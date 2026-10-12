// Shared by the eager and the lazy registration; its own module, so the lazy path imports no
// language besides English.
export const SUITE_NAMESPACE = "suite";

// The package's languages in menu order, as a constant: a module that only lists them (the user
// menu) never pulls in the strings of de and es.
export const SUITE_LANGUAGES = ["en", "de", "es"] as const;

export type SuiteLanguage = (typeof SUITE_LANGUAGES)[number];

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
