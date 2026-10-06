import { act, fireEvent, render, screen } from "@testing-library/react";
import { FileTextIcon } from "lucide-react";
import { describe, expect, it } from "vitest";

import { SettingsFooter } from "../settings/settings-footer.js";
import { GlobalSearch } from "../shell/global-search.js";
import { ShellHarness } from "../shell/test-utils.js";
import {
  type Box,
  collectVisibleTexts,
  controlHeightViolations,
  foreignTexts,
  pagerEdgeViolations,
  searchDialogViolations,
  settingsFooterViolations,
  userMenuOrderViolations,
} from "./index.js";

describe("foreignTexts", () => {
  it("accepts suite texts with any interpolated value and the allowed labels", () => {
    expect(
      foreignTexts(["Profile", "Nothing found in Events, Content.", "Dashboard"], "en", [
        "Dashboard",
      ]),
    ).toEqual([]);
  });

  it("reports a hard-coded text and a text of another language, once each", () => {
    expect(foreignTexts(["Log out", "Abmelden", "Account", "Account"], "en")).toEqual([
      "Abmelden",
      "Account",
    ]);
  });
});

describe("collectVisibleTexts", () => {
  it("collects rendered text and placeholders, skips hidden text", () => {
    const { container } = render(
      <div>
        <span>Profile</span>
        <span hidden>Secret</span>
        <span className="sr-only">Close</span>
        <span aria-hidden="true">⌘K</span>
        <input placeholder="Search …" />
      </div>,
    );
    expect(collectVisibleTexts(container)).toEqual(["Profile", "⌘K", "Search …"]);
  });
});

describe("userMenuOrderViolations", () => {
  const order = (changePassword: string) => [
    "user-menu-profile",
    "user-menu-language",
    "user-menu-appearance",
    changePassword,
    "user-menu-security",
    "user-menu-notifications",
    "user-menu-logout",
  ];

  it("accepts the locked Change password entry in Change password's place", () => {
    expect(userMenuOrderViolations(order("user-menu-change-password"))).toEqual([]);
    expect(userMenuOrderViolations(order("user-menu-change-password-locked"))).toEqual([]);
  });

  it("reports the locked entry anywhere else", () => {
    const ids = order("user-menu-change-password-locked");
    const moved = [...ids.slice(0, 3), ...ids.slice(4, 6), ids[3] as string, ...ids.slice(6)];
    expect(userMenuOrderViolations(moved)).toHaveLength(1);
  });

  it("accepts the menu without Change password; still reports a swap of the others", () => {
    const without = order("user-menu-change-password").filter(
      (id) => id !== "user-menu-change-password",
    );
    expect(userMenuOrderViolations(without)).toEqual([]);
    const swapped = [without[0], without[2], without[1], ...without.slice(3)] as string[];
    expect(userMenuOrderViolations(swapped)).toHaveLength(1);
  });
});

describe("searchDialogViolations", () => {
  async function openSearch() {
    render(
      <ShellHarness route="/dashboard">
        <GlobalSearch
          areas={[{ key: "events", labelKey: "Events" }]}
          search={() =>
            Promise.resolve({
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
              ],
            })
          }
        />
      </ShellHarness>,
    );
    fireEvent.click(screen.getByTestId("shell-search"));
    fireEvent.change(screen.getByTestId("search-dialog-input"), { target: { value: "summer" } });
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    await screen.findByTestId("search-hit");
  }

  it("accepts the package search dialog with grouped hits", async () => {
    await openSearch();
    expect(searchDialogViolations(document.body)).toEqual([]);
  });

  it("reports an inline hit list at the field and a dialog without close control", async () => {
    await openSearch();
    const inline = document.createElement("div");
    inline.dataset.testid = "search-hit";
    screen.getByTestId("shell-search").after(inline);
    document.querySelector("[data-slot=dialog-close]")?.remove();
    expect(searchDialogViolations(document.body)).toEqual([
      "search hit outside the search dialog",
      "dialog without close control",
    ]);
  });

  it("reports a missing dialog", () => {
    expect(searchDialogViolations(document.body)).toEqual(["no search dialog"]);
  });
});

describe("settingsFooterViolations", () => {
  function renderFooter() {
    render(<SettingsFooter pageKey="general" dirty onReset={() => {}} />);
    const footer = screen.getByTestId("settings-footer");
    // Stands in for the package stylesheet, which jsdom does not load (`border-t`).
    footer.style.borderTop = "1px solid";
    return footer;
  }

  it("accepts the package footer", () => {
    expect(settingsFooterViolations(renderFooter())).toEqual([]);
  });

  it("reports a missing divider and a hand-built pair in the wrong order", () => {
    const footer = renderFooter();
    footer.style.borderTop = "none";
    footer.append(footer.querySelector("[data-testid=settings-general-reset]") as Element);
    expect(settingsFooterViolations(footer)).toEqual([
      "footer without divider",
      "footer buttons settings-general-save · settings-general-reset ≠ settings-<page>-reset · settings-<page>-save",
    ]);
  });

  it("reports a pair with the wrong variants", () => {
    const footer = renderFooter();
    footer
      .querySelector("[data-testid=settings-general-reset]")
      ?.setAttribute("data-variant", "outline");
    expect(settingsFooterViolations(footer)).toEqual(["reset is outline, not destructive"]);
  });
});

const at = (x: number, width: number, height = 36): Box => ({ x, y: 0, width, height });

describe("pagerEdgeViolations", () => {
  it("accepts a pager whose right edge meets the gutter within 1 px", () => {
    expect(pagerEdgeViolations(at(1700, 196), 1896)).toEqual([]);
    expect(pagerEdgeViolations(at(1700, 196.8), 1896)).toEqual([]);
  });

  it("reports a left-aligned pager", () => {
    expect(pagerEdgeViolations(at(264, 196), 1896)).toEqual([
      "pager edge at 460.0 ≠ gutter at 1896.0 (±1 px)",
    ]);
  });
});

describe("controlHeightViolations", () => {
  it("accepts controls of one height", () => {
    expect(
      controlHeightViolations([
        { testId: "filter-haystack", box: at(0, 400) },
        { testId: "filter-reset", box: at(400, 36) },
        { testId: "filter-sort", box: at(440, 160, 36.4) },
      ]),
    ).toEqual([]);
  });

  it("reports a control of another height", () => {
    expect(
      controlHeightViolations([
        { testId: "filter-haystack", box: at(0, 400) },
        { testId: "filter-sort", box: at(440, 160, 32) },
      ]),
    ).toEqual(["filter-sort is 32.0 px high ≠ filter-haystack 36.0 px"]);
  });
});
