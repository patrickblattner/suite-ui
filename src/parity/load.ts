import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

import { suiteStrings, type SuiteLanguage } from "../strings/index.js";
import type { App, AppStrings } from "./index.js";
import type { RecordedBundle } from "./i18n-stub.js";

/** Where each app keeps its language files, relative to its checkout root. */
const APP_SOURCES: Record<App, { src: string; locales: string }> = {
  cockpit: { src: "client/src", locales: "client/src/i18n/locales" },
  community: { src: "client/src", locales: "client/src/i18n/locales" },
};

const BUNDLE_SUFFIX = ".i18n.ts";

type Tree = Record<string, unknown>;

function isTree(value: unknown): value is Tree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDeep(target: Tree, source: Tree): Tree {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (isTree(existing) && isTree(value)) mergeDeep(existing, value);
    else target[key] = isTree(value) ? mergeDeep({}, value) : value;
  }
  return target;
}

function stubPath(): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const built = join(here, "i18n-stub.js");
  return existsSync(built) ? built : join(here, "i18n-stub.ts");
}

async function findBundles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true });
  return entries
    .filter(
      (entry) => entry.endsWith(BUNDLE_SUFFIX) && !entry.split(/[\\/]/).includes("node_modules"),
    )
    .sort()
    .map((entry) => join(dir, entry));
}

/**
 * Loads an app's texts in all three languages: the main locale file per language (its exported
 * resource tree) plus every lazily registered page bundle (`*.i18n.ts`) of the `translation`
 * namespace.
 */
export async function loadAppStrings(app: App, root: string): Promise<AppStrings> {
  const { src, locales } = APP_SOURCES[app];
  const srcDir = join(root, src);
  const localesDir = join(root, locales);
  if (!existsSync(localesDir)) throw new Error(`no locale directory at ${localesDir}`);

  const stub = stubPath();
  const jiti = createJiti(import.meta.url, {
    alias: { "@/i18n/locales": join(srcDir, "i18n/locales"), "@/i18n": stub, "@": srcDir },
  });

  const languages = Object.keys(suiteStrings) as SuiteLanguage[];
  const strings = Object.fromEntries(languages.map((lng) => [lng, {}])) as Record<
    SuiteLanguage,
    Tree
  >;

  for (const lng of languages) {
    const module = await jiti.import<Tree>(join(localesDir, `${lng}.ts`));
    const tree = Object.values(module).find(isTree);
    if (!tree) throw new Error(`${app}: ${lng}.ts exports no resource tree`);
    mergeDeep(strings[lng], tree);
  }

  const { recorded } = await jiti.import<{ recorded: RecordedBundle[] }>(stub);
  for (const bundle of await findBundles(srcDir)) await jiti.import(bundle);
  for (const { lng, ns, resources } of recorded) {
    if (ns === "translation" && lng in strings && isTree(resources)) {
      mergeDeep(strings[lng as SuiteLanguage], resources);
    }
  }

  return strings;
}
