import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";

// React's ids count across a test file, so a snapshot numbers them by first appearance instead.
export function stableIds(html: string): string {
  const ids = new Map<string, string>();
  return html.replace(/_r_[0-9a-z]+_/g, (id) => {
    if (!ids.has(id)) ids.set(id, `id${ids.size + 1}`);
    return ids.get(id)!;
  });
}

// A sidebar entry beside an open panel (`#suite-app-sidebar` in the body), focused; `remove` takes the
// sidebar out again.
export function focusSidebarEntry(): { entry: HTMLButtonElement; remove: () => void } {
  const sidebar = document.createElement("nav");
  sidebar.id = "suite-app-sidebar";
  const entry = document.createElement("button");
  sidebar.append(entry);
  document.body.append(sidebar);
  entry.focus();
  return { entry, remove: () => sidebar.remove() };
}

// WAI-ARIA tabs (`GL-UX-001`): every trigger's `aria-controls` names a `tabpanel` in the DOM; only the
// active one (`panelTestId`) shows, holding `activeText`; the others are empty and hidden.
export function expectEveryTabControlsAPanel(
  active: string,
  panelTestId: string,
  activeText: string,
) {
  for (const tab of screen.getAllByRole("tab")) {
    const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute("role", "tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    if (tab.textContent === active) {
      expect(panel).toBe(screen.getByTestId(panelTestId));
      expect(panel).toBeVisible();
      expect(panel).toHaveTextContent(activeText);
    } else {
      expect(panel).not.toBeVisible();
      expect(panel).toHaveAttribute("hidden");
      expect(panel).toBeEmptyDOMElement();
    }
  }
  expect(screen.getAllByRole("tabpanel")).toEqual([screen.getByTestId(panelTestId)]);
}

// Server-side render of `app` without a document, then a hydration (#926, #930): text is typed into
// the server's first input before hydrating, and the recoverable errors and console errors of the
// hydration are returned. The caller unmounts `root`.
export async function hydrateFromServer(app: React.ReactElement) {
  vi.stubGlobal("document", undefined);
  let html: string;
  try {
    html = renderToString(app);
  } finally {
    vi.unstubAllGlobals();
  }
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const input = container.querySelector("input");
  if (input === null) throw new Error("no server-rendered input");
  input.value = "typed before hydration";

  const errors: unknown[] = [];
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  let root: Root | undefined;
  await act(async () => {
    root = hydrateRoot(container, app, {
      onRecoverableError: (error) => errors.push(error),
    });
    await Promise.resolve();
  });
  const logged = [...consoleError.mock.calls];
  consoleError.mockRestore();
  return { root: root as Root, container, input, errors, logged };
}

// The hydration of `hydrateFromServer` reported no mismatch and kept the server's input, so the text
// typed before hydration survives.
export function expectHydratedIntact({
  container,
  input,
  errors,
  logged,
}: Awaited<ReturnType<typeof hydrateFromServer>>) {
  expect(errors).toEqual([]);
  expect(logged).toEqual([]);
  expect(container.querySelector("input")).toBe(input);
  expect(input.value).toBe("typed before hydration");
}

// Collector row 659: opens the panel `panel(open, setOpen)` renders from a modal menu entry by keyboard.
// The closing menu's focus trap pulls the focus back while the panel opens; its return to the trigger is
// held here as the `inert` content region holds it in a browser.
export async function openFromMenu(
  panel: (open: boolean, setOpen: (open: boolean) => void) => React.ReactNode,
): Promise<void> {
  function FromMenu() {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger data-testid="menu">Menu</DropdownMenuTrigger>
          <DropdownMenuContent onCloseAutoFocus={(event) => event.preventDefault()}>
            <DropdownMenuItem data-testid="item" onSelect={() => setOpen(true)}>
              Open
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {panel(open, setOpen)}
      </>
    );
  }
  render(<FromMenu />);
  fireEvent.keyDown(screen.getByTestId("menu"), { key: "Enter" });
  const item = await screen.findByTestId("item");
  item.focus();
  fireEvent.keyDown(item, { key: "Enter" });
}
