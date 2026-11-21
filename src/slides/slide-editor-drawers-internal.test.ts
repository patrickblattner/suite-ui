import { describe, expect, it, vi } from "vitest";

import { SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { safeParseSlideDocument } from "./document.js";
import type { SlideDocument } from "./schema.js";
import { type PagesContext, pageSorterActions } from "./slide-editor-drawers-internal.js";

const parsed = safeParseSlideDocument(SLIDE_EDITOR_DOC);
if (!parsed.ok) throw new Error("the showcase document is valid");
const document: SlideDocument = parsed.document;

const actions = (change: Partial<PagesContext> = {}) => {
  const ctx: PagesContext = {
    document,
    page: 0,
    pageCap: undefined,
    pagesFull: false,
    fits: () => true,
    holding: (current) => current,
    changePages: vi.fn(),
    onOnePage: vi.fn(),
    ...change,
  };
  return { ctx, actions: pageSorterActions(ctx) };
};

describe("pageSorterActions (SUI-FEATURE-161 §Seiten)", () => {
  it("moves a page and shows it where it went", () => {
    const { ctx, actions: sorter } = actions();
    sorter.onMove(0, 1);
    const [next, shown, keep] = vi.mocked(ctx.changePages).mock.calls[0]!;
    expect(next.pages[1]!.id).toBe(document.pages[0]!.id);
    expect(shown).toBe(1);
    expect(keep("x")).toBe("x");
  });

  it("duplicates a page and shows the copy; nothing at the cap or for a refused document", () => {
    const { ctx, actions: sorter } = actions();
    sorter.onDuplicate(0);
    const [next, shown, keep] = vi.mocked(ctx.changePages).mock.calls[0]!;
    expect(next.pages).toHaveLength(document.pages.length + 1);
    expect(keep("x")).toBe(next.pages[shown]!.id);
    const full = actions({ pagesFull: true });
    full.actions.onDuplicate(0);
    full.actions.onNew(undefined);
    expect(full.ctx.changePages).not.toHaveBeenCalled();
    const refused = actions({ fits: () => false });
    refused.actions.onDuplicate(0);
    refused.actions.onNew(undefined);
    expect(refused.ctx.changePages).not.toHaveBeenCalled();
  });

  it("deletes a page, shows its neighbour and asks for the canvas's focus at one page under a cap of 1", () => {
    const { ctx, actions: sorter } = actions({
      pageCap: 1,
      document: { ...document, pages: document.pages.slice(0, 2) },
    });
    sorter.onDelete(1);
    const [next, shown, keep] = vi.mocked(ctx.changePages).mock.calls[0]!;
    expect(next.pages).toHaveLength(1);
    expect(shown).toBe(0);
    expect(keep("gone")).toBe(next.pages[0]!.id);
    expect(ctx.onOnePage).toHaveBeenCalled();
  });

  it("hides a page and keeps it shown", () => {
    const { ctx, actions: sorter } = actions();
    sorter.onHidden(0, true);
    const [next, shown] = vi.mocked(ctx.changePages).mock.calls[0]!;
    expect(next.pages[0]!.hidden).toBe(true);
    expect(shown).toBe(0);
  });
});
