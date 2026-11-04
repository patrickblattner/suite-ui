// Pre-push hook (#794; PROC-DEV-005 rev 6, PROC-REL-017), installed by `simple-git-hooks` from
// `prepare`. Git hands it the remote name as its first argument and the pushed refs on stdin, one
// line `<local ref> <local sha> <remote ref> <remote sha>` each.
//
//   1. Secret guard, always, on every pushed ref: gitleaks (the version hygiene pins) over the
//      commits the ref pushes. No marker skips it; a range git cannot list refuses the push.
//   2. `spec-sync gate --profile merge --preflight`, then `spec-sync repin --check`, on each pushed
//      tip's own tree (exit 2 of the pin check: the spec server is unreachable, it passes).
//   3. 2 is skipped when the push only deletes refs (no tree), or when refs/heads/main is not pushed
//      and every pushed tip's subject starts with `wip:` — the loss-protection push of a red state.
//      An unreadable tip counts as unmarked.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// The gitleaks hygiene pins (`TOOL_VERSIONS` in hygiene.ts; a test holds the two equal). Node needs a
// `.ts` path to import hygiene.ts at run time and the typecheck forbids one, so the hook imports none.
export const GITLEAKS_VERSION = "8.30.1";
// gitleaks exits 1 on a leak and on its own errors alike; a code of our own tells them apart.
const LEAK_EXIT = 42;
const ZERO = /^0+$/;

export type PushedRef = {
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
};

export function parseRefs(stdin: string): PushedRef[] {
  return stdin
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length === 4)
    .map(([localRef, localSha, remoteRef, remoteSha]) => ({
      localRef: localRef!,
      localSha: localSha!,
      remoteRef: remoteRef!,
      remoteSha: remoteSha!,
    }));
}

export const isWipSubject = (subject: string): boolean => /^wip:/i.test(subject.trim());

const tipsOf = (refs: PushedRef[]) => refs.filter((ref) => !ZERO.test(ref.localSha));

// The commits each ref pushes, as git revision arguments; a deleted ref pushes none. A remote tip
// this clone does not hold (a force push over an unfetched advance) cannot bound a range, so the
// range falls back to what the pushed remote's tracking refs do not reach.
export function scanRanges(
  refs: PushedRef[],
  remote: string,
  hasCommit: (sha: string) => boolean,
): string[][] {
  return tipsOf(refs).map((ref) =>
    !ZERO.test(ref.remoteSha) && hasCommit(ref.remoteSha)
      ? [`${ref.remoteSha}..${ref.localSha}`]
      : [ref.localSha, "--not", `--remotes=${remote}`],
  );
}

export type CheckPlan = { run: boolean; line?: string };

export function checkPlan(refs: PushedRef[], isWip: (sha: string) => boolean): CheckPlan {
  const tips = tipsOf(refs);
  if (tips.length === 0) {
    return {
      run: false,
      line: "• pre-push: the push only deletes refs — no tree pushed, preflight and pin check skipped",
    };
  }
  const wip = tips.filter((ref) => isWip(ref.localSha));
  if (refs.some((ref) => ref.remoteRef === "refs/heads/main")) {
    return wip.length === 0
      ? { run: true }
      : {
          run: true,
          line: "• pre-push: `wip:` not honoured — refs/heads/main is pushed, the full set runs",
        };
  }
  if (wip.length === tips.length) {
    return {
      run: false,
      line: "• pre-push: WIP tip (`wip:`) on a non-main ref — preflight and repin --check skipped; the secret guard ran",
    };
  }
  return wip.length === 0
    ? { run: true }
    : {
        run: true,
        line: "• pre-push: `wip:` not honoured — not every pushed tip is a `wip:` commit, the full set runs",
      };
}

const git = (args: string[], cwd?: string) =>
  spawnSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function subjectIsWip(sha: string): boolean {
  const run = git(["log", "-1", "--format=%s", sha]);
  return run.status === 0 && isWipSubject(run.stdout);
}

const hasCommit = (sha: string) => git(["cat-file", "-e", `${sha}^{commit}`]).status === 0;

function refuse(...lines: string[]): never {
  for (const line of lines) console.error(line);
  process.exit(1);
}

// Returns the refusal lines, or nothing when every pushed commit is scanned clean.
function guard(refs: PushedRef[], remote: string): string[] | undefined {
  const version = spawnSync("gitleaks", ["version"], { encoding: "utf8" });
  const found = version.status === 0 ? version.stdout.trim() : "none";
  if (found !== GITLEAKS_VERSION) {
    return [
      `push refused: the secret guard needs gitleaks ${GITLEAKS_VERSION}, found ${found}`,
      `  install gitleaks ${GITLEAKS_VERSION} (the version scripts/hygiene.ts pins) and push again`,
    ];
  }
  const report = mkdtempSync(join(tmpdir(), "suite-ui-pre-push-leaks-"));
  try {
    for (const range of scanRanges(refs, remote, hasCommit)) {
      // gitleaks reports a range git cannot list as "no leaks"; git decides first.
      const list = git(["rev-list", "--quiet", ...range]);
      if (list.status !== 0) {
        return [
          `push refused: the secret guard cannot list the pushed commits (${range.join(" ")})`,
          `  ${list.stderr.trim().split("\n")[0] ?? ""}`,
        ];
      }
      const path = join(report, "leaks.json");
      const scan = spawnSync(
        "gitleaks",
        [
          "git",
          "--no-banner",
          "--redact",
          "--exit-code",
          String(LEAK_EXIT),
          "--report-format",
          "json",
          "--report-path",
          path,
          "--log-opts",
          range.join(" "),
          ".",
        ],
        { stdio: ["ignore", "ignore", "inherit"] },
      );
      if (scan.status === LEAK_EXIT) {
        const leaks = JSON.parse(readFileSync(path, "utf8")) as {
          Commit: string;
          File: string;
          RuleID: string;
        }[];
        return [
          "push refused: the secret guard found a secret",
          ...leaks.map(
            (leak) =>
              `  commit ${leak.Commit.slice(0, 12)}, file ${leak.File} (gitleaks rule ${leak.RuleID})`,
          ),
          "  take it out of that commit (amend or rebase), rotate the secret, and push again",
        ];
      }
      if (scan.status !== 0) {
        return [
          `push refused: the secret guard could not scan (gitleaks exit ${scan.status ?? scan.signal})`,
          "  nothing was found and nothing was proven clean; fix gitleaks and push again",
        ];
      }
    }
  } finally {
    rmSync(report, { recursive: true, force: true });
  }
  return undefined;
}

// The pushed tip's own tree: the working tree when it is that commit and clean, else a throwaway
// worktree of the commit that borrows this checkout's install.
function withTree<T>(sha: string, check: (cwd: string) => T): T {
  const here = process.cwd();
  if (
    git(["rev-parse", "HEAD"]).stdout.trim() === sha &&
    git(["status", "--porcelain"]).stdout === ""
  ) {
    return check(here);
  }
  const dir = join(mkdtempSync(join(tmpdir(), "suite-ui-pre-push-")), "tree");
  execFileSync("git", ["worktree", "add", "-q", "--detach", dir, sha], { stdio: "ignore" });
  try {
    if (existsSync(join(here, "node_modules"))) {
      symlinkSync(join(here, "node_modules"), join(dir, "node_modules"));
    }
    return check(dir);
  } finally {
    git(["worktree", "remove", "--force", dir]);
    rmSync(join(dir, ".."), { recursive: true, force: true });
  }
}

// Returns the refusal lines, or nothing when the tip may go.
function checks(sha: string, cwd: string): string[] | undefined {
  const preflight = spawnSync("npx", ["spec-sync", "gate", "--profile", "merge", "--preflight"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (preflight.status !== 0) {
    let result: { failures?: { name: string }[]; logDir?: string } = {};
    try {
      result = JSON.parse(preflight.stdout) as typeof result;
    } catch {
      // No JSON: the exit code is all there is.
    }
    const phases = (result.failures ?? []).map((failure) => failure.name).join(", ");
    return [
      preflight.status === 2
        ? `push refused: merge preflight unprovable (exit 2) for ${sha.slice(0, 12)} — not green`
        : `push refused: merge preflight red for ${sha.slice(0, 12)} (exit ${preflight.status ?? preflight.signal})`,
      ...(phases === "" ? [] : [`  failing phases: ${phases}`]),
      ...(result.logDir === undefined ? [] : [`  logs: ${result.logDir}`]),
      "  next: fix what failed and commit, or commit the state as `wip: …` and push it to a branch other than main",
    ];
  }
  const pins = spawnSync("npx", ["spec-sync", "repin", "--check"], {
    cwd,
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (pins.status === 2) {
    console.error("• pre-push: spec server unreachable — pin check skipped");
  } else if (pins.status === 1) {
    return [
      "push refused: spec pins owed — run `npx spec-sync repin` and commit `spec-pins.json` + drift coverage",
    ];
  } else if (pins.status !== 0) {
    return [`push refused: spec pin check failed (exit ${pins.status ?? pins.signal})`];
  }
  return undefined;
}

function main(): void {
  // A tip checked in a worktree of its own must not be read through the pushing checkout's git env.
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete process.env[name];
  const remote = process.argv[2] ?? "origin";
  const refs = parseRefs(readFileSync(0, "utf8"));
  const leaked = guard(refs, remote);
  if (leaked !== undefined) refuse(...leaked);
  const plan = checkPlan(refs, subjectIsWip);
  if (plan.line !== undefined) console.log(plan.line);
  if (!plan.run) return;
  for (const sha of new Set(tipsOf(refs).map((ref) => ref.localSha))) {
    const refused = withTree(sha, (cwd) => checks(sha, cwd));
    if (refused !== undefined) refuse(...refused);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
