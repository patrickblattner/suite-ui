import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { useLeaveGuard } from "./leave-guard.js";

// #235: this file never calls `installLeaveGuard()` (its module state is its own), as an app that
// forgot it in its entry.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Page() {
  const [name, setName] = useState("Main");
  const { dialog } = useLeaveGuard({
    dirty: name !== "Main",
    onLeave: () => {},
    onSave: () => true,
  });
  return (
    <>
      <input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} />
      {dialog}
    </>
  );
}

it("warns once in development when the first hold finds the guard not installed", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const guardWarnings = () =>
    warn.mock.calls.filter((call) => String(call[0]).includes("installLeaveGuard()"));
  render(
    <BrowserRouter>
      <Page />
    </BrowserRouter>,
  );
  expect(guardWarnings()).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Changed" } });
  expect(guardWarnings()).toHaveLength(1);
  expect(String(guardWarnings()[0]?.[0])).toContain("browser back and forward are not held");
  expect(String(guardWarnings()[0]?.[0])).toContain("<LeaveGuardWindow window={…}>");
  // The fallback installed it: a later hold does not warn again.
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Main" } });
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Again" } });
  expect(guardWarnings()).toHaveLength(1);
});
