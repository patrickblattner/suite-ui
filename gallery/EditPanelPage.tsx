import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { PageHeader } from "../src/list/page-header.js";
import { PageScroll } from "../src/list/page-scroll.js";
import { Button } from "../src/ui/button.js";
import { Combobox, type ComboboxOption } from "../src/ui/combobox.js";
import { CreateAndSelectDialog } from "../src/ui/create-and-select-dialog.js";
import { EditPanel } from "../src/ui/edit-panel.js";
import { Input } from "../src/ui/input.js";
import { FileFacts } from "../src/ui/file-facts.js";
import { Hint } from "../src/ui/hint.js";
import { Label } from "../src/ui/label.js";
import { useLeaveGuard } from "../src/ui/leave-guard.js";
import { Textarea } from "../src/ui/textarea.js";
import {
  type MediaDetailKind,
  MediaDetailShell,
  type MediaDetailSource,
  type MediaPreviewState,
} from "../src/ui/media-detail-shell.js";
import { UsageTable } from "../src/ui/usage-table.js";
import { ShellPage } from "./ShellPage.js";

const ROWS = Array.from({ length: 60 }, (_, index) => `Channel ${index + 1}`);
const MEDIA = ["team-photo.jpg", "logo.svg", "brochure.pdf"];
// A landscape stand-in picture per medium, so the preview shows how an image fills its column.
const PICTURE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">' +
  '<rect width="1200" height="800" fill="#8a94a6"/><circle cx="380" cy="300" r="140" fill="#d8dce3"/>' +
  '<path d="M0 800 L420 420 L700 640 L900 480 L1200 760 L1200 800 Z" fill="#5b6475"/></svg>';
const PICTURE = `data:image/svg+xml,${encodeURIComponent(PICTURE_SVG)}`;
// The shell loads only https, http and blob URLs (`SUI-FEATURE-089`): its stand-ins are blobs.
const blobOf = (body: string, type: string) => URL.createObjectURL(new Blob([body], { type }));
// The media detail shell pages through one image, one video and one PDF (`SUI-FEATURE-061`). The
// video and the PDF are stand-ins without bytes worth playing: the frame and the control bar show.
const SHELL_MEDIA = [
  { kind: "image", name: "team-photo.jpg", src: blobOf(PICTURE_SVG, "image/svg+xml") },
  { kind: "video", name: "intro.mp4", src: blobOf("", "video/mp4") },
  { kind: "pdf", name: "brochure.pdf", src: blobOf("", "application/pdf") },
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
type ShellMedium = {
  kind: MediaDetailKind;
  name: string;
  src?: string;
  text?: string;
  format?: "plain" | "json";
  state?: MediaPreviewState;
  detail?: string;
};

// The shell's source props of a medium (#167): its kind with its address, or the state that stands
// in for the preview.
function sourceOf({ kind, src, state }: ShellMedium): MediaDetailSource {
  const address = src === undefined ? {} : { src };
  const stand = state === undefined ? {} : { previewState: state };
  if (kind === "text" || kind === "other") return { kind, ...address, ...stand };
  if (state !== undefined) return { kind, ...address, previewState: state };
  if (src === undefined) throw new Error(`a ${kind} medium needs its src`);
  return { kind, src };
}

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
// App-side hint: the two panels below close after saving, which the package `save` hint does not say
// (`SUI-FEATURE-091`).
const LABELS = {
  en: { saveCloseHint: "Saves the entries and closes the panel." },
  de: { saveCloseHint: "Speichert die Eingaben und schließt das Panel." },
  es: { saveCloseHint: "Guarda los datos y cierra el panel." },
};
const FIELDS = Array.from({ length: 24 }, (_, index) => `Field ${index + 1}`);

// `SUI-FEATURE-093` (#264): a record picker in a panel creates a missing contact in the compact
// dialog over it. The stand-in server searches for 400 ms and creates for 800 ms; a name that exists
// (in any letter case) is reported as a duplicate.
const CONTACTS: readonly ComboboxOption[] = [
  { value: "c1", label: "Ada Lovelace" },
  { value: "c2", label: "Alan Turing" },
  { value: "c3", label: "Grace Hopper" },
];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// SUI-FEATURE-094: a glossary panel over a settings form; Apply takes the term over into the form,
// which saves with its own page Save. The panel's submit never submits the outer form; applied
// terms not yet saved make the page ask "Save changes?" before a route change.
function ApplyPanelDemo() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [terms, setTerms] = useState<string[]>([]);
  const [saves, setSaves] = useState(0);
  const [saved, setSaved] = useState(0);
  const { dialog } = useLeaveGuard({
    dirty: terms.length !== saved,
    onLeave: () => {},
    onSave: () => {
      setSaves((count) => count + 1);
      setSaved(terms.length);
      return true;
    },
    // Discard drops the applied terms not saved yet: the page is back at its saved state.
    onDiscard: () => setTerms((list) => list.slice(0, saved)),
  });
  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        setSaves((count) => count + 1);
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="apply-panel-trigger"
        onClick={() => {
          setTerm("");
          setOpen(true);
        }}
      >
        Open a glossary term
      </Button>
      <span data-testid="apply-panel-counts">
        terms {terms.length} · page saves {saves}
      </span>
      <EditPanel
        open={open}
        onOpenChange={setOpen}
        title="Glossary term"
        mode="add"
        dirty={term !== ""}
        submitKind="apply"
        onSubmit={() => {
          setTerms((list) => [...list, term]);
          setOpen(false);
          return true;
        }}
        testIdPrefix="apply-panel"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="apply-term">Term</Label>
          <Input id="apply-term" value={term} onChange={(event) => setTerm(event.target.value)} />
        </div>
      </EditPanel>
      {dialog}
    </form>
  );
}

function ContactPanelDemo() {
  const [open, setOpen] = useState(false);
  // The stand-in server's records; the picker's own options stay the first few, as an app's would.
  const [server, setServer] = useState(CONTACTS);
  const [contact, setContact] = useState<ComboboxOption | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        data-testid="contact-panel-trigger"
        onClick={() => {
          setContact(null);
          setOpen(true);
        }}
      >
        Open with a contact picker
      </Button>
      <EditPanel
        open={open}
        onOpenChange={setOpen}
        title="Requirement"
        mode="edit"
        dirty={contact !== null}
        onSubmit={() => setOpen(false)}
        testIdPrefix="contact-panel"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact-picker">Contact</Label>
          <Combobox
            id="contact-picker"
            options={CONTACTS}
            value={contact?.value ?? ""}
            selectedOption={contact ?? undefined}
            onValueChange={(_, option) => setContact(option)}
            onSearch={async (text) => {
              await wait(400);
              return server.filter(({ label }) => label.toLowerCase().includes(text.toLowerCase()));
            }}
            onCreateRequest={setTerm}
            data-testid="contact-picker"
          />
        </div>
      </EditPanel>
      <CreateAndSelectDialog
        open={term !== null}
        onOpenChange={(next) => !next && setTerm(null)}
        title="Create contact"
        initialName={term ?? ""}
        onCreate={async ({ name = "" }) => {
          await wait(800);
          const existing = server.find(
            ({ label }) => label.toLowerCase() === name.trim().toLowerCase(),
          );
          if (existing !== undefined) return { duplicate: existing };
          const created = { value: `c${server.length + 1}`, label: name.trim() };
          setServer((list) => [...list, created]);
          return { created };
        }}
        onSelect={setContact}
        data-testid="contact-create"
      >
        {(nameField) => (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input id="contact-name" data-testid="contact-create-name" {...nameField} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                name="email"
                type="email"
                data-testid="contact-create-email"
              />
            </div>
          </>
        )}
      </CreateAndSelectDialog>
    </>
  );
}

// A long list whose rows open the edit panel, inside the shell frame (`SUI-FEATURE-030`). The panel
// lives in the routed page as in an app: a navigation away unmounts both. Save works for 1.5 s.
function Demo() {
  const { i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const { pathname } = useLocation();
  const [start] = useState(pathname);
  const [row, setRow] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [submits, setSubmits] = useState(0);
  const [backs, setBacks] = useState(0);
  const [media, setMedia] = useState<number | null>(null);
  const [nextOpen, setNextOpen] = useState(false);
  const [nextName, setNextName] = useState("team-photo.jpg");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewModeOpen, setViewModeOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
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
          onClick={() => {
            setNextName("team-photo.jpg");
            setNextOpen(true);
          }}
        >
          Open a next step
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="view-panel-trigger"
          onClick={() => setViewOpen(true)}
        >
          Open read-only
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="view-mode-panel-trigger"
          onClick={() => setViewModeOpen(true)}
        >
          Open view mode
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="note-panel-trigger"
          onClick={() => {
            setNote("");
            setNoteOpen(true);
          }}
        >
          Open without save target
        </Button>
        <ContactPanelDemo />
        <ApplyPanelDemo />
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
        submitHint={labels.saveCloseHint}
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
        dirty={nextName !== "team-photo.jpg"}
        submitLabel="Continue to review"
        submitKind="next"
        onSubmit={() => setNextOpen(false)}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="next-name">File name</Label>
          <Input
            id="next-name"
            value={nextName}
            onChange={(event) => setNextName(event.target.value)}
          />
        </div>
      </EditPanel>
      {/* SUI-FEATURE-091: without onSubmit the panel only shows a record; its footer is Close. */}
      <EditPanel
        open={viewOpen}
        onOpenChange={setViewOpen}
        title="Main channel"
        mode="edit"
        testIdPrefix="view-panel"
      >
        <p className="text-sm">Created on 3 March, 12 posts.</p>
      </EditPanel>
      {/* SUI-FEATURE-097: the view mode shows a record with its preview; Edit is the app's action. */}
      <EditPanel
        open={viewModeOpen}
        onOpenChange={setViewModeOpen}
        title="team-photo.jpg"
        description="Uploaded on 3 March by Ana."
        mode="view"
        testIdPrefix="view-mode-panel"
        preview={<img src={PICTURE} alt="team-photo.jpg" data-testid="view-mode-panel-picture" />}
        actions={
          <Hint text="Opens the record in the edit panel.">
            <Button
              type="button"
              variant="outline"
              size="default"
              data-testid="view-mode-panel-edit"
              onClick={() => {
                setViewModeOpen(false);
                setMedia(0);
              }}
            >
              <PencilIcon aria-hidden="true" />
              Edit
            </Button>
          </Hint>
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Type</dt>
          <dd>JPEG image</dd>
          <dt className="text-muted-foreground">Size</dt>
          <dd>1200 × 800 px</dd>
          <dt className="text-muted-foreground">Used in</dt>
          <dd>Spring newsletter</dd>
        </dl>
      </EditPanel>
      {/* SUI-FEATURE-092: an unsent comment has no save target; leaving it asks to discard. */}
      <EditPanel
        open={noteOpen}
        onOpenChange={setNoteOpen}
        title="Triage"
        mode="edit"
        testIdPrefix="note-panel"
        dirty={note !== ""}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="note-comment">Comment</Label>
          <Textarea
            id="note-comment"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
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
        submitHint={labels.saveCloseHint}
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
          {...sourceOf(shellMedium)}
          text={shellMedium.text}
          format={shellMedium.format}
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
