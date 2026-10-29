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
