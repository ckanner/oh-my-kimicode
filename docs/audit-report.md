# lazykimicode Audit Report

> **Scope:** Verification that the `OMO`/`OmO` legacy brand has been fully removed from code, docs, configuration, and CI, and that the implementation is consistent with the LazyKimiCode product plan.
>
> **Date:** 2026-07-13
>
> **Status:** Complete — all remediation tasks in [`docs/lazykimicode-audit-remediation-plan.md`](lazykimicode-audit-remediation-plan.md) are finished and CI is green.
>
> **Verification baseline:** `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` — green.

---

## 1. Wire protocol

Kimi Code CLI communicates with hook scripts through a local stdio contract (sometimes called the "wire protocol" in this codebase):

- The CLI writes a single JSON object to the hook script's **stdin**.
- Field names use **snake_case**, e.g. `hook_event_name`, `tool_name`, `tool_input`, `tool_output`, `session_id`, `subagent_type`, `stop_hook_active`, `prompt`, `response`.
- Only `UserPromptSubmit`, `PreToolUse`, and `Stop` can block.
- Exit code `0` = allow; exit code `2` = block; other non-zero = fail-open.
- The script may print a JSON object to **stdout**. Recognized fields:
  - `message` (top-level context to append)
  - `hookSpecificOutput.message`
  - `hookSpecificOutput.permissionDecision` / `permissionDecisionReason`
- For blocking events the reason is read from **stderr**.

`lazykimicode` implements this correctly via `src/shared/payload.ts` (snake→camel normalization) and `src/shared/serialize.ts` (output builder). No protocol changes are required.

Reference: [Hooks | Kimi Code CLI Docs](https://moonshotai.github.io/kimi-code/en/customization/hooks)

---

## 2. Environment variables and branding

All harness configuration uses the `LAZYKIMICODE_*` namespace. Legacy `OMO_KIMI_*` and `OMO_*` env var fallbacks have been removed from production code.

- `src/shared/env.ts` is the single source of truth for env var reads.
- No production code reads `process.env.OMO_*` or `process.env.OMO_KIMI_*` directly.
- `src/components/ulw-loop/steer.ts` only recognizes the `LAZYKIMICODE_ULW_LOOP_STEER:` steering marker.
- `scripts/sync-hooks.mjs` generates `(LazyKimiCode ${VERSION})` status messages.
- `scripts/build.mjs` and `.github/workflows/release.yml` use only `LAZYKIMICODE_POSTHOG_API_KEY`.

---

## 3. Previously flagged gaps (all implemented)

| Gap | Evidence |
|---|---|
| `teammode` subcommands | `src/components/teammode/scripts/team.ts`, `tests/unit/components/teammode.test.ts` |
| `lsp-daemon` split | `src/components/lsp/daemon.ts`, `src/components/lsp/mcp-server.ts`, `tests/unit/components/lsp-daemon.test.ts`, `tests/unit/components/lsp-mcp-server.test.ts` |
| Skill / MCP tool name alignment | `tests/unit/skills/mcp-alignment.test.ts` |
| `create-pr-body.mjs` | `plugin/skills/lcx-contribute-bug-fix/scripts/create-pr-body.mjs`, `tests/unit/skills/create-pr-body.test.ts` |

---

## 4. Known limitations (all resolved in code)

1. **teammode file locking** — `archive()` and `deleteTeam()` use `withLock()`.
2. **comment-checker multi-line/template-literal detection** — `findStringRanges()` handles multi-line template literals, `${...}` interpolation, escaped backticks, and nested strings.
3. **LSP quoted-space args** — `parseLspArgs()` respects single/double quotes and backslash escapes.

---

## 5. `.omo` directory rename to `.lazykimicode` (complete)

The only remaining `OMO` footprint was the **`.omo` directory name** used for configuration and state. `.omo` has been renamed `.lazykimicode` across source code, tests, skills, plugin manifest, docs, and `.gitignore`.

- `src/shared/env.ts` defaults to `~/.lazykimicode` and `~/.lazykimicode/teams`.
- All hardcoded project paths (`boulder.json`, `rules/`, `lsp-cache.json`, `codegraph-index.json`, `kimi-agents`, `sg-npm`) use `.lazykimicode`.
- `scripts/sync-skills.mjs` renames `.omo` to `.lazykimicode` in all copied text files, including helper `.mjs` scripts.
- `plugin/skills/` is clean of `OMO`, `OmO`, `Oh My KimiCode`, and `.omo`.
- CI run `29220023538` passed on `ubuntu-latest`, `macos-latest`, and `windows-latest`.
