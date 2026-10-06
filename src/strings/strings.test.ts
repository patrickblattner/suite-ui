import { describe, expect, it } from "vitest";

import { suiteStrings } from "./index.js";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const languages = Object.entries(suiteStrings).map(
  ([lng, tree]) => [lng, flatten(tree as Tree)] as const,
);
const enKeys = [...flatten(suiteStrings.en).keys()];

// Content that never belongs in a user-facing text: ticket numbers, env files, spec keys.
const forbidden: [string, RegExp][] = [
  ["ticket number", /#\d+/],
  [".env", /\.env\b/],
  ["spec key", /\b[A-Z]{2,}(?:-[A-Z]+)*-\d{3}\b/],
];

describe("suite strings", () => {
  it.each(languages)("%s has exactly the keys of en", (lng, strings) => {
    const missing = enKeys.filter((key) => !strings.has(key)).map((key) => `${lng} ${key}`);
    const extra = [...strings.keys()].filter((key) => !enKeys.includes(key));
    expect(missing, `missing keys`).toEqual([]);
    expect(
      extra.map((key) => `${lng} ${key}`),
      `keys not in en`,
    ).toEqual([]);
  });

  it.each(languages)("%s has no empty value", (lng, strings) => {
    const empty = [...strings]
      .filter(([, value]) => value.trim() === "")
      .map(([k]) => `${lng} ${k}`);
    expect(empty).toEqual([]);
  });

  it.each(languages)("%s has no forbidden content", (lng, strings) => {
    const hits = [...strings].flatMap(([key, value]) =>
      forbidden.filter(([, re]) => re.test(value)).map(([what]) => `${lng} ${key}: ${what}`),
    );
    expect(hits).toEqual([]);
  });
});
