import { de } from "./de.js";
import { en, type SuiteStrings } from "./en.js";
import { es } from "./es.js";
import { SUITE_NAMESPACE, type SuiteI18n, type SuiteLanguage } from "./types.js";

export type { SuiteStrings };
export { SUITE_LANGUAGES, SUITE_NAMESPACE, type SuiteI18n, type SuiteLanguage } from "./types.js";
export { registerSuiteStringsLazy, type SuiteLazyI18n } from "./lazy.js";

export const suiteStrings = { en, de, es } as const satisfies Record<SuiteLanguage, SuiteStrings>;

/**
 * Adds the `suite` namespace in en, de and es to the app's i18next at once: the synchronous path for
 * tests and the gallery. Apps use `registerSuiteStringsLazy`. Call once in the i18n setup.
 */
export function registerSuiteStrings(i18n: SuiteI18n): void {
  for (const [lng, resources] of Object.entries(suiteStrings)) {
    i18n.addResourceBundle(lng, SUITE_NAMESPACE, resources, true, true);
  }
}
