import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "../ui/button.js";
import { ConfirmDeleteDialog } from "../ui/confirm-delete-dialog.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";
import { GRID_ITEM_ATTR, useRowGrid } from "../list/use-row-grid.js";
import { Hint } from "../ui/hint.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { DELETE_SHORTCUT } from "../ui/use-edit-shortcuts.js";
import type { SlideDocument } from "./schema.js";
import { SlideView, type SlideViewProps } from "./slide-view.js";

// What a page dragged in the sorter carries: its index.
const PAGE_DRAG_TYPE = "application/x-suite-slide-page";

type ViewProps = Pick<
  SlideViewProps,
  "brand" | "fonts" | "fontOrigins" | "resolveMedia" | "extensions" | "renderPlaceholder"
>;

type ThumbProps = { document: SlideDocument; index: number; view: ViewProps };

// A page's small picture, drawn again only when what it shows changed: the page itself, the
// document's format, layouts or masters, or the view. Another page's change, a drag or a key on the
// canvas leaves it be (#308).
export const samePageThumb = (before: ThumbProps, after: ThumbProps) =>
  before.index === after.index &&
  before.document.pages[before.index] === after.document.pages[after.index] &&
  before.document.format === after.document.format &&
  before.document.layouts === after.document.layouts &&
  before.document.masters === after.document.masters &&
  (Object.keys(before.view) as (keyof ViewProps)[]).every(
    (key) => before.view[key] === after.view[key],
  ) &&
  Object.keys(after.view).length === Object.keys(before.view).length;

const PageThumb = React.memo(function PageThumb({ document, index, view }: ThumbProps) {
  return <SlideView {...view} document={document} page={index} animationStep="none" />;
}, samePageThumb);

// The page sorter in the editor's Document drawer (`SUI-FEATURE-161` §Seiten-Sortierer): every page
// as a small picture in order; a click shows it on the canvas. The pictures are a keyboard grid
// (`GL-UI-006`): ↑/↓ go from page to page, Enter shows one, Delete asks to delete it. A page is
// dragged to its new place (the arrow buttons are the keyboard's way), duplicated, hidden (the player
// skips it) or deleted after `ConfirmDeleteDialog`; the last page stays. "Add page" adds an empty
// page after the one shown, from one of the document's layouts when it has any.
export function PageSorter({
  document,
  layouts,
  page,
  view,
  onShow,
  onMove,
  onDuplicate,
  onHidden,
  onDelete,
  onNew,
}: {
  document: SlideDocument;
  // The layouts a new page can come from: the document's and the app's (`SUI-FEATURE-192`).
  layouts: readonly { id: string; name: string }[];
  page: number;
  view: ViewProps;
  onShow: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (index: number) => void;
  onHidden: (index: number, hidden: boolean) => void;
  onDelete: (index: number) => void;
  onNew: (layoutId: string | undefined) => void;
}) {
  const { t } = useTranslation("suite");
  const [deleting, setDeleting] = React.useState<number | undefined>(undefined);
  const [over, setOver] = React.useState<number | undefined>(undefined);
  const grid = useRowGrid();
  const count = document.pages.length;
  const { width, height } = document.format;
  const iconButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    testId: string,
    options: {
      pressed?: boolean;
      disabledText?: string | undefined;
      shortcut?: readonly string[] | undefined;
    } = {},
  ) => (
    <IconButtonTooltip
      label={label}
      disabledText={options.disabledText}
      shortcut={options.shortcut}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-pressed={options.pressed}
        disabled={options.disabledText !== undefined}
        onClick={onClick}
        data-testid={testId}
      >
        {icon}
      </Button>
    </IconButtonTooltip>
  );
  // With the app's layouts the button opens their list instead of adding a page. The Hint then wraps
  // the menu trigger rather than sitting inside it (GL-UI-016 §Doppel-Rolle).
  const newButton = (onClick?: () => void) => {
    const button = (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={onClick}
        data-testid="slide-editor-page-new"
      >
        <PlusIcon aria-hidden="true" />
        {t("slides.editor.newPage")}
      </Button>
    );
    return (
      <Hint
        text={t(
          onClick === undefined ? "slides.editor.newPageMenuHint" : "slides.editor.newPageHint",
        )}
      >
        {onClick === undefined ? (
          <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
        ) : (
          button
        )}
      </Hint>
    );
  };
  return (
    <section className="flex flex-col gap-2" data-testid="slide-editor-pages">
      <h3 className="text-sm font-medium">{t("slides.editor.pages")}</h3>
      {/* The list takes the grid's keys, but no grid role: its pages are no table rows. */}
      <ol {...grid.gridProps} role={undefined} className="flex flex-col gap-1">
        {document.pages.map((one, index) => {
          const n = index + 1;
          // Enter and Space show the page natively, so the picture's button takes only Delete from
          // `rowProps`, plus its tab stop, its mark for the arrows and its inset focus ring.
          const entry = grid.rowProps({
            onDelete: count <= 1 ? undefined : () => setDeleting(index),
          });
          return (
            <li
              key={one.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(PAGE_DRAG_TYPE, String(index));
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes(PAGE_DRAG_TYPE)) return;
                event.preventDefault();
                setOver(index);
              }}
              onDragLeave={() => setOver(undefined)}
              onDrop={(event) => {
                const from = Number(event.dataTransfer.getData(PAGE_DRAG_TYPE));
                setOver(undefined);
                if (!Number.isInteger(from)) return;
                event.preventDefault();
                onMove(from, index);
              }}
              onDragEnd={() => setOver(undefined)}
              className={cn(
                "flex items-start gap-2 rounded-md border border-transparent p-1",
                index === page &&
                  "border-ring bg-accent [--surface:var(--accent)] text-accent-foreground",
                over === index && "border-primary",
              )}
              data-testid="slide-editor-page-row"
              data-page-id={one.id}
              data-page-hidden={one.hidden ? "true" : undefined}
            >
              <IconButtonTooltip label={t("slides.editor.showPage", { n })}>
                <button
                  type="button"
                  tabIndex={entry.tabIndex}
                  onKeyDown={entry.onKeyDown}
                  {...{ [GRID_ITEM_ATTR]: true }}
                  className={cn(
                    "w-20 shrink-0 overflow-hidden rounded-sm border bg-background",
                    entry.className,
                  )}
                  style={{ aspectRatio: `${width} / ${height}` }}
                  aria-current={index === page ? "page" : undefined}
                  onClick={() => onShow(index)}
                  data-testid="slide-editor-page-show"
                >
                  <div className={cn("pointer-events-none size-full", one.hidden && "opacity-40")}>
                    <PageThumb document={document} index={index} view={view} />
                  </div>
                </button>
              </IconButtonTooltip>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm tabular-nums">
                  {t("slides.editor.pageNumber", { n })}
                  {one.hidden ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t("slides.editor.pageHidden")}
                    </span>
                  ) : null}
                </span>
                <div className="flex flex-wrap gap-0.5" data-tooltip-row="">
                  {iconButton(
                    t("slides.editor.movePageUp", { n }),
                    <ArrowUpIcon />,
                    () => onMove(index, index - 1),
                    "slide-editor-page-up",
                    { disabledText: index === 0 ? t("slides.editor.pageFirst") : undefined },
                  )}
                  {iconButton(
                    t("slides.editor.movePageDown", { n }),
                    <ArrowDownIcon />,
                    () => onMove(index, index + 1),
                    "slide-editor-page-down",
                    { disabledText: index === count - 1 ? t("slides.editor.pageLast") : undefined },
                  )}
                  {iconButton(
                    t("slides.editor.duplicatePage", { n }),
                    <CopyIcon />,
                    () => onDuplicate(index),
                    "slide-editor-page-duplicate",
                  )}
                  {iconButton(
                    t("slides.editor.hidePage", { n }),
                    one.hidden ? <EyeOffIcon /> : <EyeIcon />,
                    () => onHidden(index, !one.hidden),
                    "slide-editor-page-hide",
                    { pressed: one.hidden },
                  )}
                  {iconButton(
                    t("slides.editor.deletePage", { n }),
                    <Trash2Icon />,
                    () => setDeleting(index),
                    "slide-editor-page-delete",
                    // The Delete chip while the grid binds the key to it.
                    count <= 1
                      ? { disabledText: t("slides.editor.pageOnly") }
                      : { shortcut: DELETE_SHORTCUT },
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {layouts.length === 0 ? (
        newButton(() => onNew(undefined))
      ) : (
        <DropdownMenu>
          {newButton()}
          <DropdownMenuContent align="start" data-testid="slide-editor-page-layouts">
            <DropdownMenuItem onSelect={() => onNew(undefined)}>
              {t("slides.editor.blankPage")}
            </DropdownMenuItem>
            {layouts.map((layout) => (
              <DropdownMenuItem
                key={layout.id}
                onSelect={() => onNew(layout.id)}
                data-testid={`slide-editor-page-layout-${layout.id}`}
              >
                {layout.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        onOpenChange={(open) => (open ? null : setDeleting(undefined))}
        object={t("slides.editor.pageNumber", { n: (deleting ?? 0) + 1 })}
        description={t("slides.editor.deletePageDescription")}
        confirmHint={t("slides.editor.deletePageHint")}
        onConfirm={() => {
          if (deleting !== undefined) onDelete(deleting);
          setDeleting(undefined);
        }}
        data-testid="slide-editor-page-delete-dialog"
      />
    </section>
  );
}
