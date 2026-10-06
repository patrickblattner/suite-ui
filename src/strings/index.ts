import { de } from "./de.js";
import { en, type SuiteStrings } from "./en.js";
import { es } from "./es.js";

export type { SuiteStrings };

export const SUITE_NAMESPACE = "suite";

export const suiteStrings = { en, de, es } as const satisfies Record<string, SuiteStrings>;

export type SuiteLanguage = keyof typeof suiteStrings;

/**
 * The slice of an i18next instance this package needs. Structural on purpose, so any i18next
 * major the apps run (23 to 26) satisfies it without the package depending on i18next itself.
 */
export interface SuiteI18n {
  addResourceBundle(
    lng: string,
    ns: string,
    resources: object,
    deep?: boolean,
    overwrite?: boolean,
  ): unknown;
}

/** Adds the `suite` namespace in en, de and es to the app's i18next. Call once in the i18n setup. */
export function registerSuiteStrings(i18n: SuiteI18n): void {
  for (const [lng, resources] of Object.entries(suiteStrings)) {
    i18n.addResourceBundle(lng, SUITE_NAMESPACE, resources, true, true);
  }
}
