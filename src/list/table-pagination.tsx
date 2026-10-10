import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { suiteUiConfig } from "../config/index.js";
import { isInDialog, isTextField } from "../lib/keyboard.js";
import { MEASURED_TRIGGER, MeasuredCell } from "../lib/select-sizer.js";
import { Button } from "../ui/button.js";
import { Hint } from "../ui/hint.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { IconButtonTooltip } from "../ui/tooltip.js";
import { GRID_ITEM_ATTR } from "./use-row-grid.js";

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
  shortcut?: string;
};

// The mounted pagers: with the focus on `body`, ←/→ page only while exactly one is mounted.
let mountedPagers = 0;

// Controls whose arrows mean something of their own (`GL-UI-006` §Fokus-Regel).
const OWN_ARROWS =
  '[role="tablist"], [role="listbox"], [role="menu"], [role="combobox"], [role="radiogroup"], [role="slider"]';

// Whether ←/→ at `focused` page the list of the pager `root`: in the same list frame — an entry, the
// table or the pager — or on `body` with this the only pager; never in a field, a control with its own
// arrows, the toolbar or the focused scroller (`SUI-FEATURE-053`).
function pagesFrom(focused: Element | null, root: HTMLElement): boolean {
  if (focused === null || focused === document.body || focused === document.documentElement) {
    return mountedPagers === 1;
  }
  if (isTextField(focused) || focused.closest(OWN_ARROWS)) return false;
  if (root.contains(focused)) return true;
  const frame = root.closest("[data-slot=list-frame]");
  return (
    frame !== null &&
    frame.contains(focused) &&
    focused.closest(`[${GRID_ITEM_ATTR}], table`) !== null
  );
}

// The pager under every list (`GL-UI-025`): four chevrons around "Page X / Y (Total)" and the page
// size (10/25/50/100), right-aligned so its right edge meets the page gutter on every surface.
// `--pager-gap` keeps chevrons and indicator one compact cluster. Under `selectWidth: "measured"` the
// page size is as wide as its longest option in the active language.
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
  const measured = suiteUiConfig().selectWidth === "measured";
  const rootRef = React.useRef<HTMLDivElement>(null);
  // Set when a page change by key started in an entry: the focus then moves to the new first entry.
  const focusFirstEntry = React.useRef(false);

  React.useEffect(() => {
    mountedPagers += 1;
    return () => {
      mountedPagers -= 1;
    };
  }, []);

  // ←/→ page the list (`GL-UI-006` §Pagination); on the first/last page nothing happens.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.shiftKey) return;
      const root = rootRef.current;
      const focused = document.activeElement;
      if (root === null || isInDialog(focused) || !pagesFrom(focused, root)) return;
      const target = event.key === "ArrowLeft" ? page - 1 : page + 1;
      if (target < 1 || target > totalPages) return;
      event.preventDefault();
      focusFirstEntry.current = focused?.closest(`[${GRID_ITEM_ATTR}]`) != null;
      setPage(target);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [page, totalPages, setPage]);

  React.useEffect(() => {
    if (!focusFirstEntry.current) return;
    focusFirstEntry.current = false;
    rootRef.current
      ?.closest("[data-slot=list-frame]")
      ?.querySelector<HTMLElement>(`[${GRID_ITEM_ATTR}]`)
      ?.focus();
  }, [page]);

  const step = ({ key, testId, icon, target, disabled, shortcut }: Step) => (
    <IconButtonTooltip
      key={key}
      label={t(`pagination.${key}`)}
      disabledText={t(`pagination.${key}Disabled`)}
      shortcut={shortcut}
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

  const pageSizeSelect = (
    <Select value={String(pageSize)} onValueChange={(size) => setPageSize(Number(size))}>
      <Hint text={t("pagination.pageSizeHint")}>
        <SelectTrigger
          size="sm"
          className={measured ? MEASURED_TRIGGER : "min-w-[160px]"}
          aria-label={t("pagination.pageSizeLabel")}
          data-testid="pagination-page-size"
        >
          <SelectValue />
        </SelectTrigger>
      </Hint>
      <SelectContent>
        {PAGE_SIZES.map((size) => (
          <SelectItem key={size} value={String(size)}>
            {t("pagination.pageSize", { size, interpolation: { escapeValue: false } })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div
      ref={rootRef}
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
        shortcut: "ArrowLeft",
      })}
      <span className="px-1 text-muted-foreground" data-testid="pagination-summary">
        {t("pagination.summary", {
          page,
          totalPages,
          total,
          interpolation: { escapeValue: false },
        })}
      </span>
      {step({
        key: "nextPage",
        testId: "pagination-next",
        icon: <ChevronRightIcon />,
        target: page + 1,
        disabled: atLast,
        shortcut: "ArrowRight",
      })}
      {step({
        key: "lastPage",
        testId: "pagination-last",
        icon: <ChevronsRightIcon />,
        target: totalPages,
        disabled: atLast,
      })}
      {measured ? (
        <MeasuredCell
          texts={PAGE_SIZES.map((size) =>
            t("pagination.pageSize", { size, interpolation: { escapeValue: false } }),
          )}
          data-testid="pagination-page-size"
        >
          {pageSizeSelect}
        </MeasuredCell>
      ) : (
        pageSizeSelect
      )}
    </div>
  );
}

export { PAGE_SIZES, TablePagination, type TablePaginationProps };
