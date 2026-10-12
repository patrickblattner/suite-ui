import { FileTextIcon, FileVideoIcon } from "lucide-react";
import * as React from "react";

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
  onOpen: () => void;
  // Given, the tile is a choice of the picker: `aria-pressed`, and the selection ring while true.
  selected?: boolean;
  "data-testid"?: string;
};

// A medium in the tile view of a media list (`GL-UI-002`, `SUI-FEATURE-063`), for `TileGridShell`:
// one button over the whole tile. On top the preview at a fixed height, cropped edge to edge; a
// non-image shows its type icon with the extension, both muted. Below the name on one line (the full
// name in the tooltip when clipped), the description on at most two lines and the tags; a missing
// description or an empty tag list drops its line. The name names the button, description and tags
// describe it.
function MediaTile({
  kind,
  src,
  name,
  extension,
  description,
  tags,
  onOpen,
  selected,
  "data-testid": testId = "media-tile",
}: MediaTileProps) {
  const id = React.useId();
  const hasDescription = description !== undefined && description !== "";
  const hasTags = tags.length > 0;
  const describedBy = [hasDescription && `${id}-description`, hasTags && `${id}-tags`]
    .filter(Boolean)
    .join(" ");
  const Icon = kind === "video" ? FileVideoIcon : FileTextIcon;
  return (
    <button
      type="button"
      data-slot="media-tile"
      data-testid={testId}
      data-selected={selected === true || undefined}
      aria-pressed={selected}
      aria-labelledby={`${id}-name`}
      aria-describedby={describedBy || undefined}
      onClick={onOpen}
      className="relative flex w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-left text-card-foreground transition-colors outline-none hover:border-ring focus-visible:focus-ring"
    >
      <span
        data-slot="media-tile-preview"
        className="flex h-32 w-full shrink-0 flex-col items-center justify-center gap-1 bg-muted text-muted-foreground"
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
      {/* The selection ring sits over the tile's edge, independent of the focus ring. */}
      {selected === true && (
        <span
          aria-hidden="true"
          data-slot="media-tile-selection"
          className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-primary ring-inset"
        />
      )}
    </button>
  );
}

export { MediaTile, type MediaTileProps };
