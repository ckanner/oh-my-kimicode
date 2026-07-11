# AGENTS.md — lazykimicode

## Architecture

This repo builds a Kimi Code CLI plugin plus a Node installer.

- `src/components/<name>/` — hook handler source code
- `src/install/` — installer and config patcher
- `src/shared/` — types, paths, serialization, telemetry
- `src/cli/` — CLI entry
- `plugin/` — built plugin assets (manifest, skills, hooks, component dist)
- `scripts/` — build and sync scripts
- `tests/unit/` — unit tests
- `tests/integration/` — end-to-end installer and hook execution tests

## Build

```bash
pnpm install
pnpm run build
```

## Components

| Component | Hook events | Purpose |
|---|---|---|
| `bootstrap` | `SessionStart` | Link managed binaries, seed agent profiles, install `sg` if missing |
| `codegraph` | `SessionStart`, `PostToolUse` | Structural code search MCP (TS/JS/Python/Go/Rust indexer). Exposed tools: `codegraph_search`, `codegraph_relate`, `codegraph_reindex`, `codegraph_status`, `codegraph_explore`, `codegraph_files`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`. The MCP server and hooks are registered by the installer (`src/install/hook-defs.ts`); remote MCP defaults (`grep_app`, `context7`) are provided as disabled placeholders in `.mcp.json`. |
| `comment-checker` | `PostToolUse` | Block commits/edits that leave unresolved `TODO/FIXME/HACK/XXX/BUG` markers |
| `executor-verify` | `SubagentStop` | Require `EVIDENCE_RECORDED:` before a coder subagent can stop |
| `git-bash` | `PreToolUse`, `PostCompact` | Recommend Git Bash on Windows; `git_bash` MCP is declared in `plugin/kimi.plugin.json` and registered by the installer on Windows |
| `lsp` | `PostToolUse`, `PostCompact` | Real LSP client MCP (`lsp_status`, `lsp_diagnostics`, `lsp_goto_definition`, `lsp_find_references`, `lsp_symbols`, `lsp_prepare_rename`, `lsp_rename`). The plugin MCP uses a persistent `lsp-daemon` binary to avoid cold-starting the LSP server; a stateless `lsp-tools-mcp` fallback is also linked |
| `rules` | `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `PostCompact` | Load `AGENTS.md` and `.omo/rules/*.md` into context |
| `start-work-continuation` | `Stop`, `SubagentStop` | Block stop and provide resume guidance while `.omo/boulder.json` has unchecked tasks |
| `teammode` | Skill-driven | Parallel multi-agent state script (`init`, `add-member`, `member-prompt`, `set-status`, `worktree-add`, `worktree-remove`, `integrate`, `archive`, `delete`, `status`) |
| `telemetry` | `SessionStart` | Anonymous daily-active telemetry (opt-out via `OMO_KIMI_DISABLE_POSTHOG=1`) |
| `ultrawork` | `UserPromptSubmit` | Detect `ultrawork`/`ulw` keywords and trigger autonomous mode |
| `ulw-loop` | `UserPromptSubmit`, `PreToolUse` | Steering parser; guard against budgeted `CreateGoal` |

Release builds inject the PostHog API key via CI. Local/debug builds without
`OMO_KIMI_POSTHOG_API_KEY` will skip telemetry with a build-time warning.

## Test

```bash
pnpm test
```

Latest result: **38 test files, 211 tests passing**.

## Adding a new component

1. Create `src/components/<name>/`
2. Add `cli.ts`, optional `mcp-server.ts`, and `hooks.json`
3. Add unit tests in `tests/unit/components/<name>.test.ts`
4. Run `pnpm run sync:hooks` to regenerate `plugin/hooks/`
5. Update `plugin/kimi.plugin.json` if you add an MCP server

## Release

Push a tag `v*`. The release workflow builds the plugin, creates a GitHub release, and publishes to npm.
