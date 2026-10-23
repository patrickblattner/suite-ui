import { useMediaQuery } from "../lib/use-media-query.js";

// Whether the person asks for less motion: the slide's animations and transitions then play in no
// time, each still after its delay (`SUI-FEATURE-234` §Weniger Bewegung).
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
