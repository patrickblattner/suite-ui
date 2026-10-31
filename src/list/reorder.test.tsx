import { act, fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { CopyIcon } from "lucide-react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Table, TableBody, TableCell, TableHead, TableRow } from "../ui/table.js";
import { DataTableShell } from "./data-table-shell.js";
import { ReorderCell, ReorderHead } from "./reorder.js";
import { RowActions } from "./row-actions.js";
import { hintOf } from "./test-utils.js";
import { useRowGrid } from "./use-row-grid.js";

type Item = { id: string; name: string; group?: string };

const ITEMS: Item[] = [
  { id: "a", name: "Ada" },
  { id: "b", name: "Grace" },
  { id: "c", name: "Linus" },
  { id: "d", name: "Barbara" },
  { id: "e", name: "Ken" },
];

// A hand-sorted list as an app builds it: a pager over `pageSize` rows, ↑/↓ move across the whole
// list and the pager follows the entry, a drop moves within the page, a click on a row selects it.
// `locks` adds lock reasons by id; `onTableKeyDown` listens on the table beside the keyboard grid.
function Harness({
  items: initial = ITEMS,
  pageSize = 10,
  locks = {},
  onDrop,
  onMove,
  onTableKeyDown,
  refresh = (list) => [{ id: "x", name: "Xena" }, ...list],
}: {
  items?: Item[];
  pageSize?: number;
  locks?: Record<string, { up?: string; down?: string }>;
  onDrop?: (id: string, toIndex: number) => void;
  onMove?: (id: string, direction: "up" | "down") => void;
  onTableKeyDown?: (key: string) => void;
  refresh?: (items: Item[]) => Item[];
}) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState("");
  const grid = useRowGrid();
  const start = page * pageSize;
  const visible = items.slice(start, start + pageSize);
  const move = (from: number, to: number) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  return (
    <>
      <DataTableShell
        head={
          <>
            <ReorderHead data-testid="reorder-head" />
            <TableHead>Name</TableHead>
          </>
        }
        columnCount={2}
        isPending={false}
        isEmpty={false}
        empty=""
        loadingRowTestId="loading"
        emptyTestId="empty"
        tableProps={{
          ...grid.gridProps,
          onKeyDown: (event) => {
            onTableKeyDown?.(event.key);
            grid.gridProps.onKeyDown(event);
          },
        }}
        reorder={{
          onDrop: (id, toIndex) => {
            onDrop?.(id, toIndex);
            move(start + visible.findIndex((item) => item.id === id), start + toIndex);
          },
        }}
        pagination={
          <button type="button" onClick={() => setPage((current) => current + 1)}>
            next
          </button>
        }
      >
        {visible.map((item, index) => (
          <TableRow
            key={item.id}
            {...grid.rowProps({ onOpen: () => setSelected(item.id) })}
            data-testid={`row-${item.id}`}
          >
            <ReorderCell
              id={item.id}
              rowName={item.name}
              {...(item.group === undefined ? {} : { group: item.group })}
              onMove={(direction) => {
                onMove?.(item.id, direction);
                const from = start + index;
                const to = direction === "up" ? from - 1 : from + 1;
                move(from, to);
                setPage(Math.floor(to / pageSize));
              }}
              {...(start + index === 0 ? { upDisabledText: "Already the first entry." } : {})}
              {...(start + index === items.length - 1
                ? { downDisabledText: "Already the last entry." }
                : {})}
              {...(locks[item.id]?.up === undefined ? {} : { upDisabledText: locks[item.id]!.up })}
              {...(locks[item.id]?.down === undefined
                ? {}
                : { downDisabledText: locks[item.id]!.down })}
              data-testid={`reorder-${item.id}`}
            />
            <TableCell>{item.name}</TableCell>
          </TableRow>
        ))}
      </DataTableShell>
      <button type="button" onClick={() => setItems(refresh)}>
        refresh
      </button>
      <output data-testid="order">{items.map((item) => item.id).join("")}</output>
      <output data-testid="selected">{selected}</output>
    </>
  );
}

const order = () => screen.getByTestId("order").textContent;
const grip = (id: string) => screen.getByTestId(`reorder-${id}-grip`);
const cell = (id: string) => screen.getByTestId(`reorder-${id}`);

// A pointer drag of `id`'s grip over the row of `over`, then dropped there.
function drag(id: string, over: string, { drop = true } = {}) {
  fireEvent.dragStart(grip(id));
  const target = within(screen.getByTestId(`row-${over}`)).getByText(
    ITEMS.find((item) => item.id === over)?.name ?? over,
  );
  fireEvent.dragOver(target);
  const line = document.querySelector("[data-drop]")?.getAttribute("data-reorder-id") ?? null;
  if (drop) fireEvent.drop(target);
  fireEvent.dragEnd(grip(id));
  return line;
}

describe("ReorderCell (SUI-FEATURE-340)", () => {
  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    await i18n.changeLanguage("en");
  });

  it("AC1: grip, ↑ and ↓ in the first cell, ghost icon-xs, named ‹verb› ‹rowName›", () => {
    render(<Harness />);
    const first = screen.getByTestId("row-b").firstElementChild as HTMLElement;
    expect(first).toBe(cell("b"));
    expect(first).toHaveClass("w-0");
    const buttons = within(first).getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Move Grace",
      "Move up Grace",
      "Move down Grace",
    ]);
    expect(buttons.map((button) => button.dataset.testid)).toEqual([
      "reorder-b-grip",
      "reorder-b-up",
      "reorder-b-down",
    ]);
    for (const button of buttons) {
      expect(button).toHaveAttribute("data-variant", "ghost");
      expect(button).toHaveAttribute("data-size", "icon-xs");
    }
    expect(hintOf(buttons[1]!).hover1500).toBe("Move up Grace");
  });

  it.each([
    [
      "de",
      ["Verschieben Ada", "Nach oben verschieben Ada", "Nach unten verschieben Ada"],
      "Reihenfolge",
    ],
    ["es", ["Mover Ada", "Subir Ada", "Bajar Ada"], "Orden"],
    ["en", ["Move Ada", "Move up Ada", "Move down Ada"], "Order"],
  ])(
    "AC1 %s: names from the package; the head is empty but for its sr-only label",
    async (lng, names, head) => {
      await i18n.changeLanguage(lng);
      render(<Harness />);
      expect(
        within(cell("a"))
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual(names);
      const th = screen.getByTestId("reorder-head");
      expect(th).toHaveTextContent(head);
      expect(th).toHaveClass("w-0");
      expect(th.firstElementChild).toHaveClass("sr-only");
    },
  );

  it("AC2: ↓ and a drag onto the next row give the same row at the same place", () => {
    const onMove = vi.fn();
    const { unmount } = render(<Harness onMove={onMove} />);
    fireEvent.click(screen.getByTestId("reorder-b-down"));
    expect(onMove).toHaveBeenCalledWith("b", "down");
    const byArrow = order();
    unmount();
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    expect(drag("b", "c")).toBe("c");
    expect(onDrop).toHaveBeenCalledWith("b", 2);
    expect(order()).toBe(byArrow);
    expect(order()).toBe("acbde");
  });

  it("AC2: a drag upward shows the line above its target and drops at the target's index", () => {
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    fireEvent.dragStart(grip("d"));
    fireEvent.dragOver(within(screen.getByTestId("row-b")).getByText("Grace"));
    expect(cell("b")).toHaveAttribute("data-drop", "before");
    expect(cell("d")).toHaveAttribute("data-carried");
    fireEvent.drop(within(screen.getByTestId("row-b")).getByText("Grace"));
    fireEvent.dragEnd(grip("d"));
    expect(onDrop).toHaveBeenCalledWith("d", 1);
    expect(order()).toBe("adbce");
    expect(document.querySelector("[data-drop], [data-carried]")).toBeNull();
  });

  it("AC2: a drag never leaves the page; the index is the one on that page", () => {
    const onDrop = vi.fn();
    render(<Harness pageSize={3} onDrop={onDrop} />);
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.queryByTestId("row-a")).toBeNull();
    drag("e", "d");
    expect(onDrop).toHaveBeenCalledWith("e", 0);
    expect(order()).toBe("abced");
  });

  it("AC2: a drag over its own row shows no line and a drop there calls nothing", () => {
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    expect(drag("b", "b")).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("AC3: Space, ↓, Space on the grip drops at the next index and announces each step", () => {
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    const live = screen.getByTestId("reorder-live");
    expect(live).toHaveAttribute("aria-live", "polite");
    grip("a").focus();
    fireEvent.keyDown(grip("a"), { key: " " });
    expect(live).toHaveTextContent("Ada picked up, position 1 of 5 on this page.");
    expect(grip("a")).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(grip("a"), { key: "ArrowDown" });
    expect(live).toHaveTextContent("Ada: position 2 of 5 on this page.");
    expect(cell("b")).toHaveAttribute("data-drop", "after");
    fireEvent.keyDown(grip("a"), { key: " " });
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith("a", 1);
    expect(order()).toBe("bacde");
    expect(live).toHaveTextContent("Ada dropped at position 2 of 5 on this page.");
    // The grip keeps the focus once the rows have moved, and is no longer pressed.
    expect(grip("a")).toHaveFocus();
    expect(grip("a")).toHaveAttribute("aria-pressed", "false");
  });

  it("AC3: Enter picks up and drops as well", () => {
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    fireEvent.keyDown(grip("c"), { key: "Enter" });
    fireEvent.keyDown(grip("c"), { key: "ArrowUp" });
    fireEvent.keyDown(grip("c"), { key: "ArrowUp" });
    fireEvent.keyDown(grip("c"), { key: "Enter" });
    expect(onDrop).toHaveBeenCalledWith("c", 0);
    expect(order()).toBe("cabde");
  });

  it("AC3: Escape after a pick-up puts the row back without a call", () => {
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    fireEvent.keyDown(grip("b"), { key: " " });
    fireEvent.keyDown(grip("b"), { key: "ArrowDown" });
    fireEvent.keyDown(grip("b"), { key: "Escape" });
    expect(onDrop).not.toHaveBeenCalled();
    expect(order()).toBe("abcde");
    expect(document.querySelector("[data-drop], [data-carried]")).toBeNull();
    expect(screen.getByTestId("reorder-live")).toHaveTextContent(
      "Grace put back at position 2 of 5.",
    );
  });

  it("AC3: while a row is carried, the arrows move the row and never reach the grid", () => {
    const onTableKeyDown = vi.fn();
    render(<Harness onTableKeyDown={onTableKeyDown} />);
    act(() => grip("b").focus());
    fireEvent.keyDown(grip("b"), { key: " " });
    const down = fireEvent.keyDown(grip("b"), { key: "ArrowDown" });
    fireEvent.keyDown(grip("b"), { key: "ArrowUp" });
    expect(down).toBe(false);
    expect(onTableKeyDown).not.toHaveBeenCalled();
    expect(grip("b")).toHaveFocus();
    // Put back, the grip's arrows belong to the grid again.
    fireEvent.keyDown(grip("b"), { key: "Escape" });
    fireEvent.keyDown(grip("b"), { key: "ArrowDown" });
    expect(onTableKeyDown).toHaveBeenCalledWith("ArrowDown");
  });

  it("AC4: upDisabledText locks ↑ with its reason; the first row overall shows ↑ locked", () => {
    const onMove = vi.fn();
    render(<Harness onMove={onMove} />);
    const up = screen.getByTestId("reorder-a-up");
    expect(up).toHaveAttribute("aria-disabled", "true");
    expect(up).toHaveAccessibleDescription("Already the first entry.");
    fireEvent.click(up);
    expect(onMove).not.toHaveBeenCalled();
    expect(hintOf(up.parentElement as HTMLElement).hover1500).toBe("Already the first entry.");
    expect(screen.getByTestId("reorder-b-up")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("reorder-e-down")).toHaveAttribute("aria-disabled", "true");
  });

  it("AC4: the first row on a later page keeps ↑, and ↑ moves it across the page boundary", () => {
    render(<Harness pageSize={3} />);
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    const up = screen.getByTestId("reorder-d-up");
    expect(up).not.toHaveAttribute("aria-disabled");
    fireEvent.click(up);
    expect(order()).toBe("abdce");
    // The pager followed the entry; its ↑ keeps the focus on the new page.
    expect(screen.getByTestId("reorder-d-up")).toHaveFocus();
    fireEvent.click(screen.getByTestId("reorder-d-down"));
    expect(order()).toBe("abcde");
    expect(screen.getByTestId("reorder-d-down")).toHaveFocus();
  });

  it("AC9: upDisabledText binds the keyboard carry, and the lock is announced", () => {
    const onDrop = vi.fn();
    render(<Harness locks={{ c: { up: "Pinned below Grace." } }} onDrop={onDrop} />);
    fireEvent.keyDown(grip("c"), { key: " " });
    fireEvent.keyDown(grip("c"), { key: "ArrowUp" });
    expect(document.querySelector("[data-drop]")).toBeNull();
    expect(screen.getByTestId("reorder-live")).toHaveTextContent("Pinned below Grace.");
    fireEvent.keyDown(grip("c"), { key: " " });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("AC9: downDisabledText binds the keyboard carry; the last row overall is locked", () => {
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    fireEvent.keyDown(grip("e"), { key: " " });
    fireEvent.keyDown(grip("e"), { key: "ArrowDown" });
    expect(screen.getByTestId("reorder-live")).toHaveTextContent("Already the last entry.");
    fireEvent.keyDown(grip("e"), { key: " " });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("AC9: a pointer drag over a row above an upDisabledText row shows no line and drops nothing", () => {
    const onDrop = vi.fn();
    render(<Harness locks={{ c: { up: "Pinned below Grace." } }} onDrop={onDrop} />);
    expect(drag("c", "b")).toBeNull();
    expect(drag("c", "a")).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
    // Downward it still moves.
    expect(drag("c", "d")).toBe("d");
    expect(onDrop).toHaveBeenCalledWith("c", 3);
  });

  it("AC9: a pointer drag over a row below a downDisabledText row shows no line and drops nothing", () => {
    const onDrop = vi.fn();
    render(<Harness locks={{ b: { down: "Stays above Linus." } }} onDrop={onDrop} />);
    expect(drag("b", "c")).toBeNull();
    expect(drag("b", "e")).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
    expect(drag("b", "a")).toBe("a");
    expect(onDrop).toHaveBeenCalledWith("b", 0);
  });

  it("AC9: a refresh during a pointer carry keeps the carried row's lock (#680)", () => {
    const onDrop = vi.fn();
    render(<Harness locks={{ b: { down: "Stays above Linus." } }} onDrop={onDrop} />);
    fireEvent.dragStart(grip("b"));
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    const target = within(screen.getByTestId("row-c")).getByText("Linus");
    fireEvent.dragOver(target);
    expect(document.querySelector("[data-drop]")).toBeNull();
    fireEvent.drop(target);
    fireEvent.dragEnd(grip("b"));
    expect(onDrop).not.toHaveBeenCalled();
    expect(order()).toBe("xabcde");
  });

  it("AC9: a refresh during a keyboard carry keeps the carried row's lock (#680)", () => {
    const onDrop = vi.fn();
    render(<Harness locks={{ b: { down: "Stays above Linus." } }} onDrop={onDrop} />);
    fireEvent.keyDown(grip("b"), { key: " " });
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    fireEvent.keyDown(grip("b"), { key: "ArrowDown" });
    expect(screen.getByTestId("reorder-live")).toHaveTextContent("Stays above Linus.");
    fireEvent.keyDown(grip("b"), { key: "ArrowDown" });
    fireEvent.keyDown(grip("b"), { key: " " });
    expect(onDrop).not.toHaveBeenCalled();
    expect(order()).toBe("xabcde");
  });

  it("a refresh during a carry lands the row at its target's current index (#680)", () => {
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    fireEvent.keyDown(grip("b"), { key: " " });
    fireEvent.keyDown(grip("b"), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    fireEvent.keyDown(grip("b"), { key: " " });
    expect(onDrop).toHaveBeenCalledWith("b", 3);
    expect(order()).toBe("xacbde");
  });

  it("AC5: a refresh during a carry keeps the carried row's group, by pointer and keyboard (#680)", () => {
    const items: Item[] = [
      { id: "a", name: "Ada", group: "main" },
      { id: "b", name: "Grace", group: "footer" },
      { id: "c", name: "Linus", group: "footer" },
    ];
    const refresh = (list: Item[]) => [{ id: "x", name: "Xena", group: "main" }, ...list];
    const onDrop = vi.fn();
    render(<Harness items={items} refresh={refresh} onDrop={onDrop} />);
    fireEvent.dragStart(grip("b"));
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    const target = within(screen.getByTestId("row-x")).getByText("Xena");
    fireEvent.dragOver(target);
    expect(document.querySelector("[data-drop]")).toBeNull();
    fireEvent.drop(target);
    fireEvent.dragEnd(grip("b"));
    expect(onDrop).not.toHaveBeenCalled();
    // By keyboard the row stops at its group's edge on the refreshed rows.
    fireEvent.keyDown(grip("b"), { key: " " });
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    fireEvent.keyDown(grip("b"), { key: "ArrowUp" });
    expect(document.querySelector("[data-drop]")).toBeNull();
    fireEvent.keyDown(grip("b"), { key: " " });
    expect(onDrop).not.toHaveBeenCalled();
    expect(order()).toBe("xxabc");
  });

  it("a refresh that puts a barrier before the target refuses the drop and announces the put-back (#680)", () => {
    const items: Item[] = [
      { id: "a", name: "Ada", group: "main" },
      { id: "b", name: "Grace", group: "main" },
      { id: "c", name: "Linus", group: "main" },
    ];
    const refresh = (list: Item[]) => [
      ...list.slice(0, 2),
      { id: "y", name: "Yara", group: "footer" },
      ...list.slice(2),
    ];
    const onDrop = vi.fn();
    render(<Harness items={items} refresh={refresh} onDrop={onDrop} />);
    fireEvent.keyDown(grip("b"), { key: " " });
    fireEvent.keyDown(grip("b"), { key: "ArrowDown" });
    expect(cell("c")).toHaveAttribute("data-drop", "after");
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    expect(document.querySelector("[data-drop]")).toBeNull();
    fireEvent.keyDown(grip("b"), { key: " " });
    expect(onDrop).not.toHaveBeenCalled();
    expect(screen.getByTestId("reorder-live")).toHaveTextContent(
      "Grace put back at position 2 of 4.",
    );
  });

  it("a refresh keeps the drop line's direction on the moved rows (#680)", () => {
    render(<Harness />);
    fireEvent.keyDown(grip("c"), { key: " " });
    fireEvent.keyDown(grip("c"), { key: "ArrowUp" });
    expect(cell("b")).toHaveAttribute("data-drop", "before");
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    expect(cell("b")).toHaveAttribute("data-drop", "before");
    fireEvent.keyDown(grip("c"), { key: "ArrowDown" });
    expect(document.querySelector("[data-drop]")).toBeNull();
    fireEvent.keyDown(grip("c"), { key: "ArrowDown" });
    expect(cell("d")).toHaveAttribute("data-drop", "after");
  });

  it("a refresh that removes the carried row ends the carry and its drop line (#680)", () => {
    const onDrop = vi.fn();
    render(<Harness refresh={(list) => list.filter((item) => item.id !== "b")} onDrop={onDrop} />);
    fireEvent.dragStart(grip("b"));
    fireEvent.dragOver(within(screen.getByTestId("row-c")).getByText("Linus"));
    expect(cell("c")).toHaveAttribute("data-drop", "after");
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    expect(document.querySelector("[data-drop], [data-carried]")).toBeNull();
    fireEvent.drop(within(screen.getByTestId("row-d")).getByText("Barbara"));
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("AC10: the position counts the rows of the visible page; a page edge is announced", () => {
    render(<Harness pageSize={3} />);
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    const live = screen.getByTestId("reorder-live");
    fireEvent.keyDown(grip("d"), { key: " " });
    expect(live).toHaveTextContent("Barbara picked up, position 1 of 2 on this page.");
    fireEvent.keyDown(grip("d"), { key: "ArrowUp" });
    expect(live).toHaveTextContent("Barbara cannot move further up on this page.");
    fireEvent.keyDown(grip("d"), { key: "ArrowDown" });
    expect(live).toHaveTextContent("Barbara: position 2 of 2 on this page.");
  });

  it("AC5: with group, a drag over another group's row shows no line and a drop calls nothing", () => {
    const items: Item[] = [
      { id: "a", name: "Ada", group: "main" },
      { id: "b", name: "Grace", group: "main" },
      { id: "c", name: "Linus", group: "footer" },
      { id: "d", name: "Barbara", group: "footer" },
    ];
    const onDrop = vi.fn();
    render(<Harness items={items} onDrop={onDrop} />);
    expect(drag("b", "c")).toBeNull();
    expect(drag("a", "d")).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
    expect(drag("c", "d")).toBe("d");
    expect(onDrop).toHaveBeenCalledWith("c", 3);
    // By keyboard the row stops at its group's edge.
    fireEvent.keyDown(grip("b"), { key: " " });
    fireEvent.keyDown(grip("b"), { key: "ArrowDown" });
    expect(document.querySelector("[data-drop]")).toBeNull();
    fireEvent.keyDown(grip("b"), { key: " " });
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it("AC6: a click or Enter on grip, ↑ or ↓ never changes the selected row", () => {
    render(<Harness />);
    fireEvent.click(within(screen.getByTestId("row-c")).getByText("Linus"));
    expect(screen.getByTestId("selected")).toHaveTextContent("c");
    for (const part of ["grip", "up", "down"]) {
      const control = screen.getByTestId(`reorder-b-${part}`);
      fireEvent.click(control);
      fireEvent.keyDown(control, { key: "Enter" });
      fireEvent.keyDown(control, { key: "Escape" });
    }
    expect(screen.getByTestId("selected")).toHaveTextContent("c");
  });

  it("without reorder on the shell there is no grip; ↑ and ↓ still move", () => {
    const onMove = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow>
            <ReorderCell id="a" rowName="Ada" onMove={onMove} data-testid="plain" />
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.queryByTestId("plain-grip")).toBeNull();
    expect(
      within(screen.getByTestId("plain"))
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Move up Ada", "Move down Ada"]);
    fireEvent.click(screen.getByTestId("plain-down"));
    expect(onMove).toHaveBeenCalledWith("down");
  });
});

// React's ids differ between two renders; everything else must not.
const withoutIds = (html: string) => html.replace(/_r_[0-9a-z]+_/g, "_r_");

describe("RowActions beside a ReorderCell (SUI-FEATURE-340)", () => {
  it("AC7: renders exactly as without it, with the same controls", () => {
    const actions = () => (
      <RowActions
        rowName="Ada"
        extra={[{ label: "Copy", icon: CopyIcon, onClick: vi.fn() }]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        data-testid="actions"
      />
    );
    const plain = render(
      <Table>
        <TableBody>
          <TableRow>{actions()}</TableRow>
        </TableBody>
      </Table>,
    );
    const before = withoutIds(plain.getByTestId("actions").outerHTML);
    plain.unmount();
    render(
      <DataTableShell
        head={null}
        columnCount={2}
        isPending={false}
        isEmpty={false}
        empty=""
        loadingRowTestId="loading"
        emptyTestId="empty"
        reorder={{ onDrop: vi.fn() }}
      >
        <TableRow>
          <ReorderCell id="a" rowName="Ada" onMove={vi.fn()} />
          {actions()}
        </TableRow>
      </DataTableShell>,
    );
    const cellNode = screen.getByTestId("actions");
    expect(withoutIds(cellNode.outerHTML)).toBe(before);
    expect(within(cellNode).getAllByRole("button")).toHaveLength(3);
  });
});

type MenuEntry = { id: string; children: string[] };

const MENU: MenuEntry[] = [
  { id: "p1", children: ["p1a", "p1b"] },
  { id: "p2", children: ["p2a", "p2b"] },
  { id: "p3", children: ["p3a"] },
];

// A main menu with expanded parents as an app builds it (`SUI-FEATURE-123`): parents pass
// `children={id}`, children `group={parentId}`; ↑/↓ move an entry among its group, a drop places it
// at `groupIndex`. Each row is named by its id.
function GroupedHarness({
  onDrop,
  locks = {},
}: {
  onDrop?: (id: string, toIndex: number, groupIndex?: number) => void;
  locks?: Record<string, { up?: string; down?: string }>;
}) {
  const [menu, setMenu] = useState(MENU);
  const moved = <T,>(list: readonly T[], from: number, to: number) => {
    const next = [...list];
    const [entry] = next.splice(from, 1);
    next.splice(to, 0, entry!);
    return next;
  };
  const moveParent = (from: number, to: number) => setMenu((list) => moved(list, from, to));
  const moveChild = (parent: number, from: number, to: number) =>
    setMenu((list) =>
      list.map((entry, index) =>
        index === parent ? { ...entry, children: moved(entry.children, from, to) } : entry,
      ),
    );
  const lockProps = (id: string) => ({
    ...(locks[id]?.up === undefined ? {} : { upDisabledText: locks[id].up }),
    ...(locks[id]?.down === undefined ? {} : { downDisabledText: locks[id].down }),
  });
  const row = (
    id: string,
    cellProps: Omit<React.ComponentProps<typeof ReorderCell>, "id" | "rowName">,
  ) => (
    <TableRow key={id} data-testid={`row-${id}`}>
      <ReorderCell
        id={id}
        rowName={id}
        {...cellProps}
        {...lockProps(id)}
        data-testid={`reorder-${id}`}
      />
      <TableCell>{id}</TableCell>
    </TableRow>
  );
  return (
    <>
      <DataTableShell
        head={
          <>
            <ReorderHead />
            <TableHead>Name</TableHead>
          </>
        }
        columnCount={2}
        isPending={false}
        isEmpty={false}
        empty=""
        loadingRowTestId="loading"
        emptyTestId="empty"
        reorder={{
          onDrop: (id, toIndex, groupIndex) => {
            onDrop?.(id, toIndex, groupIndex);
            const parent = menu.findIndex((entry) => entry.id === id);
            const to = groupIndex ?? toIndex;
            if (parent !== -1) return moveParent(parent, to);
            const owner = menu.findIndex((entry) => entry.children.includes(id));
            moveChild(owner, menu[owner]!.children.indexOf(id), to);
          },
        }}
      >
        {menu.flatMap((entry, at) => [
          row(entry.id, {
            children: entry.id,
            onMove: (direction) => moveParent(at, direction === "up" ? at - 1 : at + 1),
          }),
          ...entry.children.map((child, index) =>
            row(child, {
              group: entry.id,
              onMove: (direction) =>
                moveChild(at, index, direction === "up" ? index - 1 : index + 1),
            }),
          ),
        ])}
      </DataTableShell>
      <button
        type="button"
        onClick={() =>
          setMenu((list) =>
            list.map((entry) =>
              entry.id === "p2" ? { ...entry, children: [...entry.children, "p2c"] } : entry,
            ),
          )
        }
      >
        add child
      </button>
      <output data-testid="order">
        {menu.map((entry) => [entry.id, ...entry.children].join(" ")).join(" | ")}
      </output>
    </>
  );
}

// The name cell of the row `id`.
const nameCell = (id: string) => screen.getByTestId<HTMLTableRowElement>(`row-${id}`).cells[1]!;

// A pointer drag of `id`'s grip over the row of `over`: the row that shows the drop line, then
// dropped there unless `drop` is false.
function dragRow(id: string, over: string, { drop = true } = {}) {
  fireEvent.dragStart(grip(id));
  const target = nameCell(over);
  fireEvent.dragOver(target);
  const line = document.querySelector("[data-drop]")?.getAttribute("data-reorder-id") ?? null;
  if (drop) fireEvent.drop(target);
  fireEvent.dragEnd(grip(id));
  return line;
}

describe("ReorderCell in grouped lists (SUI-FEATURE-123)", () => {
  const AFTER_P2 = "p2 p2a p2b | p1 p1a p1b | p3 p3a";

  it("AC1/AC2: dragging the first parent below the second gives the same order as ↓, children kept", () => {
    const onDrop = vi.fn();
    const { unmount } = render(<GroupedHarness onDrop={onDrop} />);
    fireEvent.click(screen.getByTestId("reorder-p1-down"));
    const byArrow = order();
    expect(byArrow).toBe(AFTER_P2);
    unmount();
    render(<GroupedHarness onDrop={onDrop} />);
    // The drop line sits after the second parent's last child.
    expect(dragRow("p1", "p2")).toBe("p2b");
    expect(cell("p2b")).not.toHaveAttribute("data-drop");
    expect(onDrop).toHaveBeenCalledWith("p1", 3, 1);
    expect(order()).toBe(byArrow);
  });

  it("AC1: foreign rows on the way are skipped, not blocking; ↑ lands before the parent", () => {
    const onDrop = vi.fn();
    render(<GroupedHarness onDrop={onDrop} />);
    expect(dragRow("p1", "p3")).toBe("p3a");
    expect(onDrop).toHaveBeenLastCalledWith("p1", 5, 2);
    expect(order()).toBe("p2 p2a p2b | p3 p3a | p1 p1a p1b");
    fireEvent.dragStart(grip("p1"));
    fireEvent.dragOver(nameCell("p2"));
    expect(cell("p2")).toHaveAttribute("data-drop", "before");
    fireEvent.drop(nameCell("p2"));
    expect(onDrop).toHaveBeenLastCalledWith("p1", 0, 0);
    expect(order()).toBe("p1 p1a p1b | p2 p2a p2b | p3 p3a");
  });

  it("AC2: a carried parent travels as a block: its children wear the outline and the preview", async () => {
    render(<GroupedHarness />);
    const setDragImage = vi.fn();
    fireEvent.dragStart(grip("p1"), {
      dataTransfer: { setData: vi.fn(), setDragImage, effectAllowed: "", dropEffect: "" },
    });
    // One outline around the block: each row marks its part of it.
    expect(cell("p1")).toHaveAttribute("data-carried", "block-first");
    expect(cell("p1a")).toHaveAttribute("data-carried", "block-middle");
    expect(cell("p1b")).toHaveAttribute("data-carried", "block-last");
    expect(cell("p2")).not.toHaveAttribute("data-carried");
    const image = setDragImage.mock.calls[0]?.[0] as HTMLTableElement;
    expect(Array.from(image.rows, (tr) => tr.textContent)).toEqual(["p1", "p1a", "p1b"]);
    fireEvent.dragEnd(grip("p1"));
    expect(document.querySelector("[data-carried]")).toBeNull();
    // The preview's copy leaves once the browser took its picture.
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(image.isConnected).toBe(false);
  });

  it("AC3: while dragging a parent, another parent's children show no drop line", () => {
    render(<GroupedHarness />);
    // Over a child the parent aims like over that child's parent: the line stays outside its block.
    expect(dragRow("p1", "p2a", { drop: false })).toBe("p2b");
    expect(dragRow("p3", "p1a", { drop: false })).toBe("p1");
    expect(cell("p1")).not.toHaveAttribute("data-drop");
    expect(dragRow("p3", "p2b", { drop: false })).toBe("p2");
  });

  it("AC7: the pointer on the second parent's last child shows the line after it; the drop moves the block", () => {
    const onDrop = vi.fn();
    render(<GroupedHarness onDrop={onDrop} />);
    expect(dragRow("p1", "p2b")).toBe("p2b");
    expect(onDrop).toHaveBeenCalledWith("p1", 3, 1);
    expect(order()).toBe(AFTER_P2);
  });

  it("a refresh that adds a child to the passed parent keeps the aim after its block (#715)", () => {
    const onDrop = vi.fn();
    render(<GroupedHarness onDrop={onDrop} />);
    fireEvent.keyDown(grip("p1"), { key: " " });
    fireEvent.keyDown(grip("p1"), { key: "ArrowDown" });
    expect(cell("p2b")).toHaveAttribute("data-drop", "after");
    fireEvent.click(screen.getByRole("button", { name: "add child" }));
    expect(cell("p2b")).not.toHaveAttribute("data-drop");
    expect(cell("p2c")).toHaveAttribute("data-drop", "after");
    fireEvent.keyDown(grip("p1"), { key: " " });
    expect(onDrop).toHaveBeenCalledWith("p1", 4, 1);
    expect(order()).toBe("p2 p2a p2b p2c | p1 p1a p1b | p3 p3a");
  });

  it("AC4: a child never leaves its parent; within it, it reorders as before", () => {
    const onDrop = vi.fn();
    render(<GroupedHarness onDrop={onDrop} />);
    expect(dragRow("p1a", "p2a")).toBeNull();
    expect(dragRow("p1a", "p2")).toBeNull();
    expect(dragRow("p1a", "p1")).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
    expect(dragRow("p1a", "p1b")).toBe("p1b");
    expect(onDrop).toHaveBeenCalledWith("p1a", 2, 1);
    expect(order()).toBe("p1 p1b p1a | p2 p2a p2b | p3 p3a");
    // By keyboard the child stops at its parent's edge.
    fireEvent.keyDown(grip("p1a"), { key: " " });
    fireEvent.keyDown(grip("p1a"), { key: "ArrowDown" });
    expect(document.querySelector("[data-drop]")).toBeNull();
    expect(screen.getByTestId("reorder-live")).toHaveTextContent(
      "p1a cannot move further down at this level.",
    );
  });

  it("AC5: ↓, Space on a parent gives the drag's result; a step passes one parent with its children", () => {
    const onDrop = vi.fn();
    render(<GroupedHarness onDrop={onDrop} />);
    const live = screen.getByTestId("reorder-live");
    fireEvent.keyDown(grip("p1"), { key: " " });
    expect(live).toHaveTextContent("p1 picked up, position 1 of 3 at this level.");
    fireEvent.keyDown(grip("p1"), { key: "ArrowDown" });
    expect(cell("p2b")).toHaveAttribute("data-drop", "after");
    expect(live).toHaveTextContent("p1: position 2 of 3 at this level.");
    fireEvent.keyDown(grip("p1"), { key: "ArrowDown" });
    expect(cell("p3a")).toHaveAttribute("data-drop", "after");
    expect(live).toHaveTextContent("p1: position 3 of 3 at this level.");
    fireEvent.keyDown(grip("p1"), { key: "ArrowUp" });
    fireEvent.keyDown(grip("p1"), { key: " " });
    expect(onDrop).toHaveBeenCalledWith("p1", 3, 1);
    expect(order()).toBe(AFTER_P2);
  });

  it("AC5: a child's carry counts the positions among its parent's children", () => {
    render(<GroupedHarness />);
    fireEvent.keyDown(grip("p2b"), { key: " " });
    expect(screen.getByTestId("reorder-live")).toHaveTextContent(
      "p2b picked up, position 2 of 2 at this level.",
    );
  });

  it("AC6: direction locks bind as before and skip no rows", () => {
    const onDrop = vi.fn();
    render(
      <GroupedHarness
        onDrop={onDrop}
        locks={{ p2: { up: "Pinned below the first.", down: "Pinned above the last." } }}
      />,
    );
    expect(dragRow("p2", "p1")).toBeNull();
    expect(dragRow("p2", "p3")).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
    fireEvent.keyDown(grip("p2"), { key: " " });
    fireEvent.keyDown(grip("p2"), { key: "ArrowDown" });
    expect(screen.getByTestId("reorder-live")).toHaveTextContent("Pinned above the last.");
    fireEvent.keyDown(grip("p2"), { key: "ArrowUp" });
    expect(screen.getByTestId("reorder-live")).toHaveTextContent("Pinned below the first.");
    expect(document.querySelector("[data-drop]")).toBeNull();
  });
});
