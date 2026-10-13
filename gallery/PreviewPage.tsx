import { CopyIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { RowActions, type RowActionSet } from "../src/list/row-actions.js";
import { PreviewFrame } from "../src/ui/preview-frame.js";
import { type PreviewDevice, PreviewToolbar } from "../src/ui/preview-toolbar.js";
import { Table, TableBody, TableCell, TableRow } from "../src/ui/table.js";
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
  },
  de: {
    zoom: "Zoom 100 %",
    entry: "Startseite",
    duplicate: "Duplizieren",
    more: "Mehr zu Startseite",
    export: "Exportieren",
    archive: "Archivieren",
  },
  es: {
    zoom: "Zoom 100 %",
    entry: "Inicio",
    duplicate: "Duplicar",
    more: "Más sobre Inicio",
    export: "Exportar",
    archive: "Archivar",
  },
} as const;

const CONTENT_LANGUAGES = ["de", "en", "es"] as const;

// One preview toolbar, with its own language and device state.
function Toolbar({
  languages,
  status = true,
  device = true,
  zoom = false,
  selected = true,
}: {
  languages: readonly (typeof CONTENT_LANGUAGES)[number][];
  status?: boolean;
  device?: boolean;
  zoom?: boolean;
  selected?: boolean;
}) {
  const { t, i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [language, setLanguage] = useState<string>(languages[0] ?? "de");
  const [view, setView] = useState<PreviewDevice>("desktop");
  const [maximized, setMaximized] = useState(false);
  return (
    <div className="mb-4 max-w-3xl rounded-md border p-2">
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
// showing the same group. The menu holds a plain, a locked and a destructive entry.
function RowWithMenu() {
  const { i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const actions: RowActionSet = {
    rowName: labels.entry,
    onEdit: () => {},
    menu: {
      label: labels.more,
      items: [
        { label: labels.duplicate, onSelect: () => {} },
        { label: labels.export, onSelect: () => {}, disabled: true },
        { label: labels.archive, onSelect: () => {}, destructive: true },
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
      className="w-[480px] [transform:translateZ(0)] rounded-md border p-2"
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

// `GL-UI-008`: the preview toolbar full, with a single language, without status, without device and
// without a selected entry.
export function PreviewPage() {
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
      <h3 className="mt-6 mb-2 text-sm font-medium">PreviewFrame</h3>
      <div className="flex flex-wrap items-start gap-4">
        <Frame initial="desktop" />
        <Frame initial="mobile" />
      </div>
    </Section>
  );
}
