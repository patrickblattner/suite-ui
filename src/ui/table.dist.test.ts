// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DEFAULT = {
  container: "relative w-full overflow-x-auto",
  header: "[&_tr]:border-b",
  row: "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
  head: "h-10 px-3 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
  cell: "px-3 py-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
};
const STICKY_HEADER = "sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_0_var(--border)]";
const STICKY_ACTIONS =
  "data-[col-kind=actions]:sticky data-[col-kind=actions]:right-0 data-[col-kind=actions]:bg-background";
// The sticky head cell draws the header rule itself, its ground would cover it.
const STICKY_HEAD_LINE = "data-[col-kind=actions]:shadow-[inset_0_-1px_0_0_var(--border)]";

// AC6: every form is one literal class string in the source and in the built `dist` (the gate builds
// before the unit phase), where the apps' Tailwind scan finds it.
describe("Table class strings", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const source = readFileSync(`${root}src/ui/table.tsx`, "utf8");
  const built = readdirSync(`${root}dist`, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".js"))
    .map((file) => readFileSync(`${root}dist/${file}`, "utf8"))
    .join("\n");
  const forms = [
    ...Object.values(DEFAULT),
    "relative w-full",
    `${STICKY_HEADER} [&_tr]:border-b`,
    "border-b transition-colors data-[grid-row]:hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
    `${DEFAULT.head} ${STICKY_ACTIONS} ${STICKY_HEAD_LINE}`,
    `${DEFAULT.cell} ${STICKY_ACTIONS}`,
  ];

  it.each(forms)("%s", (form) => {
    expect(source).toContain(`"${form}"`);
    expect(built).toContain(`"${form}"`);
  });
});
