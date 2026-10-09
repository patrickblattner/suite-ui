import { LayoutGridIcon, TableIcon } from "lucide-react";
import { useState } from "react";
import type * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import { IconButtonTooltip } from "../ui/tooltip.js";

type ListView = "table" | "tiles";

const VIEWS = [
  { view: "table", icon: TableIcon },
  { view: "tiles", icon: LayoutGridIcon },
] as const;

// The view a page last chose, from `localStorage` under its key; table by default and whenever the
// storage cannot be read.
function readListView(storageKey: string): ListView {
  try {
    return window.localStorage.getItem(storageKey) === "tiles" ? "tiles" : "table";
  } catch {
    return "table";
  }
}

// The page's view, starting from the remembered choice; `ViewToggle` remembers each new one.
function useListView(storageKey: string) {
  return useState<ListView>(() => readListView(storageKey));
}

type ViewToggleProps = {
  value: ListView;
  onChange: (value: ListView) => void;
  // Where the choice is remembered, one key per page.
  storageKey: string;
};

// Table or tiles on a media list (`GL-UI-002`), the last element of the FilterBar. The choice is
// remembered per page; a storage that cannot be written only forgets it. A radio group: only the
// chosen view is in the tab order, and the arrow keys move the choice.
function ViewToggle({ value, onChange, storageKey }: ViewToggleProps) {
  const { t } = useTranslation("suite");
  const choose = (view: ListView) => {
    try {
      window.localStorage.setItem(storageKey, view);
    } catch {
      // Without storage the choice holds until the page is left.
    }
    onChange(view);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index =
      (VIEWS.findIndex(({ view }) => view === value) + step + VIEWS.length) % VIEWS.length;
    const next = VIEWS[index];
    if (next === undefined) return;
    choose(next.view);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[index]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={t("view.label")}
      className="flex items-center gap-1"
      onKeyDown={onKeyDown}
      data-testid="view-toggle"
    >
      {VIEWS.map(({ view, icon: Icon }) => (
        <IconButtonTooltip key={view} label={t(`view.${view}`)}>
          <Button
            variant="outline"
            size="icon-sm"
            role="radio"
            aria-checked={value === view}
            tabIndex={value === view ? 0 : -1}
            className="aria-checked:border-ring aria-checked:bg-accent aria-checked:text-accent-foreground dark:aria-checked:border-ring dark:aria-checked:bg-accent"
            onClick={() => choose(view)}
            data-testid={`view-${view}`}
          >
            <Icon aria-hidden="true" />
          </Button>
        </IconButtonTooltip>
      ))}
    </div>
  );
}

export { readListView, useListView, ViewToggle, type ListView, type ViewToggleProps };
