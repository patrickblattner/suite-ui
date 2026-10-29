# Changelog

## 0.180.0 — #647 #648 #649 #651 #652 #653 #654 #655 #656 #657 #658 #659 #660: SUI-FEATURE-117 rev 2–4 (a read-only Input, Textarea or TagInput has a grey surface and the normal cursor, one look for all three; read-only tags as outline badges), SUI-FEATURE-252 rev 2 (useFocusAfterRun keeps the focus on a self-locking button and hands it on when the button disappears), SUI-FEATURE-194 rev 5 (SlideEditor deletes a page with protected elements again), SUI-FEATURE-311 rev 4 + SUI-FEATURE-251 rev 4 (ImagePlacementButtons' Flip keeps its label, a lock names its reason, a pressed toggle shows its lock), SUI-FEATURE-291 rev 2 (custom element types declare the fonts they draw), SUI-FEATURE-253 rev 3 (Switch locks like Button: busy and aria-disabled keep the focus and block toggling), SUI-FEATURE-195 rev 2–3 (SlideEditor: a locked element's property panel locks every control the same way, with the reason, its read-only fields included), SUI-FEATURE-101 rev 9 (the receipt after a confirm dialog appears only once the dialog has closed), SUI-FEATURE-151 rev 2 (EditPanel: `submitKind="create"` for the add mode, the package word Add with the plus symbol), SUI-FEATURE-320 rev 2–3 (SlideEditor: a placeholder with a prototype element lays it down on a new page and on a layout change; slide schema version 5) and a Select fix (a colour swatch in the chosen value is square again) (minor)

- **Input and Textarea (#647):** with `readOnly` the field gets the muted surface (`--muted`, light and dark; it replaces the editable field's transparent / `input/30` background) and the default cursor instead of the text cursor. The owner's taste decision ("Grau hinterlegt"): a read-only field shows without trying that its value cannot be changed; before, a `readOnly` `Input` looked exactly like an editable one. Everything else stays the editable field's: shape, height (`size`), padding, border, font size, help text, value hint, error state and `aria-describedby`; the field stays a Tab stop with its focus ring, its text stays selectable, and assistive tech reads it as read-only through the native `readonly` attribute. The look keys on the `readonly` attribute of a field that is not `disabled`, so `disabled` keeps its own look (reduced opacity, not focusable). No new prop: every field passed `readOnly` gets the look, the slide editor's read-only number fields included.
- **Gallery (#647):** the components page shows a read-only `Input` (with a help text) and a read-only `Textarea` beside the editable fields, and a read-only `Input` in each height row. Changed baselines (the new fields): `gallery/__screenshots__/components-{de,en,es}-{light,dark}.png` and `components-de-{light,dark}-{390,1440}.png` (10 files).
- **Tests (#647):** unit: a read-only `Input` and `Textarea` carry the native attribute and the read-only classes beside the editable field's shape and size classes; inside a `SettingsField` they keep their help text, value hint and error references. Gallery, light and dark: the read-only fields' computed background equals `--muted` and their cursor is `default`, while the editable and disabled fields keep theirs (`text` / `not-allowed`, opacity 1 / 0.5); height, padding, border width and colour, radius and font size equal the editable field's at both sizes; Tab reaches the read-only input and then the textarea with the focus ring, and their text selects.
- **TagInput (#653, `SUI-FEATURE-117` rev 3 + rev 4):** the read-only look now covers every package text-entry control, so a `readOnly` `TagInput` gets it too: its whole field box, chips included, takes the muted surface (`--muted`, light and dark) and the default cursor, while its height, padding, border, radius, font size, focus ring, Tab stop and `aria-describedby` stay the editable field's. Its chips are now the `outline` badge instead of `secondary` (rev 4, a tag is a category, `GL-UI-011`): the `secondary` fill equals `--muted`, so each chip keeps a visible border on the muted box instead of reading as a loose word. An editable `TagInput` is unchanged, a `disabled` one keeps its own look. The look is defined once in the package and shared by `Input`, `Textarea` and `TagInput`; it keys on the native `readonly` attribute or, on the `TagInput` frame, on the new `data-readonly` attribute. No prop and no call-site change.
- **Gallery (#653):** the upload section shows a read-only `TagInput` (with a help text) under the editable one. Changed baselines (the new field): `gallery/__screenshots__/components-{de,en,es}-{light,dark}.png` and `components-de-{light,dark}-{390,1440}.png` (10 files).
- **Tests (#653):** unit: the read-only classes appear in one package source only (no other source or stylesheet keys a style on `readonly`, `data-readonly`, `aria-readonly` or `:read-only`) and are used by exactly `Input`, `Textarea` and `TagInput`; a read-only `TagInput` carries them on its frame (chips inside) and its text field, an editable or `disabled` one has no `data-readonly`; its chips are `outline` badges. Gallery, light and dark: the read-only `TagInput` frame's computed background equals `--muted` and its cursor, its text field's and its chips' are `default`; each chip is an `outline` badge with a 1 px border whose colour is neither transparent nor `--muted`, while the editable one keeps its surface and the `text` cursor; height, padding, border width and colour, radius and font size equal the editable frame's (`TagInput` has one size, 36 px); Tab reaches its text field with the frame's focus ring and the help text as its description.
- **useFocusAfterRun (#648):** the hook no longer moves the focus away from its button while the button is still in the document, whether it ends the run locked (`aria-disabled`) or usable; the focus stays on the button (`GL-UI-050` rev 7, `SUI-FEATURE-120` rev 7). Before, a button that locked itself as the run ended handed the focus on to its group. New: if the button leaves the document during or after the run (conditionally removed, or the component holding the hook unmounts with it) and the focus was on it or has fallen to `<body>`, the hook places it by `GL-UI-050` targets 2–4: the next usable control of its group after it, then before it (group = the nearest `data-focus-group`, toolbar, row or header; its neighbours are noted while the run is in progress), else the `main` callback, else the marked main content (`data-focus-main`) or `main`, else the nearest container still in the document; never `<body>`. Focus the person moved elsewhere during the run stays there. Inside a dialog that closes with the button the hook does nothing, so the dialog's return to its opener wins (`GL-UI-050` target 1); a remount that keeps the button (StrictMode, `Activity`) moves nothing. Apps build no fallback of their own. Internally, the dialog return and the hook share one helper for the group's noted neighbours.
- **SettingsSaveReset (#648):** a Save that ends with an invalid entry (locked with a reason) now keeps the focus on Save instead of handing it to Reset.
- **Tests (#648):** unit: a package `Button` busy and then self-locked through the hook keeps `document.activeElement` and triggers nothing (AC 1, AC 5); a button that ends usable keeps it; a button removed after the run hands the focus to the next control of its group, else the one before, trying each in turn, else the `main` callback, else the marked main content, never `<body>` (AC 2); a holder that unmounts together with the button hands it to the next toolbar control (AC 3); focus moved to a field during the run stays there, whether Save goes or stays (AC 4); a button removed while the run goes on hands the focus on at once; without group control, callback or main content the nearest container takes it (tier 4); a StrictMode remount during a run leaves the focus where it was; a dialog closed while its Save still runs returns the focus to its opener. The SettingsSaveReset invalid-entry test now expects the focus on Save.
- **SlideEditor (#651):** pages with protected elements can be deleted again. The delete protection keeps an element from being removed from its page; it no longer keeps the page. A page holding protected elements is deleted after the usual question, its elements go with it, and `onChange` reports it once. Whether a page can be deleted is decided by the page rule alone: the last page stays. Deleting or cutting a protected element, a group with a protected child included, is still refused. The hint "Page n contains a protected element" is gone (`slides.editor.deletePageProtected` removed from the strings). The protected element's layers-row tooltip now says it can't be deleted from its page (`slides.editor.protected`, all three languages).
- **Gallery (#651):** the strings table loses that row. Changed baselines: `gallery/__screenshots__/gallery-{de,en,es}-{light,dark}.png` and `gallery-de-{light,dark}-{390,1440}.png` (10 files).
- **Tests (#651):** unit: the page with a protected element is deleted after the question, with no hint and exactly one `onChange` holding only the other page; after Undo and deleting the other page, the protected page is the last one and its Delete stays locked, without a question. The test that expected the refusal is rewritten to this.
- **Flip label (#649):** Flip keeps the label "Flip" ("Spiegeln") in both states, so a screen reader announces the change once, through `aria-pressed`; pressed, it shows the package's pressed fill (`SUI-FEATURE-095`, primary fill, `--primary-hover` on hover) instead of the accent highlight. The string `flip.active` ("Flipped", "Gespiegelt", "Reflejado") is removed from de, en and es; nothing reads it any more. Crop is unchanged: no `aria-pressed`, its active text "Cropped" stays the state cue.
- **Lock with a reason (#649, `SUI-FEATURE-250`):** `disabled` now comes only together with the new `disabledReason` (string; both or neither, enforced by the type). Locked, both buttons carry `aria-disabled="true"` through the `Hint`'s `disabledText`, stay reachable by Tab, trigger nothing on click or Enter and have the reason as their description instead of their hint. With a `disabledReason` the `Hint` stands locked and unlocked alike, so toggling the lock never remounts a button and a focused one keeps its focus; unlocked without a hint of its own it shows no bubble and no description.
- **Pressed and locked (#649, `SUI-FEATURE-251` rev 4):** a toggle that is pressed and locked with `aria-disabled`, or disabled with the `disabled` attribute (one look for "not available", `SUI-FEATURE-250` rev 4), now wears the locked look on its pressed fill: the primary fill at half alpha over `--surface` (border clear) and the label `--primary-foreground` mixed half with `--surface`, without the pressed hover tone, light and dark; under forced colours its label and border take `GrayText`, as a locked or disabled `Button` does (#387). Set once in `PRESSED_FILL_CLASS`, so every package toggle gets it. Before, a pressed toggle kept its full fill and hover tone while locked or disabled (a read-only slide's Bold, for one).
- **Hint (#649):** an empty `text` means no bubble and no description while the control is usable; only its `disabledText` shows while it is locked.
- **Gallery (#649):** `?page=components&placementLocked=on` locks the placement buttons with a reason and `placementFlipped=on` starts them flipped (both together: pressed and locked); the default page keeps them usable and unflipped. The strings table loses the `flip.active` row; the same 10 `gallery-*` baselines as #651 are regenerated over both string changes. New checks: Flip keeps "Spiegeln" and takes the primary fill while pressed, the outline look while not; locked, both buttons are reached by Tab, stay inert on click and Enter and are described by the reason. Pressed and locked, light and dark: Flip's fill and label are the half mix of `--primary` and `--primary-foreground` with `--surface`, differ from the locked, unpressed Crop, and hover changes neither. The Apply/Reset check expects "Flip" after a flip.
- **Tests (#649):** unit: Flip keeps its label in de, en and es after a click, carries the pressed fill class and no `data-active`, Crop has neither; locked with and without hints both buttons have `aria-disabled="true"`, are focusable, are described by the reason only and ignore clicks; `disabled` without `disabledReason` and a reason without `disabled` are type errors; toggling the lock with and without hints keeps both buttons the same nodes and the focus on Flip. `PRESSED_FILL_CLASS` carries the half-tone for pressed and locked and for pressed and disabled, in light and dark, at rest and on hover, no hover tone there, and `GrayText` under forced colours. `Hint` with an empty `text` opens no bubble on hover while usable and the reason once locked.
- **SlideTypeExtension `fonts` (#652):** a custom element type can declare the fonts its renderer draws with the new optional hook `fonts(element)`, a list of `{ font?, weight?, italic? }` (omitted: the default font, 400, not italic). `SlideView` merges every entry, for each drawn element of that type, into the same font needs and missing-font report as text runs, table cells and charts: the face is loaded with the app's font files before the page is ready (export capture included), a brand font key the brand set lacks is reported in `missingFonts` exactly as for a text run, and a face a text and a custom type both need is named once. The hook reads only the element (payload included), never the page context. A type without `fonts` changes nothing.
- **Gallery (#652):** the page counter (`gallery.page-counter`) declares the face it draws, the default font at 400. No visual change.
- **Tests (#652):** unit: a custom type declaring a brand heading at 700 with only the 400 file loaded reports `Gallery Slide Sans 700` missing and none once the 700 file is there, its hook called with the element alone (AC 1); with that bold file's load held open the page stays not ready and reports no ready state until it settles (AC 1); a brand key the set lacks gives the same `missingFonts` and `missingFaces` from a custom type as from a text run (AC 2); a text run and two custom elements needing the same face name it once (AC 3); a type without `fonts` reports nothing (AC 4).
- **Switch `busy` (#654):** `Switch` takes `busy` (boolean) for a switch whose toggle runs an action: it sets `aria-disabled="true"` and `aria-busy="true"`, never the `disabled` attribute, so the switch keeps the focus through the run and is usable again when `busy` ends. An app's own `aria-disabled="true"` locks the same way without `aria-busy`. Locked, a click, `Space` and `Enter` do not toggle and neither `onCheckedChange` nor the app's `onClick` is called, and a press does not move the focus, as on a locked `Button`. A switch that declares `busy` also drops a repeat click (`event.detail > 1`), so a double-click toggles once; keyboard activation passes. Before, Radix toggled an `aria-disabled` switch, and the only lock was `disabled`, which dropped the focus to the page. A lock reason comes through the `Hint`'s `disabledText`; the locked switch carries it as its own description.
- **Switch busy look (#654):** a busy switch looks like a busy `Button`, not like a refused one (`GL-UI-027`): full colour in its new position, cursor `progress`, no dimming.
- **Switch locked look (#654):** a switch locked with `aria-disabled` and no run, and a `disabled` one, share one look in colour instead of `opacity: 0.5`: track (`--primary` on, `--input` off) and thumb mixed half with `--surface` (`SUI-FEATURE-251`), light and dark, cursor `not-allowed`; the focus ring of the focusable locked switch stays at full strength (at least 3:1). Under forced colours the track's border takes `GrayText`, as a locked `Button` does. `disabled` stays unfocusable.
- **Gallery (#654):** the components page's Switch row adds a busy switch, a switch that runs for 800 ms on toggle, and an off and an on switch locked with a reason (`Hint` `disabledText`); the disabled switches take the new look. Changed baselines: `gallery/__screenshots__/components-{de,en,es}-{light,dark}.png` and `components-de-{light,dark}-{390,1440}.png`.
- **Tests (#654):** unit: `busy` and `aria-disabled` switches ignore a click, keep `aria-checked`, call neither `onCheckedChange` nor `onClick` and keep the focus, `busy` alone renders `aria-busy` (AC 1); a press on a locked switch is prevented and leaves the focus where it was; a switch that declares `busy` drops a repeat click and passes keyboard activation; a focused switch that turns busy after its toggle keeps the focus, ignores clicks during the run and toggles again after it (AC 2); a busy switch carries the progress cursor and not the locked look, a lock without a run carries it and `GrayText` under forced colours, a disabled switch stays disabled with no opacity class (AC 3). Gallery: busy and locked switches ignore click, `Space` and `Enter` and keep the focus, the locked one is described by its reason; the busy and the running switch show the usable switch's colours with cursor `progress`, keep the focus through the run and toggle again after (AC 1–2); light and dark, locked and disabled switches have track and thumb at the half mix with `--surface`, opacity 1, cursor `not-allowed`, locked and disabled tracks alike, the focused locked switch draws the ring at least 3:1 on the surface, the disabled one is not focusable; under forced colours locked and disabled tracks take `GrayText`, busy ones do not (AC 3).
- **Select locked with `aria-disabled` (#655):** a `SelectTrigger` with `aria-disabled="true"` is locked like a `Button`: it stays focusable and keeps the focus (a press does not move it), and neither a press, a click, `Space`, `Enter`, the arrow keys nor a typed letter (the typeahead of the closed trigger) opens the list or changes the value. Its look is in colour, never element opacity (`SUI-FEATURE-251`): value and border mixed half with `--surface`, no hover, cursor `not-allowed`, `GrayText` under forced colours. The reason comes through the `Hint`'s `disabledText`, as the trigger's own description. `disabled` is unchanged.
- **SlideEditor locked element (#655):** the property panel of a locked element has one lock state (`SUI-FEATURE-195`). Text and number fields stay `readOnly` (look of `SUI-FEATURE-117`); every other control (the text format's font and colour selects and its toggles, the sizing and follow selects, the animation selects, the table's buttons and selects, the chart's buttons) is locked through `aria-disabled` instead of `disabled`: focusable, at full opacity, opening and changing nothing, described by the new string `slides.lockedElement` (de / en / es). Unlocking in the layers panel makes every control operable again without reselecting. The chart's own lock reason `slides.editor.chartLocked` is replaced by `slides.lockedElement` and removed. App type fields and add-on fields keep receiving `readOnly`.
- **Gallery (#655):** a slide editor test locks a new text field and shows its property panel. New baselines: `gallery/__screenshots__/slide-editor-locked-text-{de,en,es}-{light,dark}.png`. Changed baselines (the strings table gains `slides.lockedElement` and loses `slides.editor.chartLocked`): `gallery/__screenshots__/gallery-{de,en,es}-{light,dark}.png` and `gallery-de-{light,dark}-{390,1440}.png` (10 files).
- **Tests (#655):** unit: a locked `SelectTrigger` opens on no press, click, `Space`, `Enter`, `ArrowDown` or `ArrowUp` (each opens it unlocked), keeps its value against a typed letter, keeps the focus against a prevented press and is described by its reason (AC 3); a locked text field's panel has every field `readonly`, no `disabled` control and no `opacity-50` (AC 1); each of its other controls (font, colour, toggles, sizing, both animation selects) is `aria-disabled`, described by `slides.lockedElement`, focusable, opens no list and leaves the document unchanged on press, click, `Space`, `Enter` and the arrow keys (AC 2–3), as are a locked table's buttons and selects; unlocked, no control is locked and the effect select opens (AC 4). Gallery, de/en/es light and dark: no `disabled` control and no computed opacity below 1 in either tab, Tab walks through every control, each `readonly` or `aria-disabled` with the reason, which neither keys nor a click open; unlocked, the font select opens (AC 1–5).
- **SlideEditor locked fields (#660, `SUI-FEATURE-195` rev 3):** a read-only text or number field of a locked element (the text size, X, Y, width, height, rotation, the animation's duration, delay and order, the table's column width, the inline media's alt text, the chart's names and values) now carries the reason `slides.lockedElement` too, after its own hint: both stand in its hover bubble and its accessible description. Unlocked, the reason is gone; a field that stays editable on a locked element (the table's cell row and column) never carries it. The lock flip keeps every field and the focus. App type fields and add-on fields are unchanged.
- **Tests (#660):** unit: on a locked text field every field of both tabs is described by its own hint and then the reason, and after unlocking by its hint alone; the flip keeps the layout tab's fields as the same nodes and the focus on X, both ways (AC 1–3). On a locked table every read-only field, column width included, carries the reason and the cell pickers do not; on a locked chart every name and value field carries it.
- **Toaster after a confirm dialog (#656, `SUI-FEATURE-101` rev 9):** a toast raised while a `ConfirmDialog` or `ConfirmDeleteDialog` is open waits for it: the receipt appears only once the dialog has closed and the focus is back on its trigger (the ⋯), never while the dialog works (busy). It then follows the rules for a toast over the focus as before: without an action it closes after 1000 ms, `Esc` earlier; with Undo it stays at least 8000 ms. A toast the dialog stays open for (an error, the dialog idle again) shows 50 ms after the dialog turned idle, also when it was raised while the dialog was still busy. A dialog removed while open or closing (with its row) releases its toasts only after Radix has returned the focus. `toast.promise` is held as a whole: its loading state shows once the dialog has closed, its result after it, and `unwrap()` waits for it. A held toast that is dismissed never shows.
- **Gallery (#656):** in the preview (`?page=preview`) Archive and Delete work busy after the confirm and raise their receipt while still busy; with `?receipt=1` the dialog stays busy until a test calls `window.releaseConfirm()`, otherwise it closes after 400 ms. No visual change to the baselines.
- **Tests (#656):** unit: by ⋯ → Delete or Archive → confirm, no toast while the dialog is busy (another toast raised meanwhile waits too), the receipt once it has closed with the focus on the ⋯ at the moment it shows, in the live region, Undo on the archive (AC 1, AC 2); an error toast while the dialog stays open shows, also one raised while busy once busy clears 100 ms later; a dialog unmounted with its row shows the receipt only with the focus back on the ⋯; `toast.promise` shows no loading toast while the dialog works, then its loading state and result, and `unwrap()` resolves; a dismissed held toast never shows. Gallery: the receipt tests (AC 5, AC 6) hold the dialog busy after the receipt was raised, check that no toast shows two frames later, then release it and check the receipt only after the dialog is hidden, with the focus on the ⋯ — no wall-clock windows.
- **SelectValue swatch (#658):** a colour swatch in the chosen value of a select (the slide editor's text colour and table cell fill) renders as its square again instead of a 1–2 px bar. The value shows the option's content inline, outside the item's flex row, so its `size-*` did not apply; `SelectValue` now renders the option's leading decorative mark (a first-child `span[aria-hidden=true]`) as an inline block, vertically centred, with the item's gap before the label; other `aria-hidden` spans in the value are untouched. The list items were already square and are unchanged.
- **Gallery (#658):** the text colour value shows its square swatch. Changed baselines: `gallery/__screenshots__/pressed-{de,en,es}-{light,dark}.png`, `pressed-de-{light,dark}-{390,1440}.png` and `slide-editor-locked-text-{de,en,es}-{light,dark}.png` (16 files).
- **Tests (#658):** gallery, light and dark: in the slide editor's text colour select the swatch of an open option and of the chosen value has equal computed width and height, larger than 8 px (AC 1–2).
- **EditPanel `submitKind="create"` (#659, `SUI-FEATURE-151` rev 2):** the new kind for a panel's add mode. Its primary action is the package word `actions.create` ("Add", "Anlegen", "Añadir") with `PlusIcon` before the text and no `SaveIcon`, in the `success` variant at Save's size; its hint is the new string `editPanel.createHint` ("Adds the entry.", "Legt den Eintrag an.", "Añade la entrada."). It submits exactly like `"save"`: click or Enter, `submitDisabled`, `busy`, the leave dialog's Save and Cancel's hint are the same. `"save"` (the default) is unchanged: `SaveIcon` and `actions.save`, for the edit mode.
- **Gallery (#659):** the edit-panel page gets "Add a channel" (`create-panel`), an add-mode panel with `submitKind="create"`, beside the rows' edit mode. The strings table gains `editPanel.createHint`. Changed baselines: `gallery/__screenshots__/gallery-{de,en,es}-{light,dark}.png` and `gallery-de-{light,dark}-{390,1440}.png`.
- **Tests (#659):** unit: in en, de and es `submitKind="create"` shows the package word with exactly one icon, the plus before the text, no save symbol, the `success` variant, the create hint and Cancel's save hint, and calls `onSubmit` on click; it submits on Enter, locks with `submitDisabled` and works with `busy` like Save; an outer form never submits along; the leave dialog's Save calls `onSubmit` and leaves on success. The `"save"` tests stay as they were. Gallery, in en, de and es: the add panel's Add carries the plus left of its text, no save symbol, 36 px high, its hint, and closes on submit; the edit panel beside it keeps Save with the save symbol.
- **Slide schema 5 (#657):** `SLIDE_SCHEMA_VERSION` is 5. A placeholder may carry `prototype`, an element without `id`, box (`x`, `y`, `width`, `height`), `rotation` and `placeholderRole`: its type, content, style and `deletable`. Any element type but `group` and `placeholder`, held to that type's rules; a prototype of type `group` or `placeholder`, or one that carries any of those seven keys, is rejected (rev 3), and so is a shape prototype with `follow` (it is laid down outside any group, where a following shape is invalid); exported as `slidePrototypeSchema` and the type `SlidePrototype`. The app ships it with its layouts (`layouts`, `masters`); a layout the editor copies into the document brings it along. The migration 4 → 5 drops any `prototype` a version-4 document carries (its parse dropped one anyway), in layouts, masters, pages and groups, so an older document loads with no prototypes and its content unchanged.
- **SlideEditor prototypes (#657, `SUI-FEATURE-320` rev 2–3):** "New page from layout" lays down an element for every placeholder of the layout (or its master, the layout's placeholder first for a role) that carries a prototype: an id of its own, the placeholder's box and rotation, the prototype's content and style, `placeholderRole` = the placeholder's role, `deletable` from the prototype; these roles show no hint. A placeholder without a prototype stays an open placeholder with its hint. Changing a page's layout moves an element whose role the new layout has into its placeholder, content unchanged, as before, and lays down the prototype of every role the page has no element for (an open placeholder does not count). An element whose role the new layout lacks, or every role element when the layout is removed, now loses its protection as well as its role (`deletable` becomes `true`) and stays as a free element. The new page or the layout change, with every element laid down or changed, is one Undo step and one `onChange` report.
- **Tests (#657):** unit: a version-4 document with stray prototypes in a layout, its master and a group loads as version 5 with no prototypes and its elements unchanged (AC 5); a prototype parses with its type's defaults, a chart prototype gets its patterns, a group or placeholder prototype, one carrying `id`, `x`, `y`, `width`, `height`, `rotation` or `placeholderRole` (each named at its path), a shape prototype with `follow` and a table prototype with a short row are rejected (AC 6); a new page from a layout with a protected title and a body prototype holds both with the placeholders' box and rotation, the prototypes' text and style, role and protection, ids of their own, and only the placeholder without a prototype stays open (AC 1); a layout change lays down a missing role, moves the held title without changing its retyped text, and does not count an open placeholder as present (AC 2); a protected element whose role the new layout lacks, and the title once the layout is removed, keep their place, lose the role and are deletable (AC 3); a master's prototype fills a role the layout lacks, and a role on both layout and master gets exactly one element, from the layout's prototype (AC 7); the version-4 test covers the stray key (AC 8). Editor: New page from the app layout and choosing it in the page's Layout select each report `onChange` once with the elements laid down and no hint shown, and one Undo reports the document before (AC 1, AC 2, AC 4).

**Migration (#647, #653):** apps drop any local read-only styling of `Input`, `Textarea` and `TagInput` (`GL-UI-004`); the package draws it.

**Migration (#648):** the `locked` argument is dropped: `useFocusAfterRun(button, running, locked, main?)` becomes `useFocusAfterRun(button, running, main?)`, since a lock no longer changes where the focus goes. App tests that expect the focus on a neighbour after a button locked itself at the end of a run expect it on the button.

**Migration (#651):** apps that relied on the editor keeping a page with protected elements check on their server when saving that no protected element is missing (`SUI-FEATURE-194` rev 5).

**Migration (#649):** an app that passes `disabled` adds `disabledReason` with the reason it knows when it raises the pin; `disabled` alone no longer compiles. Code or tests that read "Flipped" or Flip's `data-active` read `aria-pressed` instead; apps that read the package string `flip.active` keep their own text.

**Migration (#659):** in an add-mode panel, apps replace `submitLabel={t("suite:actions.create")}` together with `submitKind="save"` (or no `submitKind`) by `submitKind="create"`; the panel then shows Add with the plus symbol and its own hint. Edit-mode panels keep `"save"`.

**Migration (#657):** slide documents move to schema version 5 on load (`parseSlideDocument` migrates 1–4; a `prototype` in a version-4 document is dropped, all else unchanged); a server or app that checks `schemaVersion === 4` must accept 5, and test fixtures with `schemaVersion: 4` typed as `SlideDocument` say 5. On a layout change an element whose role the new layout lacks is now deletable (`deletable: true`); an app that keeps core elements across layouts gives the new layout a placeholder of that role, with a protected prototype where the page should get one. New exports: `slidePrototypeSchema`, `SlidePrototype`. No `data-testid`, package text or baseline changes.

## 0.179.0 — #644, SUI-FEATURE-310 rev 3: CroppedImage and CroppedBackground render statically, without Tailwind and without measurement (minor)

- **Static form (#644):** `CroppedImage` and `CroppedBackground` now set every property they depend on as inline styles (frame `position: relative; overflow: hidden`, image `position: absolute; max-width: none`, background box `position: relative; isolation: isolate`), so static HTML without Tailwind and without hydration (a community public site, an Astro build) draws them like the apps. A `className` from the call site only adds properties; a caller's `style` is merged after the component's inline styles and wins. `CroppedBackground` no longer measures its box: it renders the box, an absolute layer (`inset: 0; z-index: -1; container-type: size; overflow: hidden; pointer-events: none`, `data-slot="cropped-background-layer"`) and inside it the image layer (`data-slot="cropped-background-image"`), whose `background-size` and `background-position` read the box with container units (`cqw`/`cqh`). The first HTML already shows the right section; there is no layout effect and no resize observer left. The size containment sits on the layer, so a box sized by its children keeps their height. `flipped` mirrors the image layer only.
- **New `croppedBackgroundStyle({ src, crop, flipped, naturalWidth, naturalHeight })` (#644):** the image layer's CSS in container units, without a box size, for consumers that build the layers themselves (its parent needs `container-type: size`). `croppedBackground()` with `boxWidth`/`boxHeight` in px stays; both share one calculation.
- **Tests (#644):** unit: `renderToStaticMarkup` of both components with `crop` and `flipped` carries every inline property and no class; the background's three levels and container-unit values; no resize observer is created; a call-site `style={{ position: "absolute" }}` wins on the frame and on the box, and a call-site `className` keeps every listed inline property (AC 7); `croppedBackgroundStyle` with and without a crop. Gallery (`gallery/static-crop.tsx`, loaded into a page without stylesheet or script): the frame clips the image; the 1000 × 1000 box shows exactly the middle half behind a child's chip; flipped mirrors the bands, never the text; the computed size and position equal `croppedBackground()`'s within 0.5 px at 1000 × 1000, 1600 × 400 and 375 × 812 for two crops; a box sized by a 120 px child stays 120 px tall. The existing CroppedBackground gallery test reads the image layer.

**Migration:** the background now sits on the inner `[data-slot=cropped-background-image]` (was the layer itself); code or tests that read the layer's `background-*` or `transform` read the image layer instead. A call-site `className` can no longer change the inline `position` or `isolation` of the box or the `position` or `overflow` of the frame (`SUI-FEATURE-310` rev 3); pass such a value as `style`, which the component merges after its own inline styles, so it wins (`style={{ position: "absolute" }}`). A static consumer also passes `naturalWidth` and `naturalHeight`, otherwise the crop falls back to `cover`.

## 0.179.0 — #645, SUI-FEATURE-311 rev 3: ImagePlacementButtons' Flip carries aria-pressed, each button takes an optional hint (minor)

- **ImagePlacementButtons (#645):** Flip is a toggle button with `aria-pressed` set to `flipped`; Crop opens a dialog and carries no `aria-pressed`, its active text "Cropped" stays the state cue. New optional props `flipHint` and `cropHint` (string): a set hint wraps that button alone in the package `Hint`, so it opens on hover (hoverable, `GL-UI-016`) and describes the button through `aria-describedby`; keyboard focus reaches it as that description. Without a hint the button has no tooltip and no `aria-describedby`; the group never carries one.
- **Gallery (#645):** `?page=components&placementHints=on` gives the placement buttons a hint each; the default page keeps them without, so no baseline changes. New checks: Flip's `aria-pressed` follows its state and Crop has none; with hints each button is described by its own text and its hover opens only its own bubble; without hints neither button opens a tooltip or carries a description.
- **Tests (#645):** unit: Flip's `aria-pressed` false then true after a click, none on Crop; `flipHint` and `cropHint` each describe only their own button, both together each their own text; without hints no `aria-describedby`, no tooltip state and no tooltip on focus.

## 0.178.0 — #633, SUI-FEATURE-300 rev 3 + GL-UI-010 rev 14: SettingsBlock and Card hold their content 8 px under the header (patch)

- **SettingsBlock (#633):** the first content sits 8 px under the header (`not-last:-mb-2` on the header against the block's `gap-4`) instead of 16 px; the contents stay 16 px apart and `purpose` stays 4 px under `name`.
- **Card (#633):** `CardDescription` sits 4 px under `CardTitle` (was 8 px), and `CardContent` 8 px under a `CardHeader` without `border-b` (was 24 px); the gap to `CardFooter` stays 24 px. Without a description the header ends at the title line, or at a taller `CardAction`: the action spans the description's row only when there is one. `SecretCardHeader` and `SettingsActionRow` are unchanged. Apps drop any own spacing between header and content.
- **Gallery (#633):** a third card on the components page, with an action and no description. Changed baselines (the cards): `gallery/__screenshots__/components-{de,en,es}-{light,dark}.png` and `components-de-{light,dark}-{390,1440}.png` (10 files). No baseline shows a SettingsBlock.
- **Tests (#633):** gallery bounding boxes, light and dark: in every SettingsBlock purpose − name = 4 px and first content − header = 8 px; in both component cards description − title = 4 px, content − header = 8 px, footer − content = 24 px; in the card with an action and no description the header ends at the lower of title and action and content − header = 8 px; in the SecretBlock action row − input = 16 px; in the settings card without a description the header ends at the title and content − title = 8 px. Unit: the block frame carries `gap-4`, its header `not-last:-mb-2`.

## 0.178.0 — #635, SUI-FEATURE-115 rev 8: the tile tooltip's hit test finds a thin fixed part above or below the name (patch)

- **Tile tooltip (#635):** the hit test that finds fixed or sticky app parts over a tile's column now samples rows every 8 px through the band the bubble can stand in (the name's line and, over and under it, the bubble's tallest height with its offset and padding), besides the area's, the tile's and the name's edges. So a part at least 8 px tall (and, as before, 16 px wide) is found where the bubble could cover it, at any tile width, and the bubble never stands over it; outside the band a part leaves the bubble's place unchanged. Before, only a fixed set of rows was sampled and a thin bar or chip between them was missed. Cost: at most 35 columns times the band's rows (an 80 px bubble: about 1000 hit tests for a 400 px tile). The keyboard focus's reveal sweeps the whole column with at most 2048 hit tests, its rows further apart past that.
- **Tile reveal (#635, #636 CX4):** the keyboard focus's reveal saves and restores each `scroll-margin` side on its own. Before, it saved only the shorthand, which reads empty unless all four sides are set, so an inline `scroll-margin-top` on a tile was wiped.
- **Tests (#635):** unit: with a mocked hit test, an 8 px fixed bar between the old rows above the name (AC 9 geometry) puts the bubble under the name, one below the name under a sticky header (AC 5 geometry) sends it to the element, never over the bar; a 400 px tile in a 1000 px tall viewport finds an 8 px bar in the bubble's band, samples every 8 px there and stays at 1024 hit tests or fewer; an inline top and left scroll margin survive the reveal. Gallery: a thin fixed bar between a media tile's top and its name keeps the bubble under the name; the AC 8 header test now covers the keyboard's own scroll stop (a 10 px scroll during the wait keeps the bubble closed; Radix already closes an open bubble on the page's scroll, so only the wait shows it) and fails with that stop removed.

## 0.178.0 — #632, SUI-FEATURE-116 rev 4: the toast cancel is outlined at rest and fills on hover (patch)

- **Toast cancel (#632):** sonner's cancel button in a toast now carries a 1 px border in the toast's text colour (`--normal-text`) at rest, without a fill, so it reads as a button before a pointer reaches it. On hover it fills in `--normal-text` with its label in the toast's fill (`--normal-bg`), in every variant, neutral included, light and dark. Before, it showed only its label at rest and revealed the border on hover. Set once in the Toaster; the action button is unchanged.
- **Tests (#632):** unit: the cancel carries the rest border and hover fill classes, no transparent border and no accent, beside an app's own class. Gallery: on every variant, light and dark, the cancel's rest border is the toast's text colour at 3:1 on the fill with no fill under its label; on hover its fill is the toast's text colour and its label the toast's fill at 4.5:1.

## 0.178.0 — #630, GL-UI-013: the text format buttons stay on one row at the panel's default width (patch)

- **SlideEditor property panel (#630):** on the Content tab the text format row (bold/italic · alignment · lists) and the table toolbar now share one look: a 2 px gap between buttons (was 4 px) and separators with 2 px on each side (was 4 px). All eight format buttons fit the panel's default 340 px on one row, beside a classic 15 px scrollbar too (284 px of 292 px); before, the numbered-list button wrapped onto a row of its own. Part 1 (Field size select width) shipped in #622.
- **Gallery (#630):** new checks that at the default panel width the eight text format buttons share one row, once as usual and once (`@scrollbars`) with classic scrollbars in a panel body capped so it scrolls. Changed baselines (the tighter row): `gallery/__screenshots__/pressed-{de,en,es}-{light,dark}.png` and `pressed-de-{light,dark}-{390,1440}.png` (10 files); no baseline shows the table toolbar.

## 0.178.0 — #626, SUI-FEATURE-290 rev 4: an app type's renderer and an add-on's style get the page's position (minor)

- **Slides page context (#626):** `SlideCustomRenderer` now gets a second argument `{ page }` and an add-on's `style` a third, both `SlideDrawContext`: `page` is `{ number, count }` (`SlidePagePosition`), `count` the pages not hidden, `number` the page's place among them from 1 and `null` on a hidden page; a master's or layout's element drawn on a page gets that page's position; with no page drawn on, `page` is `null`. `SlideView` computes it from the document, so the editor, player and export show the same values. The editor's page pictures are drawn again when a page's position changes (order, count or hidden), in the same step as the change; the sorter takes every page's position once per step and hands each picture its number and count. The package formats nothing; existing one-argument renderers keep working. No schema change.
- **Gallery (#626):** new app type `gallery.page-counter` in `GALLERY_SLIDE_PROPS`, drawing `{number}/{count}` and a dash on a hidden page. The player's deck (`SLIDE_DECK`) carries it on a master through a layout on all three pages (1/2, —, 2/2), and the editor's `?extensions=editor` offers it in the library with a size of 160 × 60. Changed baselines (the counter on the player's first page): `gallery/__screenshots__/slide-player-{de,en,es}-{light,dark}.png` and `slide-player-de-{light,dark}-{390,1440}.png` (10 files). The gallery's library test expects the counter's entry and draws it as 1/2 on the editor's first page.
- **Tests (#626):** unit (`slide-page-position.test.tsx`): four pages with the second hidden draw 1/3, —, 2/3, 3/3; an add-on's style gets the same position; a master's counter on three pages draws 1/3, 2/3, 3/3, and `pagePosition` without a page is `null` with the renderer drawing nothing; player and export draw the view's values; in the editor a page moved forward and a hidden page shown redraw every picture's counter in that step, and Undo restores them.

**Migration:** `SlideCustomRenderer` takes a required second argument and an add-on's `style` a required third (`SlideDrawContext`); a renderer or style written with fewer parameters still type-checks, but app code that calls its own renderer or style directly passes `{ page: null }` (or the page's position) as the new argument.

## 0.178.0 — #640, SUI-FEATURE-165 AC 3 + SUI-FEATURE-231 rev 3: text follow re-measures on a brand font switch; format transfer scales a following shape's inset (patch)

- **Slides text follow (#640):** a text field whose size follows its text is measured again when the app's brand set switches a font to another one that is already loaded, the page's inherited body font too (a run whose brand font key the set lacks draws in it). Before, only the document's text, box or a font still loading set off a new measure, so the field and its badge kept the old font's size. The document stays unchanged.
- **Format transfer (#640):** a shape that follows a text field has its inset (top, right, bottom, left) scaled with the ratio of the shorter sides, rounded as the other dimensions are. Before, the inset stayed at its old value, so a scaled badge's padding fell back to the old format's.
- **Tests (#640):** unit: a view re-rendered with a brand set naming another loaded font measures the label and its group again, for a run's own family and for the inherited one, each size differing from the stored box; `transferFormat` scales a following shape's inset up (2.4) and down (1/3) and the copy validates.

## 0.178.0 — #639, SUI-FEATURE-112 AC 2 + AC 5: a new `draft` during a router submission takes the waiting route change back (patch)

- **Leave guard (#639):** a new `draft` (a change without a DOM `input`, such as a Switch or a canvas drag) while a route change waits for the router's form submission now takes that change back, as an entry in a field does: the page stays, and a Discard confirmed before never resets the draft. Before, the change went once the submission succeeded and the edit was lost. A draft the submission's result sets comes once it has ended and is no edit.
- **Tests (#639):** unit: a new draft during the wait (clean page and after a confirmed Discard) keeps the route and the draft; the redirect-mark test of `leave-guard.search-params.test.tsx` waits for the guard's effects before it submits, so it no longer flakes under load.

## 0.178.0 — #643, SUI-FEATURE-194 rev 4: emptying a protected group is refused; migration 3 → 4 leaves an oversized tree unwalked (patch)

- **SlideEditor delete protection (#643):** deleting or cutting the last deletable child or children of a protected (`deletable: false`) group is now refused like deleting the group itself, and the toast names the group. A group that was already empty no longer counts as emptied and is kept by a delete. Locked children that stay keep their group.
- **Slide migration (#643):** the 3 → 4 migration leaves a page, layout or master over the element or group-depth limit unmigrated, so loading fails with too-many-elements before the whole tree is walked (Codex CX1/CX2).

## 0.178.0 — #642, GL-UI-029 rev 5: a toast's text description counts toward its reading time (patch)

- **Toast reading time (#642):** `toast.success`/`error`/`warning`/`info` and `toast.promise` results now count the words of the description sonner shows as text together with the title: base plus 50 ms per word of both, capped at 12000 ms (`toast.warning("Check the input", { description: "…10 words…" })` lasts 3650 ms instead of 3150 ms). Toasts with an action count it too, beside the key hint, above their 8000 ms floor. The counted description is the call's, else that of the live toast a call replaces by its id (sonner keeps showing it); for a promise result its own, else the call's, a description function's text included (the function is still called once). A React-node description counts no words, as before; an explicit `duration` is unchanged.
- **Tests (#642):** unit: the description counted for all four variants, capped, a node description ignored, an explicit duration kept, a replaced live toast's description counted, an action toast past the floor; toast.promise success, error, a result object with a description, the result's own description winning over the call's, a description function's text (called once), a result with an action past the floor, a node description on a result, and a toast.warning closing after its reading time under fake timers. The numeric-id toast.promise test dismisses toasts earlier tests left in sonner first, so it passes alone and under `-t "duration"`.

## 0.177.0 — #624, SUI-FEATURE-194 rev 4: delete protection per element and `onChange` for every document change; slide schema version 4

- **Slide schema 4 (#624):** `SLIDE_SCHEMA_VERSION` is 4. Every element has `deletable` (default `true`), set by the app in the document; the editor offers no switch for it. The migration 3 → 4 drops any `deletable` a version-3 document carries (it knew none), on pages, layouts and masters and in groups, so an older document loads with every element deletable; nothing else changes.
- **SlideEditor delete protection (#624):** deleting (Delete/Backspace, the floating Delete, a held command) or cutting (Ctrl/Cmd+X, the canvas menu) a selection that holds a protected element, itself, as a child of a group or locked as well, is refused whole: nothing changes, nothing goes to the clipboard, the selection stays, and an error toast says why. A locked selection holding a protected element takes Delete for that, and its floating actions show only Delete. The toast names a single protected element and, when it is chosen beside others, says to deselect it (`slides.editor.deleteProtectedOne`/`deleteProtectedRest`, `cutProtectedOne`/`cutProtectedRest`); several are named together (`deleteProtected`, `cutProtected`). Copying stays allowed. Deleting a page with a protected element is refused before the question (`slides.editor.deletePageProtected`). All these refusals share one toast id, so a repeat replaces it. A protected element shows a 12 px lock mark with a tooltip (`slides.editor.protected`) at its row in the Layers drawer; moving, changing and grouping it stay possible. Every copy (duplicate, paste, a duplicated page, a library block) is deletable, the original stays protected; ungrouping keeps the protection on the children, and a protected group hands it to each child, as it does its lock. The protection is an editor lock, not a permission: an app that relies on these elements checks on save, on its server, that no protected element is missing.
- **SlideEditor `onChange` (#624):** new optional prop `onChange(document)`, called with the validated document for every change the editor takes over: each step, Undo, Redo, Reset and an extension's change. A drag reports once, on release; typing in a field (or any run of changes under one merge key) reports once the focus leaves it, a press ends or a pointer click lands, so an extension's button clicked reports at once (a click from the keyboard, Enter submitting a form, settles nothing while the focus stays); selection, page shown, zoom and grid display never report; a document the schema refuses is not reported. Sizes the canvas measures for text that follows its size are stored inside their step and not reported on their own; the next report carries them. Without `onChange` the editor checks nothing per step. The reported document is typed deeply `readonly` (an assignment to any field, nested ones too, does not compile); an app that wants to change it copies it. `onSave` is unchanged.
- **Tests (#624):** unit: the 3 → 4 migration (every element deletable, in groups too; a stray `deletable: false` or non-boolean dropped on pages, in groups and layouts), `holdsProtected`, copies deletable on duplicate, copy/paste and duplicate page, ungroup keeping protection; the editor refusing Delete, Backspace, the floating Delete, Ctrl+X and the menu's Cut (one toast id, the element named, the deselect hint beside others, the plain hint for several), a locked protected element by key and floating Delete, a group with a protected child and a page with one (no question asked), copying still working, the duplicate deletable, the layers mark; `onChange` once on a drag's release, none for selection, page, grid or zoom changes, once per Undo/Redo with the document before, once after typing in the X field, once for an extension's field, none for a keyboard click in a field being typed in; the 3 → 4 migration leaving a sparse list over its cap unwalked; a type test (`@ts-expect-error`) that assigning to a field of the reported document, top-level or nested, does not compile; the history's step count not counting a measured amend.

**Migration:** slide documents move to schema version 4 on load (`parseSlideDocument` migrates 1–3; a `deletable` in a version-3 document is dropped, all else unchanged); a server or app that checks `schemaVersion === 3` must accept 4. A parsed element always carries `deletable`, so code building a `SlideElement` by hand adds `deletable: true`. New package texts: `slides.editor.protected`, `deleteProtected`, `deleteProtectedOne`, `deleteProtectedRest`, `cutProtected`, `cutProtectedOne`, `cutProtectedRest`, `deletePageProtected` (`en`/`de`/`es`); an app that overrides the suite strings adds its own. New `data-testid`: `slide-editor-layer-protected` (the mark in a Layers row). New optional `SlideEditor` prop `onChange`, its document typed deeply `readonly` (new type `ReadonlySlideDocument` from `@suite/ui/slides/slide-editor`): a handler typed `(doc: SlideDocument) => void` no longer compiles; type its parameter as `ReadonlySlideDocument`, or copy the document (`structuredClone`) before changing it. Behaviour change: a selection holding a protected element is no longer deleted in its unprotected part; the whole delete or cut is refused. The gallery's strings-table baselines change (8 rows more): 10 files `gallery-{de,en,es}-{light,dark}.png` and `gallery-de-{light,dark}-{390,1440}.png`; no other gallery or Iris baselines change.

## 0.177.0 — #641, GL-UI-029: a toast.promise result without an action gets the variant's display duration

- **toast.promise (#641):** a success or error result without an action is now timed like `toast.success`/`toast.error`: the variant's base plus 50 ms per word ("Saved" lasts 2050 ms instead of sonner's 4000 ms), capped at 12000 ms. An explicit `duration` stays within the same bounds: one below the base lasts the base, one above the cap lasts 12000 ms. Results with an action are unchanged (#637).

## 0.177.0 — #638, GL-UI-016 rev 21: a press on the bubble ends the keyboard-focus wait

- **Overflow tooltip on keyboard focus (#638):** with a pointer bubble open, a keyboard focus on its holder starts the 1500 ms wait; a press on that bubble within the wait now ends the wait as well, so the bubble stays closed instead of opening again at the deadline. `OverflowTooltip` and `Hint` alike. The pointer leaving and the keyboard bubble's own open still leave the wait running; a press on an open keyboard bubble is left to the bubble as before (#593).

## 0.177.0 — #637, SUI-FEATURE-101: a toast.promise result keeps the caller's duration

- **toast.promise (#637):** the result of a promise toast with an action now takes the caller's explicit `duration`, as `toast.success` with an action does: `duration: 10000` lasts 10000 ms instead of 8000 ms, and one below 8000 ms still lasts 8000 ms. Without a duration the timing is unchanged: an action toast lasts at least 8000 ms, one without an action keeps sonner's.

## 0.176.0 — #625, SUI-FEATURE-280 rev 2: an image's crop shifts along the axis its proportions overhang, at 100 % too

- **SlideView image crop (#625):** the image is drawn at its own proportions, filling the area inside its border (`cover`) and then zoomed; the crop's offset reaches as far as that drawn image overhangs the area, half to each side. At zoom 1 the axis the image overhangs now shifts (a 2:1 image in a 400 × 400 frame reaches ±200 px sideways), the other does not. Editor, player and export draw it alike.
- **Natural size (#625):** the proportions come from the loaded image's natural size. Until it has loaded nothing is clamped; a stored crop is never rewritten, only drawn within its reach.
- **Crop mode (#625):** dragging, the x/y fields and the arrow keys shift the image on the overhanging axis at 100 %; the fields' range names that reach, and the dimmed rest shows the whole drawn image, its overhang included. Cropping starts from the size the canvas's image has already loaded; while it is not known, a shift is kept unclamped and no range is named. A medium that does not load keeps the area's own proportions, as before.
- **Export (#625):** each image drawn by `SlideView` carries `data-slide-image` (`loading`, then `sized` once its size is known); `exportSlidePages` waits until every loaded one is `sized`, so the PNG never catches a crop before it is clamped to its reach.
- **Tests (#625):** unit: the reach from the image's proportions (2:1 in 400 × 400: −150 kept, −500 clamped at −200; a bordered frame against its inner area), SlideView drawing it shifted, clamped, centred with offset 0, and unclamped before load; crop mode at 100 % shifting sideways by keys, field and drag, never up and down; a key before load keeps the stored shift; the size taken from the canvas; a broken medium clamped as before; the export's wait for sized images. Gallery: an export with a crop on the overhanging axis equals the view; crop expectations follow the photo's 4:3 proportions in its 400 × 250 frame.

**Migration:** none required; no schema change. Stored crops draw as before as long as their offset on the overhanging axis is 0, and every stored crop within the old reach draws unchanged. Crop-mode screenshots show the image's overhang in the dimmed rest.

## 0.176.0 — #622, SUI-FEATURE-164 rev 2 and SUI-FEATURE-165 rev 2 (folded #623): inline icons and images in text, text fields and shapes that grow with their text; slide schema version 3

- **Slide schema 3 (#622):** `SLIDE_SCHEMA_VERSION` is 3. A run is text or an inline element: `{ inline: "icon", icon, height }` or `{ inline: "media", media: { id }, alt, height }` (`inlineIconRunSchema`, `inlineMediaRunSchema`, `runSchema`, types `InlineRun`, `Run`, guard `isTextRun`). `height` is a factor of the line's font size (default 1, at most `SLIDE_LIMITS.maxInlineHeight`, 4); an inline run counts as one run against `maxRuns`. A text element has `sizing`: `fixed` (default), `height` or `both`; a shape may `follow` a text field of its own group (`{ id, inset: { top, right, bottom, left } }`). A follow reference to an element outside the shape's group is the issue `follow-outside-group`, one to no text field `follow-not-text` (sentences in `slides.editor.saveRule`, `en`/`de`/`es`). The migration 2 → 3 changes no content: older documents have no inline runs, every text field is `fixed`, no shape follows.
- **SlideView, SlidePlayer, SlideExport (#622):** an inline run stands on the baseline of its line, `height` em of its paragraph's size; its first em lies inside the line, so factor 1 leaves the line height as it is; the part above 1 em grows its line, so a taller one never reaches into the line above and a field that follows its text holds it. It wraps together with the word it touches, takes its paragraph's colour (icon) and highlight; an image with an alt text is read out, one without and an icon are decorative. An unknown medium or icon shows the missing-media or unknown-icon stand-in at the line's size and is reported as before. A text field of `sizing` `height`/`both` is drawn at the size its text measures where it is drawn (`both`: no automatic wrapping, the longest line's width), growing from the anchor of its alignment and vertical alignment; a following shape takes the field's box plus its inset, its group the box around its children. A wider brand font makes a wider badge without a change to the document; an inline image that fails is measured again with its stand-in. New `SlideView` prop `onLayout(boxes)`: the boxes of the page's own elements where the drawn one differs from the stored one.
- **SlideEditor (#622):** with a caret in a text field or cell, an icon or a picked medium from the library goes into the text at the caret as an inline run (no new element); the field takes the focus back, its caret after it. Arrows pass over it as one character, Backspace/Delete remove it, Undo brings it back; a copy and paste inside the editor keeps it (clipboard type `application/x-suite-slide-runs`). At the run limit the insert is refused with `slides.editor.textRefused` (`SUI-FEATURE-114`). An inline run in the field shows a pointer and a hover outline; a click selects it, outlined in the ring token while the selection covers it, and the Content tab then shows its height and, for an image, its alt text. While a caret is set, the library hint says an icon or image goes into the text at the cursor. The Content tab of a text field has a field size select (`fixed` / height follows / width and height follow). Under `both` the field offers no width handles, under `height` no height handles, a following shape no size handles; dragging a handle on a followed side sets the field `fixed` in the same step, and so does a width (under `both`) or height typed in the Layout tab; a box value typed for a following shape drops its `follow` in the same step. A field switched to `both` while being edited stops wrapping at once. Duplicate, copy and paste, a duplicated page and a library block keep a shape following the copy of its text (one id remap, `freshCopies`); a shape whose text is deleted, not copied along or grouped apart from it no longer follows it, so the draft stays one Save takes. The size the canvas measures is stored as the size last measured, inside the step that changed the text (one Undo takes back text and size), never as a step of its own; a draft saved as it stood stays saved. A paste between documents adopts the media of inline images as it does an image's.
- **Folded spec drift (#622; SUI-FEATURE-164 rev 4, SUI-FEATURE-114 rev 5, SUI-FEATURE-165 rev 4/5, #630 part 1, #631):** an inline run takes its colour and highlight from the text run before it in its paragraph (at the paragraph's start, the one after it), in `SlideView` and the editor's field alike (`inkRun`). An inline run refused at the run limit says so in its own words: new key `slides.editor.inlineRefused` in every catalogue, same toast slot. The Field size select moves to the Layout tab, directly under X/Y/W/H and Rotation, at the width of the panel's other single selects, and leaves the Content tab. A shape in a group with a text field gets a "Follows text" select (a text field of the group, or None) with four inset fields, on the Layout tab directly under X/Y/W/H and Rotation, the select at the width of the other single selects, the insets in the two-column number grid (Top, Right / Bottom, Left); a shape outside a group, or in a group without a text field, has none. Setting a follow puts the shape directly behind its text field in the group's order, in the same Undo step, and new paddings are 8 px each side; ungrouping a badge onto the page's top level drops its follow (SUI-FEATURE-165 rev 6). Its options name each text field by its opening text (cut at 40 characters with an ellipsis), text fields that read the same followed by their place in the group; the paddings read "Padding top/right/bottom/left" (de "Innenabstand …", es "Relleno …") (new keys `followText`, `followTextHint`, `followTextValueHint`, `followNone`, `insetTop`/`Right`/`Bottom`/`Left`, `insetHint`, `insetValueHint`; test ids `slide-editor-follow`, `slide-editor-follow-<id>`, `slide-editor-follow-none`, `slide-editor-inset-<side>`). A growing text field is measured unrounded (its used size from `getComputedStyle`, no longer `offsetWidth`/`offsetHeight`).
- **Tests (#622):** unit: schema (inline runs, defaults, limits, follow errors, the 2 → 3 migration), the follow layout (left, centre, right, middle, bottom anchors, inset, group box, stale measurements), editor text offsets with inline runs, the view (baseline placement styles, alt text, stand-ins, measured badges, a wider brand font), the editor (insert at the caret, Backspace and Undo, run limit, copy and paste, height and alt fields, locked handles, measured sizes and Undo). Gallery: the flag on the baseline with the line height kept and wrapping with its word, badges and a `height` field growing from their anchor and with a wider brand font, the export PNG equal to the editor view, and the library icon at the caret with arrows, Delete and Undo in a real browser. Review round (#622): editor ops keep or drop `follow` on duplicate, paste (same page too), duplicate page, library block, delete and group (each result passes `safeParseSlideDocument`); typed W/H and shape boxes switch to `fixed` / drop `follow` with one Undo; the selected and lifted inline run in field and view; the caret library hint; the field unwrapped under `both`; the re-measure after a failed image; gallery: a tall inline clear of the line above and inside its field, and the inline run's hover and selected outline.

**Migration:** slide documents move to schema version 3 on load (`parseSlideDocument` migrates 1 and 2; content unchanged); a server or app that writes `schemaVersion: 2` keeps working through the migration, one that checks `schemaVersion === 2` must accept 3. Type change: `runs` of a text element and a table cell are `Run[]` (`TextRun | InlineRun`), so code reading `run.text`, `run.size` or another format key narrows first (`isTextRun(run)` or `run.inline === undefined`); `TextRun` itself is unchanged. A parsed text element always carries `sizing` (default `"fixed"`), so code building a `SlideElement` of type `text` by hand adds `sizing: "fixed"`. New `SlideIssueCode` values `follow-outside-group`, `follow-not-text` and `follow-no-group` (a shape on the page's top level, which is no group, follows a text field; SUI-FEATURE-165 rev 6): an app with its own sentence per code adds three. New package texts: `slides.editor.libraryHintCaret`, `slides.editor.textSizing`, `textSizingHint`, `textSizingValueHint`, `textSizingFixed`, `textSizingHeight`, `textSizingBoth`, `inlineElement`, `inlineHeight`, `inlineHeightHint`, `inlineHeightValueHint`, `inlineAlt`, `inlineAltHint`, `saveRule.follow-outside-group`, `saveRule.follow-not-text`, `saveRule.follow-no-group`, `inlineRefused`, `followText`, `followTextHint`, `followTextValueHint`, `followNone`, `insetTop`, `insetRight`, `insetBottom`, `insetLeft`, `insetHint`, `insetValueHint` (`en`/`de`/`es`); an app that overrides the suite strings adds its own. New `data-testid`s: `slide-editor-text-sizing`, `slide-editor-text-sizing-{fixed,height,both}`, `slide-editor-text-inline`, `slide-editor-text-inline-height`, `slide-editor-text-inline-alt`, `slide-editor-text-inline-run` (each inline span in the text field, `data-selected` while selected), `slide-editor-library-hint`, `slide-editor-follow`, `slide-editor-follow-none`, `slide-editor-follow-<id>`, `slide-editor-inset-{top,right,bottom,left}`; the inline spans in the text field carry `data-inline`, in the view `data-slide-inline`. New `SlideView` prop `onLayout`; `InlineTextEditor` takes `resolveMedia` and `focusRequest`. The gallery's strings-table baselines change (27 rows more): 10 files `gallery-{de,en,es}-{light,dark}.png` and `gallery-de-{light,dark}-{390,1440}.png`; no other gallery or Iris baselines change.

## 0.176.0 — #634, GL-UI-017: a Hint that adds only a status line keeps the field's label help

- **Hint (#634, Q&A #4792):** on a field with `LabelWithHelp`, a Hint that does not describe the field (describe off, or its text equals the `aria-label`) but sets a status line no longer drops the label help from `aria-describedby`; it reads `"<field>-help <status>"`. A describing Hint still replaces the label help with its own id.
- **Hint on a disabled control (#634):** the carrier span now carries the field's own `aria-describedby` ids, the label help included, by the same rule (a describing Hint replaces the label help); the disabled control itself keeps none, so nothing is described twice.
- **Tests (#634):** unit: label help kept beside a status-only Hint and beside a Hint with `describe={false}`; a describing Hint with a status line still replaces it; on a disabled field the carrier keeps the label help, or takes the hint id in its place.

**Migration:** none required. No strings, `data-testid`s or baselines change.

## 0.176.0 — #629, GL-UI-013: the outline Button shows its ring border on hover in dark; a disabled Button shows `not-allowed` and no hover

- **Button outline (#629, found in #628):** in dark mode the hover now reveals the `--ring` border on the input tint, as the Select trigger does; before, `dark:border-input` hid it and only a 1.08:1 fill change remained.
- **Disabled Button (#629):** it no longer sets `pointer-events: none`, so its `cursor-not-allowed` shows, as on the locked (`aria-disabled`) Button and the disabled Select. Every variant keeps its rest look under the pointer. A press on it does nothing: it opens no menu whose `asChild` trigger it is.
- **Behaviour change (#629):** a click on a disabled Button no longer falls through to a clickable row or card behind it; the browser drops it at the button.
- **Behaviour change (#629):** a disabled Button that is its own tooltip trigger (`IconButtonTooltip` or `Hint` without `disabledText`, or `TooltipTrigger asChild`) now opens its hint on hover in a real browser, so a disabled icon button names itself (`GL-UI-016`, as `GL-UI-006` rev 4 pins for a locked surface's Undo and Redo). Before, `pointer-events: none` kept it shut. A running (`busy`) button still keeps its own hint closed.
- **Tests (#629):** unit: the outline's dark hover border, every variant's disabled hover pair and cursor, no menu from a disabled `asChild` trigger. Unit: a disabled self-trigger `Hint` and `IconButtonTooltip` open on hover. Gallery: a disabled icon Undo (`?page=keys&history=locked`) shows its name on hover and ignores a click; the outline Button's hover (ring border, accent or input fill, label ≥ 4.5:1) light and dark; every disabled variant shows `not-allowed` and keeps its look under the pointer.

**Migration:** none required. An app that relied on a click through a disabled Button reaching the element behind it handles that element's click itself. No strings, `data-testid`s or baselines change.

## 0.176.0 — #619, GL-UI-013: toast action and cancel show a hover signal; an app's toastOptions no longer replace the package's

- **Toaster (#619, found in #617):** the filled action tints its fill on hover (85 % of the toast's text colour over the toast fill); on success, error and warning its label takes the variant's `-hover` token meanwhile, so it keeps 4.5:1. The ghost cancel reveals a 1 px border in the toast's text colour on hover. Both carry `cursor-pointer` and a transparent 1 px border at rest, so under forced colours they show an edge. The close X takes the toast buttons' token ring with the same 2 px gap, and on hover inverts to the toast's text colour with its icon in the toast's fill (sonner's grey hover hid the X). All set once in the Toaster.
- **Toaster `toastOptions` (#619):** an app's own `toastOptions`, its `classNames` included, now merge with the package's; variant colours, close button and the buttons' ring, gap and hover stay.
- **Tests (#619):** unit: a consumer `toastOptions.classNames` merges with the package's. Gallery: on every toast variant, light and dark, the action's hover tint (against its rest fill ≥ 1.2:1 on a light fill, ≥ 1.1:1 on a dark one; label ≥ 4.5:1), the cancel's border reveal (≥ 3:1 on the fill) and the close X's hover (icon ≥ 3:1), all with the pointer cursor; the close X's gapped token ring on keyboard focus; under forced colours the action and cancel show an edge at rest.

**Migration:** none required. An app that passed `toastOptions.classNames` to the Toaster now keeps the package's toast look alongside its own classes. No strings or `data-testid`s change.

## 0.176.0 — #620, SUI-FEATURE-114 rev 4: a refused format change gets its own hint

- **SlideEditor (#620):** a format change refused at input since #618 (bold or italic by `Ctrl`/`Cmd`+`B`/`I`, or a format from the property panel, in a text field or table cell) now says so in its own words, in the same toast slot: the new key `slides.editor.formatRefused` ("Formatting not changed: this text has too many differently formatted parts. Remove some formatting and try again."), in `en`, `de` and `es`. Refused typed or pasted text keeps `slides.editor.textRefused`, unchanged.
- **Tests (#620):** unit: the bold toggle in a text field and in a table cell and the panel size at `maxRuns` now expect the `formatRefused` text in the refused-text toast slot; the refused paste in a text field and a table cell still expects `textRefused`. The catalogue parity test covers the new key in every language.

**Migration:** new package text `slides.editor.formatRefused`; an app that overrides the suite strings (`registerSuiteStrings`) adds its own translation of it, or the package text applies. The gallery's strings-table baselines change (one row more); no call site or `data-testid` changes.

## 0.176.0 — #617, GL-UI-013 / SUI-FEATURE-116 rev 2: toast action and cancel keep their contrast and the token focus ring

- **Toaster (#617, found in #614):** a toast's action and cancel take the one token focus ring (`--ring`, full opacity, the transparent forced-colours outline) in place of sonner's 2 px black shadow at 40 %. On every variant, neutral included, a 2 px gap in the toast's text colour (`--normal-text`) parts the ring from the toast fill, so the ring keeps 3:1 against the gap and the gap 3:1 against the fill, light and dark; the gap is set once in the Toaster. The cancel drops sonner's see-through fill (2.77:1 in dark mode) and shows its label in the toast's text colour on the toast fill, so it keeps the toast's text contrast.
- **Tests (#617):** gallery: the receipt's Undo as action and as only cancel, and the action and cancel on every toast variant (new `?page=toast&buttons=1` view), light and dark: cancel label ≥ 4.5:1 with no fill, the ring with its gap drawn on keyboard focus, ring against gap and gap against fill ≥ 3:1; under forced colours a focused toast button shows its outline.

**Migration:** none required. Toasts with an action or cancel look different: the cancel has no fill, and on keyboard focus both buttons show the gapped token ring. No gallery or Iris baselines change; no strings or `data-testid`s change.

## 0.176.0 — #621, SUI-FEATURE-115 rev 8: a tile's tooltip keeps off every fixed or sticky app part near the tile's name, and keyboard focus brings a tile out from under a header

- **Tile tooltip (#621):** every fixed or sticky app part (header, toolbar, footer) that overlaps the tile's column counts toward the tile's visible area, whether it covers the tile or lies just above or below it, and it cuts that area only vertically: the top is the bottom edge of the lowest part above the name, the bottom the top edge of the highest part below. A part that overlaps the tile no longer cuts the area at its side. A part across the name's whole width in the name's own line counts by its centre: when it covers the name's whole height, against the middle of the column; when it cuts the line only partly, against the name's middle (a centre exactly on it counts as below). A part over only part of the name's width cuts nothing. The name stays shown, and the tooltip stands over or under it on the side clear of the part (over first), else at the element. Parts are found every 16 px across the tile's column, so a narrow chip is found wherever it stands. What the user sees: the tooltip no longer covers a bar or chip near the name, and no longer disappears behind a narrow chip over the name.
- **Tile keyboard focus (#621):** Tab or Shift+Tab onto a tile under a fixed header now scrolls it out 8 px clear below the header. This holds when its name lies in the header's upper half, and when the tile was wholly above the viewport. Before, the header counted as a part below the name, so the tile could stay hidden under it (AC 7).
- **Tests (#621):** unit: a sticky header ending 10 px above the tile's top (AC 9) with no room above the name — the bubble stands 4 px under the name, no pixel over the header; a fixed footer below a wholly visible tile leaves the bubble over the name (AC 4); a narrow fixed part over the tile's rows keeps the bubble off it; a sticky bar cutting the name's line counts as above or below by its centre, on the middle as below (AC 10); a part over part of the name's width leaves the name shown and the bubble clear of it (AC 11), also found by the hit test off the column's centre; Tab onto a tile whose name lies in the header's upper half, or that lies wholly above the viewport, sets `scroll-margin-top` 64 px (AC 7). Gallery: the AC 9 and AC 4 cases on a `MediaTile` with a fixed header and footer, and a fixed bar cutting the top or the bottom of the name's line (AC 10), and a fixed chip over 64–98 % of the name's width (AC 11).

**Migration:** none. No call site, string, `data-testid` or baseline changes.

## 0.176.0 — #615, SUI-FEATURE-115 rev 4: a tile's tooltip is placed inside the tile's visible area, never over a sticky header or toolbar

- **Tile tooltip (#615):** the overflow tooltip in a tile (`data-tooltip-tile`, e.g. `MediaTile`) now measures its edges against the tile's visible area instead of the viewport. That area is the viewport cut by every clipping ancestor (`overflow` other than `visible`, at its padding box, so borders and scrollbars do not count), less every fixed or sticky app part (an app header, a toolbar) on top of the tile or its column; a part only above or below the tile cuts the area there only, never at the tile's sides. Every placement — beside the text, over or under it, and the fallback at the element — stays inside that area, so the bubble never covers such a part. The parts are found with `elementsFromPoint` probes over the tile's column, not by walking the page; without a hit test (jsdom) every fixed or sticky part overlapping the column counts.
- **Hidden name (#615, Q&A #4728):** keyboard focus on a tile first scrolls it fully into the visible area, 8 px clear of the parts over it (`scrollIntoView({ block: "nearest", behavior: "instant" })` with a temporary `scroll-margin`, `GL-UI-013`; instant also under an app's `scroll-behavior: smooth`, so the bubble still opens); then the rules above apply. A name that lies fully outside the visible area shows no bubble, and an open one closes when a scroll moves its name out of view; nothing is ever held at the area's edge. Pointer and keyboard alike.
- **Tests (#615):** unit: a 56 px sticky header with the name 14 px and 40 px under it (the bubble 4 px under the name, no pixel over the header); a name half covered by the header (the bubble's top 8 px under the header); a name wholly under it (no bubble); Tab onto a tile under a fixed header scrolls with a 64 px margin, then places the bubble; a tile cut 100 px off at a bordered inner scroll container's edge; a fixed strip in the column below a wholly visible tile leaves its bubble unchanged. Gallery: under a fixed 56 px header by pointer (14 px and 40 px) and by Tab (name at y 70, 96 and 26: the tile scrolls out, the bubble stays off the header and the name); an open bubble closes once its name is scrolled under the header; Tab under smooth scrolling still opens the bubble; the same header beneath the tiles (z-index -1) cuts nothing. The keyboard case of the viewport top-edge check now expects the tile to scroll into view first.

**Migration:** none; no call site changes. Behaviour change: keyboard focus on a tile partly out of view (or under a sticky part) now scrolls it into view. No strings, `data-testid`s or baselines change.

## 0.176.0 — #618, SUI-FEATURE-114 rev 3: a format change over a limit is refused on input

- **SlideEditor (#618):** a format change in a text field or table cell — bold or italic by `Ctrl`/`Cmd`+`B`/`I`, or any format from the property panel (size, weight, italic, font, colour) on a selection — that would split the runs past `SLIDE_LIMITS.maxRuns` is refused at input, as typed and pasted text is since #610: the formatting stays as it was and the same error toast (`slides.editor.textRefused`) says why. A field already past the limit takes a format change that adds no runs (one that joins runs, for example), so it can still be brought back under. The check at Save stays as the last bound.
- **Tests (#618):** unit: in a text field at `maxRuns`, bold on part of a run is refused with the hint and leaves the draft unchanged; bold on a whole run is taken and Save succeeds. The same in a table cell. A size from the panel on part of a run at the limit is refused, on a whole run taken. In a field past the limit, italic that splits a run is refused, bold that joins runs taken.

**Migration:** none. No call site, string, `data-testid` or baseline changes.

## 0.176.0 — #609, SUI-FEATURE-113 rev 3: `ProseLink` and `Button variant="link" inline` for links in running text

- **ProseLink (#609):** new export `@suite/ui/ui/prose-link` with `<ProseLink>` (renders `<a>`, takes its props; `asChild` for a router link) and `proseLinkClass`: underlined at rest 4 px below the text (`underline-offset-4`), no underline on hover, the token focus ring on keyboard focus (`GL-UI-060` §Links, `GL-UI-013`), in `text-primary`. The look is the new `prose-link` rule in `styles.css`.
- **Button (#609):** `variant="link"` takes `inline` in place of a size for a link button in a sentence: the same look as `ProseLink`, flowing in the line (no height or padding of its own, the paragraph's font size, weight and line height, on the text's baseline); its label stays on one line, so a label that can wrap belongs in a `ProseLink`. Without `inline`, `variant="link"` and `size="inline"` are unchanged.
- **One source (#609):** the help-markdown link and the link in an `InlineMessage` use the `prose-link` rule. The `InlineMessage` link looks as before (in its tone colour); the help link's underline moves from the default offset to 4 px, the only visible change.
- **Tests (#609):** unit: `ProseLink` renders `<a>` with the look, `asChild` hands it to the child; `Button variant="link" inline` carries the look and none of the link variant's box, `inline` is a type error without `variant="link"` or together with a size; the focus-ring check covers the `prose-link` rule. Gallery: a sentence each with `ProseLink` and the inline link button, both underlined at rest, not on hover, ringed on keyboard focus, in one colour, with the underline 4 px below the text and the paragraph's line height unchanged.

**Migration:** none required. Apps move their own prose links and link buttons in a sentence to `ProseLink` or `inline` and drop local underline classes. The components gallery baselines change (new section), and the help baselines with a link change (underline offset); no strings or `data-testid`s change.

## 0.176.0 — #608, SUI-FEATURE-112 rev 2: an edit while a way out is held takes it back

- **Leave guard (#608):** an edit on the surface (an `input` event, heard on the whole document: typing in a field, a native select or checkbox; not `change`, which a text field fires on blur; only the user's own, trusted input: a value a component sets from a prop, such as the combobox's hidden input or a Radix bubble select or slider, drops nothing) while a way out is held — during a page's own `busy` save, a panel's `onSubmit` promise or a router form submission — now drops that way silently. Once the work ends the surface stays: no "Save changes?", no focus change, so a following `Enter` no longer saves and leaves. A route change that waited for a router submission after a confirmed Discard is dropped with that Discard: `onDiscard` never runs and every input stays (`SUI-FEATURE-172` rev 5). A newer way out during the hold still replaces the held one and lands at its target (asking first if the surface is changed). Without an edit, `SUI-FEATURE-150` is unchanged.
- **Tests (#608):** unit: Back, Previous/Next, `Esc` and a route change held during a page's busy save, then typing → no dialog, route and focus kept (memory and data router); the same for a panel's slow `onSubmit` and a router submission (clean, and after Discard); Back then another route change lands at the second target, after an edit with its question first; the edit panel's Back step during its slow `onSubmit` is dropped by typing; a blur's `change` after the hold drops nothing; a combobox value set by the save's result leaves the held Back going. Rewritten to the new rule: an own Save changed meanwhile (`SUI-FEATURE-170` rev 6 AC5) and a second guard changed during the wait now stay without a dialog. Gallery: typing after Back or a link during the save keeps the page and the focus; Back then a link lands at the link.

**Migration:** none for call sites. Behaviour change: input during a held way no longer leads to a late "Save changes?" or to Discard resetting that input. Changes that fire no `input` event (a canvas drag, a button-based control) do not take the way back. No strings, `data-testid`s or baselines change.

## 0.176.0 — #606, SUI-FEATURE-091 rev 6: the edit panel's Back is one step inside the panel and never asks

- **Edit panel (#606):** Back (`onBack`) now goes one step back inside the panel at once, the inputs kept, also when the panel is changed; it no longer opens the leave dialog (`GL-UI-007`). That dialog stays for Cancel, Close, `Esc`, Previous/Next and navigation that leaves the panel. During the panel's own submit promise Back still waits for its result (`SUI-FEATURE-171`), decided by the running work itself, so a click in the render after the work ended no longer opens the dialog. Back's package hint is now one text for every `submitKind`, saying only that it goes one step back ("Goes back one step." / "Geht einen Schritt zurück." / "Vuelve un paso atrás."); the Cancel and Close hints still name the question (`SUI-FEATURE-094` rev 10).
- **Tests (#606):** unit: a two-step panel, a field changed, Back goes to the first step without a dialog and the input is still there, Cancel afterwards asks; in de/en/es Back's hint names no question while Cancel's (every kind) and Close's do. The leave-guard test of a dirty Back now expects no dialog.

**Migration:** an app that relied on Back asking before it runs `onBack` now gets `onBack` at once; it keeps the inputs of the step it leaves. `onBack` is a step inside the panel and never closes it: an `onBack` that sets `open` to false would let a changed panel go without the question, so on the first step the call site omits `onBack` or sets `backDisabled`. Removed keys `editPanel.applyBackHint` and `editPanel.nextBackHint`; an app that overrides them moves to the single `editPanel.backHint`. The gallery's strings-table baselines change; no `data-testid`s change.

## 0.176.0 — #587, GL-UI-028: `toast.promise` returns a dismissable id without a loading state; an async `finally` rejects `unwrap()`

- **Toaster (#587, found in #585):** `toast.promise` without `loading` now returns the id of its result toast (`suite-promise-<n>`, boxed with `unwrap` as sonner boxes it); before, sonner returned only `{ unwrap }` and the caller could not dismiss the result. The id dismisses the result once it shows, also a React element the promise resolves to (sonner showed that under an id of its own; the wrapper now shows it by the returned id, and `unwrap()` still resolves to the element); a dismissal before the promise settles has nothing to close, and the result still shows, as with a loading state. A caller's async `finally` that rejects now makes `unwrap()` reject with that rejection (`unwrap()` waits for the `finally`) and, when `unwrap()` is called before the promise settles, is then not reported as unhandled; without `unwrap()` it surfaces as an unhandled rejection, as a `finally` that throws does. Before, sonner dropped the promise: `unwrap()` resolved and the rejection always went unhandled. A click on the action of a toast with an action now also drops the wrapper's mark for it (sonner runs neither `onDismiss` nor `onAutoClose` on that path), so no entry stays behind. The dead `"dismiss" in` check on sonner's active toasts is gone.
- **Tests (#587):** unit tests: an async `finally` that rejects rejects `unwrap()` with no unhandled rejection; without `unwrap()` a rejecting and a throwing `finally` each surface as unhandled; the id of a `toast.promise` without `loading` matches `suite-promise-<n>` and dismisses its shown result, also a resolved element (shown once, by that id); an action click drops the toast's mark.

**Migration:** none. A call site that read `toast.promise(…)` without `loading` as `{ unwrap }` keeps working; it now also gets a string-boxed id. No strings, `data-testid`s or baselines change.

## 0.176.0 — #590, GL-UI-016 rev 17: the keyboard overflow bubble stands at its clipped text

- **Overflow tooltip (#590, follow-up #576):** opened by the keyboard focus of the control that holds a clipped text (a select, a button, a row), the bubble now stands at the clipped text, where the pointer's bubble stands, no longer beside the whole holder (rev 17, Q&A #4645); with several clipped texts, at the first in document order. The text stays free; the rest of the holder (its chevron, the other cells of a row, the rest of a tile) may be covered, neighbouring rows never. The place at the text itself applies only when neither side of the clipped text offers 120 px. A scroll in the two frames after the focus no longer extends that window: a scroll begun with the focus still closes the bubble.
- **Internal (#590):** the hint and the overflow tooltip share one component for the lines of full texts.
- **Tests (#590):** unit: the keyboard bubble stands past the clipped text inside its wider holder, placed as the pointer's; the fallback at the text only without 120 px on either side; a scroll that starts with the focus and goes on closes it. Gallery: Tab onto the clipped select puts the bubble at its value, the same box as on hover.

**Migration:** none. No strings, `data-testid`s or baselines change (baselines are taken without focus).

## 0.176.0 — #586, GL-UI-016 / GL-UI-017: the slide editor's schema save error names the broken rule in plain words

- **Slide editor (#586, found in #584):** a draft the schema refuses on Save no longer shows the first issue's technical `code · path` ("Not saved: the document breaks a rule (row-cells · pages.0…)"). The line under the header now names the rule in plain words and what to do: "Not saved: a table row has more or fewer cells than the table has columns. Undo your recent changes, then save again." One sentence per issue code (`slides.editor.saveRule.<code>`, en/de/es); the strings type requires one for every `SlideIssueCode`. Like the rejected-save text (#584), the line goes when Reset or undoing makes the draft clean again.
- **Tests (#586):** `slide-editor-save-rule.test.tsx`: a schema violation on Save shows the plain message and neither the issue code, its path nor its technical detail; a pasted text past the length limit, the real path to the refusal, shows the too-big sentence; undoing back to the saved state removes the line.

**Migration:** `slides.editor.saveFailed` takes `{{rule}}` instead of `{{issue}}`; an app that overrides it moves to the new placeholder. New keys `slides.editor.saveRule.*`. The gallery's strings-table baselines change; no `data-testid`s change.

## 0.176.0 — #583, SUI-FEATURE-150 rev 7: the page's own ways out wait for its busy save

- **Leave guard (#583, follow-up #572):** while a page's own save runs (`useLeaveGuard`'s / `useEditorLeaveGuard`'s `busy` / `saving`), its own ways out wrapped in `guard` (Back, Previous/Next) and an `Esc` that leaves the page are now held silently, as a route change to another pathname already was; before, they were dropped. Once `busy` turns `false` without `saveFailed` the held way goes anew through the guard as the page is then: an unchanged page lands at its target, a page still changed asks "Save changes?". With `saveFailed: true` it is dropped and the page stays with its error. The latest way out held replaces an earlier one. The edit panel and other `useLeaveConfirm` surfaces are unchanged: their `busy` still drops a way out (`SUI-FEATURE-171`).
- **Tests (#583):** Back, Previous, Next and Esc during the page's own busy save are held without a dialog and land at their target after the save succeeded; with `saveFailed` each is dropped, the error stays and the next way out asks. The #572 test of a held route change and Esc now lands at the Esc's target.

**Migration:** none. A page whose Back or Previous/Next was ignored while it saved now leaves once the save succeeded. No strings, `data-testid`s or baselines change.

## 0.176.0 — #577, GL-UI-019 rev 9 / GL-UI-010 rev 11: a neutral instance-name block with the initial in a primary square

- **Sidebar (#577):** the instance-name block in the sidebar head is no longer a filled colour block. It stands on the sidebar's card ground with a fine `border` frame, the name in `foreground`, semibold; left of it a small square (`size-6`, `rounded-sm`) in `primary` shows the instance name's first letter in `primary-foreground`. Hover tints it like a nav entry (`accent`); the click still leads to the dashboard, and collapsed the head still shows the toggle alone. Light and dark are built the same, from tokens only. Its hint now says only what happens next ("Opens the dashboard." / „Öffnet das Dashboard." / "Abre el panel."), no longer the visible name before it.
- **Initial (#577):** the letter is the first code point of the trimmed name, uppercased (`initialOf`): an emoji or a CJK Ext-B character shows whole, a leading space is skipped; a blank name shows no square at all, the name or the avatar slot simply starts without it.
- **User menu (#577, GL-UI-020 rev 13):** the avatar in the user block is now the same initial square as the instance-name block (one shared `InitialSquare`, `size-6` instead of `size-8`): the user's first letter in `primary-foreground` on `primary`; before it drew from the instance-name tokens. A transparent border on the user-menu trigger puts the avatar and the name on the same x as the framed head block's square and name.
- **Tokens (#577):** `--instance-name`, `--instance-name-foreground`, `--instance-name-hover` and their `--color-instance-name*` mappings are removed from both themes; there is no colour token of the instance name any more.
- **Tests (#577):** a unit test for the neutral block (border, card ground, foreground, semibold, accent hover, no fill class) and the initial square (`primary` ground, `primary-foreground`, the initial letter, `aria-hidden`); a token test that no `--instance-name` token is left; a user-menu test that the avatar is the same primary square with the user's initial, and none for a blank name; `initial-square.test.tsx` for emoji, CJK Ext-B, a leading space and the empty and blank name. The gallery's shell-text check takes both initials from `initialOf`.

**Migration:** an app that used the classes `bg-instance-name`, `text-instance-name-foreground` or `hover:bg-instance-name-hover`, or the CSS variables `--instance-name*`, moves to `bg-primary` / `text-primary-foreground` (or a neutral surface) — the tokens are gone. No strings change; new `data-testid`s `sidebar-instance-initial` and `user-menu-avatar`.

## 0.176.0 — #576, GL-UI-016 rev 16: the overflow tooltip opens on keyboard focus, for clipped text only

- **Overflow tooltip (#576):** an `OverflowTooltip` whose text is clipped now also opens when its element, or the control that holds it, takes the focus by keyboard (`:focus-visible`, after a key, never after a press or touch), after the same `--tooltip-hint-delay` (1500 ms) as for the pointer. The holder is the nearest focusable ancestor, where it is tabbable (natively focusable, or `tabindex` 0 and up: a media tile, a button, a link) or has an interactive role (`option`, `gridcell`, `row`, `tab`, `menuitem`, also as a roving `tabindex="-1"` item), told at the focus; a container only a script focuses (`tabindex="-1"` without such a role: the upload list, the help drawer's main, the slide player, a dialog's content) is none and ends the search, never climbing past it to a tabbable element above (rev 16, Q&A #4643). Opened so, the bubble stands beside the focused holder, never over it, and closes any other open bubble. It closes on the next focus change, `Esc`, scroll and a click, `Enter`/`Space` on the holder included; any of these during the delay keeps it closed. The scroll the focus itself causes (Tab onto an element out of view) does not count. A text that fits shows nothing on focus. Several clipped texts in one holder show in one bubble, each full text on its own line (`mt-1` apart), in document order (rev 15, Q&A #4641). A clipped text in no holder (page and editor titles) shows nothing on focus and gets no tab stop; its full text stays in the DOM for screen readers. A focusable clipped element no longer opens its bubble at once on focus (radix did), only after the delay and by keyboard.
- **Hint (#576):** the description hint still stays closed on focus (`GL-UI-017`). A `Hint` whose control is clipped, by its own text or by `OverflowTooltip`s inside it (a select value, a button label), opens on keyboard focus after the delay with the full texts alone; on pointer it shows them above the description as before. Every clipped `OverflowTooltip` inside counts, one line each in document order (before, only the last one reported). A `Hint` and an `OverflowTooltip` in one holder open one bubble. A closed hint still reads no layout (#438): its own clipping is read once, when the delay has run.
- **Tests (#576):** `tooltip-keyboard-focus.test.tsx`: opens after 1500 ms on keyboard focus of a holder and of the clipped element itself; nothing for a fitting text, after a press or touch, without `:focus-visible`, in a `tabindex="-1"` container, or for a tabbable element above such a container; items with an interactive role are holders, a roving item without one by its `tabindex` at the focus; closes on focus change, `Esc`, scroll, click, `Enter` and `Space`, each asserted open first, and each during the delay against an uninterrupted control run; the focus's own scroll does not cancel it; one bubble when a hover bubble opened meanwhile; no reopen without focus after the text fit and clipped again; several clipped texts as lines in document order, `mt-1` apart; a clipped title in no holder shows nothing; a `Hint` stays closed for a fitting text, shows only the full texts on keyboard focus (own clipping, one and several inner `OverflowTooltip`s), all lines and the description on pointer; a `Hint` and an `OverflowTooltip` in one holder share one bubble; placed by the holder's room. Gallery: Tab onto the media tile with the clipped name shows its full text beside the tile; Tab onto the next tile (name fits) shows none by the time a hover begun after it opens its own; Tab onto the clipped tile below the fold shows its full text.

**Migration:** none for call sites. `OverflowReportContext`'s value now takes the reporting element and its text, `(node, full)`, instead of the text alone; only a component that provides or calls it itself (none outside the package is known) changes. `useIsOverflowing` also returns the measured `node`. No strings, `data-testid`s or baselines change (no layout change; baselines are taken without focus).

## 0.176.0 — #575, SUI-FEATURE-101 rev 7 / GL-UI-050: sonner's return after a pointer press holds off where it remembers another element than the toaster

- **Toaster (#575, follow-up #564):** a pointer press outside the toasts keeps the focus where it puts it also when the element focused before the toasts is an SVG element (`tabindex` on an `<svg>`); before, sonner gave that element a passing focus. The toaster now follows sonner's own record of the entry and holds its return as well where it differs from the element before: a toast with `dismissible: false` entered by Tab (sonner then remembers that toast), a focus that came in through the section around the lists (sonner remembers the section), and a stale record left when the toast node holding the focus went without a blur (sonner remembers the element of that earlier entry). All three got the fallback; none is left as a documented limit. The same hold applies when the toaster itself returns the focus (Tab past the last stop after Alt+T, a focus that leaves for nothing), so sonner's return does not pull it to its other element. A Tab out of the toasts onto a focusable SVG element now keeps the focus there, as on any other element; before, it counted as a focus that left for nothing and went back to the element before. An SVG element before that is gone falls back to its group's next usable control (`GL-UI-050`), as an HTML one does; before, it went straight to the main content (`focus-return`'s opener now takes an SVG element as its trigger). A dialog opened from a focusable SVG element that is still there returns the focus to it (tier 1), not to its group's next control. The toaster's copy of sonner's record is emptied when the last list unmounts, as sonner empties its own, and is kept across a change of the Toaster's `id`, as sonner keeps its own. **Limit:** sonner's own return as its list unmounts (the last toast gone) comes outside any focusout and cannot be held; it can still move the focus to the element sonner remembered from a stale entry.
- **Tests (#575):** unit tests, each failing without the change: a pointer press after an SVG element before, after a `dismissible: false` toast entered by Tab, after an entry through the section, and after a stale entry whose node went without a blur moves the focus only to the pressed element; after a stale entry, Tab past the last stop after Alt+T and a focus that leaves for nothing go to the element before only; a Tab out onto an SVG element stays there; a gone SVG element before falls back to its group's next control; after the list unmounted, a new `dismissible: false` toast entered by Tab takes no passing focus on a pointer press. A dialog opened from an `<svg tabindex>` in a toolbar returns the focus to the svg; after a change of the Toaster's `id`, the section sonner remembered takes no passing focus on a pointer press (fails with the per-effect reset of the copy). The receipt tests in the gallery share one setup helper. Gallery: the "empty" round of the receipt test is its own test now, tagged `@touch`, so it also runs in the `webkit-touch` project (WebKit, touch tap): after Alt+T onto Undo, a press on the page's empty area leaves the focus on nothing and the receipt open.

**Migration:** the public type `Opener` (from `captureOpener`) widens: `Opener.trigger` is now `HTMLElement | SVGElement`, no longer `HTMLElement`. A consumer that reads `opener.trigger` and uses HTML-only members on it (`dataset`, `click()`, `offsetParent`, …) narrows it first (`trigger instanceof HTMLElement`); `focus()`, `blur()`, `closest()` and `isConnected` work as before. No strings, `data-testid`s or baselines change.

## 0.176.0 — #573, SUI-FEATURE-109 rev 4 AC 6: the leave guard fails safe without react-router's private redirect mark

- **Leave guard (#573, follow-up #562):** a submission's own location is now the first one it runs at; any later location during the same submission counts as a redirect's, so a waiting same-path change (a `?tab=` switch, a browser step) is dropped after a redirect of the submission even if react-router no longer sets its private `location.state._isRedirect`. The mark is still read where the guard first sees a submission at a redirect; the code comment names it as private API and points at the canary tests.
- **Tests (#573):** in `leave-guard.search-params.test.tsx`, a canary that fails once react-router stops marking a redirect location, and runs with the mark stripped (302 and 307): a `?tab=` change during the load of a same-path redirect is dropped and the app lands at the redirect target. A regression test: after the last guard unmounted during a submission, a `?tab=` change held during a later submission without a redirect still goes on (the guard forgets the old submission's location at teardown).

**Migration:** none.

## 0.176.0 — #585, GL-UI-028: the id `toast.promise` returns dismisses its toast

- **Toaster (#585, found in #582):** `toast.dismiss` takes the id `toast.promise` returns as it is: sonner returns it boxed with `unwrap`, and its own `dismiss` compared the box with the toast's id and closed nothing; the wrapper's `dismiss` now unboxes it, for the `suite-promise-<n>` id and for a caller's own `id` alike. A caller's `finally` that throws now makes `unwrap()` reject with that error; before, the wrapper's async `finally` turned it into an unhandled rejection and `unwrap()` resolved. A click on the action of a toast with an action now stops the wrapper's timer for it (sonner closes the toast on the click without its dismiss handler); before, the timer ran on and later dismissed that id.
- **Tests (#585):** unit tests: the returned id of a `toast.promise` without an `id`, with the caller's string `id` and with a numeric one dismisses its toast; an action whose click prevents the default keeps its toast and its timer (open at 7500 ms, closed by 9500 ms); `dismiss` hands sonner a plain id unchanged and a boxed one unboxed; a throwing `finally` rejects `unwrap()`; an action click drops the timer and a toast that reuses the id reports `onDismiss`, not `onAutoClose`, on the dismissal Esc calls; a toast with an action raised by its id right after its timer closed it reports `onDismiss`; a call with neither `action` nor `onAutoClose` (and one with its own `onAutoClose`) right after the dismissal of an action toast shows no action and never runs the replaced toast's `onAutoClose`. Each of the explicit overrides in `prepare` now has a test that fails without it.

**Migration:** none; `toast.dismiss(id.valueOf())` keeps working. No strings, `data-testid`s or baselines change.

## 0.176.0 — #584, SUI-FEATURE-150 / GL-UI-027: a rejecting `onSave` of the slide editor is a failed save

- **Slide editor (#584, found in #572):** a promise from `onSave` that rejects now counts as a failed save, as a result other than `true` does: `saving` ends, `saveFailed` is set in the same update, the draft stays and a route change held during the save is dropped, with no "Save changes?" over it. Since the host's own handling did not run, the editor names it in its save-error line (`role="alert"`, `slide-editor-save-error`): "Not saved: saving failed. Your changes are still here. Try again." / "Nicht gespeichert: Das Speichern ist fehlgeschlagen. Deine Änderungen sind noch da. Versuche es erneut." / "No se ha podido guardar. Tus cambios siguen aquí. Inténtalo de nuevo.", never the exception's text; it goes when the next save starts and when the draft is clean again (Reset, or undo back to the saved state). A `false` result stays as it was (no text in the editor; the host reports it). Before, the rejection escaped as an unhandled rejection and nothing was shown.
- **Tests (#584):** unit test under `MemoryRouter`: a rejecting `onSave` with a click to another path during it keeps the user on `/editor` in the draft, no dialog, no unhandled rejection, the new text shown without the exception's message; the `false` case shows no save-error text; the next save clears the text as it starts; a Reset after the rejection clears it too.

**Migration:** none. New string key `slides.editor.saveRejected` (de/en/es); a host that passes its own strings adds it. No `data-testid`s change; baselines: `gallery-{de,en,es}-{light,dark}` and `gallery-de-{light,dark}-{390,1440}` (the strings table gains the key), all others unchanged.

## 0.176.0 — #582, SUI-FEATURE-101 rev 7: after any replacement a toast is one with an action exactly when it shows one; its timer stands still in a hidden tab

- **Toaster (#582, Codex review v0.175.0 and merge review):** sonner merges a call that replaces a toast by its id into that toast, so the toast keeps the action it shows unless the call sets `action` itself. After every replacement, on every route (the plain call, the four variants, `toast.message`, `toast.loading`, `toast.custom` and `toast.promise` with its loading state and its result, also one the promise resolves to as a React element), also a call that comes right after the toast's dismissal, before sonner has shown it,, it is now a toast with an action exactly when it shows one: one that still shows an action, inherited or its own, gets the action duration max(8000 ms, reading time with the key hint), the `Alt+T` hint in the live text, the action mark and the pause rules. One whose call removes the action (`action: undefined`) gets its own duration (or the Toaster's configured one), and the mark and the wrapper's dismiss handler go with the action; the caller's own `className`, `onDismiss` and `onAutoClose` stay as sonner merges them. Before, `toast.success(…, { id, action })`, then `toast.loading(…, { id })`, then `toast.message(…, { id, action: undefined })` stayed open for good; without `action: undefined`, or as a promise result, the Undo stayed but closed after 4000 ms without its hint; and a `toast.custom` or pending `toast.promise` replacement was closed by the replaced toast's 8000 ms timer. A `toast.promise` without its own `id` now gets one of the form `suite-promise-<n>`. The timer of a toast with an action now stands still while the document is hidden (another browser tab), also for a toast raised while hidden, as sonner's own timer does, and goes on with the time left once it is visible again; before, an Undo could expire unseen.
- **Tests (#582):** unit tests for an action inherited through a loading toast and through a `toast.promise` result (open past 7500 ms, hint and mark present, closed by 9500 ms), an action removed with `action: undefined` (no mark, no hint, closed by sonner's 4000 ms, the caller's `onAutoClose` called once and its `onDismiss` called on a dismissal), a call right after the dismissal of an action toast, the `onDismiss` of the replacing call taking over, an inherited action on `toast.custom` and on a promise resolving to an element, a `toast.custom` replacement with 12000 ms, the pause while the document is hidden and an action toast raised while it is hidden, and the returned `suite-promise-<n>` id of a `toast.promise` without one dismissing that toast. The replacement tests of #563 now remove the action explicitly.

**Migration:** a call that replaces a toast with an action by its id and shall show no action passes `action: undefined`; without it the toast keeps the Undo, now with its full duration and hint (sonner showed the inherited Undo before too). `toast.promise` without its own `id` now returns the id `suite-promise-<n>`, a string, instead of sonner's counter number: a call site that compares or stores it as a number changes to a string; since #585 `toast.dismiss(id)` with the returned id itself dismisses that toast (sonner returns it boxed with `unwrap`; `id.valueOf()` is no longer needed). No strings, `data-testid`s or baselines change.

## 0.176.0 — #572, SUI-FEATURE-150 rev 7: a route change during the page's own save waits for it and goes on after a success

- **Leave guard (#572, retrofit, Q&A #4600):** while a page reports its own save as `busy` (a fetch, mutation or fetcher save), a route change to another `pathname` (without `ignoreSearchParams` also one that keeps it), browser back/forward included, is now held instead of dropped, silently without a dialog on an unchanged page, and is not forced by an abort. Once `busy` ends it goes anew through the holds as they are then: an unchanged page lets it pass to the chosen target. The new optional `saveFailed` of `useLeaveGuard` and `useEditorLeaveGuard` (there beside `saving`), set with `busy` turning `false`, drops the held change instead: the page stays and its error stays visible, with no "Save changes?" over it. The latest change replaces an older held one. Under a data router a router Save of the page's own form submitted during such a fetch save is held the same way and submitted anew from its form, once, after the save succeeded. Unchanged: the edit panel's `onSubmit` and `busy` (SUI-FEATURE-171), router form submissions (SUI-FEATURE-150 AC 1–3), `Esc` and the page's own ways (still dropped while `busy`), and same-path changes with `ignoreSearchParams` (SUI-FEATURE-109 rev 4). The #562 entry below now says that such a change goes on after the save (its bullet text corrected, heading unchanged).
- **Tests (#572):** unit tests under `MemoryRouter`, `BrowserRouter`, `createMemoryRouter` and `createBrowserRouter`: a change to another pathname during the save, with and without `ignoreSearchParams`, stays held without a dialog and lands at its target after the save; browser back to another path lands there after the save; with `saveFailed` the change is dropped, the draft stays and the next way out asks; the same for `useEditorLeaveGuard` and for `SlideEditor`, whose failed save now sets `saveFailed` itself (a click to another path during it stays, no "Save changes?" over the error; after a success it lands there); a page's own router Save held during a fetch save posts once after it; a held change on a page still changed after the save asks, and an `Esc` dropped meanwhile never runs. Gallery (`?harness=leave-guard`, `/detail` gains "Fail save"): a click to another path during the save lands there after success and stays with `saveFailed`.

**Migration:** additive. A page (or an editor via `useEditorLeaveGuard`) whose `busy` save fails must set `saveFailed` in the same update that turns `busy` false and clear it when the next save starts, else the held route change goes on after the failed save; after a successful save `dirty` must read clean in that same render, else the held change asks "Save changes?" first; pages that kept the user on the page after a save with a click meanwhile now follow that click. No strings or baselines change; new `data-testid` `harness-fail-save` in the gallery harness only.

## 0.176.0 — #574, GL-UI-017: the slide editor's test-id-only props are named for what they set

- **Slide editor (#574, follow-up #566):** `TextFormatFields` takes `testIdPrefix` instead of `idPrefix`; since #566 it sets only the `data-testid`s of the format fields (the field ids are per instance). Inside `AnimationFields` the test-id stem is named `testId` alike. Nothing changes on screen.
- **Tests (#574):** the two-editor test "SlideEditor field ids" also checks that every `aria-errormessage` points into its own editor, with a refused animation duration in both.

**Migration:** `TextFormatFields` `idPrefix` → `testIdPrefix` (same value, it sets only `data-testid`s). No strings, `data-testid`s or baselines change.

## 0.175.0 — #568, SUI-FEATURE-106 rev 7: the waiting paste's status moves into the editor head's status slot

- **Feedback (#568, retrofit #552):** after 300 ms of waiting for `adoptMedia`, "Medien werden übernommen …" / "Importing media …" / "Importando medios …" now shows in the `EditorHeader` status slot (`status`, `SUI-FEATURE-104`) as the `GL-UI-033` operation spinner and label, left of the state. Where the head lacks the room for the label beside its title's floor, the slot shows the compact form instead: the spinner alone, focusable, named by the label and carrying it as its hint, so the head keeps its height and Save its place (390/420 px). The slot appears only from 300 ms on, so a quicker paste moves nothing in the head. The screen-reader-only `role="status"` (`aria-live="polite"`) sits in the head outside its row, is there from the paste's start and announces the text once. The visible line at the work area's bottom left (#552) is gone: nothing lies on or at the work area, its content does not move. `aria-busy="true"` and `cursor: progress` on the canvas stay; all of it ends with the paste, also after 10 s of silence or a failed `adoptMedia`.
- **Tests (#568):** the unit tests check both forms of the status in the head's slot, one live region and one spinner, no slot before 300 ms and nothing after the paste lands. The gallery checks that the head's and the canvas's boxes stay the same at 1920 px and, light, at 390, 420 and 768 px in de/en/es, with Save inside the head.

**Migration:** `data-testid="slide-editor-adopting"` (the live region) now exists only while a paste waits, in the head's container beside the `EditorHeader`; new `slide-editor-adopting-status` for the slot content. Without `adoptMedia` nothing changes; baselines: `slide-editor-paste-wait-{de,en,es}-{light,dark}` (status in the head instead of the work area), all others unchanged.

## 0.175.0 — #565, SUI-FEATURE-101 rev 7 / GL-UI-050: the way back after Alt+T falls back when the element before is gone

- **Toaster (#565, retrofit #550):** when the focus came into the toasts by `Alt+T`, Tab past the last toast control and Shift+Tab before the first still go back to the element focused before. When that element is no longer there (or takes no focus), the focus now goes to the `GL-UI-050` fallback: the next usable control of its group (toolbar, header, row) after it, then before it; else the surface's main content; else the container it was in. It never falls to `<body>`. The same fallback applies when a toast takes the focus along as it leaves, or when the focus leaves the toasts for nothing. The fallback target shows the ring only when the focus in the toasts showed one, as the direct return does (`returnFocus` takes an optional `focusVisible`). A switch to another window or browser tab while the focus is on a toast no longer counts as leaving for nothing: the focus stays in the toasts and their timers stay paused. Before, the focus stayed on the toast control, or fell to `<body>`.
- **Tests (#565):** unit tests for Tab and Shift+Tab after `Alt+T` with the element before removed: the group's next control, the main content without the group, the container without group or main content, never `<body>`; the fallback for a leaving toast, for a focus that leaves for nothing and for an element before that takes no focus; the ring on the fallback with and without one in the toasts; a window switch that moves no focus.

**Migration:** none. No strings, `data-testid`s or baselines change.

## 0.175.0 — #564, SUI-FEATURE-101 / GL-UI-050 follow-up #550: a pointer press outside the toasts moves no passing focus

- **Toaster (#564):** when a pointer press moves the focus out of the toasts, sonner's return to the element focused before is prevented instead of undone afterwards, so that element takes no passing focus or blur (an auto-activating tab does not switch, a field does not validate on blur). A press on the page's empty area puts the focus on nothing, as without toasts: the element before gets no focus and no ring, and a receipt over it stays open. Safari focuses no button on a press, so a press on a button there is such a press on nothing too. A focus that leaves the toasts for nothing without a press (Tab past the page's last stop) still goes back, with its ring; a press counts only until the focus change it makes or its click, so a later focus move without keys (a screen reader's browse mode) goes back too. Once the focus left the toasts, the timer of a toast with an action goes on, also when the focus came from nothing.
- **Tests (#564):** unit tests for the focusin log of a press outside (only the pressed element), an auto-activating Radix tab before that does not activate, a press on the empty area (focus on nothing, no return, receipt open), the timer going on after such a press when the focus came from nothing, the return after a press that has ended, and an own `focus` property of the element before kept; the gallery receipt test logs the focus on the press outside and adds a round with a press on the empty area (Chromium).

**Migration:** none. No strings, `data-testid`s or baselines change.

## 0.175.0 — #562, SUI-FEATURE-109 rev 4: with `ignoreSearchParams` a same-path change passes during a running save

- **Leave guard (#562, retrofit #547):** with `ignoreSearchParams` set and the page busy (`busy`, a running save), a route change that keeps the `pathname` and changes only `search` or `hash` now passes at once, by push or by replace, also as browser back/forward to an entry of the same pathname, under `BrowserRouter`, `MemoryRouter` and data routers alike; the save goes on. Before, it was dropped under `BrowserRouter` and held until after the save under data routers. A change to another `pathname` stays held while `busy` (`SUI-FEATURE-150`), the option set or not, browser back/forward to another path included, and goes on to its target once the save succeeded (dropped with `saveFailed`, #572). A router form submission that is still running (`<Form method="post">`, not a fetcher) is not cut off: a same-path change during it waits until it ends and then goes on, as react-router would abort that submission otherwise (rev 4). Its result and a redirect arrive: when the submission redirects, to another path, to the same one with another search (`/detail?saved=1`) or to the very same URL, the waiting change is dropped and the redirect wins, also when the change came while the redirect target loaded or a 307/308 submitted it anew; a submission that does not redirect lets it go on, also in an index route (`?index`) or from a URL with a hash. Without the option nothing changes.
- **Tests (#562):** unit tests under `MemoryRouter`, `BrowserRouter`, `createMemoryRouter` and `createBrowserRouter`: during a running save a `?tab=` push, a replace and a hash change pass at once and the save completes; another pathname stays held; without the option the same-path change does not pass; browser back to the same pathname passes, back to another one stays held; under data routers a `?tab=` change during a router form submission waits for it without aborting it and goes on after; after a redirect to `/list`, to `/detail?saved=1` or to the same URL the app stays where the redirect led; without a redirect it goes on also in an index route and from a URL with a hash; the same for a click while the loaders after the action run (the redirect target's, or the revalidation without a redirect) and for 307 redirects, clicked during the action or while the target is submitted anew. Gallery (`?harness=leave-guard`, `/detail` now has a held Save): a `?tab=` switch during the running save passes and the save completes; browser back to another path stays held.

**Migration:** additive; call sites without the option behave as before. With the option set, a page busy with a save now lets its tab switches (`?tab=`) through instead of ignoring them; the condition for setting it is unchanged: only where nothing is lost when only the search parameters change (the changed state lives outside the component that unmounts, a server draft or a store, and is back after switching back), never where a search parameter selects another entry (`?id=`). The save must not depend on the current search parameters. No strings, `data-testid`s (the gallery harness only) or baselines change.

## 0.175.0 — #559, GL-UI-050 follow-up #557: the tab stop follows the focus again, re-entry lands on the selected tab

- **Tabs (#559):** a focus from outside the tab list no longer prevents its default; `Tabs` drops that one activation itself, so Radix's roving focus updates as before #557. While the focus is in the list the focused trigger is the tab stop, once it leaves the selected one is: after Cancel in the leave dialog, Tab out to the panel and Shift+Tab back lands on the selected tab, and Tab from a trigger before the selected one leaves the list (WAI-ARIA tabs). Only an activation Radix makes on that focus is held back, so a press from outside activates also with `activationMode="manual"` or a caller's `preventDefault`. A focus with no previous focus (window refocus) does not activate; a press activates, also when it moves the focus in from outside; a caller's `onFocus` that prevents the default still skips the activation. An own `tabIndex` on a `TabsTrigger` wins.
- **Tests (#559):** unit tests for the not-prevented focus, the window refocus, the caller's `preventDefault`, a press from outside (also manual and prevented), the tab stop and an uncontrolled `Tabs`; gallery (`/detail-plain`, mouse and keyboard): after Cancel, Tab and Shift+Tab land on the selected tab; Tab from a returned focus before the selected tab leaves the list.

**Migration:** none. No strings, `data-testid`s or baselines change.

## 0.175.0 — #553, GL-UI-017 rev 8: the chart series field describes the visible pie note

- **Accessibility (#553, retrofit #536):** in a pie, the name field of a series left out is described by its hint, then the visible short note ("Not in pie" / "Nicht im Kreis" / "Fuera del circular"), which is no longer `aria-hidden`; the hidden full sentence and its string `slides.editor.chartNotInPie` are gone. Each series column header and each category row header is named by its name alone (`aria-label`, an emptied one by its default name "Series n" / "Category n"), so neither its remove button nor the note becomes part of the header's name. `Hint` takes a `status` id, described after the hint and also where the hint itself is not attached (GL-UI-017 §Zustandszeile).
- **Tests (#553):** unit tests for the description (hint + visible note) in en/de/es, the header names with an emptied series and category, and `Hint`'s `status` order and attachment; the gallery checks the description and the emptied headers' names in the browser. The note renders as before (`slide-editor-chart-pie-*` unchanged); only the full-gallery baselines `gallery-{de,en,es}-{light,dark}` and `gallery-de-{light,dark}-{390,1440}` change, one strings-table row shorter for the removed string.

## 0.175.0 — #552, SUI-FEATURE-106 rev 6: a waiting paste drops the selection and shows a visible status line

- **Selection (#552, rev 6 AC 6):** when a paste starts waiting for `adoptMedia`, the editor drops the selection at once (no handles); once it lands, the pasted elements are selected. Commands pressed during the wait still act on what the paste pastes.
- **Feedback (#552, rev 6 AC 5):** after 300 ms of waiting the canvas takes `cursor: progress` (was `cursor-wait`) next to `aria-busy="true"`, and the `role="status"` message "Medien werden übernommen …" / "Importing media …" / "Importando medios …" is now a visible line with the operation spinner (`OperationIndicator`) at the visible bottom left of the work area: it does not scroll with the slide, stays off the page in the margin and draws above the handles. All of it ends with the paste, also after 10 s of silence or a failed `adoptMedia`.
- **Gallery (#552):** `?page=slide-editor&paste=wait` holds a paste on `adoptMedia` for good; new baselines `slide-editor-paste-wait-{de,en,es}-{light,dark}`.
- **Tests (#552):** unit tests for the visible status line, its place and spinner, the progress cursor and their end after a silent or failed `adoptMedia`; for the dropped handles and the pasted selection; and for a handle press behind a held Ctrl+D during the wait.

**Migration:** the string `slides.editor.adoptingMedia` changes wording in en and es. Without `adoptMedia` nothing changes (AC 7); baselines: the gallery string table `gallery-{en,es}-{light,dark}` (the new wording), six new ones; all others unchanged.

## 0.175.0 — #551, GL-UI-010/GL-UI-016: SlideEditor panes — drawer title, unique heading ids, library tile labels, dialog shot crop

- **Drawer title (#551, `GL-UI-010` §Titel & Metadaten):** the `DrawerRail` pane title (h2) is `text-base font-semibold`, no longer `text-sm font-medium` below the `text-base font-semibold` h3 sections it holds.
- **Heading ids (#551):** the SlideEditor's Animation and Grid section headings take their ids from `React.useId`, so two mounted editors no longer share `slide-editor-animation-title` / `slide-editor-grid-title`; each section stays labelled by its own heading.
- **Library tiles (#551, `GL-UI-016`):** a tile whose label the drawer cuts ("A arrow d…") keeps its full label as its name and in its hint bubble — now covered by a gallery test.
- **Gallery (#551):** the transfer-dialog shots clip the dialog's box rounded inwards, so no row of the slide canvas shows at the top edge.
- **Tests (#551):** unit tests for the drawer title type and for unique heading ids with two editors mounted; gallery test for the cut library label.

**Migration:** the removed ids `slide-editor-animation-title` and `slide-editor-grid-title` were never `data-testid`s; code that selected them must use the heading role. Baselines: `components-*` and `pressed-*` (all, the DrawerRail demo), `slide-editor-document-tab-*`, `slide-editor-library-tab-*` (drawer title) and `slide-editor-transfer-dialog-*` (crop). No API, string or `data-testid` changes.

## 0.175.0 — #550, SUI-FEATURE-101 rev 6 / GL-UI-050: a toast with an action lasts at least 8000 ms and gives the focus back

- **Duration (#550, rev 6 AC 7):** a toast with an action lasts max(8000 ms, reading time of all the live region reads, the screen-reader-only key hint included), on every route: the four variants, the plain call and `toast.message`. While the pointer or the focus is in the toaster its timer stands still; afterwards it goes on with the time left. It closes by the package's own timer (sonner gets `duration: Infinity`); `onAutoClose` still runs when that timer closes it, `onDismiss` when it is dismissed. A plain call or `toast.message` that replaces such a toast by its id without an action gets a duration again (sonner's 4000 ms or its own), so it no longer stays open for good. Without an i18next instance the hint counts no words; nothing throws. A loading toast with an action stays until it is replaced, as before.
- **Focus back (#550, `GL-UI-050`):** the focus that entered the toasts goes back to the element focused before, as long as that element still exists: after Enter on the action (Undo), when the toast holding it is dismissed or closes, and when it leaves the toasts for nothing. Entered by Alt+T, Tab past the last toast stop and Shift+Tab before the first go back too, instead of leaving for the page's ends. It comes back with its ring when it left with one. A toast the action raises (the "restored" receipt) is not closed by that return. If that element is gone, the focus stays where the browser puts it; the further fallbacks of `GL-UI-050` are not built.
- **Pointer unchanged (#550, `SUI-FEATURE-101`):** a pointer press outside the toasts, or a Tab out after entering by Tab, keeps the focus where it lands; sonner's own return to its remembered element is prevented (#564).
- **Hint (#550):** the key hint names the real key path: "Alt+T, then Tab: Undo" / "Alt+T, dann Tab: Rückgängig" / "Alt+T, luego Tab: Deshacer" (generic: "…: the action" / "die Aktion" / "la acción"). It shows for `toast.message` and `toast.loading` too, and generically for a label that is no text. Once the focus has entered the toasts it leaves the toast's text for good, so it is neither read again inside nor announced anew when the focus leaves. `toast.custom` (own element, no sonner action) and `toast.promise` stay without hint and own duration.
- **Tests (#550):** unit tests for the 8000 ms floor, the reading time with the hint, the routes, the dropped timer of a replaced toast, the duration of a toast replaced without an action, `onAutoClose` on the own timer, no i18next instance, the pause by pointer and by focus with the time left; the focus return after Enter on the action, after a dismissal, to nothing with the ring, on Tab past the last stop and Shift+Tab before the first after Alt+T, an own `tabindex` element as a stop, no catch after entering by Tab; the hint on every route and gone for good once the focus entered. Gallery AC 6: the focus on the ⋯ right after Enter on Undo, with its ring; Tab past Undo back to the ⋯ with its ring; a pointer click outside keeps the focus there; Tab beside the receipt keeps it, Shift+Tab back onto the ⋯ closes it; Shift+Tab onto the covered Edit closes it; the hint gone with the focus inside; the receipt open past 7500 ms, then closed.

**Migration:** the strings `status.actionKey` and `status.actionKeyUnnamed` change wording in de, en and es. Baselines: the gallery string table (`gallery-{de,en,es}-{light,dark}`, `gallery-de-*-{390,1440}`) shows the new wording. No API or `data-testid` changes.

## 0.174.0 — #541, GL-UI-038 rev 2: field errors appear late, retract early

- **Field errors (#541):** `Field`/`FieldError` show the error text and `aria-invalid` only after blur or submit, never on change, and remove them as soon as the value is valid.

**Migration:** tests that assert an error or `aria-invalid` while focus is still in the field must blur or submit first; remove app-owned error-timing code.

## 0.174.0 — #549, SUI-FEATURE-107 rev 4: in the Sidebar overlay, a section and the back link move the focus for every input

- **Sidebar overlay (#549):** below `md`, the section button and the back link now set the focus as for the keyboard (the active first entry of the opened section, or the entry of the section just left) whatever the input: pointer, touch and screen-reader activation (a VoiceOver double tap arrives as a click with `detail >= 1`) included. The modal overlay no longer leaves the focus on `<body>`. The ring still follows `:focus-visible`, so none shows after a pointer or touch press.
- **Unchanged (#549):** expanded and collapsed, a pointer press still sets no focus, also after a keyboard switch a leave guard blocked.
- **Tests (#549):** unit test for the pointer press in the overlay (section and back link move the focus, overlay stays open); gallery test for AC4 (overlay, pointer click on Settings and the back link: focus on the first entry and on the Settings entry, no `:focus-visible`, no ring).

**Migration:** none; no API, string, `data-testid` or baseline changes.

## 0.174.0 — #557, GL-UI-007/GL-UI-050: Cancel in the leave dialog no longer reactivates the tab trigger that asked

- **Tabs (#557):** a `TabsTrigger` activates on focus only when the focus moves within its own tab list (arrow keys, Home, End); a press activates it as before. A focus from outside the list — a dialog returning it on close (`GL-UI-050`) — leaves the selection as it is. Before, a guarded page whose tab switch asked (no `ignoreSearchParams`) looped: Cancel returned the focus to the trigger, its automatic activation switched again, and the leave dialog reopened. Now Cancel closes the dialog, the focus is on the trigger, the original tab and the draft stay. A caller's own `onFocus` still runs first; preventing its default skips the activation as before.
- **Tests (#557):** unit tests: a focus from outside the tab list does not activate, an arrow key and a press do. Gallery (`?harness=leave-guard`, `/detail-plain`): field changed, tab switch by click and by `ArrowRight`, Cancel → no dialog, focus on the trigger, still on the original tab and `?tab=`, draft kept.

**Migration:** none for pointer and keyboard use. Code that activated a tab by calling `.focus()` on its trigger from outside the list must set the value instead. No strings, `data-testid`s or baselines change.

## 0.174.0 — #548, SUI-FEATURE-103 rev 3 / GL-UI-050: the busy button's focus hold survives a window switch, a missed blur and a late `disabled`

- **Window switch (#548):** a blur with no `relatedTarget` while the document has lost the focus and the button is still its active element (a switch to another window or tab) no longer ends the hold; back in the page, the focus is still on the button.
- **Real focus at the run's end (#548):** when a run ends, the hold checks `document.activeElement`; a blur that never reached the button no longer leaves it held with `aria-disabled` instead of `disabled`.
- **Late `disabled` (#548):** the hold lasts as long as the focus stays on the button, so a `disabled` that arrives a render after `busy` ends (a call site deriving it from state the run changed) keeps the focus as well; before, a run that ended without `disabled` dropped the hold at once.
- **Fewer renders (#548):** only a button that declares `busy` and is not `asChild` tracks its focus; any other `Button` no longer re-renders on focus or blur.
- **Tests (#548):** unit tests for the window switch, a missed blur, a late `disabled`, the render count on focus/blur (plain, `asChild`, busy-capable), a `Hint` around a busy disabled button (the hold path; the `disabledText` tests go through `lockedWithReason` and never reached it) and a run that ends without `disabled`.

**Migration:** none; no API, string, `data-testid` or baseline changes.

## 0.174.0 — #547, SUI-FEATURE-109 rev 2: the leave guard can let a same-path search/hash change pass

- **Leave guard (#547):** `useLeaveGuard` takes a new option `ignoreSearchParams` (boolean, default `false`). Set, a route change that keeps the `pathname` and changes only `search` or `hash` passes the dirty page without the question, by push or by replace (a tab switch over `setSearchParams({ tab }, { replace: true })`), also as browser back/forward to an entry of the same pathname; under `BrowserRouter`, `MemoryRouter` and data routers alike. Any other `pathname` asks as before, the option set or not, browser back/forward to another path included; `navigate(-n)` from the app counts as another path. A change to the very same URL passes too (a tab control that reports its value on press and again on focus repeats it); a form submission to the page's own route still asks (data routers), as its action may redirect away. While the page works (`busy`, a running Save) nothing passes, as before. Without the option nothing changes.
- **Tests (#547):** unit tests under `MemoryRouter`, `BrowserRouter`, `createMemoryRouter` and `createBrowserRouter`: same pathname with another `search` or `hash` passes with the option, push and replace; another pathname is held, push and replace; without the option the same-path changes are held; the same URL passes with the option; a foreign POST to the page's own route whose action redirects asks with and without the option; browser back/forward to the same pathname passes with the option, back to another one asks; without the option browser back to the same pathname asks, Cancel keeps the address, Discard goes back. Gallery (`?harness=leave-guard`, new routes `/detail` with the option and `/detail-plain` without): a `?tab=` switch passes with URL and tab state together; a link, the guarded Back and browser back to another path ask; without the option the `?tab=` switch asks.

**Migration:** additive; existing call sites behave as before. Set `ignoreSearchParams` only where nothing is lost when only the search parameters change: the changed state lives outside the component that unmounts (a server draft, a store) and is back after switching back, as with tabs over `?tab=`. Never set it where a search parameter selects another entry (`?id=`), where the changed state would be gone. Under a data router a search-only change still re-runs the route's loaders, and a loader that redirects then leaves the page without the question. No strings, `data-testid`s (the gallery harness only) or baselines change.

## 0.174.0 — #544, GL-UI-016: a tall bubble beside a narrow input reaches over the next field's label box; the row is looked up once per open

- **Label text, not its box (#544):** where a field's neighbours are obstacles (an `apart` neighbour on its line), a label below the field's line counts by its text, no longer by its full-width box: a multi-line bubble beside a narrow input stays at the field over the empty part of the next stacked field's label box, instead of standing past it. A partner's label on the field's own line still counts whole: the bubble stands past it (#543).
- **One lookup per open (#544):** the bubble looks up its element's row once when it opens, no longer on every render while it stays open; finding a field's row climbs its ancestors and reads their layout.
- **#542 entry:** its distances are now all the gap between the field and its neighbour (460 px, 420 px, 960 px, 24 px); its "far card" test renders a real `Card` > `CardContent`.
- **Tests (#544):** a two-line bubble beside a narrow input, a sidebar field on its line, stays at the field (148px) over the next field's 600 px label box with a 20 px text; a partner's 600 px label box on the field's line stands it past that box (772px); renders of a field pair while its bubble is open read no field's layout.

**Migration:** none; no API, string, `data-testid` or baseline changes.

## 0.174.0 — #539, GL-UI-017 rev 7/9: a radio group's value hint describes the group

- **SettingsField group (#539):** `valueHint` is accepted again together with `group`. It says what the options do and describes the group (`aria-describedby`) after the label's hint and before the help text, each read once; the options carry none of it, each radio keeps its own text as its hint.
- **Field (#539):** a `valueHint` on a field whose `control` is an option group (`role="group"` or `"radiogroup"`) is no longer dropped: it stands in a hidden element under the id `${htmlFor}-value-hint`, which the group's `aria-describedby` references right after the label's hint (`${htmlFor}-help`), or first without one; an empty `valueHint` adds nothing. This covers `SettingsField`, `GridFields` and every other `Field` caller. A group has no field surface, so its label is the visible hover carrier (`GL-UI-017` rev 9 §Gruppen): it shows the label's hint followed by the value hint, after `--tooltip-hint-delay`; its hidden `${htmlFor}-help` keeps the label's hint alone (none without one), so the group still reads each hint once. `LabelWithHelp` takes an optional `description` for that (`null`: no hidden description).
- **Tests (#539):** unit tests for the group description order (hint, value hint, help), a value hint without a hint, no repeat, a `radiogroup` control, an empty value hint, the group label's hover showing the value hint, no option described by the group's hints, and a radio's own hint; the #507 type test is removed.

**Migration:** reverses #507 — `SettingsFieldProps` accepts `valueHint` with `group` again (no longer a type error); a group's `valueHint` now reaches screen readers as the group's description. No strings, `data-testid`s or baselines change.

## 0.174.0 — #538, SUI-FEATURE-230 rev 5: a bordered image lies in the frame less its border, cropped evenly

- **SlideView (#538):** an image with a border of width b lies in the area inside the border, (w − 2b) × (h − 2b); its crop (zoom, offset) refers to that area, so opposite sides are cut evenly. Before, the image was laid out at w × h from the inner top-left corner, so 2b px of it were cut off on the right and at the bottom and none on the left and top.
- **SlideEditor crop mode (#538):** the dimmed rest, the press target and the zoom/offset clamp (wheel, keys, drag, slider, % field, offset fields and their named reach) follow the same area. The #493 editor-only workaround — the rest shifted by b, its reach inset and the extra clip layer `slide-editor-crop-reach` — is removed. A crop stored past the new reach opens in crop mode clamped, as the view draws it (rest, fields and drag start agree); left untouched, it stays in the document as stored and makes no change. New export `cropArea(element)` in the editor ops gives the area (`clampCrop`, `zoomCrop` and `panCrop` take its width and height).
- **Tests (#538):** unit tests for the view (unzoomed: nothing hidden on any side; 150 %: equal on opposite sides; a stored offset past the reach drawn at the limit), `cropArea` with `clampCrop`, and the editor's rest at 100 % and 200 %; a gallery test measuring the drawn image's edges against the inner area in the view and in crop mode, unzoomed and at 150 % (rev 5 AC6). The #493 pixel test keeps the border whole at 100 % and at the zoomed right/bottom limit; its offset limit at 150 % is now −57.5 (was −62.5).

**Migration:** a bordered image now shows (w − 2b) × (h − 2b) of its picture scaled to fit, instead of w × h cut off on the right and bottom; the offset range of a bordered image shrinks accordingly; a stored offset past the new range is drawn at its limit (the view clamps the crop to the area), never with a gap. Removed `data-testid` `slide-editor-crop-reach`. Baselines: 10 changed, only by the showcase's bordered photo — `slides-{de,en,es}-{light,dark}.png`, `slides-de-{light,dark}-{390,1440}.png`.

## 0.174.0 — #536, SUI-FEATURE-233: the chart data panel in a pie fits the PropertyPanel; a short note for the series not drawn

- **Chart data panel, pie (#536):** the series a pie leaves out show the short note "Not in pie" / "Nicht im Kreis" / "Fuera del circular" (new string `slides.editor.chartNotInPieShort`), at most two lines in the 80 px series column. The whole sentence (`slides.editor.chartNotInPie`, unchanged) is the series name field's accessible description beside its hint; the visible note is `aria-hidden`. Before, the note wrapped to 3 lines (en, de) or 4 (es) and "Kreisdiagramm" widened the column.
- **Chart data table width (#536):** the category name fields are at least 100 px wide from `md` (was 112 px; below `md`, at the 16 px text, still 112 px), so the table with two series fits the 307 px panel body without scrolling sideways in en, de and es (was 316 px, de in a pie 335 px). With more series it still scrolls (`SUI-FEATURE-233`).
- **Tests (#536):** a unit test for the short note and the full description in en, de, es; a gallery test for the note at most two lines and no sideways scroll, with a shot of the chart panel in a pie.

**Migration:** none for the API. Strings: new `slides.editor.chartNotInPieShort` (de, en, es); `slides.editor.chartNotInPie` is now the series name field's description, no longer visible. Baselines: 6 new — `slide-editor-chart-pie-{de,en,es}-{light,dark}.png`; 10 changed, only by the new `slides.editor.chartNotInPieShort` row in the gallery's string table — `gallery-{de,en,es}-{light,dark}.png`, `gallery-de-{light,dark}-{390,1440}.png` (30 px taller at 1920 and 1440, 93 px at 390).

## 0.174.0 — #535, SUI-FEATURE-106 rev 5: commands wait behind a paste awaiting `adoptMedia`, at most 10 s, with busy feedback

- **Paste queue (#535):** every command pressed while a paste waits for `adoptMedia` — copy, cut, paste, duplicate, Delete/Backspace, Arrow/Shift+Arrow, Undo/Redo, by key, from the canvas menu or the toolbar — now waits behind it and runs afterwards in the order pressed, inside and outside a drag. The end of a drag no longer releases the queue (the #533 rule is removed); gestures (drag, frame selection) never wait. A second paste while one waits is queued instead of ignored. Each held command acts on what was meant when it was pressed: the selection then, or, with no selection made by hand since (every press on the canvas counts — an element, the same one again, a resize, rotate or column handle, a right click on an element), what the command before it leaves selected — after a paste, its pasted elements. The canvas menu's Cut, Copy and Duplicate are enabled when they would act on such pasted elements, nothing selected yet, as the keys are. An element no longer there drops out. Commands held by a drag alone (#527, #530) follow the same rule.
- **10 s limit (#535):** a paste whose `adoptMedia` gives no answer within 10 s counts as failed: it is inserted with the missing-media placeholder and the hint naming the medium, as one history step, and the queue moves on; a later answer is discarded.
- **Busy feedback (#535):** after 300 ms of waiting the canvas carries `aria-busy="true"` and the wait cursor, and a screen-reader status (`data-testid="slide-editor-adopting"`) says the media are being brought along; both end when the paste lands. Undo is enabled while a paste waits, so it can be pressed to take the paste back once it lands.
- **Tests (#535):** AC3 (10 s silence → placeholder, hint, one step, queue free, late answer dropped), AC4 (drag `a`, Ctrl+V, Delete, release, drag `b`, answer → the paste lands and is deleted, `b` stays), AC5 (`aria-busy`, wait cursor and status after 300 ms, gone after the paste), Delete after a resize-handle press and menu Cut/Copy/Duplicate after a right click on an element acting on that element, menu Cut enabled for and acting on a waiting paste with nothing selected, commands pressed outside a drag in order on their meant targets, a second paste queued (also during a drag); the #533 regression tests adapted to the new rule (the later drag's keys wait for the paste and act on what was selected when pressed).

**Migration:** none for the API. New string `slides.editor.adoptingMedia` (de "Medien werden übernommen …", en "Bringing the media along …", es "Trayendo los medios …"); new `data-testid` `slide-editor-adopting`. Without `adoptMedia` nothing changes. Baselines: 10 changed, only by the new `slides.editor.adoptingMedia` row in the gallery's string table — `gallery-{de,en,es}-{light,dark}.png`, `gallery-de-{light,dark}-{390,1440}.png`; each grows by that one row (30 px at 1920 and 1440, 72 px at 390), every other row pixel-identical to the previous baseline.

## 0.174.0 — #537, SUI-FEATURE-108 rev 3: TagInput passes ref, id, ARIA attributes and native handlers to its text field

- **TagInput (#537):** `ref` (`React.forwardRef`), `id`, `name`, every `aria-*` and `data-*` attribute and the native handlers (`onFocus`, `onBlur`, `onKeyDown`, `onKeyUp`, `onPaste` …) reach the inner text field, as on `Input`. Inside a `Hint` the field now carries the hint as its description, and `ref.current.focus()` focuses it. The own handlers run first, the passed ones after, so Enter/comma still add and Backspace still removes the last chip. A passed `aria-describedby` is kept with the `Hint`'s id, each id once. `className` and `testId` still style and name the frame; a passed `data-testid` names the text field. A passed `aria-invalid` marks the text field and reddens the frame, as an invalid surrounding field does. The pointer handlers (`onPointerMove`, `onPointerLeave`, `onPointerDown`, `onPointerDownCapture`, `onClick`) and a `Hint`'s trigger ref (`triggerRef`, `TagInput.hintTriggerRef`, as on `Slider`) sit on the frame, so a `Hint` opens over the chips too; `ref` stays the text field's. `defaultValue` and `defaultChecked` are not accepted.
- **Tests (#537):** unit tests for the `Hint` description, `ref` focus, `id`/`name`/`aria-*`/`data-*` on the field, a passed `aria-describedby` joined with the hint's, passed `onFocus`/`onBlur`/`onKeyDown` called with Enter still adding, a passed `onKeyDown` calling `preventDefault()` that stops neither Enter nor Backspace, a passed `aria-invalid` on field and frame, a `Hint` opened by a hover over a chip, and `onKeyUp`/`onPaste`.

**Migration:** none; additive — without the new props nothing changes. A `Hint` around a `TagInput` now works: before, its ref, handlers and description were dropped and the bubble had no anchor; now the frame anchors and opens it and the text field carries the description. No string, `data-testid` or baseline changes.

## 0.174.0 — #532, GL-UI-010: the grid of the SlideEditor document tab is its own section

- **SlideEditor document tab (#532):** the grid fields stand in their own section under a visible `h3` "Grid" (`text-base font-semibold`, the existing `grid.label` text), 8 px above the first field, 16 px below the pages. Before, they followed the pages list at the field spacing, named only by an `aria-label`, and read as part of Pages.
- **GridFields `labelledBy` (#532):** a new optional prop, the id of a visible heading that names the group (`aria-labelledby`); without it the group keeps its own `aria-label`, as before.
- **Tests (#532):** unit tests for the section heading naming the grid group in the document tab and for `labelledBy`; a gallery test for the heading's 16 px semibold, 8 px to the first field and 16 px to the pages; gallery shots of the open document and library tabs and of the transfer dialog.

**Migration:** none for the API (one new optional prop); no string or `data-testid` changes beyond the new `slide-editor-grid` on the section. Baselines: 18 new, none changed — `slide-editor-document-tab-{de,en,es}-{light,dark}.png`, `slide-editor-library-tab-{de,en,es}-{light,dark}.png`, `slide-editor-transfer-dialog-{de,en,es}-{light,dark}.png`.

## 0.174.0 — #524, SUI-FEATURE-101 rev 5: a toast that appears over the keyboard focus closes after 1000 ms unless it has an action

- **Toaster (#524):** a toast that appears while the keyboard focus (`:focus-visible`) rests on an element it covers, ring included (typically the receipt after a confirm dialog hands the focus back to its trigger), stays 1000 ms, so the live region announces it and it is briefly seen, then `<Toaster>` closes all toasts as it does when focus lands under one. `Esc` closes them earlier and leaves the focus where it is. A toast away from the focus keeps its normal duration, and `Esc` then closes nothing. While a toast with an action (such as Undo) shows, none closes after 1000 ms: it keeps its normal duration so its action stays reachable, and the next keyboard focus move onto an element it covers, or `Esc`, closes it. An `Esc` an open layer (menu, popover, sheet) already handled closes only that layer. One timer serves all toasts, so an earlier toast's timer never cuts a later one short.
- **`toast` (#524):** a toast with an action names it and its key route in the live region ("Undo with Alt+T"; new string `status.actionKey` in de, en, es). Alt+T is sonner's hotkey that focuses the toasts.
- **Tests (#524):** unit tests cover a toast appearing over the focus (open at 700 ms, closed by 1000 ms, focus kept), `Esc` before that, a toast away from the focus that keeps its duration also on `Esc`, a second toast that gets its own 1000 ms, an `Esc` taken by an open popover, and a toast with an action (kept past 1000 ms, its key route in the live region, closed on the next keyboard move under it and on `Esc`). On the preview page (`?receipt=1`, the row full width under the toast column, its last entry Delete) a gallery test runs ⋯ → Delete → confirm by keyboard and checks the receipt without an action over the ⋯, in the live region, closed after 1000 ms and, in a second round, on `Esc`, the focus on the ⋯ both times; a second one runs ⋯ → Archive → confirm and checks the receipt with Undo open past 1000 ms, naming Undo and Alt+T, Alt+T then Enter on Undo restoring the entry, and a Tab onto a covered element or `Esc` closing it at once.

**Migration:** none. Apps build nothing of their own for it (`GL-UI-004`).

## 0.174.0 — #529, SUI-FEATURE-107 rev 3: keyboard focus after a sidebar section switch; no browser outline on the calendar button

- **AppSidebar section switch (#529):** a section (Tools, Administration, Settings, or one in `primary`) opened by keyboard (`Enter`/`Space`) puts the focus on its active first entry (`aria-current="page"`); the next `Tab` goes to the second entry. The back link opened by keyboard puts the focus on the entry of the section just left in the primary nav (`GL-UI-050`). Before, the pressed control left the DOM and the focus fell to `<body>`. Expanded, collapsed and in the overlay alike; a pointer press moves no focus.
- **Overlay below `md` (#529):** a section press and the back link are list switches inside the open overlay: it stays open across their navigation (keyboard and pointer). It still closes on an entry link, the instance name, `Esc`, the scrim and any other route change. Before, both closed it.
- **Input date and time types (#529):** the browser's calendar or clock button of `date`, `time`, `datetime-local`, `month` and `week` draws no outline of its own when it holds the keyboard focus; the field's token ring (`:focus-within`, 3:1, forced-colors outline) stands for it. Before, Chromium drew its own focus box around the button inside the ring.
- **Tests (#529):** unit tests for the focus after a keyboard section switch and back (expanded, collapsed), none after a pointer press, the overlay kept open across both switches and closed by an entry link, and the calendar-button class; gallery tests for the focus and the next `Tab` in all three modes, and that the calendar button's corner of each picker field looks the same as while a segment holds the focus (fails without the fix).

**Migration:** none; no API, string or `data-testid` changes, no baseline changes.

## 0.174.0 — #528, SUI-FEATURE-103 rev 3: a run's end keeps the focus on a disabled button

- **Button `busy` with `disabled` (#528):** when the run ends while the button holds the focus, the call site's `disabled` no longer drops the focus to `<body>` (`GL-UI-050`): the button keeps the `aria-disabled="true"` lock — no `disabled` attribute, the focus stays, click, `Enter`, `Space`, a press and the form's submit fire nothing — and wears the locked look, the same half-tone as the disabled one. Once the focus leaves (Tab away), the real `disabled` attribute applies. Without the focus on the button, `disabled` applies as soon as the run ends, as before. Before, `disabled` applied the moment the run ended and the focus fell to `<body>`.
- **Disabled-reason hint after the run (#528):** a `Hint` or `IconButtonTooltip` with `disabledText` around a `disabled` button shows its reason again once the run has ended, the focus still on the button.
- **Tests (#528):** unit tests for the focus held after the run (no `disabled`, `aria-disabled="true"`, focus kept, nothing fires, `disabled` after Tab away; fails on the rev-2 code), for `disabled` at once without the focus and after a focus that left during the run, for the held look, and for the reason of `Hint` and `IconButtonTooltip` after the run.

**Migration:** none for the API; no string, `data-testid` or baseline changes. A test that expects `toBeDisabled()` right after a run ends on a focused `disabled` button moves the focus away first.

## 0.174.0 — #521, SUI-FEATURE-104 rev 3: the read-only text folds to an eye at narrow width

- **EditorHeader `readOnly` (#521):** the read-only text stands in the state's place and now folds with it as `SUI-FEATURE-090` step 4: once Preview (with the header tools) is folded and the header still overflows, "Nur lesen"/"Read only"/"Solo lectura" becomes lucide `EyeIcon` (16 px, muted foreground) in a focusable `role="status"` sign, the full text as tooltip and screen-reader text — before Back folds to its arrow and before the title drops below its 18-character floor. It is never truncated and never moves into the ⋯ menu. Before, the text stayed full width and Back and the title folded first.
- **Tests (#521):** unit tests (en, de) for the eye with tooltip text and status at a width where Back and the title's 18-character floor still stand, and for the text with room; a gallery test at 1440 px (text) and 390 px (eye, tooltip "Nur lesen", not in the ⋯), and that from 390 to 900 px Back or the title never fold while the text still stands.

**Migration:** none; no API, string or `data-testid` changes (the sign keeps `data-testid="editor-read-only"`, compact with `data-compact`). Baselines: `editor-bar-de-light-390.png` and `editor-bar-de-dark-390.png` change — the read-only header shows the eye in place of "Nur lesen"; every other baseline (1440 and 1920 px included) is unchanged.

## 0.174.0 — #515, GL-UI-010 rev 8: one shared sub-group title one step below the section title

- **New export `SubgroupTitle` (#515):** `@suite/ui/ui/subgroup-title` (and the `ui` barrel) exports `SubgroupTitle`, the title of a sub-group inside a section: `text-sm font-semibold` (14 px), one step below the section title's `text-base font-semibold` (16 px). An `h4` by default; `asChild` gives the style to another element, such as a `legend`. Apps use it instead of styling sub-group titles at the call site.
- **SlideEditor (#515):** the "Entrance" and "Exit" titles under "Animation" in the property panel are `SubgroupTitle`s (their `legend` kept); the "Animation" heading above stays.
- **SettingsBlock (#515):** the block name is a `SubgroupTitle` on its `h3` (`asChild`) instead of its own `text-sm font-semibold`; no visual change.
- **Tests (#515):** a unit test for `SubgroupTitle` (h4, `asChild` on a legend); the gallery checks the Animation section title at 16 px and its Entrance/Exit titles at 14 px, all semibold.

**Migration:** none; the sub-group titles looked the same before, so no baseline changes. No string or `data-testid` changes; the legends gain `data-slot="subgroup-title"`.

## 0.174.0 — #542, GL-UI-016: a field's bubble covers no neighbouring control beside a column of fields (#543 delivered here)

- **Neighbours as obstacles (#542):** the fields and loose controls of a column on a lone `Field`'s line no longer join its group nor bound its side: they are obstacles, as another bar's controls are, and the bubble stands in the nearest gap that holds it. Beside the field where the gap before them does (a column 460 px from the field), past them where it does not (24 px). Before, a column's field on the line pulled the bubble across any distance, and a column's button there left no side, so it stood at the field, over the column.
- **Direct field pairs (#543):** a partner field on a `Field`'s line is an obstacle by the same rule, no longer a member of its group: a far partner (420 px from the field) leaves the bubble at the field, in the gap before it; a close partner (10 px, 24 px) stands it past the partner, as before. Before, any partner on the line pulled the bubble past it across any distance.
- **Column's field and button (#542):** the field of a column or card, none of whose neighbouring fields stands on its line, and a control among fields (the column's button) now have a row at the nearest ancestor holding a control on their line, however deep the column is wrapped (an extra div, `Card` > `CardContent`): those controls are obstacles. A column's field or button 24 px left of a lone field stands its bubble past the lone field instead of over it; a stacked form's field beside a far sidebar field, or beside a card 460 px from it, keeps its bubble at the field.
- **Tests (#542, #543):** with a 320 px bubble: a far column field, a far column button, a far card and a far pair partner leave the bubble at the field (148px); a stacked form beside a sidebar field 960 px from it keeps it at the field; a column's button, a wrapped column's field and a card's field 24 px left of a lone field stand it past the lone field (312px); a close pair partner stands it past the partner (312px); the 24 px cases past a lone field, a column's field and button (312px, 408px), and past a tall column's button (298px, formerly "is in no row") hold.

**Migration:** none for the API; no `data-testid`, string or baseline changes (the gallery's field-pair baselines did not move). Bar and marked-group placements are unchanged; a lone field beside a column of fields, or beside a far partner field, stands its bubble in the gap before it where it fits, instead of past it.

## 0.174.0 — #516, GL-UI-037 rev 2: the grid's number fields use the shared decimal parser

- **Grid number fields (#516):** `GridFields` read its step, column count, gutter, margin and row step with `Number` in native `type="number"` inputs, so a German or Spanish "8,0" was not a number and a grouped "1.000,5" got the field's bound as its error. They now read what is typed through `parseDecimal` and show the value through `formatDecimal`: in de/es a point and a comma are both the decimal sign, in en only the point; one separator is always the decimal sign ("1.000" is 1); more than one is refused with the new `grid.separator` (de/en/es), which names the right form with a whole-number example inside the field's bounds ("such as 1000", "such as 24" for the column count), since the fields take whole numbers only. A fraction still asks for whole pixels, a number outside the bounds still names them. A number typed on its way ("8,") stays as typed until the field is left.
- **Numpad key in the grid (#516):** the numpad's decimal key types the UI language's decimal sign in the grid fields, as in every other package number field.
- **Grid input semantics (#516):** the inputs are text inputs with `role="spinbutton"`, `inputMode="numeric"` (whole numbers, as before) and `aria-valuenow`/`aria-valuemin`/`aria-valuemax` in place of the native `min`/`max`; the arrow keys step to the next whole number within the bounds ("2,6" Up is 3, "2,4" Down is 2), and an empty field steps to its minimum.
- **Shorter separator errors (#516, #451 ui review):** `slides.editor.numberSeparator` took six lines in the slide editor's narrow X/Y column in German and Spanish. It now says what to do, as the English one: "Tippe etwa 1000,5, ohne Tausendertrennung." (de) and "Escribe p. ej. 1000,5, sin separador de miles." (es), each at most four lines and no more than the English one.
- **Tests (#516):** unit tests for the GL-UI-037 cases on the grid fields in de/en/es (both signs, one separator as decimal, two refused with the right form, the numpad key, a number on its way, the arrow keys from a fraction and from an empty field, the separator example in the column count's bounds); a new gallery spec (`gallery/number-entry.spec.ts`) covers the numpad key and the separator error on the grid gutter in a real browser in de/en/es, and the German and Spanish errors' line count in the X column.

**Migration:** none for the API. `GridFields`' inputs are no longer `type="number"`: a test that reads them by `toHaveValue(<number>)` or by the `min`/`max` attributes reads the text value and `aria-valuemin`/`aria-valuemax` instead; their role (`spinbutton`) and `data-testid`s stay. Strings: `grid.separator` is new (de/en/es) and takes an `{{example}}` value; `slides.editor.numberSeparator` (de, es) changes text. Baselines: the gallery's full-page shots change with the new `grid.separator` row and the shorter `numberSeparator` texts in their strings table: `gallery-{de,en,es}-{light,dark}.png` and `gallery-de-{light,dark}-{390,1440}.png`; the grid page's pixels stay.

## 0.174.0 — #511, GL-UI-016/GL-UI-017: Hint and RadioGroup follow-ups from the #438 reviews

- **Transfer formats (#511):** the `SlideEditor` transfer dialog's format options carry `data-tooltip-row` like its scope options, so an option's bubble stands beside the labels it would reach and covers no other format's label.
- **RadioGroup Home/End (#511):** in the package `RadioGroup`, Home/End and PageUp/PageDown, which radix lets move the focus to the first or last option, now check that option as the arrow keys do, so focus and checked option never part.
- **Narrowed bubble beside a group (#511):** when a bubble beside a group narrows and grows taller (#445), the group's extent is taken again at that height, so it stands past a lower control of its group it now reaches instead of over it.
- **Field pairs (#511):** a lone `Field` beside a column or card holding several fields is no longer grouped with the whole page layout when one of those fields stands at its height: such a neighbour is a layout of its own, never a field's wrapper, and the climb ends there. The lone field's group is itself with the layout's fields at its height, so its bubble stands past them; the layout's other controls only bound the gaps.
- **Strings (#511):** the Spanish entrance-effect value hint is shortened from 120 to 113 characters ("lo muestra ya" for "lo muestra al inicio", as de/en "at once").
- **Gallery (#511):** the LabelWithHelp demo builds its `aria-describedby` with `helpIdFor`; `?page=slide-editor&formats=three` offers a square format besides, its label longer than the portrait one's.
- **Tests (#511):** Home/End/PageUp/PageDown check the option; a narrowed bubble's extent is retaken at its height; a lone field 24 px beside a column of fields stands its 320 px bubble past the column's field at its height; the help-id scan covers `gallery/`. The gallery checks that a transfer format's bubble covers no other format's label, and pins that a wrapped page action's bubble on line 2 stands past line 1 and covers no action of either line.

**Migration:** none for the API; no `data-testid` changes. One `es` string changes (`slides.editor.animationEntranceValueHint`), so 2 gallery baselines change, `gallery-es-{light,dark}.png` (the string list, regenerated on top of #514).

## 0.174.0 — #514, follow-ups of #446: element library app grid, error advice, one shape order

- **App entries grid (#514):** the app's entries in the element library (`slide-editor-library-app`) were one tab stop each. They now use the same roving grid as the shapes and the icons: one tab stop, the arrows move inside the two columns, Home and End go to the first and last, an arrow past the edge does nothing. The grid is a `group` named by its heading.
- **Shapes grid order (#514):** the shapes grid's arrow keys walked a separate key list (`SHAPE_GRID`) beside the rendered buttons. Both now come from one list of entries, so an added or reordered entry cannot put an arrow key on the wrong button.
- **Placeholder fill error (#514):** `slides.editor.placeholderFillFailed` (de/en/es) now names a next step: insert a text field from Add instead.
- **Paste error (#514):** a paste or duplicate the document refuses for a reason other than the element limit showed `slides.editor.insertFailed` with its "Choose another one" advice. It now shows the new `slides.editor.pasteFailed` (de/en/es) without that advice.
- **`insertFits` (#514):** the editor's internal insert check takes its two message keys as an options object (`{ refused, failed }`) instead of positional arguments.
- **Tests (#514):** the app grid is one tab stop the arrows and Home move through, stopping at the edge; the shapes grid's arrows reach every rendered button in order, Home and End the first and last; a refused paste names `pasteFailed` without "Choose another"; the placeholder fill names its next step.

**Migration:** none for the API. Strings: `slides.editor.placeholderFillFailed` changes text, `slides.editor.pasteFailed` is new. The app entries are no longer separate tab stops; their `data-testid`s stay. Baselines: the gallery's full-page shots (de/en/es, light/dark, and de at 390 and 1440 px) grow by the new `pasteFailed` row and the longer `placeholderFillFailed` text in its strings table.

## 0.174.0 — #508, GL-UI-017: a SettingsField group is described by its help text

- **SettingsField group help (#508):** the `help` text under a `SettingsField` with `group` (`${htmlFor}-description`) was not on the group's `aria-describedby`, so a screen reader in focus mode skipped it: Tab lands on an option, and the caller cannot reach the group element. The group's `aria-describedby` now lists the hint id (`${htmlFor}-help`, if a `hint` is set) first and `${htmlFor}-description` second, each read once; the options still carry neither. With `error` the error replaces the help text and stays on `aria-errormessage` only. Without `group` nothing changes.
- **Tests (#508):** a group with `help`, with and without `hint`, is described by hint and help text in that order; with `error` the help id leaves `aria-describedby`.

**Migration:** none; no API, strings, `data-testid`s or baselines change. A group with `help` now announces the help text as its description.

## 0.174.0 — #507, GL-UI-017: a SettingsField group takes no valueHint

- **SettingsField group (#507):** a `valueHint` on a `SettingsField` with `group` reached nobody, because the options of a group take no field hint. `SettingsFieldProps` now rejects `valueHint` together with `group` at type level, so the text can no longer be written and lost. Without `group` nothing changes.
- **Tests (#507):** a type test fails the typecheck if `group` and `valueHint` are accepted together again.

**Migration:** a caller passing `valueHint` to a `SettingsField` with `group` no longer compiles; drop the `valueHint` and put the text on the options. No strings, `data-testid`s or baselines change.

## 0.174.0 — #502, SUI-FEATURE-230: leaving the crop fields clears the % field's step mark

- **Crop zoom step mark (#502):** an arrow key in the crop zoom % field marks the change it makes as a step, and its keyup cleared the mark. A keyup that never reached the crop fields (focus moved away while the key was held) left the mark set, so a later paste into the field counted as a step and zoomed from the crop as it was instead of from the crop its typing started with. Leaving the crop fields now clears the mark.
- **Tests (#502):** ArrowDown on the % field without its keyup, focus leaves, then a paste of 100 and 200 counts as typing: the zoom is 200 % with the shift kept, scaled.

**Migration:** none; no API, `data-testid`, strings or baselines change.

## 0.174.0 — #493, SUI-FEATURE-230: no unreachable crop rest beside a bordered image

- **Crop rest of a bordered image (#493):** the view draws a bordered image shifted by its border, so the image's last two border widths on the right and at the bottom never show at any crop. In crop mode the `SlideEditor` left them in the dimmed rest, a strip one border wide past the frame's right and bottom edge at 100 % that no drag, slider, field or key could bring in. The dimmed rest and the area where a press shifts the image now leave them out: at 100 % a bordered image shows no rest, zoomed its rest is the same on all four sides. The cut-out of the frame stays whole, so the border stays in view on all four sides. A press on the old strip applies the crop as any press beside the image does. The view itself is left as it is, because the ticket's scope keeps the crop result and bordered images outside crop mode unchanged.
- **Tests (#493):** a bordered image at 100 % shows no rest and a press on the old strip applies the crop; at 200 % its rest is even on all four sides. The gallery reads the right and bottom border at 100 % and at 150 % with the image shifted to its right and bottom end: still the border colour.

**Migration:** none for the API; no strings change and no baselines change. The dimmed rest gains an inner layer, `data-testid="slide-editor-crop-reach"`, which clips it to the part a crop can bring in.

## 0.174.0 — #490, SUI-FEATURE-270 rev 3: TagInput takes the field error state

- **TagInput error state (#490):** inside `SettingsField error`, `TagInput` now takes the field error through `useFieldErrorAttributes`, as `Input` does: its text field carries `aria-invalid="true"` and `aria-errormessage` on the `FieldError`, and the outer frame, which also carries the focus, takes the red border (`border-destructive`, marked `data-invalid`). Invalid with and without focus, it matches an invalid `Input` (border and ring). Without an error nothing changes.
- **Tests (#490):** `SettingsField error` with `TagInput` marks the text field and the frame and unmarks both once the error is gone; the gallery compares an invalid `TagInput` with an invalid `Input`, with and without focus.

**Migration:** none for the API; no `data-testid` or strings change. The gallery's FieldError demo gains an invalid `TagInput`, so 10 gallery baselines change, `components-{de,en,es}-{light,dark}.png` and `components-de-{light,dark}-{390,1440}.png`; the FieldError demo checks now count 7 fields instead of 6.

## 0.174.0 — #534, GL-UI-010 rev 9: chart panel hints, errors and the crop hint at body size

- **Running-text size (#534):** the chart panel's hint sentences, its row errors and its negative-values-in-pie hint, and the crop toolbar's gesture hint now use the body size `text-sm` instead of `text-xs` (muted and destructive colours unchanged). The placeholder label chip on the canvas stays `text-xs`. Label to field and field to help or error text stay 8 px.
- **Tests (#534):** the gallery checks that the crop hint, the chart row error and both pie hints render at 14 px.

**Migration:** none for the API; no `data-testid` or strings change. No gallery baselines change. The gallery check on the chart row error (#368) now allows at most two lines at the body line height (`< 3 * 20` instead of `< 2 * 20`).

## 0.174.0 — #533, SUI-FEATURE-191 rev 8: commands held behind a paste that waits for the app

- **Held paste order (#533):** a `Ctrl+V` pressed during a drag whose media the app still adopts (`adoptMedia`) now holds the commands pressed after it in the same drag until it has landed, inserted and selected. Before, the queue moved on at once, so a `Delete` pressed after the paste removed the dragged element and the pasted image stayed. A paste the app answers during a later drag lands first when that drag ends, ahead of what was held behind it. The hold covers only the paste's own drag: a later drag ends it, so its commands still land when the app never answers, and a late answer lands as a plain paste. Each command stays its own history step; a second paste while one waits is still ignored (#525).
- **Tests (#533):** `Ctrl+V` then `Delete` during a drag with `adoptMedia` answering after the release (the paste is deleted, Undo brings it back); the same with the answer arriving during a second drag; `Delete`, and Arrow then `Delete`, during a later drag while `adoptMedia` never answers, none of them left held.

**Migration:** none.

## 0.174.0 — #531, GL-UI-010 rev 8: SlideEditor pane body text and Animation subgroup legends

- **Pane typography (#531):** the Library hint and result count and the Pages pane's inline hint now use the body size `text-sm` instead of `text-xs` (still muted). The Entrance/Exit legends of the Animation section are subgroup titles at `text-sm font-semibold`; the "Animation" section heading stays `text-base font-semibold`. Heading or legend to first content stays 8 px.

**Migration:** none for the API; no `data-testid` or strings change. 6 gallery baselines change, `slide-editor-menu-{de,en,es}-{light,dark}.png`; a test that compares the exact class string of these elements updates it.

## 0.173.1 — #488, GL-UI-010 rev 8: SlideEditor pane headings and section gaps

- **Pane headings (#488):** the section headings of the Pages and Library panes and the legends of the transfer dialog now use `text-base font-semibold`, like the PropertyPanel (#425). The document tab puts `gap-4` between its top-level sections instead of `gap-6`. Heading to first content stays 8 px.

**Migration:** none for the API; no `data-testid`, strings or baselines change. A test that compares the exact class string of these headings or of the document tab wrapper updates it.

## 0.173.1 — #530, SUI-FEATURE-191 rev 8: arrow keys pressed during a drag are no longer undone

- **Arrow keys during a drag (#530):** Arrow and Shift+Arrow pressed while an element is being dragged, resized or rotated now join the #527 order and move the selection once the drag ends, kept or cancelled with Esc, each as its own history step on the document the drag left. Before, the release put back the drag's preview, drawn from the document before the move, and the move vanished. During a frame selection the arrows still move the selection shown at once.
- **Tests (#530):** arrows during a kept drag (two steps Undo takes back one by one), `Ctrl+D` then Shift+Arrow during an Esc-cancelled drag (the copy moves, the original stays), arrows during a frame selection.

**Migration:** none.

## 0.173.1 — #527, SUI-FEATURE-191 rev 6: clipboard keys and Delete pressed during a drag are no longer lost

- **Clipboard keys and Delete during a drag (#527):** `Cmd/Ctrl+C`, `X`, `V`, `D` and `Delete`/`Backspace` pressed while an element is being dragged, resized or rotated now take effect once the drag ends, kept or cancelled with Esc, in the order they were pressed, each as its own history step on the document the drag left. A paste whose `adoptMedia` answer arrives meanwhile joins the same order (#525). Before, the release put back the drag's preview, drawn from the document before the edit, and a cut, duplicate or delete vanished; `X` then `V` in one drag pasted nothing back; and a copy or cut during a cancelled drag took the dragged, not the kept, position. During a frame selection, which draws no preview, the keys act at once on the selection shown.
- **Tests (#527):** cut and duplicate during a kept and an Esc-cancelled drag, copy during a cancelled one, `X` then `V` in one drag, `Delete` during a drag, `X` during a cancelled frame selection; for the #525 paste hold, a second paste while one waits is ignored and a held paste lands after Esc.

**Migration:** none.

## 0.173.1 — #486, SUI-FEATURE-103 rev 2: Button `busy` wins over the call site's `disabled` and `aria-disabled`

- **Button (#486):** while `busy`, a call site's `disabled` no longer renders the `disabled` attribute, so the focus stays on the running button; the run's `aria-disabled="true"` lock holds instead, and `disabled` applies again once `busy` ends. `aria-disabled="true"` and `aria-busy="true"` are now set after the passed-through props, so a call-site `aria-disabled={false}` (or `aria-busy`) can no longer undo the lock during a run. Applies to every building block that passes `busy` through.
- **Hints (#486):** `Hint` and `IconButtonTooltip` show no `disabledText` while the wrapped button is `busy`; a run is no lock with a reason. Report a run only through `busy`, never folded into `aria-disabled`.
- **Tests (#486):** unit tests for `busy` with `disabled` (no attribute, focus kept, nothing fires, `disabled` after the run), `busy` with `aria-disabled={false}` (click, `Enter`/`Space`, form submit fire nothing), no reason hint while `busy`, and a saving `SettingsActionRow` Save.

**Migration:** app tests that expect a running button to be `disabled` because the call site also passed `disabled` check `aria-disabled="true"` instead.

## 0.173.1 — #525, SUI-FEATURE-106 rev 2: a paste awaiting `adoptMedia` survives a drag; no `resolveMedia` resolves nothing

- **Paste during a drag (#525):** a paste whose `adoptMedia` answer arrives while an element is being dragged, resized or rotated now lands once the drag ends (kept or cancelled with Esc). Before, the drag's release put back the document as it was when the drag began and the paste was lost. A paste in the meantime is ignored.
- **Paste without `resolveMedia` (#525):** an editor without `resolveMedia` treats every pasted medium as unresolved, as its page draws them: `adoptMedia` is asked for all of them, and any still unresolved is named in the hint. Before, such a paste skipped `adoptMedia` and the hint while the images showed the missing-media placeholder.
- **Tests (#525):** editor tests for both cases (`slide-editor-clipboard.test.tsx`).

**Migration:** none.

## 0.173.0 — #466, SUI-FEATURE-191 rev 5, SUI-FEATURE-106 rev 2: copy/paste of locked elements, layout roles, group children, and into another document

- **Locked elements (#466):** copy, cut and duplicate now take the whole selection, locked elements included. Cut leaves a locked element in place and removes only the unlocked part. Before, cut and duplicate skipped locked elements. Copies are never locked, and the canvas menu's Cut and Duplicate are usable whenever something is selected; their hints (`cutHint`, `cutUnavailable`, `duplicateUnavailable`) say so.
- **Layout role (#466):** a copy no longer carries the layout placeholder role (`placeholderRole`), so after a layout change each role belongs only to the original.
- **Group child copied alone (#466):** the copy takes the groups' opacity multiplied into its own and their hiding, so it looks as it did on the page. A group copied whole is unchanged.
- **Paste into another document — media (#466, SUI-FEATURE-106):** `SlideEditor` takes `adoptMedia?: (ids: string[]) => Promise<Record<string, string>>`. A paste calls it once with the media ids `resolveMedia` does not resolve; the app creates the entries and answers old id → new id (an id it leaves out stays). The paste waits for the answer and stays one undo step. If the call fails, the prop is absent, or a medium still does not resolve, also one the app renamed, the paste goes in anyway: the image shows the missing-media placeholder and a hint (`slides.editor.mediaNotAdopted`) names the medium by its alt text or name, or counts it without a name (`slides.editor.unnamedMedia`), never by its id. A paste while one still waits for the app is ignored, and an answer that comes after the editor closed lands nowhere.
- **Paste into another document — brand (#466, SUI-FEATURE-106):** `SlideBrandSet` takes `defaults?: { text?, fill?, line?, heading?, body? }`. A brand key the target's brand set has stays. A key it lacks is rewritten in the document to the target's default for the key's role, or to the set's first key of that kind when there is no default; with no key of that kind at all, the source's resolved value is baked in as a free value. Roles: a run's colour is `text`; fills, highlights, icon and chart-series colours are `fill`; borders, line strokes and shadows are `line`; the font of a title placeholder's content (or the source's `defaults.heading` key) is `heading`, any other font `body`.
- **Tests (#466):** unit tests for AC 6–8 (`editor-clipboard.test.ts`) and for media and brand adoption (`editor-adopt.test.ts`); editor tests for cut and duplicate with a locked element, `adoptMedia` remapping, a failed or absent adoption with its hint and one undo step, a renamed medium that still does not resolve, a repeated paste while one is pending and an answer after closing, and brand keys in another document (`slide-editor-clipboard.test.tsx`).
- **Gallery (#466):** the default gallery page (strings table) shows the new keys; its baselines are updated.

**Migration:** none required; both props are optional and without them nothing changes. Apps with their own media store pass `adoptMedia` and set `defaults` on their brand set.

## 0.173.0 — #462, SUI-FEATURE-101 rev 3, GL-UI-028 rev 5, GL-UI-013 rev 5: keyboard focus never rests under a toast

- **Toaster (#462):** when keyboard focus lands on an element that a visible toast covers, wholly or in part (its focus ring included, 4 px around it as in forced colours), `<Toaster>` closes all toasts, the keyboard counterpart of the click that dismisses them all; the live region has announced them already. Only keyboard focus counts, as `:focus-visible` tells it; focus after a pointer press is unchanged, and focus on a toast's own action or close button closes none.
- **Scroll containers (#462):** the sidebar nav, the edit panel and media detail shell (both columns), the property panel, the drawer rail, the dialog body, the tile grid and the settings scaffold now carry `scroll-padding` of 0.5 rem, so a focused node scrolled into view keeps its whole ring visible, also the last Tab stop of a sidebar.
- **Tests (#462):** unit tests cover Tab onto an element one of two toasts covers (both close) and onto its ring, Tab onto an uncovered element, a pointer press under a toast and Tab into the toast's action; gallery tests focus the uncovered search field and then Tab onto the FilterBar control under a held toast on the list page (`?toast=1`), and Tab to the last stop of a scrolling sidebar nav at 360 px height.

**Migration:** none for the API. A test that compares the exact class string of one of these scroll containers adds `scroll-py-2` (`@panel-split:scroll-py-2` on the split column); the frozen markup of `DataTableShell` and `PageScroll` is unchanged. An app that closed a toast itself before tabbing to a control under it (or a test that dismissed the toast first) can drop that; the package does it. Apps build nothing of their own for it (`GL-UI-004`).

## 0.173.0 — #463, SUI-FEATURE-102 rev 3: the Sidebar's focused entry is never obscured

- **Sidebar focus (#463, `GL-UI-013` rev 5):** the Sidebar's scrolling nav area keeps a block `scroll-padding` (8 px, clear of the 3 px ring and the forced-colours outline) and scrolls a keyboard-focused (`:focus-visible`) entry into view with `scrollIntoView({ block: 'nearest' })`. Pointer focus does not scroll: Chromium focuses on mousedown, and a scroll then would move the entry from under the pointer and lose the click. Before, at a low viewport height the browser scrolled a tabbed-to entry only to the area's edge, so the lower part of its ring was clipped against the footer (e.g. `nav-section-admin`, `nav-section-settings` at 400 px). Applies expanded, collapsed and in the overlay; the area carries `data-testid="nav-scroll"`.
- **Tests (#463):** unit tests check the padding, the `scrollIntoView` call on keyboard focus and none on pointer focus; a gallery test at 1280 × 320 clicks the link cut off at the nav's bottom and finds it active; a gallery test tabs through every nav stop to `help-button` at 1280 × 720 and 1280 × 400 (expanded, collapsed) and 390 × 720 / 390 × 400 (overlay) and asserts each box plus ring lies inside the area's visible part and above the footer.

**Migration:** none. No strings or baselines change.

## 0.173.0 — #461, GL-UI-006 rev 4: a locked shortcut control offers no shortcut

- **Locked without a reason of its own (#461):** `IconButtonTooltip` and `Hint` now drop the shortcut chip and `aria-keyshortcuts` whenever the wrapped control is `disabled` or `aria-disabled`, also without `disabledText`. Before, they dropped them only with `disabledText`. This is the case of a surface or toolbar locked as a whole whose hint names the reason once: its Undo/Redo pass `disabled` and no `disabledText`, so they carry no reason of their own, have no focusable wrapper (`Tab` skips them) and offer no shortcut; usable again, chip and `aria-keyshortcuts` return. The `disabledText` path is unchanged.
- **Row overflow menu (#461, #518):** a `disabled` entry of a row's ⋯ menu (`RowActions` `menu.items`, also the `EditorHeader`'s folded tools) no longer shows its shortcut chip and no longer carries `aria-keyshortcuts`, with or without a `hint`; once it is usable again, both return.
- **Audit (#461):** already correct before this change, no code change: the `TablePagination` chevrons, the row delete button, the slide page sorter's delete, the slide editor's context-menu entries, and the editor's Undo/Redo (header buttons and folded ⋯ entries, #380/#454). Fixed here: the row ⋯ menu entries and the whole-surface case above. No surface in the package locks Undo/Redo as a whole today.
- **Tests (#461):** a unit and a gallery test check that the back button on page 1 carries neither chip nor `aria-keyshortcuts` and names its reason, and on page 2 carries both; a unit test covers the menu entry; a unit test models a surface locked as a whole (`GL-UI-006` rev 4, last acceptance bullet).

**Migration:** a control wrapped in `IconButtonTooltip` or `Hint` that is `disabled` or `aria-disabled` without `disabledText` no longer gets `aria-keyshortcuts` or the `kbd` chip; tests that expected them on such a locked control expect them only once it is usable. An app that passes `shortcut` on a `disabled` menu entry no longer gets them on that entry either; a `disabled` `RowMenuItem` must carry a `hint` naming its reason, otherwise it shows neither a shortcut nor a reason (`GL-UX-001` question 5). No strings or baselines change.

## 0.172.1 — #520: a long malformed number is rejected in linear time

- **Number parsing (#520):** `parseDecimal` no longer backtracks quadratically on a long malformed paste (40,000 digits and an "x" took over 2 s, now well under 1 ms). What it accepts and rejects, and why, is unchanged (`GL-UI-037`).
- **Tests (#520):** a unit test rejects 40,000-character malformed input within 50 ms.

**Migration:** none.

## 0.172.0 — #519, SUI-FEATURE-104 rev 2, SUI-FEATURE-105 rev 2: EditorHeader tools, status, read-only, page head

- **`tools` (#519):** `EditorHeader` takes `tools?: EditorHeaderTool[]` (`{ id, label, icon, onClick, pressed?, disabledText? }`, type exported). They stand first in the right group as `icon-sm` buttons named by `label` (accessible name and tooltip), followed by a separator: tools · separator · Preview · ⋯ · next · separator · Undo · Redo · status · state · Reset · Save. `pressed` makes a toggle with `aria-pressed` and the package's pressed fill; `disabledText` locks it with `aria-disabled` and names the reason. At narrow width they fold with Preview (stage 3) into the one ⋯, ahead of the other folded tools; a pressed tool becomes a checkbox entry (`RowMenuItem` gains `checked?`).
- **`status` (#519):** `status?: ReactNode` for a running operation stands directly left of the state indicator and never folds.
- **`readOnly` (#519):** with `readOnly` the header renders Back, the title, the tools, Preview, `status` and "Read only" (`suite:editor.readOnly`: Nur lesen / Read only / Solo lectura) in place of the state; Undo, Redo, the state, Reset, Save, the next step and the record's menu are absent, and the undo/redo keys are not bound.
- **Page head (#519):** the visible title is now the page's `h1` with `data-testid="page-title"` (same size, weight and truncation). A new `subtitle?: ReactNode` renders one muted `text-sm` line under it (`data-testid="page-subtitle"`), truncating with its full text as the tooltip; the header grows by that line only when it is set.
- **Gallery and tests (#519):** a new gallery page `editor-bar` shows tools + status, read-only, and the subtitle with and without a lifecycle (new screenshots); unit and gallery tests cover order, toggles, the folded checkbox entry, read-only, the `h1` and the subtitle at 390 px. The default gallery page (strings table) shows the new key.

**Migration:** none for the props. A page that renders its own `h1` beside `EditorHeader` drops it, so the route keeps one `h1`; a test that finds the editor title by `data-slot=editor-title-text` still does, and it is now also `getByRole("heading", { level: 1 })`.

## 0.172.0 — #460, SUI-FEATURE-234 rev 4: the preview's long-play control is Stop, not Pause

- **Stop in the preview (#460):** the control the editor's preview shows while a play over 5 s runs is now "Stop" (de "Stoppen", es "Detener"), its hint "Ends the play; the page stays as far as it got." It ends the play: no further step, the running animations stay in the state they reached, and the focus it held moves to "Play again", which starts over. There is no resume. The `SlidePlayer` is unchanged by this; its changes from #385 (less motion, the first page fading in from black) already match rev 4.
- **Tests (#460):** unit and gallery tests use the new test id and attribute; the gallery 390 px test checks the de and es labels.

**Migration:** strings `slides.editor.previewPause` → `slides.editor.previewStop` (en "Pause" → "Stop", de "Anhalten" → "Stoppen", es "Pausar" → "Detener") and `slides.editor.previewPauseHint` → `slides.editor.previewStopHint` (en "Stops the preview where it stands." → "Ends the play; the page stays as far as it got.", de "Hält die Vorschau an der Stelle an, an der sie gerade steht." → "Beendet das Abspielen; die Seite bleibt im erreichten Stand.", es "Detiene la vista previa donde está." → "Termina la reproducción; la página queda donde ha llegado."). `data-testid="slide-editor-preview-pause"` → `slide-editor-preview-stop`; the preview stage's `data-paused` → `data-stopped`. Baselines: 10 gallery captures (strings table) in `gallery/__screenshots__/`: `gallery-de-{light,dark}.png`, `gallery-de-{light,dark}-390.png`, `gallery-de-{light,dark}-1440.png` (6) and `gallery-{en,es}-{light,dark}.png` (4).

## 0.172.0 — #455, SUI-FEATURE-162: no entrance warning when the exit is at order 1

- **Animation order check (#455):** with the exit at order 1, the entrance's order field no longer asks for a lower number, since it cannot go below 1; the exit's warning ("give it a higher number") alone tells the fix. The `Field` props `warning` and `warningTestId` this uses are listed under 0.162.0 (#382).
- **Tests (#455):** the gallery animation test sets the exit to order 1 and checks that only the exit is warned.

**Migration:** none.

## 0.172.0 — #451, GL-UI-037 rev 2, SUI-FEATURE-233 rev 6: one number parser, `parseDecimal`

- **New export `parseDecimal` (#451):** `@suite/ui/ui/decimal-number` (also in `@suite/ui/ui/index`) exports `parseDecimal(text, language)`, `formatDecimal(value, language)`, `decimalSign(language)`, `numpadDecimal(event, language)` and the type `DecimalInvalid`. It is the one parser for number entry per `GL-UI-037`: in de and es a point and a comma are both the decimal sign ("1.5" = "1,5"), in en only the point; nothing is grouped, so one separator is always decimal ("1.000" = 1) and two ("1.000,5", "1,000.5") are refused as `separator`. A decimal number too large for a number is `tooLarge`, anything else `other`.
- **Chart values and `NumberField`/`NumberInput` (#451):** both read what is typed through `parseDecimal` and show the stored number with the UI language's decimal sign. The numpad's decimal key (`code` `NumpadDecimal`) types that sign whatever the key reports. A refused value stays as typed with an error that says why and names the right form, for example "Enter the number with one decimal point and no comma, such as 1000.5." An overflowing chart value now says the number is too large.
- **`NumberInput` is a text field (#451):** it was `type="number"`, which cannot hold a comma. It now has `role="spinbutton"` with `aria-valuenow`/`-valuemin`/`-valuemax`, and the arrow keys step by `step` within `min` and `max`; the native spinner is gone. It takes a new optional `onInvalid(why)`; a `NumberField` uses it to show its error (test id `${testId}-error`).
- **Tests (#451):** unit tests cover the GL-UI-037 cases for the parser, chart values and `NumberField` in de, es and en: accepted forms, refused forms with their messages, the numpad key, display, and the export.

**Migration:** apps read their own number fields through `parseDecimal` and show numbers through `formatDecimal` instead of `Number()`/`String()`; on a keydown they pass the event to `numpadDecimal`. Tests that read a `NumberInput`'s value as a number (`toHaveValue(12)`) now read text (`toHaveValue("12")`), and `min`/`max` are now `aria-valuemin`/`aria-valuemax`.

## 0.172.0 — #449, SUI-FEATURE-251 rev 2: the locked look mixes with the surface it sits on

- **`--surface` token (#449):** a new package token for the colour of the surface a control sits on, defaulting to `--background`.
- **Package surfaces (#449):** every package container with its own background sets `--surface` to that token: `Card`, `MediaTile` and the app sidebar (`--card`); popover, dropdown and context menu, `Select`, `Combobox`, `TagInput`, `TimezoneCombobox` and the user menu (`--popover`); `Dialog`, `Sheet`, the `DrawerRail` drawer, `EditorHeader`, `PropertyPanel`, the slide player's bar, the canvas action bar, the maximized `PreviewFrame`, the `EditPanel` and `MediaDetailShell` panels and the sticky table header (`--background`); the selected row of the slide page sorter (`--accent`); the `bg-muted` tab list, previews and the theme switch of the user menu (`--muted`).
- **Locked and disabled look (#449):** a `Button` locked with `aria-disabled` or `disabled` mixes its label half with `--surface`, never with `--background`; the half-tone fill already shows half of the surface under it: a locked Save in `SettingsFooter`, `EditorHeader` or `DrawerRail` and a locked button on a card, popover or the player bar now match their surface in dark mode. No opacity dimming, the focus ring stays at least 3:1, no hover tone (`SUI-FEATURE-120`).
- **Tests (#449):** a gallery test checks label and fill of every variant's locked button on the page background, a card, a popover, the player bar and the selected page row as the 50 % mix with that surface's token, light and dark, and the focus ring at 3:1 on each; gallery shots show the locked Save in `SettingsFooter`, `EditorHeader` and `DrawerRail`, light and dark.

**Migration:** none for package surfaces. An app that builds its own container with a background other than `--background` sets `--surface` to that colour token on it (`[--surface:var(--card)]`), so a locked button inside matches it; without it, `--background` applies as before. A test that checks the locked label's class `…_50%,var(--background))]` checks `…_50%,var(--surface))]`.

## 0.172.0 — #513, GL-UI-031 rev 5: shell search no longer opens on focus

- **No open-on-focus (#513):** tabbing onto the sidebar search field (`shell-search`) leaves the search dialog closed (WCAG 2.2 SC 3.2.1); click, `Enter`, typing or the shortcut open it, and a typed prefix still arrives in `search-dialog-input`. `Esc` closes the dialog and returns the focus to the field without reopening it.
- **Tests (#513):** unit tests cover focus without opening, `Enter` and click opening, and `Esc` back to the closed field.

**Migration:** none for callers; a test that opened the dialog by focusing the field clicks it or presses `Enter` instead.

## 0.172.0 — #446, SUI-FEATURE-086 rev 3: SlideEditor `headerRef`

- **`headerRef` (#446):** `SlideEditor` takes a new optional `headerRef` prop and hangs it on its header element. The full-screen editor route passes the same ref to `useEditorShellToastOffset`, so toasts start below the editor's header and cover none of its controls; the editor never calls the hook itself, and a DOM lookup of the header is no way for apps.

**Migration:** the slide editor's route calls `useEditorShellToastOffset(ref)` and passes `headerRef={ref}` to `SlideEditor`.

## 0.171.8 — #436, GL-UI-017 rev 6: locked chart controls and value errors under test

- **Locked chart (#436):** the chart panel's type buttons, like its add and remove buttons (#440), stay focusable while the element is locked and say "Unlock the element to change its chart." as their description; this already held, a test now pins it.
- **Value error (#436):** a chart value that is not a number points to its row's error by `aria-errormessage`, never `aria-describedby`; once the value is a number again, the reference and the error are gone and the value hint is its whole description. This already held since #437, a test now pins it.
- **Tests (#436):** unit tests cover both.

**Migration:** none. No code change; tests only.

## 0.171.7 — #505, GL-UI-017 rev 6: SettingsField group described by its hint

- **Group hint (#505):** a `SettingsField` with `group` and a `hint` describes its group element by that hint (`aria-describedby` to `${htmlFor}-help`), read once; the options still take none of the field's hints.
- **Tests (#505):** a unit test checks the group's description and that neither the options nor the inner radiogroup repeat it.

**Migration:** a caller that wires the group field's hint by hand (`aria-describedby={helpIdFor(htmlFor)}` on the inner `RadioGroup` or its options) drops that wiring, otherwise the hint is read twice.

## 0.171.6 — #435, GL-UI-017 rev 6: Field and SettingsField hint on the control

- **Hint on the control (#435):** a `Field` or `SettingsField` with a `hint` and no `valueHint` now carries that hint on its package control too (Input, Textarea, a Select's trigger, Combobox, TimezoneCombobox): hovering the control opens it, and it is the control's description in place of the label's hidden help, read once. A `valueHint` still wins. Help, warning and error keep their wiring.
- **Checkbox and Switch (#435):** as the control of a hinted `Field`, `SettingsField` or `SettingsToggleField`, a Checkbox or Switch carries the label's hint, the same text on both carriers. The options of a `group` field take none of the field's hints; each has its own text.
- **The caller's own Hint wins (#435):** a control the caller already wraps in a `Hint` of its own takes no field hint: one bubble, and its description stays that Hint's text alone.
- **Grid type hint (#435):** the en hint of the grid type says "Sets which type of grid is drawn.", in the label's term.
- **Tests (#435):** unit tests cover the label's hint on an input, a Select's trigger, an invalid input, a Checkbox and a Switch (in `SettingsField` and `SettingsToggleField`), a caller's own `Hint` winning, group options left out, and on a `Field` with help text, the value hint winning.

**Migration:** none. A control inside a hinted field without a value hint (and without a `Hint` of its own) now opens the hint on hover; its `aria-describedby` points to the hint's own description, with the same text, instead of `${htmlFor}-help`.

## 0.171.5 — #434, GL-UI-017 rev 6: hints on GridFields and CanvasZoom

- **GridFields (#434):** every label of the grid group (type, step, number of columns, gutter, margin, row step) carries its hint, and every field a value hint saying what it counts and in which unit, or what each type does; the value hint is the field's whole description (`aria-describedby`), without the px unit beside it, which the hint already names. Where "No grid" is offered (`allowNone`), the type's value hint names it too. Each hint is one sentence. In de, en and es.
- **CanvasZoom (#434):** "Fit" and "100 %" each carry a hint saying what the press does, as the button's description. In de, en and es.
- **Tests (#434):** unit tests check, in every language, that each grid label and field and each zoom button has its hint, and that with `allowNone` the type's hint names "No grid".

**Migration:** none. Tests that found a GridFields label by `selector: "label"` find its text in the label's inner span now.

## 0.171.4 — #500, SUI-FEATURE-230 rev 4: spinner step in the crop zoom % field

- **Spinner is a step (#500, Codex CX1):** a click on the native spinner of the crop zoom % field, and every repeat while it is held, now zooms from the crop as it is and ends the typing, like an arrow key; a press that changes nothing (a caret click) or a right-button press stays out of it; before, it counted as typing and brought back a shift that typing 100 % had dropped (300 % with a shift, type 100, spinner up: the shift returned at 101 %).
- **Tests (#500):** unit tests cover a spinner step after typing 100 % over a shifted 300 %, a held spinner followed by typing, a caret click before leaving (shift kept, scaled) and a right-button press (still typing).

**Migration:** none.

## 0.171.3 — #496, SUI-FEATURE-230 rev 4: Esc after typing in the crop zoom % field

- **Esc drops the crop (#496):** Esc in the crop zoom % field after typing a zoom now ends cropping as it does without typing; before, the field leaving for the canvas set its zoom on the way and brought cropping back.
- **Tests (#496):** a unit test types 300 % and presses Esc, expecting cropping ended and the focus on the canvas.

**Migration:** none.

## 0.171.2 — #495, Codex review v0.171.0: crop zoom % field

- **Leaving for outside (#495, Codex CX1):** typing a zoom past 500 % in the crop zoom % field and then moving the focus outside cropping (a drawer button, the header) keeps the clamped 500 %; before, cropping ended with the zoom from before the field was left.
- **Typed text stays gone (#495, Codex CX2):** text typed in the field that gave way to the wheel, a key, the slider or a shift no longer comes back when the zoom returns to the value typed before, and leaving the field then changes nothing.
- **Past 500 % keeps the shift (#495, from #493):** typing 1000 passes through 100 %, which drops the shift; leaving the field now zooms from the crop typing started with, so it ends at 500 % with the shift kept, scaled.
- **Canvas press keeps the typed zoom (#495):** typing a zoom and then pressing beside the image (apply) or on it (drag) starts from the field's clamped zoom; before, it started from the zoom before typing. Enter and an arrow step in the field end the typing, so a shift dropped on the way does not come back.

**Migration:** none. `NumberField` and `NumberInput` are unchanged.

## 0.171.1 — #432, SUI-FEATURE-097: focus return after the view → edit hand-off

- **Focus return (#432, GL-UI-007):** when a view panel's Edit opens an edit panel, the closing view hands its return target to that panel; closing the edit panel puts the focus back on the element that opened the view, not on the page body (the view's Edit is gone by then).
- **Tests (#432):** a unit test and a gallery test walk view → Edit → close and expect the focus on the original trigger.

**Migration:** none.

## 0.171.0 — #426, SUI-FEATURE-230 rev 4: crop mode rest past the page, zoom % field

- **Rest past the page (#426):** in the slide editor's crop mode the dimmed rest of the image runs past the page edge onto the work area, so a full-bleed image shows its rest too, in light and dark. The canvas takes presses over that area while cropping: a press on the rest past the page shifts the image, a press beside the image still applies the crop. Its focus ring stays around the page.
- **Zoom % field (#426):** a number field in % stands beside the crop zoom slider (slider beside number field, `SUI-FEATURE-057`) with the same value; typing there moves the slider and the other way round. While typing it applies only 100–500 %, so a first digit no longer zooms out and drops the shift; leaving the field or Enter clamps what is typed to 100–500 %, like slider, wheel and keys. Typed text gives way once the zoom changes elsewhere (Undo, wheel, keys, slider).
- **Steps (#426):** `+`/`−` while cropping now step the zoom by 10 points (300 % → 310 %), coarse as PageUp/PageDown on the slider; before they multiplied by 1.1. The slider's arrows step 1 %, the wheel still zooms by a factor.
- **Border (#426, Codex CX1):** for an image with a border the dimmed rest continues the image drawn inside the border, and its cut-out is the bordered frame, so the border stays in view. A press on any edge of the bordered frame shifts the image.
- **NumberInput (#426):** the input of the slide editor's `NumberField` with its unit is a part of its own, used by the crop zoom field too (GL-UI-004).
- **Tests (#426):** the dimmed rest is left out once its medium fails to load.
- **Strings (#426):** new `slides.editor.cropZoomPercent` (en, de, es).

**Migration:** none for code. 10 gallery baselines changed (the strings listing gains one row): `gallery-{de,en,es}-{light,dark}.png`, `gallery-de-{light,dark}-{390,1440}.png`.

## 0.170.0 — #430, SUI-FEATURE-096 rev 4: InlineMessage warning prefix and link hover

- **Warning prefix (#430):** the screen-reader prefix of `InlineMessage tone="warn"` reads "Warnung:" / "Warning:" / "Advertencia:", the same words as `status.warning` / `severity.warning` (was "Hinweis:" / "Aviso:" in de/es).
- **Link (#430, GL-UI-060, GL-UI-013):** a link in the text stays underlined at rest and drops the underline on hover, like the help-markdown link; the token focus ring stays. The link colour stays the tone colour.

**Migration:** none. Tests that read the whole de/es warning text see the new prefix.

## 0.169.3 — #428, GL-UI-004, SUI-FEATURE-096: the remaining error lines through InlineMessage

- **One error line (#428):** the error of `SettingsScaffold` (`settings-error`), the rejected-files line of `UploadStep` (`upload-rejected`) and the error state of `DataTableShell`/`TileGridShell` now render through `InlineMessage tone="error"`: same symbol, colour and `role="alert"`, and screen readers now hear the "Error:" prefix before the text. The list error is newly announced as an alert.
- **UploadStep (#428, SUI-FEATURE-052 rev 7):** `upload-rejected` stays in place as a wrapper without a role; the message inside it is the one alert, empty again with the next choice. Before, the wrapper itself was `role="status"`.

**Migration:** none. Tests that read the whole text of these lines see the invisible "Error:" prefix; tests that looked for `role="status"` in `upload-rejected` look for `role="alert"` inside it.

## 0.169.2 — #425, GL-UI-010: slide editor property panel headings and spacing

- **Headings (#425):** every slide editor property panel section (transition, animation with its entrance/exit legends, add-on fields, crop, text format, table cell, arrange, align, distribute, placeholders) titles itself `text-base font-semibold` instead of `text-sm font-medium`.
- **Spacing (#425):** a field section stands 8 px (`gap-2`) from its heading to its content and 16 px (`gap-4`) between its fields and field grids, instead of 12 px throughout; the chart data fields also stand 16 px apart. Button-row sections keep `gap-2`.

**Migration:** none for code. 26 gallery baselines changed: `slide-editor-{de,en,es}-{light,dark}.png`, `slide-editor-de-{light,dark}-{390,1440}.png`, `slide-editor-menu-{de,en,es}-{light,dark}.png`, `pressed-{de,en,es}-{light,dark}.png`, `pressed-de-{light,dark}-{390,1440}.png`.

## 0.169.1 — #484, SUI-FEATURE-260: invalid date and time fields keep the destructive border under focus

- **Fix (#484):** a date or time `Input` with `aria-invalid="true"` no longer swaps its destructive border for the ring color on keyboard focus; the focus ring stays. Regression from 0.168.6 (#410).

**Migration:** none.

## 0.169.0 — #423, SUI-FEATURE-095 rev 3: every toggle pressed in the one primary fill

- **Remaining toggles (#423):** the list's view toggle, the single-column List / Preview switch of `SplitWorkspace`, the canvas zoom mode ("Fit" · "100 %"), the slide editor's chart type and its text formats (bold, italic, alignment, bullets) now show their pressed or chosen state in the package's one pressed fill (`PRESSED_FILL_CLASS`: `--primary` with `--primary-foreground`, on hover `--primary-hover`), in light and dark, like RowActions, GridToggle, the drawer rail and maximize since 0.155.0 (#353). Before, they used the accent surface, barely visible in the light theme. Unpressed they are unchanged.
- **Guard (#423):** the package test now also fails on an accent surface for an `aria-pressed`/`aria-checked` state, not only on a second primary copy.
- **Gallery (#423):** the "Pressed toggles" page shows the new toggles, each with a pressed and an unpressed button.

**Migration:** none. Apps that relied on the accent look of these toggles see the primary fill.

## 0.168.6 — #410, SUI-FEATURE-260: date and time fields keep the focus ring on the calendar button

- **Focus ring on the calendar button (#410):** an `Input` of type `date`, `time`, `datetime-local`, `month` or `week` now shows the focus ring while any part of it holds the keyboard focus, the calendar button included. In Chromium that button is a tab stop of its own and left the field without a ring. A mouse click into such a field, on its segments or its calendar button, shows no ring; the next key pressed in the field brings it back. Ring, colour and 3:1 are unchanged.

**Migration:** none.

## 0.168.5 — #482, SUI-FEATURE-099: Esc gives back the selection and the spot's pointer

- **Selection before a frame (#482):** Esc during a frame selection started without Shift now gives back the selection from before the press. Before, it left the selection empty (only a Shift frame got its selection back).
- **Pointer after Esc (#482):** the pointer after Esc is computed against the page with the gesture dropped. Before, it was taken from the cancelled preview: an element moved over an empty spot left the move pointer there until the next pointer move.

**Migration:** none.

## 0.168.4 — #418, SUI-FEATURE-099: the pointer stays the same during a gesture

- **Gesture pointer (#418):** from the press to the release the pointer stays the one the gesture started with: the dragged handle's resize arrow (turned with the element, #338), the rotate handle's, "move" while moving, a column border's. Before, it changed with what it passed over: other elements, the canvas, the window outside the page. After the release it is the pointer of the spot under it again, without a further move.
- **Esc cancels a gesture (#418):** Esc during a resize, turn, move, column drag or frame selection drops it (nothing changes, a frame selection gives back the selection before) and the pointer is the one of the spot again. While cropping, Esc still also drops the crop.

**Migration:** none.

## 0.168.3 — #415, SUI-FEATURE-161: a table's column border cursor turns with the table

- **Border cursor (#415):** the cursor over a table's column border now follows the table's turn on the screen, its groups' turn included, as the resize handles do since 0.153.1 (#338): `col-resize` while the border runs up and down on the screen, `row-resize` once it lies nearer the horizontal (around 90° and 270°). Before, it always showed `col-resize`, so on a table turned by 90° it pointed across the drag.

**Migration:** none.

## 0.168.2 — #476, SUI-FEATURE-192: a filling group lands centred on the new placeholder

- **Centred group (#476):** when the page's layout changes, a group filling a placeholder whose turned children cannot take the placeholder's shape keeps its own size, as before, but is now centred on the placeholder where it is drawn (within 0.01 px). Since 0.167.3 it was placed from the placeholder's corner, its centre off by up to half the size difference.

**Migration:** none.

## 0.168.1 — #408, SUI-FEATURE-190 rev 5: align and distribute in a turned group's axes

- **Align in the group's frame (#408):** when every selected element sits in the same turned group, align and distribute now work in that group's axes: two children aligned left get flush left edges in the group, not on the page. Any other multi-selection still aligns its axis-parallel outline on the page, and a single element still aligns to the page where it is drawn.
- **Tests (#408):** a group width typed key by key leaves the children where the width set at once puts them; a child of an upright group snaps to the group's edges and centre as measured when the drag starts.

**Migration:** none.

## 0.168.0 — #396, SUI-FEATURE-193: brand values by name, delete without confirm, one word "page"

Breaking for apps that pass a brand set to `SlideView`, `SlideEditor`, `SlidePlayer` or `SlideExport`.

- **Brand values by name (#396):** each entry of `SlideBrandSet` now carries a required display name in the interface's language: a colour is `{ value, label }` (new type `SlideBrandColor`), a font `{ family, label }` (new type `SlideBrandFont`). The text and table panels show only that name, fonts with their family ("Body text · Inter"); a key such as `primary` no longer appears there. A brand set without `label` is a type error.
- **Delete without confirm (#396):** an element, a table row or a table column deletes at once (an element with `Delete`/`Backspace` too), and `Cmd/Ctrl+Z` brings it back; deleting a page keeps its confirm. The editor already worked this way; a test now holds it.
- **One word "page" (#396):** the player's and view's texts say "page" (de "Seite", es "página") instead of "slide"/"Folie"/"diapositiva": `Previous page`, `Next page`, `Page 2 of 5`, `This page can’t be shown.` The English slide-in effects read "Glide in"/"Glide out", the slide transition "Push". Code names (`SlidePlayer`, effect value `slide`) stay.
- **Column width says why (#396):** with one column the read-only column width field explains under it that it can change once the table has another column.
- **Numbered placeholders (#396):** when a page has more than one unnamed placeholder, the canvas hint and the fill buttons number them ("Placeholder 1", "Placeholder 2").

**Migration:** give every brand set entry a display name: `colors: { primary: "#1d4ed8" }` becomes `colors: { primary: { value: "#1d4ed8", label: t("brand.primary") } }`, `fonts: { body: "Inter" }` becomes `fonts: { body: { family: "Inter", label: t("brand.body") } }`. App tests that find the player's buttons by "Previous slide"/"Next slide", the position "Slide n of m", the invalid text "This slide can’t be shown." or the effect options "Slide in"/"Slide out"/"Slide" switch to the new texts. Baselines: the string table grows by two keys in 10 gallery captures in `gallery/__screenshots__/`: `gallery-{de,en,es}-{light,dark}.png` (6) and `gallery-de-{light,dark}-{390,1440}.png` (4).

## 0.167.3 — #399, SUI-FEATURE-192: a layout switch places a grouped element in one step

- **One placement (#399):** when the page's layout changes, an element filling a placeholder inside turned groups is now placed once, against its groups as they stand after its turn, instead of being corrected in up to six nudged steps. It lands where the new placeholder is drawn within 0.01 px, nested and turned groups and a turned placeholder included.

**Migration:** none.

## 0.167.2 — #471, SUI-FEATURE-250 rev 4: a Button in a disabled fieldset dims again

- **Disabled through a fieldset (#471):** a `Button` disabled by a parent `<fieldset disabled>` (without its own `disabled` prop) now shows the same colour-dimmed look as `<Button disabled>`, in light and dark. Since 0.166.0 it stayed disabled but kept its full colour. A `busy` button keeps its full colour as before.

**Migration:** none.

## 0.167.1 — #469, SUI-FEATURE-191: paste offset bound counts copy-element pairs

- **Paste clears every covered element (#469):** when several pasted copies would lie on the same identical element at successive offsets, `pasteElements` keeps offsetting until none lies on one. The number of offsets is now bounded by copies times elements on the page instead of the elements alone; the stop when the offset no longer moves a covering copy stays.

## 0.167.0 — #395, SUI-FEATURE-192 rev 3: placeholder text starts at its role size

- **Placeholder text by role (#395):** a text field made by filling a placeholder (double click or the fill button) now starts at its role's size, measured against the format's base text size (32 px at a 1080 px shorter side, scaled with the format): `title` twice it in the brand set's `heading` font, `subtitle` one and a half times, every other role the base size in the `body` font. A title at 1920 × 1080 starts at 64 px. Before, every role started at 36 px in the default font.

**Migration:** none. Existing documents are unchanged.

## 0.166.0 — #392, SUI-FEATURE-250 rev 4: one look for "not available"

Feature.

- **Disabled looks like locked (#392):** a `Button` with a real `disabled` (no reason) now dims in colour like a button locked with `aria-disabled` (`SUI-FEATURE-120`): the fill at half tone, the label mixed half with the background, `GrayText` for label and border under forced colours. It no longer uses half element opacity (`disabled:opacity-50` is gone from the base class). A disabled button that is also `busy` keeps the full colour of its variant. Other disabled controls (inputs, checkboxes, tabs …) keep their look.
- **EditorHeader Reset keeps the focus (#392):** while there is nothing to reset or Save runs, `editor-reset` locks with `aria-disabled` and the trigger lock of `Button`, in the locked look, instead of `disabled`. It stays focusable; a click or `Enter` opens no confirm. A confirmed Reset still hands the focus on as `GL-UI-050` says.

**Migration:** App tests that check `toBeDisabled()` on `editor-reset` (EditorHeader) switch to `toHaveAttribute("aria-disabled", "true")`. App code or tests that read the class `disabled:opacity-50` or a computed opacity of 0.5 on a disabled `Button` read the half-tone instead (`disabled:bg-<variant>/50`, `disabled:text-[color-mix(…)]`). The busy class `disabled:opacity-100` is gone. Gallery: each variant row of the Button section has a new locked twin `button-locked-<variant>` next to the new `button-disabled-<variant>`. Baselines: 10 gallery captures (Button section) in `gallery/__screenshots__/`: `components-de-{light,dark}.png`, `components-de-{light,dark}-390.png`, `components-de-{light,dark}-1440.png` (6) and `components-{en,es}-{light,dark}.png` (4).

## 0.165.1 — #467, SUI-FEATURE-191: paste offset bounded, group children counted

- **Paste never freezes the editor (#467):** `pasteElements` stops offsetting once the offset no longer moves a copy that covers an identical element (coordinates too large to change by 10 page units); the copies then land where they were copied. The number of offsets is bounded by the elements on the page.
- **Paste offsets off a group's child (#467):** a child copied alone out of a group and pasted onto the same page now gets the paste offset when it would lie exactly on its original; the elements in groups count, as drawn on the page.

## 0.165.0 — #394, SUI-FEATURE-163 rev 6: add-on ids `ext.<app>.<name>`

Breaking for apps that register slide add-ons or keep add-on values in an element's payload.

- **Add-on ids without a colon (#394):** an add-on's `id` now has the form `ext.<app>.<name>` (`ext.cockpit.image-filter`), the token format of `SUI-DESIGN-002`. `SlideView` and `SlideEditor` (`checkSlideExtensions`) refuse any other form with an error naming the id, the old `ext:<app>.<name>` included. Only a payload key starting with `ext.` counts as an add-on's value: the editor's note on settings of an extension not loaded here shows for such a key, never for plain app data, and an `ext:` key is now plain app data. The gallery's example add-on is `ext.gallery.image-filter`.

**Migration:** rename each add-on `id` from `ext:<app>.<name>` to `ext.<app>.<name>`, and move stored values from the payload key `ext:<app>.<name>` to `ext.<app>.<name>` (until then they are kept as plain app data and not drawn).

## 0.164.0 — #391, SUI-FEATURE-163: element schema with the structural preflight

Breaking for apps that call `slideElementFitsLimits`: the export is removed.

- **One element is bounded (#391):** `slideElementSchema` now runs the same structural preflight as `slideDocumentSchema` before its recursive parse: groups nest at most `SLIDE_LIMITS.maxGroupDepth` deep and an element holds at most `SLIDE_LIMITS.maxElements` elements, those in groups counted. Past them, parsing returns an issue (`group-depth`, `too-many-elements`) with the element's own path, never a `RangeError`; 2000 nested groups included.

**Migration:** removed export `slideElementFitsLimits(element)`; parse with `slideElementSchema` instead, which now checks the same limits itself. Its type stays `z.ZodType<SlideElement, SlideElementInput>`.

## 0.163.1 — #459, SUI-FEATURE-234: Pause stays until a capped long animation ends

Fix.

- **Preview plays what it waits for (#459):** the editor's preview now plays an imported delay, duration or transition longer than 60 000 ms (`ANIMATION_MAX_MS`) capped at 60 000 ms. This holds on the page, its layout and its master, and inside groups. The drawn animation now ends when the step's timer does, so Pause stays until the last animation has played. Before, only the timers were capped (a step at 120 000 ms): a final 180 000 ms entrance kept running for 60 s after Pause had gone. The document itself is not changed.

**Migration:** none. A step of the preview with an imported delay or duration over 60 000 ms now waits up to 60 000 ms for each, instead of up to 120 000 ms for the two together. The internal `STEP_MAX_MS` is removed.

## 0.163.0 — #385, SUI-FEATURE-234: preview Pause, instant reduced motion, first-page fade, Animation section

Feature.

- **Pause in the preview (#385):** when the editor's preview plays for more than 5 s (transition plus every step), its footer shows "Pause" while it runs (WCAG 2.2.2). Pause stops the steps that are still to come and freezes the running animations. "Play again" starts over. When Pause goes, after a press or at the end of the play, the focus it held moves to "Play again". The preview footer now wraps, so on a phone every button stays inside the dialog.
- **Reduced motion is instant (#385):** with `prefers-reduced-motion`, every entrance, exit and page transition in the preview and the `SlidePlayer` plays in 0 ms. Each one still waits for its delay, and the order and the preview's waits stay the same. Before, a slide or zoom only faded.
- **First page fades in from black (#385):** a transition on the first shown page fades it in from black, whatever its type. This now happens in both the preview and the `SlidePlayer`. Before, the player played no transition there, and the preview had dropped it to match.
- **Animation section (#385):** an element's entrance and exit fields now sit at the end of the Layout tab, in a section labelled "Animation". The page transition stays with the page properties. A new animation still plays 500 ms with no delay, and the order is shown from 1.

**Migration:** new strings `slides.editor.previewPause` (en "Pause", de "Anhalten", es "Pausar") and `slides.editor.previewPauseHint` (en "Stops the preview where it stands.", de "Hält die Vorschau an der Stelle an, an der sie gerade steht.", es "Detiene la vista previa donde está."). Removed from `src/styles.css`: the `@media (prefers-reduced-motion: reduce)` overrides of the `suite-slide-slide-*` and `suite-slide-zoom-*` keyframes; the animations now set a 0 ms duration instead. Internal `transitionOf(page, direction)` in `render-style.ts` takes an optional third argument `{ first, reduced }`; it is not exported. New `data-testid="slide-editor-preview-pause"`. The preview stage (`data-slot="slide-preview"`) carries `data-paused`. The `slide-editor-animation` section moved to the end of `slide-editor-layout` and is labelled through `aria-labelledby="slide-editor-animation-title"`. The preview's `DialogFooter` has `flex-wrap`. Baselines: 10 gallery captures (strings table, two rows longer) in `gallery/__screenshots__/`: `gallery-de-{light,dark}.png`, `gallery-de-{light,dark}-390.png`, `gallery-de-{light,dark}-1440.png` (6) and `gallery-{en,es}-{light,dark}.png` (4).

## 0.162.0 — #379, #380, #382, SUI-FEATURE-233, GL-UX-001, SUI-FEATURE-162: chart field widths, locked Undo/Redo hints, animation follow-ups

Feature and fixes.

- **Chart data panel (#379):** the category name fields are all as wide as their column (`flex-1`, at least `min-w-28`), whatever their names. The remove buttons line up and the values no longer move while a name is typed. Before, each category field was as wide as its name (`min-w-24` to `max-w-40`). The series name fields keep `w-20`. Interim: overflow at narrow widths waits for a taste decision.
- **Locked Undo/Redo (#380):** with nothing to undo or redo, the hover hint gives the reason ("Nothing to undo", "Nothing to redo") and drops the shortcut chip. A locked control (`disabled`) no longer carries `aria-keyshortcuts`; a usable one still names every variant.
- **Animation order check (#382):** an exit that plays before or with the entrance of the same element, and an entrance that plays after or with its exit, get a warning under the order field naming the other order. Equal orders play together, and the order hint says so.
- **Long and zero durations (#382):** a duration of 0 ms gets a help note under the field (not a `warning`) that the element appears or disappears, or the page changes, without the effect. In the preview an imported transition longer than 60 000 ms (`ANIMATION_MAX_MS`) plays 60 000 ms, and a step waits at most 120 000 ms; the page fade CSS is clamped to 60 s. Closing or restarting the preview clears its timers. Panel writes of the animation fields have tests.
- **`Field` warning (#382):** new optional props `warning` and `warningTestId`. A warning about a valid value stands under the control in place of the help text, under the same id `${htmlFor}-description`, as an `InlineMessage` with `tone="warn"`. An error still wins.

**Migration:** new public `Field` props `warning` and `warningTestId` (optional). `editor-undo` and `editor-redo` (EditorHeader) now always sit inside the `IconButtonTooltip` span: tooltip trigger attributes such as `data-state` move to the span, and while locked the button carries `aria-describedby` to the reason text. `aria-keyshortcuts` is dropped only on `IconButtonTooltip`/`Hint` controls with `disabledText` while they are `disabled` or `aria-disabled`. New strings `editor.undoNone`, `editor.redoNone`, `slides.editor.animationExitBeforeEntrance`, `slides.editor.animationEntranceAfterExit`, `slides.editor.entranceZeroDuration`, `slides.editor.exitZeroDuration`, `slides.editor.transitionZeroDuration` (en, de, es). Changed string `slides.editor.animationOrderValueHint`: en "A whole number from 1; lower numbers play first." → "A whole number from 1; lower numbers play first, equal numbers play together."; de "Eine ganze Zahl ab 1; kleinere Zahlen kommen zuerst." → "Eine ganze Zahl ab 1; kleinere Zahlen kommen zuerst, gleiche spielen zusammen."; es "Un número entero desde 1; los números menores van primero." → "Un número entero desde 1; los menores van primero y los iguales a la vez.". Baselines: 10 gallery captures (strings table) in `gallery/__screenshots__/`, changed in #380 and again in #382: `gallery-de-{light,dark}.png`, `gallery-de-{light,dark}-390.png`, `gallery-de-{light,dark}-1440.png` (6) and `gallery-{en,es}-{light,dark}.png` (4). Gallery captures now load `gallery/still-scene.css`.

## 0.161.6 — #378, SUI-FEATURE-233: a too-large chart value gets the generic message

Fix.

- **Separator message only for the separator:** a chart value now gets the separator message only when it contains the separator its language forbids (a point in German and Spanish, a comma in English). A decimal number too large for a number, such as `1.5e309`, now gets the generic "enter a number" message. Before, it got the separator message although it had no wrong separator.

**Migration:** none.

## 0.161.5 — #372, SUI-FEATURE-120 rev 7: locked buttons use the Button's own look

Fix.

- **One locked look:** the package's own locked Save, Reset, Cancel and pager chevrons no longer add a class of their own. They use the look the `Button` gives itself on `aria-disabled`: a half-tone fill, the label mixed with the background, no hover tint, focus ring at full contrast. The removed classes repeated that look. The chevrons now mix their icon with `--background` instead of using 50 % alpha. On the panel surface (`bg-background`) both give the same colour.

**Migration:** none. The removed classes were internal.

## 0.161.4 — #445, GL-UI-016: a narrowed hint bubble is checked at its final height

Fix.

- **Bubbles beside a group:** narrowed to a gap, a bubble wraps and grows taller, which can bring in another bar's control lower down. It is now chosen again at each new height until its room narrows no further. If it still narrows after three rounds, it is chosen at the height it takes at 120 px, its tallest. Before, it was checked only once after narrowing, and could narrow further and grow over a control that was never checked.

**Migration:** none.

## 0.161.3 — #365, SUI-FEATURE-232: element library follow-ups

Fix.

- **Icons are one tab stop:** the library's icon grid has a roving tabindex (`GL-UX-001`). Tab enters it at the icon last focused, the arrow keys move within its two columns, Home and End go to the first and last icon, and the next Tab leaves the grid. From the canvas the library is a few Shift+Tab presses away instead of about 70.
- **Refusal toasts:** "The page can’t take another element" appears only when the page is at its element limit. Any other rule the insert breaks gets a new generic error (`slides.editor.insertFailed`). The medium error appears only for images. The toast has one id, so repeated presses replace it instead of stacking.
- **Gallery:** the `?doc=full` dots have a visible fill, and a new `?ground=dark` page has a dark first page.

**Migration:** none. New string `slides.editor.insertFailed` (en, de, es). Baselines: the strings table (gallery start page) in de, en and es, light and dark, and in de at 390 px and 1440 px.

## 0.161.2 — #441, GL-UI-016: hint bubbles keep clear of neighbours and floating actions

Fix.

- **Field pairs:** a field's label counts as a control of its row (`label[for]`), and the label's whole box belongs to its hint. On the label line of a two-column pair, the label hint stands beside both labels, no longer over the neighbour's label and the top of its input.
- **Field pairs in an app's grid:** two `Field`s (or `SettingsField`s) side by side on one line form a row without a `data-tooltip-row` marker. Their label and value hints stand beside the whole pair.
- **Other bars at the bubble's height:** a bubble beside its group also keeps clear of the controls of other bars at its height, such as the canvas's floating actions (ungroup, forward, backward, delete, crop Apply) beside the SlideEditor panel. It stands in the nearest gap that holds it, or narrows in the widest one.
- **Narrow windows:** when neither side of the element has 120 px, the bubble stands at the element, at least 120 px wide and inside the viewport. Before, it shrank to a few pixels and ran past the edge.
- **Chart:** the add-category and add-series buttons are one tooltip row, so neither hint covers the other button.

**Migration:** none. The gallery has a new `?harness=field-pair` page, with no capture.

## 0.161.1 — #440, GL-UI-017: value hints on comboboxes; locked chart buttons name the unlock

Fix.

- **`Combobox`, `TimezoneCombobox`:** inside a `Field` with `valueHint` they take that hint as their hover hint and `aria-describedby` text, like `Input`, `Textarea` and a `Select`'s trigger. Their own `hint` still wins.
- **Chart:** locked, the add and remove buttons for series and categories say to unlock the element, as the chart type buttons already did.
- **Strings:** the de and es entrance and exit value hints are shorter, at most 120 characters with the option names filled in; a strings test keeps them there.

**Migration:** none.

## 0.161.0 — #437, GL-UI-017: value hints on fields; errors and locks are no hint

Fix.

- **`Field valueHint`** (also on `SettingsField` and the SlideEditor's `NumberField`): label and field are two carriers. The label keeps its hint on what the field is for; the package control inside the field (`Input`, `Textarea`, a `Select`'s trigger) stands in a `Hint` with the value hint: what the value counts, its unit, the effect of a choice. That hint is the control's `aria-describedby` text, in place of the label's. Any other control (a `Slider`) takes its value hint in its own `Hint`.
- **SlideEditor:** every panel field has its value hint in de, en and es: position, size, rotation, crop zoom and offsets, entrance and exit effect, direction, duration, delay and order, the page's transition and layout, text font, size and colour, the table's row, column, column width, cell fill and vertical alignment. Label hints say only what the field is for: units, the order rule and picking another cell moved to the value hints. Effect, transition, layout and cell fill hints name each option by its own string. Every two-column field grid of the panel is a tooltip row, so a hint stands beside the whole pair and never covers the neighbouring field (`GL-UI-016`).
- **Chart:** an invalid value points to its error through `aria-errormessage` only; its description stays the value hint. Locked, the chart type buttons say to unlock the element.

**Migration:** none; `valueHint` is optional. New strings `slides.editor.*ValueHint` (the effect has one for entrance and one for exit), `slides.editor.msValueHint` and `slides.editor.chartLocked` (en, de, es); eleven label hints lose their unit. GridFields gets its hints in #434.

## 0.160.0 — #361, GL-UI-017: hover hints across the SlideEditor

Feature.

- **Fields:** every field in the SlideEditor's property panel now has a hover hint on its label, in de, en and es. Screen readers read the same text as the field's description. This covers position, size, rotation, crop zoom and offsets, entrance and exit effects with direction, duration, delay and order, the page's transition and layout, text font, size and colour, and the table's row, column, column width, cell fill and vertical alignment. `NumberField` takes a new `hint` prop for this.
- **Buttons:** every text button has a hint: Preview with Replay and Close, Transfer format with Cancel and Transfer, crop Cancel and Apply, placeholder fill, New page (which names the layout list when the app has layouts), the chart type buttons, and the layer rows of the Layers drawer. The page pictures in the Document drawer show their name ("Show page n") as a tooltip. The chart type buttons, each row of the chart data and each layer row are a tooltip row, so a hint never covers the neighbouring controls (`GL-UI-016`).
- **Transfer dialog:** each format and each scope option ("This page", "Whole document") carries its hint on the radio and on its label alike. The transfer hints say that the dialog makes a copy and leaves the document as it is.
- **Chart data:** the series name, category name and value inputs each have a hint that says what the entry is for. The aria-label stays the field's name.
- **`Hint` around an input** (`src/ui/tooltip.tsx`, `useIsOverflowing`): for an input or textarea, the hint now checks whether the value itself is cut off, where before it read the element's text. A cut-off value shows in full above the hint in one bubble, as on truncating buttons (`GL-UI-016`). A password's value is never read. The chart's name fields use this in place of their own overflow tooltip.

**Migration:** none. Many new `slides.editor.*Hint` strings (en, de, es), among them `newPageMenuHint`, `transferFormatOptionHint`, `transferPageHint` and `transferAllHint`. GridFields and CanvasZoom get their hints in #434. Baselines: the strings table (gallery start page) in de, en and es, light and dark, and in de at 390 px and 1440 px.

## 0.159.0 — #360, SUI-FEATURE-097: EditPanel view mode with preview

Feature.

- **`mode="view"`:** the EditPanel shows a record before anyone changes it (`GL-UI-027`). It has the same panel and the same `preview` split as the edit mode, but no form, no dirty state, no save and no Back. Apps no longer need to build a view out of `mode="edit"` without `onSubmit`.
- **Footer:** "Close" (`panel.close`, with the hint "Closes the panel.") plus the app's own `actions` (new prop) to its right. The package forces no primary colour on them, and the app wraps each one in a `Hint` (`SUI-FEATURE-091`). `actions` is accepted only with `mode="view"`; anywhere else it is a type error.
- **Leaving:** Esc and Close close without asking, even when `dirty` is passed, and the focus returns to the element that opened the panel. When the view hands over to another edit panel (its Edit opens one), the focus stays in the new panel.
- The gallery's edit panel page has a view mode panel with an image preview and an Edit action, light and dark.

**Migration:** none for existing panels. Props built with `Omit<Partial<EditPanelProps>, …>` must also omit `mode` and `actions`, since the two now form one unit. The Cockpit's avatar detail and template view switch from `mode="edit"` without `onSubmit` to `mode="view"`. New strings `panel.close`, `editPanel.viewCloseHint` (en, de, es). Baselines: new `edit-panel-view` screenshots in de, en and es, light and dark; the strings table (gallery start page) in every language and theme, and in de at 390 px and 1440 px.

## 0.158.0 — #359, SUI-FEATURE-063: a MediaTile's selection and current choice show in words

Feature.

- **Selected:** a `selected` MediaTile keeps its selection ring and also carries a check badge reading "Selected" over the preview's top-left corner. The state no longer rests on the ring's colour alone (`GL-UI-060`), and `aria-pressed` is unchanged.
- **Current (new prop `current?`):** marks the picker's pinned current choice with a "Current" badge. Screen readers read it with the tile's description, and it sets no `aria-pressed`. With both set, the tile shows only "Selected".
- Both states can be told apart in greyscale: the filled check badge plus the ring for Selected, the neutral badge for Current.
- The gallery's tiles page adds a `current` tile next to the `selected` one, light and dark.

**Migration:** pickers in the apps drop their own selection markings and pass `selected` and `current` to MediaTile. The package's own pickers delegate to the app's media picker, so they had none to replace. New strings `tile.selected`, `tile.current` (en, de, es). Baselines: the tiles page in de, en and es, light and dark, and in de at 1440 px; the strings table (gallery start page) in every language and theme, and in de at 390 px and 1440 px.

## 0.157.0 — #357, SUI-FEATURE-096: InlineMessage, one error and warning line with a symbol

Feature.

- **New building block `InlineMessage`** (`@suite/ui/ui/inline-message`): a free message line with `tone: "error" | "warn"`; the children are the app's text and may hold a link. Error shows `CircleXIcon` in `--destructive-text` and is an alert; warning shows `TriangleAlertIcon` in `--warn-text` and is a status message. Both in `text-sm`, `id` and `data-testid` pass through.
- **Screen-reader prefix:** the text starts with a word only screen readers read, so the kind rests neither on colour nor on the symbol alone (`GL-UI-060`): "Error:" / "Warning:" (de "Fehler:" / "Hinweis:", es "Error:" / "Aviso:").
- **Link in the text:** underlined, in the tone's colour, in the tab order with the focus ring.
- **FieldError on it:** `FieldError` now renders an `InlineMessage` in the error tone with its field wiring (`id` for `aria-errormessage`); its API, look and spacing are unchanged, and a field error is now announced with the "Error:" prefix too.
- The gallery's components page shows both tones in a new InlineMessage section, light and dark.

**Migration:** none; apps replace their own error and warning lines outside fields with `InlineMessage`. New strings `inline.error`, `inline.warn` (en, de, es). Baselines: the components page (new section) and the strings table (gallery start page) in de, en and es, light and dark, and in de at 390 px and 1440 px.

## 0.156.0 — #354, SUI-FEATURE-230: crop mode shows the image's rest, works without a drag, applies on a press beside the image

Feature.

- **Dimmed rest:** while an image is cropped in the SlideEditor, the part of the image outside its frame shows darkened under a 50 % black scrim, as the CropEditor darkens, clipped to the page, with the frame cut out, in light and dark. With a corner radius the cut-out keeps the round corners, so the dimmed rest shows in the corners the result cuts off. A medium that does not load has no rest.
- **Panel fields:** in crop mode the PropertyPanel's Layout tab starts with a Crop section: a Zoom slider (fixed range 100–500 %, about the frame's centre, by arrows and Page Up/Down too) and Offset X and Offset Y fields in px, each clamped as a drag is. The zoom is spoken as a localized percent. Each offset field names its reach under it ("From -62.5 to 62.5 px", or "Zoom in to shift the image." at 100 %) and shows the clamped value once the focus leaves it. The fields follow drag, wheel and keys; focus moving between them, the panel's tabs and the canvas keeps cropping; Esc in them discards the crop, as in the crop bar.
- **One zoom maximum:** zoom stops at 500 % for slider, wheel and keys alike (`CROP_ZOOM_MAX` in `zoomCrop`).
- **Press beside the image:** a press on the canvas beside the whole zoomed image applies the crop and ends crop mode, one history step that Undo takes back. A press on the dimmed rest shifts the image and keeps the mode. Only Esc and Cancel discard a crop.

**Migration:** none. New strings `slides.editor.cropFields`, `cropZoom`, `cropOffsetX`, `cropOffsetY`, `cropOffsetRange`, `cropOffsetNone` (en, de, es). Baselines: the strings table (gallery start page) in de, en and es, light and dark, and in de at 390 px and 1440 px (six rows more).

## 0.155.0 — #353, SUI-FEATURE-095: one pressed style for the package toggles

Feature.

- **Pressed fill:** RowActions, GridToggle, DrawerRail and the PreviewToolbar maximize and device toggles show pressed as the full `--primary` fill with `--primary-foreground` text, in light and dark; pressed under hover goes to `--primary-hover`. DrawerRail used to show pressed in the accent colour. Unpressed toggles are unchanged.
- The value is defined once, as `PRESSED_FILL_CLASS` (`src/lib/pressed-fill.ts`) on a new `pressed` variant, which matches `aria-pressed="true"` and `aria-checked="true"`. The second copy in `preview-toolbar.tsx` is gone; a test fails if another file paints a pressed state with `bg-primary`.
- The gallery's new `pressed` page shows all four toggles off and on.

**Migration:** none. Baselines: the new `pressed` page, and the components page (the DrawerRail in the canvas-editor demo shows the primary fill).

## 0.154.2 — #346, SUI-FEATURE-220: the hover frame's dashes show on every ground

Fix.

- **Hover frame gaps:** `--background` now fills the gaps between the hover frame's `--ring` dashes. On mid-grey or saturated grounds the dashes used to blend into the ground, so the frame read as two continuous hairlines (the halos). The dashes and the filled gaps now differ by at least 3 : 1 in either theme, so hover (dashed) and selection (solid) can be told apart by the line alone, without the name badge (`GL-UI-040`). The two-tone halo from #333 and the solid selection frame are unchanged.
- The gallery's canvas edge row shows hover and selection side by side on mid-grey and on red; a test reads the pixels along both lines in both themes.

**Migration:** none. Baselines: the components page in de, en and es, light and dark, and in de at 390 px and 1440 px (the canvas edge row has two grounds more, and every hover frame has filled gaps).

## 0.154.1 — #345, CanvasOverlay: the frames keep their outer halo at the canvas edge

Fix.

- **Selection and hover frames at the canvas edge:** a frame whose element meets the edge of a canvas that clips (a scrolling canvas) lost its 1 px `--background` halo outside, so at that edge only the ring and the inner halo were left, below 3 : 1 on some grounds. Verified in the gallery in both themes, on all four edges. Each frame, with its name badge and actions, now stays 1 px inside the overlay, so the outer halo shows at every edge and one continuous 1 px line stands out at 3 : 1 there too (`GL-UX-001` rev 5).
- The gallery's canvas edge row has a selection and a hover frame flush with every edge of a clipping canvas; a test reads their edge pixels in both themes.

**Migration:** none. Baselines: the components page in de, en and es, light and dark, and in de at 390 px and 1440 px (the canvas edge row has two frames more, and the frames at its right edge sit 1 px inside).

## 0.154.0 — #342, SUI-FEATURE-210: Hint takes a shortcut

Feature.

- **`Hint` `shortcut`:** a text button in a `Hint` shows its keyboard shortcut as an icon button does (`GL-UI-006`). The prop takes the same form as on `IconButtonTooltip` (`"Delete"`, or a list of variants such as `["Ctrl+Z", "Meta+Z"]`). The hint shows the same key chip behind its text, hidden from the name and left out while the locked text shows, and the wrapped control carries `aria-keyshortcuts` with every variant. Both components share one chip and one variants helper.
- Without `shortcut`, `Hint` renders as before.
- The gallery's Hint row shows a "Delete" text button with the shortcut Delete.

**Migration:** none. New prop `Hint` `shortcut` (optional). Baselines: the components page in de, en and es, light and dark, and in de at 390 px and 1440 px (the Hint row has one button more).

## 0.153.2 — #341, SUI-FEATURE-200: names of the cuts, a talk with no visible page

Fix.

- **Names of the cuts:** in Spanish, weight 900 is now "Negra" instead of "Gruesa", so the names rise from Fina to Negra as is usual. The en and de names already matched the sheet; a test now pins all three lists.
- **No visible page:** when every page is hidden, the `SlidePlayer` says what is wrong and what to do next: no page is visible, unhide a page in the editor, and Esc or "End presentation" leaves. The message sits in a live region, is also the player dialog's description (read on focus, so it is heard when the player opens on such a deck), and has no icon.
- Verified as built in #321: the strip stays one line of fixed height with the overflow tooltip on a cut message, and a family with a number in its name keeps its name.

**Migration:** package texts changed. Reworded:

- `slides.allHidden`: en "This presentation has no visible slides." → "No page is visible."; de "Diese Präsentation hat keine sichtbaren Folien." → "Keine Seite ist sichtbar."; es "Esta presentación no tiene diapositivas visibles." → "Ninguna página está visible."
- `slides.weight.900` (es): "Gruesa" → "Negra".

New (de, en, es):

- `slides.allHiddenShow`: en "Unhide a page in the editor to present it.", de "Blende im Editor eine Seite ein, um sie zu zeigen.", es "Deja de ocultar una página en el editor para presentarla."
- `slides.allHiddenEnd`: en "Press Esc or “End presentation” to leave.", de "Esc oder „Vortrag beenden“ schließt den Vortrag.", es "Pulsa Esc o «Terminar la presentación» para salir."

An app that overrides these texts checks its wording. Baselines: the gallery overview in de, en and es, light and dark, and in de at 390 px and 1440 px (its strings table has two rows more and the texts above changed).

## 0.153.1 — #338, SlideEditor: resize cursors turn with the element

Fix.

- **Resize cursors:** each resize handle shows the arrow of the direction it points on the screen: the element's own rotation plus its groups' turn, to the nearest of the eight directions. Before, the cursor stayed fixed, so at a quarter turn the east handle sat below the element but showed a horizontal arrow.

**Migration:** none. Baselines: none.

## 0.153.0 — #336, SlideViewReport.missingFaces is required

Breaking.

- **`SlideViewReport.missingFaces`** is no longer optional: the view always fills it. The player's fallback to `missingFonts` when it was absent could never run and is gone.

**Migration:** code that builds a `SlideViewReport` itself (`@suite/ui/slides/slide-view`), such as a test double, adds `missingFaces` (an empty list when no font is missing). Code that only reads the report needs no change. Baselines: none.

## 0.152.6 — #331, contrastOf: stronger self-test for the below layer

Test-only.

- **`contrastOf` self-test:** a half-black ground over a white below layer must measure about 5.3 : 1 against black, so a helper that composites the layers wrongly fails the test.
- **`contrastOf` error:** a see-through layer is named as what it is — "the ground" or "the below layer" — instead of always "the ground".
- **Nav active bar:** verified that the bar sits in the sidebar's gutter, clear of the active row's tint, so measuring it against the sidebar background is right; the test now pins that.

**Migration:** none. Baselines: none.

## 0.152.5 — #409, SUI-FEATURE-098 rev 3: a selection never holds a group and its own child

Fix.

- **Shift-click:** with a child of a group selected, a Shift-click on the group (between its children) selects the group in the child's place. The last one clicked wins, and the frame shows it at once. Other selected elements stay. Before, both stayed selected, and "Align left" moved only the group while the child stayed put (Codex #407). Hit testing is unchanged: a click inside a selected group still hits the group.
- **Any selection set:** a selection set with a group and one of its descendants keeps only the enclosing element, also when a frame dragged with Shift adds a selected child's group. Where a child would join its selected group (not reachable by a click on the canvas), it replaces the group. Dragging, the arrow keys, align, distribute, delete and group therefore work on exactly the elements framed.

**Migration:** none. Baselines: none.

## 0.152.4 — #411, Codex review of v0.152.3: empty subgroup in the group size model

Fix.

- **Group size:** a group that holds an empty turned subgroup no longer fails when its width or height is typed or it is resized. The empty subgroup keeps its stored box, as it does when the group refits, and counts like an element of that box.

**Migration:** none. Baselines: none.

## 0.152.3 — #406, Codex review of v0.152.1: exact group size range and size solve

Fix.

- **Group size range:** the sizes a group with turned elements reaches are now computed exactly instead of sampled. Its width and height are piecewise linear in the two scale factors, so the ends lie at a kink or where a 1 px floor starts to hold. Before, the sampling could leave out sizes the group reaches (a flat group of two: width at most 515.81 instead of 516.88), and in a nested turned group it could leave out the current size (retyping the width resized the group). This also covers #405.
- **Group size solve:** `setBox` finds a turned group's scale factors in closed form from the same model instead of by Newton steps. Before, about 9% of reachable sizes were missed, and some (also with a resize handle) blew a group up to 1e10 px or more. The 1 px floor holds, and a size no scale reaches still scales the children plainly.
- A group of 500 elements: the range takes about 2 ms instead of about 25 ms.

**Migration:** none. Baselines: none.

## 0.152.2 — #328, SUI-FEATURE-190: align, distribute and the selection frame in turned groups

Fix.

- **Align and distribute:** a child of a turned group is measured where it is drawn on the page, and its step is turned into its group's frame. Before, it moved along the group's axes, so at 90° "Align left" moved it up or down the screen instead of to the left. All the steps are applied together, so the groups refit once.
- **Selection frame:** a selection with children of a turned group (also one across levels) is framed where it is drawn on the page, and align uses that frame. Before, the frame lay in the group's frame and jumped by about 40 px at 90° when a second element was added.
- **No move, no change:** a move whose steps are all zero (an Alt-drag back to the start) leaves the document as it was. Before, it rounded fractional coordinates and the document counted as changed (#329).

**Migration:** none. Baselines: none.

## 0.152.1 — #404, Codex review of v0.152.0: group size range

Fix.

- **Group size:** the range of sizes a group with turned elements reaches is now found along the direction of the two scale factors. It no longer assumes that a side grows with each factor alone. That assumption failed for a turned group nested in the group: a width of 1000 it reaches was clamped to 991.93.
- **Typing in a large group's size field:** the range takes about 300 measurements instead of about 8,500, and it is computed once per group and side. Every keystroke of a typing run reuses it. One calculation for a group of 500 elements takes about 16 ms instead of about 330 ms.

**Migration:** none. Baselines: none.

## 0.152.0 — #327, SUI-FEATURE-190: group sizes and snapping in turned groups

New, not breaking.

- **Group size:** a width or height typed in the panel that a group's turned elements do not allow (with the other side kept) sets the nearest size the group reaches, and the field names the limit: "The group's rotated elements keep it at least 70.71 px." (or "at most"), the number in the language's format, and the note is announced to screen readers. No element in the group shrinks below 1 px on the way. The other side stays. Each keystroke counts from the group before the typing, so typing 3, 0, 0 lands on 300 and does not pass through the unreachable 3 (#351).
- **Snapping in a turned group:** a child of a turned group, or several children of the same one, snaps in the group's frame: to the group's edges and centre and to its siblings, the guide drawn turned with the group. The page and the grid are no candidates there. `Alt` turns it off as before. Any other selection that includes a child of a turned group snaps by its box on the page, to the page, the grid and the other elements. Before, such a selection did not snap at all (#326).
- **Rotation of a child:** the rotation field of a child of a turned group shows the angle on the page, its own angle plus its groups', from 0 to 360°. A value typed there sets that angle on the page, and the child stores its own angle (a group at 37°: 90 typed stores 53). After a turn with Shift the field shows a multiple of 15.
- `NumberField` (internal) takes a `help` note, read with the field.

**Migration:** none. New package texts `slides.editor.sizeAtLeast` and `slides.editor.sizeAtMost` (de, en, es). Baselines: the gallery overview (its strings table).

## 0.151.0 — #312, GridToggle mode values in English

Breaking.

- **`GridToggle`** (`SUI-FEATURE-087` §4): the `mode` values are English (`GL-CODE-001`), like the rest of the grid's identifiers.

**Migration:** `GridToggle` prop `mode`: `"gekoppelt"` → `"coupled"`, `"getrennt"` → `"separate"` (type `"coupled" | "separate"`). No `data-testid` or package text changed. Baselines: the gallery's grid page (its captions).

## 0.150.2 — #401, Codex review of v0.150.1: an emptied text field

Fix.

- **Text on the canvas:** once every run of a field has been deleted, the text pasted or typed next takes the format of the run deleted last. It no longer brings back the format of a run deleted earlier. The field still resolves its spans against the runs it was filled with, and takes the empty field's format from the runs it last handed on.

## 0.150.1 — #398, Codex review of v0.150.0: text runs, placeholders in turned groups, narrow table columns

Fix.

- **Text on the canvas:** after a run was deleted, the text typed next kept the format of its own run; it no longer takes the format of the run after it (the field reads its runs against the runs it was filled with, not the normalised ones it handed on).
- **Layouts:** changing a page's layout puts an element filling a placeholder inside a turned group where the new placeholder is drawn — its box, its turn less the groups', and its centre in the groups' frame, the groups' refit taken into account — instead of using the placeholder's page geometry as the child's own.
- **Tables:** a column border of a table whose two columns are narrower together than two minimums (8 px each) no longer drags a column below zero, which made the document unsaveable; each column then keeps at least half of the two.

## 0.150.0 — #308, SUI-FEATURE-161 increment B and SUI-FEATURE-192: text and tables on the canvas, page sorter, layouts with placeholders; slide schema version 2

New. The slide schema rises to version 2.

- **Text on the canvas** (`SUI-FEATURE-161` §Text): a double click on a text field (or `Enter` on a selected one) edits it in place, turned with it and its groups, at the canvas's zoom; the field sets `select-text` itself inside the `select-none` canvas frame (#317). Typing keeps each run's format; `Enter` starts a paragraph, a paste takes plain text. The panel's Content tab holds the text's format from the brand set — font, size, bold, italic, colour — for the selected text while editing (the whole field without a selection), and the field's alignment and list; `Cmd/Ctrl-B` and `-I` switch bold and italic. `Esc` ends the editing with the field still selected; the next `Esc` goes on outwards (`GL-UI-007`). Undo and Redo in the field are the editor's: what is typed in one editing is one step.
- **Tables** (`SUI-FEATURE-161` §Tabellen): a press into a selected table picks its current cell; the Content tab inserts rows above or below and columns left or right of it, deletes its row or column (the last stays), and sets its fill from the brand set and its vertical alignment. A column border dragged shares the width of its two columns, the table keeping its box. A double click on a cell edits its text as a text field's.
- **Page sorter** in the Document drawer (`SUI-FEATURE-161` §Seiten-Sortierer): every page as a small picture; a click shows it, a drag (or the arrow buttons) moves it, and it is duplicated, hidden (the player skips it) or deleted after `ConfirmDeleteDialog` (the last page stays). "New page" adds an empty page after the one shown, blank or from a layout.
- **Layouts of the app** (`SUI-FEATURE-192`): `SlideEditor` takes `layouts` and `masters`, offered beside the document's own for a new page and in the page's Layout field (Layout tab, nothing selected); one in use is copied into the document with its master once (same id = already there). An open placeholder shows its hint on the canvas; a double click fills it with a text field, a library entry dropped on it becomes its content — in both cases a page element with the placeholder's box, turn and `placeholderRole`, and the page no longer draws that placeholder (also in the view, the player and the export). Changing the layout moves such an element into the new layout's placeholder of its role, or frees it where it is.
- **Deleting elements:** `Delete` or `Backspace` on the canvas, or the selection's new Delete action, removes the selected unlocked elements (a group left empty goes with them); Undo brings them back.
- **Library:** Text and Table entries beside the shapes.
- Every change above is one step of the history, across pages too.

**Migration:** the slide schema is version 2 (`SLIDE_SCHEMA_VERSION`): elements carry an optional `placeholderRole` (token format). A version-1 document is migrated on load without any content change (`SLIDE_MIGRATIONS[1]`, the chain's first step); a server that writes documents writes `schemaVersion: 2`, and an older `@suite/ui` names a version-2 document as newer. New exports `SlideLayoutInput`, `SlideMasterInput`; new package texts under `slides.editor` (de, en, es). The gallery's editor deck has a table on its second page and an app layout "Title". Baselines: the gallery overview (its strings table) and the slide editor page (the page's Layout field).

## 0.149.1 — #389, Codex review of v0.148.0: a library block nested too deep is left out instead of crashing the editor

Fix.

- **App blocks in the library** (`SlideExtensions.library`, `SUI-FEATURE-163`): a block is checked against the group depth and element count of a page before the recursive schema parses it, so a block with groups nested past `SLIDE_LIMITS.maxGroupDepth` (2,000 deep, say) is left out of the library like any other block that breaks the schema; the editor no longer throws `RangeError: Maximum call stack size exceeded` when it opens.
- New: `slideElementFitsLimits(element)` — whether one element, groups and all, stays within those limits, checked without recursion; whoever parses an element on its own with `slideElementSchema` asks it first.

## 0.149.0 — #387, SUI-FEATURE-250: a Button locked with a reason is `aria-disabled` and carries the reason itself

Fix, breaking for app tests and for `EditPanel` call sites without a reason.

- **A `Button` locked with a reason** (`disabled` inside `Hint` or `IconButtonTooltip` with `disabledText`) is now locked with `aria-disabled="true"` instead of `disabled` (the lock of `SUI-FEATURE-120`): it stays focusable, takes no click, `Enter`, `Space` or form submit, and names the reason as its own description (`aria-describedby`). The wrapping span is no tab stop for it anymore, so Tab reaches the button once. This holds in `EditPanel`, `ConfirmDialog`, `ConfirmDeleteDialog`, `CreateAndSelectDialog`, `RestoreDefaultsButton`, `DrawerRail`, `PreviewToolbar`, `RowActions`, `PageHeader`, `TablePagination`, `EditorHeader`, `MediaDetailShell`, the settings actions, the slide editor, and both parts of the `Grid` toggle. Controls other than `Button` (fields, a plain `button`) keep the focusable span. The tooltip is unchanged; the look is the locked one of `SUI-FEATURE-120` (dimmed in colour, focus ring ≥ 3:1; under forced colours text and border in `GrayText`). In the slide editor's chart data a read-only chart no longer names a series or category limit as the reason for its locked buttons.
- **`EditPanel` requires `submitDisabledHint` with `submitDisabled`**: the two come together or not at all; `submitDisabled` without a reason (or a reason without `submitDisabled`) is a type error.

**Migration:** app tests that check such a button with `toBeDisabled()` (Testing Library) switch to `toHaveAttribute("aria-disabled", "true")`, and read its reason from the button (`toHaveAccessibleDescription`), no longer from its parent span. Every `EditPanel` with `submitDisabled` passes a `submitDisabledHint` naming the condition that unlocks Save; a props object typed `Partial<EditPanelProps>` that sets one of the two needs both. Such a locked button now takes the focus and key events: the `Button` cancels only its activation (click, `Enter`, `Space`, form submit), so an app's own `onKeyDown`, `onPointerDown` or `onDoubleClick` on it still runs while it is locked and checks the lock itself.

## 0.148.0 — #295, SUI-FEATURE-163 increment 2 (rev 5): app extensions in the slide editor — fields, library entries, overlay; add-on ids `ext:<app>.<name>`

New. An add-on's `key` becomes `id` (no app uses it yet).

- **Add-on ids** (`SUI-FEATURE-163` rev 5): an add-on's `id` has the form `ext:<app>.<name>` (`ext:cockpit.image-filter`; lower-case letters, digits, hyphens) and is the payload key of its value. `SlideView` and `SlideEditor` refuse another form with an error naming the id (`checkSlideExtensions`, new export). A payload key without `ext:` is plain app data: the note on settings of an extension not loaded here shows only for an `ext:` key no loaded add-on of the element's type has, never for plain data.

- **Fields of an app's type** (`SlideTypeExtension.fields`): a selected element of the type shows them in the panel's Content tab, over the element's payload. `defaultSize` is its size when inserted (format px; without, a square of 20 % of the page's shorter side), and `library` gives it an entry in the element library with the payload a new element starts with.
- **Fields of an add-on** (`SlideAddOn.fields`, `label`): a selected built-in element of the add-on's type shows them under its label in the Content tab, over the value under the add-on's id; `undefined` removes the key, and an empty payload is removed. Each change is one step of the history; changes in a row to the same value merge into one.
- **App blocks in the library** (`SlideExtensions.library`): under "From this app" with the app's types; inserting a block puts a copy on the page with new ids, centred where it lands, its payloads kept. A block that breaks the schema is left out; a drag carries only the entry's id, and the drop takes the rest from the app's entries.
- An app's renderer, fields and overlay are rendered as components of their own, so they may use hooks; fields start afresh for each selected element. A built-in type with add-on fields still opens on Layout; their fields are under Content. A block without a name of its own takes its library label; an app type whose library element breaks the schema is left out of the library, as a block is. An add-on's fields that render nothing leave no heading.
- **Overlay** (`SlideExtensions.overlay`): drawn over the editor's page at its size on screen, unscaled, taking no pointer input; never in the document, the view, the player, the preview or the export.
- The note on settings of an extension not loaded here also shows on the Content tab (a chart opens on it). The `SlideAddOn` comment now says that its value is untrusted document data.
- Gallery: `?page=slide-editor&extensions=editor` adds the stamp's text field, size and library entry, a warmth field on the filter, a badge block and a safe-zone overlay.

**Migration:** `{ type, key: "filter", style }` becomes `{ type, id: "ext:<app>.filter", style }`, and the values move to that payload key. New exports `SlideFieldProps`, `SlideLibraryBlock`, `SlideOverlayProps`; new package text `slides.editor.libraryApp` (de, en, es). Baselines: the gallery overview (its strings table has one row more).

## 0.147.0 — #295, SUI-FEATURE-163 increment 1: app extensions draw the same in view, editor, player and export

New. `renderers` is replaced (no app uses it yet).

- **`extensions`** on `SlideView`, `SlideEditor`, `SlidePlayer` and `SlideExport` (and so the editor's preview): `types` holds an app's own element types by type id, each with a `label` and a `render`; `addOns` adds to the drawing of a built-in type: an add-on names its `type`, the payload `key` it reads and a `style` from that value (such as a CSS filter on an image), drawn in a box of its own around the element's drawing, so two add-ons compose. An element without the key is drawn as it is. New exports `SlideExtensions`, `SlideTypeExtension`, `SlideAddOn`, `carriesUnloadedAddOn`.
- **Without the extension** a document stays valid: an app type is a named stand-in (as before); a built-in element whose payload holds values no loaded add-on reads is drawn plain, its payload untouched, and only the editor's Layout tab notes that it carries settings of an extension not loaded here, which are kept.
- In the editor's Layers an unnamed element of an app type goes by its type's label.
- Gallery: a stamp type and an image filter (warmth, brightness from the payload key `filter`); the export harness draws the photo under that filter.

**Migration:** `renderers={{ id: render }}` becomes `extensions={{ types: { id: { label, render } } }}`. New package text `slides.editor.unloadedExtension` (de, en, es). Baselines: the gallery overview (its strings table has one row more).

## 0.146.1 — #383, Codex review of v0.146.0: an exit no longer hides the edited element; the preview measures only when it plays

Fix, not breaking.

- **An element with an exit stays on the editing canvas** (CX1): the slide editor drew its canvas in the export's end state, so adding an exit animation hid the element being edited. The canvas now draws every element as it stands; `SlideView` takes `animationStep="none"` for that. Player, preview and export are unchanged.
- **The preview measures its schedule only when it starts** (CX2): the step lengths were measured on every render of the editor, the preview closed too, once per animation step over all of the page's elements. They are now measured in one pass over the elements when a play starts (`stepLengths` replaces the internal `stepLength`).

**Migration:** none.

## 0.146.0 — #294, SUI-FEATURE-162 AC5: slide animations in the editor, with a preview

New, not breaking.

- **Entrances and exits in the panel** (`SUI-FEATURE-162` §Animationen): a single selected element shows "Animation" in its Layout tab, with an entrance and an exit, each with an effect (none, fade, slide, zoom; worded in or out per kind), the side a slide comes from (entrance) or goes to (exit), a duration and a delay in ms and its place in the page's order (shown from 1). A new entrance or exit plays after every animation the page has, its layout's and master's included; "None" removes it.
- **A page transition in the panel**: without a selection the Layout tab shows the page's transition (none, cross-fade, slide) and its duration; a new one plays 500 ms.
- **Preview** in the editor's toolbar: a dialog plays the page as the `SlidePlayer` does, without a click between the steps: its transition from the shown page before it (none on the first shown page, as in the player), then each order of its animations once the one before has played; "Play again" starts over. Under `prefers-reduced-motion` the moving effects only fade, as in the player.
- Every change is one step of the history (Undo, Redo).

**Migration:** none. New package texts under `slides.editor` (de, en, es): `animation`, `entrance`, `exit`, `animationEffect`, `animationNone`, `entranceFade` / `Slide` / `Zoom`, `exitFade` / `Slide` / `Zoom`, `animationFrom`, `animationTo`, `directionLeft` / `Right` / `Top` / `Bottom`, `animationDuration`, `animationDelay`, `animationOrder`, `ms`, `transition`, `transitionType`, `transitionNone` / `Fade` / `Slide`, `preview`, `previewTitle`, `previewDescription`, `previewReplay`, `previewClose`. New `DialogContent` size `stage` (a page or medium at its ratio, within 85 % of the height). Baselines: the slide editor and the gallery pages that show it.

## 0.145.1 — #370, GL-UI-050 rev 6, SUI-FEATURE-120 rev 7: Undo and Redo keep the focus

Fix, not breaking.

- **Undo and Redo keep the focus after the last step**: in `EditorHeader` (and so in the slide editor) the button that has nothing left to undo or redo locks itself with `aria-disabled` and the `Button`'s trigger lock instead of `disabled`, so the focus stays on it instead of falling to `<body>`. Locked, a click, `Enter`, `Space` and the shortcut do nothing; the look is the locked ghost one in colour.
- `SUI-FEATURE-161` rev 6: a test pins that a merged step dropped back to its base still clears the redo stack.

**Migration:** app tests that check a locked Undo or Redo with `toBeDisabled` check `aria-disabled="true"` instead.

## 0.145.0 — #368, SUI-FEATURE-233 rev 3: charts follow-up

New, not breaking.

- **A new chart is readable as it is inserted** (`SUI-FEATURE-233` rev 3): 4:3, its longer side 50 % of the page's shorter side (540 × 405 on a 1080 page), instead of 20 %.
- **A chart scales with its box, never at a fixed size**: its labels, legend, paddings, marks and patterns follow the shorter side of its box above 300 format px too (until now they stopped growing there). Charts larger than 300 px on their shorter side draw their text larger than before.
- **An emptied name is named by its default on the slide**: a series or category whose name is empty shows "Series 2" / "Category 2" in the legend, the axis labels and the data table for screen readers, as the panel already named it.
- **In German and Spanish a point is no decimal separator**: "1.000" is not taken as 1; it stays as typed and is marked as not a number, and the error says why ("Gib eine Zahl ohne Tausenderpunkt ein, etwa 1,5." / "Introduce un número sin punto de miles, como 1,5."). Only the comma separates decimals there; in English a comma is refused the same way, asking for a decimal point.
- **A value's error names what is wrong, below the table**: one message per row with a value that is not a number, under the table and outside its rows (so it is not read as a row of data), naming the row's category and its series that are not numbers ("Category 1 – Sales and Series 2: enter a number, such as 1.5.", the names joined in the language's own way), instead of a bare "Enter a number" one word per line in the value's column (`GL-UI-060`). Each such field points to it as its error message.
- **A category's field is as wide as its name** (within 96–160 px), so the default names are not cut off at 390 px and a name shows whole without the hint a touch screen opens only on focus.
- **Removing a category or series shows the bin** (`Trash2Icon`), as the RowActions' delete; the × stays for closing and chips.

**Migration:** none. Package texts: `slides.editor.chartNotANumber` now takes `{{category}}` and `{{names}}`; new `slides.editor.chartSeparator` (de, en, es). Test ids: a chart value's error is `slide-editor-chart-error-<row>` (was `slide-editor-chart-value-<column>-<row>-error`). Baselines: the gallery's slide pages with the showcase chart.

## 0.144.0 — #344, SUI-FEATURE-006 rev 4, SUI-FEATURE-120 rev 7: the inline link's hit area, `aria-disabled` locks in `Button`

New, not breaking.

- **An inline link hits on 24 px** (`SUI-FEATURE-006` rev 4): `size="inline"` adds `py-0.5 -my-0.5`, so a text link in a table row or a path has a hit area of at least 24 px (`GL-UI-013`) while its layout height stays the line of text's; it still sets no `h-*` and no `px-*`, and exists only with `variant="link"`. The gallery measures it in a table row and in a path.
- **`aria-disabled="true"` locks the `Button` itself** (`SUI-FEATURE-120` rev 7): without `busy`, a click, `Enter`, `Space`, the submit of a surrounding form and a press (`mousedown`, no focus change) trigger nothing; the button shows the disabled look (dimmed, `cursor-not-allowed`) and stays focusable. The dimming is in colour — the fill half-tone, the label mixed with the background, as the package's locked Save and Reset already were — not element opacity, which would dim the focus ring below 3:1 (WCAG 1.4.11); a locked look passed in `className` wins. Apps that use the package `Button` directly (`GL-UI-004`) need no lock of their own.

**Migration:** apps that check `disabled` on a running button or on a Save button locked after a save check `aria-disabled="true"` instead — such buttons are no longer `disabled` and keep the focus (`SUI-FEATURE-120`). An app's own lock around a `Button` with `aria-disabled="true"` can go, and so does its own dimming of it: an `aria-disabled:opacity-*` class on a `Button` stacks element opacity on the package's colour look, dims it twice and the focus ring below 3:1 (`SUI-FEATURE-120` rev 7) — remove it. The package's `SlidePlayer` drops its own for the same reason. Apps that rebuilt the inline hit area (`py-0.5 -my-0.5`) drop it once they pin this tag.

## 0.143.1 — #366, SUI-FEATURE-161: no empty undo step after a value taken back

Fix, not breaking.

- **A field edit taken back is no step** (`useSlideHistory`): changes folded into one step under a `merge` key that end where the step began — typed and taken back, or the field's own text undo (Cmd+Z / Ctrl+Z inside the field) — drop that step instead of leaving one that undoes nothing. The header's Undo then takes back the step before it, or is disabled when there is none; typing on in the same field starts a new step. Compared by value, as Save and Reset compare.

**Migration:** none.

## 0.143.0 — #294 (increment 4), SUI-FEATURE-162 AC4, SUI-FEATURE-233: charts in the slide editor

New, not breaking.

- **A chart from the element library** (`SUI-FEATURE-233`): the Add drawer's "Chart" entry puts a bar chart with sample data at the page's centre (by click or Enter) or under the pointer (by drag), 4:3 with its longer side 20 % of the page's shorter side; its names ("Chart", "Category 1…", "Series 1…") come from the package's texts. Each series carries its own mark beside its colour, so a bar chart with two series tells them apart in greyscale (`GL-UI-060`); its data is a table for screen readers, as `SlideView` already drew it.
- **A small chart keeps its text inside its box** (`SlideView`): a chart's labels, legend, paddings, marks and patterns are drawn at their full size from 300 format px on the box's shorter side and shrink with a smaller box, so a chart at the inserted size keeps a plot (a pie its slices) and all its text inside its box. Category labels that would run into each other are thinned to every second, third… one, a label too long for its room ends in "…"; the legend runs in rows over at most half the box, and keys that do not fit are counted at its end ("+2"). Charts of 300 px and more on their shorter side are drawn as before.
- **A chart's data in the panel's Content tab**: the chart type as a segmented control (bar, line, pie; arrow keys move along it), then a small table — the series' names on top, one row per category with its name and one value per series — every field going into the chart as it is typed, one history step per field; choosing the type already chosen is no step. A value is a decimal number, in German and Spanish with a decimal comma ("1,5", shown so too); one that is not ("1x", "0x10", in English "1,5") stays as typed, is not taken, and says so under the field ("Enter a number, such as 1.5.", the package's `FieldError`, announced); Undo or Redo clears it as in the number fields, and so does adding or removing a row or column, or another chart, so typed text never lands in another cell. A name cut off in its field shows itself whole in a hint; an emptied name shows its default name as a placeholder and is named by it to the ear. The default table fits the panel; with more series it scrolls sideways (`SUI-FEATURE-233`). Categories and series are added and removed within the schema's limits (at least one each, at most six series); a disabled button says why, and a remove button names what it removes ("Remove Series 1"). Adding or removing by keyboard keeps the focus in the table (WCAG 2.4.3): on the new name, on the remove button that took the removed one's place, or on the name once only one is left. A pie keeps every series: those it does not draw say "Not shown in a pie chart", and a value below 0 in its first series is named under the table ("A pie chart leaves out values below 0."). A change the schema would refuse is named in an error toast and not taken.
- New in `slides/editor-ops`: `chartData` (the chart's data operations) and the library entry `chart`; new module `slides/slide-editor-chart` (the panel's chart data).

**Migration:** none. New package texts (de, en, es): `slides.editor.libraryChart`, `chartCategory`, `chartSeries`, `chartType`, `chartBar`, `chartLine`, `chartPie`, `chartData`, `chartCategoryHeader`, `chartCategoryName`, `chartSeriesName`, `chartValue`, `chartNotANumber`, `chartNotInPie`, `chartNegativeInPie`, `chartRemoveCategory`, `chartRemoveSeries`, `chartMinCategories`, `chartMinSeries`, `chartAddCategory`, `chartAddSeries`, `chartAddCategoryHint`, `chartAddSeriesHint`, `chartMaxCategories`, `chartMaxSeries`, `chartInvalid`. Baselines: `gallery-*` (strings table: de, en, es in light and dark, de also at 1440 and 390 px).

## 0.142.0 — #363, SUI-FEATURE-232 rev 3 (Codex review v0.141.0 CX1, CX2): the element library's follow-ups

New, not breaking.

- **The focus goes to the new element** (`SUI-FEATURE-232` rev 3): after an insert by click, Enter, drag or a picked medium, the canvas holds the focus with the new element selected; the Add drawer stays open, and the way back to the library is the one it was.
- **A new line's stroke is 0.4 % of the page's shorter side**, in whole px and at least 1 px: 4 px on a 1080 page.
- **A see-through brand colour is never taken** (Codex CX2): each candidate is measured as it shows over the page's background, so on a black page a transparent colour does not pass for white; the first brand colour at 3 : 1, else the theme's primary colour, as before.
- **An insert past the document's element limit is refused** (Codex CX1): the document with the new element is checked against the schema first; where it would not pass, an error toast says so ("The page can’t take another element. Remove one and try again.") and nothing changes.

**Migration:** none. New package text (de, en, es): `slides.editor.insertRefused`. Baselines: `gallery-*` (strings table: de, en, es in light and dark, de also at 1440 and 390 px).

## 0.141.0 — #294 (increment 3), SUI-FEATURE-162 AC3, SUI-FEATURE-232: the slide editor's element library

New, not breaking.

- **Element library in the Add drawer** (`SUI-FEATURE-232`): shapes (rectangle, ellipse, triangle) and a line; the package's whole icon set with a search that filters as you type, at most 60 shown with "Showing 60 of N icons. Refine the search to see more."; and, where the app passes `pickMedia`, a "Media" entry that opens the app's own media picker (`GL-UI-002`). A click or Enter on an entry puts it at the page's centre — also the keyboard path for dragging — and dragging it onto the page drops it centred under the pointer. A new element is 20 % of the page's shorter side (an image its larger side, in the medium's aspect ratio, else 4:3), lies above the page's other elements, and takes the first brand colour that stands out at 3 : 1 against the page's background (else the theme's primary colour, painted into a free colour); it is selected and announced by its name ("Inserted: Ellipse", "Inserted: Arrow right", a medium by its alt text); there is no toast, the visible selection is the feedback. An icon reads by its name ("Arrow right"); a label cut off in its button shows itself whole, and every entry and the search describe themselves in a hint (`GL-UI-016`, `GL-UI-017`). The search term stays while the drawer is closed. A cancelled pick inserts nothing; a picker that fails, or a medium whose id or alt text the schema refuses, is named in an error toast with what to do next; a drop that is not an entry of the library (broken data, another kind, an unknown icon) inserts nothing. The media entry reads "Choose a media item…" under "Media library" (`GL-UI-002`). An inserted icon is named by its readable name ("Alarm clock check"), in the layers and the path too.
- New `SlideEditor` prop `pickMedia?: () => Promise<{ id, alt?, width?, height? } | undefined>`; new in `slides/editor-ops`: `libraryElement`, `insertElement` and the type `LibraryEntry`; in `slides/use-slide-assets`: `slideIconNames`; new module `slides/slide-editor-library` (the drawer's content, with `parseLibraryEntry` and `iconLabel`), and `slides/editor-color` (the colour a new element takes).

**Migration:** none. New package texts (de, en, es): `slides.editor.libraryHint`, `libraryShapes`, `libraryRectangle`, `libraryEllipse`, `libraryTriangle`, `libraryLine`, `libraryMedia`, `libraryPickMedia`, `libraryIcons`, `librarySearch`, `libraryNoIcon`, `libraryFound_one` / `_other`, `libraryCapped_one` / `_other`, `libraryInsertHint`, `libraryMediaHint`, `librarySearchHint`, `libraryMediaFailed`, `libraryMediaInvalid`, `inserted`. Baselines: `gallery-*` (strings table) and `slide-editor-*` (the rail's new Add button), each de, en, es in light and dark, de also at 1440 and 390 px.

## 0.140.0 — #356, SUI-FEATURE-231 rev 3 (Codex review v0.139.0 CX1, CX2): the format transfer scales everything with a size, starts from the whole document, and counts the master's elements

New, not breaking.

- **Everything with a size scales with the shorter side** (`SUI-FEATURE-231` rev 3, Codex CX2): besides the boxes and the text, borders and line widths, shadows (blur and offset) and the document's grid (step, gap, margin, row step; the column count stays) scale with the ratio of the shorter sides, rounded and within the schema (the grid in whole px, at most the largest format side); a visible line stays at least 1 px. Tested at 2.4, 0.3 and about 15 (into 16384 × 16384): the copy validates.
- **"Whole document" is preselected** in the transfer dialog, as in the Cockpit studio's transfer, which this one replaces; the choice reads "Whole document" (de "Ganzes Dokument", es "Todo el documento"). The dialog says "Makes a copy of this page or of the whole document in the chosen format."
- **Elements from the master and the layout count** (Codex CX1): `overflowIds` names every element a page of the copy draws that reaches past it, its master's and layout's too, and `SlideView`'s past-page notices name them on the page they are drawn on.

**Migration:** none. Baselines: `gallery-*` (strings table with the renamed choice: de, en, es in light and dark, de also at 1440 and 390 px).

## 0.139.0 — #294 (increment 2), SUI-FEATURE-162 AC2, SUI-FEATURE-231: a page or the document is transferred to another format of the app

New, not breaking.

- **Transfer format** (`SUI-FEATURE-231`): `SlideEditor` takes the app's formats (`formats: SlideFormat[]`) and a receiver (`onTransfer(copy, { overflowIds })`). Where `formats` holds a format other than the document's, the toolbar shows "Transfer format"; its dialog chooses the format and what to transfer (this page or all pages) by pointer or keyboard. The copy is always a new valid document in the target format, handed to the app, which keeps and opens it; the open document and its draft stay as they are. Each element keeps its place relative to the page and the nearest of its edges or its centre on each axis, sizes and text (size, letter spacing; a table's columns, an image's crop shift and corners) scale with the shorter side, a group with what is in it; the masters and layouts go along. `overflowIds` names the copy's elements that reach past the page. The editor confirms in a toast (`GL-UI-033`), which announces itself ("Copy in Portrait created; 1 element reaches past the page."); a copy that would fail the schema is named in an error toast with what to do next, never dropped silently (text sizes stay at least 1 px). Enter on a choice in the dialog transfers, as Enter does in a dialog (`GL-UI-027`); a format reads "Portrait · 450 × 800 px".
- **An element past the page edge carries a notice** in the editor ("Reaches past the page: Box A"), always and not only after a transfer: overflow comes from the geometry, the model gets no field for it, so the mark holds for whoever opens the copy later. It is placed as a text notice is (`SUI-FEATURE-180` §Hinweise im Editor): above the element, else beside it, else in the strip below the page, never over it. `SlideView` does the placing for both (new prop `pastPageNotices`, on in the editor); a text that does not fit its box and reaches past the page has one notice naming both ("Text doesn’t fit its box and reaches past the page: Edge"). Notices carry `data-slide-notice-kind` `text`, `page` or `both`.
- New in `slides/editor-ops`: `transferFormat` and `overflowingIds`; new module `slides/slide-editor-transfer` (the dialog). Names the app supplies (format, element, image names) are no longer HTML-escaped in the editor's texts (lock, hide, cropping, transfer).

**Migration:** none. New package texts (de, en, es): `slides.editor.transfer`, `transferTitle`, `transferDescription`, `transferFormat`, `transferFormatOption`, `transferScope`, `transferPage`, `transferAll`, `transferConfirm`, `transferCancel`, `transferred`, `transferredOverflow_one` / `_other`, `transferFailed`, and `slides.pastPage`, `slides.overflowingAndPastPage`. Baselines: `gallery-*` (strings table) and `slide-editor-*` (the toolbar's new button), each de, en, es in light and dark, de also at 1440 and 390 px.

## 0.138.2 — #351 (Codex review v0.138.1 CX1): a focused number field shows the value Undo restores

Fix, not breaking.

- **`SlideEditor`'s number fields follow the document while focused**: since 0.138.1 the header's Undo and Redo keep the focus where it is, so a number field in the panel kept what was typed (X 250) while the element went back (X 200). A field keeps what is typed, as typed, until it is left or the history goes back or forth: each Undo or Redo (by the header's buttons or their shortcut) counts a history revision, and typed text belongs to the revision it was typed in. So a focused field shows the value Undo restored, also when it was cleared, while typing goes on undisturbed where the document turns, clamps or rounds what is typed (185.5° stays 185.5 in the field, 0.5 px stays 0.5 until the field is left). The header's focus guard stays, so a crop being set still goes to Undo (#349).

**Migration:** none. Baselines: none.

## 0.138.1 — #349, SUI-FEATURE-162, GL-UI-017, GL-UX-001: crop follow-ups (Codex review v0.138.0 CX1)

Fix, not breaking.

- **Undo takes back a crop being set, also as the first edit** (Codex CX1): the header's Undo (button and Ctrl/Cmd+Z) is on while cropping even with nothing in the history, and Redo is off; before, a crop as the first edit could not be undone. A press on the header's Undo or Redo, or on Undo in its ⋯ menu where they are folded (at 390 px), no longer keeps the crop first (it left a stray step to redo): `EditorHeader`'s Undo and Redo keep the focus where it is on a press (new `data-slot` `editor-undo` / `editor-redo`), and the header's ⋯ and its menu (new `data-slot` `editor-menu`) leave it pending, by click and by Tab alike. Save keeps a crop being set and saves it; Reset drops it with everything else. Any other way out of cropping — another selection (from the layers, the path line), another page — keeps the crop as Enter does; only Esc, Cancel and Undo drop it.
- **The crop bar stays on the canvas at 390 px**: `CanvasOverlay`'s action bar is laid out at its own width (`max-content`), starts at the overlay's left edge where right-aligned it would start left of it, and is never wider than the overlay, so it wraps only where one row does not fit; the crop bar wraps, and on a narrow canvas (below 480 px) leaves its hint out, which the canvas's description still says; where it is shown and has no room it ends in "…" and shows itself whole in its overflow tooltip. Tested in de, en and es at 390 px.
- **Apply and Cancel are announced** in the overlay's live region ("Crop applied.", "Crop cancelled."; an Undo or Redo clears it), and the canvas points to the crop description with `aria-describedby` instead of `aria-description` (`GL-UI-017`).
- A crop being set is compared field by field with the stored one; a unit test covers `CanvasOverlay`'s `announcement`.

**Migration:** none. New package texts (de, en, es): `slides.editor.cropApplied`, `slides.editor.cropCancelled`. Baselines: `gallery-*` (strings table with the new keys: de, en, es in light and dark, de also at 1440 and 390 px).

## 0.138.0 — #294 (increment 1), SUI-FEATURE-162 AC1: images are cropped in the slide editor

New, not breaking.

- **Crop an image in its frame**: a double click on an image in `SlideEditor` (or Enter while it is the one element selected) starts cropping it. A drag on the image shifts it in its frame along the screen, also when the image or its groups are turned; the arrow keys shift it by 1 px (10 with Shift); + and − and the wheel zoom it about the frame's centre. The image always covers its frame (zoom at least 1, shifted no further than it reaches). Enter keeps the crop as one step of the document (Undo takes it back), Esc drops it before any outer `Esc` (`GL-UI-007`). The frame stays where it is and the file is never changed: the crop is only the image element's `crop` (zoom and shift), which `SlideView` already draws. While cropping, a crop bar stands in place of the floating actions: a short hint and the buttons Cancel (= Esc) and Apply (= Enter); the handles are hidden, only the image takes the pointer (grab cursor), and a press outside the image does nothing. Entering is announced through `CanvasOverlay`'s live region (new prop `announcement`) and the canvas describes the mode (`aria-description`). A crop being set is a change: the header and the leave guard see it, and focus leaving the canvas (to Back, Save, a drawer or another window) keeps it, as Enter does; it is never dropped without Esc, Cancel or Undo. Undo while cropping takes back the crop being set; cropping also ends when its image is gone. The crop is clamped again to the frame when it is kept.
- New in `slides/editor-ops`: `clampCrop`, `zoomCrop`, `panCrop` and the type `ImageCrop`.
- New package texts (de, en, es): `slides.editor.cropping`, `slides.editor.cropHint`, `slides.editor.cropApply`, `slides.editor.cropCancel`. New optional `CanvasOverlay` prop `announcement`.
- Gallery: the editor deck's second page carries a photo to crop.

**Migration:** none. Baselines: `gallery-*` (strings table with the new keys: de, en, es in light and dark, de also at 1440 and 390 px).

## 0.137.16 — #333, GL-UX-001 rev 5 (WCAG 1.4.11), GL-UI-040: the hover frame stands out on any ground

Fix, not breaking.

- **`CanvasOverlay`'s hover frame (`canvas-hover`) carries the selection frame's two halos** (#319): 1 px `--background` outside and 1 px `--foreground` inside its dashed 2 px `--ring` line. On a mid-grey slide the line alone reached about 1.1 : 1; now one of the halos, a continuous 1 px line, is at least 3 : 1 on a white, black, mid-grey, light-grey and saturated slide in either theme, which is what `GL-UX-001` rev 5 (§3:1 bei Linien) asks; the dashed line itself does not count. It stays dashed and 2 px (`GL-UI-040`), and lies below the badge, the action bar and the snap guide as before. A gallery test reads the computed colours of both frames, checks them opaque and fails on the old hover frame.

**Migration:** none. Baselines: `components-{de,en,es}-{light,dark}` and `components-de-{light,dark}-{390,1440}`.

## 0.137.15 — #332, SUI-FEATURE-161 rev 5: the snap guide is drawn in the primary colour with a halo

Fix, not breaking.

- **`SlideEditor`'s snap guide follows the spec**: 1 px in `--primary` with a 1 px `--background` halo instead of a fixed `#c026d3` without one. On a mid-grey slide the old colour fell below 3 : 1; now the line or its halo is at least 3 : 1 on a white, black, mid-grey (`#808080`) and light-grey (`#b3b3b3`) slide in either theme. The guide is also drawn above the selection frame, which covered it along the moved element's own length, and below the frame's name badge: `CanvasOverlay`'s badge lies a layer up (`z-[1]`; the overlay's root makes no stacking context), so a line an app draws over the frame after the overlay passes under it; the overlay's own action bar and insert buttons share the badge's layer and come after it, so they stay over it where they meet, and the editor's handles lie a layer above it (`z-[2]`) as before. The gallery test reads the computed colours, checks them opaque, reads the guide's pixel where it lies on the frame and the badge's pixels with a centre-snap guide under it, and fails on the old guide.

**Migration:** none. Baselines: none.

## 0.137.14 — #325: the release script's tests start without spawning git per test

Not breaking. Tests only, the package is unchanged.

- **`scripts/release.test.ts` no longer waits on git processes in its per-test hooks**: each test spawned four git processes in its `beforeEach` (five more in the review tests), whose start-up a loaded gate slowed until "logs an empty range" hit the 10 s hook timeout once. The starting repos are now built once per file (`beforeAll`, with a 60 s timeout that matches spawning a handful of git processes on a loaded machine) and copied per test, file system work only. Under 32 CPU hogs with 8 runs of the file in parallel, the per-test hooks went from a mean of 72 / 55 ms (max 224 ms) to 18 / 22 ms (max 104 ms); 32 runs in a row green.

**Migration:** none. Baselines: none.

## 0.137.13 — #324, SUI-FEATURE-161, GL-UI-040: a child of a turned group is framed and handled where it is drawn

Fix, not breaking.

- **Frame, name badge, handles and turn handle lie over the child as it is drawn**: for a child of a turned group (nested turned groups included) `SlideEditor` places them with the groups' turn: the frame around the child's drawn box, the handles on its turned box. Before, they stood on the child's unturned box, so the visible east handle dragged sideways did nothing and a small move of the turn handle jumped (e.g. to −109°).
- **Every resize handle and the turn handle follow the pointer on the screen**, at a quarter turn and at an odd angle; the turn is measured where the child is drawn and its own rotation is what remains after the groups' turn.
- **Shift turns in steps of 15° on the screen**: the child's own angle plus its groups' turn is a multiple of 15°.
- New in `slides/editor-ops`: `outOfGroups` (the reverse of `intoGroups`) and `placedBox`; `rotationTowards` takes the groups' turn as an optional fourth argument.

**Migration:** none. Baselines: none.

## 0.137.12 — #323, SUI-FEATURE-161: the slide editor's turned-group behaviour is pinned by tests

Not breaking. Tests only, the package is unchanged.

- **A child of a turned group is nudged, resized and turned in the group's frame**: gallery tests press the arrow keys, drag a side handle and drag the turn handle on a child of a group at a quarter turn, and check where it is drawn and what its fields read. Each of the four steps put back to page coordinates (nudge, resize, turn, and snapping inside the group) fails a test.
- **The canvas selects no text, and a child of a turned group never snaps to the page's lines**: a gallery test reads `user-select: none` on the canvas frame and drags such a child without Alt, with no guide and no jump.
- **A selection across levels** moves each element in its own frame, by arrow key and by drag: shipped and tested with #326 (0.137.8). The `moveEach` unit test now also checks the turned child, not only the loose element.

**Migration:** none. Baselines: none.

## 0.137.11 — #321, SUI-FEATURE-180 rev 4: slide notices name font cuts in the UI's language, an all-hidden deck says so, and no notice is cut off

Fix, not breaking.

- **Missing font cuts are named, not numbered** (`SUI-FEATURE-180` rev 4): `SlideView`'s strip and `SlidePlayer`'s hint group them by family with the cut's name from the package's texts, "Inter (Bold, Bold italic, Italic)" / "Inter (Fett, Fett kursiv, Kursiv)" / "Inter (Negrita, Negrita cursiva, Cursiva)"; a weight between the named ones reads as the nearest. A family with no file at all is named alone as before, its name whole even where it ends in a number ("Source Sans 3", "Bodoni 72"). `missingFonts` in the report keeps "Inter 700 italic" for the app; the new optional `missingFaces` carries the same faces as family, weight and style, from which the view and the player name them. An italic run without an italic file is missing, the regular file does not stand in for it (now pinned by a test).
- **A deck whose pages are all hidden says so**: `SlidePlayer` shows "This presentation has no visible slides." instead of a black screen once its bar hides, in the style of its hint (`bg-background/80`, `text-foreground`).
- **The strip below the page never cuts a notice off silently**: each message ends in "…" where the strip is too narrow and shows its full text in the overflow tooltip (`GL-UI-016`), and the texts with no room beside them form one message naming them all (`data-slide-notice-for` lists their ids, space-separated).
- **A notice above a text near the right edge stays on the canvas**: it starts at the text's left edge as before but gives way at the view's right edge.
- **No empty band below the page**: when the smaller page of the second layout pass leaves room for every text notice, there is no strip and the page is centred in the whole view.

**Migration:** none. New package texts (de, en, es): `slides.fontFaces`, `slides.weight.100`–`slides.weight.900`, `slides.italic`, `slides.italicFace`, `slides.allHidden`. New exports `missingFontsText`, `missingFaceName` and the type `SlideMissingFace` from `slides/use-slide-assets`; new optional field `missingFaces` in `SlideViewReport`. Baselines: `gallery-*` (strings table with the new keys) and `slides-*` (the new `slide-fit-edges` case), each de, en, es in light and dark, de also at 1440 and 390 px.

## 0.137.10 — #319, GL-UI-040, SUI-FEATURE-070: the selection frame stands out on any ground, the name badge meets it without a seam

Fix, not breaking.

- **`CanvasOverlay`'s selection frame (`canvas-selection`) carries a two-tone halo**: 1 px `--background` outside and 1 px `--foreground` inside the 2 px `--ring` line. On a mid-grey slide the line alone reached about 1.1 : 1 and all but vanished; now the line or one of the halos is at least 3 : 1 on any ground in either theme (white, black, mid-grey, light grey and saturated are tested, the colours checked opaque). The hover frame is unchanged.
- **The name badge (`canvas-name`) meets the frame without a seam**: it lies over the frame's line, and its 1 px `--background` halo stays off the line and the inner line. Above the frame the halo ends on the frame's outer edge, so the line runs on unbroken beside the badge and no halo lies under the badge's bottom; inside the frame it starts past the inner line. Where the badge reaches past the frame (moved left at the overlay's edge, also inside a narrow frame at the page's top), that part keeps its full halo. Like the frame, the badge and its halo stay hidden from screen readers; the selection is announced with its full name. The halo is now drawn as elements under the badge (`canvas-name-halo`, `canvas-name-halo-overhang`) instead of a `ring` on it, and the badge sits beside the frame element in the overlay, no longer inside it. A gallery test reads the line's pixels beside the badge and checks that no halo piece lies on the lines, above and inside the frame; the gallery's edge row has a third frame with a wide badge inside a narrow selection at the top.

**Migration:** none. No prop, export or text changed; new testids `canvas-name-halo` and `canvas-name-halo-overhang`; `canvas-name` is no longer a descendant of `canvas-selection`. Baselines: `components-{de,en,es}-{light,dark}` and `components-de-{light,dark}-{390,1440}`.

## 0.137.9 — #318: the gallery's contrast check counts a see-through colour as what shows

Not breaking. Gallery tests only, the package is unchanged.

- **`contrastOf` draws the colour over its ground** before it measures: a transparent colour read back as black and a half-transparent one as fully opaque, so a contrast test (the focus-ring, nav-bar and canvas-badge tests) could pass on a see-through colour. Now a transparent colour has contrast 1 with its ground and fails every such test. A see-through ground is drawn over what lies below it, and without that it is refused: the keyboard-highlighted menu entry's tint is see-through, so its ring is now measured on the tint over the popover (still at least 3 : 1). A gallery test pins all of this.

**Migration:** none. Baselines: none.

## 0.137.8 — #326, SUI-FEATURE-190 (Codex review v0.137.7 CX1): a selection across levels moves each element in its own frame

Fix, not breaking.

- **A selection across levels nudges and drags each element in its own frame** (Codex CX1): with a child of a turned group and a page-level element selected together (Shift-click), the arrow keys and a drag measured the step only in the first element's groups, so the other element moved the wrong way. The editor now turns the step into each element's own groups, applies all moves together and refits the groups once. Such a selection does not snap while any of its elements stands in a turned group (open architect question 4080).

**Migration:** none. Baselines: none.

## 0.137.7 — #317, SUI-FEATURE-161, GL-UI-007 (Codex review v0.137.0 CX1–CX3): the slide editor saves only on `true`, resizes groups without invalid children, and drags and nudges in a turned group's frame

Fix, not breaking.

- **Save counts only `true` as success** (Codex CX1, high): `SlideEditor` marked the draft saved, and let a held way out go on, for any `onSave` result but `false` (`undefined` included). Now only `true` (or a promise of it) is success, as `GL-UI-007` says; anything else keeps the draft and holds the leave.
- **Resizing a group never gives a child a negative size** (Codex CX2): a size typed for a group with a turned child that no positive scale reaches no longer forces negative factors; the children scale plainly and the group takes the box they make. Where the size can be reached it is still exact.
- **A child of a turned group is dragged and nudged where the pointer goes** (Codex CX3): the editor measures a drag and the arrow keys in the frame of the groups the element stands in; inside a turned group a drag does not snap to the page's lines. Resizing and turning such a child stay limited: its frame and handles are still drawn unrotated, so they do not lie where the child is drawn (#324). The canvas also no longer selects text, so a double click into a group followed by a drag is no native text drag.

**Migration:** an app whose `onSave` signals success by returning nothing must now return `true` (as documented); otherwise its saves keep the draft. No package text, prop, export or testid changed. Baselines: none.

## 0.137.6 — #305, #309, SUI-FEATURE-180, SUI-FEATURE-160 (Codex review v0.136.0 CX1–CX3, ux recheck #292): notices never off the canvas, a clicked bar button lets the bar hide, and three view fixes

Fix with a behaviour change: text in a weight or style the app supplies no font file for is now reported as a missing font (`missingFonts`, named "Family 700"), and an export stops on it; before, it was drawn silently with a synthesized cut.

- **A text notice with no room beside its text goes into the strip below the page.** When the box of a text that does not fit leaves no room above it and none to its right or left (a wide text at the page's top), `SlideView` names it in the strip of page notices below the page instead of placing it mostly off the canvas (`SUI-FEATURE-180`).
- **A mouse click on a bar button of `SlidePlayer` takes no focus**, so the bar hides again after a few seconds as on any other input; keyboard focus on a bar button still holds it, and the keys stay with the player.
- **A deck whose pages are all hidden shows none of them** (Codex CX1): the player draws no page and counts "0 / 0"; before, it drew the first hidden page.
- **A font file that failed counts as a missing face even when another face of the family loaded** (Codex CX2): the view checks each face a text needs (family, weight, style) against the files that loaded (a variable font's weight range included) and names a missing one as "Family 700" or "Family 400 italic"; a family with no file at all is named as before.
- **`scale="fit"` recovers when an invalid document becomes valid** (Codex CX3): the view measures its box as soon as its root appears, not only when `scale` changes.

**Migration:** none for the API. A document whose text uses a weight or style with no supplied file now reports that face in `missingFonts` (and the export stops on it) where it was silently drawn with a synthesized cut before: supply the file for every weight and style the brand set uses. Baselines: 10 `slides-*.png` (the new wide-text case: de, en, es in light and dark, de also at 1440 and 390 px).

## 0.137.5 — #316, SUI-FEATURE-161 rev 5, GL-UI-040: the canvas name badge stands out on any page

Fix, not breaking.

- **`CanvasOverlay`'s name badge (`canvas-name`) carries a 1 px `--background` halo**, so it stands out on a light and a dark page in either theme: in the dark theme the near-white badge was barely visible on a white slide. The badge or its halo is at least 3 : 1 against white and black, its text stays at AA; a gallery test checks the computed colours in both themes. Baselines: `components-{de,en,es}-{light,dark}` and `components-de-{light,dark}-{390,1440}`.

## 0.137.4 — #320

- chore: git-ignore .playwright-mcp/ #320

## 0.137.0 — #293, SUI-FEATURE-161 rev 5 (increment A), GL-UI-040, SUI-FEATURE-087: the slide editor — a free canvas with selection, transform, layers, arranging and the grid

Feature, not breaking. Increment A of the slide editor (`SUI-FEATURE-161` ACs 1, 2, 3, 6); text, tables, the page sorter and masters/layouts follow in #308.

- **`SlideEditor`** (`@suite/ui/slides/slide-editor`): the page of a slide document on a free canvas (`GL-UI-040`) from the package's own parts: `EditorHeader` with Undo, Redo, Save and Reset, `DrawerRail` (Layers, Document), `SlideView` under `CanvasOverlay` and `CanvasZoom` (Fit · 100 %), and `PropertyPanel` with the path (Document › group › element). Save hands the validated document to the app (`onSave`; `true` reports success); Back and `Esc` with a draft ask first (`useEditorLeaveGuard`, `GL-UI-007`).
- **Select** by click, Shift-click (adds or removes) or a frame dragged over empty canvas; locked and hidden elements are not hit on the canvas. A double click on a group selects the child under the pointer, also in a turned group, and clicks then stay among its siblings. Over a selectable element the pointer shows Move. `Esc` goes from the inside out: a child's group, no selection, an open drawer, and only then leaving (`GL-UI-007`). **Drag** the selection; **resize** at eight handles, the opposite side staying, Shift keeping the ratio, also on a turned element; **turn** at the rotate handle, Shift in 15° steps; the **arrow keys** move by 1 px, with Shift by 10. X, Y, width, height and rotation stand as **number fields** in the panel and apply as they are typed, one step per field; width and height are at least 1 px and every value stays within twice the largest format side, so nothing typed loses an element or overflows; a locked element's fields are read-only. The arrow keys work on after a resize or turn (the canvas keeps the focus).
- **Snapping** while dragging: edges and centre to the page, the other elements and the grid, with a guide 1 px above the grid in a colour of its own that stands out on a light and a dark slide in either editor theme (at least 4.4 : 1 against white and black), which itself lies above the elements; at a tie an element or the page wins over the grid; `Alt` holds it off; a hidden grid never snaps (`SUI-FEATURE-161` rev 4), the page and elements still do. The grid is the document's (`GridFields` in the Document drawer); whether it is shown is the person's view state (`gridShown`, `onGridShown`, with `GridToggle`).
- **Layers**: forward, backward, to the front, to the back; the Layers drawer lists the page's elements topmost first, groups with their children, each with Lock and Hide, each showing its state by its own icon (lock open/closed, eye open/closed), a hint and `aria-pressed`; a hidden element's name is struck through. **Group** two or more elements of one list (the group takes the topmost one's place) and **ungroup** (the group's rotation, opacity, hidden and locked pass to its children); a group's box follows its children after every change (`SUI-DESIGN-002` §Gruppen), a turned group shifting so nothing it holds moves where it is drawn; a size typed for a group with a turned child is the size it gets. Group and Ungroup leave locked elements alone. **Align** edges and centres to the selection, or to the page for one element; **distribute** three or more horizontally or vertically (with fewer, the buttons are locked and say why); both go by the box an element is drawn in, also turned. Group and Ungroup stand with the layer actions, which also float at the selection (`GL-UI-040` §5), below the handles, so every handle stays reachable at any angle. A change that changes nothing adds no step.
- **History**: every change of the document is a step of `useSlideHistory` (`@suite/ui/slides/use-slide-history`): `Cmd/Ctrl-Z`, `Shift-Cmd/Ctrl-Z` and the header's Undo and Redo, across pages, each showing the page its step changed; a drag is one step, typing in a field one step per field (`merge`). The changes themselves are pure functions in `@suite/ui/slides/editor-ops` and `@suite/ui/slides/editor-geometry`.
- A document the schema refuses shows the header with Back (and `Esc`) and the named error; a draft Save cannot hand on names its first issue under the header.
- An app's own element types (`renderers`) are selected, moved, resized, turned and layered like the built-in ones.
- **`GridOverlay` draws a fine grid thinned**: at most `GRID_MAX_LINES` (512) lines per axis and at least 4 screen px apart, so step 1 on a 16384 px side stays responsive; snapping still uses every line.

**Migration:** `useLeaveGuard` (and `useEditorLeaveGuard`) no longer leave on an `Esc` while a package `Esc` layer is active (a canvas selection, an open drawer, a maximized preview): that layer takes it first (new export `hasEscapeLayer` in `lib/escape-layers`). `GridOverlay` no longer draws every line of a grid finer than 4 screen px (new export `GRID_MAX_LINES`). New subpaths `slides/slide-editor`, `slides/editor-ops`, `slides/editor-geometry`, `slides/use-slide-history`. New package texts (de, en, es): `slides.editor.*` (page, previousPage, nextPage, x, y, width, height, rotation, degrees, arrange, forward, backward, front, back, group, ungroup, align, alignLeft, alignCenter, alignRight, alignTop, alignMiddle, alignBottom, distribute, distributeHorizontal, distributeVertical, distributeNeedsThree, lock, hide, selection, document, format, gridUnavailable, saveFailed, type.*). Baselines: 10 `gallery-*.png` (strings table: de, en, es in light and dark, de also at 1440 and 390 px); new 10 `slide-editor-*.png`.

## 0.136.3 — #313

- test: wait for the restored address after the leave dialog opens #313

## 0.136.2 — #310, SUI-FEATURE-150 rev 6, GL-UI-007: the guard holds a `BrowserRouter` on its own window

Fix, not breaking.

- **Under `<BrowserRouter window={own}>`, browser back and forward and a guarded leave are held as with the global window** (review #306). The navigator wrapper listened to the global window's `popstate` and read and stepped its history, so a back on the router's own window passed a dirty page without asking. New `LeaveGuardWindow`: wrap the router in `<LeaveGuardWindow window={own}>`; it installs the guard's listener on that window as it renders, before the router mounts, and the guards inside hold on it and read its history. `installLeaveGuard(win?)` takes the window to install on (the global one by default). The #306 tests dispose their routers in `finally`.

**Migration:** only for apps with their own window: wrap the router in `<LeaveGuardWindow window={own}>` (same-origin windows only). In development, a hold under a router whose window the guard was not told of warns; the "not installed" warning names `LeaveGuardWindow` too. New export `LeaveGuardWindow`. Baselines: none.

## 0.136.1 — #306, SUI-FEATURE-172 rev 4, GL-UI-007: the guard reads the router's own window

Fix, not breaking.

- **A guarded Back that is a browser step (`guard(() => navigate(-1))`), let go with Discard during a submission, lands at its entry also under a browser router created with its own `window` option** (review #304). The guard read the global window's history for the router's index, so such a router was taken for one without the window's history and, after a submission that pushed, stepped from the wrong entry. It now reads the router's own window (`router.window`). A test under `createHashRouter` covers the same step there; the history state the #303/#304 tests set is reset in `finally`.

**Migration:** none required. Baselines: none.

## 0.136.0 — #292, #299, SUI-FEATURE-160 rev 4, SUI-FEATURE-180 rev 3, SUI-DESIGN-002 rev 7 (Q&A #4050, Codex review v0.135.0 CX1, reviews #292): SlideView, SlidePlayer and the headless export draw a slide document in the DOM

Feature, not breaking. Step 1 of the slide editor: the view the editor, the presentation and the export draw with.

- **`SlideView`** (`@suite/ui/slides/slide-view`) draws one page of a slide document: every element absolutely in the format's px, layer as stacking order (master below layout below page), rotation, opacity, image crop and flip, shapes, lines and charts as SVG, tables as a real table, icons from the package's icon library (lucide, one module per icon), groups with their children in page coordinates. The whole page sits under one scale: `scale="fit"` fits it into the view's box with its aspect ratio, a number scales by it. It checks the document itself (`safeParseSlideDocument`) and draws nothing of one that breaks the schema. Every CSS value comes from the validated document or a brand value that passes the same grammar (`isSlideColor`, `isSlideFontFamily`, new exports); an image URL is an `<img>` source, never CSS. An app type draws through `renderers` by type id; without one, as an unknown icon or one whose import failed (tried again by the next view), and a media id the app does not resolve or whose image does not load (a new URL for it is tried again), a named stand-in takes its place, the same in light and dark. A brand colour key the brand set lacks is named on the view ("Brand colour missing: …") and in `data-slide-missing-brand`.
- **Fonts** come only from files the app passes in `fonts`, from the page's own origin, `blob:` or an http(s) origin the app passes in `fontOrigins` (its media store), loaded with `FontFace` without following redirects; a file from any other origin counts as a missing font; the page is drawn once they have loaded. A family without a file names itself on the view ("Font missing: …"). A run without a font uses the brand key `body`, without a size 32 px, without a fill the brand colour `text`; nothing inherits from the app's CSS.
- **Fit text** (`fitText`, default off): text that overflows its field shrinks, down to 70 % of its size; below that the view names the element ("Text doesn’t fit its box: …") outside its box and its spilled text, above it or, without room, beside it, never over its text (`SUI-FEATURE-180`); missing fonts and brand colours are named in a strip below the page, which gives up the strip's height; the report keys it by element, so equal or empty names neither cancel nor drop one. Off, text overflows visibly.
- **`SlidePlayer`** (`@suite/ui/slides/slide-player`): a modal dialog over every page that is not hidden (full screen where the browser allows it): everything behind is inert, Tab stays inside, and on close (`Esc`, Close, leaving full screen) the focus returns to the control that opened it. On with →, ↓, Page Down, space, Enter or a click, back with ←, ↑, Page Up, Backspace; each step plays the next order of the page's animations (a master's and layout's too), back undoes one; the next page comes with its transition, the outgoing page fading out over it. A bar with Back, Next, the counter "n / m" and Close (icon buttons with names) appears on any pointer move, tap or key and hides after 3 s without input; it stays while hovered or while one of its buttons has the focus, each on its own. A hidden bar never takes a click: a tap or a quick click on its strip only shows it (no button acts, the page stays), a tap on the slide pages on and shows it. The last page stays: Next is locked there and the counter shows "m / m". A locked Next or Previous is `aria-disabled` and keeps the focus, so the keys go on working. A page with a problem (missing font, text that does not fit, missing brand colour) shows the presenter a short hint at the edge that fades after 5 s, and `onReport(report, page)` tells the app once per page, again only when that page's problems change. Under `prefers-reduced-motion` every animation only fades (`styles.css`), the bar and hint appear without transition. `startPage` past the end starts at the last page.
- **Export**: `SlideExport` (`@suite/ui/slides/slide-export`) draws every shown page at scale 1 in the end state of its animations, one print page each; `exportSlidePages(page)` (`@suite/ui/slides/export`, Node, no Playwright dependency) takes one PNG per page and a PDF with real text from a Playwright page the app opened on its export route, and stops with a `SlideExportError` instead of writing a page that differs. It lists every problem with its reason (`problems`; `code` and `items` are the first one's): `missing-fonts`, `overflowing`, `missing-media` (also an image that did not load), `unknown-types`, `unknown-icons`, `missing-brand`, `invalid` (with the document's error code), `not-ready`, `no-export-page`. The PNG equals the editor's view pixel for pixel.
- **The exported `slideDocumentSchema` carries the structural preflight** (Codex v0.135.0 CX1): group depth, elements per page and the list lengths are checked before the recursive parse, so `slideDocumentSchema.safeParse` rejects 33 nested groups or 5001 elements on a page with a named issue (`group-depth`, `too-many-elements`, `too-big`) and returns one for 1000 nested groups instead of throwing a `RangeError`. `parseSlideDocument` and `safeParseSlideDocument` use that schema.
- **Accessibility**: text stays text, images carry the model's alt text, a chart carries its data as a table for screen readers.

**Migration:** none required; nothing existing changed. New subpaths `slides/slide-view`, `slides/slide-player`, `slides/slide-export`, `slides/export`, `slides/render-style`, `slides/use-slide-assets` under the existing `./slides/*`; the barrel `slides/index` stays free of React. `slideDocumentSchema` keeps its types (`SlideDocument`, `SlideDocumentInput`) and now rejects what only the load functions rejected before; it is a pipe now, not a `ZodObject`, so `.shape`, `.extend` and `.pick` are gone from it (no app used them; keeping them would expose the unguarded parse). New prop `fontOrigins`. New exports `SlideView`, `SlidePlayer`, `SlideExport`, `exportSlidePages`, `SlideExportError`, `isSlideColor`, `isSlideFontFamily` and the types `SlideViewProps`, `SlideViewReport`, `SlidePlayerProps`, `SlideExportProps`, `SlideExportPage`, `SlideFontFile`. New package texts (de, en, es): `slides.missingBrand`, `slides.previous`, `slides.next`, `slides.close`, `slides.counter`, `slides.unknownType`, `slides.missingMedia`, `slides.unknownIcon`, `slides.missingFonts`, `slides.overflowing`, `slides.invalid`, `slides.player`, `slides.position`. New keyframes `suite-slide-*` in `styles.css`. New dev dependency `pdfjs-dist` `^6.4.299` (gallery test only). Baselines: 10 `gallery-*.png` (strings table with the new keys: de, en, es in light and dark, de also at 1440 and 390 px); new 10 `slides-*.png` and 10 `slide-player-*.png` (de, en, es in light and dark, de also at 1440 and 390 px); the player is captured once its bar has hidden.

## 0.135.5 — #304, SUI-FEATURE-172 rev 4, SUI-FEATURE-150 rev 6, GL-UI-007: a memory router is never taken for a browser router

Fix, not breaking.

- **Under a memory router, a guarded Back that is a browser step (`guard(() => navigate(-1))`), let go with Discard during a submission, lands at its target once the submission succeeded, also when it steps to the router's first entry** (Codex review v0.135.4, CX1). That entry has the key `"default"`, as a browser router's entry without a key; when the window's history entry had an `idx` but no key (as the first entry a browser history leaves), the guard read the window's history as the router's, and the change was dropped after the submission. The guard now reads the window's history only for a router whose history owns it (browser or hash), so a memory router's step goes by the step it came with.

**Migration:** none required. Baselines: none.

## 0.135.4 — #303, SUI-FEATURE-172 rev 4, SUI-FEATURE-150 rev 6, GL-UI-007: a browser step that never arrives leaves no pass

Fix, not breaking.

- **A guarded Back that is a browser step (`guard(() => navigate(-1))`), let go with Discard during a router submission, no longer leaves its pass behind when the step never arrives** (Codex review v0.135.3, CX1; e.g. `go(-1)` at the tab's first entry fires no `popstate`). Before, the pass and the deferred `onDiscard` waited for the next browser step, which then left the changed page without asking and reset its draft. Now they count only for a step to the entry the Back targeted, and never past the next route change: any other change asks the page as usual, and the draft stays, since the way never went. A step whose `popstate` comes only after the submission ended still passes the page once, without a second question. Under a memory router, where the target entry is not known, they last as long as the submission.

**Migration:** none required. Baselines: none.

## 0.135.3 — #301, #302, SUI-FEATURE-150 rev 6, SUI-FEATURE-172 rev 3: a guarded Back confirmed during a submission waits for it

Fix, not breaking.

- **A way out wrapped in `guard` (a Back) that the leave question let go during a router submission no longer cuts that submission off.** Under a data router its route change now waits for the running submission like any held change: after a success it lands at its target, without asking the page again, and a Discard's `onDiscard` runs then (`SUI-FEATURE-172`); after a failure the change is dropped, `onDiscard` never runs, and the draft and the error stay (before: the route changed at once, aborting the submission). The same holds for Save in the question, and for a Back that is a browser step (`guard(() => navigate(-1))`), whose step the router sees only later. A guarded way that changes no route still goes at once, with its reset (a panel closing during a foreign submission: Q&A #4058 is open).
- **While a page's Discard holds a waiting change, a further guarded way of that page asks nothing** (Back again, `Esc`): it takes the waiting change's place, as a navigation click does (`SUI-FEATURE-172`; before: "Save changes?" opened again, and its Cancel kept nothing).
- **A newer change that took the waiting one's Discards over and is then cancelled drops them** (Codex review v0.135.2, CX1, #302). Before, they stayed with the waiting change, so a third change passed the page silently and reset the input made after that Cancel. Now that third change asks the page again, and only its own answer counts. A third change that displaces the newer one while its question is still open takes the Discards on, so the page is not asked again.
- A browser step back to the first history entry carries its pass and the deferred resets like any other step; the gap noted in #287 was not one (the cause was the page gone after a redirect, fixed in 0.135.2). Tests pin it now.

**Migration:** none required. Baselines: none.

## 0.135.2 — #287, SUI-FEATURE-172 rev 3, SUI-FEATURE-150 rev 6, GL-UI-007 (Q&A #4051, #4053): Discard during a running submission resets the draft only when the way goes

Fix, not breaking.

- **`onDiscard` runs only once a route change that waits for a submission goes.** Under a data router, Discard in "Save changes?" while a router submission still runs leaves the draft as it is while the change waits. After the submission succeeded `onDiscard` runs once as the change goes (after a redirect the page may be gone by then), and the page passes without a second question; `onDiscard` is read when it runs, so it is the one of the latest render. When the submission fails the change is dropped, `onDiscard` never runs, and the page keeps the entries the error refers to (before: the draft was reset at once and was gone after a failure). This holds for a link or `navigate`, a held submission of another form and a browser step alike; a guard asked again on the way (a second guard changed meanwhile, or the page after an Apply in a panel) counts with its latest answer, so each reset runs once. Without a running submission, and for a way out that is no route change, `onDiscard` runs at once as before, also when another guard's Cancel then keeps the page.
- **The newer click wins** (`SUI-FEATURE-172` AC3): a route change made during the wait takes the waiting one's place, passes the guards that confirmed Discard without asking again, takes their resets along and lands at the newer target after the submission succeeded. Guards without a confirmed Discard ask as usual.

**Migration:** none required. Baselines: none. Known limit (`SUI-FEATURE-172`): input made during the wait falls under the confirmed Discard and is dropped with the draft when the change goes; the guard knows only `dirty`, not the values, so it does not ask again.

## 0.135.1 — #285, SUI-FEATURE-171 rev 3, GL-UI-027, GL-UI-007: Back and Cancel explain the panel's work, and the focus stays on it

Fix, not breaking.

- **While an `EditPanel` works, Back and Cancel both show the working hint** ("An action is running; available again once it has finished.", de/en/es) instead of their ask-first hint, also while Back is held during the work of a promise from `onSubmit`; once the result is in, their hint by `submitKind` returns (`SUI-FEATURE-171`). Back still waits for that work and Cancel stays locked, for `save`, `next` and `apply` alike. A Back the call site locked with `backDisabled` keeps its own `backDisabledHint` meanwhile, as it stays locked after the work (before: under `busy` it showed the working hint).
- **The leave dialog that closes into a working panel hands the focus to its working primary action** (`SUI-FEATURE-171` AC5). When Save or Apply in "Save changes?" / "Apply changes?" turns on the call site's `busy`, the focus goes to the busy Save/Apply, whatever opened the dialog: Cancel, Back, Previous/Next or `Esc` in a field (before: a locked Cancel or Back dropped it to the panel container). A dialog that closes into a panel that is not working returns the focus to what opened it, as before.
- As decided in `SUI-FEATURE-171` rev 3 (AC4): under the call site's `busy` alone (a synchronous `onSubmit`) the panel knows no success, so a way out meanwhile is dropped and the panel stays open; to have it wait, return a promise from `onSubmit`. The pager is not shown locked while the panel works: Previous/Next are ways out that are held (or dropped under `busy`), as `SUI-FEATURE-150` says, and `GL-UI-027` locks only the primary action.

**Migration:** none required. Baselines: none.

## 0.135.0 — #291, SUI-DESIGN-002 rev 7, SUI-FEATURE-087 rev 7, GL-UI-040 (Q&A #4036, #4038, #4039, #4040): the slide document model — one Zod schema for the slides and layouts of every app; the grid's identifiers in English

Feature; breaking for the grid's identifiers (below). New subpath `@suite/ui/slides/*` (`slides/index` re-exports all): the slide document as JSON that apps and servers check with the same schema. A document carries its format (data: name, width, height; the package ships `FORMAT_16_9`, 1920 × 1080), its grid (the `GridDefinition` of `GL-UI-040`, or `null`), masters, layouts, its pages in order and a `schemaVersion`. A page carries elements, an optional layout, notes, hidden, a transition and exactly one background (colour, gradient or image). Element types: text with runs, image with crop, shape, line, icon, table, chart (bar, line, pie; data in the element, up to six series, each with a `pattern` beside its colour, `GL-UI-060`: one of `CHART_PATTERNS`; a series without one gets the pattern of its index, or the next one no other series carries, so no two series share one), group, placeholder (an app role key) and `custom` (an app's type id); every element carries box, rotation, layer, locked, hidden, opacity 0–100, an optional animation and an app `payload` the package passes through. All lengths are px of the format, inside a group too; the lower `layer` lies below, and at an equal `layer` the later element in its array lies above; a `\n` in a run ends a paragraph, and in a list every paragraph is one item. Colours and fonts are brand keys (`{ kind: "brand", key }`) or marked free values (`{ kind: "free", … }`); `resolveColor` and `resolveFont` read them from the brand set the app passes (its own keys only), so a changed brand set changes every referencing element without a rewrite. Images reference app media by id; embedded `data:` bytes are rejected.

**Limits and formats** (`SLIDE_LIMITS`, generous on purpose, as tightening one later takes a schema version): groups nest at most 32 deep, checked before the schema runs, so a deeper document is a named error and never a stack overflow; at most 5000 elements per page, layout or master (those in groups counted), 1000 pages, 100 masters, 100 layouts, 1000 runs per text field, 100 000 characters per run text and per page's notes, 1000 per name, alt text, category and series name, tables 200 rows × 50 columns, charts 200 categories and 6 series, gradients 16 stops, a format's width and height 16 384 px, and the grid's step, gap, margin and row step within that too. Ids and keys (element, page, layout, master, media id, brand key, role, `typeId`, icon) are tokens of `A–Z a–z 0–9 . _ ~ @ + = / -`, at most 256 characters: no URL scheme, no space, no control character, no `..` path segment and no leading `/`. A free colour is hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), a colour function (`rgb[a]`, `hsl[a]`, `hwb`, `lab`, `lch`, `oklab`, `oklch`) with numeric arguments only, or one word of letters (a named colour, `transparent`, `currentColor`), at most 128 characters; a function takes one to four arguments with a separator between them, and the check runs in linear time on any input. A free font family is letters, digits, spaces and `. _ , -`, at most 128 characters. Error messages cut an id from the document to 64 characters, and the message of a `SlideDocumentError` counts the issues beyond the first (`(+2 more)`).

`parseSlideDocument` migrates a document of an older schema version to the current one and validates it; a document that breaks the schema throws a `SlideDocumentError` (`code` `invalid`, `unknown-version`, `newer-version` or `migration-failed`) and is never returned. Each of its `issues` carries a `code` (`SlideIssueCode`: `invalid-type`, `invalid-value`, `invalid-format`, `too-small`, `too-big`, `duplicate-id`, `unknown-layout`, `unknown-master`, `row-cells`, `series-values`, `duplicate-pattern`, `group-depth`, `too-many-elements`, `missing-version`, `invalid-version`, `unknown-version`, `newer-version`, `migration-failed`) and a `path` like `pages[0].elements[2].opacity`; its `message` is a technical detail, and the sentence for people comes from the app's i18n through the code. A newer version is no invalid document: its message names both versions and says to update `@suite/ui`. `safeParseSlideDocument` gives the same as a result and never throws, also not for a migration step that throws. Schema version 1 is the first; the migration chain `SLIDE_MIGRATIONS` is empty. The gallery's new `slides` page validates one example document per element type and property.

**The grid in English** (`SUI-FEATURE-087` rev 7, `GL-CODE-001`): `GridDefinition` is `{ kind: "step", step }` or `{ kind: "columns", count, gap, margin, rowStep? }`; `gridLines(def, box, { centers })`; `pickSnap({ anchors, candidates, tolerance, bypass })` with candidates `{ value, source }`, sources `element` | `area` | `grid`, and the hit `{ offset, candidate }`. `GridToggleValue` is `{ guides, snap }`. The texts of the fields are unchanged; only their keys are English.

**Migration:** the grid's identifiers are renamed (no app has stored a definition yet): `art` → `kind`, `"schritt"` → `"step"`, `"spalten"` → `"columns"`, `schritt` → `step`, `anzahl` → `count`, `abstand` → `gap`, `rand` → `margin`, `zeilenschritt` → `rowStep`; `gridLines` option `mitten` → `centers`, and the `GridOverlay` prop `mitten` → `centers`; `pickSnap` parameters `anker` → `anchors`, `kandidaten` → `candidates`, `toleranz` → `tolerance`, `umgehen` → `bypass`; `SnapCandidate` `wert` → `value`, `quelle` → `source`; `SnapSource` `"flaeche"` → `"area"`, `"raster"` → `"grid"`; `SnapHit` `versatz` → `offset`, `kandidat` → `candidate`; the `GridFields` `hidden` values follow the fields (`kind`, `step`, `count`, `gap`, `margin`, `rowStep`). Testids of `GridFields`: `grid-art` → `grid-kind`, `grid-schritt` → `grid-step`, `grid-anzahl` → `grid-count`, `grid-abstand` → `grid-gap`, `grid-rand` → `grid-margin`, `grid-zeilenschritt` → `grid-rowStep`, each with its `-error`. `GridToggleValue` `hilfslinien` → `guides`, `einrasten` → `snap`. Package text keys (de, en, es; texts unchanged): `grid.art` → `grid.kind`, `grid.schritt` → `grid.kindStep`, `grid.spalten` → `grid.kindColumns`, `grid.anzahl` → `grid.count`, `grid.abstand` → `grid.gap`, `grid.rand` → `grid.margin`, `grid.zeilenschritt` → `grid.rowStep`. New dependency `zod` `^4.6.6`, which the package brings itself; an app that checks documents uses the package's exports, not a schema of its own. New subpath `./slides/*`; new exports `SLIDE_LIMITS`, `slideDocumentSchema` and its part schemas, `parseSlideDocument`, `safeParseSlideDocument`, `migrateSlideDocument`, `SLIDE_MIGRATIONS`, `SLIDE_SCHEMA_VERSION`, `SlideDocumentError`, `FORMAT_16_9`, `resolveColor`, `resolveFont` and the types `SlideDocument`, `SlideDocumentInput`, `SlideElement`, `SlideBrandSet` and others. No package text changed; package text keys, props and testids changed only for the grid, as above. Baselines: 10 `gallery-*.png` (strings table with the renamed keys: de, en, es in light and dark, de also at 1440 and 390 px); the gallery page switch gains the option `slides`.

## 0.134.8 — #289, SUI-FEATURE-150 rev 6, SUI-FEATURE-170 rev 5, GL-UI-007: a submission the guard let go stays guarded until it ends

Fix, not breaking.

- **A submission that goes on through the guard is no longer unguarded while it runs** (fixes the known limit noted in 0.134.5 and 0.134.6). Under a data router this is a form's submit let go by the leave question (Discard), or a held submit started anew once the submission before it ended, the page's own Save among them. While it runs, a route change is held as during any other submission and never cuts it off: it lands at its chosen target once the submission succeeded, and is dropped when it failed. A second submit of the same form is dropped, so the action runs once (before: a link aborted the submission, and a second submit ran the action again, as react-router asks no blocker while one proceeds). A held own Save that goes on stays the page's own Save: a way out during it opens no dialog and waits (`SUI-FEATURE-170`).

**Migration:** none required.

## 0.134.7 — #290, #296, SUI-FEATURE-150 rev 6, SUI-FEATURE-170 rev 5, GL-UI-007 (Codex reviews v0.134.5 and v0.134.6): a dropped second submit keeps the open leave question working, Back waits for the panel's work, and only the own Save itself goes unasked

Fix, not breaking.

- **A second submit dropped while "Save changes?" asks no longer makes the dialog's answer do nothing.** Under a data router, while a submission runs and the dialog asks about a route change, a second submit of the running form (same action and method) is still dropped silently. Discard or Save in the dialog then still waits for the submission and lands at the chosen target (before: the answer did nothing and the submission's redirect won). Once the submission has ended, a late answer leaves the page where it is, without an error.
- **Back in an `EditPanel` waits for the panel's own work.** While a promise from `onSubmit` runs, Back stays usable and is held like Previous/Next and `Esc`: it goes on once the work resolves `true` and is dropped when it fails, as 0.134.5 stated (before: Back was locked). An `onSubmit` promise must resolve `true` for a held Back to go on. The call site's `busy` and `backDisabled` still lock it.
- **Only the page's own Save submission goes without the question.** A navigation that submits nothing is a way out and asks on a changed page, also when it comes in the task of a submit its registered form cancelled (`preventDefault`, then `navigate`; before: it left without a question).
- **After Apply the Save is submitted anew with its submit button also when that button stands outside the form**, tied to it by its `form` attribute (before: it went without the button, so its `name`/`value` and any `formaction`/`formmethod` were lost). A button no longer in the form is still left out.

**Migration:** none required.

## 0.134.6 — #288, SUI-FEATURE-170 rev 5, SUI-FEATURE-150, GL-UI-007 (Q&A #4030, #4032, #4033, #4041; reviews #283, #288): a page's own Save form is not held by its own guard

Fix, not breaking.

- **Under a data router a page's own Save goes at once.** `useLeaveGuard` now also returns `saveForm` and `ownSave`. A page that saves through a router form passes `saveForm` as that form's `ref` (`<Form method="post" ref={saveForm}>`); a formless save runs inside `ownSave(() => submit(…))`, which marks only a submission started synchronously inside it. That submission is the page's own Save: "Save changes?" does not open and the action runs once (before: the dialog opened, and Discard then posted the dirty entries). It counts only for that guard: an open apply panel with changes still asks by its own rules. After Apply the held submission is dropped and the guard submits its save form anew, so the Save runs once with the applied values (never with the values from before); a formless own Save is dropped then, and the page keeps its changes. When the Apply fails nothing is saved.
- **Every other submission on a changed page asks**, whatever its path: a second form of the same route (archive), a form in the layout (logout), an unmarked `submit`. Discard lets it go with its own data, never the page's discarded entries.
- **A way out while the own Save runs opens no dialog**, a navigation click as well as `Esc` or a Back wrapped in `guard`. It waits; after the Save succeeded the page is asked again as it is then: clean, it lands at the chosen target; changed again meanwhile, "Save changes?" opens now. When the Save fails the way out is dropped. While the page is `busy`, or another submission runs, the own Save is held as in 0.134.5, silently, and goes on once that submission ended.

**Migration:** none required. To use it, register the save form with `saveForm` (or wrap a formless save in `ownSave`); without that a page's own Save keeps asking as before, and Discard then still posts the form. Known limit (#289): an own Save the guard held and let go later runs unguarded, as before for every submission let go.

## 0.134.5 — #283, SUI-FEATURE-150 rev 6, GL-UI-027, GL-UI-007 (Q&A #4003, #4015, #4016, #4017, #4022, #4028, reviews #280, #283): nothing closes before its result, and a held way out waits for the work

Fix, not breaking.

- **The leave dialog works until its result.** Save or Apply in "Save changes?" / "Apply changes?" keeps the dialog open: Save shows its working state, Cancel and Discard are locked, and `Esc` or any other way out does nothing. On success the held way out goes on; on failure the dialog closes, the surface stays open with its entries, and a field the call site focused for the error keeps the focus. For `EditPanel` of every `submitKind` and for `useLeaveGuard`.
- **An `EditPanel` whose `onSubmit` returns a promise works until it settles**, from its own submit as well, for every `submitKind` (before: only the call site's `busy`).
- **A way out during that work waits for it.** A navigation click, browser back, `Esc`, Back or Previous/Next while the work runs is held without a sign of its own (the latest one wins) and goes on once the work resolves `true`; after an apply it goes through the page around, which asks "Save changes?" in the same move when it is dirty by then. When the work fails it is dropped. No question comes after the surface closed.
- **Under a data router a form submission still running is never cut off, and the leave confirmed meanwhile is not lost.** It waits until the submission (its action and the loads after it) has ended and then lands at the chosen target as it came: a post with its data, a replace as a replace with its state, the basename once, a browser step to the entry it targeted (none, never `go(0)`, when the submission's push dropped that entry). On a clean page with a guard the route change is held the same way, silently, without a dialog (SUI-FEATURE-150 rev 4): a guard under a data router now holds while it is mounted, not only while dirty or busy. A route change that comes meanwhile takes its place and waits too; Cancel resets the held change. A second submit of the running form (a second click on its submit button) is dropped silently, as that submission answers it, so the action runs once; it is no way, so a link held or a leave confirmed meanwhile still lands at its target. The same form means the same action and method; for a form that kept the `navigate` of a render before any guard, which shows no method, the same form element, and when that is not known either, the submit is a way (SUI-FEATURE-150 rev 6). A form with another method on the same route (Delete next to Save) and a browser step are held and go on. A held link goes to the target it was resolved to when clicked, with the options it came with (`preventScrollReset`, `viewTransition`), also after the submission redirected elsewhere. A page busy with the submission holds a navigation click the same way and is asked again, as it is then, once the submission ended. A submission **failed** when the router ends it with a route error (the action threw) or when the action returns data instead of redirecting (react-router's way to answer a validation error; the guard cannot tell it from a confirmation): the leave is then dropped and the page stays with that answer.
- Under a data router a confirmed leave also takes the place of an older change's redirect, not only of its load (0.134.3).

**Migration:** none required; no prop, export, package text or testid changed. Baselines: none. The contract for async work: return a promise from `onSubmit` (or `onSave`) for work whose duration the app does not control and resolve it `true` on success. Close the panel in the step that settles the promise (its last `.then`, or after the last `await`): a close that renders before the promise settles (`setOpen(false)` and then `await save()`, or a close in `flushSync`) drops the held way out, and the result counts for nothing. A call site's own `busy` still locks the surface; a way out during that `busy` alone is dropped as before, unless a router submission runs. A held submission to another action whose form rendered before any guard goes on with react-router's own resolution of its action, which a form resolves when it renders. Known limit: under a memory data router (`createMemoryRouter`, which keeps no history in the window's) a browser step held during a submission goes on by its own step only when the submission replaced the entry the app stands on; after a push it is dropped, as the guard cannot count the step. Known limit: a submission that goes on through the guard (a form's submit let go by the leave question, or a held submit started anew) runs unguarded until it ends, as react-router asks no blocker while one proceeds: a second submit then runs the action again, and a route change cuts that submission off. Once no guard holds, the router's own `navigate` is back as it was; a `navigate` wrapped in after the guard's stays.

## 0.134.4 — #282, SUI-FEATURE-094 rev 9 (Q&A #4008): the English and Spanish apply hints say the entries are only saved with the page

Fix, not breaking. The hint of an `EditPanel` with `submitKind="apply"` now says in English and Spanish that the entries are saved only when the page is saved: "Applies the entries to the form; they are only saved when you save the page." / "Aplica los datos al formulario; solo se guardan al guardar la página." The German hint is unchanged.

**Migration:** none. Only the package text `editPanel.applyHint` changed (en, es); no prop, export or testid changed. Baselines: 4 `gallery-*.png` (strings table: en and es in light and dark).

## 0.134.3 — #280, GL-UI-007 (Codex review v0.134.1): a confirmed leave goes on while an older route change still loads

Fix, not breaking. Under a data router, a route change held while an earlier one was still loading (a slow loader, the page made dirty meanwhile) did nothing when the user confirmed it with Discard or Save, and the earlier change won once its loader finished. The confirmed leave now takes that change's place and lands at its target. A late answer is still dropped when a route change started after the held one is loading, or when the user left meanwhile (0.134.1).

**Migration:** none. No package text, prop, export or testid changed; baselines: none.

## 0.134.2 — #279, SUI-FEATURE-094 rev 8: the apply hint says when the entries are saved

Fix, not breaking. The hint of an `EditPanel` with `submitKind="apply"` no longer says the entries "are saved there", which read as if they were saved on their own. It now says they are kept only once the page is saved: "Applies the entries to the form; they are kept once you save the page." / „Übernimmt die Eingaben ins Formular; gespeichert wird erst mit dem Speichern der Seite." / "Aplica los datos al formulario; se guardan al guardar la página."

**Migration:** none. Only the package text `editPanel.applyHint` changed (de, en, es); no prop, export or testid changed. Baselines: 10 `gallery-*.png` (strings table: de, en, es in light and dark, de also at 1440 and 390 px).

## 0.134.1 — #277, #278, GL-UI-007, SUI-FEATURE-094 rev 7 (reviews #276, #277, Codex #278): a route change held while its guard unmounts keeps its form data, no longer doubles the basename, and never reloads the page

Fix, not breaking. Under a data router, a route change held while the guard that blocked it unmounts (an apply panel that closes, 0.134.0) was started anew by the guard as a fresh navigation, and that lost parts of it. The shared blocker is now owned by the router, not by a guard: it stays registered while a change is blocked, and the change goes on through react-router's own `proceed` once the remaining guards let it pass. So a held `<Form method="post">` (or any submission) runs its action with its `formData`, wherever the form is rendered; before, it was re-issued as a GET without its data. Under a router `basename` the change lands at its target, not under the basename twice (`/app/app/other`). A held browser back or forward goes on by its own step, never as `history.go(0)`, which reloaded the page. An apply panel whose `onSubmit` settles only after the panel unmounted (an async apply) still hands the held change on to the page, which asks "Save changes?"; before, the change was lost. A late apply resumes its change only while that change is still the one held, under a data router as under `BrowserRouter` or `MemoryRouter`: if the user left meanwhile, or a newer route change is waiting or still loading, the late answer is dropped. The guard's host no longer renders on router updates that do not concern it (revalidations, fetchers).

**Migration:** none. The known gap named in 0.134.0 (held `<Form method="post">` re-issued as a GET) is closed. The guards of a data router register one blocker under the key `suite-leave-guard` with `router.getBlocker` and remove it once nothing holds or is blocked. No package text, prop, export or testid changed; baselines: none.

## 0.134.0 — #276, SUI-FEATURE-094 rev 7, GL-UI-011 rev 10: EditPanel `submitKind="apply"` without icon; the panel's submit stays in the panel

Feature, not breaking. `EditPanel` gets a third `submitKind` next to `save` and `next`: `apply` takes the entries over into an outer form that saves them (a glossary panel over a settings page with a page Save). Its primary action carries no icon (`GL-UI-011` §Icon-Kanon: `SaveIcon` only on an action that saves), reads "Übernehmen" / "Apply" / "Aplicar" without `submitLabel`, and its hint, Cancel's and Back's hints say nothing about saving (a next step's Cancel and Back now say neither saving nor applying); busy state, locks, `submitHint` and `submitDisabledHint` work as for `save`. Leaving a changed apply panel asks "Apply changes?" with Cancel, Discard and Apply (no icon, focused on open, `Enter` applies). A leave that only closes the panel is done with that; a route change (navigation, browser back and forward) runs again after the apply has rendered, so the page around the panel, dirty by then, asks "Save changes?" before the route goes: applied values are never lost silently. Leaving a changed next step asks the two-button "Discard changes?" (Cancel, Discard, focused on Cancel): a next step never runs from the dialog. `submitKind="next"` without `submitLabel` now reads "Weiter" / "Next" / "Siguiente" with its arrow instead of "Save". And the panel's `<form>` stops its `submit` event at its own boundary for every `submitKind`, so a panel that stands inside an outer `<form>` in the React tree never submits it along, also through the portal.

**Migration:** a panel inside an outer React `<form>` no longer submits that form; an outer `onSubmit` that relied on hearing the panel's submit no longer does. `submitKind="next"` without `submitLabel` shows Next/Weiter/Siguiente instead of Save. The leave dialog of an apply panel keeps the testid `leave-guard-save` for its Apply button; save panels are unchanged. A next panel's leave dialog is now "Discard changes?" without `leave-guard-save`, and its `onSubmit` no longer runs from that dialog; a test that saved a next step through the dialog uses the panel's own button. On a route change, Apply no longer releases the route at once: the route goes only after the guards active after the apply let it pass. Under a data router, the shared blocker now stays with its guard while a change is blocked, even if that guard turns inactive meanwhile; once that guard unmounts, the change still held starts anew as it came (a push, a replace with its `state`, a browser back or forward by the same step; a back or forward under a memory router arrives as a push). Known gap: a held data-router `<Form method="post">` submission on that restart path is re-issued as a GET without its `formData`. New `submitKind` value `"apply"`. New package texts (de, en, es): `actions.apply`, `actions.next`, `editPanel.applyHint`, `editPanel.applyCancelHint`, `editPanel.applyBackHint`, `editPanel.nextCancelHint`, `editPanel.nextBackHint`, `leaveGuard.applyTitle`, `leaveGuard.applyDescription`. No export or testid changed. Baselines: 10 `gallery-*.png` (strings table, the 9 new keys: de, en, es in light and dark, de also at 1440 and 390 px).

## 0.133.3 — #272, SUI-FEATURE-093 rev 4 (owner's taste decisions, Q&A #3983, #3984): duplicate line as a status, quoted create entry, no entry for an exact match

Fix, not breaking. Three refinements of the 0.133.0 building blocks. The `CreateAndSelectDialog`'s "⟨name⟩ already exists" line is a status, neither error nor warning: muted text with a small info icon, `role="status"`, the "Select this one" button beside it. The `Combobox` create entry puts the term in the language's typographic quotes. And a term that names a listed entry exactly, in any letter case, shows no create entry: "ada lovelace" with "Ada Lovelace" listed offers only that entry, for a local filter and for a server search's answer alike.

**Migration:** changed package texts — `combobox.create`: en "Create {{term}} …" → "“{{term}}” create …", de "{{term}} anlegen …" → "„{{term}}“ anlegen …", es "Crear {{term}} …" → "«{{term}}» crear …". The duplicate line's text (`createAndSelect.duplicate`) is unchanged; it is now muted with an info icon (`data-slot="status-icon"`). A call site that relied on the create entry for a term equal to a listed label no longer gets it; the listed entry is the pick. No prop, export or testid changed. Baselines: 10 `gallery-*.png` (strings table: de, en, es in light and dark, de also at 1440 and 390 px).

## 0.133.2 — #271, SUI-FEATURE-093 rev 4 (Codex review #270): a named Combobox counts as input and carries no value while disabled

Fix, not breaking. In a `CreateAndSelectDialog`, a pick in a `Combobox` whose value lives in a child component of the call site did not count as input, so Cancel and `Esc` closed without asking "Discard changes?". A named `Combobox` now announces each new value from its hidden input, as typing would, so the dialog hears it wherever the value's state lives. And a disabled named `Combobox` no longer submits its value: its hidden input is disabled with it, as a disabled field is.

**Migration:** a `Combobox` with `name` now dispatches a bubbling `input` event from its hidden input whenever its value changes; a form `onInput` handler around it hears that event. A disabled named `Combobox` is no longer in the form's `FormData` (and so not in `onCreate`'s values). No package text, prop, export or testid changed; baselines: none.

## 0.133.1 — #269, GL-UI-016 rev 12 (Codex review #268): typing under a bubble over a text field closes it

Fix, not breaking. A bubble that stands over a text field's empty end (the search's own hint, or a bubble of the `FilterBar` controls) measured the end of the text only when it was placed; text typed or pasted while it was open grew under it. A change of the field's value now closes the bubble, so it never covers typed text; the next open places it anew.

**Migration:** none. No package text, prop, export or testid changed; baselines: none.

## 0.133.0 — #264, SUI-FEATURE-093 rev 3, GL-UI-036 rev 2 (Q&A #3966, #3971): Combobox and CreateAndSelectDialog — create a record from a picker

Feature, not breaking. Two new building blocks in `@suite/ui/ui`, so no app builds its own create dialog from a picker.

`Combobox` is a searchable single choice over records, the building block of the apps' record pickers (contact, location, speaker). It works like `TimezoneCombobox`: the list floats under the field (no portal, opens upwards where a dialog or panel has no room), the arrows, Enter, Tab and `Esc` work as there, and text without a pick is discarded. Props: `options` (`{ value, label }[]`), `value`, `onValueChange(value, option)` (with the picked option, a found one too), optional `selectedOption` (the chosen `{ value, label }` for a value not among `options`, such as a record found by `onSearch` or created in the dialog; without it such a value shows as it is), optional `name` (a hidden input carries the value into a form), `placeholder`, `hint`, `invalid` and the usual field attributes. Without `onSearch` it filters the options by label; with `onSearch(term) → Promise<options>` it asks the server for each typed text, says "Searching …" while it waits and "Nothing found" without a hit (the global search's words), and only the answer to the latest text counts. With `onCreateRequest(term)` the list ends in "⟨term⟩ anlegen …" (en "Create ⟨term⟩ …"), which hands the trimmed term to the call site; it is left out while a search runs, so Enter never creates what the answer is about to offer, and without `onCreateRequest` there is no such entry. Terms and names show as typed (`&`, `'`). `TimezoneCombobox` is unchanged.

`CreateAndSelectDialog` is the compact add dialog over the open panel (`DialogContent size="form" mode="add"`, never a second panel). Props: `open`, `onOpenChange`, `title`, `initialName` (the picker's term), `children` as a render prop that receives `{ name: "name", defaultValue: initialName }` for the name field, `onCreate(values) → Promise<{ created: record } | { duplicate: record }>` (values by field `name`: every field carries one, a `Combobox` too), `onSelect(record)`, `data-testid` (default `create-and-select`). "Create and select" shows the working state while `onCreate` runs and closes only with the result: the new record goes to `onSelect` and the focus returns to the picker. A duplicate is not created: the line "⟨name⟩ already exists" offers "Select this one". A rejected `onCreate` keeps the dialog open and unlocked; a result that arrives after the call site closed the dialog, also one opened again since, selects nothing. While it works, Cancel and the corner X are locked. `Esc` and Cancel close at once without input beyond the term (typed, a changed select or checkbox, a `Combobox` pick), else they ask "Discard changes?" with Cancel and Discard. The dialog's submit never reaches a surrounding panel form.

**Migration:** none for existing call sites. `onCreate` resolves to `{ created: record }` or `{ duplicate: record }`; a picker whose chosen record may be missing from `options` keeps the option `onValueChange` hands over (or the record `onSelect` gets) and passes it back as `selectedOption`. New exports `Combobox`, `ComboboxOption`, `ComboboxProps`, `CreateAndSelectDialog`, `CreateAndSelectDialogProps`, `CreateResult`, `CreateValues`. New package texts (de, en, es): `combobox.placeholder`, `combobox.loading`, `combobox.empty`, `combobox.create`, `createAndSelect.submit`, `createAndSelect.duplicate`, `createAndSelect.selectExisting`, `createAndSelect.submitHint`, `createAndSelect.cancelHint`, `createAndSelect.selectExistingHint`. New testids: `<id>-options`, `<id>-option`, `<id>-create`, `<id>-status` on the `Combobox`; `<id>`, `-submit`, `-cancel`, `-duplicate`, `-select-existing` on the dialog. Baselines: 10 `gallery-*.png` (strings table, the 10 new keys: de, en, es in light and dark, de also at 1440 and 390 px).

## 0.132.2 — #266, GL-UI-016 rev 12 (Q&A #3977): the search's own hint stands over its empty end; the way from an element to its bubble spans both

Fix, not breaking. Two regressions from 0.132.0 on the `FilterBar`. The search's own hint had no gap beside it and fell back to the place next to the field, over the filter selects; like the bubbles of the controls, it now stands over the search's own empty end, 8 px inside its right edge, at least 16 px clear of the typed text, and a press on it focuses the search. Only where that empty end is under 120 px does it fall back as before. And a bubble that stands beside a group, far from its element (Clear filter's), closed as soon as the pointer drifted off radix's grace area on its way there, a wedge a few pixels high from the point where it left the element. The way now spans the whole area between element and bubble (the convex hull of both): moving across it keeps the bubble open, leaving it closes the bubble at once, and resting 300 ms on another control on it closes it as before. This applies to every package tooltip.

**Migration:** none. No package text, prop, export or testid changed; baselines: none. An app test that leaves an element with a single synthetic `pointerLeave` and then moves the pointer somewhere off element and bubble now sees the bubble close at once. Under jsdom, where every box is 0, each such move is off the way, so an app test of the 300 ms rest-close sees the bubble close on the move instead; it mocks `getBoundingClientRect` for the element, the neighbour and the bubble, as the package's own tests in `src/ui/tooltip.test.tsx` do. While a bubble is open, the package stops the element's native `pointerleave` in the capture phase, so a native (non-capture) `pointerleave` listener an app attached to that element does not run then; React's `onPointerLeave` still fires, since React derives it from `pointerout`.

## 0.132.1 — #263, GL-UI-016 rev 11 (Q&A #3967): a press on a tooltip over a text field focuses the field, a resize closes a bubble beside a group

Fix, not breaking. A bubble that stands over the empty end of a text field (a bubble of the `FilterBar` controls over the search) no longer swallows the press: a press on it closes it and puts the focus into the text field underneath, so typing lands there, also after the pointer rested on the bubble. A bubble over no text field keeps its behaviour: a press closes it and the click goes no further. A bubble beside a group of controls now closes when the window is resized, as on scroll; before, it kept the place measured at its open and could stand past the viewport's edge (Codex review #265). The next open measures anew.

**Migration:** none. No package text, prop, export or testid changed; baselines: none.

## 0.132.0 — #259, GL-UI-016 rev 10, SUI-FEATURE-049 rev 7 (Q&A #3948, #3952, #3954, #3955, #3962, #3965): hoverable tooltip, beside its group of controls

Feature, not breaking. Every package tooltip (`Tooltip`, `Hint`, `IconButtonTooltip`, `OverflowTooltip`) is now hoverable (WCAG 1.4.13 "Content on Hover or Focus"). When the pointer moves from the element straight onto the bubble, the bubble stays open. Radix's grace area between element and bubble counts as on the way while the pointer moves. When the pointer, after leaving the element, rests 300 ms on another control on that way (a neighbour in the row), the bubble closes; a bubble opened by the focus does not close this way; every move starts the rest anew, and reaching the bubble ends it. Once the pointer moves outside element, bubble and that way, the bubble closes. A click closes it at once: on the element, on another control (the click reaches that control) and now also on the bubble. The click on the bubble goes no further, so the element's ancestors (a tile that opens) never hear it. Focus change, scroll and `Esc` still close it at once, and the `--tooltip-hint-delay` appear delay is unchanged. Apps still cannot set `disableHoverableContent`.

For an element in a bar of controls, the bubble stands beside the element's group of tightly spaced controls, at the element's height (top edge 4 px above the element's), in the nearest gap that holds it: to the right of the group up to the bar's next control (or the viewport), else to the left. There it covers no neighbouring control. A text field that takes the remaining width (the `FilterBar` search) leaves no gap: a bubble of the group to its right then stands over the field's empty end, at least 16 px clear of its text (value or placeholder, measured on a canvas in the field's font). With no gap for its full width, it takes the larger gap and narrows there, wrapping, down to 120 px. With not even 120 px (a narrow window such as the pagination at 390 px, or text that leaves the search under 120 px), it stands beside the element as outside a bar, right of it, else left; there it can cover neighbours and typed text, and a click on the bubble only closes it. The arrow shows only where the bubble stands right next to its element; beside a group it would point at a neighbour. The bubble is never above or below and never cut off: beside a group, where radix's collision shift is off, a bubble at the bottom of the viewport rises by itself. Each open measures anew.

The package sets the bars and groups in its own building blocks: a bar is the outermost ancestor with `data-tooltip-row` (or an app's `role="toolbar"`), so a marked bar inside a larger one (a `ViewToggle` in the `FilterBar`) belongs to the larger one; its groups carry `data-tooltip-group`, and a bar without them is one group. Bars: `TablePagination`, the `EditPanel` pager and footer, the `EditorHeader` actions, `RowActions`, the `PreviewToolbar`, the media detail head and footer, the canvas action bar and zoom, `ViewToggle`, the drawer rail, the `FilterBar` (groups: the search and the controls), the `PageHeader` action groups, the settings action row and footer, the secret card header group, the grid toggle, the sidebar head and `DialogFooter`.

Known edges: the close after leaving needs a pointer move. A pointer that jumps out in a single move onto no control and then rests keeps the bubble open until it moves again, at any distance; so does a pointer that leaves the window straight from the element.

**Migration:** none for call sites: the bars and groups are set inside the package, and the `data-tooltip-row` and `data-tooltip-group` attributes are package-internal. No package text, prop, export or testid changed; baselines: none. An app test that asserts a closed bubble after a bare `pointerLeave` now also moves the pointer away from element and bubble, as `leaveTooltip` in `src/list/test-utils.tsx` does.

## 0.131.1 — #258, SUI-FEATURE-092 rev 3, SUI-FEATURE-091 rev 5 (Q&A #3943): leave-prompt texts name the prompt

Text fix, not breaking. The "Discard changes?" description now names the loss as the result of discarding, never as certain, and the `EditPanel` Close hint (no `onSubmit`) now says that changes are asked about first, like Back and Cancel. The `save` hint is unchanged. Texts in de, en and es.

**Migration:** changed package texts — `leaveGuard.discardDescription`: en "This entry has changes that will be lost." → "This entry has changes that will be lost if you discard them.", de "Dieser Eintrag hat Änderungen, die verloren gehen." → "Dieser Eintrag hat Änderungen, die beim Verwerfen verloren gehen.", es "Esta entrada tiene cambios que se perderán." → "Esta entrada tiene cambios que se perderán si los descartas."; `editPanel.closeHint`: en "Closes the panel." → "Closes the panel; asks first if there are changes.", de "Schließt das Panel." → "Schließt das Panel; Änderungen werden vorher abgefragt.", es "Cierra el panel." → "Cierra el panel; antes pregunta si hay cambios.". Props, exports and testids: none. Baselines: 10 `gallery-*.png` (strings table).

## 0.131.0 — #256, SUI-FEATURE-092 rev 2, GL-UI-007 rev 5: leave prompt without a save target asks "Discard changes?"

Feature, not breaking. A dirty surface without a save target no longer offers a Save that does nothing. Its leave prompt is titled "Discard changes?" and shows only Cancel and Discard (destructive). The focus opens on Cancel with its ring, and `Enter` and `Esc` both stay, so only Discard carries out the held way out (Esc, Cancel/Close, Back, Previous/Next, a navigation click, browser back and forward). It applies to `EditPanel` without `onSubmit` and to `useLeaveGuard` without `onSave`; `onSave` is now optional there and in `useLeaveConfirm`. With `onSubmit` or `onSave` the prompt is unchanged: three buttons, opening on Save. New strings `leaveGuard.discardTitle` and `leaveGuard.discardDescription` in de, en and es. The gallery's edit-panel page gets a panel without a save target (`note-panel`).

**Migration:** a detail or editor page without a save target leaves `onSave` out of `useLeaveGuard` (do not pass a handler that does nothing); its prompt then asks "Discard changes?". A decision or other action stays with its own button and never runs through the prompt. `useEditorLeaveGuard` still requires `onSave`. An `EditPanel` without `onSubmit` gets the new variant on its own. Baselines: 10 `gallery-*.png` (strings table).

## 0.130.2 — #254, SUI-FEATURE-091 rev 4 (Q&A #3925): EditPanel busy hint uses ConfirmDialog's wording

Text fix, not breaking. While `busy`, every `EditPanel` footer button now shows the neutral hint in `ConfirmDialog`'s wording: "An action is running; available again once it has finished." (de "Eine Aktion läuft; wieder verfügbar, sobald sie abgeschlossen ist.", es "Hay una acción en curso; vuelve a estar disponible cuando haya terminado."), the same for `submitKind` `save` and `next`. Texts in de, en and es.

**Migration:** none. Baselines: 10 `gallery-*.png` (strings table).

## 0.130.1 — #251, SUI-FEATURE-091 rev 3 (Q&A #3920): EditPanel footer hints say only what the package does

Text fix, not breaking. The `editPanel.*` hints from 0.130.0 (#249) now state only what the package itself does. Back goes one step back and Cancel closes without saving, and both say that unsaved changes are asked about first. The `save` hint is now "Saves the entries", with no claim about closing, since the package never closes on submit. While `busy`, every footer button shows one neutral "work in progress" hint for both `save` and `next`, never "saving". Close and `next` are unchanged. Texts in de, en and es.

**Migration:** a call site that closes the panel after saving passes a `submitHint` saying so. Baselines: 10 `gallery-*.png` (strings table).

## 0.130.0 — #249, SUI-FEATURE-091 rev 2: EditPanel footer buttons carry description hints

Feature, not breaking. The `EditPanel` footer buttons (Back, Cancel/Close, primary action for `submitKind` `save` and `next`) now show a description hint per `GL-UI-017` after `--tooltip-hint-delay`, through the package `Hint`, the same way as `ConfirmDialog`. The hint is the button's `aria-describedby`; its accessible name stays the label. While `busy`, all footer buttons show one "saving in progress" hint. New optional props `submitHint`, `submitDisabledHint`, `backHint` and `backDisabledHint` take already-translated texts: `submitHint`/`backHint` replace the package text, and the `…DisabledHint` props show while `submitDisabled`/`backDisabled` locks the button. Package texts are in de, en and es under the new `editPanel.*` string group. The gallery gets a read-only panel with only Close (`view-panel`).

**Migration:** none required. An app that sets `submitDisabled` or `backDisabled` passes the matching `…DisabledHint` with its unlock condition; an app that sets its own `submitLabel` passes a matching `submitHint`. Baselines: 10 `gallery-*.png` (longer strings table).

## 0.129.5 — #247, GL-UI-031 rev 4 (Q&A #3898): in the collapsed rail the search icon opens the dialog directly

Bug fix, not breaking. In the collapsed sidebar rail, a click on the `GlobalSearch` icon expanded the sidebar, and the expanded field's focus then opened the dialog. Now the click opens the search dialog directly and the rail stays collapsed, as with the shortcut. `Esc` or the × gives the focus back to the rail's search icon. The expanded field, the closed overlay below `md` (#240) and the search opened over a modal (#244) keep their focus paths.

**Migration:** none. Baselines: none changed.

## 0.129.4 — #244, GL-UI-050: closing the search opened over a modal keeps the focus in that modal

Bug fix, not breaking. Since 0.129.2 (#240), closing the `GlobalSearch` dialog always sent the focus to the sidebar search field. That also happened when the shortcut opened it from a control inside a modal dialog that is still open, so the focus landed behind that modal. Now `Esc` or the × gives the focus back to the control in the modal that had it, through `GL-UI-050`'s order inside that modal. This applies only to a modal dialog that is in front: a non-modal sheet such as `EditPanel` or `MediaDetailShell` hides nothing, so closing the search from there still focuses the sidebar field. The desktop and narrow-screen focus return from #240 is unchanged. The gallery's shell page gets `?modal=1`, a modal dialog to open the search over.

**Migration:** none. Baselines: none changed.

## 0.129.3 — #242, GL-UI-050: tests for the search's last focus fallback and its unmount guard

Tests only, no behaviour change. New unit tests for `GlobalSearch` cover the closed overlay below `md`, where the sidebar field is hidden. Opened by the shortcut from a link in the page content, `Esc` puts the focus on the overlay trigger, or on the main content when there is no trigger. It never goes to the link or to `<body>`. Another test covers unmounting the search while its dialog is open: no focus is returned, and whatever the app focused meanwhile keeps the focus.

**Migration:** none. Baselines: none changed.

## 0.129.2 — #240, GL-UI-031 rev 3 (Q&A #3895): closing the search returns the focus to the sidebar field

Bug fix, not breaking. Since 0.93.0 (#145), closing the `GlobalSearch` dialog with `Esc` or its × gave the focus back to whatever had it when the dialog opened. Opened by the shortcut from a nav link, `Esc` landed on that link. Now closing always puts the focus on the sidebar search field (in the collapsed rail, on its search button), however the dialog was opened, and the dialog does not reopen. The search's trigger is always its sidebar field (`GL-UI-031`, `SUI-FEATURE-015` AC 5). Below `md`, while the overlay sidebar is closed, the field is hidden. The focus then goes back to the control that had it at opening, unless that is a navigation element; else to the overlay trigger; else `GL-UI-050`'s main-content order. It never goes to a link or to `<body>`. A chosen hit still navigates and leaves the focus to the target page; `GL-UI-050` focus return of every other dialog is unchanged.

**Migration:** none; the cockpit e2e `shell-search.spec.ts:77` passes again. Baselines: none changed.

## 0.129.1 — #239, GL-UI-015 (Q&A #3894): a click on empty space in the row-actions cell opens the row

Bug fix. `RowActions` stopped every click on its wrapper, so with `className="w-full"` a click on the empty part of the actions cell no longer opened the row. It now stops only clicks that come from an action (button, ⋯ trigger, menu entry, locked action); empty space in the cell opens the row. Row keys on a focused action are unchanged.

- Cockpit: the `*:ml-auto *:w-fit` workaround can be dropped.

## 0.129.0 — #235, GL-UI-007 rev 4 (Q&A #3865, #3870, #3872): the leave guard holds browser back and forward under `BrowserRouter`

Bug fixes plus one new export. Three defects of the leave guard (`useLeaveGuard`, `useLeaveConfirm`, and through it `EditPanel`, `MediaDetailShell` and the editor's guard) are fixed together.

- **New: `installLeaveGuard()`** from `@suite/ui/ui/leave-guard`. It installs the guard's `popstate` listener once; further calls do nothing.
- **Browser back and forward are held under `BrowserRouter`** (no data router), once the app calls `installLeaveGuard()` in its entry, before the router renders. The guard used to listen only once a hold existed, after the router. On the window, listeners run in the order they were added, whatever `capture` says, and React commits the route change between two listeners. So the router left the page before the guard was asked. The installed listener comes before the router's and hands each `popstate` to the holds active at that moment, so a hold created later, on a lazy route too, is held. With a draft, back or forward asks once, and the address stays until Leave/Discard; Abbrechen keeps page and address.
- **A released step back no longer asks again.** After Discard or Save in the dialog, the `popstate` of the `navigate(-1)` / `navigate(n)` that passed every hold passes too. Before, it re-opened the dialog when the page stayed mounted across the step, for example a panel opened by a query parameter. A released step that never arrives, such as a `go` past the end of the history, no longer lets a later back slip through.
- **`Esc` while the dialog asks is Abbrechen, always.** In `MediaDetailShell` and `EditPanel` an `Esc` that reached the panel before the dialog had taken the key re-opened the dialog, in 2 of 3 runs in the reported e2e. Now such an `Esc` closes the dialog as Abbrechen and the panel keeps its draft; the gallery checks are stable over 10 runs.

**Migration:** every app with `BrowserRouter` calls `installLeaveGuard()` once in its entry, before the router renders:

```ts
import { installLeaveGuard } from "@suite/ui/ui/leave-guard";

installLeaveGuard();
createRoot(root).render(<App />);
```

Without it, the first hold installs the listener after the router's, and browser back and forward with a draft are not held; in development, that first hold logs one `console.warn` naming `installLeaveGuard()`, under browser-history routers only (`BrowserRouter`), never under `MemoryRouter`. In-app route changes (links, the navigation, `navigate()`) are held either way. This applies to both suite apps:

- Community: the guard parts only load with a lazy route.
- Cockpit: static imports are not enough either, because nothing installs the listener at import any more; the call is explicit, so no bundler can drop it.

Apps can then drop their workarounds for browser back with a draft (Community: the history-state workaround of COM-FEATURE-003 rev 3). A data router (`createBrowserRouter`) needs nothing. Baselines: none changed.

Minor, not patch: a new export, and apps must call it to get browser back and forward held.

## 0.128.0 — #234, SUI-FEATURE-051 rev 11 (Q&A #3862, #3863): the `PageHeader` reflows by its own width; `status.more` gets a plural

Behaviour changes that app tests may see.

- The two-row `PageHeader` now follows the head's own width, at any window width. It switches whenever the head is narrower than 640 px, through a container query, instead of the 640 px window rule of 0.125.0. The title has row one; row two holds the status slot's reserved compact width and the actions, which wrap within their column.
- The head now sits in a new block, `[data-slot=page-head]`, which is the container `page-head` and carries the head's `mb-2`. As a block it takes its width from its parent. The 640 px threshold is defined once, as the container size `--container-head-split: 40rem` (`@max-head-split/page-head:`).
- At head widths of 320, 390 and 480 px, with a long title and "+10", the head keeps one height idle, running, with progress and with several operations. Nothing reaches past it and the title stays whole. "+10" stays whole in the compact slot under and over 640 px.
- `suite:status.more` is a plural pair now: `status.more_one` / `status.more_other`, chosen by i18next's `count`. German says "1 weiterer" / "{{n}} weitere". English and Spanish keep one text for both: "{{n}} more", "{{n}} más". So the German compact indicator's name with one other reads "<label>, 1 weiterer".

**Migration:** the head now sits in a full-width block wrapper (`data-slot="page-head"`, `w-full`); a head placed in a flex row takes the row's width. Check two points:

- App tests that expected `page-header`'s parent to be the page column, or its next sibling to be the content after the head, find the `page-head` block in between: `page-header` is its only child, and the content follows the block.
- App tests that read the German compact indicator's name with one other operation read "1 weiterer" instead of "1 weitere".

Apps that override `suite:status.more` provide `more_one` and `more_other` instead. The suite apps' page heads measure about 1153–1168 px at a 1440 px window (sidebar 224 px, page gutter 2 × 24 px), so they stay on one row there.

Baselines: the strings table, which gains the plural pair: `gallery-{de,en,es}-{light,dark}` and `gallery-de-{light,dark}-{390,1440}`. All other 390, 1440 and 1920 px captures are unchanged.

Minor, not patch: the head gains a wrapping element, the switch follows the head instead of the window, and a string key becomes a plural pair, all of which app tests can see.

## 0.127.0 — #232, SUI-FEATURE-071 rev 7 (Q&A #3861): `PropertyPanel` stacks by the editor frame's width

Behaviour changes that app tests may see. The `PropertyPanel` now stands under the canvas at full width whenever the editor frame is narrower than 1024 px, decided by a container query on the frame instead of the 640 px window rule of 0.125.1. So at 700 px, or in any frame narrower than 1024 px, nothing of the drawer or the panel lies outside the frame any more. The split stays half and half (`--property-panel-share`), the panel's head stays and only its body scrolls. From a 1024 px frame on, the panel is the 340 px column on the right and the drawer 300 px, as before. Opening or closing a drawer never re-flows the panel: the switch follows the frame alone. The threshold is defined once, as the container size `--container-editor-split: 64rem` (`@max-editor-split/editor:`). It is measured on the content box of the editor row, the only width a container query can read: a row of exactly 1024 px stays side by side and 1023 px stacks, and a border or padding on the row itself does not count.

The editor row is now the flex row that holds the `DrawerRail` and the `PropertyPanel` as direct children; a row with only one of them, or a panel wrapped in another element, is left alone. That row is the container `editor` (`container-type: inline-size`, set by `styles.css`), and it always wraps. The package now sizes the canvas too: the element right after the rail takes the rest of the row from nothing (`flex: 1 1 0%; min-width: 0`). So from a 1024 px frame a row of rail, canvas and panel always fits one line, whatever the canvas holds, and below it the canvas stays beside the rail. Any other child of the row, such as a fixed aside, keeps the size the app gives it; below 1024 px it is only capped at the upper half in height. The row has no row gap (`row-gap: 0`), so below 1024 px its two halves fill the editor exactly. Both rules are unlayered and override the app's own utilities there.

**Migration:** none in code for the suite apps. Their editor frames measure about 1134–1168 px at a 1440 px window (sidebar 224 px, page gutter 2 × 24 px), so the panel stays on the right there. Check three points:

- The editor row must take its width from its parent (a block or a stretched flex item), never from its content: as a size container its own content no longer widens it.
- App tests at a viewport between 640 and about 1100 px that expect the panel beside the canvas see it under the canvas.
- An extra in-flow sibling in the editor row (an app's own aside or tool strip beside rail, canvas and panel) is not supported yet: below 1024 px it takes a line of its own, and from 1024 px it can push the panel onto a second line, out of a clipping frame. How the editor row holds one is open with the architect (Q&A #3874).

Of the 0.125.1 conditions one remains: rail and panel are direct children of one flex row, and the canvas is the element right after the rail. The canvas no longer needs `min-w-0`, because the package sizes it; an app's `flex-*`/`min-w-*` on the canvas and a `gap-y`/`gap` row gap on the row are overridden there (a column gap stays). Baselines: none changed.

Minor, not patch: the panel's position changes in frames between 640 and 1024 px, and the editor row becomes a size container, which app layouts and tests can see.

## 0.126.0 — #230, SUI-FEATURE-051 rev 9 (Q&A #3859): "+n" visible in the compact status slot

Behaviour changes that app tests may see.

- The compact status slot shows "+n" beside its indicator again, at every width. Only the label goes into the hint (it still stays closed on focus).
- The indicator's accessible name now names the others with the new string `suite:status.more`: "Uploading images, 1 more" / "…, 1 weitere" / "…, 1 más", instead of "Uploading images +1". The visible glyph stays "+n" and is hidden from screen readers in the compact form, since the name says it.
- Below 640 px, the slot's reserved compact width on row two now fits a progress indicator and "+n" (5.5rem instead of 3.5rem), reserved while idle too. So the head keeps one height idle, running, with progress and with "+n" visible, and nothing reaches past it at 320 and 390 px.
- The full slot is unchanged.

**Migration:** none in code. App tests that read the compact indicator's name as "<label> +n" read "<label>, n more" (in the app's language). Tests that expect no `page-operation-more` beside a compact indicator find it again. Tests that expect the hint to read "<label> +n" read the label alone. Apps that register the package strings get `suite:status.more` with them. Baselines:

- `components-de-light-390` and `components-de-dark-390`: the wider reserved slot, and "+1" visible in the several-operations sample.
- The strings table, which gains the `status.more` row: `gallery-{de,en,es}-{light,dark}` and `gallery-de-{light,dark}-{390,1440}`.

All other 1440 and 1920 px captures are unchanged.

Minor, not patch: the compact indicator's accessible name and the visible "+n" change, which app tests can see.

## 0.125.1 — #228, SUI-FEATURE-071 rev 6 (Q&A #3856, #3857, #3860): `PropertyPanel` under the canvas below 640 px

Not breaking; the DOM and its order are unchanged. Below 640 px of window width (Tailwind `sm`; Reflow, `GL-UX-001`), the `PropertyPanel` stands under the canvas at full width instead of as a 340 px column on the right, where it lay entirely outside the editor frame at 320 and 390 px. It is a CSS rule on the window width. `styles.css` lets the editor row that holds the panel wrap and sets the split in one place, `--property-panel-share` (50 %). The panel takes the lower half, with its head in place and only its body scrolling; its three tabs take narrower padding below 640 px so they fit 320 px in every language. `styles.css` caps each other child of that row at the upper half, so the `DrawerRail` with its open drawer and the canvas share it. The drawer keeps its width up to what the row leaves, and the canvas keeps the rest, at worst none while a drawer is open (Q&A #3857). From 640 px on nothing changes: a 340 px panel on the right and a 300 px drawer. **Migration:** none in most editors; check three points below 640 px. The editor row that holds the panel needs a definite height, as before, so the halves resolve. The `DrawerRail`, the canvas and the `PropertyPanel` must be direct children of one flex row, since the rule finds the row by its panel child (`:has(> …)`); if the panel is wrapped in another element, nothing of this applies below 640 px. The canvas child needs `min-w-0`, or a squeezed canvas pushes the panel out of the editor. Every direct child of that row except the panel, a `dialog` and a `[popover]` is capped at the upper half, so an absolutely positioned overlay placed directly in the row covers only that half; put it in the canvas instead. Baselines: `components-de-light-390` and `components-de-dark-390`, where the panel now stands under the canvas; 1440 and 1920 px are unchanged.

## 0.125.0 — #226, SUI-FEATURE-051 rev 8 (Q&A #3852): `PageHeader` two rows below 640 px, "+n" in the compact hint

Behaviour changes that app tests may see.

- The two-row `PageHeader` now starts below 640 px of window width (Tailwind `sm`) instead of below 390 px. The title has row one; row two holds the status slot's reserved compact width on the left and the actions beside it, which wrap within their column. It is still a CSS rule on the window width, and an operation changes nothing. So at 390 px too, the head keeps one height idle, running, with progress and with several operations, and nothing reaches past it. That ends the overflow of up to 23 px a running slot's head had at 390 px. From 640 px on nothing changes.
- The compact status slot no longer draws "+n" beside its indicator. "+n" moves into the hint and the indicator's accessible name, after the label ("Uploading images +1"). The slot keeps its fixed compact width. The full slot still shows "+n" beside the label.

**Migration:** none in code. App tests at a viewport below 640 px that expect the actions beside the title see them on row two. A test that looks for `page-operation-more` beside a compact indicator finds "+n" in the indicator's name instead. Baselines: `components-de-light-390`, `components-de-dark-390`, `list-de-light-390` and `list-de-dark-390` (the actions on row two); 1440 and 1920 px are unchanged.

Minor, not patch: the visible "+n" moves and the 390 px layout changes, which app tests can see.

## 0.124.1 — #223, SUI-FEATURE-071 rev 4 (Q&A #3845): the open `DrawerRail` drawer is never clipped

Not breaking. The open drawer is 300 px wide but never wider than the room its container leaves beside the 48 px rail. It still narrows the canvas and never covers it. Before, below about 350 px of editor width (320 px window, a 1280 px desktop at 400 % zoom, WCAG 1.4.10 Reflow, `GL-UX-001`), the drawer ran past the editor frame and its fields were cut off: by 77 px at 320 px, by 6 px at 390 px. The rule follows the container, not the window. From 1440 px the drawer is 300 px as before. Gallery: the CanvasEdgeRow demo frames stack when the row is too narrow, so the components page no longer scrolls sideways at 320 px. **Migration:** none. Baselines: `components-de-light-390` and `components-de-dark-390`, where the open style drawer now ends at the editor frame instead of 6 px past it; 1440 and 1920 px are unchanged.

## 0.124.0 — #222, SUI-FEATURE-051 rev 7 (Q&A #3842, #3849, #3850): `PageHeader` reflows at 320 px

Not breaking in the API. Below 390 px of window width (a 1280 px desktop at 400 % zoom, WCAG 1.4.10 Reflow, `GL-UX-001`), the first row of the `PageHeader` belongs to the title, and the actions stand on a second row, right-aligned. With a status slot, row two holds the slot's compact width on its left, reserved while idle as well, and the actions beside it wrap their buttons within their column when they do not fit side by side. The reserved width is the same idle and running, so the head keeps one height idle, running and with progress, and the title stays whole. This is a CSS rule on the window width; nothing is measured. Before, a head with a status slot and two actions reached up to 40 px past its box at 320 px. Below `md` the title block keeps to the sidebar overlay trigger on the first row, whatever the subtitle's length (`SUI-FEATURE-110`). From 390 px on nothing changes, including the existing overflow at 390 px: a running slot's head can reach up to 23 px past its box with several operations and progress. Markup: the actions now sit in a `[data-slot=page-header-actions]` wrapper, and with a status slot both sit in a `[data-slot=page-header-status-row]` wrapper; both are `display: contents` from 390 px on. **Migration:** none in code. An app unit test that expects a single add's parent to be `page-header` finds the wrapper in between. Baselines: none changed.

Minor, not patch: the actions wrapper changes the DOM app tests can see.

## 0.123.4 — #221, GL-UX-001 (Q&A #3837): `EditorHeader` reflows at 320 px

Not breaking. At 320 px (a 1280 px desktop at 400 % zoom, WCAG 1.4.10 Reflow), `EditorHeader` with every fold step spent (`SUI-FEATURE-090`) was still up to 10 px wider than its space, so Save reached past the edge and the page scrolled sideways. Now, once every step is spent and the header still does not fit, the action group wraps onto its own line, right-aligned. Back and the title stay on the first line. Where the header fits, nothing changes: 390, 1440 and 1920 px look as before. **Migration:** none. Baselines: none changed.

## 0.123.3 — #218: the canvas name badge re-measures after a font swap

Not breaking. `CanvasOverlay` measures the overlay, the action bar and the name badge again whenever one of them resizes (a `ResizeObserver`), not only when it mounts or the selection changes. Before, a web font that loaded after mount made the badge wider than it was measured, and at the right edge it stuck out past the frame (2 px in the gallery with Inter). Now it moves left and stays inside the frame. The gallery keeps waiting for its substitute font before the first render, on purpose, so the captures are deterministic: a popper placed before the font swap (the open Select at 390 px) would stay 1 px off. **Migration:** none. Baselines: none changed.

## 0.123.2 — #217, SUI-FEATURE-076 rev 9: native gallery runs and a substitute font in the gallery

Not breaking. Gallery only, the package ships no font. The gallery phase runs natively in the arm64 Playwright image, without amd64 emulation. The gallery loads a checked-in OFL substitute font, Inter with real cuts 400/500/600/700, only from `gallery.css`, so a font-weight change now shows in the baselines. The gallery waits for the font before its first render; that `CanvasOverlay`'s name badge does not re-measure after a font swap is #218. The gallery's own header bar wraps where it is too narrow. **Migration:** none. Baselines: all re-recorded once with the substitute font.

## 0.123.1 — #213, GL-UX-001 / SUI-FEATURE-038: the help drawer reflows at narrow widths

Not breaking. Below `sm` (640 px), the `HelpDrawer` stacks its navigation (search, pages, version) above the content, and the drawer scrolls as one column. The content padding narrows to `px-4`. At 320 and 390 px, neither the drawer nor the document scrolls sideways, headings are no longer cut off, and the text wraps across the drawer's width instead of one word per line. From `sm` on, the layout is unchanged: the 256 px navigation stays beside the content, which keeps `px-8`. Below `sm`, the search stays on top as a sticky bar while the column scrolls (`SUI-FEATURE-038`). This is CSS only: the navigation column becomes `display: contents`, so the search is one element in one place at any width and keeps its focus, caret and query when the width crosses `sm`. Picking a page there moves the focus to the content and scrolls it into view below the bar; from `sm` up, the focus stays on the link as before. **Migration:** none. Baselines: `help-de-light-390` and `help-de-dark-390` changed; the wide help captures are unchanged.

## 0.123.0 — #210, SUI-FEATURE-089 rev 3: a neutral `noRenderer` text

Behaviour changes that app tests may see. `media.noRenderer` now speaks of the file, not its type, because a refused source scheme (`SUI-FEATURE-089`) shows it too: "Für diese Datei gibt es keine Vorschau." / "No preview available for this file." / "No hay vista previa para este archivo." **Migration:** app tests that match the old sentence ("No preview for this type.") match the new one. Baselines: the `gallery-*` strings table only.

Minor, not patch: app tests that assert the old `noRenderer` sentence will see the new text.

## 0.122.0 — #202, SUI-FEATURE-087 rev 6: the alignment grid after the taste decisions (Q&A #3773–#3777)

Not breaking in the API. The look of `GridToggle` and `GridOverlay` changes, and one Spanish label changes.

- New export `Field` from `@suite/ui/ui/field`: the neutral field building block. It puts the label above the control, the help or error text under it, `aria-invalid` and `aria-errormessage` on the package controls inside, and gives the label the id `${htmlFor}-label`. `SettingsField` and `GridFields` are both built on it, with no visible change to `SettingsField`.
- `GridFields`: the Spanish label for the gutter reads "Separación" instead of "Medianil".
- `GridToggle`: pressed is the primary fill, now one shared value with the RowActions "Used by" toggle. The package's other toggles keep their look. In `mode="getrennt"` it is one joined split button: one frame, with a narrow arrow segment for "Grid options". While snapping is on, the arrow segment carries a primary dot, so snapping never runs unseen while the lines are off. Screen readers hear it too: while snapping is on, the arrow segment is described as "Snap is on" (new string `grid.snapOn`), and its hit area is 32 px wide.
- `GridOverlay`: the halo behind each line is 2 px at 50 % (was 3 px).

**Migration:** none in code. App tests that look for the Spanish "Medianil" read "Separación". Community (separate mode) and Cockpit (coupled mode) get the new look with the pin change.

Baselines: the `grid-*` set (en/de/es, light/dark, plus de 390/1440; the gallery gains a pressed `getrennt` sample), and the full-page `gallery-*` set (en/de/es, light/dark, de 390/1440: the strings table and the new sample). All others are unchanged, RowActions included.

## 0.121.0 — #201, GL-UI-050: Reset keeps the focus after a reset

Not breaking for the API; no new props. Behaviour changes that app tests may see. Reset in `SettingsActionRow` and `SettingsFooter` (the shared pair, `SUI-FEATURE-043`) now locks itself like Save and Cancel. While the entry is clean it carries `aria-disabled="true"` with a click guard instead of native `disabled`, so the focus stays on it after a reset instead of dropping to the body. The locked look is the one the disabled button had: a half-tone fill and the label mixed with the background, with the element opaque so its focus ring keeps full contrast. The locked Reset keeps its reset-disabled hint as its accessible description. **Migration:** Playwright `toBeDisabled()`/`toBeEnabled()` on Reset keep passing, because they count `aria-disabled`. A jest-dom `toBeDisabled()` on a clean Reset in a unit test switches to `toHaveAttribute("aria-disabled", "true")`. An E2E check that compares Reset's opacity or background may change. Affected: Cockpit 5 unit lines and 2 E2E look lines, Community 5 unit lines. Baselines: none changed.

## 0.120.0 — #168, SUI-FEATURE-089 rev 2: `MediaDetailShell` loads only https, http, blob and relative sources

Breaking for apps that pass a `data:` URL (or any other scheme) as the `src` of an image, video, audio or PDF: that preview now shows `noRenderer` instead of the file. Nothing changes for `https:`, `http:`, `blob:` and relative URLs.

- An image, video, audio or PDF loads its `src` only with `https:`, `http:` or `blob:`. A relative URL counts as the page's own origin. Every other scheme loads nothing: `javascript:`, `data:`, `file:` and so on, also with spaces or control characters around or inside the scheme. No element with that `src` is rendered, and the preview shows the `noRenderer` state. An app's own `previewState` still wins. An empty `src` counts as unloadable too. The package checks the scheme, not the origin: the app passes only URLs of its own media store.
- A `src` made only of control characters and spaces counts as empty, and a file kind without `src` and without `previewState` (possible only around the types) shows `noRenderer` too.
- The PDF frame now carries `referrerpolicy="no-referrer"`. It deliberately has no `sandbox`, because Chromium's built-in PDF viewer refuses a sandboxed frame and the preview would stay empty.

**Migration:** pass the medium's address from the app's media store (an `https:`/`http:` URL, or relative to the app). A preview built in the browser goes in as a `blob:` URL (`URL.createObjectURL`) instead of a `data:` URL. Cockpit (`MediaDetail.tsx`, `/api/media/<id>`) and Community (`MediaDetailPanel.tsx`, `/media/<storageKey>`) pass relative store URLs and keep their previews. Their shell tests use no `data:` sources.

The gallery's media detail stand-ins are now `blob:` URLs. Baselines: none changed.

## 0.119.2 — #177, SUI-FEATURE-082 rev 7 / GL-UX-001: the user menu's appearance options are one radiogroup stop

Not breaking. In the open user menu, the appearance options (System · Light · Dark) follow the WAI-ARIA radiogroup pattern. They are one Tab stop: the checked option has `tabindex="0"`, the others `-1`. ←/→ choose the next or previous option, wrap at the ends, and move the focus with the choice. ↑/↓, Home and End stay the panel's moves between its stops (`SUI-FEATURE-082` rev 7). Q&A #3791 is answered and confirms this: ←/→ choose with wrap, ↑/↓, Home and End stay the panel's moves. **Migration:** none. Baselines: none changed.

## 0.119.1 — #172, GL-UI-013: the focusable span around a locked control shows the package focus ring

Not breaking. `Hint` (with `disabledText`) and `IconButtonTooltip` wrap a disabled control in a span that takes the focus in its place. That span now shows the package focus ring (`focus-visible:focus-ring`: 3 px `--ring`, and under forced colors the outline the ring rule sets) with `rounded-md`, instead of the browser's default outline. `Hint` takes a new optional `carrierClassName` that sets the span's radius and ring in place of `rounded-md` and the outset ring; a locked `UserMenuItem` passes `rounded-sm focus-visible:focus-ring-inset`, so its span shows the same inset ring as an enabled entry. **Migration:** none. Baselines: none changed, because no capture holds a focused carrier.

## 0.119.0 — #167, SUI-FEATURE-140: `MediaDetailShell` needs `src` for the kinds that show a file

Breaking for callers that pass `kind="image" | "video" | "audio" | "pdf"` with no `src` and no `previewState`: that no longer compiles. Nothing changes at runtime for a correct caller, and there is no visual change.

- The props are now keyed on `kind` with the new exported type `MediaDetailSource` (and `MediaDetailFileKind`). An image, video, audio or PDF needs its `src`, unless a `previewState` stands in for the preview: a `missingRef` entry has no file, so it has no address. `kind="text"` and `kind="other"` stay as they were, with an optional `src`.
- No `src=""` is ever passed: without `src`, the element carries no `src` at all. Before, the shell defaulted `src` to `""`, which React warns about and which would make a browser fetch the page again.

**Migration:** pass `src` for every image, video, audio or PDF that has a file, or set `previewState` for one that has none. A caller that builds the props from a loosely typed record maps it onto `MediaDetailSource` first, as the gallery's `sourceOf` does. A caller that holds `kind` as the wide `MediaDetailKind` compiles as long as its `src` is a `string`; one whose `src` is `string | undefined` passes a `previewState` or narrows `kind` first. Cockpit (`MediaDetail.tsx`) and Community (`MediaDetailPanel.tsx`) pass the wide kind with a string `src`, so both compile as they are. Cockpit's `src ?? ""` for an entry without a file can become a `previewState` in its own time.

Baselines: none changed.

## 0.118.0 — #199, SUI-FEATURE-088 rev 4: `SettingsActionRow` with Cancel and immediate buttons on the left

Not breaking. Without the new props, the row renders exactly as before.

- `onCancel` + `cancelable` in place of `onReset`: the left button reads "Cancel" (de "Abbrechen", es "Cancelar"), `outline`, with testid `<testIdPrefix>-cancel`. It is usable while `cancelable` is set, also without `dirty`. Not cancelable, it locks itself like a clean Save (`aria-disabled` and a click guard), so the focus stays on it after a cancel (`GL-UI-050`): an open sub-form (replacing a stored secret) is itself the change. The app's handler decides what Cancel discards and closes. Save is unchanged. Passing `onCancel` together with `onReset` is a type error, and so is `onCancel` without `cancelable`.
- `leading`: buttons that act at once stand left in the same row, and the pair stays right. Build them with `SettingsActionButton`, newly exported from `@suite/ui/settings/secret-card-header`. It is the secret card's own button, `outline`, now at the pair's height by default (`size="default"`, one row one height, rev 4); the secret card head keeps `size="sm"`. With `disabledText` it is locked and shows the reason as its tooltip, and a running one locks the same way. Where the block is too narrow for both groups (a 360 px block, Q&A #3770), the row wraps: the immediate buttons above on the left, and the pair below on the right. No text is cut. A `leading` of `null` or `false` renders the row as before.
- `onSave` stays a plain button. Inside a form, call `form.requestSubmit()` in it, so Enter in a field and the button take the same path. Enter submits past Save's lock, so the form's `onSubmit` must check `dirty` and `valid` itself.
- New texts: `settings.cancelHint` and `settings.cancelDisabledHint` in de/en/es.

**Migration:**

- Cockpit: the two app-owned rows from `CPT-FEATURE-UI-120` switch to the package row, with `onCancel`/`cancelable` and the immediate buttons as `leading`.
- Community: replacing the inbound key uses the row with `onCancel`.

The gallery gains `?page=settings&layout=action-row` (`&width=360` narrows the block): a block with its own form, Replace and Remove on the left, and Cancel and Save on the right. Save calls `form.requestSubmit()`, the form ignores a submit without a change, and Replace is locked while its sub-form is open. Baselines: only the `gallery-*` strings table changed, by the two new keys. The row's own captures are unchanged.

## 0.117.0 — #197, SUI-FEATURE-087 rev 3: alignment grid for visual editors

Not breaking. New modules `@suite/ui/ui/grid-core` and `@suite/ui/ui/grid`, so a DOM editor and a canvas editor snap alike (`GL-UI-040`). The app owns and stores the grid; the package stores nothing.

- `GridDefinition`: `{ art: "schritt", schritt }` or `{ art: "spalten", anzahl (1–24), abstand, rand, zeilenschritt? }`, integer px of the app's reference frame; no grid is `null`.
- `gridLines(def, box, { mitten })` (pure, no DOM): `{ x, y }`. For columns, both edges of every column (the outer ones are the margin), with `mitten` the centres too, and a horizontal line every `zeilenschritt`. For a step, a square grid.
- `pickSnap({ anker, kandidaten, toleranz, umgehen })` (pure, one axis): the nearest candidate (`{ wert, quelle: "element" | "flaeche" | "raster" }`) within the tolerance wins. At equal distance an element or area beats the grid. `umgehen` (Alt/Option) snaps nothing. Returns `{ versatz, kandidat }` or `null`.
- `GridFields`: the type, then the step or count, gutter, margin and the optional row step. Labels are above their fields, values are in px. An entry out of bounds, or not a whole number, is not taken, and the field names its bound. `allowNone` offers "No grid"; `hidden` leaves out the fields the app does not lead.
- `GridToggle`: an icon-and-label toggle with `aria-pressed`, filled while on. `mode="gekoppelt"` shows the grid and snaps to it together. `mode="getrennt"` adds a menu beside the button with "Guides" and "Snap" as separate switches; the button itself switches the guides. Without a definition it is locked, and the app's `unavailableText` says where the grid is set. It holds a tool state: no undo, no review.
- `GridOverlay`: the lines over a DOM canvas, unscaled (1 px at any `zoom`), translucent in `--ring` on a `--background` halo. It takes no pointer events and is hidden in print. Never render it in a preview or an export.
- `DropdownMenuCheckboxItem` in `@suite/ui/ui/dropdown-menu`: an entry with `aria-checked` that keeps the menu open.

**Migration:**

- Community: take the grid from the kit, use `GridToggle mode="getrennt"` and `GridOverlay` from the package, and snap with `pickSnap`. The local grid of off · 5 · 10 · 20 % goes away with the pin change.
- Cockpit: take the grid from the scene, use `GridToggle mode="gekoppelt"` in the View band, and draw your own Konva lines from `gridLines`. The locked part becomes available with the pin change.

The gallery gains a `grid` page: the fields in a 340 px panel, the three toggle states, and the overlay over light and dark content. Baselines: new `grid-*` set (en/de/es, light/dark, plus de 390/1440). The `gallery-*` strings table changed by the new `grid.*` keys.

## 0.116.1 — #195: `RowActions` buttons no longer submit a surrounding form

Not breaking. The action buttons of `RowActions` ("Used by", the extra actions, edit and delete) now render `type="button"`. So does the `MediaTile` corner delete button, which is the same element. Before, they had no `type`, so a click inside a `<form>` submitted the form while the action ran. **Migration:** none. Baselines: none changed.

## 0.116.0 — #193, SUI-FEATURE-084 rev 5: an always-visible delete button on `MediaTile`

Not breaking. A `MediaTile` with `onDelete` now shows a delete button in its top-right corner, always visible: no hover or focus reveal, no ⋯ menu. It is the same element as the delete action of `RowActions` (filled `destructive`, `icon-xs`, 24 × 24 px). Its name and hint read "Delete ‹name›". In a keyboard grid (`rowProps`) it shows the Delete chip, because the tile binds the same handler to Delete/Backspace. A click calls `onDelete` once, so the app's confirmation runs, and does not open the tile. Without `onDelete` there is no button, and the tile renders as before.

- How: with `onDelete`, the tile and the button stand side by side in a frame (`data-slot="media-tile-frame"`), with the button positioned over the tile's corner. That keeps the button its own hit target and never nests it in the open button (`GL-UI-013`). The tile keeps its `data-testid`; the button's test id is the tile's plus `-delete` (by default `media-tile-delete`).
- Focus after the confirmation (`GL-UI-050` rev 4): the frame carries the new marker `data-grid-entry-frame` (`ENTRY_FRAME_ATTR` in `lib/list-focus`). A dialog opened from a control in such a frame takes the frame's grid entry as its trigger, the same as a button inside a table row. So Cancel returns the focus to the tile, and a confirmed delete moves it to the tile now in that place, the same as with the Delete key.

**Migration:** none in code. Community: the media library's tile view passes `onDelete` where the role may delete, and the button appears on its own. Cockpit: passes `onDelete` only with the right to delete, with the next package update.

The gallery's tiles page gives `team-photo.jpg` (image) and `intro.mp4` (icon) an `onDelete`. Baselines: the `tiles-*` set (en/de/es, light/dark, plus de 390/1440) changed, by the two delete buttons only.

## 0.115.0 — #192, GL-UI-028 rev 4 / SUI-FEATURE-086: toast offset below the editor header in a full-screen editor

Not breaking. New export `useEditorShellToastOffset(headerRef)` from `@suite/ui/ui/toaster`. A full-screen editor (`GL-UI-040` point 7) is its own shell. While the hook is mounted, it measures the document-relative bottom edge (`bottom + scrollY`) of the element that wraps the `EditorHeader`, and sets `--toast-offset-top` on the document root to that edge plus the new `--toast-gap` (0.5rem). The app shell's `--toast-offset-top` uses the same `--toast-gap`, so the two gaps can't drift apart. The hook measures again when the header resizes (a header that wraps grows), when its parent or the body resizes (a band inserted above moves the header down), and when the window resizes. A MutationObserver on the body (its tree, and `class`, `style` and `hidden`) also triggers a measurement, at most one per animation frame. It catches a full-height editor where a band above the header only shrinks the canvas. A wrapper that renders only after a loading state is picked up on the render that mounts it. On unmount the hook removes the value, and the app shell's default from `styles.css` applies again. The hook is meant for one mounted editor shell at a time. `EditorHeader` is unchanged: it takes no new prop and measures nothing.

**Migration:**

- Every full-screen editor route calls the hook exactly once. Wrap the `EditorHeader` in an element, pass that element's ref to the hook, and write no pixel value of your own: `const header = useRef<HTMLDivElement>(null); useEditorShellToastOffset(header); … <div ref={header}><EditorHeader … /></div>`.
- Community: its full-screen editor route calls the hook, and the local workaround from `COM-GL-039` rev 3 goes away.
- Cockpit: every full-screen editor route under `GL-UI-040` point 7 calls the hook.
- Editors that keep the app shell (inside `AppLayout`) do not call it. Their offset stays the app shell's default.

The gallery gains an `editor-shell` page: a full-screen editor whose Save shows a success toast with Undo. `&layout=screen` shows the same editor full height. Both are covered by axe, and neither has a screenshot. Baselines: none changed.

## 0.114.0 — #191, SUI-FEATURE-057 rev 4: a slider's hint opens over the whole slider, beside the track's end

Not breaking. A `Hint` around a `Slider` now opens its bubble on a hover anywhere over the slider, track and thumb, after the one hint delay. The bubble stands to the right of the track's end, so it covers neither the track nor the thumb (`GL-UI-016` §Lage). Before, it opened only over the thumb and stood beside it, over the track.

- The description (`aria-describedby`), the focus, `id` and `ref` stay on the thumb, as in 0.112.0. Focus opens no bubble.
- A press held on the slider, or a drag, keeps the bubble closed until the pointer leaves, as since 0.112.1.
- How: `Slider` declares `Slider.hintTriggerRef = "triggerRef"`. `Hint` passes its trigger's ref there, together with the pointer handlers, which land on the wrapper; the control's own `ref` stays its own.

**Migration:** none. Community moves its slider hint onto the slider, as noted in 0.112.0. Its hover behaviour over the whole slider stays the same as with the hint on its wrapping element.

Baselines: none changed. The gallery test for a held press on the thumb (0.112.0) now scrolls the slider into view first, so the mouse actually reaches it.

## 0.113.0 — #188, SUI-FEATURE-082 rev 5/6: user-menu toggles switch their label, `UserMenuItem` drops `pressed`

Breaking for apps that pass `pressed`. No visual change to the package.

**Migration:**

- `UserMenuItem` no longer takes `pressed` (added in 0.107.0, #179). An app toggle in the user menu is a plain entry whose label names the next action, such as "Turn notifications on" or "Turn notifications off". The app passes the matching `label` for the current state and keeps `keepOpen`.
- There is no `aria-pressed` and no `aria-checked` on such a toggle: with a switching label, a separate state would be announced twice and could contradict the label.
- Cockpit keeps its switching text and drops `role="menuitemcheckbox"` and `aria-checked` from its notifications toggle. Community checks its own entries the same way.
- E2E tests that checked `aria-pressed` or `aria-checked` on such a toggle check its label instead.

The gallery's Notifications entry now switches between "Turn notifications on" and "… off". Changed baselines (SUI-FEATURE-082 rev 6 AC 6, Q&A #3717): `shell-menu-{de,en,es}-{light,dark}.png`. Only the text of that gallery entry changes; in German the open panel is wider for "Benachrichtigungen einschalten". The package's panel, entries and states look unchanged.

## 0.112.1 — #190: hint bubbles stay closed during a held press

Fix, not breaking (`GL-UI-016`: a hint closes on click). An icon button's bubble no longer opens during a press held past the hint delay, for example on a pagination arrow. A press keeps it closed until the pointer leaves, and hovering again opens it as before. The cause was the same as in `Hint` (0.112.0): Radix closes only an open bubble on pointerdown, while the open timer started by the hover keeps running. Every package hint bubble now has the same fix through one shared internal hook: `Hint`, `IconButtonTooltip`, `OverflowTooltip`, the help of `LabelWithHelp`, and the plain `Tooltip`. Its `TooltipTrigger` gets the handlers from the `Tooltip`. A `Tooltip` whose `open` the app sets stays as the app sets it. `disabledText` and the `aria-disabled` behaviour are unchanged.

## 0.112.0 — #187, SUI-FEATURE-057 rev 3: the slider's thumb takes `ref`, `id` and `aria-describedby`

Not breaking. `Slider` takes `id`, `aria-describedby` and `ref` (a React 19 prop). All three land on the thumb (`role="slider"`), next to `aria-label` and `aria-labelledby`, as on the native `<input type="range">` the slider replaces. `ref.current` is the thumb. Props that a wrapping trigger merges in, such as a `Hint`'s handlers, also go to the thumb. `className` and `data-testid` stay on the wrapper. So a `Hint` can wrap the slider directly, and its description reaches the thumb.

`Hint`: a press now keeps the bubble closed until the pointer leaves (`GL-UI-016`). Before, a press held past the hint delay still opened it, because the open timer started by the hover kept running (for example a slider thumb held or dragged).

The gallery's Slider section gains a "With hint" row. Changed baselines: `components-{de,en,es}-{light,dark}.png` and `components-de-{light,dark}-{390,1440}.png`, each 40 px taller for that row.

**Migration:** Community moves its slider hint off the element that wraps the slider and onto the slider itself: `<Hint text=…><Slider … /></Hint>`.

## 0.111.0 — #186, GL-UI-050 rev 6, SUI-FEATURE-120 rev 5: a self-locking Save keeps the focus

Not breaking for the API; no new props. Behaviour changes that app tests may see.

**Migration:**

- Save in `SettingsFooter`/`SettingsActionRow`, in `EditorHeader` and the style Save of `DrawerRail`, while there is nothing to save (clean form or draft, including right after a save), is locked with `aria-disabled="true"` plus a trigger lock, no longer with `disabled`. Click, Enter, Space and the form's submit trigger nothing. App tests that check `toBeDisabled()` on a clean or just-saved Save check `aria-disabled="true"` instead. A running Save (`busy`) was already `aria-disabled` since `SUI-FEATURE-120`. Locks that have a reason stay `disabled`: an invalid entry, or a settings page that is loading or failed to load.
- After a successful save, the focus stays on Save. It no longer moves on to the next control of the row or header, or to the page's main content. App tests that expect the focus on a neighbour after saving expect it on Save. `EditorHeader` no longer hands the focus on after a save. A refold that swaps Save between icon and text returns the focus to Save.

Look unchanged: the locked Save has the look of the disabled one (half-tone fill, label mixed with the background, as in `MediaDetailShell` since 0.110.3). The element stays opaque, so its focus ring keeps full contrast.

Hints (Q&A #3709, GL-UI-017): every self-locking Save says what it does and when it becomes available. Its accessible description, reached via `aria-describedby`, is that hint, and its name stays "Save". New keys `editor.saveHint`, `editor.saveCleanHint`, `media.saveHint`, `media.saveCleanHint`, `canvas.styleSaveHint` and `canvas.styleSaveCleanHint` in de/en/es. The locked hints `settings.saveDisabledHint`, `settings.saveInvalidHint` and `settings.resetDisabledHint` now follow the same form: what the button does, then when it becomes available. `Hint` and `IconButtonTooltip` show `disabledText` for a control locked with `aria-disabled` too; such a control carries the description itself.

On unlocking, the Save fill now fades from half-tone to full colour through the button's colour transition. `MediaDetailShell` has done this since 0.110.1. Changed baselines: only the strings table, `gallery-{de,en,es}-{light,dark}.png` and `gallery-de-{light,dark}-{390,1440}.png`, for the six new keys and the three reworded settings hints. The settings, editor and media-detail baselines are unchanged.

## 0.110.3 — #189: locked Save label back to the old locked look

Fix, not breaking (SUI-FEATURE-085 §Delta 2, GL-UI-050: the locked look stays the same). Since 0.110.1 the locked Save's label in `MediaDetailShell` was half-tone against its own half-tone fill, so in dark mode it read less locked than the disabled Reset beside it. The label colour is now `--success-foreground` mixed 50 % with `--background`, the colour element opacity composited it to before. The half-tone fill and the full-contrast focus ring from 0.110.1 stay. Baselines `media-detail-de-dark.png`, `media-detail-en-dark.png` and `media-detail-es-dark.png` are back to their pre-0.110.1 pixels.

**Migration (nachgetragen):** none in code. Baselines: `media-detail-de-dark`, `media-detail-en-dark` and `media-detail-es-dark` back to their pre-0.110.1 pixels.

## 0.110.2 — #185: EditPanel pager chevrons keep a full-contrast focus ring

Fix, not breaking (WCAG 1.4.11, GL-UI-013). The locked ‹/› chevrons of the `EditPanel` pager no longer dim with element `opacity-50`, which also dimmed their focus ring below 3:1; they take the same locked look as `MediaDetailShell`'s since 0.110.1: a half-tone icon, no hover tint (in dark mode too), the element opaque. The shared class now lives beside `PANEL_SURFACE_CLASS` in `lib/panel-geometry`.

## 0.110.1 — #184: locked Save and pager chevrons keep a full-contrast focus ring

Fix, not breaking (WCAG 1.4.11). In `MediaDetailShell` the locked Save (nothing to save) and the locked ‹/› chevrons at the ends no longer dim with element `opacity-50`, which also dimmed their focus ring to about 1.85:1. Save shows its locked look by half-tone fill and text, the chevrons by a half-tone icon without hover tint; the element stays opaque, so the ring keeps full contrast. A running Save (busy) stays at full colour. Changed baselines: `media-detail-de-dark.png`, `media-detail-en-dark.png` and `media-detail-es-dark.png`, 3 pixels each in the Save icon, as the gallery compares them (Playwright's default colour threshold 0.2, no pixel allowance). The light `media-detail` baselines are unchanged: there the Save label's new slight tint stays below that threshold.

**Migration (nachgetragen):** none in code. Baselines: `media-detail-de-dark`, `media-detail-en-dark` and `media-detail-es-dark` changed.

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

Not breaking for apps that already follow 0.105.0. No visual change. _Superseded by 0.113.0: `UserMenuItem`'s `pressed` was removed there, and a toggle switches its label._

**Migration:** an app toggle in the user menu (e.g. a notifications switch) is a `UserMenuItem` with `keepOpen`, never `role="menuitemcheckbox"`. Its label and state follow 0.113.0. E2E tests find the panel as a group and its entries as buttons or by `data-testid`, not by `menu`/`menuitem` roles.

- ↓ on the trigger of the open panel focuses the first entry.
- The panel closes when the focus leaves it: Tab past Log out (also out of the document), Shift-Tab back to the trigger or beyond, a click beside it. The open language list counts as the panel, though portalled: opening it and picking a language keep the panel open. A press on the trigger while the focus is in the panel closes it, the focus on the trigger.

## 0.106.0 — #176, SUI-FEATURE-081 rev 3: UserMenu unavailableReason

Not breaking. `UserMenu` takes `unavailableReason` (`"notYet" | "noRole"`, default `"notYet"`); new type export `UnavailableReason`. New string `account.requiresRole` (de/en/es).

- It applies to every unavailable entry (`profileUnavailable`, `changePasswordUnavailable`, `securityUnavailable`): `"notYet"` keeps "Not available yet", `"noRole"` shows "Requires a role." The entries stay focusable with `aria-disabled` and trigger nothing.

**Migration (nachgetragen):** none in code. Baselines: 10 `gallery-*` changed (strings table).

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

**Migration (nachgetragen):** `media.missingRef` "No object linked." → "No file is attached to this entry."; `media.missingBytes` "File missing from storage." → "The file is no longer available. Upload it again or remove the entry." (de/es reworded alike). App tests that match the old sentences match the new ones. Baselines: 10 `gallery-*` changed (strings table).

## 0.102.0 — #166, SUI-FEATURE-140 rev 3: MediaDetailShell preview states and text preview

Not breaking. `MediaDetailShell` takes `previewState`, `previewDetail`, `text` and `format`; `src` is now optional; `MediaDetailKind` gains `"text"`. New type export `MediaPreviewState`. New strings `media.missingRef`, `media.missingBytes`, `media.noRenderer`, `media.truncated` (de/en/es).

- `previewState` (`"missingRef" | "missingBytes" | "noRenderer"`) replaces the preview by `kind` with an icon, one sentence and, muted below it, the optional `previewDetail`. Head, paging, details and footer keep working.
- `kind="text"` shows `text` in its own scroll region in the base family (never monospace, `GL-UI-010`), whitespace kept, wrapping on, tab size 2; `format="json"` indents valid JSON, invalid JSON stays plain. Past 200 KB (UTF-8) only the beginning shows, with a muted note.

**Migration (nachgetragen):** `MediaDetailShell` `src` is now optional and `MediaDetailKind` gains `"text"`; an exhaustive `switch` over `MediaDetailKind` needs the new case. Baselines: 10 `gallery-*` changed (strings table).

## 0.101.0 — #165, SUI-FEATURE-130 rev 3: DropdownMenu submenu

Not breaking. New exports from `@suite/ui/ui/dropdown-menu`: `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`.

- Thin wrappers around the Radix submenu parts, with no logic of their own. The sub-trigger looks like a menu item, carries a trailing chevron (mirrored in RTL) and stays highlighted while its submenu is open; the submenu content looks like the menu content and opens beside its trigger.
- Keyboard and focus come from Radix: Arrow right opens the submenu, Arrow left closes it with focus back on the sub-trigger, Esc closes the whole menu with focus back on the menu button.

**Migration (nachgetragen):** the tag also carries the version line rework (#156–#158), the sidebar's active-entry tint (#154) and the list tab stop in row-less states (#162). `VersionLine` (in `AppSidebar`): `data-testid="version-tooltip"` removed, the info is `version-info`; `version-line` is now a button named by the new string `version.name` ("Version {{text}}"). Baselines: 54 changed across `edit-panel-preview-split-*`, `edit-panel-preview-stacked-*`, `gallery-*`, `media-detail-*`, `shell-*`, `shell-menu-*`, `shell-search-*` and `shell-settings-*`.

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

**Migration (nachgetragen):** none in code. Baselines: 10 `gallery-*` changed (strings table).

## 0.98.0 — #150, SUI-FEATURE-120 rev 3 and GL-UI-050 rev 5: a running button keeps the focus

Changed for apps: `busy` no longer sets the `disabled` attribute. A running `Button` carries `aria-disabled="true"` and `aria-busy="true"` and stays focusable. App tests that check `disabled` (`toBeDisabled`) on a running button switch to `aria-disabled` plus the trigger guard. In Playwright, `toBeDisabled()` also counts `aria-disabled`, while `not.toHaveAttribute("disabled")` tells the two apart. New: `useFocusAfterRun` in `focus-return`.

- `Button busy`: the lock is a trigger guard on activation. A click, `Enter` and `Space` (both click a button) and the implicit submit of a surrounding form (a click on its submit button) are cancelled, and a press on the running button does not move the focus. The focus stays on the button for the whole run and after it, unless the button disappears. The lock does not cover an app's own `onKeyDown` on the button, nor an `asChild` trigger or a wrapping element that acts by itself; those check `busy` themselves. The look stays as the disabled button's was: full colour, the working sign, no hover tint (`aria-disabled:hover:` per variant), and now the progress cursor (`aria-busy:cursor-progress`). Hints behave as before: a `Hint` whose trigger is the running button stays closed on hover, the wrapping span of `Hint` with `disabledText` and of `IconButtonTooltip` opens on hover as before, and focus opens none. Real locks (`disabled`, with a reason) stay as they were. The repeat-click guard stays.
- Applies to every component that passes `busy` through: `RowActions` (an extra action), `PageHeader` add, `SettingsFooter`, `SettingsActionRow`, `EditPanel`, `EditorHeader`, `ConfirmDeleteDialog`, `MediaDetailShell`, `RestoreDefaultsButton`, `SecretCardHeader`, `DrawerRail`.
- A Save that locks itself as its run ends (the form is clean) hands the focus on (`GL-UI-050`), never to `<body>`. `SettingsFooter` and `SettingsActionRow` hand it to the next usable control of their row, else the page's main content. `MediaDetailShell` hands it to the next usable control of its footer, else the first field of the details. `EditorHeader` already did this. Their rows carry `data-focus-group`. Each target counts only if it takes the focus; otherwise the next one is tried.
- Gallery: a check that a running Save keeps the focus, that `Enter`, `Space`, a click and the form's implicit submit start no second run, and that the focus lands on the main content, not the body, once Save locks. The edit panel and media detail checks assert the focus too.

**Migration (nachgetragen):** a running `Button` (`busy`) no longer carries `disabled`, only `aria-disabled="true"` and `aria-busy="true"`. A jest-dom `toBeDisabled()` on a running button switches to `toHaveAttribute("aria-disabled", "true")`; Playwright `toBeDisabled()` keeps passing. Baselines: none changed.

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

**Migration (nachgetragen):** none in code. Baselines: 204 of 224 regenerated natively (arm64), all page patterns.

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

**Migration (nachgetragen):** none in code. Each toast now carries its variant's name (`suite:status.*`) as screen-reader text, so a test that finds a toast by a text equal to that name ("Success") matches twice; select the toast element (`[data-sonner-toast][data-type=success]`) instead. Baselines: 30 changed, 10 each of `components-*`, `preview-*` and `tiles-*`.

## 0.95.0 — #147, SUI-FEATURE-110 rev 3: sidebar as an overlay below md

Not breaking. At `md` (48rem) and up the shell and panels look and behave as before. New: `SidebarOverlayTrigger`; `useSidebar()` also returns `isOverlay`, `overlayOpen`, `openOverlay` and `closeOverlay`; the CSS variable `--sidebar-inset`; the string `suite:nav.openNavigation` (de/en/es).

- Below `md` the `AppSidebar` is an overlay. It takes no room beside the content and is closed by default. When open it lies expanded over the content with a scrim, and it is modal: the content behind is `inert` and Tab and Shift+Tab cycle inside it. A dialog it opens (the search) keeps its own Tab and `Esc`.
- `Esc`, a click beside it (the scrim), a navigation and a press on a link or the home name of the current route close it; the focus returns to the trigger (`GL-UI-050`). When the navigation replaced the page and its head, the trigger of the new head takes it, also on a route that renders later (a transition, a lazy route) or in the closing render (a synchronous router). The first press or key of the person ends that handover, and a page that places the focus itself (`autoFocus`, a focused heading) keeps it. The sidebar's own toggle closes it too, without touching the stored collapse choice.
- `UserMenu` is a package `Esc` layer: inside the overlay, the first `Esc` closes the open menu only (`GL-UI-007`).
- The trigger (`SidebarOverlayTrigger`, the panel symbol named "Open navigation", `aria-expanded` and `aria-controls` on the sidebar) stands at the start of every `PageHeader` inside a `SidebarProvider`, below `md` only. A surface without a `PageHeader` places it itself. `EditorHeader` has none: Back leads out of an editor.
- Below `md`, `useSidebar().isOpen` is always true (the overlay shows the expanded sidebar) and `toggle` closes the overlay.
- Panels: `EditPanel`, `MediaDetailShell` and the maximized `PreviewFrame` take the full viewport width below `md`. Their left edge is the sidebar width times `--sidebar-inset` (1, and 0 below `md`), so at `md` and up it is the same as before.
- Gallery: the shell page at 390 px shows the sidebar closed and the trigger in the page head; the strings page lists the new string.

**Migration (nachgetragen):** none in code. Baselines: 12 changed, 10 `gallery-*` (strings table) and `shell-de-light-390` / `shell-de-dark-390`.

## 0.94.0 — #146, SUI-FEATURE-100 rev 4: TagInput suggestions

Not breaking. `TagInput` takes an optional `suggestions`; without it the field is unchanged. New string `suite:tags.suggestions` (de/en/es), the name of the suggestion list.

- `TagInput suggestions={…}` (`SUI-FEATURE-100`): typing lists the matching existing tags under the field. Tags that start with the typed text come first, then those that contain it, ignoring letter case, at most eight. The first entry is chosen only if it starts with the text; an entry that merely contains it ("tur" → "Kultur") waits for the arrows. Tags already added are left out, and a suggestion listed twice in any letter case shows once.
- The arrows move the choice and keep it in view. Enter and Tab take the chosen entry over as a chip, and the field keeps the focus. With nothing chosen, Enter takes the typed text over as before and Tab leaves the field. The comma and leaving the field always take the typed text, never a suggestion in its place. Esc closes the list and keeps the text (and never closes a surrounding dialog). A tag typed in another letter case than a suggestion takes the suggestion's spelling on every way in (Enter, Tab, comma, leaving).
- Combobox pattern: the field has `role="combobox"` with `aria-expanded`, the list `role="listbox"`, the chosen option is named by `aria-activedescendant`; adding a chip is still announced. Long names wrap inside the list.
- The list floats like the time zone list: no portal; in a dialog or panel body it grows the body or opens upwards (`GL-UI-027` §Floating Content). Both use the new shared `usePopupPlacement` (`src/lib/popup-placement.ts`); the time zone list behaves as before.
- Gallery: the tag field of the components page offers suggestions. The strings page lists the new string.

**Migration (nachgetragen):** none in code. Baselines: 10 `gallery-*` changed (strings table).

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

**Migration (nachgetragen):** none in code. Baselines: `components-de-light-390` and `components-de-dark-390` changed.

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

**Migration (nachgetragen):** none in code. Baselines: 8 changed, `components-`, `gallery-`, `preview-` and `split-de-{light,dark}-390.png`.

## 0.91.3 — SUI-FEATURE-076 rev 5 (#135): gallery phase in the pinned Playwright image

Not breaking. Package API unchanged. No CI workflow: the package is built and checked by the local gate.

- The local gate's `gallery` phase runs `npm run gallery:image`: the gallery screenshots from `gallery/gallery.spec.ts` inside the pinned Playwright image via `docker run` (`linux/amd64`). All gallery baselines are regenerated in that image; macOS baselines are gone.
- The pinned image is written out once, in `scripts/playwright-image.ts`, and refused while it does not match the lockfile's `@playwright/test`.
- Still scene: fixed browser clock, time zone `Europe/Zurich`, locale `en-US`, `animations: "disabled"`.
- New screenshots of every gallery page and the shell at 390 and 1440 px, in de, light and dark.
- `npm run gate:record` runs the merge gate and, on green with a clean tree, records it for HEAD's tree in `.spec-sync/gate-records/`. `npm run release:tag` is the only way to tag: it tags and pushes `v<version>` only with a green record for HEAD's tree.

**Migration (nachgetragen):** none in code. Baselines: all 156 existing ones regenerated in the Playwright image (macOS renderings gone); 68 new, `<page>-de-{light,dark}-{390,1440}.png` for 17 pages.

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

**Migration (nachgetragen):** `ButtonProps` is now a union (`{ variant, size }` or `{ variant: "link", size: "inline" }`); `ButtonSize` keeps its members. Baselines: 6 `components-*` changed.

## 0.88.1 — SUI-FEATURE-049 rev 6 (#129): tooltips close on every focus change

Not breaking.

- `Tooltip`, `Hint`, `OverflowTooltip`: a bubble opened by hover closes in the next frame as soon as focus lands on any element outside its trigger and its content — also when the trigger is not focusable (e.g. `OverflowTooltip` on a `MediaTile` name). Previously only a blur of the trigger closed it.

## 0.88.0 — SUI-FEATURE-005 rev 2 (#128): LabelWithHelp and RadioGroup follow the field canon

Not breaking. Two defaults change; apps drop their shims on the pin bump.

- `LabelWithHelp`: the label is `text-sm font-medium` and has no outer margin any more (`mb-1` dropped). The field container sets the 8 px to the field (`gap-2`); an app override of `mb-0`/`font-medium` is no longer needed.
- `RadioGroup`: the options stand 8 px apart (`gap-2`) instead of 12 px (`gap-3`); an app override to `gap-2` is no longer needed.
- `SettingsField`, `SettingsToggleField`: their own overrides of both defaults removed; layout unchanged.

**Migration (nachgetragen):** drop app overrides of `mb-0`/`font-medium` on `LabelWithHelp` and `gap-2` on `RadioGroup`; a test that checks the label's `mb-1` or the options' `gap-3` sees the new defaults. Baselines: 6 `components-*` changed.

## 0.87.0 — SUI-FEATURE-080 rev 2 (#127): Cancel in the delete dialog is always "Cancel"

Breaking for callers that pass `cancelLabel`: it no longer compiles.

- `ConfirmDeleteDialog`: `cancelLabel` removed; Cancel always shows the package text (`actions.cancel`).

**Migration (nachgetragen):** `ConfirmDeleteDialog` prop `cancelLabel` removed; drop it, Cancel shows `actions.cancel`. Baselines: none changed.

## 0.86.0 — SUI-FEATURE-074 rev 2 (#126): an icon button's hint opens on hover only

Not breaking.

- `IconButtonTooltip`: focus opens no bubble any more — keyboard, initial or programmatic focus, free, disabled with `disabledText` and declaring `busy` alike; a bubble beside the button covered the neighbour of its row and caught its clicks. The text reaches the focus as the name (`label`), while disabled as the span's description (`disabledText`). Hover opens it after the hint delay as before. Applies to every consumer, `RowActions` and `PreviewToolbar` included.

## 0.85.0 — SUI-FEATURE-073 rev 2 (#125): dialog mode only on the form size, the time zone list floats

Breaking for types only: a compact `DialogContent` with `mode` no longer compiles. Runtime unchanged.

- `DialogContent`: `mode?: "add" | "edit"` types only together with `size="form"`; there it stays optional.
- `TimezoneCombobox`: the open list floats over the content at the field's width and shifts nothing below. Where a dialog or panel body would clip it, the body grows by the missing part; where it cannot, the list opens upwards.
- `TimezoneCombobox`: with `data-testid="<id>"` the list carries `<id>-options` and each option `<id>-option`.
- `TimezoneCombobox`: `aria-errormessage`, set on the field only while it is invalid.

**Migration (nachgetragen):** `DialogContent` `mode` now types only with `size="form"`; drop it from compact dialogs. Baselines: none changed.

## 0.84.0 — SUI-FEATURE-072 rev 2 (#123): a row action can be running

Not breaking.

- `RowAction`: `busy?: boolean`. A running action shows the `Button` working state in full colour with `aria-busy` and is locked against a second click, a double click and activation through its shortcut; for this action in this row only, the other actions stay operable.
- `PreviewToolbar`: the selected row's running action shows the same state; folded into ⋯, its entry is locked while it runs.
- `IconButtonTooltip`: a control that declares `busy` sits in a span trigger, so its hint, still "‹label› ‹rowName›", opens on hover while it is locked.
- Gallery: on the list with `?actions=1` the second row's copy is running.

## 0.83.0 — SUI-FEATURE-004 rev 3 (#122): the usage table shows domain states

Not breaking.

- `UsageTable`: an item's `status` is a catalog state or a domain state `{ tone, label }`; the latter renders as a `StatusChip` in that tone with the app's label.

**Migration (nachgetragen):** `UsageTable` `items[].status` widened from `StatusChipState` to `StatusChipState | { tone, label }`; existing call sites compile unchanged. Baselines: none changed.

## 0.82.0 — SUI-FEATURE-070 rev 5 (#121): the truncated name badge carries no `title`

Not breaking.

- `CanvasOverlay`: a name badge that ends in "…" no longer carries the full name as its `title`; the full name stays in the `canvas.selected` announcement.

## 0.81.0 — SUI-FEATURE-070 rev 4 (#120): the name badge is clipped at no frame edge

Not breaking.

- `CanvasOverlay`: past the overlay's right edge the name badge moves left, above the selection and inside its top left corner alike.
- A badge wider than the overlay is capped at its width and ends in "…"; it then carries the full name as its `title`.
- The action bar's check against the badge now uses the badge's actual left edge (2 px further right than before at a selection away from the left edge).
- Gallery: the canvas section shows two narrow frames with a selection at the right edge, one with a badge moved left and one truncated.

**Migration (nachgetragen):** none in code. Baselines: 6 `components-*` changed.

## 0.80.0 — SUI-FEATURE-070 rev 3 (#119): the name badge is never clipped

Not breaking.

- `CanvasOverlay`: the selection's name badge stands above the selection, left-aligned; without room up to the overlay's edge it moves inside the top left corner, and at the left edge it does not reach past the frame.
- The action bar also moves below the selection where, above it, it would cover the name badge (a narrow selection); the badge stays.

**Migration (nachgetragen):** none in code. Baselines: 6 `components-*` changed.

## 0.79.0 — SUI-FEATURE-071 rev 1 (#117): `PropertyPanel` and `DrawerRail`

Not breaking (new components).

- New `PropertyPanel` (`path`, `tabs`, `activeTab`, `onTab`): the fixed 340 px column on the right of a visual editor, as high as the editor area, with a `--border` rule on the left. The head holds the path (Document › … › element; every step but the last is a link that selects its element) and the tabs in the fixed order Content · Layout · Background, leaving out the ones the element lacks. Only the body scrolls.
- New `DrawerRail` (`items`, `open?`, `onOpen`, `styleSave?`): the narrow rail on the left with `ghost` `icon-sm` buttons Add · Layers · Style · Document (tooltip with the name, optional `badge`). A click opens the 300 px drawer beside it, which narrows the canvas instead of covering it; a second click or `Esc` closes it (innermost `Esc` first) and the focus returns to its button. At most one is open; its button is pressed.
- The style drawer has a footer with "Save style" (`success`, `SaveIcon`) and the scope note "Applies to everything that uses this brand kit"; the app supplies the save and its dirty state through `styleSave`.
- Texts `canvas.tab.*`, `canvas.drawer.*`, `canvas.styleSave` and `canvas.styleScope` in de/en/es.
- Gallery: the components page shows an editor frame with the rail, the open style drawer, the canvas and the property panel.

**Migration (nachgetragen):** none in code. Baselines: 12 changed, 6 `components-*` and 6 `gallery-*`.

## 0.78.0 — SUI-FEATURE-070 rev 1 (#116): `CanvasOverlay` and `CanvasZoom`

Not breaking (new components).

- New `CanvasOverlay` (`hovered?`, `selected?`, `actions?`, `inserts?`, `onSelectParent?`): the unscaled selection layer of a visual editor. It is rendered inside the positioned canvas frame and takes the pointer only on its own controls; the app passes its elements' rects in frame coordinates after zoom. Hover is a dashed 2 px `--ring` frame, the selection a solid 2 px `--ring` frame with a name tag (`--primary`) at its top left; the lines stay 2 px at any zoom. A new selection is announced once ("Selected: ‹name›").
- `actions` float above the selection, right-aligned, and below it when the space above is less than their height. Each insert point is a round `+` (`outline`, `icon-xs`, named by its `label`), always visible and in the tab order.
- `Esc` with a selection calls `onSelectParent`; without one it goes on outwards (`GL-UI-007`).
- New `CanvasZoom` (`zoom`, `mode: "fit" | "actual"`, `onMode`): the radio group "Fit" · "100 %" with the current level as text, for the `PreviewToolbar`'s further tools between status and device.
- Texts `canvas.fit`, `canvas.actual`, `canvas.selected` and `canvas.zoom` (the group's name) in de/en/es.
- Gallery: the components page shows a canvas under a preview toolbar with the zoom, with hover, selection, actions and insert points.

**Migration (nachgetragen):** none in code. Baselines: 12 changed, 6 `components-*` and 6 `gallery-*`.

## 0.77.0 — SUI-FEATURE-069 rev 1 (#115): a lifecycle slot in the `EditorHeader`

Not breaking (one new optional property).

- `EditorHeader` takes `lifecycle?: { preview?; menu?; next?: { label; icon?; onClick; busy?; disabledText? } }`. It stands on the right before the editor group, in the order Preview · ⋯ · next step, followed by a vertical separator at the bar's height. Without it nothing changes.
- The next step is a `Button` `success`, size `default`, with the working state while `busy`. While the draft is unsaved (`dirty`) it is locked with the tooltip "Save first" (`suite:editor.saveFirst`, de/en/es); a `disabledText` of the app takes precedence and locks it as well. So never more than one green button is usable at a time.
- Gallery: the `EditorHeader` section shows an editor with a lifecycle saved and with a draft.

**Migration (nachgetragen):** none in code. Baselines: 12 changed, 6 `components-*` and 6 `gallery-*`.

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

**Migration (nachgetragen):** `MediaDetailShell.usage` retyped from `ReactNode` to `{ count, active, onToggle, content }`; pass the usages as a `UsageTable` in `content`. `MediaUsageList` is `@deprecated`. Baselines: 18 changed, 6 each of `gallery-*`, `media-detail-*` and `preview-*`.

## 0.74.0 — SUI-FEATURE-003 rev 1 (#112): `PreviewToolbar` separator and filled active device

Not breaking (no new props).

- The chosen device in the `PreviewToolbar` is filled (`bg-primary`, `text-primary-foreground`, `border-primary`, also on hover) in light and dark; the other stays `outline`. `ViewToggle` and `SplitWorkspace` are unchanged.
- A vertical 1 px rule (`bg-border`, the height of the `sm` buttons, `aria-hidden`, `data-testid="preview-separator"`) parts the view group (device and/or maximize) from the actions. It stands only when both are there; wrapped (`SUI-FEATURE-067` step 3) only when maximize stands beside the actions in the first line.
- Gallery: the `preview` page shows the separator and the filled device.

**Migration (nachgetragen):** none in code. Baselines: 12 changed, 6 `preview-*` and 6 `split-*`.

## 0.73.0 — SUI-FEATURE-068 rev 2 (#111): `PageHeader` add entry reports open and closed

Not breaking (two new optional props).

- A `PageHeader` `add` entry takes optional `expanded?: boolean` and `controls?: string`; when set, the button renders `aria-expanded` and `aria-controls`. Without them nothing changes.
- Gallery: new upload add entry that toggles a panel and reports open/closed.

**Migration (nachgetragen):** none in code. Baselines: 6 `components-*` changed.

## 0.72.0 — SUI-FEATURE-067 rev 2 (#110): `PreviewToolbar` in a narrow column

Not breaking (no new props).

- `PreviewToolbar` measures its own width (`ResizeObserver`, never the window) and, when it does not fit one line, shrinks in order: the actions but edit fold into the ⋯ overflow menu, then edit too; after that language, status and device wrap into a second, left-aligned line. Widening restores in reverse order.
- Folded, the menu holds the row's actions in the row's order (extra actions, edit, the row's own menu entries), delete last after a separator. Without a row `menu` the ⋯ button is named by the new string `actions.more` ("More for {{name}}").
- Close stays far right in the first line in every state, never alone: without maximize or actions the device switch stays beside it, and with neither the toolbar does not wrap.
- The toolbar carries `data-shrink` (`0`–`3`) for its current step.
- Gallery: the `preview` page shows the full toolbar at 420, 600 and 900 px.

**Migration (nachgetragen):** `PreviewToolbar` test ids re-nested: `preview-language`, `preview-status` and `preview-device` now sit in the new `preview-toolbar-top` / `preview-toolbar-bottom` wrappers inside `preview-toolbar`. Baselines: 12 changed, 6 `gallery-*` and 6 `preview-*`.

## 0.71.0 — SUI-FEATURE-066 rev 2 (#109): `RowActionSet` overflow menu

Not breaking (one new optional property).

- `RowActionSet` takes `menu?: { label; items: { label; onSelect; destructive?; disabled? }[] }`. It shows as an `outline` ⋯ icon button (`aria-label` and tooltip = `label`) after `extra` and edit and before delete, and opens a `DropdownMenu`.
- Destructive entries stand last after a separator, in the destructive colour; disabled entries are muted and cannot be chosen. The menu works by keyboard (Enter opens, arrows select, Esc closes).
- The table row (`RowActions`) and the `PreviewToolbar` render the menu alike through `useRowActionButtons`, which now also returns `menu`.
- New type export `RowMenuItem`.
- Gallery: the `preview` page shows a row with a menu and its matching preview header.

**Migration (nachgetragen):** none in code. Baselines: 6 `preview-*` changed.

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

**Migration (nachgetragen):** none in code. Baselines: 18 changed, 6 each of `components-*`, `crop-editor-*` and `gallery-*`.

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

**Migration (nachgetragen):** none in code. Baselines: 6 `tiles-*` changed.

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

**Migration (nachgetragen):** none in code. Baselines: 6 `components-*` and 6 `gallery-*` changed; 6 `crop-editor-*` new.

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

**Migration (nachgetragen):** none in code. Baselines: 6 `gallery-*` changed (strings table); 6 `media-detail-*` new.

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

**Migration (nachgetragen):** `tabs` on `DataTableShell` and `TileGridShell` retyped from `ReactNode` to `ListTabs` (`{ list, value }`). A `SelectTrigger` with `fieldName` adds a hidden field name to its text content, so `FilterSelect` and `SortSelect` triggers read it too. Baselines: none changed.

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

**Migration (nachgetragen):** export `@suite/ui/config` (`configureSuiteUi`, `suiteUiConfig`, `SuiteUiConfig`) removed. `FilterBar` test ids: `filterbar-filters` and `filterbar-search-group` removed; filters, reset and sort sit in the new `filterbar-controls`. Baselines: 14 changed, `list-*` and `list-bottom-*` (de/en/es, light/dark) and `tiles-en-*`.
