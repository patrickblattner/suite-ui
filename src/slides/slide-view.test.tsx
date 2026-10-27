import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveSlideMedia,
  SLIDE_BRAND,
  SLIDE_DECK,
  SLIDE_FONTS,
  SLIDE_MISSING_FONT,
  SLIDE_SHOWCASE,
} from "../../gallery/slide-showcase.js";
import {
  animationOrders,
  animationState,
  cssFill,
  cssFont,
  gradientLine,
  paragraphs,
  stackOrder,
} from "./render-style.js";
import { parseSlideDocument } from "./document.js";
import {
  carriesUnloadedAddOn,
  checkSlideExtensions,
  type SlideAddOn,
  type SlideExtensions,
  SlideView,
  type SlideViewProps,
  type SlideViewReport,
} from "./slide-view.js";
import { missingFontsText } from "./use-slide-assets.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const stamp = () => <span>Stamp of the gallery</span>;
const extensions: SlideExtensions = {
  types: { "gallery.stamp": { label: "Stamp", render: stamp } },
};
const sepia: SlideAddOn = {
  type: "image",
  id: "ext.gallery.image-filter",
  style: (value) => ({ filter: `sepia(${(value as { warmth: number }).warmth}%)` }),
};
// The showcase with the photo carrying filter values in its payload.
const filtered = {
  ...SLIDE_SHOWCASE,
  pages: SLIDE_SHOWCASE.pages.map((page) => ({
    ...page,
    elements: page.elements?.map((element) =>
      element.id === "photo"
        ? { ...element, payload: { "ext.gallery.image-filter": { warmth: 40 } } }
        : element,
    ),
  })),
} as SlideViewProps["document"];

async function drawn(props: Partial<SlideViewProps> = {}) {
  const onReport = vi.fn<(report: SlideViewReport) => void>();
  const view = render(
    <SlideView
      document={SLIDE_SHOWCASE}
      brand={SLIDE_BRAND}
      fonts={SLIDE_FONTS}
      resolveMedia={resolveSlideMedia}
      extensions={extensions}
      scale={0.5}
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

describe("SlideView", () => {
  it("draws every element type of the showcase at its place, under one scale", async () => {
    const { container } = await drawn();
    const types = new Set(
      [...container.querySelectorAll("[data-slide-type]")].map((node) =>
        node.getAttribute("data-slide-type"),
      ),
    );
    expect([...types].sort()).toEqual(
      [
        "chart",
        "custom",
        "group",
        "icon",
        "image",
        "line",
        "placeholder",
        "shape",
        "table",
        "text",
      ].sort(),
    );
    expect(screen.getByTestId("view")).toHaveStyle({ width: "960px", height: "540px" });
    const page = container.querySelector<HTMLElement>("[data-slot=slide-page]")!;
    expect(page.style.transform).toBe("scale(0.5)");
    expect(page.style.width).toBe("1920px");
    const photo = container.querySelector<HTMLElement>("[data-slide-element=photo]")!;
    expect(photo.style).toMatchObject({
      left: "1240px",
      top: "60px",
      width: "600px",
      height: "400px",
    });
    // A group's children keep page coordinates; they stand relative to the group's box.
    const back = container.querySelector<HTMLElement>("[data-slide-element=badge-back]")!;
    expect(back.style).toMatchObject({ left: "0px", top: "0px" });
  });

  // SUI-FEATURE-160 AC6: an element type without renderer stands as a named stand-in.
  it("names an unknown element type and draws a registered one", async () => {
    const { report } = await drawn();
    expect(screen.getByText("“community.poll” can’t be shown here")).toBeInTheDocument();
    expect(screen.getByText("Stamp of the gallery")).toBeInTheDocument();
    expect(report().unknownTypes).toEqual(["community.poll"]);
  });

  // SUI-FEATURE-160 §Barrierefreiheit: real text, the model's alt text, a chart's data as a table.
  it("keeps text as text, gives images their alt text and charts a data table", async () => {
    await drawn();
    expect(screen.getByText("Workshop")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Hills under a sun" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    const data = screen.getByRole("table", { name: "Results" });
    expect(within(data).getByRole("rowheader", { name: "2026" })).toBeInTheDocument();
    expect(
      within(data)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toContain("7");
  });

  // SUI-FEATURE-233 rev 3: a chart's texts scale with its shorter side, above 300 px as below; an
  // emptied name is drawn and read by its default name (#368).
  it("scales a large chart's texts with its box and names an emptied name by its default", async () => {
    const document = structuredClone(SLIDE_SHOWCASE);
    const results = document.pages[0]!.elements!.find((element) => element.id === "results")!;
    if (results.type !== "chart") throw new Error("no chart");
    results.series[0]!.name = " ";
    results.categories[1] = "";
    const { container } = await drawn({ document });
    const chart = container.querySelector("[data-slide-element=results]")!;
    // 640 × 360: 20 px at 300 on the shorter side, so 24 here.
    const sizes = [...chart.querySelectorAll("svg text")].map((text) =>
      text.getAttribute("font-size"),
    );
    expect(new Set(sizes)).toEqual(new Set(["24"]));
    const data = within(chart as HTMLElement).getByRole("table", { hidden: true });
    expect(
      within(data)
        .getAllByRole("rowheader", { hidden: true })
        .map((cell) => cell.textContent),
    ).toEqual(["Series 1", "2026"]);
    expect(
      within(data)
        .getAllByRole("columnheader", { hidden: true })
        .map((cell) => cell.textContent),
    ).toEqual(["Q1", "Category 2", "Q3"]);
    const drawnTexts = [...chart.querySelectorAll("svg text")].map((text) => text.textContent);
    expect(drawnTexts).toEqual(expect.arrayContaining(["Series 1", "Category 2"]));
  });

  it("draws nothing of a document that breaks the schema and names the error", async () => {
    const onReport = vi.fn<(report: SlideViewReport) => void>();
    const { container } = render(
      <SlideView
        document={{ ...SLIDE_SHOWCASE, schemaVersion: 9 } as unknown as SlideViewProps["document"]}
        brand={SLIDE_BRAND}
        onReport={onReport}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("This page can’t be shown.");
    expect(container.querySelector("[data-slot=slide-page]")).toBeNull();
    await waitFor(() => expect(onReport).toHaveBeenCalled());
    expect(onReport.mock.lastCall![0].error?.code).toBe("newer-version");
  });

  // SUI-FEATURE-160 AC3 (the browser half is in the gallery): a font without a file is named.
  it("names a font without a file, a brand font key the set lacks and a font of another origin", async () => {
    const { report } = await drawn({ document: SLIDE_MISSING_FONT });
    expect(report().missingFonts).toEqual(["Unserved Display"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Font missing: Unserved Display");
    cleanup();
    const noBody = await drawn({
      brand: {
        ...SLIDE_BRAND,
        fonts: { heading: { family: "Gallery Slide Sans", label: "Heading" } },
      },
    });
    expect(noBody.report().missingFonts).toContain("body");
    cleanup();
    const foreign = await drawn({
      fonts: [{ family: "Gallery Slide Sans", src: "https://fonts.example/inter.woff2" }],
    });
    expect(foreign.report().missingFonts).toEqual(["Gallery Slide Sans"]);
  });

  // SUI-FEATURE-160 rev 4 AC3: an origin the app passes counts as its own; any other does not.
  it("takes a font from an origin the app passes, and only from that one", async () => {
    const fonts = [400, 700].map((weight) => ({
      family: "Gallery Slide Sans",
      src: `https://media.example/inter-${weight}.woff2`,
      weight,
    }));
    const passed = await drawn({ fonts, fontOrigins: ["https://media.example"] });
    expect(passed.report().missingFonts).toEqual([]);
    cleanup();
    const other = await drawn({ fonts, fontOrigins: ["https://other.example"] });
    expect(other.report().missingFonts).toEqual(["Gallery Slide Sans"]);
  });

  // Review #292: an entry that is no http(s) origin admits nothing, so an opaque URL never loads.
  it("admits no opaque-origin font through a malformed origin entry", async () => {
    const fonts = [{ family: "Gallery Slide Sans", src: "data:font/woff2;base64,AAAA" }];
    const { report } = await drawn({ fonts, fontOrigins: ["localhost:3000", "null"] });
    expect(report().missingFonts).toEqual(["Gallery Slide Sans"]);
  });

  // SUI-FEATURE-160 rev 4 AC6: an icon name the library lacks stands as a named stand-in.
  it("names an unknown icon", async () => {
    const page = SLIDE_SHOWCASE.pages[0]!;
    const { report } = await drawn({
      document: {
        ...SLIDE_SHOWCASE,
        pages: [
          {
            ...page,
            elements: [
              {
                id: "odd",
                type: "icon",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                icon: "no-such-icon",
              },
            ],
          },
        ],
      },
    });
    expect(screen.getByText("Icon no-such-icon not found")).toBeInTheDocument();
    expect(report().unknownIcons).toEqual(["no-such-icon"]);
  });

  it("writes no brand value outside the colour grammar into CSS", async () => {
    const { container, report } = await drawn({
      brand: {
        ...SLIDE_BRAND,
        colors: {
          ...SLIDE_BRAND.colors,
          accent: { value: "red; background: url(https://evil.example/t)", label: "Accent" },
        },
      },
    });
    expect(container.innerHTML).not.toContain("evil.example");
    expect(report().missingBrand).toContain("accent");
  });

  it("shows the animation step it is given, and the end state without one", async () => {
    const step = async (animationStep: number | undefined) => {
      cleanup();
      const { container } = await drawn({ document: SLIDE_DECK, animationStep });
      const inner = (id: string) =>
        container.querySelector<HTMLElement>(`[data-slide-element=${id}] > div`)!.style;
      return { one: inner("first-one"), two: inner("first-two") };
    };
    const start = await step(0);
    expect([start.one.visibility, start.two.visibility]).toEqual(["hidden", "hidden"]);
    const first = await step(1);
    expect(first.one.animation).toContain("suite-slide-slide-in-left 300ms");
    expect(first.two.visibility).toBe("hidden");
    const end = await step(undefined);
    expect([end.one.visibility, end.one.animation, end.two.visibility]).toEqual(["", "", ""]);
  });
});

// Review #292: what the view cannot draw as asked is reported, never a silent gap.
describe("SlideView reports", () => {
  const page = SLIDE_SHOWCASE.pages[0]!;
  const withElements = (elements: unknown[]) =>
    ({ ...SLIDE_SHOWCASE, pages: [{ ...page, elements }] }) as SlideViewProps["document"];
  const text = (id: string, name?: string) => ({
    id,
    name,
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    runs: [{ text: "far too long" }],
  });

  it("keys overflow by element: equal names do not cancel, an empty name falls back to the id", async () => {
    // Every text box is too small in this layout-free test: content 100 px in a 50 px box.
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(50);
    const { report } = await drawn({
      document: withElements([text("a", "Same"), text("b", "Same"), text("c", "")]),
      fitText: true,
    });
    await waitFor(() => expect(report().overflowing).toHaveLength(3));
    expect([...report().overflowing].sort()).toEqual(["Same", "Same", "c"]);
    // Each notice stands beside its own box, below it.
    const notices = screen.getAllByRole("alert");
    expect(notices.map((notice) => notice.getAttribute("data-slide-notice-for")).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("names a missing brand colour on the view and in its attributes", async () => {
    const { report } = await drawn({
      brand: {
        ...SLIDE_BRAND,
        colors: { ...SLIDE_BRAND.colors, accent: { value: "not a colour!", label: "Accent" } },
      },
    });
    expect(report().missingBrand).toContain("accent");
    expect(screen.getByTestId("view")).toHaveAttribute("data-slide-missing-brand", "accent");
    expect(screen.getByRole("alert")).toHaveTextContent("Brand colour missing: accent");
  });

  it("names an image that resolves but does not load", async () => {
    const { report } = await drawn();
    fireEvent.error(screen.getByRole("img", { name: "Hills under a sun" }));
    expect(await screen.findByText("Image photo not found")).toBeInTheDocument();
    await waitFor(() => expect(report().missingMedia).toEqual(["photo"]));
  });
});

// Review #292 r2: each fix pinned by a test of its own.
describe("SlideView reports, second round", () => {
  const page = SLIDE_SHOWCASE.pages[0]!;

  it("names a page background that does not load", async () => {
    const document = {
      ...SLIDE_SHOWCASE,
      pages: [{ ...page, background: { type: "image", media: { id: "photo" } }, elements: [] }],
    } as SlideViewProps["document"];
    const { container, report } = await drawn({ document });
    fireEvent.error(container.querySelector("[data-slot=slide-page] > img")!);
    await waitFor(() => expect(report().missingMedia).toEqual(["photo"]));
  });

  // Review #295 inc 2: an app type's renderer may use hooks.
  it("draws an app type whose renderer uses a hook", async () => {
    await drawn({
      extensions: {
        types: {
          "gallery.stamp": {
            label: "Stamp",
            render: function Render() {
              const [text] = React.useState("Hooked stamp");
              return <span>{text}</span>;
            },
          },
        },
      },
    });
    expect(screen.getByText("Hooked stamp")).toBeInTheDocument();
  });

  // SUI-FEATURE-163: an add-on draws onto a built-in type from its payload key.
  it("draws a registered add-on onto the element whose payload holds its key", async () => {
    const { container } = await drawn({
      document: filtered,
      extensions: { ...extensions, addOns: [sepia] },
    });
    const photo = container.querySelector("[data-slide-element=photo]")!;
    const box = photo.querySelector<HTMLElement>("[data-slide-add-on='ext.gallery.image-filter']")!;
    expect(box.style.filter).toBe("sepia(40%)");
    expect(box).toContainElement(screen.getByRole("img", { name: "Hills under a sun" }));
    // Another image or an element without the key is drawn as it is.
    expect(container.querySelectorAll("[data-slide-add-on]")).toHaveLength(1);
  });

  it("composes two add-ons on one element, one box each", async () => {
    const tint: SlideAddOn = {
      type: "image",
      id: "ext.test.tint",
      style: () => ({ opacity: 0.5 }),
    };
    const document = {
      ...SLIDE_SHOWCASE,
      pages: SLIDE_SHOWCASE.pages.map((page) => ({
        ...page,
        elements: page.elements?.map((element) =>
          element.id === "photo"
            ? {
                ...element,
                payload: { "ext.gallery.image-filter": { warmth: 40 }, "ext.test.tint": true },
              }
            : element,
        ),
      })),
    } as SlideViewProps["document"];
    const { container } = await drawn({ document, extensions: { addOns: [sepia, tint] } });
    const outer = container.querySelector<HTMLElement>(
      "[data-slide-element=photo] [data-slide-add-on='ext.test.tint']",
    )!;
    const inner = outer.querySelector<HTMLElement>(
      "[data-slide-add-on='ext.gallery.image-filter']",
    )!;
    expect(outer.style.opacity).toBe("0.5");
    expect(inner.style.filter).toBe("sepia(40%)");
    expect(inner).toContainElement(screen.getByRole("img", { name: "Hills under a sun" }));
  });

  // SUI-FEATURE-163 AC2: without the extension, the custom type is a named stand-in and the image with
  // filter values is drawn plain, with nothing reported.
  it("draws a filtered image plain without the add-on and names the unregistered type", async () => {
    const { container, report } = await drawn({ document: filtered, extensions: undefined });
    expect(container.querySelector("[data-slide-add-on]")).toBeNull();
    expect(screen.getByRole("img", { name: "Hills under a sun" })).toBeInTheDocument();
    expect(screen.getByText("“gallery.stamp” can’t be shown here")).toBeInTheDocument();
    expect(report().unknownTypes.sort()).toEqual(["community.poll", "gallery.stamp"]);
    expect(report().missingMedia).toEqual([]);
  });

  it("tells a built-in element with payload no loaded add-on reads", () => {
    const image = parseSlideDocument(filtered).pages[0]!.elements.find((e) => e.id === "photo")!;
    const stampElement = parseSlideDocument(filtered).pages[0]!.elements.find(
      (e) => e.id === "stamp",
    )!;
    expect(carriesUnloadedAddOn(image, undefined)).toBe(true);
    expect(carriesUnloadedAddOn(image, { addOns: [sepia] })).toBe(false);
    expect(carriesUnloadedAddOn(image, { addOns: [{ ...sepia, id: "ext.test.other" }] })).toBe(
      true,
    );
    // AC4: plain app data (no `ext.`) never counts, even without any add-on; an old `ext:` key is
    // plain app data too.
    const plain = {
      ...image,
      payload: { origin: "template-7", filter: { warmth: 1 }, "ext:gallery.image-filter": {} },
    };
    expect(carriesUnloadedAddOn(plain, undefined)).toBe(false);
    expect(
      carriesUnloadedAddOn({ ...plain, payload: { ...plain.payload, "ext.x.y": 1 } }, undefined),
    ).toBe(true);
    // An app type's payload is its own data, never an add-on's.
    expect(carriesUnloadedAddOn(stampElement, undefined)).toBe(false);
  });

  // SUI-FEATURE-163 AC5: an add-on id not of the form `ext.<app>.<name>` is refused with an error.
  it("refuses an add-on whose id is not ext.<app>.<name>", () => {
    for (const id of [
      "filter",
      "ext.cockpit",
      "ext.Cockpit.filter",
      "ext.cockpit.",
      "ext.a.b.c",
      "ext:cockpit.image-filter",
      "x:a.b",
    ]) {
      expect(() => checkSlideExtensions({ addOns: [{ ...sepia, id }] })).toThrow(id);
    }
    for (const id of ["ext.cockpit.image-filter", "ext.a1.b2"]) {
      expect(() => checkSlideExtensions({ addOns: [{ ...sepia, id }] })).not.toThrow();
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <SlideView
          document={SLIDE_SHOWCASE}
          brand={SLIDE_BRAND}
          extensions={{ addOns: [{ ...sepia, id: "filter" }] }}
        />,
      ),
    ).toThrow("ext.<app>.<name>");
  });

  it("tries a media id again once the app resolves a new URL for it", async () => {
    const { rerender } = await drawn();
    fireEvent.error(screen.getByRole("img", { name: "Hills under a sun" }));
    await screen.findByText("Image photo not found");
    rerender(
      <SlideView
        document={SLIDE_SHOWCASE}
        brand={SLIDE_BRAND}
        fonts={SLIDE_FONTS}
        resolveMedia={(id) => (id === "photo" ? "/renewed.png" : undefined)}
        extensions={extensions}
        scale={0.5}
        data-testid="view"
      />,
    );
    expect(screen.getByRole("img", { name: "Hills under a sun" })).toHaveAttribute(
      "src",
      "/renewed.png",
    );
  });

  it("measures a text again when its runs change", async () => {
    // A box overflows when its text is longer than 20 characters.
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return (this.textContent ?? "").length > 20 ? 100 : 10;
    });
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(50);
    const document = (text: string) =>
      ({
        ...SLIDE_SHOWCASE,
        pages: [
          {
            ...page,
            elements: [
              { id: "t", type: "text", x: 0, y: 400, width: 100, height: 50, runs: [{ text }] },
            ],
          },
        ],
      }) as SlideViewProps["document"];
    const { rerender, report } = await drawn({ document: document("short"), fitText: true });
    expect(report().overflowing).toEqual([]);
    rerender(
      <SlideView
        document={document("now far too long for its box")}
        brand={SLIDE_BRAND}
        fonts={SLIDE_FONTS}
        fitText
        scale={0.5}
        data-testid="view"
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("view")).toHaveAttribute("data-slide-overflowing", "t"),
    );
  });

  it("names missing fonts in a strip below the page, never over it", async () => {
    await drawn({ document: SLIDE_MISSING_FONT });
    const view = screen.getByTestId("view");
    // The page keeps its 960 × 540; the strip adds its 28 px below.
    expect(view).toHaveStyle({ width: "960px", height: "568px" });
    const strip = screen.getByRole("alert");
    expect(strip).toHaveClass("bottom-0");
    expect(strip).toHaveStyle({ height: "28px" });
  });
});

describe("slide render rules", () => {
  it("splits paragraphs at a newline in a run, keeping each piece's run", () => {
    const runs = [{ text: "a\nb" }, { text: "c" }, { text: "\nd" }];
    expect(paragraphs(runs).map((pieces) => pieces.map((piece) => piece.text))).toEqual([
      ["a"],
      ["b", "c"],
      ["d"],
    ]);
  });

  it("stacks by layer, then by order in the list", () => {
    const order = stackOrder([
      { id: "a", layer: 1 },
      { id: "b", layer: 0 },
      { id: "c", layer: 1 },
    ]);
    expect(order.map((one) => one.id)).toEqual(["b", "a", "c"]);
  });

  it("quotes named families and keeps generic ones", () => {
    const brand = { colors: {}, fonts: { body: { family: "Inter, sans-serif", label: "Body" } } };
    expect(cssFont({ kind: "brand", key: "body" }, brand)).toEqual({
      css: '"Inter", sans-serif',
      files: ["Inter"],
    });
    expect(cssFont({ kind: "brand", key: "nope" }, brand)).toEqual({ missing: "nope" });
    expect(
      cssFont(
        { kind: "brand", key: "body" },
        { colors: {}, fonts: { body: { family: 'x"; }', label: "Body" } } },
      ),
    ).toEqual({
      missing: "body",
    });
  });

  it("builds gradients only from colours of the grammar", () => {
    const fill = {
      type: "gradient" as const,
      angle: 90,
      stops: [
        { color: { kind: "free" as const, value: "#fff" }, position: 0 },
        { color: { kind: "brand" as const, key: "x" }, position: 100 },
      ],
    };
    expect(cssFill(fill, { colors: { x: { value: "#000", label: "X" } }, fonts: {} })).toBe(
      "linear-gradient(90deg, #fff 0%, #000 100%)",
    );
    expect(
      cssFill(fill, { colors: { x: { value: "url(a)", label: "X" } }, fonts: {} }),
    ).toBeUndefined();
    const line = gradientLine(90);
    expect(
      [line.x1, line.y1, line.x2, line.y2].map((value) => Math.round(value * 1e6) / 1e6),
    ).toEqual([0, 0.5, 1, 0.5]);
  });

  it("orders animation steps and shows an exit's element until it played", () => {
    const document = parseSlideDocument(SLIDE_DECK);
    const elements = document.pages[0]!.elements;
    const orders = animationOrders(elements);
    expect(orders).toEqual([1, 2]);
    const exiting = {
      ...elements[1]!,
      animation: { exit: { effect: "fade" as const, duration: 200, delay: 0, order: 1 } },
    };
    expect(animationState(exiting, 0, orders)).toEqual({ kind: "shown" });
    expect(animationState(exiting, 1, orders)).toMatchObject({
      kind: "playing",
      name: "suite-slide-fade-out",
    });
    expect(animationState(exiting, 2, orders)).toEqual({ kind: "hidden" });
    expect(animationState(exiting, undefined, orders)).toEqual({ kind: "hidden" });
  });
});

// Codex #309 CX2 and CX3.
describe("SlideView fonts by face, and fit after a fix", () => {
  it("names a bold face whose file failed while the regular one loaded", async () => {
    const fonts = [
      { family: "Gallery Slide Sans", src: "/inter-400.woff2", weight: 400 },
      {
        family: "Gallery Slide Sans",
        src: "https://elsewhere.example/inter-700.woff2",
        weight: 700,
      },
    ];
    const { report } = await drawn({ fonts });
    expect(report().missingFonts).toEqual(["Gallery Slide Sans 700"]);
    cleanup();
    const variable = await drawn({
      fonts: [{ family: "Gallery Slide Sans", src: "/inter-var.woff2", weight: "100 900" }],
    });
    expect(variable.report().missingFonts).toEqual([]);
  });

  it("fits a document that was invalid once it is valid", async () => {
    const observed: Element[] = [];
    let notify:
      ((entries: { contentRect: { width: number; height: number } }[]) => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: typeof notify) {
          notify = callback;
        }
        observe(element: Element) {
          observed.push(element);
        }
        disconnect() {}
      },
    );
    const props = {
      brand: SLIDE_BRAND,
      fonts: SLIDE_FONTS,
      scale: "fit" as const,
      "data-testid": "fit",
    };
    const { rerender } = render(
      <SlideView
        {...props}
        document={{ ...SLIDE_SHOWCASE, schemaVersion: 9 } as unknown as SlideViewProps["document"]}
      />,
    );
    expect(observed).toHaveLength(0);
    rerender(<SlideView {...props} document={SLIDE_SHOWCASE} />);
    expect(observed).toHaveLength(1);
    act(() => notify?.([{ contentRect: { width: 960, height: 540 } }]));
    await waitFor(() =>
      expect(screen.getByTestId("fit")).toHaveAttribute("data-slide-ready", "true"),
    );
  });
});

// #321: the notices of the view, their names in the package's languages and their places.
describe("SlideView notices (#321)", () => {
  const page = SLIDE_SHOWCASE.pages[0]!;
  const withElements = (elements: unknown[]) =>
    ({ ...SLIDE_SHOWCASE, pages: [{ ...page, elements }] }) as SlideViewProps["document"];
  const text = (id: string, name: string, x: number, y: number, width: number) => ({
    id,
    name,
    type: "text",
    x,
    y,
    width,
    height: 50,
    runs: [{ text: "far too long" }],
  });
  const overflowing = () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(50);
  };

  // AC1: grouped by family, each cut by its name, no weight number, in de, en and es.
  it("names missing cuts by family and by name in every language", async () => {
    // Family names that end in a number stay whole: the faces come apart, not as text.
    const missing = [
      { family: "Inter", weight: 700, style: "normal" },
      { family: "Inter", weight: 700, style: "italic" },
      { family: "Inter", weight: 400, style: "italic" },
      { family: "Brand Sans" },
      { family: "Inter", weight: 650, style: "normal" },
      { family: "Source Sans 3", weight: 700, style: "normal" },
      { family: "Bodoni 72" },
    ] as const;
    const names = Object.fromEntries(
      ["en", "de", "es"].map((lng) => [
        lng,
        missingFontsText(i18n.getFixedT(lng, "suite"), missing),
      ]),
    );
    expect(names).toEqual({
      en: "Inter (Bold, Bold italic, Italic), Brand Sans, Source Sans 3 (Bold), Bodoni 72",
      de: "Inter (Fett, Fett kursiv, Kursiv), Brand Sans, Source Sans 3 (Fett), Bodoni 72",
      es: "Inter (Negrita, Negrita cursiva, Cursiva), Brand Sans, Source Sans 3 (Negrita), Bodoni 72",
    });
    // No weight number besides the families' own.
    for (const name of Object.values(names)) {
      expect(name.replace(/Source Sans 3|Bodoni 72/g, "")).not.toMatch(/\d/);
    }
    // The view's strip names it so, the report keeps the number for the app.
    await i18n.changeLanguage("de");
    try {
      const { report } = await drawn({
        fonts: [
          { family: "Gallery Slide Sans", src: "/inter-400.woff2", weight: 400 },
          { family: "Gallery Slide Sans", src: "https://elsewhere.example/b.woff2", weight: 700 },
        ],
      });
      expect(report().missingFonts).toEqual(["Gallery Slide Sans 700"]);
      expect(report().missingFaces).toEqual([
        { family: "Gallery Slide Sans", weight: 700, style: "normal" },
      ]);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Schrift fehlt: Gallery Slide Sans (Fett)",
      );
    } finally {
      await i18n.changeLanguage("en");
    }
  });

  // SUI-FEATURE-200 AC2 (#341): the cuts by their usual names, rising without reversal in every
  // language; 200 and 900 in en and es.
  it("names the cuts per SUI-FEATURE-200", () => {
    const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900];
    const cuts = Object.fromEntries(
      ["en", "es", "de"].map((lng) => {
        const t = i18n.getFixedT(lng, "suite");
        return [lng, steps.map((step) => t(`slides.weight.${step}`))];
      }),
    );
    expect(cuts).toEqual({
      en: [
        "Thin",
        "Extra light",
        "Light",
        "Regular",
        "Medium",
        "Semibold",
        "Bold",
        "Extra bold",
        "Black",
      ],
      es: [
        "Fina",
        "Extraligera",
        "Ligera",
        "Normal",
        "Media",
        "Seminegrita",
        "Negrita",
        "Extranegrita",
        "Negra",
      ],
      de: [
        "Dünn",
        "Extraleicht",
        "Leicht",
        "Normal",
        "Mittel",
        "Halbfett",
        "Fett",
        "Extrafett",
        "Schwarz",
      ],
    });
    const faces = [
      { family: "Inter", weight: 200, style: "normal" },
      { family: "Inter", weight: 900, style: "normal" },
    ] as const;
    expect(missingFontsText(i18n.getFixedT("en", "suite"), faces)).toBe(
      "Inter (Extra light, Black)",
    );
    expect(missingFontsText(i18n.getFixedT("es", "suite"), faces)).toBe(
      "Inter (Extraligera, Negra)",
    );
  });

  // Scope (a): an italic run needs an italic file; the regular one does not stand in for it, and an
  // italic file that loads covers it.
  it("matches faces by style: an italic run without its italic file is missing", async () => {
    const italicPage = withElements([
      {
        id: "slanted",
        type: "text",
        x: 0,
        y: 0,
        width: 800,
        height: 200,
        runs: [{ text: "Slanted", italic: true }],
      },
    ]);
    const regular = { family: "Gallery Slide Sans", src: "/inter-400.woff2", weight: 400 };
    const { report } = await drawn({
      document: italicPage,
      fonts: [
        regular,
        { ...regular, src: "https://elsewhere.example/i.woff2", style: "italic" as const },
      ],
    });
    expect(report().missingFonts).toEqual(["Gallery Slide Sans 400 italic"]);
    cleanup();
    const covered = await drawn({
      document: italicPage,
      fonts: [regular, { ...regular, src: "/inter-400-italic.woff2", style: "italic" as const }],
    });
    expect(covered.report().missingFonts).toEqual([]);
  });

  // AC3: texts with no room beside them form one message in the strip, which ends in "…" where it
  // is too narrow.
  it("names every text without room in one message of the strip, truncated, never cut", async () => {
    overflowing();
    await drawn({
      document: withElements([text("a", "First", 0, 0, 1920), text("b", "Second", 0, 0, 1920)]),
      fitText: true,
    });
    const view = screen.getByTestId("view");
    await waitFor(() =>
      expect(view.querySelector("[data-slide-notice-for='a b']")).toHaveTextContent(
        "Text doesn’t fit its box: First, Second",
      ),
    );
    const messages = view.querySelectorAll(
      "[data-slot=slide-notice]:not([data-slide-notice-for]) > span",
    );
    expect(messages).toHaveLength(1);
    for (const message of messages) expect(message).toHaveClass("min-w-0", "truncate");
  });

  // AC4: above its box a notice starts at the box's left edge but gives way at the view's right edge.
  it("keeps a notice above a text near the right edge on the canvas", async () => {
    overflowing();
    await drawn({ document: withElements([text("a", "Narrow", 1880, 400, 30)]), fitText: true });
    const notice = await waitFor(() => {
      const found = screen
        .getByTestId("view")
        .querySelector<HTMLElement>("[data-slot=slide-notice][data-slide-notice-for=a]");
      expect(found).not.toBeNull();
      return found!;
    });
    const row = notice.parentElement!;
    // The row spans the view inside 4 px; the spacer before the notice is the box's left edge and
    // shrinks, the notice does not.
    expect(row.style).toMatchObject({ left: "4px", right: "4px" });
    expect(row).toHaveClass("flex");
    const spacer = row.firstElementChild as HTMLElement;
    expect(spacer.style.flexBasis).toBe("936px");
    expect(spacer).toHaveClass("min-w-0", "shrink");
    expect(notice).toHaveClass("max-w-full", "flex-none");
  });

  // AC5: the smaller page of the second pass leaves room for every notice: no strip, the page centred.
  it("centres the page again when the strip turns out not to be needed", async () => {
    overflowing();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe() {
          this.callback(
            [{ contentRect: { width: 960, height: 540 } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
        }
        disconnect() {}
      },
    );
    // Fitted into 960 × 540 it has 132 px on its right (too little); scaled down by the strip,
    // 150 px: its notice goes beside it, and the page is centred in the whole view.
    await drawn({
      document: withElements([text("a", "Wide", 0, 0, 1640)]),
      fitText: true,
      scale: "fit",
    });
    const view = screen.getByTestId("view");
    await waitFor(() =>
      expect(
        view.querySelector("[data-slot=slide-notice][data-slide-notice-for=a]"),
      ).not.toBeNull(),
    );
    expect(view.querySelector("[data-slot=slide-notice]:not([data-slide-notice-for])")).toBeNull();
    const drawnPage = view.querySelector<HTMLElement>("[data-slot=slide-page]")!;
    expect(parseFloat(drawnPage.style.top)).toBeCloseTo(14, 1);
  });
});

// #294 inc 2: a text that does not fit its box and reaches past the page has one notice naming both,
// under keys of its own (no duplicate React key).
describe("SlideView notices past the page", () => {
  it("names a text that overflows and reaches past the page in one notice", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(50);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const page = SLIDE_SHOWCASE.pages[0]!;
    const document = {
      ...SLIDE_SHOWCASE,
      pages: [
        {
          ...page,
          elements: [
            {
              id: "edge",
              name: "Edge",
              type: "text",
              x: -100,
              y: 400,
              width: 400,
              height: 50,
              runs: [{ text: "far too long" }],
            },
            {
              id: "inside",
              name: "Inside",
              type: "text",
              x: 600,
              y: 400,
              width: 400,
              height: 50,
              runs: [{ text: "far too long" }],
            },
          ],
        },
      ],
    } as SlideViewProps["document"];
    await drawn({ document, fitText: true, pastPageNotices: true });
    const view = screen.getByTestId("view");
    await waitFor(() =>
      expect(view.querySelectorAll("[data-slide-notice-for=edge]")).toHaveLength(1),
    );
    const edge = view.querySelector("[data-slide-notice-for=edge]")!;
    expect(edge).toHaveAttribute("data-slide-notice-kind", "both");
    expect(edge).toHaveTextContent("Text doesn’t fit its box and reaches past the page: Edge");
    expect(view.querySelector("[data-slide-notice-for=inside]")).toHaveAttribute(
      "data-slide-notice-kind",
      "text",
    );
    expect(errors.mock.calls.some((call) => String(call[0]).includes("same key"))).toBe(false);
  });
});

// Codex #355 CX1 (#356): an element the page draws from its master reaches past the page too, and
// the view names it.
describe("SlideView past-page notices of a master", () => {
  it("names a master's element that reaches past the page", async () => {
    const document = {
      ...SLIDE_SHOWCASE,
      masters: [
        {
          id: "m",
          name: "Master",
          elements: [
            {
              id: "banner",
              name: "Banner",
              type: "shape",
              shape: "rectangle",
              x: -100,
              y: 40,
              width: 600,
              height: 80,
            },
          ],
        },
      ],
      layouts: [{ id: "l", name: "Layout", masterId: "m", elements: [] }],
      pages: [{ ...SLIDE_SHOWCASE.pages[0]!, layoutId: "l", elements: [] }],
    } as SlideViewProps["document"];
    await drawn({ document, pastPageNotices: true });
    const view = screen.getByTestId("view");
    await waitFor(() =>
      expect(view.querySelector("[data-slide-notice-for=banner]")).toHaveTextContent(
        "Reaches past the page: Banner",
      ),
    );
  });
});

// An image loaded at its natural size, as the browser reports it.
function loadImage(image: HTMLElement, natural: { width: number; height: number }) {
  Object.defineProperty(image, "naturalWidth", { configurable: true, value: natural.width });
  Object.defineProperty(image, "naturalHeight", { configurable: true, value: natural.height });
  fireEvent.load(image);
}

// SUI-FEATURE-230 rev 5 §Rahmen (#538): a bordered image lies in its frame less the border, and its
// crop refers to that area: as much of it is hidden on one side as on the opposite one.
describe("SlideView bordered image", () => {
  const page = SLIDE_SHOWCASE.pages[0]!;
  const bordered = async (
    crop: { zoom: number; offsetX: number; offsetY: number },
    color: { kind: "free"; value: string } | { kind: "brand"; key: string } = {
      kind: "free",
      value: "#dc2626",
    },
    natural?: { width: number; height: number },
  ) => {
    const document = {
      ...SLIDE_SHOWCASE,
      pages: [
        {
          ...page,
          elements: page.elements?.map((element) =>
            element.id === "photo"
              ? {
                  ...element,
                  crop,
                  border: { color, width: 10 },
                }
              : element,
          ),
        },
      ],
    } as SlideViewProps["document"];
    await drawn({ document });
    const image = screen.getByRole("img", { name: "Hills under a sun" });
    if (natural !== undefined) loadImage(image, natural);
    const [left, top, width, height] = ["left", "top", "width", "height"].map((key) =>
      parseFloat(image.style.getPropertyValue(key)),
    ) as [number, number, number, number];
    // The area inside the border is 580 × 380 (600 × 400 less 10 px on each side).
    return { left: 0 - left, right: left + width - 580, top: 0 - top, bottom: top + height - 380 };
  };

  it("hides no image of an unzoomed bordered image", async () => {
    expect(await bordered({ zoom: 1, offsetX: 0, offsetY: 0 })).toEqual({
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    });
  });

  it("hides as much on opposite sides of a zoomed bordered image", async () => {
    expect(await bordered({ zoom: 1.5, offsetX: 0, offsetY: 0 })).toEqual({
      left: 145,
      right: 145,
      top: 95,
      bottom: 95,
    });
  });

  // #561: a border whose colour does not resolve still takes its width, transparent, so the image
  // fills the area inside it.
  it("keeps the border's width transparent when its colour does not resolve", async () => {
    expect(
      await bordered({ zoom: 1, offsetX: 0, offsetY: 0 }, { kind: "brand", key: "nope" }),
    ).toEqual({
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    });
    const frame = screen.getByRole("img", { name: "Hills under a sun" }).parentElement!;
    expect(frame.style.border).toBe("10px solid transparent");
  });

  // A crop stored for the whole frame (before rev 5) reaches past the area's limit: drawn at it.
  it("draws a crop past the area's reach at its limit, leaving no gap", async () => {
    const red = { kind: "free" as const, value: "#dc2626" };
    // An image of the area's own proportions (`SUI-FEATURE-280`: the reach follows the image).
    const area = { width: 580, height: 380 };
    expect(await bordered({ zoom: 1.5, offsetX: 150, offsetY: -100 }, red, area)).toEqual({
      left: 0,
      right: 290,
      top: 190,
      bottom: 0,
    });
  });
});

// SUI-FEATURE-280 (#625): the image is drawn at its own proportions, cover-filled and zoomed; the crop
// reaches as far as it overhangs the area, so at 100 % its overhanging axis shifts.
describe("SlideView image crop on the overhanging axis", () => {
  const wide = { width: 1600, height: 800 };
  const square = async (
    crop: { zoom: number; offsetX: number; offsetY: number },
    natural: { width: number; height: number } | undefined,
    border?: number,
  ) => {
    const document = {
      ...SLIDE_SHOWCASE,
      pages: [
        {
          ...SLIDE_SHOWCASE.pages[0]!,
          elements: [
            {
              id: "square",
              type: "image",
              x: 0,
              y: 0,
              width: 400,
              height: 400,
              media: { id: "photo" },
              alt: "Square",
              crop,
              ...(border === undefined
                ? {}
                : { border: { color: { kind: "free", value: "#000" }, width: border } }),
            },
          ],
        },
      ],
    } as SlideViewProps["document"];
    await drawn({ document });
    const image = screen.getByRole("img", { name: "Square" });
    if (natural !== undefined) loadImage(image, natural);
    const [left, top, width, height] = ["left", "top", "width", "height"].map((key) =>
      parseFloat(image.style.getPropertyValue(key)),
    ) as [number, number, number, number];
    return { left, top, width, height };
  };

  // AC1: a 2:1 image in a 400 × 400 frame at zoom 1 shifts 150 px left with no gap, and stops at
  // half its overhang.
  it("shifts a wide image along its overhang at 100 % and clamps at half of it", async () => {
    expect(await square({ zoom: 1, offsetX: -150, offsetY: 0 }, wide)).toEqual({
      left: -350,
      top: 0,
      width: 800,
      height: 400,
    });
    cleanup();
    expect(await square({ zoom: 1, offsetX: -500, offsetY: 40 }, wide)).toEqual({
      left: -400,
      top: 0,
      width: 800,
      height: 400,
    });
  });

  // AC4: with a border, the reach refers to the area inside it (360 × 360 at border 20).
  it("relates a bordered image's reach to the area inside the border", async () => {
    expect(await square({ zoom: 1, offsetX: -500, offsetY: 0 }, wide, 20)).toEqual({
      left: -360,
      top: 0,
      width: 720,
      height: 360,
    });
  });

  // AC5: a crop with no shift on the overhanging axis is centred as `cover` centred it before.
  it("draws a crop with no shift on the overhanging axis centred, as before", async () => {
    expect(await square({ zoom: 1.5, offsetX: 0, offsetY: 30 }, wide)).toEqual({
      left: -400,
      top: -70,
      width: 1200,
      height: 600,
    });
  });

  // Until the image has loaded nothing is clamped, and the stored crop stays as it is.
  it("clamps nothing before the image has loaded", async () => {
    const crop = { zoom: 1, offsetX: -150, offsetY: 0 };
    expect(await square(crop, undefined)).toEqual({ left: -150, top: 0, width: 400, height: 400 });
    expect(crop).toEqual({ zoom: 1, offsetX: -150, offsetY: 0 });
  });
});
