import { useState } from "react";
import { useLocation } from "react-router-dom";

import { PageHeader } from "../src/list/page-header.js";
import { PageScroll } from "../src/list/page-scroll.js";
import { Button } from "../src/ui/button.js";
import { EditPanel } from "../src/ui/edit-panel.js";
import { Input } from "../src/ui/input.js";
import { Label } from "../src/ui/label.js";
import { ShellPage } from "./ShellPage.js";

const ROWS = Array.from({ length: 60 }, (_, index) => `Channel ${index + 1}`);
const FIELDS = Array.from({ length: 24 }, (_, index) => `Field ${index + 1}`);

// A long list whose rows open the edit panel, inside the shell frame (`SUI-FEATURE-030`). The panel
// lives in the routed page as in an app: a navigation away unmounts both. Save works for 1.5 s.
function Demo() {
  const { pathname } = useLocation();
  const [start] = useState(pathname);
  const [row, setRow] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (pathname !== start) {
    return (
      <PageScroll>
        <PageHeader title={pathname} subtitle="Navigated away from the list." />
      </PageScroll>
    );
  }

  return (
    <PageScroll>
      <PageHeader title="Channels" subtitle="Every row opens the edit panel." />
      <ul className="flex flex-col gap-2" data-testid="edit-panel-list">
        {ROWS.map((name, index) => (
          <li key={name} className="flex items-center justify-between rounded-md border px-4 py-2">
            {name}
            <Button
              variant="outline"
              size="sm"
              data-testid={`edit-panel-trigger-${index + 1}`}
              onClick={() => setRow(name)}
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>
      <EditPanel
        open={row !== null}
        onOpenChange={(open) => !open && setRow(null)}
        title={row ?? ""}
        description="An edit panel over the whole content area."
        mode="edit"
        submitLabel="Save"
        busy={busy}
        onSubmit={() => {
          setBusy(true);
          setTimeout(() => {
            setBusy(false);
            setRow(null);
          }, 1500);
        }}
      >
        <div className="flex flex-col gap-4">
          {FIELDS.map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <Label htmlFor={field}>{field}</Label>
              <Input id={field} defaultValue={row ?? ""} />
            </div>
          ))}
        </div>
      </EditPanel>
    </PageScroll>
  );
}

export function EditPanelPage() {
  return <ShellPage content={<Demo />} />;
}
