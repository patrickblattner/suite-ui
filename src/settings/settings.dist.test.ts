// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SUI-FEATURE-031: the classes of the action row and the tabbed body are literal strings in the
// source and in the built `dist` (the gate builds before the unit phase), where the apps' Tailwind
// scan finds them.
describe("Settings class strings", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const source = [
    "secret-card-header.tsx",
    "settings-action-row.tsx",
    "settings-block.tsx",
    "settings-field.tsx",
    "settings-footer.tsx",
    "settings-scaffold.tsx",
    "settings-section.tsx",
    "settings-toggle-field.tsx",
  ]
    .map((file) => readFileSync(`${root}src/settings/${file}`, "utf8"))
    .join("\n");
  const built = readdirSync(`${root}dist/settings`, { encoding: "utf8" })
    .filter((file) => file.endsWith(".js"))
    .map((file) => readFileSync(`${root}dist/settings/${file}`, "utf8"))
    .join("\n");
  const forms = [
    "flex gap-2",
    "flex min-h-0 flex-1 flex-col gap-4",
    "relative min-h-0 flex-1 overflow-y-auto pb-4",
    // SUI-FEATURE-042: the option group of a SettingsField and the head of a SettingsSection.
    "flex w-full max-w-xl flex-col gap-2 [&_[data-slot=radio-group]]:gap-2",
    "flex items-start justify-between gap-4 border-b border-border pb-4",
    // SUI-FEATURE-043: the frame of a SettingsBlock and the group of a SecretCardHeader.
    "flex flex-col gap-4 rounded-lg border p-4",
    "flex flex-col items-end gap-2",
    "flex justify-end gap-2",
    // SUI-FEATURE-058: the row of a SettingsToggleField.
    "grid max-w-xl grid-cols-[auto_1fr] items-center gap-2",
  ];

  it.each(forms)("%s", (form) => {
    expect(source).toContain(`"${form}"`);
    expect(built).toContain(`"${form}"`);
  });
});
