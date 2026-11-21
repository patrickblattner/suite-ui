import * as React from "react";

import { DrawerRail, type DrawerId, type DrawerRailProps } from "../ui/drawer-rail.js";
import { updateElements } from "./editor-ops.js";
import { deletePage, duplicatePage, movePage, newPage, setPageHidden } from "./editor-pages.js";
import type { SlideDocument } from "./schema.js";
import type { FieldContext } from "./slide-editor-fields-internal.js";
import { ElementLibrary } from "./slide-editor-library.js";
import { DocumentPanel, LayerList, type LayerListProps } from "./slide-editor-panels-internal.js";

// The slide Editor's drawers on the rail (`GL-UI-040`): Add (the element library), Layers, the host's
// Style and Document, split out of the Editor (#993 finding #880).

type Sorter = NonNullable<React.ComponentProps<typeof DocumentPanel>["sorter"]>;

// What the page sorter's changes read and change: the document and the page shown, the page cap,
// and the Editor's way to change the pages (`changePages`), each a step of the history.
export type PagesContext = {
  document: SlideDocument;
  page: number;
  pageCap: number | undefined;
  pagesFull: boolean;
  fits: (next: SlideDocument, refused: string) => boolean;
  holding: (current: SlideDocument, id: string | undefined) => SlideDocument;
  changePages: (next: SlideDocument, changed: number, shown: (id: string) => string) => void;
  // A delete left the one page a cap of 1 allows: the canvas takes the focus.
  onOnePage: () => void;
};

// The page sorter's moves, duplicates, hiding, deletes and new pages (`SUI-FEATURE-161` §Seiten); a
// page past the cap or a document the schema refuses changes nothing.
export function pageSorterActions(
  ctx: PagesContext,
): Pick<Sorter, "onMove" | "onDuplicate" | "onHidden" | "onDelete" | "onNew"> {
  const { document, page, pagesFull, fits, changePages } = ctx;
  return {
    onMove: (from, to) => changePages(movePage(document, from, to), to, (id) => id),
    onDuplicate: (index) => {
      if (pagesFull) return;
      const made = duplicatePage(document, index);
      if (!fits(made.document, "slides.editor.pageRefused")) return;
      changePages(made.document, made.index, () => made.document.pages[made.index]!.id);
    },
    onHidden: (index, hidden) =>
      changePages(setPageHidden(document, index, hidden), index, (id) => id),
    onDelete: (index) => {
      const next = deletePage(document, index);
      if (ctx.pageCap === 1 && next.pages.length === 1) ctx.onOnePage();
      const shown = Math.min(index, next.pages.length - 1);
      changePages(next, shown, (id) =>
        next.pages.some((one) => one.id === id) ? id : next.pages[shown]!.id,
      );
    },
    onNew: (layoutId) => {
      if (pagesFull) return;
      const made = newPage(ctx.holding(document, layoutId), page, layoutId);
      if (!fits(made.document, "slides.editor.pageRefused")) return;
      changePages(made.document, made.index, () => made.document.pages[made.index]!.id);
    },
  };
}

// The rail with its drawers. Under `readOnly` no Add; the host's Style drawer is openable under
// `readOnly` too (`SUI-FEATURE-384`); `documentPanel` is left out where the pane would hold nothing
// (`SUI-FEATURE-381`). A layer's lock or visibility turned is one step.
export function EditorDrawers({
  readOnly,
  library,
  layers,
  ctx,
  styleDrawer,
  documentPanel,
  open,
  onOpen,
  styleSave,
}: {
  readOnly: boolean;
  library: React.ComponentProps<typeof ElementLibrary>;
  layers: Omit<LayerListProps, "readOnly" | "onToggle">;
  ctx: Pick<FieldContext, "page" | "apply">;
  styleDrawer: { content: React.ReactNode } | undefined;
  documentPanel: React.ComponentProps<typeof DocumentPanel> | undefined;
  open: DrawerId | undefined;
  onOpen: (id: DrawerId | undefined) => void;
  styleSave: DrawerRailProps["styleSave"];
}) {
  return (
    <DrawerRail
      items={[
        ...(readOnly ? [] : [{ id: "add" as const, content: <ElementLibrary {...library} /> }]),
        {
          id: "layers",
          content: (
            <LayerList
              {...layers}
              readOnly={readOnly}
              onToggle={(id, state) =>
                ctx.apply((current) =>
                  updateElements(current, ctx.page, [id], (one) =>
                    state === "locked"
                      ? { ...one, locked: !one.locked }
                      : { ...one, hidden: !one.hidden },
                  ),
                )
              }
            />
          ),
        },
        ...(styleDrawer === undefined
          ? []
          : [{ id: "style" as const, content: styleDrawer.content }]),
        ...(documentPanel === undefined
          ? []
          : [{ id: "document" as const, content: <DocumentPanel {...documentPanel} /> }]),
      ]}
      open={open}
      onOpen={onOpen}
      {...(styleSave === undefined ? {} : { styleSave })}
    />
  );
}
