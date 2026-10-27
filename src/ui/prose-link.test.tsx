import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProseLink, proseLinkClass } from "./prose-link.js";

describe("ProseLink", () => {
  it("renders an <a> in the prose-link look in the link colour", () => {
    render(
      <p>
        Read the <ProseLink href="#guide">guide</ProseLink> first.
      </p>,
    );
    const link = screen.getByRole("link", { name: "guide" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "#guide");
    expect(link).toHaveClass("prose-link", "text-primary");
    expect(proseLinkClass).toBe("prose-link text-primary");
  });

  it("hands the look to a router link with asChild", () => {
    render(
      <ProseLink asChild className="font-semibold">
        <a href="/plans" data-testid="router-link">
          Plans
        </a>
      </ProseLink>,
    );
    const link = screen.getByTestId("router-link");
    expect(link).toHaveAttribute("href", "/plans");
    expect(link).toHaveClass("prose-link", "text-primary", "font-semibold");
  });
});
