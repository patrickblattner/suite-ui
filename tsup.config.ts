import { copyFile } from "node:fs/promises";
import { defineConfig } from "tsup";

// Transpile file by file (no bundling): every source module becomes its own file in `dist/`, so
// each `exports` subpath (including the `ui/*`, `list/*`, `settings/*` and `shell/*` wildcards)
// maps to one file, shared modules exist once, and peer dependencies are never bundled.
export default defineConfig({
  entry: ["src/**/*.{ts,tsx}", "!src/**/*.test.{ts,tsx}", "!src/test-setup.ts"],
  format: ["esm"],
  bundle: false,
  dts: true,
  clean: true,
  target: "es2022",
  onSuccess: async () => {
    await copyFile("src/styles.css", "dist/styles.css");
  },
});
