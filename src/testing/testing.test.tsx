import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { collectVisibleTexts, foreignTexts } from "./index.js";

describe("foreignTexts", () => {
  it("accepts suite texts with any interpolated value and the allowed labels", () => {
    expect(
      foreignTexts(["Profile", "Nothing found in Events, Content.", "Dashboard"], "en", [
        "Dashboard",
      ]),
    ).toEqual([]);
  });

  it("reports a hard-coded text and a text of another language, once each", () => {
    expect(foreignTexts(["Log out", "Abmelden", "Account", "Account"], "en")).toEqual([
      "Abmelden",
      "Account",
    ]);
  });
});

describe("collectVisibleTexts", () => {
  it("collects rendered text and placeholders, skips hidden text", () => {
    const { container } = render(
      <div>
        <span>Profile</span>
        <span hidden>Secret</span>
        <span className="sr-only">Close</span>
        <span aria-hidden="true">⌘K</span>
        <input placeholder="Search …" />
      </div>,
    );
    expect(collectVisibleTexts(container)).toEqual(["Profile", "⌘K", "Search …"]);
  });
});
