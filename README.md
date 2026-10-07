# suite-ui

> `@suite/ui` — the one shared UI implementation of the suite apps (Production Cockpit, Community Platform): design tokens, base components, shell frame and their texts in de / en / es.

## Overview

Cockpit and Community are used by the same people, so they must look and speak identically. The UI rules live in the foundation specs on the spec server (`GL-UI-0xx`, entry point `GL-UI-004`). This package is the single implementation of those rules. Both apps consume it, so a shared element exists once instead of twice.

- **Rules:** foundation specs (what it should look like). They are never restated here.
- **Package:** this repo (how it is built). Spec project `suite-ui`, key prefix `SUI`.
- **Apps:** consume the package and never override its tokens, components or texts.

Status: being set up (October 2026). The package is seeded from the cockpit, which is the suite reference. The community migrates first and the cockpit follows after its go-live. Moving onto the package changes presentation only, never function.

## Contents (planned)

- Design tokens (`styles.css`: palette, action tokens, layout variables, dark mode)
- Base components (button, dialog, form fields, badge, hint, confirm dialog)
- List frame (page header, filter bar, sort, pagination)
- Settings footer
- Shell frame (sidebar, user menu, search dialog) with slots for app-specific entries
- Texts of all shared elements in de / en / es (i18n namespace `suite`)
- Parity check and shared test assertions for both apps

## Usage in an app

```bash
npm install --save-dev github:patrickblattner/suite-ui#vX.Y.Z
```

Switching to a new tag always needs this explicit `npm install` (lockfile). Then add `@import "@suite/ui/styles.css";` once in the app CSS and call `registerSuiteStrings(i18n)` once in the i18n setup.

An app that follows a different norm until the cockpit go-live sets the app switch once at start, next to `registerSuiteStrings`: `configureSuiteUi({ filterBar?: "kind" | "block"; selectWidth?: "content" | "measured" })` from `@suite/ui/config`. The defaults `kind` and `content` are the previous package behaviour.

Peer dependencies (never bundled): `react` and `react-dom` ^19.2, `react-router-dom` ^7, `radix-ui` ^1.5, `lucide-react` >=1.17, `class-variance-authority` ^0.7, `tailwind-merge` ^3, `clsx` ^2, `react-i18next` >=15 <18.

### Parity check

```bash
npx suite-ui-parity --app <cockpit|community> [--root <path>] [--report]
```

Compares the app's own texts for every shared element in `parity-map.json` with the canonical `suite` text and prints one line per deviation. `pending` elements only report, `aligned` elements fail the command (exit 1). `--report` never fails.

## Development

Node 22, npm. `npm ci` builds `dist/` (`prepare`).

| Script                 | Purpose                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run build`        | tsup: ESM and `.d.ts` into `dist/`                                    |
| `npm run format:check` | Prettier                                                              |
| `npm run lint`         | ESLint                                                                |
| `npm run typecheck`    | TypeScript strict                                                     |
| `npm test`             | Vitest with Testing Library                                           |
| `npm run gallery`      | Playwright captures of the gallery (de/en/es × light/dark, 1920×1080) |
| `npm run gallery:dev`  | Gallery dev server                                                    |
| `npm run parity`       | Parity command from `dist/`                                           |

Gallery baselines live in `gallery/__screenshots__/`; an intended visual change updates them with `npx playwright test --config gallery/playwright.config.ts --update-snapshots`.

## Requests and questions

Ask through the spec server Q&A mailbox (project `suite-ui`), never by editing a copy in an app. The question starts with `Paket-Anfrage (<cockpit|community>): <component>` and states:

- what is missing or wrong
- the route where it is visible
- the affected languages
- whether it blocks a release

Questions about a design rule go to project `foundation`. Domain questions stay with the app's architect.

## Ownership

- Architect: the Overmind (as for `spec-sync-toolkit`)
- Build and releases: the `suite-ui` worker under the worker harness
- Releases are semver tags from a green gate

## License

Private use within the suite. Public repository so the apps' CI and Docker builds need no token.
