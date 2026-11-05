import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND } from "../../gallery/slide-showcase.js";
import { toast } from "../ui/toaster.js";
import type { PickedMedia } from "./slide-editor-library.js";
import { FORMAT_16_9, SLIDE_SCHEMA_VERSION } from "./schema.js";
import { type PickMediaContext, type ReadonlySlideDocument, SlideEditor } from "./slide-editor.js";

// The media the app resolves, each loaded at its natural size by the section's own `Image`.
const NATURAL: Record<string, { width: number; height: number }> = {
  "/photo.png": { width: 1920, height: 1080 },
  "/other.png": { width: 1000, height: 1000 },
};
// "broken" resolves to a URL that does not load.
const resolveMedia = (id: string) =>
  id === "photo" || id === "other" || id === "broken" ? `/${id}.png` : undefined;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 0;
      naturalHeight = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        const natural = NATURAL[value];
        if (natural === undefined) {
          queueMicrotask(() => this.onerror?.());
          return;
        }
        this.naturalWidth = natural.width;
        this.naturalHeight = natural.height;
        queueMicrotask(() => this.onload?.());
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Crop = { zoom: number; offsetX: number; offsetY: number };

function renderEditor(
  background: unknown,
  pickMedia?: (context: PickMediaContext) => Promise<PickedMedia | undefined>,
  morePages: unknown[] = [],
) {
  const onChange = vi.fn<(document: ReadonlySlideDocument) => void>();
  render(
    <SlideEditor
      document={
        {
          schemaVersion: SLIDE_SCHEMA_VERSION,
          format: FORMAT_16_9,
          pages: [{ id: "one", background, elements: [] }, ...morePages],
        } as never
      }
      title="Deck"
      brand={SLIDE_BRAND}
      resolveMedia={resolveMedia}
      onSave={() => true}
      onBack={() => {}}
      onChange={onChange}
      {...(pickMedia === undefined ? {} : { pickMedia })}
    />,
  );
  const last = () => onChange.mock.lastCall?.[0];
  return {
    stored: () => last()?.pages[0]!.background,
    elements: () => last()?.pages[0]!.elements,
    byId: (id: string) => last()?.pages.find((page) => page.id === id)?.background,
    pageIds: () => last()?.pages.map((page) => page.id),
  };
}

const section = () => screen.getByTestId("slide-editor-background");
const percent = () =>
  within(section()).getByRole<HTMLInputElement>("spinbutton", { name: "Zoom (%)" });
const offset = (axis: "X" | "Y") =>
  within(section()).getByRole<HTMLInputElement>("spinbutton", { name: `Offset ${axis}` });
const image = (crop: Crop, flipped = false, media = "photo", flippedVertical = false) => ({
  type: "image",
  media: { id: media },
  crop,
  flipped,
  flippedVertical,
});
// The section's medium has loaded: the shift is clamped to its reach.
const loaded = () =>
  waitFor(() => expect(screen.getByTestId("slide-editor-background-offsetX-range")).toBeVisible());

// SUI-DESIGN-002 rev 10 (Q&A #5206): with nothing selected, the layout tab sets the page's
// background image: its crop by the fields of an image's crop, the flip toggle and "Change image".
describe("SlideEditor background image", () => {
  it("shows the section only for an image background", () => {
    renderEditor({ type: "color", color: { kind: "free", value: "#fff" } });
    expect(screen.queryByTestId("slide-editor-background")).toBeNull();
    cleanup();
    renderEditor(image({ zoom: 1, offsetX: 0, offsetY: 0 }));
    expect(section()).toHaveTextContent("Background");
    expect(percent()).toHaveValue("100");
  });

  it("zooms about the page's centre and clamps the shift to the image's reach on the page", async () => {
    const { stored } = renderEditor(image({ zoom: 1, offsetX: 0, offsetY: 0 }));
    await loaded();
    // At 100 % a 16:9 image on a 16:9 page reaches nowhere past it.
    expect(screen.getByTestId("slide-editor-background-offsetX-range")).toHaveTextContent(
      "Zoom in to shift the image.",
    );
    fireEvent.change(percent(), { target: { value: "150" } });
    fireEvent.blur(percent());
    expect(stored()).toMatchObject({ crop: { zoom: 1.5, offsetX: 0, offsetY: 0 } });
    // 2880 × 1620 on 1920 × 1080: 480 px each way across, 270 px down and up.
    expect(screen.getByTestId("slide-editor-background-offsetX-range")).toHaveTextContent(
      "From −480 to 480 px",
    );
    fireEvent.change(offset("X"), { target: { value: "-900" } });
    fireEvent.blur(offset("X"));
    fireEvent.change(offset("Y"), { target: { value: "40" } });
    fireEvent.blur(offset("Y"));
    expect(stored()).toEqual(image({ zoom: 1.5, offsetX: -480, offsetY: 40 }));
  });

  // #495 as for an image's crop: a prefix typed on the way (100 on the way to 1000) leaves no trace.
  it("zooms a typed number from the crop the typing started with", async () => {
    const { stored } = renderEditor(image({ zoom: 1.5, offsetX: -300, offsetY: 0 }));
    await loaded();
    // 100 % on the way drops the shift for that moment (zoom 1 reaches nowhere past the page) …
    fireEvent.change(percent(), { target: { value: "100" } });
    expect(offset("X")).toHaveValue("0");
    // … and 1000 %, clamped to 500 % on leaving, zooms from the crop the typing started with.
    fireEvent.change(percent(), { target: { value: "1000" } });
    fireEvent.blur(percent());
    expect(stored()).toMatchObject({ crop: { zoom: 5, offsetX: -1000 } });
  });

  // #764 review: a crop changed elsewhere while the % field is being typed in (here the slider) ends
  // that typing: the next typed number zooms from the crop as it is then, never from the older one.
  it("restarts the typing after the crop changed elsewhere", async () => {
    renderEditor(image({ zoom: 2, offsetX: -900, offsetY: 0 }));
    await loaded();
    // 150 % from 200 %: −675, held at the reach of 480.
    fireEvent.change(percent(), { target: { value: "150" } });
    expect(offset("X")).toHaveValue("-480");
    // The slider's step zooms from the crop as it is: 151 %, −483.2.
    const slider = within(section()).getByRole("slider", { name: "Zoom" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuetext", "151%");
    expect(offset("X")).toHaveValue("-483.2");
    // 300 % from 151 %: −960; from the typing's 200 % it would be −1350.
    fireEvent.change(percent(), { target: { value: "300" } });
    expect(offset("X")).toHaveValue("-960");
  });

  // #769 CX1: Undo and Redo bring back the crop the typing set last, the % field keeping the focus;
  // the next typing starts from that crop, never from the one the earlier typing began at.
  it("restarts the typing after Undo and Redo", async () => {
    renderEditor(image({ zoom: 1.5, offsetX: -200, offsetY: 0 }));
    await loaded();
    fireEvent.change(percent(), { target: { value: "100" } });
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(offset("X")).toHaveValue("-200");
    fireEvent.click(screen.getAllByTestId("editor-redo")[0]!);
    expect(offset("X")).toHaveValue("0");
    // 200 % from 100 %: still centred; from the typing's 150 % it would be −266.67.
    fireEvent.change(percent(), { target: { value: "200" } });
    expect(within(section()).getByRole("slider", { name: "Zoom" })).toHaveAttribute(
      "aria-valuetext",
      "200%",
    );
    expect(offset("X")).toHaveValue("0");
  });

  it("flips the background with a toggle whose label stays", () => {
    const { stored } = renderEditor(image({ zoom: 1.5, offsetX: -120, offsetY: 40 }));
    const flip = screen.getByTestId("slide-editor-background-flip");
    expect(flip).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(flip);
    expect(flip).toHaveAttribute("aria-pressed", "true");
    expect(flip).toHaveTextContent("Flip");
    expect(stored()).toEqual(image({ zoom: 1.5, offsetX: -120, offsetY: 40 }, true));
  });

  // SUI-FEATURE-135: "Flip vertically" next to "Flip horizontally", each its own step.
  it("flips the background vertically with its own toggle next to the horizontal one", () => {
    const { stored } = renderEditor(image({ zoom: 1.5, offsetX: -120, offsetY: 40 }));
    const horizontal = screen.getByTestId("slide-editor-background-flip");
    const vertical = screen.getByTestId("slide-editor-background-flip-vertical");
    expect(horizontal).toHaveAccessibleName("Flip horizontally");
    expect(vertical).toHaveAccessibleName("Flip vertically");
    expect(vertical).toHaveAccessibleDescription(
      "Mirrors the background image vertically; the page's content stays as it is.",
    );
    fireEvent.click(vertical);
    expect(vertical).toHaveAttribute("aria-pressed", "true");
    expect(horizontal).toHaveAttribute("aria-pressed", "false");
    expect(stored()).toEqual(
      image({ zoom: 1.5, offsetX: -120, offsetY: 40 }, false, "photo", true),
    );
    fireEvent.click(horizontal);
    expect(stored()).toEqual(image({ zoom: 1.5, offsetX: -120, offsetY: 40 }, true, "photo", true));
    const drawn = document.querySelector<HTMLImageElement>("[data-slot=slide-page] > img")!;
    expect(drawn.style.transform).toBe("scale(-1, -1)");
  });

  // SUI-FEATURE-135: flipped vertically, the y field reads and steps the shift as drawn.
  it("reads and steps a vertically flipped background's y shift the way it goes on screen", async () => {
    const { stored } = renderEditor(
      image({ zoom: 1.5, offsetX: -120, offsetY: 40 }, false, "photo", true),
    );
    await loaded();
    expect(offset("Y")).toHaveValue("-40");
    fireEvent.keyDown(offset("Y"), { key: "ArrowUp" });
    fireEvent.blur(offset("Y"));
    expect(stored()).toEqual(
      image({ zoom: 1.5, offsetX: -120, offsetY: 39 }, false, "photo", true),
    );
  });

  // GL-UI-035: the user picking another image resets the crop and the flip; a cancel changes nothing.
  it("resets crop and flip when the user picks another image", async () => {
    const answers: (PickedMedia | undefined)[] = [
      undefined,
      { id: "other", width: 1000, height: 1000 },
    ];
    const pickMedia = vi.fn(() => Promise.resolve(answers.shift()));
    const { stored } = renderEditor(
      image({ zoom: 1.5, offsetX: -120, offsetY: 40 }, true),
      pickMedia,
    );
    const replace = screen.getByTestId("slide-editor-background-replace");
    expect(replace).toHaveTextContent("Change image");
    await act(async () => {
      fireEvent.click(replace);
      await Promise.resolve();
    });
    expect(pickMedia).toHaveBeenCalledTimes(1);
    expect(stored()).toBeUndefined();
    await act(async () => {
      fireEvent.click(replace);
      await Promise.resolve();
    });
    expect(stored()).toEqual(image({ zoom: 1, offsetX: 0, offsetY: 0 }, false, "other"));
    expect(screen.getByTestId("slide-editor-background-flip")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  // #764 review: the medium lands on the page shown as the picker opened, found by its id.
  it("sets the picked image on the page it was asked for, even if that page moved meanwhile", async () => {
    let answer: (picked: PickedMedia | undefined) => void = () => {};
    const pickMedia = vi.fn(
      () => new Promise<PickedMedia | undefined>((resolve) => (answer = resolve)),
    );
    const two = image({ zoom: 2, offsetX: 0, offsetY: 0 });
    const { byId, pageIds } = renderEditor(
      image({ zoom: 1.5, offsetX: -120, offsetY: 40 }, true),
      pickMedia,
      [{ id: "two", background: two, elements: [] }],
    );
    fireEvent.click(screen.getByTestId("slide-editor-background-replace"));
    // While the picker is open, page "one" moves below page "two".
    fireEvent.click(screen.getByTestId("drawer-document"));
    fireEvent.click(
      within(screen.getAllByTestId("slide-editor-page-row")[0]!).getByTestId(
        "slide-editor-page-down",
      ),
    );
    expect(pageIds()).toEqual(["two", "one"]);
    await act(async () => {
      answer({ id: "other" });
      await Promise.resolve();
    });
    expect(byId("one")).toEqual(image({ zoom: 1, offsetX: 0, offsetY: 0 }, false, "other"));
    expect(byId("two")).toEqual(two);
  });

  // #764 review: a medium the schema refuses is named where it was asked for and not set.
  it("refuses a picked image the page cannot take", async () => {
    const error = vi.spyOn(toast, "error");
    const pickMedia = vi.fn(() => Promise.resolve({ id: "x".repeat(257) }));
    const { stored } = renderEditor(image({ zoom: 1.5, offsetX: -120, offsetY: 40 }), pickMedia);
    await act(async () => {
      fireEvent.click(screen.getByTestId("slide-editor-background-replace"));
      await Promise.resolve();
    });
    expect(stored()).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "This medium can’t be placed on the page. Choose another one.",
    );
  });

  // #764 review: a medium that does not load clamps the shift to the page's proportions, as an image
  // element's crop does.
  it("clamps the shift of an image that does not load to the page's proportions", async () => {
    const { stored } = renderEditor(image({ zoom: 1.5, offsetX: 0, offsetY: 0 }, false, "broken"));
    await loaded();
    expect(screen.getByTestId("slide-editor-background-offsetX-range")).toHaveTextContent(
      "From −480 to 480 px",
    );
    fireEvent.change(offset("X"), { target: { value: "-900" } });
    fireEvent.blur(offset("X"));
    expect(stored()).toEqual(image({ zoom: 1.5, offsetX: -480, offsetY: 0 }, false, "broken"));
  });

  it("offers no image change without the app's picker", () => {
    renderEditor(image({ zoom: 1, offsetX: 0, offsetY: 0 }));
    expect(screen.queryByTestId("slide-editor-background-replace")).toBeNull();
  });

  // The canvas draws what the section set, as `SlideView` draws a background's crop.
  it("draws the set crop and flip on the canvas", async () => {
    renderEditor(image({ zoom: 1.5, offsetX: -120, offsetY: 40 }, true));
    const drawn = await waitFor(() => {
      const found = document.querySelector<HTMLImageElement>("[data-slot=slide-page] > img");
      expect(found).not.toBeNull();
      return found!;
    });
    expect(drawn.style.transform).toBe("scaleX(-1)");
    expect(parseFloat(drawn.style.width)).toBe(2880);
    expect(parseFloat(drawn.style.left)).toBe(-600);
  });

  // Review #772 (GL-UI-035): flipped about the page's centre, the image is drawn with its shift
  // mirrored; the x field reads and steps that drawn shift, as an image element's does.
  it("reads and steps a flipped background's x shift the way it goes on screen", async () => {
    const { stored } = renderEditor(image({ zoom: 1.5, offsetX: -120, offsetY: 40 }, true));
    await loaded();
    // Stored 120 px left, drawn 120 px right.
    expect(offset("X")).toHaveValue("120");
    fireEvent.keyDown(offset("X"), { key: "ArrowUp" });
    expect(offset("X")).toHaveValue("121");
    fireEvent.blur(offset("X"));
    // Drawn 1 px further right: the stored shift goes 1 px further left.
    expect(stored()).toEqual(image({ zoom: 1.5, offsetX: -121, offsetY: 40 }, true));
    fireEvent.change(offset("X"), { target: { value: "200" } });
    fireEvent.blur(offset("X"));
    expect(stored()).toEqual(image({ zoom: 1.5, offsetX: -200, offsetY: 40 }, true));
  });
});

// SUI-FEATURE-380 AC3: the picker is told what it opens for; a host that takes no argument works on.
describe("SlideEditor media picker context", () => {
  it("opens the picker for the background with its current medium", async () => {
    const pickMedia = vi.fn<(context: PickMediaContext) => Promise<PickedMedia | undefined>>(() =>
      Promise.resolve(undefined),
    );
    renderEditor(image({ zoom: 1, offsetX: 0, offsetY: 0 }), pickMedia);
    await act(async () => {
      fireEvent.click(screen.getByTestId("slide-editor-background-replace"));
      await Promise.resolve();
    });
    expect(pickMedia).toHaveBeenCalledWith({ purpose: "background", current: "photo" });
  });

  it("opens the picker for an insert from the Add drawer, without a current medium", async () => {
    const pickMedia = vi.fn<(context: PickMediaContext) => Promise<PickedMedia | undefined>>(() =>
      Promise.resolve(undefined),
    );
    renderEditor(image({ zoom: 1, offsetX: 0, offsetY: 0 }), pickMedia);
    fireEvent.click(screen.getByTestId("drawer-add"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("slide-editor-library-media"));
      await Promise.resolve();
    });
    expect(pickMedia).toHaveBeenCalledWith({ purpose: "insert" });
  });

  it("still inserts for a host that takes no argument", async () => {
    const { elements } = renderEditor(image({ zoom: 1, offsetX: 0, offsetY: 0 }), () =>
      Promise.resolve({ id: "hills", alt: "Hills" }),
    );
    fireEvent.click(screen.getByTestId("drawer-add"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("slide-editor-library-media"));
      await Promise.resolve();
    });
    expect(elements()).toMatchObject([{ type: "image", media: { id: "hills" } }]);
  });
});
