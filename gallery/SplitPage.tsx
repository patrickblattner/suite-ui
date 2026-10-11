import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTableShell } from "../src/list/data-table-shell.js";
import { RowActions, RowActionsHead } from "../src/list/row-actions.js";
import { type SplitStop, SplitWorkspace } from "../src/list/split-workspace.js";
import { PreviewFrame } from "../src/ui/preview-frame.js";
import { PreviewToolbar } from "../src/ui/preview-toolbar.js";
import { TableCell, TableHead, TableRow } from "../src/ui/table.js";
import { Section } from "./ComponentsPage.js";

// App-side labels: the entries and their preview come from the app.
const LABELS = {
  en: { rows: ["Home", "About", "Contact"], preview: "Preview of", page: "Page", note: "Note" },
  de: {
    rows: ["Startseite", "Über uns", "Kontakt"],
    preview: "Vorschau von",
    page: "Seite",
    note: "Notiz",
  },
  es: {
    rows: ["Inicio", "Sobre nosotros", "Contacto"],
    preview: "Vista previa de",
    page: "Página",
    note: "Nota",
  },
} as const;

// One surface: rows select an entry, the preview shows it, close (`Esc`) clears the selection.
function Workspace({
  id,
  defaultStop,
  selected: initial,
  minWidths = { list: 240, preview: 240 },
  width,
}: {
  id: string;
  defaultStop: SplitStop;
  selected: number | null;
  minWidths?: { list: number; preview: number };
  width?: string;
}) {
  const { i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [selected, setSelected] = useState<number | null>(initial);
  return (
    <div className={`mb-4 h-48 rounded-md border p-2 ${width ?? "max-w-3xl"}`}>
      <SplitWorkspace
        list={
          <ul className="flex flex-col gap-1 pr-2">
            {labels.rows.map((row, index) => (
              <li key={row}>
                <button
                  type="button"
                  aria-current={selected === index}
                  className="w-full rounded-sm px-2 py-1 text-left text-sm aria-[current=true]:bg-accent"
                  onClick={() => setSelected(index)}
                >
                  {row}
                </button>
              </li>
            ))}
          </ul>
        }
        preview={
          <div className="h-full rounded-sm bg-muted p-3 text-sm">
            {labels.preview} {selected === null ? "" : labels.rows[selected]}
          </div>
        }
        open={selected !== null}
        onClose={() => setSelected(null)}
        defaultStop={defaultStop}
        minWidths={minWidths}
        storageKey={`gallery:split:${id}`}
        data-testid={`split-${id}`}
      />
    </div>
  );
}

// A note long enough that the table overflows its column beside the preview.
const NOTE =
  "Rescheduled after the venue changed; attendees were notified by mail and the waitlist moved up.";

// `GL-UI-023` §Neben einer Vorschau nie fixiert: a list table with an actions column beside a
// preview; under `tableActions: "sticky"` it overflows, yet its actions column stays an ordinary last
// column.
function TableWorkspace() {
  const { i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [selected, setSelected] = useState<number | null>(0);
  const [maximized, setMaximized] = useState(false);
  return (
    <div className="mb-4 flex h-64 max-w-3xl flex-col rounded-md border p-2">
      <SplitWorkspace
        list={
          <div className="flex h-full min-h-0 flex-col">
            <DataTableShell
              head={
                <>
                  <TableHead>{labels.page}</TableHead>
                  <TableHead>{labels.note}</TableHead>
                  <RowActionsHead />
                </>
              }
              columnCount={3}
              isPending={false}
              isEmpty={false}
              empty=""
              loadingRowTestId="split-table-loading"
              emptyTestId="split-table-empty"
              scrollTestId="split-table-scroll"
            >
              {labels.rows.map((row, index) => (
                <TableRow
                  key={row}
                  data-grid-row=""
                  data-state={selected === index ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => setSelected(index)}
                >
                  <TableCell className="font-medium">{row}</TableCell>
                  <TableCell>{NOTE}</TableCell>
                  <RowActions
                    rowName={row}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    data-testid="split-table-actions"
                  />
                </TableRow>
              ))}
            </DataTableShell>
          </div>
        }
        preview={
          <PreviewFrame
            device="desktop"
            maximized={maximized}
            toolbar={
              <PreviewToolbar
                maximize={{ value: maximized, onChange: setMaximized }}
                actions={
                  selected === null
                    ? undefined
                    : { rowName: labels.rows[selected]!, onEdit: () => {}, onDelete: () => {} }
                }
                onClose={() => setSelected(null)}
              />
            }
            data-testid="split-table-frame"
          >
            <div className="h-64 bg-muted p-6 text-2xl">
              {labels.preview} {selected === null ? "" : labels.rows[selected]}
            </div>
          </PreviewFrame>
        }
        open={selected !== null}
        onClose={() => {
          setMaximized(false);
          setSelected(null);
        }}
        defaultStop="1/2"
        minWidths={{ list: 240, preview: 240 }}
        storageKey="gallery:split:table"
        data-testid="split-table"
      />
    </div>
  );
}

// `GL-UI-009`: without a selection, open at 2/5 and at 3/5, and the single column of a surface too
// narrow for both min widths.
export function SplitPage() {
  return (
    <Section id="split-workspace" title="SplitWorkspace">
      <Workspace id="closed" defaultStop="2/5" selected={null} />
      <Workspace id="two-fifths" defaultStop="2/5" selected={0} />
      <Workspace id="three-fifths" defaultStop="3/5" selected={1} />
      <Workspace
        id="single"
        defaultStop="1/2"
        selected={2}
        minWidths={{ list: 320, preview: 320 }}
        width="w-[480px]"
      />
      <TableWorkspace />
    </Section>
  );
}
