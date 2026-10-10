import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageScroll } from "../src/list/page-scroll.js";
import { SecretCardHeader } from "../src/settings/secret-card-header.js";
import { SettingsActionRow } from "../src/settings/settings-action-row.js";
import { SettingsBlock } from "../src/settings/settings-block.js";
import { SettingsField } from "../src/settings/settings-field.js";
import { SettingsScaffold } from "../src/settings/settings-scaffold.js";
import { SettingsSection } from "../src/settings/settings-section.js";
import { SettingsToggleField } from "../src/settings/settings-toggle-field.js";
import { Badge } from "../src/ui/badge.js";
import { Button } from "../src/ui/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "../src/ui/card.js";
import { Checkbox } from "../src/ui/checkbox.js";
import { Input } from "../src/ui/input.js";
import { Label } from "../src/ui/label.js";
import { RadioGroup, RadioGroupItem } from "../src/ui/radio-group.js";
import { Switch } from "../src/ui/switch.js";
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
// `?layout=fields` shows SettingsSection and SettingsField in the column (`SUI-FEATURE-042`): a section
// with an action, a text field with hint and help, a short field, a RadioGroup and a checkbox group,
// then a Checkbox and a Switch each in a SettingsToggleField (`SUI-FEATURE-058`), and a RadioGroup
// outside any field after the section.
const FIELD_LAYOUT = PARAMS.get("layout") === "fields";
// `?layout=blocks` shows a SettingsBlock with a full SecretCardHeader as its aside, Remove locked with a
// reason, and a SettingsActionRow at its foot, after one field of the page form (`SUI-FEATURE-043`).
const BLOCK_LAYOUT = PARAMS.get("layout") === "blocks";
const OPTIONS = ["a", "b", "c"] as const;
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

  if (BLOCK_LAYOUT) {
    return (
      <PageScroll>
        <SettingsScaffold
          pageKey="general"
          title={labels.title}
          subtitle={labels.subtitle}
          body={
            <>
              {field("field-1", 0)}
              <SecretBlock labels={labels} />
            </>
          }
          form={formProps}
        />
      </PageScroll>
    );
  }

  if (FIELD_LAYOUT) {
    const options = (prefix: string) =>
      OPTIONS.map((value, i) => (
        <div key={value} className="flex items-center gap-2" data-testid={`${prefix}-${value}`}>
          <RadioGroupItem id={`${prefix}-${value}`} value={value} />
          <Label htmlFor={`${prefix}-${value}`}>{`${labels.field} ${i + 1}`}</Label>
        </div>
      ));
    return (
      <PageScroll>
        <SettingsScaffold
          pageKey="general"
          title={labels.title}
          subtitle={labels.subtitle}
          body={
            <>
              <SettingsSection
                title={labels.title}
                description={labels.subtitle}
                action={
                  <Button variant="outline" size="sm" type="button" data-testid="section-action">
                    {labels.status}
                  </Button>
                }
              >
                <SettingsField
                  label={`${labels.field} 1`}
                  htmlFor="field-1"
                  hint={labels.status}
                  help={labels.subtitle}
                >
                  <Input
                    id="field-1"
                    data-testid="settings-field-1"
                    value={form["field-1"]}
                    onChange={(event) => setForm((f) => ({ ...f, "field-1": event.target.value }))}
                  />
                </SettingsField>
                <SettingsField label={`${labels.field} 2`} htmlFor="field-2" size="short">
                  <Input
                    id="field-2"
                    data-testid="settings-field-2"
                    value={form["field-2"]}
                    onChange={(event) => setForm((f) => ({ ...f, "field-2": event.target.value }))}
                  />
                </SettingsField>
                <SettingsField label={`${labels.field} 3`} htmlFor="field-3" group>
                  <RadioGroup defaultValue="a">{options("field-3")}</RadioGroup>
                </SettingsField>
                <SettingsField label={`${labels.field} 4`} htmlFor="field-4" group>
                  {OPTIONS.map((value, i) => (
                    <div
                      key={value}
                      className="flex items-center gap-2"
                      data-testid={`field-4-${value}`}
                    >
                      <Checkbox id={`field-4-${value}`} />
                      <Label htmlFor={`field-4-${value}`}>{`${labels.field} ${i + 1}`}</Label>
                    </div>
                  ))}
                </SettingsField>
                <SettingsToggleField
                  label={`${labels.field} 5`}
                  htmlFor="field-5"
                  hint={labels.status}
                  help={labels.subtitle}
                >
                  <Checkbox
                    id="field-5"
                    data-testid="settings-field-5"
                    aria-describedby="field-5-help field-5-description"
                  />
                </SettingsToggleField>
                <SettingsToggleField
                  label={`${labels.field} 6`}
                  htmlFor="field-6"
                  help={labels.subtitle}
                >
                  <Switch
                    id="field-6"
                    data-testid="settings-field-6"
                    aria-describedby="field-6-description"
                  />
                </SettingsToggleField>
              </SettingsSection>
              <RadioGroup defaultValue="a" aria-label={labels.status}>
                {options("outside")}
              </RadioGroup>
            </>
          }
          form={formProps}
        />
      </PageScroll>
    );
  }

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

// One secret entry with its own Save and Reset; Active and Test act at once.
function SecretBlock({ labels }: { labels: (typeof LABELS)[keyof typeof LABELS] }) {
  const [active, setActive] = useState(true);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <SettingsBlock
      name={labels.field}
      purpose={labels.subtitle}
      aside={
        <SecretCardHeader
          testIdPrefix="secret"
          active={{ checked: active, onCheckedChange: setActive }}
          testChip={
            <Badge variant="outline" data-testid="secret-test-chip">
              {labels.status}
            </Badge>
          }
          stateChip={
            <Badge variant="outline" data-testid="secret-state-chip">
              OK
            </Badge>
          }
          replace={{ onReplace: () => {} }}
          remove={{ onRemove: () => {}, disabledText: labels.subtitle }}
          test={{ onTest: () => {} }}
        />
      }
    >
      <Input
        aria-label={labels.field}
        data-testid="secret-value"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <SettingsActionRow
        dirty={value !== ""}
        saving={saving}
        onSave={() => {
          setSaving(true);
          window.setTimeout(() => {
            setValue("");
            setSaving(false);
          }, SAVE_MS);
        }}
        onReset={() => setValue("")}
        testIdPrefix="secret"
      />
    </SettingsBlock>
  );
}
