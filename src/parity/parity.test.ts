// @vitest-environment node
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { suiteStrings } from "../strings/index.js";
import {
  checkParity,
  exitCode,
  formatDeviation,
  lookup,
  parityMap,
  type ParityMap,
} from "./index.js";
import { loadAppStrings } from "./load.js";

const fixtureRoot = fileURLToPath(new URL("../../test/fixtures/app", import.meta.url));
const communityBefore = fileURLToPath(
  new URL("../../test/fixtures/community-before", import.meta.url),
);
const communityMigrated = fileURLToPath(
  new URL("../../test/fixtures/community-migrated", import.meta.url),
);
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

describe("parity map", () => {
  it("names a suite key that exists in en and at least one app key per element", () => {
    const broken = parityMap.elements
      .filter(
        (e) =>
          e.element === undefined ||
          lookup(suiteStrings.en, e.suite) === undefined ||
          (e.cockpit === undefined && e.community === undefined),
      )
      .map((e) => e.suite);
    expect(broken).toEqual([]);
  });

  it("maps the list frame of both apps, pending until both have switched", () => {
    const elements = new Set(parityMap.elements.map((e) => e.element));
    expect([...elements].sort()).toEqual(["FilterBar", "SortSelect", "TablePagination"]);
    expect(parityMap.elements.every((e) => e.status === "pending")).toBe(true);
  });
});

describe("suite-ui-parity", () => {
  const run = (app: string, root: string) =>
    promisify(execFile)(process.execPath, [
      "--import",
      "jiti/register",
      cli,
      "--app",
      app,
      "--root",
      root,
    ]);

  it("reports one line per deviating language and key while the community has its own list texts", async () => {
    const { stdout } = await run("community", communityBefore);
    const lines = stdout.trim().split("\n");
    expect(lines.at(-1)).toBe(
      "suite-ui-parity community: 16 elements (16 pending, 0 aligned), 16 deviations",
    );
    expect(lines).toContain("es filter.reset Quitar el filtro ≠ Borrar filtro");
    expect(lines).toContain("en pagination.pageSizeLabel Items per page ≠ Rows per page");
    // The non-filter value is the same word in both apps already.
    expect(lines.filter((line) => line.includes(" filter.all "))).toEqual([]);
  });

  it("reports no line once the community carries the suite texts", async () => {
    const { stdout } = await run("community", communityMigrated);
    expect(stdout.trim()).toBe(
      "suite-ui-parity community: 16 elements (16 pending, 0 aligned), 0 deviations",
    );
  });
});
