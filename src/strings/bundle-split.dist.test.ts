// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";
import { afterAll, describe, expect, it } from "vitest";

// SUI-DESIGN-011 rev 5: an app that imports `registerSuiteStringsLazy` and the shared building blocks
// it mounts at start (the user menu) loads English at start and German and Spanish from chunks of
// their own. The package has no root (`.`) export to add. Bundles the built package (the gate builds
// before the unit phase) through its `exports` and `sideEffects` with Vite, the apps' bundler. Not
// esbuild: its code splitting keeps a bare static import of every module that is also reachable
// statically, so `@suite/ui/strings` (which keeps the synchronous `registerSuiteStrings`) would
// always pull de and es in at start there.
const root = fileURLToPath(new URL("../../", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as {
  peerDependencies: Record<string, string>;
};
// The app brings its peers; only the package itself is bundled.
const peers = Object.keys(pkg.peerDependencies);
const work = mkdtempSync(join(tmpdir(), "suite-ui-split-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe("@suite/ui/strings bundle split", () => {
  it("keeps de and es out of what registerSuiteStringsLazy and the user menu load at start", async () => {
    mkdirSync(join(work, "node_modules", "@suite"), { recursive: true });
    symlinkSync(root, join(work, "node_modules", "@suite", "ui"), "dir");
    writeFileSync(
      join(work, "entry.js"),
      [
        'import { registerSuiteStringsLazy } from "@suite/ui/strings";',
        'import { UserMenu } from "@suite/ui/shell/user-menu";',
        "export { registerSuiteStringsLazy, UserMenu };",
        "",
      ].join("\n"),
    );
    const result = (await build({
      root: work,
      configFile: false,
      logLevel: "silent",
      resolve: { preserveSymlinks: true },
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: join(work, "entry.js"),
          preserveEntrySignatures: "exports-only",
          external: (id) => peers.some((name) => id === name || id.startsWith(`${name}/`)),
        },
      },
    })) as Rollup.RollupOutput;
    const chunks = result.output.filter(
      (output): output is Rollup.OutputChunk => output.type === "chunk",
    );
    // What the app loads at start: the entry chunk and every chunk it reaches by static import.
    const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
    const atStart = new Set<string>();
    const visit = (fileName: string): void => {
      if (atStart.has(fileName)) return;
      atStart.add(fileName);
      for (const imported of byName.get(fileName)?.imports ?? []) visit(imported);
    };
    for (const chunk of chunks) if (chunk.isEntry) visit(chunk.fileName);
    const startCode = chunks
      .filter((chunk) => atStart.has(chunk.fileName))
      .map((chunk) => chunk.code)
      .join("\n");
    const later = chunks.filter((chunk) => !atStart.has(chunk.fileName));
    expect(startCode).toContain('"Save"');
    for (const word of ['"Speichern"', '"Guardar"']) {
      expect(startCode).not.toContain(word);
      expect(later.filter((chunk) => chunk.code.includes(word))).toHaveLength(1);
    }
    // German and Spanish never share a chunk.
    expect(
      later.filter(
        (chunk) => chunk.code.includes('"Speichern"') && chunk.code.includes('"Guardar"'),
      ),
    ).toEqual([]);
  });
});
