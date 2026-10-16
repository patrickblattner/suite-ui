import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LOCKED_SAVE_CLASS } from "../lib/locked-save.js";
import { FOCUS_MAIN_ATTR } from "../ui/focus-return.js";
import { SettingsFooter } from "./settings-footer.js";

function page(dirty: boolean, saving: boolean, valid = true, onSubmit = vi.fn()) {
  return (
    <main>
      <form onSubmit={onSubmit}>
        <input aria-label="Name" {...{ [FOCUS_MAIN_ATTR]: "" }} />
        <SettingsFooter
          pageKey="general"
          dirty={dirty}
          valid={valid}
          saving={saving}
          onReset={vi.fn()}
        />
      </form>
    </main>
  );
}

// SUI-FEATURE-120 rev 5 AC1/AC2, GL-UI-050 rev 6: the running Save keeps the focus; when the save ends
// with the form clean, Save locks itself with `aria-disabled` and keeps the focus, triggering nothing.
describe("SaveResetButtons focus", () => {
  it("keeps the focus while saving and after Save locked itself", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const { rerender } = render(page(true, false, true, onSubmit));
    const save = screen.getByTestId("settings-general-save");
    save.focus();
    rerender(page(true, true, true, onSubmit));
    expect(save).toHaveFocus();
    expect(save).toHaveAttribute("aria-disabled", "true");
    rerender(page(false, false, true, onSubmit));
    expect(save).toHaveFocus();
    expect(save).toBeEnabled();
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveClass(LOCKED_SAVE_CLASS);
    fireEvent.click(save);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // Q&A #3709, GL-UI-017: the locked Save says what it does and when it frees; its name stays "Save".
  it("a Save locked by a clean form describes what it does and when it frees", () => {
    render(page(false, false));
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveAccessibleDescription(
      "Saves the changes on this page — available once you have changed something here.",
    );
  });

  // A lock with a reason (an invalid entry) stays `disabled` and hands the focus on.
  it("a save that ends with an invalid entry locks Save and hands the focus on", () => {
    const { rerender } = render(page(true, false));
    const save = screen.getByTestId("settings-general-save");
    save.focus();
    rerender(page(true, true, false));
    rerender(page(true, false, false));
    expect(save).toBeDisabled();
    expect(screen.getByTestId("settings-general-reset")).toHaveFocus();
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
    expect(reset).toHaveFocus();
  });
});
