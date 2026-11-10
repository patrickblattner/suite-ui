import {
  FileTextIcon,
  LayersIcon,
  PaletteIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { useEscapeLayer } from "../lib/escape-layers.js";
import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
import { Button } from "./button.js";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog.js";
import { fallbackTarget } from "./focus-return.js";
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
  // the save and its dirty state; without it the drawer has no footer. An app whose style drawer
  // keeps its own draft also passes `onReset` (`SUI-FEATURE-370`, `GL-UI-034`): Reset then stands left
  // of Save, asks first like the `EditorHeader`'s, and works while `resetting`. An async `onSave`
  // returns the save's promise: a `SlideEditor` leave question awaits it, and `false` or a rejection
  // is a failed save that keeps the editor open (`SUI-FEATURE-384` rev 3); a void return counts as
  // success. The rail itself only starts it.
  styleSave?: {
    onSave: () => void | boolean | Promise<void | boolean>;
    dirty: boolean;
    saving?: boolean;
    onReset?: () => void;
    resetting?: boolean;
  };
  // The app's word for its document (a page, a slide deck), from its own i18n in the active language
  // (`SUI-FEATURE-136`, `SUI-DESIGN-011`): the Document entry's tooltip, accessible name and drawer
  // title. Without it, `suite:canvas.drawer.document`. With nothing selected the app passes the same
  // word as the `PropertyPanel` path's only element.
  documentLabel?: string;
};

// In an editor frame narrower than 1024 px that also holds the property panel (`SUI-FEATURE-071`
// rev 7, the container `editor`), the row wraps and the panel takes its share of the height below
// (`--property-panel-share`, set in `styles.css`). The rail takes the rest above; it starts from its
// 48 px column, with no content minimum, so the canvas stays beside it on the first line, then grows
// into the free room up to its own width — 48 px closed, 348 px open — and the canvas keeps the rest,
// at worst none (Q&A #3857).
const BESIDE_PANEL = cn(
  "@max-editor-split/editor:[:has(>[data-slot=property-panel])>&]:h-[calc(100%-var(--property-panel-share))]",
  "@max-editor-split/editor:[:has(>[data-slot=property-panel])>&]:basis-12",
  "@max-editor-split/editor:[:has(>[data-slot=property-panel])>&]:grow-[100000]",
  "@max-editor-split/editor:[:has(>[data-slot=property-panel])>&]:max-w-max",
  "@max-editor-split/editor:[:has(>[data-slot=property-panel])>&]:min-w-0",
);

// The drawers of a visual editor (`GL-UI-040`, `SUI-FEATURE-071`): a narrow rail on the left with Add ·
// Layers · Style · Document, in that order. A click opens the drawer beside the rail, 300 px wide but
// never wider than the room its container leaves beside the rail (`SUI-FEATURE-071` rev 4, #223); it
// takes its width from the canvas instead of covering it. A second click or `Esc` closes it (innermost
// `Esc` first, `GL-UI-007`), and the focus returns to its button. The open drawer's button is pressed.
function DrawerRail({ items, open, onOpen, styleSave, documentLabel }: DrawerRailProps) {
  const { t } = useTranslation("suite");
  const label = (drawer: DrawerId) =>
    drawer === "document" && documentLabel ? documentLabel : t(`canvas.drawer.${drawer}`);
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const id = React.useId();
  const ordered = DRAWERS.flatMap((drawer) =>
    items.filter((item) => item.id === drawer.id).map((item) => ({ ...item, icon: drawer.icon })),
  );
  const current = ordered.find((item) => item.id === open);
  // The style Save locks itself while nothing differs, with `aria-disabled` and a trigger lock, so it
  // keeps the focus after saving (`GL-UI-050`, `SUI-FEATURE-120`).
  // As in the `EditorHeader`: Save is locked while a reset runs, Reset while a save runs (`SUI-FEATURE-370`).
  const styleResetting = styleSave?.resetting === true;
  const styleSaving = styleSave?.saving === true;
  const styleClean =
    styleSave !== undefined && (!styleSave.dirty || styleResetting) && !styleSaving;
  const resetClean =
    styleSave !== undefined && (!styleSave.dirty || styleSaving) && !styleResetting;
  // A confirmed Reset locks Reset and Save, so the focus goes to the drawer's first field (`GL-UI-050`).
  const resetConfirmed = React.useRef(false);
  const [confirming, setConfirming] = React.useState(false);
  // An unsaved style draft marks the Style button, with the drawer closed too, and adds the
  // `EditorHeader`'s draft text to its name (`SUI-FEATURE-370`).
  const styleDraft = styleSave?.dirty === true;
  const railLabel = (drawer: DrawerId) =>
    drawer === "style" && styleDraft ? `${label(drawer)}, ${t("editor.draft")}` : label(drawer);
  const saveButton =
    styleSave === undefined ? null : (
      <Hint
        text={t("canvas.styleSaveHint")}
        disabledText={t(styleResetting ? "editor.pendingHint" : "canvas.styleSaveCleanHint")}
      >
        <Button
          type="button"
          variant="success"
          size="default"
          {...(styleClean ? { "aria-disabled": true } : {})}
          {...(styleSave.saving !== undefined ? { busy: styleSave.saving } : {})}
          onClick={
            styleClean
              ? undefined
              : () => {
                  // The host shows a failure; a rejection is never left unhandled.
                  void Promise.resolve(styleSave.onSave()).catch(() => {});
                }
          }
          data-testid="drawer-style-save"
        >
          <SaveIcon aria-hidden="true" />
          {t("canvas.styleSave")}
        </Button>
      </Hint>
    );
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
      className={cn("flex h-full max-w-full shrink-0", BESIDE_PANEL)}
      data-testid="drawer-rail"
    >
      <div
        className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border py-2"
        data-tooltip-row=""
      >
        {ordered.map(({ id: drawer, icon: Icon, badge }) => (
          <IconButtonTooltip key={drawer} label={railLabel(drawer)}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-pressed={open === drawer}
              aria-controls={open === drawer ? `${id}-drawer` : undefined}
              className={cn("relative", PRESSED_FILL_CLASS)}
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
              {drawer === "style" && styleDraft ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-0.5 size-2 rounded-full border border-background bg-warn"
                  data-testid="drawer-style-draft"
                />
              ) : null}
            </Button>
          </IconButtonTooltip>
        ))}
      </div>
      {current === undefined ? null : (
        <section
          id={`${id}-drawer`}
          aria-labelledby={`${id}-title`}
          className="flex w-[300px] min-w-0 flex-col border-r border-border bg-background [--surface:var(--background)]"
          data-testid="drawer"
          data-drawer-open={current.id}
        >
          <h2 id={`${id}-title`} className="border-b px-4 py-3 text-base font-semibold">
            {label(current.id)}
          </h2>
          <div className="min-h-0 flex-1 scroll-py-2 overflow-y-auto p-4" data-slot="drawer-body">
            {current.content}
          </div>
          {current.id === "style" && styleSave !== undefined ? (
            <div className="flex flex-col gap-2 border-t p-4" data-testid="drawer-style-footer">
              {styleSave.onReset === undefined ? (
                saveButton
              ) : (
                <div className="flex flex-wrap gap-2" data-testid="drawer-style-actions">
                  <Hint
                    text={t("editor.resetHint")}
                    disabledText={t(
                      styleSaving ? "editor.resetSavingHint" : "editor.resetCleanHint",
                    )}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      {...(resetClean ? { "aria-disabled": true } : {})}
                      {...(styleSave.resetting !== undefined ? { busy: styleSave.resetting } : {})}
                      onClick={
                        resetClean
                          ? undefined
                          : () => {
                              resetConfirmed.current = false;
                              setConfirming(true);
                            }
                      }
                      data-testid="drawer-style-reset"
                    >
                      <RotateCcwIcon aria-hidden="true" />
                      {t("actions.reset")}
                    </Button>
                  </Hint>
                  {saveButton}
                </div>
              )}
              <p className="text-xs text-muted-foreground" data-testid="drawer-style-scope">
                {t("canvas.styleScope")}
              </p>
            </div>
          ) : null}
        </section>
      )}
      {styleSave?.onReset === undefined ? null : (
        <ConfirmDeleteDialog
          open={confirming}
          onOpenChange={setConfirming}
          returnFocus={() =>
            resetConfirmed.current
              ? fallbackTarget(node?.querySelector("[data-slot=drawer-body]") ?? null, null)
              : null
          }
          onConfirm={() => {
            resetConfirmed.current = true;
            setConfirming(false);
            styleSave.onReset?.();
          }}
          title={t("actions.reset")}
          description={t("editor.resetConfirm")}
          confirmLabel={t("actions.reset")}
          confirmHint={t("settings.resetHint")}
          data-testid="drawer-style-reset-confirm"
        />
      )}
    </div>
  );
}

export { DrawerRail, type DrawerId, type DrawerRailProps };
