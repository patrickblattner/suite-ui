// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SUI-FEATURE-031: the classes of the action row and the tabbed body are literal strings in the
// source and in the built `dist` (the gate builds before the unit phase), where the apps' Tailwind
// scan finds them.
describe("Settings class strings", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const source = ["settings-footer.tsx", "settings-scaffold.tsx"]
    .map((file) => readFileSync(`${root}src/settings/${file}`, "utf8"))
    .join("\n");
  const built = readdirSync(`${root}dist/settings`, { encoding: "utf8" })
    .filter((file) => file.endsWith(".js"))
    .map((file) => readFileSync(`${root}dist/settings/${file}`, "utf8"))
    .join("\n");
  const forms = [
    "flex gap-2",
    "flex min-h-0 flex-1 flex-col gap-4",
    "relative min-h-0 flex-1 overflow-y-auto pb-4",
  ];

  it.each(forms)("%s", (form) => {
    expect(source).toContain(`"${form}"`);
    expect(built).toContain(`"${form}"`);
  });
});
