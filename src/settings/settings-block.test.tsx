import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { SecretCardHeader, SettingsActionButton } from "./secret-card-header.js";
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
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription(reason);
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

  // SUI-FEATURE-120 rev 5 AC2: a clean entry locks Save with `aria-disabled`, focusable, and its click
  // calls nothing (the `onSave` path, a plain button).
  it("a clean entry's Save is aria-disabled and its click calls nothing", () => {
    const onSave = vi.fn();
    render(
      <SettingsActionRow dirty={false} onSave={onSave} onReset={() => {}} testIdPrefix="mail" />,
    );
    const save = screen.getByTestId("mail-save");
    expect(save).toBeEnabled();
    expect(save).toHaveAttribute("aria-disabled", "true");
    save.focus();
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
    expect(save).toHaveFocus();
  });

  // SUI-FEATURE-088 AC1: Cancel in place of Reset, usable while cancelable, also without a change.
  it("with onCancel and cancelable but no change: Cancel usable, Save locked", () => {
    const onCancel = vi.fn();
    render(
      <SettingsActionRow
        dirty={false}
        onSave={() => {}}
        onCancel={onCancel}
        cancelable
        testIdPrefix="secret"
      />,
    );
    expect(screen.queryByTestId("secret-reset")).toBeNull();
    const cancel = screen.getByTestId("secret-cancel");
    expect(cancel).toHaveTextContent("Cancel");
    expect(cancel).toBeEnabled();
    expect(cancel).toHaveAttribute("data-variant", "outline");
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("secret-save")).toHaveAttribute("aria-disabled", "true");
  });

  // #201 (GL-UI-050): Reset resets and locks itself; the focus stays on it.
  it("the focus stays on Reset after a reset, and a locked Reset calls nothing", () => {
    const onReset = vi.fn();
    function Row() {
      const [dirty, setDirty] = useState(true);
      return (
        <SettingsActionRow
          dirty={dirty}
          onSave={() => {}}
          onReset={() => {
            onReset();
            setDirty(false);
          }}
          testIdPrefix="mail"
        />
      );
    }
    render(<Row />);
    const reset = screen.getByTestId("mail-reset");
    reset.focus();
    fireEvent.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(reset);
    expect(reset).toHaveAttribute("aria-disabled", "true");
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  // SUI-FEATURE-088 rev 5: Cancel shows no icon; Reset keeps its icon.
  it("the Cancel variant renders no icon, Reset keeps its icon", () => {
    const { unmount } = render(
      <SettingsActionRow
        dirty={false}
        onSave={() => {}}
        onCancel={() => {}}
        cancelable
        testIdPrefix="secret"
      />,
    );
    expect(screen.getByTestId("secret-cancel").querySelector("svg")).toBeNull();
    unmount();
    render(<SettingsActionRow dirty onSave={() => {}} onReset={() => {}} testIdPrefix="mail" />);
    expect(screen.getByTestId("mail-reset").querySelector("svg.lucide-rotate-ccw")).not.toBeNull();
  });

  it("not cancelable: Cancel locked with aria-disabled, its click calls nothing", () => {
    const onCancel = vi.fn();
    render(
      <SettingsActionRow
        dirty={false}
        onSave={() => {}}
        onCancel={onCancel}
        cancelable={false}
        testIdPrefix="secret"
      />,
    );
    const cancel = screen.getByTestId("secret-cancel");
    expect(cancel).toBeEnabled();
    expect(cancel).toHaveAttribute("aria-disabled", "true");
    // #372: the outline Button's own locked look.
    expect(cancel).toHaveClass(
      "aria-disabled:text-[color-mix(in_srgb,var(--foreground)_50%,var(--background))]",
    );
    fireEvent.click(cancel);
    expect(onCancel).not.toHaveBeenCalled();
  });

  // GL-UI-050: Cancel closes what is open and locks itself; the focus stays on it.
  it("the focus stays on Cancel after a cancel", () => {
    function Row() {
      const [open, setOpen] = useState(true);
      return (
        <SettingsActionRow
          dirty={false}
          onSave={() => {}}
          onCancel={() => setOpen(false)}
          cancelable={open}
          testIdPrefix="secret"
        />
      );
    }
    render(<Row />);
    const cancel = screen.getByTestId("secret-cancel");
    cancel.focus();
    fireEvent.click(cancel);
    expect(cancel).toHaveAttribute("aria-disabled", "true");
    expect(cancel).toHaveFocus();
  });

  it.each([null, false])("leading %s renders no leading group", (leading) => {
    const { container } = render(
      <SettingsActionRow
        dirty={false}
        onSave={() => {}}
        onReset={() => {}}
        leading={leading}
        testIdPrefix="mail"
      />,
    );
    expect(container.querySelector("[data-slot=settings-action-row-leading]")).toBeNull();
    expect(container.firstElementChild).toHaveClass("flex", "justify-end");
  });

  // SUI-FEATURE-088 AC2: Cancel replaces Reset, never both.
  it("onCancel and onReset together are a type error", () => {
    const base = { dirty: false, onSave: () => {}, testIdPrefix: "x" };
    const rows = [
      // @ts-expect-error onCancel and onReset together
      <SettingsActionRow key="both" {...base} onReset={() => {}} onCancel={() => {}} cancelable />,
      // @ts-expect-error onCancel needs cancelable
      <SettingsActionRow key="no-cancelable" {...base} onCancel={() => {}} />,
      // @ts-expect-error one of onReset or onCancel
      <SettingsActionRow key="neither" {...base} />,
    ];
    expect(rows).toHaveLength(3);
  });

  // SUI-FEATURE-088: the buttons that act at once stand left, the pair right, in one row.
  it("leading: the immediate buttons left, the pair right", () => {
    const onReplace = vi.fn();
    const { container } = render(
      <SettingsActionRow
        dirty={false}
        onSave={() => {}}
        onCancel={() => {}}
        cancelable
        testIdPrefix="app"
        leading={
          <>
            <SettingsActionButton
              label="Replace"
              disabledText={undefined}
              onClick={onReplace}
              testId="app-replace"
            />
            <SettingsActionButton
              label="Remove"
              disabledText="Removing…"
              onClick={() => {}}
              testId="app-remove"
            />
          </>
        }
      />,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row).toHaveClass("flex", "justify-between");
    const [leading, pair] = [...row.children] as HTMLElement[];
    // SUI-FEATURE-088 rev 4: the pair's height, one row one height.
    expect(within(leading!).getByTestId("app-replace")).toHaveAttribute("data-size", "default");
    expect(within(leading!).getByTestId("app-remove")).toHaveAttribute("aria-disabled", "true");
    expect([...pair!.querySelectorAll("button")].map((button) => button.dataset.testid)).toEqual([
      "app-cancel",
      "app-save",
    ]);
    fireEvent.click(screen.getByTestId("app-replace"));
    expect(onReplace).toHaveBeenCalledTimes(1);
  });
});
