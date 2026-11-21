// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * #895 (finding #14): removal trigger for the scoped `overrides` (#835 lifted minimatch to ^11.0.1
 * under three parents). Once a parent itself declares a range whose lowest version meets the
 * override's, the override is redundant; once it admits a newer major than the override's, the
 * override silently pins the older one (#988, finding #569). Then this test fails: drop the override
 * and re-run `npm audit`.
 */
const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
  packages: Record<string, { dependencies?: Record<string, string> }>;
};
const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  overrides?: Record<string, Record<string, string> | string>;
};

/** A version as [major, minor, patch] from the first number in `text` (`^10.2.2` → 10.2.2). */
function version(text: string): number[] {
  const [major = 0, minor = 0, patch = 0] = (/\d+(?:\.\d+){0,2}/.exec(text)?.[0] ?? "0")
    .split(".")
    .map(Number);
  return [major, minor, patch];
}

function compare(a: number[], b: number[]): number {
  return a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!;
}

/**
 * One alternative of a range (`>=10 <12`, `^10.2.2`, `10 - 12`, `*`): the lowest version it admits and
 * the highest major, Infinity when no comparator bounds it above (`>=10`, `>1`, `*`). A caret, tilde,
 * x-range or bare version implies its own major as the bound; `<X.0.0` stops below X (#991).
 * Whitespace between an operator and its version is dropped first, as semver trims it (`>= 10` is
 * `>=10`, `^ 11.2.0` is `^11.2.0`); a hyphen range keeps the spaces it needs (#999).
 */
function alternative(text: string): { low: number[]; high: number } {
  const trimmed = text.trim().replace(/(<=|>=|<|>|=|\^|~)\s+/g, "$1");
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(trimmed);
  if (hyphen) return { low: version(hyphen[1]!), high: version(hyphen[2]!)[0]! };
  let low = [0, 0, 0];
  let high = Infinity;
  for (const comparator of trimmed.split(/\s+/).filter((c) => c !== "" && !/^[*xX]$/.test(c))) {
    const [, operator = "", rest = ""] = /^(<=|>=|<|>|=|\^|~)?(.*)$/.exec(comparator)!;
    const bound = version(rest);
    if (operator === "<") {
      high = Math.min(high, bound[1] === 0 && bound[2] === 0 ? bound[0]! - 1 : bound[0]!);
    } else if (operator === "<=") {
      high = Math.min(high, bound[0]!);
    } else {
      if (compare(bound, low) > 0) low = bound;
      if (operator !== ">=" && operator !== ">") high = Math.min(high, bound[0]!);
    }
  }
  return { low, high };
}

/** Lowest version a range admits (`6 || 10` → 6.0.0). */
function lowest(range: string): number[] {
  return range
    .split("||")
    .map((alt) => alternative(alt).low)
    .reduce((min, b) => (compare(b, min) < 0 ? b : min));
}

/** Highest major a range admits over its alternatives: Infinity for an unbounded one (`>=10`, `*`). */
function highestMajor(range: string): number {
  return Math.max(...range.split("||").map((alt) => alternative(alt).high));
}

/** Why the override `range` is no longer needed against the parent's `declared` range, or null. */
function dropReason(declared: string, range: string): string | null {
  if (compare(lowest(declared), lowest(range)) >= 0) return "redundant";
  if (highestMajor(declared) > lowest(range)[0]!) return "pins an older major";
  return null;
}

/** The scoped overrides of a manifest: parent, dependency and range. */
function scopedOverrides(overrides: Record<string, Record<string, string> | string> = {}) {
  return Object.entries(overrides).flatMap(([parent, deps]) =>
    typeof deps === "string"
      ? []
      : Object.entries(deps).map(([dep, range]) => ({ parent, dep, range })),
  );
}

describe("the removal trigger's range check (#988, findings #569, #570)", () => {
  it.each([
    ["^10.2.2", "^11.0.1", null],
    ["6 || 7 || 8 || 9 || 10", "^11.0.1", null],
    ["^11.0.0", "^11.0.1", null],
    ["^11.2.0", "^11.0.1", "redundant"],
    ["6 || 10 || 12", "^11.0.1", "pins an older major"],
    [">=10", "^11.0.1", "pins an older major"],
    // #991 (Codex CX1): a comparator range is bounded by its upper comparator.
    [">=10.2.2 <11.0.0", "^11.0.1", null],
    [">=1.0.0 <2.0.0", "^11.0.1", null],
    [">=10 <12", "^11.0.1", null],
    ["<12", "^11.0.1", null],
    [">=10 <13", "^11.0.1", "pins an older major"],
    ["<=12.1", "^11.0.1", "pins an older major"],
    ["10.0.0 - 12.0.0", "^11.0.1", "pins an older major"],
    [">=12.0.0 <13", "^11.0.1", "redundant"],
    ["*", "^11.0.1", "pins an older major"],
    // #999 (Codex CX1): spacing semver accepts between an operator and its version.
    [">= 10", "^11.0.1", "pins an older major"],
    ["> 10.0.0", "^11.0.1", "pins an older major"],
    [">=  10   <13", "^11.0.1", "pins an older major"],
    [">= 10 < 12", "^11.0.1", null],
    [">= 10.2.2  <  11.0.0", "^11.0.1", null],
    ["<= 10.5", "^11.0.1", null],
    ["^ 11.2.0", "^11.0.1", "redundant"],
    ["~ 10.2.2", "^11.0.1", null],
    ["10.0.0  -  12.0.0", "^11.0.1", "pins an older major"],
  ])("declared %s against the override %s → %s", (declared, range, reason) => {
    expect(dropReason(declared, range)).toBe(reason);
  });

  it("a manifest without scoped overrides has none to check", () => {
    expect(scopedOverrides(undefined)).toEqual([]);
    expect(scopedOverrides({ minimatch: "^11.0.1" })).toEqual([]);
  });
});

const scoped = scopedOverrides(manifest.overrides);

describe("scoped overrides carry a removal trigger (#895)", () => {
  // With no scoped override left there is nothing to remove; the suite still holds a test.
  it.skipIf(scoped.length > 0)("no scoped overrides remain", () => {
    expect(scoped).toEqual([]);
  });
  it.each(scoped)("$parent → $dep $range is still needed", ({ parent, dep, range }) => {
    const declared = lock.packages[`node_modules/${parent}`]?.dependencies?.[dep];
    expect(
      declared,
      `${parent} no longer in the lockfile or no longer depends on ${dep}: drop the override`,
    ).toBeDefined();
    const reason = dropReason(declared!, range);
    expect(
      reason,
      `${parent} now declares ${dep} ${declared}: the override ${range} ${reason} — drop it, re-run npm audit`,
    ).toBeNull();
  });
});
