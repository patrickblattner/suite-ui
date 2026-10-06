import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { TablePagination } from "./table-pagination.js";

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
});
