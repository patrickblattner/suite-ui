#!/usr/bin/env node
// Gate phase `lint` (`npm run lint`): ESLint over the whole repo, without a cache (Q#5690). The JSON
// report stays under .spec-sync/eslint/ beside the tree fingerprint it linted, so phase `hygiene`
// counts the `security` and complexity rules from it instead of linting again (#862, Q#5689). The
// terminal gets ESLint's usual `stylish` output; the exit code is ESLint's.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { ESLINT_DIR, eslintArgs, recordLintRun, treeFingerprint } from "./hygiene.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const report = join(ESLINT_DIR, "report.json");

// Taken before linting: a file changed during the run makes the fingerprints differ later.
const status = recordLintRun(
  ESLINT_DIR,
  treeFingerprint(),
  (file) =>
    spawnSync(join(root, "node_modules", ".bin", "eslint"), eslintArgs(file), {
      cwd: root,
      stdio: "inherit",
    }).status,
);

// eslint-disable-next-line security/detect-non-literal-fs-filename -- root: the repo root (module URL); form (1): + literal .spec-sync/eslint/report.json
if (existsSync(report)) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- root: the repo root (module URL); form (1): + literal .spec-sync/eslint/report.json
  const results = JSON.parse(readFileSync(report, "utf8")) as ESLint.LintResult[];
  const stylish = await new ESLint({ cwd: root }).loadFormatter("stylish");
  const text = await stylish.format(results);
  if (text) console.log(text);
}
process.exit(status ?? 1);
