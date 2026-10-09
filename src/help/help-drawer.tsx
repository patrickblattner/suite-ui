import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn.js";
import type { VersionInfo } from "../shell/version-popover.js";
import { Code } from "../ui/code.js";
import { Hint } from "../ui/hint.js";
import { Input } from "../ui/input.js";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet.js";
import type { HelpPage } from "./help-bundle.js";
import { HelpMarkdown } from "./help-markdown.js";

/** One category of the page list, in the order the app's nav model gives. */
export interface HelpCategory {
  id: string;
  label: string;
}

type HelpDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The pages of the active language (`selectHelpPages`).
  pages: HelpPage[];
  categories: HelpCategory[];
  // With it the drawer carries the version info as its own section; `info` is undefined while the
  // app still loads it, and the rows then show a dash.
  version?: { info: VersionInfo | undefined };
};

// The help drawer (`GL-UI-021`, `SUI-FEATURE-038`): a full-width sheet over the content (never a
// narrow right sheet) so the embedded 75 % screenshots stay readable, with a search field and the
// category-grouped page list on the left and the GFM render of the selected page on the wide right.
// A page whose category the app did not pass is listed under the first category.
function HelpDrawer({ open, onOpenChange, pages, categories, version }: HelpDrawerProps) {
  const { t } = useTranslation("suite");

  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>(pages[0]?.id ?? "");

  const categoryOf = useMemo(() => {
    const known = new Set(categories.map((c) => c.id));
    const first = categories[0]?.id ?? "";
    return (page: HelpPage) => (known.has(page.category) ? page.category : first);
  }, [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    const labels = new Map(categories.map((c) => [c.id, c.label.toLowerCase()]));
    return pages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        (labels.get(categoryOf(p)) ?? "").includes(q),
    );
  }, [pages, categories, categoryOf, query]);

  // The selection is a page id, so a language switch re-renders the same page translated; an id
  // the page set no longer has falls back to the first page.
  const active = pages.find((p) => p.id === activeId) ?? pages[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-none"
        data-testid="help-drawer"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="text-lg">{t("help.title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("help.searchPlaceholder")}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-row">
          <aside className="flex w-64 shrink-0 flex-col border-r">
            <div className="border-b p-3">
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Hint text={t("help.searchHint")}>
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("help.searchPlaceholder")}
                    aria-label={t("help.searchPlaceholder")}
                    className="pl-8"
                    data-testid="help-search"
                  />
                </Hint>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-2 text-sm" aria-label={t("help.title")}>
              {filtered.length === 0 ? (
                <p
                  className="px-2 py-2 text-xs text-muted-foreground"
                  data-testid="help-no-results"
                >
                  {t("help.noResults")}
                </p>
              ) : (
                categories.map((category) => {
                  const categoryPages = filtered.filter((p) => categoryOf(p) === category.id);
                  if (categoryPages.length === 0) return null;
                  return (
                    <div key={category.id} className="mb-4">
                      <div className="mb-1 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                        {category.label}
                      </div>
                      <ul>
                        {categoryPages.map((page) => (
                          <li key={page.id}>
                            <Hint text={t("help.pageHint")}>
                              <button
                                type="button"
                                onClick={() => setActiveId(page.id)}
                                className={cn(
                                  "block w-full rounded px-2 py-1 text-left hover:bg-accent",
                                  active?.id === page.id && "bg-accent font-medium",
                                )}
                                data-testid={`help-link-${page.id}`}
                              >
                                {page.title}
                              </button>
                            </Hint>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
            </nav>

            {version && (
              <section
                className="border-t p-3 text-xs"
                aria-label={t("version.title")}
                data-testid="help-version"
              >
                <div className="mb-1 font-medium">{t("version.title")}</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">{t("version.version")}</dt>
                  {version.info !== undefined && version.info.version === null ? (
                    <dd className="text-muted-foreground" data-testid="help-version-value">
                      {t("version.noRelease")}
                    </dd>
                  ) : (
                    <dd data-testid="help-version-value">
                      <Code>{version.info?.version ?? "—"}</Code>
                    </dd>
                  )}
                  <dt className="text-muted-foreground">{t("version.commit")}</dt>
                  <dd className="truncate">
                    <Code>{version.info?.commit ?? "—"}</Code>
                  </dd>
                  <dt className="text-muted-foreground">{t("version.buildDate")}</dt>
                  <dd>
                    <Code>{version.info?.buildDate ?? "—"}</Code>
                  </dd>
                </dl>
              </section>
            )}
          </aside>

          <main className="flex-1 overflow-y-auto px-8 py-6" data-testid="help-content">
            {active ? (
              <HelpMarkdown body={active.body} />
            ) : (
              <p className="text-muted-foreground">{t("help.empty")}</p>
            )}
          </main>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { HelpDrawer, type HelpDrawerProps };
