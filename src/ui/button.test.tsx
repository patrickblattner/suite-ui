import { fireEvent, render, screen } from "@testing-library/react";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button.js";

// `variant` and `size` are required: each line below must stay a type error, or `npm run typecheck`
// fails on the unused directive.
export const missingProps = [
  // @ts-expect-error variant is required
  <Button key="no-variant" size="default" />,
  // @ts-expect-error size is required
  <Button key="no-size" variant="success" />,
];

// An action that switches its own working state on, like a mutation whose pending flag drives the
// prop.
function Action({ prop, onRun }: { prop: "busy" | "loading"; onRun: () => void }) {
  const [running, setRunning] = useState(false);
  return (
    <Button
      variant="success"
      size="default"
      {...{ [prop]: running }}
      onClick={() => {
        setRunning(true);
        onRun();
      }}
    >
      Save
    </Button>
  );
}

describe("Button", () => {
  it("busy: two clicks fire onClick once", () => {
    const onRun = vi.fn();
    render(<Action prop="busy" onRun={onRun} />);
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 1 });
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("busy: a double-click burst is one intent", () => {
    const onClick = vi.fn();
    render(
      <Button variant="success" size="default" busy={false} onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 2 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("loading: two clicks fire onClick twice", () => {
    const onRun = vi.fn();
    render(<Action prop="loading" onRun={onRun} />);
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 2 });
    expect(onRun).toHaveBeenCalledTimes(2);
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("busy keeps the full opacity of its variant", () => {
    render(
      <Button variant="destructive" size="default" busy>
        Delete
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).toContain("disabled:opacity-100");
    expect(button.className).not.toContain("disabled:opacity-50");
    expect(button.querySelector("[data-slot=busy]")).not.toBeNull();
  });

  it("busy: the working sign carries the loading test id, a leading icon stays in the DOM", () => {
    render(
      <Button variant="success" size="default" busy>
        <PlusIcon data-testid="leading" />
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(screen.getByTestId("button-loading")).toHaveAttribute("data-slot", "busy");
    expect(screen.getByTestId("leading")).toBeInTheDocument();
    expect(button.className).toContain("[&_svg:not([data-slot=busy])]:hidden");
    expect(button).toHaveTextContent("Save");
  });
});
