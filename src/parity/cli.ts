#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { APPS, checkParity, exitCode, formatDeviation, type App } from "./index.js";
import { loadAppStrings } from "./load.js";

const USAGE = "usage: suite-ui-parity --app <cockpit|community> [--root <path>] [--report]";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      app: { type: "string" },
      root: { type: "string" },
      report: { type: "boolean", default: false },
    },
  });
  if (!APPS.includes(values.app as App)) {
    console.error(USAGE);
    return 2;
  }
  const app = values.app as App;
  const root = resolve(values.root ?? process.cwd());

  const result = checkParity(app, await loadAppStrings(app, root));
  for (const deviation of result.deviations) console.log(formatDeviation(deviation));

  const pending = result.elements.filter((e) => e.status === "pending").length;
  const aligned = result.elements.length - pending;
  console.log(
    `suite-ui-parity ${app}: ${result.elements.length} elements (${pending} pending, ${aligned} aligned), ${result.deviations.length} deviations`,
  );
  return exitCode(result, values.report);
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`suite-ui-parity: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  },
);
