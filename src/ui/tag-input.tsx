import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import { usePopupPlacement } from "../lib/popup-placement.js";
import { RemovableChip } from "./removable-chip.js";

type TagInputProps = {
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
};

// The most entries the suggestion list shows.
const MAX_SUGGESTIONS = 8;

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
// With `suggestions` (`SUI-FEATURE-100`) the field is a combobox: typing lists the matching existing
// tags under it, the first one chosen; the arrows move the choice, Enter takes it over as a chip, Esc
// closes the list and keeps the text. Without a match Enter takes the typed text over as before; a tag
// that equals a suggestion but for letter case takes the suggestion's spelling. The list floats like
// the time zone list (`usePopupPlacement`).
function TagInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  id,
  testId = "tag-input",
  className,
  suggestions,
}: TagInputProps) {
  const { t } = useTranslation("suite");
  const [draft, setDraft] = React.useState("");
  const listId = `${React.useId()}-suggestions`;
  const [focused, setFocused] = React.useState(false);
  // Esc closed the list; typing opens it again.
  const [dismissed, setDismissed] = React.useState(false);
  const [active, setActive] = React.useState(0);
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
  const open = focused && !dismissed && !disabled && matches.length > 0;
  const choice = Math.min(active, matches.length - 1);
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

  const remove = (tag: string) => {
    onChange(value.filter((other) => other !== tag));
    setAnnouncement(t("tags.removed", { tag, ...raw }));
  };

  // The suggestions by their lower-case form, for the suggestion's spelling of a typed tag.
  const spelling = new Map((suggestions ?? []).map((tag) => [tag.toLowerCase(), tag]));

  // Takes the typed text over; `picked` replaces the text after the last comma.
  const commit = (picked?: string) => {
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
    setActive(0);
  };

  // Places the open list; Esc closes the list only, not a surrounding dialog: radix listens on the
  // document in the capture phase, so this listener sits one step earlier, on the window.
  usePopupPlacement(open, root, popup, matches.length);
  // The chosen entry stays in view while the arrows move through a list taller than its cap.
  React.useEffect(() => {
    if (open)
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

  return (
    <div
      ref={root}
      data-testid={testId}
      data-disabled={disabled || undefined}
      className={cn(
        "relative flex min-h-9 w-full min-w-0 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 shadow-xs transition-[color,box-shadow] dark:bg-input/30",
        "focus-within:border-ring focus-within:focus-ring",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className,
      )}
    >
      {value.length > 0 ? (
        <ul role="list" className="contents">
          {value.map((tag, index) => (
            <li key={tag} className="flex">
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
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        value={draft}
        placeholder={value.length === 0 ? placeholder : undefined}
        disabled={disabled}
        {...(suggestions === undefined
          ? {}
          : {
              role: "combobox",
              autoComplete: "off",
              "aria-expanded": open,
              "aria-controls": listId,
              "aria-autocomplete": "list" as const,
              "aria-activedescendant": open ? `${listId}-${choice}` : undefined,
            })}
        onChange={(event) => {
          setDraft(event.target.value);
          setDismissed(false);
          setActive(0);
          setKeyboard(true);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setDismissed(false);
          if (draft.trim() !== "") commit();
        }}
        onKeyDown={(event) => {
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
            setActive(Math.min(Math.max(choice + step, 0), matches.length - 1));
          } else if (event.key === "Enter" && open) {
            // An open list owns Enter: it takes the chosen suggestion over.
            event.preventDefault();
            commit(matches[choice]);
            // An empty field leaves Enter to the form, so it still triggers the primary action.
          } else if ((event.key === "Enter" && draft.trim() !== "") || event.key === ",") {
            event.preventDefault();
            commit();
          } else if (event.key === "Backspace" && draft === "") {
            const last = value.at(-1);
            if (last !== undefined) remove(last);
          }
        }}
        data-testid={`${testId}-input`}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
      />
      {open ? (
        <div
          ref={popup}
          className="absolute inset-x-0 top-full z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md data-[side=top]:top-auto data-[side=top]:bottom-full data-[side=top]:mt-0 data-[side=top]:mb-1"
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
}

export { TagInput, type TagInputProps };
