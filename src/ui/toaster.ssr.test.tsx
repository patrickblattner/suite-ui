// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Toaster } from "./toaster.js";

// The Toaster portals into `document.body` (`SUI-FEATURE-142` rev 3); on the server, without a
// document, it renders nothing instead of throwing.
describe("Toaster on the server", () => {
  it("renders without a document", () => {
    expect(renderToStaticMarkup(<Toaster />)).toBe("");
  });
});
