#!/usr/bin/env node
// Weekly growth measurement without a model (SUI-FEATURE-139, PROC-REL-080 §Sunday).
//
//   npm run growth:metrics    # writes .spec-sync/growth/growth-<ISO-year>-W<week>.json in the main checkout
//
// Every number in the file stands as { value, previous, delta } against the newest earlier week's
// file (`previous`/`delta` are null for a value the earlier file does not have); list entries are
// matched by their `name`, `source`, `module` or `path`. Files of weeks eight or more weeks back are
// deleted. Sources: the package build (dist/ and size-limit), quality-baseline.json, the git history of
// the measure files, package.json and package-lock.json, tracked source files (lines counted
// in-script, scc's code/comment/blank split), FTA (`fta-cli`), cognitive complexity and the cleanness
// counts (`eslint-plugin-sonarjs` and typescript-eslint through the ESLint API, never part of the lint
// config or the gate), `type-coverage`, chunk composition (`source-map-explorer` over a source-map
// build in a temporary directory), `git log`, dependency-cruiser, the spec-sync ledger and — the only
// network — `gh` for the week's merged PRs labelled `growth-review` (the raises). No model, never the
// spec server: the week's collector rows are read by the Overmind itself (SUI-FEATURE-139 rev 3).

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type Exec = (command: string, args: string[], cwd: string) => string;

// Returns stdout whatever the exit code (dependency-cruiser and size-limit exit non-zero on findings);
// a command that cannot start or writes nothing to stdout on failure is an error.
export const exec: Exec = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  if (result.status !== 0 && result.stdout.trim() === "") {
    throw new Error(
      `${command} ${args.join(" ")} exited ${result.status}: ${result.stderr.slice(0, 300)}`,
    );
  }
  return result.stdout;
};

const DAY = 24 * 60 * 60 * 1000;
export const KEEP_WEEKS = 8;
export const COMPLEXITY_THRESHOLD = 15; // eslint-plugin-sonarjs default for cognitive-complexity
const SOURCE = /\.(ts|tsx|js|jsx|cjs|mjs)$/;
const MEASURE_FILES = ["quality-baseline.json", "size-limit-lines.json"];

const bin = (root: string, name: string) => join(root, "node_modules", ".bin", name);
const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;
const byValueDesc = (a: [string, number], b: [string, number]) =>
  b[1] - a[1] || a[0].localeCompare(b[0]);

// --- metrics ------------------------------------------------------------------------------------

// Every file under `dir` whose name matches `pattern`, as absolute paths in sorted order.
function filesUnder(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return filesUnder(path, pattern);
      return pattern.test(name) ? [path] : [];
    });
}

// Every shipped chunk of the package build (tsup transpiles file by file), raw bytes.
export function chunkSizes(root: string): Record<string, number> {
  const dist = join(root, "dist");
  return Object.fromEntries(
    filesUnder(dist, /\.(js|css)$/).map((path) => [relative(dist, path), statSync(path).size]),
  );
}

export function sizeLimitSizes(run: Exec, root: string): Record<string, number> {
  const checks = JSON.parse(run(bin(root, "size-limit"), ["--json"], root)) as {
    name: string;
    size: number;
  }[];
  return Object.fromEntries(checks.map((check) => [check.name, check.size]));
}

export function ratchetCounts(root: string): Record<string, number> {
  return readJson<{ counts: Record<string, number> }>(join(root, "quality-baseline.json")).counts;
}

export interface Raise {
  commit: string;
  subject: string;
  file: string;
  key: string;
  old: number;
  new: number;
}

// The numbers a measure file holds: ratchet counts and size maxima (recommended lines follow main
// and are no raise).
export function measureValues(text: string): Record<string, number> {
  const data = JSON.parse(text) as {
    counts?: Record<string, number>;
    entries?: Record<string, { maximum: number }>;
  };
  const values: Record<string, number> = { ...data.counts };
  for (const [name, line] of Object.entries(data.entries ?? {}))
    values[`${name} maximum`] = line.maximum;
  return values;
}

// The week's raises: every commit since `since` whose change to a measure file raised a value.
export function weekRaises(run: Exec, root: string, since: string): Raise[] {
  const log = run(
    "git",
    ["log", `--since=${since}`, "--format=%H%x09%s", "--", ...MEASURE_FILES],
    root,
  );
  const raises: Raise[] = [];
  for (const line of log.split("\n").filter(Boolean)) {
    const [commit = "", subject = ""] = line.split("\t");
    for (const file of MEASURE_FILES) {
      const show = (rev: string) => {
        try {
          return measureValues(run("git", ["show", `${rev}:${file}`], root));
        } catch {
          return undefined;
        }
      };
      const before = show(`${commit}^`);
      const after = show(commit);
      if (!before || !after) continue;
      for (const [key, value] of Object.entries(after)) {
        const old = before[key];
        if (old !== undefined && value > old) {
          raises.push({ commit: commit.slice(0, 8), subject, file, key, old, new: value });
        }
      }
    }
  }
  return raises;
}

export interface PrRaise {
  number: number;
  title: string;
  url: string;
  mergedAt: string;
}

// The week's raises as PROC-REL-080 rev 5 books them: PRs merged since `since` (YYYY-MM-DD) with a
// raise, labelled `growth-review`. `gh` is the run's only network.
export function prRaises(run: Exec, root: string, since: string): PrRaise[] {
  return JSON.parse(
    run(
      "gh",
      [
        "pr",
        "list",
        "--state",
        "merged",
        "--label",
        "growth-review",
        "--search",
        `merged:>=${since}`,
        "--json",
        "number,title,url,mergedAt",
        "--limit",
        "200",
      ],
      root,
    ),
  ) as PrRaise[];
}

export function dependencies(root: string) {
  const manifest = readJson<{ dependencies?: object; devDependencies?: object }>(
    join(root, "package.json"),
  );
  const lock = readJson<{ packages: Record<string, { version?: string }> }>(
    join(root, "package-lock.json"),
  );
  const versions = new Map<string, Set<string>>();
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path.includes("node_modules/") || !entry.version) continue;
    const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
    versions.set(name, (versions.get(name) ?? new Set()).add(entry.version));
  }
  const duplicates = Object.fromEntries(
    [...versions]
      .filter(([, found]) => found.size > 1)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, found]) => [name, found.size]),
  );
  return {
    runtime: Object.keys(manifest.dependencies ?? {}).length,
    dev: Object.keys(manifest.devDependencies ?? {}).length,
    duplicatePackages: Object.keys(duplicates).length,
    duplicateVersions: duplicates,
  };
}

// src/<dir> is a module, files directly in src/ are `src`, any other top-level folder is one module.
export function moduleOf(file: string): string {
  const parts = file.split("/");
  if (parts.length === 1) return "(root)";
  if (parts[0] === "src") return parts.length > 2 ? `src/${parts[1]}` : "src";
  return parts[0]!;
}

// scc's split, counted in-script (scc is a Go binary without an npm package): blank lines, lines that
// hold only a comment, and code.
export function countLines(text: string): { code: number; comment: number; blank: number } {
  const counts = { code: 0, comment: 0, blank: 0 };
  let inBlock = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (inBlock) {
      counts.comment++;
      if (line.includes("*/")) inBlock = false;
    } else if (line === "") counts.blank++;
    else if (line.startsWith("//")) counts.comment++;
    else if (line.startsWith("/*")) {
      counts.comment++;
      inBlock = !line.includes("*/");
    } else counts.code++;
  }
  if (text.endsWith("\n")) counts.blank--;
  return counts;
}

export function linesOfCode(run: Exec, root: string) {
  const files = run("git", ["ls-files"], root)
    .split("\n")
    .filter(
      (file) => /\.(ts|tsx|js|jsx|cjs|mjs|css|sh)$/.test(file) && existsSync(join(root, file)),
    );
  const modules: Record<string, { files: number; code: number; comment: number; blank: number }> =
    {};
  for (const file of files) {
    const counted = countLines(readFileSync(join(root, file), "utf8"));
    const module = (modules[moduleOf(file)] ??= { files: 0, code: 0, comment: 0, blank: 0 });
    module.files++;
    module.code += counted.code;
    module.comment += counted.comment;
    module.blank += counted.blank;
  }
  return Object.fromEntries(Object.entries(modules).sort(([a], [b]) => a.localeCompare(b)));
}

// FTA score per tracked file (fta-cli follows .gitignore), rounded to two decimals.
export function ftaScores(run: Exec, root: string): Record<string, number> {
  const report = JSON.parse(
    run(bin(root, "fta"), [".", "--json", "--exclude-under", "0"], root),
  ) as {
    file_name: string;
    fta_score: number;
  }[];
  return Object.fromEntries(
    report
      .map((file): [string, number] => [file.file_name, Math.round(file.fta_score * 100) / 100])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

// Measured in this weekly run only, never in the lint config or the gate (PROC-REL-080 rev 4).
export const CLEANNESS_RULES = [
  "sonarjs/no-identical-functions",
  "sonarjs/no-collapsible-if",
  "sonarjs/no-redundant-jump",
  "sonarjs/prefer-immediate-return",
  "sonarjs/no-duplicate-string",
  "sonarjs/no-small-switch",
] as const;
export const TYPED_RULE = "@typescript-eslint/no-unnecessary-condition";

// The files of root's tsconfig.json program: only they have the type information TYPED_RULE needs.
async function typedFiles(root: string): Promise<Set<string>> {
  const config = join(root, "tsconfig.json");
  if (!existsSync(config)) return new Set();
  const { default: ts } = await import("typescript");
  const parsed = ts.getParsedCommandLineOfConfigFile(
    config,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  );
  return new Set((parsed?.fileNames ?? []).map((file) => relative(root, file)));
}

// One ESLint pass for cognitive complexity and the cleanness counts. Cognitive complexity per
// function: sonarjs reports every function above the threshold it is given, so with 0 it names each
// function's value; a function without a report has 0.
export async function lintMetrics(root: string, files: string[]) {
  const [{ ESLint }, { default: sonarjs }, { default: tseslint }] = await Promise.all([
    import("eslint"),
    import("eslint-plugin-sonarjs"),
    import("typescript-eslint"),
  ]);
  const typed = await typedFiles(root);
  const parserOptions = { ecmaFeatures: { jsx: true } };
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx,js,jsx,cjs,mjs}"],
        linterOptions: { reportUnusedDisableDirectives: "off" },
        languageOptions: { parser: tseslint.parser, parserOptions },
        plugins: { sonarjs, "@typescript-eslint": tseslint.plugin },
        rules: {
          "sonarjs/cognitive-complexity": ["error", 0],
          ...Object.fromEntries(CLEANNESS_RULES.map((rule) => [rule, "error"])),
        },
      },
      ...(typed.size === 0
        ? []
        : [
            {
              files: files.filter((file) => typed.has(file)),
              languageOptions: {
                parserOptions: { ...parserOptions, projectService: true, tsconfigRootDir: root },
              },
              rules: { [TYPED_RULE]: "error" as const },
            },
          ]),
    ],
  });
  const perFunction: Record<string, number> = {};
  const rules: Record<string, number> = Object.fromEntries(
    [...CLEANNESS_RULES, TYPED_RULE].map((rule) => [rule, 0]),
  );
  const perFile: Record<string, number> = {};
  for (const result of await eslint.lintFiles(files)) {
    const file = relative(root, result.filePath);
    for (const message of result.messages) {
      if (message.fatal) throw new Error(`eslint: ${file}: ${message.message}`);
      const value = /Complexity from (\d+) to/.exec(message.message)?.[1];
      if (message.ruleId === "sonarjs/cognitive-complexity" && value !== undefined) {
        perFunction[`${file}:${message.line}`] = Number(value);
      } else if (message.ruleId !== null && message.ruleId in rules) {
        rules[message.ruleId]!++;
        perFile[file] = (perFile[file] ?? 0) + 1;
      }
    }
  }
  const values = Object.values(perFunction);
  return {
    complexity: {
      threshold: COMPLEXITY_THRESHOLD,
      functions: values.length,
      aboveThreshold: values.filter((value) => value > COMPLEXITY_THRESHOLD).length,
      max: Math.max(0, ...values),
      perFunction,
    },
    cleanness: { rules, perFile: Object.fromEntries(Object.entries(perFile).sort(byValueDesc)) },
  };
}

// Share of `any` (type-coverage over tsconfig.json), in per cent of all counted identifiers.
export function anyShare(run: Exec, root: string) {
  const report = JSON.parse(
    run(bin(root, "type-coverage"), ["-p", "tsconfig.json", "--json-output"], root),
  ) as { correctCount: number; totalCount: number };
  const anyCount = report.totalCount - report.correctCount;
  return {
    anyCount,
    totalCount: report.totalCount,
    anyPercent: Math.round((anyCount / report.totalCount) * 100_000) / 1000,
  };
}

// What every chunk consists of: the package build again, with source maps, into a temporary
// directory that is removed afterwards — dist/ is never touched, so no map is ever shipped.
export function composition(run: Exec, root: string) {
  const out = realpathSync(mkdtempSync(join(tmpdir(), "growth-sourcemaps-")));
  try {
    run(
      bin(root, "tsup"),
      ["--sourcemap", "--out-dir", out, "--no-dts", "--onSuccess", "true"],
      root,
    );
    const chunks = filesUnder(out, /\.js$/);
    if (chunks.length === 0) throw new Error("composition: the source-map build wrote no chunk");
    const report = JSON.parse(
      run(bin(root, "source-map-explorer"), [...chunks, "--json", "--no-border-checks"], root),
    ) as { results?: { bundleName: string; files: Record<string, { size: number }> }[] };
    const result: Record<string, Record<string, number>> = {};
    for (const bundle of report.results ?? []) {
      const parts: Record<string, number> = {};
      for (const [source, { size }] of Object.entries(bundle.files)) {
        if (source === "[sourceMappingURL]") continue; // the comment exists only in this build
        const name = source.startsWith("[")
          ? source
          : relative(root, resolve(dirname(bundle.bundleName), source));
        parts[name] = (parts[name] ?? 0) + size;
      }
      result[relative(out, bundle.bundleName)] = parts;
    }
    return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

// Change count per file over `since` × its FTA score; the 20 highest products.
export function hotspots(run: Exec, root: string, fta: Record<string, number>, since: string) {
  const changes = new Map<string, number>();
  const log = run("git", ["log", `--since=${since}`, "--format=", "--name-only"], root);
  for (const file of log.split("\n").filter(Boolean))
    changes.set(file, (changes.get(file) ?? 0) + 1);
  const ranked = [...changes]
    .filter(([file]) => fta[file] !== undefined)
    .map(([file, count]): [string, number] => [file, Math.round(count * fta[file]! * 100) / 100])
    .sort(byValueDesc)
    .slice(0, 20);
  return ranked.map(([path, score]) => ({
    path,
    changes: changes.get(path)!,
    fta: fta[path]!,
    score,
  }));
}

export function cruise(run: Exec, root: string) {
  const report = JSON.parse(
    run(
      bin(root, "depcruise"),
      ["--config", ".dependency-cruiser.cjs", "--output-type", "json", "."],
      root,
    ),
  ) as { summary: { violations: { from: string; to: string; rule: { name: string } }[] } };
  // Split as scripts/hygiene.ts counts it: `no-circular` is a cycle, every other rule a boundary.
  const edge = (v: { from: string; to: string; rule: { name: string } }) => ({
    rule: v.rule.name,
    from: v.from,
    to: v.to,
  });
  const circular = (v: { rule: { name: string } }) => v.rule.name === "no-circular";
  return {
    cycles: report.summary.violations.filter(circular).map(edge),
    boundaryViolations: report.summary.violations.filter((v) => !circular(v)).map(edge),
  };
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length === 0
    ? 0
    : sorted.length % 2
      ? sorted[mid]!
      : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
};

// The week's gate runs from the spec-sync ledger, per profile and per phase.
export function gateTimes(ledger: string, sinceMs: number) {
  const runs = existsSync(ledger)
    ? readFileSync(ledger, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as {
              at: string;
              type: string;
              profile?: string;
              durationMs?: number;
              phases?: { name: string; durationMs: number; skipped?: boolean }[];
            };
          } catch {
            return undefined;
          }
        })
        .filter(
          (entry) =>
            entry?.type === "gate" &&
            Date.parse(entry.at) >= sinceMs &&
            entry.durationMs !== undefined,
        )
    : [];
  const profiles: Record<string, { runs: number; medianMs: number; maxMs: number }> = {};
  const phases: Record<string, number[]> = {};
  for (const profile of [...new Set(runs.map((run) => run!.profile ?? "(none)"))].sort()) {
    const durations = runs
      .filter((run) => (run!.profile ?? "(none)") === profile)
      .map((run) => run!.durationMs!);
    profiles[profile] = {
      runs: durations.length,
      medianMs: median(durations),
      maxMs: Math.max(...durations),
    };
  }
  for (const run of runs) {
    for (const phase of run!.phases ?? [])
      if (!phase.skipped) (phases[phase.name] ??= []).push(phase.durationMs);
  }
  return {
    runs: runs.length,
    profiles,
    phaseMedianMs: Object.fromEntries(
      Object.entries(phases).map(([name, values]) => [name, median(values)]),
    ),
  };
}

// --- the weekly file ----------------------------------------------------------------------------

export interface Delta {
  value: number;
  previous: number | null;
  delta: number | null;
}

const isDelta = (node: unknown): node is Delta =>
  typeof node === "object" &&
  node !== null &&
  !Array.isArray(node) &&
  "value" in node &&
  "delta" in node;

const IDENTITY = ["name", "source", "module", "path"] as const;

// The key that names a list entry across weeks, or undefined for a list without one.
function identity(entry: unknown): string | undefined {
  if (typeof entry !== "object" || entry === null) return undefined;
  const record = entry as Record<string, unknown>;
  const key = IDENTITY.find((name) => typeof record[name] === "string");
  return key === undefined ? undefined : `${key}:${record[key] as string}`;
}

// Every number becomes { value, previous, delta } against the same path in `previous`; entries of
// a list are matched by their identity (`identity`). Lists without one (raises, cycles) stay as they
// are, their counts are numbers in `counts` beside them.
export function annotate(current: unknown, previous: unknown): unknown {
  if (typeof current === "number") {
    const before = typeof previous === "number" ? previous : null;
    const delta = before === null ? null : Math.round((current - before) * 100) / 100;
    return { value: current, previous: before, delta };
  }
  if (Array.isArray(current)) {
    if (!current.every((entry) => identity(entry) !== undefined)) return current;
    const prior = new Map(
      (Array.isArray(previous) ? previous : []).map((entry) => [identity(entry), entry]),
    );
    return current.map((entry) => annotate(entry, prior.get(identity(entry))));
  }
  if (typeof current !== "object" || current === null) return current;
  const prior =
    typeof previous === "object" && previous !== null ? (previous as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(current).map(([key, value]) => [key, annotate(value, prior[key])]),
  );
}

// The plain values of an annotated file.
export function plain(node: unknown): unknown {
  if (isDelta(node)) return node.value;
  if (Array.isArray(node)) return node.map(plain);
  if (typeof node !== "object" || node === null) return node;
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, plain(value)]));
}

const WEEK_FILE = /^growth-(\d{4}-W\d{2})\.json$/;
export const weekFile = (week: string) => `growth-${week}.json`;

// The ISO week of a YYYY-MM-DD date, as `spec-sync review growth` reads it: "2026-W45".
export function isoWeek(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  const thursday = new Date(day.getTime() + (3 - ((day.getUTCDay() + 6) % 7)) * DAY);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.floor((thursday.getTime() - yearStart) / DAY / 7) + 1;
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Weeks since 1970 of an ISO week "YYYY-Www" (its Monday), so two weeks can be subtracted.
function weekNumber(week: string): number {
  const [year, number] = week.split("-W").map(Number) as [number, number];
  const jan4 = Date.UTC(year, 0, 4);
  const monday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY + (number - 1) * 7 * DAY;
  return Math.round(monday / DAY / 7);
}

export interface Target {
  path: string;
  reason: string;
}

const onLastWeek = (delta: number | null) =>
  delta === null ? "no value last week" : `${delta >= 0 ? "+" : ""}${delta} on last week`;

// The target list (PROC-REL-080 rev 5): the 10 worst hotspots and the up to 5 modules that grew the
// most lines of code since the previous file, from the annotated metrics.
export function targetList(metrics: {
  hotspots?: { path: string; changes: Delta; fta: Delta; score: Delta }[];
  modules?: { module: string; code: Delta }[];
}): Target[] {
  const hot = (metrics.hotspots ?? []).slice(0, 10).map((spot) => ({
    path: spot.path,
    reason: `hotspot: ${spot.changes.value} changes in four weeks × FTA ${spot.fta.value} = ${spot.score.value} (${onLastWeek(spot.score.delta)})`,
  }));
  const grown = (metrics.modules ?? [])
    .filter(({ code }) => (code.delta ?? 0) > 0)
    .sort((a, b) => b.code.delta! - a.code.delta!)
    .slice(0, 5)
    .map(({ module, code }) => ({
      path: module === "(root)" ? "." : module,
      reason: `most-grown module: ${code.previous} → ${code.value} lines of code (${onLastWeek(code.delta)})`,
    }));
  return [...hot, ...grown];
}

// Writes growth-<week>.json beside the earlier weeks, compared with the newest earlier week's file,
// and deletes the files of weeks eight or more weeks back. `week`, `previous_week` (or `gap_reason`)
// and `targets` are what `spec-sync review growth` reads; a second run in the same week replaces
// that week's file.
export function writeWeek(dir: string, date: string, metrics: object, meta: object = {}) {
  mkdirSync(dir, { recursive: true });
  const week = isoWeek(date);
  const earlier = readdirSync(dir)
    .map((name) => WEEK_FILE.exec(name)?.[1])
    .filter((found): found is string => found !== undefined && found < week)
    .sort();
  const previousWeek = earlier.at(-1) ?? null;
  const previous = previousWeek ? plain(readJson(join(dir, weekFile(previousWeek)))) : undefined;
  const gap =
    previousWeek === null
      ? { gap_reason: "no earlier week's file in .spec-sync/growth — nothing to compare with" }
      : weekNumber(week) - weekNumber(previousWeek) > 1
        ? { gap_reason: `no file for the week before ${week}; compared with ${previousWeek}` }
        : {};
  const annotated = annotate(metrics, previous) as Parameters<typeof targetList>[0];
  const targets = targetList(annotated);
  const file = join(dir, weekFile(week));
  writeFileSync(
    file,
    `${JSON.stringify({ week, date, previous_week: previousWeek, ...gap, ...meta, targets, ...annotated }, null, 2)}\n`,
  );
  const removed = earlier.filter((found) => weekNumber(week) - weekNumber(found) >= KEEP_WEEKS);
  for (const found of removed) rmSync(join(dir, weekFile(found)));
  return { file, previousWeek, removed };
}

export async function collect(run: Exec, root: string, ledger: string, now: number) {
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const fta = ftaScores(run, root);
  const sources = run("git", ["ls-files"], root)
    .split("\n")
    .filter((file) => SOURCE.test(file) && existsSync(join(root, file)));
  const raises = prRaises(run, root, weekAgo.slice(0, 10));
  const raiseCommits = weekRaises(run, root, weekAgo);
  const { cycles, boundaryViolations } = cruise(run, root);
  const { complexity, cleanness } = await lintMetrics(root, sources);
  const composed = composition(run, root);
  const chunks = Object.entries(chunkSizes(root)).map(([name, size]) => ({
    name,
    size,
    composition: Object.entries(composed[name] ?? {}).map(([source, bytes]) => ({
      source,
      size: bytes,
    })),
  }));
  const ftaFiles = Object.entries(fta)
    .sort(byValueDesc)
    .map(([path, score]) => ({ path, score }));
  return {
    chunks,
    size_limit: sizeLimitSizes(run, root),
    ratchet: ratchetCounts(root),
    raises,
    // The week's commits that raised a value in a measure file: suite-ui merges without PRs.
    raise_commits: raiseCommits,
    dependencies: dependencies(root),
    modules: Object.entries(linesOfCode(run, root)).map(([module, lines]) => ({
      module,
      ...lines,
    })),
    fta: ftaFiles,
    complexity,
    cleanness: { ...cleanness, any: anyShare(run, root) },
    hotspots: hotspots(run, root, fta, new Date(now - 28 * DAY).toISOString()),
    cycles,
    boundary_violations: boundaryViolations,
    check_times: gateTimes(ledger, now - 7 * DAY),
    counts: {
      raises: raises.length,
      raise_commits: raiseCommits.length,
      fta_files: ftaFiles.length,
      cycles: cycles.length,
      boundary_violations: boundaryViolations.length,
    },
  };
}

// The main checkout, also for a run in a worktree: the weeks accumulate in one place, beside the ledger.
function mainCheckout(root: string): string {
  const common = exec(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    root,
  ).trim();
  return basename(common) === ".git" ? dirname(common) : root;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const build = spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
  if (build.status !== 0) {
    console.error("growth:metrics: npm run build failed — no file written");
    process.exit(1);
  }
  const now = Date.now();
  const state = join(mainCheckout(root), ".spec-sync");
  const metrics = await collect(exec, root, join(state, "ledger.jsonl"), now);
  const head = exec("git", ["rev-parse", "HEAD"], root).trim();
  const date = new Date(now).toLocaleDateString("sv-SE");
  const { file, previousWeek, removed } = writeWeek(join(state, "growth"), date, metrics, { head });
  console.log(
    `growth:metrics: ${file} (compared with ${previousWeek ?? "nothing — first week"}${removed.length ? `; removed ${removed.join(", ")}` : ""})`,
  );
}
