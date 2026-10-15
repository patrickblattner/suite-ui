import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FOCUS_MAIN_ATTR } from "../ui/focus-return.js";
import { SettingsFooter } from "./settings-footer.js";

function page(dirty: boolean, saving: boolean) {
  return (
    <main>
      <form>
        <input aria-label="Name" {...{ [FOCUS_MAIN_ATTR]: "" }} />
        <SettingsFooter pageKey="general" dirty={dirty} saving={saving} onReset={vi.fn()} />
      </form>
    </main>
  );
}

// SUI-FEATURE-120 rev 3 AC1, GL-UI-050 §laufende Aktion: the running Save keeps the focus; when the save
// ends with the form clean, Save locks and hands the focus on, never to the body.
describe("SaveResetButtons focus", () => {
  it("keeps the focus while saving and hands it to the main content once Save locks", () => {
    const { rerender } = render(page(true, false));
    const save = screen.getByTestId("settings-general-save");
    save.focus();
    rerender(page(true, true));
    expect(save).toHaveFocus();
    expect(save).toHaveAttribute("aria-disabled", "true");
    rerender(page(false, false));
    expect(save).toBeDisabled();
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("a save that ends with Save still usable keeps the focus on it", () => {
    const { rerender } = render(page(true, false));
    const save = screen.getByTestId("settings-general-save");
    save.focus();
    rerender(page(true, true));
    rerender(page(true, false));
    expect(save).toHaveFocus();
  });

  it("focus moved away during the save stays where it went", () => {
    const { rerender } = render(page(true, false));
    const save = screen.getByTestId("settings-general-save");
    save.focus();
    rerender(page(true, true));
    const reset = screen.getByTestId("settings-general-reset");
    reset.focus();
    rerender(page(false, false));
    expect(save).not.toHaveFocus();
    expect(screen.getByLabelText("Name")).not.toHaveFocus();
  });
});
