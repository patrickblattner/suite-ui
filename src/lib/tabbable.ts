// Whether `node` is rendered: not `hidden`, and drawn per `checkVisibility` where the browser has it
// (jsdom has not). `css` also counts `visibility: hidden` as not drawn.
function isShown(node: HTMLElement, css = false): boolean {
  if (node.closest("[hidden]") !== null) return false;
  return (
    typeof node.checkVisibility !== "function" ||
    node.checkVisibility(css ? { checkVisibilityCSS: true } : undefined)
  );
}

// The tabbable elements in `root` in document order: among the `candidates`, enabled, not a hidden
// input, `tabIndex` ≥ 0, and shown. `css` as in `isShown`.
function tabbables(root: HTMLElement, candidates = "*", css = false): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(candidates)].filter(
    (node) =>
      node.tabIndex >= 0 &&
      !(node as HTMLButtonElement).disabled &&
      !(node instanceof HTMLInputElement && node.type === "hidden") &&
      isShown(node, css),
  );
}

export { isShown, tabbables };
