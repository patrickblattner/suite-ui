import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SecretCardHeader } from "./secret-card-header.js";
import { SettingsActionRow } from "./settings-action-row.js";
import { SettingsBlock } from "./settings-block.js";
import { SettingsFooter } from "./settings-footer.js";

describe("SettingsBlock", () => {
  it("is a section named by the entry, with the purpose under the name and no legend", () => {
    const { container } = render(
      <SettingsBlock name="Mail" purpose="Sends the notifications." aside={<span>state</span>}>
        <p>content</p>
      </SettingsBlock>,
    );
    const block = screen.getByRole("region", { name: "Mail" });
    expect(block.tagName).toBe("SECTION");
    expect(block).toHaveClass("rounded-lg", "border", "p-4", "gap-4");
    expect(within(block).getByText("Sends the notifications.")).toHaveClass(
      "text-sm",
      "text-muted-foreground",
    );
    expect(container.querySelector("fieldset, legend")).toBeNull();
    const header = container.querySelector("[data-slot=settings-block-header]");
    expect(header).toHaveClass("items-start");
    expect(header).toContainElement(screen.getByText("state"));
  });
});

describe("SecretCardHeader", () => {
  const all = {
    testIdPrefix: "mail",
    active: { checked: true, onCheckedChange: () => {} },
    testChip: <span data-testid="mail-test-chip">tested</span>,
    stateChip: <span data-testid="mail-state-chip">set</span>,
    replace: { onReplace: () => {} },
    remove: { onRemove: () => {} },
    test: { onTest: () => {} },
  };

  it("orders the group Active, test chip, state chip, Replace, Remove, with the test in a row below", () => {
    const { container } = render(<SecretCardHeader {...all} />);
    const group = container.querySelector("[data-slot=secret-card-header-group]");
    const ids = [...(group?.querySelectorAll("[data-testid]") ?? [])].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(ids).toEqual([
      "mail-active",
      "mail-test-chip",
      "mail-state-chip",
      "mail-replace",
      "mail-remove",
    ]);
    expect(screen.getByRole("switch", { name: "Active" })).toBeChecked();
    const test = screen.getByRole("button", { name: "Test connection" });
    expect(group).not.toContainElement(test);
    expect(group?.parentElement).toHaveClass("flex-col");
  });

  it("leaves no gap for a missing member", () => {
    const { container } = render(
      <SecretCardHeader testIdPrefix="mail" remove={{ onRemove: () => {} }} />,
    );
    const group = container.querySelector("[data-slot=secret-card-header-group]");
    expect(group?.children).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Test connection" })).toBeNull();
  });

  it("makes Replace, Remove and Test outline and small, and calls their handlers", () => {
    const onReplace = vi.fn();
    const onRemove = vi.fn();
    const onTest = vi.fn();
    render(
      <SecretCardHeader
        testIdPrefix="mail"
        replace={{ onReplace }}
        remove={{ onRemove }}
        test={{ onTest }}
      />,
    );
    for (const name of ["Replace", "Remove", "Test connection"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("data-variant", "outline");
      expect(button).toHaveAttribute("data-size", "sm");
      fireEvent.click(button);
    }
    expect([onReplace, onRemove, onTest].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it("toggles Active at once through onCheckedChange", () => {
    const onCheckedChange = vi.fn();
    render(<SecretCardHeader testIdPrefix="mail" active={{ checked: false, onCheckedChange }} />);
    fireEvent.click(screen.getByRole("switch", { name: "Active" }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it.each(["Replace", "Remove", "Test connection"])(
    "locks %s with disabledText and names the reason as its description",
    (name) => {
      const reason = "Possible once the key is set";
      render(
        <SecretCardHeader
          testIdPrefix="mail"
          replace={{ onReplace: () => {}, disabledText: reason }}
          remove={{ onRemove: () => {}, disabledText: reason }}
          test={{ onTest: () => {}, disabledText: reason }}
        />,
      );
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      const id = button.parentElement?.getAttribute("aria-describedby") ?? "";
      expect(document.getElementById(id)).toHaveTextContent(reason);
    },
  );

  it("shows the working state on Test while it runs", () => {
    render(<SecretCardHeader testIdPrefix="mail" test={{ onTest: () => {}, busy: true }} />);
    expect(screen.getByRole("button", { name: "Test connection" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});

describe("SettingsActionRow", () => {
  // Variant, size, icon, text and lock of both buttons, independent of the testid stem.
  function look(container: HTMLElement) {
    return [...container.querySelectorAll("button")].map((button) => ({
      variant: button.getAttribute("data-variant"),
      size: button.getAttribute("data-size"),
      icon: button.querySelector("svg")?.getAttribute("class"),
      text: button.textContent,
      disabled: button.disabled,
      busy: button.getAttribute("aria-busy"),
      testId: button.getAttribute("data-testid")?.replace(/^.*-/, ""),
    }));
  }

  it.each([
    { dirty: false, valid: true, saving: false },
    { dirty: true, valid: true, saving: false },
    { dirty: true, valid: false, saving: false },
    { dirty: true, valid: true, saving: true },
  ])("matches SettingsFooter for %o", (state) => {
    const row = render(
      <SettingsActionRow {...state} onSave={() => {}} onReset={() => {}} testIdPrefix="mail" />,
    );
    const footer = render(
      <form>
        <SettingsFooter pageKey="general" {...state} onReset={() => {}} />
      </form>,
    );
    const expected = look(footer.container);
    expect(expected).toHaveLength(2);
    expect(look(row.container)).toEqual(expected);
  });

  it("right-aligns Reset and Save with the prefixed testids, and calls onSave and onReset", () => {
    const onSave = vi.fn();
    const onReset = vi.fn();
    const { container } = render(
      <SettingsActionRow dirty onSave={onSave} onReset={onReset} testIdPrefix="mail" />,
    );
    expect(container.firstElementChild).toHaveClass("flex", "justify-end");
    fireEvent.click(screen.getByTestId("mail-reset"));
    fireEvent.click(screen.getByTestId("mail-save"));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("mail-save")).toHaveAttribute("type", "button");
  });
});
