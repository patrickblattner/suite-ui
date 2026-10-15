import { EyeIcon, PencilIcon, PlusIcon, SendIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTableShell } from "../src/list/data-table-shell.js";
import { PageHeader } from "../src/list/page-header.js";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../src/ui/accordion.js";
import { Badge, type BadgeVariant } from "../src/ui/badge.js";
import { Button, type ButtonSize, type ButtonVariant } from "../src/ui/button.js";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../src/ui/card.js";
import { Checkbox } from "../src/ui/checkbox.js";
import { Code } from "../src/ui/code.js";
import { ColorDotBadge } from "../src/ui/color-dot-badge.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/ui/dropdown-menu.js";
import { ImagePlacementButtons } from "../src/ui/crop-editor.js";
import { type Crop, CroppedBackground, CroppedImage } from "../src/ui/cropped-image.js";
import { EditorHeader, type EditorLifecycle } from "../src/ui/editor-header.js";
import { FileFacts } from "../src/ui/file-facts.js";
import { Hint } from "../src/ui/hint.js";
import { InlineStatus } from "../src/ui/inline-status.js";
import { Input } from "../src/ui/input.js";
import { Label } from "../src/ui/label.js";
import { LabelWithHelp } from "../src/ui/label-with-help.js";
import {
  type OperationHandle,
  type OperationStart,
  OperationStatusProvider,
  useOperationStatus,
} from "../src/ui/operation-status.js";
import { RadioGroup, RadioGroupItem } from "../src/ui/radio-group.js";
import { RestoreDefaultsButton } from "../src/ui/restore-defaults-button.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/ui/select.js";
import { Skeleton } from "../src/ui/skeleton.js";
import { Slider } from "../src/ui/slider.js";
import { STATUS_CHIP_STATES, StatusChip, type StatusChipTone } from "../src/ui/status-chip.js";
import { Switch } from "../src/ui/switch.js";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../src/ui/table.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/ui/tabs.js";
import { TagInput } from "../src/ui/tag-input.js";
import { Textarea } from "../src/ui/textarea.js";
import { TimezoneCombobox } from "../src/ui/timezone-combobox.js";
import { type UploadItem, UploadStep } from "../src/ui/upload-step.js";

import { CanvasEdgeRow, CanvasRow } from "./CanvasDemo.js";
import { CanvasEditorRow } from "./CanvasEditorDemo.js";

const VARIANTS: ButtonVariant[] = [
  "success",
  "warn",
  "destructive",
  "outline",
  "secondary",
  "ghost",
  "default",
  "link",
];
const TEXT_SIZES: ButtonSize[] = ["default", "xs", "sm", "lg"];
const ICON_SIZES: ButtonSize[] = ["icon", "icon-xs", "icon-sm", "icon-lg"];
const BADGES: BadgeVariant[] = [
  "success",
  "warn",
  "destructive",
  "info",
  "success-soft",
  "warn-soft",
  "destructive-soft",
  "info-soft",
  "secondary",
  "outline",
  "default",
];

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} data-testid={`section-${id}`} className="mb-8">
      <h2 id={`${id}-heading`} className="mb-3 text-lg font-medium">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 py-1 md:flex-row md:items-center md:gap-3">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <div className="flex max-w-full min-w-0 flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Buttons() {
  const { t } = useTranslation("suite");
  return (
    <Section id="button" title="Button">
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          {TEXT_SIZES.map((size) => (
            <Button key={size} variant={variant} size={size}>
              {t("actions.save")} {size}
            </Button>
          ))}
          {ICON_SIZES.map((size) => (
            <Button key={size} variant={variant} size={size} aria-label={t("actions.create")}>
              <PlusIcon />
            </Button>
          ))}
          <Button variant={variant} size="default" disabled>
            disabled
          </Button>
          <Button variant={variant} size="default" busy>
            <PlusIcon />
            busy
          </Button>
          <Button variant={variant} size="default" loading>
            loading
          </Button>
        </Row>
      ))}
      <Row label="idle · busy">
        <Button variant="default" size="default" data-testid="button-idle">
          <PlusIcon />
          {t("actions.create")}
        </Button>
        <Button variant="default" size="default" busy data-testid="button-busy">
          <PlusIcon />
          {t("actions.create")}
        </Button>
      </Row>
      <Row label="row actions">
        <Button variant="warn" size="icon-xs" aria-label="Edit">
          <PencilIcon />
        </Button>
        <Button variant="destructive" size="icon-xs" aria-label={t("actions.delete")}>
          <Trash2Icon />
        </Button>
      </Row>
      {/* `SUI-FEATURE-006`: a text link sized by its line of text, in a table row and in a path. */}
      <Row label="inline · table row">
        <Table data-testid="button-inline-table">
          <TableBody>
            <TableRow>
              <TableCell>Spring catalogue</TableCell>
              <TableCell>
                <Button variant="link" size="inline" data-testid="button-inline-row">
                  <EyeIcon />
                  12 items
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Row>
      <Row label="inline · path">
        <nav aria-label="Path" data-testid="button-inline-path">
          <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <li>
              <Button variant="link" size="inline">
                Storage
              </Button>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Button variant="link" size="inline">
                Media
              </Button>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground">
              2026
            </li>
          </ol>
        </nav>
      </Row>
    </Section>
  );
}

// `SUI-FEATURE-045`: two adds in one title row, the second locked with its reason, and the one look
// of "Restore defaults".
function Adds() {
  const { t } = useTranslation("suite");
  return (
    <Section id="adds" title="PageHeader add pair · RestoreDefaultsButton">
      <div className="max-w-3xl rounded-md border p-4" data-testid="adds-frame">
        <PageHeader
          title="Users"
          subtitle="Two adds in one title row."
          add={[
            { label: t("actions.create"), onClick: () => {} },
            {
              label: "Import",
              onClick: () => {},
              disabled: true,
              disabledText: "Possible once a directory is connected.",
            },
          ]}
        />
      </div>
      <UploadAdd />
      <Row label="restore">
        <RestoreDefaultsButton onClick={() => {}} />
        <RestoreDefaultsButton
          onClick={() => {}}
          disabled
          disabledText="Already the defaults."
          testId="restore-defaults-locked"
        />
      </Row>
    </Section>
  );
}

// `SUI-FEATURE-068`: an upload add that opens its panel and reports open and closed.
function UploadAdd() {
  const [open, setOpen] = useState(false);
  return (
    <div className="max-w-3xl rounded-md border p-4" data-testid="adds-upload-frame">
      <PageHeader
        title="Media library"
        subtitle="The upload add reports whether its panel is open."
        add={{
          label: "Upload",
          kind: "upload",
          onClick: () => setOpen((value) => !value),
          expanded: open,
          controls: "gallery-upload-panel",
        }}
      />
      <div
        id="gallery-upload-panel"
        hidden={!open}
        className="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
        data-testid="adds-upload-panel"
      >
        Drop files here.
      </div>
    </div>
  );
}

// Starts the given operations once, as a page would after a press.
function SeedOperations({ operations }: { operations: OperationStart[] }) {
  const { start } = useOperationStatus();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    for (const operation of operations) start(operation);
  }, [operations, start]);
  return null;
}

function StatusFrame({
  id,
  title,
  operations,
}: {
  id: string;
  title: string;
  operations: OperationStart[];
}) {
  return (
    <div className="max-w-3xl rounded-md border p-4" data-testid={`status-frame-${id}`}>
      <OperationStatusProvider>
        <SeedOperations operations={operations} />
        <PageHeader
          title={title}
          subtitle="The status slot sits left of the actions."
          operationScope={id}
          secondaryAction={
            <Button variant="outline" size="default" data-testid={`status-preview-${id}`}>
              Preview
            </Button>
          }
          primaryAction={
            <Button variant="success" size="default">
              Publish
            </Button>
          }
        />
      </OperationStatusProvider>
    </div>
  );
}

// The toggle starts and ends one operation, so the head can be measured before and after; its text
// stays the same, so the actions keep their width.
function StatusToggle({
  subtitle,
  label = "Website is updating",
}: {
  subtitle: string;
  label?: string;
}) {
  const { start } = useOperationStatus();
  const handle = useRef<OperationHandle | null>(null);
  const [running, setRunning] = useState(false);
  const toggle = () => {
    if (handle.current === null) {
      handle.current = start({ scope: "toggle", label });
    } else {
      handle.current.succeed("Website updated");
      handle.current = null;
    }
    setRunning(handle.current !== null);
  };
  return (
    <>
      <PageHeader
        title="Brand kit"
        subtitle={subtitle}
        operationScope="toggle"
        action={
          <Button
            variant="outline"
            size="default"
            onClick={toggle}
            aria-pressed={running}
            data-testid="status-toggle"
          >
            Run
          </Button>
        }
      />
      <Input aria-label="First field" data-testid="status-below" />
    </>
  );
}

// `SUI-FEATURE-050`: the status slot of the page head (running, progress, several) and the row status.
function OperationStatus() {
  return (
    <Section id="operation-status" title="PageHeader status slot · InlineStatus">
      <div className="flex flex-col gap-4">
        <StatusFrame
          id="running"
          title="Brand kit"
          operations={[
            { scope: "running", label: "Website is updating — visible in about 1–2 minutes" },
          ]}
        />
        <StatusFrame
          id="progress"
          title="Media"
          operations={[{ scope: "progress", label: "3 of 5 files uploaded", progress: 0.6 }]}
        />
        <StatusFrame
          id="multiple"
          title="Exports"
          operations={[
            { scope: "multiple", label: "Exporting members" },
            { scope: "multiple", label: "Exporting events" },
          ]}
        />
        <div className="max-w-3xl rounded-md border p-4" data-testid="status-frame-toggle">
          <OperationStatusProvider>
            <StatusToggle subtitle="Start and end an operation." />
          </OperationStatusProvider>
        </div>
        <div className="max-w-3xl rounded-md border p-4" data-testid="status-frame-squeezed">
          <OperationStatusProvider>
            <StatusToggle
              subtitle="A subtitle long enough to fill the row on its own, so a running operation has to take its width from it: it truncates on one line, the title stays whole."
              label="Website is updating — visible in about 1–2 minutes"
            />
          </OperationStatusProvider>
        </div>
      </div>
      <Row label="inline">
        <InlineStatus />
        <InlineStatus state="running" label="Uploading logo.svg" />
        <InlineStatus state="running" progress={0.4} label="40 %" />
        <InlineStatus state="done" label="Uploaded" />
        <InlineStatus state="failed" label="File too large" />
      </Row>
    </Section>
  );
}

// The choice state: the chosen files' names land below, so a test can read what `onFiles` got.
function UploadChoose() {
  const [chosen, setChosen] = useState<string[]>([]);
  return (
    <div className="flex flex-col gap-2" data-testid="upload-frame-choose">
      <UploadStep
        options={
          <div className="flex items-center gap-2">
            <Checkbox id="upload-optimise" defaultChecked />
            <Label htmlFor="upload-optimise">Optimise images</Label>
          </div>
        }
        accept="image/*"
        onFiles={(files) => setChosen(files.map((file) => file.name))}
      />
      <span className="text-sm text-muted-foreground" data-testid="upload-chosen">
        {chosen.join(", ")}
      </span>
    </div>
  );
}

// The rejection state (`SUI-FEATURE-052`): on mount the frame chooses one matching and one other file,
// so the message stands in the gallery, below the drop zone, or above the rows when `onFiles` sets them.
function UploadRejected({ rows = false }: { rows?: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<UploadItem[]>();
  useEffect(() => {
    const input = frame.current?.querySelector<HTMLInputElement>("[data-testid=upload-input]");
    if (input == null) return;
    const files = new DataTransfer();
    files.items.add(new File(["a"], "team-photo.jpg", { type: "image/jpeg" }));
    files.items.add(new File(["b"], "notes.txt", { type: "text/plain" }));
    input.files = files.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);
  return (
    <div ref={frame} data-testid={rows ? "upload-frame-rejected-rows" : "upload-frame-rejected"}>
      <UploadStep
        accept="image/*"
        items={items}
        onFiles={(files) => {
          if (rows) {
            setItems(files.map((file) => ({ id: file.name, name: file.name, state: "running" })));
          }
        }}
      />
    </div>
  );
}

const UPLOAD_LOADING: UploadItem[] = [
  { id: "1", name: "team-photo.jpg", state: "running", progress: 0.4 },
  { id: "2", name: "logo.svg", state: "running" },
];

const UPLOAD_RESULT: UploadItem[] = [
  { id: "1", name: "team-photo.jpg", state: "done" },
  {
    id: "2",
    name: "brochure-with-a-very-long-file-name-2026.pdf",
    state: "failed",
    error: "File too large",
  },
];

// The existing tags the tag field suggests (`SUI-FEATURE-100`).
const TAG_SUGGESTIONS = ["Stadt", "Land", "Sport", "Festival", "Kultur", "Musik", "Team"];

// `SUI-FEATURE-051`: the upload step (choose, loading, result with an error) and the tag field;
// `SUI-FEATURE-052`: the rejection message; `SUI-FEATURE-100`: the tag field's suggestions.
function UploadAndTags() {
  const [tags, setTags] = useState(["summer", "team"]);
  const [loading, setLoading] = useState(true);
  return (
    <Section id="upload" title="UploadStep · TagInput">
      <div className="grid max-w-3xl gap-4 md:grid-cols-3">
        <UploadChoose />
        <div className="flex flex-col gap-2" data-testid="upload-frame-loading">
          <UploadStep onFiles={() => {}} items={loading ? UPLOAD_LOADING : UPLOAD_RESULT} />
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setLoading((value) => !value)}
            data-testid="upload-toggle"
          >
            Switch state
          </Button>
        </div>
        <div data-testid="upload-frame-error">
          <UploadStep onFiles={() => {}} items={UPLOAD_RESULT} />
        </div>
        <UploadRejected />
        <UploadRejected rows />
      </div>
      <div className="mt-4 flex max-w-md flex-col gap-2">
        <Label htmlFor="gallery-tags">Tags</Label>
        <TagInput
          id="gallery-tags"
          value={tags}
          onChange={setTags}
          placeholder="Add tags"
          suggestions={TAG_SUGGESTIONS}
        />
      </div>
    </Section>
  );
}

function Fields() {
  const [timezone, setTimezone] = useState("Europe/Zurich");
  const [empty, setEmpty] = useState("");
  return (
    <Section id="fields" title="Input · Textarea · Label · TimezoneCombobox">
      <div className="grid grid-cols-4 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="input-empty">Label</Label>
          <Input id="input-empty" placeholder="Placeholder" />
        </div>
        <div className="flex flex-col gap-2">
          <LabelWithHelp htmlFor="input-filled" help="The name shown in lists">
            LabelWithHelp
          </LabelWithHelp>
          <Input id="input-filled" defaultValue="Filled" aria-describedby="input-filled-help" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="input-disabled">Disabled</Label>
          <Input id="input-disabled" defaultValue="Disabled" disabled />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="input-invalid">Invalid</Label>
          <Input id="input-invalid" defaultValue="Invalid" aria-invalid />
        </div>
        <Textarea aria-label="Textarea empty" placeholder="Placeholder" />
        <Textarea aria-label="Textarea filled" defaultValue={"Two\nlines"} />
        <Textarea aria-label="Textarea disabled" defaultValue="Disabled" disabled />
        <Textarea aria-label="Textarea invalid" defaultValue="Invalid" aria-invalid />
        <Textarea
          aria-label="Textarea overflowing"
          data-testid="textarea-overflowing"
          className="h-24"
          defaultValue={Array.from({ length: 12 }, (_, i) => `Line ${i + 1}`).join("\n")}
        />
        <Textarea
          aria-label="Textarea fitting"
          data-testid="textarea-fitting"
          className="h-24"
          defaultValue="Line 1"
        />
        <TimezoneCombobox
          value={timezone}
          onValueChange={setTimezone}
          data-testid="timezone-value"
        />
        <TimezoneCombobox value={empty} onValueChange={setEmpty} data-testid="timezone-empty" />
        <TimezoneCombobox value="Europe/Berlin" onValueChange={() => undefined} disabled />
        <TimezoneCombobox value="Europe/Berlin" onValueChange={() => undefined} aria-invalid />
      </div>
    </Section>
  );
}

function Choices() {
  return (
    <Section id="choices" title="Checkbox · RadioGroup · Switch · Select">
      <Row label="Checkbox">
        <Checkbox aria-label="unchecked" />
        <Checkbox aria-label="checked" defaultChecked />
        <Checkbox aria-label="disabled" disabled />
        <Checkbox aria-label="disabled checked" disabled defaultChecked />
        <Checkbox aria-label="invalid" aria-invalid />
      </Row>
      <Row label="RadioGroup">
        <RadioGroup defaultValue="a" className="flex gap-4" aria-label="RadioGroup">
          {["a", "b", "c"].map((value) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem id={`radio-${value}`} value={value} disabled={value === "c"} />
              <Label htmlFor={`radio-${value}`}>{value === "c" ? "disabled" : value}</Label>
            </div>
          ))}
        </RadioGroup>
      </Row>
      <Row label="Switch">
        <Switch aria-label="off" />
        <Switch aria-label="on" defaultChecked />
        <Switch aria-label="disabled" disabled />
        <Switch aria-label="disabled on" disabled defaultChecked />
        <Switch aria-label="sm off" size="sm" />
        <Switch aria-label="sm on" size="sm" defaultChecked />
      </Row>
      <Row label="Select">
        <Select defaultValue="weekly">
          <SelectTrigger aria-label="Select with value" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger aria-label="Select empty" className="w-48">
            <SelectValue placeholder="Placeholder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="daily" disabled>
          <SelectTrigger aria-label="Select disabled" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="daily">
          <SelectTrigger aria-label="Select small" size="sm" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="long">
          <SelectTrigger aria-label="Select clipped" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="long">A value too long for its trigger</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row label="Select · field name">
        <Select defaultValue="weekly">
          <SelectTrigger className="w-80" data-testid="select-named-wide" fieldName="Interval">
            <span aria-hidden="true">Interval</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="long">
          <SelectTrigger className="w-48" data-testid="select-named-clipped" fieldName="Interval">
            <span aria-hidden="true">Interval</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="long">A value too long for its trigger</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      {(["default", "sm"] as const).map((size) => (
        <Row key={size} label={`Height · ${size}`}>
          <div className="flex flex-wrap items-center gap-3" data-testid={`height-row-${size}`}>
            <Input aria-label={`Input ${size}`} size={size} placeholder="Search" className="w-48" />
            <Select defaultValue="weekly">
              <SelectTrigger aria-label={`Select ${size}`} size={size} className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="default" size={size}>
              Apply
            </Button>
          </div>
        </Row>
      ))}
    </Section>
  );
}

const TILE_SIZES = ["small", "medium", "large"] as const;

// `SUI-FEATURE-057`: alone, beside a number field holding the same value, and in three named steps.
function Sliders() {
  const [width, setWidth] = useState(50);
  const [linked, setLinked] = useState(40);
  const [size, setSize] = useState(1);
  return (
    <Section id="slider" title="Slider">
      <Row label="Alone">
        <Slider
          value={width}
          onValueChange={setWidth}
          min={1}
          max={100}
          aria-label="Image width"
          className="w-48"
          data-testid="slider-alone"
        />
        <Slider
          value={30}
          onValueChange={() => {}}
          disabled
          aria-label="Disabled"
          className="w-48"
          data-testid="slider-disabled"
        />
      </Row>
      <Row label="With number">
        <Slider
          value={linked}
          onValueChange={setLinked}
          min={1}
          max={100}
          aria-label="Linked width"
          className="w-48"
          data-testid="slider-linked"
        />
        <Input
          type="number"
          size="sm"
          min={1}
          max={100}
          value={linked}
          onChange={(event) => setLinked(Number(event.target.value))}
          aria-label="Linked width in %"
          className="w-20"
          data-testid="slider-linked-input"
        />
      </Row>
      <Row label="Three steps">
        <Slider
          value={size}
          onValueChange={setSize}
          min={0}
          max={2}
          getAriaValueText={(value) => TILE_SIZES[value] ?? ""}
          aria-label="Tile size"
          className="w-48"
          data-testid="slider-steps"
        />
        <span className="text-muted-foreground">{TILE_SIZES[size]}</span>
      </Row>
    </Section>
  );
}

// Domain states with the app's own text (`GL-UI-011` §Fachzustände): a tone and a translated label.
const DOMAIN_STATES = {
  en: {
    paid: "Paid",
    cancelled: "Cancelled",
    signatureMissing: "Signature missing",
    sending: "Sending",
    ended: "Ended",
  },
  de: {
    paid: "Bezahlt",
    cancelled: "Storniert",
    signatureMissing: "Unterschrift fehlt",
    sending: "Wird versendet",
    ended: "Beendet",
  },
  es: {
    paid: "Pagado",
    cancelled: "Cancelado",
    signatureMissing: "Falta la firma",
    sending: "Enviando",
    ended: "Finalizado",
  },
};

const DOMAIN_TONES = {
  paid: "success",
  cancelled: "destructive",
  signatureMissing: "warn",
  sending: "info",
  ended: "neutral",
} as const satisfies Record<keyof typeof DOMAIN_STATES.en, StatusChipTone>;

function Badges() {
  const { t, i18n } = useTranslation("suite");
  const domainLabels =
    DOMAIN_STATES[i18n.language as keyof typeof DOMAIN_STATES] ?? DOMAIN_STATES.en;
  const label: Partial<Record<BadgeVariant, string>> = {
    success: t("status.success"),
    warn: t("status.warning"),
    destructive: t("status.error"),
    info: t("status.info"),
    "success-soft": t("status.success"),
    "warn-soft": t("status.warning"),
    "destructive-soft": t("status.error"),
    "info-soft": t("status.info"),
  };
  return (
    <Section id="badge" title="Badge · StatusChip · Code · Hint · Skeleton">
      <Row label="Badge">
        {BADGES.map((variant) => (
          <Badge key={variant} variant={variant}>
            {label[variant] ?? variant}
          </Badge>
        ))}
      </Row>
      <Row label="StatusChip">
        {STATUS_CHIP_STATES.map((state) => (
          <StatusChip key={state} state={state} data-testid={`status-chip-${state}`} />
        ))}
      </Row>
      <Row label="StatusChip filled">
        {STATUS_CHIP_STATES.map((state) => (
          <StatusChip key={state} state={state} emphasis="filled" />
        ))}
      </Row>
      <Row label="StatusChip domain">
        {Object.entries(DOMAIN_TONES).map(([key, tone]) => (
          <StatusChip
            key={key}
            tone={tone}
            label={domainLabels[key as keyof typeof DOMAIN_TONES]}
            data-testid={`status-chip-domain-${key}`}
          />
        ))}
        <StatusChip
          tone="success"
          label={domainLabels.paid}
          emphasis="filled"
          detail="09.10.2026"
          data-testid="status-chip-domain-filled"
        />
      </Row>
      <Row label="ColorDotBadge">
        <ColorDotBadge color="oklch(0.6 0.2 300)" data-testid="color-dot-badge">
          Newsletter
        </ColorDotBadge>
        <ColorDotBadge color="oklch(0.7 0.15 75)">Events</ColorDotBadge>
      </Row>
      <Row label="Code">
        <span data-testid="code-context">
          Slot <Code data-testid="code">slot-07</Code> · <Code>smtp.password</Code>
        </span>
      </Row>
      <Row label="Hint">
        <Hint text="Saves the draft">
          <Button variant="success" size="default" data-testid="hint-save">
            {t("actions.save")}
          </Button>
        </Hint>
        <Hint text="Saves the draft" disabledText="Possible once a field changed">
          <Button variant="success" size="default" disabled>
            {t("actions.save")}
          </Button>
        </Hint>
      </Row>
      <Row label="Skeleton">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="size-9 rounded-full" />
      </Row>
    </Section>
  );
}

function Structure() {
  return (
    <Section id="structure" title="Tabs · Card · Table · Accordion">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="mail">Mail</TabsTrigger>
              <TabsTrigger value="off" disabled>
                Disabled
              </TabsTrigger>
            </TabsList>
            <TabsContent value="general">Default tabs</TabsContent>
          </Tabs>
          <Tabs defaultValue="general">
            <TabsList variant="line">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="mail">Mail</TabsTrigger>
            </TabsList>
            <TabsContent value="general">Line tabs</TabsContent>
          </Tabs>
          <Accordion type="single" collapsible defaultValue="open">
            <AccordionItem value="open">
              <AccordionTrigger>Open item</AccordionTrigger>
              <AccordionContent>The content of the open item.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="closed">
              <AccordionTrigger>Closed item</AccordionTrigger>
              <AccordionContent>Hidden.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Card</CardTitle>
                <CardDescription>Presentational</CardDescription>
                <CardAction>
                  <Badge variant="secondary">Manual</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>Content</CardContent>
              <CardFooter>Footer</CardFooter>
            </Card>
            <Card interactive tabIndex={0}>
              <CardHeader>
                <CardTitle>Interactive card</CardTitle>
                <CardDescription>Clickable</CardDescription>
              </CardHeader>
              <CardContent>Content</CardContent>
            </Card>
          </div>
          <Table>
            <TableCaption>Table</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Alpha</TableCell>
                <TableCell>
                  <Badge variant="success">Success</Badge>
                </TableCell>
                <TableCell className="text-right">12</TableCell>
              </TableRow>
              <TableRow data-state="selected">
                <TableCell>Beta (selected)</TableCell>
                <TableCell>
                  <Badge variant="destructive">Error</Badge>
                </TableCell>
                <TableCell className="text-right">3</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Gamma</TableCell>
                <TableCell>
                  <Badge variant="outline">Automatic</Badge>
                </TableCell>
                <TableCell className="text-right">0</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </Section>
  );
}

const LOG_ROWS = Array.from({ length: 12 }, (_, index) => ({
  time: `09:${String(index * 5).padStart(2, "0")}`,
  message: `Sync run ${index + 1} finished`,
}));

// `SUI-FEATURE-053`: a read table without focusable rows; `scrollLabel` makes its scroller a named
// region in the tab order, so the rows scroll by keyboard.
function ReadTable() {
  return (
    <Section id="read-table" title="DataTableShell · scrollLabel">
      <div className="flex h-56 max-w-md flex-col">
        <DataTableShell
          head={
            <>
              <TableHead>Time</TableHead>
              <TableHead>Message</TableHead>
            </>
          }
          columnCount={2}
          isPending={false}
          isEmpty={false}
          empty="No entries."
          emptyTestId="log-empty"
          loadingRowTestId="log-loading"
          scrollTestId="log-scroll"
          scrollLabel="System log"
        >
          {LOG_ROWS.map((row) => (
            <TableRow key={row.time} data-testid="log-row">
              <TableCell>{row.time}</TableCell>
              <TableCell>{row.message}</TableCell>
            </TableRow>
          ))}
        </DataTableShell>
      </div>
    </Section>
  );
}

// `SUI-FEATURE-060`: the file details of an image, a video without a measured frame rate, and an audio.
function FileFactsRow() {
  return (
    <Section id="file-facts" title="FileFacts">
      <Row label="FileFacts">
        <div className="flex flex-wrap items-start gap-8">
          <FileFacts
            kind="image"
            formatName="PNG"
            mime="image/png"
            width={1920}
            height={1080}
            bytes={2_516_582}
            data-testid="file-facts-image"
          />
          <FileFacts
            kind="video"
            formatName="MP4"
            mime="video/mp4"
            width={1280}
            height={720}
            durationSeconds={3725}
            bytes={157_286_400}
            data-testid="file-facts-video"
          />
          <FileFacts
            kind="audio"
            formatName="MP3"
            mime="audio/mpeg"
            durationSeconds={185}
            bytes={1536}
            data-testid="file-facts-audio"
          />
        </div>
      </Row>
    </Section>
  );
}

// A 2000 × 1000 stand-in in four bands, with an arrow pointing right across the middle half, so the
// crop and the flip read at a glance.
const BANDS = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1000" viewBox="0 0 2000 1000">' +
    '<rect width="500" height="1000" fill="#c0392b"/><rect x="500" width="500" height="1000" fill="#2e86c1"/>' +
    '<rect x="1000" width="500" height="1000" fill="#28b463"/><rect x="1500" width="500" height="1000" fill="#d4ac0d"/>' +
    '<path d="M600 420 H1250 V300 L1450 500 L1250 700 V580 H600 Z" fill="#ffffff"/></svg>',
)}`;
const MIDDLE: Crop = { x: 0.25, y: 0, width: 0.5, height: 1 };

// `SUI-FEATURE-062`: the image placement buttons with the crop editor, the drawn image (original,
// middle half, middle half flipped) and a cropped, flipped background whose text stays unflipped.
function CropRow() {
  const [flipped, setFlipped] = useState(false);
  const [crop, setCrop] = useState<Crop | null>(null);
  return (
    <Section id="crop" title="Crop and flip">
      <Row label="Placement buttons">
        <Button variant="outline" size="sm">
          Change image
        </Button>
        <ImagePlacementButtons
          src={BANDS}
          alt="Four bands"
          aspect={16 / 9}
          flipped={flipped}
          onFlippedChange={setFlipped}
          crop={crop}
          onCropChange={setCrop}
        />
      </Row>
      <Row label="CroppedImage">
        <CroppedImage
          src={BANDS}
          alt="Placement"
          crop={crop}
          flipped={flipped}
          naturalWidth={2000}
          naturalHeight={1000}
          className="w-48"
          data-testid="crop-placement"
        />
        <CroppedImage src={BANDS} alt="Original" className="w-48" />
        <CroppedImage
          src={BANDS}
          alt="Middle half"
          crop={MIDDLE}
          naturalWidth={2000}
          naturalHeight={1000}
          className="w-24"
          data-testid="crop-middle"
        />
        <CroppedImage
          src={BANDS}
          alt="Middle half, flipped"
          crop={MIDDLE}
          flipped
          naturalWidth={2000}
          naturalHeight={1000}
          className="w-24"
        />
      </Row>
      <Row label="CroppedBackground">
        <CroppedBackground
          src={BANDS}
          crop={MIDDLE}
          flipped
          naturalWidth={2000}
          naturalHeight={1000}
          className="flex size-48 items-end p-3"
          data-testid="crop-background"
        >
          <span className="rounded-sm bg-background px-2 py-1 text-sm">Not mirrored</span>
        </CroppedBackground>
      </Row>
    </Section>
  );
}

// `SUI-FEATURE-064`: the editor header saved and with an unsaved draft. The draft counts edits as
// history; Save works for 1.5 s, Reset asks first.
function EditorHeaderRow() {
  const [edits, setEdits] = useState(2);
  const [undone, setUndone] = useState(0);
  const [saving, setSaving] = useState(false);
  return (
    <Section id="editor-header" title="EditorHeader">
      <div className="flex flex-col gap-4 rounded-md border" data-testid="editor-header-saved">
        <EditorHeader
          title="Spring newsletter"
          onBack={() => {}}
          canUndo={false}
          canRedo={false}
          onUndo={() => {}}
          onRedo={() => {}}
          dirty={false}
          saving={false}
          onSave={() => {}}
          onReset={() => {}}
        />
      </div>
      <div className="mt-4 flex flex-col gap-4 rounded-md border" data-testid="editor-header-draft">
        <EditorHeader
          title="Autumn campaign landing page"
          onBack={() => {}}
          canUndo={edits > 0}
          canRedo={undone > 0}
          onUndo={() => {
            setEdits((n) => n - 1);
            setUndone((n) => n + 1);
          }}
          onRedo={() => {
            setEdits((n) => n + 1);
            setUndone((n) => n - 1);
          }}
          dirty={edits > 0}
          saving={saving}
          onSave={() => {
            setSaving(true);
            setTimeout(() => {
              setSaving(false);
              setEdits(0);
              setUndone(0);
            }, 1500);
          }}
          onReset={() => {
            setEdits(0);
            setUndone(0);
          }}
        />
      </div>
      <div
        className="mt-4 flex flex-col gap-4 rounded-md border"
        data-testid="editor-lifecycle-saved"
      >
        <EditorHeader
          title="Spring newsletter"
          onBack={() => {}}
          canUndo={false}
          canRedo={false}
          onUndo={() => {}}
          onRedo={() => {}}
          dirty={false}
          saving={false}
          onSave={() => {}}
          onReset={() => {}}
          lifecycle={galleryLifecycle}
        />
      </div>
      <div
        className="mt-4 flex flex-col gap-4 rounded-md border"
        data-testid="editor-lifecycle-draft"
      >
        <EditorHeader
          title="Autumn campaign landing page"
          onBack={() => {}}
          canUndo
          canRedo={false}
          onUndo={() => {}}
          onRedo={() => {}}
          dirty
          saving={false}
          onSave={() => {}}
          onReset={() => {}}
          lifecycle={galleryLifecycle}
        />
      </div>
    </Section>
  );
}

// `SUI-FEATURE-069`: Preview, ⋯ and the next step of a record with a lifecycle; saved, the next step is
// free; with a draft it waits for Save.
const galleryLifecycle: EditorLifecycle = {
  preview: { label: "Preview", icon: <EyeIcon aria-hidden="true" />, onClick: () => {} },
  menu: {
    label: "More",
    items: [
      { label: "Duplicate", onSelect: () => {} },
      { label: "Archive", onSelect: () => {} },
    ],
  },
  next: { label: "Submit for review", icon: <SendIcon aria-hidden="true" />, onClick: () => {} },
};

function FocusRow() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="default" size="default" className="focus-ring">
        Button
      </Button>
      <Button variant="outline" size="default" className="focus-ring">
        Outline
      </Button>
      <Button variant="destructive" size="default" className="focus-ring">
        Destructive
      </Button>
      <Input aria-label="Focus input" className="w-40 focus-ring" />
      <Select>
        <SelectTrigger aria-label="Focus select" className="w-40 focus-ring">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="daily">Daily</SelectItem>
        </SelectContent>
      </Select>
      <Checkbox aria-label="Focus checkbox" className="focus-ring" />
      <RadioGroup aria-label="Focus radio" defaultValue="a">
        <RadioGroupItem value="a" aria-label="Focus radio item" className="focus-ring" />
      </RadioGroup>
      <Switch aria-label="Focus switch" className="focus-ring" />
    </div>
  );
}

// `SUI-FEATURE-054`: the one focus ring of every component, drawn statically with the `focus-ring`
// rule the components apply on `focus-visible`, on the page and on a card. `SUI-FEATURE-055`: a
// closed menu to open by keyboard, whose highlighted entry carries the inset ring.
function FocusRing() {
  return (
    <Section id="focus" title="Focus ring">
      <div className="flex flex-col gap-6">
        <FocusRow />
        <Card>
          <CardContent className="flex flex-col gap-6">
            <FocusRow />
            <Textarea aria-label="Focus textarea" className="max-w-md focus-ring" />
          </CardContent>
        </Card>
        <div className="grid max-w-2xl grid-cols-2 gap-6">
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general" className="focus-ring">
                General
              </TabsTrigger>
              <TabsTrigger value="mail">Mail</TabsTrigger>
            </TabsList>
            {/* The panel the active trigger controls (axe); this demo shows only the triggers. */}
            <TabsContent value="general" className="hidden" />
          </Tabs>
          <Accordion type="single" collapsible>
            <AccordionItem value="item">
              <AccordionTrigger className="focus-ring">Accordion</AccordionTrigger>
              <AccordionContent>Hidden.</AccordionContent>
            </AccordionItem>
          </Accordion>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" className="w-fit" data-testid="focus-menu">
                Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Card interactive tabIndex={0} className="focus-ring">
            <CardHeader>
              <CardTitle>Interactive card</CardTitle>
            </CardHeader>
          </Card>
          <div className="flex h-32 flex-col rounded-md focus-ring">
            <DataTableShell
              head={<TableHead>Time</TableHead>}
              columnCount={1}
              isPending={false}
              isEmpty={false}
              empty="No entries."
              emptyTestId="focus-log-empty"
              loadingRowTestId="focus-log-loading"
              scrollTestId="focus-log-scroll"
              scrollLabel="Log"
            >
              {LOG_ROWS.map((row) => (
                <TableRow key={row.time}>
                  <TableCell>{row.time}</TableCell>
                </TableRow>
              ))}
            </DataTableShell>
          </div>
        </div>
      </div>
    </Section>
  );
}

export function ComponentsPage() {
  return (
    <>
      <Buttons />
      <Adds />
      <OperationStatus />
      <UploadAndTags />
      <Badges />
      <Fields />
      <Choices />
      <Sliders />
      <Structure />
      <ReadTable />
      <FileFactsRow />
      <CropRow />
      <EditorHeaderRow />
      <Section id="canvas" title="CanvasOverlay · CanvasZoom">
        <CanvasRow />
        <CanvasEdgeRow />
      </Section>
      <Section id="canvas-editor" title="DrawerRail · PropertyPanel">
        <CanvasEditorRow />
      </Section>
      <FocusRing />
    </>
  );
}
