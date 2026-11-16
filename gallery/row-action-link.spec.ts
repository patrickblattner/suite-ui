import { expect, type Locator, test } from "@playwright/test";

// SUI-FEATURE-331 in a real browser: a row action and a head tool with `href` are links in the look
// of the button beside them, and `external` opens a new tab.

// The look a link must share with the button form: box, fill, border, colour, radius.
const look = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      background: style.backgroundColor,
      border: `${style.borderWidth} ${style.borderStyle}`,
      borderColor: style.borderColor,
      color: style.color,
      radius: style.borderRadius,
      decoration: style.textDecorationLine,
      cursor: style.cursor,
    };
  });

test("row link: an external <a> in the outline button's look; locked without href", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?page=list&actions=1&links=1");
  const row = page.getByTestId("list-actions").nth(1);
  const link = row.getByRole("link", { name: "Top up Event 2 opens in a new tab" });
  await expect(link).toHaveAttribute("href", "https://example.com/top-up");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  const button = page.getByTestId("list-actions").nth(3).getByRole("button", { name: /^Copy/ });
  expect(await look(link)).toEqual(await look(button));
  // Locked on the first row: no href, still a tab stop, the reason as its description.
  const locked = page.getByTestId("list-actions").first().getByTestId("row-top-up");
  await expect(locked).not.toHaveAttribute("href");
  await expect(locked).toHaveAttribute("aria-disabled", "true");
  await locked.focus();
  await expect(locked).toBeFocused();
  await expect(locked).toHaveAccessibleDescription("No payment method on file; add one to top up.");
});

test("head tool link: an external <a> in the ghost tool's look", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?page=editor-bar&links=1");
  const tools = page.getByTestId("editor-header-tools");
  const link = tools.getByRole("link", { name: "Help centre opens in a new tab" });
  await expect(link).toHaveAttribute("href", "https://example.com/help");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  // Released, the Desktop tool is a free ghost tool: the link matches its whole look, fill and colour too.
  const desktop = tools.getByTestId("editor-tool-desktop");
  await desktop.click();
  await expect(desktop).toHaveAttribute("aria-pressed", "false");
  await desktop.blur();
  await page.mouse.move(0, 0);
  // Polled: the released tool fades out of its pressed fill.
  const linkLook = await look(link);
  await expect.poll(() => look(desktop)).toEqual(linkLook);
});
