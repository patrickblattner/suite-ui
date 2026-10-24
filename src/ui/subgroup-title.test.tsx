import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SubgroupTitle } from "./subgroup-title.js";

// GL-UI-010 §Titel & Metadaten: a sub-group title is one step below the section title, 14 px semibold.
describe("SubgroupTitle", () => {
  it("is an h4 in text-sm font-semibold", () => {
    render(<SubgroupTitle>Entrance</SubgroupTitle>);
    const title = screen.getByRole("heading", { level: 4, name: "Entrance" });
    expect(title).toHaveClass("text-sm", "font-semibold");
    expect(title).toHaveAttribute("data-slot", "subgroup-title");
  });

  it("gives its style to a legend with asChild", () => {
    render(
      <fieldset>
        <SubgroupTitle asChild>
          <legend className="mb-2">Exit</legend>
        </SubgroupTitle>
      </fieldset>,
    );
    const title = screen.getByText("Exit");
    expect(title.tagName).toBe("LEGEND");
    expect(title).toHaveClass("text-sm", "font-semibold", "mb-2");
  });
});
