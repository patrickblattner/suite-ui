import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import * as React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider, useSidebar } from "../shell/sidebar-provider.js";
import { EditPanel } from "./edit-panel.js";
import { Input } from "./input.js";
import {
  MediaDetailShell,
  type MediaDetailShellProps,
  MediaUsageList,
} from "./media-detail-shell.js";

afterEach(async () => {
  cleanup();
  localStorage.clear();
  await i18n.changeLanguage("en");
});

function renderShell(props: Partial<MediaDetailShellProps> = {}) {
  const handlers = {
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    onSave: vi.fn(),
    onReset: vi.fn(),
  };
  render(
    <MediaDetailShell
      position={3}
      total={65}
      kind="image"
      src="data:,"
      alt="team-photo.jpg"
      dirty={false}
      saving={false}
      fields={<Input aria-label="Name" />}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

const panel = () => screen.getByTestId("media-detail");

function Toggle() {
  const { toggle } = useSidebar();
  return (
    <button type="button" data-testid="toggle" onClick={toggle}>
      toggle
    </button>
  );
}

describe("MediaDetailShell", () => {
  // AC 1
  it.each([
    ["de", "3 von 65"],
    ["en", "3 of 65"],
    ["es", "3 de 65"],
  ])("%s: the head reads %s", async (lng, text) => {
    await i18n.changeLanguage(lng);
    renderShell();
    expect(screen.getByTestId("media-detail-position")).toHaveTextContent(text);
    expect(screen.getByTestId("media-detail-position")).toHaveAttribute("role", "status");
  });

  it("→ calls onNext, ← calls onPrev, Esc calls onClose", () => {
    const { onPrev, onNext, onClose } = renderShell();
    fireEvent.keyDown(panel(), { key: "ArrowRight" });
    expect(onNext).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(panel(), { key: "ArrowLeft" });
    expect(onPrev).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(panel(), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the head buttons page and close; at the ends ‹ and › stay locked", () => {
    const { onPrev, onNext, onClose } = renderShell({ position: 1, total: 2 });
    fireEvent.click(screen.getByTestId("media-detail-previous"));
    expect(onPrev).not.toHaveBeenCalled();
    expect(screen.getByTestId("media-detail-previous")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByTestId("media-detail-next"));
    expect(onNext).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // #184: the locked chevron dims its icon, not the element, so its focus ring keeps its contrast.
  it("a locked chevron is half-tone, never element opacity", () => {
    renderShell({ position: 1, total: 2 });
    const previous = screen.getByTestId("media-detail-previous");
    expect(previous).toHaveClass("aria-disabled:text-foreground/50");
    expect(previous).not.toHaveClass("aria-disabled:opacity-50");
    // The ghost variant's dark hover colour must not bring the full icon back.
    expect(previous).toHaveClass(
      "aria-disabled:hover:text-foreground/50",
      "dark:aria-disabled:hover:text-foreground/50",
    );
  });

  const LOCKED_SAVE_LABEL =
    "text-[color-mix(in_srgb,var(--success-foreground)_50%,var(--background))]";

  it("a running Save stays at full colour, without the half-tone classes", () => {
    renderShell({ dirty: false, saving: true });
    const save = screen.getByTestId("media-detail-save");
    expect(save).toHaveAttribute("data-busy", "true");
    expect(save).not.toHaveClass("bg-success/50");
    expect(save).not.toHaveClass(LOCKED_SAVE_LABEL);
  });

  it("arrows in a text field belong to the field", () => {
    const { onPrev, onNext } = renderShell();
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "ArrowLeft" });
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it("with dirty, paging and closing ask first; Discard carries the leave out", async () => {
    const { onNext, onClose } = renderShell({ dirty: true });
    fireEvent.keyDown(panel(), { key: "ArrowRight" });
    expect(onNext).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    expect(onNext).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());

    fireEvent.keyDown(panel(), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId("leave-guard-cancel"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Save in the guard saves, then leaves on true", async () => {
    const onSave = vi.fn(() => true);
    const { onClose } = renderShell({ dirty: true, onSave });
    fireEvent.click(screen.getByTestId("media-detail-close"));
    fireEvent.click(await screen.findByTestId("leave-guard-save"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  // AC 2; SUI-FEATURE-085: Save is locked with aria-disabled, focusable, and triggers nothing.
  it("Reset and Save are locked while not dirty", () => {
    const { onSave } = renderShell();
    expect(screen.getByTestId("media-detail-reset")).toBeDisabled();
    const save = screen.getByTestId("media-detail-save");
    expect(save).toBeEnabled();
    expect(save).toHaveAttribute("aria-disabled", "true");
    // #189: the label is mixed with the background, so it looks as under element opacity.
    expect(save).toHaveClass("bg-success/50", LOCKED_SAVE_LABEL, "cursor-not-allowed");
    expect(save).not.toHaveClass("opacity-50");
    fireEvent.click(save);
    fireEvent.submit(screen.getByLabelText("Name"));
    expect(onSave).not.toHaveBeenCalled();
  });

  // Q&A #3709, GL-UI-017: the locked Save says what it does and when it frees; its name stays "Save".
  it("the locked Save describes when it frees", () => {
    renderShell();
    const save = screen.getByTestId("media-detail-save");
    expect(save).toHaveAccessibleName("Save");
    expect(save).toHaveAccessibleDescription(
      "Saves the changes to this media item — available once you have changed something.",
    );
  });

  it("dirty: Reset calls onReset directly, Save and Enter call onSave", () => {
    const { onReset, onSave } = renderShell({ dirty: true });
    fireEvent.click(screen.getByTestId("media-detail-reset"));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("leave-guard")).toBeNull();
    fireEvent.click(screen.getByTestId("media-detail-save"));
    fireEvent.submit(screen.getByLabelText("Name"));
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("saving: Save carries the working state and is locked; nothing closes", () => {
    const { onSave, onClose } = renderShell({ dirty: true, saving: true });
    const save = screen.getByTestId("media-detail-save");
    expect(save).toHaveAttribute("data-busy", "true");
    // SUI-FEATURE-120: aria-disabled and the click guard, so Save keeps the focus.
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toBeEnabled();
    fireEvent.click(save);
    fireEvent.submit(screen.getByLabelText("Name"));
    fireEvent.keyDown(panel(), { key: "Escape" });
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  // SUI-FEATURE-120 rev 3 AC1, SUI-FEATURE-085 AC2: Save keeps the focus while it runs and after it,
  // locked with aria-disabled.
  it("a save that ends with nothing to save keeps the focus on Save, aria-disabled", () => {
    const shell = (dirty: boolean, saving: boolean) => (
      <MediaDetailShell
        position={3}
        total={65}
        kind="image"
        src="data:,"
        alt="team-photo.jpg"
        dirty={dirty}
        saving={saving}
        fields={<Input aria-label="Name" />}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onReset={vi.fn()}
      />
    );
    const { rerender } = render(shell(true, false));
    const save = screen.getByTestId("media-detail-save");
    save.focus();
    rerender(shell(true, true));
    expect(save).toHaveFocus();
    rerender(shell(false, false));
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveFocus();
  });

  it("footer: Reset directly before Save, right-aligned, no Cancel", () => {
    renderShell({ dirty: true });
    const footer = panel().querySelector("[data-slot=media-detail-footer]")!;
    expect(footer).toHaveClass("justify-end", "flex-row", "border-t");
    expect([...footer.children].map((button) => button.textContent)).toEqual(["Reset", "Save"]);
    expect(screen.getByTestId("media-detail-reset")).toHaveAttribute("data-variant", "destructive");
    expect(screen.getByTestId("media-detail-save")).toHaveAttribute("data-variant", "success");
  });

  // AC 3
  it("width and left edge are those of EditPanel, open and collapsed sidebar alike", () => {
    render(
      <SidebarProvider storageKey="test.sidebar">
        <Toggle />
        <EditPanel open onOpenChange={() => {}} title="Channel">
          x
        </EditPanel>
        <MediaDetailShell
          position={1}
          total={1}
          kind="other"
          src="data:,"
          dirty={false}
          saving={false}
          onPrev={() => {}}
          onNext={() => {}}
          onClose={() => {}}
          onSave={() => {}}
          onReset={() => {}}
        />
      </SidebarProvider>,
    );
    const edit = screen.getByTestId("edit-panel");
    expect(panel().getAttribute("style")).toBe(edit.getAttribute("style"));
    expect(panel().style.left).toBe("calc(var(--sidebar-width) * var(--sidebar-inset))");
    expect(panel().className).toBe(edit.className);
    fireEvent.click(screen.getByTestId("toggle"));
    expect(panel().style.left).toBe("calc(var(--sidebar-width-collapsed) * var(--sidebar-inset))");
    expect(panel().getAttribute("style")).toBe(edit.getAttribute("style"));
  });

  it("exactly one head and one footer: one title, no Cancel", () => {
    renderShell({ pickAction: () => {} });
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByRole("heading")).toHaveTextContent("Details");
    expect(panel()).toHaveAccessibleName("Details");
    expect(panel().querySelectorAll("[data-slot=media-detail-footer]")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("pickAction puts Choose this media item into the head", () => {
    const pick = vi.fn();
    renderShell({ pickAction: pick });
    const head = panel().querySelector("[data-slot=media-detail-head]")!;
    fireEvent.click(within(head as HTMLElement).getByText("Choose this media item"));
    expect(pick).toHaveBeenCalledTimes(1);
  });

  // SUI-FEATURE-085 AC3: picking runs through the same guard as paging and closing.
  it("with dirty, picking asks first; Cancel keeps, Discard picks; clean it picks at once", async () => {
    const pick = vi.fn();
    renderShell({ dirty: true, pickAction: pick });
    fireEvent.click(screen.getByTestId("media-detail-pick"));
    expect(pick).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId("leave-guard-cancel"));
    expect(pick).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("leave-guard")).toBeNull());
    fireEvent.click(screen.getByTestId("media-detail-pick"));
    fireEvent.click(await screen.findByTestId("leave-guard-discard"));
    expect(pick).toHaveBeenCalledTimes(1);
    cleanup();
    const clean = vi.fn();
    renderShell({ pickAction: clean });
    fireEvent.click(screen.getByTestId("media-detail-pick"));
    expect(clean).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("leave-guard")).toBeNull();
  });

  it("without pickAction the head has no pick button", () => {
    renderShell();
    expect(screen.queryByTestId("media-detail-pick")).toBeNull();
  });

  // AC 4
  it("splits at the package's panel-split width; below it the preview stacks on top", () => {
    renderShell();
    const body = screen.getByTestId("media-detail-body");
    expect(body.parentElement).toHaveClass("@container");
    expect(body).toHaveClass(
      "flex",
      "flex-col",
      "@panel-split:grid",
      "@panel-split:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]",
    );
    const [previewColumn, details] = [...body.children] as HTMLElement[];
    expect(previewColumn).toContainElement(screen.getByTestId("media-detail-preview"));
    expect(details).toHaveAttribute("data-slot", "media-detail-details");
  });

  it("the slots stand in fixed order below Details", () => {
    renderShell({
      actions: "A",
      suggest: "S",
      fields: "F",
      facts: "X",
    });
    const details = panel().querySelector("[data-slot=media-detail-details]")!;
    expect([...details.children].map((child) => child.getAttribute("data-slot"))).toEqual([
      "sheet-title",
      "media-detail-facts",
      "media-detail-fields",
      "media-detail-suggest",
      "media-detail-actions",
    ]);
  });

  // SUI-FEATURE-004 AC 5: "Used by" is a button in the preview head, never a list in the right column.
  it("SUI-FEATURE-004: the usage button switches the preview column to the usages", () => {
    const onToggle = vi.fn();
    const { onClose } = renderShell({
      usage: { count: 2, active: false, onToggle, content: <p>usages</p> },
    });
    const details = panel().querySelector("[data-slot=media-detail-details]")!;
    expect(details.querySelector("[data-slot=media-detail-usage]")).toBeNull();
    const button = screen.getByRole("button", { name: "Used by (2)" });
    expect(panel().querySelector("[data-slot=media-detail-head]")).toContainElement(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("media-detail-usage")).toBeNull();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
    cleanup();

    renderShell({ usage: { count: 2, active: true, onToggle, content: <p>usages</p> } });
    expect(screen.getByRole("button", { name: "Used by (2)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const column = panel().querySelector("[data-slot=media-detail-preview-column]")!;
    expect(within(column as HTMLElement).getByTestId("media-detail-usage")).toHaveTextContent(
      "usages",
    );
    expect(screen.getByTestId("media-detail-preview")).not.toBeVisible();
    // The first `Esc` returns to the preview, not closing the panel.
    fireEvent.keyDown(panel(), { key: "Escape" });
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    ["image", "IMG"],
    ["video", "VIDEO"],
    ["audio", "AUDIO"],
    ["pdf", "IFRAME"],
    ["other", "svg"],
  ] as const)("kind %s shows a %s", (kind, tag) => {
    renderShell({ kind });
    const preview = screen.getByTestId("media-detail-preview");
    expect(preview.firstElementChild?.tagName).toBe(tag);
    if (kind === "video" || kind === "audio") {
      expect(preview.firstElementChild).toHaveAttribute("controls");
    }
  });

  it("open={false} renders nothing", () => {
    renderShell({ open: false });
    expect(screen.queryByTestId("media-detail")).toBeNull();
  });
});

describe("MediaDetailShell: preview states and text (SUI-FEATURE-140)", () => {
  // AC 1
  it.each([
    ["de", "missingRef", "Diesem Eintrag ist keine Datei zugeordnet."],
    ["en", "missingRef", "No file is attached to this entry."],
    ["es", "missingRef", "Esta entrada no tiene ningún archivo."],
    [
      "de",
      "missingBytes",
      "Die Datei ist nicht mehr vorhanden. Lade sie neu hoch oder entferne den Eintrag.",
    ],
    ["en", "missingBytes", "The file is no longer available. Upload it again or remove the entry."],
    [
      "es",
      "missingBytes",
      "El archivo ya no está disponible. Súbelo de nuevo o elimina la entrada.",
    ],
    ["de", "noRenderer", "Für diesen Typ gibt es keine Vorschau."],
    ["en", "noRenderer", "No preview for this type."],
    ["es", "noRenderer", "No hay vista previa para este tipo."],
  ] as const)("%s %s: icon and sentence replace the preview", async (lng, state, sentence) => {
    await i18n.changeLanguage(lng);
    renderShell({ previewState: state });
    const preview = screen.getByTestId("media-detail-preview");
    expect(preview).toHaveAttribute("data-state", state);
    expect(preview.querySelector("img")).toBeNull();
    const shown = within(preview).getByTestId("media-detail-state");
    expect(shown.querySelector("svg[aria-hidden=true]")).not.toBeNull();
    expect(shown).toHaveTextContent(sentence);
    expect(within(preview).queryByTestId("media-detail-state-detail")).toBeNull();
  });

  it("previewDetail stands muted below the sentence", () => {
    renderShell({ previewState: "missingBytes", previewDetail: "team-photo.jpg" });
    const detail = screen.getByTestId("media-detail-state-detail");
    expect(detail).toHaveTextContent("team-photo.jpg");
    expect(detail).toHaveClass("text-muted-foreground");
  });

  it("with a state, head, paging, details and footer keep working", () => {
    const { onNext, onPrev, onClose, onSave, onReset } = renderShell({
      previewState: "noRenderer",
      dirty: true,
    });
    expect(screen.getByTestId("media-detail-position")).toHaveTextContent("3 of 65");
    fireEvent.click(screen.getByTestId("media-detail-next"));
    expect(onNext).not.toHaveBeenCalled(); // dirty: the guard asks first
    cleanup();
    const clean = renderShell({ previewState: "noRenderer" });
    fireEvent.keyDown(panel(), { key: "ArrowRight" });
    expect(clean.onNext).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("media-detail-previous"));
    expect(clean.onPrev).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("media-detail-close"));
    expect(clean.onClose).toHaveBeenCalledTimes(1);
    cleanup();
    renderShell({ previewState: "missingRef", dirty: true, onSave, onReset });
    fireEvent.click(screen.getByTestId("media-detail-reset"));
    expect(onReset).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("media-detail-save"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    ["de", "missingRef", "Ohne Datei nicht wählbar."],
    ["en", "missingRef", "Can't be chosen without a file."],
    ["es", "missingBytes", "No se puede elegir sin archivo."],
  ] as const)("%s %s: the pick is locked and names its reason", async (lng, state, reason) => {
    await i18n.changeLanguage(lng);
    const pick = vi.fn();
    renderShell({ previewState: state, pickAction: pick });
    const button = screen.getByTestId("media-detail-pick");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(pick).not.toHaveBeenCalled();
    // The wrapper takes the focus and carries the reason as its description.
    const wrapper = button.parentElement!;
    expect(wrapper).toHaveAttribute("tabindex", "0");
    expect(wrapper).toHaveAccessibleDescription(reason);
  });

  it("noRenderer: the pick stays usable", () => {
    const pick = vi.fn();
    renderShell({ previewState: "noRenderer", pickAction: pick });
    const button = screen.getByTestId("media-detail-pick");
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(pick).toHaveBeenCalledTimes(1);
  });

  // AC 2
  it.each([
    ["de", "Die Datei ist leer."],
    ["en", "The file is empty."],
    ["es", "El archivo está vacío."],
  ] as const)(
    "%s: an empty text shows the empty hint instead of an empty region",
    async (lng, hint) => {
      await i18n.changeLanguage(lng);
      renderShell({ kind: "text", text: "" });
      expect(screen.queryByTestId("media-detail-text")).toBeNull();
      expect(screen.getByTestId("media-detail-empty-text")).toHaveTextContent(hint);
      cleanup();
      // Whitespace only counts as empty.
      renderShell({ kind: "text", text: " \n\t\n " });
      expect(screen.queryByTestId("media-detail-text")).toBeNull();
      const empty = screen.getByTestId("media-detail-empty-text");
      expect(empty).toHaveTextContent(hint);
      expect(empty).toHaveClass("text-muted-foreground");
    },
  );

  it("kind text: base family (never font-mono), its own scroll, wrapping on, tab size 2", () => {
    renderShell({ kind: "text", text: "line one\nline two" });
    const text = screen.getByTestId("media-detail-text");
    expect(text.tagName).toBe("PRE");
    expect(text.textContent).toBe("line one\nline two");
    expect(text).toHaveClass(
      "[font-family:inherit]",
      "overflow-auto",
      "whitespace-pre-wrap",
      "[tab-size:2]",
    );
    expect(text).not.toHaveClass("font-mono");
    expect(text).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("region", { name: "team-photo.jpg" })).toBe(text);
    expect(screen.queryByTestId("media-detail-truncated")).toBeNull();
  });

  it('format="json" indents valid JSON', () => {
    renderShell({ kind: "text", format: "json", text: '{"a":1,"b":[true]}' });
    expect(screen.getByTestId("media-detail-text").textContent).toBe(
      '{\n  "a": 1,\n  "b": [\n    true\n  ]\n}',
    );
  });

  it('format="json" changes only whitespace: number literals stay as the file has them', () => {
    renderShell({
      kind: "text",
      format: "json",
      text: '{"big":9007199254740993,"huge":1e400,"zero":-0.0,"price":1.50}',
    });
    expect(screen.getByTestId("media-detail-text").textContent).toBe(
      '{\n  "big": 9007199254740993,\n  "huge": 1e400,\n  "zero": -0.0,\n  "price": 1.50\n}',
    );
  });

  it('format="json" leaves strings alone: brackets, commas, colons and escapes inside them', () => {
    const text = '{ "a" : "[x, {y}: z]",\n\t"b\\"c" : [ ], "d": {} , "e": " \\\\" }';
    renderShell({ kind: "text", format: "json", text });
    expect(screen.getByTestId("media-detail-text").textContent).toBe(
      '{\n  "a": "[x, {y}: z]",\n  "b\\"c": [],\n  "d": {},\n  "e": " \\\\"\n}',
    );
  });

  it('format="json" leaves invalid JSON as plain text, silently', () => {
    renderShell({ kind: "text", format: "json", text: '{"a":1,' });
    expect(screen.getByTestId("media-detail-text").textContent).toBe('{"a":1,');
  });

  it("plain text stays as it is, JSON included", () => {
    renderShell({ kind: "text", text: '{"a":1}' });
    expect(screen.getByTestId("media-detail-text").textContent).toBe('{"a":1}');
  });

  it.each([
    ["de", "Gekürzt — nur der Anfang wird gezeigt."],
    ["en", "Truncated — only the beginning is shown."],
    ["es", "Truncado: solo se muestra el inicio."],
  ])("%s: over 200 KB shows the first 200 KB and the muted note", async (lng, note) => {
    await i18n.changeLanguage(lng);
    renderShell({ kind: "text", text: "x".repeat(200 * 1024 + 10) });
    expect(screen.getByTestId("media-detail-text").textContent).toHaveLength(200 * 1024);
    const truncated = screen.getByTestId("media-detail-truncated");
    expect(truncated).toHaveTextContent(note);
    expect(truncated).toHaveClass("text-muted-foreground");
  });

  it("exactly 200 KB is not truncated; a cut never splits a character", () => {
    renderShell({ kind: "text", text: "x".repeat(200 * 1024) });
    expect(screen.queryByTestId("media-detail-truncated")).toBeNull();
    cleanup();
    // "é" is two bytes: one byte of "x" puts the limit in the middle of a character.
    renderShell({ kind: "text", text: "x" + "é".repeat(200 * 1024) });
    const shown = screen.getByTestId("media-detail-text").textContent;
    expect(shown.endsWith("é")).toBe(true);
    expect(new TextEncoder().encode(shown).length).toBe(200 * 1024 - 1);
  });

  it("JSON past 200 KB shows its beginning as it is, never indented", () => {
    const json = JSON.stringify(Array.from({ length: 30000 }, (_, i) => ({ i })));
    renderShell({ kind: "text", format: "json", text: json });
    expect(screen.getByTestId("media-detail-text").textContent).toBe(json.slice(0, 200 * 1024));
    expect(screen.getByTestId("media-detail-truncated")).toBeInTheDocument();
  });

  it("deeply nested JSON stops indenting at the limit, the shown beginning unchanged", () => {
    const depth = 5000;
    renderShell({
      kind: "text",
      format: "json",
      text: "[".repeat(depth) + "]".repeat(depth),
    });
    let expected = "";
    for (let level = 1; expected.length < 200 * 1024; level++) {
      expected += "[\n" + "  ".repeat(level);
    }
    expect(screen.getByTestId("media-detail-text").textContent).toBe(expected.slice(0, 200 * 1024));
    expect(screen.getByTestId("media-detail-truncated")).toBeInTheDocument();
  });

  it("JSON that indenting grows past 200 KB is cut after indenting", () => {
    const json = JSON.stringify(Array.from({ length: 30000 }, (_, i) => i));
    expect(json.length).toBeLessThan(200 * 1024);
    renderShell({ kind: "text", format: "json", text: json });
    const shown = screen.getByTestId("media-detail-text").textContent;
    expect(shown.startsWith("[\n  0,\n  1,")).toBe(true);
    expect(shown).toHaveLength(200 * 1024);
    expect(screen.getByTestId("media-detail-truncated")).toBeInTheDocument();
  });

  it("an arrow that pages from inside the text region moves the focus to the panel", () => {
    const { onNext } = renderShell({ kind: "text", text: "hello" });
    const text = screen.getByTestId("media-detail-text");
    text.focus();
    fireEvent.keyDown(text, { key: "ArrowRight" });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(panel()).toHaveFocus();
  });

  it("paging across the pick's lock, either way, keeps the focus in the panel", () => {
    // Position 1 has a file, position 2 has none: the pick flips between usable and locked.
    function Pager() {
      const [position, setPosition] = React.useState(1);
      return (
        <MediaDetailShell
          position={position}
          total={3}
          kind="image"
          src="data:,"
          previewState={position === 2 ? "missingBytes" : undefined}
          dirty={false}
          saving={false}
          onPrev={() => setPosition((n) => n - 1)}
          onNext={() => setPosition((n) => n + 1)}
          onClose={() => {}}
          onSave={() => {}}
          onReset={() => {}}
          pickAction={() => {}}
        />
      );
    }
    render(<Pager />);
    const pick = () => screen.getByTestId("media-detail-pick");
    pick().focus();
    fireEvent.keyDown(pick(), { key: "ArrowRight" });
    expect(screen.getByTestId("media-detail-position")).toHaveTextContent("2 of 3");
    expect(pick()).toBeDisabled();
    expect(panel()).toHaveFocus();
    // Locked, the wrapper holds the focus; from there back to the usable pick.
    const wrapper = pick().parentElement!;
    wrapper.focus();
    fireEvent.keyDown(wrapper, { key: "ArrowLeft" });
    expect(screen.getByTestId("media-detail-position")).toHaveTextContent("1 of 3");
    expect(pick()).toBeEnabled();
    expect(panel()).toHaveFocus();
    fireEvent.keyDown(panel(), { key: "ArrowRight" });
    expect(screen.getByTestId("media-detail-position")).toHaveTextContent("2 of 3");
  });

  it("a new position starts the text region fresh", () => {
    const props = {
      onPrev: vi.fn(),
      onNext: vi.fn(),
      onClose: vi.fn(),
      onSave: vi.fn(),
      onReset: vi.fn(),
      total: 2,
      kind: "text",
      dirty: false,
      saving: false,
    } as const;
    const { rerender } = render(<MediaDetailShell {...props} position={1} text="one" />);
    const first = screen.getByTestId("media-detail-text");
    rerender(<MediaDetailShell {...props} position={2} text="two" />);
    expect(screen.getByTestId("media-detail-text")).not.toBe(first);
  });

  it("a state wins over the text preview", () => {
    renderShell({ kind: "text", text: "hello", previewState: "missingBytes" });
    expect(screen.queryByTestId("media-detail-text")).toBeNull();
    expect(screen.getByTestId("media-detail-state")).toBeInTheDocument();
  });
});

describe("MediaUsageList", () => {
  // AC 5
  it.each([
    ["de", "nicht verwendet"],
    ["en", "not used"],
    ["es", "sin usar"],
  ])("%s: without entries it reads %s", async (lng, text) => {
    await i18n.changeLanguage(lng);
    render(
      <MemoryRouter>
        <MediaUsageList items={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("media-usage-empty")).toHaveTextContent(text);
  });

  it("each use is a link with language and status muted after it", () => {
    render(
      <MemoryRouter>
        <MediaUsageList
          items={[
            { id: "1", title: "Spring news", to: "/posts/1", language: "DE", status: "Published" },
            { id: "2", title: "Landing", to: "/pages/2" },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("region", { name: "Used in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Spring news" })).toHaveAttribute("href", "/posts/1");
    expect(screen.getByText("DE · Published")).toHaveClass("text-muted-foreground");
    expect(screen.getByRole("link", { name: "Landing" })).toHaveAttribute("href", "/pages/2");
    expect(screen.queryByTestId("media-usage-empty")).toBeNull();
  });
});
