// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** #841, GL-CODE-004: a repo consumed as a git dependency lists every install-script package of its lockfile. */
const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
  packages: Record<string, { version?: string; resolved?: string; hasInstallScript?: boolean }>;
};
const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  allowScripts?: Record<string, boolean>;
};

/**
 * #895 (finding #60): npm runs a git dependency's `prepare` on install, but the lockfile records no
 * `hasInstallScript` for it. Every git dependency is therefore listed under its hosted key.
 * #898, GL-CODE-004 rev 3: the key carries the full resolved SHA from the lockfile
 * (`github:owner/repo#<sha>`); npm 11.19 matches `#<sha>` keys by prefix of the resolved SHA.
 * Name-only keys (`github:owner/repo`) are forbidden, so a toolkit pin bump must update the key.
 */
const hostedKey = (resolved: string) =>
  resolved.replace(
    /^git\+(?:ssh:\/\/git@|https:\/\/)github\.com[/:]([^/]+)\/(.+?)(?:\.git)?#([0-9a-f]{40})$/,
    "github:$1/$2#$3",
  );
const isHosted = (key: string) => /^[a-z]+:/.test(key);

const withScript = new Set(
  Object.entries(lock.packages)
    .filter(([, entry]) => entry.hasInstallScript === true)
    .map(([path, entry]) => `${path.replace(/.*node_modules\//, "")}@${entry.version ?? ""}`),
);
const gitDeps = new Set(
  Object.values(lock.packages)
    .filter((entry) => entry.resolved?.startsWith("git") === true)
    .map((entry) => hostedKey(entry.resolved!)),
);
const listed = Object.keys(manifest.allowScripts ?? {});

describe("allowScripts covers the lockfile in both directions (GL-CODE-004)", () => {
  it("lists every lockfile package with an install script", () => {
    expect([...withScript].filter((key) => !listed.includes(key))).toEqual([]);
  });

  it("lists nothing that is not an install-script package of the lockfile", () => {
    expect(listed.filter((key) => !isHosted(key) && !withScript.has(key))).toEqual([]);
  });

  it("lists every git dependency of the lockfile under its hosted key (prepare scripts)", () => {
    expect([...gitDeps].filter((key) => !listed.includes(key))).toEqual([]);
  });

  it("lists no name-only hosted key (GL-CODE-004 rev 3)", () => {
    expect(listed.filter((key) => isHosted(key) && !/#[0-9a-f]{40}$/.test(key))).toEqual([]);
  });

  it("lists no hosted key that is not a git dependency of the lockfile", () => {
    expect(listed.filter((key) => isHosted(key) && !gitDeps.has(key))).toEqual([]);
  });
});
