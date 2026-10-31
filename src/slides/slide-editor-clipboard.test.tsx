import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSlideMedia, SLIDE_BRAND } from "../../gallery/slide-showcase.js";
import { FORMAT_16_9, SLIDE_LIMITS, type SlideDocument, type SlideElement } from "./schema.js";
import { elementClipboard } from "./element-clipboard-internal.js";
import { SlideEditor } from "./slide-editor.js";
import { toast } from "../ui/toaster.js";

beforeEach(() => {
  // The clipboard is the session's: each test starts with it empty.
  elementClipboard.elements = [];
  // jsdom has no pointer capture.
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// The canvas's "Fit" in jsdom (its area measures 0).
const ZOOM = 0.25;
const at = (x: number, y: number) => ({ clientX: x * ZOOM, clientY: y * ZOOM });

const shape = (id: string, x: number, y: number) => ({
  id,
  name: id,
  type: "shape" as const,
  shape: "rectangle" as const,
  x,
  y,
  width: 100,
  height: 100,
});
const background = { type: "color" as const, color: { kind: "free" as const, value: "#fff" } };
const payload = { "ext.gallery.image-filter": { warmth: 20, brightness: -5 }, note: ["kept", 1] };

const DOC = {
  schemaVersion: 6 as const,
  format: FORMAT_16_9,
  pages: [
    {
      id: "one",
      background,
      elements: [
        shape("a", 0, 0),
        shape("b", 300, 0),
        {
          id: "pair",
          name: "pair",
          type: "group" as const,
          x: 600,
          y: 300,
          width: 300,
          height: 100,
          children: [
            {
              ...shape("left", 600, 300),
              animation: { entrance: { effect: "fade" as const, duration: 300, order: 0 } },
            },
            shape("right", 800, 300),
          ],
        },
        {
          id: "photo",
          name: "photo",
          type: "image" as const,
          x: 40,
          y: 400,
          width: 160,
          height: 100,
          media: { id: "photo" },
          payload,
        },
        {
          id: "words",
          name: "words",
          type: "text" as const,
          x: 300,
          y: 400,
          width: 200,
          height: 40,
          runs: [{ text: "Some words", size: 20 }],
        },
      ],
    },
    { id: "two", background, elements: [] },
  ],
};

function renderEditor(props: Partial<React.ComponentProps<typeof SlideEditor>> = {}) {
  const onSave = vi.fn((saved: SlideDocument) => {
    void saved;
    return true as const;
  });
  render(
    <SlideEditor
      document={DOC}
      title="Deck"
      brand={SLIDE_BRAND}
      resolveMedia={resolveSlideMedia}
      onSave={onSave}
      onBack={() => {}}
      {...props}
    />,
  );
  return onSave;
}

const canvas = () => screen.getByTestId("slide-editor-canvas");
const key = (key: string, target: Element = canvas()) =>
  fireEvent.keyDown(target, { key, ctrlKey: true });
const select = (id: string) => {
  if (screen.queryByTestId("slide-editor-layers") === null)
    fireEvent.click(screen.getByTestId("drawer-layers"));
  const row = screen
    .getAllByTestId("slide-editor-layer")
    .find((node) => node.getAttribute("data-layer-id") === id)!;
  fireEvent.click(row.querySelector("button")!);
};
const click = (x: number, y: number, shiftKey = false) => {
  fireEvent.pointerDown(canvas(), { ...at(x, y), button: 0, pointerId: 1, shiftKey });
  fireEvent.pointerUp(canvas(), at(x, y));
};
const nextPage = () => {
  fireEvent.click(screen.getByTestId("drawer-document"));
  fireEvent.click(screen.getByTestId("slide-editor-next-page"));
};
const openMenu = (x: number, y: number) => {
  fireEvent.contextMenu(canvas(), at(x, y));
  return screen.getByTestId("slide-editor-menu");
};
async function saved(onSave: ReturnType<typeof renderEditor>, index = 0) {
  fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  return onSave.mock.lastCall![0].pages[index]!.elements;
}
// An element of the first page as given, any id.
const original = (id: string) => ({
  ...DOC.pages[0]!.elements.find((e) => e.id === id)!,
  id: expect.any(String) as unknown,
});
const without = (element: SlideElement): unknown =>
  JSON.parse(
    JSON.stringify(element, (name, value: unknown) => (name === "id" ? undefined : value)),
  );

// SUI-FEATURE-191: duplicate, copy, cut and paste of elements on the canvas and in its menu.
describe("SlideEditor element clipboard", () => {
  it("names when Paste becomes usable while nothing was cut or copied (GL-UI-017)", () => {
    renderEditor();
    openMenu(1200, 600);
    const paste = screen.getByTestId("slide-editor-menu-paste");
    expect(paste).toHaveAttribute("aria-disabled", "true");
    const description = document.getElementById(paste.getAttribute("aria-describedby")!);
    expect(description).toHaveTextContent("Paste: possible once an element is cut or copied.");
  });

  it("duplicates two elements with Ctrl+D as one step Undo takes back (AC1)", async () => {
    const onSave = renderEditor();
    click(50, 50);
    click(350, 50, true);
    key("d");
    const layerIds = () =>
      screen.getAllByTestId("slide-editor-layer").map((row) => row.getAttribute("data-layer-id"));
    fireEvent.click(screen.getByTestId("drawer-layers"));
    expect(layerIds()).toHaveLength(9);
    // The copies are selected: a further Ctrl+D copies them, not the originals.
    expect(
      screen.getAllByTestId("slide-editor-layer-select").filter((b) => b.ariaPressed === "true"),
    ).toHaveLength(2);
    key("z");
    expect(layerIds()).toHaveLength(7);
    key("y");
    const elements = await saved(onSave);
    const copies = elements.filter((e) => !["a", "b", "pair", "photo", "words"].includes(e.id));
    expect(copies.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 10, y: 10 },
      { x: 310, y: 10 },
    ]);
  });

  it("duplicates from the canvas menu, whose entries name their keys (AC1, AC6)", async () => {
    const onSave = renderEditor();
    const menu = openMenu(50, 50);
    const entry = (name: string) => screen.getByTestId(`slide-editor-menu-${name}`);
    expect(menu).toBeInTheDocument();
    expect(entry("cut")).toHaveAttribute("aria-keyshortcuts", "Control+X Meta+X");
    expect(entry("copy")).toHaveAttribute("aria-keyshortcuts", "Control+C Meta+C");
    expect(entry("duplicate")).toHaveAttribute("aria-keyshortcuts", "Control+D Meta+D");
    fireEvent.click(entry("duplicate"));
    openMenu(50, 50);
    expect(entry("paste")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(entry("copy"));
    openMenu(50, 50);
    expect(entry("paste")).not.toHaveAttribute("aria-disabled");
    expect(entry("paste")).toHaveAttribute("aria-keyshortcuts", "Control+V Meta+V");
    fireEvent.keyDown(entry("paste"), { key: "Escape" });
    const elements = await saved(onSave);
    expect(elements).toHaveLength(6);
    expect(elements[1]).toMatchObject({ type: "shape", x: 10, y: 10 });
  });

  it("pastes a copied group on another page where it was, with new ids (AC2)", async () => {
    const onSave = renderEditor();
    select("pair");
    key("c");
    nextPage();
    key("v");
    const [pasted] = await saved(onSave, 1);
    const original = onSave.mock.lastCall![0].pages[0]!.elements.find((e) => e.id === "pair")!;
    expect(pasted).toMatchObject({ x: 600, y: 300 });
    expect(without(pasted!)).toEqual(without(original));
    const ids = JSON.stringify(pasted).match(/"id":"[^"]+"/g)!;
    expect(ids).toHaveLength(3);
    for (const id of ["pair", "left", "right"]) expect(ids).not.toContain(`"id":"${id}"`);
  });

  it("cuts with Ctrl+X and pastes from the menu on another page (AC2)", async () => {
    const onSave = renderEditor();
    select("b");
    key("x");
    nextPage();
    fireEvent.click(within(openMenu(10, 10), "paste"));
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const [first, second] = onSave.mock.lastCall![0].pages;
    expect(first!.elements.map((e) => e.id)).not.toContain("b");
    expect(second!.elements).toHaveLength(1);
    expect(second!.elements[0]).toMatchObject(original("b"));
    expect(second!.elements[0]!.id).not.toBe("b");
  });

  // Selects a and b on the canvas, then locks a: the selection stays.
  const selectWithLockedA = () => {
    click(50, 50);
    click(350, 50, true);
    fireEvent.click(screen.getByTestId("drawer-layers"));
    const row = screen
      .getAllByTestId("slide-editor-layer")
      .find((node) => node.getAttribute("data-layer-id") === "a")!;
    fireEvent.click(row.querySelector('[data-testid="slide-editor-layer-lock"]')!);
  };

  it("cuts a locked element as a copy and leaves it in place, the copy unlocked (AC6)", async () => {
    const onSave = renderEditor();
    selectWithLockedA();
    key("x");
    nextPage();
    key("v");
    fireEvent.click(screen.getAllByTestId("editor-save")[0]!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const [first, second] = onSave.mock.lastCall![0].pages;
    expect(first!.elements.map((e) => e.id)).toEqual(["a", "pair", "photo", "words"]);
    expect(first!.elements[0]).toMatchObject({ locked: true });
    expect(second!.elements.map(({ x, y, locked }) => ({ x, y, locked }))).toEqual([
      { x: 0, y: 0, locked: false },
      { x: 300, y: 0, locked: false },
    ]);
  });

  it("duplicates a selection with a locked element whole, the copies unlocked (AC6)", async () => {
    const onSave = renderEditor();
    selectWithLockedA();
    key("d");
    const elements = await saved(onSave);
    expect(elements.map(({ x, y, locked }) => ({ x, y, locked })).slice(0, 4)).toEqual([
      { x: 0, y: 0, locked: true },
      { x: 10, y: 10, locked: false },
      { x: 300, y: 0, locked: false },
      { x: 310, y: 10, locked: false },
    ]);
  });

  // Another document of the session: its own brand set and media, the first page empty.
  const OTHER_BRAND = {
    colors: {
      ink: { value: "#101010", label: "Ink" },
      primary: { value: "#ff0000", label: "Red" },
    },
    fonts: { plain: { family: "Plain", label: "Plain" } },
    defaults: { text: "ink" },
  };
  const OTHER = { ...DOC, pages: [{ id: "other", background, elements: [] }] };
  const copyThenOpenOther = (id: string, props: Parameters<typeof renderEditor>[0]) => {
    renderEditor();
    select(id);
    key("c");
    cleanup();
    return renderEditor({ document: OTHER, brand: OTHER_BRAND, ...props });
  };

  it("brings an image's medium into another document through adoptMedia (SUI-FEATURE-106 AC1)", async () => {
    const adoptMedia = vi.fn(() => Promise.resolve({ photo: "photo-copy" }));
    const onSave = copyThenOpenOther("photo", {
      adoptMedia,
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    key("v");
    fireEvent.click(screen.getByTestId("drawer-layers"));
    await waitFor(() => expect(screen.getAllByTestId("slide-editor-layer")).toHaveLength(1));
    expect(adoptMedia).toHaveBeenCalledTimes(1);
    expect(adoptMedia).toHaveBeenCalledWith(["photo"]);
    const [pasted] = await saved(onSave);
    expect(pasted).toMatchObject({ type: "image", media: { id: "photo-copy" }, payload });
  });

  it("pastes an image whose medium did not come along, with a hint (SUI-FEATURE-106 AC4)", async () => {
    const warning = vi.spyOn(toast, "warning");
    const onSave = copyThenOpenOther("photo", {
      adoptMedia: () => Promise.reject(new Error("offline")),
      resolveMedia: () => undefined,
    });
    key("v");
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    expect(warning.mock.lastCall![0]).toContain("photo");
    const [pasted] = await saved(onSave);
    expect(pasted).toMatchObject({ type: "image", media: { id: "photo" } });
    key("z");
    fireEvent.click(screen.getByTestId("drawer-layers"));
    expect(screen.queryAllByTestId("slide-editor-layer")).toHaveLength(0);
    warning.mockRestore();
  });

  it("pastes an image whose medium did not come along without adoptMedia, with a hint (SUI-FEATURE-106 AC4)", async () => {
    const warning = vi.spyOn(toast, "warning");
    const onSave = copyThenOpenOther("photo", { resolveMedia: () => undefined });
    key("v");
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.lastCall![0]).toContain("photo");
    expect(screen.getByText("Image photo not found")).toBeInTheDocument();
    const [pasted] = await saved(onSave);
    expect(pasted).toMatchObject({ type: "image", media: { id: "photo" } });
    key("z");
    fireEvent.click(screen.getByTestId("drawer-layers"));
    expect(screen.queryAllByTestId("slide-editor-layer")).toHaveLength(0);
    warning.mockRestore();
  });

  it("hints at a medium the app renamed that still does not resolve (SUI-FEATURE-106)", async () => {
    const warning = vi.spyOn(toast, "warning");
    const onSave = copyThenOpenOther("photo", {
      adoptMedia: () => Promise.resolve({ photo: "photo-copy" }),
      resolveMedia: () => undefined,
    });
    key("v");
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    expect(warning.mock.lastCall![0]).toContain("photo");
    expect(screen.getByText("Image photo-copy not found")).toBeInTheDocument();
    const [pasted] = await saved(onSave);
    expect(pasted).toMatchObject({ type: "image", media: { id: "photo-copy" } });
    warning.mockRestore();
  });

  it("pastes a second Ctrl+V pressed while the app adopts media after the first lands (#535)", async () => {
    const answers: ((remap: Record<string, string>) => void)[] = [];
    const adoptMedia = vi.fn(
      () => new Promise<Record<string, string>>((resolve) => answers.push(resolve)),
    );
    const onSave = copyThenOpenOther("photo", {
      adoptMedia,
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    key("v");
    key("v");
    expect(adoptMedia).toHaveBeenCalledTimes(1);
    answers[0]!({ photo: "photo-copy" });
    await waitFor(() => expect(adoptMedia).toHaveBeenCalledTimes(2));
    answers[1]!({ photo: "photo-copy" });
    await waitFor(async () => expect(await saved(onSave)).toHaveLength(2));
  });

  it("drops a paste whose adoptMedia answers after the editor closed (SUI-FEATURE-106)", async () => {
    const warning = vi.spyOn(toast, "warning");
    let answer: (remap: Record<string, string>) => void = () => {};
    const onSave = copyThenOpenOther("photo", {
      adoptMedia: () => new Promise((resolve) => (answer = resolve)),
      resolveMedia: () => undefined,
    });
    key("v");
    cleanup();
    answer({});
    await Promise.resolve();
    await Promise.resolve();
    expect(warning).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    warning.mockRestore();
  });

  it("lands a paste whose adoptMedia answers during a drag once the drag ends (#525)", async () => {
    let answer: (remap: Record<string, string>) => void = () => {};
    const onSave = copyThenOpenOther("photo", {
      document: { ...DOC, pages: [{ id: "other", background, elements: [shape("a", 0, 0)] }] },
      adoptMedia: () => new Promise((resolve) => (answer = resolve)),
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    key("v");
    fireEvent.pointerDown(canvas(), { ...at(50, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(250, 50));
    answer({ photo: "photo-copy" });
    await Promise.resolve();
    await Promise.resolve();
    fireEvent.pointerMove(canvas(), at(450, 50));
    fireEvent.pointerUp(canvas(), at(450, 50));
    fireEvent.click(screen.getByTestId("drawer-layers"));
    await waitFor(() => expect(screen.getAllByTestId("slide-editor-layer")).toHaveLength(2));
    const elements = await saved(onSave);
    expect(elements.map(({ type, x }) => ({ type, x }))).toEqual([
      { type: "shape", x: 400 },
      { type: "image", x: 40 },
    ]);
    expect(elements[1]).toMatchObject({ media: { id: "photo-copy" } });
  });

  it("pastes a second Ctrl+V pressed during a drag after the paste the drag holds (#535)", async () => {
    const answers: ((remap: Record<string, string>) => void)[] = [];
    const adoptMedia = vi.fn(
      () => new Promise<Record<string, string>>((resolve) => answers.push(resolve)),
    );
    const onSave = copyThenOpenOther("photo", {
      document: { ...DOC, pages: [{ id: "other", background, elements: [shape("a", 0, 0)] }] },
      adoptMedia,
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    key("v");
    fireEvent.pointerDown(canvas(), { ...at(50, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(250, 50));
    answers[0]!({ photo: "photo-copy" });
    await Promise.resolve();
    await Promise.resolve();
    key("v");
    expect(adoptMedia).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(canvas(), at(250, 50));
    await waitFor(() => expect(adoptMedia).toHaveBeenCalledTimes(2));
    answers[1]!({ photo: "photo-copy" });
    await waitFor(async () =>
      expect((await saved(onSave)).map(({ type, x }) => ({ type, x }))).toEqual([
        { type: "shape", x: 200 },
        { type: "image", x: 40 },
        { type: "image", x: 50 },
      ]),
    );
  });

  it("lands a paste held by a drag once Esc cancels the drag (#525)", async () => {
    let answer: (remap: Record<string, string>) => void = () => {};
    const onSave = copyThenOpenOther("photo", {
      document: { ...DOC, pages: [{ id: "other", background, elements: [shape("a", 0, 0)] }] },
      adoptMedia: () => new Promise((resolve) => (answer = resolve)),
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    key("v");
    fireEvent.pointerDown(canvas(), { ...at(50, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(250, 50));
    answer({ photo: "photo-copy" });
    await Promise.resolve();
    await Promise.resolve();
    fireEvent.keyDown(canvas(), { key: "Escape" });
    fireEvent.pointerUp(canvas(), at(250, 50));
    fireEvent.click(screen.getByTestId("drawer-layers"));
    await waitFor(() => expect(screen.getAllByTestId("slide-editor-layer")).toHaveLength(2));
    const elements = await saved(onSave);
    expect(elements.map(({ type, x }) => ({ type, x }))).toEqual([
      { type: "shape", x: 0 },
      { type: "image", x: 40 },
    ]);
  });

  it("deletes with Delete after Ctrl+V during a drag what the paste landed, once adoptMedia answers (#533)", async () => {
    let answer: (remap: Record<string, string>) => void = () => {};
    const onSave = copyThenOpenOther("photo", {
      document: { ...DOC, pages: [{ id: "other", background, elements: [shape("a", 0, 0)] }] },
      adoptMedia: () => new Promise((resolve) => (answer = resolve)),
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    fireEvent.pointerDown(canvas(), { ...at(50, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(250, 50));
    key("v");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    fireEvent.pointerMove(canvas(), at(450, 50));
    fireEvent.pointerUp(canvas(), at(450, 50));
    answer({ photo: "photo-copy" });
    await waitFor(async () =>
      expect((await saved(onSave)).map(({ type, x }) => ({ type, x }))).toEqual([
        { type: "shape", x: 400 },
      ]),
    );
    key("z");
    expect((await saved(onSave)).map(({ type, x }) => ({ type, x }))).toEqual([
      { type: "shape", x: 400 },
      { type: "image", x: 40 },
    ]);
  });

  it("keeps a held Delete behind a held paste adoptMedia answers during the next drag (#533)", async () => {
    let answer: (remap: Record<string, string>) => void = () => {};
    const onSave = copyThenOpenOther("photo", {
      document: { ...DOC, pages: [{ id: "other", background, elements: [shape("a", 0, 0)] }] },
      adoptMedia: () => new Promise((resolve) => (answer = resolve)),
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    fireEvent.pointerDown(canvas(), { ...at(50, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(250, 50));
    key("v");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    fireEvent.pointerUp(canvas(), at(250, 50));
    fireEvent.pointerDown(canvas(), { ...at(250, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(450, 50));
    answer({ photo: "photo-copy" });
    await Promise.resolve();
    await Promise.resolve();
    fireEvent.pointerUp(canvas(), at(450, 50));
    await waitFor(async () =>
      expect((await saved(onSave)).map(({ type, x }) => ({ type, x }))).toEqual([
        { type: "shape", x: 400 },
      ]),
    );
  });

  it("deletes with Delete during a later drag once a held paste's adoptMedia stays silent 10 s (#535)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSave = copyThenOpenOther("photo", {
      document: { ...DOC, pages: [{ id: "other", background, elements: [shape("a", 0, 0)] }] },
      adoptMedia: () => new Promise(() => {}),
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    fireEvent.pointerDown(canvas(), { ...at(50, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(250, 50));
    key("v");
    fireEvent.pointerUp(canvas(), at(250, 50));
    fireEvent.pointerDown(canvas(), { ...at(250, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(450, 50));
    fireEvent.keyDown(canvas(), { key: "Delete" });
    fireEvent.pointerUp(canvas(), at(450, 50));
    // The end of the drag frees nothing: the Delete waits behind the paste.
    expect((await saved(onSave)).map(({ id, x }) => ({ id, x }))).toEqual([{ id: "a", x: 400 }]);
    act(() => void vi.advanceTimersByTime(10_000));
    await waitFor(async () =>
      expect((await saved(onSave)).map(({ type }) => type)).toEqual(["image"]),
    );
  });

  it("moves and deletes with the keys of a later drag, on what they were pressed on, once a held paste's adoptMedia stays silent 10 s (#535)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSave = copyThenOpenOther("photo", {
      document: {
        ...DOC,
        pages: [{ id: "other", background, elements: [shape("a", 0, 0), shape("b", 600, 0)] }],
      },
      adoptMedia: () => new Promise(() => {}),
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    fireEvent.pointerDown(canvas(), { ...at(50, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(250, 50));
    key("v");
    fireEvent.pointerUp(canvas(), at(250, 50));
    fireEvent.pointerDown(canvas(), { ...at(650, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(850, 50));
    fireEvent.keyDown(canvas(), { key: "ArrowRight" });
    fireEvent.keyDown(canvas(), { key: "Delete" });
    fireEvent.pointerUp(canvas(), at(850, 50));
    act(() => void vi.advanceTimersByTime(10_000));
    await waitFor(async () =>
      expect((await saved(onSave)).map(({ type, x }) => ({ type, x }))).toEqual([
        { type: "shape", x: 200 },
        { type: "image", x: 40 },
      ]),
    );
    key("z");
    expect((await saved(onSave)).map(({ x }) => x)).toEqual([200, 801, 40]);
  });

  it("deletes what each Delete was meant for behind a paste that stays silent 10 s, leaving none held (#535)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSave = copyThenOpenOther("photo", {
      document: {
        ...DOC,
        pages: [{ id: "other", background, elements: [shape("a", 0, 0), shape("b", 600, 0)] }],
      },
      adoptMedia: () => new Promise(() => {}),
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    fireEvent.pointerDown(canvas(), { ...at(50, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(250, 50));
    key("v");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    fireEvent.pointerUp(canvas(), at(250, 50));
    fireEvent.pointerDown(canvas(), { ...at(650, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(850, 50));
    fireEvent.keyDown(canvas(), { key: "Delete" });
    fireEvent.pointerUp(canvas(), at(850, 50));
    act(() => void vi.advanceTimersByTime(10_000));
    // The first Delete takes the paste, the second b, selected by hand when it was pressed.
    await waitFor(async () => expect((await saved(onSave)).map((e) => e.id)).toEqual(["a"]));
    // A third drag must not set off a Delete left over.
    fireEvent.pointerDown(canvas(), { ...at(250, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(450, 50));
    fireEvent.pointerUp(canvas(), at(450, 50));
    expect((await saved(onSave)).map(({ id, x }) => ({ id, x }))).toEqual([{ id: "a", x: 400 }]);
  });

  it("pastes with placeholder and hint as one step once adoptMedia stays silent 10 s, dropping a later answer (SUI-FEATURE-106 AC3)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const warning = vi.spyOn(toast, "warning");
    let answer: (remap: Record<string, string>) => void = () => {};
    const onSave = copyThenOpenOther("photo", {
      document: { ...DOC, pages: [{ id: "other", background, elements: [shape("a", 0, 0)] }] },
      adoptMedia: () => new Promise((resolve) => (answer = resolve)),
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    key("v");
    act(() => void vi.advanceTimersByTime(9_999));
    expect(warning).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.lastCall![0]).toContain("photo");
    expect(screen.getByText("Image photo not found")).toBeInTheDocument();
    answer({ photo: "photo-copy" });
    await Promise.resolve();
    await Promise.resolve();
    const elements = await saved(onSave);
    expect(elements).toHaveLength(2);
    expect(elements[1]).toMatchObject({ type: "image", media: { id: "photo" } });
    // The queue is free: Delete acts at once, on the pasted image; one Undo each.
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(await saved(onSave)).toHaveLength(1);
    key("z");
    key("z");
    expect((await saved(onSave)).map((e) => e.id)).toEqual(["a"]);
    warning.mockRestore();
  });

  it("runs Delete, Arrow and Undo pressed outside a drag behind a waiting paste, in order (SUI-FEATURE-106 AC1)", async () => {
    let answer: (remap: Record<string, string>) => void = () => {};
    const onSave = copyThenOpenOther("photo", {
      document: {
        ...DOC,
        pages: [{ id: "other", background, elements: [shape("a", 0, 0), shape("b", 600, 0)] }],
      },
      adoptMedia: () => new Promise((resolve) => (answer = resolve)),
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    click(650, 50);
    key("v");
    // Meant for the paste: nothing selected by hand since.
    fireEvent.keyDown(canvas(), { key: "ArrowRight" });
    // Meant for b, selected by hand.
    click(650, 50);
    fireEvent.keyDown(canvas(), { key: "Delete" });
    key("z");
    expect(layerCount()).toBe(2);
    answer({ photo: "photo-copy" });
    // Paste, its image moved, b deleted, then Undo brings b back.
    await waitFor(() => expect(layerCount()).toBe(3));
    expect((await saved(onSave)).map(({ type, x }) => ({ type, x }))).toEqual([
      { type: "shape", x: 0 },
      { type: "shape", x: 600 },
      { type: "image", x: 41 },
    ]);
  });

  it("runs Redo pressed behind a queued Undo, with an empty history, once the paste lands (#561)", async () => {
    let answer: (remap: Record<string, string>) => void = () => {};
    const onSave = copyThenOpenOther("photo", {
      adoptMedia: () => new Promise((resolve) => (answer = resolve)),
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    key("v");
    key("z");
    key("y");
    // The queue drains in one act: paste, Undo takes it back, Redo brings it again.
    await act(async () => {
      answer({ photo: "photo-copy" });
      await Promise.resolve();
    });
    expect(layerCount()).toBe(1);
    expect((await saved(onSave)).map(({ type }) => type)).toEqual(["image"]);
  });

  it("lands the paste, then Delete on it, leaving b a later drag moved (SUI-FEATURE-106 AC4)", async () => {
    let answer: (remap: Record<string, string>) => void = () => {};
    const onSave = copyThenOpenOther("photo", {
      document: {
        ...DOC,
        pages: [{ id: "other", background, elements: [shape("a", 0, 0), shape("b", 600, 0)] }],
      },
      adoptMedia: () => new Promise((resolve) => (answer = resolve)),
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    fireEvent.pointerDown(canvas(), { ...at(50, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(250, 50));
    key("v");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    fireEvent.pointerUp(canvas(), at(250, 50));
    fireEvent.pointerDown(canvas(), { ...at(650, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(850, 50));
    fireEvent.pointerUp(canvas(), at(850, 50));
    answer({ photo: "photo-copy" });
    await waitFor(async () =>
      expect((await saved(onSave)).map(({ id, x }) => ({ id, x }))).toEqual([
        { id: "a", x: 200 },
        { id: "b", x: 800 },
      ]),
    );
    key("z");
    expect((await saved(onSave)).map(({ type }) => type)).toEqual(["shape", "shape", "image"]);
  });

  // The other document with a, its image's paste waiting until `answer` is called.
  const waitingPaste = () => {
    let answer: (remap: Record<string, string>) => void = () => {};
    const onSave = copyThenOpenOther("photo", {
      document: { ...DOC, pages: [{ id: "other", background, elements: [shape("a", 0, 0)] }] },
      adoptMedia: () => new Promise((resolve) => (answer = resolve)),
      resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
    });
    return { onSave, answer: () => answer({ photo: "photo-copy" }) };
  };

  it("deletes a with Delete after a's resize handle was pressed during a wait (#535)", async () => {
    const { onSave, answer } = waitingPaste();
    key("v");
    // The wait drops the selection's handles (`SUI-FEATURE-106` AC6): a is selected by hand first.
    click(50, 50);
    fireEvent.pointerDown(screen.getByTestId("slide-editor-handle-se"), {
      ...at(100, 100),
      button: 0,
      pointerId: 1,
    });
    fireEvent.pointerMove(canvas(), at(150, 150));
    fireEvent.pointerUp(canvas(), at(150, 150));
    fireEvent.keyDown(canvas(), { key: "Delete" });
    answer();
    await waitFor(() => expect(layerCount()).toBe(1));
    expect((await saved(onSave)).map(({ type }) => type)).toEqual(["image"]);
  });

  it("deletes a with Delete after a's resize handle was pressed behind a held Ctrl+D (#535)", async () => {
    const { onSave, answer } = waitingPaste();
    key("v");
    click(50, 50);
    key("d");
    // The press on a's handle picks a again by hand: Delete is meant for a, not the duplicate.
    fireEvent.pointerDown(screen.getByTestId("slide-editor-handle-se"), {
      ...at(100, 100),
      button: 0,
      pointerId: 1,
    });
    fireEvent.pointerUp(canvas(), at(100, 100));
    fireEvent.keyDown(canvas(), { key: "Delete" });
    answer();
    await waitFor(() => expect(layerCount()).toBe(2));
    const elements = await saved(onSave);
    expect(elements.map(({ type }) => type).sort()).toEqual(["image", "shape"]);
    expect(elements.map(({ id }) => id)).not.toContain("a");
  });

  it.each([
    ["cut", ["image"], "a"],
    ["copy", ["shape", "image"], "a"],
    ["duplicate", ["shape", "shape", "image"], undefined],
  ] as const)(
    "%ss a from the canvas menu after a right click on a during a wait (#535)",
    async (entry, types, clipboard) => {
      elementClipboard.elements = [];
      const { onSave, answer } = waitingPaste();
      click(50, 50);
      key("v");
      const kept = elementClipboard.elements;
      fireEvent.click(within(openMenu(50, 50), entry));
      answer();
      await waitFor(() => expect(layerCount()).toBe(types.length));
      expect((await saved(onSave)).map(({ type }) => type)).toEqual(types);
      if (clipboard === undefined) expect(elementClipboard.elements).toBe(kept);
      else expect(elementClipboard.elements.map(({ name }) => name)).toEqual([clipboard]);
    },
  );

  it("offers Cut on what a waiting paste pastes, nothing selected, and cuts it once it lands (#535)", async () => {
    const { onSave, answer } = waitingPaste();
    click(1200, 600);
    key("v");
    const menu = openMenu(1200, 600);
    expect(screen.getByTestId("slide-editor-menu-cut")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("slide-editor-menu-copy")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("slide-editor-menu-duplicate")).not.toHaveAttribute("aria-disabled");
    fireEvent.click(within(menu, "cut"));
    answer();
    await waitFor(() => expect(elementClipboard.elements).toMatchObject([{ type: "image" }]));
    expect((await saved(onSave)).map(({ id }) => id)).toEqual(["a"]);
  });

  it.each([
    ["spinner and label where the head has the room", true],
    ["the spinner alone, the label its hint, where it has not", false],
  ] as const)(
    "says after 300 ms in the head's status slot that the media are being adopted, until the paste lands: %s (SUI-FEATURE-106 AC5)",
    async (_, roomy) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      // jsdom lays nothing out: the head's title, its floor and the label's measure get widths here.
      const rect = Object.getOwnPropertyDescriptor(Element.prototype, "getBoundingClientRect")!
        .value as (this: Element) => DOMRect;
      const widths: Record<string, number> = {
        "editor-title": 600,
        "slide-editor-adopting-measure": 120,
      };
      const box = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
        this: Element,
      ) {
        const slot =
          this.getAttribute("data-slot") ??
          (this.parentElement?.getAttribute("data-slot") === "editor-title" &&
          this === this.parentElement.firstElementChild
            ? "editor-title-floor"
            : "");
        const width = roomy ? (widths[slot] ?? (slot === "editor-title-floor" ? 100 : 0)) : 0;
        return width === 0 ? rect.call(this) : new DOMRect(0, 0, width, 20);
      });
      let answer: (remap: Record<string, string>) => void = () => {};
      copyThenOpenOther("photo", {
        adoptMedia: () => new Promise((resolve) => (answer = resolve)),
        resolveMedia: (id: string) => (id === "photo-copy" ? "blob:photo" : undefined),
      });
      expect(screen.queryByTestId("slide-editor-adopting")).toBeNull();
      key("v");
      // The live region is there before its text, so the text is announced once.
      const status = screen.getByTestId("slide-editor-adopting");
      expect(status).toHaveAttribute("role", "status");
      expect(status).toHaveAttribute("aria-live", "polite");
      act(() => void vi.advanceTimersByTime(299));
      expect(canvas()).not.toHaveAttribute("aria-busy");
      expect(status).toBeEmptyDOMElement();
      // Nothing in the head's row yet, not even an empty slot taking a gap.
      expect(document.querySelector("[data-slot=editor-status]")).toBeNull();
      act(() => void vi.advanceTimersByTime(1));
      expect(canvas()).toHaveAttribute("aria-busy", "true");
      expect(canvas().className).toContain("cursor-progress");
      expect(status).toHaveTextContent("Importing media …");
      // Seen, not only heard: in the head's status slot (`GL-UI-033`), nothing of it on the work area
      // (rev 7); the live region stays outside the slot's row.
      const slot = screen.getByTestId("slide-editor-adopting-status");
      expect(slot.closest("[data-slot=editor-status]")).not.toBeNull();
      expect(status.closest("[data-slot=editor-header]")).toBeNull();
      expect(slot.querySelector("[data-testid=operation-spinner]")).not.toBeNull();
      if (roomy) {
        expect(slot.querySelector("[data-testid=operation-label]")).toHaveTextContent(
          "Importing media …",
        );
      } else {
        expect(slot.querySelector("[data-testid=operation-label]")).toBeNull();
        expect(slot.querySelector("[role=img]")).toHaveAttribute("aria-label", "Importing media …");
        expect(slot.querySelector("[role=img]")).toHaveAttribute("tabindex", "0");
      }
      expect(
        screen
          .getAllByRole("status", { hidden: true })
          .filter((node) => node.textContent === "Importing media …"),
      ).toEqual([status]);
      expect(screen.getAllByTestId("operation-spinner")).toHaveLength(1);
      answer({ photo: "photo-copy" });
      await waitFor(() => expect(canvas()).not.toHaveAttribute("aria-busy"));
      expect(canvas().className).not.toContain("cursor-progress");
      expect(screen.queryByTestId("slide-editor-adopting-status")).toBeNull();
      expect(screen.queryByTestId("slide-editor-adopting")).toBeNull();
      box.mockRestore();
    },
  );

  it.each([
    ["folds a step further", (head: Element) => head.setAttribute("data-shrink", "3")],
    ["grows taller", (head: Element) => head.setAttribute("data-tall", "")],
  ] as const)(
    "keeps the status compact for the rest of the wait once the head %s than it stood without it (#581)",
    async (_, narrow) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      // The head has the room for the label; it reports its fold step and height as laid out.
      const rect = Object.getOwnPropertyDescriptor(Element.prototype, "getBoundingClientRect")!
        .value as (this: Element) => DOMRect;
      const box = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
        this: Element,
      ) {
        const slot = this.getAttribute("data-slot");
        if (slot === "editor-header")
          return new DOMRect(0, 0, 1200, this.hasAttribute("data-tall") ? 120 : 60);
        if (slot === "editor-title") return new DOMRect(0, 0, 600, 20);
        if (slot === "slide-editor-adopting-measure") return new DOMRect(0, 0, 120, 20);
        if (this.parentElement?.getAttribute("data-slot") === "editor-title")
          return new DOMRect(0, 0, 100, 20);
        return rect.call(this);
      });
      let answer: (remap: Record<string, string>) => void = () => {};
      copyThenOpenOther("photo", {
        adoptMedia: () => new Promise((resolve) => (answer = resolve)),
        resolveMedia: () => undefined,
      });
      key("v");
      act(() => void vi.advanceTimersByTime(300));
      const label = () =>
        screen
          .getByTestId("slide-editor-adopting-status")
          .querySelector("[data-testid=operation-label]");
      expect(label()).toHaveTextContent("Importing media …");
      const head = document.querySelector("[data-slot=editor-header]")!;
      // Narrowed while the full label shows: the room its folds or its line free is not the head's.
      // jsdom lays nothing out: the head settles by writing its bare step anew.
      await act(async () => {
        narrow(head);
        head.setAttribute("data-bare-shrink", "0");
        await Promise.resolve();
      });
      expect(label()).toBeNull();
      expect(
        screen.getByTestId("slide-editor-adopting-status").querySelector("[role=img]"),
      ).not.toBeNull();
      // Widened again, it stays compact until the paste ends.
      await act(async () => {
        head.setAttribute("data-shrink", "0");
        head.removeAttribute("data-tall");
        head.setAttribute("data-bare-shrink", "0");
        await Promise.resolve();
      });
      expect(label()).toBeNull();
      // The next paste's wait starts afresh: the head has the room again, so the label shows.
      answer({});
      await waitFor(() => expect(screen.queryByTestId("slide-editor-adopting")).toBeNull());
      key("v");
      act(() => void vi.advanceTimersByTime(300));
      expect(label()).toHaveTextContent("Importing media …");
      box.mockRestore();
    },
  );

  it("keeps a status compact from its start compact through a widening until the paste ends (#581, SUI-FEATURE-104 rev 5 AC 9, #607)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Narrow at first: the title has no room for the label beside its floor.
    let titleWidth = 150;
    const rect = Object.getOwnPropertyDescriptor(Element.prototype, "getBoundingClientRect")!
      .value as (this: Element) => DOMRect;
    const box = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      const slot = this.getAttribute("data-slot");
      if (slot === "editor-header") return new DOMRect(0, 0, 1200, 60);
      if (slot === "editor-title") return new DOMRect(0, 0, titleWidth, 20);
      if (slot === "slide-editor-adopting-measure") return new DOMRect(0, 0, 120, 20);
      if (this.parentElement?.getAttribute("data-slot") === "editor-title")
        return new DOMRect(0, 0, 100, 20);
      return rect.call(this);
    });
    copyThenOpenOther("photo", {
      adoptMedia: () => new Promise(() => {}),
      resolveMedia: () => undefined,
    });
    key("v");
    act(() => void vi.advanceTimersByTime(300));
    const status = () => screen.getByTestId("slide-editor-adopting-status");
    expect(status().querySelector("[role=img]")).not.toBeNull();
    const head = document.querySelector("[data-slot=editor-header]")!;
    // Widened, the head settles still folded beyond its bare step: the compact form holds those
    // folds, so the title's room is not the head's.
    await act(async () => {
      titleWidth = 600;
      head.setAttribute("data-shrink", "3");
      head.setAttribute("data-bare-shrink", "1");
      await Promise.resolve();
    });
    expect(status().querySelector("[data-testid=operation-label]")).toBeNull();
    // Back at its bare step with that room, it still stays compact until the paste ends.
    await act(async () => {
      head.setAttribute("data-shrink", "1");
      head.setAttribute("data-bare-shrink", "1");
      await Promise.resolve();
    });
    expect(status().querySelector("[data-testid=operation-label]")).toBeNull();
    box.mockRestore();
  });

  it("hands the focus of the compact spinner to Reset once the paste ends on a dirty deck, with no fold step (GL-UI-050, #600)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // No room for the label: the status shows the compact spinner.
    const rect = Object.getOwnPropertyDescriptor(Element.prototype, "getBoundingClientRect")!
      .value as (this: Element) => DOMRect;
    const box = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      const slot = this.getAttribute("data-slot");
      if (slot === "editor-header") return new DOMRect(0, 0, 1200, 60);
      if (slot === "editor-title") return new DOMRect(0, 0, 150, 20);
      if (slot === "slide-editor-adopting-measure") return new DOMRect(0, 0, 120, 20);
      if (this.parentElement?.getAttribute("data-slot") === "editor-title")
        return new DOMRect(0, 0, 100, 20);
      return rect.call(this);
    });
    let answer: (remap: Record<string, string>) => void = () => {};
    copyThenOpenOther("photo", {
      adoptMedia: () => new Promise((resolve) => (answer = resolve)),
      resolveMedia: () => undefined,
    });
    // A first paste lands: the deck is dirty.
    key("v");
    answer({});
    await waitFor(() => expect(screen.queryByTestId("slide-editor-adopting")).toBeNull());
    expect(screen.getByTestId("editor-reset")).toBeEnabled();
    key("v");
    act(() => void vi.advanceTimersByTime(300));
    const spinner = screen
      .getByTestId("slide-editor-adopting-status")
      .querySelector<HTMLElement>("[role=img]")!;
    act(() => spinner.focus());
    expect(spinner).toHaveFocus();
    const shrink = document.querySelector("[data-slot=editor-header]")!.getAttribute("data-shrink");
    answer({});
    await waitFor(() => expect(screen.queryByTestId("slide-editor-adopting-status")).toBeNull());
    expect(document.querySelector("[data-slot=editor-header]")!.getAttribute("data-shrink")).toBe(
      shrink,
    );
    await waitFor(() => expect(screen.getByTestId("editor-reset")).toHaveFocus());
    box.mockRestore();
  });

  it.each([
    ["stays silent 10 s", () => new Promise<Record<string, string>>(() => {})],
    [
      "fails after 300 ms",
      () =>
        new Promise<Record<string, string>>((_, reject) =>
          window.setTimeout(() => reject(new Error("offline")), 500),
        ),
    ],
  ] as const)(
    "ends the busy canvas, its cursor and status line once adoptMedia %s (SUI-FEATURE-106 AC5)",
    async (_, adoptMedia) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const warning = vi.spyOn(toast, "warning");
      copyThenOpenOther("photo", { adoptMedia, resolveMedia: () => undefined });
      key("v");
      act(() => void vi.advanceTimersByTime(300));
      expect(canvas()).toHaveAttribute("aria-busy", "true");
      expect(screen.getByTestId("slide-editor-adopting")).toHaveTextContent("Importing media …");
      await act(async () => void (await vi.advanceTimersByTimeAsync(10_000)));
      expect(warning).toHaveBeenCalledTimes(1);
      expect(canvas()).not.toHaveAttribute("aria-busy");
      expect(canvas().className).not.toContain("cursor-progress");
      expect(screen.queryByTestId("slide-editor-adopting-status")).toBeNull();
      warning.mockRestore();
    },
  );

  it("drops the selection's handles while a paste waits and selects what it pasted once it lands (SUI-FEATURE-106 AC6)", async () => {
    const { onSave, answer } = waitingPaste();
    click(50, 50);
    expect(screen.getByTestId("slide-editor-handle-se")).toBeInTheDocument();
    key("v");
    expect(screen.queryByTestId("slide-editor-handle-se")).toBeNull();
    answer();
    await waitFor(() => expect(layerCount()).toBe(2));
    expect(screen.getByTestId("slide-editor-handle-se")).toBeInTheDocument();
    // The image is selected, not a: Delete takes it.
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect((await saved(onSave)).map(({ id }) => id)).toEqual(["a"]);
  });

  // Drags a from (50, 50) to (450, 50), pressing keys on the way and cancelling with Esc if asked.
  const dragA = (press: () => void, cancel = false) => {
    fireEvent.pointerDown(canvas(), { ...at(50, 50), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(250, 50));
    press();
    fireEvent.pointerMove(canvas(), at(450, 50));
    if (cancel) fireEvent.keyDown(canvas(), { key: "Escape" });
    fireEvent.pointerUp(canvas(), at(450, 50));
  };
  const layerCount = () => {
    if (screen.queryByTestId("slide-editor-layers") === null)
      fireEvent.click(screen.getByTestId("drawer-layers"));
    return screen.getAllByTestId("slide-editor-layer").length;
  };

  it("cuts with Ctrl+X pressed during a drag once it ends, one step each (#527)", async () => {
    const onSave = renderEditor();
    dragA(() => key("x"));
    expect(layerCount()).toBe(6);
    expect(elementClipboard.elements).toMatchObject([{ type: "shape", x: 400, y: 0 }]);
    key("z");
    expect(layerCount()).toBe(7);
    const elements = await saved(onSave);
    expect(elements[0]).toMatchObject({ id: "a", x: 400 });
  });

  it("duplicates with Ctrl+D pressed during a drag once it ends, one step each (#527)", async () => {
    const onSave = renderEditor();
    dragA(() => key("d"));
    expect(layerCount()).toBe(8);
    key("z");
    expect(layerCount()).toBe(7);
    key("y");
    const elements = await saved(onSave);
    expect(elements.slice(0, 2).map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 400, y: 0 },
      { x: 410, y: 10 },
    ]);
  });

  it("cuts with Ctrl+X pressed during a drag Esc cancels, from where it was (#527)", async () => {
    const onSave = renderEditor();
    dragA(() => key("x"), true);
    expect(layerCount()).toBe(6);
    expect(elementClipboard.elements).toMatchObject([{ type: "shape", x: 0, y: 0 }]);
    const elements = await saved(onSave);
    expect(elements.map((e) => e.id)).not.toContain("a");
  });

  it("duplicates with Ctrl+D pressed during a drag Esc cancels, the copy selected (#527)", async () => {
    const onSave = renderEditor();
    dragA(() => key("d"), true);
    expect(layerCount()).toBe(8);
    const selected = screen
      .getAllByTestId("slide-editor-layer-select")
      .filter((b) => b.ariaPressed === "true");
    expect(selected).toHaveLength(1);
    const elements = await saved(onSave);
    expect(elements.slice(0, 2).map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  it("pastes back what Ctrl+X cut when Ctrl+V follows in the same drag (#527)", async () => {
    const onSave = renderEditor();
    dragA(() => {
      key("x");
      key("v");
    });
    const elements = await saved(onSave);
    expect(elements.map((e) => e.id)).not.toContain("a");
    expect(elements.at(-1)).toMatchObject({ type: "shape", x: 400, y: 0 });
  });

  it("copies with Ctrl+C during a drag Esc cancels from where it was, as a cut does (#527)", () => {
    renderEditor();
    dragA(() => key("c"), true);
    expect(elementClipboard.elements).toMatchObject([{ type: "shape", x: 0, y: 0 }]);
  });

  it("deletes with Delete pressed during a drag once it ends (#527)", async () => {
    const onSave = renderEditor();
    dragA(() => fireEvent.keyDown(canvas(), { key: "Delete" }));
    const elements = await saved(onSave);
    expect(elements.map((e) => e.id)).toEqual(["b", "pair", "photo", "words"]);
  });

  it("cuts with Ctrl+X during a frame selection what it shows, Esc or not (#527)", async () => {
    const onSave = renderEditor();
    click(50, 50);
    fireEvent.pointerDown(canvas(), { ...at(250, 200), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(350, 50));
    key("x");
    fireEvent.keyDown(canvas(), { key: "Escape" });
    fireEvent.pointerUp(canvas(), at(350, 50));
    expect(elementClipboard.elements).toMatchObject([{ type: "shape", x: 300, y: 0 }]);
    const elements = await saved(onSave);
    expect(elements.map((e) => e.id)).toEqual(["a", "pair", "photo", "words"]);
  });

  const arrow = (key: string, shiftKey = false) => fireEvent.keyDown(canvas(), { key, shiftKey });

  it("moves with the arrow keys pressed during a drag once it ends, one step each (#530)", async () => {
    const onSave = renderEditor();
    dragA(() => {
      arrow("ArrowRight");
      arrow("ArrowDown", true);
    });
    expect((await saved(onSave))[0]).toMatchObject({ id: "a", x: 401, y: 10 });
    key("z");
    expect((await saved(onSave))[0]).toMatchObject({ id: "a", x: 401, y: 0 });
    key("z");
    expect((await saved(onSave))[0]).toMatchObject({ id: "a", x: 400, y: 0 });
  });

  it("moves with an arrow key after Ctrl+D during a drag Esc cancels, in that order (#530)", async () => {
    const onSave = renderEditor();
    dragA(() => {
      key("d");
      arrow("ArrowRight", true);
    }, true);
    const xy = (elements: readonly SlideElement[]) =>
      elements.slice(0, 2).map(({ x, y }) => ({ x, y }));
    expect(xy(await saved(onSave))).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 10 },
    ]);
    key("z");
    expect(xy(await saved(onSave))).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  it("moves with the arrow keys during a frame selection what it shows, at once (#530)", async () => {
    const onSave = renderEditor();
    click(50, 50);
    fireEvent.pointerDown(canvas(), { ...at(250, 200), button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas(), at(350, 50));
    arrow("ArrowRight");
    expect((await saved(onSave))[1]).toMatchObject({ id: "b", x: 301 });
    fireEvent.keyDown(canvas(), { key: "Escape" });
    fireEvent.pointerUp(canvas(), at(350, 50));
    const elements = await saved(onSave);
    expect(elements.slice(0, 2)).toMatchObject([
      { id: "a", x: 0 },
      { id: "b", x: 301 },
    ]);
  });

  it("asks the app for every medium when the target resolves none (#525)", async () => {
    const warning = vi.spyOn(toast, "warning");
    const adoptMedia = vi.fn(() => Promise.resolve({}));
    const onSave = copyThenOpenOther("photo", { adoptMedia, resolveMedia: undefined });
    key("v");
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    expect(adoptMedia).toHaveBeenCalledWith(["photo"]);
    expect(warning.mock.lastCall![0]).toContain("photo");
    const [pasted] = await saved(onSave);
    expect(pasted).toMatchObject({ type: "image", media: { id: "photo" } });
    warning.mockRestore();
  });

  it("takes the target's brand for a key it has, its role default for one it lacks (AC9)", async () => {
    const branded = {
      ...DOC,
      pages: [
        {
          id: "one",
          background,
          elements: [
            {
              ...shape("a", 0, 0),
              fill: { type: "color" as const, color: { kind: "brand" as const, key: "primary" } },
            },
          ],
        },
      ],
    };
    const words = {
      id: "words",
      name: "words",
      type: "text" as const,
      ...{ x: 300, y: 0, width: 200, height: 40 },
      runs: [
        {
          text: "Some words",
          fill: { type: "color" as const, color: { kind: "brand" as const, key: "text" } },
          font: { kind: "brand" as const, key: "body" },
        },
      ],
    };
    branded.pages[0]!.elements.push(words as never);
    renderEditor({ document: branded });
    click(50, 50);
    click(350, 20, true);
    key("c");
    cleanup();
    const onSave = renderEditor({ document: OTHER, brand: OTHER_BRAND });
    key("v");
    const [kept, rewritten] = await saved(onSave);
    expect(kept).toMatchObject({ fill: { color: { kind: "brand", key: "primary" } } });
    expect(rewritten).toMatchObject({
      runs: [
        {
          fill: { color: { kind: "brand", key: "ink" } },
          font: { kind: "brand", key: "plain" },
        },
      ],
    });
  });

  it("keeps an image's payload byte-equal through copy and paste (AC3)", async () => {
    const onSave = renderEditor();
    select("photo");
    key("c");
    nextPage();
    key("v");
    const [pasted] = await saved(onSave, 1);
    expect(JSON.stringify(pasted!.payload)).toBe(JSON.stringify(payload));
  });

  it("pastes nothing past the element limit and says why (AC4)", () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const limits = SLIDE_LIMITS as { maxElements: number };
    const max = limits.maxElements;
    limits.maxElements = 8;
    try {
      renderEditor();
      select("pair");
      key("c");
      key("v");
      key("d");
      expect(error).toHaveBeenCalledTimes(2);
      // A group of two counts as three elements, as the limit counts them (#540).
      expect(error).toHaveBeenLastCalledWith(
        "The page can’t take that many elements. Remove some and try again.",
        expect.anything(),
      );
      expect(screen.getAllByTestId("slide-editor-layer")).toHaveLength(7);
      limits.maxElements = 7;
      click(50, 50);
      key("d");
      expect(error).toHaveBeenLastCalledWith(
        "The page can’t take another element. Remove one and try again.",
        expect.anything(),
      );
      expect(screen.getAllByTestId("slide-editor-layer")).toHaveLength(7);
    } finally {
      limits.maxElements = max;
    }
  });

  it("names one or several elements it cannot place and that the page is unchanged (#540)", () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const limits = SLIDE_LIMITS as { maxGroupDepth: number };
    const depth = limits.maxGroupDepth;
    renderEditor();
    // From here the page's group breaks a rule other than the element limit.
    limits.maxGroupDepth = 0;
    try {
      click(50, 50);
      key("d");
      expect(error).toHaveBeenLastCalledWith(
        "This element can’t be placed on the page. The page is unchanged.",
        expect.anything(),
      );
      click(350, 50, true);
      key("c");
      key("v");
      expect(error).toHaveBeenLastCalledWith(
        "These elements can’t be placed on the page. The page is unchanged.",
        expect.anything(),
      );
      fireEvent.click(screen.getByTestId("drawer-layers"));
      expect(screen.getAllByTestId("slide-editor-layer")).toHaveLength(7);
    } finally {
      limits.maxGroupDepth = depth;
    }
  });

  it("keeps the browser's menu shut while cropping", () => {
    renderEditor();
    select("photo");
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(canvas()).toHaveAttribute("data-cropping", "photo");
    expect(fireEvent.contextMenu(canvas(), at(100, 450))).toBe(false);
    expect(screen.queryByTestId("slide-editor-menu")).toBeNull();
  });

  it("leaves Ctrl+C in a text field to the text (AC5)", async () => {
    const onSave = renderEditor();
    select("a");
    key("c");
    select("words");
    fireEvent.keyDown(canvas(), { key: "Enter" });
    const field = document.querySelector<HTMLElement>("[contenteditable]")!;
    expect(field).not.toBeNull();
    const copy = fireEvent.keyDown(field, { key: "c", ctrlKey: true });
    // Not taken: the browser copies the marked text.
    expect(copy).toBe(true);
    fireEvent.keyDown(field, { key: "Escape" });
    nextPage();
    key("v");
    const pasted = await saved(onSave, 1);
    expect(pasted).toHaveLength(1);
    expect(pasted[0]).toMatchObject(original("a"));
    expect(pasted[0]!.id).not.toBe("a");
  });
});

function within(menu: HTMLElement, name: string) {
  return menu.querySelector<HTMLElement>(`[data-testid=slide-editor-menu-${name}]`)!;
}
