import { updateElements } from "./editor-ops.js";
import type { SlideBrandSet } from "./brand.js";
import type { SlideElement } from "./schema.js";
import { type FieldContext, ShadowSection } from "./slide-editor-fields-internal.js";
import { LineFields } from "./slide-editor-line.js";
import { ShapeFields } from "./slide-editor-shape.js";

// The look of the selected element in the inspector's Layout tab, split out of the Editor (#993
// finding #880): a line's colour, width and ends, a shape's fill and border, and the one shadow
// section of text, shapes, images and lines (`SUI-FEATURE-135` rev 3): a choice or the switch is one
// step, typing in a row in one field is one.
export function StyleSections({
  element,
  brand,
  borderWidth,
  ctx,
}: {
  element: SlideElement;
  brand: SlideBrandSet;
  // The width a shape's border first drawn takes: a table's for the page format (`borderWidthFor`).
  borderWidth: number;
  ctx: FieldContext;
}) {
  // The element replaced by a panel (a line's, a shape's); `merge` names the field whose changes in a
  // row are one step.
  const replace = (next: SlideElement, merge?: string) =>
    ctx.apply(
      (current) => updateElements(current, ctx.page, [element.id], () => next),
      merge === undefined ? undefined : `field:${element.id}:${merge}`,
    );
  return (
    <>
      {element.type !== "line" ? null : (
        <LineFields
          key={element.id}
          line={element}
          brand={brand}
          readOnly={element.locked}
          revision={ctx.travels}
          onLine={replace}
        />
      )}
      {/* A shape's fill and border (`SUI-FEATURE-137` rev 3 §Shape). */}
      {element.type !== "shape" ? null : (
        <ShapeFields
          key={element.id}
          shape={element}
          brand={brand}
          readOnly={element.locked}
          revision={ctx.travels}
          borderWidth={borderWidth}
          onShape={replace}
        />
      )}
      {element.type !== "text" &&
      element.type !== "shape" &&
      element.type !== "image" &&
      element.type !== "line" ? null : (
        <ShadowSection element={element} brand={brand} ctx={ctx} />
      )}
    </>
  );
}
