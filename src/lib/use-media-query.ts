import * as React from "react";

// Whether `query` matches, following its change events. The MediaQueryList is created once per
// query, not on every render; without `matchMedia` (server, old test DOM) the answer is `false`.
export function useMediaQuery(query: string): boolean {
  const list = React.useMemo(
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(query)
        : null,
    [query],
  );
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (!list) return () => {};
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [list],
  );
  const snapshot = React.useCallback(() => list?.matches ?? false, [list]);
  return React.useSyncExternalStore(subscribe, snapshot, () => false);
}
