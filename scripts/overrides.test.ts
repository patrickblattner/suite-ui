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

/** Lowest version a range admits (`6 || 10` → 6.0.0). */
function lowest(range: string): number[] {
  return range
    .split("||")
    .map(version)
    .reduce((min, b) => (compare(b, min) < 0 ? b : min));
}

/** Highest major a range admits: Infinity for an open range (`>=10`, `*`), else each alternative's. */
function highestMajor(range: string): number {
  return Math.max(
    ...range.split("||").map((alt) => {
      const text = alt.trim();
      if (text === "" || text === "*" || text === "x" || /^>/.test(text)) return Infinity;
      return version(text)[0]!;
    }),
  );
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
