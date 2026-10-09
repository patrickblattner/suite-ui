// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// GL-UI-010: components never set `font-mono`; identifiers take `Code` (SUI-FEATURE-044).
describe("font-mono", () => {
  it("appears in no source file under src/", () => {
    const src = fileURLToPath(new URL("./", import.meta.url));
    const hits = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.(ts|tsx|css)$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) => readFileSync(`${src}${file}`, "utf8").includes("font-mono"));
    expect(hits).toEqual([]);
  });
});
