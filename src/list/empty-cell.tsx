import type * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { TableCell } from "../ui/table.js";

// A cell without a value (`GL-UI-023`): a muted "—" that a screen reader announces as "empty".
function EmptyCell({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TableCell>, "children">) {
  const { t } = useTranslation("suite");
  return (
    <TableCell
      aria-label={t("list.emptyValue")}
      className={cn("text-muted-foreground", className)}
      {...props}
    >
      —
    </TableCell>
  );
}

export { EmptyCell };
