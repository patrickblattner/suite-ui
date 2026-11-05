import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "i18next";
import type * as React from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { Checkbox } from "../ui/checkbox.js";
import { Combobox } from "../ui/combobox.js";
import { EditPanel } from "../ui/edit-panel.js";
import { Input } from "../ui/input.js";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group.js";
import { RestoreDefaultsButton } from "../ui/restore-defaults-button.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { Slider } from "../ui/slider.js";
import { Switch } from "../ui/switch.js";
import { TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
import { TagInput } from "../ui/tag-input.js";
import { TimezoneCombobox } from "../ui/timezone-combobox.js";
import { SecretCardHeader } from "./secret-card-header.js";
import { SettingsField } from "./settings-field.js";
import { SettingsScaffold } from "./settings-scaffold.js";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

// A settings page as an app builds it: the form against its loaded state, a save that resolves when
// the test says so and then makes the saved value the loaded one.
function GeneralPage({ save }: { save: (value: string) => Promise<void> }) {
  const [loaded, setLoaded] = useState("Studio");
  const [name, setName] = useState(loaded);
  const [saving, setSaving] = useState(false);
  return (
    <SettingsScaffold
      pageKey="general"
      title="General"
      subtitle="The name of this instance."
      left={
        <input
          aria-label="Name"
          data-testid="settings-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      }
      form={{
        dirty: name !== loaded,
        saving,
        onReset: () => setName(loaded),
        onSave: () => {
          setSaving(true);
          void save(name).then(() => {
            setLoaded(name);
            setSaving(false);
          });
        },
      }}
    />
  );
}

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe("SettingsScaffold", () => {
  it("puts the form directly under the header and starts it with the body", () => {
    render(<GeneralPage save={() => Promise.resolve()} />);
    // The head sits in its container `page-head` (`SUI-FEATURE-051` rev 11); the form follows it.
    const head = screen.getByTestId("page-header").closest("[data-slot=page-head]");
    expect(head?.nextElementSibling).toBe(screen.getByTestId("settings-general-form"));
    expect(screen.getByTestId("settings-general-form").firstElementChild).toBe(
      screen.getByTestId("settings-body"),
    );
    expect(screen.getByTestId("settings-body").nextElementSibling).toBe(
      screen.getByTestId("settings-footer"),
    );
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent("The name of this instance.");
  });

  // SUI-FEATURE-120 rev 5: a clean form locks Save with `aria-disabled` and its trigger lock, so it keeps
  // the focus after a save; Reset locks the same way (`GL-UI-050`, #201).
  it("orders Reset (destructive) before Save (success), both locked while unchanged", () => {
    const run = vi.fn(() => Promise.resolve());
    render(<GeneralPage save={run} />);
    const save = screen.getByTestId("settings-general-save");
    const reset = screen.getByTestId("settings-general-reset");
    expect(save).toHaveAttribute("data-variant", "success");
    expect(reset).toHaveAttribute("data-variant", "destructive");
    expect(save).toHaveAttribute("type", "submit");
    expect(reset.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(save).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(save);
    expect(run).not.toHaveBeenCalled();
    // #201: Reset locks itself with aria-disabled like Save, focusable.
    expect(reset).toHaveAttribute("aria-disabled", "true");
  });

  it("enables both after a change and disables both again after a reset", () => {
    render(<GeneralPage save={() => Promise.resolve()} />);
    fireEvent.change(screen.getByTestId("settings-name"), { target: { value: "Studio 2" } });
    expect(screen.getByTestId("settings-general-save")).toBeEnabled();
    expect(screen.getByTestId("settings-general-reset")).not.toHaveAttribute("aria-disabled");
    fireEvent.click(screen.getByTestId("settings-general-reset"));
    expect(screen.getByTestId("settings-name")).toHaveValue("Studio");
    expect(screen.getByTestId("settings-general-save")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("settings-general-reset")).toHaveAttribute("aria-disabled", "true");
  });

  it("saves once while a save runs, in the working state, and is locked again afterwards", async () => {
    const run = deferred();
    const save = vi.fn(() => run.promise);
    render(<GeneralPage save={save} />);
    fireEvent.change(screen.getByTestId("settings-name"), { target: { value: "Studio 2" } });
    const button = screen.getByTestId("settings-general-save");

    fireEvent.click(button, { detail: 1 });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("data-busy", "true");
    expect(button.querySelector("[data-slot=busy]")).not.toBeNull();
    // The busy lock replaces the generic dimming: the full colour stays.
    expect(button.className).not.toMatch(/opacity|disabled:bg-/);
    fireEvent.click(button, { detail: 1 });
    fireEvent.submit(screen.getByTestId("settings-general-form"));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("Studio 2");

    await act(async () => {
      run.resolve();
      await run.promise;
    });
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button, { detail: 1 });
    fireEvent.submit(screen.getByTestId("settings-general-form"));
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("settings-general-reset")).toHaveAttribute("aria-disabled", "true");
  });

  it("does not save an unchanged form on Enter", () => {
    const save = vi.fn(() => Promise.resolve());
    render(<GeneralPage save={save} />);
    fireEvent.submit(screen.getByTestId("settings-general-form"));
    expect(save).not.toHaveBeenCalled();
  });

  it("without a form: the grid only, no form and no footer", () => {
    render(
      <SettingsScaffold
        pageKey="integrations"
        title="Integrations"
        subtitle="Connected services."
        left={<p>Entry</p>}
        right={<p>Status</p>}
      />,
    );
    expect(screen.getByTestId("settings-grid")).toBeInTheDocument();
    expect(screen.getByTestId("settings-column-right")).toHaveTextContent("Status");
    expect(screen.queryByTestId("settings-footer")).toBeNull();
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.queryByTestId("settings-integrations-save")).toBeNull();
  });

  it.each([
    ["en", "Reset", "Save"],
    ["de", "Zurücksetzen", "Speichern"],
    ["es", "Restablecer", "Guardar"],
  ])("labels the pair from the suite namespace in %s", async (lng, reset, save) => {
    await i18n.changeLanguage(lng);
    render(<GeneralPage save={() => Promise.resolve()} />);
    expect(screen.getByTestId("settings-general-reset")).toHaveTextContent(reset);
    expect(screen.getByTestId("settings-general-save")).toHaveTextContent(save);
  });

  it("positions the scrolling body, so hidden native inputs stay in it", () => {
    render(<GeneralPage save={() => Promise.resolve()} />);
    expect(screen.getByTestId("settings-body")).toHaveClass("relative", "overflow-y-auto");
  });

  it("names the pair after testIdPrefix and keeps the footer testid", () => {
    render(
      <SettingsScaffold
        pageKey="general"
        testIdPrefix="settings"
        title="General"
        subtitle="The name of this instance."
        left={<p>Name</p>}
        form={{ dirty: false, onSave: () => {}, onReset: () => {} }}
      />,
    );
    expect(screen.getByTestId("settings-save")).toBeInTheDocument();
    expect(screen.getByTestId("settings-reset")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-general-save")).toBeNull();
    expect(screen.getByTestId("settings-footer")).toBeInTheDocument();
  });
});

describe("SettingsScaffold community additions (SUI-FEATURE-031)", () => {
  const scaffold = (props: Partial<React.ComponentProps<typeof SettingsScaffold>>) =>
    render(
      <SettingsScaffold
        pageKey="general"
        title="General"
        subtitle="The name of this instance."
        left={<p>Name</p>}
        form={{ dirty: false, onSave: () => {}, onReset: () => {} }}
        {...(props as object)}
      />,
    );

  it("AC1: the prefix names form, action row and Save", () => {
    scaffold({ testIdPrefix: "hauptmenue" });
    const actions = screen.getByTestId("hauptmenue-actions");
    expect(screen.getByTestId("hauptmenue-form")).toBeInTheDocument();
    expect(actions).toContainElement(screen.getByTestId("hauptmenue-save"));
    expect(actions).toContainElement(screen.getByTestId("hauptmenue-reset"));
    expect(actions.parentElement).toBe(screen.getByTestId("settings-footer"));
    expect(screen.queryByTestId("settings-general-form")).toBeNull();
  });

  it("AC1: formTestId names the form over the prefix", () => {
    scaffold({ testIdPrefix: "settings-ai", formTestId: "settings-ai-page" });
    expect(screen.getByTestId("settings-ai-page").tagName).toBe("FORM");
    expect(screen.queryByTestId("settings-ai-form")).toBeNull();
  });

  it("AC1: without a prefix the footer holds the pair directly, as in v0.21.0", () => {
    scaffold({});
    const footer = screen.getByTestId("settings-footer");
    expect(footer.querySelector('[data-testid$="-actions"]')).toBeNull();
    expect(footer.children).toHaveLength(2);
    expect(footer).toContainElement(screen.getByTestId("settings-general-save"));
    expect(screen.getByTestId("settings-general-form")).toBeInTheDocument();
  });

  it("AC2: valid={false} on a changed form locks Save and keeps Reset", () => {
    const save = vi.fn();
    scaffold({ form: { dirty: true, valid: false, onSave: save, onReset: () => {} } });
    expect(screen.getByTestId("settings-general-save")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("settings-general-reset")).toBeEnabled();
    fireEvent.submit(screen.getByTestId("settings-general-form"));
    expect(save).not.toHaveBeenCalled();
  });

  it("AC2: without valid a changed form saves as before", () => {
    const save = vi.fn();
    scaffold({ form: { dirty: true, onSave: save, onReset: () => {} } });
    expect(screen.getByTestId("settings-general-save")).toBeEnabled();
    fireEvent.submit(screen.getByTestId("settings-general-form"));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("AC3: tabs put one tab row over one full-width body inside one form", () => {
    const keys = ["provider", "areas", "prompts"];
    scaffold({
      left: undefined,
      scrollTestId: "settings-ai-scroll",
      tabs: {
        defaultValue: "provider",
        list: (
          <TabsList data-testid="tab-row">
            {keys.map((key) => (
              <TabsTrigger key={key} value={key}>
                {key}
              </TabsTrigger>
            ))}
          </TabsList>
        ),
        panels: keys.map((key) => (
          <TabsContent key={key} value={key} data-testid={`panel-${key}`}>
            {key}
          </TabsContent>
        )),
      },
    });
    const body = screen.getByTestId("settings-ai-scroll");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByTestId("tab-row").nextElementSibling).toBe(body);
    expect(body).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    expect(body).toContainElement(screen.getByTestId("panel-provider"));
    expect(screen.queryByTestId("settings-grid")).toBeNull();
    expect(screen.queryByTestId("settings-body")).toBeNull();
    expect(document.querySelectorAll("form")).toHaveLength(1);
    expect(screen.getByTestId("settings-general-form")).toContainElement(body);
    expect(screen.getByTestId("settings-tabs").nextElementSibling).toBe(
      screen.getByTestId("settings-footer"),
    );
  });

  it("AC3: without tabs the two halves stay", () => {
    scaffold({ right: <p>Status</p> });
    expect(screen.getByTestId("settings-body").firstElementChild).toBe(
      screen.getByTestId("settings-grid"),
    );
    expect(screen.queryByTestId("settings-tabs")).toBeNull();
  });
});

describe("SettingsFooter icons (SUI-FEATURE-037)", () => {
  it("AC1: Reset carries RotateCcwIcon and Save carries SaveIcon, each before the label", () => {
    render(<GeneralPage save={() => Promise.resolve()} />);
    const reset = screen.getByTestId("settings-general-reset");
    const save = screen.getByTestId("settings-general-save");
    const resetIcon = reset.querySelector("svg.lucide-rotate-ccw");
    const saveIcon = save.querySelector("svg.lucide-save");
    expect(resetIcon).not.toBeNull();
    expect(saveIcon).not.toBeNull();
    expect(reset.firstElementChild).toBe(resetIcon);
    expect(save.firstElementChild).toBe(saveIcon);
    expect(reset.lastChild).toHaveProperty("nodeType", Node.TEXT_NODE);
    expect(save.lastChild).toHaveProperty("nodeType", Node.TEXT_NODE);
    // Size comes from the button token, not from the icon.
    expect(resetIcon?.getAttribute("class")).not.toMatch(/size-/);
    expect(saveIcon?.getAttribute("class")).not.toMatch(/size-/);
  });

  it("AC2: while saving, Save shows only the working sign and hides its icon", () => {
    render(<GeneralPage save={() => new Promise<void>(() => {})} />);
    fireEvent.change(screen.getByTestId("settings-name"), { target: { value: "Studio 2" } });
    const save = screen.getByTestId("settings-general-save");
    fireEvent.click(save, { detail: 1 });
    expect(save.firstElementChild).toHaveAttribute("data-slot", "busy");
    expect(save.querySelector("svg.lucide-save")).not.toHaveAttribute("data-slot", "busy");
    expect(save.className).toContain("[&_svg:not([data-slot=busy])]:hidden");
  });

  it("AC3: icons are decorative; role and accessible name stay as in v0.27.0", () => {
    render(<GeneralPage save={() => Promise.resolve()} />);
    for (const icon of screen.getByTestId("settings-footer").querySelectorAll("svg")) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
    expect(screen.getByRole("button", { name: "Reset" })).toBe(
      screen.getByTestId("settings-general-reset"),
    );
    expect(screen.getByRole("button", { name: "Save" })).toBe(
      screen.getByTestId("settings-general-save"),
    );
  });
});

describe("SettingsScaffold single column and states (SUI-FEATURE-041)", () => {
  const form = { dirty: true, onSave: () => {}, onReset: () => {} };

  it("AC1: body is one column in the scroller, without a width limit", () => {
    render(
      <SettingsScaffold
        pageKey="general"
        title="General"
        subtitle="The name of this instance."
        body={<p>Name</p>}
        form={form}
      />,
    );
    const column = screen.getByTestId("settings-column");
    const scroller = screen.getByTestId("settings-body");
    expect(column.parentElement).toBe(scroller);
    expect(column).toHaveClass("flex", "flex-col", "gap-6");
    expect(column).toHaveTextContent("Name");
    for (const el of [column, scroller]) expect(el.className).not.toMatch(/max-w-/);
    expect(screen.queryByTestId("settings-grid")).toBeNull();
  });

  it("AC4: body together with left or tabs does not type-check", () => {
    const tabs = { list: null, panels: null };
    // @ts-expect-error body and left exclude each other
    void (<SettingsScaffold pageKey="g" title="G" subtitle="S" body={null} left={null} />);
    // @ts-expect-error body and tabs exclude each other
    void (<SettingsScaffold pageKey="g" title="G" subtitle="S" body={null} tabs={tabs} />);
  });

  it.each([
    ["loading", { loading: true }],
    ["loading over error", { loading: true, error: "Settings could not be loaded." }],
  ])("AC5: %s shows the loading row instead of the content", (_, state) => {
    render(
      <SettingsScaffold
        pageKey="general"
        title="General"
        subtitle="The name of this instance."
        body={<p data-testid="content">Name</p>}
        form={form}
        {...state}
      />,
    );
    expect(screen.getByTestId("settings-loading")).toHaveAttribute("data-slot", "skeleton");
    expect(screen.queryByTestId("settings-error")).toBeNull();
    expect(screen.queryByTestId("content")).toBeNull();
    expect(screen.getByTestId("page-title")).toHaveTextContent("General");
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent("The name of this instance.");
    expect(screen.getByTestId("settings-general-save")).toHaveAttribute("aria-disabled", "true");
  });

  it("AC5: error shows the text in text-destructive, header stays, Save is locked", () => {
    const save = vi.fn();
    render(
      <SettingsScaffold
        pageKey="general"
        title="General"
        subtitle="The name of this instance."
        tabs={{ list: <p data-testid="tab-row">Tabs</p>, panels: null }}
        form={{ ...form, onSave: save }}
        error="Settings could not be loaded."
      />,
    );
    const error = screen.getByTestId("settings-error");
    expect(error).toHaveTextContent("Settings could not be loaded.");
    // SUI-FEATURE-096: an InlineMessage alert, its text led by the screen-reader prefix.
    expect(error).toHaveAttribute("role", "alert");
    expect(error).toHaveTextContent(/^Error: Settings could not be loaded\.$/);
    // SUI-FEATURE-052: the AA text token, not the fill; its 4.5:1 on --background in both themes is
    // checked in styles.test.ts.
    expect(error).toHaveClass("text-destructive-text");
    expect(error).not.toHaveClass("text-destructive");
    // GL-UI-060: a hidden error symbol before the text.
    expect(error.firstElementChild).toHaveClass("lucide-circle-x");
    expect(error.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByTestId("tab-row")).toBeNull();
    expect(screen.getByTestId("page-title")).toHaveTextContent("General");
    expect(screen.getByTestId("page-subtitle")).toBeInTheDocument();
    expect(screen.getByTestId("settings-footer")).toBeInTheDocument();
    expect(screen.getByTestId("settings-general-save")).toHaveAttribute("aria-disabled", "true");
    fireEvent.submit(screen.getByTestId("settings-general-form"));
    expect(save).not.toHaveBeenCalled();
  });
});

// #541 (GL-UI-038 §Absenden): Save locked by an invalid entry still submits the form, so its fields
// show their errors and the first takes the focus; nothing is saved.
describe("SettingsScaffold submit of an invalid form", () => {
  function InvalidPage({ onSave, group = false }: { onSave: () => void; group?: boolean }) {
    const [city, setCity] = useState("");
    return (
      <SettingsScaffold
        pageKey="general"
        title="General"
        subtitle="The name of this instance."
        left={
          <>
            {group ? (
              <SettingsField label="Mode" htmlFor="mode" group error="Choose a mode.">
                <RadioGroup aria-label="Mode">
                  <RadioGroupItem value="a" aria-label="A" data-testid="mode-a" />
                  <RadioGroupItem value="b" aria-label="B" />
                </RadioGroup>
              </SettingsField>
            ) : null}
            <SettingsField label="Name" htmlFor="name" error="Enter a name.">
              <Input id="name" defaultValue="" />
            </SettingsField>
            <SettingsField
              label="City"
              htmlFor="city"
              error={city === "" ? "Enter a city." : undefined}
            >
              <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
            </SettingsField>
          </>
        }
        form={{ dirty: true, valid: false, onSave, onReset: () => {} }}
      />
    );
  }

  it("a click on the locked Save shows every error and focuses the first field", async () => {
    const onSave = vi.fn();
    render(<InvalidPage onSave={onSave} />);
    expect(screen.queryByText("Enter a name.")).toBeNull();
    const save = screen.getByTestId("settings-general-save");
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).not.toBeDisabled();
    act(() => save.focus());
    fireEvent.click(save);
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a city.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Enter in a field submits past the locked Save the same way", async () => {
    const onSave = vi.fn();
    render(<InvalidPage onSave={onSave} />);
    const city = screen.getByLabelText("City");
    act(() => city.focus());
    // Enter in a field clicks the form's submit button, the locked Save.
    fireEvent.click(screen.getByTestId("settings-general-save"));
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a city.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("with a group first, the focus goes to its first option", async () => {
    // The radio's indicator measures itself.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    render(<InvalidPage onSave={vi.fn()} group />);
    fireEvent.click(screen.getByTestId("settings-general-save"));
    expect(screen.getByText("Choose a mode.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("mode-a")).toHaveFocus());
  });
});

// #735 (GL-UI-038 rev 3 §Absenden): a save that leaves the form clean ends the submit state; a value
// that turns invalid afterwards without being typed shows its error late again.
describe("SettingsScaffold: a successful save ends the submit state", () => {
  function Page({ saves }: { saves: boolean }) {
    const [saved, setSaved] = useState("Init");
    const [name, setName] = useState("");
    return (
      <SettingsScaffold
        pageKey="general"
        title="General"
        subtitle="The name of this instance."
        left={
          <>
            <SettingsField
              label="Name"
              htmlFor="name"
              error={name === "" ? "Enter a name." : undefined}
            >
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </SettingsField>
            {/* A value from elsewhere (a reload), not typed. */}
            <button type="button" data-testid="clear" onClick={() => setName("")}>
              clear
            </button>
          </>
        }
        form={{
          dirty: name !== saved,
          valid: name !== "",
          onSave: () => {
            if (saves) setSaved(name);
          },
          onReset: () => setName(saved),
        }}
      />
    );
  }

  const submit = () => fireEvent.submit(screen.getByLabelText("Name").closest("form")!);

  it.each([
    [true, "late"],
    [false, "at once"],
  ])(
    "saves %s: after a failed submit and a save, a cleared value shows its error %s",
    async (saves) => {
      render(<Page saves={saves} />);
      submit();
      expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
      const name = screen.getByLabelText("Name");
      fireEvent.change(name, { target: { value: "Ada" } });
      fireEvent.blur(name);
      submit();
      fireEvent.click(screen.getByTestId("clear"));
      if (saves) expect(screen.queryByText("Enter a name.")).toBeNull();
      else expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    },
  );

  // A mutation-like save: `saving` set in the submit's handler, or only after `setTimeout(0)` (as
  // TanStack v5 delivers `isPending`); it saves a tick later.
  function Pending({
    timing,
    ok,
    onEnd,
  }: {
    timing: "handler" | "timeout";
    ok: boolean;
    onEnd: () => void;
  }) {
    const [saved, setSaved] = useState("Init");
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    return (
      <SettingsScaffold
        pageKey="general"
        title="General"
        subtitle="The name of this instance."
        left={
          <>
            <SettingsField
              label="Name"
              htmlFor="name"
              error={name === "" ? "Enter a name." : undefined}
            >
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </SettingsField>
            <button type="button" data-testid="clear" onClick={() => setName("")}>
              clear
            </button>
          </>
        }
        form={{
          dirty: name !== saved,
          valid: name !== "",
          saving,
          onSave: () => {
            const finish = () =>
              setTimeout(() => {
                if (ok) setSaved(name);
                setSaving(false);
                onEnd();
              }, 5);
            if (timing === "handler") {
              setSaving(true);
              finish();
            } else
              setTimeout(() => {
                setSaving(true);
                finish();
              }, 0);
          },
          onReset: () => setName(saved),
        }}
      />
    );
  }

  it.each([
    ["handler", true],
    ["timeout", true],
    ["handler", false],
    ["timeout", false],
  ] as const)(
    "saving set in the %s, saved %s: a cleared value then shows its error late only when saved",
    async (timing, ok) => {
      const ended = deferred();
      render(<Pending timing={timing} ok={ok} onEnd={ended.resolve} />);
      submit();
      expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
      const name = screen.getByLabelText("Name");
      fireEvent.change(name, { target: { value: "Ada" } });
      fireEvent.blur(name);
      submit();
      // The save starts and ends.
      await act(() => ended.promise);
      fireEvent.click(screen.getByTestId("clear"));
      if (ok) expect(screen.queryByText("Enter a name.")).toBeNull();
      else expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    },
  );
});

// #735 (GL-UI-038 rev 4 §Absenden): Reset ends the submit state; typing the saved values back by hand
// does not.
describe("SettingsScaffold: Reset ends the submit state, typing back does not", () => {
  function Page() {
    const [name, setName] = useState("");
    const [city, setCity] = useState("");
    return (
      <SettingsScaffold
        pageKey="general"
        title="General"
        subtitle="The name of this instance."
        left={
          <>
            <SettingsField
              label="Name"
              htmlFor="name"
              error={name === "" ? "Enter a name." : undefined}
            >
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </SettingsField>
            <SettingsField
              label="City"
              htmlFor="city"
              error={city === "" ? "Enter a city." : undefined}
            >
              <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
            </SettingsField>
          </>
        }
        form={{
          dirty: name !== "" || city !== "",
          valid: name !== "" && city !== "",
          onSave: () => {},
          onReset: () => {
            setName("");
            setCity("");
          },
        }}
      />
    );
  }

  function failedSubmit() {
    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "A" } });
    fireEvent.blur(name);
    fireEvent.submit(name.closest("form")!);
  }

  it("a failed submit, then Reset → no field errors", async () => {
    render(<Page />);
    failedSubmit();
    expect(await screen.findByText("Enter a city.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("settings-general-reset"));
    expect(screen.queryByText("Enter a name.")).toBeNull();
    expect(screen.queryByText("Enter a city.")).toBeNull();
  });

  it("a failed submit, then the values typed back by hand → the still invalid fields' errors stay", async () => {
    render(<Page />);
    failedSubmit();
    expect(await screen.findByText("Enter a city.")).toBeInTheDocument();
    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "" } });
    fireEvent.blur(name);
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a city.")).toBeInTheDocument();
  });
});

// #735 (GL-UI-038 rev 4 §Absenden): the person's next edit in the form drops a started save, so
// typing the saved values back ends nothing; a portal's event or a control's own dispatch does not.
describe("SettingsScaffold: an edit drops the started save, other events do not", () => {
  // jsdom marks no event trusted: this marks every input and change it sees as a person's, as a
  // browser does, except one from a control flagged `data-untrusted` (a control's own dispatch).
  function Trusted({ children }: { children: React.ReactNode }) {
    const trust = (event: React.SyntheticEvent) => {
      if (!(event.target instanceof Element && event.target.hasAttribute("data-untrusted")))
        (event as { isTrusted: boolean }).isTrusted = true;
    };
    return (
      <div onInputCapture={trust} onChangeCapture={trust}>
        {children}
      </div>
    );
  }

  it("valid, a save that saves nothing, an invalid saved state: typing the values back keeps the errors", async () => {
    function Page() {
      const [name, setName] = useState("");
      const [city, setCity] = useState("");
      return (
        <SettingsScaffold
          pageKey="general"
          title="General"
          subtitle="The name of this instance."
          left={
            <>
              <SettingsField
                label="Name"
                htmlFor="name"
                error={name === "" ? "Enter a name." : undefined}
              >
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
              </SettingsField>
              <SettingsField
                label="City"
                htmlFor="city"
                error={city === "" ? "Enter a city." : undefined}
              >
                <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
              </SettingsField>
            </>
          }
          form={{
            dirty: name !== "" || city !== "",
            valid: true,
            onSave: () => {},
            onReset: () => {},
          }}
        />
      );
    }
    render(
      <Trusted>
        <Page />
      </Trusted>,
    );
    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "A" } });
    fireEvent.blur(name);
    fireEvent.submit(name.closest("form")!);
    expect(await screen.findByText("Enter a city.")).toBeInTheDocument();
    fireEvent.change(name, { target: { value: "" } });
    fireEvent.blur(name);
    expect(screen.getByText("Enter a city.")).toBeInTheDocument();
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
  });

  it.each([
    ["a trusted input in a portal (a combobox search)", "portal"],
    ["an untrusted change of a control in the form (a Radix Select set by code)", "own"],
  ])("%s keeps the started save: its clean end ends the submit state", async (_case, source) => {
    const ended = deferred();
    function Page() {
      const [saved, setSaved] = useState("Init");
      const [name, setName] = useState("");
      const [saving, setSaving] = useState(false);
      return (
        <SettingsScaffold
          pageKey="general"
          title="General"
          subtitle="The name of this instance."
          left={
            <>
              <SettingsField
                label="Name"
                htmlFor="name"
                error={name === "" ? "Enter a name." : undefined}
              >
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
              </SettingsField>
              <select aria-hidden="true" data-testid="own" data-untrusted="" defaultValue="a">
                <option value="a">a</option>
                <option value="b">b</option>
              </select>
              {createPortal(<input aria-label="Search" data-testid="portal" />, document.body)}
              <button type="button" data-testid="clear" onClick={() => setName("")}>
                clear
              </button>
            </>
          }
          form={{
            dirty: name !== saved,
            valid: name !== "",
            saving,
            // As a mutation: `isPending` after `setTimeout(0)`, saved a tick later.
            onSave: () =>
              setTimeout(() => {
                setSaving(true);
                setTimeout(() => {
                  setSaved(name);
                  setSaving(false);
                  ended.resolve();
                }, 5);
              }, 0),
            onReset: () => setName(saved),
          }}
        />
      );
    }
    render(
      <Trusted>
        <Page />
      </Trusted>,
    );
    const name = screen.getByLabelText("Name");
    fireEvent.submit(name.closest("form")!);
    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    fireEvent.change(name, { target: { value: "Ada" } });
    fireEvent.blur(name);
    fireEvent.submit(name.closest("form")!);
    if (source === "portal")
      fireEvent.input(screen.getByTestId("portal"), { target: { value: "x" } });
    else fireEvent.change(screen.getByTestId("own"), { target: { value: "b" } });
    await act(() => ended.promise);
    fireEvent.click(screen.getByTestId("clear"));
    expect(screen.queryByText("Enter a name.")).toBeNull();
  });
});

// #739 (GL-UI-038 rev 4 §Absenden): a Select, Combobox, Checkbox, Switch, RadioGroup or Slider sets
// its value by code, so a pick sends no trusted input or change event; the control reports the pick
// itself, and putting the saved choice back after a failed save ends nothing.
describe("SettingsScaffold: a pick put back after a failed save keeps the submit state", () => {
  beforeEach(() => {
    // jsdom has no pointer capture and no scrolling into view, which Radix calls on opening, and no
    // ResizeObserver, with which Radix measures a checkbox, switch, radio or slider thumb.
    for (const name of ["hasPointerCapture", "releasePointerCapture", "scrollIntoView"]) {
      Object.defineProperty(HTMLElement.prototype, name, {
        configurable: true,
        value: () => false,
      });
    }
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
  });

  // jsdom marks no event trusted: this marks every input and change as a person's, as a browser does,
  // except one on a control's hidden native input (a Radix bubble input, the combobox's hidden input),
  // which only the control's own dispatch reaches.
  function Trusted({ children }: { children: React.ReactNode }) {
    const trust = (event: React.SyntheticEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const hidden =
        target.getAttribute("aria-hidden") === "true" ||
        (target instanceof HTMLInputElement && target.type === "hidden") ||
        target.style.display === "none";
      if (!hidden) (event as { isTrusted: boolean }).isTrusted = true;
    };
    return (
      <div onInputCapture={trust} onChangeCapture={trust}>
        {children}
      </div>
    );
  }

  const OPTIONS = [
    { value: "basic", label: "Basic" },
    { value: "pro", label: "Pro" },
  ];

  type Control = "select" | "combobox" | "checkbox" | "switch" | "radio" | "slider";

  function Page({ control }: { control: Control }) {
    const [plan, setPlan] = useState("basic");
    const [city, setCity] = useState("");
    const toggle = (checked: boolean) => setPlan(checked ? "pro" : "basic");
    return (
      <SettingsScaffold
        pageKey="general"
        title="General"
        subtitle="The name of this instance."
        left={
          <>
            {control === "select" ? (
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger fieldName="Plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : control === "combobox" ? (
              <>
                <label htmlFor="plan">Plan</label>
                <Combobox id="plan" options={OPTIONS} value={plan} onValueChange={setPlan} />
              </>
            ) : control === "checkbox" ? (
              <Checkbox
                aria-label="Plan"
                checked={plan === "pro"}
                onCheckedChange={(checked) => toggle(checked === true)}
              />
            ) : control === "switch" ? (
              <Switch aria-label="Plan" checked={plan === "pro"} onCheckedChange={toggle} />
            ) : control === "radio" ? (
              <RadioGroup aria-label="Plan" value={plan} onValueChange={setPlan}>
                {OPTIONS.map((option) => (
                  <RadioGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={option.label}
                  />
                ))}
              </RadioGroup>
            ) : (
              <Slider
                aria-label="Plan"
                min={0}
                max={1}
                value={plan === "pro" ? 1 : 0}
                onValueChange={(next) => toggle(next === 1)}
              />
            )}
            <SettingsField
              label="City"
              htmlFor="city"
              error={city === "" ? "Enter a city." : undefined}
            >
              <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
            </SettingsField>
          </>
        }
        // The saved state: Basic, no city. The save saves nothing.
        form={{ dirty: plan !== "basic", valid: true, onSave: () => {}, onReset: () => {} }}
      />
    );
  }

  function pick(control: Control, label: "Basic" | "Pro") {
    if (control === "select") {
      fireEvent.keyDown(screen.getByRole("combobox", { name: "Plan" }), { key: "Enter" });
      fireEvent.keyDown(screen.getByRole("option", { name: label }), { key: "Enter" });
    } else if (control === "combobox") {
      fireEvent.keyDown(screen.getByRole("combobox", { name: "Plan" }), { key: "ArrowDown" });
      fireEvent.click(screen.getByRole("option", { name: label }));
    } else if (control === "checkbox" || control === "switch") {
      fireEvent.click(screen.getByRole(control, { name: "Plan" }));
    } else if (control === "radio") {
      fireEvent.click(screen.getByRole("radio", { name: label }));
    } else {
      fireEvent.keyDown(screen.getByRole("slider", { name: "Plan" }), {
        key: label === "Pro" ? "End" : "Home",
      });
    }
  }

  it.each(["select", "combobox", "checkbox", "switch", "radio", "slider"] as const)(
    "%s: a failed save, then the saved choice picked back → the city's error stays",
    async (control) => {
      render(
        <Trusted>
          <Page control={control} />
        </Trusted>,
      );
      pick(control, "Pro");
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(screen.getByTestId("settings-general-reset")).not.toHaveAttribute("aria-disabled");
      fireEvent.submit(screen.getByTestId("settings-general-form"));
      expect(await screen.findByText("Enter a city.")).toBeInTheDocument();
      pick(control, "Basic");
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      // Clean again: the saved choice is back.
      expect(screen.getByTestId("settings-general-reset")).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByText("Enter a city.")).toBeInTheDocument();
    },
  );

  // One value in the form, saved as `initial`, beside an untouched required City field. "by code to
  // Team" sets a third value by code, "by code" the saved value; "saved" ends a save in flight with the current value saved. With
  // `pending` a save sets `saving` and keeps it until "saved"; without it the save saves nothing.
  function ValueForm({
    initial,
    pending = false,
    field,
  }: {
    initial: string;
    pending?: boolean;
    field: (value: string, setValue: (next: string) => void) => React.ReactNode;
  }) {
    const [saved, setSaved] = useState(initial);
    const [value, setValue] = useState(initial);
    const [city, setCity] = useState("");
    const [saving, setSaving] = useState(false);
    return (
      <SettingsScaffold
        pageKey="general"
        title="General"
        subtitle="The name of this instance."
        left={
          <>
            {field(value, setValue)}
            <button type="button" data-testid="by-code-other" onClick={() => setValue("team")}>
              by code to Team
            </button>
            <button type="button" data-testid="by-code" onClick={() => setValue(saved)}>
              by code
            </button>
            <button
              type="button"
              data-testid="saved"
              onClick={() => {
                setSaved(value);
                setSaving(false);
              }}
            >
              saved
            </button>
            <SettingsField
              label="City"
              htmlFor="city"
              error={city === "" ? "Enter a city." : undefined}
            >
              <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
            </SettingsField>
          </>
        }
        form={{
          dirty: value !== saved,
          valid: true,
          saving,
          onSave: () => {
            if (pending) setSaving(true);
          },
          onReset: () => {},
        }}
      />
    );
  }

  const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  const reset = () => screen.getByTestId("settings-general-reset");
  async function failedSubmit() {
    await tick();
    expect(reset()).not.toHaveAttribute("aria-disabled");
    fireEvent.submit(screen.getByTestId("settings-general-form"));
    expect(await screen.findByText("Enter a city.")).toBeInTheDocument();
  }
  async function cleanWithError(visible: boolean) {
    await tick();
    expect(reset()).toHaveAttribute("aria-disabled", "true");
    if (visible) expect(screen.getByText("Enter a city.")).toBeInTheDocument();
    else expect(screen.queryByText("Enter a city.")).toBeNull();
  }

  const tags = (value: string, setValue: (next: string) => void) => (
    <TagInput
      aria-label="Tags"
      value={value.split(",")}
      onChange={(next) => setValue(next.join(","))}
      testId="tags"
    />
  );
  const tagField = () => screen.getByTestId("tags").querySelector("input")!;
  const addTag = (tag: string) => {
    fireEvent.change(tagField(), { target: { value: tag } });
    fireEvent.keyDown(tagField(), { key: "Enter" });
  };

  it("timezone combobox: a failed save, then the saved zone picked back → the city's error stays", async () => {
    render(
      <Trusted>
        <ValueForm
          initial="Europe/Berlin"
          field={(value, setValue) => (
            <>
              <label htmlFor="tz">Zone</label>
              <TimezoneCombobox id="tz" value={value} onValueChange={setValue} />
            </>
          )}
        />
      </Trusted>,
    );
    const pickZone = (zone: string) => {
      fireEvent.click(screen.getByRole("combobox", { name: "Zone" }));
      fireEvent.click(screen.getByRole("option", { name: zone }));
    };
    pickZone("Europe/Paris");
    await failedSubmit();
    pickZone("Europe/Berlin");
    await cleanWithError(true);
  });

  it.each([
    ["×", () => fireEvent.click(screen.getAllByTestId("tags-remove")[1]!)],
    ["Backspace in the empty field", () => fireEvent.keyDown(tagField(), { key: "Backspace" })],
  ])(
    "tag input: a failed save, then the added tag removed with %s → the city's error stays",
    async (_how, removeLast) => {
      render(
        <Trusted>
          <ValueForm initial="a" field={tags} />
        </Trusted>,
      );
      addTag("b");
      await failedSubmit();
      removeLast();
      await cleanWithError(true);
    },
  );

  it("tag input: a failed save, then the removed tag added back → the city's error stays", async () => {
    render(
      <Trusted>
        <ValueForm initial="a,b" field={tags} />
      </Trusted>,
    );
    fireEvent.click(screen.getAllByTestId("tags-remove")[1]!);
    await failedSubmit();
    addTag("b");
    await cleanWithError(true);
  });

  it("Restore defaults: a failed save, then defaults equal to the saved values restored → the city's error stays", async () => {
    render(
      <Trusted>
        <ValueForm
          initial="basic"
          field={(value, setValue) => (
            <>
              <Checkbox
                aria-label="Plan"
                checked={value === "pro"}
                onCheckedChange={(checked) => setValue(checked === true ? "pro" : "basic")}
              />
              <RestoreDefaultsButton onClick={() => setValue("basic")} />
            </>
          )}
        />
      </Trusted>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Plan" }));
    await failedSubmit();
    fireEvent.click(screen.getByTestId("restore-defaults"));
    await cleanWithError(true);
  });

  it("a change while the save is in flight drops nothing: the save's clean end ends the submit state", async () => {
    render(
      <Trusted>
        <ValueForm
          initial="basic"
          pending
          field={(value, setValue) => (
            <Checkbox
              aria-label="Plan"
              checked={value === "pro"}
              onCheckedChange={(checked) => setValue(checked === true ? "pro" : "basic")}
            />
          )}
        />
      </Trusted>,
    );
    const plan = () => screen.getByRole("checkbox", { name: "Plan" });
    fireEvent.click(plan());
    await failedSubmit();
    // Saving: toggled off and on again, the value the save started with.
    fireEvent.click(plan());
    fireEvent.click(plan());
    await tick();
    fireEvent.click(screen.getByTestId("saved"));
    await cleanWithError(false);
  });

  it.each(["select", "checkbox"] as const)(
    "%s set by code, first to another value, then to the saved one, keeps the started save: its clean end ends the submit state",
    async (control) => {
      render(
        <Trusted>
          <ValueForm
            initial="basic"
            field={(value, setValue) =>
              control === "select" ? (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger fieldName="Plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...OPTIONS, { value: "team", label: "Team" }].map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Checkbox
                  aria-label="Plan"
                  checked={value === "pro"}
                  onCheckedChange={(checked) => setValue(checked === true ? "pro" : "basic")}
                />
              )
            }
          />
        </Trusted>,
      );
      pick(control, "Pro");
      await failedSubmit();
      // Another value by code first: the control learns of it in its own render, before the saved
      // value comes back.
      fireEvent.click(screen.getByTestId("by-code-other"));
      await tick();
      fireEvent.click(screen.getByTestId("by-code"));
      await cleanWithError(false);
    },
  );

  it("tag input: a failed save, then a tag picked from the suggestions → the city's error stays", async () => {
    render(
      <Trusted>
        <ValueForm
          initial="a,b"
          field={(value, setValue) => (
            <TagInput
              aria-label="Tags"
              value={value.split(",")}
              onChange={(next) => setValue(next.join(","))}
              suggestions={["b", "c"]}
              testId="tags"
            />
          )}
        />
      </Trusted>,
    );
    fireEvent.click(screen.getAllByTestId("tags-remove")[1]!);
    await failedSubmit();
    tagField().focus();
    fireEvent.change(tagField(), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("option", { name: "b" }));
    await cleanWithError(true);
  });

  it("tag input: typed text taken over as the submit moves the focus on → the city's error stays", async () => {
    render(
      <Trusted>
        <ValueForm initial="a,b" field={tags} />
      </Trusted>,
    );
    fireEvent.click(screen.getAllByTestId("tags-remove")[1]!);
    await tick();
    // Typed but not taken over: the submit's focus on City leaves the field, which takes it over.
    tagField().focus();
    fireEvent.change(tagField(), { target: { value: "b" } });
    fireEvent.submit(screen.getByTestId("settings-general-form"));
    await cleanWithError(true);
  });

  // A checkbox outside, and a control that is no edit of this form: the result is the same, the
  // started save waits for clean, and the saved value set back by code ends the submit state.
  const planCheckbox = (value: string, setValue: (next: string) => void) => (
    <Checkbox
      aria-label="Plan"
      checked={value === "pro"}
      onCheckedChange={(checked) => setValue(checked === true ? "pro" : "basic")}
    />
  );
  function OtherToggle({ where }: { where: "secret" | "panel" }) {
    const [on, setOn] = useState(false);
    return where === "secret" ? (
      <SecretCardHeader testIdPrefix="secret" active={{ checked: on, onCheckedChange: setOn }} />
    ) : (
      <EditPanel open onOpenChange={() => {}} title="Channel" onSubmit={() => true}>
        <Checkbox
          aria-label="Inner"
          checked={on}
          onCheckedChange={(next) => setOn(next === true)}
        />
      </EditPanel>
    );
  }

  it.each([
    ["the Active switch of a secret card (acts at once, without Save)", "secret"],
    ["a checkbox in an EditPanel inside the scaffold (its own form)", "panel"],
  ] as const)("%s is no edit of the scaffold's form", async (_case, where) => {
    render(
      <Trusted>
        <ValueForm
          initial="basic"
          field={(value, setValue) => (
            <>
              {planCheckbox(value, setValue)}
              <OtherToggle where={where} />
            </>
          )}
        />
      </Trusted>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Plan" }));
    await failedSubmit();
    if (where === "secret") fireEvent.click(screen.getByTestId("secret-active"));
    else fireEvent.click(screen.getByRole("checkbox", { name: "Inner" }));
    await tick();
    fireEvent.click(screen.getByTestId("by-code"));
    await cleanWithError(false);
  });
});
