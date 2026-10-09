import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
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
    const header = screen.getByTestId("page-header");
    expect(header.nextElementSibling).toBe(screen.getByTestId("settings-general-form"));
    expect(screen.getByTestId("settings-general-form").firstElementChild).toBe(
      screen.getByTestId("settings-body"),
    );
    expect(screen.getByTestId("settings-body").nextElementSibling).toBe(
      screen.getByTestId("settings-footer"),
    );
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent("The name of this instance.");
  });

  it("orders Reset (destructive) before Save (success), both disabled while unchanged", () => {
    render(<GeneralPage save={() => Promise.resolve()} />);
    const save = screen.getByTestId("settings-general-save");
    const reset = screen.getByTestId("settings-general-reset");
    expect(save).toHaveAttribute("data-variant", "success");
    expect(reset).toHaveAttribute("data-variant", "destructive");
    expect(save).toHaveAttribute("type", "submit");
    expect(reset.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(save).toBeDisabled();
    expect(reset).toBeDisabled();
  });

  it("enables both after a change and disables both again after a reset", () => {
    render(<GeneralPage save={() => Promise.resolve()} />);
    fireEvent.change(screen.getByTestId("settings-name"), { target: { value: "Studio 2" } });
    expect(screen.getByTestId("settings-general-save")).toBeEnabled();
    expect(screen.getByTestId("settings-general-reset")).toBeEnabled();
    fireEvent.click(screen.getByTestId("settings-general-reset"));
    expect(screen.getByTestId("settings-name")).toHaveValue("Studio");
    expect(screen.getByTestId("settings-general-save")).toBeDisabled();
    expect(screen.getByTestId("settings-general-reset")).toBeDisabled();
  });

  it("saves once while a save runs, in the working state, and is disabled again afterwards", async () => {
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
    expect(button.className).toContain("disabled:opacity-100");
    fireEvent.click(button, { detail: 1 });
    fireEvent.submit(screen.getByTestId("settings-general-form"));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("Studio 2");

    await act(async () => {
      run.resolve();
      await run.promise;
    });
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).toBeDisabled();
    expect(screen.getByTestId("settings-general-reset")).toBeDisabled();
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
    expect(screen.getByTestId("settings-general-save")).toBeDisabled();
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
