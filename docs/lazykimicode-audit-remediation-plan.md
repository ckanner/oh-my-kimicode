# LazyKimiCode Audit & Remediation Plan

> **Date:** 2026-07-13  
> **Scope:** Full review of code, docs, prompts/skills, tests, and CI against the LazyKimiCode product plan; remediation of all remaining `OMO`/`OmO`/`.omo` legacy branding and any implementation gaps.  
> **Status:** Completed. All remediation tasks are finished and verified; see [`docs/audit-report.md`](audit-report.md) for the final audit summary.  
> **Verification baseline:** `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` — green.

---

## 1. What is the "wire protocol"?

The Kimi Code CLI **hook wire protocol** is the JSON stdio contract between the Kimi Code CLI and external hook scripts / MCP servers:

- The CLI writes a single JSON object to the script's **stdin**.
- Field names are **snake_case**: `hook_event_name`, `tool_name`, `tool_input`, `tool_output`, `session_id`, `subagent_type`, `stop_hook_active`, `prompt`, `response`.
- Only `UserPromptSubmit`, `PreToolUse`, and `Stop` can block.
- Exit code `0` = allow; exit code `2` = block; other non-zero = fail-open.
- The script may print JSON to **stdout**. Recognized fields:
  - `message` (top-level context to append)
  - `hookSpecificOutput.message`
  - `hookSpecificOutput.permissionDecision` / `permissionDecisionReason`
- For blocking events the reason is read from **stderr**.

This repo implements the wire protocol correctly in:

- `src/shared/payload.ts` — snake_case → camelCase normalization.
- `src/shared/serialize.ts` — Kimi-compatible stdout output builder.
- `src/shared/types.ts` — payload/output TypeScript types.
- Every component `cli.ts` uses `normalizeHookPayload()` and emits `message`/`hookSpecificOutput`.

**Reference:** [Hooks | Kimi Code CLI Docs](https://moonshotai.github.io/kimi-code/en/customization/hooks)

**Note:** The Kimi Code CLI hook protocol is **not** the same as the consumer-facing "Kimi CLI" chat product. It is specific to the Kimi Code CLI editor/agent harness. No protocol changes are required.

---

## 2. Audit findings

### 2.1 Already correct (verified)

| Area | Evidence |
|---|---|
| Wire protocol | `src/shared/payload.ts`, `src/shared/serialize.ts`, all `cli.ts` handlers |
| Env namespace | `src/shared/env.ts` reads only `LAZYKIMICODE_*` / `KIMI_CODE_HOME` / `KIMI_LOCAL_BIN_DIR`; no `OMO_*` fallbacks remain in production code |
| Hook status branding | `scripts/sync-hooks.mjs` emits `(LazyKimiCode ${VERSION})` |
| Build/CI PostHog secret | `scripts/build.mjs` and `.github/workflows/release.yml` use only `LAZYKIMICODE_POSTHOG_API_KEY` |
| ULW steering marker | `src/components/ulw-loop/steer.ts` matches only `LAZYKIMICODE_ULW_LOOP_STEER:` |
| `teammode` subcommands | `src/components/teammode/scripts/team.ts` exports 10 subcommands; `tests/unit/components/teammode.test.ts` covers them |
| `teammode` file locking | `archive()` and `deleteTeam()` wrap mutations in `withLock()` |
| `lsp-daemon` split | `src/components/lsp/daemon.ts` (persistent) + `src/components/lsp/mcp-server.ts` (stateless fallback) are separate binaries |
| LSP quoted-space args | `src/components/lsp/args.ts` `parseLspArgs()` respects single/double quotes and backslash escapes |
| Comment-checker template literals | `src/components/comment-checker/check.ts` `findStringRanges()` handles multi-line template literals, `${...}` interpolation, escaped backticks, and nested strings |
| Skill / MCP tool-name alignment | `tests/unit/skills/mcp-alignment.test.ts` passes; `plugin/kimi.plugin.json` declares `codegraph`, `lsp`, `lsp_tools_mcp`, `git_bash` |
| `create-pr-body.mjs` exists | `plugin/skills/lcx-contribute-bug-fix/scripts/create-pr-body.mjs` exists and has unit tests |

### 2.2 Remediation completed

All legacy `.omo` / `OMO` / `OmO` / `Oh My KimiCode` references have been removed from shipped code, tests, documentation, and configuration. The remaining `OMO` footprint was the **`.omo` directory name** used for configuration and state; it has been renamed to `.lazykimicode` everywhere.

Key remediation items completed:

- `src/shared/env.ts` defaults to `~/.lazykimicode` and `~/.lazykimicode/teams`.
- All hardcoded project paths (`boulder.json`, `rules/`, `lsp-cache.json`, `codegraph-index.json`, `kimi-agents`, `sg-npm`) use `.lazykimicode`.
- `scripts/sync-skills.mjs` renames `.omo` to `.lazykimicode` and `Oh My KimiCode` to `LazyKimiCode` in all copied text files, including helper `.mjs` scripts.
- `plugin/skills/` is clean of `OMO`, `OmO`, `Oh My KimiCode`, and `.omo` after `pnpm run sync:skills`.
- `plugin/kimi.plugin.json` `skillInstructions` references `.lazykimicode/rules/`.
- Tests use `.lazykimicode` directories.
- `.gitignore` ignores `.lazykimicode/`.
- Documentation no longer advertises `.omo` or legacy branding.

---

## 3. Remediation plan

### Task 1: Rename default config directories in `src/shared/env.ts`

**Files:**
- Modify: `src/shared/env.ts`

**Changes:**
1. `getTeamsDir()` default: `path.join(os.homedir(), '.lazykimicode', 'teams')`
2. `getConfigDir()` default: `path.join(os.homedir(), '.lazykimicode')`
3. Update the doc comment for `getConfigDir()` to say `.lazykimicode` is the LazyKimiCode convention.

**Verification:**
```bash
pnpm vitest run tests/unit/shared/env.test.ts tests/unit/shared/paths.test.ts
```

---

### Task 2: Replace hardcoded `.omo` paths in source

**Files:**
- Modify: `src/components/bootstrap/provision.ts`
- Modify: `src/components/codegraph/indexer.ts`
- Modify: `src/components/lsp/diagnostics.ts`
- Modify: `src/components/rules/discover.ts`
- Modify: `src/components/start-work-continuation/boulder.ts`
- Modify: `src/install/doctor.ts`
- Modify: `src/cli/index.ts`

**Changes:**
Replace every literal `.omo` segment with `.lazykimicode` in paths, error messages, and help text.

**Verification:**
```bash
pnpm run lint && pnpm run typecheck
pnpm vitest run tests/unit/components/bootstrap.test.ts tests/unit/components/rules.test.ts tests/unit/components/start-work-continuation.test.ts tests/unit/install/doctor.test.ts tests/unit/components/codegraph.test.ts tests/unit/components/lsp.test.ts
```

---

### Task 3: Update component skill sources to remove `.omo`

**Files:**
- Modify: `src/components/ultrawork/skills/ultrawork/SKILL.md`
- Modify: `src/components/ulw-loop/skills/ulw-loop/SKILL.md`
- Modify: `src/components/teammode/skills/teammode/SKILL.md`
- Modify: `src/components/rules/skills/rules/SKILL.md`

**Changes:**
Replace all `.omo/` references with `.lazykimicode/`.

---

### Task 4: Harden `scripts/sync-skills.mjs` to rebrand `.omo` and all copied helper scripts

**Files:**
- Modify: `scripts/sync-skills.mjs`

**Changes:**
1. Extend `rebrandSkillContent()` to replace `.omo/` with `.lazykimicode/` (and bare `.omo` when used as a directory name).
2. Apply the full rebrand transform to **all** copied text files, not only `SKILL.md`. At minimum transform `.md`, `.mjs`, `.js`, `.json`, `.yaml`, `.yml`, `.sh`.
3. Keep binary files copied as-is.

This will automatically fix `plugin/skills/lcx-contribute-bug-fix/scripts/create-pr-body.mjs` and `plugin/skills/ulw-plan/scripts/scaffold-plan.mjs`.

**Verification:**
```bash
pnpm run sync:skills
# plugin/skills must be clean of OMO/OmO/Oh My KimiCode/.omo
grep -R "OMO\|OmO\|Oh My KimiCode\|\.omo" plugin/skills/ || echo "clean"
```

---

### Task 5: Update plugin manifest skill instructions

**Files:**
- Modify: `plugin/kimi.plugin.json`

**Changes:**
Update `skillInstructions` to reference `.lazykimicode/rules/` instead of `.omo/rules/`.

---

### Task 6: Update tests to use `.lazykimicode`

**Files:**
- Modify: `tests/integration/cli-wrappers.test.ts`
- Modify: `tests/integration/hooks.test.ts`
- Modify: `tests/integration/installer.test.ts`
- Modify: `tests/integration/uninstall.test.ts`
- Modify: `tests/unit/components/bootstrap.test.ts`
- Modify: `tests/unit/components/rules.test.ts`
- Modify: `tests/unit/components/start-work-continuation.test.ts`
- Modify: `tests/unit/scripts/build.test.ts`

**Changes:**
1. Replace all `.omo` directory literals with `.lazykimicode`.
2. Remove the stale `delete env.OMO_KIMI_POSTHOG_API_KEY` line from `tests/unit/scripts/build.test.ts`.

**Verification:**
```bash
pnpm test
```

---

### Task 7: Update documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/capabilities.md`
- Modify: `docs/audit-report.md`
- Modify: `docs/lazykimicode-finalize-plan.md`

**Changes:**
1. Replace every `.omo/` reference with `.lazykimicode/`.
2. Update default values in env-var tables: `~/.omo` → `~/.lazykimicode`, `~/.omo/teams` → `~/.lazykimicode/teams`.
3. In `docs/audit-report.md`, remove the claim that the rebrand is complete; instead point at this remediation plan and list the remaining work.
4. In `docs/lazykimicode-finalize-plan.md`, correct the "What is still wrong" section (OMO env fallbacks are already removed) and add `.omo` directory renaming as the remaining task.
5. Keep `docs/lazykimicode-rebrand-plan.md` as historical record but add a note that it is superseded.

---

### Task 8: Update `.gitignore`

**Files:**
- Modify: `.gitignore`

**Changes:**
Replace `.omo/` with `.lazykimicode/`.

---

### Task 9: Regenerate plugin assets

**Files:**
- Generated: `plugin/hooks/`, `plugin/components/*/dist/`, `plugin/skills/`, `plugin/components/teammode/scripts/team.mjs`

**Changes:**
1. `pnpm run sync:skills`
2. `pnpm run build` (which runs `sync-hooks` and the esbuild steps)
3. Verify generated files contain no `.omo` / `OMO` / `OmO` / `Oh My KimiCode`.

---

### Task 10: Final verification

Run the full matrix:

```bash
pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build
```

Expected: green; 41 test files / 267 tests passing.

Then audit:

```bash
grep -R "OMO_KIMI_\|OMO_DISABLE\|OMO_SOURCE\|OMO_TEAMS\|OMO_CONFIG\|\\bOmO\\b\|Oh My KimiCode" \
  --include="*.{ts,tsx,mjs,js,json,md,yml,yaml,toml}" \
  src/ plugin/ scripts/ tests/ docs/ README.md AGENTS.md .github/ .gitignore || echo "no legacy brand references"
```

Expected exceptions:
- `vendor/shared-skills/` (upstream copy; rebrand is applied during sync).
- `docs/lazykimicode-rebrand-plan.md` historical text.
- `docs/lazykimicode-finalize-plan.md` may mention the historical migration.

Also verify no literal `.omo` directory references remain in shipped code:

```bash
grep -R "\\.omo\\b" \
  --include="*.{ts,tsx,mjs,js,json,md}" \
  src/ plugin/ scripts/ tests/ docs/ README.md AGENTS.md .github/ || echo "no .omo references"
```

Expected exceptions:
- `vendor/shared-skills/`.
- Historical plan docs.

---

### Task 11: Commit, push, and monitor CI

1. `git status --short` — ensure only intended files are modified; generated artifacts are expected.
2. `git add -A`
3. `git commit -m "rebrand: remove remaining .omo/OMO legacy from code, docs, and config

- Rename default config/state dirs from ~/.omo to ~/.lazykimicode
- Replace all hardcoded .omo project paths with .lazykimicode
- Update skills, plugin manifest, tests, and docs
- sync-skills.mjs now renames .omo in all copied text files
- Remove stale OMO_KIMI_POSTHOG_API_KEY fallback from build test
- Update .gitignore to ignore .lazykimicode/"`
4. `git push origin main`
5. Watch CI: `gh run list --branch main --limit 5` until green.

---

## 4. Acceptance criteria

- [x] `src/shared/env.ts` defaults to `~/.lazykimicode` and `~/.lazykimicode/teams`.
- [x] No `.omo` directory references remain in `src/`, `plugin/`, `tests/`, `docs/`, `README.md`, `AGENTS.md`, `.github/`, `.gitignore` (except historical plan docs).
- [x] `plugin/skills/` is clean of `OMO`, `OmO`, `Oh My KimiCode`, and `.omo` after `pnpm run sync:skills`.
- [x] `plugin/kimi.plugin.json` `skillInstructions` references `.lazykimicode/rules/`.
- [x] `scripts/sync-skills.mjs` applies `.omo` → `.lazykimicode` and `Oh My KimiCode` → `LazyKimiCode` to all copied text files.
- [x] All tests pass: `pnpm test` → 41 files / 267 tests.
- [x] Build succeeds: `pnpm run build`.
- [x] Lint and typecheck pass.
- [x] Changes are committed and pushed to `origin/main`.
- [x] GitHub Actions run is green.
