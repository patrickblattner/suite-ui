import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { CopyIcon, DownloadIcon, SendIcon } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { Table, TableBody, TableHeader, TableRow } from "../ui/table.js";
import { EmptyCell } from "./empty-cell.js";
import {
  foldRowAction,
  type RowAction,
  RowActions,
  RowActionsHead,
  type RowActionsProps,
} from "./row-actions.js";
import { hintOf } from "./test-utils.js";

function renderRow(props: Partial<RowActionsProps> = {}, onRowClick = vi.fn()) {
  render(
    <Table>
      <TableHeader>
        <TableRow>
          <RowActionsHead data-testid="actions-head" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow onClick={onRowClick} data-testid="row">
          <RowActions
            rowName="Ada"
            extra={[
              { label: "Copy", icon: CopyIcon, onClick: vi.fn(), "data-testid": "row-copy" },
              {
                label: "Download",
                icon: DownloadIcon,
                onClick: vi.fn(),
                "data-testid": "row-download",
              },
            ]}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            data-testid="actions"
            {...props}
          />
          <EmptyCell data-testid="empty" />
        </TableRow>
      </TableBody>
    </Table>,
  );
  return onRowClick;
}

describe("RowActions (SUI-FEATURE-047)", () => {
  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    await i18n.changeLanguage("en");
  });

  it("marks head and cell as the actions column; the head reads Actions", () => {
    renderRow();
    expect(screen.getByTestId("actions-head")).toHaveAttribute("data-col-kind", "actions");
    expect(screen.getByTestId("actions-head")).toHaveTextContent("Actions");
    expect(screen.getByTestId("actions")).toHaveAttribute("data-col-kind", "actions");
  });

  it("AC4: extra, extra, edit, delete in DOM order, all icon-xs, named ‹verb› ‹row›", async () => {
    await i18n.changeLanguage("de");
    renderRow();
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Copy Ada",
      "Download Ada",
      "Bearbeiten Ada",
      "Löschen Ada",
    ]);
    expect(buttons.map((button) => button.dataset.variant)).toEqual([
      "outline",
      "outline",
      "warn",
      "destructive",
    ]);
    for (const button of buttons) expect(button.dataset.size).toBe("icon-xs");
  });

  it("names edit and delete in en", () => {
    renderRow();
    expect(screen.getByRole("button", { name: "Edit Ada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Ada" })).toBeInTheDocument();
  });

  it("leaves out edit and delete without a handler", () => {
    renderRow({ onEdit: undefined, onDelete: undefined, extra: [] });
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("AC5: a click on an action runs it and does not reach the row", () => {
    const onEdit = vi.fn();
    const onRowClick = renderRow({ onEdit });
    fireEvent.click(screen.getByRole("button", { name: "Edit Ada" }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onRowClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("row"));
    expect(onRowClick).toHaveBeenCalledOnce();
  });

  it("GL-UI-015: a click on the empty part of the actions cell opens the row, with w-full too", () => {
    const onRowClick = renderRow({ className: "w-full" });
    const cluster = screen.getByTestId("actions").querySelector('[data-slot="row-actions"]');
    fireEvent.click(cluster as HTMLElement);
    expect(onRowClick).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("row-copy"));
    expect(onRowClick).toHaveBeenCalledOnce();
  });

  it.each(["Enter", " "])("AC5: %j on an action reaches neither the row nor its table", (key) => {
    const onRowKey = vi.fn();
    const onEdit = vi.fn();
    render(
      <Table onKeyDown={onRowKey}>
        <TableBody>
          <TableRow onKeyDown={onRowKey}>
            <RowActions rowName="Ada" onEdit={onEdit} />
          </TableRow>
        </TableBody>
      </Table>,
    );
    const edit = screen.getByRole("button", { name: "Edit Ada" });
    fireEvent.keyDown(edit, { key });
    // A browser turns the activation key into a click on the button.
    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onRowKey).not.toHaveBeenCalled();
  });

  it("lets other keys through to the row's grid navigation", () => {
    const onRowKey = vi.fn();
    render(
      <Table onKeyDown={onRowKey}>
        <TableBody>
          <TableRow>
            <RowActions rowName="Ada" onEdit={vi.fn()} />
          </TableRow>
        </TableBody>
      </Table>,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Edit Ada" }), { key: "ArrowDown" });
    expect(onRowKey).toHaveBeenCalledOnce();
  });

  it("AC5: a locked action shows its reason and a click on it reaches neither action nor row", () => {
    const onDelete = vi.fn();
    const onRowClick = renderRow({ onDelete, deleteDisabledText: "Still in use by 3 events." });
    const remove = screen.getByRole("button", { name: "Delete Ada" });
    expect(remove).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(remove);
    fireEvent.click(remove.parentElement as HTMLElement);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
    // SUI-FEATURE-074: the reason shows on hover over the span; on focus it is the button's own
    // description (SUI-FEATURE-250), and the span is no tab stop.
    const span = remove.parentElement as HTMLElement;
    expect(hintOf(span)).toEqual({
      focus: null,
      hover1499: null,
      hover1500: "Still in use by 3 events.",
    });
    expect(remove).toHaveAccessibleDescription("Still in use by 3 events.");
    expect(span).not.toHaveAttribute("tabindex");
  });

  it("the hint of a usable action is its name", () => {
    renderRow();
    expect(hintOf(screen.getByRole("button", { name: "Edit Ada" })).hover1500).toBe("Edit Ada");
  });
});

describe("RowActions overflow menu (SUI-FEATURE-066)", () => {
  // The open menu measures itself; jsdom has no ResizeObserver.
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const MENU = {
    label: "More for Ada",
    items: [
      { label: "Archive", onSelect: vi.fn(), destructive: true },
      { label: "Duplicate", onSelect: vi.fn() },
      { label: "Export", onSelect: vi.fn(), disabled: true },
    ],
  };

  const openMenu = () => {
    const trigger = screen.getByRole("button", { name: "More for Ada" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    return screen.getByRole("menu");
  };

  it("AC1: edit, then the outline ⋯ button named by its label, then delete", () => {
    renderRow({ extra: [], menu: MENU });
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Edit Ada",
      "More for Ada",
      "Delete Ada",
    ]);
    expect(buttons[1]?.dataset.variant).toBe("outline");
    expect(buttons[1]?.dataset.size).toBe("icon-xs");
    expect(buttons[1]).toHaveAttribute("aria-haspopup", "menu");
    expect(hintOf(buttons[1] as HTMLElement).hover1500).toBe("More for Ada");
  });

  it("AC2: the destructive entry stands last after a separator; a disabled entry is muted", () => {
    renderRow({ extra: [], menu: MENU });
    const menu = openMenu();
    const children = [...menu.children];
    expect(children.map((el) => el.getAttribute("role"))).toEqual([
      "menuitem",
      "menuitem",
      "separator",
      "menuitem",
    ]);
    expect(children.map((el) => el.textContent)).toEqual(["Duplicate", "Export", "", "Archive"]);
    expect(children[3]).toHaveAttribute("data-variant", "destructive");
    expect(children[3]).toHaveClass("text-destructive-text");
    expect(children[1]).toHaveAttribute("data-disabled");
    expect(children[1]).toHaveAttribute("aria-disabled", "true");
    expect(children[1]).toHaveClass("data-[disabled]:opacity-50");
  });

  it("AC3: Enter opens, the arrows skip the disabled entry, Enter chooses, Esc closes", async () => {
    const onDuplicate = vi.fn();
    const onArchive = vi.fn();
    const onExport = vi.fn();
    const onRowKey = vi.fn();
    const onRowClick = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow onKeyDown={onRowKey} onClick={onRowClick}>
            <RowActions
              rowName="Ada"
              menu={{
                label: "More for Ada",
                items: [
                  { label: "Duplicate", onSelect: onDuplicate },
                  { label: "Export", onSelect: onExport, disabled: true },
                  { label: "Archive", onSelect: onArchive, destructive: true },
                ],
              }}
            />
          </TableRow>
        </TableBody>
      </Table>,
    );
    let menu = openMenu();
    const items = within(menu).getAllByRole("menuitem");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0] as HTMLElement, { key: "ArrowDown" });
    // The menu moves the focus on the next task.
    await waitFor(() => expect(items[2]).toHaveFocus());
    fireEvent.keyDown(items[2] as HTMLElement, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onArchive).not.toHaveBeenCalled();

    menu = openMenu();
    const [duplicate] = within(menu).getAllByRole("menuitem");
    (duplicate as HTMLElement).focus();
    fireEvent.keyDown(duplicate as HTMLElement, { key: "Enter" });
    expect(onDuplicate).toHaveBeenCalledOnce();
    expect(onExport).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe("RowActions menu entry hint (SUI-FEATURE-066 rev 3)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const MENU = {
    label: "More for Ada",
    items: [
      { label: "Duplicate", onSelect: vi.fn(), hint: "Makes a copy of this entry." },
      {
        label: "Export",
        onSelect: vi.fn(),
        disabled: true,
        hint: "Unlocks once the entry is published.",
      },
      { label: "Archive", onSelect: vi.fn() },
    ],
  };

  const openMenu = () => {
    const trigger = screen.getByRole("button", { name: "More for Ada" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    return screen.getByRole("menu");
  };
  const description = (element: HTMLElement) =>
    (element.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ");

  it("AC7: an entry with a hint keeps its label as name and is described by the hint", () => {
    renderRow({ extra: [], menu: MENU });
    const menu = openMenu();
    const duplicate = within(menu).getByRole("menuitem", { name: "Duplicate" });
    expect(description(duplicate)).toBe("Makes a copy of this entry.");
    expect(within(menu).getByRole("menuitem", { name: "Archive" })).not.toHaveAttribute(
      "aria-describedby",
    );
  });

  it("AC7: the hint opens on hover after the package delay, not on focus", () => {
    renderRow({ extra: [], menu: MENU });
    const menu = openMenu();
    const hint = hintOf(within(menu).getByRole("menuitem", { name: "Duplicate" }));
    expect(hint).toEqual({
      hover1499: null,
      hover1500: "Makes a copy of this entry.",
      focus: null,
    });
  });

  it("AC7: a disabled entry shows its hint as well", () => {
    renderRow({ extra: [], menu: MENU });
    const menu = openMenu();
    const exported = within(menu).getByRole("menuitem", { name: "Export" });
    expect(exported).toHaveAttribute("data-disabled");
    expect(exported).toHaveClass("data-[disabled]:pointer-events-auto");
    expect(description(exported)).toBe("Unlocks once the entry is published.");
    expect(hintOf(exported).hover1500).toBe("Unlocks once the entry is published.");
    fireEvent.click(exported);
    expect(MENU.items[1]!.onSelect).not.toHaveBeenCalled();
  });
});

// #518: a locked menu entry offers no shortcut (`GL-UI-006` rev 4 §Sichtbarkeit).
describe("RowActions menu entry shortcut (GL-UI-006)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const row = (disabled: boolean) => (
    <Table>
      <TableBody>
        <TableRow>
          <RowActions
            rowName="Ada"
            menu={{
              label: "More for Ada",
              items: [
                {
                  label: "Undo",
                  onSelect: vi.fn(),
                  shortcut: ["Ctrl+Z", "Meta+Z"],
                  disabled,
                  ...(disabled ? { hint: "Nothing to undo." } : {}),
                },
                { label: "Redo", onSelect: vi.fn(), shortcut: ["Ctrl+Y"], disabled },
              ],
            }}
          />
        </TableRow>
      </TableBody>
    </Table>
  );
  const openMenu = () => {
    const trigger = screen.getByRole("button", { name: "More for Ada" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    return screen.getByRole("menu");
  };
  const entry = (menu: HTMLElement, name: string) =>
    within(menu)
      .getAllByRole("menuitem")
      .find((item) => item.textContent?.startsWith(name))!;

  it("a disabled entry, with or without a hint, shows no chip and no aria-keyshortcuts; enabled, both return", () => {
    const { rerender } = render(row(true));
    let menu = openMenu();
    for (const name of ["Undo", "Redo"]) {
      const item = entry(menu, name);
      expect(item).not.toHaveAttribute("aria-keyshortcuts");
      expect(item.querySelector("kbd")).toBeNull();
    }
    fireEvent.keyDown(menu, { key: "Escape" });
    rerender(row(false));
    menu = openMenu();
    expect(entry(menu, "Undo")).toHaveAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
    expect(entry(menu, "Undo").querySelector("kbd")).not.toBeNull();
    expect(entry(menu, "Redo")).toHaveAttribute("aria-keyshortcuts", "Control+Y");
    expect(entry(menu, "Redo").querySelector("kbd")).not.toBeNull();
  });
});

describe("RowActions Used by (SUI-FEATURE-004)", () => {
  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    await i18n.changeLanguage("en");
  });

  it("AC1: the usage button stands first, before the extra actions, its hint names the count", async () => {
    await i18n.changeLanguage("de");
    const onToggle = vi.fn();
    renderRow({ usage: { count: 3, active: false, onToggle } });
    const buttons = within(screen.getByTestId("actions")).getAllByRole("button");
    expect(buttons[0]).toBe(screen.getByTestId("row-usage"));
    expect(buttons[1]).toBe(screen.getByTestId("row-copy"));
    expect(buttons[0]).toHaveAttribute("aria-label", "Verwendet von (3)");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
    expect(buttons[0]).toHaveAttribute("data-size", "icon-xs");
    expect(screen.getByTestId("row-usage-count")).toHaveTextContent("3");
    expect(hintOf(buttons[0]!).hover1500).toBe("Verwendet von (3)");
    fireEvent.click(buttons[0]!);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // SUI-FEATURE-087 rev 6: the pressed fill is one value in the package, shared with GridToggle.
  it("the usage toggle's pressed fill is the shared PRESSED_FILL_CLASS", () => {
    renderRow({ usage: { count: 2, active: true, onToggle: () => {} } });
    const classes = screen.getByTestId("row-usage").className.split(" ");
    for (const token of PRESSED_FILL_CLASS.split(" ")) expect(classes).toContain(token);
  });

  it("AC2: without a use the button is locked and its hint says so", async () => {
    await i18n.changeLanguage("de");
    const onToggle = vi.fn();
    renderRow({ usage: { count: 0, active: false, onToggle } });
    const button = screen.getByTestId("row-usage");
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
    // SUI-FEATURE-074: the hint shows on hover, not on focus.
    expect(hintOf(button.parentElement as HTMLElement)).toEqual({
      focus: null,
      hover1499: null,
      hover1500: "Nirgends verwendet",
    });
  });

  it("AC3: active, the button is pressed and filled like the chosen device", () => {
    renderRow({ usage: { count: 3, active: true, onToggle: vi.fn() } });
    const button = screen.getByTestId("row-usage");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass(
      "pressed:bg-primary",
      "pressed:text-primary-foreground",
      "pressed:border-primary",
      "pressed:hover:bg-primary-hover",
    );
  });
});

describe("RowActions busy (SUI-FEATURE-072)", () => {
  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    await i18n.changeLanguage("en");
  });

  // Two rows with the same "Send" action; it runs in Ada's row only.
  function renderRows() {
    const sendAda = vi.fn();
    const sendBob = vi.fn();
    const copyAda = vi.fn();
    const editAda = vi.fn();
    const deleteAda = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow>
            <RowActions
              rowName="Ada"
              extra={[
                { label: "Copy", icon: CopyIcon, onClick: copyAda },
                {
                  label: "Send",
                  icon: DownloadIcon,
                  onClick: sendAda,
                  busy: true,
                  shortcut: ["Ctrl+Enter"],
                },
              ]}
              onEdit={editAda}
              onDelete={deleteAda}
            />
          </TableRow>
          <TableRow>
            <RowActions
              rowName="Bob"
              extra={[{ label: "Send", icon: DownloadIcon, onClick: sendBob, busy: false }]}
            />
          </TableRow>
        </TableBody>
      </Table>,
    );
    return { sendAda, sendBob, copyAda, editAda, deleteAda };
  }

  it("AC1: shows the working state, aria-busy, full colour; click, double click and shortcut do not run it", () => {
    const { sendAda } = renderRows();
    const send = screen.getByRole("button", { name: "Send Ada" });
    expect(within(send).getByTestId("button-loading")).toBeInTheDocument();
    expect(send).toHaveAttribute("aria-busy", "true");
    // SUI-FEATURE-120: locked by aria-disabled and the click guard, never `disabled`.
    expect(send).toHaveAttribute("aria-disabled", "true");
    expect(send).toBeEnabled();
    // Full colour: neither opacity nor the disabled half-tone (SUI-FEATURE-250 rev 4).
    expect(send.className).not.toMatch(/opacity|disabled:bg-/);
    expect(send).toHaveAttribute("aria-keyshortcuts", "Control+Enter");
    fireEvent.click(send);
    fireEvent.click(send, { detail: 2 });
    fireEvent.dblClick(send);
    // A shortcut dispatcher activates the button it names; the locked button drops it.
    send.click();
    expect(sendAda).not.toHaveBeenCalled();
  });

  it.each(["Enter", " "])(
    "AC1: %j on the focused busy button does not run it; aria-keyshortcuts stays",
    (key) => {
      const { sendAda } = renderRows();
      const send = screen.getByRole("button", { name: "Send Ada" });
      send.focus();
      fireEvent.keyDown(send, { key });
      fireEvent.keyUp(send, { key });
      // The browser activates a focused button on Enter/Space with a click; the locked button drops it.
      fireEvent.click(send, { detail: 0 });
      expect(sendAda).not.toHaveBeenCalled();
      expect(send).toHaveFocus();
      expect(send).toHaveAttribute("aria-keyshortcuts", "Control+Enter");
    },
  );

  it("AC2: edit, delete and the other extras of the row stay operable; the same action elsewhere runs", () => {
    const { sendBob, copyAda, editAda, deleteAda } = renderRows();
    fireEvent.click(screen.getByRole("button", { name: "Copy Ada" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Ada" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Ada" }));
    const sendOther = screen.getByRole("button", { name: "Send Bob" });
    expect(sendOther).not.toHaveAttribute("aria-busy");
    fireEvent.click(sendOther);
    expect([copyAda, editAda, deleteAda, sendBob].map((fn) => fn.mock.calls.length)).toEqual([
      1, 1, 1, 1,
    ]);
  });

  it("AC4: name and hint stay ‹label› ‹rowName›", () => {
    renderRows();
    const send = screen.getByRole("button", { name: "Send Ada" });
    expect(send).toHaveAttribute("aria-label", "Send Ada");
    // Locked while it runs, the button sits in a span that opens the hint on hover.
    expect(hintOf(send.parentElement as HTMLElement).hover1500).toMatch(/^Send Ada/);
  });
});

describe("RowActions test ids (SUI-FEATURE-008)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC1: edit and delete carry the given ids, by default row-edit and row-delete", () => {
    renderRow({ editTestId: "tag-edit-7", deleteTestId: "tag-delete-7" });
    expect(screen.getByRole("button", { name: "Edit Ada" })).toHaveAttribute(
      "data-testid",
      "tag-edit-7",
    );
    expect(screen.getByRole("button", { name: "Delete Ada" })).toHaveAttribute(
      "data-testid",
      "tag-delete-7",
    );
    expect(screen.queryByTestId("row-edit")).toBeNull();
    expect(screen.queryByTestId("row-delete")).toBeNull();
  });

  it("AC1: without the props edit and delete stay row-edit and row-delete", () => {
    renderRow();
    expect(screen.getByRole("button", { name: "Edit Ada" })).toHaveAttribute(
      "data-testid",
      "row-edit",
    );
    expect(screen.getByRole("button", { name: "Delete Ada" })).toHaveAttribute(
      "data-testid",
      "row-delete",
    );
  });

  it("AC2: a menu entry with a data-testid carries it; without it stays row-menu-item", () => {
    renderRow({
      extra: [],
      menu: {
        label: "More for Ada",
        items: [
          { label: "Duplicate", onSelect: vi.fn(), "data-testid": "tag-duplicate-7" },
          { label: "Export", onSelect: vi.fn() },
        ],
      },
    });
    const trigger = screen.getByRole("button", { name: "More for Ada" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveAttribute(
      "data-testid",
      "tag-duplicate-7",
    );
    expect(screen.getByRole("menuitem", { name: "Export" })).toHaveAttribute(
      "data-testid",
      "row-menu-item",
    );
  });
});

describe("RowActions step (SUI-FEATURE-330)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Ada's row with a step, Bob's without; Cleo's step is running.
  function renderRows(adaStep: Partial<RowAction> = {}) {
    const deliverAda = vi.fn();
    const deliverCleo = vi.fn();
    const editAda = vi.fn();
    const row = (rowName: string, step?: RowAction) => (
      <TableRow>
        <RowActions
          rowName={rowName}
          {...(step === undefined ? {} : { step })}
          extra={[{ label: "Copy", icon: CopyIcon, onClick: vi.fn() }]}
          onEdit={rowName === "Ada" ? editAda : vi.fn()}
          onDelete={vi.fn()}
          data-testid={`actions-${rowName}`}
        />
      </TableRow>
    );
    render(
      <Table>
        <TableBody>
          {row("Ada", {
            label: "Deliver",
            icon: SendIcon,
            onClick: deliverAda,
            "data-testid": "row-step",
            ...adaStep,
          })}
          {row("Bob")}
          {row("Cleo", { label: "Deliver", icon: SendIcon, onClick: deliverCleo, busy: true })}
        </TableBody>
      </Table>,
    );
    return { deliverAda, deliverCleo, editAda };
  }
  const cluster = (rowName: string) =>
    screen.getByTestId(`actions-${rowName}`).querySelector<HTMLElement>("[data-slot=row-actions]");

  it("AC1: the step stands first as a labelled success button with icon, named ‹label› ‹rowName›", () => {
    const { deliverAda } = renderRows();
    const buttons = within(screen.getByTestId("actions-Ada")).getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Deliver Ada",
      "Copy Ada",
      "Edit Ada",
      "Delete Ada",
    ]);
    const step = screen.getByTestId("row-step");
    expect(buttons[0]).toBe(step);
    expect(step).toHaveAttribute("data-variant", "success");
    // The text size of the icon buttons' height (`icon-xs`).
    expect(step).toHaveAttribute("data-size", "xs");
    expect(step).toHaveTextContent("Deliver");
    expect(step.querySelector("svg")).toBeInTheDocument();
    expect(step).toHaveAttribute("type", "button");
    fireEvent.click(step);
    expect(deliverAda).toHaveBeenCalledOnce();
  });

  it("AC1: its hint reads ‹label› ‹rowName›", () => {
    renderRows();
    expect(hintOf(screen.getByTestId("row-step")).hover1500).toMatch(/^Deliver Ada/);
  });

  it("AC2: the cluster stays end-aligned; a row without a step has the same icon buttons and no step", () => {
    renderRows();
    for (const rowName of ["Ada", "Bob", "Cleo"]) {
      expect(cluster(rowName)?.className).toMatch(/\bjustify-end\b/);
    }
    // Bob's cluster reserves nothing: its buttons are exactly the icon buttons Ada's step stands before.
    const icons = (rowName: string) =>
      within(cluster(rowName) as HTMLElement)
        .getAllByRole("button")
        .filter((button) => button.dataset.size === "icon-xs")
        .map((button) => button.getAttribute("aria-label")?.split(" ")[0]);
    expect(icons("Bob")).toEqual(icons("Ada"));
    expect(within(cluster("Bob") as HTMLElement).getAllByRole("button")).toHaveLength(3);
    expect(cluster("Bob")?.children).toHaveLength(3);
  });

  it("AC3: busy locks only that row's step; click and double click do not run it", () => {
    const { deliverAda, deliverCleo } = renderRows();
    const running = screen.getByRole("button", { name: "Deliver Cleo" });
    expect(running).toHaveAttribute("aria-busy", "true");
    expect(within(running).getByTestId("button-loading")).toBeInTheDocument();
    fireEvent.click(running);
    fireEvent.click(running, { detail: 2 });
    fireEvent.dblClick(running);
    expect(deliverCleo).not.toHaveBeenCalled();
    const other = screen.getByTestId("row-step");
    expect(other).not.toHaveAttribute("aria-busy");
    fireEvent.click(other);
    expect(deliverAda).toHaveBeenCalledOnce();
  });

  it("AC3: disabledText locks the step and names the reason, as on any RowAction", () => {
    const { deliverAda } = renderRows({ disabledText: "No address yet." });
    const step = screen.getByTestId("row-step");
    expect(step).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(step);
    expect(deliverAda).not.toHaveBeenCalled();
    expect(step).toHaveAccessibleDescription("No address yet.");
    expect(hintOf(step.parentElement as HTMLElement).hover1500).toBe("No address yet.");
  });

  it("AC3: shortcut shows on the step as on any RowAction", () => {
    renderRows({ shortcut: ["Ctrl+Enter"] });
    expect(screen.getByTestId("row-step")).toHaveAttribute("aria-keyshortcuts", "Control+Enter");
  });
});

// #195: inside a form an action acts on its row and never submits the form.
describe("foldRowAction (SUI-FEATURE-330)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderFolded = (action: RowAction) =>
    render(
      <Table>
        <TableBody>
          <TableRow>
            <RowActions
              rowName="Ada"
              menu={{ label: "More for Ada", items: [foldRowAction(action, "Ada")] }}
            />
          </TableRow>
        </TableBody>
      </Table>,
    );
  const openMenu = () => {
    const trigger = screen.getByRole("button", { name: "More for Ada" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    return screen.getByRole("menuitem");
  };

  it("keeps the action's icon and shortcut on its entry", () => {
    renderFolded({
      label: "Deliver",
      icon: SendIcon,
      onClick: vi.fn(),
      shortcut: ["Ctrl+Enter"],
    });
    const entry = openMenu();
    expect(entry.querySelector("svg.lucide-send")).toHaveAttribute("aria-hidden", "true");
    expect(entry).toHaveAttribute("aria-keyshortcuts", "Control+Enter");
    expect(entry.querySelector("kbd")).not.toBeNull();
  });

  it("a running action marks the ⋯ button as working, unlocked; idle, it does not", () => {
    const { unmount } = renderFolded({
      label: "Deliver",
      icon: SendIcon,
      onClick: vi.fn(),
      busy: true,
    });
    const trigger = screen.getByRole("button", { name: "More for Ada" });
    expect(trigger).toHaveAttribute("aria-busy", "true");
    expect(trigger).not.toHaveAttribute("aria-disabled");
    expect(openMenu()).toHaveAttribute("data-disabled");
    unmount();
    renderFolded({ label: "Deliver", icon: SendIcon, onClick: vi.fn() });
    expect(screen.getByRole("button", { name: "More for Ada" })).not.toHaveAttribute("aria-busy");
  });
});

describe("RowActions inside a form", () => {
  it("Used by, an extra action, edit and delete are type=button: one call, no submit", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onCopy = vi.fn();
    const onToggle = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Table>
          <TableBody>
            <TableRow>
              <RowActions
                rowName="Ada"
                usage={{ count: 3, active: false, onToggle }}
                extra={[
                  { label: "Copy", icon: CopyIcon, onClick: onCopy, "data-testid": "row-copy" },
                ]}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </TableRow>
          </TableBody>
        </Table>
      </form>,
    );
    for (const [testId, handler] of [
      ["row-usage", onToggle],
      ["row-copy", onCopy],
      ["row-edit", onEdit],
      ["row-delete", onDelete],
    ] as const) {
      const button = screen.getByTestId(testId);
      expect(button).toHaveAttribute("type", "button");
      fireEvent.click(button);
      expect(handler).toHaveBeenCalledOnce();
    }
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("EmptyCell (SUI-FEATURE-047)", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it.each([
    ["de", "leer"],
    ["en", "empty"],
    ["es", "vacío"],
  ])("AC6: a muted dash, announced as empty (%s)", async (lng, label) => {
    await i18n.changeLanguage(lng);
    renderRow();
    const cell = screen.getByTestId("empty");
    expect(cell).toHaveTextContent(/^—$/);
    expect(cell).toHaveClass("text-muted-foreground");
    expect(cell).toHaveAttribute("aria-label", label);
  });
});
