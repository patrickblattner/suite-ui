// Stands in for an app's `@/i18n` module while the parity command loads lazily registered page
// bundles: it records every `addResourceBundle` call instead of touching a real i18next.
export interface RecordedBundle {
  lng: string;
  ns: string;
  resources: object;
}

export const recorded: RecordedBundle[] = [];

const i18n = {
  addResourceBundle(lng: string, ns: string, resources: object) {
    recorded.push({ lng, ns, resources });
    return i18n;
  },
};

export default i18n;
