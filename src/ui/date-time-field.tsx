import { CalendarIcon, ClockIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { isCompositionKey } from "./composition.js";
import { usePopupPlacement } from "../lib/popup-placement.js";
import { Button } from "./button.js";
import { CalendarGrid, DateTimePanel, TimeList } from "./date-picker-internal.js";
import {
  browserTimeZone,
  formatDate,
  formatTime,
  fromIsoDate,
  fromIsoTime,
  type CalendarDate,
  parseTime,
  readDate,
  toIsoDate,
  type WallClock,
  type WallTime,
  wallClock,
  zonedInstant,
} from "./date-time-internal.js";
import { useFieldDraft } from "./field-drafts-internal.js";
import { FieldError, FieldUserEditContext } from "./field-error.js";
import { useFieldLockReason } from "./field-value-hint.js";
import { captureOpener, returnFocus } from "./focus-return.js";
import { Input } from "./input.js";
import { isInLeaveGuardDialog } from "./leave-guard.js";
import { IconButtonTooltip } from "./tooltip.js";

// `SUI-FEATURE-145`: date, time and date-time entry in day.month.year and 24-hour time in every
// language, with a picker of the package's own instead of the native one (`GL-UI-030`).

type DateTimeFieldBaseProps = {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  id?: string;
  // Names the input; the picker button, the open picker and the error line derive theirs from it.
  testId?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-errormessage"?: string;
  "aria-required"?: boolean;
};

// A wrong form, or a well-formed value that does not exist (`SUI-FEATURE-460`).
type ErrorKey =
  "datetime.invalidDate" | "datetime.invalidTime" | "datetime.dateMissing" | "datetime.timeMissing";
type Reading = { value: string } | { error: ErrorKey };

type PanelProps = {
  value: string | null;
  pick: (text: string) => void;
  testId: string | undefined;
};

// What sets the three fields apart: how a value shows, how an entry reads, and the picker.
type Kind = {
  show: (value: string | null) => string;
  read: (text: string) => Reading;
  pickerLabel: "datetime.chooseDate" | "datetime.chooseTime" | "datetime.chooseDateTime";
  Icon: typeof CalendarIcon;
  Panel: (props: PanelProps) => React.ReactNode;
};

function today(timeZone: string) {
  return wallClock(Date.now(), timeZone);
}

const DATE_KIND: Kind = {
  show: (value) => {
    const date = value === null ? null : fromIsoDate(value);
    return date === null ? "" : formatDate(date);
  },
  read: (text) => {
    const date = readDate(text);
    if (date === "invalid") return { error: "datetime.invalidDate" };
    return date === "missing" ? { error: "datetime.dateMissing" } : { value: toIsoDate(date) };
  },
  pickerLabel: "datetime.chooseDate",
  Icon: CalendarIcon,
  Panel: ({ value, pick, testId }) => (
    <CalendarGrid
      selected={value === null ? null : fromIsoDate(value)}
      today={today(browserTimeZone())}
      autoFocus
      testId={testId}
      onPick={(date) => pick(formatDate(date))}
    />
  ),
};

const TIME_KIND: Kind = {
  show: (value) => {
    const time = value === null ? null : fromIsoTime(value);
    return time === null ? "" : formatTime(time);
  },
  read: (text) => {
    const time = parseTime(text);
    return time === null ? { error: "datetime.invalidTime" } : { value: formatTime(time) };
  },
  pickerLabel: "datetime.chooseTime",
  Icon: ClockIcon,
  Panel: ({ value, pick, testId }) => (
    <TimeList
      selected={value === null ? null : fromIsoTime(value)}
      reference={today(browserTimeZone())}
      autoFocus
      testId={testId}
      onPick={(time) => pick(formatTime(time))}
    />
  ),
};

function instantClock(value: string | null, timeZone: string): WallClock | null {
  const instant = value === null ? NaN : Date.parse(value);
  return Number.isNaN(instant) ? null : wallClock(instant, timeZone);
}

// Date, whitespace, time: the wall clock, or the reason it is no entry.
function readDateTime(text: string): WallClock | ErrorKey {
  const [datePart = "", timePart, ...rest] = text.trim().split(/\s+/);
  const date = readDate(datePart);
  if (date === "invalid") return "datetime.invalidDate";
  if (date === "missing") return "datetime.dateMissing";
  const time = timePart === undefined || rest.length > 0 ? null : parseTime(timePart);
  return time === null ? "datetime.invalidTime" : { ...date, ...time };
}

function dateTimeKind(timeZone: string): Kind {
  const exists = (date: CalendarDate, time: WallTime) =>
    zonedInstant({ ...date, ...time }, timeZone) !== null;
  return {
    show: (value) => {
      const clock = instantClock(value, timeZone);
      return clock === null ? "" : `${formatDate(clock)} ${formatTime(clock)}`;
    },
    read: (text) => {
      const clock = readDateTime(text);
      if (typeof clock === "string") return { error: clock };
      // A time in a DST gap does not exist on that day (`SUI-FEATURE-460`).
      const instant = zonedInstant(clock, timeZone);
      return instant === null
        ? { error: "datetime.timeMissing" }
        : { value: new Date(instant).toISOString() };
    },
    pickerLabel: "datetime.chooseDateTime",
    Icon: CalendarIcon,
    Panel: ({ value, pick, testId }) => (
      <DateTimePanel
        exists={exists}
        selected={instantClock(value, timeZone)}
        today={today(timeZone)}
        reference={today(timeZone)}
        testId={testId}
        onPick={pick}
      />
    ),
  };
}

// The typed text, its error and the commit on blur, Enter and a pick. A valid entry is normalised to
// the display form and reported once; an emptied field reports null; an invalid one keeps its text,
// reports nothing and shows the error.
function useEntry(kind: Kind, value: string | null, onChange: (next: string | null) => void) {
  const shown = kind.show(value);
  const [text, setText] = React.useState(shown);
  const [error, setError] = React.useState<ErrorKey | null>(null);
  // A new value from outside replaces the text and its error.
  const [lastShown, setLastShown] = React.useState(shown);
  if (shown !== lastShown) {
    setLastShown(shown);
    setText(shown);
    setError(null);
  }
  const commit = (entry: string) => {
    const trimmed = entry.trim();
    if (trimmed === shown) {
      setText(shown);
      setError(null);
      return;
    }
    if (trimmed === "") {
      setText("");
      setError(null);
      onChange(null);
      return;
    }
    const reading = kind.read(trimmed);
    if ("error" in reading) {
      setText(entry);
      setError(reading.error);
      return;
    }
    setText(kind.show(reading.value));
    setError(null);
    if (reading.value !== value) onChange(reading.value);
  };
  const pending = text.trim() !== shown;
  // Whether the pending entry would change the value: an emptied field or a valid, different entry.
  const changes = (): boolean => {
    const trimmed = text.trim();
    if (trimmed === "") return value !== null;
    const reading = kind.read(trimmed);
    return "value" in reading && reading.value !== value;
  };
  const discard = () => {
    setText(shown);
    setError(null);
  };
  return { text, setText, error, commit, pending, changes, discard };
}

const TOOLTIP_BUBBLE = "[data-slot=tooltip-content]";

// Closes the open picker on a press outside and on Esc; Esc hands the focus back to the input.
function useDismiss(
  open: boolean,
  rootRef: React.RefObject<HTMLElement | null>,
  close: (focusInput: boolean) => void,
) {
  const closeRef = React.useRef(close);
  React.useEffect(() => {
    closeRef.current = close;
  });
  React.useEffect(() => {
    if (!open) return;
    // A press outside closes it; a press on a tooltip bubble is the bubble's (#596). An Esc inside the
    // field closes the picker only, not a surrounding dialog: radix listens on the document in the
    // capture phase, so the key listener sits one step earlier, on the window; an Esc elsewhere is not
    // the picker's. Both leave the leave guard's dialog alone (SUI-FEATURE-118).
    const dismiss = (event: PointerEvent | KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (isInLeaveGuardDialog(target)) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape" || isCompositionKey(event)) return;
        if (!rootRef.current?.contains(target)) return;
        event.stopPropagation();
        closeRef.current(true);
      } else if (!rootRef.current?.contains(target) && !target?.closest(TOOLTIP_BUBBLE)) {
        closeRef.current(false);
      }
    };
    const capture = { capture: true };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismiss, capture);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss, capture);
    };
  }, [open, rootRef]);
}

// Disabled or locked while open, the picker closes: it takes no pick (Codex #964). A focus inside it
// returns to the input (#958); a natively disabled input takes no focus, so there it goes on as
// `GL-UI-050` rev 8 says — the group's next usable control, the main content, the container, never
// `<body>` (#826).
function useCloseOnLock(
  open: boolean,
  locked: boolean,
  popupRef: React.RefObject<HTMLElement | null>,
  inputRef: React.RefObject<HTMLElement | null>,
  setOpen: (open: boolean) => void,
) {
  React.useLayoutEffect(() => {
    if (!open || !locked) return;
    const inside = popupRef.current?.contains(document.activeElement) === true;
    // The focus inside the picker is read before it unmounts: only an effect sees it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
    if (inside) returnFocus(captureOpener(inputRef.current));
  }, [open, locked, popupRef, inputRef, setOpen]);
}

function joinIds(...ids: (string | undefined)[]): string | undefined {
  const joined = ids.filter((id) => id !== undefined && id !== "").join(" ");
  return joined === "" ? undefined : joined;
}

// The ARIA attributes of the input: only those that are set, so an invalid surrounding `Field`
// still marks it (`Input` spreads its error attributes first).
function inputAria(props: DateTimeFieldBaseProps, errorId: string | undefined) {
  const attributes: Record<string, string | boolean> = {};
  const set = (name: string, entry: string | boolean | undefined) => {
    if (entry !== undefined) attributes[name] = entry;
  };
  set("aria-label", props["aria-label"]);
  set("aria-labelledby", props["aria-labelledby"]);
  set("aria-describedby", joinIds(props["aria-describedby"], errorId));
  set("aria-invalid", errorId === undefined ? props["aria-invalid"] : true);
  set("aria-errormessage", props["aria-errormessage"]);
  set("aria-required", props["aria-required"]);
  return attributes;
}

function EntryField({ kind, ...props }: DateTimeFieldBaseProps & { kind: Kind }) {
  const { value, onChange, disabled: ownDisabled = false, id, testId } = props;
  const { t } = useTranslation("suite");
  // Locked with its field's reason (`SUI-FEATURE-450`): the input is read-only (`Input`), the picker
  // button locks like a `Button` with a reason — `aria-disabled`, focusable, never opens, the reason
  // as its description. The reason wins over `disabled`.
  const lockReason = useFieldLockReason();
  const locked = lockReason !== undefined;
  const disabled = ownDisabled && !locked;
  const errorId = React.useId();
  const panelId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const entry = useEntry(kind, value, onChange);
  // A typed, uncommitted entry belongs to the leave guard's decision (`SUI-FEATURE-118` rev 6): a
  // change counts, Save commits it, Discard drops it. An open picker is no change; it only closes once
  // the surface leaves.
  useFieldDraft(entry.pending && !disabled && !locked, {
    counts: entry.pending && entry.changes(),
    flush: () => entry.commit(entry.text),
    discard: entry.discard,
    element: () => rootRef.current,
  });
  useFieldDraft(open, {
    counts: false,
    flush: () => setOpen(false),
    discard: () => setOpen(false),
  });
  // The form around it hears a pick as the person's edit (`GL-UI-038`): a pick sends no input event.
  const userEdit = React.useContext(FieldUserEditContext);

  const close = (focusInput: boolean) => {
    setOpen(false);
    if (focusInput) inputRef.current?.focus();
  };
  useDismiss(open, rootRef, close);
  useCloseOnLock(open, disabled || locked, popupRef, inputRef, setOpen);
  usePopupPlacement(open, anchorRef, popupRef, 0);

  const pick = (text: string) => {
    userEdit?.();
    entry.commit(text);
    close(true);
  };
  const { Icon, Panel } = kind;
  return (
    <div
      ref={rootRef}
      data-slot="date-time-field"
      className="w-full"
      // The focus leaving the field closes the picker, so it never covers the next field
      // (`GL-UI-013`); a move into the leave guard's dialog or onto a tooltip bubble is no leaving.
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!open || isInLeaveGuardDialog(next) || rootRef.current?.contains(next)) return;
        if (next instanceof Element && next.closest(TOOLTIP_BUBBLE)) return;
        close(false);
      }}
    >
      <div ref={anchorRef} className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          data-testid={testId}
          disabled={disabled}
          className="pr-10"
          value={entry.text}
          onChange={(event) => entry.setText(event.target.value)}
          onBlur={(event) => {
            // A blur into the leave guard's dialog is no leaving (`SUI-FEATURE-118`).
            if (isInLeaveGuardDialog(event.relatedTarget)) return;
            // Locked, a text typed before the lock is dropped, never committed (#958).
            if (locked) entry.discard();
            else entry.commit(entry.text);
          }}
          onKeyDown={(event) => {
            // Enter takes a pending entry; with nothing pending it submits the form as usual.
            // The Enter that confirms a composition (IME) is the composition's (Codex #964).
            if (event.key !== "Enter" || isCompositionKey(event) || !entry.pending) return;
            event.preventDefault();
            if (locked) entry.discard();
            else entry.commit(entry.text);
          }}
          {...inputAria(props, entry.error === null ? undefined : errorId)}
        />
        {/* The tooltip's carrier span stands whether or not a reason locks the button (empty
            `disabledText` while usable), so a reason that arrives or leaves never remounts it and a
            focused button keeps the focus; only native `disabled` drops it. The span sits in this
            positioned box, out of the input's flow. */}
        <div className="absolute top-1/2 right-0.5 flex -translate-y-1/2">
          <IconButtonTooltip
            label={t(kind.pickerLabel)}
            disabledText={locked ? lockReason : disabled ? undefined : ""}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled || locked}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              data-testid={testId === undefined ? undefined : `${testId}-picker`}
              className="text-muted-foreground"
              onClick={() => (open ? close(true) : setOpen(!disabled && !locked))}
            >
              <Icon aria-hidden="true" />
            </Button>
          </IconButtonTooltip>
        </div>
        {open ? (
          <div
            ref={popupRef}
            id={panelId}
            // A press on the picker's background keeps the focus inside the field.
            tabIndex={-1}
            role="dialog"
            aria-label={t(kind.pickerLabel)}
            data-testid={testId === undefined ? undefined : `${testId}-popover`}
            className="absolute top-full left-0 z-50 mt-1 w-max max-w-[calc(100vw-2rem)] rounded-md border bg-popover [--surface:var(--popover)] p-3 text-popover-foreground shadow-md outline-none data-[side=top]:top-auto data-[side=top]:bottom-full data-[side=top]:mt-0 data-[side=top]:mb-1"
          >
            <Panel value={value} pick={pick} testId={testId} />
          </div>
        ) : null}
      </div>
      {entry.error === null ? null : (
        <FieldError
          id={errorId}
          className="mt-1.5"
          data-testid={testId === undefined ? undefined : `${testId}-error`}
        >
          {t(entry.error)}
        </FieldError>
      )}
    </div>
  );
}

type DateFieldProps = DateTimeFieldBaseProps;
type TimeFieldProps = DateTimeFieldBaseProps;
type DateTimeFieldProps = DateTimeFieldBaseProps & {
  // The IANA zone the value is shown and entered in; default the viewer's browser zone.
  timeZone?: string;
};

// The value: `YYYY-MM-DD` or null.
function DateField(props: DateFieldProps) {
  return <EntryField kind={DATE_KIND} {...props} />;
}

// The value: `HH:MM` (wall-clock time, 24 h, no zone) or null.
function TimeField(props: TimeFieldProps) {
  return <EntryField kind={TIME_KIND} {...props} />;
}

// The value: an UTC ISO-8601 instant (`toISOString()`) or null, shown and entered in `timeZone`.
function DateTimeField({ timeZone, ...props }: DateTimeFieldProps) {
  const zone = timeZone ?? browserTimeZone();
  const kind = React.useMemo(() => dateTimeKind(zone), [zone]);
  return <EntryField kind={kind} {...props} />;
}

export {
  DateField,
  type DateFieldProps,
  DateTimeField,
  type DateTimeFieldProps,
  TimeField,
  type TimeFieldProps,
};
