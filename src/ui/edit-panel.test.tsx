import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider, useSidebar } from "../shell/sidebar-provider.js";
import { EditPanel, type EditPanelProps } from "./edit-panel.js";
import { Input } from "./input.js";

afterEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("en");
});

function renderPanel(props: Partial<EditPanelProps> = {}) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn();
  render(
    <EditPanel
      open
      onOpenChange={onOpenChange}
      title="Channel"
      onSubmit={onSubmit}
      submitLabel="Save"
      {...props}
    >
      <Input aria-label="Name" defaultValue="Main" />
    </EditPanel>,
  );
  return { onOpenChange, onSubmit };
}

// A trigger that opens the panel, as a list row does.
function WithTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
        Edit
      </button>
      <EditPanel open={open} onOpenChange={setOpen} title="Channel">
        <Input aria-label="Name" />
      </EditPanel>
    </>
  );
}

function Toggle() {
  const { toggle } = useSidebar();
  return (
    <button type="button" data-testid="toggle" onClick={toggle}>
      toggle
    </button>
  );
}

describe("EditPanel", () => {
  it.each([
    ["en", "Cancel", "Close"],
    ["de", "Abbrechen", "Schließen"],
    ["es", "Cancelar", "Cerrar"],
  ])("%s: Cancel and Close come from the suite namespace", async (lng, cancel, close) => {
    await i18n.changeLanguage(lng);
    const { unmount } = render(
      <EditPanel open onOpenChange={() => {}} title="Channel" onSubmit={() => {}}>
        x
      </EditPanel>,
    );
    expect(screen.getByTestId("edit-panel-cancel")).toHaveTextContent(cancel);
    unmount();
    render(
      <EditPanel open onOpenChange={() => {}} title="Channel">
        x
      </EditPanel>,
    );
    expect(screen.getByTestId("edit-panel-cancel")).toHaveTextContent(close);
    expect(screen.queryByTestId("edit-panel-submit")).toBeNull();
  });

  it("footer: Cancel directly before the primary action, right-aligned in one row", () => {
    renderPanel({ description: "Name and handle" });
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Name and handle");
    const footer = screen.getByTestId("edit-panel").querySelector("[data-slot=edit-panel-footer]");
    expect(footer).toHaveClass("flex-row", "justify-end", "border-t");
    const buttons = [...(footer?.querySelectorAll("button") ?? [])];
    expect(buttons.map((b) => b.dataset.testid)).toEqual([
      "edit-panel-cancel",
      "edit-panel-submit",
    ]);
    expect(screen.getByTestId("edit-panel-body")).toHaveClass("overflow-y-auto");
  });

  it("submit and Enter in a field call onSubmit, Cancel requests the close", () => {
    const { onOpenChange, onSubmit } = renderPanel();
    fireEvent.click(screen.getByTestId("edit-panel-submit"));
    fireEvent.submit(screen.getByLabelText("Name"));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId("edit-panel-cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submitDisabled locks the primary action and the form submit", () => {
    const { onSubmit } = renderPanel({ submitDisabled: true });
    expect(screen.getByTestId("edit-panel-submit")).toBeDisabled();
    fireEvent.submit(screen.getByLabelText("Name"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // AC3
  it("busy: the primary action works and is locked, the panel does not close", () => {
    const { onOpenChange, onSubmit } = renderPanel({ busy: true });
    const submit = screen.getByTestId("edit-panel-submit");
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("data-busy", "true");
    expect(screen.getByTestId("edit-panel-cancel")).toBeDisabled();
    fireEvent.submit(screen.getByLabelText("Name"));
    fireEvent.keyDown(screen.getByTestId("edit-panel"), { key: "Escape" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("Escape closes when idle; a click outside does not", () => {
    const { onOpenChange } = renderPanel();
    fireEvent.pointerDown(document.body);
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByTestId("edit-panel"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // AC4
  it("className and style of the call site do not change edges or width", () => {
    renderPanel({ className: "w-1/2 left-10", style: { width: "50%", left: 40, inset: 10 } });
    const panel = screen.getByTestId("edit-panel");
    expect(panel).toHaveClass("w-1/2");
    expect(panel.style.width).toBe("auto");
    expect(panel.style.left).toBe("0px");
    expect(panel.style.right).toBe("0px");
    expect(panel.style.top).toBe("0px");
    expect(panel.style.bottom).toBe("0px");
  });

  it("the left edge follows the sidebar width, open and collapsed", () => {
    render(
      <SidebarProvider storageKey="test.sidebar">
        <Toggle />
        <EditPanel open onOpenChange={() => {}} title="Channel">
          x
        </EditPanel>
      </SidebarProvider>,
    );
    expect(screen.getByTestId("edit-panel").style.left).toBe("var(--sidebar-width)");
    fireEvent.click(screen.getByTestId("toggle"));
    expect(screen.getByTestId("edit-panel").style.left).toBe("var(--sidebar-width-collapsed)");
  });

  it("testIdPrefix replaces the testid stem", () => {
    renderPanel({ testIdPrefix: "channel-panel" });
    for (const id of [
      "channel-panel",
      "channel-panel-body",
      "channel-panel-cancel",
      "channel-panel-submit",
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it("opening focus: the first field only in add mode", () => {
    renderPanel({ mode: "add" });
    expect(screen.getByLabelText("Name")).toHaveFocus();
    cleanup();
    renderPanel({ mode: "edit" });
    expect(screen.getByTestId("edit-panel")).toHaveFocus();
  });

  // AC5
  it("close returns the focus to the trigger", async () => {
    render(<WithTrigger />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByTestId("edit-panel")).toHaveFocus();
    fireEvent.click(screen.getByTestId("edit-panel-cancel"));
    expect(screen.queryByTestId("edit-panel")).toBeNull();
    // radix hands the focus back on a tick after the unmount.
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
