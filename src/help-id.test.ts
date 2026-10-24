// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// GL-UI-017 rev 6 §Assistive Tech (#438): the label help's id is deterministic and spelled in one
// place, `helpIdFor()` of `label-with-help.tsx`; no source builds a `…-help` id by hand, the
// gallery's included (#511).
const roots = [
  fileURLToPath(new URL("./", import.meta.url)),
  fileURLToPath(new URL("../gallery/", import.meta.url)),
];

describe("label help ids", () => {
  it.each(roots)("are built by helpIdFor() only in %s", (root) => {
    const sources = readdirSync(root, { recursive: true, encoding: "utf8" }).filter(
      (file) =>
        /\.tsx?$/.test(file) &&
        !/\.(test|spec)\.tsx?$/.test(file) &&
        !file.endsWith("label-with-help.tsx"),
    );
    const spelled = sources.filter((file) =>
      /-help["`]/.test(readFileSync(`${root}${file}`, "utf8")),
    );
    expect(sources.length).toBeGreaterThan(0);
    expect(spelled).toEqual([]);
  });
});
