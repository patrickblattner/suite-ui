// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Delta,
  type Exec,
  collect,
  countLines,
  exec,
  ftaScores,
  hotspots,
  isoWeek,
  lintMetrics,
  targetList,
  writeWeek,
} from "./growth-metrics";

// SUI-FEATURE-139: the weekly growth file.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const script = readFileSync(fileURLToPath(new URL("./growth-metrics.ts", import.meta.url)), "utf8");
const SPAWN_TIMEOUT = 120_000;

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "growth-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const write = (path: string, text: string) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
};

interface WeekFile {
  week: string;
  previous_week: string | null;
  gap_reason?: string;
  targets: { path: string; reason: string }[];
  raises: object[];
  raise_commits: object[];
}
const readWeek = (file: string) => JSON.parse(readFileSync(file, "utf8")) as WeekFile;

// Every number of an annotated file, with its path; a list entry is named by its identity field.
function leaves(node: unknown, path = ""): [string, Delta][] {
  if (Array.isArray(node))
    return node.flatMap((entry: Record<string, unknown>) =>
      leaves(entry, `${path}/${String(entry.name ?? entry.source ?? entry.module ?? entry.path)}`),
    );
  if (typeof node !== "object" || node === null) return [];
  if ("value" in node && "delta" in node) return [[path, node as Delta]];
  return Object.entries(node).flatMap(([key, value]) => leaves(value, `${path}/${key}`));
}

const NESTED = `export function nested(rows: number[][], limit: number): number {
  let total = 0;
  for (const row of rows) {
    if (row.length > 0) {
      for (const cell of row) {
        if (cell > limit) {
          while (total < limit) {
            if (cell % 2 === 0 && total % 3 === 0) {
              total += cell;
            } else if (cell % 5 === 0 || total > 100) {
              total -= 1;
            } else {
              break;
            }
          }
        }
      }
    }
  }
  return total;
}
`;

describe("growth:metrics", () => {
  // A package root with every local input, and a fake command runner that answers only the commands
  // the script may use; any other command (npm, curl, a model CLI) fails the run.
  function fakeRoot(chunkSize: number) {
    const root = join(dir, "pkg");
    write(join(root, "dist", "index.js"), "x".repeat(chunkSize));
    write(join(root, "dist", "styles.css"), "body{}");
    // The module grows with the chunk, so the second run has a most-grown module.
    write(join(root, "src", "a.ts"), NESTED + "export const x = 1;\n".repeat(chunkSize / 50));
    write(
      join(root, "quality-baseline.json"),
      JSON.stringify({ counts: { "jscpd.duplicated-lines": chunkSize } }),
    );
    write(
      join(root, "package.json"),
      JSON.stringify({ dependencies: { a: "1" }, devDependencies: { b: "1" } }),
    );
    write(
      join(root, "package-lock.json"),
      JSON.stringify({
        packages: {
          "": {},
          "node_modules/a": { version: "1.0.0" },
          "node_modules/b": { version: "1.0.0" },
          "node_modules/b/node_modules/a": { version: "2.0.0" },
        },
      }),
    );
    const ledger = join(dir, "ledger.jsonl");
    writeFileSync(
      ledger,
      `${JSON.stringify({ at: new Date().toISOString(), type: "gate", profile: "local", durationMs: chunkSize, phases: [{ name: "unit", durationMs: chunkSize }] })}\n`,
    );
    const commands: string[] = [];
    const run: Exec = (command, args) => {
      const name = basename(command);
      commands.push(name);
      const joined = args.join(" ");
      if (name === "git" && joined === "ls-files") return "src/a.ts\ndist/index.js\n";
      if (name === "git" && joined.includes("-- quality-baseline.json"))
        return "abc12345\tbump #1\n";
      if (name === "git" && joined.startsWith("show abc12345^:quality-baseline"))
        return JSON.stringify({ counts: { "knip.findings": 1 } });
      if (name === "git" && joined.startsWith("show abc12345:quality-baseline"))
        return JSON.stringify({ counts: { "knip.findings": 2 } });
      if (name === "git" && joined.startsWith("show")) throw new Error("no such file");
      if (name === "git" && joined.includes("--name-only")) return "src/a.ts\nsrc/a.ts\n";
      if (name === "fta")
        return JSON.stringify([{ file_name: "src/a.ts", fta_score: chunkSize / 10 }]);
      if (name === "size-limit") return JSON.stringify([{ name: "./index", size: chunkSize }]);
      if (name === "depcruise") return JSON.stringify({ summary: { violations: [] } });
      if (name === "tsup") {
        write(join(args[args.indexOf("--out-dir") + 1]!, "index.js"), "x");
        return "";
      }
      if (name === "source-map-explorer") {
        const files = { [join(root, "src", "a.ts")]: { size: chunkSize }, "[EOLs]": { size: 1 } };
        return JSON.stringify({
          results: [
            { bundleName: args[0], files: { ...files, "[sourceMappingURL]": { size: 9 } } },
          ],
        });
      }
      if (name === "type-coverage")
        return JSON.stringify({ correctCount: 1000 - chunkSize / 10, totalCount: 1000 });
      if (name === "gh" && joined.includes("--label growth-review"))
        return JSON.stringify([
          { number: 7, title: "raise #7", url: "u", mergedAt: "2026-11-02T00:00:00Z" },
        ]);
      throw new Error(`unexpected command ${name} ${joined}`);
    };
    return { root, ledger, run, commands };
  }

  it("AC1: two runs in different weeks give two files; the second names the difference for every value", async () => {
    const out = join(dir, "growth");
    const first = fakeRoot(100);
    writeWeek(out, "2026-11-01", await collect(first.run, first.root, first.ledger, Date.now()));
    rmSync(first.root, { recursive: true });
    const second = fakeRoot(150);
    const { previousWeek } = writeWeek(
      out,
      "2026-11-08",
      await collect(second.run, second.root, second.ledger, Date.now()),
    );

    expect(readdirSync(out).sort()).toEqual(["growth-2026-W44.json", "growth-2026-W45.json"]);
    expect(previousWeek).toBe("2026-W44");
    const file = readWeek(join(out, "growth-2026-W45.json"));
    // The fields SUI-FEATURE-139 rev 3 requires, at the top level.
    for (const field of [
      "chunks",
      "raises",
      "modules",
      "fta",
      "hotspots",
      "cycles",
      "targets",
    ] as const)
      expect(Array.isArray((file as unknown as Record<string, unknown>)[field]), field).toBe(true);
    for (const field of ["ratchet", "dependencies", "complexity", "cleanness", "check_times"])
      expect(typeof (file as unknown as Record<string, unknown>)[field], field).toBe("object");
    expect(file.previous_week).toBe("2026-W44");
    expect(file.gap_reason).toBeUndefined();
    const numbers = leaves(file);
    expect(numbers.length).toBeGreaterThan(20);
    for (const [path, entry] of numbers) {
      expect(entry.previous, path).not.toBeNull();
      expect(entry.delta, path).toBe(Math.round((entry.value - entry.previous!) * 100) / 100);
    }
    const byPath = Object.fromEntries(numbers);
    expect(byPath["/chunks/index.js/size"]).toEqual({ value: 150, previous: 100, delta: 50 });
    expect(byPath["/ratchet/jscpd.duplicated-lines"]!.delta).toBe(50);
    expect(byPath["/dependencies/duplicateVersions/a"]!.value).toBe(2);
    expect(byPath["/chunks/index.js/composition/src/a.ts/size"]!.delta).toBe(50);
    expect(byPath["/chunks/index.js/composition/[sourceMappingURL]/size"]).toBeUndefined();
    expect(byPath["/modules/src/code"]!.delta).toBeGreaterThan(0);
    expect(byPath["/fta/src/a.ts/score"]!.delta).toBe(5);
    expect(byPath["/hotspots/src/a.ts/score"]!.delta).toBe(10);
    expect(byPath["/cleanness/any/anyCount"]!.delta).toBe(5);
    expect(byPath["/check_times/runs"]!.value).toBe(1);
    expect(byPath["/counts/raises"]).toEqual({ value: 1, previous: 1, delta: 0 });
    // Raises are the week's PRs labelled growth-review; the measure-file commits stay beside them.
    expect(file.raises).toEqual([
      { number: 7, title: "raise #7", url: "u", mergedAt: "2026-11-02T00:00:00Z" },
    ]);
    expect(file.raise_commits[0]).toMatchObject({ key: "knip.findings", old: 1, new: 2 });
    expect(JSON.stringify(file)).not.toMatch(/collector/i);
    // `week` and `targets` as `spec-sync review growth` reads them.
    expect(file.week).toBe("2026-W45");
    expect(file.targets.map((target) => target.path)).toEqual(["src/a.ts", "src"]);
    for (const target of file.targets) expect(target.reason).toEqual(expect.any(String));
    // The first file has nothing to compare with and says why.
    const firstFile = readWeek(join(out, "growth-2026-W44.json"));
    expect(firstFile.previous_week).toBeNull();
    expect(firstFile.gap_reason).toMatch(/no earlier week/);
    expect(leaves(firstFile).every(([, entry]) => entry.delta === null)).toBe(true);
  });

  it("AC3: `spec-sync review growth` accepts the file (dry run, no Codex call)", () => {
    const out = join(dir, "growth");
    writeWeek(out, "2026-11-08", {
      hotspots: [{ path: "src/a.ts", changes: 2, fta: 5, score: 10 }],
    });
    const review = spawnSync(
      join(repoRoot, "node_modules", ".bin", "spec-sync"),
      ["review", "growth", "--metrics", join(out, "growth-2026-W45.json"), "--dry-run"],
      { cwd: repoRoot, encoding: "utf8", timeout: SPAWN_TIMEOUT },
    );
    expect(review.status, review.stdout + review.stderr).toBe(0);
    expect(JSON.parse(review.stdout)).toMatchObject({
      ok: true,
      week: "2026-W45",
      targets: 1,
      outcome: "dry-run",
    });
  });

  it("keeps the last eight weeks, names a missing previous week and replaces a same-week rerun", () => {
    const out = join(dir, "growth");
    for (const day of ["2026-09-06", "2026-09-13", "2026-09-20"]) writeWeek(out, day, { n: 1 });
    // 2026-11-08 is 2026-W45; W37 (2026-09-13) is eight weeks back: it and older ones go.
    const { removed, previousWeek } = writeWeek(out, "2026-11-08", { n: 2 });
    expect(removed).toEqual(["2026-W36", "2026-W37"]);
    expect(previousWeek).toBe("2026-W38");
    expect(readdirSync(out).sort()).toEqual(["growth-2026-W38.json", "growth-2026-W45.json"]);
    expect(readWeek(join(out, "growth-2026-W45.json")).gap_reason).toBe(
      "no file for the week before 2026-W45; compared with 2026-W38",
    );
    writeWeek(out, "2026-11-07", { n: 3 }); // Saturday of the same week
    expect(readdirSync(out).sort()).toEqual(["growth-2026-W38.json", "growth-2026-W45.json"]);
  });

  it(
    "AC2: a new deeply nested function shows in the complexity count and, changed often, tops the hotspots",
    async () => {
      const repo = join(dir, "repo");
      mkdirSync(repo);
      symlinkSync(join(repoRoot, "node_modules"), join(repo, "node_modules"));
      const git = (...args: string[]) =>
        execFileSync("git", args, { cwd: repo, stdio: "pipe", timeout: SPAWN_TIMEOUT });
      git("init", "-q");
      git("config", "user.email", "t@example.com");
      git("config", "user.name", "t");
      write(join(repo, ".gitignore"), "node_modules\n");
      write(join(repo, "src", "flat.ts"), "export const flat = (a: number) => a + 1;\n".repeat(8));
      git("add", ".");
      git("commit", "-qm", "flat");
      const { complexity: before } = await lintMetrics(repo, ["src/flat.ts"]);

      write(join(repo, "src", "nested.ts"), NESTED);
      git("add", ".");
      git("commit", "-qm", "nested");
      for (let change = 1; change <= 5; change++) {
        write(join(repo, "src", "nested.ts"), `${NESTED}// change ${change}\n`);
        git("commit", "-qam", `change ${change}`);
      }

      const { complexity: after } = await lintMetrics(repo, ["src/flat.ts", "src/nested.ts"]);
      expect(after.aboveThreshold).toBe(before.aboveThreshold + 1);
      expect(after.perFunction["src/nested.ts:1"]).toBeGreaterThan(after.threshold);

      const fta = ftaScores(exec, repo);
      expect(fta["src/nested.ts"]).toBeGreaterThan(0);
      const spots = hotspots(exec, repo, fta, "4 weeks ago");
      expect(spots[0]).toMatchObject({ path: "src/nested.ts", changes: 6 });
      const out = join(dir, "growth");
      writeWeek(out, "2026-11-08", { hotspots: spots });
      expect(readWeek(join(out, "growth-2026-W45.json")).targets[0]!.path).toBe("src/nested.ts");
    },
    SPAWN_TIMEOUT,
  );

  it("AC4: needs no model and no network but gh — only git, gh and the local tools run, fetch is never called", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("network");
    });
    const { root, ledger, run, commands } = fakeRoot(100);
    await collect(run, root, ledger, Date.now());
    expect(new Set(commands)).toEqual(
      new Set([
        "git",
        "gh",
        "fta",
        "size-limit",
        "depcruise",
        "tsup",
        "source-map-explorer",
        "type-coverage",
      ]),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    // No HTTP client, no URL, no model SDK, never the spec server in the script itself.
    expect(script).not.toMatch(/fetch\(|https?:\/\/|anthropic|openai|node:https?"|8787|mcp/i);
  });

  it(
    "counts the cleanness rules, the typed one only with type information",
    async () => {
      const root = join(dir, "clean");
      write(
        join(root, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ["src"] }),
      );
      write(
        join(root, "src", "c.ts"),
        [
          "export function c(a: number, list: number[]): string {",
          "  if (a > 1) {",
          "    if (a > 2) {",
          '      return "the same text";',
          "    }",
          "  }",
          '  if (list) return "the same text";',
          '  return "the same text";',
          "}",
          "",
        ].join("\n"),
      );
      const { cleanness } = await lintMetrics(root, ["src/c.ts"]);
      expect(cleanness.rules).toMatchObject({
        "sonarjs/no-collapsible-if": 1,
        "sonarjs/no-duplicate-string": 1,
        "sonarjs/no-small-switch": 0,
        "@typescript-eslint/no-unnecessary-condition": 1,
      });
      expect(cleanness.perFile).toEqual({ "src/c.ts": 3 });
    },
    SPAWN_TIMEOUT,
  );

  it("target list: the 10 worst hotspots, then the up to 5 most-grown modules", () => {
    const out = join(dir, "growth");
    const spots = (score: number) =>
      Array.from({ length: 12 }, (_, i) => ({
        path: `src/f${i}.ts`,
        changes: 2,
        fta: 10,
        score: score - i,
      }));
    const modules = (base: number) =>
      Array.from({ length: 7 }, (_, i) => ({ module: `src/m${i}`, code: base + i * 10 }));
    writeWeek(out, "2026-11-01", { hotspots: spots(100), modules: modules(100) });
    const grown = modules(100).map((entry) =>
      entry.module === "src/m2"
        ? { ...entry, code: 500 }
        : entry.module === "src/m5"
          ? { ...entry, code: 90 }
          : entry,
    );
    writeWeek(out, "2026-11-08", { hotspots: spots(110), modules: grown });
    const file = readWeek(join(out, "growth-2026-W45.json"));
    expect(file.targets.slice(0, 10).map((target) => target.path)).toEqual(
      Array.from({ length: 10 }, (_, i) => `src/f${i}.ts`),
    );
    expect(file.targets[0]!.reason).toBe(
      "hotspot: 2 changes in four weeks × FTA 10 = 110 (+10 on last week)",
    );
    // Only m2 grew; m5 shrank and the others stayed.
    expect(file.targets.slice(10)).toEqual([
      { path: "src/m2", reason: "most-grown module: 120 → 500 lines of code (+380 on last week)" },
    ]);
    expect(targetList({})).toEqual([]);
  });

  it("names the ISO week of the date", () => {
    expect(isoWeek("2026-11-08")).toBe("2026-W45");
    expect(isoWeek("2026-11-09")).toBe("2026-W46");
    expect(isoWeek("2027-01-01")).toBe("2026-W53");
    expect(isoWeek("2025-12-29")).toBe("2026-W01");
  });

  it("counts code, comment and blank lines the way scc splits them", () => {
    expect(countLines("// a\n/* b\n c */\n\nconst x = 1;\n")).toEqual({
      code: 1,
      comment: 3,
      blank: 1,
    });
  });

  it("never writes into the repo: .spec-sync/ is ignored", () => {
    expect(existsSync(join(repoRoot, ".gitignore"))).toBe(true);
    const ignored = execFileSync(
      "git",
      ["check-ignore", ".spec-sync/growth/growth-2026-W45.json"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        timeout: SPAWN_TIMEOUT,
      },
    );
    expect(ignored.trim()).toBe(".spec-sync/growth/growth-2026-W45.json");
  });
});
