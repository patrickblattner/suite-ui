// Pre-push hook (#794; PROC-DEV-005 rev 6, PROC-REL-017), installed by `simple-git-hooks` from
// `prepare`. Git hands it the remote name as its first argument and the pushed refs on stdin, one
// line `<local ref> <local sha> <remote ref> <remote sha>` each.
//
//   1. Secret guard, always, on every pushed ref: gitleaks (the version hygiene pins) over the
//      commits the ref pushes. No marker skips it; a range git cannot list refuses the push.
//   2. `spec-sync prepush` (the light preflight, fed the pushed refs), then `spec-sync repin --check`, on each pushed
//      tip's own tree (exit 2 of the pin check: the spec server is unreachable, it passes).
//   3. 2 is skipped when the push only deletes refs (no tree), or when refs/heads/main is not pushed
//      and every pushed tip's subject starts with `wip:` — the loss-protection push of a red state.
//      An unreadable tip counts as unmarked.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { resolveUnder } from "./resolve-under.ts";

// The gitleaks hygiene pins (`TOOL_VERSIONS` in hygiene.ts; a test holds the two equal). Node needs a
// `.ts` path to import hygiene.ts at run time and the typecheck forbids one, so the hook imports none.
export const GITLEAKS_VERSION = "8.30.1";
// gitleaks exits 1 on a leak and on its own errors alike; a code of our own tells them apart.
const LEAK_EXIT = 42;
const ZERO = /^0+$/;
// git log prints no patch for a merge by default. The first pass scans every commit, a two-parent
// merge by what its resolution added (remerge); remerge prints nothing for a merge of 3+ parents,
// so the second scans those against their first parent, which shows all they add beyond it (#811).
// Hygiene's GITLEAKS_PASSES scans history the same way (a test holds the two equal).
export const MERGE_PASSES = [
  ["--diff-merges=remerge"],
  ["--min-parents=3", "--diff-merges=first-parent"],
] as const;

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

// The buffer hygiene's run() allows, so a large file shown for the octopus rule is read whole.
const git = (args: string[], cwd?: string) =>
  spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 512 * 1024 * 1024,
  });

function subjectIsWip(sha: string): boolean {
  const run = git(["log", "-1", "--format=%s", sha]);
  return run.status === 0 && isWipSubject(run.stdout);
}

type Leak = { Commit: string; File: string; StartLine: number; EndLine: number };

// Hygiene's octopusOwnLeaks, for the hook (a test holds the two equal on a table of cases): the
// octopus pass diffs against the first parent, so it also shows what the other parents bring in. A
// finding whose whole block (StartLine..EndLine — a multi-line key in full, not by its shared BEGIN
// line) one of the merge's parents already holds in that file came with that parent: the first
// pass found it there (or .gitleaksignore excused it there). Only blocks the merge itself adds
// count; an unreadable block counts (#814).
export function octopusOwnLeaks<T extends Leak>(leaks: T[], cwd?: string): T[] {
  const fileText = (rev: string, file: string): string | undefined => {
    const shown = git(["show", `${rev}:${file}`], cwd);
    return shown.status === 0 ? `\n${shown.stdout}\n` : undefined;
  };
  return leaks.filter((leak) => {
    const lines = fileText(leak.Commit, leak.File)?.split("\n") ?? [];
    const block = lines.slice(leak.StartLine, leak.EndLine + 1);
    if (!(leak.EndLine >= leak.StartLine) || block.length !== leak.EndLine - leak.StartLine + 1)
      return true;
    const [, ...parents] = git(["rev-list", "--parents", "-n", "1", leak.Commit], cwd)
      .stdout.trim()
      .split(" ");
    const wanted = `\n${block.join("\n")}\n`;
    return parents.every((parent) => !fileText(parent, leak.File)?.includes(wanted));
  });
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
      for (const pass of MERGE_PASSES) {
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
            [...pass, ...range].join(" "),
            ".",
          ],
          { stdio: ["ignore", "ignore", "inherit"] },
        );
        const found =
          scan.status === LEAK_EXIT
            ? // eslint-disable-next-line security/detect-non-literal-fs-filename -- root: the mkdtemp dir this function created; form (1): + literal leaks.json
              (JSON.parse(readFileSync(path, "utf8")) as (Leak & { RuleID: string })[])
            : [];
        const leaks = pass === MERGE_PASSES[1] ? octopusOwnLeaks(found) : found;
        if (leaks.length > 0) {
          return [
            "push refused: the secret guard found a secret",
            ...leaks.map(
              (leak) =>
                `  commit ${leak.Commit.slice(0, 12)}, file ${leak.File} (gitleaks rule ${leak.RuleID})`,
            ),
            "  take it out of that commit (amend or rebase), rotate the secret, and push again",
          ];
        }
        if (scan.status !== 0 && scan.status !== LEAK_EXIT) {
          return [
            `push refused: the secret guard could not scan (gitleaks exit ${scan.status ?? scan.signal})`,
            "  nothing was found and nothing was proven clean; fix gitleaks and push again",
          ];
        }
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
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- root: process.cwd() (operator root, the checkout the human's git push runs the hook in); form (1): + literal node_modules
    if (existsSync(join(here, "node_modules"))) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- roots: process.cwd() (operator root) and the mkdtemp dir this function created; form (1): each + literal node_modules (dir = mkdtemp + literal tree)
      symlinkSync(join(here, "node_modules"), join(dir, "node_modules"));
    }
    return check(dir);
  } finally {
    git(["worktree", "remove", "--force", dir]);
    rmSync(join(dir, ".."), { recursive: true, force: true });
  }
}

// The preflight's verdict by exit code (toolkit: 1 red, 2 unprovable, 3 ambiguous, 4 precondition
// violated): the head line and what to do next.
const VERDICT: Record<number, { head: string; next: string }> = {
  1: { head: "red", next: "fix what failed and commit" },
  2: { head: "unprovable — not green", next: "repeat the push (nothing was proven)" },
  3: { head: "ambiguous — not green", next: "settle the reason above, then push again" },
  4: { head: "precondition not met", next: "fix the reason above, then push again" },
};

// A log dir inside a throwaway worktree dies with it; it is copied to the same path in this checkout.
export function keptLogs(logDir: string, cwd: string): string {
  const here = process.cwd();
  // logDir is a field of the gate's JSON (GL-CODE-020 form 3). A log dir outside the worktree does
  // not die with it and stays where it is; the worktree root itself is no log dir and is never copied.
  const source = resolveUnder(cwd, logDir);
  if (source === undefined) return resolve(cwd, logDir);
  const kept = resolveUnder(here, relative(cwd, source));
  if (kept === undefined) return source;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- roots: cwd (the mkdtemp worktree) and process.cwd() (operator root, the checkout the hook runs in); form (3): source and kept both come from resolveUnder
  if (kept !== source && existsSync(source)) cpSync(source, kept, { recursive: true });
  return kept;
}

// Returns the refusal lines, or nothing when the tip may go.
function checks(sha: string, cwd: string, stdin: string): string[] | undefined {
  const preflight = spawnSync("npx", ["spec-sync", "prepush"], {
    cwd,
    encoding: "utf8",
    input: stdin,
    stdio: ["pipe", "pipe", "inherit"],
  });
  if (preflight.status !== 0) {
    let result: {
      failures?: { name: string }[];
      logDir?: string;
      error?: string;
      notes?: string[];
    } = {};
    try {
      result = JSON.parse(preflight.stdout) as typeof result;
    } catch {
      // No JSON: the exit code is all there is.
    }
    const code = preflight.status ?? preflight.signal;
    const verdict = (typeof code === "number" ? VERDICT[code] : undefined) ?? {
      head: "failed — not green",
      next: "look at the output above, then push again",
    };
    const phases = (result.failures ?? []).map((failure) => failure.name).join(", ");
    return [
      `push refused: merge preflight ${verdict.head} for ${sha.slice(0, 12)} (exit ${code})`,
      ...(result.error === undefined ? [] : [`  reason: ${result.error}`]),
      ...(result.notes ?? []).map((note) => `  note: ${note}`),
      ...(phases === "" ? [] : [`  failing phases: ${phases}`]),
      ...(result.logDir === undefined ? [] : [`  logs: ${keptLogs(result.logDir, cwd)}`]),
      `  next: ${verdict.next}, or commit the state as \`wip: …\` and push it to a branch other than main`,
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
      "push refused: spec pins owed — run the `npx spec-sync repin --ids <keys>` the check printed above and commit `spec-pins.json` + drift coverage",
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
  const stdin = readFileSync(0, "utf8");
  const refs = parseRefs(stdin);
  const leaked = guard(refs, remote);
  if (leaked !== undefined) refuse(...leaked);
  const plan = checkPlan(refs, subjectIsWip);
  if (plan.line !== undefined) console.log(plan.line);
  if (!plan.run) return;
  for (const sha of new Set(tipsOf(refs).map((ref) => ref.localSha))) {
    const refused = withTree(sha, (cwd) => checks(sha, cwd, stdin));
    if (refused !== undefined) refuse(...refused);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
