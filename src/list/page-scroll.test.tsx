import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageScroll } from "./page-scroll.js";

// jsdom has no layout, so the overflow is faked per element; the gallery measures the real one.
function fakeWidths(el: HTMLElement, scrollWidth: number, clientWidth: number): void {
  Object.defineProperty(el, "scrollWidth", { configurable: true, get: () => scrollWidth });
  Object.defineProperty(el, "clientWidth", { configurable: true, get: () => clientWidth });
}

async function nextFrame(): Promise<void> {
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

function Page({ wide, className }: { wide: boolean; className: string }) {
  return (
    <PageScroll>
      <div className={className} data-testid="scroller">
        <span>a</span>
        {wide ? <span>wide</span> : null}
      </div>
    </PageScroll>
  );
}

describe("PageScroll", () => {
  it("marks a horizontal scroller while it overflows and unmarks it in the next frame after", async () => {
    const view = render(<Page wide={false} className="overflow-x-auto" />);
    const scroller = screen.getByTestId("scroller");
    expect(scroller).not.toHaveAttribute("data-overflow-x");

    fakeWidths(scroller, 900, 400);
    view.rerender(<Page wide className="overflow-x-auto" />);
    await nextFrame();
    expect(scroller).toHaveAttribute("data-overflow-x", "");

    fakeWidths(scroller, 400, 400);
    view.rerender(<Page wide={false} className="overflow-x-auto" />);
    await nextFrame();
    expect(scroller).not.toHaveAttribute("data-overflow-x");
  });

  it("ignores a vertical-only scroller", async () => {
    const view = render(<Page wide={false} className="overflow-y-auto" />);
    const scroller = screen.getByTestId("scroller");
    fakeWidths(scroller, 900, 400);
    view.rerender(<Page wide className="overflow-y-auto" />);
    await nextFrame();
    expect(scroller).not.toHaveAttribute("data-overflow-x");
  });
});
