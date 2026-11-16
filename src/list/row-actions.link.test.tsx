import { act, fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { CopyIcon, ExternalLinkIcon, SendIcon } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Table, TableBody, TableRow } from "../ui/table.js";
import {
  foldRowAction,
  type RowAction,
  RowActions,
  type RowActionSet,
  type RowMenuItem,
} from "./row-actions.js";
import { hintOf } from "./test-utils.js";

// SUI-FEATURE-331 AC 6: a link takes no `onClick`, `busy`, or step place, and an action needs one of
// `href` and `onClick`. Each line below must stay a type error, or `npm run typecheck` fails on the
// unused directive.
const base = { label: "Top up", icon: ExternalLinkIcon };
export const linkShapes: RowAction[] = [
  { ...base, href: "https://example.com" },
  { ...base, href: "https://example.com", external: true, disabledText: "No account yet" },
  { ...base, onClick: () => {}, busy: true },
  // @ts-expect-error href and onClick exclude each other
  { ...base, href: "https://example.com", onClick: () => {} },
  // @ts-expect-error a navigation has no duration of its own
  { ...base, href: "https://example.com", busy: true },
  // @ts-expect-error external only with href
  { ...base, onClick: () => {}, external: true },
  // @ts-expect-error neither href nor onClick
  { ...base },
];
// @ts-expect-error a lifecycle step is a state change, never a link
export const linkStep: RowActionSet = { rowName: "Ada", step: { ...base, href: "/costs" } };

const HREF = "https://pay.example.com/top-up";
// A same-tab link is an in-app route, the router's `Link` (rev 3).
const ROUTE = "/costs/top-up";

function renderRow(extra: RowAction[], props: Partial<RowActionSet> = {}) {
  const onRowClick = vi.fn();
  render(
    <Table>
      <TableBody>
        <TableRow onClick={onRowClick}>
          <RowActions
            rowName="Ada"
            extra={extra}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            data-testid="actions"
            {...props}
          />
        </TableRow>
      </TableBody>
    </Table>,
    { wrapper: MemoryRouter },
  );
  return onRowClick;
}

const copy: RowAction = { label: "Copy", icon: CopyIcon, onClick: vi.fn(), "data-testid": "copy" };
const topUp = (over: Partial<Extract<RowAction, { href: string }>> = {}): RowAction => ({
  label: "Top up",
  icon: ExternalLinkIcon,
  href: HREF,
  "data-testid": "top-up",
  ...over,
});

// jsdom has no ResizeObserver; the step fold and an open tooltip's popper use one.
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("en");
});

describe("RowAction link (SUI-FEATURE-331)", () => {
  it("AC1: renders an <a href> in the button's look, named ‹label› ‹rowName›", () => {
    renderRow([copy, topUp({ href: ROUTE })]);
    const link = screen.getByRole("link", { name: "Top up Ada" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", ROUTE);
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
    // The classes and slots of the button beside it: the same look. Beyond them only the locked look,
    // which waits for `aria-disabled`.
    const button = screen.getByRole("button", { name: "Copy Ada" });
    expect(link.className.startsWith(button.className)).toBe(true);
    const extra = link.className.slice(button.className.length).trim().split(" ");
    expect(extra.every((name) => name.includes("aria-disabled:"))).toBe(true);
    for (const name of ["data-slot", "data-variant", "data-size"])
      expect(link.getAttribute(name)).toBe(button.getAttribute(name));
    expect(link.querySelector("svg.lucide-external-link")).toHaveAttribute("aria-hidden", "true");
    expect(link).toHaveTextContent("");
  });

  it("AC1: the hint names the link like the button", () => {
    renderRow([topUp({ href: ROUTE })]);
    expect(hintOf(screen.getByRole("link", { name: "Top up Ada" })).hover1500).toBe("Top up Ada");
  });

  it("AC1: a click on the link never opens the row", () => {
    const onRowClick = renderRow([topUp({ href: ROUTE })]);
    const link = screen.getByRole("link", { name: "Top up Ada" });
    // Cancelled only so jsdom does not try to navigate.
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("AC2: external opens a new tab, its name ends with the screen-reader text; tooltip unchanged", () => {
    renderRow([topUp({ external: true })]);
    const link = screen.getByRole("link", { name: "Top up Ada opens in a new tab" });
    expect(link).toHaveAttribute("href", HREF);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // Labelled: the name carries the label and the suffix exactly once.
    expect(link).toHaveAccessibleName("Top up Ada opens in a new tab");
    // No extra icon.
    expect(link.querySelectorAll("svg")).toHaveLength(1);
    expect(hintOf(link).hover1500).toBe("Top up Ada");
  });

  it.each([
    ["de", "öffnet in neuem Tab"],
    ["es", "se abre en una pestaña nueva"],
  ])("AC2/AC8: %s names the new tab in its language", async (lng, suffix) => {
    await i18n.changeLanguage(lng);
    renderRow([topUp({ external: true })]);
    expect(screen.getByTestId("top-up")).toHaveAccessibleName(`Top up Ada ${suffix}`);
  });

  it("AC3: disabledText — no href, aria-disabled, focusable, hint names the reason, does nothing", () => {
    const onRowClick = renderRow([topUp({ external: true, disabledText: "No account yet." })]);
    const link = screen.getByTestId("top-up");
    expect(link.tagName).toBe("A");
    expect(link).not.toHaveAttribute("href");
    expect(link).not.toHaveAttribute("target");
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("role", "link");
    expect(link).toHaveAttribute("tabindex", "0");
    act(() => link.focus());
    expect(link).toHaveFocus();
    expect(link).toHaveAccessibleDescription("No account yet.");
    // Locked it opens nothing, so its name announces no new tab.
    expect(link).toHaveAccessibleName("Top up Ada");
    // The locked look of the button form.
    expect(link).toHaveClass("aria-disabled:cursor-not-allowed");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(onRowClick).not.toHaveBeenCalled();
    expect(hintOf(link).hover1500).toBe("No account yet.");
  });
});

// A row whose ⋯ holds `items`; returns the ⋯ button and how to open it by keyboard.
function renderMenu(items: RowMenuItem[]) {
  render(
    <Table>
      <TableBody>
        <TableRow>
          <RowActions rowName="Ada" menu={{ label: "More for Ada", items }} />
        </TableRow>
      </TableBody>
    </Table>,
    { wrapper: MemoryRouter },
  );
  const trigger = screen.getByRole("button", { name: "More for Ada" });
  return {
    trigger,
    open: () => {
      act(() => trigger.focus());
      fireEvent.keyDown(trigger, { key: "Enter" });
      return screen.getByRole("menu");
    },
  };
}

describe("RowAction link folded into ⋯ (SUI-FEATURE-331 AC 4)", () => {
  const openFolded = (action: RowAction) => renderMenu([foldRowAction(action, "Ada")]).open();

  it("the entry is an <a> with the same href, target and rel; Enter follows it", () => {
    const entry = within(openFolded(topUp({ external: true }))).getByRole("menuitem");
    expect(entry.tagName).toBe("A");
    expect(entry).toHaveAttribute("href", HREF);
    expect(entry).toHaveAttribute("target", "_blank");
    expect(entry).toHaveAttribute("rel", "noopener noreferrer");
    expect(entry).toHaveAccessibleName("Top up opens in a new tab");
    // Enter clicks the entry: on an <a> the browser follows the link unless the click is cancelled.
    // Checked on the menu's portal container after React's own listener there ran; it cancels then
    // only so jsdom does not try to navigate.
    let followed: { target: EventTarget | null; cancelled: boolean } | undefined;
    const onClick = (event: MouseEvent) => {
      followed = { target: event.target, cancelled: event.defaultPrevented };
      event.preventDefault();
    };
    document.body.addEventListener("click", onClick);
    try {
      entry.focus();
      fireEvent.keyDown(entry, { key: "Enter" });
    } finally {
      document.body.removeEventListener("click", onClick);
    }
    expect(followed).toEqual({ target: entry, cancelled: false });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("same-tab link: href without target or rel", () => {
    const entry = within(openFolded(topUp({ href: ROUTE }))).getByRole("menuitem", {
      name: "Top up",
    });
    expect(entry).toHaveAttribute("href", ROUTE);
    expect(entry).not.toHaveAttribute("target");
  });

  // #637: the router's Link entry carries the classes and data-* attributes of every other entry.
  it("same-tab link: the same classes and data-* attributes as a plain entry", () => {
    const menu = renderMenu([
      foldRowAction(topUp({ href: ROUTE }), "Ada"),
      foldRowAction(copy, "Ada"),
    ]).open();
    const link = within(menu).getByRole("menuitem", { name: "Top up" });
    const plain = within(menu).getByRole("menuitem", { name: "Copy" });
    expect(link.tagName).toBe("A");
    expect(plain.tagName).toBe("DIV");
    expect(link.className).toBe(plain.className);
    const data = (element: HTMLElement) =>
      Object.fromEntries(
        Array.from(element.attributes)
          // `data-discover` is the router's own mark on every `Link`, not the menu's.
          .filter(
            (attribute) => attribute.name.startsWith("data-") && attribute.name !== "data-discover",
          )
          .map((attribute) => [attribute.name, attribute.value]),
      );
    expect(data(link)).toEqual(data(plain));
  });

  it("locked: an <a> without href, aria-disabled, the reason as description, no navigation", () => {
    const menu = openFolded(topUp({ external: true, disabledText: "No account yet." }));
    const entry = within(menu).getByRole("menuitem");
    expect(entry.tagName).toBe("A");
    expect(entry).not.toHaveAttribute("href");
    expect(entry).toHaveAttribute("aria-disabled", "true");
    expect(entry).toHaveAccessibleDescription("No account yet.");
    expect(entry).toHaveAccessibleName("Top up");
    fireEvent.click(entry);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});

// Finding #595: the running entry in the ⋯ shows it runs, as its button would (SUI-FEATURE-072).
describe("RowActionMenu running entry (finding #595)", () => {
  it("shows the working sign for its icon, aria-busy, undimmed; a locked entry stays dimmed", () => {
    const deliver = vi.fn();
    const send = { label: "Deliver", icon: SendIcon, onClick: deliver, busy: true };
    renderMenu([
      foldRowAction(send, "Ada"),
      { label: "Archive", onSelect: vi.fn(), disabled: true, hint: "Not yet." },
    ]).open();
    const [running, locked] = screen.getAllByRole("menuitem");
    expect(running).toHaveAttribute("aria-busy", "true");
    expect(running).toHaveAttribute("data-disabled");
    expect(running!.querySelector("[data-slot=busy]")).toHaveClass("animate-spin");
    expect(running!.querySelector("svg.lucide-send")).toBeNull();
    expect(running).toHaveClass("data-[disabled]:opacity-100", "data-[disabled]:cursor-progress");
    expect(running).not.toHaveClass("data-[disabled]:cursor-not-allowed");
    fireEvent.click(running!);
    expect(deliver).not.toHaveBeenCalled();
    expect(locked).not.toHaveAttribute("aria-busy");
    expect(locked).not.toHaveClass("data-[disabled]:opacity-100");
    expect(locked).toHaveClass("data-[disabled]:cursor-not-allowed");
  });
});

// Finding #596: with an entry's hint bubble open, Esc closes the menu, not the bubble alone, so a
// following Enter fires nothing.
describe("RowActionMenu Esc with an open hint (finding #596)", () => {
  it("Esc closes the bubble and the menu; a following Enter fires no entry", () => {
    vi.useFakeTimers();
    const duplicate = vi.fn();
    const { trigger, open } = renderMenu([
      { label: "Duplicate", onSelect: duplicate, hint: "Makes a copy." },
    ]);
    open();
    const entry = screen.getByRole("menuitem", { name: "Duplicate" });
    fireEvent.pointerMove(entry, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Makes a copy.");
    fireEvent.keyDown(entry, { key: "Escape" });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Enter" });
    expect(duplicate).not.toHaveBeenCalled();
  });
});
