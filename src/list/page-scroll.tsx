import * as React from "react";

import { useOverflowXMarker } from "./use-overflow-x-marker.js";

// The one content container of a page (`GL-UI-018`): the page's only vertical scroller, with the page
// gutter as a symmetric inset on all four sides and the scrollbar's place reserved (`scrollbar-gutter:
// stable`) on the same element, so the bar never touches the content and nothing shifts when it
// appears. It is positioned, so absolutely placed helpers inside it (the hidden native `select` of a
// Select, `sr-only` texts) stay in this scroller instead of lengthening the document. The app mounts it
// once as the wrapper of its routed content; a page adds no scroller and no outer margin of its own.
// Inner horizontal scrollers are marked while they overflow, so their bar gets its gap at the bottom.
function PageScroll({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  useOverflowXMarker(ref);
  return (
    <div
      ref={ref}
      data-testid="page-scroll"
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto p-[var(--page-gutter)] [scrollbar-gutter:stable]"
    >
      {children}
    </div>
  );
}

export { PageScroll };
