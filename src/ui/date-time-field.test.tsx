import { act, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DateField, DateTimeField, TimeField } from "./date-time-field.js";
import { FieldUserEditContext } from "./field-error.js";
import { Field } from "./field.js";

type AnyField = typeof DateField | typeof TimeField | typeof DateTimeField;

function Controlled({
  Field,
  initial = null,
  onChange,
  ...rest
}: {
  Field: AnyField;
  initial?: string | null;
  onChange: (next: string | null) => void;
  timeZone?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <Field
      aria-label="When"
      testId="field"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      {...rest}
    />
  );
}

function enter(input: HTMLElement, text: string) {
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: "Enter" });
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DateField, TimeField, DateTimeField (SUI-FEATURE-145)", () => {
  it("AC1: shows 24 h and T.M.JJJJ under an en-US browser locale", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
    render(
      <>
        <TimeField aria-label="Time" value="14:30" onChange={() => {}} />
        <DateField aria-label="Day" value="2026-04-15" onChange={() => {}} />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Time" })).toHaveValue("14:30");
    expect(screen.getByRole("textbox", { name: "Day" })).toHaveValue("15.4.2026");
  });

  it("AC2: 1430 → 14:30, 9:5 → error without onChange, 9:05 → 09:05", () => {
    const onChange = vi.fn();
    render(<Controlled Field={TimeField} onChange={onChange} />);
    const input = screen.getByTestId("field");

    enter(input, "1430");
    expect(onChange).toHaveBeenLastCalledWith("14:30");
    expect(input).toHaveValue("14:30");

    enter(input, "9:5");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("9:5");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const error = screen.getByTestId("field-error");
    expect(error).toHaveTextContent("Enter the time as HH:MM");
    expect(input.getAttribute("aria-describedby")).toContain(error.id);

    enter(input, "9:05");
    expect(onChange).toHaveBeenLastCalledWith("09:05");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(input).toHaveValue("09:05");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByTestId("field-error")).not.toBeInTheDocument();
  });

  it("AC2: takes the date forms on blur and reports null when emptied", () => {
    const onChange = vi.fn();
    render(<Controlled Field={DateField} initial="2026-04-15" onChange={onChange} />);
    const input = screen.getByTestId("field");
    fireEvent.change(input, { target: { value: "5.4.26" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith("2026-04-05");
    expect(input).toHaveValue("5.4.2026");
    fireEvent.change(input, { target: { value: "31.4.2026" } });
    fireEvent.blur(input);
    expect(screen.getByTestId("field-error")).toHaveTextContent("This date does not exist");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("AC2: a time in the DST gap is invalid, a fall-back time takes the earlier instant", () => {
    const onChange = vi.fn();
    render(<Controlled Field={DateTimeField} timeZone="Europe/Zurich" onChange={onChange} />);
    const input = screen.getByTestId("field");
    enter(input, "29.3.2026 02:30");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("field-error")).toHaveTextContent(
      "This time does not exist on this day because of the clock change",
    );
    enter(input, "25.10.2026 02:30");
    expect(onChange).toHaveBeenLastCalledWith("2026-10-25T00:30:00.000Z");
  });

  it("AC3: Europe/Zurich 15.4.2026 14:30 → 2026-04-15T12:30:00.000Z, shown back", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DateTimeField aria-label="At" timeZone="Europe/Zurich" value={null} onChange={onChange} />,
    );
    enter(screen.getByRole("textbox", { name: "At" }), "15.4.2026 14:30");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-04-15T12:30:00.000Z");
    rerender(
      <DateTimeField
        aria-label="At"
        timeZone="Europe/Zurich"
        value="2026-04-15T12:30:00.000Z"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("textbox", { name: "At" })).toHaveValue("15.4.2026 14:30");
  });

  it("Enter with nothing pending leaves the form its submit", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TimeField aria-label="Time" value="14:30" onChange={() => {}} />
      </form>,
    );
    const event = fireEvent.keyDown(screen.getByRole("textbox", { name: "Time" }), {
      key: "Enter",
    });
    expect(event).toBe(true);
  });
});

describe("the picker's selected entries (GL-UI-013 rev 6, finding #819)", () => {
  // GL-UI-013, finding #819: the selected day, filled, still answers hover, with the filled button's
  // tint; an unselected day keeps the accent tint. The gallery measures the colours.
  it("the selected day answers hover with the filled tint, not its own fill", () => {
    render(<DateField testId="field" aria-label="Day" value="2026-04-15" onChange={() => {}} />);
    fireEvent.click(screen.getByTestId("field-picker"));
    const calendar = screen.getByTestId("field-calendar");
    const selected = calendar.querySelector<HTMLElement>("[data-date='2026-04-15']")!;
    expect(selected.className.split(" ")).toContain("hover:bg-primary-hover");
    expect(selected.className.split(" ")).not.toContain("hover:bg-primary");
    const other = calendar.querySelector<HTMLElement>("[data-date='2026-04-16']")!;
    expect(other.className.split(" ")).toContain("hover:bg-accent");
  });

  // GL-UI-013 rev 6, finding #819: the selected time step keeps its tint; hover takes the tint's own
  // hover token, as the selected day does. The gallery measures the colours.
  it("the selected time step keeps its tint and answers hover with secondary-hover", () => {
    render(<TimeField testId="field" aria-label="Time" value="14:30" onChange={() => {}} />);
    fireEvent.click(screen.getByTestId("field-picker"));
    const selected = within(screen.getByTestId("field-times")).getByRole("option", {
      selected: true,
    });
    const classes = selected.className.split(" ");
    expect(selected).toHaveTextContent("14:30");
    expect(classes).toEqual(
      expect.arrayContaining(["aria-selected:bg-accent", "aria-selected:hover:bg-secondary-hover"]),
    );
  });
});

describe("the picker (SUI-FEATURE-145 §Picker)", () => {
  it.each(["de", "en", "es"])("AC4: the calendar starts on Monday in %s", async (lng) => {
    await i18n.changeLanguage(lng);
    render(<DateField testId="field" aria-label="Day" value="2026-04-15" onChange={() => {}} />);
    fireEvent.click(screen.getByTestId("field-picker"));
    const headers = within(screen.getByTestId("field-calendar")).getAllByRole("columnheader");
    const monday = new Intl.DateTimeFormat(lng === "en" ? "en-GB" : lng, {
      weekday: "long",
      timeZone: "UTC",
    }).format(Date.UTC(2024, 0, 1));
    expect(headers[0]).toHaveAttribute("abbr", monday);
    expect(headers).toHaveLength(7);
  });

  it("AC4: arrows, PageDown and Enter pick a day; the focus returns to the input", () => {
    const onChange = vi.fn();
    render(<Controlled Field={DateField} initial="2026-04-15" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("field-picker"));
    const calendar = screen.getByTestId("field-calendar");
    expect(document.activeElement).toHaveAttribute("data-date", "2026-04-15");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toHaveAttribute("data-date", "2026-04-23");
    fireEvent.keyDown(document.activeElement!, { key: "PageDown" });
    expect(document.activeElement).toHaveAttribute("data-date", "2026-05-23");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    fireEvent.keyDown(document.activeElement!, { key: "PageUp" });
    expect(document.activeElement).toHaveAttribute("data-date", "2026-04-15");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    fireEvent.keyDown(calendar.querySelector("[tabindex='0']")!, { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-04-16");
    expect(screen.queryByTestId("field-popover")).not.toBeInTheDocument();
    expect(screen.getByTestId("field")).toHaveFocus();
    expect(screen.getByTestId("field")).toHaveValue("16.4.2026");
  });

  it("AC4: Esc closes the picker and returns the focus to the input", () => {
    const onChange = vi.fn();
    render(<Controlled Field={DateField} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("field-picker"));
    expect(screen.getByTestId("field-popover")).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByTestId("field-popover")).not.toBeInTheDocument();
    expect(screen.getByTestId("field")).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("AC4: month and weekday names come from Intl in the UI language", async () => {
    await i18n.changeLanguage("de");
    render(<DateField testId="field" aria-label="Tag" value="2026-04-15" onChange={() => {}} />);
    fireEvent.click(screen.getByTestId("field-picker"));
    const popover = screen.getByTestId("field-popover");
    expect(popover).toHaveTextContent("April 2026");
    expect(within(popover).getByRole("button", { name: "Vorheriger Monat" })).toBeInTheDocument();
    fireEvent.click(within(popover).getByRole("button", { name: "Nächster Monat" }));
    expect(popover).toHaveTextContent("Mai 2026");
  });

  it("AC4: the time list holds 15-minute steps and starts at the nearest one", () => {
    const onChange = vi.fn();
    render(<Controlled Field={TimeField} initial="14:37" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("field-picker"));
    const options = within(screen.getByTestId("field-times")).getAllByRole("option");
    expect(options).toHaveLength(96);
    expect(options[0]).toHaveTextContent("00:00");
    expect(options[95]).toHaveTextContent("23:45");
    expect(document.activeElement).toHaveTextContent("14:30");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("14:45");
    expect(screen.getByTestId("field")).toHaveFocus();
  });

  it("AC4: date-time picks a day, then a time", () => {
    const onChange = vi.fn();
    render(
      <Controlled
        Field={DateTimeField}
        timeZone="Europe/Zurich"
        initial="2026-04-15T12:30:00.000Z"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId("field-picker"));
    const popover = screen.getByTestId("field-popover");
    expect(within(popover).getByTestId("field-calendar")).toBeInTheDocument();
    fireEvent.click(popover.querySelector("[data-date='2026-04-20']")!);
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toHaveTextContent("14:30");
    fireEvent.click(within(popover).getByRole("option", { name: "09:00" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-04-20T07:00:00.000Z");
    expect(screen.getByTestId("field")).toHaveValue("20.4.2026 09:00");
  });

  it("AC4: disabled locks input and button; the picker never opens", () => {
    render(<DateField testId="field" aria-label="Day" disabled value={null} onChange={() => {}} />);
    expect(screen.getByTestId("field")).toBeDisabled();
    expect(screen.getByTestId("field-picker")).toBeDisabled();
    fireEvent.click(screen.getByTestId("field-picker"));
    expect(screen.queryByTestId("field-popover")).not.toBeInTheDocument();
  });

  it("AC5: no native date or time input in any of the three", () => {
    const { container } = render(
      <>
        <DateField aria-label="a" value="2026-04-15" onChange={() => {}} />
        <TimeField aria-label="b" value="14:30" onChange={() => {}} />
        <DateTimeField aria-label="c" value="2026-04-15T12:30:00.000Z" onChange={() => {}} />
      </>,
    );
    for (const button of screen.getAllByRole("button")) {
      act(() => {
        fireEvent.click(button);
      });
      expect(
        container.querySelector("input[type=date], input[type=time], input[type=datetime-local]"),
      ).toBeNull();
    }
    expect(container.querySelectorAll("input[type=text]")).toHaveLength(3);
  });

  it("AC6: picker buttons are named in the UI language", async () => {
    await i18n.changeLanguage("es");
    render(
      <>
        <DateField aria-label="a" value={null} onChange={() => {}} />
        <TimeField aria-label="b" value={null} onChange={() => {}} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Elegir fecha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elegir hora" })).toBeInTheDocument();
  });
});

describe("the picker commit (SUI-FEATURE-145 rev 3)", () => {
  function openDateTime(initial: string | null) {
    const onChange = vi.fn();
    render(
      <Controlled
        Field={DateTimeField}
        timeZone="Europe/Zurich"
        initial={initial}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId("field-picker"));
    return { onChange, popover: screen.getByTestId("field-popover") };
  }

  it("AC4: a day keeps the popover open with the focus on the value's step; Enter keeps 14:37", () => {
    const { onChange, popover } = openDateTime("2026-04-15T12:37:00.000Z");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(popover).toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute("role", "option");
    expect(document.activeElement).toHaveTextContent("14:30");
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-04-17T12:37:00.000Z");
    expect(screen.queryByTestId("field-popover")).not.toBeInTheDocument();
    expect(screen.getByTestId("field")).toHaveValue("17.4.2026 14:37");
    expect(screen.getByTestId("field")).toHaveFocus();
  });

  it("AC4: a step moved to with the keyboard commits that step with the draft date", () => {
    const { onChange, popover } = openDateTime("2026-04-15T12:37:00.000Z");
    fireEvent.click(popover.querySelector("[data-date='2026-04-20']")!);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-04-20T12:45:00.000Z");
  });

  it("without a value the list opens at the step nearest now in timeZone; the date is today", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-15T09:07:00Z"));
    try {
      const { onChange } = openDateTime(null);
      const times = screen.getByTestId("field-times");
      expect(times.querySelector("[tabindex='0']")).toHaveTextContent("10:00");
      fireEvent.click(within(times).getByRole("option", { name: "10:15" }));
      expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-01-15T09:15:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("Esc after a day closes without a change", () => {
    const { onChange, popover } = openDateTime("2026-04-15T12:37:00.000Z");
    fireEvent.click(popover.querySelector("[data-date='2026-04-20']")!);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByTestId("field-popover")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("field")).toHaveValue("15.4.2026 14:37");
  });

  it("TimeField: Enter on the unmoved list keeps an off-step time", () => {
    const onChange = vi.fn();
    render(<Controlled Field={TimeField} initial="14:37" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("field-picker"));
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("field")).toHaveValue("14:37");
    expect(screen.queryByTestId("field-popover")).not.toBeInTheDocument();
  });
});

describe("the picker and the focus around it", () => {
  function openBeside(onOutsideKey = vi.fn()) {
    render(
      <>
        <DateField testId="field" aria-label="Day" value="2026-04-15" onChange={() => {}} />
        <input aria-label="Next" onKeyDown={onOutsideKey} />
      </>,
    );
    fireEvent.click(screen.getByTestId("field-picker"));
    expect(screen.getByTestId("field-popover")).toBeInTheDocument();
    return screen.getByRole("textbox", { name: "Next" });
  }

  it("closes when the focus leaves the field, so it never covers the next one", () => {
    const next = openBeside();
    act(() => next.focus());
    expect(screen.queryByTestId("field-popover")).not.toBeInTheDocument();
    expect(next).toHaveFocus();
  });

  it("stays open while the focus moves inside it", () => {
    openBeside();
    act(() => screen.getByRole("button", { name: "Next month" }).focus());
    expect(screen.getByTestId("field-popover")).toBeInTheDocument();
    act(() => screen.getByTestId("field-popover").focus());
    expect(screen.getByTestId("field-popover")).toBeInTheDocument();
  });

  it("leaves an Esc outside the field to its own control", () => {
    const onOutsideKey = vi.fn();
    const next = openBeside(onOutsideKey);
    fireEvent.keyDown(next, { key: "Escape" });
    expect(onOutsideKey).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("field-popover")).toBeInTheDocument();
  });
});

describe("impossible values, DST-gap steps, date-time button name (SUI-FEATURE-460)", () => {
  it.each([
    [DateField, undefined, "31.4.2026", "This date does not exist"],
    [DateField, undefined, "31-4-2026", "Enter the date as D.M.YYYY"],
    [
      DateTimeField,
      "Europe/Zurich",
      "29.3.2026 02:30",
      "This time does not exist on this day because of the clock change",
    ],
    [DateTimeField, "Europe/Zurich", "31.4.2026 02:30", "This date does not exist"],
    [DateTimeField, "Europe/Zurich", "15.4.2026 9:5", "Enter the time as HH:MM"],
  ] as const)("%o %s: %s → %s, no onChange", (Field, timeZone, text, message) => {
    const onChange = vi.fn();
    render(
      <Controlled
        Field={Field}
        onChange={onChange}
        {...(timeZone === undefined ? {} : { timeZone })}
      />,
    );
    const input = screen.getByTestId("field");
    enter(input, text);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(text);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("field-error")).toHaveTextContent(message);
  });

  it("TimeField: 02:30 is reported", () => {
    const onChange = vi.fn();
    render(<Controlled Field={TimeField} onChange={onChange} />);
    enter(screen.getByTestId("field"), "02:30");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("02:30");
  });

  it("DateTimeField, Europe/Zurich, draft day 29.3.2026: the list omits 02:00–02:45", () => {
    render(
      <Controlled
        Field={DateTimeField}
        timeZone="Europe/Zurich"
        initial="2026-03-28T12:00:00.000Z"
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("field-picker"));
    const times = () =>
      within(screen.getByTestId("field-times"))
        .getAllByRole("option")
        .map((option) => option.textContent);
    expect(times()).toHaveLength(96);
    fireEvent.click(screen.getByTestId("field-popover").querySelector("[data-date='2026-03-29']")!);
    expect(times()).toHaveLength(92);
    expect(times()).not.toContain("02:00");
    expect(times()).not.toContain("02:45");
    expect(times()).toContain("01:45");
    expect(times()).toContain("03:00");
  });

  it("TimeField keeps all 96 steps", () => {
    render(<TimeField testId="field" aria-label="Time" value="02:30" onChange={() => {}} />);
    fireEvent.click(screen.getByTestId("field-picker"));
    expect(within(screen.getByTestId("field-times")).getAllByRole("option")).toHaveLength(96);
  });

  it.each([
    ["en", "Choose date and time"],
    ["de", "Datum und Uhrzeit wählen"],
    ["es", "Elegir fecha y hora"],
  ])("DateTimeField button and popover are named chooseDateTime in %s", async (lng, name) => {
    await i18n.changeLanguage(lng);
    render(<DateTimeField testId="field" aria-label="At" value={null} onChange={() => {}} />);
    const button = screen.getByRole("button", { name });
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name })).toBe(screen.getByTestId("field-popover"));
  });
});

describe("the form around the field (GL-UI-038, finding #820)", () => {
  it("a pick marks the surrounding form edited", () => {
    const userEdit = vi.fn();
    const onChange = vi.fn();
    render(
      <FieldUserEditContext.Provider value={userEdit}>
        <Controlled Field={DateField} initial="2026-04-15" onChange={onChange} />
      </FieldUserEditContext.Provider>,
    );
    fireEvent.click(screen.getByTestId("field-picker"));
    expect(userEdit).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-04-16");
    expect(userEdit).toHaveBeenCalledTimes(1);
  });

  it("the same value typed in another form sends no onChange", () => {
    const onChange = vi.fn();
    render(<Controlled Field={DateField} initial="2026-04-15" onChange={onChange} />);
    const input = screen.getByTestId("field");
    enter(input, "15.04.2026");
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("15.4.2026");
  });
});

describe("Codex #964", () => {
  it("CX1: Enter on the list keeps the value's time; in a DST gap on the draft date it takes the nearest step", () => {
    const onChange = vi.fn();
    render(
      <Controlled
        Field={DateTimeField}
        timeZone="Europe/Zurich"
        initial="2026-03-28T01:30:00.000Z"
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId("field")).toHaveValue("28.3.2026 02:30");
    fireEvent.click(screen.getByTestId("field-picker"));
    fireEvent.click(screen.getByTestId("field-popover").querySelector("[data-date='2026-03-29']")!);
    fireEvent.keyDown(screen.getByTestId("field-times"), { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-03-29T01:00:00.000Z");
    expect(screen.getByTestId("field")).toHaveValue("29.3.2026 03:00");
    expect(screen.queryByTestId("field-error")).toBeNull();
  });

  it.each([
    ["disabled", { disabled: true }],
    ["locked by its field's reason", {}],
  ] as const)("CX2: %s while open, the picker closes and takes no pick", (_, lock) => {
    const onChange = vi.fn();
    const ui = (locked: boolean) => (
      <Field
        label="At"
        htmlFor="at"
        disabledReason={locked && !("disabled" in lock) ? "No." : undefined}
      >
        <TimeField
          id="at"
          testId="field"
          value="09:00"
          onChange={onChange}
          {...(locked ? lock : {})}
        />
      </Field>
    );
    const { rerender } = render(ui(false));
    fireEvent.click(screen.getByTestId("field-picker"));
    const ten = within(screen.getByTestId("field-times")).getByRole("option", { name: "10:00" });
    rerender(ui(true));
    expect(screen.queryByTestId("field-popover")).toBeNull();
    fireEvent.click(ten);
    expect(onChange).not.toHaveBeenCalled();
  });

  // #826, GL-UI-050 rev 8: a natively disabled input takes no focus; the focus inside the closing
  // picker goes to the group's next usable control, never <body>.
  it("disabled while its picker holds the focus: the focus goes to the group's next control", () => {
    const ui = (disabled: boolean) => (
      <div data-focus-group="">
        <TimeField
          testId="field"
          aria-label="At"
          value="09:00"
          onChange={() => {}}
          disabled={disabled}
        />
        <button type="button" data-testid="next">
          Next
        </button>
      </div>
    );
    const { rerender } = render(ui(false));
    fireEvent.click(screen.getByTestId("field-picker"));
    within(screen.getByTestId("field-times")).getByRole("option", { name: "10:00" }).focus();
    expect(screen.getByTestId("field-popover")).toContainElement(
      document.activeElement as HTMLElement,
    );
    rerender(ui(true));
    expect(screen.queryByTestId("field-popover")).toBeNull();
    expect(screen.getByTestId("field")).toBeDisabled();
    expect(document.activeElement).toBe(screen.getByTestId("next"));
  });

  // #977 (Codex CX1): locked with a reason the input keeps its focus, also inside a list row, whose
  // entry the GL-UI-050 fallback would take instead.
  it("locked by its field's reason while its picker holds the focus, in a list row: the focus returns to the input", () => {
    const ui = (locked: boolean) => (
      <div data-slot="list-frame">
        <div data-grid-item="" tabIndex={-1} data-testid="row">
          <Field label="At" htmlFor="at" disabledReason={locked ? "No." : undefined}>
            <TimeField id="at" testId="field" value="09:00" onChange={() => {}} />
          </Field>
        </div>
      </div>
    );
    const { rerender } = render(ui(false));
    fireEvent.click(screen.getByTestId("field-picker"));
    within(screen.getByTestId("field-times")).getByRole("option", { name: "10:00" }).focus();
    rerender(ui(true));
    expect(screen.queryByTestId("field-popover")).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("field"));
  });

  it.each([
    ["isComposing", { isComposing: true }],
    ["key code 229", { keyCode: 229 }],
  ] as const)("CX3: the Enter of a composition (%s) commits nothing", (_, init) => {
    const onChange = vi.fn();
    render(<Controlled Field={TimeField} onChange={onChange} />);
    const input = screen.getByTestId("field");
    fireEvent.change(input, { target: { value: "1430" } });
    fireEvent.keyDown(input, { key: "Enter", ...init });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("1430");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("14:30");
  });

  it("CX4: a day the zone skipped whole (Pacific/Apia 30.12.2011) offers no time and throws nothing", () => {
    const onChange = vi.fn();
    render(
      <Controlled
        Field={DateTimeField}
        timeZone="Pacific/Apia"
        initial="2011-12-29T22:00:00.000Z"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId("field-picker"));
    const day = screen
      .getByTestId("field-popover")
      .querySelector<HTMLElement>("[data-date='2011-12-30']")!;
    day.focus();
    expect(() => fireEvent.click(day)).not.toThrow();
    const times = screen.getByTestId("field-times");
    expect(within(times).queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByTestId("field-calendar")).toContainElement(
      document.activeElement as HTMLElement,
    );
    for (const key of ["ArrowDown", "End", "Home", "PageDown", "Enter", " "]) {
      const event = createEvent.keyDown(times, { key });
      expect(() => fireEvent(times, event)).not.toThrow();
      // The empty list leaves every key alone, as it came.
      expect(event.defaultPrevented).toBe(false);
    }
    expect(onChange).not.toHaveBeenCalled();
  });
});
