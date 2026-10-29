import { act, fireEvent, render, screen } from "@testing-library/react";
import { type ReactElement, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDeleteDialog } from "./confirm-delete-dialog.js";
import { ConfirmDialog } from "./confirm-dialog.js";
import { toast, Toaster } from "./toaster.js";

const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

// sonner's toasts outlive a render: each test leaves none behind.
afterEach(async () => {
  vi.restoreAllMocks();
  act(() => {
    toast.dismiss();
  });
  await wait(500);
});
const toasts = () => document.querySelectorAll("[data-sonner-toast]");

// A ⋯ that opens a confirm, which works busy until the test lets it finish: as an app does, the
// receipt is raised right before the dialog closes. `controlsRef` reaches the row's state for the
// other endings: a failure the dialog stays open for, or a dialog removed with its row.
type Controls = {
  finish?: (failed?: boolean) => void;
  setBusy?: (busy: boolean) => void;
  setMounted?: (mounted: boolean) => void;
};
function Row({ kind, controlsRef }: { kind: "delete" | "archive"; controlsRef: Controls }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(true);
  const finish = (failed = false) => {
    if (failed) {
      // The work failed: the dialog stays open, no longer busy, and the error is raised.
      toast.error("Delete failed.");
      setBusy(false);
      return;
    }
    if (kind === "delete") toast.success("Home deleted.");
    else toast.success("Home archived.", { action: { label: "Undo", onClick: () => {} } });
    setBusy(false);
    setOpen(false);
  };
  Object.assign(controlsRef, { finish, setBusy, setMounted });
  const onConfirm = () => setBusy(true);
  const shared = { open, onOpenChange: setOpen, onConfirm, busy, "data-testid": "confirm" };
  return (
    <>
      <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
        More
      </button>
      {!mounted ? null : kind === "delete" ? (
        <ConfirmDeleteDialog {...shared} object="Home" description="Gone for good." />
      ) : (
        <ConfirmDialog
          {...shared}
          title="Archive Home?"
          description="It stays in the archive."
          confirmLabel="Archive"
          confirmHint="Restore it from the archive at any time."
        />
      )}
      <Toaster />
    </>
  );
}

// Opens the confirm from the ⋯ and confirms; the dialog is busy afterwards.
async function confirmFromTrigger(kind: "delete" | "archive") {
  const controlsRef: Controls = {};
  render(<Row kind={kind} controlsRef={controlsRef} />);
  const trigger = screen.getByTestId("trigger");
  act(() => trigger.focus());
  fireEvent.click(trigger);
  const confirm = await screen.findByTestId("confirm-confirm");
  fireEvent.click(confirm);
  return { trigger, controlsRef };
}

// Where the focus is each time sonner shows a success toast.
function focusAtSuccess(): (Element | null)[] {
  const focus: (Element | null)[] = [];
  const shown = vi.spyOn(sonnerToast, "success");
  shown.mockImplementation(((...args: Parameters<typeof sonnerToast.success>) => {
    focus.push(document.activeElement);
    shown.mockRestore();
    return sonnerToast.success(...args);
  }) as typeof sonnerToast.success);
  return focus;
}

// `SUI-FEATURE-101` rev 9: after a confirm dialog the receipt appears only once the dialog has
// closed and the focus is back on its trigger; never while the dialog works.
describe("toast after a confirm dialog", () => {
  for (const kind of ["delete", "archive"] as const) {
    it(`${kind}: no toast while the dialog works, the receipt once it closed, focus back (AC ${kind === "delete" ? "1" : "2"})`, async () => {
      const focusAtShow = focusAtSuccess();
      const { trigger, controlsRef } = await confirmFromTrigger(kind);
      expect(screen.getByTestId("confirm-confirm")).toHaveAttribute("aria-busy", "true");
      // Another toast raised while the dialog works waits too.
      act(() => {
        toast.info("Synced");
      });
      await wait(200);
      expect(toasts()).toHaveLength(0);
      act(() => controlsRef.finish?.());
      // Raised, the dialog still closing: nothing shows yet.
      expect(toasts()).toHaveLength(0);
      const receipt = await screen.findByText(
        kind === "delete" ? "Home deleted." : "Home archived.",
      );
      expect(screen.queryByTestId("confirm")).toBeNull();
      expect(focusAtShow).toEqual([trigger]);
      expect(trigger).toHaveFocus();
      expect(receipt.closest("[aria-live=polite]")).not.toBeNull();
      expect(await screen.findByText("Synced")).toBeInTheDocument();
      if (kind === "archive") expect(screen.getByRole("button", { name: "Undo" })).toBeVisible();
    });
  }

  it("shows a toast the dialog stays open for, once it is idle again", async () => {
    const { controlsRef } = await confirmFromTrigger("delete");
    act(() => controlsRef.finish?.(true));
    expect(await screen.findByText("Delete failed.")).toBeInTheDocument();
    expect(screen.getByTestId("confirm")).toBeInTheDocument();
  });

  it("shows a toast raised while busy once the dialog turns idle and stays open", async () => {
    const { controlsRef } = await confirmFromTrigger("delete");
    act(() => {
      toast.error("Delete failed.");
    });
    await wait(100);
    expect(toasts()).toHaveLength(0);
    act(() => controlsRef.setBusy?.(false));
    expect(await screen.findByText("Delete failed.")).toBeInTheDocument();
    expect(screen.getByTestId("confirm")).toBeInTheDocument();
  });

  it("shows the receipt of a dialog removed with its row only once the focus is back", async () => {
    const focusAtShow = focusAtSuccess();
    const { trigger, controlsRef } = await confirmFromTrigger("delete");
    act(() => {
      toast.success("Home deleted.");
      controlsRef.setMounted?.(false);
    });
    await screen.findByText("Home deleted.");
    expect(focusAtShow).toEqual([trigger]);
    expect(trigger).toHaveFocus();
  });

  it("holds toast.promise as a whole: no loading toast while the dialog works", async () => {
    const { controlsRef } = await confirmFromTrigger("delete");
    let resolve = () => {};
    let unwrapped: Promise<unknown> = Promise.resolve();
    act(() => {
      unwrapped = toast
        .promise(new Promise<string>((done) => (resolve = () => done("ok"))), {
          loading: "Deleting…",
          success: "Home deleted.",
        })
        .unwrap();
    });
    await wait(200);
    expect(toasts()).toHaveLength(0);
    act(() => controlsRef.finish?.());
    expect(await screen.findByText("Deleting…")).toBeInTheDocument();
    act(() => resolve());
    await expect(unwrapped).resolves.toBe("ok");
    expect(await screen.findAllByText("Home deleted.")).not.toHaveLength(0);
  });

  it("never shows a held toast that is dismissed", async () => {
    const { controlsRef } = await confirmFromTrigger("delete");
    let id: string | number = "";
    act(() => {
      id = toast.info("Synced");
    });
    act(() => {
      toast.dismiss(id);
    });
    act(() => controlsRef.finish?.());
    await screen.findByText("Home deleted.");
    expect(screen.queryByText("Synced")).toBeNull();
  });

  it("shows toasts at once without an open confirm dialog", () => {
    const sonnerSpy = vi.spyOn(sonnerToast, "success");
    render(<Toaster />);
    act(() => {
      toast.success("Saved");
    });
    expect(sonnerSpy).toHaveBeenCalledOnce();
  });
});

// Codex #663: a held `toast.promise` holds only its rendering. A confirm handler that works busy,
// awaits `unwrap()` and then closes, as an app does, ends; the toast shows once the dialog closed.
describe("toast.promise awaited inside a confirm dialog (#663)", () => {
  type Run = (log: string[]) => Promise<unknown>;
  // A confirm whose handler sets busy, awaits `run` and closes; `log` records the order.
  function AwaitingConfirm({ run, log }: { run: Run; log: string[] }) {
    const [open, setOpen] = useState(true);
    const [busy, setBusy] = useState(false);
    const onConfirm = async () => {
      setBusy(true);
      try {
        log.push(`unwrap:${String(await run(log))}`);
      } catch (reason) {
        log.push(`rejected:${String(reason)}`);
      }
      setBusy(false);
      setOpen(false);
    };
    return (
      <>
        <ConfirmDeleteDialog
          open={open}
          onOpenChange={setOpen}
          onConfirm={() => void onConfirm()}
          busy={busy}
          object="Home"
          description="Gone for good."
          data-testid="confirm"
        />
        <Toaster />
      </>
    );
  }

  async function confirmWith(run: Run) {
    const log: string[] = [];
    render(<AwaitingConfirm run={run} log={log} />);
    fireEvent.click(await screen.findByTestId("confirm-confirm"));
    return log;
  }

  it("settles unwrap and the caller's finally while held, shows the result after close", async () => {
    let shownWhileOpen = -1;
    const log = await confirmWith(async (entries) => {
      const value = await toast
        .promise(Promise.resolve("ok"), {
          loading: "Deleting…",
          success: "Deleted.",
          finally: () => {
            entries.push("finally");
          },
        })
        .unwrap();
      shownWhileOpen = toasts().length;
      return value;
    });
    await waitForClose();
    expect(shownWhileOpen).toBe(0);
    expect(log).toEqual(["finally", "unwrap:ok"]);
    expect(await screen.findByText("Deleted.")).toBeInTheDocument();
    expect(log).toEqual(["finally", "unwrap:ok"]);
  });

  it("rejects unwrap while held and shows the error after close", async () => {
    const log = await confirmWith(() =>
      toast
        .promise(Promise.reject(new Error("boom")), { loading: "Deleting…", error: "Failed." })
        .unwrap(),
    );
    await waitForClose();
    expect(log).toEqual(["rejected:Error: boom"]);
    expect(await screen.findByText("Failed.")).toBeInTheDocument();
  });

  it("rejects unwrap with a held caller's finally that throws, as sonner does (#585)", async () => {
    const log = await confirmWith(() =>
      toast
        .promise(Promise.resolve("ok"), {
          loading: "Deleting…",
          success: "Deleted.",
          finally: () => {
            throw new Error("finally failed");
          },
        })
        .unwrap(),
    );
    await waitForClose();
    expect(log).toEqual(["rejected:Error: finally failed"]);
    expect(await screen.findByText("Deleted.")).toBeInTheDocument();
  });

  it("settles a held promise toast that is dismissed; it never shows", async () => {
    const sonnerSpy = vi.spyOn(sonnerToast, "promise");
    const log = await confirmWith(async (entries) => {
      const shown = toast.promise(Promise.resolve("ok"), {
        loading: "Deleting…",
        success: "Deleted.",
        finally: () => {
          entries.push("finally");
        },
      });
      toast.dismiss(shown as unknown as string);
      return shown.unwrap();
    });
    await waitForClose();
    expect(log).toEqual(["finally", "unwrap:ok"]);
    await wait(300);
    expect(toasts()).toHaveLength(0);
    expect(sonnerSpy).not.toHaveBeenCalled();
  });

  it("shows only the result of a promise settled while held, no loading state first (#663)", async () => {
    const sonnerSpy = vi.spyOn(sonnerToast, "promise");
    const { controlsRef } = await confirmFromTrigger("delete");
    let unwrapped: Promise<unknown> = Promise.resolve();
    act(() => {
      unwrapped = toast
        .promise(Promise.resolve("ok"), { loading: "Deleting…", success: "Saved" })
        .unwrap();
    });
    await expect(unwrapped).resolves.toBe("ok");
    const seen: string[] = [];
    const observer = new MutationObserver(() => {
      if (document.body.textContent?.includes("Deleting…")) seen.push("loading");
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    act(() => controlsRef.finish?.());
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    observer.disconnect();
    expect(seen).toEqual([]);
    expect(sonnerSpy).toHaveBeenCalledOnce();
    expect(sonnerSpy.mock.calls[0]?.[1]?.loading).toBeUndefined();
  });

  it("never shows an element result of a held promise toast dismissed before it resolves", async () => {
    const { controlsRef } = await confirmFromTrigger("delete");
    let resolve = () => {};
    let unwrapped: Promise<unknown> = Promise.resolve();
    act(() => {
      const shown = toast.promise(
        new Promise<ReactElement>((done) => (resolve = () => done(<span>Late element</span>))),
        { success: "Saved" },
      );
      toast.dismiss(shown as unknown as string);
      unwrapped = shown.unwrap();
    });
    act(() => resolve());
    await expect(unwrapped).resolves.toMatchObject({ type: "span" });
    act(() => controlsRef.finish?.());
    await screen.findByText("Home deleted.");
    await wait(300);
    expect(screen.queryByText("Late element")).toBeNull();
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("holds an element result without a loading state while the dialog works (CX2)", async () => {
    const { controlsRef } = await confirmFromTrigger("delete");
    let unwrapped: Promise<unknown> = Promise.resolve();
    act(() => {
      unwrapped = toast
        .promise(Promise.resolve(<span>Done element</span>), { success: "Saved" })
        .unwrap();
    });
    await wait(300);
    expect(toasts()).toHaveLength(0);
    expect(screen.queryByText("Done element")).toBeNull();
    act(() => controlsRef.finish?.());
    const element = await screen.findByText("Done element");
    expect(element.closest("[data-sonner-toast]")).not.toBeNull();
    expect(screen.queryByText("Saved")).toBeNull();
    await expect(unwrapped).resolves.toMatchObject({ type: "span" });
  });
});

async function waitForClose() {
  for (let tries = 0; tries < 40 && screen.queryByTestId("confirm") !== null; tries += 1)
    await wait(50);
  expect(screen.queryByTestId("confirm")).toBeNull();
}
