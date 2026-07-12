# lazykimicode Capabilities

This document is the complete capability reference for `lazykimicode`. For installation and quick start, see [`README.md`](../README.md).

---

## Overview

`lazykimicode` is a Kimi Code CLI plugin plus a Node installer. It layers LazyCodex-style engineering discipline on top of Kimi Code using three mechanisms:

1. **Hooks** — installed into `~/.kimi-code/config.toml`, invoked automatically by Kimi events.
2. **MCP servers** — declared in `plugin/kimi.plugin.json`, providing tools the model can call.
3. **Skills** — loaded by the plugin, invoked explicitly with `/skill:lazykimicode:<name>`.

---

## 1. Automatic Hooks

Hooks are fail-open advisory components. They exit `0` when they only want to add context, and exit `2` only when they genuinely want to block a tool or stop action.

| Event | Component | Matcher | Purpose |
|---|---|---|---|
| `SessionStart` | `bootstrap` | `^startup$` | Link managed binaries, seed agent profile cache, install `sg` (ast-grep) if missing |
| `SessionStart` | `rules` | `.*` | Inject `AGENTS.md` and `.omo/rules/*.md` into context |
| `SessionStart` | `telemetry` | `.*` | Daily-active telemetry (opt-out via `OMO_KIMI_DISABLE_POSTHOG=1`) |
| `SessionStart` | `codegraph` | `.*` | Ensure a CodeGraph index exists for the project |
| `UserPromptSubmit` | `rules` | `.*` | Re-inject project rules for the current prompt |
| `UserPromptSubmit` | `ultrawork` | `.*` | Detect `ultrawork`/`ulw` keywords and inject autonomous-mode instructions |
| `UserPromptSubmit` | `ulw-loop` | `.*` | Parse `OMO_ULW_LOOP_STEER:` steering markers |
| `PreToolUse` | `git-bash` | `^Bash$` | Recommend the `git_bash` MCP over raw `Bash` (advises native Bash on non-Windows) |
| `PreToolUse` | `ulw-loop` | `^CreateGoal$` | Deny budgeted `CreateGoal` calls in ulw-loop mode |
| `PostToolUse` | `comment-checker` | `^(Write\|Edit)$` | Block if unresolved TODO/FIXME/HACK/XXX/BUG markers are left in the file |
| `PostToolUse` | `lsp` | `^(Write\|Edit)$` | Run LSP diagnostics on edited files and report results |
| `PostToolUse` | `rules` | `^(Write\|Edit)$` | Re-evaluate project rules after edits |
| `PostToolUse` | `codegraph` | `^(codegraph[._].*\|mcp__codegraph__.*)$` | Provide guidance when a CodeGraph tool fails |
| `PostCompact` | `rules` | `.*` | Reset rule cache after context compaction |
| `PostCompact` | `lsp` | `.*` | Clear LSP diagnostics cache |
| `PostCompact` | `git-bash` | `.*` | Reset Git Bash recommendation state |
| `Stop` | `start-work-continuation` | `.*` | Prevent session stop if `.omo/boulder.json` has incomplete work |
| `SubagentStop` | `start-work-continuation` | `.*` | Prevent subagent stop if start-work plan is incomplete |
| `SubagentStop` | `executor-verify` | `^coder$` | Require `EVIDENCE_RECORDED:` in subagent output before allowing stop |

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
export OMO_KIMI_LSP_COMMAND=typescript-language-server
export OMO_KIMI_LSP_ARGS="--stdio"
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

A stateless fallback binary `lsp-tools-mcp` is also linked for environments that do not use the daemon.

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

| Environment variable | Default | Purpose |
|---|---|---|
| `OMO_KIMI_DISABLE_POSTHOG` | unset | Set to `1` to disable telemetry |
| `OMO_KIMI_POSTHOG_API_KEY` | placeholder | Real PostHog project API key |
| `OMO_KIMI_POSTHOG_HOST` | `https://us.i.posthog.com` | PostHog host |
| `OMO_KIMI_LSP_COMMAND` | unset | LSP server executable |
| `OMO_KIMI_LSP_ARGS` | unset | Space-separated args for the LSP server |
| `OMO_KIMI_PROJECT` | `process.cwd()` | Project directory |
| `KIMI_CODE_HOME` | `~/.kimi-code` | Kimi Code home directory |
| `KIMI_LOCAL_BIN_DIR` | `~/.local/bin` | Directory for managed binary symlinks |
| `OMO_TEAMS_DIR` | `~/.omo/teams` | Team mode state directory |

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

Latest result: **39 test files, 244 tests passing**.
