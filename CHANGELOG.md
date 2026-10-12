# Changelog

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
