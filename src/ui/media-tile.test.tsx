import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
