# lazykimicode Audit Report

> **Scope:** Full repository audit against the current implementation, the product plan, and the stated goal of removing the legacy `OMO`/`OmO` brand in favor of `LazyKimiCode`/`lazykimicode`.
>
> **Date:** 2026-07-12
>
> **Verification baseline:** `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` — **40 test files, 257 tests passing**.

---

## 1. What is the Kimi Code CLI "wire protocol"?

Kimi Code CLI does **not** expose a public network wire protocol. The hook "protocol" is a simple local stdio contract:

- The CLI writes a single JSON object to the hook script's **stdin**.
- Field names use **snake_case**, e.g. `hook_event_name`, `tool_name`, `tool_input`, `tool_output`, `session_id`, `subagent_type`, `stop_hook_active`, `prompt`, `response`.
- Only some events can block: `UserPromptSubmit`, `PreToolUse`, `Stop`.
- Exit code `0` = allow; exit code `2` = block; other non-zero = fail-open.
- The script may print a JSON object to **stdout**. Recognized fields:
  - `message` (top-level context to append)
  - `hookSpecificOutput.message`
  - `hookSpecificOutput.permissionDecision` / `permissionDecisionReason`
- For blocking events the reason can also be written to **stderr**.

`lazykimicode` already implements this correctly via `src/shared/payload.ts` (snake→camel normalization) and `src/shared/serialize.ts` (output builder). No protocol changes are required.

Reference: [Hooks | Kimi Code CLI Docs](https://moonshotai.github.io/kimi-code/en/customization/hooks)

---

## 2. Environment variable / branding migration

`src/shared/env.ts` was created but is **not imported anywhere**. All production code still reads `process.env.OMO_KIMI_*` / `OMO_*` directly.

### 2.1 Source files that must migrate to `src/shared/env.ts`

| File | Current reads | Required helper |
|---|---|---|
| `src/components/bootstrap/session-start.ts` | `OMO_KIMI_VERSION`, `OMO_KIMI_PLUGIN_CACHE`, `OMO_KIMI_BIN_DIR`, `OMO_KIMI_PROJECT` | `getEnv`, `getProjectDir` |
| `src/components/codegraph/bootstrap.ts` | `OMO_KIMI_PROJECT` | `getProjectDir` |
| `src/components/codegraph/serve.mjs` | `OMO_KIMI_PROJECT` | `getProjectDir` |
| `src/components/lsp/cli.ts` | `OMO_KIMI_PROJECT`, `OMO_KIMI_LSP_COMMAND`, `OMO_KIMI_LSP_ARGS` | `getEnv`, `getProjectDir` |
| `src/components/lsp/daemon.ts` | `OMO_KIMI_PROJECT`, `OMO_KIMI_LSP_COMMAND`, `OMO_KIMI_LSP_ARGS` | `getEnv`, `getProjectDir` |
| `src/components/lsp/diagnostics.ts` | `OMO_KIMI_PROJECT` | `getProjectDir` |
| `src/components/lsp/mcp-server.ts` | `OMO_KIMI_PROJECT`, `OMO_KIMI_LSP_COMMAND`, `OMO_KIMI_LSP_ARGS` | `getEnv`, `getProjectDir` |
| `src/components/rules/cli.ts` | `OMO_KIMI_PROJECT` | `getProjectDir` |
| `src/components/start-work-continuation/boulder.ts` | `OMO_KIMI_PROJECT` | `getProjectDir` |
| `src/components/teammode/scripts/team.ts` | `OMO_TEAMS_DIR` | `getTeamsDir` |
| `src/components/telemetry/posthog.ts` | `OMO_KIMI_DISABLE_POSTHOG`, `OMO_DISABLE_POSTHOG`, `OMO_KIMI_POSTHOG_API_KEY`, `OMO_KIMI_POSTHOG_HOST`, `OMO_KIMI_VERSION` | `isTelemetryDisabled`, `getEnv` |
| `src/components/ulw-loop/steer.ts` | `OMO_ULW_LOOP_STEER:` marker | dual-marker parser |
| `src/install/doctor.ts` | `OMO_KIMI_VERSION` | `getEnv` |
| `src/install/install-kimi.ts` | `OMO_KIMI_DISABLE_POSTHOG`, `OMO_KIMI_MIGRATION_STATE_DIR`, `OMO_KIMI_SKIP_BOOTSTRAP`, `OMO_KIMI_PLUGIN_CACHE`, `OMO_KIMI_VERSION` | `isTelemetryDisabled`, `getEnv`, `getEnvBool` |
| `src/shared/paths.ts` | `OMO_KIMI_PROJECT`, `OMO_KIMI_VERSION`, `OMO_KIMI_CONFIG_DIR` | `getEnv`, `getProjectDir`, `getConfigDir` |
| `src/shared/telemetry.ts` | `OMO_KIMI_STATE_FILE`, `OMO_KIMI_STATE_DIR`, `OMO_KIMI_DISABLE_POSTHOG`, `OMO_DISABLE_POSTHOG`, `OMO_KIMI_SEND_ANONYMOUS_TELEMETRY`, `OMO_SEND_ANONYMOUS_TELEMETRY` | `getEnv`, `isTelemetryDisabled` |

### 2.2 Display strings containing `OmO`

All `src/components/*/hooks.json` files use `"(OmO) ..."` in `statusMessage`. These must become `"(LazyKimiCode) ..."`.

`src/components/bootstrap/session-start.ts` constructs `(OmO ${version}) Bootstrap provisioning complete`.

### 2.3 Plugin / package metadata

- `plugin/kimi.plugin.json`: `"description": "OmO agent harness for Kimi Code CLI"`, `"omo"` keyword, `"skillInstructions"` contains `(OmO for Kimi Code)`, `"shortDescription": "OmO agent harness for Kimi Code CLI"`.
- `package.json`: `"description": "OmO agent harness for Kimi Code CLI"`, `"omo"` keyword.

### 2.4 Documentation

`README.md`, `AGENTS.md`, `docs/capabilities.md`, and `docs/superpowers/plans/lazykimicode-plan.md` still reference `OMO_*` environment variables and `OmO` branding.

### 2.5 Skills

- Every `plugin/skills/*/SKILL.md` starts with `## OMO Kimi K2.7 Orchestration Calibration`.
- `plugin/skills/lsp-setup/SKILL.md` documents `OMO_KIMI_LSP_COMMAND`/`OMO_KIMI_LSP_ARGS`.
- `plugin/skills/lcx-report-bug/SKILL.md` uses `OMO_SOURCE_ROOT` in its bash snippets.
- `vendor/shared-skills/` contains the same upstream text; it should remain untouched. The rebrand should be applied by `scripts/sync-skills.mjs` when copying skills into `plugin/skills/`.

### 2.6 CI / build script

- `.github/workflows/release.yml` uses `secrets.OMO_KIMI_POSTHOG_API_KEY`.
- `scripts/build.mjs` warns about `OMO_KIMI_POSTHOG_API_KEY`.

### 2.7 Tests

Roughly 20 test files set or assert `OMO_*` env vars / strings. They must be updated to use `LAZYKIMICODE_*` (with fallback assertions for the old names where backward compatibility is intentional).

---

## 3. Docs ↔ code consistency

Verified items:

- Component list and hook events in `README.md`, `AGENTS.md`, `docs/capabilities.md` match `src/install/hook-defs.ts`.
- MCP tool names match between `plugin/kimi.plugin.json`, source servers, and `docs/capabilities.md`.
- Skills list in `docs/capabilities.md` matches `plugin/skills/`.
- Test count claim (**40 files / 257 tests**) is accurate.
- Version numbers are consistent (`0.1.3` in `package.json`, `src/shared/version.ts`, `plugin/kimi.plugin.json`).

Discrepancies to fix:

1. `README.md:76` says the plugin exposes **three** built-in MCP servers; the manifest declares **four** (`codegraph`, `lsp`, `lsp_tools_mcp`, `git_bash`).
2. `docs/superpowers/plans/lazykimicode-plan.md` contains several stale snippets (old `package.json` name/build command/node version, old plugin manifest without `lsp_tools_mcp`/`git_bash`, wrong cache path, old `--codex-home` flag, missing `rules` skill). The plan's status line also claims everything is implemented, which is true functionally but the document still uses `OmO` branding.
3. Many internal environment variables read by the code are not documented in `README.md`/`docs/capabilities.md`.

---

## 4. Missing features from the plan

The four gaps called out by the user were audited:

| Gap | Status | Evidence |
|---|---|---|
| `teammode` subcommands (`init`, `add-member`, `member-prompt`, `set-status`, `worktree-add`, `worktree-remove`, `integrate`, `archive`, `delete`, `status`) | **Implemented and tested** | `src/components/teammode/scripts/team.ts`, `tests/unit/components/teammode.test.ts` |
| `lsp-daemon` split (persistent daemon + stateless `lsp-tools-mcp` fallback) | **Implemented and tested** | `src/components/lsp/daemon.ts`, `src/components/lsp/mcp-server.ts`, `plugin/kimi.plugin.json`, `tests/unit/components/lsp-daemon.test.ts`, `tests/unit/components/lsp-mcp-server.test.ts` |
| Skill MCP tool name alignment | **Implemented and enforced** | `tests/unit/skills/mcp-alignment.test.ts`; skills use canonical names; hook matchers accept `mcp__*` prefix |
| `create-pr-body.mjs` | **Implemented and tested** | `plugin/skills/lcx-contribute-bug-fix/scripts/create-pr-body.mjs`, `tests/unit/skills/create-pr-body.test.ts` |

No missing features remain in these four areas.

---

## 5. Known limitations (must be cleared)

The following notes were previously treated as acceptable limitations but the user wants them fully resolved:

1. **`src/components/teammode/scripts/team.ts` exported `archive()` / `deleteTeam()` without file locks** — audit shows member-level `archive` uses `withTeamWrite` (which acquires `withLock`), whole-team `archive` uses `withLock`, and `deleteTeam` uses `withLock`. The limitation is already resolved; only stale comments/doc notes need removal.
2. **`comment-checker` multi-line template literal detection** — `src/components/comment-checker/check.ts` already handles multi-line template literals, `${...}` interpolation, escaped backticks, and nested strings inside interpolation; tests already cover these cases. The limitation note is stale.
3. **LSP args do not support quoted spaces** — `src/components/lsp/args.ts` already implements a shell-like parser that respects single/double quotes and backslash escapes; `tests/unit/components/lsp-args.test.ts` covers it. The limitation note is stale.

---

## 6. Recommended migration strategy

1. Keep `OMO_KIMI_*` and `OMO_*` as **legacy fallbacks** so existing users are not broken.
2. Make `LAZYKIMICODE_*` the primary namespace in code, docs, and CI.
3. Route all env var reads through `src/shared/env.ts` helpers.
4. Rebrand display strings, metadata, docs, and skills.
5. Update CI to prefer `secrets.LAZYKIMICODE_POSTHOG_API_KEY` while still falling back to the old secret name.
6. Remove stale limitation notes once the code proves they no longer apply.
7. Run the full verification matrix after every task group.
