import { act, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next, useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";

import { registerSuiteStringsLazy } from "./index.js";

// SUI-DESIGN-011 AC3: English at once, the active language by import before the start settles, every
// later language before the first render in it.
describe("registerSuiteStringsLazy", () => {
  it("holds only en and the active language under suite after the start", async () => {
    const i18n = createInstance();
    await i18n.init({ lng: "de", fallbackLng: "en", resources: {} });
    const started = registerSuiteStringsLazy(i18n);
    expect(i18n.hasResourceBundle("en", "suite")).toBe(true);
    await started;
    expect(["en", "de", "es"].filter((lng) => i18n.hasResourceBundle(lng, "suite"))).toEqual([
      "en",
      "de",
    ]);
  });

  it("loads a regional code's base language", async () => {
    const i18n = createInstance();
    await i18n.init({ lng: "es-MX", fallbackLng: "en", resources: {} });
    await registerSuiteStringsLazy(i18n);
    expect(i18n.hasResourceBundle("es", "suite")).toBe(true);
    expect(i18n.hasResourceBundle("de", "suite")).toBe(false);
    expect(i18n.t("actions.save", { ns: "suite" })).toBe("Guardar");
  });

  it("loads a new language into i18next before the first render in it", async () => {
    const i18n = createInstance();
    await i18n.use(initReactI18next).init({ lng: "en", fallbackLng: "en", resources: {} });
    await registerSuiteStringsLazy(i18n);
    expect(i18n.hasResourceBundle("es", "suite")).toBe(false);
    // Every render records its language and whether that language's bundle was already in.
    const renders: { lng: string; loaded: boolean; text: string }[] = [];
    function SaveLabel() {
      const { t, i18n: active } = useTranslation("suite");
      const text = t("actions.save");
      renders.push({
        lng: active.language,
        loaded: active.hasResourceBundle(active.language, "suite"),
        text,
      });
      return <span>{text}</span>;
    }
    render(
      <I18nextProvider i18n={i18n}>
        <SaveLabel />
      </I18nextProvider>,
    );
    expect(screen.getByText("Save")).toBeInTheDocument();

    await act(() => i18n.changeLanguage("es"));
    expect(screen.getByText("Guardar")).toBeInTheDocument();
    const inSpanish = renders.filter((entry) => entry.lng === "es");
    expect(inSpanish.length).toBeGreaterThan(0);
    expect(inSpanish.every((entry) => entry.loaded && entry.text === "Guardar")).toBe(true);
    expect(i18n.hasResourceBundle("de", "suite")).toBe(false);
  });

  it.each(["constructor", "__proto__", "toString", "fr"])(
    "treats %s as an unknown code: English stays the fallback, nothing throws",
    async (lng) => {
      const i18n = createInstance();
      await i18n.init({ lng: "en", fallbackLng: "en", resources: {} });
      await registerSuiteStringsLazy(i18n);
      await expect(i18n.changeLanguage(lng)).resolves.toBeDefined();
      expect(i18n.t("actions.save", { ns: "suite" })).toBe("Save");
    },
  );

  it("a switch without a language loads what the detector settles on before rendering in it", async () => {
    let detect = "es";
    const i18n = createInstance();
    await i18n
      .use({
        type: "languageDetector",
        init: () => {},
        detect: () => detect,
        cacheUserLanguage: () => {},
      })
      .use(initReactI18next)
      .init({ fallbackLng: "en", resources: {} });
    await registerSuiteStringsLazy(i18n);
    expect(i18n.language).toBe("es");
    expect(i18n.hasResourceBundle("es", "suite")).toBe(true);
    const renders: { lng: string; text: string }[] = [];
    function SaveLabel() {
      const { t, i18n: active } = useTranslation("suite");
      renders.push({ lng: active.language, text: t("actions.save") });
      return <span>{t("actions.save")}</span>;
    }
    render(
      <I18nextProvider i18n={i18n}>
        <SaveLabel />
      </I18nextProvider>,
    );
    detect = "de";
    await act(() => i18n.changeLanguage());
    expect(i18n.language).toBe("de");
    expect(screen.getByText("Speichern")).toBeInTheDocument();
    expect(renders.filter((entry) => entry.lng === "de").map((entry) => entry.text)).not.toContain(
      "Save",
    );
  });

  it("loads the language i18next settles on when the detector reports an unsupported code first", async () => {
    let detect: string[] = ["en"];
    const i18n = createInstance();
    await i18n
      .use({
        type: "languageDetector",
        init: () => {},
        detect: () => detect,
        cacheUserLanguage: () => {},
      })
      .init({ fallbackLng: "en", supportedLngs: ["en", "de", "es"], resources: {} });
    await registerSuiteStringsLazy(i18n);
    detect = ["fr", "es"];
    await i18n.changeLanguage();
    expect(i18n.language).toBe("es");
    expect(i18n.t("actions.save", { ns: "suite" })).toBe("Guardar");
  });
});
