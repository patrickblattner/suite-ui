// The spec-sync toolkit's CLI for Node code (GL-SEC-011 rev 4): run as `process.execPath <cli>`,
// never through npx. Without a local bin npx fetches the unrelated public npm package `spec-sync`,
// and even `--no-install` runs a copy of it already in the npx cache. Resolved from this file, so a
// checkout without the toolkit — no node_modules, or `npm ci --ignore-scripts`, which builds no
// dist/ — has none, and the caller refuses.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const NO_TOOLKIT =
  "the spec-sync toolkit is not installed (node_modules/spec-sync-toolkit/dist/cli.js missing) — run npm ci";

export function toolkitCli(): string | undefined {
  let cli: string;
  try {
    cli = fileURLToPath(import.meta.resolve("spec-sync-toolkit/dist/cli.js"));
  } catch {
    return undefined;
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- the path is the toolkit's own CLI as Node resolves it from this file, no outside input
  return existsSync(cli) ? cli : undefined;
}
