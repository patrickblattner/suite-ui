import { en, type SuiteStrings } from "./en.js";
import { SUITE_NAMESPACE, type SuiteI18n } from "./types.js";

/**
 * The slice of an i18next instance the lazy path needs on top of `SuiteI18n`: the active language,
 * the language switch it waits on, and the app's language detector for a switch without a language.
 * Structural, like `SuiteI18n`.
 */
export interface SuiteLazyI18n extends SuiteI18n {
  language?: string;
  changeLanguage(lng?: string, ...rest: unknown[]): Promise<unknown>;
  services?: { languageDetector?: { detect?(...args: unknown[]): unknown } };
}

// Each language besides English is its own module, so the app's bundler cuts it into its own chunk.
const LOADERS: Record<string, () => Promise<SuiteStrings>> = {
  de: () => import("./de.js").then((module) => module.de),
  es: () => import("./es.js").then((module) => module.es),
};

// The loader of a language code; a regional code (`de-CH`) loads its base language. Own keys only,
// so `constructor` or `__proto__` count as unknown codes.
function loaderFor(lng: string | undefined): [string, () => Promise<SuiteStrings>] | undefined {
  const base = lng?.split("-")[0] ?? "";
  return Object.hasOwn(LOADERS, base)
    ? [base, LOADERS[base] as () => Promise<SuiteStrings>]
    : undefined;
}

// The first code a synchronous detector reports, the language a switch without one will likely pick.
function detected(i18n: SuiteLazyI18n): string | undefined {
  const result = i18n.services?.languageDetector?.detect?.();
  const first: unknown = Array.isArray(result) ? result[0] : result;
  return typeof first === "string" ? first : undefined;
}

/**
 * Adds the `suite` namespace to the app's i18next language by language (`SUI-DESIGN-011`): English
 * at once, where the app's fallback chain ends; the active language and every later one by dynamic
 * import, always before i18next switches to it, so no component shows English first or a loading
 * state. Call once in the i18n setup, after `init`; the promise settles once the active language is
 * in and never rejects: a chunk that fails to load leaves English as the fallback, and the next switch
 * to that language tries again. Of switches that overlap while loading, the last one wins. A switch
 * without a language (the detector path) loads what the detector reports first, and whatever i18next
 * then settles on.
 */
export function registerSuiteStringsLazy(i18n: SuiteLazyI18n): Promise<void> {
  i18n.addResourceBundle("en", SUITE_NAMESPACE, en, true, true);
  const loaded = new Set<string>();
  const loading = new Map<string, Promise<void>>();
  const load = (lng: string | undefined): Promise<void> => {
    const entry = loaderFor(lng);
    if (entry === undefined) return Promise.resolve();
    const [base, loader] = entry;
    let pending = loading.get(base);
    if (pending === undefined) {
      pending = loader().then(
        (resources) => {
          i18n.addResourceBundle(base, SUITE_NAMESPACE, resources, true, true);
          loaded.add(base);
        },
        (error: unknown) => {
          loading.delete(base);
          throw error;
        },
      );
      loading.set(base, pending);
    }
    return pending;
  };
  // A failed chunk never blocks a switch: the suite strings then fall back to English.
  const tryLoad = (lng: string | undefined): Promise<void> => load(lng).catch(() => undefined);
  const isLoaded = (lng: string | undefined): boolean => {
    const entry = loaderFor(lng);
    return entry === undefined || loaded.has(entry[0]);
  };
  const changeLanguage = i18n.changeLanguage.bind(i18n);
  let latest = 0;
  i18n.changeLanguage = async (lng?: string, ...rest: unknown[]) => {
    const request = ++latest;
    await tryLoad(lng ?? detected(i18n));
    // A newer switch arrived while this one was loading: it decides the language.
    if (request !== latest) return undefined;
    const result = await changeLanguage(lng, ...rest);
    if (lng !== undefined || isLoaded(i18n.language)) return result;
    // The detector settled on a language not loaded yet: load it and switch again, so the suite
    // strings re-render in it.
    await tryLoad(i18n.language);
    if (request !== latest || !isLoaded(i18n.language)) return result;
    return changeLanguage(i18n.language);
  };
  return tryLoad(i18n.language);
}
