import { useState } from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { Button } from "../src/ui/button.js";
import { Input } from "../src/ui/input.js";
import { useLeaveGuard } from "../src/ui/leave-guard.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/ui/tabs.js";

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
        <Link
          to={{ pathname: "/detail", search: `${location.search}&tab=general` }}
          data-testid="harness-open-detail"
        >
          Open detail
        </Link>
        <Link
          to={{ pathname: "/detail-plain", search: `${location.search}&tab=general` }}
          data-testid="harness-open-detail-plain"
        >
          Open detail without the option
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

// A detail page whose tabs follow `?tab=` (SUI-FEATURE-109). The field's value lives above the tabs,
// so it survives a tab switch: with `ignoreSearchParams` the switch passes without asking. Its Save
// runs until "Finish save" ends it (`busy` meanwhile), so a switch during a running save is measured
// too (rev 3); "Fail save" ends it failed (`saveFailed`, `SUI-FEATURE-150` rev 7). A saved value is the
// loaded one then, so the page is unchanged after a success.
function TabbedDetail({
  name,
  ignoreSearchParams,
}: {
  name: string;
  ignoreSearchParams?: boolean;
}) {
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState("");
  const [finishSave, setFinishSave] = useState<((ok: boolean) => void) | null>(null);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { guard, dialog } = useLeaveGuard({
    dirty: value !== loaded,
    busy: finishSave !== null,
    saveFailed: failed,
    onLeave: () => void navigate(-1),
    onSave: () => true,
    onDiscard: () => setValue(loaded),
    ignoreSearchParams,
  });
  return (
    <main className="flex flex-col gap-4 p-6" data-testid={`harness-${name}`}>
      <h1 className="text-xl font-semibold">{name}</h1>
      <Tabs
        value={params.get("tab") ?? "general"}
        onValueChange={(tab) =>
          setParams(
            (prev) => {
              prev.set("tab", tab);
              return prev;
            },
            { replace: true },
          )
        }
      >
        <TabsList>
          <TabsTrigger value="general" data-testid="harness-tab-general">
            General
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="harness-tab-notes">
            Notes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <Input
            aria-label="Value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            data-testid="harness-value"
          />
        </TabsContent>
        <TabsContent value="notes" data-testid="harness-notes">
          Notes
        </TabsContent>
      </Tabs>
      <div className="flex gap-2">
        <Link to={{ pathname: "/item", search: location.search }} data-testid="harness-open">
          Open item
        </Link>
        <Button
          variant="outline"
          size="default"
          onClick={() => guard(() => void navigate(-1))}
          data-testid="harness-back"
        >
          Back
        </Button>
        <Button
          variant="default"
          size="default"
          busy={finishSave !== null}
          onClick={() => {
            setSaved(false);
            setFailed(false);
            const saving = value;
            void new Promise<boolean>((resolve) => setFinishSave(() => resolve)).then((ok) => {
              setFinishSave(null);
              if (ok) {
                setLoaded(saving);
                setSaved(true);
              } else setFailed(true);
            });
          }}
          data-testid="harness-save"
        >
          Save
        </Button>
        <Button
          variant="outline"
          size="default"
          onClick={() => finishSave?.(true)}
          data-testid="harness-finish-save"
        >
          Finish save
        </Button>
        <Button
          variant="outline"
          size="default"
          onClick={() => finishSave?.(false)}
          data-testid="harness-fail-save"
        >
          Fail save
        </Button>
        <span data-testid="harness-save-state">
          {finishSave !== null ? "saving" : saved ? "saved" : failed ? "failed" : "idle"}
        </span>
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
        <Route path="/detail" element={<TabbedDetail name="detail" ignoreSearchParams />} />
        <Route path="/detail-plain" element={<TabbedDetail name="detail-plain" />} />
        <Route path="*" element={<Form key="list" name="list" />} />
      </Routes>
    </BrowserRouter>
  );
}
