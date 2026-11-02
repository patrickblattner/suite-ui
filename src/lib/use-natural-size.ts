import * as React from "react";

// The natural size of `src` once it has loaded: `null` while it loads, `undefined` without a `src`
// or for one that did not load — its size is not known and will not be (#764).
export function useNaturalSize(
  src: string | undefined,
): { width: number; height: number } | null | undefined {
  const [read, setRead] = React.useState<{
    src: string;
    size: { width: number; height: number } | undefined;
  } | null>(null);
  React.useEffect(() => {
    if (src === undefined) return;
    const image = new Image();
    let live = true;
    image.onload = () => {
      if (live) setRead({ src, size: { width: image.naturalWidth, height: image.naturalHeight } });
    };
    image.onerror = () => {
      if (live) setRead({ src, size: undefined });
    };
    image.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  if (src === undefined) return undefined;
  return read?.src === src ? read.size : null;
}
