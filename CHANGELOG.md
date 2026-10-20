# Changelog

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
