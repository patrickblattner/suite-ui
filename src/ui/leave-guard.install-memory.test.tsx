import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { useLeaveGuard } from "./leave-guard.js";

// #235: this file never calls `installLeaveGuard()` (its module state is its own). A memory router
// has no browser history to hold, so the first hold does not warn.
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

it("does not warn about installLeaveGuard() under MemoryRouter", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  render(
    <MemoryRouter>
      <Page />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Changed" } });
  expect(
    warn.mock.calls.filter((call) => String(call[0]).includes("installLeaveGuard()")),
  ).toHaveLength(0);
});
