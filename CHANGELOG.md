# Changelog

## 0.110.2 — #185: EditPanel pager chevrons keep a full-contrast focus ring

Fix, not breaking (WCAG 1.4.11, GL-UI-013). The locked ‹/› chevrons of the `EditPanel` pager no longer dim with element `opacity-50`, which also dimmed their focus ring below 3:1; they take the same locked look as `MediaDetailShell`'s since 0.110.1: a half-tone icon, no hover tint (in dark mode too), the element opaque. The shared class now lives beside `PANEL_SURFACE_CLASS` in `lib/panel-geometry`.

## 0.110.1 — #184: locked Save and pager chevrons keep a full-contrast focus ring

Fix, not breaking (WCAG 1.4.11). In `MediaDetailShell` the locked Save (nothing to save) and the locked ‹/› chevrons at the ends no longer dim with element `opacity-50`, which also dimmed their focus ring to about 1.85:1. Save shows its locked look by half-tone fill and text, the chevrons by a half-tone icon without hover tint; the element stays opaque, so the ring keeps full contrast. A running Save (busy) stays at full colour. Changed baselines: `media-detail-de-dark.png`, `media-detail-en-dark.png` and `media-detail-es-dark.png`, 3 pixels each in the Save icon, as the gallery compares them (Playwright's default colour threshold 0.2, no pixel allowance). The light `media-detail` baselines are unchanged: there the Save label's new slight tint stays below that threshold.

## 0.110.0 — #182, SUI-FEATURE-085 rev 2: focus after the delete dialog and Save, guarded pick

Not breaking; no new props.

**Migration:** Cockpit drops its workaround that put the focus back on the delete button itself after the confirmation closed: the package now returns it. Apps that tested `media-detail-save` with `toBeDisabled()` check `aria-disabled="true"` instead.

- Dialog close focus (`ConfirmDeleteDialog` and every package dialog): opened programmatically, Cancel and Esc return the focus to the element focused at opening. When that element is gone after the delete, the focus goes to its neighbour as before, else to the surface's main content; behind a modal dialog that is still open (a confirm inside a dialog) that surface is the dialog, not `main` behind it. Without main content the container the dialog was opened from takes it, so the focus never falls to `<body>` and the next Tab stays in the surface.
- `MediaDetailShell`: Save with nothing to save is locked with `aria-disabled` instead of `disabled`, same look; it stays focusable, and after a successful save the focus stays on it (it no longer moves to the first field).
- `MediaDetailShell`: "Choose this media item" (`pickAction`) runs through the same unsaved-changes guard as paging and closing; without changes it picks at once.

## 0.109.0 — #181, SUI-FEATURE-084 rev 3: MediaTile as a grid entry, delete by key, optional onOpen

Not breaking for existing callers: a tile with `onOpen` and no `rowProps` renders and behaves as before. New props `onDelete` and `rowProps`; `onOpen` becomes optional.

**Migration:** in a `TileGridShell` with `gridProps={grid.gridProps}`, pass `rowProps={grid.rowProps}` to each `MediaTile` (the tile calls it itself; do not spread `rowProps()` on it), `onDelete` only where the role may delete (the same handler as the visible delete action, with its confirmation), and `onOpen` only where the role may open/edit.

- In the grid: ↑/↓/Home/End move between the tiles, one tab stop; Enter/Space open through the tile's own button; Delete/Backspace call the focused tile's `onDelete` once. Without `onDelete` the keys do nothing.
- Without `onOpen` the tile is no button but a labelled group: no pointer, no hover, nothing to open. With only `onDelete` it stays a focusable grid entry so Delete reaches it; without both it is not focusable and the arrows skip it.
- The picker (`selected`) is unchanged. No visual change.

## 0.108.1 — #183: tooltip stays inside a narrow viewport

Fix, not breaking. Where neither side of its element has room for the full bubble (e.g. at 360px), the tooltip of `TooltipContent` / `IconButtonTooltip` / `Hint` narrows to the room left on its side and wraps, instead of overflowing the viewport. Placement is unchanged: to the right, flipped to the left, never above or below.

## 0.108.0 — #180, SUI-FEATURE-083 rev 2: useEditShortcuts scope

Not breaking. `useEditShortcuts` takes `scope` (`RefObject<HTMLElement | null>`).

- With `scope`, the shortcuts answer only keys whose target lies inside that element, also inside a modal dialog: a dialog with its own selection binds Delete/Backspace to its content. A dialog opened above it (the delete confirmation) lies outside and triggers nothing. Text fields keep their keys as before.
- Without `scope`, nothing changes: page shortcuts, at rest while a modal dialog is open.

## 0.107.0 — #179, SUI-FEATURE-082 rev 4: UserMenu ↓ from the trigger, close on focus leave, app toggles

Not breaking for apps that already follow 0.105.0. `UserMenuItem` takes `pressed` (sets `aria-pressed`); no visual change.

**Migration:** an app toggle in the user menu (e.g. a notifications switch) is a `UserMenuItem` with `pressed` and `keepOpen`, never `role="menuitemcheckbox"`; E2E tests find the panel as a group and its entries as buttons or by `data-testid`, not by `menu`/`menuitem` roles. A `pressed` toggle keeps a fixed label ("Notifications"): a label that switches with the state ("Enable/Disable notifications") reads wrong next to `aria-pressed` in a screen reader.

- ↓ on the trigger of the open panel focuses the first entry.
- The panel closes when the focus leaves it: Tab past Log out (also out of the document), Shift-Tab back to the trigger or beyond, a click beside it. The open language list counts as the panel, though portalled: opening it and picking a language keep the panel open. A press on the trigger while the focus is in the panel closes it, the focus on the trigger.

## 0.106.0 — #176, SUI-FEATURE-081 rev 3: UserMenu unavailableReason

Not breaking. `UserMenu` takes `unavailableReason` (`"notYet" | "noRole"`, default `"notYet"`); new type export `UnavailableReason`. New string `account.requiresRole` (de/en/es).

- It applies to every unavailable entry (`profileUnavailable`, `changePasswordUnavailable`, `securityUnavailable`): `"notYet"` keeps "Not available yet", `"noRole"` shows "Requires a role." The entries stay focusable with `aria-disabled` and trigger nothing.

## 0.105.0 — #173, SUI-FEATURE-082: UserMenu as a disclosure panel, keyboard model

The ARIA contract of the open panel changes: it is no longer an ARIA menu, since it holds a select and a radio group, which a menu may not (axe `aria-required-children`). Props are unchanged; no visual change.

**Migration:** remove `role="menu"`, `menuitem`, `menuitemcheckbox` and `menuitemradio` from the children passed to `UserMenu` (inside a group they violate axe `aria-required-parent`); use `UserMenuItem` or a plain button. Select the entries by their `data-testid`, not by a menu role.

- The panel is a group labelled "Account menu"; the trigger carries `aria-expanded` and, while open, `aria-controls` (no more `aria-haspopup="menu"`). Entries are plain buttons without `role="menuitem"`; a test or app that found them by that role finds them by `data-testid`.
- Unavailable and locked entries (`profileUnavailable`, `changePasswordUnavailable`, `securityUnavailable`, `changePasswordLocked`) are focusable buttons with `aria-disabled="true"`: Tab reaches them, they trigger nothing.
- ↑/↓ move between the entries, the language trigger and the active appearance option, wrapping; from an inactive appearance option they go to the stop after/before it. Home/End jump to the first/last. On the closed language trigger ↑/↓ move on as well; its list opens on Enter, Space and Alt+↓. `Esc` closes and returns the focus to the trigger.

## 0.104.0 — #170, SUI-FEATURE-081 rev 2: UserMenu securityUnavailable

Not breaking. `UserMenu` takes `securityUnavailable` (default `false`).

- Set, Security / MFA keeps its place as the same non-interactive notice as an unavailable Profile or Change password: shield icon, "Security", "Not available yet", `aria-disabled`; `onSecurity` is never called. No new strings.

## 0.103.0 — #169, SUI-FEATURE-140 rev 4: MediaDetailShell locked pick and empty text

Not breaking. New strings `media.pickUnavailable`, `media.emptyText`; `media.missingRef` and `media.missingBytes` reworded, `missingBytes` now names the next step (de/en/es).

- In `previewState` `"missingRef"` and `"missingBytes"` the head's pick (`pickAction`) is locked, with the reason "Can't be chosen without a file." as its tooltip and, on keyboard focus, its description. In `"noRenderer"` picking stays possible.
- `kind="text"` with an empty `text` shows "The file is empty." instead of an empty region.
- `format="json"` now changes only the whitespace between tokens: number literals and strings show as the file has them (before, `9007199254740993` showed as `9007199254740992` and `1e400` as `null`).

## 0.102.0 — #166, SUI-FEATURE-140 rev 3: MediaDetailShell preview states and text preview

Not breaking. `MediaDetailShell` takes `previewState`, `previewDetail`, `text` and `format`; `src` is now optional; `MediaDetailKind` gains `"text"`. New type export `MediaPreviewState`. New strings `media.missingRef`, `media.missingBytes`, `media.noRenderer`, `media.truncated` (de/en/es).

- `previewState` (`"missingRef" | "missingBytes" | "noRenderer"`) replaces the preview by `kind` with an icon, one sentence and, muted below it, the optional `previewDetail`. Head, paging, details and footer keep working.
- `kind="text"` shows `text` in its own scroll region in the base family (never monospace, `GL-UI-010`), whitespace kept, wrapping on, tab size 2; `format="json"` indents valid JSON, invalid JSON stays plain. Past 200 KB (UTF-8) only the beginning shows, with a muted note.

## 0.101.0 — #165, SUI-FEATURE-130 rev 3: DropdownMenu submenu

Not breaking. New exports from `@suite/ui/ui/dropdown-menu`: `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`.

- Thin wrappers around the Radix submenu parts, with no logic of their own. The sub-trigger looks like a menu item, carries a trailing chevron (mirrored in RTL) and stays highlighted while its submenu is open; the submenu content looks like the menu content and opens beside its trigger.
- Keyboard and focus come from Radix: Arrow right opens the submenu, Arrow left closes it with focus back on the sub-trigger, Esc closes the whole menu with focus back on the menu button.

## 0.100.1 — #151, focus-return follow-ups from the #145 re-review (GL-UI-050)

Not breaking. `isUsable` is now exported from `focus-return` (a type guard).

- The `main` fallback (tier 3) stays focusable through a window or tab switch. It now gives up its tab index when another element takes the focus (a capture `focusin` on the document) or on a press, no longer on `blur`, so the focus no longer falls to the body when the window comes back.
- Tier 2 tries every usable control of the group in turn, after the trigger and then before it, nearest first, before it falls to the main content. Before, it tried only the first. The same holds for `useFocusAfterRun` (a Save that locks as its run ends).
- `GlobalSearch`: on close the focus goes back to what had it, else the field, else the rail's search button. Each counts only if it is usable (not locked, `aria-disabled`, hidden or inert, the shared `isUsable`) and takes the focus; otherwise the next is tried.

## 0.100.0 — #153, SUI-FEATURE-077 rev 2: OperationStatusProvider as its own module

Not breaking. New export path: `@suite/ui/operation-status/provider`.

- `OperationStatusProvider`, `useOperationStatus` and the types `OperationHandle`, `OperationStart`, `OperationStatusApi` and `OperationUpdate` live in their own module, which depends on no display building block. The context they share with the display stays internal (`src/operation-status/context.ts`, on no package path). An app frame that imports the provider from the new path no longer carries the status slot, indicator and label in its entry bundle.
- `@suite/ui/ui/operation-status` (and the `ui` barrel) passes on the provider, the hook and the types unchanged, beside `OperationStatusSlot`, `OperationIndicator` and `OperationLabel`, which read the operations from the new module.
- Apps, optional: the app frame imports `OperationStatusProvider` from `@suite/ui/operation-status/provider`.
- Package test: a Vite bundle of the provider path carries no slot, indicator or label code; one of the old path carries both.

## 0.99.0 — #152, GL-UI-070 rev 2 and SUI-FEATURE-079: reversible status changes are never red

Not breaking. New: `ConfirmDialog` (`@suite/ui/ui/confirm-dialog`, also in the barrel) and the strings `suite:confirm.cancelHint` and `suite:confirm.cancelDisabledHint` (de/en/es). `ConfirmDeleteDialog` is unchanged.

- `ConfirmDialog` is the confirm before a reversible status change (archive, deactivate, pause, hide). It is built like `ConfirmDeleteDialog`: compact, the primary action on the right, Cancel directly left of it, and the focus returning as `GL-UI-050` says. The primary action is always `default`, never `destructive`. `title`, `description`, `confirmLabel` and `confirmHint` are required and already translated; `confirmHint` names how to undo the action. `busy`, `confirmDisabled` with `confirmDisabledHint`, `children`, `returnFocus` and `data-testid` (with `-cancel` and `-confirm`) work as in `ConfirmDeleteDialog`. Cancel carries the new `confirm.*` hints.
- Apps: a confirm before archiving, deactivating, pausing or hiding switches from `ConfirmDeleteDialog` (or its own dialog) to `ConfirmDialog`. A reversible entry of a row or ⋯ menu drops `destructive` and carries the icon of its action, never `Trash2Icon`. As a button it is `outline`. Where the undo is one step, its confirmation toast offers it as an action.
- Audit: the package's red actions are all losses (delete, discard, Reset of unsaved changes, the leave guard's discard). The only reversible action in red was the gallery's Archive.
- Gallery: on the preview page, Archive is a plain menu entry with `ArchiveIcon`. Its confirm is a `ConfirmDialog` whose hint names the undo, and its toast offers Undo. A red "Discard draft" entry keeps the demo of the destructive group after the separator. The strings page lists the new strings.

## 0.98.0 — #150, SUI-FEATURE-120 rev 3 and GL-UI-050 rev 5: a running button keeps the focus

Changed for apps: `busy` no longer sets the `disabled` attribute. A running `Button` carries `aria-disabled="true"` and `aria-busy="true"` and stays focusable. App tests that check `disabled` (`toBeDisabled`) on a running button switch to `aria-disabled` plus the trigger guard. In Playwright, `toBeDisabled()` also counts `aria-disabled`, while `not.toHaveAttribute("disabled")` tells the two apart. New: `useFocusAfterRun` in `focus-return`.

- `Button busy`: the lock is a trigger guard on activation. A click, `Enter` and `Space` (both click a button) and the implicit submit of a surrounding form (a click on its submit button) are cancelled, and a press on the running button does not move the focus. The focus stays on the button for the whole run and after it, unless the button disappears. The lock does not cover an app's own `onKeyDown` on the button, nor an `asChild` trigger or a wrapping element that acts by itself; those check `busy` themselves. The look stays as the disabled button's was: full colour, the working sign, no hover tint (`aria-disabled:hover:` per variant), and now the progress cursor (`aria-busy:cursor-progress`). Hints behave as before: a `Hint` whose trigger is the running button stays closed on hover, the wrapping span of `Hint` with `disabledText` and of `IconButtonTooltip` opens on hover as before, and focus opens none. Real locks (`disabled`, with a reason) stay as they were. The repeat-click guard stays.
- Applies to every component that passes `busy` through: `RowActions` (an extra action), `PageHeader` add, `SettingsFooter`, `SettingsActionRow`, `EditPanel`, `EditorHeader`, `ConfirmDeleteDialog`, `MediaDetailShell`, `RestoreDefaultsButton`, `SecretCardHeader`, `DrawerRail`.
- A Save that locks itself as its run ends (the form is clean) hands the focus on (`GL-UI-050`), never to `<body>`. `SettingsFooter` and `SettingsActionRow` hand it to the next usable control of their row, else the page's main content. `MediaDetailShell` hands it to the next usable control of its footer, else the first field of the details. `EditorHeader` already did this. Their rows carry `data-focus-group`. Each target counts only if it takes the focus; otherwise the next one is tried.
- Gallery: a check that a running Save keeps the focus, that `Enter`, `Space`, a click and the form's implicit submit start no second run, and that the focus lands on the main content, not the body, once Save locks. The edit panel and media detail checks assert the focus too.

## 0.97.0 — #149, SUI-FEATURE-111 rev 2: EditPanel next step without the save symbol

Not breaking. New: `EditPanel submitKind?: "save" | "next"`, default `"save"`. Without it the panel is unchanged.

- `submitKind="next"`: the primary action shows no `SaveIcon`; `ArrowRightIcon` (hidden from screen readers) follows its text. Variant, size, `submitDisabled` and `busy` stay as for Save; while busy the spinner leads and the arrow is hidden, as the save symbol is.
- The `SaveIcon` now stands only on actions that save (`GL-TEST-019`: an icon claims its action).
- Apps: every panel step that only moves on and saves nothing (e.g. "Continue to review" in the media upload) sets `submitKind="next"`.
- Gallery: the edit-panel page opens a next step ("Open a next step"); a check asserts the arrow after the text, no save symbol, and the height of Save.

## 0.96.1 — #155, SUI-FEATURE-076 rev 8: the gallery runs natively

Not breaking. Tooling only; the package code is unchanged.

- `npm run gallery:image` (the gate's `gallery` phase) runs the pinned Playwright image natively in the Docker engine's architecture (`linux/arm64` on the MacBook) instead of emulating `linux/amd64`. The emulation loaded the host until hooks of other sessions timed out. A full run takes about 1 minute instead of 4.5.
- All gallery baselines are regenerated once natively in that image (204 of 224 files differ from the amd64 rendering). Baselines are taken and compared on the same machine.
- The container's dependencies live in the Docker volume `suite-ui-gallery-deps-<arch>`. They are reinstalled only when `package-lock.json` (apart from the package's own version) or the image changes; otherwise a run installs nothing. The install skips scripts, because the gallery runs from the sources.
- At most one gallery run at a time across all worktrees: a lock in the main checkout's `.spec-sync/gallery.lock`. A second run waits and says whose run it waits for, at most 30 minutes; then it exits 4. A run that has ended, or a lock left without a pid for 30 seconds, is taken over atomically, and a run releases only its own lock.
- The architecture comes from the Docker engine (`docker version`), not the shell, so a Rosetta shell does not bring the emulation back. Ctrl-C stops the run in the container and the container itself (`--init`, signals to the whole process group).

## 0.96.0 — #148, GL-UI-060 rev 2 and SUI-FEATURE-078: colour is never the only signal

Not breaking. New: `FieldError` (`@suite/ui/ui/field-error`, also in the barrel) and `SettingsField error`. Without `error` a field is unchanged. No new strings.

- `StatusChip`: each tone shows the symbol its toast carries before the text, soft and filled, catalog and domain states alike: success `CircleCheckIcon`, destructive `CircleXIcon`, warn `TriangleAlertIcon`, info `InfoIcon`. Neutral states have no symbol. The symbol is hidden from screen readers; the text is unchanged.
- `Toaster`: the success, info, warning and error symbols are hidden from screen readers. Each now carries the variant's name (`suite:status.*`) for screen readers, read before the message. Nothing changes visually.
- `DataTableShell` and `TileGridShell` (`ListStateContent`): the error state shows `CircleXIcon` before its text, with or without Try again. Empty, filtered and loading are unchanged.
- `SettingsScaffold` error and the rejected-file message of `UploadStep`: `CircleXIcon` before the text.
- `FieldError` (`SUI-FEATURE-078`) shows `CircleXIcon` and the text in `--destructive-text`, with `role="alert"` and its own `id`. `SettingsField error="…"` renders it under the control in place of the help text, which returns once `error` is cleared or empty. While the error stands, the package controls inside the field (`Input`, `Textarea`, `SelectTrigger`, `TimezoneCombobox`, `Checkbox`, `RadioGroup` and `RadioGroupItem`) carry `aria-invalid="true"` and `aria-errormessage` on it, also when they mount late or remount. With `group` the group carries them too. A value the control is given explicitly wins, and `TimezoneCombobox` keeps its own `invalid` and error id. The red border stays as an extra signal, now on checkboxes and radio options too. New: `FieldErrorContext` and `useFieldErrorAttributes` (in `field-error`), which a package control reads.
- The list error state's symbol stands on the first line of a wrapping text, like the other error messages.
- Checked and unchanged: the EditorHeader state mark (ring vs dot, with the state text for screen readers), `InlineStatus` (its own symbol and name per state), `ColorDotBadge` (the dot always stands beside the tag's name) and links in running text (`HelpMarkdown` links are underlined). The package draws no charts.
- Gallery: a FieldError section on the components page with one invalid field per kind, in one column below md; the tiles state demos stand in one column below md. New checks (`GL-UI-060`) assert that the states of a surface differ without colour, by symbol, shape mark and text: StatusChip tones, InlineStatus, the editor state mark, list and settings errors against the empty state, field errors and toast variants. The toast page now waits for the success toast element instead of its text, which now appears twice.

## 0.95.0 — #147, SUI-FEATURE-110 rev 3: sidebar as an overlay below md

Not breaking. At `md` (48rem) and up the shell and panels look and behave as before. New: `SidebarOverlayTrigger`; `useSidebar()` also returns `isOverlay`, `overlayOpen`, `openOverlay` and `closeOverlay`; the CSS variable `--sidebar-inset`; the string `suite:nav.openNavigation` (de/en/es).

- Below `md` the `AppSidebar` is an overlay. It takes no room beside the content and is closed by default. When open it lies expanded over the content with a scrim, and it is modal: the content behind is `inert` and Tab and Shift+Tab cycle inside it. A dialog it opens (the search) keeps its own Tab and `Esc`.
- `Esc`, a click beside it (the scrim), a navigation and a press on a link or the home name of the current route close it; the focus returns to the trigger (`GL-UI-050`). When the navigation replaced the page and its head, the trigger of the new head takes it, also on a route that renders later (a transition, a lazy route) or in the closing render (a synchronous router). The first press or key of the person ends that handover, and a page that places the focus itself (`autoFocus`, a focused heading) keeps it. The sidebar's own toggle closes it too, without touching the stored collapse choice.
- `UserMenu` is a package `Esc` layer: inside the overlay, the first `Esc` closes the open menu only (`GL-UI-007`).
- The trigger (`SidebarOverlayTrigger`, the panel symbol named "Open navigation", `aria-expanded` and `aria-controls` on the sidebar) stands at the start of every `PageHeader` inside a `SidebarProvider`, below `md` only. A surface without a `PageHeader` places it itself. `EditorHeader` has none: Back leads out of an editor.
- Below `md`, `useSidebar().isOpen` is always true (the overlay shows the expanded sidebar) and `toggle` closes the overlay.
- Panels: `EditPanel`, `MediaDetailShell` and the maximized `PreviewFrame` take the full viewport width below `md`. Their left edge is the sidebar width times `--sidebar-inset` (1, and 0 below `md`), so at `md` and up it is the same as before.
- Gallery: the shell page at 390 px shows the sidebar closed and the trigger in the page head; the strings page lists the new string.

## 0.94.0 — #146, SUI-FEATURE-100 rev 4: TagInput suggestions

Not breaking. `TagInput` takes an optional `suggestions`; without it the field is unchanged. New string `suite:tags.suggestions` (de/en/es), the name of the suggestion list.

- `TagInput suggestions={…}` (`SUI-FEATURE-100`): typing lists the matching existing tags under the field. Tags that start with the typed text come first, then those that contain it, ignoring letter case, at most eight. The first entry is chosen only if it starts with the text; an entry that merely contains it ("tur" → "Kultur") waits for the arrows. Tags already added are left out, and a suggestion listed twice in any letter case shows once.
- The arrows move the choice and keep it in view. Enter and Tab take the chosen entry over as a chip, and the field keeps the focus. With nothing chosen, Enter takes the typed text over as before and Tab leaves the field. The comma and leaving the field always take the typed text, never a suggestion in its place. Esc closes the list and keeps the text (and never closes a surrounding dialog). A tag typed in another letter case than a suggestion takes the suggestion's spelling on every way in (Enter, Tab, comma, leaving).
- Combobox pattern: the field has `role="combobox"` with `aria-expanded`, the list `role="listbox"`, the chosen option is named by `aria-activedescendant`; adding a chip is still announced. Long names wrap inside the list.
- The list floats like the time zone list: no portal; in a dialog or panel body it grows the body or opens upwards (`GL-UI-027` §Floating Content). Both use the new shared `usePopupPlacement` (`src/lib/popup-placement.ts`); the time zone list behaves as before.
- Gallery: the tag field of the components page offers suggestions. The strings page lists the new string.

## 0.93.0 — #145, GL-UI-050 rev 4: focus return after every dialog

Not breaking. New: the `focus-return` module (`@suite/ui/ui/focus-return`, also in the barrel), `DialogContent` takes an optional `returnFocus`. `ConfirmDeleteDialog.returnFocus` stays and is now passed through to it.

- Every dialog built on `DialogContent` (compact and form size: `ConfirmDeleteDialog`, the leave guard, the crop editor, app dialogs) returns the focus on close (confirmed, cancelled or `Esc`) in `GL-UI-050`'s order:
  1. the trigger, or the menu's ⋯ when the dialog was chosen from a menu entry;
  2. if it is locked or gone: the next usable control of its group (`role=toolbar`, `role=row`, `tr`, `header`, or anything marked `data-focus-group`) after it, then before it;
  3. else the surface's main content: the element the app marks with `data-focus-main` (`FOCUS_MAIN_ATTR`, its first field or canvas), else `main`, focusable without a tab stop.
- A link or a control marked `data-focus-nav` (`FOCUS_NAV_ATTR`) is never a fallback target (tier 2 or 3); the package marks EditorHeader's Back and the preview toolbar's Close. Never the body.
- In a list with the keyboard grid (`SUI-FEATURE-056`) the entry is the trigger, however the dialog was opened (a key on the entry, a button in it, its ⋯ menu; `GL-UI-050` rev 4): Cancel returns to the entry; a confirmed delete goes to the entry that moves into its place, else the one before (as before).
- A caller that already put the focus outside the dialog keeps it (the field of a failed save). An `onCloseAutoFocus` that prevents the default still takes over completely. A named `returnFocus` goes first, except inside a keyboard-grid list, where the entry wins.
- Each tier counts only if its target really took the focus; otherwise the next one is tried. A dialog opened with nothing focused (on load, after a click on a blank spot, by a shortcut) returns to the main content.
- Global search: closing (×, `Esc`) returns the focus once the dialog is gone, to what had it before opening (the shortcut has no trigger), else the sidebar field without reopening, else the rail's search button. Choosing a hit leaves the focus to the new page.
- `main` as the last fallback draws no outline: it is a programmatic target without a tab stop, not a control (`GL-UI-013` covers tab stops; same rule as the list frame). It is focusable only while it holds the focus.
- EditorHeader: the Reset confirm and a control that locks under the focus use the shared order (`fallbackTarget`). The Reset confirm no longer needs its own `returnFocus`.
- Gallery: the preview page's Archive entry (row ⋯ and toolbar ⋯) asks first.

## 0.92.1 — #144, SUI-FEATURE-090 rev 11, GL-UI-050: EditorHeader follow-ups

Not breaking for the API: `useFoldSteps` takes two new optional arguments, `RowActionMenu` an optional `tools` group, `ConfirmDeleteDialog` an optional `returnFocus`. At full width the EditorHeader looks as before.

- SUI-FEATURE-090 rev 11 (owner decisions):
  - Without a lifecycle the ⋯ stands directly left of Save. With one, the app's ⋯ keeps its place after Preview while nothing is folded; from the first step the one ⋯ leads the action group.
  - The ⋯ menu lists the folded header tools, a separator, the lifecycle menu's entries, and destructive entries last after another separator.
  - Save goes icon-only before `lifecycle.next`.
  - The title keeps about 18 characters while the steps fold; only after the last step does it shrink further, never below 6.
  - The shrunk state differs in shape, not only in colour: "Gespeichert" is a hollow green ring, "Entwurf · ungespeichert" a filled amber dot.
- `useFoldSteps(maxSteps, content?, fallback?)`: when `content` (what the bar shows: language, texts) changes, the remembered widths are dropped and the bar folds afresh before the paint, so a shorter text (after Save, in another language) unfolds again without a resize. The bar tracks its control that owns the focus from `focusin` (also through a menu or list it opened), so a step that swaps that control gives the focus back to the new one; a control that the step locked or took away hands it to `fallback`, in `GL-UI-050`'s order from where it stood. Swapped-out parts are no longer watched.
- Focus (`GL-UI-050`): the Reset confirm returns the focus to its trigger (Reset, or the ⋯ it was folded into), else to the next usable control of the header after it, then before it, else to the editor's main content; never to Back or the body. A control that locks under the focus (Save after saving, Undo at the history's start) hands it on the same way.

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
