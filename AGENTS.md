# AGENTS.md — oh-my-kimicode

## Architecture

This repo builds a Kimi Code CLI plugin plus a Node installer.

- `src/components/<name>/` — hook handler source code
- `src/install/` — installer and config patcher
- `src/shared/` — types, paths, serialization, telemetry
- `src/cli/` — CLI entry
- `plugin/` — built plugin assets (manifest, skills, hooks, component dist)
- `scripts/` — build and sync scripts
- `tests/unit/` — unit tests

## Build

```bash
pnpm install
pnpm run build
```

## Test

```bash
pnpm test
```

## Adding a new component

1. Create `src/components/<name>/`
2. Add `cli.ts`, optional `mcp-server.ts`, and `hooks.json`
3. Add unit tests in `tests/unit/components/<name>.test.ts`
4. Run `pnpm run sync:hooks` to regenerate `plugin/hooks/`
5. Update `plugin/kimi.plugin.json` if you add an MCP server

## Release

Push a tag `v*`. The release workflow builds the plugin, creates a GitHub release, and publishes to npm.
