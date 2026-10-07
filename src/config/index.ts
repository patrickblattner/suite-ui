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
};

const DEFAULTS: SuiteUiConfig = { filterBar: "kind", selectWidth: "content" };

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
