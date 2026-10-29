import { CheckIcon, FileTextIcon, FileVideoIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { foldRowAction, type RowAction, useRowActionButtons } from "../list/row-actions.js";
import { GRID_ITEM_ATTR, type RowGrid } from "../list/use-row-grid.js";
import { cn } from "../lib/cn.js";
import { ENTRY_FRAME_ATTR } from "../lib/list-focus.js";
import { Badge } from "./badge.js";
import type { MediaDetailKind } from "./media-detail-shell.js";
import { OverflowTooltip } from "./tooltip.js";

type MediaTileProps = {
  kind: MediaDetailKind;
  // The preview of an image; other kinds show their type icon.
  src?: string;
  name: string;
  // The file extension under the type icon of a non-image, shown in capitals ("pdf" → "PDF").
  extension?: string;
  description?: string;
  tags: readonly string[];
  // Opens the medium. Without it the tile is no button: no pointer, no hover, nothing to open (a
  // role without the right to edit, `SUI-FEATURE-084`).
  onOpen?: (() => void) | undefined;
  // The same handler as the visible delete action, so with its confirmation. Given, the tile shows
  // that delete button in its top-right corner, always visible; Delete/Backspace on the focused tile
  // call it through `rowProps`. Without it (no right to delete) no button and no key.
  onDelete?: (() => void) | undefined;
  // The medium's next lifecycle step (`SUI-FEATURE-330`). A tile is below the fold width, so the step
  // is the first entry of a ⋯ menu beside the delete button: named "‹label›", hinted "‹label› ‹name›";
  // while it runs the ⋯ button shows the working state.
  step?: RowAction | undefined;
  // `useRowGrid().rowProps` of the grid whose `gridProps` the `TileGridShell` holds: the tile is
  // one of its entries, arrows move between the tiles, one tab stop. A tile without `onOpen` and
  // `onDelete` is no entry: not focusable, not reachable by Tab or arrows.
  rowProps?: RowGrid["rowProps"] | undefined;
  // Given, the tile is a choice of the picker: `aria-pressed`, and the selection ring while true. A
  // choice needs `onOpen` (the pick); without it `selected` has no effect.
  selected?: boolean;
  // The picker's pinned current choice: a "Current" badge, which `selected` replaces.
  current?: boolean;
  "data-testid"?: string;
};

// A medium in the tile view of a media list (`GL-UI-002`, `SUI-FEATURE-063`), for `TileGridShell`:
// one button over the whole tile, a plain group without `onOpen` (`SUI-FEATURE-084`). On top the
// preview at a fixed height, cropped edge to edge; a non-image shows its type icon with the
// extension, both muted. Below the name on one line (the full name in the tooltip when clipped),
// the description on at most two lines and the tags; a missing description or an empty tag list
// drops its line. The name names the button or the group, description and tags describe it. With
// `onDelete` the tile and the delete button of `RowActions` stand side by side in a frame, the button
// over the top-right corner: its own hit target, never inside the open button (`SUI-FEATURE-084`).
// A selected or current choice also says so in a badge over the preview's top-left corner, so the
// state does not rest on the ring's colour (`GL-UI-060`).
function MediaTile({
  kind,
  src,
  name,
  extension,
  description,
  tags,
  onOpen,
  onDelete,
  step,
  rowProps,
  selected,
  current,
  "data-testid": testId = "media-tile",
}: MediaTileProps) {
  const { t } = useTranslation("suite");
  const id = React.useId();
  const isSelected = selected === true && onOpen !== undefined;
  // Only one mark: a selected tile shows "Selected", never "Current" as well.
  const isCurrent = current === true && !isSelected;
  const hasDescription = description !== undefined && description !== "";
  const hasTags = tags.length > 0;
  // `aria-pressed` names the selection; "Current" is read with the description.
  const describedBy = [
    isCurrent && `${id}-current`,
    hasDescription && `${id}-description`,
    hasTags && `${id}-tags`,
  ]
    .filter(Boolean)
    .join(" ");
  const Icon = kind === "video" ? FileVideoIcon : FileTextIcon;
  // Enter and Space open a button natively, so the grid entry takes only Delete/Backspace from
  // `rowProps`, plus its tab stop, its mark for the arrows and its inset focus ring, which the
  // scroller does not clip on edge tiles; outside a grid the tile keeps the outer ring.
  const entry =
    rowProps === undefined || (onOpen === undefined && onDelete === undefined)
      ? undefined
      : rowProps({ onDelete });
  // Filled `destructive`, `icon-xs`, hint and name "Delete ‹name›" (`GL-UI-012`, `GL-UI-016`); the
  // Delete chip while the grid binds the same handler to the key. The step folds into ⋯ before it.
  const buttons = useRowActionButtons({
    rowName: name,
    onDelete,
    deleteTestId: `${testId}-delete`,
    deleteShortcut: entry !== undefined,
    ...(step === undefined
      ? {}
      : { menu: { label: t("actions.more", { name }), items: [foldRowAction(step, name)] } }),
  });
  const shared = {
    "data-slot": "media-tile",
    "data-testid": testId,
    // The name's tooltip stands inside this tile, never over a neighbour (`GL-UI-016` rev 19, #589).
    "data-tooltip-tile": "",
    "aria-labelledby": `${id}-name`,
    "aria-describedby": describedBy || undefined,
    ...(entry === undefined
      ? {}
      : { tabIndex: entry.tabIndex, onKeyDown: entry.onKeyDown, [GRID_ITEM_ATTR]: true }),
  };
  const tileClass = cn(
    "group/tile relative flex w-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card [--surface:var(--card)] text-left text-card-foreground transition-colors",
    entry === undefined ? "outline-none focus-visible:focus-ring" : entry.className,
  );
  const content = (
    <>
      <span
        data-slot="media-tile-preview"
        className="flex h-32 w-full shrink-0 flex-col items-center justify-center gap-1 bg-muted [--surface:var(--muted)] text-muted-foreground"
      >
        {kind === "image" && src !== undefined ? (
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          <>
            <Icon aria-hidden="true" className="size-8" />
            {extension !== undefined && extension !== "" && (
              <span className="text-xs font-medium">{extension.toUpperCase()}</span>
            )}
          </>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-1.5 p-3">
        <OverflowTooltip text={name}>
          <span id={`${id}-name`} className="truncate text-sm font-medium">
            {name}
          </span>
        </OverflowTooltip>
        {hasDescription && (
          <span id={`${id}-description`} className="line-clamp-2 text-xs text-muted-foreground">
            {description}
          </span>
        )}
        {hasTags && (
          <span id={`${id}-tags`} className="flex flex-wrap gap-1">
            {/* The space keeps the tags apart in the description; the flex row does not render it. */}
            {tags.map((tag, index) => (
              <React.Fragment key={tag}>
                {index > 0 && " "}
                <Badge variant="outline">{tag}</Badge>
              </React.Fragment>
            ))}
          </span>
        )}
      </span>
      {/* An inset ring is drawn under the preview; in a grid this copy draws it over it. */}
      {entry !== undefined && (
        <span
          aria-hidden="true"
          data-slot="media-tile-focus"
          className="pointer-events-none absolute inset-0 hidden rounded-[inherit] ring-[3px] ring-ring ring-inset group-focus-visible/tile:block"
        />
      )}
      {/* The selection ring sits over the tile's edge, independent of the focus ring. */}
      {isSelected && (
        <span
          aria-hidden="true"
          data-slot="media-tile-selection"
          className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-primary ring-inset"
        />
      )}
      {isSelected && (
        <Badge
          variant="default"
          aria-hidden="true"
          data-slot="media-tile-selected"
          className="absolute top-2 left-2"
        >
          <CheckIcon aria-hidden="true" />
          {t("tile.selected")}
        </Badge>
      )}
      {isCurrent && (
        <Badge
          variant="secondary"
          id={`${id}-current`}
          data-slot="media-tile-current"
          className="absolute top-2 left-2 border-border"
        >
          {t("tile.current")}
        </Badge>
      )}
    </>
  );
  const tile =
    onOpen === undefined ? (
      <div role="group" {...shared} className={tileClass}>
        {content}
      </div>
    ) : (
      <button
        type="button"
        {...shared}
        data-selected={isSelected || undefined}
        aria-pressed={selected}
        onClick={onOpen}
        className={cn(tileClass, "cursor-pointer hover:border-ring")}
      >
        {content}
      </button>
    );
  return buttons.menu === null && buttons.delete === null ? (
    tile
  ) : (
    <div
      data-slot="media-tile-frame"
      {...{ [ENTRY_FRAME_ATTR]: true }}
      className="relative flex w-full min-w-0"
    >
      {tile}
      <div
        data-slot="media-tile-actions"
        // Without a step the corner holds only delete, as before.
        className={cn("absolute top-2 right-2", buttons.menu !== null && "flex items-center gap-1")}
      >
        {buttons.menu}
        {buttons.delete}
      </div>
    </div>
  );
}

export { MediaTile, type MediaTileProps };
