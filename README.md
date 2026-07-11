# lazykimicode

OmO agent harness for [Kimi Code CLI](https://moonshotai.github.io/kimi-code/).

This is the Kimi Code CLI edition of [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent), analogous to how [LazyCodex](https://github.com/code-yeongyu/lazycodex) is the OpenAI Codex CLI edition.

It brings LazyCodex's engineering discipline — rules injection, comment checking, LSP diagnostics, structural code search, autonomous execution modes, telemetry, and team orchestration — into Kimi Code CLI using Kimi-native hooks, MCP servers, Skills, and `Agent` / `AgentSwarm`.

For the full capability reference, see [`docs/capabilities.md`](docs/capabilities.md).

---

## Quick start

### 1. Install

```bash
npx lazykimicode install
```

For fully autonomous mode (sets `default_permission_mode = "auto"`):

```bash
npx lazykimicode install --no-tui --kimi-autonomous
```

The installer will:

- Copy the Kimi plugin to `~/.kimi-code/plugins/cache/lazykimicode/<version>/`
- Add `[[hooks]]` entries to `~/.kimi-code/config.toml`
- Link managed binaries (`git-bash-mcp`, `lsp-tools-mcp`, `lsp-daemon`, `codegraph-server`) to `~/.local/bin/`
- Seed `~/.omo/config.jsonc`
- Back up your original `config.toml` to `config.toml.bak.<timestamp>`

### 2. Enable the plugin

Inside Kimi Code CLI:

```text
/plugins enable lazykimicode
```

Then start a new session (or run `/new`). The plugin will load its MCP servers and the `rules` session-start skill automatically.

### 3. Use it

Trigger skills by name, or just type an ultrawork keyword:

```text
ulw add OAuth login to this project
/skill:lazykimicode:init-deep
/skill:lazykimicode:ulw-plan "add OAuth login"
/skill:lazykimicode:teammode
```

---

## What it does

### Automatic hooks

Once installed, `lazykimicode` hooks run on Kimi events without any manual setup:

| Event | Component | Behavior |
|---|---|---|
| `SessionStart` | `bootstrap`, `rules`, `telemetry`, `codegraph` | Provision binaries, load rules, emit daily-active telemetry, ensure codegraph index |
| `UserPromptSubmit` | `rules`, `ultrawork`, `ulw-loop` | Inject project rules; detect `ultrawork`/`ulw`; parse `OMO_ULW_LOOP_STEER:` |
| `PreToolUse` | `git-bash`, `ulw-loop` | Recommend `git_bash` on Windows; deny budgeted `CreateGoal` |
| `PostToolUse` | `comment-checker`, `lsp`, `rules`, `codegraph` | Check for stale TODO/FIXME; run LSP diagnostics; reload rules; guide codegraph usage |
| `PostCompact` | `rules`, `lsp`, `git-bash` | Reset caches after context compaction |
| `Stop` / `SubagentStop` | `start-work-continuation`, `executor-verify` | Block stop when work is incomplete; require `EVIDENCE_RECORDED:` |

### MCP servers

The plugin exposes two built-in MCP servers:

- **`codegraph`** — structural code search and impact analysis
  - `codegraph_search`
  - `codegraph_relate`
  - `codegraph_reindex`
  - `codegraph_status`
  - `codegraph_explore`
  - `codegraph_files`
  - `codegraph_callers`
  - `codegraph_callees`
  - `codegraph_impact`

- **`lsp`** — Language Server Protocol client, backed by a persistent `lsp-daemon`
  - `lsp_status`
  - `lsp_diagnostics`
  - `lsp_goto_definition`
  - `lsp_find_references`
  - `lsp_symbols`
  - `lsp_prepare_rename`
  - `lsp_rename`

Configure your LSP server via environment variables:

```bash
export OMO_KIMI_LSP_COMMAND=typescript-language-server
export OMO_KIMI_LSP_ARGS="--stdio"
```

On Windows, the installer also registers a `git_bash` MCP in `config.toml` for shell operations.

### Skills

All skills live under `plugin/skills/` and are loaded by the plugin. Notable ones:

- `init-deep` — deep project initialization
- `ultrawork` / `ulw` — autonomous execution
- `ulw-plan` / `ulw-loop` — planning and loop control
- `teammode` — parallel multi-agent orchestration via `AgentSwarm`
- `ast-grep` — structural search with `sg`
- `lcx-doctor` — health check
- `lcx-report-bug` / `lcx-contribute-bug-fix` — GitHub issue/PR workflows
- `start-work` — start-work planning

Invoke any skill with:

```text
/skill:lazykimicode:<skill-name>
```

If the skill name is unique, `/skill:<skill-name>` also works.

---

## Configuration

| Environment variable | Purpose |
|---|---|
| `OMO_KIMI_DISABLE_POSTHOG=1` | Disable anonymous telemetry |
| `OMO_KIMI_POSTHOG_API_KEY` | Use a real PostHog key instead of the placeholder |
| `OMO_KIMI_POSTHOG_HOST` | PostHog host (default `https://us.i.posthog.com`) |
| `OMO_KIMI_LSP_COMMAND` | LSP server executable |
| `OMO_KIMI_LSP_ARGS` | Space-separated args for the LSP server |
| `OMO_KIMI_PROJECT` | Override project directory |
| `KIMI_CODE_HOME` | Override Kimi Code home (default `~/.kimi-code`) |
| `KIMI_LOCAL_BIN_DIR` | Override bin directory for managed binaries |
| `OMO_TEAMS_DIR` | Override team-mode state directory (default `~/.omo/teams`) |

Release builds inject the PostHog API key via CI. Local/debug builds without
`OMO_KIMI_POSTHOG_API_KEY` will skip telemetry with a build-time warning.

---

## Uninstall

```bash
npx lazykimicode uninstall
```

To keep your `~/.omo/` rules and config:

```bash
npx lazykimicode uninstall --preserve-rules
```

---

## Development

```bash
pnpm install
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

After changing skills or component `hooks.json`, regenerate plugin assets:

```bash
pnpm run sync:skills
pnpm run sync:hooks
```

---

## Troubleshooting

- Run `npx lazykimicode doctor` to check the local installation.
- If a skill references a tool that seems missing, make sure the plugin is enabled (`/plugins info lazykimicode`) and that `pnpm run build` produced `plugin/components/*/dist/*.mjs`.
- For LSP issues, verify `OMO_KIMI_LSP_COMMAND` points to a working stdio LSP server.

---

## License

MIT
