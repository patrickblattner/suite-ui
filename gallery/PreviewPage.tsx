import { ArchiveIcon, CopyIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MemoryRouter } from "react-router-dom";

import { RowActions, type RowActionSet } from "../src/list/row-actions.js";
import { ConfirmDialog } from "../src/ui/confirm-dialog.js";
import { PreviewFrame } from "../src/ui/preview-frame.js";
import { type PreviewDevice, PreviewToolbar } from "../src/ui/preview-toolbar.js";
import { Table, TableBody, TableCell, TableRow } from "../src/ui/table.js";
import { toast, Toaster } from "../src/ui/toaster.js";
import { UsageTable } from "../src/ui/usage-table.js";
import { Section } from "./ComponentsPage.js";

// App-side labels: the zoom readout, the selected entry and its extra action come from the app; the
// status picks a package state.
const LABELS = {
  en: {
    zoom: "Zoom 100 %",
    entry: "Home",
    duplicate: "Duplicate",
    more: "More for Home",
    export: "Export",
    archive: "Archive",
    archiveTitle: "Archive Home?",
    archiveText: "The page leaves the site; it stays in the archive.",
    archiveHint: "Restore it from the archive at any time.",
    discard: "Discard draft",
    archived: "Home archived.",
    restored: "Home restored.",
    post: "Post",
    page: "Page",
    news: "Spring newsletter",
    landing: "Landing page",
    duplicateHint: "Adds a copy of this page.",
    exportHint: "Unlocks once the page is published.",
  },
  de: {
    zoom: "Zoom 100 %",
    entry: "Startseite",
    duplicate: "Duplizieren",
    more: "Mehr zu Startseite",
    export: "Exportieren",
    archive: "Archivieren",
    archiveTitle: "Startseite archivieren?",
    archiveText: "Die Seite verlässt die Website; sie bleibt im Archiv.",
    archiveHint: "Jederzeit aus dem Archiv wiederherstellbar.",
    discard: "Entwurf verwerfen",
    archived: "Startseite archiviert.",
    restored: "Startseite wiederhergestellt.",
    post: "Beitrag",
    page: "Seite",
    news: "Frühlings-Newsletter",
    landing: "Startseite Kampagne",
    duplicateHint: "Legt eine Kopie dieser Seite an.",
    exportHint: "Wird frei, sobald die Seite veröffentlicht ist.",
  },
  es: {
    zoom: "Zoom 100 %",
    entry: "Inicio",
    duplicate: "Duplicar",
    more: "Más sobre Inicio",
    export: "Exportar",
    archive: "Archivar",
    archiveTitle: "¿Archivar Inicio?",
    archiveText: "La página sale del sitio; queda en el archivo.",
    archiveHint: "Restáurala desde el archivo cuando quieras.",
    discard: "Descartar borrador",
    archived: "Inicio archivado.",
    restored: "Inicio restaurado.",
    post: "Entrada",
    page: "Página",
    news: "Boletín de primavera",
    landing: "Página de campaña",
    duplicateHint: "Crea una copia de esta página.",
    exportHint: "Se habilita cuando la página esté publicada.",
  },
} as const;

const CONTENT_LANGUAGES = ["de", "en", "es"] as const;

// The column widths the narrow toolbar is shown at (`SUI-FEATURE-067` AC 5).
// `max-w-full` keeps them inside a narrow viewport.
const NARROW = {
  420: "w-[420px] max-w-full",
  600: "w-[600px] max-w-full",
  900: "w-[900px] max-w-full",
} as const;

// One preview toolbar, with its own language and device state.
function Toolbar({
  languages,
  status = true,
  device = true,
  zoom = false,
  selected = true,
  width = "max-w-3xl",
}: {
  languages: readonly (typeof CONTENT_LANGUAGES)[number][];
  status?: boolean;
  device?: boolean;
  zoom?: boolean;
  selected?: boolean;
  width?: string;
}) {
  const { t, i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [language, setLanguage] = useState<string>(languages[0] ?? "de");
  const [view, setView] = useState<PreviewDevice>("desktop");
  const [maximized, setMaximized] = useState(false);
  return (
    <div className={`mb-4 rounded-md border p-2 ${width}`}>
      <PreviewToolbar
        language={{
          value: language,
          options: languages.map((lng) => ({ value: lng, label: t(`language.${lng}`) })),
          onChange: setLanguage,
        }}
        status={status ? (language === "es" ? "draft" : "published") : undefined}
        device={device ? { value: view, onChange: setView } : undefined}
        maximize={{ value: maximized, onChange: setMaximized }}
        onClose={() => {}}
        actions={
          selected
            ? {
                rowName: labels.entry,
                extra: [{ label: labels.duplicate, icon: CopyIcon, onClick: () => {} }],
                onEdit: () => {},
                onDelete: () => {},
              }
            : undefined
        }
      >
        {zoom ? <span className="text-sm text-muted-foreground">{labels.zoom}</span> : null}
      </PreviewToolbar>
    </div>
  );
}

// `SUI-FEATURE-066`: a row with edit and an overflow menu, and the preview header of the same row
// showing the same group. The menu holds a plain, a locked, a reversible and a destructive entry; the plain and the
// locked one carry a hint (`SUI-FEATURE-066` rev 3). Archive is reversible (`GL-UI-070`): a plain entry
// with its own icon, never red; it asks first in a `ConfirmDialog` whose hint names the undo, and its
// toast offers Undo. On close the focus returns to the ⋯ it was chosen from (`GL-UI-050`).
function RowWithMenu() {
  const { t, i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [archiving, setArchiving] = useState(false);
  const archive = () => {
    setArchiving(false);
    toast.success(labels.archived, {
      action: { label: t("editor.undo"), onClick: () => toast.success(labels.restored) },
    });
  };
  const actions: RowActionSet = {
    rowName: labels.entry,
    onEdit: () => {},
    menu: {
      label: labels.more,
      items: [
        { label: labels.duplicate, onSelect: () => {}, hint: labels.duplicateHint },
        { label: labels.export, onSelect: () => {}, disabled: true, hint: labels.exportHint },
        {
          label: labels.archive,
          icon: <ArchiveIcon aria-hidden="true" />,
          onSelect: () => setArchiving(true),
        },
        // A loss is red and stands last, after a separator.
        {
          label: labels.discard,
          icon: <XIcon aria-hidden="true" />,
          onSelect: () => {},
          destructive: true,
        },
      ],
    },
  };
  return (
    <div className="mb-4 max-w-3xl rounded-md border p-2" data-testid="preview-row-menu">
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>{labels.entry}</TableCell>
            <RowActions {...actions} data-testid="row-menu-actions" />
          </TableRow>
        </TableBody>
      </Table>
      <div className="mt-2">
        <PreviewToolbar actions={actions} onClose={() => {}} />
      </div>
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        onConfirm={archive}
        title={labels.archiveTitle}
        description={labels.archiveText}
        confirmLabel={labels.archive}
        confirmHint={labels.archiveHint}
        data-testid="archive-confirm"
      />
    </div>
  );
}

// An app's page as the preview content: three 360 px cards that stand in one row only at desktop
// width, so a reflowed page would show at once.
function SamplePage() {
  return (
    <div className="flex flex-wrap gap-4 bg-muted p-6" data-testid="sample-page">
      {["One", "Two", "Three"].map((name) => (
        <div
          key={name}
          className="h-24 w-[360px] rounded-md border bg-background p-4"
          data-testid="sample-card"
        >
          {name}
        </div>
      ))}
    </div>
  );
}

// `GL-UI-008` §Gerät heißt Gerät: a frame in a narrow column, with its toolbar driving device and
// maximize.
function Frame({ initial }: { initial: PreviewDevice }) {
  const [device, setDevice] = useState<PreviewDevice>(initial);
  const [maximized, setMaximized] = useState(false);
  return (
    // A transformed ancestor, as an animated column would be: maximized, the frame still covers the
    // whole content area.
    <div
      className="w-[480px] max-w-full [transform:translateZ(0)] rounded-md border p-2"
      data-testid={`frame-${initial}`}
    >
      <PreviewFrame
        device={device}
        maximized={maximized}
        toolbar={
          <PreviewToolbar
            device={{ value: device, onChange: setDevice }}
            maximize={{ value: maximized, onChange: setMaximized }}
            onClose={() => {}}
          />
        }
        data-testid={`preview-frame-${initial}`}
      >
        <SamplePage />
      </PreviewFrame>
    </div>
  );
}

// `SUI-FEATURE-004`: a preview whose toolbar carries "Used by"; on, the usages take the preview's place.
function UsageFrame({ initial }: { initial: boolean }) {
  const { i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [usage, setUsage] = useState(initial);
  return (
    <div
      className="w-[480px] max-w-full rounded-md border p-2"
      data-testid={`usage-frame-${initial ? "on" : "off"}`}
    >
      <MemoryRouter>
        <PreviewFrame
          device="desktop"
          usage={{
            active: usage,
            onClose: () => setUsage(false),
            content: (
              <UsageTable
                items={[
                  {
                    id: "1",
                    title: labels.news,
                    type: labels.post,
                    status: "published",
                    href: "/",
                  },
                  { id: "2", title: labels.landing, type: labels.page, status: "draft", href: "/" },
                ]}
              />
            ),
          }}
          toolbar={
            <PreviewToolbar
              actions={{
                rowName: labels.entry,
                usage: { count: 2, active: usage, onToggle: () => setUsage(!usage) },
                onEdit: () => {},
              }}
              onClose={() => {}}
            />
          }
          data-testid={`preview-frame-usage-${initial ? "on" : "off"}`}
        >
          <SamplePage />
        </PreviewFrame>
      </MemoryRouter>
    </div>
  );
}

// `GL-UI-008`: the preview toolbar full, with a single language, without status, without device and
// without a selected entry.
export function PreviewPage({ theme }: { theme: "light" | "dark" }) {
  return (
    <Section id="preview-toolbar" title="PreviewToolbar">
      <div data-testid="preview-full">
        <Toolbar languages={CONTENT_LANGUAGES} zoom />
      </div>
      <div data-testid="preview-single-language">
        <Toolbar languages={["de"]} />
      </div>
      <div data-testid="preview-no-status">
        <Toolbar languages={CONTENT_LANGUAGES} status={false} />
      </div>
      <div data-testid="preview-no-device">
        <Toolbar languages={CONTENT_LANGUAGES} device={false} />
      </div>
      <div data-testid="preview-no-selection">
        <Toolbar languages={CONTENT_LANGUAGES} selected={false} />
      </div>
      <RowWithMenu />
      {/* `SUI-FEATURE-067`: the full toolbar in a narrow column, a medium one and a wide one. */}
      <h3 className="mt-6 mb-2 text-sm font-medium">PreviewToolbar 420 · 600 · 900 px</h3>
      {([420, 600, 900] as const).map((width) => (
        <div key={width} data-testid={`preview-narrow-${width}`}>
          <Toolbar languages={CONTENT_LANGUAGES} width={NARROW[width]} />
        </div>
      ))}
      <h3 className="mt-6 mb-2 text-sm font-medium">PreviewFrame</h3>
      <div className="flex flex-wrap items-start gap-4">
        <Frame initial="desktop" />
        <Frame initial="mobile" />
      </div>
      <h3 className="mt-6 mb-2 text-sm font-medium">PreviewFrame · Used by</h3>
      <div className="flex flex-wrap items-start gap-4">
        <UsageFrame initial={false} />
        <UsageFrame initial />
      </div>
      <Toaster theme={theme} />
    </Section>
  );
}
