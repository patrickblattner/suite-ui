import * as React from "react";

/**
 * How many fold steps a one-line bar needs (`SUI-FEATURE-067`, `SUI-FEATURE-090`). The bar measures
 * its own width, never the window's: while its content overflows it folds one step more; each step
 * remembers the width it needed, and once the bar is that wide again it steps back. `maxSteps` caps
 * the count. Pass `attach` as the bar's `ref`.
 *
 * It re-measures when the bar's box or any of its direct children's boxes changes (a folded
 * control, a font), and once per fold step; never on a render that changes nothing. `content` names
 * what the bar shows (its language, its texts): when it changes, the remembered widths are stale, so
 * the bar starts over from no fold and folds again as far as it needs.
 */
function useFoldSteps(
  maxSteps: number,
  content: string,
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

  const measure = React.useCallback((node: HTMLElement) => {
    const step = current.current;
    let next = step;
    if (node.scrollWidth > node.clientWidth) {
      if (step >= max.current) return;
      needed.current[step] = node.scrollWidth;
      next = step + 1;
    } else if (step > 0 && node.clientWidth >= (needed.current[step - 1] ?? 0)) {
      next = step - 1;
    }
    if (next === step) return;
    current.current = next;
    setSteps(next);
  }, []);

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
    current.current = 0;
    setSteps(0);
  }, [content, root, measure]);

  // Once per step: the folded layout may still overflow, or already fit one step back.
  React.useLayoutEffect(() => {
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
