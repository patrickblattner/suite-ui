import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InlineStatus } from "./inline-status.js";

describe("InlineStatus", () => {
  it("stands empty without a state", () => {
    render(<InlineStatus />);
    expect(screen.getByTestId("inline-status")).toBeEmptyDOMElement();
  });

  it("runs with a spinner, or a bar once the progress is known", () => {
    const { rerender } = render(<InlineStatus state="running" label="Uploading" />);
    expect(screen.getByTestId("operation-spinner")).toHaveClass("animate-spin");
    expect(screen.getByTestId("operation-label")).toHaveTextContent("Uploading");
    rerender(<InlineStatus state="running" progress={0.25} label="Uploading" />);
    const bar = screen.getByTestId("operation-progress");
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(bar).toHaveAccessibleName("Uploading");
  });

  it("marks done with a check in the success colour", () => {
    render(<InlineStatus state="done" />);
    const box = screen.getByTestId("inline-status");
    expect(box).toHaveAttribute("data-state", "done");
    expect(box.querySelector("svg")).toHaveClass("text-success-text");
  });

  it("marks failed with a cross in the error colour and the label as its hint", () => {
    render(<InlineStatus state="failed" label="File too large" />);
    const icon = screen.getByRole("img", { name: "File too large" });
    expect(icon.querySelector("svg")).toHaveClass("text-destructive-text");
    expect(screen.queryByTestId("operation-label")).toBeNull();
  });

  it.each([
    ["done", "Done"],
    ["failed", "Failed"],
  ] as const)(
    "names the %s state to screen readers without a label, showing only the icon",
    (state, word) => {
      render(<InlineStatus state={state} />);
      const box = screen.getByTestId("inline-status");
      expect(box).toHaveTextContent(word);
      expect(screen.getByText(word)).toHaveClass("sr-only");
      expect(box.querySelector("svg")).toBeInTheDocument();
    },
  );

  it("puts the state word before the label", () => {
    render(<InlineStatus state="running" label="Uploading" />);
    expect(screen.getByTestId("inline-status")).toHaveTextContent(/^RunningUploading$/);
  });
});
