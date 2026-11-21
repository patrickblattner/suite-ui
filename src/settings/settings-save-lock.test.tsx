import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { useState } from "react";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useLeaveGuard } from "../ui/leave-guard.js";
import { SettingsScaffold } from "./settings-scaffold.js";
import { settingsSaveLock } from "./settings-save-lock.js";

const REASON = "Connect the mail server first.";

// A settings page with the page's own leave guard (`SUI-FEATURE-250` rev 9): its submit is locked
// while `locked`, and it always hands the guard the slot from `settingsSaveLock`, locked with the
// reason while one is set. `guarded={false}` leaves `saveLocked` out.
function Page({
  locked,
  onSave,
  guarded = true,
}: {
  locked: boolean;
  onSave: () => Promise<boolean> | boolean;
  guarded?: boolean;
}) {
  const [name, setName] = useState("");
  const dirty = name !== "";
  const { dialog } = useLeaveGuard({
    dirty,
    onLeave: () => {},
    onSave,
    ...(guarded && { saveLocked: settingsSaveLock(locked ? REASON : undefined) }),
  });
  return (
    <>
      <Link to="/elsewhere" data-testid="nav">
        Elsewhere
      </Link>
      <span data-testid="path">{useLocation().pathname}</span>
      <SettingsScaffold
        pageKey="mail"
        title="Mail"
        subtitle="How the instance sends mail."
        body={
          <input
            aria-label="Sender"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        }
        form={{
          dirty,
          onSave: () => {},
          onReset: () => setName(""),
          submitDisabled: locked,
          submitDisabledHint: REASON,
        }}
      />
      {dialog}
    </>
  );
}

function openLeaveDialog(locked: boolean, guarded = true) {
  const onSave = vi.fn(() => true);
  const page = (lock: boolean) => (
    <MemoryRouter initialEntries={["/settings/mail"]}>
      <Page locked={lock} onSave={onSave} guarded={guarded} />
    </MemoryRouter>
  );
  const { rerender } = render(page(locked));
  fireEvent.change(screen.getByLabelText("Sender"), { target: { value: "ops@example.com" } });
  fireEvent.click(screen.getByTestId("nav"));
  return { onSave, relock: (lock: boolean) => rerender(page(lock)) };
}

describe("settingsSaveLock: the settings leave dialog follows the page's locked submit (SUI-FEATURE-250 rev 9 AC 7)", () => {
  it("locked: Save is aria-disabled with the reason, the focus opens on Cancel, Discard and Cancel stay free", async () => {
    openLeaveDialog(true);
    const save = await screen.findByTestId("leave-guard-save");
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).not.toBeDisabled();
    expect(save).toHaveAccessibleDescription(REASON);
    await waitFor(() => expect(screen.getByTestId("leave-guard-cancel")).toHaveFocus());
    expect(screen.getByTestId("leave-guard-cancel")).toBeEnabled();
    expect(screen.getByTestId("leave-guard-discard")).toBeEnabled();
  });

  it("locked: a press on Save, by click or Enter, never calls the page's onSave and the dialog stays", async () => {
    const { onSave } = openLeaveDialog(true);
    const save = await screen.findByTestId("leave-guard-save");
    fireEvent.click(save);
    save.focus();
    fireEvent.keyDown(save, { key: "Enter" });
    fireEvent.keyUp(save, { key: "Enter" });
    await new Promise((done) => setTimeout(done, 50));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId("leave-guard")).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/settings/mail");
  });

  // #1004 (Codex CX1): `Enter` in the dialog answers like its Save; locked, it saves nothing, whether
  // the dialog itself or any of its controls has the focus.
  it.each(["dialog", "leave-guard-cancel", "leave-guard-discard", "leave-guard-save"])(
    "locked: Enter on %s never calls the page's onSave",
    async (where) => {
      const { onSave } = openLeaveDialog(true);
      const dialog = await screen.findByTestId("leave-guard");
      const target = where === "dialog" ? dialog : screen.getByTestId(where);
      target.focus();
      fireEvent.keyDown(target, { key: "Enter" });
      await new Promise((done) => setTimeout(done, 50));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByTestId("path")).toHaveTextContent("/settings/mail");
    },
  );

  it("free: Enter on the dialog itself saves, as before", async () => {
    const { onSave } = openLeaveDialog(false);
    fireEvent.keyDown(await screen.findByTestId("leave-guard"), { key: "Enter" });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it("locked: Discard leaves without saving", async () => {
    const { onSave } = openLeaveDialog(true);
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/elsewhere"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("free (no reason): Save is free, takes the opening focus and saves", async () => {
    const { onSave } = openLeaveDialog(false);
    const save = await screen.findByTestId("leave-guard-save");
    expect(save).not.toHaveAttribute("aria-disabled");
    await waitFor(() => expect(save).toHaveFocus());
    fireEvent.click(save);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it("a lock that comes or goes with the dialog open keeps the focused Save, the same element", async () => {
    const { relock } = openLeaveDialog(false);
    const save = await screen.findByTestId("leave-guard-save");
    await waitFor(() => expect(save).toHaveFocus());
    relock(true);
    expect(screen.getByTestId("leave-guard-save")).toBe(save);
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAccessibleDescription(REASON);
    expect(save).toHaveFocus();
    relock(false);
    expect(screen.getByTestId("leave-guard-save")).toBe(save);
    expect(save).not.toHaveAttribute("aria-disabled");
    expect(save).toHaveFocus();
  });

  it("without saveLocked Save is free and takes the opening focus", async () => {
    openLeaveDialog(false, false);
    const save = await screen.findByTestId("leave-guard-save");
    expect(save).not.toHaveAttribute("aria-disabled");
    await waitFor(() => expect(save).toHaveFocus());
  });
});

// AC 7: the guard's chunk does not grow by the `Hint`. No module `useLeaveGuard` reaches through its
// runtime imports pulls in `ui/hint`; the settings helper carries it, and its import of the guard is
// type-only.
describe("the leave guard bundles no Hint (SUI-FEATURE-250 rev 8 AC 7)", () => {
  const runtimeImports = (file: string): string[] =>
    [
      ...readFileSync(file, "utf8").matchAll(/^import\s+(?!type\b)[^;]*?from\s+"(\.[^"]+)";/gms),
    ].map((match) => resolve(dirname(file), match[1]!.replace(/\.js$/, "")));
  const source = (stem: string): string => {
    for (const ext of [".tsx", ".ts"]) {
      try {
        readFileSync(stem + ext);
        return stem + ext;
      } catch {
        // the other extension
      }
    }
    throw new Error(`no source for ${stem}`);
  };
  const reach = (entry: string): Set<string> => {
    const seen = new Set<string>();
    const queue = [source(entry)];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const stem of runtimeImports(file)) queue.push(source(stem));
    }
    return seen;
  };
  const hint = resolve("src/ui/hint.tsx");

  it("ui/leave-guard reaches no ui/hint", () => {
    const reached = reach(resolve("src/ui/leave-guard"));
    // The walk follows the guard's own imports (its dialog and button) …
    expect(reached).toContain(resolve("src/ui/dialog.tsx"));
    expect(reached).toContain(resolve("src/ui/button.tsx"));
    // … and none of them pulls in the Hint or the surfaces' Hint wrapper.
    expect(reached).not.toContain(hint);
    expect(reached).not.toContain(resolve("src/lib/hinted-save.tsx"));
  });

  it("the settings helper carries the Hint, its import of the guard is type-only", () => {
    const reached = reach(resolve("src/settings/settings-save-lock"));
    expect(reached).toContain(hint);
    expect(reached).not.toContain(resolve("src/ui/leave-guard.tsx"));
  });
});
