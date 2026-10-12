// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const BASE = {
  head: "h-10 px-3 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
  cell: "px-3 py-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
};
const STICKY_HEADER = "sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_0_var(--border)]";
const STICKY_EDGE =
  "data-[col-kind=actions]:in-data-actions-shadow:[--actions-edge:-8px_0_8px_-8px_var(--shadow-edge)]";
const STUCK = "data-[col-kind=actions]:in-data-actions-stuck";
// Sticky only while the scroller overflows (`data-actions-stuck`); the head on the background with
// the header rule it would cover, the cell with an opaque ground under the row's own background.
const STICKY_HEAD_ACTIONS = `${STICKY_EDGE} ${STUCK}:sticky ${STUCK}:right-0 ${STUCK}:bg-background ${STUCK}:shadow-[inset_0_-1px_0_0_var(--border),var(--actions-edge,0_0_#0000)]`;
const STICKY_CELL_ACTIONS = `${STICKY_EDGE} ${STUCK}:sticky ${STUCK}:right-0 ${STUCK}:bg-inherit ${STUCK}:shadow-[var(--actions-edge,0_0_#0000)] ${STUCK}:before:absolute ${STUCK}:before:inset-0 ${STUCK}:before:-z-10 ${STUCK}:before:bg-background ${STUCK}:after:absolute ${STUCK}:after:inset-0 ${STUCK}:after:-z-10 ${STUCK}:after:bg-inherit`;

// AC6 (SUI-FEATURE-029), SUI-FEATURE-002: every class is one literal string in the source and in the built `dist` (the gate builds
// before the unit phase), where the apps' Tailwind scan finds it.
describe("Table class strings", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const source = readFileSync(`${root}src/ui/table.tsx`, "utf8");
  const built = readdirSync(`${root}dist`, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".js"))
    .map((file) => readFileSync(`${root}dist/${file}`, "utf8"))
    .join("\n");
  const forms = [
    "relative w-full",
    `${STICKY_HEADER} [&_tr]:border-b`,
    "border-b transition-colors data-[grid-row]:hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
    `${BASE.head} ${STICKY_HEAD_ACTIONS}`,
    `${BASE.cell} ${STICKY_CELL_ACTIONS}`,
  ];

  it.each(forms)("%s", (form) => {
    expect(source).toContain(`"${form}"`);
    expect(built).toContain(`"${form}"`);
  });
});
