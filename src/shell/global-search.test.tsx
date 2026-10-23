import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { FileTextIcon } from "lucide-react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog.js";
import { EditPanel } from "../ui/edit-panel.js";
import { GlobalSearch, type SearchResult } from "./global-search.js";
import { SIDEBAR_ID } from "./sidebar-provider.js";
import { ShellHarness } from "./test-utils.js";

const AREAS = [
  { key: "content", labelKey: "Content" },
  { key: "events", labelKey: "Events" },
];

const RESULT: SearchResult = {
  groups: [
    {
      area: "events",
      hits: [
        {
          id: "e1",
          icon: FileTextIcon,
          title: "Summer meetup",
          context: "Planned",
          to: "/events/1",
        },
      ],
    },
    {
      area: "content",
      hits: [
        { id: "c1", icon: FileTextIcon, title: "Summer post", context: "Draft", to: "/content/1" },
        {
          id: "c2",
          icon: FileTextIcon,
          title: "Summer note",
          context: "Archived",
          to: "/content/2",
          marker: "Archived",
        },
      ],
    },
  ],
};

function renderSearch(search = vi.fn(() => Promise.resolve(RESULT))) {
  render(
    <ShellHarness route="/dashboard">
      <GlobalSearch areas={AREAS} search={search} />
    </ShellHarness>,
  );
  return search;
}

// Past the debounce, so a search that would start has started.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 300)));

describe("GlobalSearch", () => {
  it("shows the shortcut badge and no results in the field", () => {
    renderSearch();
    expect(screen.getByTestId("shell-search-shortcut")).toHaveTextContent(/⌘K|Ctrl K/);
    expect(screen.getByTestId("shell-search")).toHaveValue("");
    expect(screen.queryByTestId("search-dialog")).not.toBeInTheDocument();
  });

  it("focus alone leaves the dialog closed; click and Enter open it", async () => {
    renderSearch();
    const field = screen.getByTestId("shell-search");
    act(() => field.focus());
    await settle();
    expect(screen.queryByTestId("search-dialog")).not.toBeInTheDocument();
    fireEvent.keyDown(field, { key: "Enter" });
    const dialog = await screen.findByTestId("search-dialog");
    fireEvent.keyDown(within(dialog).getByTestId("search-dialog-input"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("search-dialog")).not.toBeInTheDocument());
    expect(field).toHaveFocus();
    await settle();
    expect(screen.queryByTestId("search-dialog")).not.toBeInTheDocument();
    fireEvent.click(field);
    expect(await screen.findByTestId("search-dialog")).toBeInTheDocument();
  });

  it("one character searches nothing and names the areas exactly once; Esc returns to the field", async () => {
    const search = renderSearch();
    fireEvent.change(screen.getByTestId("shell-search"), { target: { value: "s" } });
    const dialog = await screen.findByTestId("search-dialog");
    expect(within(dialog).getByTestId("search-dialog-input")).toHaveValue("s");
    await settle();
    expect(search).not.toHaveBeenCalled();
    expect(dialog.textContent?.split("Content, Events")).toHaveLength(2);
    expect(dialog.querySelector("[data-slot=dialog-body]")).toBeEmptyDOMElement();

    fireEvent.keyDown(within(dialog).getByTestId("search-dialog-input"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("search-dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("shell-search")).toHaveFocus();
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
  });

  it("groups the hits in area order and opens the selected one with Enter", async () => {
    const search = renderSearch();
    fireEvent.change(screen.getByTestId("shell-search"), { target: { value: "su" } });
    const groups = await screen.findAllByTestId("search-group");
    expect(search).toHaveBeenCalledWith("su", expect.any(AbortSignal));
    expect(groups.map((g) => g.getAttribute("data-area"))).toEqual(["content", "events"]);
    expect(screen.getAllByTestId("search-hit")).toHaveLength(3);
    expect(screen.getByTestId("search-hit-marker")).toHaveTextContent("Archived");

    const input = screen.getByTestId("search-dialog-input");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByTestId("search-hit")[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("location")).toHaveTextContent("/content/2");
  });

  it("names the searched areas when nothing is found", async () => {
    renderSearch(vi.fn(() => Promise.resolve({ groups: [], searchedAreas: ["events"] })));
    fireEvent.change(screen.getByTestId("shell-search"), { target: { value: "zz" } });
    expect(await screen.findByTestId("search-dialog-empty")).toHaveTextContent(
      "Nothing found in Events.",
    );
  });

  // #240: the search's trigger is always its sidebar field (`GL-UI-031`), also when the shortcut
  // opened it from a nav link; closing never goes back to what had the focus before.
  it.each([
    [
      "Esc",
      (dialog: HTMLElement) => {
        fireEvent.keyDown(within(dialog).getByTestId("search-dialog-input"), { key: "Escape" });
      },
    ],
    [
      "the close control",
      (dialog: HTMLElement) => {
        fireEvent.click(within(dialog).getByRole("button", { name: /close/i }));
      },
    ],
  ] as const)(
    "the shortcut from a nav link, then %s, returns the focus to the field",
    async (_, close) => {
      render(
        <ShellHarness route="/dashboard">
          <a href="/events" data-testid="nav-link">
            Events
          </a>
          <GlobalSearch areas={AREAS} search={vi.fn(() => Promise.resolve(RESULT))} />
        </ShellHarness>,
      );
      act(() => screen.getByTestId("nav-link").focus());
      fireEvent.keyDown(document, { key: "k", ctrlKey: true });
      const dialog = await screen.findByTestId("search-dialog");
      close(dialog);
      await waitFor(() => expect(screen.queryByTestId("search-dialog")).not.toBeInTheDocument());
      expect(screen.getByTestId("shell-search")).toHaveFocus();
      expect(screen.queryByTestId("search-dialog")).not.toBeInTheDocument();
      expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    },
  );

  // #242: below `md` the closed overlay hides the field (here a hidden sidebar). Opened by the
  // shortcut from a link in the page content, Esc never goes back to that link (`GL-UI-050`): the
  // overlay trigger if there is one, else the main content; never `<body>`.
  it.each([
    ["no overlay trigger", "main", false],
    ["an overlay trigger", "overlay-trigger", true],
  ] as const)(
    "the shortcut from a content link with the field hidden and %s focuses %s on Esc",
    async (_, target, withTrigger) => {
      render(
        <ShellHarness route="/dashboard">
          {withTrigger && (
            <button type="button" aria-controls={SIDEBAR_ID} data-testid="overlay-trigger">
              Menu
            </button>
          )}
          <div hidden>
            <GlobalSearch areas={AREAS} search={vi.fn(() => Promise.resolve(RESULT))} />
          </div>
          <main data-testid="main">
            <a href="/events" data-testid="content-link">
              Events
            </a>
          </main>
        </ShellHarness>,
      );
      act(() => screen.getByTestId("content-link").focus());
      fireEvent.keyDown(document, { key: "k", ctrlKey: true });
      const dialog = await screen.findByTestId("search-dialog");
      fireEvent.keyDown(within(dialog).getByTestId("search-dialog-input"), { key: "Escape" });
      await waitFor(() => expect(screen.queryByTestId("search-dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByTestId(target)).toHaveFocus());
      expect(screen.getByTestId("content-link")).not.toHaveFocus();
      expect(document.activeElement).not.toBe(document.body);
    },
  );

  // #244: opened by the shortcut from a control in a modal dialog that stays open, Esc hands the focus
  // back to that control (`GL-UI-050`), never to the field behind the modal. A non-modal sheet (an
  // edit panel) hides nothing: the focus goes to the field as everywhere else (`GL-UI-031`, #240).
  it.each([
    [
      "a modal dialog",
      "in-surface",
      <Dialog key="modal" open>
        <DialogContent>
          <DialogTitle>Dialog</DialogTitle>
          <DialogDescription>Over the page.</DialogDescription>
          <button type="button" data-testid="in-surface">
            Inside
          </button>
        </DialogContent>
      </Dialog>,
    ],
    [
      "a non-modal edit panel",
      "shell-search",
      <EditPanel key="panel" open onOpenChange={() => {}} title="Channel">
        <input aria-label="Name" data-testid="in-surface" />
      </EditPanel>,
    ],
  ] as const)("the shortcut from %s, then Esc, focuses %s", async (_, target, surface) => {
    render(
      <ShellHarness route="/dashboard">
        <GlobalSearch areas={AREAS} search={vi.fn(() => Promise.resolve(RESULT))} />
        {surface}
      </ShellHarness>,
    );
    act(() => screen.getByTestId("in-surface").focus());
    await waitFor(() => expect(screen.getByTestId("in-surface")).toHaveFocus());
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const dialog = await screen.findByTestId("search-dialog");
    fireEvent.keyDown(within(dialog).getByTestId("search-dialog-input"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("search-dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId(target)).toHaveFocus());
    await settle();
    await waitFor(() => expect(screen.getByTestId(target)).toHaveFocus());
    expect(screen.queryByTestId("search-dialog")).not.toBeInTheDocument();
  });

  // #242: unmounting the search with the dialog open returns no focus: the field and the rail are
  // gone, and whatever the app focused meanwhile keeps it.
  it("unmounting with the dialog open leaves the focus where the app put it", async () => {
    const page = (search: ReactNode) => (
      <ShellHarness route="/dashboard">
        <button type="button" data-testid="earlier">
          Earlier
        </button>
        <button type="button" data-testid="elsewhere">
          Elsewhere
        </button>
        {search}
      </ShellHarness>
    );
    const { rerender } = render(
      page(<GlobalSearch areas={AREAS} search={vi.fn(() => Promise.resolve(RESULT))} />),
    );
    act(() => screen.getByTestId("earlier").focus());
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    await screen.findByTestId("search-dialog");
    await waitFor(() => expect(screen.getByTestId("search-dialog-input")).toHaveFocus());
    rerender(page(null));
    act(() => screen.getByTestId("elsewhere").focus());
    // Past the dialog's deferred close-focus, which would hand the focus back to `earlier`.
    await settle();
    await waitFor(() => expect(screen.getByTestId("elsewhere")).toHaveFocus());
    expect(screen.getByTestId("earlier")).not.toHaveFocus();
  });

  it("opens with the shortcut", async () => {
    renderSearch();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(await screen.findByTestId("search-dialog")).toBeInTheDocument();
  });

  // SUI-FEATURE-028 AC3.
  const TWO_HITS: SearchResult = {
    groups: [{ area: "content", hits: RESULT.groups[1]!.hits }],
  };

  it("marks only the active row; arrow down and Enter on the dialog open the second hit", async () => {
    renderSearch(vi.fn(() => Promise.resolve(TWO_HITS)));
    fireEvent.change(screen.getByTestId("shell-search"), { target: { value: "su" } });
    await screen.findAllByTestId("search-hit");
    const [first, second] = screen.getAllByTestId("search-hit");
    expect(first).toHaveAttribute("data-active", "true");
    expect(second).not.toHaveAttribute("data-active");

    const dialog = screen.getByTestId("search-dialog");
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    expect(first).not.toHaveAttribute("data-active");
    expect(second).toHaveAttribute("data-active", "true");
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(screen.getByTestId("location")).toHaveTextContent("/content/2");
  });

  it("a focused hit keeps its own Enter", async () => {
    renderSearch(vi.fn(() => Promise.resolve(TWO_HITS)));
    fireEvent.change(screen.getByTestId("shell-search"), { target: { value: "su" } });
    await screen.findAllByTestId("search-hit");
    const second = screen.getAllByTestId("search-hit")[1]!;
    fireEvent.keyDown(second, { key: "ArrowDown" });
    fireEvent.keyDown(second, { key: "Enter" });
    expect(screen.getAllByTestId("search-hit")[0]).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
  });

  it("without areas the description names none", async () => {
    render(
      <ShellHarness route="/dashboard">
        <GlobalSearch areas={[]} search={vi.fn(() => Promise.resolve({ groups: [] }))} />
      </ShellHarness>,
    );
    fireEvent.change(screen.getByTestId("shell-search"), { target: { value: "s" } });
    const dialog = await screen.findByTestId("search-dialog");
    const description = dialog.querySelector(`#${dialog.getAttribute("aria-describedby") ?? ""}`);
    expect(description).toBeEmptyDOMElement();
  });

  it("carries the app's test ids on the result body and the empty state", async () => {
    const search = vi.fn((term: string) =>
      Promise.resolve(term === "zz" ? { groups: [] } : TWO_HITS),
    );
    render(
      <ShellHarness route="/dashboard">
        <GlobalSearch
          areas={AREAS}
          search={search}
          resultsTestId="global-search-results"
          emptyTestId="global-search-empty"
        />
      </ShellHarness>,
    );
    fireEvent.change(screen.getByTestId("shell-search"), { target: { value: "su" } });
    const body = await screen.findByTestId("global-search-results");
    expect(within(body).getAllByTestId("search-hit")).toHaveLength(2);
    fireEvent.change(screen.getByTestId("search-dialog-input"), { target: { value: "zz" } });
    expect(await screen.findByTestId("global-search-empty")).toHaveTextContent("Nothing found in");
    expect(screen.queryByTestId("search-dialog-empty")).not.toBeInTheDocument();
  });

  it("the result body has no test id by default", async () => {
    renderSearch(vi.fn(() => Promise.resolve(TWO_HITS)));
    fireEvent.change(screen.getByTestId("shell-search"), { target: { value: "su" } });
    await screen.findAllByTestId("search-hit");
    expect(screen.getByRole("listbox")).not.toHaveAttribute("data-testid");
  });
});
