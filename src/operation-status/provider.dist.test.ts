// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// SUI-FEATURE-077: an app frame that imports only `OperationStatusProvider` from its own path carries
// no code of the status slot, indicator or label. Bundles the built package (the gate builds before
// the unit phase) through its `exports` with Vite, the apps' bundler. Tree-shaking is off, so the check
// is about which modules the path reaches, not about what a bundler happens to drop.
const root = fileURLToPath(new URL("../../", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as {
  peerDependencies: Record<string, string>;
  exports: Record<string, { types: string; import: string }>;
};
const peers = Object.keys(pkg.peerDependencies);
const work = mkdtempSync(join(tmpdir(), "suite-ui-operation-status-"));
beforeAll(() => {
  mkdirSync(join(work, "node_modules", "@suite"), { recursive: true });
  symlinkSync(root, join(work, "node_modules", "@suite", "ui"), "dir");
});
afterAll(() => rmSync(work, { recursive: true, force: true }));

const DISPLAY = [
  "function OperationStatusSlot",
  "function OperationIndicator",
  "function OperationLabel",
];

async function entryCode(name: string, source: string): Promise<string> {
  const input = join(work, `${name}.js`);
  writeFileSync(input, source);
  const result = (await build({
    root: work,
    configFile: false,
    logLevel: "silent",
    resolve: { preserveSymlinks: true },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input,
        treeshake: false,
        preserveEntrySignatures: "exports-only",
        external: (id) => peers.some((peer) => id === peer || id.startsWith(`${peer}/`)),
      },
    },
  })) as Rollup.RollupOutput;
  return result.output
    .filter((output): output is Rollup.OutputChunk => output.type === "chunk")
    .map((chunk) => chunk.code)
    .join("\n");
}

describe("@suite/ui/operation-status/provider", () => {
  it("is its own built entry", () => {
    expect(pkg.exports["./operation-status/provider"]).toEqual({
      types: "./dist/operation-status/provider.d.ts",
      import: "./dist/operation-status/provider.js",
    });
  });

  it("passes on only the provider and the hook; the context stays internal", async () => {
    const mod = (await import(`${root}dist/operation-status/provider.js`)) as object;
    expect(Object.keys(mod).sort()).toEqual(["OperationStatusProvider", "useOperationStatus"]);
    expect(
      Object.keys(pkg.exports).filter((path) => path.startsWith("./operation-status")),
    ).toEqual(["./operation-status/provider"]);
  });

  it("AC2: the provider alone carries no slot, indicator or label code", async () => {
    const code = await entryCode(
      "provider",
      [
        'import { OperationStatusProvider, useOperationStatus } from "@suite/ui/operation-status/provider";',
        "export { OperationStatusProvider, useOperationStatus };",
        "",
      ].join("\n"),
    );
    expect(code).toContain("function OperationStatusProvider");
    for (const marker of DISPLAY) expect(code).not.toContain(marker);
  });

  it("AC3: the old path still passes on the provider together with the display", async () => {
    const code = await entryCode(
      "old-path",
      [
        'import { OperationStatusProvider, OperationStatusSlot, useOperationStatus } from "@suite/ui/ui/operation-status";',
        "export { OperationStatusProvider, OperationStatusSlot, useOperationStatus };",
        "",
      ].join("\n"),
    );
    expect(code).toContain("function OperationStatusProvider");
    for (const marker of DISPLAY) expect(code).toContain(marker);
  });
});
