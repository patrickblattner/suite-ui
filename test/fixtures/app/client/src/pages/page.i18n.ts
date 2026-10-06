import i18n from "@/i18n";

const TEXTS = {
  en: { back: "Back" },
  de: { back: "Zurueck" },
  es: { back: "Volver" },
} as const;

for (const [lng, texts] of Object.entries(TEXTS)) {
  i18n.addResourceBundle(lng, "translation", { page: texts }, true, false);
}
