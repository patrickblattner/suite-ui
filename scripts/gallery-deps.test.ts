// @vitest-environment node
import { describe, expect, it } from "vitest";

import { depsKey, depsVolume, VOLUME_PREFIX } from "./gallery-deps";

// #823: concurrent gallery runs (two dev-box slots, PROC-REL-060) must not share a dependency
// volume unless their dependencies are the same.
const lock = (version: string, react: string) =>
  JSON.stringify({
    name: "suite-ui",
    version,
    lockfileVersion: 3,
    packages: { "": { name: "suite-ui", version }, "node_modules/react": { version: react } },
  });
const IMAGE = "mcr.microsoft.com/playwright:v1.60.0-jammy";

describe("gallery dependency volume", () => {
  it("keeps the volume across a release bump", () => {
    expect(depsKey(lock("1.0.0", "19.0.0"), IMAGE)).toBe(depsKey(lock("1.1.0", "19.0.0"), IMAGE));
  });

  it("gives another lockfile another volume", () => {
    const a = depsVolume("arm64", depsKey(lock("1.0.0", "19.0.0"), IMAGE));
    const b = depsVolume("arm64", depsKey(lock("1.0.0", "19.1.0"), IMAGE));
    expect(a).not.toBe(b);
  });

  it("gives another image another volume", () => {
    const key = (image: string) => depsKey(lock("1.0.0", "19.0.0"), image);
    expect(key(IMAGE)).not.toBe(key(`${IMAGE}-other`));
  });

  it("names the volume by prefix, architecture and key", () => {
    const key = depsKey(lock("1.0.0", "19.0.0"), IMAGE);
    expect(depsVolume("amd64", key)).toBe(`${VOLUME_PREFIX}amd64-${key.slice(0, 16)}`);
    expect(depsVolume("amd64", key)).not.toBe(depsVolume("arm64", key));
  });
});
