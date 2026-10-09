// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { TOOLTIP_HINT_DELAY, TOOLTIP_OVERFLOW_DELAY } from "./ui/tooltip.js";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function block(selector: string): Map<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in styles.css`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start));
  const tokens = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    tokens.set(name as string, (value as string).trim());
  }
  return tokens;
}

const root = block(":root");
const themes = {
  light: root,
  // `.dark` only overrides; everything it leaves alone is inherited from `:root`.
  dark: new Map([...root, ...block(".dark")]),
};

type Rgb = [number, number, number];

// OKLCH → linear sRGB (Björn Ottosson's OKLab matrices), clipped to the sRGB gamut like the browser.
function oklchToLinearSrgb(value: string): Rgb {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value);
  if (!match) throw new Error(`not an opaque oklch() color: ${value}`);
  const [l, c, h] = match.slice(1).map(Number) as Rgb;
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((x) => x ** 3) as Rgb;
  const [L, M, S] = lms;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ].map((x) => Math.min(1, Math.max(0, x))) as Rgb;
}

function resolve(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`--${name} is not defined`);
  const ref = /^var\(--([a-z0-9-]+)\)$/.exec(value);
  return ref ? resolve(tokens, ref[1] as string) : value;
}

function luminanceOf([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: number, b: number): number {
  const [hi, lo] = [a, b].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function contrast(tokens: Map<string, string>, text: string, ground: string): number {
  const luminance = (name: string) => luminanceOf(oklchToLinearSrgb(resolve(tokens, name)));
  return ratio(luminance(text), luminance(ground));
}

// The browser blends a translucent layer in gamma-encoded sRGB.
const encode = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const decode = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

function over(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return top.map((t, i) =>
    decode(alpha * encode(t) + (1 - alpha) * encode(bottom[i] as number)),
  ) as Rgb;
}

// A status text on its own fill at /15, the way a status badge sits in a list row: over the selected
// row (`bg-muted`) and over the hover row (`bg-muted/50` on the page).
function statusGrounds(tokens: Map<string, string>, fill: string): [string, Rgb][] {
  const color = (name: string) => oklchToLinearSrgb(resolve(tokens, name));
  const tint = color(fill);
  const muted = color("muted");
  return [
    ["bg-muted", over(tint, 0.15, muted)],
    ["bg-muted/50", over(tint, 0.15, over(muted, 0.5, color("background")))],
  ];
}

// A `-foreground` sits ON its fill (and on the fill's hover step); `foreground` sits on the page.
// A `-text` token sits on the neutral grounds the gallery shows it on. `muted-foreground` is also
// the metadata color on page and card.
function pairs(tokens: Map<string, string>): [string, string][] {
  const out: [string, string][] = [];
  for (const name of tokens.keys()) {
    if (name === "foreground") out.push([name, "background"]);
    else if (name.endsWith("-foreground")) {
      const fill = name.slice(0, -"-foreground".length);
      for (const ground of [fill, `${fill}-hover`])
        if (tokens.has(ground)) out.push([name, ground]);
      if (fill === "muted") out.push([name, "background"], [name, "card"]);
    } else if (name.endsWith("-text")) out.push([name, "background"], [name, "card"]);
  }
  return out;
}

describe("styles.css tokens", () => {
  for (const [theme, tokens] of Object.entries(themes)) {
    it.each(pairs(tokens))(`${theme}: --%s on --%s meets WCAG AA (4.5:1)`, (text, ground) => {
      expect(contrast(tokens, text, ground)).toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const [theme, tokens] of Object.entries(themes)) {
    for (const fill of ["destructive", "success", "warn"]) {
      it.each(statusGrounds(tokens, fill))(
        `${theme}: --${fill}-text on ${fill}/15 over %s meets WCAG AA (4.5:1)`,
        (_, ground) => {
          const text = luminanceOf(oklchToLinearSrgb(resolve(tokens, `${fill}-text`)));
          expect(ratio(text, luminanceOf(ground))).toBeGreaterThanOrEqual(4.5);
        },
      );
    }
  }

  it("gives every status text tone its own value in each theme, never the fill", () => {
    for (const tokens of Object.values(themes)) {
      for (const fill of ["destructive", "success", "warn"]) {
        const value = tokens.get(`${fill}-text`) ?? "";
        expect(value).toMatch(/^oklch\(/);
        expect(value).not.toBe(tokens.get(fill));
      }
    }
  });

  it("checks every -text token and the action -foreground tokens", () => {
    const checked = new Set(pairs(themes.light).map(([text]) => text));
    for (const name of ["destructive-text", "success-text", "warn-text"]) {
      expect(checked).toContain(name);
    }
    for (const fill of ["success", "warn", "destructive", "instance-name"]) {
      expect(checked).toContain(`${fill}-foreground`);
    }
  });

  // SUI-FEATURE-044 AC1: the text of every soft badge on its own ground, in both themes; the AA
  // check itself is the `-foreground` pair above.
  it.each(["success", "warn", "destructive", "info"])(
    "carries --%s-soft and its -foreground in each theme, checked as a pair",
    (tone) => {
      for (const [theme, tokens] of Object.entries(themes)) {
        expect(pairs(tokens), theme).toContainEqual([`${tone}-soft-foreground`, `${tone}-soft`]);
        expect(contrast(tokens, `${tone}-soft-foreground`, `${tone}-soft`)).toBeGreaterThanOrEqual(
          4.5,
        );
      }
      expect(block(".dark").get(`${tone}-soft`)).not.toBe(root.get(`${tone}-soft`));
    },
  );

  it("carries the shell offsets, the tooltip delays and the checker size of the seed", () => {
    expect(Object.fromEntries(root)).toMatchObject({
      "app-bar-height": "0rem",
      "shell-chrome-height": "0rem",
      "page-inset-top": "1.5rem",
      "tooltip-overflow-delay": "0ms",
      "tooltip-hint-delay": "1500ms",
      "checker-size": "12px",
    });
    expect(root.get("toast-offset-top")?.replace(/\s+/g, " ")).toBe(
      "calc( var(--app-bar-height) + var(--shell-chrome-height) + var(--page-inset-top) + var(--page-header-height) + 0.5rem )",
    );
  });

  it("keeps the tooltip delay constants equal to their tokens", () => {
    expect(root.get("tooltip-overflow-delay")).toBe(`${TOOLTIP_OVERFLOW_DELAY}ms`);
    expect(root.get("tooltip-hint-delay")).toBe(`${TOOLTIP_HINT_DELAY}ms`);
  });

  it("carries no domain token and no font", () => {
    // Domain tokens stay in the apps: Cockpit status-*, plan-*, tile-*; Community agenda-*, content-*.
    expect(css).not.toMatch(/--(status|plan|tile|agenda|content)-[a-z0-9-]+\s*:/);
    expect(css).not.toMatch(/--font-|font-family|@fontsource/);
  });
});
