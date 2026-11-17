import { act, screen } from "@testing-library/react";
import type * as React from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, vi } from "vitest";

// React's ids count across a test file, so a snapshot numbers them by first appearance instead.
export function stableIds(html: string): string {
  const ids = new Map<string, string>();
  return html.replace(/_r_[0-9a-z]+_/g, (id) => {
    if (!ids.has(id)) ids.set(id, `id${ids.size + 1}`);
    return ids.get(id)!;
  });
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
