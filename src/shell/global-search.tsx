import { type LucideIcon, SearchIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { cn } from "../lib/cn.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.js";
import { Hint } from "../ui/hint.js";
import { useSidebar } from "./sidebar-provider.js";

/** One area the search covers; `labelKey` resolves in the app's i18next like a nav label. */
export interface SearchArea {
  key: string;
  labelKey: string;
}

/** One hit. Title, context line and marker are record data the app already put into words. */
export interface SearchHit {
  id: string;
  icon: LucideIcon;
  title: string;
  // The one line that tells same-named records apart (status and phase, parent object, role, …).
  context: string;
  to: string;
  // Archived or frozen records stay findable but marked.
  marker?: string;
}

export interface SearchResult {
  // Hits per area; groups render in the order of `areas`.
  groups: { area: string; hits: SearchHit[] }[];
  // The areas the caller's role was allowed to search; defaults to all `areas`.
  searchedAreas?: string[];
}

type GlobalSearchProps = {
  // The declared scope of the search, in display order.
  areas: SearchArea[];
  // The app's search; the package never filters what it returns.
  search: (term: string, signal: AbortSignal) => Promise<SearchResult>;
  // The `data-testid` of the result body; without it the body has none.
  resultsTestId?: string;
  // The `data-testid` of the empty state.
  emptyTestId?: string;
};

// Below this many characters the dialog does not search and its body stays empty: the subtitle
// already names the areas, so they appear exactly once (`GL-UI-031`).
const MIN_TERM_LENGTH = 2;
const DEBOUNCE_MS = 200;
const SHORTCUT_KEY = "k";

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac/i.test(navigator.platform || navigator.userAgent);
}

// The app-shell search (`GL-UI-031`): a field in the sidebar under the head, with its shortcut badge.
// The field never shows results; focus, click, typing or the shortcut open the centred dialog, which
// is the one place hits appear. Collapsed, the field is an icon that expands the rail and focuses it.
function GlobalSearch({
  areas,
  search,
  resultsTestId,
  emptyTestId = "search-dialog-empty",
}: GlobalSearchProps) {
  const { t } = useTranslation("suite");
  const { isOpen, toggle } = useSidebar();
  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);
  // The collapsed rail has no input to focus; it is focused once the expanded field exists.
  const focusPending = React.useRef(false);
  // Esc returns the focus to the field; without this flag that focus would reopen the dialog.
  const suppressFocusOpen = React.useRef(false);
  const [term, setTerm] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const openDialog = React.useCallback((seed?: string) => {
    if (seed !== undefined) setTerm(seed);
    setDialogOpen(true);
  }, []);

  React.useEffect(() => {
    if (isOpen && focusPending.current) {
      focusPending.current = false;
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // On the document, so the shortcut works from every route.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key.toLowerCase() !== SHORTCUT_KEY || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      openDialog();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openDialog]);

  function closeDialog(): void {
    setDialogOpen(false);
    setTerm("");
  }

  const shortcut = isMacPlatform() ? "⌘K" : "Ctrl K";
  const fieldHint = t("search.fieldHint", { shortcut });

  const field = isOpen ? (
    <div className="px-2 pb-2">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Hint text={fieldHint}>
          <input
            ref={inputRef}
            type="search"
            data-testid="shell-search"
            // The way in, not a place for an answer: whatever is typed travels into the dialog.
            value=""
            aria-label={t("search.label")}
            aria-keyshortcuts="Meta+K Control+K"
            placeholder={t("search.placeholder")}
            onChange={(event) => openDialog(event.target.value)}
            onFocus={() => {
              if (suppressFocusOpen.current) {
                suppressFocusOpen.current = false;
                return;
              }
              openDialog();
            }}
            onClick={() => openDialog()}
            className="h-9 w-full rounded-md border border-input bg-transparent py-1 pr-16 pl-8 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </Hint>
        <span
          data-testid="shell-search-shortcut"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-sm border bg-muted px-1.5 py-0.5 text-[10px] leading-none font-medium text-foreground/70 dark:text-muted-foreground"
        >
          {shortcut}
        </span>
      </div>
    </div>
  ) : (
    <div className="flex justify-center px-2 pb-2">
      <Hint text={`${t("search.label")}: ${fieldHint}`}>
        <button
          type="button"
          data-testid="shell-search"
          onClick={() => {
            focusPending.current = true;
            toggle();
          }}
          aria-label={t("search.label")}
          className="flex cursor-pointer items-center justify-center rounded-md p-2 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <SearchIcon className="size-4" aria-hidden="true" />
        </button>
      </Hint>
    </div>
  );

  return (
    <>
      {field}
      <SearchDialog
        open={dialogOpen}
        term={term}
        areas={areas}
        search={search}
        resultsTestId={resultsTestId}
        emptyTestId={emptyTestId}
        onTermChange={setTerm}
        onSelect={(hit) => {
          closeDialog();
          void navigate(hit.to);
        }}
        onClose={() => {
          closeDialog();
          suppressFocusOpen.current = true;
          inputRef.current?.focus();
        }}
      />
    </>
  );
}

type Outcome =
  { term: string; status: "done"; result: SearchResult } | { term: string; status: "failed" };

function SearchDialog({
  open,
  term,
  areas,
  search,
  resultsTestId,
  emptyTestId,
  onTermChange,
  onSelect,
  onClose,
}: {
  open: boolean;
  term: string;
  areas: SearchArea[];
  search: GlobalSearchProps["search"];
  resultsTestId: string | undefined;
  emptyTestId: string;
  onTermChange: (term: string) => void;
  onSelect: (hit: SearchHit) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("suite");
  const [debounced, setDebounced] = React.useState("");
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const searching = open && debounced.length >= MIN_TERM_LENGTH;

  React.useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    search(debounced, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setOutcome({ term: debounced, status: "done", result });
      },
      () => {
        if (!controller.signal.aborted) setOutcome({ term: debounced, status: "failed" });
      },
    );
    return () => controller.abort();
  }, [searching, debounced, search]);

  const current = outcome !== null && outcome.term === debounced ? outcome : null;
  const result = current?.status === "done" ? current.result : undefined;

  const labelOf = React.useCallback(
    (key: string) => {
      const area = areas.find((a) => a.key === key);
      return area !== undefined ? i18n.t(area.labelKey) : key;
    },
    [areas, i18n],
  );
  // The searched areas come from the scope, never from a list in a text.
  const searchedAreas = result?.searchedAreas ?? areas.map((a) => a.key);
  const named = searchedAreas.map(labelOf).join(t("search.areaSeparator"));

  const groups = React.useMemo(
    () =>
      areas
        .map((area) => ({
          area,
          hits: result?.groups.find((group) => group.area === area.key)?.hits ?? [],
        }))
        .filter((group) => group.hits.length > 0),
    [areas, result],
  );
  const orderedHits = React.useMemo(() => groups.flatMap((group) => group.hits), [groups]);

  // The selection belongs to one result set; a new set starts again at its first row.
  const [cursor, setCursor] = React.useState<{ hits: SearchHit[]; index: number }>({
    hits: [],
    index: 0,
  });
  const activeIndex = cursor.hits === orderedHits ? cursor.index : 0;
  const moveTo = (index: number) => setCursor({ hits: orderedHits, index });

  // On the whole dialog while the focus rests on the field or the dialog itself; a focused hit keeps
  // its own Enter.
  function onDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.target !== inputRef.current && event.target !== event.currentTarget) return;
    if (orderedHits.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveTo((activeIndex + 1) % orderedHits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveTo((activeIndex - 1 + orderedHits.length) % orderedHits.length);
    } else if (event.key === "Enter") {
      const hit = orderedHits[activeIndex];
      if (hit !== undefined) {
        event.preventDefault();
        onSelect(hit);
      }
    }
  }

  let body: React.ReactNode = null;
  if (debounced.length < MIN_TERM_LENGTH) {
    body = null;
  } else if (current === null) {
    body = (
      <p data-testid="search-dialog-loading" className="px-2 py-3 text-sm text-muted-foreground">
        {t("search.loading")}
      </p>
    );
  } else if (current.status === "failed") {
    body = (
      <p data-testid="search-dialog-failed" className="px-2 py-3 text-sm text-muted-foreground">
        {t("search.failed")}
      </p>
    );
  } else if (orderedHits.length === 0) {
    body = (
      <p data-testid={emptyTestId} className="px-2 py-3 text-sm text-muted-foreground">
        {t("search.empty", { areas: named })}
      </p>
    );
  } else {
    body = (
      <div role="listbox" aria-label={t("search.results")} data-testid={resultsTestId}>
        {groups.map(({ area, hits }) => (
          <section
            key={area.key}
            role="group"
            aria-labelledby={`search-group-${area.key}`}
            data-testid="search-group"
            data-area={area.key}
          >
            <h3
              id={`search-group-${area.key}`}
              className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground"
            >
              {labelOf(area.key)}
            </h3>
            <ul role="none">
              {hits.map((hit) => (
                <HitRow
                  key={hit.id}
                  hit={hit}
                  active={orderedHits[activeIndex] === hit}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        size="form"
        data-testid="search-dialog"
        // The shell returns the focus to the sidebar field itself, in `onClose`.
        onCloseAutoFocus={(event) => event.preventDefault()}
        onKeyDown={onDialogKeyDown}
      >
        <DialogHeader>
          <DialogTitle>{t("search.title")}</DialogTitle>
          <DialogDescription>
            {searchedAreas.length > 0 ? t("search.subtitle", { areas: named }) : ""}
          </DialogDescription>
        </DialogHeader>
        <Hint text={t("search.inputHint")}>
          <input
            ref={inputRef}
            autoFocus
            type="search"
            data-testid="search-dialog-input"
            value={term}
            aria-label={t("search.label")}
            placeholder={t("search.placeholder")}
            onChange={(event) => onTermChange(event.target.value)}
            className="h-9 w-full shrink-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </Hint>
        <DialogBody>{body}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function HitRow({
  hit,
  active,
  onSelect,
}: {
  hit: SearchHit;
  active: boolean;
  onSelect: (hit: SearchHit) => void;
}) {
  const { t } = useTranslation("suite");
  const ref = React.useRef<HTMLButtonElement>(null);
  const Icon = hit.icon;

  // A keyboard walk past the fold keeps the highlighted row in view.
  React.useEffect(() => {
    if (active) ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  return (
    <li role="none">
      <Hint text={t("search.hitHint")}>
        <button
          ref={ref}
          type="button"
          role="option"
          aria-selected={active}
          data-testid="search-hit"
          data-active={active ? true : undefined}
          onClick={() => onSelect(hit)}
          className={cn(
            "flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            active && "bg-accent text-accent-foreground",
          )}
        >
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm">{hit.title}</span>
              {hit.marker !== undefined && (
                <span
                  data-testid="search-hit-marker"
                  className="shrink-0 rounded-sm bg-muted px-1 py-0.5 text-[10px] leading-none font-medium text-muted-foreground"
                >
                  {hit.marker}
                </span>
              )}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{hit.context}</span>
          </span>
        </button>
      </Hint>
    </li>
  );
}

export { GlobalSearch, type GlobalSearchProps };
