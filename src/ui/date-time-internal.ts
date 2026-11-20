// Parsing, display and zone arithmetic of `DateField`, `TimeField` and `DateTimeField`
// (`SUI-FEATURE-145`, `GL-UI-030`): day.month.year without leading zeros and 24-hour time in every
// language, independent of the browser locale.

type CalendarDate = { year: number; month: number; day: number };
type WallTime = { hour: number; minute: number };
type WallClock = CalendarDate & WallTime;

const DAY_MS = 86_400_000;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Years below 1000 are no entry: `Date.UTC` would read 0–99 as 1900–1999.
function validDate(year: number, month: number, day: number): CalendarDate | null {
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month))
    return null;
  return { year, month, day };
}

// `d.m.yyyy`, `dd.mm.yyyy` and `d.m.yy` (→ 20yy): the date, `"invalid"` for a wrong form (a year
// below 1000 included), `"missing"` for a well-formed date the calendar does not have (`SUI-FEATURE-460`).
function readDate(text: string): CalendarDate | "invalid" | "missing" {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(text.trim());
  if (match === null) return "invalid";
  const [, day, month, year] = match as unknown as [string, string, string, string];
  const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
  if (fullYear < 1000) return "invalid";
  return validDate(fullYear, Number(month), Number(day)) ?? "missing";
}

function parseDate(text: string): CalendarDate | null {
  const date = readDate(text);
  return typeof date === "string" ? null : date;
}

// `H:MM`, `HH:MM`, `HHMM` and `H` (→ `H:00`).
function parseTime(text: string): WallTime | null {
  const trimmed = text.trim();
  const match =
    /^(\d{1,2}):(\d{2})$/.exec(trimmed) ??
    /^(\d{2})(\d{2})$/.exec(trimmed) ??
    /^(\d{1,2})()$/.exec(trimmed);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = match[2] === "" ? 0 : Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

// `15.4.2026`
function formatDate({ year, month, day }: CalendarDate): string {
  return `${day}.${month}.${year}`;
}

// `09:05`
function formatTime({ hour, minute }: WallTime): string {
  return `${pad(hour)}:${pad(minute)}`;
}

// The value of `DateField`: `YYYY-MM-DD`.
function toIsoDate({ year, month, day }: CalendarDate): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function fromIsoDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match === null ? null : validDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

// The value of `TimeField`: `HH:MM`.
function fromIsoTime(value: string): WallTime | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const time = { hour: Number(match[1]), minute: Number(match[2]) };
  return time.hour < 24 && time.minute < 60 ? time : null;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

// The wall clock of an instant in an IANA zone.
function wallClock(instant: number, timeZone: string): WallClock {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of zoneFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
  };
}

function naiveUtc(clock: WallClock): number {
  return Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute);
}

// The instant a wall clock names in an IANA zone: null in a DST gap (the time does not exist), the
// earlier of the two in a fall-back hour.
function zonedInstant(clock: WallClock, timeZone: string): number | null {
  const naive = naiveUtc(clock);
  const offsets = new Set(
    [naive - DAY_MS, naive, naive + DAY_MS].map(
      (probe) => naiveUtc(wallClock(probe, timeZone)) - probe,
    ),
  );
  const instants = [...offsets]
    .map((offset) => naive - offset)
    .filter((instant) => naiveUtc(wallClock(instant, timeZone)) === naive);
  return instants.length === 0 ? null : Math.min(...instants);
}

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function sameDate(a: CalendarDate | null, b: CalendarDate | null): boolean {
  return a !== null && b !== null && a.year === b.year && a.month === b.month && a.day === b.day;
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

// The same day a number of months on, clamped to the last day of a shorter month.
function addMonths(date: CalendarDate, months: number): CalendarDate {
  const index = date.year * 12 + date.month - 1 + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

// The six Monday-first weeks shown for a month, days of the neighbouring months included.
function monthWeeks(year: number, month: number): CalendarDate[][] {
  const first = { year, month, day: 1 };
  const weekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const start = addDays(first, -weekday);
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)),
  );
}

// The 96 steps of the time list, 00:00–23:45.
const TIME_STEPS: readonly WallTime[] = Array.from({ length: 96 }, (_, index) => ({
  hour: Math.floor(index / 4),
  minute: (index % 4) * 15,
}));

// Of the offered steps (indices into `TIME_STEPS`), the one nearest a time; a tie goes to the earlier.
function nearestStep({ hour, minute }: WallTime, offered: readonly number[]): number {
  const minutes = hour * 60 + minute;
  const distance = (index: number) => {
    const step = TIME_STEPS[index]!;
    return Math.abs(step.hour * 60 + step.minute - minutes);
  };
  return offered.reduce((best, index) => (distance(index) < distance(best) ? index : best));
}

// The `Intl` locale of a UI language: English names come in British order (day before month,
// `GL-UI-030`).
function intlLocale(language: string): string {
  return language.startsWith("en") ? "en-GB" : language;
}

export {
  addDays,
  addMonths,
  browserTimeZone,
  type CalendarDate,
  formatDate,
  formatTime,
  fromIsoDate,
  fromIsoTime,
  intlLocale,
  monthWeeks,
  nearestStep,
  parseDate,
  parseTime,
  readDate,
  sameDate,
  TIME_STEPS,
  toIsoDate,
  type WallClock,
  type WallTime,
  wallClock,
  zonedInstant,
};
