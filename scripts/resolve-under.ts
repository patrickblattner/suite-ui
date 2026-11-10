// The repo's one resolve-then-check helper (GL-CODE-020 rev 5, form 3): a path segment that is not a
// literal, a self-computed segment or an enumerated entry (a lockfile key, a JSON field, argv, env)
// is resolved against its root and accepted only when it lies strictly under it. The root itself is
// rejected too: the callers always mean a child.

import { isAbsolute, relative, resolve, sep } from "node:path";

export function resolveUnder(root: string, rel: string): string | undefined {
  const path = resolve(root, rel);
  const inside = relative(resolve(root), path);
  if (inside === "" || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    return undefined;
  }
  return path;
}
