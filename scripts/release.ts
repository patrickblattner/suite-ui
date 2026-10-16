#!/usr/bin/env node
// Tags only from a green local gate run on exactly the tagged content (SUI-FEATURE-076).
//
//   npm run gate:record [-- --issue <n>] [--run <id>]   # merge gate; on green, record it for HEAD's tree
//   npm run release:tag                    # tag HEAD on `main` as v<version> and push, only with that record
//   npm run release:tag -- --dry-run       # all checks, no tag, no push
//
// After the push, `tag` runs the Codex review of the range from the previous tag
// (`spec-sync review tag <prev>..<new>`, PROC-DEV-003). Its verdict never undoes the tag; the log line comes
// from `outcome` of its JSON on stdout: clean, findings, skipped (Codex down or at its limit — logged,
// no Claude fallback), already reviewed or an empty range. Exit 2 is unprovable and is rerun by hand.
//
// `record` writes `.spec-sync/gate-records/<tree hash>.json` only on exit 0 with a clean working tree
// before and after the run, and only when exactly the merge profile's phases ran. Before the gate it
// compares every installed version with package-lock.json and runs `npm ls --all`; a difference ends
// with exit 4 and no record.
// The record is keyed by the tree, not the commit, so a squash commit with the gated content finds
// it without a second run. `tag` is the only way to tag; it refuses
// without a green record for HEAD's tree, on a dirty working tree and off `main`.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8" }).trim();

const isClean = (): boolean => git("status", "--porcelain") === "";

const fail = (why: string): never => {
  console.error(`release ${mode}: ${why}`);
  process.exit(1);
};

// In the main checkout, also for a run in a worktree: the worktree is removed after the merge, the
// tag is made on `main`.
function recordPath(tree: string): string {
  const common = git("rev-parse", "--path-format=absolute", "--git-common-dir");
  const root = basename(common) === ".git" ? dirname(common) : git("rev-parse", "--show-toplevel");
  return join(root, ".spec-sync", "gate-records", `${tree}.json`);
}

// Every `packages` entry of package-lock.json against its installed package.json, offline. An optional
// package that is not installed (a platform build for another machine) does not count. Returns the
// first differences as `<path> <locked> ≠ <installed>`.
function lockfileDrift(): string[] {
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
    packages: Record<string, { version?: string; optional?: boolean; link?: boolean }>;
  };
  const drift: string[] = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === "" || entry.link || entry.version === undefined) continue;
    const manifest = join(path, "package.json");
    if (!existsSync(manifest)) {
      if (!entry.optional) drift.push(`${path} ${entry.version} ≠ missing`);
    } else {
      const { version } = JSON.parse(readFileSync(manifest, "utf8")) as { version?: string };
      if (version !== entry.version) drift.push(`${path} ${entry.version} ≠ ${version}`);
    }
    if (drift.length === 5) break;
  }
  return drift;
}

function noRecord(): never {
  console.error("release record: `npm ci` im Haupt-Checkout — no gate run, no record");
  process.exit(4);
}

// Only the ledger arguments go through: a second `--profile` would win in the gate and record another
// profile's run as the merge gate.
const RECORD_ARGS = ["--issue", "--run"];

function mergePhases(): string[] {
  const config = JSON.parse(
    readFileSync(new URL("../spec-sync.config.json", import.meta.url), "utf8"),
  ) as {
    gate: { profiles: { merge: string[] } };
  };
  return config.gate.profiles.merge;
}

function record(gateArgs: string[]): void {
  for (let i = 0; i < gateArgs.length; i += 2) {
    if (!RECORD_ARGS.includes(gateArgs[i] ?? "") || gateArgs[i + 1] === undefined) {
      fail(
        `only ${RECORD_ARGS.map((a) => `${a} <value>`).join(" and ")} go to the gate, not "${gateArgs[i]}"`,
      );
    }
  }
  // The installed packages have to be exactly the lockfile's; a stale install gates other code than
  // HEAD's. Installing is never this script's job: the main checkout is also the owner's working copy.
  const drift = lockfileDrift();
  if (drift.length > 0) {
    console.error(
      `release record: installed packages differ from package-lock.json: ${drift.join(", ")}`,
    );
    noRecord();
  }
  // `npm ls` adds what the lockfile comparison does not see: a version outside its declared range.
  const ls = spawnSync("npm", ["ls", "--all"], { encoding: "utf8" });
  if (ls.status !== 0) {
    const first = `${ls.stderr}${ls.stdout}`.split("\n").find((l) => /ERR|missing|invalid/.test(l));
    console.error(`release record: npm ls reports an error${first ? ` (${first.trim()})` : ""}`);
    noRecord();
  }
  if (!isClean()) fail("the working tree has uncommitted changes — no record");
  const tree = git("rev-parse", "HEAD^{tree}");
  const commit = git("rev-parse", "HEAD");

  const gate = spawnSync(
    "npx",
    ["--no-install", "spec-sync", "gate", "--profile", "merge", ...gateArgs],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  process.stdout.write(gate.stdout);
  const exit = gate.status ?? 1;
  if (exit !== 0) process.exit(exit);
  if (!isClean() || git("rev-parse", "HEAD^{tree}") !== tree) {
    fail("the working tree changed during the gate run — no record");
  }

  const { logDir, phases = [] } = JSON.parse(gate.stdout) as {
    logDir?: string;
    phases?: { name: string; skipped: boolean; exit: number }[];
  };
  const ran = phases.filter((p) => !p.skipped && p.exit === 0).map((p) => p.name);
  if (ran.join(",") !== mergePhases().join(",")) {
    fail(`the gate ran ${ran.join(",") || "no phase"}, not the merge profile — no record`);
  }
  const path = recordPath(tree);
  mkdirSync(dirname(path), { recursive: true });
  const at = new Date().toISOString();
  writeFileSync(
    path,
    `${JSON.stringify({ tree, commit, profile: "merge", phases: ran, exit, logDir, at }, null, 2)}\n`,
  );
  console.error(`release record: green merge gate recorded for tree ${tree} (${commit})`);
}

function tag(args: string[]): void {
  const unknown = args.filter((a) => a !== "--dry-run");
  if (unknown.length > 0) fail(`unknown argument ${unknown.join(" ")} — no tag`);
  const dryRun = args.includes("--dry-run");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  const name = `v${pkg.version}`;
  if (!isClean()) fail(`the working tree has uncommitted changes — ${name} not created`);
  if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main")
    fail(`HEAD is not on main — ${name} not created`);
  const commit = git("rev-parse", "HEAD");
  if (spawnSync("git", ["merge-base", "--is-ancestor", commit, "origin/main"]).status !== 0) {
    fail(`${commit} is not on origin/main (push main first) — ${name} not created`);
  }
  if (spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${name}`]).status === 0) {
    fail(`${name} exists already — no tag`);
  }
  const describe = spawnSync("git", ["describe", "--tags", "--abbrev=0", "--match", "v*", commit], {
    encoding: "utf8",
  });
  const previous = describe.status === 0 ? describe.stdout.trim() : "";
  const path = recordPath(git("rev-parse", "HEAD^{tree}"));
  if (!existsSync(path)) {
    fail(`no green gate record for ${commit} (run npm run gate:record) — ${name} not created`);
  }
  const gate = JSON.parse(readFileSync(path, "utf8")) as { profile?: string; exit?: number };
  if (gate.profile !== "merge" || gate.exit !== 0) {
    fail(`the gate record ${path} is not green — ${name} not created`);
  }

  if (dryRun) {
    console.log(
      `release tag: ${name} on ${commit} would be created (gate record ${path}), dry run`,
    );
    return;
  }
  git("tag", name, commit);
  if (spawnSync("git", ["push", "origin", name], { stdio: "inherit" }).status !== 0) {
    git("tag", "-d", name);
    fail(`pushing ${name} failed — the local tag is deleted again`);
  }
  console.log(`release tag: ${name} on ${commit} (gate record ${path})`);
  review(previous, name);
}

function review(previous: string, name: string): void {
  if (previous === "") {
    console.error(`release tag: no previous tag before ${name} — no Codex review`);
    return;
  }
  const range = `${previous}..${name}`;
  const run = spawnSync("npx", ["--no-install", "spec-sync", "review", "tag", range], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  process.stdout.write(run.stdout ?? "");
  const log = (what: string) => console.error(`release tag: Codex review ${range} ${what}`);
  if (run.status === null)
    return log(`did not run (${run.error?.message ?? "no exit code"}) — ${name} stays`);
  if (run.status === 2) return log(`unprovable (exit 2), rerun npx spec-sync review tag ${range}`);
  // The toolkit's envelope is flat: outcome, class and error sit next to command, ok, exit and notes.
  let result: { notes?: string[]; outcome?: string; class?: string; error?: string } = {};
  try {
    result = JSON.parse(run.stdout) as typeof result;
  } catch {
    // no JSON on stdout: the outcome stays unreadable
  }
  const { outcome, error } = result;
  const note = result.notes?.[0] ?? "";
  if (run.status === 1 && outcome === "findings")
    log(`has critical/high findings open — ${name} stays`);
  else if (run.status !== 0 || outcome === undefined)
    log(
      `ended with exit ${run.status}, outcome ${outcome ?? "unreadable"}${error ? ` (${error})` : ""} — ${name} stays`,
    );
  else if (outcome === "clean") log("clean");
  else if (outcome === "findings") log("has findings below high — follow-up tickets");
  else if (outcome === "skipped")
    log(`skipped — ${result.class ?? ""} (logged, no Claude fallback; rerun to review ${name})`);
  else if (outcome === "already-reviewed") log(`already reviewed — ${note}`);
  else if (outcome === "not-triaged") log("is empty — no Codex call");
  else log(`ended with outcome ${outcome} — ${name} stays`);
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === "record") record(rest);
else if (mode === "tag") tag(rest);
else fail("usage: node scripts/release.ts record [--issue <n>] [--run <id>] | tag [--dry-run]");
