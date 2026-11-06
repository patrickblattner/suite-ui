#!/usr/bin/env node
// The Docker volume the gallery container's dependencies live in (`scripts/gallery-image.sh`, #823).
// Since #820 two gallery runs can hold dev-box slots at once (PROC-REL-060), so the volume is named
// by what its dependencies were made from — the lockfile and the image — not by the architecture
// alone: a run never reinstalls into a volume another run with a different lockfile is reading.
//
//   node scripts/gallery-deps.ts <arch> <image>   # prints "<key> <volume>"

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const VOLUME_PREFIX = "suite-ui-gallery-deps-";

// The package's own version is left out, so a release bump reinstalls nothing.
export function depsKey(lockText: string, image: string): string {
  const lock = JSON.parse(lockText) as {
    version?: string;
    packages?: Record<string, { version?: string }>;
  };
  delete lock.version;
  if (lock.packages?.[""]) delete lock.packages[""].version;
  return createHash("sha256")
    .update(JSON.stringify(lock) + image)
    .digest("hex");
}

export function depsVolume(arch: string, key: string): string {
  return `${VOLUME_PREFIX}${arch}-${key.slice(0, 16)}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [arch, image] = process.argv.slice(2);
  if (!arch || !image) {
    console.error("usage: node scripts/gallery-deps.ts <arch> <image>");
    process.exit(4);
  }
  const key = depsKey(
    readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
    image,
  );
  process.stdout.write(`${key} ${depsVolume(arch, key)}\n`);
}
