# LazyKimiCode Finalization Plan

> **Date:** 2026-07-13  
> **Goal:** Remove the legacy `OMO`/`OmO` brand entirely from code, docs, configuration, and CI; verify the Kimi Code CLI wire-protocol implementation is complete; clean any remaining stale limitation notes; and deliver a green CI on `main`.
>
> **Status:** The env-var namespace and hook/build branding tasks below are complete. The remaining `.omo` directory rename is being executed in [`docs/lazykimicode-audit-remediation-plan.md`](lazykimicode-audit-remediation-plan.md).

## 1. Current State Summary

### 1.1 Wire protocol

The Kimi Code CLI wire protocol is the JSON message format the CLI uses to talk to hook scripts and MCP servers over stdin/stdout/stderr. Kimi sends **snake_case** payloads such as:

```json
{
  "hook_event_name": "PostToolUse",
  "tool_input": { "path": "/tmp/foo.ts" },
  "session_id": "session_abc"
}
```

Hooks respond with JSON on stdout containing:

- `message` (top level) or `hookSpecificOutput.message` — context injected into the session.
- `hookSpecificOutput.permissionDecision = "deny"` plus `permissionDecisionReason` — for `PreToolUse` denies; the process must exit `0`.
- For hard `Stop` blocks, the process exits `2` and the reason is read from **stderr**.

This is **not** the same thing as the consumer-facing "Kimi CLI" chat product. It is specific to Kimi Code CLI.

**Status in this repo:** already implemented.

- `src/shared/payload.ts` normalizes snake_case → internal camelCase (`tool_input` → `toolInput`, etc.).
- `src/shared/serialize.ts` builds Kimi-compatible output (`message` first, `additionalContext` fallback) and provides `writeBlockReason()` for stderr-based `Stop` blocks.
- All component CLIs have been updated to use `normalizeHookPayload()` and emit `message`.

### 1.2 Previously flagged gaps

The four gaps called out in earlier audits are implemented and tested:

| Gap | Evidence |
|-----|----------|
| `teammode` subcommands | `src/components/teammode/scripts/team.ts` exports 10 subcommands; `tests/unit/components/teammode.test.ts` covers them. |
| `lsp-daemon` split | `src/components/lsp/daemon.ts` + `mcp-server.ts`; `tests/unit/components/lsp-daemon.test.ts` + `lsp-mcp-server.test.ts`. |
| Skill / MCP tool-name alignment | `tests/unit/skills/mcp-alignment.test.ts` green. |
| `create-pr-body.mjs` | `plugin/skills/lcx-contribute-bug-fix/scripts/create-pr-body.mjs`; `tests/unit/skills/create-pr-body.test.ts`. |

### 1.3 Known limitations

All three previously listed limitations are already hardened in code; only stale comments/docs remain:

1. **teammode file locking** — `archive()` and `deleteTeam()` already use `withLock()`.
2. **comment-checker multi-line/template-literal handling** — `findStringRanges()` already parses multi-line template literals and interpolation.
3. **LSP quoted-space args** — `parseLspArgs()` already supports single/double quotes and backslash escapes.

### 1.4 What is still wrong

The env-var namespace, hook/build branding, and limitation hardening tasks described in the original plan are complete. The only remaining `OMO` footprint is the **`.omo` directory name** used for configuration and state. The user has directed that the project use its own brand everywhere, including configuration, so `.omo` must become `.lazykimicode`.

Remaining `.omo` references are tracked and remediated in [`docs/lazykimicode-audit-remediation-plan.md`](lazykimicode-audit-remediation-plan.md).

## 2. Plan

### Task 1: Remove OMO env-var fallbacks

**Files:**
- `src/shared/env.ts`
- `src/shared/paths.ts` (if any direct OMO reads remain)
- `src/shared/telemetry.ts` (if any direct OMO reads remain)
- `src/components/ulw-loop/steer.ts`
- `src/components/lsp/args.ts` comment

**Changes:**
1. In `src/shared/env.ts`:
   - `getEnv()` reads only `LAZYKIMICODE_${name}`.
   - `getEnvBool()` reads only `LAZYKIMICODE_${name}`.
   - `isTelemetryDisabled()` reads only `LAZYKIMICODE_DISABLE_POSTHOG` and `LAZYKIMICODE_SEND_ANONYMOUS_TELEMETRY`.
   - `getProjectDir()` reads only `LAZYKIMICODE_PROJECT`.
   - `getTeamsDir()` reads only `LAZYKIMICODE_TEAMS_DIR`.
   - `getConfigDir()` reads only `LAZYKIMICODE_CONFIG_DIR`.
2. In `src/components/ulw-loop/steer.ts`, change the steering regex to match only `LAZYKIMICODE_ULW_LOOP_STEER:`.
3. In `src/components/lsp/args.ts`, update the comment to say `LAZYKIMICODE_LSP_ARGS`.

**Verification:** `pnpm vitest run tests/unit/shared/env.test.ts` after updating tests.

### Task 2: Update tests

**Files:**
- `tests/unit/shared/env.test.ts`
- `tests/unit/scripts/build.test.ts`

**Changes:**
1. Rewrite `tests/unit/shared/env.test.ts` to assert only `LAZYKIMICODE_*` behavior; remove all fallback assertions.
2. Update `tests/unit/scripts/build.test.ts` expected warning to reference only `LAZYKIMICODE_POSTHOG_API_KEY`.

**Verification:** `pnpm vitest run tests/unit/shared/env.test.ts tests/unit/scripts/build.test.ts`

### Task 3: Update build / CI scripts

**Files:**
- `scripts/build.mjs`
- `.github/workflows/release.yml`
- `scripts/sync-hooks.mjs`

**Changes:**
1. `scripts/build.mjs`: read only `LAZYKIMICODE_POSTHOG_API_KEY`; update warning text.
2. `.github/workflows/release.yml`: use only `secrets.LAZYKIMICODE_POSTHOG_API_KEY`; update warning text.
3. `scripts/sync-hooks.mjs`: generate `(LazyKimiCode ${VERSION})` status messages.
4. Run `pnpm run sync:hooks` to regenerate `plugin/hooks/`.

**Verification:** `pnpm run build && pnpm vitest run tests/unit/scripts/build.test.ts tests/integration/release-zip.test.ts`

### Task 4: Regenerate skills and verify clean

**Files:**
- `scripts/sync-skills.mjs`
- `plugin/skills/`

**Changes:**
1. Keep the rebrand transforms in `scripts/sync-skills.mjs` (they are required because `vendor/shared-skills/` is upstream and still contains OMO/OmO).
2. Run `pnpm run sync:skills`.
3. Verify `plugin/skills/` has no `OMO`/`OmO`/`OMO_` references.

**Verification:** `grep -R "OMO\\|OmO\\|OMO_" plugin/skills/ || echo clean`

### Task 5: Clean stale limitation comments / docs

**Files:**
- `src/components/lsp/args.ts`
- `docs/lazykimicode-rebrand-plan.md`
- `docs/audit-report.md`
- `docs/capabilities.md`
- `README.md`
- `AGENTS.md`

**Changes:**
1. Remove/correct any text that claims the three known limitations still exist.
2. Remove all mentions of `OMO_KIMI_*` / `OMO_*` env var fallbacks.
3. Update env-var tables to list only `LAZYKIMICODE_*` names.
4. Update test-count claims to the current passing count.

**Verification:** `grep -R "OMO_KIMI_\\|OMO_\\|OmO" --include="*.{ts,tsx,mjs,js,json,md}" src/ plugin/ scripts/ tests/ docs/ README.md AGENTS.md package.json .github/ || echo clean`

Expected exceptions:
- `vendor/shared-skills/` (upstream copy, not shipped after sync).
- Historical commit messages or changelog (not source).

### Task 6: Final verification

Run the full matrix:

```bash
pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build
```

Expected: green; test count should be 41 files / 267 tests (current baseline).

### Task 7: Commit, push, and monitor CI

1. `git status --short` — ensure no unexpected generated artifacts.
2. `git add -A && git commit -m "chore: remove OMO/OmO legacy branding entirely

- Drop OMO_KIMI_* and OMO_* env var fallbacks
- sync-hooks now emits (LazyKimiCode) status messages
- build/release.yml use only LAZYKIMICODE_POSTHOG_API_KEY
- docs and tests no longer reference OMO branding"`
3. `git push origin main`
4. `gh run watch` or `gh run list --branch main --limit 5` until green on all platforms.

## 3. Acceptance Criteria

- [x] `grep` for `OMO_KIMI_`, `OMO_`, `\bOmO\b` in tracked source/docs is clean (except `vendor/`).
- [x] `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` passes locally.
- [x] `git status` is clean after build.
- [x] Changes pushed to `origin/main`.
- [x] GitHub Actions run `29200996585` green on ubuntu-latest, macos-latest, windows-latest.
