// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join, matchesGlob } from "node:path";
import {
  changedSources,
  depcruiseCounts,
  falls,
  freshReport,
  gitleaksArgs,
  gitleaksCommitsScanned,
  jscpdCounts,
  knipCounts,
  rises,
  semgrepCounts,
  semgrepVerdict,
  sizeVerdict,
  trivyCounts,
  trivyArgs,
  trivyDevOnly,
  Unreadable,
  type SizeLines,
} from "./hygiene";

const root = new URL("..", import.meta.url);

// .size-limit.cjs resolves the `exports` entries against dist/, which the gate's build phase produces.
const built = existsSync(new URL("dist/ui/button.js", root));
const sizeChecks = () =>
  createRequire(import.meta.url)("../.size-limit.cjs") as {
    name: string;
    path: string;
    limit?: string;
  }[];

// SUI-FEATURE-128 AC2: a count above quality-baseline.json turns `hygiene` red; a fall never does.
describe("hygiene ratchet", () => {
  const baseline = { "dependency-cruiser.cycles": 0, "jscpd.duplicated-lines": 100 };

  it("reports a count above its baseline entry", () => {
    expect(
      rises(baseline, { "dependency-cruiser.cycles": 1, "jscpd.duplicated-lines": 100 }),
    ).toEqual(["dependency-cruiser.cycles: 1 > baseline 0"]);
  });

  it("treats a measured count without a baseline entry as a rise from nothing", () => {
    expect(rises(baseline, { "semgrep.error-or-warning": 2 })).toEqual([
      "semgrep.error-or-warning: 2 > baseline (none)",
    ]);
  });

  it("passes equal and falling counts, reporting the fall", () => {
    const measured = { "dependency-cruiser.cycles": 0, "jscpd.duplicated-lines": 90 };
    expect(rises(baseline, measured)).toEqual([]);
    expect(falls(baseline, measured)).toEqual(["jscpd.duplicated-lines: 90 < baseline 100"]);
  });

  it("names a count for every tool the gate measures", () => {
    const file = JSON.parse(readFileSync(new URL("quality-baseline.json", root), "utf8")) as {
      counts: Record<string, number>;
    };
    expect(Object.keys(file.counts).sort()).toEqual([
      "dependency-cruiser.cycles",
      "dependency-cruiser.forbidden-imports",
      "jscpd.duplicated-lines",
      "knip.findings",
      "licence-inventory.outside-allowlist",
      "semgrep.error-or-warning",
      "size-limit.over-maximum",
      "trivy.fixable-high-or-critical",
    ]);
  });
});

// SUI-FEATURE-128 AC1: a new cycle and a licence outside the allowlist each raise a count.
describe("hygiene tool counts", () => {
  it("splits dependency-cruiser violations into cycles and forbidden imports", () => {
    const report = {
      summary: {
        violations: [
          { rule: { name: "no-circular" } },
          { rule: { name: "no-circular" } },
          { rule: { name: "src-not-to-gallery" } },
        ],
      },
    };
    expect(depcruiseCounts(report)).toEqual({
      "dependency-cruiser.cycles": 2,
      "dependency-cruiser.forbidden-imports": 1,
    });
  });

  it("counts jscpd duplicated lines and names the largest block", () => {
    const result = jscpdCounts({
      statistics: { total: { duplicatedLines: 42, percentage: 2.5 } },
      duplicates: [{ lines: 7 }, { lines: 12 }],
    });
    expect(result.counts).toEqual({ "jscpd.duplicated-lines": 42 });
    expect(result.note).toBe("2.50 % duplicated lines, largest block 12 lines");
  });

  it("counts Semgrep findings at ERROR or WARNING only", () => {
    const results = ["ERROR", "WARNING", "INFO"].map((severity) => ({ extra: { severity } }));
    expect(semgrepCounts({ results })).toEqual({ "semgrep.error-or-warning": 2 });
  });

  it("counts Trivy vulnerabilities across targets", () => {
    const report = { Results: [{ Vulnerabilities: [{}, {}] }, { Vulnerabilities: null }, {}] };
    expect(trivyCounts(report)).toEqual({ "trivy.fixable-high-or-critical": 2 });
  });

  it("counts Trivy devDependency findings separately from production", () => {
    const finding = (PkgName: string, VulnerabilityID: string) => ({
      PkgName,
      InstalledVersion: "1.0.0",
      VulnerabilityID,
    });
    const production = {
      Results: [{ Target: "package-lock.json", Vulnerabilities: [finding("a", "CVE-1")] }],
    };
    const withDev = {
      Results: [
        {
          Target: "package-lock.json",
          Vulnerabilities: [
            finding("a", "CVE-1"),
            finding("vite", "CVE-2"),
            finding("vite", "CVE-3"),
          ],
        },
      ],
    };
    expect(trivyCounts(production)).toEqual({ "trivy.fixable-high-or-critical": 1 });
    expect(trivyDevOnly(production, withDev)).toBe(2);
    expect(trivyDevOnly({ Results: [] }, withDev)).toBe(3);
  });

  // GL-CODE-003: the gate scans production only; --include-dev-deps belongs to the inventory.
  it("passes --include-dev-deps to Trivy only for the inventory's devDependency scan", () => {
    const gate = trivyArgs(false);
    const dev = trivyArgs(true);
    expect(gate).not.toContain("--include-dev-deps");
    expect(dev).toContain("--include-dev-deps");
    expect(dev.filter((arg) => arg !== "--include-dev-deps")).toEqual(gate);
  });

  it("counts knip issues of every type, not the file or its owners", () => {
    const report = {
      issues: [
        {
          file: "src/lib/a.ts",
          owners: [{ name: "@team" }],
          exports: [{ name: "x" }, { name: "y" }],
          files: [{ name: "src/lib/a.ts" }],
          types: [],
        },
        { file: "package.json", owners: [], devDependencies: [{ name: "left-pad" }] },
      ],
    };
    expect(knipCounts(report)).toEqual({ "knip.findings": 4 });
  });

  it("reads the number of commits gitleaks scanned", () => {
    expect(gitleaksCommitsScanned("10:55PM INF 1340 commits scanned.\nno leaks found")).toBe(1340);
    expect(gitleaksCommitsScanned("0 commits scanned.")).toBe(0);
    expect(gitleaksCommitsScanned("fatal: not a git repository")).toBeUndefined();
  });

  // #808: builds a scratch repo, scans it with the hygiene's gitleaks args, returns the files found.
  const scanRepo = (build: (git: (...args: string[]) => string, token: string) => void) => {
    const dir = mkdtempSync(join(tmpdir(), "suite-ui-hygiene-gitleaks-"));
    try {
      const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
      git("init", "-q", "--template=", "-b", "main");
      git("config", "user.email", "test@example.com");
      git("config", "user.name", "test");
      // Built at run time, so this file carries no token for the history scan to find.
      const token = `ghp_${randomBytes(27)
        .toString("base64")
        .replace(/[^A-Za-z0-9]/g, "x")
        .slice(0, 36)}`;
      build(git, token);
      const report = join(dir, "gitleaks.json");
      const scan = spawnSync("gitleaks", gitleaksArgs(report, dir), { encoding: "utf8" });
      expect(scan.status).toBe(1);
      return (JSON.parse(readFileSync(report, "utf8")) as { File: string }[]).map((f) => f.File);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const write = (git: (...args: string[]) => string, file: string, text: string) => {
    writeFileSync(join(git("rev-parse", "--show-toplevel").trim(), file), text);
    git("add", file);
  };

  // #808: git log prints no patch for a merge by default, so a secret only its resolution adds hid.
  it("finds a secret that only a merge resolution adds", () => {
    const files = scanRepo((git, token) => {
      const commit = (message: string, file: string, text: string) => {
        write(git, file, text);
        git("commit", "-q", "-m", message);
      };
      commit("base", "notes.txt", "base\n");
      git("checkout", "-q", "-b", "side");
      commit("side", "side.txt", "side\n");
      git("checkout", "-q", "main");
      commit("ahead", "notes.txt", "ahead\n");
      git("merge", "-q", "--no-ff", "--no-commit", "side");
      write(git, "config.txt", `token = "${token}"\n`);
      git("commit", "-q", "-m", "merge side");
    });
    expect(files).toEqual(["config.txt"]);
  });

  // #808: a set --log-opts drops gitleaks' default --all; a branch HEAD does not reach stays scanned.
  it("finds a secret on a branch HEAD does not reach", () => {
    const files = scanRepo((git, token) => {
      write(git, "notes.txt", "base\n");
      git("commit", "-q", "-m", "base");
      git("checkout", "-q", "-b", "side");
      write(git, "config.txt", `token = "${token}"\n`);
      git("commit", "-q", "-m", "side");
      git("checkout", "-q", "main");
    });
    expect(files).toEqual(["config.txt"]);
  });
});

// SUI-FEATURE-128: a scanner that did not run its rules is never a zero.
describe("semgrep verdict", () => {
  const results = [{ extra: { severity: "WARNING" } }, { extra: { severity: "INFO" } }];

  it("counts findings and hands warn-level scan errors on as warnings", () => {
    const verdict = semgrepVerdict(
      {
        results,
        errors: [{ level: "warn", type: ["Timeout"], path: "src/a.tsx", message: "Timeout when…" }],
      },
      1,
    );
    expect(verdict.counts).toEqual({ "semgrep.error-or-warning": 1 });
    expect(verdict.warnings).toEqual(["Timeout src/a.tsx Timeout when…"]);
  });

  it("is unreadable on an error-level entry even with exit 0 (a dropped rule)", () => {
    const report = { results: [], errors: [{ level: "error", type: "Rule parse error" }] };
    expect(() => semgrepVerdict(report, 0)).toThrow(Unreadable);
  });

  it("is unreadable on exit 2 or more (a config that did not load)", () => {
    expect(() => semgrepVerdict({ results: [], errors: [] }, 7)).toThrow(Unreadable);
    expect(() => semgrepVerdict({ results: [] }, null)).toThrow(Unreadable);
  });
});

// A tool that fails without writing a report never hands on the previous run's numbers.
describe("fresh reports", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "hygiene-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("removes a stale report before the tool runs", () => {
    const file = join(dir, "report.json");
    writeFileSync(file, '{"stale": true}');
    expect(() => freshReport(file, "jscpd", () => undefined)).toThrow("jscpd wrote no report");
    expect(existsSync(file)).toBe(false);
  });

  it("reads the report the tool wrote", () => {
    const file = join(dir, "report.json");
    writeFileSync(file, '{"stale": true}');
    const report = freshReport<{ fresh: boolean }>(file, "jscpd", () =>
      writeFileSync(file, '{"fresh": true}'),
    );
    expect(report).toEqual({ fresh: true });
  });
});

// #766 (Codex v0.211.0 CX1): a name Git would quote (core.quotePath) still reaches Semgrep.
describe("changed sources", () => {
  let dir: string;
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
  };
  // Neither the helper nor changedSources may reach the real repository (a hook's GIT_DIR) or read
  // the user's global config (signing, hooksPath).
  const saved = { ...process.env };
  beforeEach(() => {
    for (const key of Object.keys(process.env)) if (key.startsWith("GIT_")) delete process.env[key];
    process.env.GIT_CONFIG_GLOBAL = "/dev/null";
    process.env.GIT_CONFIG_NOSYSTEM = "1";
    dir = mkdtempSync(join(tmpdir(), "hygiene-git-"));
    git("init", "-q", "-b", "main");
    git("config", "core.quotePath", "true");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "test");
    git("commit", "-q", "--allow-empty", "-m", "base");
    git("checkout", "-q", "-b", "branch");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  });

  it("fails closed when a Git call fails, so Semgrep is never skipped silently", () => {
    writeFileSync(join(dir, ".git", "index"), "not an index");
    expect(() => changedSources(dir)).toThrow(Unreadable);
    expect(() => changedSources(dir)).toThrow(/^git diff exit \d+: .+/);
  });

  it("lists committed and untracked sources with non-ASCII, quote and newline names", () => {
    mkdirSync(join(dir, "src"));
    const committed = ["src/café.ts", 'src/say"hi.tsx', "src/two\nlines.js", "src/plain.ts"];
    for (const file of committed) writeFileSync(join(dir, file), "export {};\n");
    git("add", "src");
    git("commit", "-q", "-m", "change");
    writeFileSync(join(dir, "src/naïve.mjs"), "export {};\n");
    writeFileSync(join(dir, "src/notes.md"), "not a source\n");
    expect(changedSources(dir)?.sort()).toEqual([...committed, "src/naïve.mjs"].sort());
  });
});

// SUI-FEATURE-128 AC3: every exports entry is measured against a recommended and a maximum line.
describe("size-limit lines", () => {
  const lines = {
    "./a": { recommended: 100, maximum: 105 },
    "./b": { recommended: 100, maximum: 105 },
  };

  it("judges at the maximum only and reports the recommended line", () => {
    const verdict = sizeVerdict(
      [
        { name: "./a", size: 103 },
        { name: "./b", size: 106 },
        { name: "./c", size: 1 },
      ],
      lines,
    );
    expect(verdict.counts).toEqual({ "size-limit.over-maximum": 1 });
    expect(verdict.overMaximum).toEqual(["./b 106 B > 105 B"]);
    expect(verdict.overRecommended).toEqual(["./a 103 B > 100 B"]);
    expect(verdict.unlined).toEqual(["./c"]);
  });

  it.skipIf(!built)("resolves every exports entry to a dist file that carries both lines", () => {
    const checks = sizeChecks();
    const carrier = JSON.parse(readFileSync(new URL("size-limit-lines.json", root), "utf8")) as {
      entries: Record<string, SizeLines | undefined>;
    };
    const names = checks.map((check) => check.name);
    expect(names).toEqual(
      expect.arrayContaining(["./styles.css", "./ui/button", "./strings", "./parity"]),
    );
    for (const check of checks) {
      expect(existsSync(new URL(check.path, root)), check.path).toBe(true);
      const line = carrier.entries[check.name];
      expect(line, check.name).toBeDefined();
      expect(line!.maximum).toBeGreaterThanOrEqual(line!.recommended);
      expect(check.limit).toBe(`${line!.maximum} B`);
    }
  });
});

// SUI-FEATURE-128: knip's entry points are the package's `exports`; knip.jsonc mirrors them.
describe("knip entry points", () => {
  const knipEntries = (): string[] => {
    const text = readFileSync(new URL("knip.jsonc", root), "utf8")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/,(\s*[\]}])/g, "$1");
    return (JSON.parse(text) as { entry: string[] }).entry;
  };

  it.skipIf(!built)("covers the source of every exports entry", () => {
    const entries = knipEntries();
    const sources = sizeChecks()
      .filter((check) => check.path.endsWith(".js"))
      .map((check) =>
        [".ts", ".tsx"]
          .map((ext) => check.path.replace(/^dist\//, "src/").replace(/\.js$/, ext))
          .find((file) => existsSync(new URL(file, root))),
      );
    for (const source of sources) {
      expect(source).toBeDefined();
      expect(
        entries.some((pattern) => matchesGlob(source!, pattern)),
        source,
      ).toBe(true);
    }
  });
});
