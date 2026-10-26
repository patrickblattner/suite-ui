import { ChevronDownIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { usePopupPlacement } from "../lib/popup-placement.js";
import { useFieldErrorAttributes } from "./field-error.js";
import { WithFieldValueHint } from "./field-value-hint.js";
import { Hint } from "./hint.js";

// The IANA zones of the runtime's own Intl database (`GL-UI-030` §Zeitzonen-Feld).
const TIME_ZONES: readonly string[] = Intl.supportedValuesOf("timeZone");

function normalize(text: string): string {
  return text.toLowerCase().replace(/_/g, " ");
}

function filterZones(zones: readonly string[], query: string): readonly string[] {
  const needle = normalize(query.trim());
  return needle === "" ? zones : zones.filter((zone) => normalize(zone).includes(needle));
}

type TimezoneComboboxProps = {
  // The IANA name; an empty string is "no zone chosen".
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  // The field hint: a hover hint on the field and its description for assistive tech. Without it, the
  // value hint of a surrounding `Field` takes its place (`Field valueHint`).
  hint?: string;
  // The error state, shown like every other form field of the package.
  invalid?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  // Set on the field only while it is invalid.
  "aria-errormessage"?: string;
  // Also names the open list `<id>-options` and each option `<id>-option`.
  "data-testid"?: string;
};

// A searchable choice over every IANA time zone. The value is always one of the offered zones: typing
// only filters, and text without a pick is discarded when the field closes, so free text never becomes
// a value.
//
// The list floats over the content at the field's width and shifts nothing below (`SUI-FEATURE-073`).
// It is no portal (`GL-UI-027` §Floating Content): where a dialog or panel body would clip it, the body
// first grows by the missing part at its end, so the dialog grows with the list; where that does not
// make room (the dialog at its height cap, a full-height panel), the list opens upwards.
function TimezoneCombobox({
  value,
  onValueChange,
  id,
  disabled = false,
  className,
  hint,
  invalid = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-errormessage": ariaErrorMessage,
  "data-testid": testId,
}: TimezoneComboboxProps) {
  const { t } = useTranslation("suite");
  // An invalid surrounding field marks the field too; its own `invalid` and error id come first.
  const fieldError = useFieldErrorAttributes();
  const isInvalid = invalid || ariaInvalid === true || fieldError["aria-invalid"] === true;
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-listbox`;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  // Whether the keyboard placed the highlight: then it carries the inset ring on top of the tint
  // (`GL-UI-013`); a highlight under the mouse keeps the tint alone.
  const [keyboard, setKeyboard] = React.useState(false);

  // A value outside the runtime's list (an older database) is still offered, so it stays visible.
  const zones = React.useMemo(
    () => (value === "" || TIME_ZONES.includes(value) ? TIME_ZONES : [value, ...TIME_ZONES]),
    [value],
  );
  const matches = React.useMemo(() => filterZones(zones, query), [zones, query]);

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const openList = () => {
    if (disabled || open) return;
    setOpen(true);
    setQuery("");
    setActive(Math.max(0, zones.indexOf(value)));
    setKeyboard(false);
  };

  const pick = (zone: string) => {
    onValueChange(zone);
    close();
  };

  // A pointer press outside closes the list and discards the typed text. A press on a tooltip bubble
  // belongs to the bubble alone and leaves the list open (`GL-UI-016` §Schließen, #596).
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-slot=tooltip-content]")) {
        return;
      }
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    // Escape closes the list only, not a surrounding dialog: radix listens on the document in the
    // capture phase, so this listener sits one step earlier, on the window.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [open, close]);

  // Places the open list before it paints; again when filtering changes its height.
  usePopupPlacement(open, anchorRef, popupRef, matches.length);

  React.useEffect(() => {
    if (!open) return;
    const option = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    option?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        setKeyboard(true);
        return;
      }
      setKeyboard(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => Math.min(Math.max(index + step, 0), Math.max(matches.length - 1, 0)));
    } else if (event.key === "Enter" && open) {
      // An open list owns Enter, so it never submits the surrounding form.
      event.preventDefault();
      const zone = matches[active];
      if (zone !== undefined) pick(zone);
    } else if (event.key === "Tab" && open) {
      close();
    }
  };

  const field = (
    <input
      id={inputId}
      type="text"
      role="combobox"
      autoComplete="off"
      spellCheck={false}
      aria-expanded={open}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={
        open && matches[active] !== undefined ? `${listId}-${active}` : undefined
      }
      aria-invalid={invalid || ariaInvalid || fieldError["aria-invalid"]}
      aria-describedby={ariaDescribedBy}
      aria-errormessage={
        isInvalid ? (ariaErrorMessage ?? fieldError["aria-errormessage"]) : undefined
      }
      data-testid={testId}
      disabled={disabled}
      placeholder={t("timezone.placeholder")}
      value={open ? query : value}
      onClick={openList}
      onChange={(event) => {
        if (!open) setOpen(true);
        setQuery(event.target.value);
        setActive(0);
        setKeyboard(true);
      }}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) close();
      }}
      className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent py-1 pr-9 pl-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:focus-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
    />
  );

  return (
    <div ref={rootRef} data-slot="timezone-combobox" className={cn("w-full", className)}>
      <div ref={anchorRef} className="relative">
        {hint === undefined ? (
          <WithFieldValueHint>{field}</WithFieldValueHint>
        ) : (
          <Hint text={hint}>{field}</Hint>
        )}
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        {open ? (
          <div
            ref={popupRef}
            className="absolute inset-x-0 top-full z-50 mt-1 rounded-md border bg-popover [--surface:var(--popover)] text-popover-foreground shadow-md data-[side=top]:top-auto data-[side=top]:bottom-full data-[side=top]:mt-0 data-[side=top]:mb-1"
          >
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">{t("timezone.empty")}</p>
            ) : null}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              data-testid={testId === undefined ? undefined : `${testId}-options`}
              className={cn("max-h-60 overflow-y-auto p-1", matches.length === 0 && "hidden")}
            >
              {matches.map((zone, index) => (
                <li
                  key={zone}
                  id={`${listId}-${index}`}
                  role="option"
                  data-testid={testId === undefined ? undefined : `${testId}-option`}
                  data-index={index}
                  aria-selected={zone === value}
                  data-active={index === active ? "" : undefined}
                  // Keeps the focus in the field, so the blur does not close the list before the click.
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseMove={() => {
                    setActive(index);
                    setKeyboard(false);
                  }}
                  onClick={() => pick(zone)}
                  className={cn(
                    "cursor-pointer rounded-sm px-2 py-1.5 text-sm select-none aria-selected:font-medium data-active:bg-accent data-active:text-accent-foreground",
                    keyboard && "data-active:focus-ring-inset",
                  )}
                >
                  {zone}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { TimezoneCombobox, type TimezoneComboboxProps };
