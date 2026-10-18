import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider, useSidebar } from "../shell/sidebar-provider.js";
import { EditPanel, type EditPanelProps } from "./edit-panel.js";
import { Input } from "./input.js";
import { TagInput } from "./tag-input.js";

afterEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("en");
});

function renderPanel(props: Partial<EditPanelProps> = {}) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn();
  render(
    <EditPanel
      open
      onOpenChange={onOpenChange}
      title="Channel"
      onSubmit={onSubmit}
      submitLabel="Save"
      {...props}
    >
      <Input aria-label="Name" defaultValue="Main" />
    </EditPanel>,
  );
  return { onOpenChange, onSubmit };
}

// A trigger that opens the panel, as a list row does.
function WithTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
        Edit
      </button>
      <EditPanel open={open} onOpenChange={setOpen} title="Channel">
        <Input aria-label="Name" />
      </EditPanel>
    </>
  );
}

function Toggle() {
  const { toggle } = useSidebar();
  return (
    <button type="button" data-testid="toggle" onClick={toggle}>
      toggle
    </button>
  );
}

describe("EditPanel", () => {
  it.each([
    ["en", "Cancel", "Close"],
    ["de", "Abbrechen", "Schließen"],
    ["es", "Cancelar", "Cerrar"],
  ])("%s: Cancel and Close come from the suite namespace", async (lng, cancel, close) => {
    await i18n.changeLanguage(lng);
    const { unmount } = render(
      <EditPanel open onOpenChange={() => {}} title="Channel" onSubmit={() => {}}>
        x
      </EditPanel>,
    );
    expect(screen.getByTestId("edit-panel-cancel")).toHaveTextContent(cancel);
    unmount();
    render(
      <EditPanel open onOpenChange={() => {}} title="Channel">
        x
      </EditPanel>,
    );
    expect(screen.getByTestId("edit-panel-cancel")).toHaveTextContent(close);
    expect(screen.queryByTestId("edit-panel-submit")).toBeNull();
  });

  it("footer: Cancel directly before the primary action, right-aligned in one row", () => {
    renderPanel({ description: "Name and handle" });
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Name and handle");
    const footer = screen.getByTestId("edit-panel").querySelector("[data-slot=edit-panel-footer]");
    expect(footer).toHaveClass("flex-row", "justify-end", "border-t");
    const buttons = [...(footer?.querySelectorAll("button") ?? [])];
    expect(buttons.map((b) => b.dataset.testid)).toEqual([
      "edit-panel-cancel",
      "edit-panel-submit",
    ]);
    expect(screen.getByTestId("edit-panel-body")).toHaveClass("overflow-y-auto");
  });

  // SUI-FEATURE-045 AC6: the submit carries `SaveIcon` before its text; text, variant and testid stay.
  it("submit carries the decorative SaveIcon with its text, variant and testid", () => {
    renderPanel();
    const submit = screen.getByRole("button", { name: "Save" });
    expect(submit).toHaveAttribute("data-testid", "edit-panel-submit");
    expect(submit).toHaveAttribute("data-variant", "success");
    expect(submit).toHaveAttribute("data-size", "default");
    expect(submit).toHaveTextContent(/^Save$/);
    const icon = submit.querySelector("svg");
    expect(icon).toHaveClass("lucide-save");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  // SUI-FEATURE-111 AC1: a step that only moves on claims no save.
  it('submitKind="next": the text, then an arrow, no SaveIcon; variant and size as Save', () => {
    const { onSubmit } = renderPanel({ submitKind: "next", submitLabel: "Continue to review" });
    const submit = screen.getByRole("button", { name: "Continue to review" });
    expect(submit).toHaveAttribute("data-testid", "edit-panel-submit");
    expect(submit).toHaveAttribute("data-variant", "success");
    expect(submit).toHaveAttribute("data-size", "default");
    expect(submit.querySelector(".lucide-save")).toBeNull();
    const icons = submit.querySelectorAll("svg");
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveClass("lucide-arrow-right");
    expect(icons[0]).toHaveAttribute("aria-hidden", "true");
    expect(submit.lastElementChild).toBe(icons[0]);
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submitKind="next" locks with submitDisabled and works with busy like Save', () => {
    renderPanel({ submitKind: "next", submitDisabled: true });
    expect(screen.getByTestId("edit-panel-submit")).toBeDisabled();
    cleanup();
    const { onSubmit: onBusySubmit } = renderPanel({ submitKind: "next", busy: true });
    const submit = screen.getByTestId("edit-panel-submit");
    expect(submit).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(submit);
    expect(onBusySubmit).not.toHaveBeenCalled();
    expect(submit).toHaveAttribute("data-busy", "true");
    expect(submit.querySelector("[data-testid=button-loading]")).toHaveClass(
      "lucide-loader-circle",
    );
    expect(submit.firstElementChild).toHaveAttribute("data-testid", "button-loading");
  });

  it.each([undefined, "save"] as const)(
    "submitKind %s: the Save symbol, no arrow",
    (submitKind) => {
      renderPanel(submitKind === undefined ? {} : { submitKind });
      const submit = screen.getByTestId("edit-panel-submit");
      expect(submit.firstElementChild).toHaveClass("lucide-save");
      expect(submit.querySelector(".lucide-arrow-right")).toBeNull();
    },
  );

  it("submit and Enter in a field call onSubmit, Cancel requests the close", () => {
    const { onOpenChange, onSubmit } = renderPanel();
    fireEvent.click(screen.getByTestId("edit-panel-submit"));
    fireEvent.submit(screen.getByLabelText("Name"));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId("edit-panel-cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submitDisabled locks the primary action and the form submit", () => {
    const { onSubmit } = renderPanel({ submitDisabled: true });
    expect(screen.getByTestId("edit-panel-submit")).toBeDisabled();
    fireEvent.submit(screen.getByLabelText("Name"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // AC3
  it("busy: the primary action works and is locked, the panel does not close", () => {
    const { onOpenChange, onSubmit } = renderPanel({ busy: true });
    const submit = screen.getByTestId("edit-panel-submit");
    // SUI-FEATURE-120: aria-disabled and the click guard keep the focus on the running action.
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit).toBeEnabled();
    expect(submit).toHaveAttribute("data-busy", "true");
    fireEvent.click(submit);
    expect(screen.getByTestId("edit-panel-cancel")).toBeDisabled();
    fireEvent.submit(screen.getByLabelText("Name"));
    fireEvent.keyDown(screen.getByTestId("edit-panel"), { key: "Escape" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("Escape closes when idle; a click outside does not", () => {
    const { onOpenChange } = renderPanel();
    fireEvent.pointerDown(document.body);
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByTestId("edit-panel"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // AC4
  it("className and style of the call site do not change edges or width", () => {
    renderPanel({ className: "w-1/2 left-10", style: { width: "50%", left: 40, inset: 10 } });
    const panel = screen.getByTestId("edit-panel");
    expect(panel).toHaveClass("w-1/2");
    expect(panel.style.width).toBe("auto");
    expect(panel.style.left).toBe("0px");
    expect(panel.style.right).toBe("0px");
    expect(panel.style.top).toBe("0px");
    expect(panel.style.bottom).toBe("0px");
  });

  it("the left edge follows the sidebar width, open and collapsed", () => {
    render(
      <SidebarProvider storageKey="test.sidebar">
        <Toggle />
        <EditPanel open onOpenChange={() => {}} title="Channel">
          x
        </EditPanel>
      </SidebarProvider>,
    );
    expect(screen.getByTestId("edit-panel").style.left).toBe(
      "calc(var(--sidebar-width) * var(--sidebar-inset))",
    );
    fireEvent.click(screen.getByTestId("toggle"));
    expect(screen.getByTestId("edit-panel").style.left).toBe(
      "calc(var(--sidebar-width-collapsed) * var(--sidebar-inset))",
    );
  });

  it("testIdPrefix replaces the testid stem", () => {
    renderPanel({ testIdPrefix: "channel-panel" });
    for (const id of [
      "channel-panel",
      "channel-panel-body",
      "channel-panel-cancel",
      "channel-panel-submit",
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it("opening focus: the first field only in add mode", () => {
    renderPanel({ mode: "add" });
    expect(screen.getByLabelText("Name")).toHaveFocus();
    cleanup();
    renderPanel({ mode: "edit" });
    expect(screen.getByTestId("edit-panel")).toHaveFocus();
    cleanup();
    renderPanel();
    expect(screen.getByTestId("edit-panel")).toHaveFocus();
  });

  // SUI-FEATURE-035 AC1: native constraints never block the submit.
  it("the form is noValidate: an invalid number or email still calls onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <EditPanel open onOpenChange={() => {}} title="Channel" onSubmit={onSubmit}>
        <Input aria-label="Count" type="number" min={1} defaultValue={0} />
        <Input aria-label="Mail" type="email" defaultValue="not-an-email" />
      </EditPanel>,
    );
    expect(screen.getByLabelText("Count").closest("form")).toHaveAttribute("novalidate");
    fireEvent.click(screen.getByTestId("edit-panel-submit"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // SUI-FEATURE-035 AC2, AC4
  it("onBack: Back left-aligned before Cancel and the primary action, calls only onBack", () => {
    const onBack = vi.fn();
    const { onOpenChange, onSubmit } = renderPanel({ onBack });
    const footer = screen.getByTestId("edit-panel").querySelector("[data-slot=edit-panel-footer]");
    expect(footer).toHaveClass("flex-row", "justify-end");
    const buttons = [...(footer?.querySelectorAll("button") ?? [])];
    expect(buttons.map((b) => b.dataset.testid)).toEqual([
      "edit-panel-back",
      "edit-panel-cancel",
      "edit-panel-submit",
    ]);
    const back = screen.getByTestId("edit-panel-back");
    expect(back).toHaveAttribute("type", "button");
    expect(back).toHaveClass("mr-auto");
    expect(back.className.replace(" mr-auto", "")).toBe(
      screen.getByTestId("edit-panel-cancel").className,
    );
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("edit-panel")).toBeInTheDocument();
  });

  // SUI-FEATURE-035 AC3
  it.each([[{ backDisabled: true }], [{ busy: true }]])("%o locks Back", (props) => {
    renderPanel({ onBack: () => {}, ...props });
    expect(screen.getByTestId("edit-panel-back")).toBeDisabled();
  });

  it("testIdPrefix applies to Back", () => {
    renderPanel({ onBack: () => {}, testIdPrefix: "channel-panel" });
    expect(screen.getByTestId("channel-panel-back")).toBeInTheDocument();
  });

  // SUI-FEATURE-091: the footer buttons carry description hints (GL-UI-017).
  describe("footer hints", () => {
    // The carrying span owns the description while its button is `disabled`.
    function hintOf(testId: string) {
      const button = screen.getByTestId(testId);
      const owner = button.hasAttribute("aria-describedby") ? button : button.parentElement;
      const ids = owner?.getAttribute("aria-describedby")?.split(" ") ?? [];
      return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
    }

    it.each([
      [
        "en",
        "Goes back one step; asks first if there are unsaved changes.",
        "Closes the panel without saving; asks first if there are unsaved changes.",
        "Closes the panel; asks first if there are changes.",
        "Saves the entries.",
        "Goes on to the next step.",
        "An action is running; available again once it has finished.",
      ],
      [
        "de",
        "Geht einen Schritt zurück; ungespeicherte Änderungen werden vorher abgefragt.",
        "Schließt das Panel, ohne zu speichern; ungespeicherte Änderungen werden vorher abgefragt.",
        "Schließt das Panel; Änderungen werden vorher abgefragt.",
        "Speichert die Eingaben.",
        "Geht zum nächsten Schritt.",
        "Eine Aktion läuft; wieder verfügbar, sobald sie abgeschlossen ist.",
      ],
      [
        "es",
        "Vuelve un paso atrás; antes pregunta si hay cambios sin guardar.",
        "Cierra el panel sin guardar; antes pregunta si hay cambios sin guardar.",
        "Cierra el panel; antes pregunta si hay cambios.",
        "Guarda los datos.",
        "Pasa al paso siguiente.",
        "Hay una acción en curso; vuelve a estar disponible cuando haya terminado.",
      ],
    ])(
      "AC1/AC2/AC5/AC6 %s: the package hints of Back, Cancel, Close, save, next and busy",
      async (lng, back, cancel, close, save, next, busyText) => {
        await i18n.changeLanguage(lng);
        renderPanel({ onBack: () => {} });
        expect(hintOf("edit-panel-back")).toBe(back);
        expect(hintOf("edit-panel-cancel")).toBe(cancel);
        expect(hintOf("edit-panel-submit")).toBe(save);
        cleanup();
        renderPanel({ submitKind: "next" });
        expect(hintOf("edit-panel-submit")).toBe(next);
        cleanup();
        renderPanel({ onSubmit: undefined });
        expect(hintOf("edit-panel-cancel")).toBe(close);
        cleanup();
        renderPanel({ onBack: () => {}, busy: true, submitHint: "x", backDisabledHint: "y" });
        for (const id of ["edit-panel-back", "edit-panel-cancel", "edit-panel-submit"]) {
          expect(hintOf(id)).toBe(busyText);
        }
        cleanup();
        renderPanel({ submitKind: "next", busy: true });
        for (const id of ["edit-panel-cancel", "edit-panel-submit"]) {
          expect(hintOf(id)).toBe(busyText);
        }
      },
    );

    it("AC1: the hint is the description, never the accessible name", () => {
      renderPanel({ onBack: () => {} });
      expect(screen.getByTestId("edit-panel-back")).toHaveAccessibleName("Back");
      expect(screen.getByTestId("edit-panel-back")).toHaveAccessibleDescription(
        "Goes back one step; asks first if there are unsaved changes.",
      );
      expect(screen.getByTestId("edit-panel-cancel")).toHaveAccessibleName("Cancel");
      expect(screen.getByTestId("edit-panel-submit")).toHaveAccessibleName("Save");
      expect(screen.getByTestId("edit-panel-submit")).toHaveAccessibleDescription(
        "Saves the entries.",
      );
    });

    it("AC3: submitHint and backHint replace the package hints", () => {
      renderPanel({
        onBack: () => {},
        submitLabel: "Publish",
        submitHint: "Publishes the post now.",
        backHint: "Back to the media pick.",
      });
      expect(hintOf("edit-panel-submit")).toBe("Publishes the post now.");
      expect(hintOf("edit-panel-back")).toBe("Back to the media pick.");
      expect(hintOf("edit-panel-cancel")).toBe(
        "Closes the panel without saving; asks first if there are unsaved changes.",
      );
    });

    it("AC4: a locked primary action and Back show their disabled hints", () => {
      renderPanel({
        onBack: () => {},
        submitDisabled: true,
        submitDisabledHint: "Available once a name is set.",
        backDisabled: true,
        backDisabledHint: "Available once the upload has finished.",
      });
      expect(screen.getByTestId("edit-panel-submit")).toBeDisabled();
      expect(hintOf("edit-panel-submit")).toBe("Available once a name is set.");
      expect(hintOf("edit-panel-back")).toBe("Available once the upload has finished.");
    });

    it("AC4: locked without a disabled hint, the normal hint stands", () => {
      renderPanel({ onBack: () => {}, submitDisabled: true, backDisabled: true });
      expect(hintOf("edit-panel-submit")).toBe("Saves the entries.");
      expect(hintOf("edit-panel-back")).toBe(
        "Goes back one step; asks first if there are unsaved changes.",
      );
    });

    it("AC7: order, testids and button classes stay, each button in its hint shell", () => {
      renderPanel({ onBack: () => {} });
      const footer = screen
        .getByTestId("edit-panel")
        .querySelector("[data-slot=edit-panel-footer]");
      const shells = [...(footer?.children ?? [])];
      expect(shells.map((shell) => shell.tagName)).toEqual(["SPAN", "SPAN", "SPAN"]);
      expect(shells.map((shell) => shell.firstElementChild?.getAttribute("data-testid"))).toEqual([
        "edit-panel-back",
        "edit-panel-cancel",
        "edit-panel-submit",
      ]);
      expect(shells[0]).toHaveClass("mr-auto");
    });
  });

  // SUI-FEATURE-035 AC5
  it("without onBack the footer markup and classes are as before", () => {
    renderPanel();
    const footer = screen.getByTestId("edit-panel").querySelector("[data-slot=edit-panel-footer]");
    expect(footer?.className).toBe(
      "flex shrink-0 flex-row items-center justify-end gap-2 border-t px-6 py-4",
    );
    expect(footer?.children).toHaveLength(2);
    expect(screen.queryByTestId("edit-panel-back")).toBeNull();
  });

  // SUI-FEATURE-035 AC6
  it.each([
    ["en", "Back"],
    ["de", "Zurück"],
    ["es", "Volver"],
  ])("%s: Back comes from the suite namespace", async (lng, back) => {
    await i18n.changeLanguage(lng);
    renderPanel({ onBack: () => {} });
    expect(screen.getByTestId("edit-panel-back")).toHaveTextContent(back);
  });

  // AC5
  it("close returns the focus to the trigger", async () => {
    render(<WithTrigger />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByTestId("edit-panel")).toHaveFocus();
    fireEvent.click(screen.getByTestId("edit-panel-cancel"));
    expect(screen.queryByTestId("edit-panel")).toBeNull();
    // radix hands the focus back on a tick after the unmount.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  // #185: a locked chevron dims its icon, not the element, so its focus ring keeps its contrast;
  // no hover tint, in dark mode too.
  it("pager: a locked chevron is half-tone, never element opacity", () => {
    renderPanel({
      pager: { position: "1/3", onPrevious: vi.fn(), onNext: vi.fn(), previousDisabled: true },
    });
    const previous = screen.getByTestId("edit-panel-previous");
    expect(previous).toHaveClass(
      "aria-disabled:text-foreground/50",
      "aria-disabled:hover:text-foreground/50",
      "dark:aria-disabled:hover:text-foreground/50",
    );
    expect(previous).not.toHaveClass("aria-disabled:opacity-50");
  });

  // SUI-FEATURE-051: paging through a set of records.
  it("pager: ‹ and › left of the title call their callbacks and lock per flag", () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    renderPanel({ pager: { position: "1/3", onPrevious, onNext, previousDisabled: true } });
    const previous = screen.getByTestId("edit-panel-previous");
    const next = screen.getByTestId("edit-panel-next");
    expect(previous).toHaveAccessibleName("Previous");
    expect(next).toHaveAccessibleName("Next");
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(next).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("edit-panel-position")).toHaveTextContent("1/3");
    const title = screen.getByRole("heading", { name: "Channel" });
    expect(next.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
    fireEvent.click(previous);
    expect(onPrevious).not.toHaveBeenCalled();
  });

  it("pager: the next lock holds too", () => {
    const onNext = vi.fn();
    renderPanel({ pager: { position: "3/3", onPrevious: vi.fn(), onNext, nextDisabled: true } });
    expect(screen.getByTestId("edit-panel-previous")).not.toHaveAttribute("aria-disabled");
    const next = screen.getByTestId("edit-panel-next");
    next.focus();
    fireEvent.click(next);
    expect(onNext).not.toHaveBeenCalled();
    // Locked by aria-disabled, the button keeps the focus it had when paging reached the end.
    expect(next).toHaveFocus();
  });

  it("without pager the header holds the title alone, as before", () => {
    renderPanel();
    const header = document.querySelector("[data-slot=edit-panel-header]")!;
    expect(header.querySelector("[data-slot=edit-panel-pager]")).toBeNull();
    expect(screen.getByRole("heading", { name: "Channel" }).parentElement).toBe(header);
    expect(screen.queryByTestId("edit-panel-previous")).toBeNull();
  });

  // SUI-FEATURE-052: a change of position is announced politely.
  it("pager: the position is a status, so ‹ and › announce the new one", () => {
    function Paging() {
      const [index, setIndex] = useState(1);
      return (
        <EditPanel
          open
          onOpenChange={() => {}}
          title="Channel"
          onSubmit={() => {}}
          submitLabel="Save"
          pager={{
            position: `${index}/3`,
            onPrevious: () => setIndex((value) => value - 1),
            onNext: () => setIndex((value) => value + 1),
          }}
        >
          <Input aria-label="Name" />
        </EditPanel>
      );
    }
    render(<Paging />);
    const position = screen.getByTestId("edit-panel-position");
    expect(position).toHaveAttribute("role", "status");
    fireEvent.click(screen.getByTestId("edit-panel-next"));
    expect(position).toHaveTextContent("2/3");
    fireEvent.click(screen.getByTestId("edit-panel-previous"));
    expect(position).toHaveTextContent("1/3");
  });

  // SUI-FEATURE-052: Save takes typed tag text over before the submit.
  it("Save: a TagInput's typed text reaches onChange before onSubmit", () => {
    const calls: string[] = [];
    function WithTags() {
      const [tags, setTags] = useState<string[]>([]);
      return (
        <EditPanel
          open
          onOpenChange={() => {}}
          title="Media"
          onSubmit={() => calls.push(`submit ${tags.join(",")}`)}
          submitLabel="Save"
        >
          <TagInput
            value={tags}
            onChange={(next) => {
              calls.push(`change ${next.join(",")}`);
              setTags(next);
            }}
          />
        </EditPanel>
      );
    }
    render(<WithTags />);
    const field = screen.getByTestId("tag-input-input");
    field.focus();
    fireEvent.change(field, { target: { value: "neu" } });
    // A click moves the focus to the button first, as the browser does on mousedown.
    const save = screen.getByRole("button", { name: "Save" });
    act(() => save.focus());
    fireEvent.click(save);
    expect(calls).toEqual(["change neu", "submit neu"]);
  });

  describe("preview (GL-UI-027 §Panel mit Vorschau)", () => {
    function renderPreview(props: Partial<EditPanelProps> = {}) {
      render(
        <EditPanel
          open
          onOpenChange={() => {}}
          title="team-photo.jpg"
          onSubmit={() => {}}
          preview={<img src="data:," alt="team-photo.jpg" />}
          {...props}
        >
          <Input aria-label="Name" />
        </EditPanel>,
      );
      return screen.getByTestId(`${props.testIdPrefix ?? "edit-panel"}-body`);
    }

    it("puts the preview left of the fields, inside the one scrolling body", () => {
      const body = renderPreview();
      const [preview, fields] = [...body.children] as HTMLElement[];
      expect(preview).toBe(screen.getByTestId("edit-panel-preview"));
      expect(preview).toContainElement(screen.getByRole("img", { name: "team-photo.jpg" }));
      expect(fields).toHaveAttribute("data-slot", "edit-panel-fields");
      expect(fields).toContainElement(screen.getByLabelText("Name"));
      expect(body.children).toHaveLength(2);
    });

    it("splits at the package's panel-split width of the panel itself, nowhere else", () => {
      const body = renderPreview();
      const split = body.parentElement!;
      expect(split).toHaveAttribute("data-slot", "edit-panel-split");
      expect(split).toHaveClass("@container", "min-h-0", "flex-1");
      // Stacked by default; side by side, preview wider than the fields, from `panel-split` on.
      expect(body).toHaveClass(
        "flex",
        "flex-col",
        "overflow-y-auto",
        "@panel-split:grid",
        "@panel-split:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]",
        "@panel-split:overflow-hidden",
      );
      // One breakpoint: no viewport breakpoint and no other container size anywhere in the split.
      const fields = body.querySelector("[data-slot=edit-panel-fields]")!;
      const classes = [split, body, screen.getByTestId("edit-panel-preview"), fields]
        .flatMap((element) => [...element.classList])
        .filter((name) => name.includes(":"));
      for (const name of classes) {
        expect(name).not.toMatch(/^(sm|md|lg|xl|2xl):/);
        expect(name).not.toMatch(/^@(?!panel-split:)[a-z0-9]+:/);
      }
    });

    it("the preview fills its column: full body height side by side, the picture fills the frame", () => {
      renderPreview();
      const preview = screen.getByTestId("edit-panel-preview");
      expect(preview).toHaveClass(
        "h-[45vh]",
        "@panel-split:h-full",
        "[&>img]:size-full",
        "[&>img]:object-contain",
        "[&>video]:size-full",
        "[&>video]:object-contain",
        "[&>*]:w-full",
      );
      expect(
        screen.getByTestId("edit-panel").querySelector("[data-slot=edit-panel-fields]"),
      ).toHaveClass("@panel-split:overflow-y-auto");
    });

    it("side by side the fields column is a GL-UI-018 inner scroll surface", () => {
      const body = renderPreview();
      const fields = body.querySelector("[data-slot=edit-panel-fields]")!;
      // Gutter and end padding on the same scrolling element; the body gives up its own.
      expect(fields).toHaveClass(
        "relative",
        "@panel-split:overflow-y-auto",
        "@panel-split:[scrollbar-gutter:stable]",
        "@panel-split:pe-[var(--page-gutter)]",
        // Start padding only as focus-ring room, cancelled by the margin: the edge stays flush.
        "@panel-split:ps-1.5",
        "@panel-split:-ms-1.5",
      );
      expect(body).toHaveClass("@panel-split:pe-0", "@panel-split:[scrollbar-gutter:auto]");
    });

    it("sizing stays with the package: call-site class and style do not reach the split", () => {
      renderPreview({ className: "w-1/3", style: { width: "30%" }, testIdPrefix: "media" });
      const preview = screen.getByTestId("media-preview");
      expect(screen.getByTestId("media").style.width).toBe("auto");
      expect(preview.getAttribute("style")).toBeNull();
      expect(screen.getByTestId("media-body").getAttribute("style")).toBeNull();
    });

    it("add mode focuses the first field of the fields column, not one in the preview", () => {
      render(
        <EditPanel
          open
          onOpenChange={() => {}}
          title="New post"
          mode="add"
          preview={<input aria-label="Preview search" />}
        >
          <Input aria-label="Name" />
        </EditPanel>,
      );
      expect(screen.getByLabelText("Name")).toHaveFocus();
    });

    it("a non-media preview scrolls inside the frame", () => {
      renderPreview({ preview: <article>Post</article> });
      expect(screen.getByTestId("edit-panel-preview")).toHaveClass(
        "[&>*]:max-h-full",
        "[&>:not(img,video)]:overflow-y-auto",
      );
    });

    it("without a preview the body is the plain scrolling form body", () => {
      render(
        <EditPanel open onOpenChange={() => {}} title="Channel">
          x
        </EditPanel>,
      );
      const body = screen.getByTestId("edit-panel-body");
      expect(body.className).toBe(
        "relative min-h-0 flex-1 overflow-y-auto p-6 [scrollbar-gutter:stable]",
      );
      expect(screen.queryByTestId("edit-panel-preview")).toBeNull();
    });
  });
});
