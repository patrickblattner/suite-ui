import { createInstance } from "i18next";
import { describe, expect, it, vi } from "vitest";

import { registerSuiteStringsLazy } from "./lazy.js";

// The language chunks under control: German waits for a release, Spanish fails while `failEs` is set.
const chunks = vi.hoisted(() => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release: () => release(), failEs: 0 };
});
vi.mock("./de.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./de.js")>();
  await chunks.gate;
  return actual;
});
vi.mock("./es.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./es.js")>();
  return {
    get es() {
      if (chunks.failEs > 0) {
        chunks.failEs -= 1;
        throw new Error("chunk failed to load");
      }
      return actual.es;
    },
  };
});

describe("registerSuiteStringsLazy loading", () => {
  it("resolves with English when the active language's chunk fails, and a retry loads it", async () => {
    chunks.failEs = 1;
    const i18n = createInstance();
    await i18n.init({ lng: "es", fallbackLng: "en", resources: {} });
    await expect(registerSuiteStringsLazy(i18n)).resolves.toBeUndefined();
    expect(i18n.hasResourceBundle("es", "suite")).toBe(false);
    expect(i18n.t("actions.save", { ns: "suite" })).toBe("Save");
    await i18n.changeLanguage("es");
    expect(i18n.hasResourceBundle("es", "suite")).toBe(true);
    expect(i18n.t("actions.save", { ns: "suite" })).toBe("Guardar");
  });

  it("the last requested language wins: de loading slowly, then es loading fast, ends in es", async () => {
    const i18n = createInstance();
    await i18n.init({ lng: "en", fallbackLng: "en", resources: {} });
    await registerSuiteStringsLazy(i18n);
    const toGerman = i18n.changeLanguage("de");
    await i18n.changeLanguage("es");
    expect(i18n.language).toBe("es");
    chunks.release();
    await toGerman;
    expect(i18n.language).toBe("es");
    expect(i18n.t("actions.save", { ns: "suite" })).toBe("Guardar");
  });
});
