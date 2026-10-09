import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { VersionInfo } from "../shell/version-popover.js";
import { type HelpPage, parseHelpPage, selectHelpPages } from "./help-bundle.js";
import { type HelpCategory, HelpDrawer } from "./help-drawer.js";

// The app's bundle in miniature: the raw files an `import.meta.glob` over `docs/help/` yields.
const RAW: Record<string, string> = {
  "/docs/help/en/dashboard.md":
    "---\ntitle: Dashboard\ncategory: main\norder: 1\n---\n# Dashboard\n\n## What this screen does\n\n![The dashboard](./missing.png)\n",
  "/docs/help/en/ideas.md":
    "---\ntitle: Ideas\ncategory: main\norder: 2\n---\n# Ideas\n\nThe Kanban board collects every idea.\n",
  "/docs/help/en/platforms.md":
    "---\ntitle: Platforms\ncategory: tools\norder: 1\n---\n# Platforms\n\n[Unsafe](javascript:alert(1)) and [safe](https://example.com) and [relative](./ideas).\n",
  "/docs/help/en/settings.md":
    "---\ntitle: Settings\ncategory: administration\norder: 1\n---\n# Settings\n\nGeneral options.\n\n![The settings form]()\n",
  "/docs/help/en/review.md":
    "---\ntitle: Review\ncategory: unknown\norder: 3\n---\n# Review\n\nChecks the drafts.\n",
  "/docs/help/de/dashboard.md":
    "---\ntitle: Dashboard\ncategory: main\norder: 1\n---\n# Dashboard\n\n## Was dieser Bildschirm tut\n",
  "/docs/help/de/tags.md": "---\ntitle: Tags\ncategory: tools\norder: 2\n---\n# Tags\n",
};

const ALL_PAGES = Object.entries(RAW).flatMap(([path, raw]) => parseHelpPage(path, raw) ?? []);

const CATEGORIES: HelpCategory[] = [
  { id: "main", label: "Overview" },
  { id: "tools", label: "Tools" },
  { id: "administration", label: "Administration" },
];

// A tiny harness that wires a toggle button to the drawer's open state and selects the pages of
// the active language, as the app does.
function Harness({ version }: { version?: { info: VersionInfo | undefined } }) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState(i18n.language);
  useEffect(() => {
    i18n.on("languageChanged", setLanguage);
    return () => i18n.off("languageChanged", setLanguage);
  }, []);
  const pages = selectHelpPages(ALL_PAGES, language, "en");
  return (
    <>
      <button type="button" data-testid="toggle" onClick={() => setOpen(true)}>
        open
      </button>
      <HelpDrawer
        open={open}
        onOpenChange={setOpen}
        pages={pages}
        categories={CATEGORIES}
        {...(version ? { version } : {})}
      />
    </>
  );
}

async function openDrawer(version?: { info: VersionInfo | undefined }) {
  render(<Harness {...(version ? { version } : {})} />);
  expect(screen.queryByTestId("help-drawer")).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId("toggle"));
  return screen.findByTestId("help-drawer");
}

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

describe("HelpDrawer", () => {
  it("opens from a toggle and renders the grouped page list", async () => {
    await openDrawer();
    expect(screen.getByTestId("help-link-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("help-link-review")).toBeInTheDocument();
    expect(screen.getByTestId("help-link-platforms")).toBeInTheDocument();
    expect(screen.getByTestId("help-link-settings")).toBeInTheDocument();
    // Category headings are the labels the app passes, in its order.
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
    expect(screen.getByText("Administration")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Help" })).toBeInTheDocument();
  });

  it("lists a page of an unknown category under the first category", async () => {
    await openDrawer();
    const overview = screen.getByText("Overview").parentElement as HTMLElement;
    expect(within(overview).getByTestId("help-link-review")).toBeInTheDocument();
  });

  it("spans the full width instead of a narrow right sheet", async () => {
    const drawer = await openDrawer();
    expect(drawer).toHaveClass("w-full", "sm:max-w-none");
    expect(drawer).not.toHaveClass("w-3/4");
  });

  it("renders the markdown of the selected page", async () => {
    await openDrawer();
    const content = screen.getByTestId("help-content");
    // The first page (dashboard) renders by default.
    expect(within(content).getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    // Selecting another page swaps the rendered markdown.
    fireEvent.click(screen.getByTestId("help-link-ideas"));
    expect(within(content).getByText(/Kanban board/i)).toBeInTheDocument();
  });

  it("filters the page list by search query", async () => {
    await openDrawer();
    fireEvent.change(screen.getByTestId("help-search"), { target: { value: "platform" } });
    expect(screen.getByTestId("help-link-platforms")).toBeInTheDocument();
    expect(screen.queryByTestId("help-link-dashboard")).not.toBeInTheDocument();
  });

  it("finds a page by its content", async () => {
    await openDrawer();
    fireEvent.change(screen.getByTestId("help-search"), { target: { value: "kanban" } });
    expect(screen.getByTestId("help-link-ideas")).toBeInTheDocument();
    expect(screen.queryByTestId("help-link-platforms")).not.toBeInTheDocument();
  });

  it("shows a no-results state when the search matches nothing", async () => {
    await openDrawer();
    fireEvent.change(screen.getByTestId("help-search"), { target: { value: "zzzznomatch" } });
    expect(screen.getByTestId("help-no-results")).toHaveTextContent("No matching pages.");
  });

  it("renders the page in the active language and re-renders on language change", async () => {
    await openDrawer();
    const content = screen.getByTestId("help-content");
    expect(within(content).getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage("de");
    });
    await waitFor(() => {
      expect(within(content).getByText(/Was dieser Bildschirm tut/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Hilfe" })).toBeInTheDocument();
  });

  it("renders the screenshot-pending placeholder for an image (never a broken render)", async () => {
    await openDrawer();
    const content = screen.getByTestId("help-content");
    // jsdom loads no image; a failing load swaps the image for the placeholder.
    const img = content.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img as HTMLImageElement);
    expect(screen.getAllByTestId("help-screenshot-pending")[0]).toHaveTextContent(
      "Screenshot pending",
    );
  });

  it("renders the placeholder for an image without a source", async () => {
    await openDrawer();
    fireEvent.click(screen.getByTestId("help-link-settings"));
    expect(
      within(screen.getByTestId("help-content")).getByTestId("help-screenshot-pending"),
    ).toHaveTextContent("Screenshot pending — The settings form");
  });

  it("embeds help screenshots at 75% width", async () => {
    await openDrawer();
    const img = screen.getByTestId("help-content").querySelector("img");
    expect(img).toHaveClass("max-w-[75%]");
  });

  it("renders a javascript: link as text and keeps HTTP(S) and relative links", async () => {
    await openDrawer();
    fireEvent.click(screen.getByTestId("help-link-platforms"));
    const content = screen.getByTestId("help-content");
    expect(within(content).getByTestId("help-link-unsafe")).toHaveTextContent("Unsafe");
    expect(within(content).queryByRole("link", { name: "Unsafe" })).not.toBeInTheDocument();
    expect(within(content).getByRole("link", { name: "safe" })).toHaveAttribute(
      "href",
      "https://example.com/",
    );
    expect(within(content).getByRole("link", { name: "relative" })).toHaveAttribute(
      "href",
      "./ideas",
    );
  });

  it("closes on Escape", async () => {
    const drawer = await openDrawer();
    fireEvent.keyDown(drawer, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("help-drawer")).not.toBeInTheDocument());
  });

  it("closes on X", async () => {
    await openDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId("help-drawer")).not.toBeInTheDocument());
  });

  it("has no version section without `version`", async () => {
    await openDrawer();
    expect(screen.queryByTestId("help-version")).not.toBeInTheDocument();
  });

  it("shows version, commit and build date with `version`", async () => {
    await openDrawer({ info: { version: "1.4.0", commit: "abc1234", buildDate: "2026-10-09" } });
    const section = screen.getByTestId("help-version");
    expect(section).toHaveTextContent("1.4.0");
    expect(section).toHaveTextContent("abc1234");
    expect(section).toHaveTextContent("2026-10-09");
  });

  it("shows dashes in the version section while the info loads", async () => {
    await openDrawer({ info: undefined });
    const section = screen.getByTestId("help-version");
    expect(within(section).getAllByText("—")).toHaveLength(3);
  });
});

describe("parseHelpPage", () => {
  it("reads language and id from the path and title, category and order from the frontmatter", () => {
    expect(
      parseHelpPage("/docs/help/de/dashboard.md", RAW["/docs/help/de/dashboard.md"] ?? ""),
    ).toEqual({
      id: "dashboard",
      language: "de",
      category: "main",
      title: "Dashboard",
      order: 1,
      body: "# Dashboard\n\n## Was dieser Bildschirm tut\n",
    });
  });

  it("falls back to the id as title and order 0 without frontmatter", () => {
    expect(parseHelpPage("help/en/faq.md", "# FAQ")).toMatchObject({
      id: "faq",
      title: "faq",
      order: 0,
      category: "",
      body: "# FAQ",
    });
  });

  it("returns undefined for a path without language and id", () => {
    expect(parseHelpPage("faq.md", "# FAQ")).toBeUndefined();
  });
});

describe("selectHelpPages fallback", () => {
  const byId = (pages: HelpPage[], id: string) => pages.find((p) => p.id === id);

  it("returns the requested language when present", () => {
    const page = byId(selectHelpPages(ALL_PAGES, "de", "en"), "dashboard");
    expect(page?.language).toBe("de");
    expect(page?.title).toBe("Dashboard");
  });

  it("falls back to the passed language per page when a translation is missing", () => {
    const pages = selectHelpPages(ALL_PAGES, "de", "en");
    expect(byId(pages, "ideas")?.language).toBe("en");
    expect(byId(pages, "tags")?.language).toBe("de");
  });

  it("uses the fallback language the app passes, not a package default", () => {
    const pages = selectHelpPages(ALL_PAGES, "es", "de");
    expect(pages.map((p) => p.id).sort()).toEqual(["dashboard", "tags"]);
    expect(pages.every((p) => p.language === "de")).toBe(true);
  });

  it("lists one page per id, sorted by order", () => {
    const pages = selectHelpPages(ALL_PAGES, "de", "en");
    const ids = pages.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(pages.map((p) => p.order)).toEqual([...pages.map((p) => p.order)].sort((a, b) => a - b));
  });
});
