import * as React from "react";

// The width the bar's content needs. `scrollWidth` misses content that only reaches into the bar's
// end padding, so the last part's edge is held against the padding as well.
function required(node: HTMLElement): number {
  const last = node.lastElementChild;
  if (last === null) return node.scrollWidth;
  const end =
    node.getBoundingClientRect().right - parseFloat(getComputedStyle(node).paddingRight || "0");
  const excess = last.getBoundingClientRect().right - end;
  return Math.max(node.scrollWidth, excess > 0.5 ? node.clientWidth + Math.ceil(excess) : 0);
}

/**
 * How many fold steps a one-line bar needs (`SUI-FEATURE-067`, `SUI-FEATURE-090`). The bar measures
 * its own width, never the window's: while its content overflows it folds one step more; each step
 * remembers the width it needed, and once the bar is that wide again it steps back. `maxSteps` caps
 * the count. Pass `attach` as the bar's `ref`.
 *
 * It re-measures when the bar's box or any of its direct children's boxes changes (a folded
 * control, a font), and once per fold step; never on a render that changes nothing. `content` names
 * what the bar shows (its language, its texts): when it changes, the remembered widths are stale, so
 * the bar starts over from no fold and folds again as far as it needs. `extra` reads the width of
 * content that comes, goes or changes width without a refold (a running operation's status): each
 * step remembers its width without it and is held against that plus `extra` as it is then, so the bar
 * steps only where it needs to. Each time the bar settles on the step it shows, `settled` gets the
 * step it would stand at without that content: the steps that content holds are the difference.
 *
 * A step can swap the control that has the focus for another one (a folded button, the ⋯, a control
 * that moves line). The bar keeps track of its control that owns the focus — the focused control, or
 * the one whose menu or list (`aria-controls`) holds it — from `focusin`, so it is known even when
 * the focus is gone by the time a step starts (a list that closes in the same update). Once the steps
 * have settled and the focus was lost, it returns to that control if it can take it; otherwise
 * `fallback` gets the control (locked) or `null` (gone) and names the target.
 */
function useFoldSteps(
  maxSteps: number,
  content = "",
  fallback?: (bar: HTMLElement, from: HTMLElement | null) => HTMLElement | null,
  extra?: (bar: HTMLElement) => number,
  settled?: (bar: HTMLElement, bare: number) => void,
): {
  attach: (node: HTMLElement | null) => void;
  steps: number;
} {
  const [root, setRoot] = React.useState<HTMLElement | null>(null);
  const [steps, setSteps] = React.useState(0);
  // The measurement reads these from callbacks that outlive a render.
  const current = React.useRef(0);
  const max = React.useRef(maxSteps);
  const needed = React.useRef<number[]>([]);
  const focused = React.useRef<string | null>(null);
  const lost = React.useRef(fallback);
  const apart = React.useRef(extra);
  const rest = React.useRef(settled);
  // The step the bar's layout shows; a step taken is shown once its render is laid out.
  const shown = React.useRef(0);
  React.useLayoutEffect(() => {
    lost.current = fallback;
    apart.current = extra;
    rest.current = settled;
  });

  // The bar's control that owns the focus, kept from `focusin`; `focused` is the one noted for a step.
  const owner = React.useRef<string | null>(null);

  const ownerOf = React.useCallback((node: HTMLElement, target: Element): string | null => {
    let control = node.contains(target) ? target : null;
    // In a popup the bar opened: its trigger in the bar names it by `aria-controls`.
    for (let at: Element | null = target; control === null && at !== null; at = at.parentElement) {
      if (at.id !== "") control = node.querySelector(`[aria-controls="${at.id}"]`);
    }
    return control?.closest("[data-testid]")?.getAttribute("data-testid") ?? null;
  }, []);

  const noteFocus = React.useCallback(
    (node: HTMLElement) => {
      if (focused.current !== null) return;
      const active = document.activeElement;
      const lostAlready = active === null || active === document.body || !active.isConnected;
      focused.current = lostAlready ? owner.current : ownerOf(node, active);
    },
    [ownerOf],
  );

  const settle = React.useCallback((node: HTMLElement) => {
    const id = focused.current;
    focused.current = null;
    if (id === null) return;
    // Once the event that started the steps is done: Enter on a list option would otherwise click the
    // control the focus returns to, and reopen a select.
    setTimeout(() => {
      const active = document.activeElement;
      if (!node.isConnected || (active !== null && active !== document.body && active.isConnected))
        return;
      const control = node.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      const takes = control !== null && !(control as HTMLButtonElement).disabled;
      if (takes) control.focus();
      // A control whose other form takes no focus (a sign unfolded to plain text) counts as locked.
      if (document.activeElement !== control) lost.current?.(node, control)?.focus();
    });
  }, []);

  React.useEffect(() => {
    if (root === null) return;
    const enter = (event: FocusEvent) => {
      owner.current = event.target instanceof Element ? ownerOf(root, event.target) : null;
    };
    // Leaving for nothing on purpose (a click on the page) forgets the owner; a control that was
    // removed or locked under the focus keeps it. Chrome fires `focusout` on a focused node it is
    // about to remove, while the node is still connected, so this is decided once the update that
    // removes it is done — after the step it starts has read the owner.
    const leave = (event: FocusEvent) => {
      const from = event.target;
      if (event.relatedTarget !== null || !(from instanceof Element)) return;
      queueMicrotask(() => {
        const active = document.activeElement;
        if (
          (active === null || active === document.body) &&
          from.isConnected &&
          !(from as HTMLButtonElement).disabled
        ) {
          owner.current = null;
        }
      });
    };
    document.addEventListener("focusin", enter);
    document.addEventListener("focusout", leave);
    return () => {
      document.removeEventListener("focusin", enter);
      document.removeEventListener("focusout", leave);
    };
  }, [root, ownerOf]);

  const measure = React.useCallback(
    (node: HTMLElement) => {
      const step = current.current;
      let next = step;
      const width = required(node);
      const aside = apart.current?.(node) ?? 0;
      if (width > node.clientWidth) {
        if (step < max.current) {
          needed.current[step] = width - aside;
          next = step + 1;
        }
      } else if (step > 0 && node.clientWidth >= (needed.current[step - 1] ?? 0) + aside) {
        next = step - 1;
      }
      if (next === step) {
        settle(node);
        // Read off a layout that still shows an earlier step, the bar is not settled yet.
        if (step !== shown.current) return;
        let bare = step;
        while (bare > 0 && node.clientWidth >= (needed.current[bare - 1] ?? 0)) bare -= 1;
        rest.current?.(node, bare);
        return;
      }
      noteFocus(node);
      current.current = next;
      setSteps(next);
    },
    [noteFocus, settle],
  );

  React.useLayoutEffect(() => {
    max.current = maxSteps;
    if (current.current > maxSteps) {
      current.current = maxSteps;
      setSteps(maxSteps);
    }
  }, [maxSteps]);

  // New content: forget the widths measured for the old one and fold again from the start. Every
  // step runs before the paint, so the bar never shows unfolded in between.
  const previous = React.useRef(content);
  React.useLayoutEffect(() => {
    if (previous.current === content) return;
    previous.current = content;
    needed.current = [];
    if (current.current === 0) {
      if (root !== null) measure(root);
      return;
    }
    if (root !== null) noteFocus(root);
    current.current = 0;
    setSteps(0);
  }, [content, root, measure, noteFocus]);

  // Once per step: the folded layout may still overflow, or already fit one step back.
  React.useLayoutEffect(() => {
    shown.current = steps;
    if (root !== null) measure(root);
  }, [root, steps, maxSteps, measure]);

  React.useLayoutEffect(() => {
    if (root === null || typeof ResizeObserver === "undefined") return;
    const resize = new ResizeObserver(() => measure(root));
    const observeChildren = () => {
      for (const child of root.children) resize.observe(child);
    };
    resize.observe(root);
    observeChildren();
    // A fold step swaps children; the new ones are watched, the old ones let go.
    const mutation =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((records) => {
            for (const record of records)
              for (const node of record.removedNodes)
                if (node instanceof Element) resize.unobserve(node);
            observeChildren();
            measure(root);
          });
    mutation?.observe(root, { childList: true });
    return () => {
      resize.disconnect();
      mutation?.disconnect();
    };
  }, [root, measure]);

  return { attach: setRoot, steps };
}

export { useFoldSteps };
