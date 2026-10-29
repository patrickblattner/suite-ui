// Kept out of the field modules, whose exports are the package's public API (`src/ui/index.ts`).

// The one read-only look of every text-entry control (`SUI-FEATURE-117`): a muted surface and the
// default cursor, in light and dark; all else stays the editable field's. Keyed on the native
// `readonly` attribute (`Input`, `Textarea`, the text field of `TagInput`) or on `data-readonly` (the
// frame of `TagInput`), never on `:read-only`, which also matches a disabled field and the types the
// attribute does not apply to. A disabled field keeps its own look.
const READ_ONLY_LOOK =
  "[&:is([readonly],[data-readonly]):not(:disabled)]:cursor-default [&:is([readonly],[data-readonly]):not(:disabled)]:bg-muted";

export { READ_ONLY_LOOK };
