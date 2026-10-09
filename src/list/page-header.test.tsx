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

  // SUI-FEATURE-045 AC1: a single entry stands alone in the row, without a group around it.
  it("renders a single add without a group, as in v0.35.0", () => {
    render(
      <PageHeader
        title="Events"
        subtitle="Every event."
        add={{ label: "Add event", onClick: () => {} }}
      />,
    );
    const add = screen.getByRole("button", { name: "Add event" });
    expect(add.parentElement).toBe(screen.getByTestId("page-header"));
    expect(add).toHaveAttribute("data-size", "default");
    expect(screen.queryByTestId("page-add-group")).toBeNull();
    expect(screen.queryByTestId("page-add-secondary")).toBeNull();
  });

  // SUI-FEATURE-045 AC2: the second entry is outline, left of the first, both size default.
  it("renders a pair: the second outline left of the green first", () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <PageHeader
        title="Users"
        subtitle="Every user."
        add={[
          { label: "Add user", onClick: first },
          { label: "Add group", onClick: second },
        ]}
      />,
    );
    const group = screen.getByTestId("page-add-group");
    expect(group).toHaveClass("flex", "items-center", "gap-2", "shrink-0");
    const buttons = [...group.querySelectorAll("button")];
    expect(buttons.map((b) => b.dataset.testid)).toEqual(["page-add-secondary", "page-add"]);
    const [secondary, primary] = buttons;
    expect(primary).toHaveAttribute("data-variant", "success");
    expect(primary).toHaveTextContent("Add user");
    expect(secondary).toHaveAttribute("data-variant", "outline");
    expect(secondary).toHaveTextContent("Add group");
    for (const button of buttons) expect(button).toHaveAttribute("data-size", "default");
    fireEvent.click(screen.getByTestId("page-add-secondary"));
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  // SUI-FEATURE-045 AC3: a locked entry names its reason; `disabledText` goes before `hint`.
  it.each<[string, string | undefined]>([
    ["with a hint", "Opens the form."],
    ["without a hint", undefined],
  ])("names the reason of a locked entry %s", (_case, hint) => {
    render(
      <PageHeader
        title="Users"
        subtitle="Every user."
        add={[
          { label: "Add user", onClick: () => {} },
          {
            label: "Add group",
            onClick: () => {},
            disabled: true,
            disabledText: "Possible once a directory is connected",
            ...(hint !== undefined ? { hint } : {}),
          },
        ]}
      />,
    );
    const secondary = screen.getByTestId("page-add-secondary");
    expect(secondary).toBeDisabled();
    const wrapper = secondary.parentElement;
    expect(wrapper).toHaveAttribute("tabindex", "0");
    const id = wrapper?.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(id)).toHaveTextContent("Possible once a directory is connected");
    expect(screen.getByTestId("page-add")).toBeEnabled();
  });

  // SUI-FEATURE-045 AC4: busy locks only its own entry.
  it("locks only the busy entry of a pair", () => {
    const first = vi.fn();
    render(
      <PageHeader
        title="Users"
        subtitle="Every user."
        add={[
          { label: "Add user", onClick: first },
          { label: "Add group", onClick: () => {}, busy: true },
        ]}
      />,
    );
    expect(screen.getByTestId("page-add-secondary")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("page-add-secondary")).toBeDisabled();
    const primary = screen.getByTestId("page-add");
    expect(primary).toBeEnabled();
    expect(primary).not.toHaveAttribute("aria-busy");
    fireEvent.click(primary);
    expect(first).toHaveBeenCalledTimes(1);
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
