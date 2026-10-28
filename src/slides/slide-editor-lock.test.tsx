import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import type { SlideDocumentInput } from "./schema.js";
import { SlideEditor } from "./slide-editor.js";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  // jsdom has no pointer capture and no scrolling into view, which Radix calls on opening a select.
  for (const name of ["hasPointerCapture", "releasePointerCapture", "scrollIntoView"]) {
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, value: () => false });
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const REASON = "The element is locked. Unlock it in the layers panel to change it.";

// A locked text field sliding in, so its panel holds every kind of control: number fields, the
// format's selects and toggles, the sizing select and both animation selects.
const DOC: SlideDocumentInput = {
  ...SLIDE_EDITOR_DOC,
  pages: [
    {
      id: "locked",
      background: { type: "color", color: { kind: "brand", key: "background" } },
      elements: [
        {
          id: "title",
          name: "Title",
          type: "text",
          x: 40,
          y: 40,
          width: 300,
          height: 60,
          locked: true,
          runs: [{ text: "Locked", size: 24 }],
          animation: {
            entrance: { effect: "slide", direction: "left", duration: 500, delay: 0, order: 0 },
          },
        },
      ],
    },
  ],
};

function editor() {
  render(
    <SlideEditor
      document={DOC}
      title="Deck"
      brand={SLIDE_BRAND}
      onSave={() => true}
      onBack={() => {}}
    />,
  );
  fireEvent.click(screen.getByTestId("drawer-layers"));
  const row = screen
    .getAllByTestId("slide-editor-layer")
    .find((node) => node.getAttribute("data-layer-id") === "title")!;
  fireEvent.click(within(row).getByTestId("slide-editor-layer-select"));
  return { lock: within(row).getByTestId("slide-editor-layer-lock") };
}

const tab = (name: "content" | "layout") => {
  fireEvent.mouseDown(screen.getByTestId(`property-tab-${name}`), { button: 0 });
  return screen.getByTestId(name === "content" ? "slide-editor-content" : "slide-editor-layout");
};
const fieldsOf = (panel: HTMLElement) => [...panel.querySelectorAll("input, textarea")];
const controlsOf = (panel: HTMLElement) => [
  ...panel.querySelectorAll<HTMLElement>("button, [role=combobox], [role=switch]"),
];
const draft = () => screen.getAllByTestId("editor-state")[0]!.textContent;

// SUI-FEATURE-195: one lock state for a locked element's property panel.
describe("SlideEditor: a locked element's property panel", () => {
  it("makes every field read-only and disables no control (AC 1)", () => {
    editor();
    for (const name of ["content", "layout"] as const) {
      const panel = tab(name);
      const fields = fieldsOf(panel);
      expect(fields.length, name).toBeGreaterThan(0);
      for (const field of fields) expect(field, field.id).toHaveAttribute("readonly");
      expect(panel.querySelector("[disabled]"), name).toBeNull();
      for (const node of panel.querySelectorAll("*")) {
        expect(node.className.toString(), node.outerHTML).not.toMatch(/(^|\s)opacity-50(\s|$)/);
      }
    }
  });

  it("locks every other control with aria-disabled and the reason, focusable, changing nothing (AC 2–3)", () => {
    editor();
    const before = draft();
    const seen: string[] = [];
    for (const name of ["content", "layout"] as const) {
      const controls = controlsOf(tab(name));
      expect(controls.length, name).toBeGreaterThan(0);
      for (const control of controls) {
        const id = control.dataset.testid ?? control.id;
        seen.push(id);
        expect(control, id).toHaveAttribute("aria-disabled", "true");
        expect(control, id).toHaveAccessibleDescription(REASON);
        control.focus();
        expect(control, id).toHaveFocus();
        fireEvent.pointerDown(control, { button: 0, ctrlKey: false, pointerType: "mouse" });
        expect(fireEvent.mouseDown(control, { button: 0 }), id).toBe(false);
        fireEvent.click(control);
        for (const key of [" ", "Enter", "ArrowDown", "ArrowUp"]) {
          fireEvent.keyDown(control, { key });
        }
        expect(control, id).toHaveFocus();
        expect(screen.queryByRole("listbox"), id).toBeNull();
        if (control.getAttribute("role") === "combobox") {
          expect(control, id).toHaveAttribute("aria-expanded", "false");
        }
      }
    }
    // The format's font and colour, its toggles, the sizing and both animation selects.
    expect(seen).toEqual(
      expect.arrayContaining([
        "slide-editor-text-font",
        "slide-editor-text-color",
        "slide-editor-text-bold",
        "slide-editor-text-numbered",
        "slide-editor-text-sizing",
        "slide-editor-entrance-effect",
        "slide-editor-entrance-direction",
        "slide-editor-exit-effect",
      ]),
    );
    expect(draft()).toBe(before);
  });

  it("locks a locked table's buttons and selects with the same reason (AC 2)", () => {
    const facts = SLIDE_EDITOR_DOC.pages[1]!.elements!.find((element) => element.id === "facts")!;
    render(
      <SlideEditor
        document={{ ...DOC, pages: [{ ...DOC.pages[0]!, elements: [{ ...facts, locked: true }] }] }}
        title="Deck"
        brand={SLIDE_BRAND}
        onSave={() => true}
        onBack={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("drawer-layers"));
    fireEvent.click(screen.getByTestId("slide-editor-layer-select"));
    const controls = controlsOf(tab("content"));
    expect(controls.map((control) => control.dataset.testid)).toEqual(
      expect.arrayContaining([
        "slide-editor-table-row-above",
        "slide-editor-table-delete-column",
        "slide-editor-table-fill",
        "slide-editor-table-valign",
      ]),
    );
    for (const control of controls) {
      expect(control, control.dataset.testid).toHaveAttribute("aria-disabled", "true");
      expect(control, control.dataset.testid).toHaveAccessibleDescription(REASON);
    }
    expect(screen.getByTestId("slide-editor-content").querySelector("[disabled]")).toBeNull();
  });

  it("makes every control operable again once unlocked, without reselecting (AC 4)", () => {
    const { lock } = editor();
    fireEvent.click(lock);
    for (const name of ["content", "layout"] as const) {
      const panel = tab(name);
      for (const field of fieldsOf(panel)) expect(field, field.id).not.toHaveAttribute("readonly");
      for (const control of controlsOf(panel)) {
        expect(control, control.dataset.testid).not.toHaveAttribute("aria-disabled");
        expect(control, control.dataset.testid).not.toHaveAccessibleDescription(REASON);
      }
    }
    const effect = screen.getByTestId("slide-editor-entrance-effect");
    fireEvent.keyDown(effect, { key: "Enter" });
    expect(effect).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});
