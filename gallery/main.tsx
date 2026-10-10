import "../src/styles.css";
import "./gallery.css";

import i18n from "i18next";
import { type ReactNode, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { initReactI18next, useTranslation } from "react-i18next";

import { configureSuiteUi } from "../src/config/index.js";
import { registerSuiteStrings, suiteStrings, type SuiteLanguage } from "../src/strings/index.js";
import { ComponentsPage } from "./ComponentsPage.js";
import { EditPanelPage } from "./EditPanelPage.js";
import { HelpPage } from "./HelpPage.js";
import { KeysPage } from "./KeysPage.js";
import { ListPage } from "./ListPage.js";
import {
  ConfirmPage,
  DialogPage,
  OverlaysPage,
  SelectPage,
  SheetPage,
  ToastPage,
} from "./OverlayPages.js";
import { SettingsPage } from "./SettingsPage.js";
import { registerShellLabels, ShellPage } from "./ShellPage.js";
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
  "overlays",
  "select",
  "sheet",
  "edit-panel",
  "help",
  "toast",
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
// The app switch as an app sets it at start (`?filterBar=block&selectWidth=measured&userMenu=fit`,
// `&tableScroll=page&tableRowHover=target&tableActions=sticky`); without the
// parameters the gallery shows the defaults.
configureSuiteUi({
  filterBar: params.get("filterBar") === "block" ? "block" : "kind",
  selectWidth: params.get("selectWidth") === "measured" ? "measured" : "content",
  userMenu: params.get("userMenu") === "fit" ? "fit" : "fixed",
  tableScroll: params.get("tableScroll") === "page" ? "page" : "frame",
  tableRowHover: params.get("tableRowHover") === "target" ? "target" : "all",
  tableActions: params.get("tableActions") === "sticky" ? "sticky" : "static",
});

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
  overlays: () => <OverlaysPage />,
  select: () => <SelectPage />,
  sheet: () => <SheetPage />,
  "edit-panel": () => <EditPanelPage />,
  help: () => <HelpPage />,
  toast: (theme) => <ToastPage theme={theme} />,
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
          page === "list" || page === "settings" || page === "shell" || page === "edit-panel"
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

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
