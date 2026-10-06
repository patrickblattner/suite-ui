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
