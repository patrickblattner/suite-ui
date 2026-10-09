import { useState } from "react";

import { HelpDrawer } from "../src/help/help-drawer.js";
import { parseHelpPage, selectHelpPages } from "../src/help/help-bundle.js";

// An app's help bundle in miniature (`SUI-FEATURE-038`): raw files as `import.meta.glob` yields them.
const RAW: Record<string, string> = {
  "/docs/help/en/dashboard.md": [
    "---",
    "title: Dashboard",
    "category: main",
    "order: 1",
    "---",
    "# Dashboard",
    "",
    "The dashboard shows what needs attention today.",
    "",
    "![The dashboard with its cards]()",
    "",
    "| Card | Shows |",
    "|---|---|",
    "| Ideas | Open ideas |",
    "| Review | Drafts to check |",
    "",
    "See [the guide](https://example.com/guide) or [this link](javascript:alert(1)).",
  ].join("\n"),
  "/docs/help/en/ideas.md": "---\ntitle: Ideas\ncategory: main\norder: 2\n---\n# Ideas\n",
  "/docs/help/en/platforms.md":
    "---\ntitle: Platforms\ncategory: tools\norder: 1\n---\n# Platforms\n",
  "/docs/help/en/settings.md":
    "---\ntitle: Settings\ncategory: administration\norder: 1\n---\n# Settings\n",
};

const PAGES = selectHelpPages(
  Object.entries(RAW).flatMap(([path, raw]) => parseHelpPage(path, raw) ?? []),
  "en",
  "en",
);

const CATEGORIES = [
  { id: "main", label: "Overview" },
  { id: "tools", label: "Tools" },
  { id: "administration", label: "Administration" },
];

// The help drawer open with the version section, as the community sets it.
export function HelpPage() {
  const [open, setOpen] = useState(true);
  return (
    <HelpDrawer
      open={open}
      onOpenChange={setOpen}
      pages={PAGES}
      categories={CATEGORIES}
      version={{ info: { version: "1.4.0", commit: "abc1234", buildDate: "2026-10-09" } }}
    />
  );
}
