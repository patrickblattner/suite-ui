import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SLIDE_EDITOR_DOC } from "../../gallery/slide-showcase.js";
import { safeParseSlideDocument } from "./document.js";
import type { SlideDocument } from "./schema.js";
import {
  otherFormatsOf,
  type SaveContext,
  saveDraft,
  useHostReset,
} from "./slide-editor-save-internal.js";
import type { SlideHistory } from "./use-slide-history.js";

const parsed = safeParseSlideDocument(SLIDE_EDITOR_DOC);
if (!parsed.ok) throw new Error("the showcase document is valid");
const document: SlideDocument = parsed.document;

const context = (change: Partial<SaveContext> = {}): SaveContext => ({
  readOnly: false,
  document,
  page: 0,
  elements: document.pages[0]!.elements,
  cropping: undefined,
  cropNatural: undefined,
  storedCrop: undefined,
  apply: vi.fn(),
  setCropping: vi.fn(),
  setSaveRejected: vi.fn(),
  setSaveError: vi.fn(),
  setSaveFailed: vi.fn(),
  setResetFailed: vi.fn(),
  setSaving: vi.fn(),
  setSaved: vi.fn(),
  onSave: vi.fn(() => true),
  ...change,
});

describe("saveDraft (GL-UI-007)", () => {
  it("hands the valid draft on and keeps it as saved on `true`", async () => {
    const ctx = context();
    await expect(saveDraft(ctx)).resolves.toBe(true);
    expect(ctx.onSave).toHaveBeenCalledWith(document);
    expect(ctx.setSaved).toHaveBeenCalledWith(document);
    expect(ctx.setSaveFailed).toHaveBeenLastCalledWith(false);
    expect(ctx.setSaving).toHaveBeenLastCalledWith(false);
  });

  it("does nothing under `readOnly`", async () => {
    const ctx = context({ readOnly: true });
    await expect(saveDraft(ctx)).resolves.toBeUndefined();
    expect(ctx.onSave).not.toHaveBeenCalled();
  });

  it("names the first rule a refused draft breaks and hands nothing on", async () => {
    const ctx = context({ document: { ...document, format: { ...document.format, width: -5 } } });
    await expect(saveDraft(ctx)).resolves.toBe(false);
    expect(ctx.setSaveError).toHaveBeenCalledWith(expect.any(String));
    expect(ctx.onSave).not.toHaveBeenCalled();
  });

  it("counts anything but `true` and a rejection as failed", async () => {
    const declined = context({ onSave: () => false });
    await expect(saveDraft(declined)).resolves.toBe(false);
    expect(declined.setSaveFailed).toHaveBeenLastCalledWith(true);
    expect(declined.setSaveRejected).not.toHaveBeenCalledWith(true);
    const rejected = context({ onSave: () => Promise.reject(new Error("x")) });
    await expect(saveDraft(rejected)).resolves.toBe(false);
    expect(rejected.setSaveRejected).toHaveBeenLastCalledWith(true);
  });
});

describe("otherFormatsOf (SUI-FEATURE-231)", () => {
  it("leaves out the document's own format, by size and name", () => {
    const own = { name: "Wide", width: 1920, height: 1080 };
    const formats = [
      own,
      { ...own },
      { ...own, name: "HD" },
      { ...own, width: 1080, height: 1920 },
    ];
    expect(otherFormatsOf(formats, own)).toEqual([formats[2], formats[3]]);
    expect(otherFormatsOf(undefined, own)).toEqual([]);
  });
});

// R10 review (#993): the host's Reset, awaited (`SUI-FEATURE-383`, #858, #859).
describe("useHostReset", () => {
  const setup = (onReset: () => void | boolean | Promise<void | boolean>) => {
    const history = { reset: vi.fn() } as unknown as SlideHistory;
    const setCropping = vi.fn();
    const setSaveFailed = vi.fn();
    const hook = renderHook(() =>
      useHostReset({ saved: document, onReset, history, setCropping, setSaveFailed }),
    );
    return { hook, history, setCropping, setSaveFailed };
  };

  it("a synchronous host resets at once; false changes nothing", () => {
    const ok = setup(() => undefined);
    expect(ok.hook.result.current.reset()).toBe(true);
    expect(ok.history.reset).toHaveBeenCalledWith(document);
    const refused = setup(() => false);
    expect(refused.hook.result.current.reset()).toBe(false);
    expect(refused.history.reset).not.toHaveBeenCalled();
  });

  it("awaits a promise: resetting meanwhile, a second Reset calls nothing, success resets", async () => {
    let finish!: (value: boolean) => void;
    const onReset = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)));
    const { hook, history, setSaveFailed } = setup(onReset);
    let first!: Promise<unknown> | boolean;
    act(() => {
      first = hook.result.current.reset();
    });
    expect(hook.result.current.resetting).toBe(true);
    // The guard reads this reset's outcome, not an earlier failed save (#859).
    expect(setSaveFailed).toHaveBeenCalledWith(false);
    expect(hook.result.current.reset()).toBe(false);
    expect(onReset).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(true);
      await first;
    });
    expect(await first).toBe(true);
    expect(history.reset).toHaveBeenCalledWith(document);
    expect(hook.result.current.resetting).toBe(false);
    expect(hook.result.current.resetFailed).toBe(false);
  });

  it.each([
    ["resolves false", () => Promise.resolve(false)],
    ["rejects", () => Promise.reject(new Error("host"))],
  ])("a host that %s changes nothing and marks the reset failed (#858)", async (_, onReset) => {
    const { hook, history, setCropping } = setup(onReset);
    let result!: Promise<unknown> | boolean;
    await act(async () => {
      result = hook.result.current.reset();
      await result;
    });
    expect(await result).toBe(false);
    expect(history.reset).not.toHaveBeenCalled();
    expect(setCropping).not.toHaveBeenCalled();
    expect(hook.result.current.resetting).toBe(false);
    expect(hook.result.current.resetFailed).toBe(true);
  });

  it("a host that throws changes nothing", () => {
    const { hook, history } = setup(() => {
      throw new Error("host");
    });
    expect(hook.result.current.reset()).toBe(false);
    expect(history.reset).not.toHaveBeenCalled();
  });
});
