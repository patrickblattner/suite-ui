import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
});
