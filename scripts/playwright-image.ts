#!/usr/bin/env node
// Prints the pinned Playwright image the gallery screenshots are taken and compared in
// (SUI-FEATURE-076, GL-TEST-019). This is the one written-out pin; `scripts/gallery-image.sh`
// reads it from here.
//
// The tag has to match the `@playwright/test` version the lockfile resolves — the browsers in the
// image belong to that version — so a Playwright bump is a lockfile change and a pin change in the
// same commit; this script refuses the pin while the two disagree.

import { readFileSync } from "node:fs";

const IMAGE =
  "mcr.microsoft.com/playwright:v1.60.0-jammy@sha256:e1529a04087193966ea15d4a1617345bdaa0791690a24ab2c42b65f9ce5b2cdc";

const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")) as {
  packages?: Record<string, { version?: string }>;
};
const version = lock.packages?.["node_modules/@playwright/test"]?.version ?? "?";
if (!IMAGE.includes(`:v${version}-`)) {
  console.error(
    `playwright-image: the pin ${IMAGE} does not match @playwright/test ${version} in package-lock.json`,
  );
  process.exit(1);
}
process.stdout.write(`${IMAGE}\n`);
