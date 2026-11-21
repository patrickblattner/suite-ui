import * as React from "react";
import type { TFunction } from "i18next";

import { PropertyPanel } from "../ui/property-panel.js";
import type { SlideBrandSet } from "./brand.js";
import type { SlideElement, SlidePage } from "./schema.js";
import {
  hasReadOnlyContent,
  ReadOnlyContent,
  ReadOnlyLayout,
  ReadOnlyPage,
} from "./slide-editor-readonly.js";
import { bodyOf } from "./slide-editor-text-fields-internal.js";

type PanelProps = React.ComponentProps<typeof PropertyPanel>;

// The inspector's tabs under `readOnly` (`SUI-FEATURE-133` rev 4), as the editable one's, split out of
// the Editor (#993 finding #880): the selected element's text format under Content, its flip, box,
// line, shadow and animation under Layout (`rotation` the angle on the page); the page's flip,
// transition and format without a selection, with the host's `pagePanel`; a line naming the count for
// several. The Editor renders them in the same `PropertyPanel` as the editable tabs, so a switch of
// `readOnly` keeps the panel and its focus (R10 review).
export function readOnlyPanelTabs({
  element,
  selectedCount,
  rotation,
  brand,
  page,
  format,
  pagePanel,
  tab,
  t,
}: {
  element: SlideElement | undefined;
  selectedCount: number;
  rotation: number;
  brand: SlideBrandSet;
  page: SlidePage | undefined;
  format: { name: string; width: number; height: number };
  pagePanel: React.ReactNode;
  tab: PanelProps["activeTab"];
  t: TFunction<"suite">;
}): Pick<PanelProps, "tabs" | "activeTab"> {
  const body = element === undefined ? undefined : bodyOf(element, undefined);
  const content =
    element !== undefined && hasReadOnlyContent(element, body) ? (
      <ReadOnlyContent element={element} body={body} brand={brand} />
    ) : undefined;
  const layout =
    element !== undefined ? (
      <ReadOnlyLayout element={element} rotation={rotation} brand={brand} />
    ) : selectedCount === 0 ? (
      // Spaced as the editable inspector's layout tab.
      <div className="flex flex-col gap-4">
        {page === undefined ? null : (
          <ReadOnlyPage
            background={page.background}
            transition={page.transition}
            format={t("slides.editor.format", {
              ...format,
              interpolation: { escapeValue: false },
            })}
          />
        )}
        {pagePanel}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground" data-testid="slide-editor-readonly-count">
        {t("slides.editor.selectedCount", { count: selectedCount })}
      </p>
    );
  return {
    tabs: [
      ...(content === undefined ? [] : [{ id: "content" as const, content }]),
      { id: "layout", content: layout },
    ],
    activeTab: content === undefined ? "layout" : tab,
  };
}
