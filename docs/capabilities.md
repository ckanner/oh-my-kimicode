# lazykimicode Capabilities

This document is the complete capability reference for `lazykimicode`. For installation and quick start, see [`README.md`](../README.md).

---

## Overview

`lazykimicode` is a Kimi Code CLI plugin plus a Node installer. It layers engineering discipline on top of Kimi Code using three mechanisms:

1. **Hooks** — installed into `~/.kimi-code/config.toml`, invoked automatically by Kimi events.
2. **MCP servers** — declared in `plugin/kimi.plugin.json`, providing tools the model can call.
3. **Skills** — loaded by the plugin, invoked explicitly with `/skill:lazykimicode:<name>`.

---

## 1. Automatic Hooks

Hooks are fail-open advisory components. They exit `0` when they only want to add context, and exit `2` only when they genuinely want to block a tool or stop action.

| Event | Component | Matcher | Purpose |
|---|---|---|---|
| `SessionStart` | `bootstrap` | `^startup$` | Link managed binaries, seed agent profile cache, install `sg` (ast-grep) if missing |
| `SessionStart` | `rules` | `.*` | Inject `AGENTS.md` and `.lazykimicode/rules/*.md` into context |
| `SessionStart` | `telemetry` | `.*` | Daily-active telemetry (opt-out via `LAZYKIMICODE_DISABLE_POSTHOG=1`) |
| `SessionStart` | `codegraph` | `.*` | Ensure a CodeGraph index exists for the project |
| `UserPromptSubmit` | `rules` | `.*` | Re-inject project rules for the current prompt |
| `UserPromptSubmit` | `ultrawork` | `.*` | Detect `ultrawork`/`ulw` keywords and inject autonomous-mode instructions |
| `UserPromptSubmit` | `ulw-loop` | `.*` | Parse `LAZYKIMICODE_ULW_LOOP_STEER:` steering markers |
| `PreToolUse` | `git-bash` | `^Bash$` | Recommend the `git_bash` MCP over raw `Bash` (advises native Bash on non-Windows) |
| `PreToolUse` | `ulw-loop` | `^CreateGoal$` | Deny budgeted `CreateGoal` calls in ulw-loop mode |
| `PostToolUse` | `comment-checker` | `^(Write\|Edit)$` | Warn when unresolved TODO/FIXME/HACK/XXX/BUG markers are left in the file |
| `PostToolUse` | `lsp` | `^(Write\|Edit)$` | Run LSP diagnostics on edited files and report results |
| `PostToolUse` | `rules` | `^(Write\|Edit)$` | Re-evaluate project rules after edits |
| `PostToolUse` | `codegraph` | `^(codegraph[._].*\|mcp__codegraph__.*)$` | Provide guidance when a CodeGraph tool fails |
| `PostCompact` | `rules` | `.*` | Reset rule cache after context compaction |
| `PostCompact` | `lsp` | `.*` | Clear LSP diagnostics cache |
| `PostCompact` | `git-bash` | `.*` | Reset Git Bash recommendation state |
| `Stop` | `start-work-continuation` | `.*` | Block session stop if `.lazykimicode/boulder.json` has incomplete work |
| `SubagentStop` | `start-work-continuation` | `.*` | Advise when a start-work plan has incomplete work |
| `SubagentStop` | `executor-verify` | `^coder$` | Advise when a coder subagent stops without `EVIDENCE_RECORDED:` |

---

## 2. MCP Servers and Tools

The plugin registers MCP servers in `plugin/kimi.plugin.json`.

### `codegraph`

Indexed languages: TypeScript, JavaScript, Python, Go, Rust.

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `codegraph_search` | `query: string`, `kind?: string`, `file?: string` | `{ results: Symbol[] }` | Structural symbol search |
| `codegraph_relate` | `symbol: string` | `{ results: Symbol[] }` | Symbols in files related to the given symbol |
| `codegraph_reindex` | — | `{ symbolCount: number }` | Rebuild the CodeGraph index |
| `codegraph_status` | — | `{ status, symbolCount }` | CodeGraph index status |
| `codegraph_explore` | `query: string`, optional `kind`, `file`, `limit` | `{ results: ExploreResult[] }` | Search symbols plus their file neighbors |
| `codegraph_files` | `query?: string` | `{ files: string[] }` | Files containing matching symbols |
| `codegraph_callers` | `symbol: string` | `{ callers: CallerInfo[] }` | Files that reference a symbol |
| `codegraph_callees` | `symbol: string` | `{ callees: Symbol[] }` | Symbols referenced from the symbol's file |
| `codegraph_impact` | `symbol: string` | `{ files: string[] }` | Files impacted by changing a symbol |

### `lsp`

Backed by the persistent `lsp-daemon` binary. Configure the LSP server with:

```bash
export LAZYKIMICODE_LSP_COMMAND=typescript-language-server
export LAZYKIMICODE_LSP_ARGS="--stdio"
```

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `lsp_status` | — | text | Daemon / LSP server status |
| `lsp_diagnostics` | `file: string` | `{ diagnostics: Diagnostic[] }` | Diagnostics for a file |
| `lsp_goto_definition` | `file`, `line`, `character` | `{ locations: Location[] }` | Go-to-definition |
| `lsp_find_references` | `file`, `line`, `character` | `{ locations: Location[] }` | Find references |
| `lsp_symbols` | `file: string` | `{ symbols: SymbolInformation[] }` | Document symbols |
| `lsp_prepare_rename` | `file`, `line`, `character` | `{ result }` | Validate a symbol rename |
| `lsp_rename` | `file`, `line`, `character`, `newName` | `{ result }` | Execute a symbol rename |

A stateless fallback binary is also registered as the `lsp_tools_mcp` MCP in `plugin/kimi.plugin.json` for environments that do not use the daemon.

### `git_bash`

On Windows, the `git_bash` MCP runs shell commands through a Git Bash installation. On Linux and macOS it returns guidance to use the native Bash tool instead, since the MCP is optimized for Windows paths and shells.

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `git_bash` | `command: string`, `cwd?: string` | `{ content: { type, text }[], isError?: boolean }` | Execute a command via Git Bash on Windows |

---

## 3. Skills

Invoke with `/skill:lazykimicode:<name>` (or `/skill:<name>` if unique).

| Skill | Purpose |
|---|---|
| `init-deep` | Deep project initialization and rule seeding |
| `ultrawork` | Autonomous execution mode triggered by keyword |
| `ulw-plan` | Produce a structured execution plan |
| `ulw-loop` | Self-referential execution loop with evidence-based completion |
| `ulw-research` | Research phase for ultrawork plans |
| `teammode` | Parallel multi-agent orchestration via `AgentSwarm` |
| `ast-grep` | Structural search using `sg` (ast-grep) |
| `coding-agent-sessions` | Find and inspect local coding-agent session histories |
| `debugging` | Systematic debugging workflow |
| `frontend` | Frontend-focused development guidance |
| `git-master` | Git workflow guidance |
| `lcx-doctor` | Health check the local installation |
| `lcx-report-bug` | File a bug issue in the correct repository |
| `lcx-contribute-bug-fix` | Implement and deliver a verified bug fix |
| `lsp-setup` | Set up and configure LSP for the project |
| `programming` | General programming guidance |
| `refactor` | Refactoring workflows |
| `remove-ai-slops` | Remove low-quality AI-generated code |
| `review-work` | Review completed work |
| `rules` | Load and apply project rules |
| `start-work` | Start-work planning with Boulder state |
| `ultimate-browsing` | Browsing and external research workflows |
| `visual-qa` | Visual / screenshot QA workflows |

---

## 4. Configuration

`LAZYKIMICODE_*` is the environment variable namespace used by the harness.

| Environment variable | Default | Purpose |
|---|---|---|
| `LAZYKIMICODE_DISABLE_POSTHOG` | unset | Set to `1` to disable telemetry |
| `LAZYKIMICODE_POSTHOG_API_KEY` | placeholder | Real PostHog project API key |
| `LAZYKIMICODE_POSTHOG_HOST` | `https://us.i.posthog.com` | PostHog host |
| `LAZYKIMICODE_LSP_COMMAND` | unset | LSP server executable |
| `LAZYKIMICODE_LSP_ARGS` | unset | Space-separated args for the LSP server |
| `LAZYKIMICODE_PROJECT` | `process.cwd()` | Project directory |
| `LAZYKIMICODE_TEAMS_DIR` | `~/.lazykimicode/teams` | Team mode state directory |
| `LAZYKIMICODE_CONFIG_DIR` | `~/.lazykimicode` | User configuration directory |
| `LAZYKIMICODE_STATE_DIR` | `~/.local/share/lazykimicode` | Telemetry state directory |
| `LAZYKIMICODE_STATE_FILE` | unset | Explicit telemetry state file |
| `LAZYKIMICODE_PLUGIN_CACHE` | unset | Override plugin cache path used by bootstrap |
| `LAZYKIMICODE_BIN_DIR` | `~/.local/bin` or `<KIMI_CODE_HOME>/bin` | Managed binary directory |
| `LAZYKIMICODE_VERSION` | `package.json` version | Override reported version |
| `LAZYKIMICODE_SKIP_BOOTSTRAP` | unset | Set to `1` to skip first bootstrap |
| `LAZYKIMICODE_MIGRATION_STATE_DIR` | `~/.local/share/lazykimicode` | Installer migration state directory |
| `KIMI_CODE_HOME` | `~/.kimi-code` | Kimi Code home directory |
| `KIMI_LOCAL_BIN_DIR` | `~/.local/bin` | Directory for managed binary symlinks |

---

## 5. Common Usage Patterns

### Load rules automatically

Install the plugin and start a session. `rules` hooks run on `SessionStart` and `UserPromptSubmit` automatically.

### Run ultrawork

```text
ulw implement OAuth login for this project
```

### Use a skill

```text
/skill:lazykimicode:init-deep
/skill:lazykimicode:ulw-plan "add OAuth login"
/skill:lazykimicode:teammode
```

### Query code structure

```text
Use codegraph_search to find all functions named "fetchUser".
```

### Run a team

```text
/skill:lazykimicode:teammode
```

Then follow the skill instructions to `init`, `add-member`, and launch an `AgentSwarm`.

### Health check

```bash
npx lazykimicode doctor
```

---

## 6. Mapping to LazyCodex

| LazyCodex concept | lazykimicode equivalent |
|---|---|
| `.codex-plugin/plugin.json` | `plugin/kimi.plugin.json` |
| Codex hooks | `config.toml` `[hooks]` entries installed by the installer |
| `.mcp.json` servers | `plugin/kimi.plugin.json` `mcpServers` + user/project `.mcp.json` |
| Skills | `plugin/skills/<name>/SKILL.md` (same format, Kimi-mapped content) |
| `multi_agent_v1.spawn_agent` | `Agent(subagent_type="coder" / "explore" / "plan")` |
| `codex_app.*` threads | `AgentSwarm` or sequential `Agent` calls |
| `apply_patch` / Codex write | Kimi `Write` / `Edit` |

---

## 7. Verification

The full verification command used in CI and development:

```bash
pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build
```

Latest result: **41 test files, 267 tests passing**.
