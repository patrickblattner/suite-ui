import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { CopyIcon, DownloadIcon } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Table, TableBody, TableHeader, TableRow } from "../ui/table.js";
import { EmptyCell } from "./empty-cell.js";
import { RowActions, RowActionsHead, type RowActionsProps } from "./row-actions.js";
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
    expect(remove).toBeDisabled();
    fireEvent.click(remove.parentElement as HTMLElement);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
    expect(hintOf(remove.parentElement as HTMLElement).focus).toBe("Still in use by 3 events.");
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
