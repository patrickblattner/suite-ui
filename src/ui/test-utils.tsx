import { screen } from "@testing-library/react";
import { expect } from "vitest";

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
