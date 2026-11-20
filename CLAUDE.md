# suite-ui

@~/.claude/roles/lead.md

The lead engineer's charter is imported from `~/.claude/roles/lead.md` (line above).

This package is the one shared UI library of all Suite apps. Requests from the app leads arrive as
"Paket-Anfrage" through the spec master, who writes the building block's sheet first (foundation
rule `GL-UI-004`).

## What this project does

_TODO: Brief description._

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

## Gate — `spec-sync-toolkit`

The gate comes from the `spec-sync-toolkit` (devDependency, pinned to a tag); custom gate chains
call the runner instead of declaring a second source of truth.

```bash
node_modules/.bin/spec-sync gate --profile local|merge [--changed]          # all phases run, red ones in failures[]; red blocking phase skips the rest
node_modules/.bin/spec-sync gate --profile merge --preflight                # pre-run before every push, must list nothing
node_modules/.bin/spec-sync doctor                                          # environment against the norm
npm run gate:record                                           # merge gate; on green, record it for HEAD's tree
npm run release:tag                                           # tag HEAD on main as v<version> and push, only with that record
```

stdout is **exactly one JSON object** (`--human` for the terminal), logs under `.spec-sync/logs/`.
Exit codes: `0` ok · `1` substantively red · `2` unprovable (retry, don't count as green) ·
`3` ambiguous · `4` precondition violated (config, branch, `owner-hold`, pause flag).

**`spec-sync.config.json` is the only project-specific file** (versioned);
`.spec-sync/` (logs, ledger) is not. `spec-pins.json` is versioned.

## Architecture

_TODO: defined by the specs — just one orientation sentence here._

## Commands

```bash
# TODO: Fill in
# npm install / npm run dev / npm run build / npm test / npm run lint
```

<!-- scaffolded by init-project.sh on 2026-10-06 -->
