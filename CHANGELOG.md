# Changelog

## 0.92.1 — #144: EditorHeader and PreviewToolbar fold follow-ups

Not breaking.

- `useFoldSteps` takes what the bar shows (language, texts) as a second argument. When it changes, the widths remembered for the old texts are dropped and the bar folds afresh before the paint. A shorter text unfolds again without a resize: after Save ("Saved" is shorter than "Draft · unsaved"), or after switching to a language with shorter labels.
- `useFoldSteps` stops watching the parts a fold step swaps out.
- The Reset confirm hands the focus back to Reset while it is usable, else to the ⋯ that Reset was folded into, else to Back; never to the page's body. `ConfirmDeleteDialog` takes `returnFocus` for this.
- Not changed: the state dot's look and the ⋯ menu's grouping and label alignment wait for open owner decisions.

## 0.92.0 — SUI-FEATURE-090 rev 4 (#141): EditorHeader at narrow width

Breaking for apps that pass `lifecycle.preview` or `lifecycle.menu` (see the migration note). Without a lifecycle, and at any width where everything fits, the header looks as before.

- `EditorHeader` measures its own width. What does not fit folds into its one ⋯ menu, in this order: Undo/Redo, Reset, Preview, then the lifecycle menu's own entries. After that the state text shrinks to its dot, then Back, `lifecycle.next` (if it has an icon) and last Save show their icon only, keeping their name as accessible name and tooltip. Back, the title, `lifecycle.next` and Save always stay visible. Once the header is wide enough again, it steps back.
- A folded action keeps its text, icon and lock reason in the menu and is chosen by keyboard. Folded Reset still asks first. There is never more than one ⋯.
- The title truncates with an ellipsis and shows its full text as a tooltip. It never shrinks below 6 characters plus the ellipsis.
- The header's ⋯ is the row menu's body (`SUI-FEATURE-066`) with a `ghost icon-sm` trigger, like the header's other icon buttons. Without `lifecycle.menu` it is named by the new string `editor.more`: "Weitere Aktionen" / "More actions" / "Más acciones".
- The shrunk state is a `size-2` dot, `bg-success` for "Gespeichert" and `bg-warn` for "Entwurf · ungespeichert". Its full text is the tooltip and the screen-reader status text.
- The title's floor is measured from its own first 6 characters and the ellipsis, in its own font.
- Icon-only, a locked next step's bubble shows its name above the reason (`IconButtonTooltip` takes `named` for this).
- `EditorHeader` and `PreviewToolbar` fold through one hook, `useFoldSteps`. It watches the bar and each of its parts, so a runtime language switch re-folds both (#143); a render that changes no width no longer re-measures.
- `RowMenuItem` takes an optional `icon`, shown before the label, and an optional `shortcut`, shown as the key hint (folded Undo and Redo keep `Ctrl+Z` / `Ctrl+Y`). `RowActionMenu` is exported.
- Every overflow menu (row, preview toolbar, editor header): a locked entry with a hint stays in the arrow keys' path, so its reason reaches the keyboard; choosing it does nothing.
- Gallery: the EditorHeader demos lose the sideways scroller from #139.

### Migration

- `lifecycle.preview` is now `{ label, icon?, onClick, disabledText? }` instead of a ReactNode. The package renders the `outline` button.
- `lifecycle.menu` is now `{ label, items: RowMenuItem[] }` instead of a ReactNode. Drop the app's own ⋯ dropdown; its entries go into `items`.

## 0.91.4 — SUI-FEATURE-076 rev 7 (#140): gate:record checks the install against the lockfile first

Not breaking. Package API unchanged.

- Before the gate, `npm run gate:record` compares every `packages` entry of `package-lock.json` with the installed `node_modules/<package>/package.json`, offline; an optional platform package not installed on this machine does not count. `npm ls --all` runs as well, for versions outside their declared range. On any difference it ends with exit 4, names the first differing packages and gives the hint "`npm ci` im Haupt-Checkout", without a gate run and without a record. It never installs anything itself.

## 0.91.3 — SUI-FEATURE-076 rev 5 (#135): gallery phase in the pinned Playwright image

Not breaking. Package API unchanged. No CI workflow: the package is built and checked by the local gate.

- The local gate's `gallery` phase runs `npm run gallery:image`: the gallery screenshots from `gallery/gallery.spec.ts` inside the pinned Playwright image via `docker run` (`linux/amd64`). All gallery baselines are regenerated in that image; macOS baselines are gone.
- The pinned image is written out once, in `scripts/playwright-image.ts`, and refused while it does not match the lockfile's `@playwright/test`.
- Still scene: fixed browser clock, time zone `Europe/Zurich`, locale `en-US`, `animations: "disabled"`.
- New screenshots of every gallery page and the shell at 390 and 1440 px, in de, light and dark.
- `npm run gate:record` runs the merge gate and, on green with a clean tree, records it for HEAD's tree in `.spec-sync/gate-records/`. `npm run release:tag` is the only way to tag: it tags and pushes `v<version>` only with a green record for HEAD's tree.

## 0.91.2 — SUI-FEATURE-075 rev 2 (#134): Node 24 for development, CI and gate

Not breaking for the package API. Development, build and gate switch from Node 22 to Node 24.

- `engines.node` `>=22` → `>=24.15`; new `.nvmrc` names major 24.
- `package-lock.json` regenerated with npm 11; `npm audit` reports 0 vulnerabilities.
- No code change needed for APIs removed in Node 24; gallery baselines unchanged.

## 0.91.1 — SUI-FEATURE-009 rev 2 (#133): npm audit without findings

Not breaking. Runtime dependencies and the package API unchanged; only dev dependencies move. `npm audit` reports 0 vulnerabilities (all severities, dev dependencies included).

- `vitest` 3.2 → 5.0.4 (closes `tinypool` prototype pollution to RCE and the `@vitest/mocker` path traversal).
- `tsup` 8.5 → 9.0.0, which brings `esbuild` 0.27 → 0.28.2 (also used by `vite`; closes the dev-server file read).
- `spec-sync-toolkit` v0.23.1 → v0.24.0, which brings `simple-git` 3.36 → 4.0.2 and `@simple-git/argv-parser` 2.x (closes the unsafe-operation guard bypasses).
- No package replaced or removed.

## 0.91.0 — SUI-FEATURE-008 rev 2 (#132): RowActions test id per action

Not breaking. Without the new props every test id stays as before.

- `RowActions` (and `useRowActionButtons`): new props `editTestId?` and `deleteTestId?` set the `data-testid` of edit and delete; default `row-edit` and `row-delete`. Apps switching to `RowActions` pass their per-row ids through (`tag-edit-<id>`, `tag-delete-<id>` …).
- `RowMenuItem`: new `"data-testid"?` for an entry of the ⋯ menu; default `row-menu-item`.
- Variant, size, text and order of the actions unchanged.

## 0.90.0 — SUI-FEATURE-007 rev 2 (#131): RemovableChip, a chip with a remove button

Not breaking.

- New building block `RemovableChip` (`label`, `onRemove`, `removeLabel` for the ×'s accessible name, `disabled?`, `testId?` → `-chip`/`-remove`): the `h-6` chip with a round `size-6` × of `TagInput`, keyboard-reachable with the focus ring. Apps replace their own remove chips (`Button size="icon-xs" className="size-4"`) with it; a chip without removal stays `Badge`.
- `TagInput` renders its chips with `RemovableChip`; look, test ids and behaviour unchanged.

## 0.89.0 — SUI-FEATURE-006 rev 2 (#130): Button size `inline` for the text link

Not breaking. `ButtonSize` keeps its members; `inline` is typed only beside `variant="link"`.

- `Button`: new size `size="inline"` for a text link in a table row, a path or running text: no height and no padding of its own (its height is the line of text's), the icon gap of `sm`, `text-sm`. The focus ring stays.
- `size="inline"` with any `variant` other than `"link"` is a type error. Apps replace `variant="link"` with `className="h-auto p-0"`/`"h-auto px-0"` by `size="inline"`.

## 0.88.1 — SUI-FEATURE-049 rev 6 (#129): tooltips close on every focus change

Not breaking.

- `Tooltip`, `Hint`, `OverflowTooltip`: a bubble opened by hover closes in the next frame as soon as focus lands on any element outside its trigger and its content — also when the trigger is not focusable (e.g. `OverflowTooltip` on a `MediaTile` name). Previously only a blur of the trigger closed it.

## 0.88.0 — SUI-FEATURE-005 rev 2 (#128): LabelWithHelp and RadioGroup follow the field canon

Not breaking. Two defaults change; apps drop their shims on the pin bump.

- `LabelWithHelp`: the label is `text-sm font-medium` and has no outer margin any more (`mb-1` dropped). The field container sets the 8 px to the field (`gap-2`); an app override of `mb-0`/`font-medium` is no longer needed.
- `RadioGroup`: the options stand 8 px apart (`gap-2`) instead of 12 px (`gap-3`); an app override to `gap-2` is no longer needed.
- `SettingsField`, `SettingsToggleField`: their own overrides of both defaults removed; layout unchanged.

## 0.87.0 — SUI-FEATURE-080 rev 2 (#127): Cancel in the delete dialog is always "Cancel"

Breaking for callers that pass `cancelLabel`: it no longer compiles.

- `ConfirmDeleteDialog`: `cancelLabel` removed; Cancel always shows the package text (`actions.cancel`).

## 0.86.0 — SUI-FEATURE-074 rev 2 (#126): an icon button's hint opens on hover only

Not breaking.

- `IconButtonTooltip`: focus opens no bubble any more — keyboard, initial or programmatic focus, free, disabled with `disabledText` and declaring `busy` alike; a bubble beside the button covered the neighbour of its row and caught its clicks. The text reaches the focus as the name (`label`), while disabled as the span's description (`disabledText`). Hover opens it after the hint delay as before. Applies to every consumer, `RowActions` and `PreviewToolbar` included.

## 0.85.0 — SUI-FEATURE-073 rev 2 (#125): dialog mode only on the form size, the time zone list floats

Breaking for types only: a compact `DialogContent` with `mode` no longer compiles. Runtime unchanged.

- `DialogContent`: `mode?: "add" | "edit"` types only together with `size="form"`; there it stays optional.
- `TimezoneCombobox`: the open list floats over the content at the field's width and shifts nothing below. Where a dialog or panel body would clip it, the body grows by the missing part; where it cannot, the list opens upwards.
- `TimezoneCombobox`: with `data-testid="<id>"` the list carries `<id>-options` and each option `<id>-option`.
- `TimezoneCombobox`: `aria-errormessage`, set on the field only while it is invalid.

## 0.84.0 — SUI-FEATURE-072 rev 2 (#123): a row action can be running

Not breaking.

- `RowAction`: `busy?: boolean`. A running action shows the `Button` working state in full colour with `aria-busy` and is locked against a second click, a double click and activation through its shortcut; for this action in this row only, the other actions stay operable.
- `PreviewToolbar`: the selected row's running action shows the same state; folded into ⋯, its entry is locked while it runs.
- `IconButtonTooltip`: a control that declares `busy` sits in a span trigger, so its hint, still "‹label› ‹rowName›", opens on hover while it is locked.
- Gallery: on the list with `?actions=1` the second row's copy is running.

## 0.83.0 — SUI-FEATURE-004 rev 3 (#122): the usage table shows domain states

Not breaking.

- `UsageTable`: an item's `status` is a catalog state or a domain state `{ tone, label }`; the latter renders as a `StatusChip` in that tone with the app's label.

## 0.82.0 — SUI-FEATURE-070 rev 5 (#121): the truncated name badge carries no `title`

Not breaking.

- `CanvasOverlay`: a name badge that ends in "…" no longer carries the full name as its `title`; the full name stays in the `canvas.selected` announcement.

## 0.81.0 — SUI-FEATURE-070 rev 4 (#120): the name badge is clipped at no frame edge

Not breaking.

- `CanvasOverlay`: past the overlay's right edge the name badge moves left, above the selection and inside its top left corner alike.
- A badge wider than the overlay is capped at its width and ends in "…"; it then carries the full name as its `title`.
- The action bar's check against the badge now uses the badge's actual left edge (2 px further right than before at a selection away from the left edge).
- Gallery: the canvas section shows two narrow frames with a selection at the right edge, one with a badge moved left and one truncated.

## 0.80.0 — SUI-FEATURE-070 rev 3 (#119): the name badge is never clipped

Not breaking.

- `CanvasOverlay`: the selection's name badge stands above the selection, left-aligned; without room up to the overlay's edge it moves inside the top left corner, and at the left edge it does not reach past the frame.
- The action bar also moves below the selection where, above it, it would cover the name badge (a narrow selection); the badge stays.

## 0.79.0 — SUI-FEATURE-071 rev 1 (#117): `PropertyPanel` and `DrawerRail`

Not breaking (new components).

- New `PropertyPanel` (`path`, `tabs`, `activeTab`, `onTab`): the fixed 340 px column on the right of a visual editor, as high as the editor area, with a `--border` rule on the left. The head holds the path (Document › … › element; every step but the last is a link that selects its element) and the tabs in the fixed order Content · Layout · Background, leaving out the ones the element lacks. Only the body scrolls.
- New `DrawerRail` (`items`, `open?`, `onOpen`, `styleSave?`): the narrow rail on the left with `ghost` `icon-sm` buttons Add · Layers · Style · Document (tooltip with the name, optional `badge`). A click opens the 300 px drawer beside it, which narrows the canvas instead of covering it; a second click or `Esc` closes it (innermost `Esc` first) and the focus returns to its button. At most one is open; its button is pressed.
- The style drawer has a footer with "Save style" (`success`, `SaveIcon`) and the scope note "Applies to everything that uses this brand kit"; the app supplies the save and its dirty state through `styleSave`.
- Texts `canvas.tab.*`, `canvas.drawer.*`, `canvas.styleSave` and `canvas.styleScope` in de/en/es.
- Gallery: the components page shows an editor frame with the rail, the open style drawer, the canvas and the property panel.

## 0.78.0 — SUI-FEATURE-070 rev 1 (#116): `CanvasOverlay` and `CanvasZoom`

Not breaking (new components).

- New `CanvasOverlay` (`hovered?`, `selected?`, `actions?`, `inserts?`, `onSelectParent?`): the unscaled selection layer of a visual editor. It is rendered inside the positioned canvas frame and takes the pointer only on its own controls; the app passes its elements' rects in frame coordinates after zoom. Hover is a dashed 2 px `--ring` frame, the selection a solid 2 px `--ring` frame with a name tag (`--primary`) at its top left; the lines stay 2 px at any zoom. A new selection is announced once ("Selected: ‹name›").
- `actions` float above the selection, right-aligned, and below it when the space above is less than their height. Each insert point is a round `+` (`outline`, `icon-xs`, named by its `label`), always visible and in the tab order.
- `Esc` with a selection calls `onSelectParent`; without one it goes on outwards (`GL-UI-007`).
- New `CanvasZoom` (`zoom`, `mode: "fit" | "actual"`, `onMode`): the radio group "Fit" · "100 %" with the current level as text, for the `PreviewToolbar`'s further tools between status and device.
- Texts `canvas.fit`, `canvas.actual`, `canvas.selected` and `canvas.zoom` (the group's name) in de/en/es.
- Gallery: the components page shows a canvas under a preview toolbar with the zoom, with hover, selection, actions and insert points.

## 0.77.0 — SUI-FEATURE-069 rev 1 (#115): a lifecycle slot in the `EditorHeader`

Not breaking (one new optional property).

- `EditorHeader` takes `lifecycle?: { preview?; menu?; next?: { label; icon?; onClick; busy?; disabledText? } }`. It stands on the right before the editor group, in the order Preview · ⋯ · next step, followed by a vertical separator at the bar's height. Without it nothing changes.
- The next step is a `Button` `success`, size `default`, with the working state while `busy`. While the draft is unsaved (`dirty`) it is locked with the tooltip "Save first" (`suite:editor.saveFirst`, de/en/es); a `disabledText` of the app takes precedence and locks it as well. So never more than one green button is usable at a time.
- Gallery: the `EditorHeader` section shows an editor with a lifecycle saved and with a draft.

## 0.76.0 — SUI-FEATURE-066 rev 3 (#114): a hint per overflow menu entry

Not breaking (one new optional property).

- `RowMenuItem` takes `hint?: string`. An entry with a hint shows it as the package's description hint (`Hint`, after `--tooltip-hint-delay`, never on focus) and references the same text through `aria-describedby`; its accessible name stays `label`.
- A disabled entry with a hint still takes the pointer, so its hint (the condition under which it unlocks) opens too; it still cannot be chosen.
- Folded actions in the `PreviewToolbar` (`SUI-FEATURE-067`) keep their hint in the ⋯ menu: their name with the row's ("Edit Home"), or their `disabledText` while locked. A folded "Used by" without a use carries "Not used anywhere".
- Gallery: the `preview` page's row menu shows a plain and a locked entry with a hint.

## 0.75.0 — SUI-FEATURE-004 rev 1 (#113): "Used by" action and `UsageTable`

Breaking for `MediaDetailShell.usage` (see below); otherwise additive.

- `RowActionSet` takes `usage?: { count; active; onToggle }`. `useRowActionButtons` draws it as the first extra action: an `outline` icon button (`Link`) with the count as a badge, tooltip "Used by ({{count}})", `aria-pressed = active`, filled while active like the chosen device of the `PreviewToolbar`. With `count: 0` it is locked with the tooltip "Not used anywhere". Row and `PreviewToolbar` show it alike; folded (`SUI-FEATURE-067`) it is the first entry of the ⋯ menu.
- New `UsageTable` (`items: { id; title; type; status?; href?; onOpen? }[]`): Title · Type · Status (status as `StatusChip`), the whole row opens the entry by click or Enter (`onOpen`, else navigates to `href`), empty "No usages". Needs a router, like `MediaUsageList`.
- `PreviewFrame` takes `usage?: { active; onClose; content }`. Active, `content` takes the preview's place at its height; the preview stays mounted. `Esc` returns to the preview first, the next `Esc` closes it.
- **Breaking:** `MediaDetailShell.usage` is now `{ count; active; onToggle; content }` instead of a `ReactNode`. The usages no longer stand in the right column: the shell draws the "Used by" button in its preview head, and active, `content` (a `UsageTable`) replaces the media preview. `Esc` returns to the preview before it closes the shell.
- `MediaUsageList` stays exported, marked `@deprecated` in favour of `UsageTable`.
- New strings `usage.action`, `usage.none`, `usage.empty`, `usage.title`, `usage.type`, `usage.status` (de, en, es).
- Gallery: the `preview` page shows a preview with "Used by" off and on; the media detail shell uses the button and `UsageTable`.

## 0.74.0 — SUI-FEATURE-003 rev 1 (#112): `PreviewToolbar` separator and filled active device

Not breaking (no new props).

- The chosen device in the `PreviewToolbar` is filled (`bg-primary`, `text-primary-foreground`, `border-primary`, also on hover) in light and dark; the other stays `outline`. `ViewToggle` and `SplitWorkspace` are unchanged.
- A vertical 1 px rule (`bg-border`, the height of the `sm` buttons, `aria-hidden`, `data-testid="preview-separator"`) parts the view group (device and/or maximize) from the actions. It stands only when both are there; wrapped (`SUI-FEATURE-067` step 3) only when maximize stands beside the actions in the first line.
- Gallery: the `preview` page shows the separator and the filled device.

## 0.73.0 — SUI-FEATURE-068 rev 2 (#111): `PageHeader` add entry reports open and closed

Not breaking (two new optional props).

- A `PageHeader` `add` entry takes optional `expanded?: boolean` and `controls?: string`; when set, the button renders `aria-expanded` and `aria-controls`. Without them nothing changes.
- Gallery: new upload add entry that toggles a panel and reports open/closed.

## 0.72.0 — SUI-FEATURE-067 rev 2 (#110): `PreviewToolbar` in a narrow column

Not breaking (no new props).

- `PreviewToolbar` measures its own width (`ResizeObserver`, never the window) and, when it does not fit one line, shrinks in order: the actions but edit fold into the ⋯ overflow menu, then edit too; after that language, status and device wrap into a second, left-aligned line. Widening restores in reverse order.
- Folded, the menu holds the row's actions in the row's order (extra actions, edit, the row's own menu entries), delete last after a separator. Without a row `menu` the ⋯ button is named by the new string `actions.more` ("More for {{name}}").
- Close stays far right in the first line in every state, never alone: without maximize or actions the device switch stays beside it, and with neither the toolbar does not wrap.
- The toolbar carries `data-shrink` (`0`–`3`) for its current step.
- Gallery: the `preview` page shows the full toolbar at 420, 600 and 900 px.

## 0.71.0 — SUI-FEATURE-066 rev 2 (#109): `RowActionSet` overflow menu

Not breaking (one new optional property).

- `RowActionSet` takes `menu?: { label; items: { label; onSelect; destructive?; disabled? }[] }`. It shows as an `outline` ⋯ icon button (`aria-label` and tooltip = `label`) after `extra` and edit and before delete, and opens a `DropdownMenu`.
- Destructive entries stand last after a separator, in the destructive colour; disabled entries are muted and cannot be chosen. The menu works by keyboard (Enter opens, arrows select, Esc closes).
- The table row (`RowActions`) and the `PreviewToolbar` render the menu alike through `useRowActionButtons`, which now also returns `menu`.
- New type export `RowMenuItem`.
- Gallery: the `preview` page shows a row with a menu and its matching preview header.

## 0.70.0 — SUI-FEATURE-065 rev 2 (#107): `ConfirmDeleteDialog` locks Confirm alone

Not breaking (two new optional props).

- `ConfirmDeleteDialog` takes `confirmDisabled` (default `false`): only the confirm button is locked, in the muted destructive colour. Cancel stays usable, no working state shows (unlike `busy`), and Enter triggers nothing. Use it for a condition inside the dialog, such as a confirmation word in `children`.
- `confirmDisabledHint`: the already translated reason, shown as the confirm button's hint while locked.
- Gallery: new page `typed-word` with a confirmation-word field.

## 0.69.0 — SUI-FEATURE-064 rev 3 (#106): `EditorHeader` and `useEditorLeaveGuard`

Not breaking (new exports, one new optional option).

- New `EditorHeader` (`@suite/ui/ui/editor-header`), the header of every editor page (`GL-UI-034`). It sits next to the editor's own toolbar and replaces none of its tools.
  - Left: "Back" with an arrow, then the record's `title`.
  - Right, in this order: Undo, Redo (`icon-sm`, tooltip with the shortcut chip, `aria-keyshortcuts`), the state ("Saved" or "Draft · unsaved", as a polite status), "Reset" (`outline`), "Save" (`success`, `SaveIcon`, working state during `saving`).
  - Reset and Save are locked while `dirty` is false. Reset first asks in the shared confirm dialog ("Discard the draft and return to the saved state?") and only then calls `onReset`.
  - Ctrl/Cmd+Z undo, Ctrl+Y and Cmd/Ctrl+Shift+Z redo, through `useEditShortcuts`: never in a text field, and only while `canUndo`/`canRedo`.
- New `useEditorLeaveGuard({ dirty, saving, onBack, onSave, onReset })`: the `GL-UI-007` guard for an editor page. Esc, Back, the navigation, browser back and route changes ask first. Discard calls `onReset` and then goes on; Save calls `onSave` and goes on when it returns `true` (or a promise of it). Wrap the header's `onBack` in its `guard` and render its `dialog`.
- `useLeaveGuard` takes an optional `onDiscard`, which runs before a discarded leave goes on.
- New strings `editor.back`, `editor.undo`, `editor.redo`, `editor.saved`, `editor.draft` and `editor.resetConfirm` (de/en/es).

### Per app, when raising the pin

**production-cockpit** and **community-platform**: every editor page puts `EditorHeader` and `useEditorLeaveGuard` in place of its own header bar and autosave indicator; its own toolbar stays. The app keeps the working draft on the server and passes `dirty`, `canUndo` and `canRedo`.

## 0.68.0 — SUI-FEATURE-063 rev 2 (#105): `MediaTile`

Not breaking (new export only).

- New `MediaTile` (`@suite/ui/ui/media-tile`), the tile of a media list in `TileGridShell`. The whole tile is one button, and a click (or Enter) calls `onOpen`.
  - Preview on top at a fixed height. An image fills it edge to edge (`object-cover`). Other kinds show their type icon, muted: `FileVideoIcon` for video, `FileTextIcon` for everything else. The `extension` appears under the icon in capitals ("pdf" → "PDF").
  - The name sits on one line and ends with "…" when it is too long; the full name is in the tooltip. The name is the button's accessible name.
  - `description` shows on at most two lines (`text-xs text-muted-foreground`). `tags` show as outline badges that wrap. An empty description or an empty tag list drops its line. Both describe the button (`aria-describedby`).
  - With `selected` the tile acts as a picker choice: it gets `aria-pressed`, and while `selected` is `true` an inset selection ring in `primary`, independent of the focus ring.
  - `kind` uses `MediaDetailKind` (`image`, `video`, `audio`, `pdf`, `other`).

### Per app, when raising the pin

**production-cockpit** and **community-platform**: the tile view of the media library renders `MediaTile` in `TileGridShell`, switched with the view toggle; the picker passes `selected`.

## 0.67.1 — GL-UI-007 rev 3 (#104): the leave guard opens with the focus on Save

Not breaking (no API change).

- The "Save changes?" dialog opens with the focus on Save, so Enter saves and, on success, carries out the held way out; Esc stays Cancel. This applies to the guard built into `EditPanel` and `MediaDetailShell` and to `useLeaveGuard` on detail and editor pages.
- Save shows its focus ring from the moment the dialog opens, even when a pointer opened it (the browser would not match `:focus-visible` there). The ring goes away with the first blur; after that the usual `focus-visible` rule applies.

### Per app, when raising the pin

No change needed. A test that expected the focus on the dialog itself when it opens now finds it on `leave-guard-save`.

## 0.67.0 — SUI-FEATURE-062 rev 3 (#103): crop and flip at an image placement

Not breaking (new exports only).

- New `CropEditor` (`@suite/ui/ui/crop-editor`), a dialog that works on its own and can also be embedded in an editor's own toolbar (`GL-UI-035`). The whole image stands still and a frame in the ratio `aspect` lies over it; without `aspect` the frame keeps the original's ratio. For a background, pass the ratio of the surface at the preview width it shows.
  - Eight handles resize the frame proportionally; the opposite side or corner stays put. Dragging inside the frame moves it, and the frame never leaves the image.
  - Keyboard on the frame: the arrows move it by 1 %, with Shift by 10 %; `+`/`-` resize it about its centre; Enter applies.
  - The footer holds Reset, Cancel and Apply, all right-aligned. Apply calls `onApply` with `{ x, y, width, height }` as fractions 0–1 of the original. Reset calls `onApply(null)`. Both close the editor; Cancel only closes it.
- New `ImagePlacementButtons`: Flip/Flipped and Crop/Cropped, two outline `sm` buttons for the place next to the change-image button. Each is highlighted (`data-active`) while it is flipped or cropped; Crop opens the `CropEditor`.
- New `CroppedImage`, `cropToSourceRect`, `croppedBackground` and `CroppedBackground` (`@suite/ui/ui/cropped-image`). They draw the crop and the flip with CSS alone and never change `src`:
  - `CroppedImage` puts the image scaled and offset in a frame with `overflow: hidden` in the crop's ratio; the frame then mirrors for `flipped`.
  - `cropToSourceRect` gives the source rectangle in pixels for canvas renderers.
  - `croppedBackground` gives the CSS for a background layer: the crop covers the box and stands on its centre; `cover` without a crop; `scaleX(-1)` for the layer when `flipped`.
  - `CroppedBackground` puts that layer behind its children and measures again on every resize. Only the layer mirrors, never the children.
  - Without `naturalWidth`/`naturalHeight`, `CroppedImage` and `CroppedBackground` read the size from the loaded image.
- New strings `crop.action`, `crop.active`, `crop.apply`, `crop.reset`, `flip.action` and `flip.active` (de/en/es).

### Per app, when raising the pin

**production-cockpit** and **community-platform**: every image placement with a change button gets `ImagePlacementButtons` and stores `crop` next to `flipped`. Changing the image resets both. Draw with `CroppedImage`, `CroppedBackground` or `cropToSourceRect`. Editors with their own toolbar keep their controls and may embed `CropEditor` there.

## 0.66.0 — SUI-FEATURE-061 rev 3 (#102): `MediaDetailShell` and `MediaUsageList`

Not breaking (new exports only).

- New `MediaDetailShell` (`@suite/ui/ui/media-detail-shell`): the media detail view as its own panel surface, with the same Sheet base, width and sidebar-aware left edge as `EditPanel`; never nest it in `EditPanel`. Preview left, details right; below the package's `panel-split` width the preview stacks on top.
  - Head of the preview: "‹n› of ‹N›", Previous / Next (locked at the ends), Close, and with `pickAction` "Choose this media item". ← and → page, Esc and Close call `onClose`; with `dirty` each asks "Save changes?" first. While `saving` nothing pages or closes.
  - Preview by `kind`: `image`, `video` (with controls), `audio`, `pdf` (`iframe`), `other` (placeholder icon). `alt` names the preview.
  - Right column: the "Details" title, then the slots `facts`, `fields`, `suggest`, `actions`, `usage` in that order.
  - Footer: Reset and Save as the dirty-state pair; both locked while `dirty` is false, Save carries the working state during `saving`, Reset calls `onReset` without asking. Enter in a field saves. `onSave` returning `true` (or a promise of it) lets Save in the leave dialog carry out the held paging or close.
  - `open` defaults to `true`.
- New `MediaUsageList`: "Used in" with each use as a router link (`to`), language and status muted after it; without uses "not used".
- New strings `media.position`, `media.details`, `media.pick`, `media.usedIn`, `media.unused`, `media.uploadedAt`, `media.uploadedBy` (de/en/es).
- `EditPanel` takes its surface class and geometry from the same internal helper as the shell; markup and styles are unchanged.

### Per app, when raising the pin

**production-cockpit** and **community-platform**: build the media detail view on `MediaDetailShell` with `FileFacts` in `facts`, the fields with `TagInput` in `fields`, and `MediaUsageList` in `usage` (`CPT-FEATURE-UI-110`); `media.uploadedAt` and `media.uploadedBy` label the upload rows next to `FileFacts`.

## 0.64.0 — SUI-FEATURE-027 rev 4 (#96): the view switch's scroller is the active tab's panel

Breaking (0.x minor). `tabs` on `DataTableShell` and `TileGridShell` takes the tab row together with its active value: `tabs: { list, value }` (new type `ListTabs` from `@suite/ui/list/list-tabs`). A bare `TabsList` or `{ list }` without `value` is a type error.

- The scroller becomes the `tabpanel` of the active tab: the tab's `aria-controls` points at it and the panel is named by the tab (`aria-labelledby`). Before, the tab row controlled no panel and axe reported `aria-valid-attr-value` (`GL-UX-001`).
- In tab mode the scroller is a tab stop (`tabindex="0"`, with the package focus ring), so every tab's rows scroll by keyboard; under `tableProps.role="grid"` (or `gridProps` on `TileGridShell`) the grid stays the one tab stop.
- In tab mode `scrollLabel` sets neither `role="region"` nor `aria-label`: the tab names the panel.
- A `value` that matches no tab of the surrounding `Tabs` leaves the list in place; the panel is always mounted.
- Without `tabs`, markup and classes are unchanged.

Also in this release, SUI-FEATURE-022 rev 8 (#95, #97): a select trigger is named by its field name.

- New `fieldName` (text) on `SelectTrigger`: it creates a hidden element with the bare field name, without a colon, and points `aria-labelledby` at it (WCAG 4.1.2: a combobox takes no name from its content). It shows nothing; a visible field name stays the caller's own child, marked `aria-hidden="true"` so it is not read again with the value. Blank text sets no name, and a caller's own `aria-labelledby` wins.
- `FilterSelect` is now named "Severity" instead of by `aria-label`; its visible "Severity: Warning" stays one run, with tooltip and width unchanged. `SortSelect` is named "Sort by"; its muted "Sort by:" prefix looks as before.

### Per app, when raising the pin

**production-cockpit**: `ReviewInboxPage` and `PlanReleaseQueue` pass their view switch as `tabs={{ list: <TabsList>…</TabsList>, value: activeView }}`, with the same value the surrounding `Tabs` holds. No surface changes its look; the list scroller gains a tab stop after the tab row.

**community-platform**: the same change on every `DataTableShell` with a tab row: `AdCatalogPage`, `BookingsPage` (via `KursZugangsrechteTab`), `SubscriptionsPage` (both tables), `TrashPage` and `WorkshopTerminePage` (including `TerminePapierkorb`).

**Both apps**: a `SelectTrigger` that shows a field name as text before the value and is named by `aria-label` can switch to `fieldName="…"` with the visible text as an `aria-hidden` child. `FilterSelect` and `SortSelect` need no change. A test that reads a trigger's whole text content now also reads the hidden field name; read the value slot (`[data-slot=select-value]`) instead.

## 0.63.0 — SUI-DESIGN-011 rev 5 (#91): strings per language, `registerSuiteStringsLazy`

Not breaking (new exports only).

- Each language of the `suite` namespace is its own export: `@suite/ui/strings/en`, `@suite/ui/strings/de`, `@suite/ui/strings/es`, so the app's bundler can put each one in a separate chunk.
- New `registerSuiteStringsLazy(i18n)` from `@suite/ui/strings`. It registers English at once (the fallback chain ends there) and loads the active language by dynamic import; the returned promise settles once it is in. Every later `i18n.changeLanguage(lng)` loads that language before i18next switches, so no English text flashes and components need no loading state. A regional code (`de-CH`) loads its base language; an unknown code keeps English.
  - The start promise never rejects: if the active language's chunk fails to load, the suite strings stay English (the fallback), and the next switch to that language tries the import again.
  - Switches that overlap while a chunk loads: the last requested language wins.
  - `i18n.changeLanguage()` without a language (the detector path) preloads what the detector reports first, and if i18next settles on another language, loads it and switches again so the suite strings re-render in it.
- New `SUITE_LANGUAGES` (`["en", "de", "es"]`) from `@suite/ui/strings`; `SuiteLanguage` is derived from it. The user menu lists its languages from this constant, so `@suite/ui/shell/user-menu` no longer pulls the German and Spanish strings in at start.
- The package now declares `sideEffects` (only `dist/styles.css` and the parity command-line tool have any). Verified with a Vite build: what an app loads at start with `registerSuiteStringsLazy` and the user menu holds no German or Spanish text; each language is a chunk of its own. esbuild-based production bundlers keep de and es in the start graph, because `@suite/ui/strings` still carries the synchronous `registerSuiteStrings`.
- `registerSuiteStrings(i18n)` is unchanged: it registers all three languages synchronously, for tests and the gallery.

### Per app, when raising the pin

**production-cockpit** and **community-platform**: switch the i18n setup to the lazy variant. Replace `registerSuiteStrings(i18n)` with `await registerSuiteStringsLazy(i18n)` (same import path `@suite/ui/strings`), called after `i18n.init(…)` and awaited before the first render. Unit-test setups that need every language at once may keep `registerSuiteStrings`. No surface changes its look.

community-platform calls `registerSuiteStrings(i18n)` at module top level in `client/src/i18n/index.ts`; the lazy call needs a top-level `await` there, or an awaited setup step before the app mounts.

## 0.62.0 — SUI-FEATURE-002 (#90): app switches removed

Breaking (0.x minor). `configureSuiteUi` and the `@suite/ui/config` export are gone; every key had one target form, which is now the only behaviour:

- **FilterBar** (`GL-UI-024`): search first, growing over the remaining width; the filters right-aligned after it, then reset, then sort (on media lists the view toggle last). When the row is too narrow the controls wrap as one group to the next line, the search keeps at least 320 px and nothing is dropped. `filters` still takes a list (`staticFilter`/`dynamicFilter`, the kind only orders within the filter block) or one node.
- **Select width** `measured`: `FilterSelect`, `SortSelect` and the page size of `TablePagination` are as wide as their longest entry in the active language.
- **User menu** `fit`: the panel is as wide as its longest entry (at least 14rem collapsed); collapsed, the trigger shows avatar and kebab only.
- **Table** (`GL-UI-023`): sticky header, no own overflow on the table container; hover only on rows with `data-grid-row`; the actions column (`data-col-kind="actions"`) sticks right only while the body overflows sideways, never beside a preview.

Also in this release:

- Lists (`DataTableShell`) now always show a vertical scrollbar (`overflow-y-scroll`), so a sticky actions column never slides into an empty gutter; visible in the cockpit, where lists had no permanent bar before.
- `DataTableShell`'s scroller keeps a keyboard-focused row clear of the sticky header and of a stuck actions column (scroll padding).
- On a row narrower than 20rem the search takes the full row width instead of overflowing it (320 px reflow).
- `controlHeightViolations` from `@suite/ui/testing` skips test ids ending in `-sizer` (the hidden sizers of measured selects).

Importing `@suite/ui/config` is now a type and module-resolution error.

### Per app, when raising the pin

**production-cockpit** (never called the switch, so every target form is new to it)

- Lines to drop: none.
- Surfaces whose look changes: every list's FilterBar (search moves from between the filters to the far left, static and dynamic filters both sit right of it); every `FilterSelect`, `SortSelect` and page-size trigger (measured width instead of the fixed minimums); the sidebar user menu (fit width; collapsed trigger without name and role); every table (sticky header, no hover on rows without `data-grid-row`, sticky actions column on overflowing lists). Update the Iris baselines of all list surfaces and of the shell's user menu.

**community-platform** (set every key to its target form)

- Lines to drop: the `configureSuiteUi` import from `@suite/ui/config` and the whole `configureSuiteUi({ filterBar, selectWidth, userMenu, tableScroll, tableRowHover, tableActions })` call with its comment in `client/src/i18n/index.ts`.
- Surfaces whose look changes: every list's FilterBar only (`block` → search first; the filter block moves from left of the search to right of it, before reset and sort). Update the Iris baselines of the affected lists. Select widths, user menu and tables are unchanged.
