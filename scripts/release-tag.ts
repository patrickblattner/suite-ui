#!/usr/bin/env node
// The only way to tag a release (SUI-FEATURE-076): tags HEAD as `v<package.json version>` and pushes
// the tag, but only when the CI workflow has a successful push run on exactly that commit.
//
//   npm run release:tag

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const WORKFLOW = "ci.yml";

// A failing command refuses the tag with its own message, never with a stack trace.
const run = (cmd: string, args: string[]): string => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? String(error);
    console.error(`release:tag: ${cmd} ${args[0]} failed — ${stderr.trim()}`);
    process.exit(1);
  }
};

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
  version: string;
};
const tag = `v${version}`;
const sha = run("git", ["rev-parse", "HEAD"]);

type Run = { databaseId: number; status: string; conclusion: string };

const runs = JSON.parse(
  run("gh", [
    "run",
    "list",
    "--workflow",
    WORKFLOW,
    "--commit",
    sha,
    "--event",
    "push",
    "--json",
    "databaseId,status,conclusion",
  ]),
) as Run[];
const green = runs.find((r) => r.status === "completed" && r.conclusion === "success");
if (!green) {
  const seen = runs.map((r) => `${r.databaseId} ${r.status}/${r.conclusion || "-"}`).join(", ");
  console.error(
    `release:tag: no green ${WORKFLOW} run on ${sha} (${seen || "no run"}) — ${tag} not created`,
  );
  process.exit(1);
}

run("git", ["tag", tag, sha]);
run("git", ["push", "origin", tag]);
console.log(`release:tag: ${tag} on ${sha} (green run ${green.databaseId})`);
