import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type PreviewDevice, PreviewToolbar } from "../src/ui/preview-toolbar.js";
import { Section } from "./ComponentsPage.js";

// App-side data: the publication status of each content language comes from the app.
const LABELS = {
  en: { published: "Published", draft: "Draft", zoom: "Zoom 100 %" },
  de: { published: "Veröffentlicht", draft: "Entwurf", zoom: "Zoom 100 %" },
  es: { published: "Publicado", draft: "Borrador", zoom: "Zoom 100 %" },
} as const;

const CONTENT_LANGUAGES = ["de", "en", "es"] as const;

// One preview toolbar, with its own language and device state.
function Toolbar({
  languages,
  status = true,
  device = true,
  zoom = false,
}: {
  languages: readonly (typeof CONTENT_LANGUAGES)[number][];
  status?: boolean;
  device?: boolean;
  zoom?: boolean;
}) {
  const { t, i18n } = useTranslation("suite");
  const labels = LABELS[i18n.language as keyof typeof LABELS] ?? LABELS.en;
  const [language, setLanguage] = useState<string>(languages[0] ?? "de");
  const [view, setView] = useState<PreviewDevice>("desktop");
  return (
    <div className="mb-4 max-w-3xl rounded-md border p-2">
      <PreviewToolbar
        language={{
          value: language,
          options: languages.map((lng) => ({ value: lng, label: t(`language.${lng}`) })),
          onChange: setLanguage,
        }}
        status={
          status
            ? language === "es"
              ? { state: "notSet", label: labels.draft }
              : { state: "active", label: labels.published }
            : undefined
        }
        device={device ? { value: view, onChange: setView } : undefined}
      >
        {zoom ? <span className="text-sm text-muted-foreground">{labels.zoom}</span> : null}
      </PreviewToolbar>
    </div>
  );
}

// `GL-UI-008`: the preview toolbar full, with a single language, without status and without device.
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
    </Section>
  );
}
