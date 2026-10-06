import { readFileSync } from "node:fs";

import { suiteStrings, type SuiteLanguage } from "../strings/index.js";

export const APPS = ["cockpit", "community"] as const;
export type App = (typeof APPS)[number];

/**
 * One shared element: its canonical `suite` key and, per app, the key in the app's own
 * `translation` namespace that still carries the text. `pending` only reports a deviation,
 * `aligned` fails on it. An app key leaves the map once the element moved into the package.
 */
export interface ParityElement {
  // The shared building block the key belongs to (FilterBar, TablePagination, …).
  element?: string;
  suite: string;
  status: "pending" | "aligned";
  cockpit?: string;
  community?: string;
}

export interface ParityMap {
  elements: ParityElement[];
}

// Read at runtime from the package root: `src/parity/` and `dist/parity/` sit at the same depth.
export const parityMap = JSON.parse(
  readFileSync(new URL("../../parity-map.json", import.meta.url), "utf8"),
) as ParityMap;

/** The app's texts per language, as nested resource trees of its `translation` namespace. */
export type AppStrings = Record<SuiteLanguage, object>;

export interface Deviation {
  lng: SuiteLanguage;
  key: string;
  appText: string | undefined;
  canonical: string | undefined;
  status: ParityElement["status"];
}

export interface ParityResult {
  app: App;
  elements: ParityElement[];
  deviations: Deviation[];
}

export function lookup(tree: object, key: string): string | undefined {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function checkParity(app: App, appStrings: AppStrings, parity = parityMap): ParityResult {
  const elements = parity.elements.filter((element) => element[app] !== undefined);
  const deviations: Deviation[] = [];
  for (const element of elements) {
    const key = element[app] as string;
    for (const lng of Object.keys(suiteStrings) as SuiteLanguage[]) {
      const appText = lookup(appStrings[lng], key);
      const canonical = lookup(suiteStrings[lng], element.suite);
      if (appText === undefined || appText !== canonical) {
        deviations.push({ lng, key, appText, canonical, status: element.status });
      }
    }
  }
  return { app, elements, deviations };
}

export function formatDeviation(d: Deviation): string {
  return `${d.lng} ${d.key} ${d.appText ?? "<missing>"} ≠ ${d.canonical ?? "<missing>"}`;
}

/** Exit code of the command: 1 when an `aligned` element deviates, unless in report mode. */
export function exitCode(result: ParityResult, reportOnly: boolean): 0 | 1 {
  if (reportOnly) return 0;
  return result.deviations.some((d) => d.status === "aligned") ? 1 : 0;
}
