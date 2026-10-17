import { useState } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { Button } from "../src/ui/button.js";
import { Input } from "../src/ui/input.js";
import { useLeaveGuard } from "../src/ui/leave-guard.js";

// `?harness=leave-guard` (#235): the leave guard under a real `BrowserRouter` (no data router), as the
// apps run it. Two routes with the same form; browser back and forward, `navigate(-1)` and the guard's
// own ways out are measured here. Not a gallery page, so it adds no capture and no page option.
// Saving reports success but leaves the form dirty, and Discard does not reset it, as a page does that
// refetches its record after the leave: the hold is still active when the released step's own
// `popstate` arrives.
function Form({ name }: { name: string }) {
  const [value, setValue] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { guard, dialog } = useLeaveGuard({
    dirty: value !== "",
    onLeave: () => void navigate(-1),
    onSave: () => true,
  });
  return (
    <main className="flex flex-col gap-4 p-6" data-testid={`harness-${name}`}>
      <h1 className="text-xl font-semibold">{name}</h1>
      <Input
        aria-label="Value"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        data-testid="harness-value"
      />
      <div className="flex gap-2">
        <Link to={{ pathname: "/item", search: location.search }} data-testid="harness-open">
          Open item
        </Link>
        {/* A history step on the same route (a panel opened by a query parameter): the form stays
            mounted, so its hold still listens when the step back arrives. */}
        <Link to={{ search: `${location.search}&panel=1` }} data-testid="harness-open-here">
          Open here
        </Link>
        <Button
          variant="outline"
          size="default"
          onClick={() => guard(() => void navigate(-1))}
          data-testid="harness-back"
        >
          Back
        </Button>
        {/* `navigate(-1)` straight through the router, as an app returns to its list. */}
        <Button
          variant="outline"
          size="default"
          onClick={() => void navigate(-1)}
          data-testid="harness-history-back"
        >
          History back
        </Button>
      </div>
      {dialog}
    </main>
  );
}

export function LeaveGuardHarness() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/item" element={<Form key="item" name="item" />} />
        <Route path="*" element={<Form key="list" name="list" />} />
      </Routes>
    </BrowserRouter>
  );
}
