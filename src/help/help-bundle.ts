// The help-page helpers (`SUI-FEATURE-038`): the app bundles its markdown pages at build time
// (`import.meta.glob` over its own `docs/help/`, since only it knows its paths) and passes each file
// through `parseHelpPage`; `selectHelpPages` then picks the pages of the active language. The package
// knows no language, category or route list of an app.
//
// Each page carries minimal YAML-ish frontmatter:
//   title:    the page's display title (already localised; not an i18n key)
//   category: the id of one of the categories the app passes to `HelpDrawer`
//   order:    position within its category (ascending)
// The body is the markdown after the frontmatter block.

/** One help page in one language. */
export interface HelpPage {
  id: string;
  language: string;
  category: string;
  title: string;
  order: number;
  body: string;
}

function parseFrontmatter(raw: string): { fm: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { fm: {}, body: raw };
  const fm: Record<string, string> = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) fm[key] = value;
  }
  return { fm, body: match[2] ?? "" };
}

/**
 * Parses one markdown file at `path` (`…/<language>/<pageId>.md`): language and id from the path,
 * `title`, `category` and `order` from the frontmatter. `undefined` when the path has no such shape.
 */
export function parseHelpPage(path: string, raw: string): HelpPage | undefined {
  const segments = /([^/]+)\/([^/]+)\.md$/.exec(path);
  const language = segments?.[1] ?? "";
  const id = segments?.[2] ?? "";
  if (!language || !id) return undefined;

  const { fm, body } = parseFrontmatter(raw);
  const order = Number.parseInt(fm.order ?? "", 10);
  return {
    id,
    language,
    category: fm.category ?? "",
    title: fm.title ?? id,
    order: Number.isFinite(order) ? order : 0,
    body,
  };
}

/**
 * The pages for `language`, one per page id: the page in `language` where it exists, otherwise in
 * `fallbackLanguage` (which the app names; the package sets no default). Sorted by `order`.
 */
export function selectHelpPages(
  pages: readonly HelpPage[],
  language: string,
  fallbackLanguage: string,
): HelpPage[] {
  const byId = new Map<string, HelpPage>();
  for (const page of pages) {
    if (page.language === fallbackLanguage && !byId.has(page.id)) byId.set(page.id, page);
  }
  for (const page of pages) {
    if (page.language === language) byId.set(page.id, page);
  }
  return [...byId.values()].sort((a, b) => a.order - b.order);
}
