// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { afterAll, describe, expect, it } from "vitest";

// SUI-DESIGN-011 rev 5: an app that imports only `registerSuiteStringsLazy` gets English in its entry
// chunk and German and Spanish in chunks of their own. Bundles the built package (the gate builds
// before the unit phase) through its `exports` and `sideEffects`, as an app's bundler resolves it.
const root = fileURLToPath(new URL("../../", import.meta.url));
const work = mkdtempSync(join(tmpdir(), "suite-ui-split-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe("@suite/ui/strings bundle split", () => {
  it("keeps de and es out of the entry chunk of registerSuiteStringsLazy", async () => {
    mkdirSync(join(work, "node_modules", "@suite"), { recursive: true });
    symlinkSync(root, join(work, "node_modules", "@suite", "ui"), "dir");
    writeFileSync(
      join(work, "entry.js"),
      'import { registerSuiteStringsLazy } from "@suite/ui/strings";\nexport { registerSuiteStringsLazy };\n',
    );
    const result = await build({
      absWorkingDir: work,
      entryPoints: ["entry.js"],
      bundle: true,
      splitting: true,
      format: "esm",
      outdir: "out",
      write: false,
      preserveSymlinks: true,
      logLevel: "silent",
    });
    const entry = result.outputFiles.find((file) => file.path.endsWith("/entry.js"));
    const chunks = result.outputFiles.filter((file) => file !== entry);
    expect(entry?.text).toContain('"Save"');
    for (const word of ['"Speichern"', '"Guardar"']) {
      expect(entry?.text).not.toContain(word);
      expect(chunks.filter((chunk) => chunk.text.includes(word))).toHaveLength(1);
    }
    // German and Spanish never share a chunk.
    expect(
      chunks.filter(
        (chunk) => chunk.text.includes('"Speichern"') && chunk.text.includes('"Guardar"'),
      ),
    ).toEqual([]);
  });
});
