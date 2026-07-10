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
- Link component binaries to `~/.local/bin/`
- Back up your original `config.toml`

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
- **LSP diagnostics** — run diagnostics after file edits
- **CodeGraph** — structural code search MCP
- **Ultrawork / ULW-loop** — autonomous execution modes
- **Teammode** — parallel multi-agent orchestration via `AgentSwarm`
- **Telemetry** — anonymous daily-active telemetry (opt-out via `OMO_KIMI_DISABLE_POSTHOG=1`)

## Uninstall

```bash
npx oh-my-kimicode uninstall
```

## Disabling telemetry

```bash
export OMO_KIMI_DISABLE_POSTHOG=1
```

## License

MIT
