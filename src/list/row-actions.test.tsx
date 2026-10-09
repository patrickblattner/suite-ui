import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { CopyIcon, DownloadIcon } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
