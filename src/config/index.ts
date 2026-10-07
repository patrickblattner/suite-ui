// The app switch (`SUI-DESIGN-012`): where the two apps follow different valid norms for one building
// block until the cockpit go-live, the package carries both forms. The defaults are the behaviour of
// `v0.15.0`, so an app that never calls the switch stays unchanged. Each setting is transitional and
// ends as named in its step's sheet (`SUI-FEATURE-026`).
type SuiteUiConfig = {
  // `kind`: static filters, search, reset, dynamic filters, sort (`GL-UI-024`). `block`: one filter
  // block left of the search, then search, reset and sort, wrapping as two groups (`COM-GL-013`).
  filterBar: "kind" | "block";
  // `content`: minimum widths that grow with the chosen value. `measured`: the trigger takes its width
  // from the longest translated entry of the active language (`COM-GL-004`).
  selectWidth: "content" | "measured";
  // `fixed`: the user-menu panel has the footer's width and the trigger always shows name and role.
  // `fit`: the panel takes the width of its longest entry, and the collapsed trigger shows only avatar
  // and kebab (`GL-020`, `SUI-FEATURE-028`).
  userMenu: "fixed" | "fit";
  // `frame`: the table container scrolls sideways itself and the header is not sticky. `page`: the
  // container has no overflow of its own and `TableHeader` is sticky against the page's scroll area
  // (`GL-UI-023`, `SUI-FEATURE-029`).
  tableScroll: "frame" | "page";
  // `all`: every row highlights on hover. `target`: only rows with `data-grid-row`, the ones that open
  // something (`COM-GL-012`).
  tableRowHover: "all" | "target";
  // `static`: the actions column scrolls with the rest. `sticky`: head and cell with
  // `data-col-kind="actions"` stick to the right edge.
  tableActions: "static" | "sticky";
};

const DEFAULTS: SuiteUiConfig = {
  filterBar: "kind",
  selectWidth: "content",
  userMenu: "fixed",
  tableScroll: "frame",
  tableRowHover: "all",
  tableActions: "static",
};

let current: SuiteUiConfig = DEFAULTS;

/** Sets the app switch; call once at start, next to `registerSuiteStrings`. Unset keys keep their default. */
function configureSuiteUi(options: Partial<SuiteUiConfig>): void {
  current = { ...DEFAULTS, ...options };
}

/** The switch as the components read it at render time. */
function suiteUiConfig(): Readonly<SuiteUiConfig> {
  return current;
}

export { configureSuiteUi, suiteUiConfig, type SuiteUiConfig };
