import { toast as sonnerToast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast, toastDurationFor } from "./toaster.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// The duration the wrapper hands to sonner for one call.
function durationOf(variant: "success" | "error" | "warning" | "info", call: () => void): unknown {
  const spy = vi.spyOn(sonnerToast, variant).mockReturnValue(1);
  call();
  return spy.mock.calls[0]?.[1]?.duration;
}

describe("toast", () => {
  it("adds 50 ms per word to the variant's base", () => {
    expect(durationOf("success", () => toast.success("eins zwei drei"))).toBe(2150);
  });

  it("caps a long error at 12 000 ms", () => {
    const words = Array.from({ length: 300 }, () => "Wort").join(" ");
    expect(durationOf("error", () => toast.error(words))).toBe(12000);
  });

  it("raises an explicit duration to the variant's base", () => {
    expect(durationOf("info", () => toast.info("a", { duration: 0 }))).toBe(1000);
    expect(durationOf("warning", () => toast.warning("a", { duration: 500 }))).toBe(3000);
  });

  it("gives a non-finite explicit duration the cap", () => {
    expect(durationOf("error", () => toast.error("x", { duration: Number.NaN }))).toBe(12000);
    expect(
      durationOf("success", () => toast.success("x", { duration: Number.POSITIVE_INFINITY })),
    ).toBe(12000);
  });

  it("caps an explicit duration and keeps one within the range", () => {
    expect(durationOf("info", () => toast.info("a", { duration: 60000 }))).toBe(12000);
    expect(durationOf("success", () => toast.success("a", { duration: 5000 }))).toBe(5000);
  });

  it("lets toastDurationFor return the duration toast sets", () => {
    const cases = [
      ["info", 0],
      ["warning", 500],
      ["error", Number.NaN],
      ["success", Number.POSITIVE_INFINITY],
      ["info", 60000],
      ["success", 5000],
    ] as const;
    for (const [variant, duration] of cases) {
      const set = durationOf(variant, () => toast[variant]("a", { duration }));
      vi.restoreAllMocks();
      expect(toastDurationFor("a", variant, duration)).toBe(set);
    }
    expect(toastDurationFor("eins zwei drei", "success")).toBe(2150);
    expect(toastDurationFor("a", "info", undefined)).toBe(1050);
  });

  it("gives a React node its variant's base", () => {
    expect(durationOf("warning", () => toast.warning(<strong>Achtung</strong>))).toBe(3000);
    expect(toastDurationFor(<span>x</span>, "info")).toBe(1000);
  });

  it("keeps sonner's dismiss", () => {
    expect(toast.dismiss).toBe(sonnerToast.dismiss);
  });
});
