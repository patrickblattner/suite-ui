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
});
