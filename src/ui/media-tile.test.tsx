import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TileGridShell } from "../list/tile-grid-shell.js";
import { useRowGrid } from "../list/use-row-grid.js";
import { MediaTile, type MediaTileProps } from "./media-tile.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderTile(props: Partial<MediaTileProps> = {}) {
  const onOpen = vi.fn();
  render(
    <MediaTile kind="image" src="hero.jpg" name="hero.jpg" tags={[]} onOpen={onOpen} {...props} />,
  );
  return { onOpen, tile: screen.getByTestId("media-tile") };
}

const preview = (tile: HTMLElement) =>
  tile.querySelector<HTMLElement>("[data-slot=media-tile-preview]")!;

describe("MediaTile", () => {
  // AC 1
  it("an image shows its preview cropped edge to edge at a fixed height", () => {
    const { tile } = renderTile();
    const img = preview(tile).querySelector("img")!;
    expect(img).toHaveAttribute("src", "hero.jpg");
    expect(img).toHaveClass("size-full", "object-cover");
    expect(preview(tile)).toHaveClass("h-32", "w-full");
  });

  it("a PDF shows the text icon and PDF, muted", () => {
    const { tile } = renderTile({
      kind: "pdf",
      src: undefined,
      name: "brochure.pdf",
      extension: "pdf",
    });
    expect(preview(tile).querySelector("img")).toBeNull();
    expect(preview(tile).querySelector("svg")).toHaveClass("lucide-file-text");
    expect(preview(tile)).toHaveTextContent(/^PDF$/);
    expect(preview(tile)).toHaveClass("text-muted-foreground");
  });

  it("a video shows the video icon and its extension, even with a src", () => {
    const { tile } = renderTile({
      kind: "video",
      src: "intro.mp4",
      name: "intro.mp4",
      extension: "mp4",
    });
    expect(preview(tile).querySelector("img")).toBeNull();
    expect(preview(tile).querySelector("svg")).toHaveClass("lucide-file-video");
    expect(preview(tile)).toHaveTextContent("MP4");
  });

  // AC 2
  it("without description and tags only preview and name remain", () => {
    const { tile } = renderTile();
    const body = preview(tile).nextElementSibling!;
    expect(body.children).toHaveLength(1);
    expect(body).toHaveTextContent(/^hero\.jpg$/);
    expect(tile).not.toHaveAttribute("aria-describedby");
  });

  it("description on at most two muted lines, tags as outline badges that wrap", () => {
    const { tile } = renderTile({ description: "The team on the roof", tags: ["team", "roof"] });
    const description = screen.getByText("The team on the roof");
    expect(description).toHaveClass("line-clamp-2", "text-xs", "text-muted-foreground");
    const badges = screen.getAllByText(/^(team|roof)$/);
    expect(badges).toHaveLength(2);
    for (const badge of badges) expect(badge).toHaveAttribute("data-variant", "outline");
    expect(badges[0]!.parentElement).toHaveClass("flex", "flex-wrap", "gap-1");
    expect(tile).toHaveAccessibleName("hero.jpg");
    expect(tile).toHaveAccessibleDescription("The team on the roof team roof");
  });

  // AC 3
  it("a long name is truncated with an ellipsis and shown whole in the tooltip", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains("truncate") ? 200 : 100;
    });
    const name = "a-very-long-file-name-from-the-summer-campaign-2026-final-version.jpg";
    renderTile({ name });
    const label = screen.getByText(name);
    expect(label).toHaveClass("truncate");
    fireEvent.pointerMove(label, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(document.querySelector("[data-slot=tooltip-content]")).toHaveTextContent(name);
  });

  // AC 4
  it("click and Enter call onOpen; it is a tab stop with the package focus ring", () => {
    const { onOpen, tile } = renderTile();
    expect(tile.tagName).toBe("BUTTON");
    expect(tile).toHaveAttribute("type", "button");
    expect(tile).not.toHaveAttribute("tabindex", "-1");
    expect(tile).toHaveClass("focus-visible:focus-ring");
    fireEvent.click(tile);
    // A native button turns Enter into a click.
    tile.focus();
    expect(tile).toHaveFocus();
    fireEvent.click(tile, { detail: 0 });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("selected shows the selection ring and is pressed; without it the tile is no choice", () => {
    const { tile } = renderTile({ selected: true });
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(tile.querySelector("[data-slot=media-tile-selection]")).toHaveClass(
      "ring-2",
      "ring-primary",
    );
    cleanup();
    const plain = renderTile().tile;
    expect(plain).not.toHaveAttribute("aria-pressed");
    expect(plain.querySelector("[data-slot=media-tile-selection]")).toBeNull();
    cleanup();
    const unselected = renderTile({ selected: false }).tile;
    expect(unselected).toHaveAttribute("aria-pressed", "false");
    expect(unselected.querySelector("[data-slot=media-tile-selection]")).toBeNull();
  });
});

// SUI-FEATURE-084: a tile as an entry of the grid `TileGridShell` holds.
type GridTile = Pick<MediaTileProps, "name" | "onOpen" | "onDelete" | "selected">;

function GridTiles({ tiles }: { tiles: GridTile[] }) {
  const { gridProps, rowProps } = useRowGrid();
  return (
    <TileGridShell
      isPending={false}
      isEmpty={false}
      loadingTestId="tiles-loading"
      emptyTestId="tiles-empty"
      gridProps={gridProps}
    >
      {tiles.map((tile) => (
        <MediaTile key={tile.name} kind="pdf" tags={[]} rowProps={rowProps} {...tile} />
      ))}
    </TileGridShell>
  );
}

describe("MediaTile in a keyboard grid (SUI-FEATURE-084)", () => {
  const tiles = () => screen.getAllByTestId("media-tile");

  // AC 1
  it("↓/↑ move between the tiles, one tab stop; Delete and Backspace call onDelete once", () => {
    const handlers = ["a", "b", "c"].map((name) => ({
      name,
      onOpen: vi.fn(),
      onDelete: vi.fn(),
    }));
    render(<GridTiles tiles={handlers} />);
    expect(tiles().map((tile) => tile.tabIndex)).toEqual([0, -1, -1]);
    tiles()[0]!.focus();
    fireEvent.keyDown(tiles()[0]!, { key: "ArrowDown" });
    expect(tiles()[1]).toHaveFocus();
    expect(tiles().map((tile) => tile.tabIndex)).toEqual([-1, 0, -1]);
    fireEvent.keyDown(tiles()[1]!, { key: "Delete" });
    expect(handlers[1]!.onDelete).toHaveBeenCalledOnce();
    fireEvent.keyDown(tiles()[1]!, { key: "ArrowUp" });
    expect(tiles()[0]).toHaveFocus();
    fireEvent.keyDown(tiles()[0]!, { key: "Backspace" });
    expect(handlers[0]!.onDelete).toHaveBeenCalledOnce();
    expect(handlers[2]!.onDelete).not.toHaveBeenCalled();
    // The button opens on its own; the entry adds no second open.
    fireEvent.click(tiles()[0]!);
    expect(handlers[0]!.onOpen).toHaveBeenCalledOnce();
  });

  // AC 2
  it("without onDelete Delete and Backspace do nothing; the picker tile stays a pressed button", () => {
    const onOpen = vi.fn();
    render(<GridTiles tiles={[{ name: "a", onOpen, selected: true }]} />);
    const [tile] = tiles();
    tile!.focus();
    const delivered = fireEvent.keyDown(tile!, { key: "Delete" });
    expect(delivered).toBe(true);
    expect(tile!.tagName).toBe("BUTTON");
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(onOpen).not.toHaveBeenCalled();
  });

  // AC 3
  it("without onOpen and onDelete: no button, no tab stop, no hover, skipped by the arrows", () => {
    render(
      <GridTiles
        tiles={[{ name: "a", onOpen: vi.fn() }, { name: "b" }, { name: "c", onOpen: vi.fn() }]}
      />,
    );
    const bare = tiles()[1]!;
    expect(bare.tagName).toBe("DIV");
    expect(bare).toHaveAttribute("role", "group");
    expect(bare).toHaveAccessibleName("b");
    expect(bare.querySelector("button, [role=button]")).toBeNull();
    expect(bare).not.toHaveAttribute("tabindex");
    expect(bare).not.toHaveAttribute("data-grid-item");
    expect(bare).not.toHaveClass("cursor-pointer");
    expect(bare.className).not.toMatch(/hover:/);
    tiles()[0]!.focus();
    fireEvent.keyDown(tiles()[0]!, { key: "ArrowDown" });
    expect(tiles()[2]).toHaveFocus();
  });

  it("with only onDelete: a focusable grid entry, no button, no hover; Delete reaches it", () => {
    const onDelete = vi.fn();
    render(
      <GridTiles
        tiles={[
          { name: "a", onOpen: vi.fn() },
          { name: "b", onDelete },
        ]}
      />,
    );
    const deleteOnly = tiles()[1]!;
    expect(deleteOnly.tagName).toBe("DIV");
    expect(deleteOnly).toHaveAttribute("role", "group");
    expect(deleteOnly).toHaveAttribute("data-grid-item");
    expect(deleteOnly).not.toHaveClass("cursor-pointer");
    expect(deleteOnly.className).not.toMatch(/hover:/);
    tiles()[0]!.focus();
    fireEvent.keyDown(tiles()[0]!, { key: "ArrowDown" });
    expect(deleteOnly).toHaveFocus();
    fireEvent.keyDown(deleteOnly, { key: "Enter" });
    fireEvent.keyDown(deleteOnly, { key: "Delete" });
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("with onOpen nothing changes: the button with its hover and pointer", () => {
    render(<GridTiles tiles={[{ name: "a", onOpen: vi.fn() }]} />);
    const [tile] = tiles();
    expect(tile!.tagName).toBe("BUTTON");
    expect(tile).toHaveClass("cursor-pointer", "hover:border-ring");
  });

  it("a grid entry draws the inset focus ring, over the preview; outside a grid the outer one", () => {
    render(<GridTiles tiles={[{ name: "a", onOpen: vi.fn() }]} />);
    const [tile] = tiles();
    expect(tile).toHaveClass("focus-visible:focus-ring-inset");
    expect(tile).not.toHaveClass("focus-visible:focus-ring");
    expect(tile!.querySelector("[data-slot=media-tile-focus]")).toHaveClass(
      "ring-inset",
      "group-focus-visible/tile:block",
    );
    cleanup();
    const plain = renderTile().tile;
    expect(plain).toHaveClass("focus-visible:focus-ring");
    expect(plain.querySelector("[data-slot=media-tile-focus]")).toBeNull();
  });

  it("selected without onOpen is no choice: no ring, not pressed", () => {
    render(<MediaTile kind="pdf" name="a.pdf" tags={[]} selected />);
    const tile = screen.getByTestId("media-tile");
    expect(tile).not.toHaveAttribute("aria-pressed");
    expect(tile).not.toHaveAttribute("data-selected");
    expect(tile.querySelector("[data-slot=media-tile-selection]")).toBeNull();
  });
});
