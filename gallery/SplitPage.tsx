import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type SplitStop, SplitWorkspace } from "../src/list/split-workspace.js";
import { Section } from "./ComponentsPage.js";

// App-side labels: the entries and their preview come from the app.
const LABELS = {
  en: { rows: ["Home", "About", "Contact"], preview: "Preview of" },
  de: { rows: ["Startseite", "Über uns", "Kontakt"], preview: "Vorschau von" },
  es: { rows: ["Inicio", "Sobre nosotros", "Contacto"], preview: "Vista previa de" },
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
    </Section>
  );
}
