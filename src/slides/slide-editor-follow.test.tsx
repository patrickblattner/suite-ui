import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import type { SlideDocument, SlideDocumentInput } from "./schema.js";
import { SlideEditor } from "./slide-editor.js";

beforeEach(() => {
  // jsdom has no pointer capture.
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// The canvas's "Fit" in jsdom (its area measures 0).
const ZOOM = 0.25;
const at = (x: number, y: number) => ({ clientX: x * ZOOM, clientY: y * ZOOM, pointerId: 1 });

// A badge — a group of a shape behind a `both` text field, inset 8/16/8/16 — a `height` text field,
// and a shape in no group.
const BADGE: SlideDocumentInput = {
  ...SLIDE_EDITOR_DOC,
  pages: [
    {
      ...SLIDE_EDITOR_DOC.pages[0]!,
      elements: [
        {
          id: "badge",
          type: "group",
          x: 384,
          y: 292,
          width: 152,
          height: 56,
          children: [
            {
              id: "back",
              type: "shape",
              shape: "rectangle",
              x: 384,
              y: 292,
              width: 152,
              height: 56,
              follow: { id: "label", inset: { top: 8, right: 16, bottom: 8, left: 16 } },
            },
            {
              id: "label",
              type: "text",
              x: 400,
              y: 300,
              width: 120,
              height: 40,
              runs: [{ text: "Neu", size: 20 }],
              sizing: "both",
            },
          ],
        },
        {
          id: "note",
          type: "text",
          x: 40,
          y: 40,
          width: 200,
          height: 80,
          runs: [{ text: "A note", size: 20 }],
          sizing: "height",
        },
        { id: "loose", type: "shape", shape: "rectangle", x: 600, y: 40, width: 80, height: 40 },
      ],
    },
  ],
};

// jsdom lays nothing out: a text measures 10 px a character and 40 px a line.
function measure() {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(
    () => [{}] as unknown as DOMRectList,
  );
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = computed(element, pseudo);
    style.width = `${(element.textContent ?? "").length * 10}px`;
    style.height = "40px";
    return style;
  });
}

function renderEditor(document: SlideDocumentInput = BADGE) {
  const onSave = vi.fn<(document: SlideDocument) => boolean>(() => true);
  const { container } = render(
    <SlideEditor
      document={document}
      title="Deck"
      brand={SLIDE_BRAND}
      onSave={onSave}
      onBack={() => {}}
    />,
  );
  const canvas = screen.getByTestId("slide-editor-canvas");
  const select = (x: number, y: number) => {
    fireEvent.pointerDown(canvas, { ...at(x, y), button: 0 });
    fireEvent.pointerUp(canvas, at(x, y));
  };
  const handles = () =>
    screen
      .queryAllByTestId(/^slide-editor-handle-/)
      .map((handle) => handle.dataset.testid!.replace("slide-editor-handle-", ""));
  const style = (id: string) =>
    container.querySelector<HTMLElement>(`[data-slide-element="${id}"]`)!.style;
  // A child of a group: a double click on the group selects the child under the pointer.
  const pick = (x: number, y: number) => {
    select(x, y);
    fireEvent.doubleClick(canvas, at(x, y));
  };
  // The first page's elements as saved, each group's children in its place.
  const saved = async () => {
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    return onSave.mock.lastCall![0].pages[0]!.elements.flatMap((element) =>
      element.type === "group" ? element.children : [element],
    );
  };
  return { canvas, select, pick, handles, style, saved };
}

// The badge as a group whose shape follows nothing yet.
const GROUPED: SlideDocumentInput = {
  ...SLIDE_EDITOR_DOC,
  pages: [
    {
      ...SLIDE_EDITOR_DOC.pages[0]!,
      elements: [
        {
          id: "badge",
          type: "group",
          x: 384,
          y: 292,
          width: 152,
          height: 56,
          children: [
            {
              id: "back",
              type: "shape",
              shape: "rectangle",
              x: 384,
              y: 292,
              width: 152,
              height: 56,
            },
            {
              id: "label",
              type: "text",
              x: 400,
              y: 300,
              width: 120,
              height: 40,
              runs: [{ text: "Neu", size: 20 }],
              sizing: "both",
            },
          ],
        },
      ],
    },
  ],
};

// SUI-FEATURE-165 §Editor (AC5).
describe("SlideEditor sizes that follow the text", () => {
  it("offers no width handles under `both`, no height handles under `height`, none on a following shape", () => {
    const { select, handles, pick } = renderEditor();
    pick(410, 310);
    expect(handles()).toEqual(["nw", "n", "ne", "se", "s", "sw", "rotate"]);
    select(60, 60);
    expect(handles()).toEqual(["nw", "ne", "e", "se", "sw", "w", "rotate"]);
    // The shape beside the field's box.
    pick(390, 296);
    expect(handles()).toEqual(["rotate"]);
  });

  it("sets the field `fixed` when a locked handle is dragged, shown in the panel, undone in one step", () => {
    const { canvas, style, pick } = renderEditor();
    pick(410, 310);
    expect(screen.getByTestId("slide-editor-text-sizing")).toHaveTextContent(
      "Width and height follow the text",
    );
    fireEvent.pointerDown(screen.getByTestId("slide-editor-handle-s"), {
      ...at(460, 340),
      button: 0,
    });
    fireEvent.pointerMove(canvas, at(460, 400));
    fireEvent.pointerUp(canvas, at(460, 400));
    expect(style("label").height).toBe("100px");
    expect(screen.getByTestId("slide-editor-text-sizing")).toHaveTextContent("Fixed");
    // Its width handles are back.
    expect(screen.getByTestId("slide-editor-handle-e")).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(screen.getByTestId("slide-editor-text-sizing")).toHaveTextContent(
      "Width and height follow the text",
    );
    expect(style("label").height).toBe("40px");
  });

  it("stores the measured size with the text, keeps a saved draft saved, and Undo takes both back (AC5)", async () => {
    measure();
    const { canvas, style, saved, pick } = renderEditor();
    // "Neu": 30 × 40, grown from the left edge; the shape behind it with its inset.
    await waitFor(() => expect(style("label").width).toBe("30px"));
    expect(style("back").width).toBe("62px");
    expect(screen.getAllByTestId("editor-state")[0]).toHaveTextContent("Saved");

    pick(410, 310);
    fireEvent.keyDown(canvas, { key: "Enter" });
    const field = await screen.findByTestId("slide-editor-text-field");
    field.querySelector("span")!.textContent = "Neu eingetroffen";
    fireEvent.input(field);
    await waitFor(() => expect(style("label").width).toBe("160px"));
    expect(style("back").width).toBe("192px");
    fireEvent.keyDown(field, { key: "Escape" });

    const [back, label] = await saved();
    expect(label).toMatchObject({ x: 400, y: 300, width: 160, height: 40, sizing: "both" });
    expect(back).toMatchObject({ x: 384, y: 292, width: 192, height: 56 });

    // One Undo takes the text and the size it measured back.
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    await waitFor(() => expect(style("label").width).toBe("30px"));
    expect(style("back").width).toBe("62px");
    expect(screen.getAllByTestId("editor-undo")[0]).toHaveAttribute("aria-disabled", "true");
  });

  // #622: a typed size the text sets switches the field to `fixed`, a typed box frees a following
  // shape, each in one Undo step, as a handle does.
  it("sets the field `fixed` when its followed width is typed in the panel, undone in one step", async () => {
    measure();
    const { style, saved, pick } = renderEditor();
    await waitFor(() => expect(style("label").width).toBe("30px"));
    pick(410, 310);
    fireEvent.change(screen.getByTestId("slide-editor-width"), { target: { value: "300" } });
    await waitFor(() => expect(style("label").width).toBe("300px"));
    expect(screen.getByTestId("slide-editor-text-sizing")).toHaveTextContent("Fixed");
    const [, label] = await saved();
    expect(label).toMatchObject({ width: 300, sizing: "fixed" });
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(screen.getByTestId("slide-editor-text-sizing")).toHaveTextContent(
      "Width and height follow the text",
    );
    await waitFor(() => expect(style("label").width).toBe("30px"));
  });

  it("sets a `height` field `fixed` when its height is typed in the panel", async () => {
    measure();
    const { select, style, saved } = renderEditor();
    select(60, 60);
    fireEvent.change(screen.getByTestId("slide-editor-height"), { target: { value: "200" } });
    await waitFor(() => expect(style("note").height).toBe("200px"));
    const [, , note] = await saved();
    expect(note).toMatchObject({ height: 200, sizing: "fixed" });
  });

  it("frees a following shape when its box is typed in the panel, undone in one step", async () => {
    measure();
    const { style, saved, pick } = renderEditor();
    await waitFor(() => expect(style("back").width).toBe("62px"));
    pick(390, 296);
    fireEvent.change(screen.getByTestId("slide-editor-width"), { target: { value: "250" } });
    await waitFor(() => expect(style("back").width).toBe("250px"));
    const [back] = await saved();
    expect(back).toMatchObject({ width: 250 });
    expect(back).not.toHaveProperty("follow");
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    await waitFor(() => expect(style("back").width).toBe("62px"));
    const [again] = await saved();
    expect(again).toHaveProperty("follow");
  });

  // #622: the field being edited wraps as the view draws it, from the moment its sizing changes.
  it("stops wrapping the open field as soon as its sizing turns to `both`", async () => {
    const { canvas, select } = renderEditor();
    select(60, 60);
    fireEvent.keyDown(canvas, { key: "Enter" });
    const field = await screen.findByTestId("slide-editor-text-field");
    expect(field.style.whiteSpace).toBe("pre-wrap");
    fireEvent.mouseDown(screen.getByTestId("property-tab-layout"), { button: 0 });
    fireEvent.keyDown(screen.getByTestId("slide-editor-text-sizing"), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Width and height follow the text" }));
    await waitFor(() => expect(field.style.whiteSpace).toBe("pre"));
    expect(screen.getByTestId("slide-editor-text-field")).toBe(field);
  });

  // SUI-FEATURE-165 rev 4 AC9: the field's size sits on Layout under X/Y/W/H and Rotation, only there.
  it("shows a text field's size on the Layout tab under Rotation, not on the Content tab (AC9)", () => {
    const { pick } = renderEditor();
    pick(410, 310);
    const sizing = screen.getByTestId("slide-editor-text-sizing");
    expect(screen.getByTestId("slide-editor-layout")).toContainElement(sizing);
    expect(
      screen.getByTestId("slide-editor-rotation").compareDocumentPosition(sizing) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.mouseDown(screen.getByTestId("property-tab-content"), { button: 0 });
    expect(screen.queryByTestId("slide-editor-text-sizing")).toBeNull();
  });

  // SUI-FEATURE-165 rev 6 AC5: a shape above its text field, set to follow it in the panel, goes
  // directly behind it and wraps it with 8 px each side, the text in view; one Undo takes both back.
  it("puts a following shape behind its text field with 8 px padding, one Undo for both; paddings and none from the panel (AC5)", async () => {
    measure();
    const above: SlideDocumentInput = {
      ...GROUPED,
      pages: [
        {
          ...GROUPED.pages[0]!,
          elements: GROUPED.pages[0]!.elements!.map((element) =>
            element.type === "group"
              ? { ...element, children: [...element.children].reverse() }
              : element,
          ),
        },
      ],
    };
    const { canvas, style, saved } = renderEditor(above);
    const ids = async () => (await saved()).map((element) => element.id);
    fireEvent.doubleClick(canvas, at(388, 296));
    const follow = await screen.findByTestId("slide-editor-follow");
    expect(follow).toHaveTextContent("None");
    expect(screen.queryByTestId("slide-editor-inset-top")).toBeNull();
    fireEvent.keyDown(follow, { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Neu" }));
    // The field's box, 30 × 40, and 8 px each side.
    await waitFor(() => expect(style("back").width).toBe("46px"));
    expect(style("back").height).toBe("56px");
    expect(await ids()).toEqual(["back", "label"]);
    const [back] = await saved();
    expect(back).toMatchObject({
      follow: { id: "label", inset: { top: 8, right: 8, bottom: 8, left: 8 } },
    });
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(await ids()).toEqual(["label", "back"]);
    expect((await saved())[1]).not.toHaveProperty("follow");

    fireEvent.keyDown(screen.getByTestId("slide-editor-follow"), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Neu" }));
    for (const [side, value] of [
      ["right", "16"],
      ["left", "16"],
    ] as const) {
      fireEvent.change(screen.getByTestId(`slide-editor-inset-${side}`), { target: { value } });
    }
    await waitFor(() => expect(style("back").width).toBe("62px"));
    expect((await saved())[0]).toMatchObject({
      follow: { id: "label", inset: { top: 8, right: 16, bottom: 8, left: 16 } },
    });
    fireEvent.keyDown(screen.getByTestId("slide-editor-follow"), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "None" }));
    const [freed] = await saved();
    expect(freed).not.toHaveProperty("follow");
  });

  // SUI-FEATURE-165 rev 6: ungrouping drops the follow; one Undo brings the group and the follow back.
  it("drops the follow when the badge is ungrouped, one Undo brings both back", async () => {
    const { container, select, saved } = { ...renderEditor(), container: document.body };
    select(388, 296);
    fireEvent.click(screen.getAllByTestId("slide-editor-ungroup")[0]!);
    await waitFor(() => expect(container.querySelector('[data-slide-element="badge"]')).toBeNull());
    expect((await saved())[0]).not.toHaveProperty("follow");
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    await waitFor(() =>
      expect(container.querySelector('[data-slide-element="badge"]')).not.toBeNull(),
    );
    expect((await saved())[0]).toMatchObject({ id: "back", follow: { id: "label" } });
  });

  // SUI-FEATURE-165 rev 5 AC10: on Layout under X/Y/W/H and Rotation, the select in one column of
  // the panel's two-column grid like its other single selects, the insets in that grid as
  // Top, Right / Bottom, Left.
  it("shows 'Follows text' and its insets on the Layout tab under Rotation, in the two-column grid (AC10)", async () => {
    const { canvas } = renderEditor({
      ...GROUPED,
      pages: [
        {
          ...GROUPED.pages[0]!,
          elements: GROUPED.pages[0]!.elements!.map((element) =>
            element.type === "group"
              ? {
                  ...element,
                  children: element.children.map((child) =>
                    child.type === "shape"
                      ? {
                          ...child,
                          follow: {
                            id: "label",
                            inset: { top: 8, right: 16, bottom: 8, left: 16 },
                          },
                        }
                      : child,
                  ),
                }
              : element,
          ),
        },
      ],
    });
    fireEvent.doubleClick(canvas, at(388, 296));
    const follow = await screen.findByTestId("slide-editor-follow");
    const layout = screen.getByTestId("slide-editor-layout");
    const rotation = screen.getByTestId("slide-editor-rotation");
    expect(layout).toContainElement(follow);
    expect(
      rotation.compareDocumentPosition(follow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const grid = follow.closest(".grid-cols-2")!;
    expect(grid).toContainElement(rotation);
    const cells = [...grid.children];
    const cellOf = (element: HTMLElement) => cells.findIndex((cell) => cell.contains(element));
    const insets = (["top", "right", "bottom", "left"] as const).map((side) =>
      screen.getByTestId(`slide-editor-inset-${side}`),
    );
    // The select takes a cell of its own in the first column; the insets follow two by two.
    const at0 = cellOf(follow);
    expect(cells[at0]).toHaveClass("col-start-1");
    expect(insets.map(cellOf)).toEqual([at0 + 1, at0 + 2, at0 + 3, at0 + 4]);
    expect(cells[at0 + 1]).toHaveClass("col-start-1");
    expect(insets.map((inset) => (inset as HTMLInputElement).value)).toEqual([
      "8",
      "16",
      "8",
      "16",
    ]);
    // A shape has no Content tab: Layout is the only place.
    expect(screen.queryByTestId("property-tab-content")).toBeNull();
  });

  // #622 review: a long opening text is cut with an ellipsis; text fields that read the same are told
  // apart by their place among the group's text fields.
  it("names the group's text fields by their text, cut and told apart", async () => {
    const extra = (id: string, text: string) => ({
      id,
      type: "text" as const,
      x: 400,
      y: 360,
      width: 120,
      height: 40,
      runs: [{ text, size: 20 }],
    });
    const { canvas } = renderEditor({
      ...GROUPED,
      pages: [
        {
          ...GROUPED.pages[0]!,
          elements: GROUPED.pages[0]!.elements!.map((element) =>
            element.type === "group"
              ? {
                  ...element,
                  children: [
                    ...element.children,
                    extra("again", "Neu"),
                    extra("long", "A text field whose opening words run on past forty characters"),
                  ],
                }
              : element,
          ),
        },
      ],
    });
    fireEvent.doubleClick(canvas, at(388, 296));
    fireEvent.keyDown(await screen.findByTestId("slide-editor-follow"), { key: "Enter" });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "None",
      "Neu (1)",
      "Neu (2)",
      "A text field whose opening words run on…",
    ]);
  });

  it("offers no 'Follows text' for a shape outside a group", () => {
    const { select } = renderEditor();
    select(620, 60);
    expect(screen.getByTestId("slide-editor-layout")).toBeInTheDocument();
    expect(screen.queryByTestId("slide-editor-follow")).toBeNull();
  });

  it("offers no 'Follows text' for a shape in a group without a text field (AC10)", () => {
    const { canvas } = renderEditor({
      ...GROUPED,
      pages: [
        {
          ...GROUPED.pages[0]!,
          elements: GROUPED.pages[0]!.elements!.map((element) =>
            element.type === "group"
              ? {
                  ...element,
                  children: element.children.map((child) =>
                    child.type === "text"
                      ? {
                          id: "dot",
                          type: "shape" as const,
                          shape: "ellipse" as const,
                          x: 400,
                          y: 300,
                          width: 120,
                          height: 40,
                        }
                      : child,
                  ),
                }
              : element,
          ),
        },
      ],
    });
    fireEvent.doubleClick(canvas, at(388, 296));
    expect(screen.getByTestId("slide-editor-x")).toBeInTheDocument();
    expect(screen.queryByTestId("slide-editor-follow")).toBeNull();
  });
});
