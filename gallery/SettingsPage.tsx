import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageScroll } from "../src/list/page-scroll.js";
import { SettingsScaffold } from "../src/settings/settings-scaffold.js";
import { Card, CardContent, CardHeader, CardTitle } from "../src/ui/card.js";
import { Input } from "../src/ui/input.js";
import { Label } from "../src/ui/label.js";
import { TabsContent, TabsList, TabsTrigger } from "../src/ui/tabs.js";

// App-side labels: page title, subtitle and field names come from the app, not from `suite`.
const LABELS = {
  en: {
    title: "General",
    subtitle: "Basic data of this instance.",
    field: "Field",
    status: "Status",
    tabs: ["Provider", "Areas", "Prompts"],
    error: "The settings could not be loaded.",
  },
  de: {
    title: "Allgemein",
    subtitle: "Grunddaten dieser Instanz.",
    field: "Feld",
    status: "Status",
    tabs: ["Anbieter", "Bereiche", "Prompts"],
    error: "Die Einstellungen konnten nicht geladen werden.",
  },
  es: {
    title: "General",
    subtitle: "Datos básicos de esta instancia.",
    field: "Campo",
    status: "Estado",
    tabs: ["Proveedor", "Áreas", "Prompts"],
    error: "No se pudieron cargar los ajustes.",
  },
} as const;

// Far more fields than fit at 1920×1080, so the body overflows and must scroll under a fixed footer.
const FIELDS = Array.from({ length: 24 }, (_, i) => `field-${i + 1}`);
const LOADED: Record<string, string> = Object.fromEntries(FIELDS.map((id, i) => [id, `${i + 1}`]));
// `?layout=tabs` shows the tabbed variant (`SUI-FEATURE-031`): three tabs over one full-width body,
// one form over all of them, the testids under a prefix, and Save locked while field 1 is empty. Every
// tab shows the same fields, so the body overflows in each and a change shows across the tabs.
const PARAMS = new URLSearchParams(window.location.search);
const TABBED = PARAMS.get("layout") === "tabs";
// `?layout=body` shows the single full-width column (`SUI-FEATURE-041`): the fields in one Card, the
// status in a second one after it. `&state=loading|error` shows the body's loading or error state.
const COLUMN = PARAMS.get("layout") === "body";
const STATE = PARAMS.get("state");
const TAB_KEYS = ["provider", "areas", "prompts"] as const;
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
  const field = (id: string, i: number) => (
    <div key={id} className="flex flex-col gap-2">
      <Label htmlFor={id}>{`${labels.field} ${i + 1}`}</Label>
      <Input
        id={id}
        data-testid={`settings-${id}`}
        value={form[id]}
        onChange={(event) => setForm((f) => ({ ...f, [id]: event.target.value }))}
      />
    </div>
  );
  const formProps = {
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
  };

  if (COLUMN) {
    return (
      <PageScroll>
        <SettingsScaffold
          pageKey="general"
          title={labels.title}
          subtitle={labels.subtitle}
          loading={STATE === "loading"}
          error={STATE === "error" ? labels.error : undefined}
          body={
            <>
              <Card data-testid="settings-card">
                <CardHeader>
                  <CardTitle>{labels.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">{FIELDS.map(field)}</CardContent>
              </Card>
              <Card data-testid="settings-status">
                <CardContent>{labels.status}: OK</CardContent>
              </Card>
            </>
          }
          form={formProps}
        />
      </PageScroll>
    );
  }

  if (TABBED) {
    return (
      <PageScroll>
        <SettingsScaffold
          pageKey="general"
          testIdPrefix="hauptmenue"
          scrollTestId="hauptmenue-scroll"
          title={labels.title}
          subtitle={labels.subtitle}
          tabs={{
            defaultValue: "provider",
            list: (
              <TabsList data-testid="hauptmenue-tabs">
                {TAB_KEYS.map((key, i) => (
                  <TabsTrigger key={key} value={key} data-testid={`hauptmenue-tab-${key}`}>
                    {labels.tabs[i]}
                  </TabsTrigger>
                ))}
              </TabsList>
            ),
            panels: TAB_KEYS.map((key) => (
              <TabsContent
                key={key}
                value={key}
                className="flex flex-col gap-4"
                data-testid={`hauptmenue-panel-${key}`}
              >
                {FIELDS.map(field)}
              </TabsContent>
            )),
          }}
          form={{ ...formProps, valid: form["field-1"] !== "" }}
        />
      </PageScroll>
    );
  }

  return (
    <PageScroll>
      <SettingsScaffold
        pageKey="general"
        title={labels.title}
        subtitle={labels.subtitle}
        left={FIELDS.map(field)}
        right={
          <div className="rounded-md border p-4 text-sm" data-testid="settings-status">
            {labels.status}: OK
          </div>
        }
        form={formProps}
      />
    </PageScroll>
  );
}
