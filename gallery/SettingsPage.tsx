import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageScroll } from "../src/list/page-scroll.js";
import { SettingsScaffold } from "../src/settings/settings-scaffold.js";
import { Input } from "../src/ui/input.js";
import { Label } from "../src/ui/label.js";

// App-side labels: page title, subtitle and field names come from the app, not from `suite`.
const LABELS = {
  en: {
    title: "General",
    subtitle: "Basic data of this instance.",
    field: "Field",
    status: "Status",
  },
  de: {
    title: "Allgemein",
    subtitle: "Grunddaten dieser Instanz.",
    field: "Feld",
    status: "Status",
  },
  es: {
    title: "General",
    subtitle: "Datos básicos de esta instancia.",
    field: "Campo",
    status: "Estado",
  },
} as const;

// Far more fields than fit at 1920×1080, so the body overflows and must scroll under a fixed footer.
const FIELDS = Array.from({ length: 24 }, (_, i) => `field-${i + 1}`);
const LOADED: Record<string, string> = Object.fromEntries(FIELDS.map((id, i) => [id, `${i + 1}`]));
// Long enough for a check of the working state, short enough for the test to wait for its end.
const SAVE_MS = 1500;

// A settings page inside the same fixed full-height frame as the list page: PageScroll is the content
// area, the scaffold fills it, and only the form body scrolls.
export function SettingsPage() {
  const { i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [loaded, setLoaded] = useState(LOADED);
  const [form, setForm] = useState(LOADED);
  const [saving, setSaving] = useState(false);
  const dirty = FIELDS.some((id) => form[id] !== loaded[id]);

  return (
    <PageScroll>
      <SettingsScaffold
        pageKey="general"
        title={labels.title}
        subtitle={labels.subtitle}
        left={FIELDS.map((id, i) => (
          <div key={id} className="flex flex-col gap-2">
            <Label htmlFor={id}>{`${labels.field} ${i + 1}`}</Label>
            <Input
              id={id}
              data-testid={`settings-${id}`}
              value={form[id]}
              onChange={(event) => setForm((f) => ({ ...f, [id]: event.target.value }))}
            />
          </div>
        ))}
        right={
          <div className="rounded-md border p-4 text-sm" data-testid="settings-status">
            {labels.status}: OK
          </div>
        }
        form={{
          dirty,
          saving,
          onReset: () => setForm(loaded),
          onSave: () => {
            setSaving(true);
            window.setTimeout(() => {
              setLoaded(form);
              setSaving(false);
            }, SAVE_MS);
          },
        }}
      />
    </PageScroll>
  );
}
