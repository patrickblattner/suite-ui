// The machine lock of the gallery run (PROC-REL-040 rev 7, #794): at most one gallery run at a time,
// across all worktrees. `scripts/gallery-image.sh` calls it before the locked work:
//
//   node scripts/gallery-lock.ts <lock dir> <holder pid> <worktree root>
//
// exit 0: the lock is held for <holder pid> (it writes `pid`, `root` and the holder line `holder`);
// exit 75: the wait ran out — a non-run, never a red: either the holder outlived its cap by more
// than five minutes (look at that holder), or the wait passed the machine's allowance (a chain of
// holders; re-run).
//
// `mkdir` is atomic: whoever creates the directory holds the lock. A lock whose pid is dead, or one
// left without a pid for `LOCK_GRACE_S`, is stale and taken over: moved aside in one atomic step and
// only dropped if it is still the one judged stale; otherwise it goes back.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

// The cap of the locked work: the longest of the last five green gallery phases (25.4 min,
// 2026-11-04T12-10-53Z, no lock wait in any of them) plus a third, rounded up to the next five minutes.
// The holder ends red at it (gallery-image.sh).
export const GALLERY_CAP_MIN = 35;
const GRACE_MIN = 5;
// The only locked step on this machine, so its cap is the largest; the allowance is that plus five.
export const WAIT_ALLOWANCE_MIN = GALLERY_CAP_MIN + GRACE_MIN;
// A holder line without a readable cap.
const NO_CAP_MIN = 40;
export const LOCK_EXPIRED = 75;
const LOCK_GRACE_S = 30;
const POLL_S = 10;
const MIN = 60_000;

export function holderLine(repository: string, run: string, started: Date, cap: number): string {
  return `repository=${repository} run=${run} started=${started.toISOString()} cap=${cap}`;
}

export function parseHolder(line: string): { started?: number; cap?: number } {
  const fields = new Map(
    line
      .trim()
      .split(/\s+/)
      .map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)]),
  );
  const started = Date.parse(fields.get("started") ?? "");
  const cap = Number(fields.get("cap"));
  return {
    started: Number.isNaN(started) ? undefined : started,
    cap: /^\d+$/.test(fields.get("cap") ?? "") ? cap : undefined,
  };
}

export function repositoryOf(url: string): string {
  return /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url.trim())?.[1] ?? "?";
}

// What a waiter sees on one attempt while it cannot create the lock.
export type Seen = {
  pid?: string;
  alive: boolean;
  root?: string;
  holder?: string;
  // How long the lock directory has existed without a pid.
  noPidForMs: number;
};

export type Verdict =
  { action: "takeover" } | { action: "wait" | "expired" | "chain"; message: string };

export function judge(seen: Seen, now: number, enteredAt: number): Verdict {
  if (seen.pid ? !seen.alive : seen.noPidForMs >= LOCK_GRACE_S * 1000)
    return { action: "takeover" };
  const holder = `${seen.pid ?? "?"} (${seen.root ?? "?"})`;
  const { started, cap } = parseHolder(seen.holder ?? "");
  const raw =
    cap === undefined
      ? ` — holder line unreadable, 40 min fallback: ${JSON.stringify(seen.holder ?? "")}`
      : "";
  const deadline =
    cap === undefined
      ? (started ?? enteredAt) + NO_CAP_MIN * MIN
      : (started ?? enteredAt) + (cap + GRACE_MIN) * MIN;
  if (now > deadline) {
    return {
      action: "expired",
      message: `gallery-lock: lock deadline expired — the gallery run ${holder} outlived its cap${raw}; look at that holder, do not re-run`,
    };
  }
  if (now - enteredAt > WAIT_ALLOWANCE_MIN * MIN) {
    return {
      action: "chain",
      message: `gallery-lock: lock deadline expired — chain: waited past the ${WAIT_ALLOWANCE_MIN} min allowance, now behind ${holder}; re-run`,
    };
  }
  return { action: "wait", message: `gallery-lock: waiting for the gallery run ${holder}${raw}` };
}

export type Deps = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  alive: (pid: string) => boolean;
  log: (line: string) => void;
};

const read = (path: string) => {
  try {
    return readFileSync(path, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
};

function tryCreate(lock: string): boolean {
  try {
    mkdirSync(lock);
    return true;
  } catch {
    return false;
  }
}

function takeOver(lock: string, pid: string | undefined, log: Deps["log"]): void {
  const aside = `${lock}.stale.${process.pid}`;
  try {
    renameSync(lock, aside);
  } catch {
    return;
  }
  if (read(`${aside}/pid`) === pid) {
    log(`gallery-lock: taking over the lock of ended run ${pid ?? "without pid"}`);
    rmSync(aside, { recursive: true, force: true });
  } else if (existsSync(lock)) {
    rmSync(aside, { recursive: true, force: true });
  } else {
    try {
      renameSync(aside, lock);
    } catch {
      rmSync(aside, { recursive: true, force: true });
    }
  }
}

// Resolves to 0 once the lock is held for `pid`, or to LOCK_EXPIRED.
export async function acquire(
  lock: string,
  pid: string,
  root: string,
  repository: string,
  deps: Deps,
): Promise<number> {
  const enteredAt = deps.now();
  while (!tryCreate(lock)) {
    const owner = read(`${lock}/pid`);
    let noPidForMs = 0;
    try {
      noPidForMs = owner ? 0 : deps.now() - statSync(lock).mtimeMs;
    } catch {
      continue;
    }
    const verdict = judge(
      {
        pid: owner,
        alive: owner ? deps.alive(owner) : false,
        root: read(`${lock}/root`),
        holder: read(`${lock}/holder`),
        noPidForMs,
      },
      deps.now(),
      enteredAt,
    );
    if (verdict.action === "takeover") {
      takeOver(lock, owner, deps.log);
      continue;
    }
    deps.log(verdict.message);
    if (verdict.action !== "wait") {
      deps.log(`gallery-lock: the lock is ${lock}`);
      return LOCK_EXPIRED;
    }
    await deps.sleep(POLL_S * 1000);
  }
  writeFileSync(`${lock}/pid`, `${pid}\n`);
  writeFileSync(`${lock}/root`, `${root}\n`);
  writeFileSync(
    `${lock}/holder`,
    `${holderLine(repository, `${pid}@${basename(root)}`, new Date(deps.now()), GALLERY_CAP_MIN)}\n`,
  );
  return 0;
}

async function main(): Promise<void> {
  const [lock, pid, root] = process.argv.slice(2);
  if (!lock || !pid || !root) {
    console.error("usage: gallery-lock.ts <lock dir> <holder pid> <worktree root>");
    process.exit(4);
  }
  let origin = "";
  try {
    origin = execFileSync("git", ["-C", root, "remote", "get-url", "origin"], { encoding: "utf8" });
  } catch {
    // No origin: the holder line names the repository `?`.
  }
  const code = await acquire(lock, pid, root, repositoryOf(origin), {
    now: Date.now,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    alive: (owner) => {
      try {
        process.kill(Number(owner), 0);
        return true;
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === "EPERM";
      }
    },
    log: (line) => console.error(line),
  });
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
