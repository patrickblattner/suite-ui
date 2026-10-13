import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { CopyIcon } from "lucide-react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RowActions, type RowActionSet } from "../list/row-actions.js";
import { type PreviewDevice, PreviewToolbar, type PreviewToolbarProps } from "./preview-toolbar.js";
import type { StatusChipState } from "./status-chip.js";
import { Table, TableBody, TableRow } from "./table.js";

const LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
];

// The app's data: each language has its own publication status.
const STATUS: Record<string, StatusChipState> = {
  de: "published",
  en: "draft",
};

// The selected entry's actions, the same set its table row shows.
const ENTRY: RowActionSet = {
  rowName: "Home",
  extra: [{ label: "Copy", icon: CopyIcon, onClick: () => {}, "data-testid": "row-copy" }],
  onEdit: () => {},
  onDelete: () => {},
};

function Preview({
  selected = true,
  onClose = () => {},
}: {
  selected?: boolean;
  onClose?: () => void;
}) {
  const [language, setLanguage] = useState("de");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [maximized, setMaximized] = useState(false);
  return (
    <PreviewToolbar
      language={{ value: language, options: LANGUAGES, onChange: setLanguage }}
      status={STATUS[language]}
      device={{ value: device, onChange: setDevice }}
      maximize={{ value: maximized, onChange: setMaximized }}
      {...(selected ? { actions: ENTRY } : {})}
      onClose={onClose}
    >
      <span data-testid="preview-zoom">100 %</span>
    </PreviewToolbar>
  );
}

const order = () =>
  [...screen.getByTestId("preview-toolbar").children].map((el) => el.getAttribute("data-testid"));

const FULL: PreviewToolbarProps = {
  language: { value: "de", options: LANGUAGES, onChange: () => {} },
  status: "published",
  device: { value: "desktop", onChange: () => {} },
  maximize: { value: false, onChange: () => {} },
  actions: ENTRY,
  onClose: () => {},
};

describe("PreviewToolbar (GL-UI-008)", () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("en");
  });

  it("orders language · status · extra tools · device · maximize · actions · close", () => {
    render(<Preview />);
    expect(order()).toEqual([
      "preview-language",
      "preview-status",
      "preview-zoom",
      "preview-device",
      "preview-maximize",
      "preview-actions",
      "preview-close",
    ]);
    expect(screen.getByTestId("preview-device")).toHaveClass("ml-auto");
  });

  const RIGHT = ["preview-device", "preview-maximize", "preview-actions", "preview-close"];
  it.each([
    ["language", { ...FULL, language: undefined }, ["preview-status", ...RIGHT]],
    [
      "language with a single option",
      { ...FULL, language: { ...FULL.language!, options: [LANGUAGES[0]!] } },
      ["preview-status", ...RIGHT],
    ],
    ["status", { ...FULL, status: undefined }, ["preview-language", ...RIGHT]],
    [
      "device",
      { ...FULL, device: undefined },
      [
        "preview-language",
        "preview-status",
        "preview-maximize",
        "preview-actions",
        "preview-close",
      ],
    ],
    [
      "maximize",
      { ...FULL, maximize: undefined },
      ["preview-language", "preview-status", "preview-device", "preview-actions", "preview-close"],
    ],
    [
      "actions",
      { ...FULL, actions: undefined },
      ["preview-language", "preview-status", "preview-device", "preview-maximize", "preview-close"],
    ],
  ] as const)("without %s keeps the others in order", (_, props, expected) => {
    render(<PreviewToolbar {...props} />);
    expect(order()).toEqual(expected);
  });

  it.each([
    ["device", { ...FULL, device: undefined }, "preview-maximize"],
    ["device and maximize", { ...FULL, device: undefined, maximize: undefined }, "preview-actions"],
    [
      "device, maximize and actions",
      { ...FULL, device: undefined, maximize: undefined, actions: undefined },
      "preview-close",
    ],
  ] as const)("without %s the right group still stands right", (_, props, first) => {
    render(<PreviewToolbar {...props} />);
    expect(screen.getByTestId(first)).toHaveClass("ml-auto");
  });

  it("Close stands far right, labelled, and closes the preview", async () => {
    const onClose = vi.fn();
    render(<Preview selected={false} onClose={onClose} />);
    const close = screen.getByTestId("preview-close");
    expect(order().at(-1)).toBe("preview-close");
    expect(close).toHaveAccessibleName("Close preview");
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
    cleanup();
    await i18n.changeLanguage("de");
    render(<Preview />);
    expect(screen.getByTestId("preview-close")).toHaveAccessibleName("Vorschau schließen");
  });

  it("the actions stand at the toolbar's height, icon-sm, like maximize and close", () => {
    render(<Preview />);
    for (const button of [
      ...screen.getByTestId("preview-actions").querySelectorAll("button"),
      screen.getByTestId("preview-maximize"),
      screen.getByTestId("preview-close"),
    ]) {
      expect(button).toHaveAttribute("data-size", "icon-sm");
    }
  });

  it("maximize toggles with the same button and leaves with Esc", () => {
    render(<Preview />);
    const button = screen.getByTestId("preview-maximize");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAccessibleName("Maximize preview");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("an Esc an inner layer takes first keeps the preview maximized", () => {
    const onChange = vi.fn();
    render(<PreviewToolbar {...FULL} maximize={{ value: true, onChange }} />);
    const inner = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener("keydown", inner, { capture: true });
    fireEvent.keyDown(document.body, { key: "Escape" });
    document.removeEventListener("keydown", inner, { capture: true });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("without a selected entry the actions are absent", () => {
    render(<Preview selected={false} />);
    expect(screen.queryByTestId("preview-actions")).toBeNull();
    expect(screen.queryByTestId("row-edit")).toBeNull();
  });

  it("shows the row's action set: the same buttons in the same order", () => {
    const onEdit = vi.fn();
    const entry = { ...ENTRY, onEdit };
    render(
      <>
        <Table>
          <TableBody>
            <TableRow>
              <RowActions {...entry} data-testid="row-actions" />
            </TableRow>
          </TableBody>
        </Table>
        <PreviewToolbar {...FULL} actions={entry} />
      </>,
    );
    const buttonsOf = (root: HTMLElement) =>
      within(root)
        .getAllByRole("button")
        .map((button) => [button.getAttribute("aria-label"), button.dataset.variant]);
    const row = buttonsOf(screen.getByTestId("row-actions"));
    const toolbar = buttonsOf(screen.getByTestId("preview-actions"));
    expect(toolbar).toEqual(row);
    expect(toolbar.slice(-2)).toEqual([
      ["Edit Home", "warn"],
      ["Delete Home", "destructive"],
    ]);
    fireEvent.click(within(screen.getByTestId("preview-actions")).getByTestId("row-edit"));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("SUI-FEATURE-066 AC1: a row with edit and menu shows the same group in the same order", () => {
    const entry: RowActionSet = {
      rowName: "Home",
      onEdit: () => {},
      menu: { label: "More for Home", items: [{ label: "Duplicate", onSelect: () => {} }] },
    };
    render(
      <>
        <Table>
          <TableBody>
            <TableRow>
              <RowActions {...entry} data-testid="row-actions" />
            </TableRow>
          </TableBody>
        </Table>
        <PreviewToolbar {...FULL} actions={entry} />
      </>,
    );
    const buttonsOf = (root: HTMLElement) =>
      within(root)
        .getAllByRole("button")
        .map((button) => [button.getAttribute("aria-label"), button.dataset.variant]);
    const toolbar = buttonsOf(screen.getByTestId("preview-actions"));
    expect(toolbar).toEqual(buttonsOf(screen.getByTestId("row-actions")));
    expect(toolbar).toEqual([
      ["Edit Home", "warn"],
      ["More for Home", "outline"],
    ]);
    const menu = within(screen.getByTestId("preview-actions")).getByTestId("row-menu");
    expect(menu.dataset.size).toBe("icon-sm");
  });

  it("uses the package Select for the language, never a button row", () => {
    render(<Preview />);
    const trigger = screen.getByRole("combobox", { name: "Language" });
    expect(trigger).toHaveAttribute("data-slot", "select-trigger");
    expect(trigger).toHaveTextContent("Deutsch");
  });

  it("the language choice drives the status shown", () => {
    Element.prototype.scrollIntoView = () => {};
    render(<Preview />);
    expect(screen.getByTestId("preview-status")).toHaveTextContent("Published");
    expect(screen.getByTestId("preview-status-chip")).toHaveAttribute("data-variant", "success");
    fireEvent.keyDown(screen.getByTestId("preview-language"), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "English" }));
    expect(screen.getByTestId("preview-status")).toHaveTextContent("Draft");
    expect(screen.getByTestId("preview-status-chip")).toHaveAttribute("data-variant", "secondary");
  });

  it("the status chip is a display: not focusable, no button, no pointer, no hover", () => {
    render(<Preview />);
    const chip = screen.getByTestId("preview-status-chip");
    expect(chip.tagName).toBe("SPAN");
    expect(chip).not.toHaveAttribute("tabindex");
    expect(chip).not.toHaveAttribute("role");
    // Only an `a` badge would hover (`[a&]:hover:`); a span never does.
    expect(chip.className).not.toMatch(/(^|\s)(cursor-pointer|hover:)/);
    expect(chip).toHaveTextContent(/^Published$/);
    // Screen readers hear the name before the chip.
    expect(screen.getByTestId("preview-status")).toHaveTextContent("Status: Published");
  });

  it("the device switch is a labelled radio group driven by the arrow keys", () => {
    render(<Preview />);
    const group = screen.getByRole("radiogroup", { name: "Device" });
    const desktop = screen.getByRole("radio", { name: "Desktop" });
    const mobile = screen.getByRole("radio", { name: "Mobile" });
    expect(desktop).toHaveAttribute("aria-checked", "true");
    expect(desktop).toHaveAttribute("tabindex", "0");
    expect(mobile).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(mobile).toHaveAttribute("aria-checked", "true");
    expect(mobile).toHaveFocus();
    fireEvent.click(desktop);
    expect(desktop).toHaveAttribute("aria-checked", "true");
  });

  it("labels come from the package strings", async () => {
    await i18n.changeLanguage("de");
    render(<Preview />);
    expect(screen.getByRole("group", { name: "Vorschau" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sprache" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Gerät" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Mobil" })).toBeInTheDocument();
  });
});
