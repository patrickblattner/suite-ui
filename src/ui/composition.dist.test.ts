// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

// SUI-FEATURE-126 AC 4: `isCompositionKey` is published, typed, as `@suite/ui/ui/composition` and in
// the `ui` barrel, from the built `dist` (the gate builds before the unit phase).
describe("isCompositionKey in dist", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));

  it("is exported by @suite/ui/ui/composition and checks isComposing and key code 229", async () => {
    const mod = (await import(pathToFileURL(`${root}dist/ui/composition.js`).href)) as {
      isCompositionKey: (event: { isComposing: boolean; keyCode: number }) => boolean;
    };
    expect(mod.isCompositionKey({ isComposing: true, keyCode: 69 })).toBe(true);
    expect(mod.isCompositionKey({ isComposing: false, keyCode: 229 })).toBe(true);
    expect(mod.isCompositionKey({ isComposing: false, keyCode: 13 })).toBe(false);
  });

  it("is typed for a DOM and a React keyboard event, and re-exported by the ui barrel", () => {
    expect(readFileSync(`${root}dist/ui/composition.d.ts`, "utf8")).toContain("isCompositionKey");
    expect(readFileSync(`${root}dist/lib/keyboard.d.ts`, "utf8")).toMatch(
      /isCompositionKey\(event: KeyboardEvent \| React\.KeyboardEvent\): boolean/,
    );
    expect(readFileSync(`${root}dist/ui/index.d.ts`, "utf8")).toMatch(
      /export \{ isCompositionKey \} from '\.\.\/lib\/keyboard\.js'/,
    );
  });
});
