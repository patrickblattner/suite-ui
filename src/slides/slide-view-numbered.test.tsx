import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveSlideMedia,
  SLIDE_BRAND,
  SLIDE_SERIF_FONTS,
  SLIDE_SHOWCASE,
} from "../../gallery/slide-showcase.js";
import { SlideExport } from "./slide-export.js";
import { SlidePlayer } from "./slide-player.js";
import { SlideView, type SlideViewProps, type SlideViewReport } from "./slide-view.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const onlyPage = (elements: unknown[]) =>
  ({
    ...SLIDE_SHOWCASE,
    pages: [{ ...SLIDE_SHOWCASE.pages[0]!, elements }],
  }) as SlideViewProps["document"];

async function drawn(props: Partial<SlideViewProps> = {}) {
  const onReport = vi.fn<(report: SlideViewReport) => void>();
  const view = render(
    <SlideView
      document={SLIDE_SHOWCASE}
      brand={SLIDE_BRAND}
      fonts={SLIDE_SERIF_FONTS}
      resolveMedia={resolveSlideMedia}
      scale={1}
      onReport={onReport}
      data-testid="view"
      {...props}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId("view")).toHaveAttribute("data-slide-ready", "true"),
  );
  return { ...view, report: () => onReport.mock.lastCall![0] };
}

const serif = { kind: "free", family: "Gallery Slide Serif" } as const;
const accent = { kind: "brand", key: "accent" } as const;
const list = (text: string, numbered?: unknown, extra: Record<string, unknown> = {}) => ({
  id: "l",
  type: "text",
  x: 0,
  y: 0,
  width: 900,
  height: 600,
  list: "numbered",
  runs: [{ text, size: 58, font: { kind: "brand", key: "body" } }],
  ...(numbered === undefined ? {} : { numbered }),
  ...extra,
});
const field = () => document.querySelector<HTMLElement>('[data-slide-element="l"]')!;
const markers = () =>
  [...field().querySelectorAll<HTMLElement>("[data-slide-marker]")].map((one) => one.textContent);

// SUI-FEATURE-124: a styled numbered list on a text field.
describe("SlideView styled numbered list", () => {
  // AC1: numbers count up from `start`, bare (no period); the list's own numbers read the same.
  it("counts from start without a period, and closes up when an entry goes", async () => {
    const view = await drawn({ document: onlyPage([list("One\nTwo\nThree", { start: 4 })]) });
    expect(markers()).toEqual(["4", "5", "6"]);
    const ol = field().querySelector("ol")!;
    expect(ol.getAttribute("start")).toBe("4");
    expect([...ol.querySelectorAll("li")].map((li) => li.getAttribute("value"))).toEqual([
      "4",
      "5",
      "6",
    ]);
    // The drawn numbers are hidden from a screen reader, which reads the list's own.
    for (const marker of field().querySelectorAll("[data-slide-marker]"))
      expect(marker).toHaveAttribute("aria-hidden", "true");
    view.rerender(
      <SlideView
        document={onlyPage([list("One\nThree", { start: 4 })])}
        brand={SLIDE_BRAND}
        fonts={SLIDE_SERIF_FONTS}
        resolveMedia={resolveSlideMedia}
        scale={1}
        data-testid="view"
      />,
    );
    expect(markers()).toEqual(["4", "5"]);
  });

  it("starts at 1 by default and takes 0", async () => {
    await drawn({ document: onlyPage([list("A\nB", {})]) });
    expect(markers()).toEqual(["1", "2"]);
    cleanup();
    await drawn({ document: onlyPage([list("A\nB", { start: 0 })]) });
    expect(markers()).toEqual(["0", "1"]);
  });

  // AC2–AC4 as styles (jsdom lays nothing out; the gallery measures them): an own number column as
  // wide as the widest number (max-content, shared by every entry through a subgrid), text at column
  // + markerGap on every line, entryGap between entries, number and first line on one baseline.
  it("lays the numbers out in their own column with the gaps, marker style its own", async () => {
    await drawn({
      document: onlyPage([
        list("First\nSecond", {
          start: 9,
          marker: { font: serif, size: 117, color: accent, weight: 700 },
          markerGap: 75,
          entryGap: 25,
        }),
      ]),
    });
    const ol = field().querySelector<HTMLElement>("ol")!;
    expect(ol.style.display).toBe("grid");
    expect(ol.style.gridTemplateColumns).toBe("max-content minmax(0, 1fr)");
    expect(ol.style.columnGap).toBe("calc(var(--slide-fit, 1) * 75px)");
    expect(ol.style.rowGap).toBe("calc(var(--slide-fit, 1) * 25px)");
    expect(ol.style.listStyleType).toBe("none");
    for (const li of ol.querySelectorAll<HTMLElement>("li")) {
      expect(li.style.gridTemplateColumns).toBe("subgrid");
      expect(li.style.gridColumn).toBe("1 / -1");
      expect(li.style.alignItems).toBe("baseline");
    }
    const marker = ol.querySelector<HTMLElement>("[data-slide-marker]")!;
    expect(marker.style.fontSize).toBe("calc(var(--slide-fit, 1) * 117px)");
    expect(marker.style.fontFamily).toContain("Gallery Slide Serif");
    expect(marker.style.fontWeight).toBe("700");
    expect(marker.style.textAlign).toBe("left");
    expect(marker.style.color).not.toBe("");
    expect(markers()).toEqual(["9", "10"]);
    // The entry text keeps its own size.
    expect(screen.getByText("First").style.fontSize).toBe("calc(var(--slide-fit, 1) * 58px)");
  });

  it("takes absent marker fields from the entry's first run", async () => {
    await drawn({
      document: onlyPage([
        {
          ...list("", {}),
          runs: [
            {
              text: "Serif\n",
              size: 40,
              font: serif,
              weight: 600,
              fill: { type: "color", color: accent },
            },
            { text: "Body", size: 20, font: { kind: "brand", key: "body" } },
          ],
        },
      ]),
    });
    const [first, second] = [...field().querySelectorAll<HTMLElement>("[data-slide-marker]")];
    expect(first!.style.fontSize).toBe("calc(var(--slide-fit, 1) * 40px)");
    expect(first!.style.fontFamily).toContain("Gallery Slide Serif");
    expect(first!.style.fontWeight).toBe("600");
    expect(second!.style.fontSize).toBe("calc(var(--slide-fit, 1) * 20px)");
    expect(second!.style.fontFamily).toContain("Gallery Slide Sans");
    expect(second!.style.fontWeight).toBe("400");
    expect(first!.style.color).not.toBe(second!.style.color);
    // markerGap absent: half the largest number size.
    expect(field().querySelector<HTMLElement>("ol")!.style.columnGap).toBe(
      "calc(var(--slide-fit, 1) * 20px)",
    );
  });

  // AC8 (rev 4): `numbered: {}` with a 40 px marker → the text 20 px after the column (0.5 em of the
  // marker), entries only the line spacing apart.
  it("defaults markerGap to half the marker size and entryGap to 0", async () => {
    await drawn({
      document: onlyPage([{ ...list("A\nB", {}), runs: [{ text: "A\nB", size: 40 }] }]),
    });
    const ol = field().querySelector<HTMLElement>("ol")!;
    expect(ol.style.columnGap).toBe("calc(var(--slide-fit, 1) * 20px)");
    expect(ol.style.rowGap).toBe("calc(var(--slide-fit, 1) * 0px)");
    cleanup();
    await drawn({ document: onlyPage([list("A\nB", { marker: { size: 40 } })]) });
    expect(field().querySelector<HTMLElement>("ol")!.style.columnGap).toBe(
      "calc(var(--slide-fit, 1) * 20px)",
    );
  });

  // Review #727 (SUI-FEATURE-180): the numbers' font and weight are fonts the page needs; one without a
  // file, or a brand key the set lacks, is named as missing.
  it("names a missing marker font, face or brand key", async () => {
    const missingKey = await drawn({
      document: onlyPage([list("A", { marker: { font: { kind: "brand", key: "nope" } } })]),
    });
    expect(missingKey.report().missingFonts).toContain("nope");
    cleanup();
    const missingFace = await drawn({
      document: onlyPage([list("A", { marker: { font: serif, weight: 900 } })]),
    });
    expect(missingFace.report().missingFaces).toContainEqual(
      expect.objectContaining({ family: "Gallery Slide Serif", weight: 900 }),
    );
    cleanup();
    const served = await drawn({ document: onlyPage([list("A", { marker: { font: serif } })]) });
    expect(served.report().missingFonts).toEqual([]);
  });

  it("is ignored on a list that is not numbered", async () => {
    await drawn({ document: onlyPage([list("A\nB", { start: 4 }, { list: "bullet" })]) });
    expect(field().querySelector("ul")).not.toBeNull();
    expect(markers()).toEqual([]);
  });

  // Text fit (SUI-FEATURE-181): the marker's size counts toward the set size, so one factor steps
  // the 117 px number in whole pixels; marker, gaps and runs all scale by it (`--slide-fit`).
  it("steps text fit from the marker's size when it is the largest", async () => {
    const computed = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
      const style = computed(element, pseudo);
      const fit = (node: Element | null) =>
        node instanceof HTMLElement ? node.style.getPropertyValue("--slide-fit") : "";
      if (fit(element) !== "") style.height = "100px";
      else if (fit(element.parentElement) !== "") {
        const factor = Number(fit(element.parentElement));
        // Fits once the number is at 100 px or less.
        style.height = `${117 * factor > 100 ? 200 : 50}px`;
      }
      return style;
    });
    await drawn({
      document: onlyPage([list("One", { marker: { size: 117 }, markerGap: 75 })]),
      fitText: true,
    });
    const factor = Number(
      field()
        .querySelector<HTMLElement>("ol")!
        .parentElement!.parentElement!.style.getPropertyValue("--slide-fit"),
    );
    expect(factor * 117).toBeCloseTo(100, 9);
  });

  // AC5: `list: "numbered"` without `numbered` draws byte-identical to the previous version (the
  // markup below was taken from v0.200.1, before `numbered` existed).
  it("draws a list without numbered exactly as before", async () => {
    await drawn({
      document: onlyPage([
        list("One\nTwo wraps\nThree"),
        { ...list("Bullet\nList"), id: "b", list: "bullet" },
        { ...list("Plain\nText"), id: "p", list: "none" },
      ]),
    });
    const page = screen.getByTestId("view");
    const html = ["l", "b", "p"]
      .map((id) => page.querySelector(`[data-slide-element="${id}"]`)!.outerHTML)
      .join("\n");
    expect(html).toMatchInlineSnapshot(`
      "<div data-slide-element="l" data-slide-type="text" style="position: absolute; left: 0px; top: 0px; width: 900px; height: 600px; z-index: 0; opacity: 1;"><div style="position: relative; width: 100%; height: 100%;"><div style="text-align: left; line-height: 1.2; white-space: pre-wrap; overflow-wrap: break-word; display: flex; flex-direction: column; justify-content: flex-start; width: 100%; height: 100%; --slide-fit: 1;"><div><ol style="margin: 0px; padding-left: 1.2em; list-style-type: decimal;"><li style="font-size: calc(var(--slide-fit, 1) * 58px); font-family: &quot;Gallery Slide Sans&quot;;"><span style="font-family: &quot;Gallery Slide Sans&quot;; font-size: calc(var(--slide-fit, 1) * 58px); font-weight: 400; font-style: normal; color: rgb(15, 23, 42);">One</span></li><li style="font-size: calc(var(--slide-fit, 1) * 58px); font-family: &quot;Gallery Slide Sans&quot;;"><span style="font-family: &quot;Gallery Slide Sans&quot;; font-size: calc(var(--slide-fit, 1) * 58px); font-weight: 400; font-style: normal; color: rgb(15, 23, 42);">Two wraps</span></li><li style="font-size: calc(var(--slide-fit, 1) * 58px); font-family: &quot;Gallery Slide Sans&quot;;"><span style="font-family: &quot;Gallery Slide Sans&quot;; font-size: calc(var(--slide-fit, 1) * 58px); font-weight: 400; font-style: normal; color: rgb(15, 23, 42);">Three</span></li></ol></div></div></div></div>
      <div data-slide-element="b" data-slide-type="text" style="position: absolute; left: 0px; top: 0px; width: 900px; height: 600px; z-index: 1; opacity: 1;"><div style="position: relative; width: 100%; height: 100%;"><div style="text-align: left; line-height: 1.2; white-space: pre-wrap; overflow-wrap: break-word; display: flex; flex-direction: column; justify-content: flex-start; width: 100%; height: 100%; --slide-fit: 1;"><div><ul style="margin: 0px; padding-left: 1.2em; list-style-type: disc;"><li style="font-size: calc(var(--slide-fit, 1) * 58px); font-family: &quot;Gallery Slide Sans&quot;;"><span style="font-family: &quot;Gallery Slide Sans&quot;; font-size: calc(var(--slide-fit, 1) * 58px); font-weight: 400; font-style: normal; color: rgb(15, 23, 42);">Bullet</span></li><li style="font-size: calc(var(--slide-fit, 1) * 58px); font-family: &quot;Gallery Slide Sans&quot;;"><span style="font-family: &quot;Gallery Slide Sans&quot;; font-size: calc(var(--slide-fit, 1) * 58px); font-weight: 400; font-style: normal; color: rgb(15, 23, 42);">List</span></li></ul></div></div></div></div>
      <div data-slide-element="p" data-slide-type="text" style="position: absolute; left: 0px; top: 0px; width: 900px; height: 600px; z-index: 2; opacity: 1;"><div style="position: relative; width: 100%; height: 100%;"><div style="text-align: left; line-height: 1.2; white-space: pre-wrap; overflow-wrap: break-word; display: flex; flex-direction: column; justify-content: flex-start; width: 100%; height: 100%; --slide-fit: 1;"><div><p style="margin: 0px; font-size: calc(var(--slide-fit, 1) * 58px); font-family: &quot;Gallery Slide Sans&quot;;"><span style="font-family: &quot;Gallery Slide Sans&quot;; font-size: calc(var(--slide-fit, 1) * 58px); font-weight: 400; font-style: normal; color: rgb(15, 23, 42);">Plain</span></p><p style="margin: 0px; font-size: calc(var(--slide-fit, 1) * 58px); font-family: &quot;Gallery Slide Sans&quot;;"><span style="font-family: &quot;Gallery Slide Sans&quot;; font-size: calc(var(--slide-fit, 1) * 58px); font-weight: 400; font-style: normal; color: rgb(15, 23, 42);">Text</span></p></div></div></div></div>"
    `);
  });
});

// SUI-DESIGN-002 rev 9 AC6 (#731): a U+2028 breaks the line inside its paragraph: under one number in
// a numbered list, inside one item of a bullet list, inside one paragraph of plain text.
describe("SlideView line break inside a paragraph", () => {
  const entries = (id: string) =>
    [...document.querySelectorAll(`[data-slide-element="${id}"] li`)].map((li) => ({
      text: li.textContent,
      breaks: li.querySelectorAll("br").length,
    }));

  it("draws A and B on two lines under one number, the following numbers unchanged", async () => {
    await drawn({ document: onlyPage([list("A\u2028B\nNext\nLast", { start: 1 })]) });
    expect(markers()).toEqual(["1", "2", "3"]);
    expect(entries("l")).toEqual([
      { text: "1AB", breaks: 1 },
      { text: "2Next", breaks: 0 },
      { text: "3Last", breaks: 0 },
    ]);
    // The new line lies in the entry's text, the column after the number: it hangs at the text's x.
    const [first] = field().querySelectorAll("li");
    const text = first!.querySelector(":scope > div")!;
    expect(text.querySelector("br")).not.toBeNull();
    expect(first!.querySelector("[data-slide-marker]")!.querySelector("br")).toBeNull();
    expect(text.textContent).not.toContain("\u2028");
  });

  it("does the same in a plain numbered list, a bullet list and plain text", async () => {
    await drawn({
      document: onlyPage([
        list("A\u2028B\nNext"),
        { ...list("A\u2028B\nNext"), id: "b", list: "bullet" },
        { ...list("A\u2028B\nNext"), id: "p", list: "none" },
      ]),
    });
    expect(entries("l")).toEqual([
      { text: "AB", breaks: 1 },
      { text: "Next", breaks: 0 },
    ]);
    expect(entries("b")).toEqual([
      { text: "AB", breaks: 1 },
      { text: "Next", breaks: 0 },
    ]);
    const paragraphs = [...document.querySelectorAll('[data-slide-element="p"] p')];
    expect(paragraphs.map((one) => [one.textContent, one.querySelectorAll("br").length])).toEqual([
      ["AB", 1],
      ["Next", 0],
    ]);
  });

  it("keeps an empty last line after a closing line break", async () => {
    await drawn({ document: onlyPage([{ ...list("A\u2028"), list: "none" }]) });
    const paragraph = field().querySelector("p")!;
    expect(paragraph.querySelectorAll("br")).toHaveLength(1);
    expect(paragraph.textContent).toBe("A\u200B");
  });

  // SUI-FEATURE-160: player and export draw the field as the view does.
  it("draws the same in the player and the export", async () => {
    const doc = onlyPage([list("A\u2028B\nNext", { start: 1, markerGap: 20 })]);
    const { unmount } = await drawn({ document: doc });
    const view = field().innerHTML;
    unmount();
    render(<SlidePlayer document={doc} brand={SLIDE_BRAND} fonts={SLIDE_SERIF_FONTS} />);
    expect(field().innerHTML).toBe(view);
    cleanup();
    render(<SlideExport document={doc} brand={SLIDE_BRAND} fonts={SLIDE_SERIF_FONTS} />);
    expect(field().innerHTML).toBe(view);
  });
});
