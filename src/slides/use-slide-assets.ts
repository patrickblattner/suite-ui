// The fonts and icons a slide needs before it is drawn (`SUI-FEATURE-160` §Schriften). Fonts come only
// from files the app supplies: the page's own origin, a `blob:` URL or an origin the app passes (its
// media store), never a third party's network. Icons come from the package's icon library (lucide), one module per icon.

import type { LucideIcon } from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import * as React from "react";

import { isSlideFontFamily } from "./schema.js";

// One font file the app supplies for a family (one weight and style each).
export interface SlideFontFile {
  family: string;
  // A same-origin URL or a `blob:` URL of the file.
  src: string;
  weight?: number | string;
  style?: "normal" | "italic";
}

// Each file loads once per page, whichever views ask for it.
const fontLoads = new Map<string, Promise<boolean>>();

// The origin of an http(s) URL; an opaque one (`data:`, `file:`, a bare host) is none.
function originOf(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function allowedUrl(src: string, origins: readonly string[]): URL | undefined {
  try {
    const url = new URL(src, window.location.href);
    const allowed =
      url.protocol === "blob:" ||
      url.origin === window.location.origin ||
      origins.some((origin) => originOf(origin) === url.origin);
    return allowed ? url : undefined;
  } catch {
    return undefined;
  }
}

function loadFont(file: SlideFontFile, origins: readonly string[]): Promise<boolean> {
  const url = allowedUrl(file.src, origins);
  if (url === undefined) return Promise.resolve(false);
  const key = JSON.stringify([file.family, url.href, file.weight, file.style]);
  let load = fontLoads.get(key);
  if (load !== undefined) return load;
  if (!isSlideFontFamily(file.family) || file.family.includes(",")) {
    load = Promise.resolve(false);
  } else if (typeof FontFace === "undefined") {
    // No font loading in this environment (a test without layout): the file counts as there.
    load = Promise.resolve(true);
  } else {
    // The bytes, not a CSS `url()`: no string of the app is ever written into CSS.
    // A redirect could leave the allowed origins, so it fails the load.
    load = fetch(url.href, { redirect: "error" })
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error())))
      .then((bytes) =>
        new FontFace(file.family, bytes, {
          weight: file.weight === undefined ? "normal" : String(file.weight),
          style: file.style ?? "normal",
        }).load(),
      )
      .then((face) => {
        document.fonts.add(face);
        return true;
      })
      .catch(() => false);
  }
  fontLoads.set(key, load);
  return load;
}

// Loads `files` and tells which of the `needed` families have none that loaded; a file from an origin
// that is neither the page's, `blob:` nor one of `origins` does not load. Not `ready` until every file
// has settled.
export function useSlideFonts(
  files: readonly SlideFontFile[],
  needed: readonly string[],
  origins: readonly string[] = [],
): { ready: boolean; missing: string[] } {
  const key = JSON.stringify([files, origins]);
  const [loaded, setLoaded] = React.useState<{ key: string; families: Set<string> } | null>(null);
  React.useEffect(() => {
    let live = true;
    const [list, allowed] = JSON.parse(key) as [SlideFontFile[], string[]];
    void Promise.all(
      list.map((file) =>
        loadFont(file, allowed).then((ok) => (ok ? file.family.toLowerCase() : null)),
      ),
    ).then((families) => {
      if (live) setLoaded({ key, families: new Set(families.filter((name) => name !== null)) });
    });
    return () => {
      live = false;
    };
  }, [key]);
  if (loaded?.key !== key) return { ready: false, missing: [] };
  return {
    ready: true,
    missing: needed.filter((name) => !loaded.families.has(name.toLowerCase())),
  };
}

const iconLoads = new Map<string, Promise<LucideIcon | undefined>>();
const iconImports = dynamicIconImports as unknown as Record<
  string,
  () => Promise<{ default: LucideIcon }>
>;

// Whether the library has an icon of that name.
export function isSlideIcon(name: string): boolean {
  return Object.hasOwn(iconImports, name);
}

// A failed import is not kept, so the next view tries again.
function loadIcon(name: string): Promise<LucideIcon | undefined> {
  let load = iconLoads.get(name);
  if (load === undefined) {
    load = isSlideIcon(name)
      ? iconImports[name]!().then(
          (module) => module.default,
          () => {
            iconLoads.delete(name);
            return undefined;
          },
        )
      : Promise.resolve(undefined);
    iconLoads.set(name, load);
  }
  return load;
}

// The icons of `names` once all have loaded; a name the library lacks, or whose import failed, stays
// out of `icons`.
export function useSlideIcons(names: readonly string[]): {
  ready: boolean;
  icons: ReadonlyMap<string, LucideIcon>;
} {
  const key = JSON.stringify([...new Set(names)].sort());
  const [loaded, setLoaded] = React.useState<{
    key: string;
    icons: Map<string, LucideIcon>;
  } | null>(null);
  React.useEffect(() => {
    let live = true;
    const list = JSON.parse(key) as string[];
    void Promise.all(list.map((name) => loadIcon(name))).then((components) => {
      if (!live) return;
      const icons = new Map<string, LucideIcon>();
      components.forEach((component, index) => {
        if (component !== undefined) icons.set(list[index]!, component);
      });
      setLoaded({ key, icons });
    });
    return () => {
      live = false;
    };
  }, [key]);
  if (loaded?.key !== key) return { ready: false, icons: new Map() };
  return { ready: true, icons: loaded.icons };
}
