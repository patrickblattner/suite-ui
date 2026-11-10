// @vitest-environment node
import { join } from "node:path";

import { resolveUnder } from "./resolve-under";

// #861 (GL-CODE-020 rev 5, form 3): resolve, then check against the root.
describe("resolveUnder", () => {
  const root = "/repo/node_modules";

  it("returns a child of the root, resolved", () => {
    expect(resolveUnder(root, "left-pad")).toBe(join(root, "left-pad"));
    expect(resolveUnder(root, "a/./b/../c")).toBe(join(root, "a", "c"));
    expect(resolveUnder(root, join(root, "x"))).toBe(join(root, "x"));
  });

  it("rejects a path that escapes the root", () => {
    expect(resolveUnder(root, "../../x")).toBeUndefined();
    expect(resolveUnder(root, "..")).toBeUndefined();
    expect(resolveUnder(root, "/etc/passwd")).toBeUndefined();
    expect(resolveUnder(root, "../node_modules-evil/x")).toBeUndefined();
  });

  it("rejects the root itself", () => {
    expect(resolveUnder(root, "")).toBeUndefined();
    expect(resolveUnder(root, ".")).toBeUndefined();
    expect(resolveUnder(root, "a/..")).toBeUndefined();
  });

  it("takes a name that only starts with two dots as a child", () => {
    expect(resolveUnder(root, "..x")).toBe(join(root, "..x"));
  });
});
