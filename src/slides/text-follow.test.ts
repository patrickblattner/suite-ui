import { describe, expect, it } from "vitest";

import { parseSlideDocument } from "./document.js";
import { FORMAT_16_9, type SlideElement, type SlideElementInput } from "./schema.js";
import {
  changedBoxes,
  followKey,
  followLayout,
  type Measured,
  offersHandle,
  sizedText,
  unfollowsBy,
} from "./text-follow.js";

type Text = Extract<SlideElement, { type: "text" }>;

// The page's elements as the schema makes them.
function elementsOf(elements: SlideElementInput[]): SlideElement[] {
  return parseSlideDocument({
    schemaVersion: 3,
    format: FORMAT_16_9,
    pages: [
      { id: "p", background: { type: "color", color: { kind: "free", value: "#fff" } }, elements },
    ],
  }).pages[0]!.elements;
}

const label = (extra: Partial<Extract<SlideElementInput, { type: "text" }>> = {}) =>
  ({
    id: "label",
    type: "text",
    x: 100,
    y: 100,
    width: 60,
    height: 40,
    runs: [{ text: "Neu" }],
    sizing: "both",
    ...extra,
  }) satisfies SlideElementInput;

// SUI-FEATURE-165 AC1: a badge — a shape behind a text field, inset 8/16/8/16 — in a group.
const badge = (extra: Partial<Extract<SlideElementInput, { type: "text" }>> = {}) =>
  elementsOf([
    {
      id: "badge",
      type: "group",
      x: 84,
      y: 92,
      width: 92,
      height: 56,
      children: [
        {
          id: "back",
          type: "shape",
          shape: "rectangle",
          x: 84,
          y: 92,
          width: 92,
          height: 56,
          follow: { id: "label", inset: { top: 8, right: 16, bottom: 8, left: 16 } },
        },
        label(extra),
      ],
    },
  ]);

const measured = (text: Text, width: number, height: number): Map<string, Measured> =>
  new Map([[text.id, { width, height, key: followKey(text) }]]);

const textIn = (elements: readonly SlideElement[]): Text => {
  const group = elements[0]!;
  const found = group.type === "group" ? group.children[1] : undefined;
  if (found?.type !== "text") throw new Error("expected the label");
  return found;
};

describe("sizes that follow the text (SUI-FEATURE-165)", () => {
  it("grows a left-aligned `both` badge to the right, shape and group with it, inset kept (AC1)", () => {
    const elements = badge();
    // "Neu eingetroffen" measures 180 × 40.
    const laid = followLayout(elements, measured(textIn(elements), 180, 40));
    const group = laid[0]!;
    if (group.type !== "group") throw new Error("expected the group");
    const [back, text] = group.children;
    expect(text).toMatchObject({ x: 100, y: 100, width: 180, height: 40 });
    expect(back).toMatchObject({ x: 84, y: 92, width: 212, height: 56 });
    expect(group).toMatchObject({ x: 84, y: 92, width: 212, height: 56 });
    expect(changedBoxes(elements, laid)).toEqual(
      new Map([
        ["badge", { x: 84, y: 92, width: 212, height: 56 }],
        ["back", { x: 84, y: 92, width: 212, height: 56 }],
        ["label", { x: 100, y: 100, width: 180, height: 40 }],
      ]),
    );
  });

  it("grows a centred one on both sides around its centre, a right-aligned one to the left (AC2)", () => {
    const centred = badge({ align: "center" });
    const text = textIn(followLayout(centred, measured(textIn(centred), 180, 40)));
    expect(text).toMatchObject({ x: 40, width: 180 });
    expect(text.x + text.width / 2).toBe(130);
    const right = badge({ align: "right" });
    expect(textIn(followLayout(right, measured(textIn(right), 180, 40)))).toMatchObject({
      x: -20,
      width: 180,
    });
  });

  it("grows `height` downwards at the same width; middle and bottom grow from their anchor (AC3)", () => {
    const [plain] = elementsOf([label({ sizing: "height", width: 200 })]) as [Text];
    expect(sizedText(plain, measured(plain, 999, 120).get("label"))).toMatchObject({
      x: 100,
      y: 100,
      width: 200,
      height: 120,
    });
    const [middle] = elementsOf([label({ sizing: "height", verticalAlign: "middle" })]) as [Text];
    expect(sizedText(middle, measured(middle, 0, 120).get("label"))).toMatchObject({
      y: 60,
      height: 120,
    });
    const [bottom] = elementsOf([label({ sizing: "height", verticalAlign: "bottom" })]) as [Text];
    expect(sizedText(bottom, measured(bottom, 0, 120).get("label"))).toMatchObject({
      y: 20,
      height: 120,
    });
  });

  it("leaves a fixed field, and a size measured of another text, as they are", () => {
    const [fixed] = elementsOf([label({ sizing: "fixed" })]) as [Text];
    expect(sizedText(fixed, measured(fixed, 180, 40).get("label"))).toBe(fixed);
    const [both] = elementsOf([label()]) as [Text];
    const stale = { width: 180, height: 40, key: followKey({ ...both, runs: [{ text: "Alt" }] }) };
    expect(sizedText(both, stale)).toBe(both);
    // Its own box is not part of what it measured: drawn at the measured size it stays the same.
    expect(followKey({ ...both, x: 5, width: 999 })).toBe(followKey(both));
  });

  it("puts a following shape on its fixed text field too, and keeps an unchanged list", () => {
    const elements = badge({ sizing: "fixed" });
    expect(followLayout(elements, new Map())).toBe(elements);
    // A group's children, as the schema takes a follow only there.
    const [group] = elementsOf([
      {
        id: "g",
        type: "group",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        children: [
          label({ sizing: "fixed" }),
          {
            id: "back",
            type: "shape",
            shape: "rectangle",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            follow: { id: "label", inset: { top: 1, right: 2, bottom: 3, left: 4 } },
          },
        ],
      },
    ]);
    const drifted = group?.type === "group" ? group.children : [];
    expect(followLayout(drifted, new Map())[1]).toMatchObject({
      x: 96,
      y: 99,
      width: 66,
      height: 44,
    });
  });

  it("offers no width handles under `both`, no height handles under `height`, none on a following shape (§Editor)", () => {
    const elements = badge();
    const [back, text] = (elements[0] as Extract<SlideElement, { type: "group" }>).children;
    const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
    expect(handles.filter((handle) => offersHandle(text!, handle))).toEqual([
      "nw",
      "n",
      "ne",
      "se",
      "s",
      "sw",
    ]);
    const height = { ...(text as Text), sizing: "height" as const };
    expect(handles.filter((handle) => offersHandle(height, handle))).toEqual([
      "nw",
      "ne",
      "e",
      "se",
      "sw",
      "w",
    ]);
    expect(handles.filter((handle) => offersHandle(back!, handle))).toEqual([]);
    // A corner or a height handle drags a followed side; `e`/`w` under `height` do not.
    expect(handles.filter((handle) => unfollowsBy(height, handle))).toEqual([
      "nw",
      "n",
      "ne",
      "se",
      "s",
      "sw",
    ]);
    expect(handles.every((handle) => unfollowsBy(text!, handle))).toBe(true);
    expect(
      handles.some((handle) => unfollowsBy({ ...(text as Text), sizing: "fixed" }, handle)),
    ).toBe(false);
  });
});
