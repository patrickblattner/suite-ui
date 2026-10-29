import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { usePopupPlacement } from "../lib/popup-placement.js";
import { Badge } from "./badge.js";
import { useFieldErrorAttributes } from "./field-error.js";
import { READ_ONLY_LOOK } from "./read-only-look-internal.js";
import { RemovableChip } from "./removable-chip.js";

// Further input attributes (`name`, `aria-*`, `data-*`, native handlers) reach the text field, as on
// `Input` (`SUI-FEATURE-108`); `className` styles the frame.
type TagInputProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  | "value"
  | "defaultValue"
  | "defaultChecked"
  | "onChange"
  | "placeholder"
  | "disabled"
  | "id"
  | "className"
  | "children"
  | "onPointerMove"
  | "onPointerLeave"
  | "onPointerDown"
  | "onPointerDownCapture"
  | "onClick"
> & {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  // The text field's id, so a `Label` can name it.
  id?: string;
  // The root's test id; the chips, their × and the text field derive theirs from it.
  testId?: string;
  className?: string;
  // Existing tags offered while typing (`SUI-FEATURE-100`); without them the field offers nothing.
  suggestions?: string[];
  // The hover trigger of a wrapping `Hint` is the whole frame, chips included (`GL-UI-017`, as the
  // `Slider`, `SUI-FEATURE-057`): its ref and pointer handlers sit on the frame, so the bubble opens over
  // the chips too. `Hint` passes the ref here (`TagInput.hintTriggerRef`); `ref` stays the text field's.
  triggerRef?: React.Ref<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLDivElement>;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerDownCapture?: React.PointerEventHandler<HTMLDivElement>;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
};

// The most entries the suggestion list shows.
const MAX_SUGGESTIONS = 8;

// The ids of an `aria-describedby`, in order and each once.
function uniqueIds(describedBy: string | undefined): string | undefined {
  const ids = [...new Set(describedBy?.split(/\s+/).filter(Boolean))];
  return ids.length === 0 ? undefined : ids.join(" ");
}

// The suggestions for the typed text: those that start with it first, then those that contain it,
// ignoring letter case; tags already chosen are left out.
function matchSuggestions(suggestions: readonly string[], chosen: readonly string[], text: string) {
  const needle = text.trim().toLowerCase();
  if (needle === "") return [];
  // Chosen tags are left out, and a suggestion listed twice in any letter case shows once.
  const taken = new Set(chosen.map((tag) => tag.toLowerCase()));
  const open = suggestions.filter((tag) => {
    const key = tag.toLowerCase();
    if (taken.has(key)) return false;
    taken.add(key);
    return true;
  });
  const starts = open.filter((tag) => tag.toLowerCase().startsWith(needle));
  const contains = open.filter(
    (tag) => !tag.toLowerCase().startsWith(needle) && tag.toLowerCase().includes(needle),
  );
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
}

// The one chip field for tags (`GL-UI-027` §Hochladen, `SUI-FEATURE-051`): Enter and comma take the
// typed text over as chips, Backspace in the empty field removes the last one. Tags are trimmed, and a
// tag already there in any letter case is dropped. Leaving the field takes typed text over as Enter does,
// so a click on Save never loses it. Each added or removed chip is announced politely
// (`SUI-FEATURE-052`). The field has the input height (`GL-UI-011`) and grows with each row of chips.
//
// With `suggestions` (`SUI-FEATURE-100` rev 4) the field is a combobox: typing lists the matching
// existing tags under it. The first one is chosen only if it starts with the text; the arrows move the
// choice, Enter and Tab take a chosen entry over as a chip, Esc closes the list and keeps the text.
// With nothing chosen Enter takes the typed text over and Tab leaves; the comma and leaving the field
// always take the typed text. A tag that equals a suggestion but for letter case takes the
// suggestion's spelling. The list floats like the time zone list (`usePopupPlacement`).
//
// Inside an invalid field (`SUI-FEATURE-270`) the text field carries the error like `Input`, and the
// frame, which also carries the focus, takes the red border of an invalid `Input`.
//
// Read-only, the whole frame, chips included, and its text field take the read-only look of `Input`
// (`SUI-FEATURE-117` rev 3); the chips are `outline` badges (rev 4).
//
// `ref`, `id` and the further input attributes reach the text field (`SUI-FEATURE-108`), so a `Hint` or
// a form field describes and focuses it. Its own handlers run first, the passed ones after; a passed
// `aria-describedby` joins the field's ids, each once.
const TagInputField = React.forwardRef<HTMLInputElement, TagInputProps>(function TagInput(
  {
    value,
    onChange,
    placeholder,
    disabled = false,
    readOnly = false,
    id,
    testId = "tag-input",
    className,
    suggestions,
    triggerRef,
    onPointerMove,
    onPointerLeave,
    onPointerDown,
    onPointerDownCapture,
    onClick,
    onFocus,
    onBlur,
    onKeyDown,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...inputProps
  },
  ref,
) {
  const { t } = useTranslation("suite");
  const fieldError = useFieldErrorAttributes();
  // A passed `aria-invalid` and an invalid surrounding field both mark the text field and the frame.
  const isInvalid =
    ariaInvalid === true || ariaInvalid === "true" || fieldError["aria-invalid"] === true;
  const [draft, setDraft] = React.useState("");
  // The text as of now: a blur in the same tick as a commit must not take the old text over again.
  const current = React.useRef("");
  const listId = `${React.useId()}-suggestions`;
  const [focused, setFocused] = React.useState(false);
  // Esc closed the list; typing opens it again.
  const [dismissed, setDismissed] = React.useState(false);
  // The entry the arrows chose; `null` until they move, then the default holds.
  const [active, setActive] = React.useState<number | null>(null);
  // Whether the keyboard placed the highlight: then it carries the inset ring on top of the tint
  // (`GL-UI-013`); a highlight under the mouse keeps the tint alone.
  const [keyboard, setKeyboard] = React.useState(true);
  const popup = React.useRef<HTMLDivElement>(null);
  // The text after the last comma is what the list matches; the parts before it are complete tags.
  const typed = draft.slice(draft.lastIndexOf(",") + 1);
  const matches = React.useMemo(
    () => (suggestions === undefined ? [] : matchSuggestions(suggestions, value, typed)),
    [suggestions, value, typed],
  );
  const open = focused && !dismissed && !disabled && !readOnly && matches.length > 0;
  // Only an entry that starts with the text is chosen by default; one that merely contains it ("tur" →
  // "Kultur") waits for the arrows (`SUI-FEATURE-100` rev 4). -1 is "nothing chosen".
  const startsWith = matches[0]?.toLowerCase().startsWith(typed.trim().toLowerCase()) === true;
  const choice = Math.min(active ?? (startsWith ? 0 : -1), matches.length - 1);
  const [announcement, setAnnouncement] = React.useState("");
  const root = React.useRef<HTMLDivElement>(null);
  // The index of a chip removed with ×: once the chips re-render, the focus moves to the chip now in
  // its place, else the one before it, else the text field.
  const removed = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const index = removed.current;
    if (index === null || root.current === null) return;
    removed.current = null;
    const buttons = root.current.querySelectorAll<HTMLElement>(`[data-testid="${testId}-remove"]`);
    const next = buttons[Math.min(index, buttons.length - 1)];
    (next ?? root.current.querySelector<HTMLElement>("input"))?.focus();
  }, [value, testId]);

  const raw = { interpolation: { escapeValue: false } };

  // Read-only, the field shows its tags and changes none of them (#561).
  const remove = (tag: string) => {
    if (readOnly) return;
    onChange(value.filter((other) => other !== tag));
    setAnnouncement(t("tags.removed", { tag, ...raw }));
  };

  // The suggestions by their lower-case form, for the suggestion's spelling of a typed tag.
  // The first of several case variants wins, as in the list.
  const spelling = new Map(
    [...(suggestions ?? [])].reverse().map((tag) => [tag.toLowerCase(), tag]),
  );

  // Takes the typed text over; `picked` replaces the text after the last comma.
  const commit = (picked?: string) => {
    if (readOnly) return;
    const known = new Set(value.map((tag) => tag.toLowerCase()));
    const added: string[] = [];
    const parts = draft.split(",");
    if (picked !== undefined) parts[parts.length - 1] = picked;
    for (const raw of parts) {
      const typedTag = raw.trim();
      const tag = spelling.get(typedTag.toLowerCase()) ?? typedTag;
      if (tag === "" || known.has(tag.toLowerCase())) continue;
      known.add(tag.toLowerCase());
      added.push(tag);
    }
    if (added.length > 0) {
      onChange([...value, ...added]);
      // Several tags from one entry are announced together (`SUI-FEATURE-052`).
      setAnnouncement(
        added.length === 1
          ? t("tags.added", { tag: added[0], ...raw })
          : t("tags.addedMany", { tags: added.join(", "), ...raw }),
      );
    }
    setDraft("");
    current.current = "";
    setActive(null);
  };

  // Places the open list; Esc closes the list only, not a surrounding dialog: radix listens on the
  // document in the capture phase, so this listener sits one step earlier, on the window.
  usePopupPlacement(open, root, popup, matches.length);
  // The chosen entry stays in view while the arrows move through a list taller than its cap.
  React.useEffect(() => {
    if (open && choice >= 0)
      document.getElementById(`${listId}-${choice}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, choice, listId]);
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setDismissed(true);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [open]);

  const ownKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // An IME is still composing: its Enter or comma belongs to the composition.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && matches.length > 0) {
      event.preventDefault();
      setKeyboard(true);
      if (!open) {
        setDismissed(false);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      const from = choice < 0 && step < 0 ? matches.length : choice;
      setActive(Math.min(Math.max(from + step, 0), matches.length - 1));
    } else if ((event.key === "Enter" || event.key === "Tab") && open && choice >= 0) {
      // A chosen entry owns Enter and Tab: it becomes the chip and the field keeps the focus.
      // Without one, Enter takes the typed text over and Tab leaves the field.
      // No ancestor sees this Tab: a dialog's focus scope would move the focus on regardless.
      event.preventDefault();
      event.stopPropagation();
      commit(matches[choice]);
    } else if (!readOnly && ((event.key === "Enter" && draft.trim() !== "") || event.key === ",")) {
      // An empty field leaves Enter to the form, so it still triggers the primary action.
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft === "") {
      const last = value.at(-1);
      if (last !== undefined) remove(last);
    }
  };

  // The frame is `root` and a wrapping `Hint`'s trigger at once.
  const frameRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      root.current = node;
      if (typeof triggerRef === "function") triggerRef(node);
      else if (triggerRef) triggerRef.current = node;
    },
    [triggerRef],
  );

  return (
    <div
      ref={frameRef}
      data-testid={testId}
      data-disabled={disabled || undefined}
      data-readonly={(readOnly && !disabled) || undefined}
      data-invalid={isInvalid ? "" : undefined}
      // Disabled, the field opens no hover hint, as the disabled `Slider`.
      {...(disabled
        ? {}
        : { onPointerMove, onPointerLeave, onPointerDown, onPointerDownCapture, onClick })}
      className={cn(
        "relative flex min-h-9 w-full min-w-0 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 shadow-xs transition-[color,box-shadow] dark:bg-input/30",
        "focus-within:border-ring focus-within:focus-ring data-[invalid]:border-destructive",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        READ_ONLY_LOOK,
        className,
      )}
    >
      {value.length > 0 ? (
        <ul role="list" className="contents">
          {value.map((tag, index) => (
            <li key={tag} className="flex">
              {readOnly ? (
                // A chip without removal is a `Badge` (`SUI-FEATURE-007`, `GL-UI-011`, #561); a tag is a
                // category, so `outline`: its border stays visible on the muted frame (`SUI-FEATURE-117` rev 4).
                <Badge variant="outline" className="h-6" data-testid={`${testId}-chip`}>
                  {tag}
                </Badge>
              ) : (
                <RemovableChip
                  label={tag}
                  removeLabel={t("tags.remove", { tag, interpolation: { escapeValue: false } })}
                  disabled={disabled}
                  onRemove={() => {
                    removed.current = index;
                    remove(tag);
                  }}
                  testId={testId}
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <input
        {...fieldError}
        data-testid={`${testId}-input`}
        {...inputProps}
        ref={ref}
        id={id}
        value={draft}
        placeholder={value.length === 0 && !readOnly ? placeholder : undefined}
        disabled={disabled}
        readOnly={readOnly}
        {...(suggestions === undefined
          ? {}
          : {
              role: "combobox",
              autoComplete: "off",
              "aria-expanded": open,
              "aria-controls": listId,
              "aria-autocomplete": "list" as const,
              "aria-activedescendant": open && choice >= 0 ? `${listId}-${choice}` : undefined,
            })}
        onChange={(event) => {
          setDraft(event.target.value);
          current.current = event.target.value;
          setDismissed(false);
          setActive(null);
          setKeyboard(true);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          setDismissed(false);
          if (current.current.trim() !== "") commit();
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          ownKeyDown(event);
          onKeyDown?.(event);
        }}
        aria-describedby={uniqueIds(ariaDescribedBy)}
        aria-invalid={isInvalid ? true : ariaInvalid}
        className={cn(
          "h-6 min-w-24 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm",
          READ_ONLY_LOOK,
        )}
      />
      {open ? (
        <div
          ref={popup}
          className="absolute inset-x-0 top-full z-50 mt-1 rounded-md border bg-popover [--surface:var(--popover)] text-popover-foreground shadow-md data-[side=top]:top-auto data-[side=top]:bottom-full data-[side=top]:mt-0 data-[side=top]:mb-1"
        >
          <ul
            id={listId}
            role="listbox"
            aria-label={t("tags.suggestions")}
            data-testid={`${testId}-options`}
            className="max-h-60 overflow-y-auto p-1"
          >
            {matches.map((tag, index) => (
              <li
                key={tag}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === choice}
                data-active={index === choice ? "" : undefined}
                data-testid={`${testId}-option`}
                // Keeps the focus in the field, so the blur does not take the text over first.
                onPointerDown={(event) => event.preventDefault()}
                onMouseMove={() => {
                  setActive(index);
                  setKeyboard(false);
                }}
                onClick={() => commit(tag)}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-1.5 text-sm wrap-anywhere select-none data-active:bg-accent data-active:text-accent-foreground",
                  keyboard && "data-active:focus-ring-inset",
                )}
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <span
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid={`${testId}-announcement`}
      >
        {announcement}
      </span>
    </div>
  );
});

// `Hint` sends its trigger's ref to `triggerRef`, not to `ref`, which stays the text field's.
const TagInput = Object.assign(TagInputField, { hintTriggerRef: "triggerRef" });

export { TagInput, type TagInputProps };
