import { useState } from "react";
import { useLocation } from "react-router-dom";

import { PageHeader } from "../src/list/page-header.js";
import { PageScroll } from "../src/list/page-scroll.js";
import { Button } from "../src/ui/button.js";
import { EditPanel } from "../src/ui/edit-panel.js";
import { Input } from "../src/ui/input.js";
import { FileFacts } from "../src/ui/file-facts.js";
import { Label } from "../src/ui/label.js";
import {
  type MediaDetailKind,
  MediaDetailShell,
  type MediaPreviewState,
} from "../src/ui/media-detail-shell.js";
import { UsageTable } from "../src/ui/usage-table.js";
import { ShellPage } from "./ShellPage.js";

const ROWS = Array.from({ length: 60 }, (_, index) => `Channel ${index + 1}`);
const MEDIA = ["team-photo.jpg", "logo.svg", "brochure.pdf"];
// A landscape stand-in picture per medium, so the preview shows how an image fills its column.
const PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">' +
    '<rect width="1200" height="800" fill="#8a94a6"/><circle cx="380" cy="300" r="140" fill="#d8dce3"/>' +
    '<path d="M0 800 L420 420 L700 640 L900 480 L1200 760 L1200 800 Z" fill="#5b6475"/></svg>',
)}`;
// The media detail shell pages through one image, one video and one PDF (`SUI-FEATURE-061`). The
// video and the PDF are stand-ins without bytes worth playing: the frame and the control bar show.
const SHELL_MEDIA = [
  { kind: "image", name: "team-photo.jpg", src: PICTURE },
  { kind: "video", name: "intro.mp4", src: "data:video/mp4;base64," },
  { kind: "pdf", name: "brochure.pdf", src: "data:application/pdf;base64," },
] as const;
const JSON_TEXT = JSON.stringify({
  locale: "de-CH",
  // Long enough to scroll, so a kept scroll offset would show.
  channels: Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    name: `Channel ${i + 1}`,
    active: i % 2 === 0,
  })),
});
// The preview states and the text preview (`SUI-FEATURE-140`): plain text, JSON indented, the three
// states with the app's line below the sentence (the pick locked without a file), and an empty text.
const STATE_MEDIA: readonly ShellMedium[] = [
  {
    kind: "text",
    name: "release-notes.txt",
    // Long enough to scroll its region.
    text: [
      "Release notes",
      "",
      ...Array.from(
        { length: 80 },
        (_, i) =>
          `${i + 1}.\tThe media library shows text files and tells why a preview is missing.`,
      ),
    ].join("\n"),
  },
  { kind: "text", name: "settings.json", text: JSON_TEXT, format: "json" },
  { kind: "image", name: "hero-banner.jpg", state: "missingRef" },
  { kind: "pdf", name: "brochure-2024.pdf", state: "missingBytes" },
  {
    kind: "other",
    name: "archive.zip",
    state: "noRenderer",
    detail: "archive.zip · application/zip",
  },
  { kind: "text", name: "empty.txt", text: "" },
];
const SHELL_SETS = { media: SHELL_MEDIA, states: STATE_MEDIA } as const;
type ShellMedium = {
  kind: MediaDetailKind;
  name: string;
  src?: string;
  text?: string;
  format?: "plain" | "json";
  state?: MediaPreviewState;
  detail?: string;
};
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
  const [nextOpen, setNextOpen] = useState(false);
  const [shell, setShell] = useState<number | null>(null);
  const [shellName, setShellName] = useState("");
  const [shellSaving, setShellSaving] = useState(false);
  const [shellUsage, setShellUsage] = useState(false);
  const [shellSet, setShellSet] = useState<keyof typeof SHELL_SETS>("media");
  const [allSavedNames, setAllSavedNames] = useState({
    media: SHELL_MEDIA.map(({ name }) => name),
    states: STATE_MEDIA.map(({ name }) => name),
  });
  const shellMedia: readonly ShellMedium[] = SHELL_SETS[shellSet];
  const savedNames = allSavedNames[shellSet];
  const shellMedium = shell === null ? undefined : shellMedia[shell];

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
        <Button
          variant="outline"
          size="sm"
          data-testid="media-detail-trigger"
          onClick={() => {
            setShellSet("media");
            setShell(0);
            setShellName(allSavedNames.media[0]!);
          }}
        >
          Open media detail shell
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="media-states-trigger"
          onClick={() => {
            setShellSet("states");
            setShell(0);
            setShellName(allSavedNames.states[0]!);
          }}
        >
          Open media preview states
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="next-panel-trigger"
          onClick={() => setNextOpen(true)}
        >
          Open a next step
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
      {/* SUI-FEATURE-111: a step that only moves on to the review; its button saves nothing. */}
      <EditPanel
        open={nextOpen}
        onOpenChange={setNextOpen}
        title="Upload media"
        description="Step 2 of 3: name the files."
        mode="edit"
        testIdPrefix="next-panel"
        submitLabel="Continue to review"
        submitKind="next"
        onSubmit={() => setNextOpen(false)}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="next-name">File name</Label>
          <Input id="next-name" defaultValue="team-photo.jpg" />
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
        preview={
          media !== null ? (
            <img src={PICTURE} alt={MEDIA[media]} data-testid="media-panel-picture" />
          ) : undefined
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="media-name">File name</Label>
          <Input id="media-name" key={media} defaultValue={media !== null ? MEDIA[media] : ""} />
        </div>
      </EditPanel>
      {/* SUI-FEATURE-061: the media detail shell; Save works for 1.5 s. */}
      {shellMedium !== undefined && shell !== null && (
        <MediaDetailShell
          position={shell + 1}
          total={shellMedia.length}
          onPrev={() => {
            setShell(shell - 1);
            setShellName(savedNames[shell - 1]!);
          }}
          onNext={() => {
            setShell(shell + 1);
            setShellName(savedNames[shell + 1]!);
          }}
          onClose={() => setShell(null)}
          kind={shellMedium.kind}
          src={shellMedium.src}
          text={shellMedium.text}
          format={shellMedium.format}
          previewState={shellMedium.state}
          previewDetail={shellMedium.detail}
          alt={savedNames[shell]}
          dirty={shellName !== savedNames[shell]}
          saving={shellSaving}
          onSave={() => {
            setShellSaving(true);
            return new Promise<boolean>((resolve) =>
              setTimeout(() => {
                setShellSaving(false);
                setAllSavedNames((all) => ({
                  ...all,
                  [shellSet]: all[shellSet].map((name, i) => (i === shell ? shellName : name)),
                }));
                resolve(true);
              }, 1500),
            );
          }}
          onReset={() => setShellName(savedNames[shell]!)}
          pickAction={() => setShell(null)}
          facts={
            <FileFacts
              kind={
                shellMedium.kind === "pdf" || shellMedium.kind === "text"
                  ? "other"
                  : shellMedium.kind
              }
            />
          }
          fields={
            <div className="flex flex-col gap-2">
              <Label htmlFor="shell-name">Name</Label>
              <Input
                id="shell-name"
                value={shellName}
                onChange={(event) => setShellName(event.target.value)}
              />
            </div>
          }
          usage={{
            count: shell === 0 ? 1 : 0,
            active: shellUsage,
            onToggle: () => setShellUsage(!shellUsage),
            content: (
              <UsageTable
                items={
                  shell === 0
                    ? [
                        {
                          id: "1",
                          title: "Spring newsletter",
                          type: "Post",
                          status: "published",
                          href: "/posts/1",
                        },
                      ]
                    : []
                }
              />
            ),
          }}
        />
      )}
    </PageScroll>
  );
}

export function EditPanelPage() {
  return <ShellPage content={<Demo />} />;
}
