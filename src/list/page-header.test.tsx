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

  it("puts an app-built action in its own slot instead of the add", () => {
    render(
      <PageHeader
        title="Backups"
        subtitle="Every backup."
        add={{ label: "Add", onClick: () => {} }}
        action={
          <Button variant="success" size="default" data-testid="backup-add">
            Add backup
          </Button>
        }
      />,
    );
    const slot = screen.getByTestId("page-header-action");
    expect(slot).toHaveClass("shrink-0");
    expect(slot).toContainElement(screen.getByTestId("backup-add"));
    expect(screen.getByTestId("page-header")).toContainElement(slot);
    expect(screen.queryByTestId("page-add")).toBeNull();
  });

  it("shows only the primary action when a page passes both it and an action", () => {
    render(
      <PageHeader
        title="Draft"
        subtitle="One draft."
        action={
          <Button variant="success" size="default">
            Add backup
          </Button>
        }
        primaryAction={
          <Button variant="success" size="default">
            Publish
          </Button>
        }
      />,
    );
    expect(screen.getByTestId("page-primary-action")).toHaveTextContent("Publish");
    expect(screen.queryByTestId("page-header-action")).toBeNull();
    expect(screen.queryByText("Add backup")).toBeNull();
  });
});
