import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { SlideEditor, type SlideEditorHandle, type SlideEditorProps } from "./slide-editor.js";
import type { SlideExtensions, SlideOverlay } from "./slide-view.js";
import { TagInput } from "../ui/tag-input.js";

// `SUI-FEATURE-134`: the host's slots — header status, page-panel section, overlay toggles, host
// steps in the undo history with `onReset`. `SUI-FEATURE-384`: the host's Stil drawer and Dokument
// section. `SUI-FEATURE-196`: the toolbar in bands with the host's `toolbarStart`, and the view
// toggles with an icon per state.

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

describe("SlideEditor awaits the host's onReset (SUI-FEATURE-383)", () => {
  // A held promise the test settles itself.
  function held() {
    let settle: { resolve: (value: void | boolean) => void; reject: (error: Error) => void } = {
      resolve: () => {},
      reject: () => {},
    };
    const promise = new Promise<void | boolean>((resolve, reject) => {
      settle = { resolve, reject };
    });
    return { promise, settle };
  }
  // Locks the first layer (a document edit) and records a host step: a dirty draft with history.
  function edited(props: Partial<SlideEditorProps>) {
    const hostUndo = vi.fn();
    const { ref } = editor(props);
    fireEvent.click(screen.getByTestId("drawer-layers"));
    fireEvent.click(lockButton());
    act(() => ref.current!.recordHostStep({ undo: hostUndo, redo: () => {} }));
    return { hostUndo };
  }
  const undoButton = () => screen.getAllByTestId("editor-undo")[0]!;
  // Document and history as they were before the Reset: lock on, Undo reaches the host step.
  const unchanged = (hostUndo: ReturnType<typeof vi.fn>) => {
    expect(lockButton()).toHaveAttribute("aria-pressed", "true");
    expect(undoButton()).not.toHaveAttribute("aria-disabled", "true");
    click("editor-undo");
    expect(hostUndo).toHaveBeenCalledTimes(1);
  };
  const discard = async () => {
    click("editor-back");
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
  };
  const confirmReset = async () => {
    click("editor-reset");
    fireEvent.click(await screen.findByTestId("editor-reset-confirm-confirm"));
  };

  // Document changes and history gone: lock off, nothing to undo.
  const cleared = () => {
    expect(lockButton()).toHaveAttribute("aria-pressed", "false");
    expect(undoButton()).toHaveAttribute("aria-disabled", "true");
  };
  // The two places that confirm a Reset: the leave guard's Discard (Back is the route) and the header.
  const surfaces = [
    ["Discard", discard, "leave-guard"],
    ["the header Reset", confirmReset, "editor-reset-confirm"],
  ] as const;

  // AC1: a pending reset holds Discard's navigation; its resolve clears the history and lets Back go.
  it.each(surfaces)(
    "waits for a pending onReset on %s, then resets",
    async (_, confirm, dialog) => {
      const { promise, settle } = held();
      const onReset = vi.fn(() => promise);
      const onBack = vi.fn();
      edited({ onReset, onBack });
      await confirm();
      expect(onBack).not.toHaveBeenCalled();
      expect(lockButton()).toHaveAttribute("aria-pressed", "true");
      await act(async () => {
        settle.resolve();
        await promise;
      });
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(onBack).toHaveBeenCalledTimes(dialog === "leave-guard" ? 1 : 0);
      cleared();
    },
  );

  // AC2: a rejected or `false` reset keeps route, document and history; the dialog closes.
  const failures = [
    ["rejects", () => Promise.reject(new Error("delete failed"))],
    ["resolves false", () => Promise.resolve(false)],
    ["returns false", () => false],
  ] as const;
  it.each(
    surfaces.flatMap((surface) => failures.map((failure) => [...surface, ...failure] as const)),
  )("keeps everything on %s when onReset %s", async (_, confirm, dialog, __, outcome) => {
    const onReset = vi.fn(outcome);
    const onBack = vi.fn();
    const { hostUndo } = edited({ onReset, onBack });
    await confirm();
    await act(async () => {});
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.queryByTestId(dialog)).toBeNull();
    unchanged(hostUndo);
  });

  // While a header Reset waits the editor locks as for the guard's `pending`; nothing calls the host
  // twice, and the lock lifts once the promise settles.
  it("locks the editor while a header Reset waits, and calls onReset only once", async () => {
    const { promise, settle } = held();
    const onReset = vi.fn(() => promise);
    edited({ onReset });
    await confirmReset();
    const surface = () => screen.getByTestId("slide-editor-canvas").closest("[inert]");
    for (const id of ["editor-reset", "editor-undo", "editor-redo"])
      expect(screen.getAllByTestId(id)[0]).toHaveAttribute("aria-disabled", "true");
    expect(surface()).not.toBeNull();
    click("editor-reset");
    expect(screen.queryByTestId("editor-reset-confirm-confirm")).toBeNull();
    await act(async () => {
      settle.resolve(false);
      await promise;
    });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(surface()).toBeNull();
    expect(screen.getAllByTestId("editor-reset")[0]).not.toHaveAttribute("aria-disabled", "true");
    expect(undoButton()).not.toHaveAttribute("aria-disabled", "true");
  });

  // #858: Back while a header Reset waits opens no dialog, so no Save or Discard starts beside the
  // reset, and the route waits for it: a reset that succeeds lets Back go on, a failed one keeps
  // route, document and history and drops the held Back (AC2).
  const backDuringReset = async (outcome: "resolve" | "false" | "reject") => {
    const { promise, settle } = held();
    const onReset = vi.fn(() => promise);
    const onSave = vi.fn(() => true);
    const onBack = vi.fn();
    const { hostUndo } = edited({ onReset, onSave, onBack });
    await confirmReset();
    click("editor-back");
    await act(async () => {});
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    await act(async () => {
      if (outcome === "reject") settle.reject(new Error("delete failed"));
      else settle.resolve(outcome === "false" ? false : undefined);
      await promise.catch(() => {});
    });
    await act(async () => {});
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    return { onBack, hostUndo };
  };
  it("holds Back during a pending header Reset and goes on once it resolves", async () => {
    const { onBack } = await backDuringReset("resolve");
    expect(onBack).toHaveBeenCalledTimes(1);
    cleared();
  });
  it.each(["false", "reject"] as const)(
    "holds Back during a pending header Reset and drops it when onReset settles %s",
    async (outcome) => {
      const { onBack, hostUndo } = await backDuringReset(outcome);
      expect(onBack).not.toHaveBeenCalled();
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      unchanged(hostUndo);
    },
  );

  // AC4 (rev 4): no save runs beside a waiting header Reset; a rejection frees Save and Reset again.
  it("disables Save and Reset while a header Reset waits, enables both on rejection", async () => {
    const { promise, settle } = held();
    const onSave = vi.fn(() => true);
    edited({ onReset: vi.fn(() => promise), onSave });
    await confirmReset();
    for (const id of ["editor-save", "editor-reset"])
      expect(screen.getAllByTestId(id)[0]).toHaveAttribute("aria-disabled", "true");
    click("editor-save");
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => {
      settle.reject(new Error("delete failed"));
      await promise.catch(() => {});
    });
    for (const id of ["editor-save", "editor-reset"])
      expect(screen.getAllByTestId(id)[0]).not.toHaveAttribute("aria-disabled", "true");
  });

  // A failed header Reset does not count against the next save: Back held during that save goes on
  // once it succeeds.
  it("carries out Back held during a save that follows a failed header Reset", async () => {
    const reset = held();
    const save = held();
    const onSave = vi.fn(() => save.promise);
    const onBack = vi.fn();
    edited({ onReset: vi.fn(() => reset.promise), onSave, onBack });
    await confirmReset();
    await act(async () => {
      reset.settle.reject(new Error("delete failed"));
      await reset.promise.catch(() => {});
    });
    click("editor-save");
    expect(onSave).toHaveBeenCalledTimes(1);
    click("editor-back");
    await act(async () => {});
    expect(onBack).not.toHaveBeenCalled();
    await act(async () => {
      save.settle.resolve(true);
      await save.promise;
    });
    await act(async () => {});
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // #859: an earlier failed save does not count against a header Reset that follows: Back held
  // during that reset goes on once it resolves. Collector row 236: a reset that then fails itself
  // (`false` or a rejection) drops the held Back and keeps the history.
  it.each(["resolve", "false", "reject"] as const)(
    "decides Back held during a header Reset after a failed save by the reset (%s)",
    async (outcome) => {
      const reset = held();
      const onSave = vi.fn(() => false);
      const onBack = vi.fn();
      const { hostUndo } = edited({ onReset: vi.fn(() => reset.promise), onSave, onBack });
      click("editor-save");
      await act(async () => {});
      expect(onSave).toHaveBeenCalledTimes(1);
      await confirmReset();
      click("editor-back");
      await act(async () => {});
      expect(onBack).not.toHaveBeenCalled();
      await act(async () => {
        if (outcome === "reject") reset.settle.reject(new Error("delete failed"));
        else reset.settle.resolve(outcome === "false" ? false : undefined);
        await reset.promise.catch(() => {});
      });
      await act(async () => {});
      if (outcome === "resolve") {
        expect(onBack).toHaveBeenCalledTimes(1);
        cleared();
        return;
      }
      expect(onBack).not.toHaveBeenCalled();
      expect(screen.queryByTestId("leave-guard")).toBeNull();
      unchanged(hostUndo);
    },
  );

  // A host whose `onReset` throws in the header Reset fails as a rejection does: nothing changes.
  it("keeps everything when onReset throws in the header Reset", async () => {
    const onReset = vi.fn(() => {
      throw new Error("delete failed");
    });
    const { hostUndo } = edited({ onReset });
    await confirmReset();
    await act(async () => {});
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("editor-reset-confirm")).toBeNull();
    unchanged(hostUndo);
  });

  // AC3: a synchronous `() => void` host resets in the same call, and Discard goes at once.
  it("lets a synchronous void onReset reset and Discard go at once", async () => {
    const onReset = vi.fn(() => {});
    const onBack = vi.fn();
    edited({ onReset, onBack });
    await discard();
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
    cleared();
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

// `SUI-FEATURE-384`: the host's Stil drawer (`styleDrawer`) and Dokument section (`documentPanel`).
const railIds = () =>
  within(screen.getByTestId("drawer-rail"))
    .getAllByRole("button")
    .map((button) => button.getAttribute("data-testid"))
    .filter((id) => id !== null && /^drawer-[a-z]+$/.test(id));
const editorState = () => screen.getAllByTestId("editor-state")[0]!;
const lockFirstLayer = () => {
  fireEvent.click(screen.getByTestId("drawer-layers"));
  const layer = screen.getAllByTestId("slide-editor-layer")[0]!;
  fireEvent.click(within(layer).getByTestId("slide-editor-layer-lock"));
};
const style = (more: Record<string, unknown> = {}) => ({
  content: <p data-testid="host-style">Brand colours</p>,
  styleSave: { onSave: vi.fn(), onReset: vi.fn(), dirty: false, ...more },
});

// Only the Stil draft dirty: Back, then the leave question's Save.
const saveStilOnLeave = async (onSave: () => boolean | Promise<boolean>) => {
  const onBack = vi.fn();
  editor({ styleDrawer: { content: null, styleSave: { onSave, dirty: true } }, onBack });
  click("editor-back");
  fireEvent.click(await screen.findByTestId("leave-guard-save"));
  await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  return { onSave, onBack };
};

describe("SlideEditor host drawers (SUI-FEATURE-384)", () => {
  // AC1
  it("keeps the rail and the Document drawer as they are without the slots", () => {
    editor();
    expect(railIds()).toEqual(["drawer-add", "drawer-layers", "drawer-document"]);
    fireEvent.click(screen.getByTestId("drawer-document"));
    expect(screen.queryByTestId("slide-editor-document-panel")).toBeNull();
    expect(screen.queryByTestId("drawer-style-footer")).toBeNull();
  });

  // AC2
  it("puts Stil between Ebenen and Dokument with the host's content and the Stil footer", async () => {
    const slot = style();
    const { rerender } = editor({ styleDrawer: slot });
    expect(railIds()).toEqual(["drawer-add", "drawer-layers", "drawer-style", "drawer-document"]);
    fireEvent.click(screen.getByTestId("drawer-style"));
    expect(screen.getByTestId("host-style")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-style-footer")).toBeInTheDocument();
    // Clean: both locked.
    expect(screen.getByTestId("drawer-style-save")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("drawer-style-reset")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByTestId("drawer-style-save"));
    fireEvent.click(screen.getByTestId("drawer-style-reset"));
    expect(slot.styleSave.onSave).not.toHaveBeenCalled();
    expect(screen.queryByTestId("drawer-style-reset-confirm")).toBeNull();

    rerender({ styleDrawer: { ...slot, styleSave: { ...slot.styleSave, dirty: true } } });
    fireEvent.click(screen.getByTestId("drawer-style-save"));
    expect(slot.styleSave.onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("drawer-style-reset"));
    expect(slot.styleSave.onReset).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId("drawer-style-reset-confirm-confirm"));
    expect(slot.styleSave.onReset).toHaveBeenCalledTimes(1);
  });

  it("keeps the Stil drawer openable under readOnly, without a footer", () => {
    editor({ readOnly: true, styleDrawer: { content: <p data-testid="host-style">Kit</p> } });
    fireEvent.click(screen.getByTestId("drawer-style"));
    expect(screen.getByTestId("host-style")).toBeInTheDocument();
    expect(screen.queryByTestId("drawer-style-footer")).toBeNull();
  });

  // AC4
  it("keeps the document's draft and undo apart from the Stil save", () => {
    const onSave = vi.fn(() => true);
    const slot = style({ dirty: true });
    editor({ styleDrawer: slot, onSave });
    lockFirstLayer();
    expect(slot.styleSave.onSave).not.toHaveBeenCalled();
    expect(slot.styleSave.onReset).not.toHaveBeenCalled();
    expect(editorState()).toHaveTextContent("Draft");
    fireEvent.click(screen.getByTestId("drawer-style"));
    fireEvent.click(screen.getByTestId("drawer-style-save"));
    expect(slot.styleSave.onSave).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(editorState()).toHaveTextContent("Draft");
    expect(screen.getAllByTestId("editor-undo")[0]).not.toHaveAttribute("aria-disabled", "true");
  });

  it("leaves without asking when the Stil draft is clean", () => {
    const onBack = vi.fn();
    editor({ styleDrawer: style(), onBack });
    click("editor-back");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // AC5
  it("shows the Document section below the editor's own content, with or without a selection", () => {
    editor({ documentPanel: { title: "Versions", content: <p>v3 · saved</p> } });
    fireEvent.click(screen.getByTestId("drawer-document"));
    const section = screen.getByTestId("slide-editor-document-panel");
    expect(within(section).getByRole("heading", { name: "Versions" })).toBeInTheDocument();
    expect(section).toHaveTextContent("v3 · saved");
    expect(
      screen.getByTestId("slide-editor-grid").compareDocumentPosition(section) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // A selection keeps it.
    fireEvent.click(screen.getByTestId("drawer-layers"));
    const layer = screen.getAllByTestId("slide-editor-layer")[0]!;
    fireEvent.click(within(layer).getByTestId("slide-editor-layer-select"));
    fireEvent.click(screen.getByTestId("drawer-document"));
    expect(screen.getByTestId("slide-editor-document-panel")).toBeInTheDocument();
  });

  it("shows the host's read-only Document section under readOnly, on one page too", () => {
    editor({
      readOnly: true,
      maxPages: 1,
      document: { ...SLIDE_EDITOR_DOC, pages: SLIDE_EDITOR_DOC.pages.slice(0, 1) },
      documentPanel: { title: "Versions", content: <p>v3</p> },
    });
    fireEvent.click(screen.getByTestId("drawer-document"));
    expect(screen.getByTestId("slide-editor-document-panel")).toHaveTextContent("v3");
  });
});

describe("SlideEditor leave question with a Stil draft (SUI-FEATURE-384 rev 3)", () => {
  // AC3
  it("marks the closed Stil button and asks on leaving while the document is clean", async () => {
    const onBack = vi.fn();
    const onSave = vi.fn(() => true);
    const onReset = vi.fn();
    const slot = style({ dirty: true });
    editor({ styleDrawer: slot, onBack, onSave, onReset });
    expect(screen.getByTestId("drawer-style-draft")).toBeInTheDocument();
    // The header's own draft stays apart.
    expect(editorState()).toHaveTextContent("Saved");
    click("editor-back");
    expect(await screen.findByTestId("leave-guard")).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("leave-guard-discard"));
    await vi.waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    // Discard drops the Stil draft; the clean document is neither reset nor saved.
    expect(slot.styleSave.onReset).toHaveBeenCalledTimes(1);
    expect(onReset).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves the Stil draft from the leave question, the document only when it differs", async () => {
    const onBack = vi.fn();
    const onSave = vi.fn(() => true);
    const slot = style({ dirty: true });
    editor({ styleDrawer: slot, onBack, onSave });
    click("editor-back");
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await vi.waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(slot.styleSave.onSave).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    cleanup();

    const both = style({ dirty: true });
    const back = vi.fn();
    const save = vi.fn(() => true);
    editor({ styleDrawer: both, onBack: back, onSave: save });
    lockFirstLayer();
    click("editor-back");
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await vi.waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledTimes(1);
    expect(both.styleSave.onSave).toHaveBeenCalledTimes(1);
  });

  // AC6 (rev 3)
  it.each([
    ["gives false", () => false],
    ["rejects", () => Promise.reject(new Error("kit"))],
    [
      "throws",
      () => {
        throw new Error("kit");
      },
    ],
  ])("stays in the editor when the Stil save %s", async (_, outcome) => {
    const { onBack } = await saveStilOnLeave(vi.fn(outcome));
    await vi.waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(onBack).not.toHaveBeenCalled();
    // The Stil drawer opens, where the host shows its error.
    expect(screen.getByTestId("drawer")).toHaveAttribute("data-drawer-open", "style");
  });
});

describe("SlideEditor leave question while a Stil save runs or fails (SUI-FEATURE-384 rev 3)", () => {
  it("holds Back while a Stil save runs and goes on once it ended", () => {
    const onBack = vi.fn();
    const onSave = vi.fn();
    const { rerender } = editor({
      styleDrawer: { content: null, styleSave: { onSave, dirty: true, saving: true } },
      onBack,
    });
    click("editor-back");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
    rerender({ styleDrawer: { content: null, styleSave: { onSave, dirty: false } } });
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the Stil draft when the document's reset fails", async () => {
    const onBack = vi.fn();
    const slot = style({ dirty: true });
    editor({ styleDrawer: slot, onBack, onReset: () => false });
    lockFirstLayer();
    click("editor-back");
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await vi.waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(slot.styleSave.onReset).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("saves a field's typed entry with the document and the Stil draft", async () => {
    const onBack = vi.fn();
    const onSave = vi.fn(() => true);
    const slot = style({ dirty: true });
    // The host's tags count as its draft once the typed entry is taken over.
    function Host() {
      const [tags, setTags] = React.useState(["a"]);
      return (
        <SlideEditor
          document={SLIDE_EDITOR_DOC}
          title="Deck"
          brand={SLIDE_BRAND}
          onSave={onSave}
          onBack={onBack}
          styleDrawer={slot}
          hostDirty={tags.length > 1}
          pagePanel={{ title: "Tags", content: <TagInput value={tags} onChange={setTags} /> }}
        />
      );
    }
    render(<Host />);
    const field = screen.getByTestId("tag-input-input");
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "draft" } });
    click("editor-back");
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await vi.waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(slot.styleSave.onSave).toHaveBeenCalledTimes(1);
  });

  it("waits for a Stil save promise before leaving", async () => {
    let resolve: (ok: boolean) => void = () => {};
    const { onBack } = await saveStilOnLeave(
      vi.fn(() => new Promise<boolean>((done) => (resolve = done))),
    );
    expect(onBack).not.toHaveBeenCalled();
    resolve(true);
    await vi.waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });

  it("stays when the document's save fails, without starting the Stil save", async () => {
    const onBack = vi.fn();
    const slot = style({ dirty: true });
    editor({ styleDrawer: slot, onBack, onSave: () => false });
    lockFirstLayer();
    click("editor-back");
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await vi.waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    expect(slot.styleSave.onSave).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("discards both drafts, and leaves on Discard without onReset", async () => {
    const onBack = vi.fn();
    const onReset = vi.fn();
    const slot = style({ dirty: true });
    editor({ styleDrawer: slot, onBack, onReset });
    lockFirstLayer();
    click("editor-back");
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await vi.waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(slot.styleSave.onReset).toHaveBeenCalledTimes(1);
    cleanup();

    const back = vi.fn();
    editor({
      styleDrawer: { content: null, styleSave: { onSave: vi.fn(), dirty: true } },
      onBack: back,
    });
    click("editor-back");
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await vi.waitFor(() => expect(back).toHaveBeenCalledTimes(1));
  });

  it("does nothing on Cancel", async () => {
    const onBack = vi.fn();
    const slot = style({ dirty: true });
    editor({ styleDrawer: slot, onBack });
    click("editor-back");
    fireEvent.click(await screen.findByTestId("leave-guard-cancel"));
    expect(slot.styleSave.onSave).not.toHaveBeenCalled();
    expect(slot.styleSave.onReset).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });
});

// Collector rows 368 and 371 (#873): the Stil draft's reset and save after the document's own.
describe("SlideEditor Stil reset and save after the document's (SUI-FEATURE-384 rev 3)", () => {
  // Row 368: Discard with a document reset the host awaits resets the Stil draft once, only after
  // that reset resolved, then leaves.
  it("runs the Stil onReset once after an awaited document reset on Discard", async () => {
    let resolve: () => void = () => {};
    const promise = new Promise<void>((done) => (resolve = done));
    const onReset = vi.fn(() => promise);
    const slot = style({ dirty: true });
    const onBack = vi.fn();
    editor({ onReset, styleDrawer: slot, onBack });
    lockFirstLayer();
    click("editor-back");
    const discard = await screen.findByTestId("leave-guard-discard");
    fireEvent.click(discard);
    await act(async () => {});
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(slot.styleSave.onReset).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    await act(async () => {
      resolve();
      await promise;
    });
    await vi.waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(slot.styleSave.onReset).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  // Row 371: an earlier failed document save does not drop a Back held during a Stil save that
  // succeeds; the failure counts only for the save that held it.
  it("carries out Back held during a successful Stil save after a failed document save", async () => {
    const onBack = vi.fn();
    const onSave = vi.fn(() => false);
    const stil = vi.fn();
    const { rerender } = editor({
      styleDrawer: { content: null, styleSave: { onSave: stil, dirty: false } },
      onSave,
      onBack,
    });
    lockFirstLayer();
    click("editor-save");
    await act(async () => {});
    expect(onSave).toHaveBeenCalledTimes(1);
    // The document clean again; its failed save lies behind.
    click("editor-undo");
    rerender({
      styleDrawer: { content: null, styleSave: { onSave: stil, dirty: true, saving: true } },
    });
    click("editor-back");
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
    rerender({ styleDrawer: { content: null, styleSave: { onSave: stil, dirty: false } } });
    await act(async () => {});
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

const labelledOverlay = (id: string, more: Partial<SlideOverlay> = {}) =>
  ({
    id,
    label: `Overlay ${id}`,
    hint: `Shows ${id}`,
    render: () => null,
    ...more,
  }) as SlideOverlay;

// The toolbar's bands and separators in order: a band by its name, a separator as "|", the free
// space between the two sides as "~".
function bands() {
  const toolbar = screen.getByTestId("slide-editor-toolbar");
  const name = (node: Element) =>
    node.getAttribute("data-testid") === "slide-editor-toolbar-separator"
      ? "|"
      : node.getAttribute("data-testid")!.replace("slide-editor-band-", "");
  const children = [...toolbar.children];
  const right = children.at(-1)!;
  return [...children.slice(0, -1).map(name), "~", ...[...right.children].map(name)].join(" ");
}

const TRANSFER_FORMATS = [SLIDE_EDITOR_DOC.format, { name: "Square", width: 600, height: 600 }];

describe("SlideEditor toolbar bands (SUI-FEATURE-196 §2)", () => {
  it("AC3: app tools, transfer, pages, then zoom and view, separators between filled bands", () => {
    editor({
      toolbarStart: (
        <button type="button" data-testid="app-insert">
          Insert
        </button>
      ),
      formats: TRANSFER_FORMATS,
      onTransfer: noop,
      extensions: { overlays: [labelledOverlay("safe"), labelledOverlay("phone")] },
    });
    expect(bands()).toBe("start | transfer | pages ~ zoom | view");
    expect(
      within(screen.getByTestId("slide-editor-band-start")).getByTestId("app-insert"),
    ).toBeInTheDocument();
    // The view band: grid, the app's overlays in their order, preview.
    const view = screen.getByTestId("slide-editor-band-view");
    expect(
      [...view.querySelectorAll("[data-testid]")]
        .map((node) => node.getAttribute("data-testid"))
        .filter(
          (id) =>
            ["grid-toggle-button", "slide-editor-preview"].includes(id!) ||
            id!.startsWith("slide-editor-overlay-toggle-"),
        ),
    ).toEqual([
      "grid-toggle-button",
      "slide-editor-overlay-toggle-safe",
      "slide-editor-overlay-toggle-phone",
      "slide-editor-preview",
    ]);
    // A separator: the border colour, about two thirds of a control's height, never read out.
    const separator = screen.getAllByTestId("slide-editor-toolbar-separator")[0]!;
    expect(separator).toHaveClass("h-5", "w-px", "bg-border");
    expect(separator).toHaveAttribute("aria-hidden", "true");
    // A band's own gap is smaller than the one between bands.
    expect(screen.getByTestId("slide-editor-band-view")).toHaveClass("gap-1");
    expect(screen.getByTestId("slide-editor-toolbar")).toHaveClass("gap-2");
  });

  it.each([
    ["without a slot", undefined],
    ["with an empty slot", null],
    ["with a false slot", false],
  ])("AC3: leaves out an empty band and its separator %s", (_, start) => {
    editor({
      ...(start === undefined ? {} : { toolbarStart: start }),
      formats: TRANSFER_FORMATS,
      onTransfer: noop,
    });
    expect(bands()).toBe("transfer | pages ~ zoom | view");
  });

  function Nothing() {
    return null;
  }
  it.each([
    ["an empty fragment", <>{false}</>],
    ["a component that renders nothing", <Nothing />],
  ])("AC3: hides a start band that renders nothing, and its separator, with %s", (_, start) => {
    editor({ toolbarStart: start, formats: TRANSFER_FORMATS, onTransfer: noop });
    // The band stands in the DOM but holds nothing: `:empty` hides it, and the separator after it
    // hides with it (the styles themselves are checked in the gallery, not in jsdom).
    const band = screen.getByTestId("slide-editor-band-start");
    expect(band.matches(":empty")).toBe(true);
    expect(band).toHaveClass("empty:hidden");
    expect(band.nextElementSibling).toHaveAttribute(
      "data-testid",
      "slide-editor-toolbar-separator",
    );
    expect(band.nextElementSibling).toHaveClass("[div:empty+&]:hidden");
    for (const separator of screen.getAllByTestId("slide-editor-toolbar-separator")) {
      expect(separator).toHaveClass("[&:has(+div:empty)]:hidden");
    }
  });

  it("AC3: clears a separator a wrap leaves at a row's end, keeping its place", () => {
    // Row one 0–32 px, row two 40–72 px: the view band wrapped below zoom and its separator.
    const rows: Record<string, [number, number]> = {
      "slide-editor-band-view": [40, 72],
    };
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const id = this.getAttribute("data-testid") ?? "";
        const [top, bottom] =
          rows[id] ?? (id === "slide-editor-toolbar-separator" ? [6, 26] : [0, 32]);
        return DOMRect.fromRect({ x: 0, y: top, width: 0, height: bottom - top });
      });
    try {
      editor({ formats: TRANSFER_FORMATS, onTransfer: noop });
      const [between, beforeView] = screen.getAllByTestId("slide-editor-toolbar-separator");
      expect(beforeView!.nextElementSibling).toHaveAttribute(
        "data-testid",
        "slide-editor-band-view",
      );
      expect(beforeView).toHaveAttribute("data-wrapped");
      expect(beforeView).toHaveClass("data-wrapped:invisible");
      expect(between).not.toHaveAttribute("data-wrapped");
    } finally {
      spy.mockRestore();
    }
  });

  it("a band wraps its own controls; a separator beside a band spanning two rows stays (#874)", () => {
    // The view band starts on row one and wraps onto row two (0–72 px): its separator stands
    // beside it on row one, so it stays visible.
    const rows: Record<string, [number, number]> = {
      "slide-editor-band-view": [0, 72],
    };
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const id = this.getAttribute("data-testid") ?? "";
        const [top, bottom] =
          rows[id] ?? (id === "slide-editor-toolbar-separator" ? [6, 26] : [0, 32]);
        return DOMRect.fromRect({ x: 0, y: top, width: 0, height: bottom - top });
      });
    try {
      editor({ formats: TRANSFER_FORMATS, onTransfer: noop });
      expect(screen.getByTestId("slide-editor-band-view")).toHaveClass("flex-wrap");
      for (const separator of screen.getAllByTestId("slide-editor-toolbar-separator")) {
        expect(separator).not.toHaveAttribute("data-wrapped");
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("AC3: one page and no transfer leave the left side empty, no separator there", () => {
    // A one-page cap with one page has no page navigation (`SUI-FEATURE-381`).
    editor({ maxPages: 1, document: { ...SLIDE_EDITOR_DOC, pages: [SLIDE_EDITOR_DOC.pages[0]!] } });
    expect(bands()).toBe("~ zoom | view");
    cleanup();
    editor({
      maxPages: 1,
      document: { ...SLIDE_EDITOR_DOC, pages: [SLIDE_EDITOR_DOC.pages[0]!] },
      toolbarStart: <span>App</span>,
    });
    expect(bands()).toBe("start ~ zoom | view");
  });

  it("keeps the app's slot under readOnly, and reads nothing from it", () => {
    editor({ readOnly: true, toolbarStart: <span data-testid="app-view-only">View</span> });
    expect(screen.getByTestId("app-view-only")).toBeInTheDocument();
    expect(bands()).toBe("start | pages ~ zoom | view");
  });
});

describe("SlideEditor view toggles with an icon per state (SUI-FEATURE-196 §3)", () => {
  const off = (id: string) => <svg data-testid={`${id}-off`} />;
  const on = (id: string) => <svg data-testid={`${id}-on`} />;

  it("AC4: an overlay's icon changes with its state, aria-pressed and fill follow", () => {
    editor({
      extensions: {
        overlays: [
          labelledOverlay("safe", { icon: off("safe"), pressedIcon: on("safe") }),
          labelledOverlay("plain"),
        ],
      },
    });
    const toggle = screen.getByTestId("slide-editor-overlay-toggle-safe");
    for (const token of PRESSED_FILL_CLASS.split(" ")) expect(toggle).toHaveClass(token);
    expect(toggle).toHaveAccessibleName("Overlay safe");
    // Shown at first: the pressed icon.
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(within(toggle).getByTestId("safe-on")).toHaveAttribute("aria-hidden", "true");
    // A direct child, so the button's icon padding reaches it.
    expect(within(toggle).getByTestId("safe-on").parentElement).toBe(toggle);
    expect(within(toggle).queryByTestId("safe-off")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(within(toggle).getByTestId("safe-off")).toBeInTheDocument();
    expect(within(toggle).queryByTestId("safe-on")).toBeNull();
    // Without an icon: the label only, as before.
    const plain = screen.getByTestId("slide-editor-overlay-toggle-plain");
    expect(plain.children).toHaveLength(0);
    expect(plain).toHaveTextContent("Overlay plain");
  });

  it("AC4: an overlay without pressedIcon keeps its icon while shown", () => {
    editor({ extensions: { overlays: [labelledOverlay("safe", { icon: off("safe") })] } });
    const toggle = screen.getByTestId("slide-editor-overlay-toggle-safe");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(within(toggle).getByTestId("safe-off")).toBeInTheDocument();
  });

  it("AC4: the grid toggle takes gridToggleIcons, aria-pressed follows", () => {
    editor({ gridToggleIcons: { icon: off("grid"), pressedIcon: on("grid") } });
    const toggle = screen.getByTestId("grid-toggle-button");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(within(toggle).getByTestId("grid-off")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(within(toggle).getByTestId("grid-on")).toBeInTheDocument();
    expect(within(toggle).queryByTestId("grid-off")).toBeNull();
  });

  it("AC4: without gridToggleIcons the grid icon in both states", () => {
    editor();
    const toggle = screen.getByTestId("grid-toggle-button");
    const before = toggle.querySelector(":scope > svg")!.outerHTML;
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle.querySelector(":scope > svg")!.outerHTML).toBe(before);
  });
});
