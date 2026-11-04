// Pre-push hook (#794; PROC-DEV-005 rev 5, PROC-REL-017), installed by `simple-git-hooks` from
// `prepare`. Git hands it the pushed refs on stdin, one line `<local ref> <local sha> <remote ref>
// <remote sha>` each.
//
//   1. Secret guard, always, on every ref: gitleaks (the version hygiene pins) over each pushed range.
//      No marker skips it.
//   2. `spec-sync gate --profile merge --preflight`, then `spec-sync repin --check` (exit 2: the spec
//      server is unreachable, the check passes with a line).
//   3. 2 is skipped only when refs/heads/main is not pushed and every pushed tip's subject starts
//      with `wip:` — the loss-protection push of a red state. An unreadable tip counts as unmarked.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// The gitleaks hygiene pins (`TOOL_VERSIONS` in hygiene.ts; a test holds the two equal). Node needs a
// `.ts` path to import hygiene.ts at run time and the typecheck forbids one, so the hook imports none.
export const GITLEAKS_VERSION = "8.30.1";
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

// The commits each ref pushes, as gitleaks `--log-opts`; a deleted ref pushes none.
export function scanRanges(refs: PushedRef[]): string[] {
  return refs
    .filter((ref) => !ZERO.test(ref.localSha))
    .map((ref) =>
      ZERO.test(ref.remoteSha)
        ? `${ref.localSha} --not --remotes`
        : `${ref.remoteSha}..${ref.localSha}`,
    );
}

export function skipsChecks(refs: PushedRef[], isWip: (sha: string) => boolean): boolean {
  if (refs.some((ref) => ref.remoteRef === "refs/heads/main")) return false;
  const tips = refs.filter((ref) => !ZERO.test(ref.localSha));
  return tips.length > 0 && tips.every((ref) => isWip(ref.localSha));
}

function subjectIsWip(sha: string): boolean {
  try {
    const subject = execFileSync("git", ["log", "-1", "--format=%s", sha], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return isWipSubject(subject);
  } catch {
    return false;
  }
}

function guard(refs: PushedRef[]): void {
  const version = spawnSync("gitleaks", ["version"], { encoding: "utf8" });
  if (version.status !== 0 || version.stdout.trim() !== GITLEAKS_VERSION) {
    console.error(
      `• pre-push: secret guard needs gitleaks ${GITLEAKS_VERSION} (found ${version.stdout?.trim() || "none"}) — push refused`,
    );
    process.exit(1);
  }
  for (const range of scanRanges(refs)) {
    const scan = spawnSync(
      "gitleaks",
      ["git", "--no-banner", "--redact", "--log-opts", range, "."],
      { stdio: "inherit" },
    );
    if (scan.status !== 0) {
      console.error(`• pre-push: secret guard refused ${range} (gitleaks exit ${scan.status})`);
      process.exit(1);
    }
  }
}

function main(): void {
  const refs = parseRefs(readFileSync(0, "utf8"));
  guard(refs);
  if (skipsChecks(refs, subjectIsWip)) {
    console.log(
      "• pre-push: WIP tip (`wip:`) on a non-main ref — preflight and repin --check skipped; the secret guard ran",
    );
    return;
  }
  const preflight = spawnSync("npx", ["spec-sync", "gate", "--profile", "merge", "--preflight"], {
    stdio: "inherit",
  });
  if (preflight.status !== 0) process.exit(preflight.status ?? 1);
  const pins = spawnSync("npx", ["spec-sync", "repin", "--check"], { stdio: "inherit" });
  if (pins.status === 2) console.error("• pre-push: spec server unreachable — pin check skipped");
  else if (pins.status !== 0) process.exit(pins.status ?? 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
