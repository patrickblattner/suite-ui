# Repository Guidelines

These rules apply to all AI coding agents in this project.
Core behavioral principles (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution) are defined globally in `~/.claude/CLAUDE.md`.

## General Behavior

- Leave `.git/` untouched — reading or modifying git internals causes corruption.
- Use tmux for long-running tasks (dev servers, watchers, REPLs). One-off commands run directly.
- Before concluding a task, run: build, lint, unit tests, E2E tests (if configured). Fix failures before marking done.
- **Always include the ticket number (`#<id>`) in every commit message** (e.g., `feat: add login form #42`). Commits without a ticket reference are blocked by a global hook.
- Use `git add <specific-files>` only — `git add .` is blocked by a global hook.

## Coding Style

- TypeScript, ES modules, functional style. Match existing patterns in the codebase.
- Run `npm run lint` + `npm run format` before pushing.
- Libraries may be installed autonomously when the implementation plan includes them.
- English for all code, comments, and documentation.

## Testing

- Place unit tests next to code (`*.test.ts` / `*.test.tsx`).
- Add regression tests for bugs before fixing — proves the bug exists and prevents reintroduction.
- Mock external API calls in tests — real calls make tests slow, flaky, and expensive.
- Playwright runs headless. Headed mode is only for user-requested debugging.

## Gate Logs

A gate run writes the full command output to `.spec-sync/logs/<timestamp>/<phase>.log`; the
JSON response carries only exit code, first error and that path.

- **The driver (PM) never reads a log.** It passes the path on and delegates.
- A **sub-agent reads selectively**: the failed phase, via `grep`/`tail` — **never the whole
  file**. A fully read log costs more context than the error it contains is worth.

## Security

- Keep secrets out of version control — use `.env` files. Committed secrets require immediate rotation.
- Keep passwords and credentials out of logs — they persist in log aggregation systems.
- Provide `.env.example` for others to copy.

## CodeGraph + Serena (MCP) — Code Navigation

Prefer them over native Read/Grep for code — symbol-level results instead of full files, far fewer tokens. Both are deferred; load them in **one** call:

```
ToolSearch select:mcp__serena__get_symbols_overview,mcp__serena__find_symbol,mcp__serena__find_referencing_symbols,mcp__serena__search_for_pattern,mcp__codegraph__codegraph_explore
```

**Division of labor (binding):** CodeGraph answers **orientation** — structure, call graph, impact ("who calls this, what depends on it"). Serena reads the **current state** of specific symbols. Impact questions → CodeGraph, current state → Serena.

| Priority | Tool | Use when |
|----------|------|----------|
| 1 | `codegraph_explore` / `get_symbols_overview` | Orienting: structure, where things live |
| 2 | `find_symbol` (`include_body`) | Reading a specific function/class |
| 3 | `find_referencing_symbols` / CodeGraph impact | Blast radius — who calls/imports this? |
| 4 | `search_for_pattern` | Non-symbolic content (strings, config, comments) |
| 5 | `Read` / `Grep` | Fallback — and still the right tool for configs, logs, docs, and a location you already identified |

Inside a git worktree **CodeGraph reflects the MAIN checkout's index**, not your uncommitted changes — never trust it for state you just modified. All code edits go through native Edit/Write — they integrate with Claude Code's permission and diff system. Never halt over tooling.

## shadcn (MCP) — UI Components

When `mcp__shadcn__*` tools are available and you are building React UI, use them to look up components before building custom ones.

| Tool | Use when |
|------|----------|
| `search_items_in_registries` | Check if a shadcn component exists for your need |
| `view_items_in_registries` | View component source, variants, usage |
| `get_item_examples_from_registries` | Get real-world usage examples |
| `get_add_command_for_items` | Get the correct install CLI command |

Never manually create files in `components/ui/` — always install via the CLI command from the MCP server. See each agent's "UI Work" section for full styling rules.

## Output Rules

- Skip explanations for obvious code.
- Keep answers concise.
- Keep emojis out of code comments — they render inconsistently across tools.
- Reference files instead of restating their contents — restating wastes tokens and risks stale copies.

<!-- scaffolded by init-project.sh on 2026-10-06 -->
