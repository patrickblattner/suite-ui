import * as React from "react";

const TABBABLE =
  "a[href], button, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])";

function tabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (node) =>
      !(node as HTMLButtonElement).disabled &&
      node.tabIndex >= 0 &&
      (typeof node.checkVisibility !== "function" || node.checkVisibility()),
  );
}

/**
 * Makes `element` modal while `active` (the WAI-ARIA dialog pattern): everything outside it is
 * `inert` except `keep` (its scrim), and Tab and Shift+Tab cycle inside it. Pass the returned handler
 * as the element's `onKeyDown`. Nodes that appear later (a portaled menu the element opens) stay
 * usable; whatever was inert before stays inert afterwards.
 */
function useModalOverlay(
  active: boolean,
  element: HTMLElement | null,
  keep: HTMLElement | null = null,
): (event: React.KeyboardEvent) => void {
  React.useEffect(() => {
    if (!active || element === null) return;
    const made: Element[] = [];
    for (let node: Element = element; node.parentElement !== null; node = node.parentElement) {
      if (node === document.body) break;
      for (const sibling of node.parentElement.children) {
        if (sibling === node || sibling === keep || sibling.hasAttribute("inert")) continue;
        if (sibling instanceof HTMLScriptElement || sibling instanceof HTMLStyleElement) continue;
        sibling.setAttribute("inert", "");
        made.push(sibling);
      }
    }
    return () => {
      for (const node of made) node.removeAttribute("inert");
    };
  }, [active, element, keep]);

  return React.useCallback(
    (event: React.KeyboardEvent) => {
      if (!active || element === null || event.key !== "Tab") return;
      const order = tabbables(element);
      const first = order[0];
      const last = order.at(-1);
      if (first === undefined || last === undefined) return;
      const at = document.activeElement;
      if (event.shiftKey && (at === first || !element.contains(at))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (at === last || !element.contains(at))) {
        event.preventDefault();
        first.focus();
      }
    },
    [active, element],
  );
}

export { useModalOverlay };
