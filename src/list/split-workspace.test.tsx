import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readSplitStop,
  SPLIT_STOPS,
  type SplitStop,
  SplitWorkspace,
  type SplitWorkspaceProps,
} from "./split-workspace.js";

const KEY = "split:pages";

// jsdom has no layout: the workspace reports this width, starting at x = 0. It has no
// ResizeObserver either; the divider's open tooltip measures its arrow with one.
let workspaceWidth = 1600;
beforeEach(() => {
  workspaceWidth = 1600;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  window.localStorage.clear();
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => workspaceWidth);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ left: 0, top: 0, width: workspaceWidth, height: 600 }) as DOMRect,
  );
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("en");
});

const ROWS = ["Home", "About", "Contact"];

// The app's surface: rows select an entry, the preview shows it, close clears the selection.
function Surface(props: Partial<SplitWorkspaceProps>) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <SplitWorkspace
      list={
        <ul>
          {ROWS.map((row) => (
            <li key={row}>
              <button type="button" onClick={() => setSelected(row)}>
                {row}
              </button>
            </li>
          ))}
        </ul>
      }
      preview={<p data-testid="preview-content">{selected}</p>}
      open={selected !== null}
      onClose={() => setSelected(null)}
      defaultStop="2/5"
      minWidths={{ list: 320, preview: 320 }}
      storageKey={KEY}
      {...props}
    />
  );
}

const workspace = () => screen.getByTestId("split-workspace");
const divider = () => screen.getByTestId("split-workspace-divider");
const listColumn = () => screen.getByTestId("split-workspace-list");

describe("SplitWorkspace (GL-UI-009)", () => {
  it("offers exactly the package snap stops", () => {
    expect(SPLIT_STOPS).toEqual(["1/4", "1/3", "2/5", "1/2", "3/5", "2/3", "3/4"]);
  });

  it("without a selection has no right column, the list takes the full width", () => {
    render(<Surface />);
    expect(screen.queryByTestId("split-workspace-preview")).toBeNull();
    expect(screen.queryByTestId("split-workspace-divider")).toBeNull();
    expect(listColumn()).toHaveClass("flex-1");
    expect(listColumn().style.width).toBe("");
  });

  it("a row click opens the preview at the default stop, another row only swaps the content", () => {
    render(<Surface />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(workspace()).toHaveAttribute("data-stop", "2/5");
    expect(listColumn()).toHaveStyle({ width: "40%" });
    expect(screen.getByTestId("preview-content")).toHaveTextContent("Home");
    fireEvent.click(screen.getByRole("button", { name: "About" }));
    expect(screen.getByTestId("preview-content")).toHaveTextContent("About");
    fireEvent.click(screen.getByRole("button", { name: "About" }));
    expect(screen.getByTestId("split-workspace-preview")).toBeInTheDocument();
  });

  it("Esc closes back to the full list, unless an inner layer took it first", () => {
    render(<Surface />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    const inner = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener("keydown", inner);
    fireEvent.keyDown(document.body, { key: "Escape" });
    document.removeEventListener("keydown", inner);
    expect(screen.getByTestId("split-workspace-preview")).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByTestId("split-workspace-preview")).toBeNull();
    expect(workspace()).toHaveAttribute("data-open", "false");
  });

  it("the divider is a labelled, focusable separator; ←/→ step to the previous/next stop", () => {
    render(<Surface />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(divider()).toHaveAttribute("role", "separator");
    expect(divider()).toHaveAttribute("tabindex", "0");
    expect(divider()).toHaveAccessibleName("Resize list and preview");
    expect(divider()).toHaveAttribute("aria-valuetext", "2/5");
    fireEvent.keyDown(divider(), { key: "ArrowRight" });
    expect(divider()).toHaveAttribute("aria-valuetext", "1/2");
    fireEvent.keyDown(divider(), { key: "ArrowLeft" });
    fireEvent.keyDown(divider(), { key: "ArrowLeft" });
    expect(divider()).toHaveAttribute("aria-valuetext", "1/3");
  });

  it("dragging snaps to the nearest stop, never a free width", () => {
    render(<Surface />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.pointerDown(divider(), { button: 0, pointerId: 1, clientX: 640 });
    // 0.62 of 1600 px lies nearest to 3/5.
    fireEvent.pointerMove(divider(), { pointerId: 1, clientX: 992 });
    expect(workspace()).toHaveAttribute("data-stop", "3/5");
    expect(listColumn()).toHaveStyle({ width: "60%" });
    fireEvent.pointerUp(divider(), { pointerId: 1 });
    fireEvent.pointerMove(divider(), { pointerId: 1, clientX: 100 });
    expect(workspace()).toHaveAttribute("data-stop", "3/5");
  });

  it("remembers only the stop per surface; a reload starts without a preview", () => {
    const { unmount } = render(<Surface />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.keyDown(divider(), { key: "ArrowRight" });
    expect(window.localStorage.getItem(KEY)).toBe("1/2");
    expect(Object.keys(window.localStorage)).toEqual([KEY]);
    unmount();
    render(<Surface />);
    expect(screen.queryByTestId("split-workspace-preview")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(workspace()).toHaveAttribute("data-stop", "1/2");
  });

  it.each([
    ["a double click", () => fireEvent.doubleClick(divider())],
    ["Enter", () => fireEvent.keyDown(divider(), { key: "Enter" })],
  ])("%s on the divider restores the surface default", (_, reset) => {
    window.localStorage.setItem(KEY, "3/4");
    render(<Surface />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(workspace()).toHaveAttribute("data-stop", "3/4");
    reset();
    expect(workspace()).toHaveAttribute("data-stop", "2/5");
    expect(window.localStorage.getItem(KEY)).toBe("2/5");
  });

  it("the divider's tooltip names drag, arrows and the reset", async () => {
    render(<Surface />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.focus(divider());
    expect(await screen.findByTestId("split-workspace-divider-hint")).toHaveTextContent(
      "Drag or press ←/→ to change the split; double-click or Enter restores the default.",
    );
  });

  it.each<[number, SplitStop, { list: number; preview: number }, SplitStop]>([
    // 1000 px: a 720 px table needs 3/4 (750 px); the 250 px preview fits beside it.
    [1000, "2/5", { list: 720, preview: 250 }, "3/4"],
    // 1200 px: 3/4 leaves the preview 300 px; 2/3 gives 800 | 400 and holds both.
    [1200, "3/4", { list: 720, preview: 320 }, "2/3"],
  ])(
    "at %i px the stop %s gives way to the nearest stop holding both min widths",
    (width, chosen, minWidths, expected) => {
      workspaceWidth = width;
      window.localStorage.setItem(KEY, chosen);
      render(<Surface minWidths={minWidths} />);
      fireEvent.click(screen.getByRole("button", { name: "Home" }));
      expect(workspace()).toHaveAttribute("data-stop", expected);
      // The fallback never overwrites the choice.
      expect(window.localStorage.getItem(KEY)).toBe(chosen);
    },
  );

  it("too narrow for both: one column with a List / Preview toggle", () => {
    workspaceWidth = 900;
    render(<Surface minWidths={{ list: 720, preview: 320 }} />);
    expect(screen.queryByTestId("split-workspace-toggle")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(workspace()).toHaveAttribute("data-stop", "single");
    expect(screen.queryByTestId("split-workspace-divider")).toBeNull();
    const toggle = screen.getByRole("radiogroup", { name: "View" });
    expect(toggle).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Preview" })).toHaveAttribute("aria-checked", "true");
    expect(listColumn()).not.toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    expect(listColumn()).toBeVisible();
    expect(screen.getByTestId("split-workspace-preview")).not.toBeVisible();
    fireEvent.keyDown(screen.getByRole("radio", { name: "List" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Preview" })).toHaveFocus();
    expect(screen.getByTestId("split-workspace-preview")).toBeVisible();
  });

  it("follows the window: a narrower one falls back, a wider one returns to the choice", () => {
    const observers: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    window.localStorage.setItem(KEY, "1/4");
    render(<Surface minWidths={{ list: 320, preview: 320 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(workspace()).toHaveAttribute("data-stop", "1/4");
    workspaceWidth = 1000;
    act(() => observers.forEach((callback) => callback([], {} as ResizeObserver)));
    expect(workspace()).toHaveAttribute("data-stop", "1/3");
    workspaceWidth = 1600;
    act(() => observers.forEach((callback) => callback([], {} as ResizeObserver)));
    expect(workspace()).toHaveAttribute("data-stop", "1/4");
  });

  it("falls back to the surface default for a stop that is not a package stop", () => {
    window.localStorage.setItem(KEY, "37%");
    expect(readSplitStop(KEY, "2/3")).toBe("2/3");
  });

  it.each([
    ["de", "Breite von Liste und Vorschau ändern"],
    ["es", "Cambiar el ancho de la lista y la vista previa"],
  ])("speaks %s", async (lng, label) => {
    await i18n.changeLanguage(lng);
    render(<Surface />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(divider()).toHaveAccessibleName(label);
  });
});
