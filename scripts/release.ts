#!/usr/bin/env node
// Tags only from a green local gate run on exactly the tagged content (SUI-FEATURE-076).
//
//   npm run gate:record [-- --issue <n>]   # merge gate; on green, record it for HEAD's tree
//   npm run release:tag                    # tag HEAD as v<version> and push, only with that record
//
// `record` writes `.spec-sync/gate-records/<tree hash>.json` only on exit 0 with a clean working tree
// before and after the run. The record is keyed by the tree, not the commit, so a squash commit
// with the gated content finds it without a second run. `tag` is the only way to tag; it refuses
// without a green record for HEAD's tree and on a dirty working tree.

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

function record(gateArgs: string[]): void {
  if (!isClean()) fail("the working tree has uncommitted changes — no record");
  const tree = git("rev-parse", "HEAD^{tree}");
  const commit = git("rev-parse", "HEAD");

  const gate = spawnSync("npx", ["spec-sync", "gate", "--profile", "merge", ...gateArgs], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  process.stdout.write(gate.stdout);
  const exit = gate.status ?? 1;
  if (exit !== 0) process.exit(exit);
  if (!isClean() || git("rev-parse", "HEAD^{tree}") !== tree) {
    fail("the working tree changed during the gate run — no record");
  }

  const { logDir } = JSON.parse(gate.stdout) as { logDir?: string };
  const path = recordPath(tree);
  mkdirSync(dirname(path), { recursive: true });
  const at = new Date().toISOString();
  writeFileSync(
    path,
    `${JSON.stringify({ tree, commit, profile: "merge", exit, logDir, at }, null, 2)}\n`,
  );
  console.error(`release record: green merge gate recorded for tree ${tree} (${commit})`);
}

function tag(): void {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  const name = `v${pkg.version}`;
  if (!isClean()) fail(`the working tree has uncommitted changes — ${name} not created`);
  const commit = git("rev-parse", "HEAD");
  const path = recordPath(git("rev-parse", "HEAD^{tree}"));
  if (!existsSync(path)) {
    fail(`no green gate record for ${commit} (run npm run gate:record) — ${name} not created`);
  }
  const gate = JSON.parse(readFileSync(path, "utf8")) as { profile?: string; exit?: number };
  if (gate.profile !== "merge" || gate.exit !== 0) {
    fail(`the gate record ${path} is not green — ${name} not created`);
  }

  git("tag", name, commit);
  git("push", "origin", name);
  console.log(`release tag: ${name} on ${commit} (gate record ${path})`);
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === "record") record(rest);
else if (mode === "tag") tag();
else fail("usage: node scripts/release.ts record [gate args] | tag");
