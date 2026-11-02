import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stableIds } from "../ui/test-utils.js";
import { SettingsScaffold, type SettingsScaffoldProps } from "./settings-scaffold.js";

afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("en");
});

type Form = NonNullable<SettingsScaffoldProps["form"]>;

// The body's own state: `loading` or a load `error` (`SUI-FEATURE-131` rev 5).
type BodyState = Pick<SettingsScaffoldProps, "loading" | "error">;
const BODY_STATES: Record<string, BodyState> = {
  loading: { loading: true },
  error: { error: "The settings could not be loaded." },
};

function renderPage(form: Partial<Form> = {}, state: BodyState = {}) {
  const onSave = vi.fn();
  const onReset = vi.fn();
  const result = render(
    <SettingsScaffold
      pageKey="general"
      title="General"
      subtitle="The name of this instance."
      body={<input aria-label="Name" />}
      {...state}
      form={{ dirty: false, onSave, onReset, ...(form as object) }}
    />,
  );
  return { ...result, onSave, onReset };
}

// jsdom has no ResizeObserver; an open bubble measures its arrow with one.
class NoResize {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeEach(() => vi.stubGlobal("ResizeObserver", NoResize));

// The text of the bubble `element` opens on hover once the hint delay ran, else `null`.
function tooltipOf(element: HTMLElement): string | null {
  vi.useFakeTimers();
  fireEvent.pointerMove(element, { pointerType: "mouse" });
  act(() => void vi.advanceTimersByTime(1500));
  vi.useRealTimers();
  const bubble = document.querySelector("[data-slot=tooltip-content]");
  return bubble === null ? null : bubble.textContent;
}

const line = () => screen.getByTestId("settings-general-disabled-reason");
const noLine = () => screen.queryByTestId("settings-general-disabled-reason");
const save = () => screen.getByTestId("settings-general-save");
const reset = () => screen.getByTestId("settings-general-reset");
const submit = () => fireEvent.submit(screen.getByTestId("settings-general-form"));
const HINT = "Test the connection first";

// Save is locked and named by `text`: the tooltip text and its one description, with the visible line
// when opted in.
function expectLockedBy(text: string, visible = true) {
  if (visible) expect(line()).toHaveTextContent(text);
  else expect(noLine()).toBeNull();
  expect(save()).toHaveAttribute("aria-disabled", "true");
  expect(save()).toHaveAccessibleDescription(text);
}

describe("SettingsScaffold form: visible lock reason (SUI-FEATURE-131 rev 3)", () => {
  // AC 4: nothing changed → the package's reason before Reset + Save, Save's one description and its
  // tooltip text, in the fixed footer.
  it.each([
    ["de", "Noch nichts geändert"],
    ["en", "Nothing changed yet"],
    ["es", "Aún no hay cambios"],
  ])("%s: nothing changed shows the package reason", async (lng, text) => {
    await i18n.changeLanguage(lng);
    renderPage({ showDisabledReason: true });
    expectLockedBy(text);
    expect(save().getAttribute("aria-describedby")).toBe(line().id);
    expect(line().className).toContain("text-muted-foreground");
    expect(line().classList).toContain("wrap-anywhere");
    expect(line().classList).toContain("text-sm");
    // First in reading order: before Reset, which stands before Save.
    expect(line().compareDocumentPosition(reset())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getAllByText(text)).toHaveLength(1);
    // The line sits in the fixed footer, outside the scrolling body.
    expect(screen.getByTestId("settings-footer")).toContainElement(line());
    expect(screen.getByTestId("settings-body")).not.toContainElement(line());
    expect(tooltipOf(save())).toBe(text);
  });

  // AC 4: after one edit the line is gone; never while a save runs; the buttons do not remount.
  it("the line goes after one edit, and while a save runs", () => {
    function Page() {
      const [name, setName] = useState("Studio");
      return (
        <SettingsScaffold
          pageKey="general"
          title="General"
          subtitle="The name of this instance."
          body={<input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />}
          form={{
            dirty: name !== "Studio",
            showDisabledReason: true,
            onSave: () => {},
            onReset: () => setName("Studio"),
          }}
        />
      );
    }
    render(<Page />);
    const button = save();
    expect(line()).toHaveTextContent("Nothing changed yet");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Studio 2" } });
    expect(noLine()).toBeNull();
    expect(save()).toBe(button);
    expect(button).not.toHaveAttribute("aria-disabled");
    cleanup();
    renderPage({ showDisabledReason: true, dirty: true, valid: false, saving: true });
    expect(noLine()).toBeNull();
  });

  // AC 3: valid=false without the pair → the package's invalid reason, as line, tooltip and
  // description.
  it.each([
    ["de", "Markierte Felder zuerst korrigieren"],
    ["en", "Fix the marked fields first"],
  ])("%s: valid=false shows the invalid reason", async (lng, text) => {
    await i18n.changeLanguage(lng);
    renderPage({ dirty: true, valid: false, showDisabledReason: true });
    expectLockedBy(text);
    expect(reset().hasAttribute("aria-disabled")).toBe(false);
    expect(tooltipOf(save())).toBe(text);
  });

  // AC 1/3 (rev 3, SUI-FEATURE-125 precedence): the app's lock and hint win over invalid and
  // unchanged; Reset follows dirty; a locked Save saves nothing, by click or by Enter.
  it.each([
    [false, true],
    [true, true],
    [true, false],
  ])("app lock with hint wins (dirty %s, valid %s)", (dirty, valid) => {
    const { onSave } = renderPage({
      submitDisabled: true,
      submitDisabledHint: HINT,
      showDisabledReason: true,
      dirty,
      valid,
    });
    expectLockedBy(HINT);
    expect(reset().getAttribute("aria-disabled")).toBe(dirty ? null : "true");
    expect(tooltipOf(save())).toBe(HINT);
    fireEvent.click(save());
    submit();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("app lock without the opt-in: the app hint is the tooltip, no line", () => {
    const { onSave } = renderPage({ dirty: true, submitDisabled: true, submitDisabledHint: HINT });
    expectLockedBy(HINT, false);
    submit();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("an unlocked app lock saves", () => {
    const { onSave } = renderPage({
      dirty: true,
      showDisabledReason: true,
      submitDisabled: false,
      submitDisabledHint: HINT,
    });
    expect(noLine()).toBeNull();
    submit();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  // AC 5 (rev 5): the body's loading lock is not an invalid value; nothing changed names that.
  it.each([
    ["de", "Noch nichts geändert", "Markierte Felder zuerst korrigieren"],
    ["en", "Nothing changed yet", "Fix the marked fields first"],
  ])("%s: loading, not dirty, shows the unchanged reason", async (lng, text, invalid) => {
    await i18n.changeLanguage(lng);
    renderPage({ showDisabledReason: true, valid: false }, BODY_STATES.loading);
    expect(screen.getByTestId("settings-loading")).toBeInTheDocument();
    expectLockedBy(text);
    expect(screen.queryByText(invalid)).toBeNull();
    expect(tooltipOf(save())).toBe(text);
  });

  // AC 5 (rev 5): dirty in loading or error, Save is silent; the body's state names the reason once.
  it.each(Object.keys(BODY_STATES))(
    "dirty while %s: no line, no tooltip, no description",
    (name) => {
      const { onSave } = renderPage({ dirty: true, showDisabledReason: true }, BODY_STATES[name]);
      expect(screen.getByTestId(`settings-${name}`)).toBeInTheDocument();
      expect(noLine()).toBeNull();
      expect(save()).toHaveAttribute("aria-disabled", "true");
      expect(save()).not.toHaveAttribute("aria-describedby");
      expect(tooltipOf(save())).toBeNull();
      submit();
      expect(onSave).not.toHaveBeenCalled();
    },
  );

  it("the reason row carries the prefixed testids", () => {
    render(
      <SettingsScaffold
        pageKey="general"
        testIdPrefix="mail"
        title="General"
        subtitle="The name of this instance."
        body={<input aria-label="Name" />}
        form={{ dirty: false, showDisabledReason: true, onSave: () => {}, onReset: () => {} }}
      />,
    );
    expect(screen.getByTestId("mail-disabled-reason")).toHaveTextContent("Nothing changed yet");
    expect(screen.getByTestId("mail-actions")).toContainElement(screen.getByTestId("mail-save"));
  });

  // AC 1 / SUI-FEATURE-250: a lock always names its reason.
  it("submitDisabled without submitDisabledHint is a type error", () => {
    const noop = () => {};
    // @ts-expect-error -- a lock always names its reason (SUI-FEATURE-250)
    const form: Form = { submitDisabled: true, dirty: false, onSave: noop, onReset: noop };
    expect(form).toHaveProperty("submitDisabled", true);
  });

  // AC 1/3: without the opt-in the footer is byte-identical; recorded on the version before it.
  const plain: Record<string, Partial<Form>> = {
    clean: { dirty: false },
    dirty: { dirty: true },
    invalid: { dirty: true, valid: false },
    saving: { dirty: true, saving: true },
  };
  it.each(Object.keys(plain))("footer without showDisabledReason unchanged: %s", (name) => {
    renderPage(plain[name]);
    expect(stableIds(screen.getByTestId("settings-footer").outerHTML)).toMatchSnapshot();
  });
  it.each(Object.keys(BODY_STATES))(
    "dirty footer without showDisabledReason unchanged: %s",
    (name) => {
      renderPage({ dirty: true }, BODY_STATES[name]);
      expect(stableIds(screen.getByTestId("settings-footer").outerHTML)).toMatchSnapshot();
    },
  );
});
