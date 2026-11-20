import { describe, expect, it } from "vitest";

import {
  addMonths,
  formatDate,
  formatTime,
  monthWeeks,
  nearestStep,
  parseDate,
  parseTime,
  readDate,
  TIME_STEPS,
  wallClock,
  zonedInstant,
} from "./date-time-internal.js";

describe("date and time entry (SUI-FEATURE-145)", () => {
  it.each([
    ["15.4.2026", { year: 2026, month: 4, day: 15 }],
    ["05.04.2026", { year: 2026, month: 4, day: 5 }],
    ["5.4.26", { year: 2026, month: 4, day: 5 }],
    ["29.2.2028", { year: 2028, month: 2, day: 29 }],
  ])("reads the date %s", (text, date) => {
    expect(parseDate(text)).toEqual(date);
  });

  it.each([
    "1.1.0050",
    "1.1.0999",
    "31.4.2026",
    "29.2.2026",
    "2026-04-15",
    "4/15/2026",
    "15.4",
    "15.4.202",
    "",
  ])("rejects the date %s", (text) => {
    expect(parseDate(text)).toBeNull();
  });

  it.each([
    ["14:30", "14:30"],
    ["1430", "14:30"],
    ["9:05", "09:05"],
    ["9", "09:00"],
    ["0:00", "00:00"],
    ["23:59", "23:59"],
  ])("reads the time %s as %s", (text, shown) => {
    const time = parseTime(text);
    expect(time).not.toBeNull();
    expect(formatTime(time!)).toBe(shown);
  });

  it.each(["9:5", "24:00", "12:60", "2:30 PM", "930", "12345", ""])(
    "rejects the time %s",
    (text) => {
      expect(parseTime(text)).toBeNull();
    },
  );

  it("tells a wrong form from a date the calendar does not have (SUI-FEATURE-460)", () => {
    expect(readDate("31.4.2026")).toBe("missing");
    expect(readDate("29.2.2026")).toBe("missing");
    expect(readDate("31-4-2026")).toBe("invalid");
    expect(readDate("1.1.0050")).toBe("invalid");
    expect(readDate("15.4.2026")).toEqual({ year: 2026, month: 4, day: 15 });
  });

  it("shows the date without leading zeros and the time in 24 h", () => {
    expect(formatDate({ year: 2026, month: 4, day: 15 })).toBe("15.4.2026");
    expect(formatTime({ hour: 14, minute: 30 })).toBe("14:30");
  });
});

describe("zone arithmetic (SUI-FEATURE-145)", () => {
  it("names the instant of a wall clock in a zone and back", () => {
    const clock = { year: 2026, month: 4, day: 15, hour: 14, minute: 30 };
    const instant = zonedInstant(clock, "Europe/Zurich");
    expect(new Date(instant!).toISOString()).toBe("2026-04-15T12:30:00.000Z");
    expect(wallClock(instant!, "Europe/Zurich")).toEqual(clock);
  });

  it("finds no instant in a DST gap", () => {
    const gap = { year: 2026, month: 3, day: 29, hour: 2, minute: 30 };
    expect(zonedInstant(gap, "Europe/Zurich")).toBeNull();
  });

  it("takes the earlier instant of a fall-back hour", () => {
    const twice = { year: 2026, month: 10, day: 25, hour: 2, minute: 30 };
    expect(new Date(zonedInstant(twice, "Europe/Zurich")!).toISOString()).toBe(
      "2026-10-25T00:30:00.000Z",
    );
  });
});

describe("picker grid and list (SUI-FEATURE-145)", () => {
  it("starts every week on Monday", () => {
    const weeks = monthWeeks(2026, 4);
    expect(weeks).toHaveLength(6);
    // 1 April 2026 is a Wednesday: the grid starts on Monday 30 March.
    expect(weeks[0]![0]).toEqual({ year: 2026, month: 3, day: 30 });
    expect(weeks[0]![2]).toEqual({ year: 2026, month: 4, day: 1 });
  });

  it("clamps a month step to the shorter month", () => {
    expect(addMonths({ year: 2026, month: 1, day: 31 }, 1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
    expect(addMonths({ year: 2026, month: 1, day: 15 }, -1)).toEqual({
      year: 2025,
      month: 12,
      day: 15,
    });
  });

  it("lists 15-minute steps from 00:00 to 23:45 and finds the nearest", () => {
    expect(TIME_STEPS).toHaveLength(96);
    expect(formatTime(TIME_STEPS[0]!)).toBe("00:00");
    expect(formatTime(TIME_STEPS.at(-1)!)).toBe("23:45");
    const all = TIME_STEPS.map((_, index) => index);
    const near = (hour: number, minute: number, offered = all) =>
      formatTime(TIME_STEPS[nearestStep({ hour, minute }, offered)]!);
    expect(near(14, 37)).toBe("14:30");
    expect(near(14, 38)).toBe("14:45");
    expect(near(23, 59)).toBe("23:45");
    // Without the gap steps 02:00–02:45, 02:30 goes to 03:00.
    expect(
      near(
        2,
        30,
        all.filter((index) => index < 8 || index > 11),
      ),
    ).toBe("03:00");
  });
});
