import "../src/styles.css";
import "./gallery.css";

import i18n from "i18next";
import { type ReactNode, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { initReactI18next, useTranslation } from "react-i18next";

import { registerSuiteStrings, suiteStrings, type SuiteLanguage } from "../src/strings/index.js";
import { installLeaveGuard } from "../src/ui/leave-guard.js";
import { ComponentsPage } from "./ComponentsPage.js";
import { EditorHeaderPage } from "./EditorHeaderPage.js";
import { EditorShellPage } from "./EditorShellPage.js";
import { EditPanelPage } from "./EditPanelPage.js";
import { DateFieldsHarness } from "./DateFieldsHarness.js";
import { FieldPairHarness } from "./FieldPairHarness.js";
import { GridPage } from "./GridPage.js";
import { HelpPage } from "./HelpPage.js";
import { InsetPage } from "./InsetPage.js";
import { KeysPage } from "./KeysPage.js";
import { LeaveGuardHarness } from "./LeaveGuardHarness.js";
import { ListPage } from "./ListPage.js";
import {
  ConfirmPage,
  ConfirmWordPage,
  DialogPage,
  OverlaysPage,
  SelectPage,
  SheetPage,
  ToastPage,
} from "./OverlayPages.js";
import { PressedPage } from "./PressedPage.js";
import { PreviewPage } from "./PreviewPage.js";
import { SettingsPage } from "./SettingsPage.js";
import { SlideExportHarness, SlidePlayerPage } from "./SlidePlayerPage.js";
import { SlideEditorPage } from "./SlideEditorPage.js";
import { SlidesPage } from "./SlidesPage.js";
import { registerShellLabels, ShellPage } from "./ShellPage.js";
import { SplitPage } from "./SplitPage.js";
import { TilesPage } from "./TilesPage.js";
import { TokensPage } from "./TokensPage.js";

const LANGUAGES = Object.keys(suiteStrings) as SuiteLanguage[];
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];
const PAGES = [
  "strings",
  "tokens",
  "components",
  "list",
  "tiles",
  "keys",
  "settings",
  "shell",
  "dialog",
  "confirm",
  "typed-word",
  "overlays",
  "select",
  "sheet",
  "inset",
  "edit-panel",
  "editor-shell",
  "editor-bar",
  "grid",
  "pressed",
  "help",
  "toast",
  "preview",
  "split",
  "slides",
  "slide-player",
  "slide-editor",
] as const;
type Page = (typeof PAGES)[number];

// The initial state comes from the URL (`?page=tokens&lng=de&theme=dark`), so every capture is
// addressable.
const params = new URLSearchParams(window.location.search);
const initialLng = (LANGUAGES as string[]).includes(params.get("lng") ?? "")
  ? (params.get("lng") as SuiteLanguage)
  : "en";
const initialTheme: Theme = params.get("theme") === "dark" ? "dark" : "light";
const initialPage: Page = (PAGES as readonly string[]).includes(params.get("page") ?? "")
  ? (params.get("page") as Page)
  : "strings";

await i18n.use(initReactI18next).init({ lng: initialLng, fallbackLng: "en", resources: {} });
registerSuiteStrings(i18n);
registerShellLabels();
// Every page but the strings table, by name.
const PAGE_CONTENT: Record<Exclude<Page, "strings">, (theme: Theme) => ReactNode> = {
  tokens: () => <TokensPage />,
  components: () => <ComponentsPage />,
  list: () => <ListPage />,
  tiles: () => <TilesPage />,
  keys: () => <KeysPage />,
  settings: () => <SettingsPage />,
  shell: () => <ShellPage />,
  dialog: () => <DialogPage />,
  confirm: () => <ConfirmPage />,
  "typed-word": () => <ConfirmWordPage />,
  overlays: () => <OverlaysPage />,
  select: () => <SelectPage />,
  sheet: () => <SheetPage />,
  inset: () => <InsetPage />,
  "edit-panel": () => <EditPanelPage />,
  "editor-shell": (theme) => <EditorShellPage theme={theme} />,
  "editor-bar": () => <EditorHeaderPage />,
  grid: () => <GridPage />,
  pressed: () => <PressedPage />,
  help: () => <HelpPage />,
  toast: (theme) => <ToastPage theme={theme} />,
  preview: (theme) => <PreviewPage theme={theme} />,
  split: () => <SplitPage />,
  slides: () => <SlidesPage />,
  "slide-player": () => <SlidePlayerPage />,
  "slide-editor": () => <SlideEditorPage />,
};

function keysOf(tree: object, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keysOf(value as object, `${prefix}${key}.`),
  );
}

function Gallery() {
  const { t } = useTranslation("suite");
  const [lng, setLng] = useState<SuiteLanguage>(initialLng);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [page, setPage] = useState<Page>(initialPage);

  useEffect(() => {
    void i18n.changeLanguage(lng);
    document.documentElement.lang = lng;
  }, [lng]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <>
      <header>
        <h1>@suite/ui</h1>
        <label>
          Page{" "}
          <select
            data-testid="gallery-page"
            value={page}
            onChange={(event) => setPage(event.target.value as Page)}
          >
            {PAGES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Language{" "}
          <select
            data-testid="gallery-language"
            value={lng}
            onChange={(event) => setLng(event.target.value as SuiteLanguage)}
          >
            {LANGUAGES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Theme{" "}
          <select
            data-testid="gallery-theme"
            value={theme}
            onChange={(event) => setTheme(event.target.value as Theme)}
          >
            {THEMES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </header>
      <main
        className={
          page === "list" ||
          page === "settings" ||
          page === "shell" ||
          page === "edit-panel" ||
          page === "inset"
            ? "frame"
            : undefined
        }
      >
        {page === "strings" ? (
          <section aria-labelledby="strings-heading">
            <h2 id="strings-heading">Strings</h2>
            <table className="strings-table">
              <thead>
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">Text</th>
                </tr>
              </thead>
              <tbody>
                {keysOf(suiteStrings.en).map((key) => (
                  <tr key={key}>
                    <td>suite:{key}</td>
                    <td>{t(key, { field: "Status" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          PAGE_CONTENT[page](theme)
        )}
      </main>
    </>
  );
}

// The substitute font (gallery.css) is loaded before the first render, so every capture shows the final
// layout (`GL-TEST-019`: a still scene). Kept on purpose: CanvasOverlay re-measures after a font swap
// (#218), but a popper placed before the swap — the open Select at 390 px — stays 1 px off. A cut that
// fails to load leaves the fallback font, never a blank gallery.
await Promise.allSettled(
  [400, 500, 600, 700].map((weight) => document.fonts.load(`${weight} 1em "Gallery Inter"`)),
);
// The leave guard's harness installs the guard as an app's entry does, before its router renders;
// `&install=none` leaves that out, as when the guard only arrives with a lazy route (#235).
const harness = params.get("harness") === "leave-guard";
if (harness && params.get("install") !== "none") installLeaveGuard();
// The slide export page, alone on the page as an app's export route renders it.
const exportHarness = params.get("harness") === "slide-export";
// Two fields side by side in an app's grid (#441).
const fieldPair = params.get("harness") === "field-pair";
// The date and time types of `Input`, to tab onto their calendar button (#410).
const dateFields = params.get("harness") === "date-fields";
createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    {exportHarness ? (
      <SlideExportHarness
        editor={params.get("view") === "editor"}
        broken={params.get("broken") === "1"}
      />
    ) : fieldPair ? (
      <FieldPairHarness />
    ) : dateFields ? (
      <DateFieldsHarness />
    ) : harness ? (
      <LeaveGuardHarness />
    ) : (
      <Gallery />
    )}
  </StrictMode>,
);
