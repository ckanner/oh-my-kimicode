# oh-my-kimicode

OmO agent harness for [Kimi Code CLI](https://moonshotai.github.io/kimi-code/).

This is the Kimi Code CLI edition of [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent), analogous to how [LazyCodex](https://github.com/code-yeongyu/lazycodex) is the OpenAI Codex CLI edition.

## Install

```bash
npx oh-my-kimicode install
```

For autonomous mode:

```bash
npx oh-my-kimicode install --no-tui --kimi-autonomous
```

The installer will:

- Copy the Kimi plugin to `~/.kimi-code/plugins/cache/oh-my-kimicode/<version>/`
- Add `[[hooks]]` entries to `~/.kimi-code/config.toml`
- Link managed binaries (`git-bash-mcp`, `lsp-tools-mcp`, `lsp-daemon`, `codegraph-server`) to `~/.local/bin/`
- Seed `~/.omo/config.jsonc`
- Back up your original `config.toml`

## Enable the plugin

After installing, enable the plugin in Kimi Code CLI:

```text
/plugins enable oh-my-kimicode
```

## Usage

Inside Kimi Code CLI:

```text
ulw add OAuth login to this project
/skill:oh-my-kimicode:init-deep
/skill:oh-my-kimicode:ulw-plan "add OAuth login"
/skill:oh-my-kimicode:teammode
```

## Features

- **Rules injection** — auto-load `AGENTS.md` and `.omo/rules/*.md`
- **Comment checker** — block edits that leave unresolved TODO/FIXME markers
- **LSP diagnostics** — run diagnostics after file edits via a real LSP client
- **CodeGraph** — structural code search MCP with indexing for TS/JS/Python/Go/Rust
- **Ultrawork / ULW-loop** — autonomous execution modes
- **Teammode** — parallel multi-agent orchestration via `AgentSwarm`
- **Telemetry** — anonymous daily-active telemetry (opt-out via `OMO_KIMI_DISABLE_POSTHOG=1`)

## Uninstall

```bash
npx oh-my-kimicode uninstall
```

To keep `~/.omo/` rules and config:

```bash
npx oh-my-kimicode uninstall --preserve-rules
```

## Disabling telemetry

```bash
export OMO_KIMI_DISABLE_POSTHOG=1
```

## Development

```bash
pnpm install
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

## License

MIT
