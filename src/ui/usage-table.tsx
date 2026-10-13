import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useRowGrid } from "../list/use-row-grid.js";
import { StatusChip, type StatusChipState } from "./status-chip.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table.js";

// One entry that uses the shown one. `href` is the in-app route of that entry; `onOpen`, when given,
// opens it instead.
type UsageItem = {
  id: string;
  title: string;
  type: string;
  status?: StatusChipState;
  href?: string;
  onOpen?: () => void;
};

type UsageTableProps = { items: readonly UsageItem[] };

// "Used by" (`SUI-FEATURE-004`): the entries that use the shown one, as a table Title · Type · Status
// in the area the preview otherwise takes, at its full height. The whole row leads to its entry, by
// click or Enter; without a use it says so.
function UsageTable({ items }: UsageTableProps) {
  const { t } = useTranslation("suite");
  const navigate = useNavigate();
  const grid = useRowGrid();
  if (items.length === 0)
    return (
      <p
        className="flex h-full items-center justify-center text-sm text-muted-foreground"
        data-testid="usage-empty"
      >
        {t("usage.empty")}
      </p>
    );
  return (
    <div data-slot="usage-table" className="h-full min-h-0 overflow-auto" data-testid="usage-table">
      <Table {...grid.gridProps}>
        <TableHeader>
          <TableRow>
            <TableHead>{t("usage.title")}</TableHead>
            <TableHead>{t("usage.type")}</TableHead>
            <TableHead>{t("usage.status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const { href } = item;
            const open = item.onOpen ?? (href === undefined ? undefined : () => navigate(href));
            return (
              <TableRow key={item.id} {...grid.rowProps({ onOpen: open })} data-testid="usage-row">
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell className="text-muted-foreground">{item.type}</TableCell>
                <TableCell>
                  {item.status === undefined ? null : <StatusChip state={item.status} />}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export { UsageTable, type UsageItem, type UsageTableProps };
