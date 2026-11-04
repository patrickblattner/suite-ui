import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { Button } from "../ui/button.js";
import { isCompositionKey } from "../ui/composition.js";
import { Field } from "../ui/field.js";
import { Input } from "../ui/input.js";
import { helpIdFor } from "../ui/label-with-help.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { LockedFieldHint, LockedTrigger } from "./element-lock-internal.js";
import type { SlideBrandSet } from "./brand.js";
import { SlideColorField } from "./brand-color-items-internal.js";
import type { Box } from "./editor-ops.js";
import { NumberField } from "./number-field.js";
import {
  formatOfRange,
  INLINE_CHARACTER,
  inlineAt,
  insertRuns,
  insertText,
  normalizeRuns,
  type RunFormatPatch,
  runFormat,
  sliceRuns,
  textOf,
} from "./editor-text.js";
import {
  cssColor,
  cssFill,
  cssFont,
  DEFAULT_FONT,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  glueInline,
  inkRun,
  inlineLift,
  largest,
  LINE_SEPARATOR,
  linesOf,
  num,
  type Piece,
  paragraphRun,
  paragraphs,
  px,
} from "./render-style.js";
import {
  type InlineRun,
  isTextRun,
  type NumberedList,
  type Run,
  runSchema,
  SLIDE_LIMITS,
  type SlideElement,
  type TextRun,
} from "./schema.js";
import { isSlideIcon, useSlideIcons } from "./use-slide-assets.js";

// What a text field and a table cell share: runs and the field's alignment, line height and list.
export type TextBody = {
  runs: Run[];
  align: "left" | "center" | "right" | "justify";
  lineHeight: number;
  list: "none" | "bullet" | "numbered";
  verticalAlign: "top" | "middle" | "bottom";
  // A text field's styled numbered list (`SUI-FEATURE-124`); a table cell has none.
  numbered?: NumberedList | undefined;
};

// A range of the field's text as character offsets, a paragraph's end counted as one.
export type TextRange = { start: number; end: number };

// The largest size the size field takes, in px of the format.
export const MAX_TEXT_SIZE = 1000;

// The CSS of a run as the view draws it (`slide-view.tsx` `runSpan`), as DOM style values.
function runStyle(run: TextRun, brand: SlideBrandSet): Partial<Record<string, string>> {
  const font = cssFont(run.font ?? DEFAULT_FONT, brand);
  const style: Partial<Record<string, string>> = {
    fontFamily: "css" in font ? font.css : "",
    fontSize: px(run.size ?? DEFAULT_TEXT_SIZE),
    // Its own, never the paragraph block's first run's (#724).
    fontWeight: String(run.weight ?? 400),
    fontStyle: run.italic === true ? "italic" : "normal",
    letterSpacing: run.letterSpacing === undefined ? "" : px(run.letterSpacing),
    textTransform: run.uppercase === true ? "uppercase" : "",
    backgroundColor:
      run.highlight === undefined ? "" : (cssColor(run.highlight, brand) ?? "transparent"),
  };
  if (run.fill === undefined) {
    style.color = cssColor(DEFAULT_TEXT_COLOR, brand) ?? "#000000";
  } else if (run.fill.type === "color") {
    style.color = cssColor(run.fill.color, brand) ?? "";
  } else {
    style.color = "transparent";
    style.backgroundImage = cssFill(run.fill, brand) ?? "";
    style.backgroundClip = "text";
    style.webkitBackgroundClip = "text";
  }
  return style;
}

// The drawing of an inline run inside its paragraph's span (`SUI-FEATURE-164`), placed as the view
// places it (`slide-view.tsx` `inlineSpan`), in the colour of `ink` (`inkRun`).
export type InlineDrawing = (
  run: InlineRun,
  ink: TextRun | undefined,
  document: Document,
) => Element;

// An inline run in the field shows that the pointer selects it and, while selected, an outline
// (`markSelectedInline`); the outline is the editor's alone, the view draws none.
const INLINE_RUN_CLASS =
  "cursor-pointer rounded-xs outline-offset-1 not-data-[selected]:hover:outline-1 not-data-[selected]:hover:outline-ring data-[selected]:outline-2 data-[selected]:outline-ring";

// Marks the inline run the range covers exactly (`inlineAt`) as selected, and no other.
function markSelectedInline(root: HTMLElement, runs: readonly Run[], range: TextRange | undefined) {
  const selected = inlineAt(runs, range)?.index;
  for (const span of root.querySelectorAll<HTMLElement>("[data-inline]")) {
    span.toggleAttribute("data-selected", span.dataset.run === String(selected));
  }
}

// A paragraph block's size and font, as the view draws them (`slide-view.tsx` `textContent`): its
// line box starts from its own first run's font, not the page's (#717).
function paragraphStyle(
  block: HTMLElement,
  pieces: readonly Piece[],
  runs: readonly Run[],
  brand: SlideBrandSet,
) {
  const paragraph = paragraphRun(pieces, runs);
  block.style.fontSize = px(paragraph?.size ?? runs.find(isTextRun)?.size ?? DEFAULT_TEXT_SIZE);
  const font = paragraph === undefined ? undefined : cssFont(paragraph.font ?? DEFAULT_FONT, brand);
  block.style.fontFamily = font !== undefined && "css" in font ? font.css : "";
  block.style.fontWeight = paragraph?.weight === undefined ? "" : String(paragraph.weight);
  block.style.fontStyle = paragraph?.italic === true ? "italic" : "";
}

// After typing the browser keeps a paragraph's old style: each block takes its paragraph's again,
// as long as the blocks are the paragraphs one by one; a styled numbered list numbers them again.
function syncParagraphs(
  root: HTMLElement,
  runs: readonly Run[],
  brand: SlideBrandSet,
  numbered?: NumberedList,
) {
  const blocks = [...root.children].filter((node): node is HTMLElement => BLOCKS.has(node.tagName));
  const all = paragraphs(runs);
  if (blocks.length !== root.children.length || blocks.length !== all.length) return;
  blocks.forEach((block, index) => paragraphStyle(block, all[index]!, runs, brand));
  if (numbered !== undefined) numberBlocks(root, blocks, runs, brand, numbered);
}

// Text typed outside a run's span would inherit its paragraph block's first-run font (#717): it goes
// into a span drawn in the run it is read into (`readRuns`), as the view draws it after a refill
// (#725). The span names no run, so reading the field back is the same; the caret stays where it is.
function styleStray(root: HTMLElement, stray: ReadonlyMap<Text, TextRun>, brand: SlideBrandSet) {
  const range = rangeIn(root);
  let moved = false;
  for (const [text, run] of stray) {
    let span = text.parentElement;
    if (span === null || !span.hasAttribute("data-stray")) {
      span = root.ownerDocument.createElement("span");
      span.dataset.stray = "";
      text.replaceWith(span);
      span.append(text);
      moved = true;
    }
    Object.assign(span.style, runStyle(run, brand));
  }
  if (moved && range !== undefined) selectRange(root, range);
}

// The number of a block in a styled numbered list, as generated content: an inline box at the start
// of its first line in the column before its hanging text, styled by the block's `--slide-marker-*`.
// Its part below the baseline takes no room in the line (a negative bottom margin): as in the view,
// the entry's next lines run beside the number, and the block is at least the number's line high.
const MARKER_CLASS =
  "before:inline-block before:content-[attr(data-number)] before:[width:var(--slide-marker-column)] before:[margin-left:calc(-1*var(--slide-marker-indent))] before:[margin-right:var(--slide-marker-gap)] before:[margin-bottom:-10em] before:text-left before:indent-0 before:whitespace-nowrap before:select-none before:[font-family:var(--slide-marker-family)] before:[font-size:var(--slide-marker-size)] before:[font-weight:var(--slide-marker-weight)] before:[font-style:var(--slide-marker-style)] before:[color:var(--slide-marker-color)]";

// A styled numbered list in the field (`SUI-FEATURE-124`), laid out as the view lays it out: each
// block carries its number (`data-number`), drawn before its text (`MARKER_CLASS`) as an inline box
// in the first line, so number and first line share a
// baseline and a taller number pushes the line down; the block's text hangs at column + `markerGap`,
// the column as wide as the widest number; `entryGap` between blocks. The number is no text of the
// field: the caret never enters it and reading the field back never sees it.
function numberBlocks(
  root: HTMLElement,
  blocks: readonly HTMLElement[],
  runs: readonly Run[],
  brand: SlideBrandSet,
  numbered: NumberedList,
) {
  const start = numbered.start ?? 1;
  const all = paragraphs(runs);
  const marker = numbered.marker;
  const sizes = blocks.map((_, index) => {
    const paragraph = all[index] === undefined ? undefined : paragraphRun(all[index], runs);
    return marker?.size ?? paragraph?.size ?? runs.find(isTextRun)?.size ?? DEFAULT_TEXT_SIZE;
  });
  const gap = numbered.markerGap ?? largest(sizes) * 0.5;
  root.dataset.slideNumbered = "";
  // The field's line height (a multiple of the size), which the number's line takes too.
  const lineHeight = Number.parseFloat(root.style.lineHeight) || 1.2;
  // The widest number, measured out of the field in each number's own font.
  const probe = root.ownerDocument.createElement("span");
  probe.style.cssText =
    "position:absolute;visibility:hidden;display:inline-block;white-space:nowrap;left:0;top:0";
  const host = root.parentElement ?? root;
  let column = 0;
  blocks.forEach((block, index) => {
    const paragraph = all[index] === undefined ? undefined : paragraphRun(all[index], runs);
    const font = cssFont(marker?.font ?? paragraph?.font ?? DEFAULT_FONT, brand);
    const color =
      marker?.color !== undefined
        ? cssColor(marker.color, brand)
        : paragraph?.fill === undefined
          ? cssColor(DEFAULT_TEXT_COLOR, brand)
          : cssColor(
              paragraph.fill.type === "color"
                ? paragraph.fill.color
                : paragraph.fill.stops[0]!.color,
              brand,
            );
    const style = {
      "--slide-marker-family": "css" in font ? font.css : "",
      "--slide-marker-size": px(sizes[index]!),
      "--slide-marker-weight": String(marker?.weight ?? paragraph?.weight ?? 400),
      "--slide-marker-style": paragraph?.italic === true ? "italic" : "normal",
      "--slide-marker-color": color ?? "#000000",
    };
    for (const [name, value] of Object.entries(style)) block.style.setProperty(name, value);
    block.dataset.number = String(start + index);
    block.className = MARKER_CLASS;
    block.style.marginTop =
      index === 0 || numbered.entryGap === undefined ? "" : px(numbered.entryGap);
    block.style.paddingLeft = "var(--slide-marker-indent)";
    block.style.minHeight = px(sizes[index]! * lineHeight);
    probe.textContent = String(start + index);
    Object.assign(probe.style, {
      fontFamily: style["--slide-marker-family"],
      fontSize: style["--slide-marker-size"],
      fontWeight: style["--slide-marker-weight"],
      fontStyle: style["--slide-marker-style"],
    });
    host.append(probe);
    column = Math.max(column, Number.parseFloat(getComputedStyle(probe).width) || 0);
    probe.remove();
  });
  root.style.setProperty("--slide-marker-column", px(column));
  root.style.setProperty("--slide-marker-gap", px(gap));
  root.style.setProperty("--slide-marker-indent", px(column + gap));
}

// Fills the editable root with the runs: one block per paragraph, one span per piece that names its
// run (`data-run`), an empty paragraph holding a `<br>` so it keeps its line. An inline run is a span
// the caret cannot enter (`data-inline`), one character to the arrows and the delete keys.
export function fillEditable(
  root: HTMLElement,
  runs: readonly Run[],
  brand: SlideBrandSet,
  list: TextBody["list"],
  inline?: InlineDrawing,
  numbered?: NumberedList,
) {
  const document = root.ownerDocument;
  root.replaceChildren();
  // A styled numbered list numbers its blocks itself (`numberBlocks`).
  const styled = list === "numbered" && numbered !== undefined;
  delete root.dataset.slideNumbered;
  for (const pieces of paragraphs(runs)) {
    const block = document.createElement("div");
    block.dataset.paragraph = "";
    paragraphStyle(block, pieces, runs, brand);
    if (list !== "none" && !styled) {
      block.style.display = "list-item";
      block.style.listStyleType = list === "bullet" ? "disc" : "decimal";
      block.style.marginLeft = "1.2em";
    }
    if (pieces.length === 0) block.append(document.createElement("br"));
    const pieceSpan = (piece: Piece) => {
      const span = document.createElement("span");
      span.dataset.run = String(runs.indexOf(piece.run));
      if (piece.text === undefined) {
        span.dataset.inline = "";
        span.dataset.testid = "slide-editor-text-inline-run";
        span.className = INLINE_RUN_CLASS;
        span.setAttribute("contenteditable", "false");
        const ink = inkRun(pieces, piece, runs);
        if (ink?.highlight !== undefined) {
          span.style.backgroundColor = cssColor(ink.highlight, brand) ?? "transparent";
        }
        if (inline !== undefined) span.append(inline(piece.run, ink, document));
      } else {
        Object.assign(span.style, runStyle(piece.run, brand));
        span.append(...lineNodes(document, piece.text));
      }
      return span;
    };
    // An inline run and the word it touches do not wrap apart, as the view draws them.
    for (const piece of glueInline(pieces)) {
      if (!("glue" in piece)) {
        block.append(pieceSpan(piece));
        continue;
      }
      const glue = document.createElement("span");
      glue.style.whiteSpace = "nowrap";
      glue.append(...piece.glue.map(pieceSpan));
      block.append(glue);
    }
    root.append(block);
  }
  if (list === "numbered" && !styled) root.style.counterReset = "list-item";
  if (styled) {
    const blocks = [...root.children].filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );
    numberBlocks(root, blocks, runs, brand, numbered);
  }
}

type Token =
  | { kind: "text"; node: Text; text: string }
  | { kind: "inline"; node: Element }
  // A line break inside its paragraph (U+2028), a `<br data-line>`: one character of the text.
  | { kind: "line"; node: Element }
  | { kind: "break"; at: [Node, number] };

// A run's text as the field holds it: a `<br data-line>` at each U+2028, as the view draws it
// (`SUI-DESIGN-002` rev 9); a text ending in one gets a zero-width space after, so its empty last
// line keeps its height and takes the caret.
function lineNodes(document: Document, text: string): Node[] {
  const lines = linesOf(text);
  return lines.flatMap((line, index) => {
    const nodes: Node[] = [];
    if (index > 0) {
      const br = document.createElement("br");
      br.dataset.line = "";
      nodes.push(br);
    }
    if (line !== "") nodes.push(document.createTextNode(line));
    else if (index > 0 && index === lines.length - 1) nodes.push(document.createTextNode("\u200B"));
    return nodes;
  });
}

const BLOCKS = new Set(["DIV", "P", "LI"]);
const CONTAINERS = new Set(["UL", "OL"]);

// The DOM position just before a node (`after`: just after it), in its parent.
const beside = (node: Node, after = false): [Node, number] => {
  const parent = node.parentNode!;
  return [parent, Array.prototype.indexOf.call(parent.childNodes, node) + (after ? 1 : 0)];
};

// The editable root as text and paragraph breaks, in reading order: a block starts a paragraph when
// something came before it; a `<br>` breaks a line unless it is the last thing in its block (the
// placeholder of an empty line); a zero-width space is no text.
function tokensOf(root: Node): Token[] {
  const tokens: Token[] = [];
  let content = false;
  let pending = false;
  const breakAt = (at: [Node, number]) => {
    tokens.push({ kind: "break", at });
    content = false;
    pending = false;
  };
  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      const text = (node as Text).data.replace(/\u200B/g, "");
      if (text === "") return;
      if (pending) breakAt([node, 0]);
      tokens.push({ kind: "text", node: node as Text, text });
      content = true;
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    if (element.hasAttribute("data-inline")) {
      if (pending) breakAt(beside(element));
      tokens.push({ kind: "inline", node: element });
      content = true;
      return;
    }
    if (element.tagName === "BR" && element.hasAttribute("data-line")) {
      if (pending) breakAt(beside(element));
      tokens.push({ kind: "line", node: element });
      content = true;
      return;
    }
    if (element.tagName === "BR") {
      let next = element.nextSibling;
      while (next !== null && next.nodeType === 3 && (next as Text).data === "") {
        next = next.nextSibling;
      }
      if (next === null) {
        if (pending) breakAt([element.parentNode!, 0]);
        return;
      }
      const parent = element.parentNode!;
      breakAt([parent, Array.prototype.indexOf.call(parent.childNodes, element) + 1]);
      // The line after a `<br>` exists even when it stays empty.
      content = true;
      return;
    }
    if (BLOCKS.has(element.tagName)) {
      if (content || pending) breakAt([element, 0]);
      element.childNodes.forEach(visit);
      pending = true;
      return;
    }
    if (CONTAINERS.has(element.tagName)) {
      element.childNodes.forEach(visit);
      return;
    }
    element.childNodes.forEach(visit);
  };
  root.childNodes.forEach(visit);
  return tokens;
}

// The runs the editable root holds now: each text takes the format of the run its span names, a text
// outside any span the one before it; paragraphs end in "\n". Text before any span, or an empty
// field, takes the first of the `latest` runs handed on, not a run of `previous` deleted since
// (Codex #401 CX1).
// An inline span is its run again, the one its `data-run` names (`SUI-FEATURE-164`); text typed
// after it takes the format of the text run before it.
// `stray` collects each text outside any run's span with the run it is read into (#725).
export function readRuns(
  root: HTMLElement,
  previous: readonly Run[],
  latest: readonly Run[] = previous,
  stray?: Map<Text, TextRun>,
): Run[] {
  const first: TextRun = latest.find(isTextRun) ?? previous.find(isTextRun) ?? { text: "" };
  const pieces: Run[] = [];
  let last: TextRun = first;
  const named = (node: Element | null | undefined) => {
    const owner = node?.closest("[data-run]");
    const index =
      owner !== null && owner !== undefined && root.contains(owner)
        ? Number(owner.getAttribute("data-run"))
        : NaN;
    return Number.isInteger(index) ? previous[index] : undefined;
  };
  for (const token of tokensOf(root)) {
    if (token.kind === "break") {
      const end = pieces.at(-1);
      if (end === undefined || end.inline !== undefined) {
        pieces.push({ ...runFormat(last), text: "\n" });
      } else {
        pieces[pieces.length - 1] = { ...end, text: `${end.text}\n` };
      }
      continue;
    }
    if (token.kind === "inline") {
      const run = named(token.node);
      if (run?.inline !== undefined) pieces.push(run);
      continue;
    }
    if (token.kind === "line") {
      const own = named(token.node);
      const run = own?.inline === undefined ? (own ?? last) : last;
      last = run;
      pieces.push({ ...runFormat(run), text: LINE_SEPARATOR });
      continue;
    }
    const own = named(token.node.parentElement);
    const run = own?.inline === undefined ? (own ?? last) : last;
    last = run;
    if (own === undefined) stray?.set(token.node, run);
    pieces.push({ ...runFormat(run), text: token.text });
  }
  return normalizeRuns(pieces.length === 0 ? [{ ...runFormat(first), text: "" }] : pieces);
}

const lengthOf = (tokens: readonly Token[]) =>
  tokens.reduce((sum, token) => sum + (token.kind === "text" ? token.text.length : 1), 0);

// The offset of a DOM position in the root's text.
function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  const range = root.ownerDocument.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  const holder = root.ownerDocument.createElement("div");
  holder.append(range.cloneContents());
  return lengthOf(tokensOf(holder));
}

// The selection's range in the root, or `undefined` when it lies elsewhere.
export function rangeIn(root: HTMLElement): TextRange | undefined {
  const selection = root.ownerDocument.getSelection();
  if (selection === null || selection.rangeCount === 0) return undefined;
  const { anchorNode, focusNode } = selection;
  if (anchorNode === null || focusNode === null) return undefined;
  if (!root.contains(anchorNode) || !root.contains(focusNode)) return undefined;
  const range = selection.getRangeAt(0);
  return {
    start: offsetOf(root, range.startContainer, range.startOffset),
    end: offsetOf(root, range.endContainer, range.endOffset),
  };
}

// The offset in a text node's data of the `offset`-th character not a zero-width space: text typed
// after the placeholder of a trailing line break goes into its node (Codex v0.203.0 CX1, #733).
function dataOffset(data: string, offset: number): number {
  let seen = 0;
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] === "\u200B") continue;
    if (seen === offset) return index;
    seen += 1;
  }
  return data.length;
}

// The DOM position of a text offset in the root.
function positionAt(root: HTMLElement, offset: number): [Node, number] {
  let at = 0;
  let last: [Node, number] = [root.firstChild ?? root, 0];
  for (const token of tokensOf(root)) {
    if (token.kind === "text") {
      if (offset <= at + token.text.length) {
        // Offsets count the text without zero-width spaces; the node may still hold one.
        return [token.node, dataOffset(token.node.data, Math.max(0, offset - at))];
      }
      at += token.text.length;
      last = [token.node, token.node.data.length];
    } else if (token.kind === "inline" || token.kind === "line") {
      if (offset <= at) return beside(token.node);
      at += 1;
      last = beside(token.node, true);
      if (offset <= at) return last;
    } else {
      at += 1;
      last = token.at;
      if (offset <= at) return token.at;
    }
  }
  return last;
}

// Selects the text from `start` to `end` in the root.
export function selectRange(root: HTMLElement, range: TextRange) {
  const selection = root.ownerDocument.getSelection();
  if (selection === null) return;
  const length = lengthOf(tokensOf(root));
  const [startNode, startOffset] = positionAt(root, Math.min(range.start, length));
  const [endNode, endOffset] = positionAt(root, Math.min(range.end, length));
  const dom = root.ownerDocument.createRange();
  dom.setStart(startNode, startOffset);
  dom.setEnd(endNode, endOffset);
  selection.removeAllRanges();
  selection.addRange(dom);
}

const isMod = (event: React.KeyboardEvent) => event.metaKey || event.ctrlKey;

// Text editing on the canvas (`SUI-FEATURE-161` §Text): an editable field laid over the text where it
// is drawn — turned with it and its groups, at the canvas's zoom — that types into the runs, keeping
// each run's format. `Esc` ends the editing (`GL-UI-007` §von innen nach aussen: the selection stays,
// the next `Esc` goes on outwards). Enter starts a new paragraph; a paste takes plain text. Undo and
// Redo go to the editor's history, so a step taken back is the field's own too. The canvas frame is
// `select-none`; the field sets `select-text` itself (Safari leaves `user-select: none` on its
// editable descendants, #317).
// Inline runs (`SUI-FEATURE-164`) are drawn in the field as the view draws them, the canvas leaving
// their ink to it as it leaves the text's; a copy inside the editor keeps them with the text's format
// (`RUNS_MIME`), so a paste of it brings them back.
export function InlineTextEditor({
  body,
  brand,
  resolveMedia,
  focusRequest = 0,
  frame,
  inner,
  padding = 0,
  unwrapped = false,
  zoom,
  label,
  range,
  onRuns,
  onRange,
  onEnd,
  onUndo,
  onRedo,
  onToggle,
  onTab,
  onComposing,
}: {
  body: TextBody;
  brand: SlideBrandSet;
  // The URL of a media id of the app, for an inline image.
  resolveMedia?: ((id: string) => string | undefined) | undefined;
  // A new count takes the focus back into the field, at `range` (an inline run put in from outside).
  focusRequest?: number;
  // Where the element is drawn on the page and its turn.
  frame: { box: Box; rotation: number };
  // The field's box in the element (a table cell's), px of the format; the whole element without.
  inner?: Box | undefined;
  padding?: number;
  // The field's width follows its text (`sizing` `both`, `SUI-FEATURE-165`): no automatic wraps, as
  // the view draws it, from the moment the sizing changes.
  unwrapped?: boolean;
  zoom: number;
  label: string;
  // The range the field selects again after its runs changed from outside (a format, Undo).
  range: TextRange | undefined;
  // `false` when the runs are refused (past a limit, `SUI-FEATURE-114`): the field keeps its text.
  onRuns: (runs: Run[], range: TextRange | undefined) => boolean;
  onRange: (range: TextRange) => void;
  onEnd: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggle: (format: "bold" | "italic", range: TextRange | undefined) => void;
  // Tab (`back` with Shift) in a table cell: `true` when the editing went on to the next cell, so the
  // key stays in the field; `false` lets the focus leave as usual.
  onTab?: ((back: boolean) => boolean) | undefined;
  // A composition (dead key, IME) starts and ends in the field; the panel's formats do nothing till
  // then (GL-UI-039 rev 2, #736).
  onComposing?: ((on: boolean) => void) | undefined;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  // The icons of the field's inline runs, drawn once out of sight and copied into the field.
  const iconNames = [
    ...new Set(
      body.runs.flatMap((run) =>
        run.inline === "icon" && isSlideIcon(run.icon) ? [run.icon] : [],
      ),
    ),
  ];
  const { icons } = useSlideIcons(iconNames);
  const iconsKey = JSON.stringify([...icons.keys()]);
  const iconSource = React.useRef<HTMLDivElement>(null);
  const media = React.useRef(resolveMedia);
  // Called in effects and handlers only, where the icons drawn out of sight are there.
  const inline = React.useCallback<InlineDrawing>(
    (run, ink, document) =>
      inlineNode(document, run, ink, brand, media.current, iconSource.current),
    [brand],
  );
  // The runs this field last handed on: the same runs coming back need no refill, unless the list
  // it was filled with or the icons it draws changed.
  const emitted = React.useRef<Run[] | null>(null);
  const filledList = React.useRef(body.list);
  // The styled numbered list the field was filled with (`SUI-FEATURE-124`).
  const numbered = body.list === "numbered" ? body.numbered : undefined;
  const filledNumbered = React.useRef(numbered);
  const filledIcons = React.useRef(iconsKey);
  // The runs the field was last filled with: its spans' `data-run` name their index there, also
  // after the runs it handed on were normalised (Codex #398 CX1).
  const filled = React.useRef<readonly Run[]>(body.runs);
  const latestRange = React.useRef(range);
  const onRangeRef = React.useRef(onRange);
  React.useLayoutEffect(() => {
    latestRange.current = range;
    onRangeRef.current = onRange;
    media.current = resolveMedia;
  });
  // A dead key or an IME is composing in the field, and where the selection was as it began (#736).
  const composingRef = React.useRef(false);
  const composedFromRef = React.useRef<TextRange | undefined>(undefined);
  const composingEnded = React.useEffectEvent(() => onComposing?.(false));
  const first = React.useRef(true);
  React.useLayoutEffect(() => {
    const node = root.current;
    if (node === null) return;
    if (
      body.runs === emitted.current &&
      body.list === filledList.current &&
      numbered === filledNumbered.current &&
      iconsKey === filledIcons.current &&
      !first.current
    ) {
      return;
    }
    emitted.current = body.runs;
    filledList.current = body.list;
    filledNumbered.current = numbered;
    filledIcons.current = iconsKey;
    filled.current = body.runs;
    // A refill ends what the field took for a composition, should its `compositionend` never come.
    if (composingRef.current) {
      composingRef.current = false;
      composingEnded();
    }
    fillEditable(node, body.runs, brand, body.list, inline, numbered);
    if (first.current) {
      first.current = false;
      node.focus();
      const end = textOf(body.runs).length;
      selectRange(node, latestRange.current ?? { start: end, end });
      return;
    }
    if (node.ownerDocument.activeElement === node && latestRange.current !== undefined) {
      selectRange(node, latestRange.current);
    }
  }, [body.runs, body.list, numbered, brand, iconsKey, inline]);
  React.useLayoutEffect(() => {
    const node = root.current;
    if (focusRequest === 0 || node === null) return;
    node.focus();
    if (latestRange.current !== undefined) selectRange(node, latestRange.current);
  }, [focusRequest]);
  // The selection as it moves, so a format from the panel knows its range after the focus left.
  React.useEffect(() => {
    const node = root.current;
    if (node === null) return;
    const onChange = () => {
      const now = rangeIn(node);
      markSelectedInline(node, filled.current, now);
      if (now !== undefined) onRangeRef.current(now);
    };
    node.ownerDocument.addEventListener("selectionchange", onChange);
    return () => node.ownerDocument.removeEventListener("selectionchange", onChange);
  }, []);
  const current = () => emitted.current ?? body.runs;
  // The text the browser put in, taken in: the runs follow, or, refused, the field is as it was and
  // the caret back where it was (before a composition, `caret`). The same runs again (Firefox's input
  // after `compositionend`) are no change.
  const takeTyped = (caret?: TextRange) => {
    const node = root.current;
    if (node === null) return;
    const stray = new Map<Text, TextRun>();
    const runs = readRuns(node, filled.current, emitted.current ?? filled.current, stray);
    // The field is still drawn as it reads, stray text in its run's style (#725).
    if (emitted.current !== null && JSON.stringify(runs) === JSON.stringify(emitted.current)) {
      syncParagraphs(node, runs, brand, numbered);
      styleStray(node, stray, brand);
      return;
    }
    emitted.current = runs;
    if (onRuns(runs, rangeIn(node))) {
      syncParagraphs(node, runs, brand, numbered);
      styleStray(node, stray, brand);
      return;
    }
    // Refused: the typed text goes again, the caret back where it was.
    emitted.current = body.runs;
    filled.current = body.runs;
    fillEditable(node, body.runs, brand, body.list, inline, numbered);
    const end = textOf(body.runs).length;
    // Refused at a blur, the field no longer has the focus: a selection would pull it back.
    if (node.ownerDocument.activeElement === node) {
      selectRange(node, caret ?? latestRange.current ?? { start: end, end });
    }
  };
  const startComposing = (range: TextRange | undefined) => {
    composingRef.current = true;
    composedFromRef.current = range;
    onComposing?.(true);
  };
  const endComposing = () => {
    composingRef.current = false;
    takeTyped(composedFromRef.current);
    onComposing?.(false);
  };
  // The field closed mid-composition (a press on the canvas) without a blur first: the composed text is
  // taken in first.
  const endComposingOnClose = React.useEffectEvent(() => {
    if (composingRef.current) endComposing();
  });
  React.useLayoutEffect(() => () => endComposingOnClose(), []);
  // Text put in by the editor itself (a paragraph, a paste): the runs refill and the caret follows.
  // Runs (a paste of a copy inside the editor) come in with their own format.
  const put = (text: string | readonly Run[]) => {
    const node = root.current;
    if (node === null) return;
    const at = rangeIn(node) ?? { start: 0, end: 0 };
    const runs =
      typeof text === "string"
        ? insertText(current(), at.start, at.end, text)
        : insertRuns(current(), at.start, at.end, text);
    const caret =
      Math.min(at.start, at.end) + (typeof text === "string" ? text : textOf(text)).length;
    const before = emitted.current;
    emitted.current = null;
    // Refused, nothing was put in: the field is as it was.
    if (!onRuns(runs, { start: caret, end: caret })) emitted.current = before;
  };
  const area = inner ?? { x: 0, y: 0, width: frame.box.width, height: frame.box.height };
  const font = cssFont(DEFAULT_FONT, brand);
  return (
    <div
      className="absolute z-[3]"
      style={{
        left: frame.box.x * zoom,
        top: frame.box.y * zoom,
        width: frame.box.width * zoom,
        height: frame.box.height * zoom,
        transform: frame.rotation === 0 ? undefined : `rotate(${num(frame.rotation)}deg)`,
      }}
      data-testid="slide-editor-text-editor"
    >
      <div
        className="relative origin-top-left"
        style={{
          width: px(frame.box.width),
          height: px(frame.box.height),
          transform: `scale(${num(zoom)})`,
          // The page's own text defaults, as the view sets them.
          color: cssColor(DEFAULT_TEXT_COLOR, brand) ?? "#000000",
          fontFamily: "css" in font ? font.css : undefined,
          fontSize: px(DEFAULT_TEXT_SIZE),
          fontWeight: 400,
          lineHeight: "normal",
        }}
      >
        <div
          className="absolute flex flex-col"
          style={{
            left: px(area.x),
            top: px(area.y),
            width: px(area.width),
            height: px(area.height),
            padding: px(padding),
            boxSizing: "border-box",
            justifyContent: { top: "flex-start", middle: "center", bottom: "flex-end" }[
              body.verticalAlign
            ],
          }}
        >
          <div
            ref={root}
            role="textbox"
            aria-multiline="true"
            aria-label={label}
            contentEditable
            suppressContentEditableWarning
            className="cursor-text outline-none select-text"
            style={{
              textAlign: body.align,
              lineHeight: num(body.lineHeight),
              whiteSpace: unwrapped ? "pre" : "pre-wrap",
              overflowWrap: "break-word",
              margin: 0,
              paddingLeft: 0,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            // A click on an inline run selects it, so the panel shows its height and alt text.
            onClick={(event) => {
              const span = (event.target as Element).closest?.("[data-inline]");
              const node = root.current;
              if (span === null || span === undefined || node === null) return;
              const [parent, index] = beside(span);
              const start = offsetOf(node, parent, index);
              selectRange(node, { start, end: start + 1 });
            }}
            onDoubleClick={(event) => event.stopPropagation()}
            // A dead key or an IME composing owns the field until it ends (GL-UI-039 rev 2): no
            // refusal, refill or restyle replaces the text it composes; the finished text is taken in
            // at `compositionend` as typed text is (#736).
            onCompositionStart={(event) => startComposing(rangeIn(event.currentTarget))}
            onCompositionEnd={endComposing}
            // Leaving mid-composition (a `compositionend` that may never come) takes the composed text
            // in, so the field is not left deaf to input.
            onBlur={() => {
              if (composingRef.current) endComposing();
            }}
            onInput={(event) => {
              if (composingRef.current || event.nativeEvent.isComposing) return;
              takeTyped();
            }}
            onCopy={(event) => {
              if (copyRuns(event, current())) event.preventDefault();
            }}
            onCut={(event) => {
              if (!copyRuns(event, current())) return;
              event.preventDefault();
              put([]);
            }}
            onPaste={(event) => {
              event.preventDefault();
              const runs = pastedRuns(event.clipboardData.getData(RUNS_MIME));
              if (runs !== undefined) {
                if (runs.length > 0) put(runs);
                return;
              }
              const text = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
              if (text !== "") put(text);
            }}
            onDrop={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              // Every key stays in the field: the canvas's arrows and Enter are not for it.
              event.stopPropagation();
              // A key of a composition is its own, the Enter that confirms a candidate too (Safari
              // sends that one after `compositionend`, as key code 229) (GL-UI-039 rev 2, #736).
              // Tab and the shortcuts keep off the browser's own action (leaving, its bold or undo).
              if (composingRef.current || isCompositionKey(event)) {
                if (event.key === "Tab" || isMod(event)) event.preventDefault();
                return;
              }
              const key = event.key.toLowerCase();
              if (event.key === "Escape") {
                event.preventDefault();
                onEnd();
              } else if (event.key === "Enter") {
                // Enter starts the next paragraph (in a list the next item), Shift+Enter breaks the
                // line inside it (`SUI-DESIGN-002` rev 9).
                event.preventDefault();
                put(event.shiftKey ? LINE_SEPARATOR : "\n");
              } else if (event.key === "Tab" && !isMod(event) && onTab?.(event.shiftKey)) {
                event.preventDefault();
              } else if (isMod(event) && (key === "y" || (key === "z" && event.shiftKey))) {
                event.preventDefault();
                onRedo();
              } else if (isMod(event) && key === "z") {
                event.preventDefault();
                onUndo();
              } else if (isMod(event) && (key === "b" || key === "i")) {
                event.preventDefault();
                onToggle(key === "b" ? "bold" : "italic", rangeIn(event.currentTarget));
              }
            }}
            data-testid="slide-editor-text-field"
          />
        </div>
      </div>
      {/* The icons of the inline runs, drawn once out of sight for the field to copy. */}
      <div ref={iconSource} hidden aria-hidden="true">
        {iconNames.map((name) => {
          const Icon = icons.get(name);
          return Icon === undefined ? null : <Icon key={name} data-slide-icon={name} />;
        })}
      </div>
    </div>
  );
}

// What a copy inside the editor carries beside its plain text: the runs, inline ones among them
// (`SUI-FEATURE-164`).
export const RUNS_MIME = "application/x-suite-slide-runs";

// Puts the selected runs on the clipboard; `false` when nothing is selected.
function copyRuns(event: React.ClipboardEvent<HTMLElement>, runs: readonly Run[]): boolean {
  const at = rangeIn(event.currentTarget);
  if (at === undefined || at.start === at.end) return false;
  const copied = sliceRuns(runs, at.start, at.end);
  // Plain text has no line separator other apps keep: a line break (U+2028) goes out as "\n" there;
  // the runs keep it.
  event.clipboardData.setData(
    "text/plain",
    textOf(copied).replaceAll(INLINE_CHARACTER, "").replaceAll(LINE_SEPARATOR, "\n"),
  );
  event.clipboardData.setData(RUNS_MIME, JSON.stringify(copied));
  return true;
}

// The runs of a copy inside the editor, checked against the schema; `undefined` when the clipboard
// holds none (or none that pass), so the plain text applies.
function pastedRuns(data: string): Run[] | undefined {
  if (data === "") return undefined;
  try {
    const parsed = runSchema.array().max(SLIDE_LIMITS.maxRuns).safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

// The colour a run's text is drawn in where one colour is needed (`slide-view.tsx` `inkOf`).
function inkOf(run: TextRun | undefined, brand: SlideBrandSet): string {
  const fill = run?.fill;
  const value =
    fill === undefined
      ? DEFAULT_TEXT_COLOR
      : fill.type === "color"
        ? fill.color
        : fill.stops[0]!.color;
  return cssColor(value, brand) ?? "#000000";
}

// An inline run as the field draws it, placed as the view places it (`slide-view.tsx` `inlineSpan`):
// an icon copied from those drawn out of sight in the colour of `ink` (`inkRun`), an image by its URL. What
// the view draws as a stand-in takes its room here and leaves the canvas's stand-in to show.
function inlineNode(
  document: Document,
  run: InlineRun,
  ink: TextRun | undefined,
  brand: SlideBrandSet,
  resolveMedia: ((id: string) => string | undefined) | undefined,
  icons: HTMLElement | null,
): Element {
  const height = `${num(run.height)}em`;
  const place = {
    display: "inline",
    height,
    verticalAlign: "baseline",
    marginTop: `${num(-run.height)}em`,
  };
  const lifted = (node: Element): Element => {
    const lift = inlineLift(run.height);
    if (lift === undefined) return node;
    const box = document.createElement("span");
    Object.assign(box.style, lift);
    box.append(node);
    return box;
  };
  if (run.inline === "icon") {
    const icon = icons?.querySelector(`[data-slide-icon="${CSS.escape(run.icon)}"]`);
    if (icon !== null && icon !== undefined) {
      const copy = icon.cloneNode(true) as SVGElement;
      copy.removeAttribute("data-slide-icon");
      copy.setAttribute("aria-hidden", "true");
      Object.assign(copy.style, place, { width: height, color: inkOf(ink, brand) });
      return lifted(copy);
    }
  } else {
    const src = resolveMedia?.(run.media.id);
    if (src !== undefined) {
      const image = document.createElement("img");
      image.src = src;
      image.alt = run.alt;
      image.draggable = false;
      Object.assign(image.style, place, { width: "auto", maxWidth: "none" });
      return lifted(image);
    }
  }
  const room = document.createElement("span");
  Object.assign(room.style, place, { display: "inline-block", width: height });
  return lifted(room);
}

// The format the range shows: a key the whole range shares, else its default, undefined when mixed.
export function shownFormat(body: TextBody, range: TextRange | undefined) {
  const { start, end } = formatSpan(body, range);
  const { format, mixed } = formatOfRange(body.runs, start, end);
  const font = format.font ?? (mixed.has("font") ? undefined : DEFAULT_FONT);
  const fill =
    format.fill ??
    (mixed.has("fill") ? undefined : { type: "color" as const, color: DEFAULT_TEXT_COLOR });
  const color = fill?.type === "color" ? fill.color : undefined;
  return { start, end, format, mixed, font, color };
}

// The range a format applies to: the selected text, or the whole field without a selection.
export function formatSpan(body: TextBody, range: TextRange | undefined): TextRange {
  return range !== undefined && range.start !== range.end
    ? { start: Math.min(range.start, range.end), end: Math.max(range.start, range.end) }
    : { start: 0, end: textOf(body.runs).length };
}

// Bold or italic switched over the range: on unless all of it has it already.
export function toggledFormat(
  body: TextBody,
  range: TextRange | undefined,
  format: "bold" | "italic",
): RunFormatPatch {
  const span = formatSpan(body, range);
  const { format: common, mixed } = formatOfRange(body.runs, span.start, span.end);
  if (format === "bold") {
    const on = !mixed.has("weight") && (common.weight ?? 400) >= 600;
    return { weight: on ? undefined : 700 };
  }
  const on = !mixed.has("italic") && common.italic === true;
  return { italic: on ? undefined : true };
}

// The text's format in the property panel (`SUI-FEATURE-161` §Text): font, size, weight and italic,
// colour from the brand set, and the field's alignment and list. A format applies to the selected text
// while editing (the whole field without a selection), the field's alignment and list to the field.
export function TextFormatFields({
  testIdPrefix,
  body,
  range,
  brand,
  readOnly,
  revision,
  target = "",
  onFormat,
  onBody,
  onInline,
}: {
  testIdPrefix: string;
  body: TextBody;
  range: TextRange | undefined;
  // What the format is of (element, cell, range): the colour field's typed value belongs to it.
  target?: string;
  brand: SlideBrandSet;
  readOnly: boolean;
  // The history's travel count, for the size field (`NumberField`).
  revision: number;
  onFormat: (patch: RunFormatPatch, merge?: string) => void;
  onBody: (patch: Partial<Pick<TextBody, "align" | "list">>) => void;
  // A change of the inline run the range selects alone (`SUI-FEATURE-164`): its height, an image's
  // alt text; changes in a row under the same `merge` are one step.
  onInline?: ((index: number, patch: InlinePatch, merge: string) => void) | undefined;
}) {
  const { t } = useTranslation("suite");
  // Per instance, so two mounted editors never share a field id (#566); `testIdPrefix` names the test ids.
  const id = React.useId();
  const selectedInline = onInline === undefined ? undefined : inlineAt(body.runs, range);
  const { start, end, format, mixed, font, color } = shownFormat(body, range);
  const fontKey = font?.kind === "brand" ? font.key : undefined;
  const bold = !mixed.has("weight") && (format.weight ?? 400) >= 600;
  const italic = !mixed.has("italic") && format.italic === true;
  const toggle = (
    label: string,
    icon: React.ReactNode,
    pressed: boolean,
    onClick: () => void,
    testId: string,
  ) => (
    // Locked, `disabled` with a reason becomes the focusable `aria-disabled` lock (`SUI-FEATURE-195`).
    <IconButtonTooltip
      label={label}
      disabledText={readOnly ? t("slides.lockedElement") : undefined}
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-pressed={pressed}
        disabled={readOnly}
        className={PRESSED_FILL_CLASS}
        // The text keeps its selection while editing.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        data-testid={`${testIdPrefix}-${testId}`}
      >
        {icon}
      </Button>
    </IconButtonTooltip>
  );
  const mixedText = t("slides.editor.textMixed");
  return (
    <section className="flex flex-col gap-2" data-testid={`${testIdPrefix}-format`}>
      <h3 className="text-base font-semibold">{t("slides.editor.textFormat")}</h3>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4" data-tooltip-row="">
          <Field
            label={t("slides.editor.textFont")}
            htmlFor={`${id}-font`}
            hint={t("slides.editor.textFontHint")}
            valueHint={t("slides.editor.textFontValueHint")}
          >
            <Select
              value={fontKey ?? ""}
              onValueChange={(key) => onFormat({ font: { kind: "brand", key } })}
            >
              <LockedTrigger locked={readOnly}>
                <SelectTrigger
                  id={`${id}-font`}
                  aria-describedby={helpIdFor(`${id}-font`)}
                  fieldName={t("slides.editor.textFont")}
                  className="w-full"
                  data-testid={`${testIdPrefix}-font`}
                >
                  <SelectValue
                    placeholder={mixed.has("font") ? mixedText : t("slides.editor.textOwnFont")}
                  />
                </SelectTrigger>
              </LockedTrigger>
              <SelectContent>
                {Object.entries(brand.fonts).map(([key, { family, label }]) => (
                  <SelectItem key={key} value={key}>
                    {t("slides.editor.textBrandFont", {
                      label,
                      family,
                      interpolation: { escapeValue: false },
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {/* Keyed by the range only: a size typed into it changes the size it shows (#308). */}
          <NumberField
            key={`${start}-${end}`}
            id={`${id}-size`}
            label={t("slides.editor.textSize")}
            hint={t("slides.editor.textSizeHint")}
            valueHint={t("slides.editor.textSizeValueHint")}
            value={mixed.has("size") ? undefined : (format.size ?? DEFAULT_TEXT_SIZE)}
            unit="px"
            readOnly={readOnly}
            revision={revision}
            onValue={(size) => {
              if (size > 0) {
                onFormat({ size: Math.min(MAX_TEXT_SIZE, Math.round(size * 100) / 100) }, "size");
              }
            }}
            testId={`${testIdPrefix}-size`}
          />
          <SlideColorField
            id={`${id}-color`}
            label={t("slides.editor.textColor")}
            hint={t("slides.editor.textColorHint")}
            valueHint={t("slides.editor.textColorValueHint")}
            color={color}
            brand={brand}
            readOnly={readOnly}
            placeholder={mixed.has("fill") ? mixedText : undefined}
            onColor={(next) => {
              if (next !== undefined) onFormat({ fill: { type: "color", color: next } });
            }}
            testId={`${testIdPrefix}-color`}
            target={target}
            revision={revision}
          />
        </div>
        <div className="flex flex-wrap gap-0.5" data-tooltip-row="">
          {toggle(
            t("slides.editor.textBold"),
            <BoldIcon />,
            bold,
            () => onFormat(toggledFormat(body, range, "bold")),
            "bold",
          )}
          {toggle(
            t("slides.editor.textItalic"),
            <ItalicIcon />,
            italic,
            () => onFormat(toggledFormat(body, range, "italic")),
            "italic",
          )}
          {/* Gap and separators as in the table's toolbar: eight buttons and two separators fit the
              panel's default width on one row, a classic scrollbar included (#630, GL-UI-013). */}
          <span className="mx-0.5 w-px self-stretch bg-border" aria-hidden="true" />
          {(
            [
              ["left", AlignLeftIcon],
              ["center", AlignCenterIcon],
              ["right", AlignRightIcon],
              ["justify", AlignJustifyIcon],
            ] as const
          ).map(([align, Icon]) => (
            <React.Fragment key={align}>
              {toggle(
                t(`slides.editor.text${align[0]!.toUpperCase()}${align.slice(1)}`),
                <Icon />,
                body.align === align,
                () => onBody({ align }),
                `align-${align}`,
              )}
            </React.Fragment>
          ))}
          <span className="mx-0.5 w-px self-stretch bg-border" aria-hidden="true" />
          {toggle(
            t("slides.editor.textBullets"),
            <ListIcon />,
            body.list === "bullet",
            () => onBody({ list: body.list === "bullet" ? "none" : "bullet" }),
            "bullets",
          )}
          {toggle(
            t("slides.editor.textNumbered"),
            <ListOrderedIcon />,
            body.list === "numbered",
            () => onBody({ list: body.list === "numbered" ? "none" : "numbered" }),
            "numbered",
          )}
        </div>
        {selectedInline === undefined || onInline === undefined ? null : (
          <section className="flex flex-col gap-2" data-testid={`${testIdPrefix}-inline`}>
            <h4 className="text-sm font-semibold">{t("slides.editor.inlineElement")}</h4>
            <div className="grid grid-cols-2 gap-4" data-tooltip-row="">
              {/* Keyed by the run: another one selected shows its own height. */}
              <NumberField
                key={`${selectedInline.index}-${start}`}
                id={`${id}-inline-height`}
                label={t("slides.editor.inlineHeight")}
                hint={t("slides.editor.inlineHeightHint")}
                valueHint={t("slides.editor.inlineHeightValueHint")}
                value={selectedInline.run.height}
                unit="×"
                min={0.1}
                max={SLIDE_LIMITS.maxInlineHeight}
                readOnly={readOnly}
                revision={revision}
                onValue={(height) => {
                  if (height > 0) {
                    const value = Math.min(
                      SLIDE_LIMITS.maxInlineHeight,
                      Math.round(height * 100) / 100,
                    );
                    onInline(selectedInline.index, { height: value }, "height");
                  }
                }}
                testId={`${testIdPrefix}-inline-height`}
              />
              {selectedInline.run.inline !== "media" ? null : (
                <Field
                  label={t("slides.editor.inlineAlt")}
                  htmlFor={`${id}-inline-alt`}
                  hint={t("slides.editor.inlineAltHint")}
                >
                  <LockedFieldHint readOnly={readOnly}>
                    <Input
                      id={`${id}-inline-alt`}
                      aria-describedby={helpIdFor(`${id}-inline-alt`)}
                      value={selectedInline.run.alt}
                      maxLength={SLIDE_LIMITS.maxLabelLength}
                      readOnly={readOnly}
                      onChange={(event) =>
                        onInline(selectedInline.index, { alt: event.target.value }, "alt")
                      }
                      data-testid={`${testIdPrefix}-inline-alt`}
                    />
                  </LockedFieldHint>
                </Field>
              )}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

// What the panel changes of an inline run.
export type InlinePatch = { height?: number; alt?: string };

export type TextSizing = "fixed" | "height" | "both";
const SIZINGS = [
  ["fixed", "textSizingFixed"],
  ["height", "textSizingHeight"],
  ["both", "textSizingBoth"],
] as const;

// A text field's size in the panel (`SUI-FEATURE-165`): fixed, or following its text.
export function TextSizingField({
  value,
  readOnly,
  onValue,
}: {
  value: TextSizing;
  readOnly: boolean;
  onValue: (sizing: TextSizing) => void;
}) {
  const { t } = useTranslation("suite");
  const id = React.useId();
  return (
    <Field
      label={t("slides.editor.textSizing")}
      htmlFor={`${id}-sizing`}
      hint={t("slides.editor.textSizingHint")}
      valueHint={t("slides.editor.textSizingValueHint", {
        fixed: t("slides.editor.textSizingFixed"),
        interpolation: { escapeValue: false },
      })}
    >
      <Select value={value} onValueChange={(next) => onValue(next as TextSizing)}>
        <LockedTrigger locked={readOnly}>
          <SelectTrigger
            id={`${id}-sizing`}
            aria-describedby={helpIdFor(`${id}-sizing`)}
            fieldName={t("slides.editor.textSizing")}
            className="w-full"
            data-testid="slide-editor-text-sizing"
          >
            <SelectValue />
          </SelectTrigger>
        </LockedTrigger>
        <SelectContent>
          {SIZINGS.map(([sizing, key]) => (
            <SelectItem
              key={sizing}
              value={sizing}
              data-testid={`slide-editor-text-sizing-${sizing}`}
            >
              {t(`slides.editor.${key}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

type Shape = Extract<SlideElement, { type: "shape" }>;
type Inset = NonNullable<Shape["follow"]>["inset"];
const INSET_SIDES = [
  ["top", "insetTop"],
  ["right", "insetRight"],
  ["bottom", "insetBottom"],
  ["left", "insetLeft"],
] as const;
// The select's value for a shape that follows no text field: a space, so no element id is it.
const FOLLOW_NONE = " ";
const LABEL_LENGTH = 40;

// A text field by its opening text, cut with an ellipsis; empty when it has none.
function textLabel(text: Extract<SlideElement, { type: "text" }>) {
  const plain = text.runs
    .flatMap((run) => (run.inline === undefined ? [run.text] : []))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > LABEL_LENGTH ? `${plain.slice(0, LABEL_LENGTH - 1).trimEnd()}…` : plain;
}

// A shape's "Follows text" in the panel (`SUI-FEATURE-165` §Editor): a text field of its group, or
// none, and the padding on each side. Grid cells of the panel's two-column number grid: the select in
// the first column, the paddings two by two (Top, Right / Bottom, Left). Text fields that read the
// same are told apart by their place in the group.
export function FollowTextField({
  follow,
  texts,
  readOnly,
  revision,
  onFollow,
  onInset,
}: {
  follow: Shape["follow"];
  texts: readonly Extract<SlideElement, { type: "text" }>[];
  readOnly: boolean;
  revision: number;
  onFollow: (id: string | undefined) => void;
  onInset: (side: keyof Inset, value: number) => void;
}) {
  const { t } = useTranslation("suite");
  const id = React.useId();
  const labels = texts.map((text) => text.name || textLabel(text) || t("slides.editor.type.text"));
  const named = labels.map((label, index) =>
    labels.filter((one) => one === label).length > 1 ? `${label} (${index + 1})` : label,
  );
  return (
    <>
      <div className="col-start-1">
        <Field
          label={t("slides.editor.followText")}
          htmlFor={`${id}-follow`}
          hint={t("slides.editor.followTextHint")}
          valueHint={t("slides.editor.followTextValueHint", {
            none: t("slides.editor.followNone"),
            interpolation: { escapeValue: false },
          })}
        >
          <Select
            value={follow?.id ?? FOLLOW_NONE}
            onValueChange={(next) => onFollow(next === FOLLOW_NONE ? undefined : next)}
          >
            <LockedTrigger locked={readOnly}>
              <SelectTrigger
                id={`${id}-follow`}
                aria-describedby={helpIdFor(`${id}-follow`)}
                fieldName={t("slides.editor.followText")}
                className="w-full"
                data-testid="slide-editor-follow"
              >
                <SelectValue />
              </SelectTrigger>
            </LockedTrigger>
            <SelectContent>
              <SelectItem value={FOLLOW_NONE} data-testid="slide-editor-follow-none">
                {t("slides.editor.followNone")}
              </SelectItem>
              {texts.map((text, index) => (
                <SelectItem
                  key={text.id}
                  value={text.id}
                  data-testid={`slide-editor-follow-${text.id}`}
                >
                  {named[index]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {follow === undefined
        ? null
        : INSET_SIDES.map(([side, key]) => (
            <div key={side} className={side === "top" ? "col-start-1" : undefined}>
              <NumberField
                id={`${id}-inset-${side}`}
                label={t(`slides.editor.${key}`)}
                hint={t("slides.editor.insetHint")}
                valueHint={t("slides.editor.insetValueHint")}
                value={follow.inset[side]}
                min={0}
                unit="px"
                readOnly={readOnly}
                revision={revision}
                onValue={(value) => onInset(side, value)}
                testId={`slide-editor-inset-${side}`}
              />
            </div>
          ))}
    </>
  );
}
