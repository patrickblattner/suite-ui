import * as React from "react";

// One tooltip behaviour (`GL-UI-016`/`GL-UI-017`): every tooltip, the overflow tooltip included, opens
// after the one hint delay. Radix needs a numeric delay, so this mirrors `--tooltip-hint-delay` in
// styles.css. Apps set no delay of their own.
const TOOLTIP_HINT_DELAY = 1500;

// Radix closes every open bubble on this document event; a bubble opening dispatches it.
const TOOLTIP_OPEN = "tooltip.open";

// Whether an element overflows (scrollWidth > clientWidth), and its text. An input's text is its value;
// a password's value is never read. `null`: the element has no width yet, it is not laid out.
function overflowOf(node: HTMLElement): { isOverflowing: boolean; text: string } | null {
  if (node.clientWidth === 0) return null;
  return {
    isOverflowing: node.scrollWidth > node.clientWidth,
    text:
      node instanceof HTMLInputElement && node.type === "password"
        ? ""
        : node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
          ? node.value
          : (node.textContent ?? ""),
  };
}

// The last input that moved the focus: a press (pointer or touch) or a key. `:focus-visible` alone
// does not tell it: a text field matches it after a press as well. Tracked once, for the whole page.
let lastInput: "key" | "press" = "key";
let trackingInput = false;
function trackInput(): void {
  if (trackingInput) return;
  trackingInput = true;
  document.addEventListener("keydown", () => (lastInput = "key"), { capture: true });
  document.addEventListener("pointerdown", () => (lastInput = "press"), { capture: true });
}

// The element whose keyboard focus opens the bubble (`GL-UI-016` rev 16, Q&A #4643): the nearest
// focusable ancestor, where it carries: a tabbable element (natively focusable, or `tabindex` 0 and
// up) or one with an interactive role (also as a roving `tabindex="-1"` item). A container that only a
// script focuses (`tabindex="-1"` without such a role: the upload list, a drawer's main, the slide
// player, a dialog's content) carries none and ends the search: it never climbs past it to a higher
// tabbable element. Whether it carries is told at the focus, as a roving list sets the `tabindex`
// just before.
const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]";
const INTERACTIVE_ROLES = ["option", "gridcell", "row", "tab", "menuitem"];
const CARRIES = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled):not([type=hidden])",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]:not([tabindex^='-'])",
  ...INTERACTIVE_ROLES.map((role) => `[role=${role}]`),
].join(", ");

// `inside`: the member's element may carry its control (a `Hint`'s span around a lockable control), so
// a focusable element inside it counts first.
function holderOf(node: HTMLElement | null, inside: boolean): HTMLElement | null {
  if (node === null) return null;
  if (inside && !node.matches(FOCUSABLE)) {
    const carried = node.querySelector<HTMLElement>(FOCUSABLE);
    if (carried !== null) return carried;
  }
  return node.closest<HTMLElement>(FOCUSABLE);
}

// The focused holder a keyboard bubble keeps clear of, where it is not the bubble's own element; the
// bubble's placement reads it (`TooltipContent`).
const KeyboardHolderContext = React.createContext<HTMLElement | null>(null);

// The members of each holder that show clipped text on its keyboard focus, by their element: an
// `OverflowTooltip` or a `Hint`. `read` gives a member's clipped full texts at the moment the delay
// has run ([] while it fits).
const membersOf = new Map<HTMLElement, Map<HTMLElement, () => string[]>>();

function inDocumentOrder(nodes: Iterable<HTMLElement>): HTMLElement[] {
  return [...nodes].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

// The overflow tooltip also opens on keyboard focus (`GL-UI-016` rev 16 §Overflow-Tooltip bei
// Tastaturfokus): once its element, or the holder around it (`holderOf`), takes the focus by keyboard
// (`:focus-visible`, after a key, not a press or touch), after the one hint delay. A text in no holder
// shows nothing on focus and gets no tab stop of its own. Every member of a holder counts: the first
// in document order with clipped text opens one bubble with every clipped full text of the holder,
// each on its own line in document order (`lines`); the others stay closed. Opening, it closes every
// other bubble, as radix's own open does. A press anywhere but on a bubble, `Esc`, `Enter` or `Space`
// on the holder (its activation, a click), a scroll and the focus leaving close it, also while it
// waits; a press on a bubble is left to that bubble, which closes itself (#593). The scroll the
// focus itself causes (Tab onto an element out of view) does not count: scrolls count once two frames
// have passed without one. `due`: this member shows the keyboard bubble. `holder`: the element the
// bubble keeps clear of, where it is not the member's own element. `close` resets it, for the root's
// close. `enabled: false` takes no part; `inside` as for `holderOf`.
function useOpenOnKeyboardFocus({
  node,
  enabled,
  read,
  inside = false,
}: {
  node: HTMLElement | null;
  enabled: boolean;
  read: () => string[];
  inside?: boolean;
}): { due: boolean; lines: string[]; holder: HTMLElement | null; close: () => void } {
  const [lines, setLines] = React.useState<string[] | null>(null);
  const holder = React.useMemo(() => holderOf(node, inside), [node, inside]);
  // Read when the delay has run, so the latest one counts without rejoining.
  const readRef = React.useRef(read);
  React.useLayoutEffect(() => {
    readRef.current = read;
  });
  React.useEffect(() => {
    if (!enabled || node === null || holder === null) return;
    trackInput();
    const members = membersOf.get(holder) ?? new Map<HTMLElement, () => string[]>();
    members.set(node, () => readRef.current());
    membersOf.set(holder, members);
    let timer = 0;
    let frame = 0;
    // Two frames without a scroll: the focus's own scroll into view has ended.
    const settle = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => (frame = 0));
      });
    };
    const onScroll = () => {
      if (frame !== 0) settle();
      else stop();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
      else if (
        (event.key === "Enter" || event.key === " ") &&
        event.target instanceof Node &&
        holder.contains(event.target)
      ) {
        stop();
      }
    };
    // A press on the bubble itself is the bubble's: it closes it and keeps the focus (#593). Closed
    // here, the bubble would leave before the press reached it, and the press would land on <body>.
    const onPress = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-slot=tooltip-content]")) {
        return;
      }
      stop();
    };
    const listen = (on: boolean) => {
      if (on) {
        window.addEventListener("pointerdown", onPress, { capture: true });
        window.addEventListener("scroll", onScroll, { capture: true });
        window.addEventListener("keydown", onKey, { capture: true });
      } else {
        window.removeEventListener("pointerdown", onPress, { capture: true });
        window.removeEventListener("scroll", onScroll, { capture: true });
        window.removeEventListener("keydown", onKey, { capture: true });
      }
    };
    function stop() {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      frame = 0;
      listen(false);
      setLines(null);
    }
    const open = () => {
      const all = inDocumentOrder(members.keys()).map((member) => ({
        member,
        texts: members.get(member)?.() ?? [],
      }));
      const first = all.find(({ texts }) => texts.length > 0);
      if (first?.member !== node) return;
      document.dispatchEvent(new CustomEvent(TOOLTIP_OPEN));
      setLines(all.flatMap(({ texts }) => texts));
    };
    const onFocus = () => {
      stop();
      if (lastInput !== "key" || !holder.matches(CARRIES) || !holder.matches(":focus-visible")) {
        return;
      }
      listen(true);
      settle();
      timer = window.setTimeout(open, TOOLTIP_HINT_DELAY);
    };
    holder.addEventListener("focus", onFocus);
    holder.addEventListener("blur", stop);
    return () => {
      stop();
      holder.removeEventListener("focus", onFocus);
      holder.removeEventListener("blur", stop);
      members.delete(node);
      if (members.size === 0) membersOf.delete(holder);
    };
  }, [node, holder, enabled]);
  const close = React.useCallback(() => setLines(null), []);
  const due = enabled && lines !== null;
  return {
    due,
    lines: due ? lines : [],
    holder: holder === node || node?.contains(holder) === true ? null : holder,
    close,
  };
}

export {
  inDocumentOrder,
  KeyboardHolderContext,
  overflowOf,
  TOOLTIP_HINT_DELAY,
  TOOLTIP_OPEN,
  useOpenOnKeyboardFocus,
};
