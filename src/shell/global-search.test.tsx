import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { FileTextIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { GlobalSearch, type SearchResult } from "./global-search.js";
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

  it("opens with the shortcut", async () => {
    renderSearch();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(await screen.findByTestId("search-dialog")).toBeInTheDocument();
  });
});
