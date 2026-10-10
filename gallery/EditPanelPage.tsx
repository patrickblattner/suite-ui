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
const MEDIA = ["team-photo.jpg", "logo.svg", "brochure.pdf"];
const FIELDS = Array.from({ length: 24 }, (_, index) => `Field ${index + 1}`);

// A long list whose rows open the edit panel, inside the shell frame (`SUI-FEATURE-030`). The panel
// lives in the routed page as in an app: a navigation away unmounts both. Save works for 1.5 s.
function Demo() {
  const { pathname } = useLocation();
  const [start] = useState(pathname);
  const [row, setRow] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [submits, setSubmits] = useState(0);
  const [backs, setBacks] = useState(0);
  const [media, setMedia] = useState<number | null>(null);

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
      <div className="mb-4 flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          data-testid="edit-panel-check-trigger"
          onClick={() => setCheckOpen(true)}
        >
          Open with invalid native values
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="media-panel-trigger"
          onClick={() => setMedia(0)}
        >
          Open media with pager
        </Button>
        <span data-testid="edit-panel-check-counts">
          submits {submits} · backs {backs}
        </span>
      </div>
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
      {/* SUI-FEATURE-035: noValidate lets an invalid native value through to onSubmit; Back left. */}
      <EditPanel
        open={checkOpen}
        onOpenChange={setCheckOpen}
        title="Native constraints"
        mode="edit"
        testIdPrefix="check-panel"
        onSubmit={() => setSubmits((n) => n + 1)}
        onBack={() => setBacks((n) => n + 1)}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="check-count">Count (min 1)</Label>
            <Input id="check-count" type="number" min={1} defaultValue={0} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="check-mail">Email</Label>
            <Input id="check-mail" type="email" defaultValue="not-an-email" />
          </div>
        </div>
      </EditPanel>
      {/* SUI-FEATURE-051: the media detail pages through the uploaded set. */}
      <EditPanel
        open={media !== null}
        onOpenChange={(open) => !open && setMedia(null)}
        title={media !== null ? MEDIA[media] : ""}
        mode="edit"
        testIdPrefix="media-panel"
        pager={
          media !== null
            ? {
                position: `${media + 1}/${MEDIA.length}`,
                onPrevious: () => setMedia(media - 1),
                onNext: () => setMedia(media + 1),
                previousDisabled: media === 0,
                nextDisabled: media === MEDIA.length - 1,
              }
            : undefined
        }
        onSubmit={() => setMedia(null)}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="media-name">File name</Label>
          <Input id="media-name" key={media} defaultValue={media !== null ? MEDIA[media] : ""} />
        </div>
      </EditPanel>
    </PageScroll>
  );
}

export function EditPanelPage() {
  return <ShellPage content={<Demo />} />;
}
