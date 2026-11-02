#!/usr/bin/env node
// Code hygiene (SUI-FEATURE-128, GL-CODE-002).
//
//   node scripts/hygiene.ts gate        # gate phase `hygiene` (after `build`): ratchet against quality-baseline.json
//   node scripts/hygiene.ts knip        # gate phase `knip` (before `unit`): same ratchet, knip's count only
//   node scripts/hygiene.ts inventory   # `npm run hygiene:inventory`: every tool over the whole repo, reports
//                                       # plus summary.json under .spec-sync/hygiene/
//
// Tools: jscpd, dependency-cruiser, Semgrep OSS (vendored packs in .semgrep/, no registry call), Trivy
// `fs`, size-limit (lines in size-limit-lines.json) and `spec-sync licence-inventory`; the inventory adds
// knip and gitleaks over the full history. No network except Trivy's vulnerability DB update.
//
// The gate is red when a count rises above its baseline, when an `exports` entry has no size lines, or
// when a tool produces no readable result (a missing number is never a zero): a scanner whose version
// differs from TOOL_VERSIONS, a stale or missing report, a Semgrep config/rule error, a gitleaks run
// over no commits. Findings are the ratchet's verdict, not the tool's exit code. Whole-project tools scan the whole repo; Semgrep, a file-local
// tool, scans the files changed against `main` in the gate and everything in the inventory.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type Counts = Record<string, number>;

export interface SizeCheck {
  name: string;
  size: number;
}

export interface SizeLines {
  recommended: number;
  maximum: number;
}

// Every count above its baseline entry; a measured count without an entry is a rise from nothing.
export function rises(baseline: Counts, measured: Counts): string[] {
  return Object.entries(measured)
    .filter(([key, value]) => value > (baseline[key] ?? 0))
    .map(([key, value]) => `${key}: ${value} > baseline ${baseline[key] ?? "(none)"}`);
}

// Every count below its baseline entry — reported, never red; the pull-down books it.
export function falls(baseline: Counts, measured: Counts): string[] {
  return Object.entries(measured)
    .filter(([key, value]) => baseline[key] !== undefined && value < baseline[key])
    .map(([key, value]) => `${key}: ${value} < baseline ${baseline[key]}`);
}

export function jscpdCounts(report: {
  statistics: { total: { duplicatedLines: number; percentage: number } };
  duplicates: { lines: number }[];
}): { counts: Counts; note: string } {
  const total = report.statistics.total;
  const largest = Math.max(0, ...report.duplicates.map((clone) => clone.lines));
  return {
    counts: { "jscpd.duplicated-lines": total.duplicatedLines },
    note: `${total.percentage.toFixed(2)} % duplicated lines, largest block ${largest} lines`,
  };
}

export function depcruiseCounts(report: {
  summary: { violations: { rule: { name: string } }[] };
}): Counts {
  const violations = report.summary.violations;
  const cycles = violations.filter((violation) => violation.rule.name === "no-circular").length;
  return {
    "dependency-cruiser.cycles": cycles,
    "dependency-cruiser.forbidden-imports": violations.length - cycles,
  };
}

export function semgrepCounts(report: { results: { extra: { severity: string } }[] }): Counts {
  const blocking = report.results.filter((result) =>
    ["ERROR", "WARNING"].includes(result.extra.severity),
  );
  return { "semgrep.error-or-warning": blocking.length };
}

export interface SemgrepReport {
  results: { extra: { severity: string } }[];
  errors?: { level?: string; type?: unknown; path?: string; message?: string }[];
}

// Semgrep prints valid JSON with `results: []` even when a config or rule failed to load (exit 7, or
// exit 0 with the rule dropped into `errors`). Exit ≥ 2 or an error-level entry is therefore an
// unreadable run; warn-level entries (a timeout, a partial parse) are returned for the report.
export function semgrepVerdict(
  report: SemgrepReport,
  status: number | null,
): { counts: Counts; warnings: string[] } {
  const describe = (entry: NonNullable<SemgrepReport["errors"]>[number]) => {
    const type = Array.isArray(entry.type) ? String(entry.type[0]) : String(entry.type);
    return `${type} ${entry.path ?? ""} ${(entry.message ?? "").split("\n")[0]}`.trim();
  };
  const errors = report.errors ?? [];
  const failed = errors.filter((entry) => entry.level !== "warn");
  if (status === null || status >= 2 || failed.length > 0) {
    const first = failed[0] ? `: ${describe(failed[0])}` : "";
    throw new Unreadable(`Semgrep exit ${status}, ${failed.length} errors${first}`);
  }
  return {
    counts: semgrepCounts(report),
    warnings: errors.filter((entry) => entry.level === "warn").map(describe),
  };
}

export function trivyCounts(report: {
  Results?: { Vulnerabilities?: unknown[] | null }[];
}): Counts {
  const findings = (report.Results ?? []).reduce(
    (sum, result) => sum + (result.Vulnerabilities ?? []).length,
    0,
  );
  return { "trivy.fixable-high-or-critical": findings };
}

// knip's JSON reporter lists, per file, one array per issue type; `file` and `owners` (CODEOWNERS)
// describe the file and are not findings.
export function knipCounts(report: { issues: Record<string, unknown>[] }): Counts {
  const findings = report.issues.reduce(
    (sum, issue) =>
      sum +
      Object.entries(issue)
        .filter(([key, value]) => key !== "file" && key !== "owners" && Array.isArray(value))
        .reduce((n, [, list]) => n + (list as unknown[]).length, 0),
    0,
  );
  return { "knip.findings": findings };
}

// gitleaks logs "<n> commits scanned." on stderr; a run over no commits proves nothing.
export function gitleaksCommitsScanned(log: string): number | undefined {
  const match = /(\d+) commits scanned/.exec(log);
  return match ? Number(match[1]) : undefined;
}

// Judges at the maximum line only; crossing the recommended line is reported, never red.
export function sizeVerdict(
  checks: SizeCheck[],
  lines: Record<string, SizeLines>,
): { counts: Counts; unlined: string[]; overRecommended: string[]; overMaximum: string[] } {
  const unlined = checks.filter((check) => !lines[check.name]).map((check) => check.name);
  const lined = checks.filter((check) => lines[check.name]);
  const describe = (check: SizeCheck, line: number) => `${check.name} ${check.size} B > ${line} B`;
  const overMaximum = lined
    .filter((check) => check.size > lines[check.name]!.maximum)
    .map((check) => describe(check, lines[check.name]!.maximum));
  const overRecommended = lined
    .filter(
      (check) =>
        check.size > lines[check.name]!.recommended && check.size <= lines[check.name]!.maximum,
    )
    .map((check) => describe(check, lines[check.name]!.recommended));
  return {
    counts: { "size-limit.over-maximum": overMaximum.length },
    unlined,
    overRecommended,
    overMaximum,
  };
}

// --- running the tools -------------------------------------------------------------------------

const root = fileURLToPath(new URL("..", import.meta.url));
const bin = (name: string) => join(root, "node_modules", ".bin", name);

export class Unreadable extends Error {}

interface Ran {
  stdout: string;
  stderr: string;
  status: number | null;
}

function run(command: string, args: string[]): Ran {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env, SEMGREP_SEND_METRICS: "off" },
  });
  if (result.error) throw new Unreadable(`${command}: ${result.error.message}`);
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

// The scanners are binaries outside npm (installed with mise/Homebrew). Their versions are pinned
// here: a different Semgrep can drop vendored rules, a different Trivy or gitleaks can count
// differently, so a mismatch is an unreadable run, never a measurement.
export const TOOL_VERSIONS = { semgrep: "1.176.0", trivy: "0.76.1", gitleaks: "8.30.1" } as const;

function checkVersion(tool: keyof typeof TOOL_VERSIONS, args: string[]) {
  const { stdout, stderr } = run(tool, args);
  const found = /\d+\.\d+\.\d+/.exec(`${stdout}\n${stderr}`)?.[0];
  if (found !== TOOL_VERSIONS[tool]) {
    throw new Unreadable(
      `${tool} ${found ?? "(no version)"} on PATH, pinned ${TOOL_VERSIONS[tool]}`,
    );
  }
}

// Removes a report file before its tool runs, so a tool that fails without writing one can never
// hand on the previous run's numbers; a missing report afterwards is an unreadable run.
export function freshReport<T>(file: string, tool: string, produce: () => void): T {
  rmSync(file, { force: true });
  produce();
  if (!existsSync(file)) throw new Unreadable(`${tool} wrote no report`);
  return json<T>(tool, readFileSync(file, "utf8"));
}

function json<T>(tool: string, text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Unreadable(`${tool} produced no JSON report (${text.slice(0, 200).trim()})`);
  }
}

function jscpd(out: string) {
  return jscpdCounts(
    freshReport(join(out, "jscpd", "jscpd-report.json"), "jscpd", () =>
      run(bin("jscpd"), ["--config", ".jscpd.json", "--output", join(out, "jscpd"), "."]),
    ),
  );
}

function depcruise(out: string) {
  const { stdout: text } = run(bin("depcruise"), [
    "--config",
    ".dependency-cruiser.cjs",
    "--output-type",
    "json",
    ".",
  ]);
  writeFileSync(join(out, "dependency-cruiser.json"), text);
  return depcruiseCounts(json("dependency-cruiser", text));
}

const SEMGREP_SOURCE = /\.(ts|tsx|js|jsx|cjs|mjs)$/;
const SEMGREP_EXCLUDE = [
  "dist",
  "node_modules",
  ".spec-sync",
  ".semgrep",
  "test-results",
  // Semgrep 1.176's TypeScript parser cannot read `await importOriginal<typeof import("…")>()` in
  // these `vi.mock` factories (PartialParsing). They are tests, never shipped; excluded per file.
  "src/slides/slide-editor-insert.test.tsx",
  "src/slides/slide-editor-preview.test.tsx",
  "src/slides/slide-editor-save-rule.test.tsx",
  "src/slides/slide-editor-text.test.tsx",
  "src/ui/toaster.test.tsx",
];
// Per rule and file, in seconds (Semgrep's default 5 timed out on the largest files under load).
const SEMGREP_TIMEOUT = "60";

// The files changed against `main` (committed on the branch or not), or null when there is no `main`.
function changedSources(): string[] | null {
  const base = spawnSync("git", ["merge-base", "HEAD", "main"], { cwd: root, encoding: "utf8" });
  if (base.status !== 0) return null;
  const git = (...args: string[]) => run("git", args).stdout.split("\n").filter(Boolean);
  const files = [
    ...git("diff", "--name-only", "--diff-filter=ACMR", base.stdout.trim()),
    ...git("ls-files", "--others", "--exclude-standard"),
  ];
  return [...new Set(files)].filter(
    (file) =>
      SEMGREP_SOURCE.test(file) &&
      !SEMGREP_EXCLUDE.some((path) => file === path || file.startsWith(`${path}/`)) &&
      existsSync(join(root, file)),
  );
}

function semgrep(out: string, targets: string[] | null) {
  if (targets !== null && targets.length === 0) {
    return { counts: { "semgrep.error-or-warning": 0 }, note: "no changed source files" };
  }
  checkVersion("semgrep", ["--version"]);
  const { stdout: text, status } = run("semgrep", [
    "scan",
    "--json",
    "--quiet",
    "--metrics=off",
    "--disable-version-check",
    "--timeout",
    SEMGREP_TIMEOUT,
    "--config",
    ".semgrep/p-typescript.yml",
    "--config",
    ".semgrep/p-react.yml",
    ...SEMGREP_EXCLUDE.flatMap((path) => ["--exclude", path]),
    // A changed file named like an option (`--exclude=…`) must stay a target.
    "--",
    ...(targets ?? ["."]),
  ]);
  writeFileSync(join(out, "semgrep.json"), text);
  const verdict = semgrepVerdict(json("Semgrep", text), status);
  const scope = targets === null ? "whole repo" : `${targets.length} changed files`;
  const warned = verdict.warnings.length === 0 ? "" : `; ${verdict.warnings.length} scan warnings`;
  for (const warning of verdict.warnings) console.log(`hygiene: note semgrep ${warning}`);
  return { counts: verdict.counts, note: `${scope}${warned}` };
}

function trivy(out: string) {
  checkVersion("trivy", ["--version"]);
  const { stdout: text } = run("trivy", [
    "fs",
    // No call to check.trivy.dev: the DB update is the only network access (SUI-FEATURE-128 AC 4).
    "--skip-version-check",
    "--disable-telemetry",
    "--scanners",
    "vuln",
    // GL-CODE-002's finish line is "0 fixable at HIGH or CRITICAL".
    "--ignore-unfixed",
    "--severity",
    "HIGH,CRITICAL",
    "--format",
    "json",
    "--quiet",
    "--skip-dirs",
    "dist",
    "--skip-dirs",
    ".spec-sync",
    ".",
  ]);
  writeFileSync(join(out, "trivy.json"), text);
  return trivyCounts(json("Trivy", text));
}

function sizeLimit(out: string) {
  const { stdout: text } = run(bin("size-limit"), ["--json"]);
  writeFileSync(join(out, "size-limit.json"), text);
  const checks = json<SizeCheck[] | { error: string }>("size-limit", text);
  if (!Array.isArray(checks)) throw new Unreadable(`size-limit: ${checks.error}`);
  const lines = json<{ entries: Record<string, SizeLines> }>(
    "size-limit-lines.json",
    readFileSync(join(root, "size-limit-lines.json"), "utf8"),
  ).entries;
  return { checks, ...sizeVerdict(checks, lines) };
}

function licences(out: string) {
  const { stdout: text } = run(bin("spec-sync"), [
    "licence-inventory",
    "--allowlist",
    "licence-allowlist.json",
  ]);
  writeFileSync(join(out, "licence-inventory.json"), text);
  const report = json<{ exit: number; findings?: number; error?: string }>(
    "licence-inventory",
    text,
  );
  if (typeof report.findings !== "number") {
    throw new Unreadable(`licence-inventory: ${report.error ?? `exit ${report.exit}`}`);
  }
  return { "licence-inventory.outside-allowlist": report.findings };
}

function knip(out: string) {
  const { stdout: text } = run(bin("knip"), ["--no-progress", "--reporter", "json"]);
  writeFileSync(join(out, "knip.json"), text);
  return knipCounts(json("knip", text));
}

function gitleaks(out: string) {
  checkVersion("gitleaks", ["version"]);
  let stderr = "";
  // `gitleaks git` scans the full history; exit 1 only means it found leaks. `--redact` keeps a
  // found secret out of the report on disk.
  const findings = freshReport<unknown[]>(join(out, "gitleaks.json"), "gitleaks", () => {
    stderr = run("gitleaks", [
      "git",
      "--no-banner",
      "--redact",
      "--report-format",
      "json",
      "--report-path",
      join(out, "gitleaks.json"),
      ".",
    ]).stderr;
  });
  const commits = gitleaksCommitsScanned(stderr);
  if (!commits)
    throw new Unreadable(`gitleaks scanned ${commits ?? "no reported number of"} commits`);
  return { counts: { "gitleaks.history": findings.length }, note: `${commits} commits scanned` };
}

// --- modes ---------------------------------------------------------------------------------------

function measure(
  counts: Counts,
  tool: string,
  step: () => Counts | { counts: Counts; note: string },
) {
  const started = Date.now();
  const result = step();
  const own = "counts" in result ? (result.counts as Counts) : result;
  Object.assign(counts, own);
  const note = "note" in result ? ` (${String(result.note)})` : "";
  console.log(`hygiene: ${tool} ${JSON.stringify(own)}${note} — ${Date.now() - started} ms`);
}

function measureAll(out: string, full: boolean) {
  const counts: Counts = {};
  const notes: string[] = [];
  const add = (tool: string, step: () => Counts | { counts: Counts; note: string }) =>
    measure(counts, tool, step);
  add("jscpd", () => jscpd(out));
  add("dependency-cruiser", () => depcruise(out));
  add("semgrep", () => semgrep(out, full ? null : changedSources()));
  add("trivy", () => trivy(out));
  const size = sizeLimit(out);
  Object.assign(counts, size.counts);
  console.log(`hygiene: size-limit ${JSON.stringify(size.counts)} (${size.checks.length} entries)`);
  for (const line of size.overRecommended) notes.push(`size-limit above recommended: ${line}`);
  add("licence-inventory", () => licences(out));
  return { counts, notes, size };
}

function readBaseline(): Counts {
  return json<{ counts: Counts }>(
    "quality-baseline.json",
    readFileSync(join(root, "quality-baseline.json"), "utf8"),
  ).counts;
}

function gateOut(): string {
  const out = join(root, ".spec-sync", "hygiene", "gate");
  mkdirSync(out, { recursive: true });
  return out;
}

// Gate phase `knip`: its own phase before `unit`, ratcheted like the `hygiene` counts.
function knipGate(): number {
  const counts = knip(gateOut());
  const red = rises(readBaseline(), counts);
  console.log(`knip: ${JSON.stringify(counts)}`);
  if (red.length > 0) {
    spawnSync(bin("knip"), ["--no-progress"], { cwd: root, stdio: "inherit" });
    for (const line of red) console.error(`knip: RED ${line}`);
  }
  return red.length === 0 ? 0 : 1;
}

function gate(): number {
  const out = gateOut();
  const baseline = readBaseline();
  const { counts, notes, size } = measureAll(out, false);
  const red = [
    ...rises(baseline, counts),
    ...size.overMaximum.map((line) => `size-limit above maximum: ${line}`),
    ...size.unlined.map(
      (name) =>
        `size-limit: ${name} has no lines in size-limit-lines.json (recommended = measured, maximum = recommended + 5 %)`,
    ),
  ];
  for (const line of [...notes, ...falls(baseline, counts)]) console.log(`hygiene: note ${line}`);
  for (const line of red) console.error(`hygiene: RED ${line}`);
  console.log(`hygiene: ${red.length === 0 ? "green" : "red"} — reports in ${out}`);
  return red.length === 0 ? 0 : 1;
}

function inventory(): number {
  const out = join(root, ".spec-sync", "hygiene");
  mkdirSync(out, { recursive: true });
  // size-limit measures dist/; the inventory builds it itself.
  const build = spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
  if (build.status !== 0) throw new Unreadable("npm run build failed");
  const { counts, size } = measureAll(out, true);
  measure(counts, "knip", () => knip(out));
  measure(counts, "gitleaks", () => gitleaks(out));
  const head = run("git", ["rev-parse", "HEAD"]).stdout.trim();
  const summary = {
    recordedAt: new Date().toISOString(),
    head,
    counts,
    sizes: Object.fromEntries(size.checks.map((check) => [check.name, check.size])),
  };
  writeFileSync(join(out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`hygiene: inventory ${JSON.stringify(counts)} — ${join(out, "summary.json")}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  try {
    if (mode === "gate") process.exit(gate());
    if (mode === "knip") process.exit(knipGate());
    if (mode === "inventory") process.exit(inventory());
    console.error("usage: node scripts/hygiene.ts gate|knip|inventory");
    process.exit(4);
  } catch (error) {
    if (!(error instanceof Unreadable)) throw error;
    console.error(`hygiene: RED unreadable — ${error.message}`);
    process.exit(1);
  }
}
