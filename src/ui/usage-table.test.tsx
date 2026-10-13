import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UsageTable, type UsageItem } from "./usage-table.js";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

function renderTable(items: readonly UsageItem[]) {
  render(
    <MemoryRouter initialEntries={["/media"]}>
      <Routes>
        <Route path="/media" element={<UsageTable items={items} />} />
        <Route path="/posts/:id" element={<p data-testid="entry">Entry</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("UsageTable (SUI-FEATURE-004)", () => {
  it("shows Title · Type · Status, the status as a chip", async () => {
    await i18n.changeLanguage("de");
    renderTable([
      { id: "1", title: "Spring news", type: "Post", status: "published", href: "/posts/1" },
      { id: "2", title: "Landing", type: "Page" },
    ]);
    expect(screen.getAllByRole("columnheader").map((head) => head.textContent)).toEqual([
      "Titel",
      "Typ",
      "Status",
    ]);
    const [first, second] = screen.getAllByTestId("usage-row");
    expect(first).toHaveTextContent("Spring newsPost");
    expect(first!.querySelector("[data-state=published]")).not.toBeNull();
    expect(second).toHaveTextContent("LandingPage");
  });

  it("AC4: a click on the row leads to its entry", () => {
    renderTable([{ id: "1", title: "Spring news", type: "Post", href: "/posts/1" }]);
    fireEvent.click(screen.getByTestId("usage-row"));
    expect(screen.getByTestId("entry")).toBeInTheDocument();
  });

  it("AC4: Enter on the row runs onOpen", () => {
    const onOpen = vi.fn();
    renderTable([{ id: "1", title: "Spring news", type: "Post", onOpen }]);
    const row = screen.getByTestId("usage-row");
    expect(row).toHaveAttribute("tabindex", "0");
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["de", "Keine Verwendungen"],
    ["en", "No usages"],
    ["es", "Sin usos"],
  ])("%s: empty, it reads %s", async (lng, text) => {
    await i18n.changeLanguage(lng);
    renderTable([]);
    expect(screen.getByTestId("usage-empty")).toHaveTextContent(text);
  });
});
