# suite-ui

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
- **Drift check:** at session start and at every ticket start, hold `spec_pins` (covers project
  **and** `foundation`) against `spec-pins.json` — anything drifted is any key with a differing
  or missing revision; read `spec_diff` per key, derive a ticket (`PROC-DEV-041`, drift protocol
  `PROC-SPEC-014`), bring pins current with `npx spec-sync repin` **only at the end** of the run.
- If a spec is missing, ambiguous, or contradicts reality: **stop, flag it** —
  `ask_question` to the architect (Q&A mailbox, `SMCP-DESIGN-015`); if blocking →
  `await_answer`, otherwise submit the question and keep working. Routing architect/owner: `PROC-DEV-013`.

## How we work

- You are **PM**: you own the ticket, routing, and merge. **Delegation follows throwaway
  context, not difficulty** (`PROC-DEV-042`/`PROC-DEV-043`): _does the ticket need a gate run
  or an open-ended search → sub-agent; otherwise you build it yourself._ Sub-agents via
  `subagent_type` (`impl-fast`/`impl`/`impl-deep`/`investigate`/`review`/`docs`) — the choice of
  type is the choice of thinking level. Never copy the role prompt into the spawn, never set `model:`.
- **Every code change needs a ticket first** (`/task`). Ticket number `#<id>` in **every**
  commit; `git add <file>` instead of `git add .`. **GitHub Issues are the only ticket store**
  (`PROC-DEV-010`); status lives in `status:` labels.
- **`owner-hold` = hands off** (`PROC-DEV-010`, `PROC-DEV-047`): beats everything, including
  `auto-audit` and `type: bug`; only the owner sets and removes it.
- **Operations:** the worker session runs under the **worker-harness** (`~/projects/worker-harness`,
  tmux `suite-ui`, command `/spec-sync`); the harness renews it at boundaries
  (`PROC-DEV-031`). Owner actions are commands: `/pause` · `/unpause` · `/handover`
  (free text triggers nothing). Turn-end hooks come from the toolkit (`dist/hooks`, absolute
  path in `.claude/settings.json`).
- PRs + tests per foundation (`PROC-DEV-*`, testing guideline); hard boundaries are in the
  specs (vision sheet §Guiding Principles).

## Gate · Queue · Merge — `spec-sync-toolkit`

The mechanical parts of the worker loop come from the `spec-sync-toolkit` (devDependency,
pinned to a tag); custom gate chains call the runner instead of declaring a second source
of truth.

```bash
npx spec-sync gate --profile local|merge|nightly [--changed]  # config phases, abort on first red
npx spec-sync queue [--check]                                 # work backlog
npx spec-sync pack <issue>                                    # knowledge package for a sub-agent
npx spec-sync merge <issue> --branch <n> [--dry-run]          # merge sequence after substantive approval
npx spec-sync lenses [--base main]                            # review-lens set derived from the diff
npx spec-sync report [--run <id>]                             # goal reconciliation from the ledger
npx spec-sync repin                                           # bring spec-pins.json current (end of run)
npx spec-sync handover --reason <reason> [--note "…"]          # session handover (.spec-sync-handover.md)
npx spec-sync doctor                                          # environment against the norm
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
