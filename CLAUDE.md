# suite-ui

@~/.claude/roles/lead.md

The lead engineer's charter is imported from `~/.claude/roles/lead.md` (line above).

This package is the one shared UI library of all Suite apps. Requests from the app leads arrive as
"Paket-Anfrage" through the spec master, who writes the building block's sheet first (foundation
rule `GL-UI-004`).

## What this project does

`@suite/ui`: the React 19 + Tailwind 4 component library (built on Radix) that every Suite app
pins by git tag. It ships the shared building blocks (fields and forms, EditPanel, lists and tiles,
FilterBar, editor header, leave guard, toasts, settings scaffold, the slide editor and player) and
their strings in de/en/es. A Storybook-like gallery (`gallery/`) renders every specified state and
its Playwright suite pins them as screenshot baselines.

## Specs — Spec-Server v2, accessed via the MCP server `spec`

This project is **spec-driven**. All specs, architecture, and conventions live in the
**Spec-Server v2** as project `suite-ui` (MCP server `spec`, http://localhost:8787/mcp ·
Web UI http://localhost:8787/). Its database is the source of truth; `~/projects/specs-db/` is
only an export mirror and is never read. There are **no spec files** in this repo.

- **Read funnel, in this order:** `spec_usage` (always the first spec call of a
  session) → `spec_tree` (`root=<Key>` for a subtree) → `spec_search` (`mode` `keyword`
  for keys/exact terms, `semantic`/`hybrid` for conceptual questions) → `spec_get`/`spec_get_many`
  → `spec_history`/`spec_diff`/`spec_changes`/`spec_pins` (only for past-state questions).
  **Reading a whole level instead of searching is doing it wrong.**
- Specs are **sheets with keys**: foundation without a prefix (`GL-…`, `PROC-…`, `ADR-…`),
  this project with prefix `SUI-`; the root of the project tree is the vision sheet
  (`spec_tree` with project `suite-ui`). **Project > foundation.**
- Questions about specs go to the spec master, as the charter says.
- Hard boundaries are in the specs (vision sheet §Guiding Principles).

## Path to `main` — phase `development` (`PROC-REL-009`)

suite-ui is in phase `development`: land straight on `main` after the fast local checks you choose
and the secrets scan. Nothing else holds a push. The big tests (full unit suite, hygiene, knip,
size limits, the gallery) belong to the test master, who reports reds on their commit. Release tags
stay, because the apps pull the package by tag.

```bash
npm run format:check && npm run lint && npm run typecheck   # fast checks
node_modules/.bin/vitest run <files you touched>              # unit tests of what you touched
git push origin main                                          # the pre-push hook runs the secrets scan (gitleaks)
npm run release:tag                                           # tag HEAD on main as v<version> (rule: SUI-FEATURE-076)
```

- The toolkit runs only as `node_modules/.bin/spec-sync` from the checkout root, never through npx
  (`GL-SEC-011`). Its gate (`gate --profile local|merge`) still works for a full local pass; stdout is
  one JSON object, logs under `.spec-sync/logs/`.
- Every checkout or worktree needs `mise trust <path>/mise.toml && mise install` once (the scanners
  are pinned in `mise.toml`/`mise.lock`); untrusted, the shims fail and the push is refused.
- `spec-sync.config.json` and `spec-pins.json` are versioned; `.spec-sync/` is not.

## Architecture

`src/` holds one module per building block under `src/ui`, `src/list`, `src/settings`,
`src/slides`, `src/shell` and `src/lib` (shared internals, `*-internal` modules are not API);
`package.json` `exports` publishes them as subpaths (`@suite/ui/ui/*` and so on), each with a
size-limit line in `size-limit-lines.json`. `src/styles.css` carries the design tokens. The specs
define the behaviour; the vision sheet of project `suite-ui` is the root.

## Commands

```bash
npm ci                    # install (then `mise trust && mise install` once per checkout)
npm run build             # tsup → dist/
npm test                  # vitest (unit)
npm run lint              # eslint
npm run typecheck         # tsc --noEmit
npm run format:check      # prettier
npm run gallery:dev       # gallery dev server (Vite)
npm run gallery:image     # gallery Playwright suite in the pinned image (Linux baselines)
npm run hygiene           # size limits, jscpd, semgrep, trivy, gitleaks, ratchet
```

<!-- scaffolded by init-project.sh on 2026-10-06 -->
