// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL(".", import.meta.url));

// Every string literal of a source file that animates every property while fading when disabled: the
// opacity would then animate instead of jumping (`GL-UI-014`).
function animatedDisabledFades(source: string): string[] {
  return (source.match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) ?? []).filter(
    (literal) => literal.includes("transition-all") && literal.includes("disabled:opacity"),
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe("transitions", () => {
  it("finds a class string that carries transition-all next to disabled:opacity", () => {
    expect(animatedDisabledFades(`cn("a transition-all disabled:opacity-50", "b")`)).toEqual([
      `"a transition-all disabled:opacity-50"`,
    ]);
  });

  it("no class string in src/ carries both transition-all and disabled:opacity", () => {
    const files = sourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap((file) =>
      animatedDisabledFades(readFileSync(file, "utf8")).map((literal) => `${file}: ${literal}`),
    );
    expect(offenders).toEqual([]);
  });
});
