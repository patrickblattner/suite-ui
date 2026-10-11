import * as React from "react";

// The package's own `Esc` layers (`GL-UI-007`: innermost `Esc` first): a maximized preview, an open
// split preview. One document listener hands each `Esc` to the innermost layer: the one activated
// last among those whose element holds the focus, else the one activated last. The order is explicit
// instead of resting on where each listener sits. An `Esc` that an inner
// layer outside this stack took first (an open select, menu, tooltip or dialog prevents its default)
// or that an editor kept (stopped propagation) reaches no layer.
type Layer = { current: () => void; element: HTMLElement | null };

const layers: Layer[] = [];

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  const target = event.target instanceof Node ? event.target : null;
  let layer = layers.at(-1);
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const candidate = layers[index];
    if (target !== null && candidate?.element?.contains(target)) {
      layer = candidate;
      break;
    }
  }
  if (layer === undefined) return;
  event.preventDefault();
  layer.current();
}

// While `active`, `onEscape` is a package `Esc` layer; `element` is where it lives, so with several
// open side by side the one holding the focus is the innermost.
function useEscapeLayer(
  active: boolean,
  onEscape: () => void,
  element: HTMLElement | null = null,
): void {
  const handler = React.useRef(onEscape);
  React.useEffect(() => {
    handler.current = onEscape;
  });
  React.useEffect(() => {
    if (!active) return;
    const layer: Layer = { current: () => handler.current(), element };
    if (layers.length === 0) document.addEventListener("keydown", onKeyDown);
    layers.push(layer);
    return () => {
      layers.splice(layers.indexOf(layer), 1);
      if (layers.length === 0) document.removeEventListener("keydown", onKeyDown);
    };
  }, [active, element]);
}

export { useEscapeLayer };
