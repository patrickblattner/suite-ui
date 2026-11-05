import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { SlideEditor, type SlideEditorHandle, type SlideEditorProps } from "./slide-editor.js";
import type { SlideExtensions, SlideOverlay } from "./slide-view.js";

// `SUI-FEATURE-134`: the host's slots — header status, page-panel section, overlay toggles, host
// steps in the undo history with `onReset`.

// jsdom has no layout observer and no scrolling; the slots need nothing more.
const noop = () => {};
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = noop;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = noop;
      unobserve = noop;
      disconnect = noop;
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function editor(props: Partial<SlideEditorProps> = {}) {
  const onChange = vi.fn();
  const ref = React.createRef<SlideEditorHandle>();
  const element = (more: Partial<SlideEditorProps>) => (
    <SlideEditor
      document={SLIDE_EDITOR_DOC}
      title="Deck"
      brand={SLIDE_BRAND}
      onSave={() => true}
      onChange={onChange}
      onBack={() => {}}
      ref={ref}
      {...props}
      {...more}
    />
  );
  const view = render(element({}));
  // The same editor with some props changed.
  const rerender = (more: Partial<SlideEditorProps>) => view.rerender(element(more));
  return { onChange, ref, rerender };
}

const header = () => document.querySelector<HTMLElement>("[data-slot=editor-header]")!;
const firstLayer = () => screen.getAllByTestId("slide-editor-layer")[0]!;
const lockButton = () => within(firstLayer()).getByTestId("slide-editor-layer-lock");
const click = (testId: string) => fireEvent.click(screen.getAllByTestId(testId)[0]!);

describe("SlideEditor host slots (SUI-FEATURE-134)", () => {
  // AC1
  it("shows the host's status in the header's status place, and nothing there without it", () => {
    editor({ status: <span data-testid="host-status">Uploading</span> });
    expect(
      within(header()).getByTestId("host-status").closest("[data-slot=editor-status]"),
    ).not.toBeNull();
    cleanup();
    editor();
    expect(header().querySelector("[data-slot=editor-status]")).toBeNull();
  });

  // AC2
  it("shows the page panel under its title with nothing selected, hides it on a selection", () => {
    editor({ pagePanel: { title: "Template fields", content: <p>Headline</p> } });
    const section = screen.getByTestId("slide-editor-page-panel");
    expect(within(section).getByRole("heading", { name: "Template fields" })).toBeInTheDocument();
    expect(section).toHaveTextContent("Headline");
    fireEvent.click(screen.getByTestId("drawer-layers"));
    fireEvent.click(within(firstLayer()).getByTestId("slide-editor-layer-select"));
    expect(screen.queryByTestId("slide-editor-page-panel")).toBeNull();
  });

  it("shows the host's read-only page panel content under readOnly", () => {
    editor({ readOnly: true, pagePanel: { title: "Template fields", content: <p>Fixed</p> } });
    expect(screen.getByTestId("slide-editor-page-panel")).toHaveTextContent("Fixed");
  });

  // AC3
  it("gives each labelled overlay a toggle that shows and hides only it, never in onChange", () => {
    const onOverlaysShown = vi.fn();
    const extensions: SlideExtensions = {
      overlays: [
        {
          id: "safe",
          label: "Safe zones",
          hint: "Shows the safe zones",
          render: () => <span>safe</span>,
        },
        {
          id: "phone",
          label: "Phone frame",
          hint: "Shows the phone frame",
          render: () => <span>phone</span>,
        },
        { id: "always", render: () => <span>always</span> },
      ],
    };
    const { onChange } = editor({ extensions, onOverlaysShown });
    const safe = screen.getByRole("button", { name: "Safe zones" });
    expect(screen.getByRole("button", { name: "Phone frame" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByTestId("slide-editor-overlay-toggle-always")).toBeNull();
    expect(safe).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(safe);
    expect(safe).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("slide-editor-overlay-safe")).toBeNull();
    expect(screen.getByTestId("slide-editor-overlay-phone")).toBeInTheDocument();
    expect(screen.getByTestId("slide-editor-overlay-always")).toBeInTheDocument();
    expect(onOverlaysShown).toHaveBeenLastCalledWith(["phone"]);
    fireEvent.click(safe);
    expect(screen.getByTestId("slide-editor-overlay-safe")).toBeInTheDocument();
    expect(onOverlaysShown).toHaveBeenLastCalledWith(["phone", "safe"]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows a labelled overlay added after mount at once", () => {
    const safe = {
      id: "safe",
      label: "Safe zones",
      hint: "Shows the safe zones",
      render: () => <span>safe</span>,
    };
    const { rerender } = editor({ extensions: { overlays: [safe] } });
    fireEvent.click(screen.getByRole("button", { name: "Safe zones" }));
    rerender({
      extensions: {
        overlays: [
          safe,
          {
            id: "phone",
            label: "Phone frame",
            hint: "Shows the phone frame",
            render: () => <span>phone</span>,
          },
        ],
      },
    });
    expect(screen.getByRole("button", { name: "Phone frame" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("slide-editor-overlay-phone")).toBeInTheDocument();
    // The one toggled off before stays off.
    expect(screen.queryByTestId("slide-editor-overlay-safe")).toBeNull();
  });

  it("follows overlaysShown when the host keeps it", () => {
    const extensions: SlideExtensions = {
      overlays: [
        {
          id: "safe",
          label: "Safe zones",
          hint: "Shows the safe zones",
          render: () => <span>safe</span>,
        },
      ],
    };
    editor({ extensions, overlaysShown: [] });
    expect(screen.getByRole("button", { name: "Safe zones" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByTestId("slide-editor-overlay-safe")).toBeNull();
  });

  // AC3 (rev 7): the toggle's hint, by the package `Hint`, is its description for focus and hover.
  it("gives each labelled overlay's toggle its own hint as description", () => {
    editor({
      extensions: {
        overlays: [
          { id: "safe", label: "Safe zones", hint: "Shows the safe zones", render: () => null },
          { id: "phone", label: "Phone frame", hint: "Shows the phone frame", render: () => null },
        ],
      },
    });
    expect(screen.getByRole("button", { name: "Safe zones" })).toHaveAccessibleDescription(
      "Shows the safe zones",
    );
    expect(screen.getByRole("button", { name: "Phone frame" })).toHaveAccessibleDescription(
      "Shows the phone frame",
    );
  });

  // AC3 (rev 8): a labelled entry without `hint` fails type-checking (checked by `tsc`); a hint
  // without a label too, and an unlabelled entry needs neither.
  it("requires a hint with a label in the overlay type", () => {
    const render = () => null;
    const overlays: SlideOverlay[] = [
      // @ts-expect-error -- a labelled overlay without its hint
      { id: "safe", label: "Safe zones", render },
      // @ts-expect-error -- a hint without a label
      { id: "lost", hint: "Shows nothing", render },
      { id: "always", render },
      { id: "phone", label: "Phone frame", hint: "Shows the phone frame", render },
    ];
    expect(overlays).toHaveLength(4);
  });

  // AC4 (rev 7): bleed 40 → the overlay's box reaches 40 format px beyond each page edge, the page
  // keeps its size, the bleed takes no press, and fit makes room for the largest bleed shown.
  it("draws an overlay's bleed beyond the page edge and fits the page with it", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private callback: ResizeObserverCallback) {}
        observe = () =>
          this.callback(
            [{ contentRect: { width: 1048, height: 1000 } } as ResizeObserverEntry],
            this,
          );
        unobserve = noop;
        disconnect = noop;
      },
    );
    const seen: { zoom: number; width: number; height: number }[] = [];
    const extensions: SlideExtensions = {
      overlays: [
        {
          id: "phone",
          label: "Phone frame",
          hint: "Shows the phone frame",
          bleed: 40,
          render: ({ zoom, width, height }) => {
            seen.push({ zoom, width, height });
            return <span data-testid="phone-drawn" />;
          },
        },
        { id: "safe", bleed: 10, render: () => null },
      ],
    };
    const { onChange } = editor({ extensions });
    // (1048 − 48) / (800 + 2 × 40) and (1000 − 48) / (450 + 80): the width decides, 1000 / 880.
    const zoom = 1000 / 880;
    const last = seen.at(-1)!;
    expect(last.zoom).toBeCloseTo(zoom);
    expect(last.width).toBeCloseTo(800 * zoom);
    expect(last.height).toBeCloseTo(450 * zoom);
    const box = screen.getByTestId("slide-editor-overlay-phone");
    expect(parseFloat(box.style.inset)).toBeCloseTo(-40 * zoom);
    expect(box).toHaveClass("pointer-events-none");
    // The page keeps its size; the room for the bleed lies around it.
    const frame = box.parentElement!;
    expect(parseFloat(frame.style.width)).toBeCloseTo(800 * zoom);
    expect(parseFloat(frame.style.height)).toBeCloseTo(450 * zoom);
    expect(parseFloat(frame.style.marginBlock)).toBeCloseTo(40 * zoom);
    // A press in the bleed selects nothing.
    fireEvent.pointerDown(box);
    fireEvent.click(box);
    expect(screen.queryByTestId("slide-editor-handles")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    // Hidden, its bleed no longer counts: the smaller one shown decides, (1048 − 48) / 820.
    fireEvent.click(screen.getByRole("button", { name: "Phone frame" }));
    expect(screen.queryByTestId("phone-drawn")).toBeNull();
    expect(parseFloat(screen.getByTestId("slide-editor-overlay-safe").style.inset)).toBeCloseTo(
      -10 * (1000 / 820),
    );
  });

  // #806 review: a bleed that is not a finite size of 0 or more would leave the canvas without a size.
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "refuses an overlay with a bleed of %s",
    (bleed) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() =>
        editor({ extensions: { overlays: [{ id: "frame", bleed, render: () => null }] } }),
      ).toThrow(/"frame" has a bleed of/);
    },
  );

  it("refuses two overlays with the same id", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const render = () => <span />;
    expect(() =>
      editor({
        extensions: {
          overlays: [
            { id: "x", render },
            { id: "x", render },
          ],
        },
      }),
    ).toThrow(/used twice/);
  });

  // AC4
  it("undoes a host step before the document edit and redoes both in order, no onChange", () => {
    const { onChange, ref } = editor();
    const calls: string[] = [];
    fireEvent.click(screen.getByTestId("drawer-layers"));
    fireEvent.click(lockButton());
    expect(lockButton()).toHaveAttribute("aria-pressed", "true");
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() =>
      ref.current!.recordHostStep({
        undo: () => calls.push("host undo"),
        redo: () => calls.push("host redo"),
      }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    click("editor-undo");
    expect(calls).toEqual(["host undo"]);
    expect(lockButton()).toHaveAttribute("aria-pressed", "true");
    click("editor-undo");
    expect(lockButton()).toHaveAttribute("aria-pressed", "false");
    click("editor-redo");
    expect(lockButton()).toHaveAttribute("aria-pressed", "true");
    expect(calls).toEqual(["host undo"]);
    click("editor-redo");
    expect(calls).toEqual(["host undo", "host redo"]);
    // The lock, its undo and its redo; the host steps fire none.
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  // AC4 (rev 6): a host step whose field is in the page panel brings the panel back on Undo and Redo.
  it("clears the selection on Undo and Redo of a host step with reveal, keeps it without", () => {
    const { ref } = editor({ pagePanel: { title: "Record", content: <p>Name</p> } });
    const select = () => {
      if (screen.queryAllByTestId("slide-editor-layer").length === 0) {
        fireEvent.click(screen.getByTestId("drawer-layers"));
      }
      fireEvent.click(within(firstLayer()).getByTestId("slide-editor-layer-select"));
      expect(screen.queryByTestId("slide-editor-page-panel")).toBeNull();
    };
    const host = vi.fn();
    act(() => ref.current!.recordHostStep({ undo: host, redo: host }));
    act(() => ref.current!.recordHostStep({ undo: host, redo: host, reveal: "page-panel" }));
    select();
    click("editor-undo");
    expect(host).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("slide-editor-page-panel")).toBeInTheDocument();
    select();
    click("editor-redo");
    expect(host).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("slide-editor-page-panel")).toBeInTheDocument();
    // Without `reveal` the selection stays.
    click("editor-undo");
    select();
    click("editor-undo");
    expect(host).toHaveBeenCalledTimes(4);
    expect(screen.queryByTestId("slide-editor-page-panel")).toBeNull();
  });

  // AC5 (rev 5): the host's fields count as part of the draft.
  it("treats hostDirty like a changed document", async () => {
    const onBack = vi.fn();
    const { rerender } = editor({ hostDirty: true, onBack });
    const state = () => screen.getAllByTestId("editor-state")[0]!;
    const enabled = (testId: string) =>
      expect(screen.getAllByTestId(testId)[0]).not.toHaveAttribute("aria-disabled", "true");
    expect(state()).toHaveTextContent("Draft");
    enabled("editor-reset");
    enabled("editor-save");
    click("editor-back");
    expect(await screen.findByTestId("leave-guard")).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("leave-guard-cancel"));
    rerender({ hostDirty: false });
    expect(state()).toHaveTextContent("Saved");
    expect(screen.getAllByTestId("editor-reset")[0]).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByTestId("editor-save")[0]).toHaveAttribute("aria-disabled", "true");
  });

  it("ignores hostDirty under readOnly", () => {
    const onBack = vi.fn();
    editor({ readOnly: true, hostDirty: true, onBack });
    // "Read only" stands in place of the state, never a draft.
    expect(header()).toHaveTextContent("Read only");
    expect(header()).not.toHaveTextContent("Draft");
    click("editor-back");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // AC6 (rev 5): Reset is a boundary — the host resets once, the history starts anew.
  it("calls onReset once on the confirmed Reset and clears the history, host steps too", async () => {
    const onReset = vi.fn();
    const hostUndo = vi.fn();
    const { ref } = editor({ onReset });
    fireEvent.click(screen.getByTestId("drawer-layers"));
    fireEvent.click(lockButton());
    act(() => ref.current!.recordHostStep({ undo: hostUndo, redo: () => {} }));
    click("editor-reset");
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId("editor-reset-confirm-confirm"));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(lockButton()).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByTestId("editor-undo")[0]).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByTestId("editor-redo")[0]).toHaveAttribute("aria-disabled", "true");
    click("editor-undo");
    fireEvent.keyDown(screen.getByTestId("slide-editor-canvas"), { key: "z", ctrlKey: true });
    expect(hostUndo).not.toHaveBeenCalled();
    expect(lockButton()).toHaveAttribute("aria-pressed", "false");
  });

  it("records no host step under readOnly", () => {
    const { ref, rerender } = editor({ readOnly: true });
    const undo = vi.fn();
    act(() => ref.current!.recordHostStep({ undo, redo: () => {} }));
    // Editable again: nothing to undo, the host's undo never runs.
    rerender({ readOnly: false });
    const button = screen.getAllByTestId("editor-undo")[0]!;
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(undo).not.toHaveBeenCalled();
  });
});

describe("SlideEditor subtitle and inner gutter (SUI-FEATURE-380)", () => {
  // AC1
  it("renders the subtitle as the header's one page-subtitle, none without it", () => {
    editor({ subtitle: "Record WS-0042" });
    const subtitles = header().querySelectorAll("[data-testid=page-subtitle]");
    expect(subtitles).toHaveLength(1);
    expect(subtitles[0]).toHaveTextContent("Record WS-0042");
    cleanup();
    editor();
    expect(header().querySelector("[data-testid=page-subtitle]")).toBeNull();
  });

  // AC4: the measurement at 1920 px is the gallery's; here the classes on the scrolling elements.
  it("gives the canvas scroller and the panel body the end gutter and a stable bar gutter", () => {
    editor();
    for (const id of ["slide-editor-canvas-area", "property-panel-body"]) {
      const scroller = screen.getByTestId(id);
      expect(scroller).toHaveClass("pe-[var(--page-gutter)]", "[scrollbar-gutter:stable]");
      expect(scroller.className).not.toMatch(/(^|\s)(p|px)-\d/);
    }
    expect(screen.getByTestId("slide-editor-canvas-area")).toHaveClass("ps-2", "overflow-auto");
    expect(screen.getByTestId("property-panel-body")).toHaveClass("ps-4", "overflow-y-auto");
  });
});
