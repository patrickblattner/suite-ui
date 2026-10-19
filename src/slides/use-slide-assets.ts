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

// A face a text needs: its family, weight (100–900) and style.
export interface SlideFontNeed {
  family: string;
  weight: number;
  style: "normal" | "italic";
}

// The weights a file covers: one, or a range for a variable font ("100 900").
function weightsOf(weight: SlideFontFile["weight"]): [number, number] {
  if (weight === undefined || weight === "normal") return [400, 400];
  if (weight === "bold") return [700, 700];
  const [low, high = low] = String(weight).trim().split(/\s+/).map(Number);
  return Number.isFinite(low) && Number.isFinite(high) ? [low!, high!] : [400, 400];
}

type LoadedFace = { family: string; weights: [number, number]; style: string };

// A face that has no file which loaded: a family alone when no file of it loaded at all (or a brand
// font key the brand set lacks), else with the weight and style it needs.
export interface SlideMissingFace {
  family: string;
  weight?: number;
  style?: "normal" | "italic";
}

// The missing face a need is: its family when no file of it loaded at all, else family, weight and
// style (a bold or italic file that failed while the regular one loaded is still missing, never a
// silent synthesized cut).
function missingFace(
  need: SlideFontNeed,
  faces: readonly LoadedFace[],
): SlideMissingFace | undefined {
  const family = need.family.toLowerCase();
  const ofFamily = faces.filter((face) => face.family === family);
  if (ofFamily.length === 0) return { family: need.family };
  const covered = ofFamily.some(
    (face) =>
      face.style === need.style && face.weights[0] <= need.weight && need.weight <= face.weights[1],
  );
  return covered ? undefined : need;
}

// The name a missing face has in the report, for the app: "Inter 700 italic", or the family alone.
export function missingFaceName(face: SlideMissingFace): string {
  if (face.weight === undefined) return face.family;
  return `${face.family} ${face.weight}${face.style === "italic" ? " italic" : ""}`;
}

// How the view names missing fonts (`SUI-FEATURE-180` rev 4): grouped by family, each cut by its name
// from the package's texts, never its weight number, "Inter (Bold, Bold italic)"; a family with no
// file at all (or a missing brand font key) by its name alone. The report keeps `missingFaceName`,
// the number included, for the app.
export function missingFontsText(
  t: (key: string, options?: Record<string, string>) => string,
  missing: readonly SlideMissingFace[],
): string {
  const families = new Map<string, string[]>();
  for (const face of missing) {
    const cuts = families.get(face.family) ?? [];
    families.set(face.family, cuts);
    if (face.weight === undefined) continue;
    const step = Math.min(900, Math.max(100, Math.round(face.weight / 100) * 100));
    const weight = t(`slides.weight.${step}`);
    const cut =
      face.style !== "italic"
        ? weight
        : step === 400
          ? t("slides.italic")
          : t("slides.italicFace", { weight });
    if (!cuts.includes(cut)) cuts.push(cut);
  }
  return [...families]
    .map(([family, cuts]) =>
      cuts.length === 0 ? family : t("slides.fontFaces", { family, faces: cuts.join(", ") }),
    )
    .join(", ");
}

// Loads `files` and tells which `needed` faces have no file that loaded; a file from an origin that
// is neither the page's, `blob:` nor one of `origins` does not load. Not `ready` until every file
// has settled.
export function useSlideFonts(
  files: readonly SlideFontFile[],
  needed: readonly SlideFontNeed[],
  origins: readonly string[] = [],
): { ready: boolean; missing: SlideMissingFace[] } {
  const key = JSON.stringify([files, origins]);
  const [loaded, setLoaded] = React.useState<{ key: string; faces: LoadedFace[] } | null>(null);
  React.useEffect(() => {
    let live = true;
    const [list, allowed] = JSON.parse(key) as [SlideFontFile[], string[]];
    void Promise.all(
      list.map((file) =>
        loadFont(file, allowed).then((ok): LoadedFace | null =>
          ok
            ? {
                family: file.family.toLowerCase(),
                weights: weightsOf(file.weight),
                style: file.style ?? "normal",
              }
            : null,
        ),
      ),
    ).then((faces) => {
      if (live) setLoaded({ key, faces: faces.filter((face) => face !== null) });
    });
    return () => {
      live = false;
    };
  }, [key]);
  if (loaded?.key !== key) return { ready: false, missing: [] };
  const missing = new Map<string, SlideMissingFace>();
  for (const need of needed) {
    const face = missingFace(need, loaded.faces);
    if (face !== undefined) missing.set(missingFaceName(face), face);
  }
  return { ready: true, missing: [...missing.values()] };
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

// The names of the package's icon set, sorted (the element library's search, `SUI-FEATURE-232`).
export function slideIconNames(): string[] {
  return Object.keys(iconImports).sort();
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
