import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SLIDE_BRAND } from "../../gallery/slide-showcase.js";
import {
  type ColorValue,
  FORMAT_16_9,
  type SlideDocumentInput,
  type SlideElementInput,
  SLIDE_SCHEMA_VERSION,
} from "./schema.js";
import { type ReadonlySlideDocument, SlideEditor, type SlideEditorProps } from "./slide-editor.js";
import { withRecentColor } from "./brand-color-items-internal.js";
import { setUpEditorTestEnv, typeFreeColor as typeFree } from "./test-utils.js";

setUpEditorTestEnv();

const box = { x: 100, y: 100, width: 600, height: 200 };
const primary = { kind: "brand" as const, key: "primary" };
const ELEMENTS: SlideElementInput[] = [
  {
    id: "words",
    name: "Words",
    type: "text",
    ...box,
    runs: [{ text: "One\nTwo" }],
    list: "numbered",
  },
  {
    id: "rule",
    name: "Rule",
    type: "line",
    ...box,
    y: 400,
    height: 40,
    stroke: { color: primary, width: 12 },
    shadow: { color: primary, blur: 8, offsetX: 4, offsetY: 4 },
  },
  {
    id: "facts",
    name: "Facts",
    type: "table",
    ...box,
    y: 600,
    columnWidths: [300, 300],
    rows: [[{ runs: [{ text: "a" }] }, { runs: [{ text: "b" }] }]],
  },
];

// The page of the three elements, as the editor loads it.
const page = (elements: SlideElementInput[]): SlideDocumentInput => ({
  schemaVersion: SLIDE_SCHEMA_VERSION,
  format: FORMAT_16_9,
  pages: [
    {
      id: "one",
      background: { type: "color", color: { kind: "free", value: "#fff" } },
      elements,
    },
  ],
});

function renderEditor(props: Partial<SlideEditorProps> = {}) {
  const onChange = vi.fn<(document: ReadonlySlideDocument) => void>();
  const view = render(
    <SlideEditor
      document={page(ELEMENTS)}
      brand={SLIDE_BRAND}
      title="Colours"
      onBack={() => {}}
      onSave={() => true}
      onChange={onChange}
      {...props}
    />,
  );
  fireEvent.click(screen.getByTestId("drawer-layers"));
  const select = (name: string) => {
    const layer = screen
      .getAllByTestId("slide-editor-layer")
      .find((one) => one.textContent.includes(name))!;
    fireEvent.click(layer.querySelector("button")!);
    // A text's format and a table's cell stand under Content.
    if (name !== "Rule") {
      fireEvent.mouseDown(screen.getByTestId("property-tab-content"), { button: 0 });
    }
  };
  const element = (id: string) =>
    onChange.mock.lastCall?.[0].pages[0]!.elements.find((one) => one.id === id);
  return { view, onChange, select, element };
}

// The options of a colour field, its recent row on its own.
const open = (testId: string) => fireEvent.keyDown(screen.getByTestId(testId), { key: "Enter" });
const optionNames = (testId: string) => {
  open(testId);
  const listbox = screen.getByRole("listbox");
  const recent = screen.queryByTestId(`${testId}-recent`);
  const names = {
    all: within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent),
    recent:
      recent === null
        ? []
        : within(recent)
            .getAllByRole("option")
            .map((option) => option.textContent),
  };
  fireEvent.keyDown(listbox, { key: "Escape" });
  return names;
};
// A brand colour picked from the brand group (the first option of that name), or a recent one.
const pick = (testId: string, name: string, from: "brand" | "recent" = "brand") => {
  open(testId);
  const scope =
    from === "recent" ? screen.getByTestId(`${testId}-recent`) : screen.getByRole("listbox");
  fireEvent.click(within(scope).getAllByRole("option", { name })[0]!);
};

const BRAND_NAMES = Object.values(SLIDE_BRAND.colors).map(({ label }) => label);

// SUI-FEATURE-137 AC1: every colour field of the editor is the shared field — the brand colours by
// their names, then the free entry.
describe("SlideEditor colour field", () => {
  it("is every colour field of the editor, the brand colours named", () => {
    const { select } = renderEditor();
    select("Words");
    expect(optionNames("slide-editor-text-color").all).toEqual([...BRAND_NAMES, "Own colour"]);
    expect(optionNames("slide-editor-list-color").all).toEqual([
      "As the entry",
      ...BRAND_NAMES,
      "Own colour",
    ]);
    select("Rule");
    expect(optionNames("slide-editor-line-color").all).toEqual([...BRAND_NAMES, "Own colour"]);
    expect(optionNames("slide-editor-shadow-color").all).toEqual([...BRAND_NAMES, "Own colour"]);
    select("Facts");
    expect(optionNames("slide-editor-table-fill").all).toEqual([
      "None",
      ...BRAND_NAMES,
      "Own colour",
    ]);
  });

  // AC1: picking a brand colour stores the reference and shows it by name with its swatch.
  it("applies a brand colour as a reference, shown by its name", () => {
    const { select, element } = renderEditor();
    select("Facts");
    pick("slide-editor-table-fill", "Accent");
    expect(element("facts")).toMatchObject({
      rows: [[{ fill: { type: "color", color: { kind: "brand", key: "accent" } } }, {}]],
    });
    expect(screen.getByTestId("slide-editor-table-fill")).toHaveTextContent("Accent");
    pick("slide-editor-table-fill", "None");
    const facts = element("facts");
    expect(facts?.type === "table" ? facts.rows[0]![0] : undefined).not.toHaveProperty("fill");
  });

  // AC2: a free value typed in is applied as a free colour and marked as own colour; an invalid one
  // is refused with the field's error and changes nothing.
  it("applies a typed free colour marked as own, and refuses an invalid one", () => {
    const { select, element, onChange } = renderEditor();
    select("Rule");
    typeFree("slide-editor-line-color", "#ff0000");
    expect(element("rule")).toMatchObject({
      stroke: { color: { kind: "free", value: "#ff0000" }, width: 12 },
    });
    expect(screen.getByTestId("slide-editor-line-color")).toHaveTextContent("Own colour #ff0000");
    expect(screen.getByTestId("slide-editor-line-color-free")).toHaveValue("#ff0000");
    const changes = onChange.mock.calls.length;
    const entry = screen.getByTestId("slide-editor-line-color-free");
    fireEvent.change(entry, { target: { value: "url(evil)" } });
    // Typing alone shows no error; Enter commits and names it at once.
    expect(screen.queryByTestId("slide-editor-line-color-error")).toBeNull();
    fireEvent.keyDown(entry, { key: "Enter" });
    expect(screen.getByTestId("slide-editor-line-color-error")).toHaveTextContent("Not a colour");
    fireEvent.blur(entry);
    expect(onChange.mock.calls.length).toBe(changes);
    expect(screen.getByTestId("slide-editor-line-color-error")).toHaveTextContent("Not a colour");
    // Only the entry is marked invalid, never the select holding a valid colour.
    expect(entry).toHaveAttribute("aria-invalid", "true");
    expect(entry).toHaveAttribute("aria-errormessage", expect.stringMatching(/-free-error$/));
    expect(screen.getByTestId("slide-editor-line-color")).not.toHaveAttribute("aria-invalid");
    fireEvent.change(entry, { target: { value: "rgb(0, 128, 0)" } });
    expect(screen.queryByTestId("slide-editor-line-color-error")).toBeNull();
    fireEvent.blur(entry);
    expect(element("rule")).toMatchObject({
      stroke: { color: { kind: "free", value: "rgb(0, 128, 0)" } },
    });
  });

  // Review #791: what is typed and the open entry belong to the field's target and the history's
  // revision; an Undo drops them.
  it("drops the typed value and the open entry on Undo", () => {
    const { select, element } = renderEditor();
    select("Rule");
    pick("slide-editor-line-color", "Accent");
    pick("slide-editor-line-color", "Own colour");
    const entry = screen.getByTestId("slide-editor-line-color-free");
    fireEvent.change(entry, { target: { value: "#zz" } });
    fireEvent.keyDown(entry, { key: "Enter" });
    expect(screen.getByTestId("slide-editor-line-color-error")).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId("editor-undo")[0]!);
    expect(element("rule")).toMatchObject({ stroke: { color: primary } });
    expect(screen.queryByTestId("slide-editor-line-color-free")).toBeNull();
    expect(screen.queryByTestId("slide-editor-line-color-error")).toBeNull();
  });

  // Review #791: a recent colour like the current one changes nothing — no `onChange`, no step.
  it("applies nothing for a recent colour equal to the current one", () => {
    const onRecentColors = vi.fn<(colors: ColorValue[]) => void>();
    const { select, onChange } = renderEditor({
      recentColors: [{ kind: "brand", key: "primary" }],
      onRecentColors,
    });
    select("Rule");
    pick("slide-editor-line-color", "Primary colour", "recent");
    expect(onChange).not.toHaveBeenCalled();
    expect(onRecentColors).toHaveBeenLastCalledWith([{ kind: "brand", key: "primary" }]);
    expect(screen.getAllByTestId("editor-undo")[0]).toHaveAttribute("aria-disabled", "true");
  });

  // AC3: the colours applied lead the recent row of every field, newest first, deduplicated, at most
  // eight; `onRecentColors` reports them and `onChange` only the document.
  it("keeps the applied colours in the recent row, reported apart from the document", () => {
    const onRecentColors = vi.fn<(colors: ColorValue[]) => void>();
    const { select, onChange } = renderEditor({ onRecentColors });
    select("Rule");
    pick("slide-editor-line-color", "Accent");
    typeFree("slide-editor-shadow-color", "#123abc");
    pick("slide-editor-line-color", "Text");
    pick("slide-editor-shadow-color", "Accent");
    expect(onRecentColors).toHaveBeenLastCalledWith([
      { kind: "brand", key: "accent" },
      { kind: "brand", key: "text" },
      { kind: "free", value: "#123abc" },
    ]);
    // `onChange` reports the four document changes only, and a colour no longer applied lives in the
    // recent row alone: the document does not carry it.
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(onChange.mock.lastCall![0])).not.toContain("123abc");
    select("Words");
    expect(optionNames("slide-editor-text-color").recent).toEqual([
      "Accent",
      "Text",
      "Own colour #123abc",
    ]);
    // A recent colour applies as any other.
    pick("slide-editor-text-color", "Own colour #123abc", "recent");
    const words = onChange.mock.lastCall![0].pages[0]!.elements.find((one) => one.id === "words");
    expect(words).toMatchObject({
      runs: [{ fill: { type: "color", color: { kind: "free", value: "#123abc" } } }],
    });
    // The document carries no recent colours.
    for (const [document] of onChange.mock.calls) {
      expect(JSON.stringify(document)).not.toMatch(/recent/i);
    }
    for (const colour of ["#000001", "#000002", "#000003", "#000004", "#000005", "#000006"]) {
      typeFree("slide-editor-text-color", colour);
    }
    expect(onRecentColors.mock.lastCall![0]).toHaveLength(8);
    expect(onRecentColors.mock.lastCall![0][0]).toEqual({ kind: "free", value: "#000006" });
    expect(onRecentColors.mock.lastCall![0][7]).toEqual({ kind: "brand", key: "accent" });
    expect(onRecentColors.mock.lastCall![0]).not.toContainEqual({ kind: "brand", key: "text" });
  });

  it("shows the app's recent colours when it holds them", () => {
    const { select } = renderEditor({
      recentColors: [
        { kind: "free", value: "#00ff00" },
        { kind: "brand", key: "muted" },
        { kind: "brand", key: "gone" },
      ],
    });
    select("Rule");
    expect(optionNames("slide-editor-line-color").recent).toEqual(["Own colour #00ff00", "Muted"]);
  });

  // AC4: the brand swatches, the recent row and the free entry are reached and picked by keyboard.
  it("is reached and picked by keyboard", async () => {
    const { select, element } = renderEditor({ recentColors: [{ kind: "brand", key: "text" }] });
    select("Rule");
    const trigger = screen.getByTestId("slide-editor-line-color");
    act(() => trigger.focus());
    fireEvent.keyDown(trigger, { key: "Enter" });
    const recent = within(screen.getByTestId("slide-editor-line-color-recent")).getByRole("option");
    fireEvent.keyDown(recent, { key: "Enter" });
    expect(element("rule")).toMatchObject({ stroke: { color: { kind: "brand", key: "text" } } });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("option", { name: "Own colour" }), { key: "Enter" });
    const entry = await screen.findByTestId("slide-editor-line-color-free");
    // The focus goes on to the entry once the list has closed.
    await waitFor(() => expect(entry).toHaveFocus());
    fireEvent.change(entry, { target: { value: "teal" } });
    fireEvent.keyDown(entry, { key: "Enter" });
    expect(element("rule")).toMatchObject({ stroke: { color: { kind: "free", value: "teal" } } });
  });

  // SUI-FEATURE-135 rev 4 AC4: a shadow switched on takes the set's text colour (`defaults.text`);
  // without it (or with a key the set lacks) the set's first key.
  it.each([
    [{ text: "accent" }, "accent"],
    [undefined, "background"],
    [{ text: "gone" }, "background"],
  ])("switches a shadow on in the brand's text colour (defaults %o)", (defaults, key) => {
    const { select, element } = renderEditor({
      brand: { ...SLIDE_BRAND, ...(defaults === undefined ? {} : { defaults }) },
      document: page([
        {
          id: "rule",
          name: "Rule",
          type: "line",
          ...box,
          stroke: { color: primary, width: 12 },
        },
      ]),
    });
    select("Rule");
    fireEvent.click(screen.getByTestId("slide-editor-shadow"));
    expect(element("rule")).toMatchObject({
      shadow: { color: { kind: "brand", key }, blur: 8, offsetX: 4, offsetY: 4 },
    });
  });

  // Under `readOnly` the text colour shows as text with its swatch, a free one marked as own colour.
  it("shows a free colour under readOnly as text with its swatch", () => {
    const { select } = renderEditor({
      readOnly: true,
      document: page([
        {
          id: "words",
          name: "Words",
          type: "text",
          ...box,
          runs: [
            { text: "One", fill: { type: "color", color: { kind: "free", value: "#abcdef" } } },
          ],
        },
      ]),
    });
    select("Words");
    expect(screen.queryByTestId("slide-editor-text-color")).toBeNull();
    const swatch = screen.getByTestId("slide-editor-readonly-color-swatch");
    expect(swatch.parentElement).toHaveTextContent("Own colour #abcdef");
    expect(swatch).toHaveStyle({ background: "#abcdef" });
  });
});

// Review #791: the recent list drops brand keys the set no longer holds before it keeps eight, and a
// free value repeated in another letter case is the same colour.
describe("withRecentColor", () => {
  it("drops gone brand keys before counting and compares free values in any case", () => {
    const free = (value: string): ColorValue => ({ kind: "free", value });
    const recent = [
      { kind: "brand" as const, key: "gone" },
      free("#FF0000"),
      ...["#000001", "#000002", "#000003", "#000004", "#000005", "#000006"].map(free),
    ];
    const next = withRecentColor(recent, free("#ff0000"), SLIDE_BRAND);
    expect(next).toEqual([free("#ff0000"), ...recent.slice(2)]);
    expect(withRecentColor(next, free("#000007"), SLIDE_BRAND)).toHaveLength(8);
  });
});
