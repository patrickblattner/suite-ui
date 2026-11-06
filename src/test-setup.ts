import "@testing-library/jest-dom/vitest";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach } from "vitest";

import { registerSuiteStrings } from "./strings/index.js";
import { drainFocusScopeTimers } from "./test-teardown.js";

// Components read `useTranslation("suite")` from the global instance; a test switches the language
// with `i18n.changeLanguage`.
await i18n.use(initReactI18next).init({ lng: "en", fallbackLng: "en", resources: {} });
registerSuiteStrings(i18n);

// jsdom lays out no range: a range over an element's contents counts as that element's box. A test
// lays out the text with `vi.spyOn(Range.prototype, "getBoundingClientRect")`. A node-environment
// test file has no DOM.
if (typeof Range !== "undefined")
  Range.prototype.getBoundingClientRect = function (this: Range) {
    const node = this.startContainer;
    return node instanceof Element ? node.getBoundingClientRect() : new DOMRect();
  };

// #819: no Radix focus-scope timer outlives a test; see src/test-teardown.ts for why it is drained
// here, after every unmount, and why the drain fails a test instead of only waiting.
afterEach(drainFocusScopeTimers);
