import { en, type SuiteStrings } from "./en.js";
import { SUITE_NAMESPACE, type SuiteI18n } from "./types.js";

/**
 * The slice of an i18next instance the lazy path needs on top of `SuiteI18n`: the active language
 * and the language switch it waits on. Structural, like `SuiteI18n`.
 */
export interface SuiteLazyI18n extends SuiteI18n {
  language?: string;
  changeLanguage(lng?: string, ...rest: unknown[]): Promise<unknown>;
}

// Each language besides English is its own module, so the app's bundler cuts it into its own chunk.
const LOADERS: Record<string, () => Promise<SuiteStrings>> = {
  de: () => import("./de.js").then((module) => module.de),
  es: () => import("./es.js").then((module) => module.es),
};

/**
 * Adds the `suite` namespace to the app's i18next language by language (`SUI-DESIGN-011`): English
 * at once, where the app's fallback chain ends; the active language and every later one by dynamic
 * import, always before i18next switches to it, so no component shows English first or a loading
 * state. Call once in the i18n setup, after `init`; the promise settles once the active language is
 * in. A regional code (`de-CH`) loads its base language.
 */
export function registerSuiteStringsLazy(i18n: SuiteLazyI18n): Promise<void> {
  i18n.addResourceBundle("en", SUITE_NAMESPACE, en, true, true);
  const loading = new Map<string, Promise<void>>();
  const load = (lng: string | undefined): Promise<void> => {
    const base = lng?.split("-")[0] ?? "";
    const loader = LOADERS[base];
    if (loader === undefined) return Promise.resolve();
    let pending = loading.get(base);
    if (pending === undefined) {
      pending = loader().then((resources) => {
        i18n.addResourceBundle(base, SUITE_NAMESPACE, resources, true, true);
      });
      loading.set(base, pending);
    }
    return pending;
  };
  const changeLanguage = i18n.changeLanguage.bind(i18n);
  i18n.changeLanguage = async (lng?: string, ...rest: unknown[]) => {
    await load(lng);
    return changeLanguage(lng, ...rest);
  };
  return load(i18n.language);
}
