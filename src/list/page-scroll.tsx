import type * as React from "react";

// The one content container of a page (`GL-UI-018`): the page's only vertical scroller, with the page
// gutter as a symmetric inset on all four sides and the scrollbar's place reserved (`scrollbar-gutter:
// stable`) on the same element, so the bar never touches the content and nothing shifts when it
// appears. It is positioned, so absolutely placed helpers inside it (the hidden native `select` of a
// Select, `sr-only` texts) stay in this scroller instead of lengthening the document. The app mounts it
// once as the wrapper of its routed content; a page adds no scroller and no outer margin of its own.
function PageScroll({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="page-scroll"
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto p-[var(--page-gutter)] [scrollbar-gutter:stable]"
    >
      {children}
    </div>
  );
}

export { PageScroll };
