// @vitest-environment node
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { checkParity, exitCode, formatDeviation, parityMap, type ParityMap } from "./index.js";
import { loadAppStrings } from "./load.js";

const fixtureRoot = fileURLToPath(new URL("../../test/fixtures/app", import.meta.url));
const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));

describe("loadAppStrings", () => {
  it("merges the main locale files with the lazily registered page bundles", async () => {
    const strings = await loadAppStrings("cockpit", fixtureRoot);
    expect(strings.de).toEqual({
      common: { save: "Speichern", cancel: "Cancel" },
      page: { back: "Zurueck" },
    });
  });
});

describe("checkParity", () => {
  const map = (status: "pending" | "aligned"): ParityMap => ({
    elements: [
      { suite: "actions.save", status, cockpit: "common.save" },
      { suite: "actions.back", status, cockpit: "page.back" },
      { suite: "actions.cancel", status, community: "common.cancel" },
    ],
  });

  it("reports one line per deviating language and key, and only for the chosen app", async () => {
    const result = checkParity(
      "cockpit",
      await loadAppStrings("cockpit", fixtureRoot),
      map("pending"),
    );
    expect(result.elements).toHaveLength(2);
    expect(result.deviations.map(formatDeviation)).toEqual(["de page.back Zurueck ≠ Zurück"]);
  });

  it("only reports pending deviations, fails on aligned ones, and never fails in report mode", async () => {
    const strings = await loadAppStrings("cockpit", fixtureRoot);
    expect(exitCode(checkParity("cockpit", strings, map("pending")), false)).toBe(0);
    expect(exitCode(checkParity("cockpit", strings, map("aligned")), false)).toBe(1);
    expect(exitCode(checkParity("cockpit", strings, map("aligned")), true)).toBe(0);
  });

  it("names a key the app lacks as missing", () => {
    const empty = { en: {}, de: {}, es: {} };
    const [first] = checkParity("cockpit", empty, map("aligned")).deviations;
    expect(first && formatDeviation(first)).toBe("en common.save <missing> ≠ Save");
  });
});

describe("suite-ui-parity", () => {
  it("ships an empty map", () => {
    expect(parityMap).toEqual({ elements: [] });
  });

  it("exits 0 and reports 0 elements for the empty map", async () => {
    const { stdout } = await promisify(execFile)(process.execPath, [
      "--import",
      "jiti/register",
      cli,
      "--app",
      "cockpit",
      "--root",
      fixtureRoot,
    ]);
    expect(stdout).toContain("suite-ui-parity cockpit: 0 elements");
  });
});
