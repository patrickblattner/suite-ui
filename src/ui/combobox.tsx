import { ChevronDownIcon, PlusIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { usePopupPlacement } from "../lib/popup-placement.js";
import { useFieldErrorAttributes } from "./field-error.js";
import { WithFieldValueHint } from "./field-value-hint.js";
import { Hint } from "./hint.js";

type ComboboxOption = { value: string; label: string };

type ComboboxProps = {
  // The records offered; with `onSearch` those shown while nothing is typed.
  options: readonly ComboboxOption[];
  // The chosen option's value; an empty string is "nothing chosen".
  value: string;
  // With the picked option, which the call site passes back as `selectedOption` when it may be missing
  // from `options` (a record found by `onSearch`).
  onValueChange: (value: string, option: ComboboxOption) => void;
  // The chosen option itself, for a value that is not among `options`: a record found by `onSearch` or
  // created in the `CreateAndSelectDialog`. Without it such a value shows as it is.
  selectedOption?: ComboboxOption;
  // The form field name: a hidden input carries the value into the form (the `CreateAndSelectDialog`
  // reads its fields by name).
  name?: string;
  // Server search: the typed text's matches. While it runs the list says so; with no match it says
  // that. Without it the options are filtered here.
  onSearch?: (term: string) => Promise<readonly ComboboxOption[]>;
  // With it the list ends in the create entry, the term in the language's quotes (de „⟨term⟩“
  // anlegen …), which hands the typed text over: the call site opens its `CreateAndSelectDialog`
  // (`SUI-FEATURE-093` rev 4). A term that names a listed entry exactly, in any letter case, gets none.
  onCreateRequest?: (term: string) => void;
  placeholder?: string;
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
  // Also names the open list `<id>-options`, each option `<id>-option` and the create entry
  // `<id>-create`.
  "data-testid"?: string;
};

function filterOptions(options: readonly ComboboxOption[], query: string) {
  const needle = query.trim().toLowerCase();
  return needle === ""
    ? options
    : options.filter((option) => option.label.toLowerCase().includes(needle));
}

// A searchable single choice over records (`SUI-FEATURE-093`), the building block of the apps' record
// pickers (contact, location, speaker). It works as the `TimezoneCombobox` does: the value is always
// one of the offered options, typing only searches, and text without a pick is discarded when the
// field closes. The list floats over the content at the field's width, no portal, and opens upwards
// where a dialog or panel cannot make room below.
function Combobox({
  options,
  value,
  onValueChange,
  selectedOption,
  name,
  onSearch,
  onCreateRequest,
  placeholder,
  id,
  disabled = false,
  className,
  hint,
  invalid = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-errormessage": ariaErrorMessage,
  "data-testid": testId,
}: ComboboxProps) {
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
  // The server's matches of the typed text, `null` while it searches.
  const [found, setFound] = React.useState<readonly ComboboxOption[] | null>([]);
  const search = React.useRef(0);
  // The option picked last, so its label shows even when it came from a search, not from `options`.
  const [picked, setPicked] = React.useState<ComboboxOption | null>(null);

  const term = query.trim();
  const matches =
    onSearch === undefined ? filterOptions(options, query) : term === "" ? options : (found ?? []);
  const loading = onSearch !== undefined && term !== "" && found === null;
  // Not while the search runs: the entry would stand alone, and Enter would create a record the
  // answer is about to offer. Nor for a term that names a listed entry exactly, in any letter case
  // (`SUI-FEATURE-093` rev 4).
  const listed = matches.some((option) => option.label.toLowerCase() === term.toLowerCase());
  const create = onCreateRequest !== undefined && term !== "" && !loading && !listed;
  const count = matches.length + (create ? 1 : 0);
  const label =
    options.find((option) => option.value === value)?.label ??
    (selectedOption?.value === value ? selectedOption.label : undefined) ??
    (picked?.value === value ? picked.label : value);

  const close = React.useCallback(() => {
    search.current += 1;
    setOpen(false);
    setQuery("");
  }, []);

  const openList = () => {
    if (disabled || open) return;
    setOpen(true);
    setQuery("");
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    setKeyboard(false);
  };

  const pick = (index: number) => {
    const option = matches[index];
    close();
    if (option !== undefined) {
      setPicked(option);
      onValueChange(option.value, option);
    } else if (create) {
      onCreateRequest?.(term);
    }
  };

  const type = (text: string) => {
    if (!open) setOpen(true);
    setQuery(text);
    setActive(0);
    setKeyboard(true);
    if (onSearch === undefined || text.trim() === "") return;
    // Only the answer to the latest text counts.
    const own = ++search.current;
    setFound(null);
    onSearch(text.trim()).then(
      (result) => {
        if (own === search.current) setFound(result);
      },
      () => {
        if (own === search.current) setFound([]);
      },
    );
  };

  // A pointer press outside closes the list and discards the typed text.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
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

  // A hidden input fires no event when its value changes: it announces the new value as typing would,
  // so a surrounding form (the `CreateAndSelectDialog`'s check for input) hears it wherever the value's
  // state lives (#271).
  const hiddenRef = React.useRef<HTMLInputElement>(null);
  const announced = React.useRef(value);
  React.useEffect(() => {
    if (announced.current === value) return;
    announced.current = value;
    hiddenRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [value]);

  // Places the open list before it paints; again when searching changes its height.
  usePopupPlacement(open, anchorRef, popupRef, count + (loading ? 1 : 0));

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
      setActive((index) => Math.min(Math.max(index + step, 0), Math.max(count - 1, 0)));
    } else if (event.key === "Enter" && open) {
      // An open list owns Enter, so it never submits the surrounding form.
      event.preventDefault();
      if (active < count) pick(active);
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
      aria-activedescendant={open && active < count ? `${listId}-${active}` : undefined}
      aria-invalid={invalid || ariaInvalid || fieldError["aria-invalid"]}
      aria-describedby={ariaDescribedBy}
      aria-errormessage={
        isInvalid ? (ariaErrorMessage ?? fieldError["aria-errormessage"]) : undefined
      }
      data-testid={testId}
      disabled={disabled}
      placeholder={placeholder ?? t("combobox.placeholder")}
      value={open ? query : label}
      onClick={openList}
      onChange={(event) => type(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) close();
      }}
      className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent py-1 pr-9 pl-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:focus-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
    />
  );

  return (
    <div ref={rootRef} data-slot="combobox" className={cn("w-full", className)}>
      {name === undefined ? null : (
        <input ref={hiddenRef} type="hidden" name={name} value={value} disabled={disabled} />
      )}
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
            {loading || matches.length === 0 ? (
              <p
                role="status"
                className="px-3 py-2 text-sm text-muted-foreground"
                data-testid={testId === undefined ? undefined : `${testId}-status`}
              >
                {loading ? t("combobox.loading") : t("combobox.empty")}
              </p>
            ) : null}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              data-testid={testId === undefined ? undefined : `${testId}-options`}
              className={cn("max-h-60 overflow-y-auto p-1", count === 0 && "hidden")}
            >
              {[...matches, ...(create ? [null] : [])].map((option, index) => (
                // The options, then the create entry (`null`).
                <li
                  key={option?.value ?? "\u0000create"}
                  id={`${listId}-${index}`}
                  role="option"
                  data-index={index}
                  aria-selected={option !== null && option.value === value}
                  data-active={index === active ? "" : undefined}
                  data-testid={
                    testId === undefined
                      ? undefined
                      : `${testId}-${option === null ? "create" : "option"}`
                  }
                  // Keeps the focus in the field, so the blur does not close the list before the click.
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseMove={() => {
                    setActive(index);
                    setKeyboard(false);
                  }}
                  onClick={() => pick(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none aria-selected:font-medium data-active:bg-accent data-active:text-accent-foreground",
                    keyboard && "data-active:focus-ring-inset",
                  )}
                >
                  {option === null ? (
                    <>
                      <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
                      {t("combobox.create", { term, interpolation: { escapeValue: false } })}
                    </>
                  ) : (
                    option.label
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { Combobox, type ComboboxOption, type ComboboxProps };
