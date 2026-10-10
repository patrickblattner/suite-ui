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
// tag already there in any letter case is dropped. The field has the input height (`GL-UI-011`) and
// grows with each row of chips.
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

  const commit = () => {
    const known = new Set(value.map((tag) => tag.toLowerCase()));
    const added: string[] = [];
    for (const raw of draft.split(",")) {
      const tag = raw.trim();
      if (tag === "" || known.has(tag.toLowerCase())) continue;
      known.add(tag.toLowerCase());
      added.push(tag);
    }
    if (added.length > 0) onChange([...value, ...added]);
    setDraft("");
  };

  return (
    <div
      ref={root}
      data-testid={testId}
      data-disabled={disabled || undefined}
      className={cn(
        "flex min-h-9 w-full min-w-0 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 shadow-xs transition-[color,box-shadow] dark:bg-input/30",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
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
              className="inline-flex h-6 items-center gap-1 rounded-full bg-secondary pr-1 pl-2.5 text-xs font-medium text-secondary-foreground"
            >
              {tag}
              <button
                type="button"
                aria-label={t("tags.remove", { tag, interpolation: { escapeValue: false } })}
                disabled={disabled}
                onClick={() => {
                  removed.current = index;
                  onChange(value.filter((other) => other !== tag));
                }}
                data-testid={`${testId}-remove`}
                className="inline-flex size-4 items-center justify-center rounded-full outline-none hover:bg-secondary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none"
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
        onKeyDown={(event) => {
          // An IME is still composing: its Enter or comma belongs to the composition.
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          // An empty field leaves Enter to the form, so it still triggers the primary action.
          if ((event.key === "Enter" && draft.trim() !== "") || event.key === ",") {
            event.preventDefault();
            commit();
          } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        data-testid={`${testId}-input`}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
      />
    </div>
  );
}

export { TagInput, type TagInputProps };
