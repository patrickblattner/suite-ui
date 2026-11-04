import type * as React from "react";

import { TabsSharedContent } from "../ui/tabs.js";

// The view switch above a list frame (`SUI-FEATURE-027` AC 8): the `TabsList` and the active value.
// The page wraps the frame in `Tabs` and picks the data by `value`; the frame's scroller becomes the
// active tab's panel, so every tab row has a panel (WCAG 4.1.2). A tab row without a value is a type
// error. The panel follows the package `Tabs` (`TabsSharedContent`); `tabs.value` is not read for the
// panel, and inside raw Radix `Tabs` the panel gets no active value.
type ListTabs = { list: React.ReactNode; value: string };

// Without tabs the scroller stays as it is. With tabs the scroller itself becomes the shared panel
// (`TabsSharedContent`, `SUI-FEATURE-132`: role, id, `aria-labelledby` to its tab, one empty hidden
// panel per inactive tab), so the frame's markup and layout do not change. Always mounted: a value that
// matches no tab leaves the list in place instead of hiding it.
function ListTabPanel({
  tabs,
  children,
}: {
  tabs: ListTabs | undefined;
  children: React.ReactElement;
}) {
  if (tabs === undefined) return children;
  return <TabsSharedContent asChild>{children}</TabsSharedContent>;
}

export { ListTabPanel, type ListTabs };
