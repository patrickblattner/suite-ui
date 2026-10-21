import * as React from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(QUERY).matches
  );
}

// Whether the person asks for less motion: the slide's animations and transitions then play in no
// time, each still after its delay (`SUI-FEATURE-234` §Weniger Bewegung).
export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribe, snapshot, () => false);
}
