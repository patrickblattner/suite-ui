import { ChevronRightIcon } from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.js";

type PropertyTabId = "content" | "layout" | "background";

const TAB_ORDER: readonly PropertyTabId[] = ["content", "layout", "background"];

type PropertyPanelProps = {
  // Document › … › element; every link but the last selects its element. Without a selection the
  // document alone, with its own properties.
  path: readonly { label: string; onSelect: () => void }[];
  // The tabs the element has; a missing one is left out.
  tabs: readonly { id: PropertyTabId; content: React.ReactNode }[];
  activeTab: PropertyTabId;
  onTab: (id: PropertyTabId) => void;
};

// The properties of the canvas selection (`GL-UI-040`, `SUI-FEATURE-071`): a fixed column on the
// right, 340 px wide and as high as the editor area. In an editor frame narrower than 1024 px it
// stands under the canvas at full width and takes its share of the editor's height (`SUI-FEATURE-071`
// rev 7): `styles.css` makes the row that holds it and the drawer rail the container `editor`, wraps
// it, sizes the canvas, sets `--property-panel-share` and caps every other child of that row at the
// rest, except a `dialog` or `[popover]` child; an absolute overlay in the row is capped too. The head
// holds the path and the tabs in the fixed order Content · Layout · Background, narrower padded below
// 640 px so all three fit 320 px; only the body scrolls.
function PropertyPanel({ path, tabs, activeTab, onTab }: PropertyPanelProps) {
  const { t } = useTranslation("suite");
  const ordered = TAB_ORDER.flatMap((id) => tabs.filter((tab) => tab.id === id));
  return (
    <div
      data-slot="property-panel"
      className="flex h-full w-[340px] shrink-0 flex-col border-l border-border bg-background [--surface:var(--background)] @max-editor-split/editor:h-(--property-panel-share) @max-editor-split/editor:min-w-0 @max-editor-split/editor:basis-full @max-editor-split/editor:border-t @max-editor-split/editor:border-l-0"
      data-testid="property-panel"
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTab(value as PropertyTabId)}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="flex flex-col gap-3 border-b p-4" data-testid="property-panel-head">
          <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
            {path.map((step, index) => (
              <li key={index} className="flex min-w-0 items-center gap-1">
                {index === 0 ? null : (
                  <ChevronRightIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
                )}
                {index === path.length - 1 ? (
                  <span className="truncate font-medium" data-testid="property-path-current">
                    {step.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="truncate rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:focus-ring"
                    onClick={step.onSelect}
                    data-testid="property-path-link"
                  >
                    {step.label}
                  </button>
                )}
              </li>
            ))}
          </ol>
          <TabsList className="w-full">
            {ordered.map(({ id }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="max-sm:px-1.5"
                data-testid={`property-tab-${id}`}
              >
                {t(`canvas.tab.${id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div
          className="min-h-0 flex-1 scroll-py-2 overflow-y-auto p-4"
          data-testid="property-panel-body"
        >
          {ordered.map(({ id, content }) => (
            <TabsContent key={id} value={id}>
              {content}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}

export { PropertyPanel, type PropertyPanelProps, type PropertyTabId };
