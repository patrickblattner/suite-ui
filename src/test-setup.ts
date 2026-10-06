import "@testing-library/jest-dom/vitest";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { registerSuiteStrings } from "./strings/index.js";

// Components read `useTranslation("suite")` from the global instance; a test switches the language
// with `i18n.changeLanguage`.
await i18n.use(initReactI18next).init({ lng: "en", fallbackLng: "en", resources: {} });
registerSuiteStrings(i18n);
