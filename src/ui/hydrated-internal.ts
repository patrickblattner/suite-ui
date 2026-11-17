import * as React from "react";

// Whether the app is hydrated never changes once it is, so there is nothing to subscribe to.
const subscribeNothing = () => () => undefined;

// `false` on the server and on the hydrating client render, `true` after hydration and in a
// client-only render. A portal into `document.body` mounts only once this is `true`: the server has
// no `document.body`, so it renders nothing, and the hydrating render has to match that; anything
// else would not match the server's HTML, and React would regenerate the tree, input typed before
// hydration lost (#926, #930).
function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

export { useHydrated };
