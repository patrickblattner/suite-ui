import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND } from "../../gallery/slide-showcase.js";
import { GALLERY_SLIDE_PROPS } from "../../gallery/SlidesPage.js";
import { parseSlideDocument } from "./document.js";
import { pagePosition } from "./render-style.js";
import { SLIDE_SCHEMA_VERSION, type SlideDocumentInput, type SlideElementInput } from "./schema.js";
import { SlideEditor } from "./slide-editor.js";
import { SlideExport } from "./slide-export.js";
import { SlidePlayer } from "./slide-player.js";
import { SlideView, type SlideAddOn, type SlideDrawContext } from "./slide-view.js";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const extensions = GALLERY_SLIDE_PROPS.extensions;
const background = { type: "color", color: { kind: "free", value: "#ffffff" } } as const;
const counter = (id: string): SlideElementInput => ({
  id,
  type: "custom",
  typeId: "gallery.page-counter",
  x: 10,
  y: 10,
  width: 100,
  height: 40,
});
const page = (id: string, hidden = false) => ({
  id,
  background,
  hidden,
  elements: [counter(`${id}-counter`)],
});
const deck = (pages: SlideDocumentInput["pages"], extra: Partial<SlideDocumentInput> = {}) =>
  ({
    schemaVersion: SLIDE_SCHEMA_VERSION,
    format: { name: "Test", width: 800, height: 450 },
    pages,
    ...extra,
  }) as SlideDocumentInput;

// Four pages, the second hidden, each with the gallery's counter.
const FOUR = deck([page("p1"), page("p2", true), page("p3"), page("p4")]);
const counterText = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-slide-element=${id}-counter]`)?.textContent;

// SUI-FEATURE-290: the renderer of an app type and an add-on's style get the page's position.
describe("page position for an app's renderer", () => {
  // AC1
  it("draws the gallery counter as 1/3, —, 2/3, 3/3 with the second of four pages hidden", () => {
    const texts = ["p1", "p2", "p3", "p4"].map((id, index) => {
      const { container, unmount } = render(
        <SlideView document={FOUR} page={index} brand={SLIDE_BRAND} extensions={extensions} />,
      );
      const text = counterText(container, id);
      unmount();
      return text;
    });
    expect(texts).toEqual(["1/3", "—", "2/3", "3/3"]);
  });

  it("hands an add-on's style the same position", () => {
    const seen: SlideDrawContext[] = [];
    const addOn: SlideAddOn = {
      type: "shape",
      id: "ext.test.seen",
      style: (_value, _element, context) => {
        seen.push(context);
        return undefined;
      },
    };
    const shape: SlideElementInput = {
      id: "box",
      type: "shape",
      shape: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      payload: { "ext.test.seen": true },
    };
    render(
      <SlideView
        document={deck([page("p1"), { id: "p2", background, elements: [shape] }])}
        page={1}
        brand={SLIDE_BRAND}
        extensions={{ addOns: [addOn] }}
      />,
    );
    expect(seen.at(-1)).toEqual({ page: { number: 2, count: 2 } });
  });

  // AC4: a master's element drawn on a page gets that page's position; no page drawn on, none.
  it("gives a master's counter each page's position, and null without a page", () => {
    const document = deck(
      [
        { id: "a", background, layoutId: "layout" },
        { id: "b", background, layoutId: "layout" },
        { id: "c", background, layoutId: "layout" },
      ],
      {
        masters: [{ id: "master", name: "Master", elements: [counter("master-counter")] }],
        layouts: [{ id: "layout", name: "Layout", masterId: "master" }],
      },
    );
    const texts = [0, 1, 2].map((index) => {
      const { container, unmount } = render(
        <SlideView document={document} page={index} brand={SLIDE_BRAND} extensions={extensions} />,
      );
      const text = counterText(container, "master");
      unmount();
      return text;
    });
    expect(texts).toEqual(["1/3", "2/3", "3/3"]);
    const parsed = parseSlideDocument(document);
    expect(pagePosition(parsed, undefined)).toBeNull();
    expect(pagePosition(parsed, 3)).toBeNull();
    const render_ = extensions.types["gallery.page-counter"].render;
    expect(() => render_(parsed.masters[0]!.elements[0] as never, { page: null })).not.toThrow();
  });

  // AC3
  it("shows the same counters in the player and the export as in the view", () => {
    const played = [0, 2, 3].map((start) => {
      const { container, unmount } = render(
        <SlidePlayer
          document={FOUR}
          brand={SLIDE_BRAND}
          extensions={extensions}
          startPage={start}
        />,
      );
      const text = counterText(container.ownerDocument.body, `p${start + 1}`);
      unmount();
      return text;
    });
    expect(played).toEqual(["1/3", "2/3", "3/3"]);
    const { container } = render(
      <SlideExport document={FOUR} brand={SLIDE_BRAND} extensions={extensions} />,
    );
    expect(["p1", "p3", "p4"].map((id) => counterText(container, id))).toEqual([
      "1/3",
      "2/3",
      "3/3",
    ]);
  });

  // AC2: the sorter's pictures and the canvas follow a move in the same step; Undo restores them.
  it("redraws every page's counter when a page moves forward, and back on Undo", () => {
    render(
      <SlideEditor
        document={FOUR}
        title="Deck"
        brand={SLIDE_BRAND}
        extensions={extensions}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("drawer-document"));
    const rows = () => screen.getAllByTestId("slide-editor-page-row");
    const thumbs = () => rows().map((row) => row.querySelector("[data-slide-element$=-counter]"));
    const counters = () => thumbs().map((one) => one?.textContent);
    expect(counters()).toEqual(["1/3", "—", "2/3", "3/3"]);
    // The fourth page moves before the third.
    fireEvent.click(within(rows()[3]!).getByTestId("slide-editor-page-up"));
    expect(rows().map((row) => row.getAttribute("data-page-id"))).toEqual(["p1", "p2", "p4", "p3"]);
    expect(counters()).toEqual(["1/3", "—", "2/3", "3/3"]);
    expect(thumbs()[2]).toHaveAttribute("data-slide-element", "p4-counter");
    // Showing the second page makes every later page's number move.
    fireEvent.click(within(rows()[1]!).getByTestId("slide-editor-page-hide"));
    expect(counters()).toEqual(["1/4", "2/4", "3/4", "4/4"]);
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(counters()).toEqual(["1/3", "—", "2/3", "3/3"]);
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(rows().map((row) => row.getAttribute("data-page-id"))).toEqual(["p1", "p2", "p3", "p4"]);
    expect(counters()).toEqual(["1/3", "—", "2/3", "3/3"]);
    expect(thumbs()[2]).toHaveAttribute("data-slide-element", "p3-counter");
  });
});
