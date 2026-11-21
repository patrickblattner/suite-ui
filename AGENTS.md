# Working in suite-ui

`@suite/ui`, the one shared UI package of all Suite apps. This page orients an agent working in this
repository; the lead's charter (`~/.claude/roles/lead.md`) and `CLAUDE.md` carry the rest.

## Specs are the truth

- Specs live in the spec server (MCP server `spec`, project `suite-ui`); its database is the source of
  truth. There are no spec files in this repo, and `~/projects/specs-db/` is only an export.
- Read them through the funnel: `spec_usage` first, then `spec_tree`, `spec_search`, `spec_get`.
- A change of observable behaviour or of a contract that no sheet describes goes to the spec master
  before it is built. A taste question (look, wording, the feel of a flow) is never decided here.
- Shared building blocks live in this package; an app never builds its own copy (`GL-UI-004`).

## The toolkit and the gate

- The spec-sync toolkit runs only as `node_modules/.bin/spec-sync` from the checkout's root, never
  through npx (`GL-SEC-011`).
- Local gate: `node_modules/.bin/spec-sync gate --profile local`. Before a push the merge preflight
  (`gate --profile merge --preflight`) must list nothing. stdout is one JSON object; the full output
  of each phase is in `.spec-sync/logs/<timestamp>/<phase>.log` — read the failed phase there, not
  the whole log.
- No merge without a green merge gate (`npm run gate:record`); a release tag only through
  `npm run release:tag` on a recorded commit.
- `.spec-sync-pause` in the root means the owner paused the project: finish what is in flight, start
  nothing new.

## Gallery

- Screenshots run only in the pinned Playwright image: `npm run gallery:image` (it takes a machine
  slot). Baselines are Linux baselines from that image, never from the host.
- One merge gate's gallery phase at a time; no other gallery run beside it.
- Recapture only what a change alters (`-- --update-snapshots=changed`), look at each changed image,
  and name the recaptured baselines in a CHANGELOG `Gallery` line.

## Every change

- Tests sit next to the code (`*.test.ts(x)`); a bug gets a failing test before its fix.
- `CHANGELOG.md`: each change adds its own lines under `## Unreleased`, naming the issue and the sheet.
- A change that crosses a size-limit maximum or raises a quality-ratchet count raises it in the same
  change (`GL-CODE-021`): size to the measured size + 5 %, a count to the measured count, through
  `node_modules/.bin/spec-sync measure set … --register 1998`, with a CHANGELOG `Size` line that
  names the cause (a raise above +20 % is named a large jump). Security counts (Semgrep, gitleaks,
  Trivy, `eslint.security`) are never raised: the change fixes the finding.
- Stage files by name (`git add <files>`), never `git add .`: parallel work shares the checkout's
  neighbours. Worktrees live under `~/projects/.worktrees/suite-ui/`.
- English for code, comments, commit messages and documentation; theme tokens and i18n texts in UI.
