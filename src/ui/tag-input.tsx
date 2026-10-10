import { XIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";

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
};

// The one chip field for tags (`GL-UI-027` §Hochladen, `SUI-FEATURE-051`): Enter and comma take the
// typed text over as chips, Backspace in the empty field removes the last one. Tags are trimmed, and a
// tag already there in any letter case is dropped. Leaving the field takes typed text over as Enter does,
// so a click on Save never loses it. Each added or removed chip is announced politely
// (`SUI-FEATURE-052`). The field has the input height (`GL-UI-011`) and grows with each row of chips.
function TagInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  id,
  testId = "tag-input",
  className,
}: TagInputProps) {
  const { t } = useTranslation("suite");
  const [draft, setDraft] = React.useState("");
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

  const commit = () => {
    const known = new Set(value.map((tag) => tag.toLowerCase()));
    const added: string[] = [];
    for (const raw of draft.split(",")) {
      const tag = raw.trim();
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
  };

  return (
    <div
      ref={root}
      data-testid={testId}
      data-disabled={disabled || undefined}
      className={cn(
        "flex min-h-9 w-full min-w-0 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 shadow-xs transition-[color,box-shadow] dark:bg-input/30",
        "focus-within:border-ring focus-within:focus-ring",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className,
      )}
    >
      {value.length > 0 ? (
        <ul role="list" className="contents">
          {value.map((tag, index) => (
            <li
              key={tag}
              data-testid={`${testId}-chip`}
              className="inline-flex h-6 items-center gap-1 rounded-full bg-secondary pl-2.5 text-xs font-medium text-secondary-foreground"
            >
              {tag}
              <button
                type="button"
                aria-label={t("tags.remove", { tag, interpolation: { escapeValue: false } })}
                disabled={disabled}
                onClick={() => {
                  removed.current = index;
                  remove(tag);
                }}
                data-testid={`${testId}-remove`}
                className="relative inline-flex size-6 items-center justify-center rounded-full outline-none after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-x-1/2 after:-translate-y-1/2 hover:bg-secondary-hover focus-visible:focus-ring disabled:pointer-events-none"
              >
                <XIcon aria-hidden="true" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        value={draft}
        placeholder={value.length === 0 ? placeholder : undefined}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft.trim() !== "") commit();
        }}
        onKeyDown={(event) => {
          // An IME is still composing: its Enter or comma belongs to the composition.
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          // An empty field leaves Enter to the form, so it still triggers the primary action.
          if ((event.key === "Enter" && draft.trim() !== "") || event.key === ",") {
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
