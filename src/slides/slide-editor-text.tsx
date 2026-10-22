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
import { Field } from "../ui/field.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import type { SlideBrandSet } from "./brand.js";
import type { Box } from "./editor-ops.js";
import { NumberField } from "./number-field.js";
import {
  formatOfRange,
  insertText,
  normalizeRuns,
  type RunFormatPatch,
  runFormat,
  textOf,
} from "./editor-text.js";
import {
  cssColor,
  cssFill,
  cssFont,
  DEFAULT_FONT,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  num,
  paragraphs,
  px,
} from "./render-style.js";
import type { TextRun } from "./schema.js";

// What a text field and a table cell share: runs and the field's alignment, line height and list.
export type TextBody = {
  runs: TextRun[];
  align: "left" | "center" | "right" | "justify";
  lineHeight: number;
  list: "none" | "bullet" | "numbered";
  verticalAlign: "top" | "middle" | "bottom";
};

// A range of the field's text as character offsets, a paragraph's end counted as one.
export type TextRange = { start: number; end: number };

// The largest size the size field takes, in px of the format.
const MAX_TEXT_SIZE = 1000;

// The CSS of a run as the view draws it (`slide-view.tsx` `runSpan`), as DOM style values.
function runStyle(run: TextRun, brand: SlideBrandSet): Partial<Record<string, string>> {
  const font = cssFont(run.font ?? DEFAULT_FONT, brand);
  const style: Partial<Record<string, string>> = {
    fontFamily: "css" in font ? font.css : "",
    fontSize: px(run.size ?? DEFAULT_TEXT_SIZE),
    fontWeight: run.weight === undefined ? "" : String(run.weight),
    fontStyle: run.italic === true ? "italic" : "",
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

// Fills the editable root with the runs: one block per paragraph, one span per piece that names its
// run (`data-run`), an empty paragraph holding a `<br>` so it keeps its line.
export function fillEditable(
  root: HTMLElement,
  runs: readonly TextRun[],
  brand: SlideBrandSet,
  list: TextBody["list"],
) {
  const document = root.ownerDocument;
  root.replaceChildren();
  for (const pieces of paragraphs(runs)) {
    const block = document.createElement("div");
    block.dataset.paragraph = "";
    const size = pieces[0]?.run.size ?? runs[0]?.size ?? DEFAULT_TEXT_SIZE;
    block.style.fontSize = px(size);
    if (list !== "none") {
      block.style.display = "list-item";
      block.style.listStyleType = list === "bullet" ? "disc" : "decimal";
      block.style.marginLeft = "1.2em";
    }
    if (pieces.length === 0) block.append(document.createElement("br"));
    for (const piece of pieces) {
      const span = document.createElement("span");
      span.dataset.run = String(runs.indexOf(piece.run));
      Object.assign(span.style, runStyle(piece.run, brand));
      span.textContent = piece.text;
      block.append(span);
    }
    root.append(block);
  }
  if (list === "numbered") root.style.counterReset = "list-item";
}

type Token = { kind: "text"; node: Text; text: string } | { kind: "break"; at: [Node, number] };

const BLOCKS = new Set(["DIV", "P", "LI"]);
const CONTAINERS = new Set(["UL", "OL"]);

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
export function readRuns(
  root: HTMLElement,
  previous: readonly TextRun[],
  latest: readonly TextRun[] = previous,
): TextRun[] {
  const first = latest[0] ?? previous[0] ?? { text: "" };
  const pieces: TextRun[] = [];
  let last: TextRun = first;
  for (const token of tokensOf(root)) {
    if (token.kind === "break") {
      const end = pieces.at(-1);
      if (end === undefined) pieces.push({ ...runFormat(last), text: "\n" });
      else pieces[pieces.length - 1] = { ...end, text: `${end.text}\n` };
      continue;
    }
    const owner = token.node.parentElement?.closest("[data-run]");
    const index =
      owner !== null && owner !== undefined && root.contains(owner)
        ? Number(owner.getAttribute("data-run"))
        : NaN;
    const run = Number.isInteger(index) ? (previous[index] ?? last) : last;
    last = run;
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

// The DOM position of a text offset in the root.
function positionAt(root: HTMLElement, offset: number): [Node, number] {
  let at = 0;
  let last: [Node, number] = [root.firstChild ?? root, 0];
  for (const token of tokensOf(root)) {
    if (token.kind === "text") {
      if (offset <= at + token.text.length) {
        // Offsets count the text without zero-width spaces; the node holds none (it was filled here).
        return [token.node, Math.max(0, offset - at)];
      }
      at += token.text.length;
      last = [token.node, token.node.data.length];
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
export function InlineTextEditor({
  body,
  brand,
  frame,
  inner,
  padding = 0,
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
}: {
  body: TextBody;
  brand: SlideBrandSet;
  // Where the element is drawn on the page and its turn.
  frame: { box: Box; rotation: number };
  // The field's box in the element (a table cell's), px of the format; the whole element without.
  inner?: Box | undefined;
  padding?: number;
  zoom: number;
  label: string;
  // The range the field selects again after its runs changed from outside (a format, Undo).
  range: TextRange | undefined;
  onRuns: (runs: TextRun[], range: TextRange | undefined) => void;
  onRange: (range: TextRange) => void;
  onEnd: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggle: (format: "bold" | "italic", range: TextRange | undefined) => void;
  // Tab (`back` with Shift) in a table cell: `true` when the editing went on to the next cell, so the
  // key stays in the field; `false` lets the focus leave as usual.
  onTab?: ((back: boolean) => boolean) | undefined;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  // The runs this field last handed on: the same runs coming back need no refill, unless the list
  // it was filled with changed.
  const emitted = React.useRef<TextRun[] | null>(null);
  const filledList = React.useRef(body.list);
  // The runs the field was last filled with: its spans' `data-run` name their index there, also
  // after the runs it handed on were normalised (Codex #398 CX1).
  const filled = React.useRef<readonly TextRun[]>(body.runs);
  const latestRange = React.useRef(range);
  const onRangeRef = React.useRef(onRange);
  React.useLayoutEffect(() => {
    latestRange.current = range;
    onRangeRef.current = onRange;
  });
  const first = React.useRef(true);
  React.useLayoutEffect(() => {
    const node = root.current;
    if (node === null) return;
    if (body.runs === emitted.current && body.list === filledList.current && !first.current) return;
    emitted.current = body.runs;
    filledList.current = body.list;
    filled.current = body.runs;
    fillEditable(node, body.runs, brand, body.list);
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
  }, [body.runs, body.list, brand]);
  // The selection as it moves, so a format from the panel knows its range after the focus left.
  React.useEffect(() => {
    const node = root.current;
    if (node === null) return;
    const onChange = () => {
      const now = rangeIn(node);
      if (now !== undefined) onRangeRef.current(now);
    };
    node.ownerDocument.addEventListener("selectionchange", onChange);
    return () => node.ownerDocument.removeEventListener("selectionchange", onChange);
  }, []);
  const current = () => emitted.current ?? body.runs;
  // Text put in by the editor itself (a paragraph, a paste): the runs refill and the caret follows.
  const put = (text: string) => {
    const node = root.current;
    if (node === null) return;
    const at = rangeIn(node) ?? { start: 0, end: 0 };
    const runs = insertText(current(), at.start, at.end, text);
    const caret = Math.min(at.start, at.end) + text.length;
    emitted.current = null;
    onRuns(runs, { start: caret, end: caret });
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
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              margin: 0,
              paddingLeft: 0,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onInput={() => {
              const node = root.current;
              if (node === null) return;
              const runs = readRuns(node, filled.current, emitted.current ?? filled.current);
              emitted.current = runs;
              onRuns(runs, rangeIn(node));
            }}
            onPaste={(event) => {
              event.preventDefault();
              const text = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
              if (text !== "") put(text);
            }}
            onDrop={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              // Every key stays in the field: the canvas's arrows and Enter are not for it.
              event.stopPropagation();
              const key = event.key.toLowerCase();
              if (event.key === "Escape") {
                event.preventDefault();
                onEnd();
              } else if (event.key === "Enter") {
                event.preventDefault();
                put("\n");
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
    </div>
  );
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
  idPrefix,
  body,
  range,
  brand,
  readOnly,
  revision,
  onFormat,
  onBody,
}: {
  idPrefix: string;
  body: TextBody;
  range: TextRange | undefined;
  brand: SlideBrandSet;
  readOnly: boolean;
  // The history's travel count, for the size field (`NumberField`).
  revision: number;
  onFormat: (patch: RunFormatPatch, merge?: string) => void;
  onBody: (patch: Partial<Pick<TextBody, "align" | "list">>) => void;
}) {
  const { t } = useTranslation("suite");
  const { start, end } = formatSpan(body, range);
  const { format, mixed } = formatOfRange(body.runs, start, end);
  const font = format.font ?? (mixed.has("font") ? undefined : DEFAULT_FONT);
  const fill =
    format.fill ??
    (mixed.has("fill") ? undefined : { type: "color" as const, color: DEFAULT_TEXT_COLOR });
  const colorKey =
    fill?.type === "color" && fill.color.kind === "brand" ? fill.color.key : undefined;
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
    <IconButtonTooltip label={label}>
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
        data-testid={`${idPrefix}-${testId}`}
      >
        {icon}
      </Button>
    </IconButtonTooltip>
  );
  const mixedText = t("slides.editor.textMixed");
  return (
    <section className="flex flex-col gap-3" data-testid={`${idPrefix}-format`}>
      <h3 className="text-sm font-medium">{t("slides.editor.textFormat")}</h3>
      <div className="grid grid-cols-2 gap-3" data-tooltip-row="">
        <Field
          label={t("slides.editor.textFont")}
          htmlFor={`${idPrefix}-font`}
          hint={t("slides.editor.textFontHint")}
          valueHint={t("slides.editor.textFontValueHint")}
        >
          <Select
            value={fontKey ?? ""}
            disabled={readOnly}
            onValueChange={(key) => onFormat({ font: { kind: "brand", key } })}
          >
            <SelectTrigger
              id={`${idPrefix}-font`}
              aria-describedby={`${idPrefix}-font-help`}
              fieldName={t("slides.editor.textFont")}
              className="w-full"
              data-testid={`${idPrefix}-font`}
            >
              <SelectValue
                placeholder={mixed.has("font") ? mixedText : t("slides.editor.textOwnFont")}
              />
            </SelectTrigger>
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
          id={`${idPrefix}-size`}
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
          testId={`${idPrefix}-size`}
        />
        <Field
          label={t("slides.editor.textColor")}
          htmlFor={`${idPrefix}-color`}
          hint={t("slides.editor.textColorHint")}
          valueHint={t("slides.editor.textColorValueHint")}
        >
          <Select
            value={colorKey ?? ""}
            disabled={readOnly}
            onValueChange={(key) =>
              onFormat({ fill: { type: "color", color: { kind: "brand", key } } })
            }
          >
            <SelectTrigger
              id={`${idPrefix}-color`}
              aria-describedby={`${idPrefix}-color-help`}
              fieldName={t("slides.editor.textColor")}
              className="w-full"
              data-testid={`${idPrefix}-color`}
            >
              <SelectValue
                placeholder={mixed.has("fill") ? mixedText : t("slides.editor.textOwnColor")}
              />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(brand.colors).map(([key, { value, label }]) => (
                <SelectItem key={key} value={key}>
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-full border"
                    style={{ background: cssColor({ kind: "brand", key }, brand) ?? value }}
                  />
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-1" data-tooltip-row="">
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
        <span className="mx-1 w-px self-stretch bg-border" aria-hidden="true" />
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
        <span className="mx-1 w-px self-stretch bg-border" aria-hidden="true" />
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
    </section>
  );
}
