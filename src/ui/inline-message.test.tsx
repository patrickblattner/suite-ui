import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, describe, expect, it } from "vitest";

import { InlineMessage } from "./inline-message.js";

// SUI-FEATURE-096: the tone's symbol before the text, its status text colour, its role and a word
// for screen readers before the text.
describe("InlineMessage", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it.each([
    ["error", "alert", "lucide-circle-x", "text-destructive-text", "Error:"],
    ["warn", "status", "lucide-triangle-alert", "text-warn-text", "Warning:"],
  ] as const)(
    "tone %s is a %s with its symbol, colour and prefix",
    (tone, role, icon, colour, prefix) => {
      render(
        <InlineMessage tone={tone} id="message" data-testid="message">
          Upload failed.
        </InlineMessage>,
      );
      const message = screen.getByRole(role);
      expect(message).toBe(screen.getByTestId("message"));
      expect(message).toHaveAttribute("id", "message");
      expect(message).toHaveClass(colour, "text-sm");
      expect(message).toHaveTextContent(new RegExp(`^${prefix} Upload failed\\.$`));
      const symbol = message.firstElementChild;
      expect(symbol).toHaveClass(icon);
      expect(symbol).toHaveAttribute("aria-hidden", "true");
      expect(message.querySelector(".sr-only")).toHaveTextContent(prefix);
    },
  );

  it.each([
    ["de", "Fehler:", "Warnung:"],
    ["es", "Error:", "Advertencia:"],
  ] as const)("names the tone in %s", async (lng, error, warn) => {
    await i18n.changeLanguage(lng);
    render(
      <>
        <InlineMessage tone="error">A</InlineMessage>
        <InlineMessage tone="warn">B</InlineMessage>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(`${error} A`);
    expect(screen.getByRole("status")).toHaveTextContent(`${warn} B`);
  });

  it("underlines a link at rest, drops it on hover and keeps it in the tab order", () => {
    render(
      <InlineMessage tone="warn">
        Quota almost used. <a href="#plans">See plans</a>
      </InlineMessage>,
    );
    const message = screen.getByRole("status");
    expect(message).toHaveClass(
      "[&_a]:underline",
      "[&_a]:hover:no-underline",
      "[&_a]:focus-visible:focus-ring",
    );
    const link = screen.getByRole("link", { name: "See plans" });
    expect(link.tabIndex).toBe(0);
    link.focus();
    expect(link).toHaveFocus();
  });
});
