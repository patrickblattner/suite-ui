import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { Hint } from "../ui/hint.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { IconButtonTooltip } from "../ui/tooltip.js";

const PAGE_SIZES = [10, 25, 50, 100] as const;

type TablePaginationProps = {
  // 1-based.
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  total: number;
};

type Step = {
  key: "firstPage" | "prevPage" | "nextPage" | "lastPage";
  testId: string;
  icon: React.ReactNode;
  target: number;
  disabled: boolean;
};

// The pager under every list (`GL-UI-025`): four chevrons around "Page X / Y (Total)" and the page
// size (10/25/50/100), right-aligned so its right edge meets the page gutter on every surface.
// `--pager-gap` keeps chevrons and indicator one compact cluster.
function TablePagination({
  page,
  setPage,
  pageSize,
  setPageSize,
  totalPages,
  total,
}: TablePaginationProps) {
  const { t } = useTranslation("suite");
  const atFirst = page <= 1;
  const atLast = page >= totalPages;
  const step = ({ key, testId, icon, target, disabled }: Step) => (
    <IconButtonTooltip
      key={key}
      label={t(`pagination.${key}`)}
      disabledText={t(`pagination.${key}Disabled`)}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t(`pagination.${key}`)}
        onClick={() => setPage(target)}
        disabled={disabled}
        data-testid={testId}
      >
        {icon}
      </Button>
    </IconButtonTooltip>
  );

  return (
    <div
      className="flex w-full items-center justify-end gap-[var(--pager-gap)] text-sm"
      data-testid="pagination"
    >
      {step({
        key: "firstPage",
        testId: "pagination-first",
        icon: <ChevronsLeftIcon />,
        target: 1,
        disabled: atFirst,
      })}
      {step({
        key: "prevPage",
        testId: "pagination-prev",
        icon: <ChevronLeftIcon />,
        target: page - 1,
        disabled: atFirst,
      })}
      <span className="px-1 text-muted-foreground" data-testid="pagination-summary">
        {t("pagination.summary", { page, totalPages, total })}
      </span>
      {step({
        key: "nextPage",
        testId: "pagination-next",
        icon: <ChevronRightIcon />,
        target: page + 1,
        disabled: atLast,
      })}
      {step({
        key: "lastPage",
        testId: "pagination-last",
        icon: <ChevronsRightIcon />,
        target: totalPages,
        disabled: atLast,
      })}
      <Select value={String(pageSize)} onValueChange={(size) => setPageSize(Number(size))}>
        <Hint text={t("pagination.pageSizeHint")}>
          <SelectTrigger
            size="sm"
            className="min-w-[160px]"
            aria-label={t("pagination.pageSizeLabel")}
            data-testid="pagination-page-size"
          >
            <SelectValue />
          </SelectTrigger>
        </Hint>
        <SelectContent>
          {PAGE_SIZES.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {t("pagination.pageSize", { size })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export { PAGE_SIZES, TablePagination, type TablePaginationProps };
