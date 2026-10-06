import { render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next, useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";

import { registerSuiteStrings } from "./index.js";

function SaveLabel() {
  const { t } = useTranslation("suite");
  return <span>{t("actions.save")}</span>;
}

describe("registerSuiteStrings", () => {
  it.each([
    ["en", "Save"],
    ["de", "Speichern"],
    ["es", "Guardar"],
  ])("registers the suite namespace in %s", async (lng, expected) => {
    const i18n = createInstance();
    await i18n.use(initReactI18next).init({ lng, resources: {} });
    registerSuiteStrings(i18n);

    expect(i18n.hasResourceBundle(lng, "suite")).toBe(true);
    render(
      <I18nextProvider i18n={i18n}>
        <SaveLabel />
      </I18nextProvider>,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
