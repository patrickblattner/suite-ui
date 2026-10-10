import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { act, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { configureSuiteUi } from "../config/index.js";
import { TablePagination } from "./table-pagination.js";
import { hintOf } from "./test-utils.js";

function Harness({ total }: { total: number }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  return (
    <TablePagination
      page={page}
      setPage={setPage}
      pageSize={pageSize}
      setPageSize={setPageSize}
      totalPages={Math.max(1, Math.ceil(total / pageSize))}
      total={total}
    />
  );
}

describe("TablePagination", () => {
  it("shows Page X / Y (Total) and moves with the chevrons", () => {
    render(<Harness total={23} />);
    const summary = screen.getByTestId("pagination-summary");
    expect(summary).toHaveTextContent("Page 1 / 3 (23)");
    fireEvent.click(screen.getByTestId("pagination-next"));
    expect(summary).toHaveTextContent("Page 2 / 3 (23)");
    fireEvent.click(screen.getByTestId("pagination-last"));
    expect(summary).toHaveTextContent("Page 3 / 3 (23)");
    fireEvent.click(screen.getByTestId("pagination-first"));
    expect(summary).toHaveTextContent("Page 1 / 3 (23)");
  });

  it("disables the chevrons at the bounds and says when they become usable", () => {
    render(<Harness total={5} />);
    for (const id of [
      "pagination-first",
      "pagination-prev",
      "pagination-next",
      "pagination-last",
    ]) {
      expect(screen.getByTestId(id)).toBeDisabled();
    }
    expect(screen.getByTestId("pagination-first").parentElement).toHaveAccessibleDescription(
      "First page: possible once you are on a later page.",
    );
  });

  it("shows the page size and labels its select", () => {
    render(<Harness total={5} />);
    expect(screen.getByRole("combobox", { name: "Rows per page" })).toHaveTextContent(
      "10 per page",
    );
  });

  // ‹ and › add their key as a chip behind the text (SUI-FEATURE-056).
  it("opens each chevron's hint with its aria-label text on keyboard focus and after 1500 ms hover", () => {
    render(<Harness total={23} />);
    fireEvent.click(screen.getByTestId("pagination-next"));
    for (const [id, chip] of [
      ["pagination-first", ""],
      ["pagination-prev", "←"],
      ["pagination-next", "→"],
      ["pagination-last", ""],
    ] as const) {
      const button = screen.getByTestId(id);
      const label = button.getAttribute("aria-label");
      expect(label).not.toBeNull();
      const hint = `${label}${chip}`;
      expect(hintOf(button)).toEqual({ focus: hint, hover1499: null, hover1500: hint });
    }
  });
});

describe("TablePagination select width (SUI-FEATURE-026)", () => {
  afterEach(async () => {
    configureSuiteUi({});
    await act(() => i18n.changeLanguage("en"));
  });

  it("AC6: content has no sizer and keeps the v0.15.0 classes", () => {
    render(<Harness total={42} />);
    expect(screen.queryByTestId("pagination-page-size-sizer")).toBeNull();
    expect(screen.getByTestId("pagination-page-size")).toHaveClass("min-w-[160px]");
  });

  it("AC5: measured sizes the page size by its longest option in the active language", async () => {
    configureSuiteUi({ selectWidth: "measured" });
    render(<Harness total={42} />);
    expect(screen.getByTestId("pagination-page-size-sizer")).toHaveTextContent("100 per page");
    expect(screen.getByTestId("pagination-page-size")).not.toHaveClass("min-w-[160px]");
    await act(() => i18n.changeLanguage("es"));
    expect(screen.getByTestId("pagination-page-size-sizer")).toHaveTextContent("100 por página");
  });
});
