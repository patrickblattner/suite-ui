import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND, SLIDE_DECK, SLIDE_MISSING_FONT } from "../../gallery/slide-showcase.js";
import * as React from "react";

import { SlidePlayer } from "./slide-player.js";
import { SlideView, type SlideViewProps } from "./slide-view.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// A deck whose master animates one element and whose first page lacks a font, with a second page.
const missingFontPage = SLIDE_MISSING_FONT.pages[0]!;
const masterDeck = {
  ...SLIDE_DECK,
  masters: [
    {
      id: "master",
      name: "Master",
      elements: [
        {
          id: "logo",
          type: "shape",
          shape: "rectangle",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          animation: { entrance: { effect: "fade", duration: 100, order: 1 } },
        },
      ],
    },
  ],
  layouts: [{ id: "layout", name: "Layout", masterId: "master" }],
  pages: [
    { ...missingFontPage, id: "one", layoutId: "layout" },
    { ...missingFontPage, id: "two", elements: [] },
  ],
} as SlideViewProps["document"];

const key = (player: HTMLElement, name: string) => fireEvent.keyDown(player, { key: name });

describe("SlidePlayer", () => {
  it("is one modal dialog with one name", () => {
    render(<SlidePlayer document={SLIDE_DECK} brand={SLIDE_BRAND} data-testid="player" />);
    const player = screen.getByRole("dialog", { name: "Presentation" });
    expect(player).toHaveAttribute("aria-modal", "true");
    expect(player).not.toHaveAttribute("aria-roledescription");
  });

  it("starts past the end on the last shown page, on a hidden one at the next shown", () => {
    render(
      <SlidePlayer document={SLIDE_DECK} brand={SLIDE_BRAND} startPage={9} data-testid="player" />,
    );
    expect(screen.getByTestId("player")).toHaveAttribute("data-slide-page", "second");
    cleanup();
    render(
      <SlidePlayer document={SLIDE_DECK} brand={SLIDE_BRAND} startPage={1} data-testid="player" />,
    );
    expect(screen.getByTestId("player")).toHaveAttribute("data-slide-page", "second");
  });
});

// Review #292: a master's or layout's animations play on the page's steps, not at step 0.
describe("SlideView master animations", () => {
  it("keeps an animated master element hidden until its step", async () => {
    const page = SLIDE_DECK.pages[2]!;
    const document = {
      ...SLIDE_DECK,
      masters: [
        {
          id: "master",
          name: "Master",
          elements: [
            {
              id: "logo",
              type: "shape",
              shape: "rectangle",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              animation: { entrance: { effect: "fade", duration: 100, order: 1 } },
            },
          ],
        },
      ],
      layouts: [{ id: "layout", name: "Layout", masterId: "master" }],
      pages: [{ ...page, layoutId: "layout" }],
    } as SlideViewProps["document"];
    const { container } = render(
      <SlideView
        document={document}
        brand={SLIDE_BRAND}
        scale={0.25}
        animationStep={0}
        data-testid="view"
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("view")).toHaveAttribute("data-slide-ready", "true"),
    );
    const logo = container.querySelector<HTMLElement>("[data-slide-element=logo] > div")!;
    expect(logo.style.visibility).toBe("hidden");
  });
});

// Review #292 r2: the steps and the hint, each pinned.
describe("SlidePlayer steps and hint", () => {
  it("gives a master's animation a step of its own", () => {
    render(<SlidePlayer document={masterDeck} brand={SLIDE_BRAND} data-testid="player" />);
    const player = screen.getByTestId("player");
    key(player, "ArrowRight");
    expect(player).toHaveAttribute("data-slide-page", "one");
    expect(player).toHaveAttribute("data-slide-step", "1");
    key(player, "ArrowRight");
    expect(player).toHaveAttribute("data-slide-page", "two");
  });

  it("tells the app once per page, also when the page comes back", async () => {
    const onReport = vi.fn();
    render(
      <SlidePlayer
        document={masterDeck}
        brand={SLIDE_BRAND}
        onReport={onReport}
        data-testid="player"
      />,
    );
    const player = screen.getByTestId("player");
    await waitFor(() => expect(onReport).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status", { hidden: true })).toBeTruthy();
    key(player, "ArrowRight");
    key(player, "ArrowRight");
    await waitFor(() => expect(player).toHaveAttribute("data-slide-page", "two"));
    key(player, "ArrowLeft");
    await waitFor(() => expect(player).toHaveAttribute("data-slide-page", "one"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    // Page two has no problem; page one, shown again, is not told twice.
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport.mock.calls.map(([, page]) => page as number)).toEqual([0]);
  });

  it("names text that does not fit in the presenter's hint", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(50);
    render(<SlidePlayer document={SLIDE_DECK} brand={SLIDE_BRAND} fitText data-testid="player" />);
    await waitFor(() =>
      expect(document.querySelector("[data-slot=slide-player-hint]")).toHaveTextContent(
        "Text doesn’t fit its box: first-title",
      ),
    );
  });

  it("leaves Enter on a focused Previous to the button, never paging on", () => {
    render(<SlidePlayer document={SLIDE_DECK} brand={SLIDE_BRAND} data-testid="player" />);
    const player = screen.getByTestId("player");
    key(player, "ArrowRight");
    const previous = screen.getByRole("button", { name: "Previous slide" });
    previous.focus();
    fireEvent.keyDown(previous, { key: "Enter" });
    expect(player).toHaveAttribute("data-slide-step", "1");
    fireEvent.click(previous);
    expect(player).toHaveAttribute("data-slide-step", "0");
  });

  it("keeps a locked Next focusable and inert", () => {
    render(
      <SlidePlayer document={SLIDE_DECK} brand={SLIDE_BRAND} startPage={2} data-testid="player" />,
    );
    const next = screen.getByRole("button", { name: "Next slide" });
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).not.toBeDisabled();
    fireEvent.click(next);
    expect(screen.getByTestId("player")).toHaveAttribute("data-slide-page", "second");
  });

  it("leaves the focus where the app put it on close", async () => {
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    function Host() {
      const [open, setOpen] = React.useState(true);
      return open ? (
        <SlidePlayer
          document={SLIDE_DECK}
          brand={SLIDE_BRAND}
          onClose={() => {
            elsewhere.focus();
            setOpen(false);
          }}
        />
      ) : null;
    }
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "End presentation" }));
    await act(() => Promise.resolve());
    expect(elsewhere).toHaveFocus();
    elsewhere.remove();
  });
});

// Codex #309 CX1: a deck whose pages are all hidden shows none of them.
describe("SlidePlayer with every page hidden", () => {
  it("draws no page and counts 0 / 0", () => {
    const hidden = {
      ...SLIDE_DECK,
      pages: SLIDE_DECK.pages.map((page) => ({ ...page, hidden: true })),
    } as SlideViewProps["document"];
    render(<SlidePlayer document={hidden} brand={SLIDE_BRAND} data-testid="player" />);
    const player = screen.getByTestId("player");
    expect(player.querySelector("[data-slot=slide-view]")).toBeNull();
    expect(screen.queryByText("First slide")).toBeNull();
    expect(screen.getByTestId("slide-player-counter")).toHaveTextContent("0 / 0");
    expect(screen.getByRole("button", { name: "Next slide" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
