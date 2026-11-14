// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * #895 (finding #14): removal trigger for the scoped `overrides` (#835 lifted minimatch to ^11.0.1
 * under three parents). Once a parent itself declares a range whose lowest version meets the
 * override's, the override is redundant — or, on a newer major, silently pins the older one.
 * Then this test fails: drop the override and re-run `npm audit`.
 */
const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
  packages: Record<string, { dependencies?: Record<string, string> }>;
};
const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  overrides?: Record<string, Record<string, string> | string>;
};

/** Lowest version a range admits, as [major, minor, patch] (`^10.2.2` → 10.2.2, `6 || 10` → 6.0.0). */
function lowest(range: string): number[] {
  const bounds = range.split("||").map((alt) => {
    const [major = 0, minor = 0, patch = 0] = (/\d+(?:\.\d+){0,2}/.exec(alt)?.[0] ?? "0")
      .split(".")
      .map(Number);
    return [major, minor, patch];
  });
  return bounds.reduce((min, b) => (compare(b, min) < 0 ? b : min));
}

function compare(a: number[], b: number[]): number {
  return a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!;
}

const scoped = Object.entries(manifest.overrides ?? {}).flatMap(([parent, deps]) =>
  typeof deps === "string"
    ? []
    : Object.entries(deps).map(([dep, range]) => ({ parent, dep, range })),
);

describe("scoped overrides carry a removal trigger (#895)", () => {
  it.each(scoped)("$parent → $dep $range is still needed", ({ parent, dep, range }) => {
    const declared = lock.packages[`node_modules/${parent}`]?.dependencies?.[dep];
    expect(
      declared,
      `${parent} no longer in the lockfile or no longer depends on ${dep}: drop the override`,
    ).toBeDefined();
    expect(
      compare(lowest(declared!), lowest(range)) < 0,
      `${parent} now declares ${dep} ${declared}: the override ${range} is redundant or pins an older major — drop it, re-run npm audit`,
    ).toBe(true);
  });
});
