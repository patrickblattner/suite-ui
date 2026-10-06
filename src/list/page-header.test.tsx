import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../ui/button.js";
import { PageHeader } from "./page-header.js";

describe("PageHeader", () => {
  it("renders one h1 title, the subtitle and the green add action", () => {
    const onClick = vi.fn();
    render(
      <PageHeader title="Events" subtitle="Every event." add={{ label: "Add event", onClick }} />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Events");
    expect(screen.getByTestId("page-title")).toHaveTextContent("Events");
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent("Every event.");
    const add = screen.getByTestId("page-add");
    expect(add).toHaveAttribute("data-variant", "success");
    expect(add).toHaveTextContent("Add event");
    fireEvent.click(add);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("puts the lifecycle next step top right instead of an add, with secondary actions left of it", () => {
    render(
      <PageHeader
        title="Draft"
        subtitle="One draft."
        add={{ label: "Add", onClick: () => {} }}
        secondaryAction={
          <Button variant="outline" size="default">
            Back
          </Button>
        }
        primaryAction={
          <Button variant="success" size="default">
            Publish
          </Button>
        }
      />,
    );
    expect(screen.queryByTestId("page-add")).toBeNull();
    const primary = screen.getByTestId("page-primary-action");
    expect(primary).toHaveTextContent("Publish");
    expect(screen.getByText("Back").compareDocumentPosition(primary)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
