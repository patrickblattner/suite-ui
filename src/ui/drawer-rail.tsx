import { FileTextIcon, LayersIcon, PaletteIcon, PlusIcon, SaveIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { useEscapeLayer } from "../lib/escape-layers.js";
import { LOCKED_SAVE_CLASS } from "../lib/locked-save.js";
import { Button } from "./button.js";
import { Hint } from "./hint.js";
import { IconButtonTooltip } from "./tooltip.js";

type DrawerId = "add" | "layers" | "style" | "document";

const DRAWERS = [
  { id: "add", icon: PlusIcon },
  { id: "layers", icon: LayersIcon },
  { id: "style", icon: PaletteIcon },
  { id: "document", icon: FileTextIcon },
] as const;

type DrawerRailProps = {
  // The drawers the editor has; a missing one is left out, the others keep their order.
  items: readonly { id: DrawerId; content: React.ReactNode; badge?: string }[];
  // The open drawer; at most one.
  open?: DrawerId | undefined;
  // Opens a drawer, or closes the open one with `undefined` (a second click, `Esc`).
  onOpen: (id: DrawerId | undefined) => void;
  // The style drawer's own save: it applies to everything that uses the brand kit. The app supplies
  // the save and its dirty state; without it the drawer has no footer.
  styleSave?: { onSave: () => void; dirty: boolean; saving?: boolean };
};

// The drawers of a visual editor (`GL-UI-040`, `SUI-FEATURE-071`): a narrow rail on the left with Add ·
// Layers · Style · Document, in that order. A click opens the drawer beside the rail, 300 px wide; it
// takes its width from the canvas instead of covering it. A second click or `Esc` closes it (innermost
// `Esc` first, `GL-UI-007`), and the focus returns to its button. The open drawer's button is pressed.
function DrawerRail({ items, open, onOpen, styleSave }: DrawerRailProps) {
  const { t } = useTranslation("suite");
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const id = React.useId();
  const ordered = DRAWERS.flatMap((drawer) =>
    items.filter((item) => item.id === drawer.id).map((item) => ({ ...item, icon: drawer.icon })),
  );
  const current = ordered.find((item) => item.id === open);
  // The style Save locks itself while nothing differs, with `aria-disabled` and a trigger lock, so it
  // keeps the focus after saving (`GL-UI-050`, `SUI-FEATURE-120`).
  const styleClean = styleSave !== undefined && !styleSave.dirty && styleSave.saving !== true;
  useEscapeLayer(
    current !== undefined,
    () => {
      node?.querySelector<HTMLElement>(`[data-drawer="${open}"]`)?.focus();
      onOpen(undefined);
    },
    node,
  );
  return (
    <div
      ref={setNode}
      data-slot="drawer-rail"
      className="flex h-full shrink-0"
      data-testid="drawer-rail"
    >
      <div className="flex w-12 flex-col items-center gap-1 border-r border-border py-2">
        {ordered.map(({ id: drawer, icon: Icon, badge }) => (
          <IconButtonTooltip key={drawer} label={t(`canvas.drawer.${drawer}`)}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-pressed={open === drawer}
              aria-controls={open === drawer ? `${id}-drawer` : undefined}
              className="relative aria-pressed:bg-accent aria-pressed:text-accent-foreground"
              onClick={() => onOpen(open === drawer ? undefined : drawer)}
              data-drawer={drawer}
              data-testid={`drawer-${drawer}`}
            >
              <Icon aria-hidden="true" />
              {badge === undefined ? null : (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 min-w-4 rounded-full border bg-background px-1 text-[10px] leading-3.5 font-medium text-foreground tabular-nums"
                  data-testid={`drawer-${drawer}-badge`}
                >
                  {badge}
                </span>
              )}
            </Button>
          </IconButtonTooltip>
        ))}
      </div>
      {current === undefined ? null : (
        <section
          id={`${id}-drawer`}
          aria-labelledby={`${id}-title`}
          className="flex w-[300px] flex-col border-r border-border bg-background"
          data-testid="drawer"
          data-drawer-open={current.id}
        >
          <h2 id={`${id}-title`} className="border-b px-4 py-3 text-sm font-medium">
            {t(`canvas.drawer.${current.id}`)}
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{current.content}</div>
          {current.id === "style" && styleSave !== undefined ? (
            <div className="flex flex-col gap-2 border-t p-4" data-testid="drawer-style-footer">
              <Hint text={t("canvas.styleSaveHint")} disabledText={t("canvas.styleSaveCleanHint")}>
                <Button
                  type="button"
                  variant="success"
                  size="default"
                  {...(styleClean ? { "aria-disabled": true } : {})}
                  {...(styleSave.saving !== undefined ? { busy: styleSave.saving } : {})}
                  className={cn(styleClean && LOCKED_SAVE_CLASS)}
                  onClick={styleClean ? undefined : styleSave.onSave}
                  data-testid="drawer-style-save"
                >
                  <SaveIcon aria-hidden="true" />
                  {t("canvas.styleSave")}
                </Button>
              </Hint>
              <p className="text-xs text-muted-foreground" data-testid="drawer-style-scope">
                {t("canvas.styleScope")}
              </p>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

export { DrawerRail, type DrawerId, type DrawerRailProps };
