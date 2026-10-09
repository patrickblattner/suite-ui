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

  it("wraps the add in the hint only when the add carries one", () => {
    const { unmount } = render(
      <PageHeader
        title="Events"
        subtitle="Every event."
        add={{ label: "Add event", onClick: () => {}, hint: "Opens the form for a new event." }}
      />,
    );
    expect(screen.getByTestId("page-add")).toHaveAccessibleDescription(
      "Opens the form for a new event.",
    );
    unmount();
    render(
      <PageHeader
        title="Events"
        subtitle="Every event."
        add={{ label: "Add", onClick: () => {} }}
      />,
    );
    expect(screen.getByTestId("page-add")).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText("Opens the form for a new event.")).toBeNull();
  });

  it("shows only the working sign while busy and blocks a second click", () => {
    const onClick = vi.fn();
    render(
      <PageHeader
        title="Backups"
        subtitle="Every backup."
        add={{ label: "Back up now", onClick, busy: true }}
      />,
    );
    const add = screen.getByTestId("page-add");
    expect(add).toHaveAttribute("aria-busy", "true");
    expect(add).toBeDisabled();
    expect(screen.getByTestId("button-loading")).toBeInTheDocument();
    expect(add.querySelector("svg:not([data-slot=busy])")).toHaveAttribute("aria-hidden", "true");
    expect(add).toHaveClass("[&_svg:not([data-slot=busy])]:hidden");
    fireEvent.click(add);
    fireEvent.click(add, { detail: 2 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps role, name, variant, size and testid of v0.29.0 with hint and busy", () => {
    render(
      <PageHeader
        title="Events"
        subtitle="Every event."
        add={{ label: "Add event", onClick: () => {}, hint: "Opens the form.", busy: false }}
      />,
    );
    const add = screen.getByRole("button", { name: "Add event" });
    expect(add).toHaveAttribute("data-testid", "page-add");
    expect(add).toHaveAttribute("data-variant", "success");
    expect(add).toHaveAttribute("data-size", "default");
    expect(add.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
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

  it("takes nodes as title and subtitle: an input in the h1, a feature row in the subtitle", () => {
    render(
      <PageHeader
        title={<input aria-label="Title" data-testid="t" />}
        subtitle={<span>#1</span>}
      />,
    );
    const title = screen.getByTestId("page-title");
    expect(title.tagName).toBe("H1");
    expect(title).toContainElement(screen.getByTestId("t"));
    expect(screen.getByTestId("page-subtitle")).toContainElement(screen.getByText("#1"));
  });

  it("keeps the markup and classes of v0.15.0 for text title and subtitle", () => {
    render(<PageHeader title="Events" subtitle="Every event." />);
    const title = screen.getByTestId("page-title");
    expect(title.outerHTML).toBe(
      '<h1 class="text-xl font-semibold tracking-tight" data-testid="page-title">Events</h1>',
    );
    expect(screen.getByTestId("page-subtitle").outerHTML).toBe(
      '<p class="mt-1 text-sm text-muted-foreground" data-testid="page-subtitle">Every event.</p>',
    );
    expect(title.parentElement).toHaveAttribute("class", "min-w-0");
    expect(screen.getByTestId("page-header")).toHaveAttribute(
      "class",
      "mb-2 flex items-start justify-between gap-4",
    );
  });
});
