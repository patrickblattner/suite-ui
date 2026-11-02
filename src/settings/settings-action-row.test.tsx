import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stableIds } from "../ui/test-utils.js";
import { SettingsActionRow, type SettingsActionRowProps } from "./settings-action-row.js";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

type RowOverrides = Partial<SettingsActionRowProps>;

function renderRow(props: RowOverrides = {}) {
  const onSave = vi.fn();
  const onReset = vi.fn();
  const result = render(
    <SettingsActionRow
      dirty={false}
      onSave={onSave}
      onReset={onReset}
      testIdPrefix="mail"
      {...(props as object)}
    />,
  );
  return { ...result, onSave, onReset };
}

const line = () => screen.getByTestId("mail-disabled-reason");
const save = () => screen.getByTestId("mail-save");

describe("SettingsActionRow: visible lock reason (SUI-FEATURE-125, SUI-FEATURE-131)", () => {
  // SUI-FEATURE-125 AC 7: nothing changed → the package's reason before Reset + Save, Save's one
  // description and its tooltip text.
  it.each([
    ["de", "Noch nichts geändert"],
    ["en", "Nothing changed yet"],
    ["es", "Aún no hay cambios"],
  ])("%s: nothing changed shows the package reason", async (lng, text) => {
    await i18n.changeLanguage(lng);
    renderRow({ showDisabledReason: true });
    expect(line()).toHaveTextContent(text);
    expect(line()).toHaveClass("text-sm", "text-muted-foreground", "wrap-anywhere");
    expect(
      screen.getByTestId("mail-reset").compareDocumentPosition(line()) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    expect(save()).toHaveAttribute("aria-disabled", "true");
    expect(save()).toHaveAttribute("aria-describedby", line().id);
    expect(save()).toHaveAccessibleDescription(text);
    expect(screen.getAllByText(text)).toEqual([line()]);
  });

  it("the line goes after one edit, and while a save runs", () => {
    const props = { onSave: () => {}, onReset: () => {}, testIdPrefix: "mail" };
    const { rerender } = render(<SettingsActionRow {...props} showDisabledReason dirty={false} />);
    const button = save();
    expect(line()).toBeInTheDocument();
    rerender(<SettingsActionRow {...props} showDisabledReason dirty />);
    expect(screen.queryByTestId("mail-disabled-reason")).toBeNull();
    expect(save()).toBe(button);
    expect(button).not.toHaveAttribute("aria-disabled");
    rerender(<SettingsActionRow {...props} showDisabledReason dirty valid={false} saving />);
    expect(screen.queryByTestId("mail-disabled-reason")).toBeNull();
  });

  // SUI-FEATURE-131 AC 3: an invalid entry without an app hint → the package's invalid reason.
  it.each([
    ["de", "Markierte Felder zuerst korrigieren"],
    ["en", "Fix the marked fields first"],
  ])("%s: valid=false shows the invalid reason", async (lng, text) => {
    await i18n.changeLanguage(lng);
    renderRow({ showDisabledReason: true, dirty: true, valid: false });
    expect(line()).toHaveTextContent(text);
    expect(save()).toHaveAttribute("aria-disabled", "true");
    expect(save()).toHaveAccessibleDescription(text);
  });

  // SUI-FEATURE-125 AC 8, SUI-FEATURE-131 AC 1/3: the app's lock and hint win over invalid and
  // unchanged; Reset follows dirty; a locked Save calls nothing.
  it.each([
    { dirty: false, valid: true },
    { dirty: true, valid: true },
    { dirty: true, valid: false },
  ])("app lock with hint wins (%o)", (state) => {
    const { onSave } = renderRow({
      ...state,
      showDisabledReason: true,
      submitDisabled: true,
      submitDisabledHint: "Test the connection first",
    });
    expect(line()).toHaveTextContent("Test the connection first");
    expect(save()).toHaveAttribute("aria-disabled", "true");
    expect(save()).toHaveAccessibleDescription("Test the connection first");
    const reset = screen.getByTestId("mail-reset");
    if (state.dirty) expect(reset).not.toHaveAttribute("aria-disabled");
    else expect(reset).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(save());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("app lock without the opt-in: the app hint is the tooltip, no line", () => {
    const { onSave } = renderRow({
      dirty: true,
      submitDisabled: true,
      submitDisabledHint: "Test the connection first",
    });
    expect(screen.queryByTestId("mail-disabled-reason")).toBeNull();
    expect(save()).toHaveAttribute("aria-disabled", "true");
    expect(save()).toHaveAccessibleDescription("Test the connection first");
    fireEvent.click(save());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("an empty app hint draws no line", () => {
    renderRow({ showDisabledReason: true, submitDisabled: true, submitDisabledHint: "" });
    expect(screen.queryByTestId("mail-disabled-reason")).toBeNull();
    expect(save()).toHaveAttribute("aria-disabled", "true");
  });

  it("submitDisabled without submitDisabledHint is a type error", () => {
    // @ts-expect-error -- a lock always names its reason (SUI-FEATURE-250)
    const props: SettingsActionRowProps = {
      dirty: true,
      onSave: () => {},
      onReset: () => {},
      testIdPrefix: "mail",
      submitDisabled: true,
    };
    expect(props.submitDisabled).toBe(true);
  });

  // SUI-FEATURE-125 AC 7, SUI-FEATURE-131 AC 3: without the opt-in the row is byte-identical;
  // recorded on the version before the opt-in.
  it.each([
    ["clean", { dirty: false }],
    ["dirty", { dirty: true }],
    ["invalid", { dirty: true, valid: false }],
    ["saving", { dirty: true, saving: true }],
    ["leading", { dirty: false, leading: <button type="button">Remove</button> }],
  ] as [string, RowOverrides][])("row without showDisabledReason unchanged: %s", (_, props) => {
    const { container } = renderRow(props);
    expect(stableIds(container.innerHTML)).toMatchSnapshot();
  });
});
