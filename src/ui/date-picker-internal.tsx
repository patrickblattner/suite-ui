import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { Button } from "./button.js";
import {
  addDays,
  addMonths,
  type CalendarDate,
  formatDate,
  formatTime,
  intlLocale,
  monthWeeks,
  nearestStep,
  sameDate,
  TIME_STEPS,
  toIsoDate,
  type WallTime,
} from "./date-time-internal.js";
import { IconButtonTooltip } from "./tooltip.js";

// The picker parts of `DateField`, `TimeField` and `DateTimeField` (`SUI-FEATURE-145` §Picker): a
// Monday-first month grid and a list of 15-minute steps, each with its own keyboard.

function useLocale(): string {
  const { i18n } = useTranslation("suite");
  return intlLocale(i18n.resolvedLanguage ?? i18n.language ?? "en");
}

function utc(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

// Monday to Sunday: 1 January 2024 was a Monday.
const WEEK = Array.from({ length: 7 }, (_, index) => ({ year: 2024, month: 1, day: 1 + index }));

const GRID_KEYS: Record<string, (date: CalendarDate) => CalendarDate> = {
  ArrowLeft: (date) => addDays(date, -1),
  ArrowRight: (date) => addDays(date, 1),
  ArrowUp: (date) => addDays(date, -7),
  ArrowDown: (date) => addDays(date, 7),
  PageUp: (date) => addMonths(date, -1),
  PageDown: (date) => addMonths(date, 1),
};

type CalendarGridProps = {
  selected: CalendarDate | null;
  today: CalendarDate;
  onPick: (date: CalendarDate) => void;
  autoFocus?: boolean;
  testId?: string | undefined;
};

function CalendarHead({
  active,
  labelId,
  onMonth,
}: {
  active: CalendarDate;
  labelId: string;
  onMonth: (months: number) => void;
}) {
  const { t } = useTranslation("suite");
  const locale = useLocale();
  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc(active));
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <IconButtonTooltip label={t("datetime.previousMonth")}>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMonth(-1)}>
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
      </IconButtonTooltip>
      <span id={labelId} aria-live="polite" className="text-sm font-medium">
        {label}
      </span>
      <IconButtonTooltip label={t("datetime.nextMonth")}>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMonth(1)}>
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </IconButtonTooltip>
    </div>
  );
}

function CalendarGrid({ selected, today, onPick, autoFocus = false, testId }: CalendarGridProps) {
  const locale = useLocale();
  const labelId = React.useId();
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [active, setActive] = React.useState<CalendarDate>(selected ?? today);
  // Set by the keyboard and the opening: the next render moves the focus onto the active day.
  const focusActive = React.useRef(autoFocus);
  React.useEffect(() => {
    if (!focusActive.current) return;
    focusActive.current = false;
    tableRef.current?.querySelector<HTMLElement>(`[data-date="${toIsoDate(active)}"]`)?.focus();
  }, [active]);

  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  const dayName = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const onKeyDown = (event: React.KeyboardEvent) => {
    const move = GRID_KEYS[event.key];
    if (move !== undefined) {
      event.preventDefault();
      focusActive.current = true;
      setActive(move(active));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPick(active);
    }
  };

  return (
    <div data-slot="calendar">
      <CalendarHead
        active={active}
        labelId={labelId}
        onMonth={(months) => setActive(addMonths(active, months))}
      />
      <table
        ref={tableRef}
        role="grid"
        aria-labelledby={labelId}
        data-testid={testId === undefined ? undefined : `${testId}-calendar`}
        className="border-collapse text-sm"
        onKeyDown={onKeyDown}
      >
        <thead>
          <tr>
            {WEEK.map((day) => (
              <th
                key={day.day}
                scope="col"
                abbr={weekdayLong.format(utc(day))}
                className="size-8 text-xs font-normal text-muted-foreground"
              >
                {weekday.format(utc(day))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(active.year, active.month).map((week) => (
            <tr key={toIsoDate(week[0]!)}>
              {week.map((date) => {
                const isActive = sameDate(date, active);
                const isSelected = sameDate(date, selected);
                return (
                  <td key={toIsoDate(date)} aria-selected={isSelected} className="p-0">
                    <button
                      type="button"
                      tabIndex={isActive ? 0 : -1}
                      data-date={toIsoDate(date)}
                      aria-label={dayName.format(utc(date))}
                      aria-current={sameDate(date, today) ? "date" : undefined}
                      onClick={() => onPick(date)}
                      className={cn(
                        "size-8 rounded-md outline-none hover:bg-accent hover:text-accent-foreground focus-visible:focus-ring",
                        date.month !== active.month && "text-muted-foreground",
                        sameDate(date, today) && "font-semibold underline underline-offset-4",
                        isSelected &&
                          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      )}
                    >
                      {date.day}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Moves within the offered steps: a position in that list and the list's length.
const LIST_KEYS: Record<string, (position: number, length: number) => number> = {
  ArrowUp: (position) => position - 1,
  ArrowDown: (position) => position + 1,
  PageUp: (position) => position - 4,
  PageDown: (position) => position + 4,
  Home: () => 0,
  End: (_, length) => length - 1,
};

const ALL_STEPS: readonly number[] = TIME_STEPS.map((_, index) => index);

type TimeListProps = {
  // The value's time; its step is selected, and Enter on it unmoved keeps the exact time.
  selected: WallTime | null;
  // The time whose nearest step the list opens at without a value (now).
  reference: WallTime;
  onPick: (time: WallTime) => void;
  // The offered steps, indices into `TIME_STEPS`; default all 96.
  offered?: readonly number[];
  // Each increase moves the focus onto the value's step, unmoved (the date-time picker after a day).
  focusRequest?: number;
  autoFocus?: boolean;
  className?: string;
  testId?: string | undefined;
};

function sameTime(a: WallTime | null, b: WallTime): boolean {
  return a !== null && a.hour === b.hour && a.minute === b.minute;
}

function TimeList({
  selected,
  reference,
  onPick,
  offered = ALL_STEPS,
  focusRequest = 0,
  autoFocus = false,
  className,
  testId,
}: TimeListProps) {
  const { t } = useTranslation("suite");
  const listRef = React.useRef<HTMLUListElement>(null);
  const valueStep = nearestStep(selected ?? reference, offered);
  // The active step, an index into `TIME_STEPS`; one the offered steps lost falls back to the value's.
  const [chosen, setActive] = React.useState(valueStep);
  const active = offered.includes(chosen) ? chosen : valueStep;
  const focusActive = React.useRef(autoFocus);
  // Whether the keyboard moved off the value's step: until then Enter keeps the value's own time,
  // also off the 15-minute grid (14:37 stays 14:37, `SUI-FEATURE-145` rev 3).
  const [moved, setMoved] = React.useState(false);
  // A new focus request puts the list back onto the value's step, unmoved; the effect below focuses it.
  const [handledRequest, setHandledRequest] = React.useState(focusRequest);
  if (focusRequest !== handledRequest) {
    setHandledRequest(focusRequest);
    setActive(valueStep);
    setMoved(false);
  }
  const focusOption = (index: number) =>
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus();

  // Opened, the list shows the current or nearest step in its middle.
  React.useLayoutEffect(() => {
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (list == null || option == null) return;
    list.scrollTop = option.offsetTop - (list.clientHeight - option.offsetHeight) / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only once, on opening
  }, []);
  React.useEffect(() => {
    if (!focusActive.current) return;
    focusActive.current = false;
    focusOption(active);
  }, [active]);
  React.useEffect(() => {
    if (handledRequest !== 0) focusOption(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new request
  }, [handledRequest]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const move = LIST_KEYS[event.key];
    if (move !== undefined) {
      event.preventDefault();
      focusActive.current = true;
      setMoved(true);
      const position = move(offered.indexOf(active), offered.length);
      setActive(offered[Math.min(Math.max(position, 0), offered.length - 1)]!);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPick(!moved && selected !== null ? selected : TIME_STEPS[active]!);
    }
  };

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label={t("datetime.chooseTime")}
      data-testid={testId === undefined ? undefined : `${testId}-times`}
      className={cn("relative max-h-64 w-24 overflow-y-auto p-1", className)}
      onKeyDown={onKeyDown}
    >
      {offered.map((index) => {
        const step = TIME_STEPS[index]!;
        return (
          <li
            key={index}
            role="option"
            data-index={index}
            tabIndex={index === active ? 0 : -1}
            aria-selected={sameTime(selected, step)}
            onClick={() => onPick(step)}
            className="cursor-pointer rounded-sm px-2 py-1.5 text-center text-sm tabular-nums outline-none select-none hover:bg-accent hover:text-accent-foreground focus-visible:focus-ring-inset aria-selected:bg-accent aria-selected:font-medium aria-selected:text-accent-foreground"
          >
            {formatTime(step)}
          </li>
        );
      })}
    </ul>
  );
}

// The date-time picker: grid and list side by side, stacked below 640 px. A day only sets the draft
// date and hands the focus to the list, onto the value's step; a time commits draft date and time.
// The list offers only the times that exist on the draft date (`SUI-FEATURE-460`): `exists` is false
// for a step in a DST gap.
function DateTimePanel({
  selected,
  today,
  reference,
  exists,
  onPick,
  testId,
}: {
  selected: (CalendarDate & WallTime) | null;
  today: CalendarDate;
  reference: WallTime;
  exists: (date: CalendarDate, time: WallTime) => boolean;
  onPick: (text: string) => void;
  testId?: string | undefined;
}) {
  const [date, setDate] = React.useState<CalendarDate>(selected ?? today);
  const [focusRequest, setFocusRequest] = React.useState(0);
  const offered = React.useMemo(
    () => ALL_STEPS.filter((index) => exists(date, TIME_STEPS[index]!)),
    [date, exists],
  );
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <CalendarGrid
        selected={date}
        today={today}
        autoFocus
        testId={testId}
        onPick={(day) => {
          setDate(day);
          setFocusRequest((count) => count + 1);
        }}
      />
      <TimeList
        selected={selected}
        reference={reference}
        offered={offered}
        focusRequest={focusRequest}
        testId={testId}
        className="max-sm:w-full sm:max-h-72 sm:border-l sm:pl-3"
        onPick={(time) => onPick(`${formatDate(date)} ${formatTime(time)}`)}
      />
    </div>
  );
}

export { CalendarGrid, DateTimePanel, TimeList };
