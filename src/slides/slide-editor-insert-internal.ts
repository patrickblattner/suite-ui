import type { TFunction } from "i18next";

import { toast } from "../ui/toaster.js";
import type { SlideBrandSet } from "./brand.js";
import { safeParseSlideDocument } from "./document.js";
import { insertColor } from "./editor-color.js";
import { insertElement, type LibraryEntry, libraryElement, uniqueId } from "./editor-ops.js";
import type { Point } from "./editor-geometry.js";
import { intoPlaceholder, type OpenPlaceholder, roleTextRun } from "./editor-layouts.js";
import { insertRuns } from "./editor-text.js";
import { cssColor } from "./render-style.js";
import {
  type Run,
  SLIDE_LIMITS,
  type SlideDocument,
  slideElementSchema,
  type SlideElement,
  type SlidePage,
} from "./schema.js";
import { type AppLibraryEntry, iconLabel, type PickedMedia } from "./slide-editor-library.js";
import type { CellAt } from "./slide-editor-table.js";
import type { TextRange } from "./slide-editor-text.js";
import {
  bodyOf,
  runsFit,
  TEXT_REFUSED_TOAST,
  type TextFieldContext,
  withBody,
} from "./slide-editor-text-fields-internal.js";
import type { SlideExtensions } from "./slide-view.js";

// The element library's inserts of the slide Editor (`SUI-FEATURE-232`), split out of it (#993
// finding #880): the app's entries, what people read for an entry, and putting one on the page or
// into the text being edited.

// The one error toast of a refused insert: a repeated press replaces it (#365).
export const INSERT_REFUSED_TOAST = "slide-editor-insert-refused";

// The app's own types with a library entry and its blocks (`SUI-FEATURE-163`); one whose element
// breaks the schema (an over-long type id, a bad size, groups nested too deep) is left out. A block without a name of its
// own takes its label, so what was picked stays recognisable in the layers and the path.
export function appLibraryEntries(extensions: SlideExtensions | undefined): AppLibraryEntry[] {
  const types = Object.entries(extensions?.types ?? {}).flatMap(([typeId, type]) => {
    if (type.library === undefined) return [];
    const size = type.defaultSize ?? { width: 1, height: 1 };
    const probe = {
      id: "probe",
      type: "custom",
      typeId,
      x: 0,
      y: 0,
      ...size,
      payload: type.library.payload,
    };
    return slideElementSchema.safeParse(probe).success
      ? [
          {
            entry: {
              kind: "custom" as const,
              typeId,
              size: type.defaultSize,
              payload: type.library.payload,
            },
            label: type.label,
          },
        ]
      : [];
  });
  const blocks = (extensions?.library ?? []).flatMap((block) => {
    const parsed = slideElementSchema.safeParse(block.element);
    if (!parsed.success) return [];
    const element = parsed.data.name
      ? parsed.data
      : { ...parsed.data, name: block.label.slice(0, SLIDE_LIMITS.maxLabelLength) };
    return [{ entry: { kind: "block" as const, id: block.id, element }, label: block.label }];
  });
  return [...types, ...blocks];
}

// What people read for an entry: a shape's kind, an icon's name, a medium's alt text, an app entry's
// label.
export const entryLabelOf = (
  entry: LibraryEntry,
  appEntries: readonly AppLibraryEntry[],
  t: TFunction<"suite">,
): string => {
  switch (entry.kind) {
    case "custom":
    case "block":
      return appEntries.find((one) => one.entry === entry)?.label ?? t("slides.editor.type.custom");
    case "icon":
      return iconLabel(entry.icon);
    case "image":
      return entry.alt || t("slides.editor.type.image");
    case "chart":
      return entry.name;
    case "text":
      return t("slides.editor.libraryText");
    case "table":
      return t("slides.editor.libraryTable");
    case "line":
      return t("slides.editor.libraryLine");
    case "shape":
      return t(`slides.editor.library${entry.shape[0]!.toUpperCase() + entry.shape.slice(1)}`);
  }
};

// A new element's colour stands out on the page's own background (`GL-UX-001`, 3 : 1).
export const pageGround = (
  background: SlidePage["background"] | undefined,
  brand: SlideBrandSet,
): string => {
  const value =
    background?.type === "color"
      ? background.color
      : background?.type === "gradient"
        ? background.stops[0]?.color
        : undefined;
  return (value === undefined ? undefined : cssColor(value, brand)) ?? "#ffffff";
};

// An insert the document refuses is named in an error toast and nothing changes: a page at its
// element limit (Codex #362 CX1) says so, any other broken rule gets the generic error. The toast
// has one id, so repeated presses replace it rather than stack (#365). `count` picks the singular
// or plural form of keys that have both (#540): for the limit, the elements in groups counted.
export const insertFitsWith = (
  t: TFunction<"suite">,
  next: SlideDocument,
  {
    refused = "slides.editor.insertRefused",
    failed = "slides.editor.insertFailed",
    count,
  }: { refused?: string; failed?: string; count?: { refused: number; failed: number } } = {},
) => {
  const result = safeParseSlideDocument(next);
  if (result.ok) return true;
  const full = result.error.issues.some((issue) => issue.code === "too-many-elements");
  toast.error(
    t(
      full ? refused : failed,
      count === undefined ? {} : { count: full ? count.refused : count.failed },
    ),
    {
      id: INSERT_REFUSED_TOAST,
    },
  );
  return false;
};

// What a library insert reads and changes: the document and page it lands on, the text being
// edited with its range (an inline insert), and the Editor's state it sets after.
export type InsertContext = {
  t: TFunction<"suite">;
  document: SlideDocument;
  page: number;
  pageWidth: number;
  pageHeight: number;
  brand: SlideBrandSet;
  ground: string;
  editing: { id: string; cell: CellAt | undefined } | undefined;
  edited: SlideElement | undefined;
  textRange: TextRange | undefined;
  setTextRange: (range: TextRange) => void;
  changeBody: TextFieldContext["changeBody"];
  setFieldFocus: (change: (count: number) => number) => void;
  apply: (change: (document: SlideDocument) => SlideDocument) => void;
  canvasRef: { readonly current: HTMLDivElement | null };
  setSelection: (ids: string[]) => void;
  setInsertNote: (note: { text: string; selection: readonly string[] }) => void;
  entryLabel: (entry: LibraryEntry) => string;
};

// With a caret in the text being edited, an icon or a medium from the library goes into the text at
// the caret as an inline run, never a new element (`SUI-FEATURE-164`): past the run limit it is
// refused with its own hint, `inlineRefused` (`SUI-FEATURE-114`), a medium the schema refuses is named as a medium.
// The field takes the focus back with its caret after the new run. `false`: nothing being edited.
export function insertInline(ctx: InsertContext, entry: LibraryEntry): boolean {
  const { t, editing, edited, textRange } = ctx;
  if (entry.kind !== "icon" && entry.kind !== "image") return false;
  if (editing === undefined || edited === undefined || textRange === undefined) return false;
  const body = bodyOf(edited, editing.cell);
  if (body === undefined) return false;
  const run: Run =
    entry.kind === "icon"
      ? { inline: "icon", icon: entry.icon, height: 1 }
      : { inline: "media", media: { id: entry.media }, alt: entry.alt, height: 1 };
  const runs = insertRuns(body.runs, textRange.start, textRange.end, [run]);
  if (!runsFit(runs, body.runs)) {
    toast.error(t("slides.editor.inlineRefused"), { id: TEXT_REFUSED_TOAST });
    return true;
  }
  if (
    !slideElementSchema.safeParse(withBody(edited, editing.cell, (one) => ({ ...one, runs })))
      .success
  ) {
    toast.error(t("slides.editor.libraryMediaInvalid"), { id: INSERT_REFUSED_TOAST });
    return true;
  }
  const caret = Math.min(textRange.start, textRange.end) + 1;
  ctx.setTextRange({ start: caret, end: caret });
  ctx.changeBody(editing.id, editing.cell, (one) => ({ ...one, runs }));
  ctx.setFieldFocus((count) => count + 1);
  return true;
}

// Put on the page of the document as it is when it lands (a picked medium arrives later). The
// element must pass the schema first: a medium it refuses (its id or alt text past their limits)
// is named as a medium, any other element by the generic error. Then the focus goes to the new
// element on the canvas; the drawer stays open (`SUI-FEATURE-232` rev 3).
// Dropped on an open placeholder (`into`), the element becomes its content: its box, turn and role
// (`SUI-FEATURE-192`); a block keeps its own box.
export function insertLibraryEntry(
  ctx: InsertContext,
  entry: LibraryEntry,
  {
    at,
    label = ctx.entryLabel(entry),
    into,
  }: { at?: Point; label?: string; into?: OpenPlaceholder },
): void {
  const { t, document, page } = ctx;
  if (at === undefined && into === undefined && insertInline(ctx, entry)) return;
  const point = at ?? { x: ctx.pageWidth / 2, y: ctx.pageHeight / 2 };
  const color = insertColor(ctx.brand, ctx.ground);
  const made = libraryElement(document, page, entry, point, color);
  const element = into === undefined || made.type === "group" ? made : intoPlaceholder(made, into);
  if (!slideElementSchema.safeParse(element).success) {
    toast.error(
      t(
        entry.kind === "image" ? "slides.editor.libraryMediaInvalid" : "slides.editor.insertFailed",
      ),
      { id: INSERT_REFUSED_TOAST },
    );
    return;
  }
  if (!insertFitsWith(t, insertElement(document, page, element))) return;
  ctx.apply((current) => insertElement(current, page, element));
  ctx.canvasRef.current?.focus();
  const ids = [element.id];
  ctx.setSelection(ids);
  ctx.setInsertNote({
    text: t("slides.editor.inserted", { name: label, interpolation: { escapeValue: false } }),
    selection: ids,
  });
}

// The text field that fills an open placeholder (`SUI-FEATURE-192`): the role's sample text in the
// placeholder's box, turn and role, on top of the page's `elements`, with an id new to `document`.
export function placeholderText(
  document: SlideDocument,
  elements: readonly SlideElement[],
  open: OpenPlaceholder,
  pageWidth: number,
  pageHeight: number,
): SlideElement {
  const made: SlideElement = {
    id: uniqueId(document, "text"),
    type: "text",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    layer: elements.reduce((top, element) => Math.max(top, element.layer), 0),
    locked: false,
    deletable: true,
    hidden: false,
    opacity: 100,
    runs: [roleTextRun(open.placeholder.role, pageWidth, pageHeight)],
    align: "left",
    lineHeight: 1.2,
    list: "none",
    verticalAlign: "top",
    sizing: "fixed",
  };
  return intoPlaceholder(made, open);
}

// The app's picker for the Add drawer's "Media" (`SUI-FEATURE-232`): a cancel inserts nothing; the
// picked medium goes in as an image, its aspect from its size where it has one, through the insert
// as it is when the app answers (`insertRef`); a picker that fails, or a medium the page cannot take,
// is named in an error toast with what to do next.
export function pickToInsert(
  pickMedia: (context: { purpose: "insert" }) => Promise<PickedMedia | undefined>,
  insertRef: { readonly current: (entry: LibraryEntry) => void },
  t: TFunction<"suite">,
) {
  pickMedia({ purpose: "insert" }).then(
    (picked) => {
      if (picked === undefined) return;
      const aspect =
        picked.width !== undefined && picked.height !== undefined && picked.height > 0
          ? picked.width / picked.height
          : Number.NaN;
      insertRef.current({
        kind: "image",
        media: picked.id,
        alt: picked.alt ?? "",
        aspect,
      });
    },
    () => toast.error(t("slides.editor.libraryMediaFailed")),
  );
}
