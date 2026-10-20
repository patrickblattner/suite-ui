import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { CopyIcon } from "lucide-react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { PRESSED_FILL_CLASS } from "../lib/pressed-fill.js";
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

const USAGE = { count: 3, active: false, onToggle: () => {} };

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
  // SUI-FEATURE-095 AC 1, 3: maximize and the device switch carry the package's one pressed fill.
  it("maximize and the devices carry the shared PRESSED_FILL_CLASS", () => {
    render(<Preview />);
    for (const id of ["preview-maximize", "preview-device-desktop", "preview-device-mobile"]) {
      const classes = screen.getByTestId(id).className.split(" ");
      for (const token of PRESSED_FILL_CLASS.split(" ")) expect(classes).toContain(token);
    }
  });

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
      "preview-separator",
      "preview-actions",
      "preview-close",
    ]);
    expect(screen.getByTestId("preview-device")).toHaveClass("ml-auto");
  });

  const RIGHT = [
    "preview-device",
    "preview-maximize",
    "preview-separator",
    "preview-actions",
    "preview-close",
  ];
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
        "preview-separator",
        "preview-actions",
        "preview-close",
      ],
    ],
    [
      "maximize",
      { ...FULL, maximize: undefined },
      [
        "preview-language",
        "preview-status",
        "preview-device",
        "preview-separator",
        "preview-actions",
        "preview-close",
      ],
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

  it("SUI-FEATURE-003 AC1: the chosen device is filled, the other stays outline", () => {
    render(<Preview />);
    const desktop = screen.getByRole("radio", { name: "Desktop" });
    const mobile = screen.getByRole("radio", { name: "Mobile" });
    const filled = ["pressed:bg-primary", "pressed:text-primary-foreground"];
    for (const button of [desktop, mobile]) {
      expect(button).toHaveClass(...filled, "pressed:border-primary");
      expect(button).toHaveClass("pressed:hover:bg-primary-hover", "border");
    }
    expect(desktop).toHaveAttribute("aria-checked", "true");
    expect(mobile).toHaveAttribute("aria-checked", "false");
    fireEvent.click(mobile);
    expect(mobile).toHaveAttribute("aria-checked", "true");
    expect(desktop).toHaveAttribute("aria-checked", "false");
  });

  it.each([
    ["device, maximize and actions", FULL],
    ["device and actions", { ...FULL, maximize: undefined }],
    ["maximize and actions", { ...FULL, device: undefined }],
  ] as const)(
    "SUI-FEATURE-003 AC2: with %s one separator stands before the first action",
    (_, props) => {
      render(<PreviewToolbar {...props} />);
      const separators = screen.getAllByTestId("preview-separator");
      expect(separators).toHaveLength(1);
      const separator = separators[0]!;
      expect(separator).toHaveAttribute("aria-hidden", "true");
      expect(separator).toHaveClass("w-px", "h-8", "bg-border");
      expect(separator.nextElementSibling).toBe(screen.getByTestId("preview-actions"));
    },
  );

  it.each([
    ["without actions", { ...FULL, actions: undefined }],
    ["without device and maximize", { ...FULL, device: undefined, maximize: undefined }],
  ] as const)("SUI-FEATURE-003 AC3: %s no separator", (_, props) => {
    render(<PreviewToolbar {...props} />);
    expect(screen.queryByTestId("preview-separator")).not.toBeInTheDocument();
  });

  it("SUI-FEATURE-004 AC1: the row and the preview header show the usage button first", () => {
    const actions: RowActionSet = { ...ENTRY, usage: USAGE };
    render(
      <>
        <Table>
          <TableBody>
            <TableRow>
              <RowActions {...actions} data-testid="row-cell" />
            </TableRow>
          </TableBody>
        </Table>
        <PreviewToolbar {...FULL} actions={actions} />
      </>,
    );
    const labels = (root: HTMLElement) =>
      within(root)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"));
    const row = labels(screen.getByTestId("row-cell"));
    expect(row[0]).toBe("Used by (3)");
    expect(labels(screen.getByTestId("preview-actions"))).toEqual(row);
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

// `SUI-FEATURE-067`: in a narrow column the toolbar folds its actions into ⋯, edit last, then wraps
// the rest into a second line; Close stays top right. The layout is modelled: the toolbar is
// `available` wide and every button in it takes 50 px.
describe("PreviewToolbar in a narrow column (SUI-FEATURE-067)", () => {
  let available = 900;
  const observers: ResizeObserverCallback[] = [];
  const watched: Element[] = [];
  const isToolbar = (el: HTMLElement) => el.dataset.testid === "preview-toolbar";
  beforeEach(() => {
    available = 900;
    observers.length = 0;
    watched.length = 0;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push(callback);
        }
        observe(target: Element) {
          watched.push(target);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return isToolbar(this) ? available : 0;
    });
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return isToolbar(this) ? this.querySelectorAll("button").length * 50 : 0;
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Full: language, two devices, maximize, Copy, Edit, Delete and Close are 8 buttons (400 px);
  // edit kept beside ⋯ are 7 (350 px); ⋯ alone are 6 (300 px).
  const resize = (width: number) => {
    available = width;
    act(() => observers.forEach((callback) => callback([], {} as ResizeObserver)));
  };
  const toolbar = () => screen.getByTestId("preview-toolbar");
  const actionLabels = () =>
    within(screen.getByTestId("preview-actions"))
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
  const menuEntries = () => {
    const trigger = within(screen.getByTestId("preview-actions")).getByTestId("row-menu");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    return [...screen.getByRole("menu").children].map((child) =>
      child.getAttribute("role") === "separator" ? "—" : child.textContent,
    );
  };

  // #144: a content language picked through the select's own list, by keyboard, while the toolbar
  // is wrapped: the refold builds the select anew in the same update the list closes, and the focus
  // goes back to the new select.
  it("a content language picked while wrapped keeps the focus on the language select", async () => {
    // What radix Select needs from the browser and jsdom lacks; taken back after this test.
    const shims = {
      scrollIntoView: () => {},
      hasPointerCapture: () => false,
      releasePointerCapture: () => {},
    };
    const saved = Object.keys(shims).map(
      (name) => [name, Object.getOwnPropertyDescriptor(Element.prototype, name)] as const,
    );
    Object.assign(Element.prototype, shims);
    onTestFinished(() => {
      for (const [name, descriptor] of saved) {
        if (descriptor === undefined) Reflect.deleteProperty(Element.prototype, name);
        else Object.defineProperty(Element.prototype, name, descriptor);
      }
    });
    available = 250;
    function Host() {
      const [value, setValue] = useState("de");
      return (
        <PreviewToolbar
          language={{ value, options: LANGUAGES, onChange: setValue }}
          device={{ value: "desktop", onChange: () => {} }}
          maximize={{ value: false, onChange: () => {} }}
          actions={ENTRY}
          onClose={() => {}}
        />
      );
    }
    render(<Host />);
    expect(toolbar()).toHaveAttribute("data-shrink", "3");
    const trigger = screen.getByTestId("preview-language");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const option = await screen.findByRole("option", { name: "English" });
    option.focus();
    fireEvent.keyDown(option, { key: "Enter" });
    await waitFor(() =>
      expect(screen.getByTestId("preview-language")).toHaveTextContent("English"),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId("preview-language")),
    );
    expect(toolbar()).toHaveAttribute("data-shrink", "3");
  });

  // #143: a language switch changes the width of the toolbar's parts, not of the toolbar; the parts
  // are watched too, so it re-measures.
  it("watches the toolbar and each of its parts", () => {
    render(<Preview />);
    expect(watched).toContain(toolbar());
    for (const part of toolbar().children) expect(watched).toContain(part);
  });

  it("AC3: wide enough, everything stands in one line as before", () => {
    render(<Preview />);
    expect(toolbar()).toHaveAttribute("data-shrink", "0");
    expect(actionLabels()).toEqual(["Copy Home", "Edit Home", "Delete Home"]);
  });

  it("AC2: folds the actions but edit first, delete last in the menu after a separator", () => {
    render(<Preview />);
    resize(380);
    expect(toolbar()).toHaveAttribute("data-shrink", "1");
    expect(actionLabels()).toEqual(["Edit Home", "More for Home"]);
    expect(menuEntries()).toEqual(["Copy", "—", "Delete"]);
  });

  it("AC4: folded entirely, the menu holds the row's actions in the row's order", () => {
    render(<Preview />);
    resize(320);
    expect(toolbar()).toHaveAttribute("data-shrink", "2");
    expect(actionLabels()).toEqual(["More for Home"]);
    expect(menuEntries()).toEqual(["Copy", "Edit", "—", "Delete"]);
  });

  it("AC4: the row's own menu entries keep their place between edit and delete", () => {
    const actions: RowActionSet = {
      ...ENTRY,
      menu: {
        label: "More for Home",
        items: [
          { label: "Export", onSelect: () => {} },
          { label: "Archive", onSelect: () => {}, destructive: true },
        ],
      },
    };
    render(<PreviewToolbar {...FULL} actions={actions} />);
    resize(320);
    expect(menuEntries()).toEqual(["Copy", "Edit", "Export", "—", "Archive", "Delete"]);
  });

  it("AC1: narrow, Close stands top right with ⋯; language, status and device wrap below", () => {
    render(<Preview />);
    resize(200);
    expect(toolbar()).toHaveAttribute("data-shrink", "3");
    const top = screen.getByTestId("preview-toolbar-top");
    const bottom = screen.getByTestId("preview-toolbar-bottom");
    expect([...toolbar().children]).toEqual([top, bottom]);
    expect(within(top).getAllByRole("button").at(-1)).toBe(screen.getByTestId("preview-close"));
    expect(within(top).getByTestId("preview-actions")).toBeInTheDocument();
    expect([...bottom.children].map((el) => el.getAttribute("data-testid"))).toEqual([
      "preview-language",
      "preview-status",
      "preview-zoom",
      "preview-device",
    ]);
  });

  it("restores in reverse order as the column widens", () => {
    render(<Preview />);
    resize(200);
    expect(toolbar()).toHaveAttribute("data-shrink", "3");
    resize(320);
    expect(toolbar()).toHaveAttribute("data-shrink", "2");
    resize(380);
    expect(toolbar()).toHaveAttribute("data-shrink", "1");
    resize(900);
    expect(toolbar()).toHaveAttribute("data-shrink", "0");
    expect(order()).toEqual([
      "preview-language",
      "preview-status",
      "preview-zoom",
      "preview-device",
      "preview-maximize",
      "preview-separator",
      "preview-actions",
      "preview-close",
    ]);
  });

  it("never wraps Close into a line of its own", () => {
    render(<PreviewToolbar language={FULL.language} status="published" onClose={() => {}} />);
    resize(20);
    expect(toolbar()).toHaveAttribute("data-shrink", "2");
    expect(screen.queryByTestId("preview-toolbar-top")).not.toBeInTheDocument();
  });

  it("SUI-FEATURE-003 AC4: folded, the separator stays before the actions", () => {
    render(<Preview />);
    for (const width of [380, 320]) {
      resize(width);
      expect(screen.getAllByTestId("preview-separator")).toHaveLength(1);
      expect(screen.getByTestId("preview-separator").nextElementSibling).toBe(
        screen.getByTestId("preview-actions"),
      );
    }
  });

  it("SUI-FEATURE-003 AC4: wrapped, the separator stands with maximize and the actions", () => {
    render(<Preview />);
    resize(200);
    const top = screen.getByTestId("preview-toolbar-top");
    expect([...top.children].map((el) => el.getAttribute("data-testid"))).toEqual([
      "preview-maximize",
      "preview-separator",
      "preview-actions",
      "preview-close",
    ]);
  });

  it("SUI-FEATURE-003 AC4: wrapped without maximize, no separator is left at the line's edge", () => {
    render(<PreviewToolbar {...FULL} maximize={undefined} />);
    resize(150);
    expect(toolbar()).toHaveAttribute("data-shrink", "3");
    expect(screen.queryByTestId("preview-separator")).not.toBeInTheDocument();
  });

  it("SUI-FEATURE-004 AC6: folded, Used by is the first entry of the menu", () => {
    render(<PreviewToolbar {...FULL} actions={{ ...ENTRY, usage: USAGE }} />);
    resize(320);
    expect(toolbar()).toHaveAttribute("data-shrink", "2");
    expect(menuEntries()).toEqual(["Used by (3)", "Copy", "Edit", "—", "Delete"]);
  });

  it("SUI-FEATURE-066 AC8: folded actions keep their hint, a locked one its reason", () => {
    render(
      <PreviewToolbar
        {...FULL}
        actions={{ ...ENTRY, deleteDisabledText: "Still used on 2 pages." }}
      />,
    );
    resize(320);
    const trigger = within(screen.getByTestId("preview-actions")).getByTestId("row-menu");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const menu = screen.getByRole("menu");
    const description = (name: string) => {
      const item = within(menu).getByRole("menuitem", { name });
      return document.getElementById(item.getAttribute("aria-describedby") ?? "")?.textContent;
    };
    expect(description("Copy")).toBe("Copy Home");
    expect(description("Edit")).toBe("Edit Home");
    expect(description("Delete")).toBe("Still used on 2 pages.");
    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toHaveAttribute("data-disabled");
  });

  it("SUI-FEATURE-072 AC3: the row's running action shows the same state; folded, its entry is locked", () => {
    const onClick = vi.fn();
    const running: RowActionSet = {
      ...ENTRY,
      extra: [{ label: "Copy", icon: CopyIcon, onClick, busy: true }],
    };
    render(<PreviewToolbar {...FULL} actions={running} />);
    const copy = within(screen.getByTestId("preview-actions")).getByRole("button", {
      name: "Copy Home",
    });
    expect(copy).toHaveAttribute("aria-busy", "true");
    expect(within(copy).getByTestId("button-loading")).toBeInTheDocument();
    fireEvent.click(copy);
    resize(320);
    expect(toolbar()).toHaveAttribute("data-shrink", "2");
    const trigger = within(screen.getByTestId("preview-actions")).getByTestId("row-menu");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const entry = within(screen.getByRole("menu")).getByRole("menuitem", { name: "Copy" });
    expect(entry).toHaveAttribute("data-disabled");
    fireEvent.click(entry);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps the device switch beside Close when nothing else would stand there", () => {
    render(<PreviewToolbar {...FULL} maximize={undefined} actions={undefined} />);
    resize(20);
    const top = screen.getByTestId("preview-toolbar-top");
    expect([...top.children].map((el) => el.getAttribute("data-testid"))).toEqual([
      "preview-device",
      "preview-close",
    ]);
  });
});
