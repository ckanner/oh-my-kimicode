# LazyKimiCode Rebrand & Finalization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note:** `docs/superpowers/` is gitignored for generated metadata, so this plan lives at `docs/lazykimicode-rebrand-plan.md` to remain tracked.

**Goal:** Complete the migration from `OMO`/`OmO` branding to `LazyKimiCode`/`lazykimicode` across code, docs, configuration, and CI, while keeping legacy `OMO_*`/`OMO_KIMI_*` env vars as fallbacks. Fix stale limitation notes and align all documentation with the actual implementation.

**Architecture:** A single source-of-truth module (`src/shared/env.ts`) owns environment-variable name resolution with backward-compatible fallbacks. All components import helpers from it instead of reading `process.env` directly. Docs, manifests, skills, and CI are updated to advertise the new `LAZYKIMICODE_*` names and branding.

**Tech Stack:** TypeScript 6.x, Node.js ESM, pnpm, vitest, esbuild, GitHub Actions.

## Global Constraints

- `LAZYKIMICODE_*` is the primary env var namespace; `OMO_KIMI_*` and a few `OMO_*` aliases remain as fallbacks.
- The `.omo/` directory path is kept as the shared harness convention; only the env var names that point to it change.
- `vendor/shared-skills/` is an upstream copy and must not be edited; rebrand skill text in `plugin/skills/` via `scripts/sync-skills.mjs` transformations.
- Hook commands remain fail-open (exit `0` for advisory context, exit `2` only for genuine blocks).
- Every task must leave `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` green.
- No new placeholder text, TODOs, or unimplemented stubs may be introduced.

---

## File map

| File | Responsibility |
|---|---|
| `src/shared/env.ts` | Single source of truth for env var name resolution and typed helpers |
| `src/shared/paths.ts` | Resolves project/config/team dirs and version; migrates to `env.ts` helpers |
| `src/shared/telemetry.ts` | Telemetry state paths; migrates to `env.ts` helpers |
| `src/components/*/cli.ts` / `*.ts` / `*.mjs` | Component source files; migrate direct `process.env` reads |
| `src/install/*.ts` | Installer/doctor; migrate env var reads |
| `src/components/*/hooks.json` | Hook metadata; change `(OmO)` status messages to `(LazyKimiCode)` |
| `plugin/kimi.plugin.json` | Plugin manifest; rebrand description/keywords/instructions |
| `package.json` | Package metadata; rebrand description/keywords |
| `scripts/build.mjs` | Build script; read new PostHog secret name with fallback |
| `.github/workflows/release.yml` | CI release workflow; use new secret name with fallback |
| `README.md`, `AGENTS.md`, `docs/capabilities.md`, `docs/audit-report.md` | User and agent docs; rebrand env vars and copy |
| `plugin/skills/*/SKILL.md` | Synced skills; rebrand header and stale env var examples |
| `scripts/sync-skills.mjs` | Skill sync script; add rebrand transforms for copied skills |
| `tests/**/*.test.ts` | Tests; update env vars and string assertions |

---

## Task 1: Extend `src/shared/env.ts` to cover all env vars

**Files:**
- Modify: `src/shared/env.ts`

**Interfaces:**
- Produces: `getEnv(name, fallback?)`, `getEnvBool(name)`, `isTelemetryDisabled()`, `getProjectDir()`, `getTeamsDir()`, `getConfigDir()`, `getStateFile()`, `getStateDir()`, `getBinDir()`, `getKimiCodeHome()`

- [ ] **Step 1: Add remaining helpers**

  Update `src/shared/env.ts` so every legacy env var has a typed helper:

  ```typescript
  import os from 'node:os';
  import path from 'node:path';

  export function getEnv(name: string, fallback?: string): string | undefined {
    const primary = process.env[`LAZYKIMICODE_${name}`];
    if (primary !== undefined) return primary;
    const legacy = process.env[`OMO_KIMI_${name}`];
    if (legacy !== undefined) return legacy;
    return fallback;
  }

  export function getEnvBool(name: string): boolean {
    const primary = process.env[`LAZYKIMICODE_${name}`];
    if (primary !== undefined) {
      return primary === '1' || primary.toLowerCase() === 'true';
    }
    const legacy = process.env[`OMO_KIMI_${name}`];
    if (legacy !== undefined) {
      return legacy === '1' || legacy.toLowerCase() === 'true';
    }
    return false;
  }

  export function isTelemetryDisabled(): boolean {
    const disabled =
      process.env.LAZYKIMICODE_DISABLE_POSTHOG === '1' ||
      process.env.LAZYKIMICODE_DISABLE_POSTHOG?.toLowerCase() === 'true' ||
      process.env.OMO_KIMI_DISABLE_POSTHOG === '1' ||
      process.env.OMO_KIMI_DISABLE_POSTHOG?.toLowerCase() === 'true' ||
      process.env.OMO_DISABLE_POSTHOG === '1' ||
      process.env.OMO_DISABLE_POSTHOG?.toLowerCase() === 'true';
    if (disabled) return true;

    const telemetryVars = [
      process.env.LAZYKIMICODE_SEND_ANONYMOUS_TELEMETRY,
      process.env.OMO_KIMI_SEND_ANONYMOUS_TELEMETRY,
      process.env.OMO_SEND_ANONYMOUS_TELEMETRY,
    ];
    for (const value of telemetryVars) {
      if (value === undefined) continue;
      if (['0', 'false', 'no'].includes(value.toLowerCase())) return true;
    }
    return false;
  }

  export function getProjectDir(): string {
    return process.env.LAZYKIMICODE_PROJECT ?? process.env.OMO_KIMI_PROJECT ?? process.cwd();
  }

  export function getTeamsDir(): string {
    return (
      process.env.LAZYKIMICODE_TEAMS_DIR ??
      process.env.OMO_TEAMS_DIR ??
      path.join(os.homedir(), '.omo', 'teams')
    );
  }

  export function getConfigDir(): string {
    return (
      process.env.LAZYKIMICODE_CONFIG_DIR ??
      process.env.OMO_KIMI_CONFIG_DIR ??
      path.join(os.homedir(), '.omo')
    );
  }

  export function getStateFile(): string | undefined {
    return getEnv('STATE_FILE');
  }

  export function getStateDir(): string {
    return getEnv('STATE_DIR') ?? path.join(os.homedir(), '.local', 'share', 'lazykimicode');
  }

  export function getBinDir(): string {
    const defaultHome = path.join(os.homedir(), '.kimi-code');
    const kimiCodeHome =
      process.env.KIMI_CODE_HOME ?? defaultHome;
    return (
      getEnv('BIN_DIR') ??
      process.env.KIMI_LOCAL_BIN_DIR ??
      (kimiCodeHome === defaultHome ? path.join(os.homedir(), '.local', 'bin') : path.join(kimiCodeHome, 'bin'))
    );
  }

  export function getKimiCodeHome(): string {
    return process.env.KIMI_CODE_HOME ?? path.join(os.homedir(), '.kimi-code');
  }
  ```

- [ ] **Step 2: Add unit tests for the new helpers**

  Modify `tests/unit/shared/paths.test.ts` (or create `tests/unit/shared/env.test.ts`) to assert:
  - `getEnv('LSP_COMMAND')` prefers `LAZYKIMICODE_LSP_COMMAND` over `OMO_KIMI_LSP_COMMAND`.
  - `isTelemetryDisabled()` returns `true` for `LAZYKIMICODE_DISABLE_POSTHOG=1` and for `OMO_DISABLE_POSTHOG=1`.
  - `getProjectDir()` falls back through `OMO_KIMI_PROJECT` to `process.cwd()`.

- [ ] **Step 3: Run targeted tests**

  ```bash
  pnpm vitest run tests/unit/shared/paths.test.ts tests/unit/shared/env.test.ts
  ```

  Expected: PASS

- [ ] **Step 4: Commit**

  ```bash
  git add src/shared/env.ts tests/unit/shared/env.test.ts
  git commit -m "feat(shared): extend env helpers with LAZYKIMICODE_* primary names and OMO fallbacks"
  ```

---

## Task 2: Migrate all source code to `src/shared/env.ts`

**Files:**
- Modify: `src/shared/paths.ts`, `src/shared/telemetry.ts`, `src/components/bootstrap/session-start.ts`, `src/components/codegraph/bootstrap.ts`, `src/components/codegraph/serve.mjs`, `src/components/lsp/cli.ts`, `src/components/lsp/daemon.ts`, `src/components/lsp/diagnostics.ts`, `src/components/lsp/mcp-server.ts`, `src/components/rules/cli.ts`, `src/components/start-work-continuation/boulder.ts`, `src/components/teammode/scripts/team.ts`, `src/components/telemetry/posthog.ts`, `src/components/ulw-loop/steer.ts`, `src/install/doctor.ts`, `src/install/install-kimi.ts`

**Interfaces:**
- Consumes: helpers from `src/shared/env.ts`
- Produces: no direct `process.env.OMO_*` reads remain (except in `env.ts` itself)

- [ ] **Step 1: Replace direct env reads with helpers**

  Mechanical replacements per file:

  - `process.env.OMO_KIMI_PROJECT ?? process.cwd()` → `getProjectDir()`
  - `process.env.OMO_TEAMS_DIR ?? ...` → `getTeamsDir()`
  - `process.env.OMO_KIMI_CONFIG_DIR ?? ...` → `getConfigDir()`
  - `process.env.OMO_KIMI_VERSION ?? VERSION` → `getEnv('VERSION') ?? VERSION`
  - `process.env.OMO_KIMI_PLUGIN_CACHE ?? ''` → `getEnv('PLUGIN_CACHE') ?? ''`
  - `process.env.OMO_KIMI_BIN_DIR ?? ''` → `getEnv('BIN_DIR') ?? ''`
  - `process.env.OMO_KIMI_LSP_COMMAND` → `getEnv('LSP_COMMAND')`
  - `process.env.OMO_KIMI_LSP_ARGS` → `getEnv('LSP_ARGS')`
  - `process.env.OMO_KIMI_POSTHOG_API_KEY` → `getEnv('POSTHOG_API_KEY')`
  - `process.env.OMO_KIMI_POSTHOG_HOST` → `getEnv('POSTHOG_HOST')`
  - `process.env.OMO_KIMI_MIGRATION_STATE_DIR` → `getEnv('MIGRATION_STATE_DIR')`
  - `process.env.OMO_KIMI_SKIP_BOOTSTRAP === '1'` → `getEnvBool('SKIP_BOOTSTRAP')`
  - `process.env.OMO_KIMI_STATE_FILE` → `getStateFile()`
  - `process.env.OMO_KIMI_STATE_DIR` → `getStateDir()`
  - Telemetry disable checks → `isTelemetryDisabled()`

  Add imports where missing:

  ```typescript
  import { getEnv, getEnvBool, getProjectDir, getTeamsDir, getConfigDir, isTelemetryDisabled } from '../../shared/env.js';
  ```

- [ ] **Step 2: Update `ulw-loop` steering marker**

  In `src/components/ulw-loop/steer.ts`, change the regex to match both the new and old marker:

  ```typescript
  const STEER_PATTERN = /(?:LAZYKIMICODE|OMO)_ULW_LOOP_STEER:\s*(.+)/i;
  ```

- [ ] **Step 3: Run lint and typecheck**

  ```bash
  pnpm run lint && pnpm run typecheck
  ```

  Expected: PASS

- [ ] **Step 4: Run unit tests**

  ```bash
  pnpm test
  ```

  Expected: 40 files / 257 tests PASS (tests still use old env vars at this point; that is fixed in Task 4)

- [ ] **Step 5: Commit**

  ```bash
  git add src/
  git commit -m "refactor: route all env var reads through src/shared/env.ts

  Keeps OMO_KIMI_* and OMO_* as fallbacks while making LAZYKIMICODE_*
  the primary namespace."
  ```

---

## Task 3: Rebrand hook status messages and bootstrap output

**Files:**
- Modify: `src/components/*/hooks.json`, `src/components/bootstrap/session-start.ts`
- Modify: `plugin/kimi.plugin.json`, `package.json`

**Interfaces:**
- Produces: no `(OmO)` strings in shipped metadata or built hooks

- [ ] **Step 1: Replace `(OmO)` with `(LazyKimiCode)` in all hooks.json**

  Example change in `src/components/bootstrap/hooks.json`:

  ```json
  "statusMessage": "(LazyKimiCode) Bootstrap provisioning"
  ```

  Apply the same transformation to every `src/components/*/hooks.json` file.

- [ ] **Step 2: Update bootstrap output**

  In `src/components/bootstrap/session-start.ts`:

  ```typescript
  details = `(LazyKimiCode ${ctx.version}) Bootstrap provisioning complete`;
  ```

- [ ] **Step 3: Update plugin manifest and package metadata**

  `plugin/kimi.plugin.json`:

  ```json
  {
    "description": "LazyKimiCode agent harness for Kimi Code CLI",
    "keywords": ["lazykimicode", "agent-harness", "lsp", "rules", "ultrawork"],
    "skillInstructions": "You are running with lazykimicode. Prefer the lazykimicode MCP tools for structural search (codegraph) and LSP. Respect project rules from .omo/rules/ and AGENTS.md. On Windows, prefer the git_bash MCP for shell operations when available.",
    "interface": {
      "displayName": "LazyKimiCode",
      "shortDescription": "LazyKimiCode agent harness for Kimi Code CLI",
      "developerName": "Sisyphus Labs"
    }
  }
  ```

  `package.json`:

  ```json
  {
    "description": "LazyKimiCode agent harness for Kimi Code CLI",
    "keywords": ["kimi-code", "kimi", "kimi-code-cli", "agent-harness", "mcp", "lsp", "ai-agent", "multi-agent", "swarm", "ultrawork", "lazykimicode", "lazykimi"]
  }
  ```

- [ ] **Step 4: Regenerate plugin hooks**

  ```bash
  pnpm run sync:hooks
  ```

  Verify `plugin/hooks/*.json` now contain `(LazyKimiCode)` status messages.

- [ ] **Step 5: Run tests**

  ```bash
  pnpm test
  ```

  Expected: PASS (string assertions in tests are updated in Task 4)

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/*/hooks.json src/components/bootstrap/session-start.ts plugin/kimi.plugin.json package.json plugin/hooks/
  git commit -m "chore: rebrand (OmO) status messages and plugin metadata to LazyKimiCode"
  ```

---

## Task 4: Update tests for the new env namespace

**Files:**
- Modify: `tests/integration/cli-wrappers.test.ts`, `tests/integration/doctor.test.ts`, `tests/integration/hooks.test.ts`, `tests/integration/installer.test.ts`, `tests/integration/release-zip.test.ts`, `tests/integration/uninstall.test.ts`, `tests/unit/components/bootstrap.test.ts`, `tests/unit/components/lsp-daemon.test.ts`, `tests/unit/components/lsp-mcp-server.test.ts`, `tests/unit/components/lsp.test.ts`, `tests/unit/components/start-work-continuation.test.ts`, `tests/unit/components/teammode.test.ts`, `tests/unit/components/telemetry.test.ts`, `tests/unit/components/ulw-loop.test.ts`, `tests/unit/scripts/build.test.ts`, `tests/unit/shared/version.test.ts`

**Interfaces:**
- Produces: tests exercise `LAZYKIMICODE_*` variables while preserving a single regression test for `OMO_KIMI_*` fallback behavior

- [ ] **Step 1: Replace env var names in tests**

  Mechanical replacements:
  - `OMO_KIMI_DISABLE_POSTHOG` → `LAZYKIMICODE_DISABLE_POSTHOG`
  - `OMO_KIMI_STATE_DIR` → `LAZYKIMICODE_STATE_DIR`
  - `OMO_KIMI_PROJECT` → `LAZYKIMICODE_PROJECT`
  - `OMO_KIMI_SKIP_BOOTSTRAP` → `LAZYKIMICODE_SKIP_BOOTSTRAP`
  - `OMO_KIMI_CONFIG_DIR` → `LAZYKIMICODE_CONFIG_DIR`
  - `OMO_KIMI_MIGRATION_STATE_DIR` → `LAZYKIMICODE_MIGRATION_STATE_DIR`
  - `OMO_KIMI_POSTHOG_API_KEY` → `LAZYKIMICODE_POSTHOG_API_KEY`
  - `OMO_KIMI_POSTHOG_HOST` → `LAZYKIMICODE_POSTHOG_HOST`
  - `OMO_KIMI_LSP_COMMAND` → `LAZYKIMICODE_LSP_COMMAND`
  - `OMO_KIMI_LSP_ARGS` → `LAZYKIMICODE_LSP_ARGS`
  - `OMO_KIMI_PLUGIN_CACHE` → `LAZYKIMICODE_PLUGIN_CACHE`
  - `OMO_KIMI_BIN_DIR` → `LAZYKIMICODE_BIN_DIR`
  - `OMO_TEAMS_DIR` → `LAZYKIMICODE_TEAMS_DIR`
  - `OMO_ULW_LOOP_STEER:` → `LAZYKIMICODE_ULW_LOOP_STEER:`

- [ ] **Step 2: Update string assertions for new branding**

  - `expect(output.message).toContain('OmO')` → `expect(output.message).toContain('LazyKimiCode')`
  - Test titles referencing `OMO_KIMI_*` → `LAZYKIMICODE_*`

- [ ] **Step 3: Add a backward-compatibility regression test**

  In `tests/unit/shared/env.test.ts` (or `tests/unit/shared/paths.test.ts`), add:

  ```typescript
  it('falls back to OMO_KIMI_* when LAZYKIMICODE_* is unset', () => {
    process.env.OMO_KIMI_LSP_COMMAND = 'legacy-lsp';
    delete process.env.LAZYKIMICODE_LSP_COMMAND;
    expect(getEnv('LSP_COMMAND')).toBe('legacy-lsp');
    delete process.env.OMO_KIMI_LSP_COMMAND;
  });
  ```

- [ ] **Step 4: Run full test suite**

  ```bash
  pnpm test
  ```

  Expected: 40 files / 257 tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add tests/
  git commit -m "test: migrate env vars and branding assertions to LAZYKIMICODE_* namespace"
  ```

---

## Task 5: Update CI and build script for the new PostHog secret

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `scripts/build.mjs`
- Modify: `tests/unit/scripts/build.test.ts`

**Interfaces:**
- Produces: release builds use `LAZYKIMICODE_POSTHOG_API_KEY` while still accepting `OMO_KIMI_POSTHOG_API_KEY` as a fallback

- [ ] **Step 1: Update build script**

  In `scripts/build.mjs`:

  ```javascript
  const posthogKey = process.env.LAZYKIMICODE_POSTHOG_API_KEY ?? process.env.OMO_KIMI_POSTHOG_API_KEY;
  if (!posthogKey) {
    console.warn('Warning: LAZYKIMICODE_POSTHOG_API_KEY (or OMO_KIMI_POSTHOG_API_KEY fallback) not set. Telemetry will be skipped in this build.');
  }
  ```

  Update the sed step (if any) to use `posthogKey`.

- [ ] **Step 2: Update release workflow**

  `.github/workflows/release.yml`:

  ```yaml
      - name: Inject PostHog API key
        env:
          LAZYKIMICODE_POSTHOG_API_KEY: ${{ secrets.LAZYKIMICODE_POSTHOG_API_KEY || secrets.OMO_KIMI_POSTHOG_API_KEY }}
        run: |
          if [ -z "$LAZYKIMICODE_POSTHOG_API_KEY" ]; then
            echo "::warning::LAZYKIMICODE_POSTHOG_API_KEY secret is not set. Telemetry will be skipped in the release build."
          else
            sed -i "s/phc_placeholder_replace_in_build/$LAZYKIMICODE_POSTHOG_API_KEY/g" src/components/telemetry/posthog.ts
          fi
  ```

- [ ] **Step 3: Update build test**

  `tests/unit/scripts/build.test.ts`:
  - Rename test title to reference `LAZYKIMICODE_POSTHOG_API_KEY`.
  - Set `LAZYKIMICODE_POSTHOG_API_KEY` (and optionally assert fallback still works with `OMO_KIMI_POSTHOG_API_KEY`).
  - Update expected warning string.

- [ ] **Step 4: Run build and build test**

  ```bash
  pnpm vitest run tests/unit/scripts/build.test.ts
  pnpm run build
  ```

  Expected: PASS, and the build warning references the new variable name.

- [ ] **Step 5: Commit**

  ```bash
  git add .github/workflows/release.yml scripts/build.mjs tests/unit/scripts/build.test.ts
  git commit -m "ci: prefer LAZYKIMICODE_POSTHOG_API_KEY with OMO_KIMI_* fallback"
  ```

---

## Task 6: Rebrand documentation

**Files:**
- Modify: `README.md`, `AGENTS.md`, `docs/capabilities.md`, `docs/superpowers/plans/lazykimicode-plan.md`, `docs/audit-report.md`

**Interfaces:**
- Produces: user-facing docs reference `LAZYKIMICODE_*` and `LazyKimiCode`; stale snippets are corrected

- [ ] **Step 1: Replace env var tables and examples**

  In `README.md`, `AGENTS.md`, and `docs/capabilities.md`:

  - `OMO_KIMI_DISABLE_POSTHOG` → `LAZYKIMICODE_DISABLE_POSTHOG`
  - `OMO_KIMI_POSTHOG_API_KEY` → `LAZYKIMICODE_POSTHOG_API_KEY`
  - `OMO_KIMI_POSTHOG_HOST` → `LAZYKIMICODE_POSTHOG_HOST`
  - `OMO_KIMI_LSP_COMMAND` → `LAZYKIMICODE_LSP_COMMAND`
  - `OMO_KIMI_LSP_ARGS` → `LAZYKIMICODE_LSP_ARGS`
  - `OMO_KIMI_PROJECT` → `LAZYKIMICODE_PROJECT`
  - `OMO_TEAMS_DIR` → `LAZYKIMICODE_TEAMS_DIR`
  - `OMO_ULW_LOOP_STEER:` → `LAZYKIMICODE_ULW_LOOP_STEER:`

- [ ] **Step 2: Correct factual discrepancies**

  - `README.md`: change "three built-in MCP servers" to "four built-in MCP servers" and list them.
  - `docs/superpowers/plans/lazykimicode-plan.md`: update the `package.json` snippet, plugin manifest snippet, cache path, hook generation note, and `--codex-home` reference. Add `rules` to the ported skills list. Replace `OmO` references with `LazyKimiCode` where appropriate.

- [ ] **Step 3: Document the full env var surface**

  Add a section (or expand the existing table) documenting all variables the harness reads, including:

  - `LAZYKIMICODE_DISABLE_POSTHOG`
  - `LAZYKIMICODE_POSTHOG_API_KEY`
  - `LAZYKIMICODE_POSTHOG_HOST`
  - `LAZYKIMICODE_LSP_COMMAND`
  - `LAZYKIMICODE_LSP_ARGS`
  - `LAZYKIMICODE_PROJECT`
  - `LAZYKIMICODE_TEAMS_DIR`
  - `LAZYKIMICODE_CONFIG_DIR`
  - `LAZYKIMICODE_STATE_DIR`
  - `LAZYKIMICODE_STATE_FILE`
  - `LAZYKIMICODE_PLUGIN_CACHE`
  - `LAZYKIMICODE_BIN_DIR`
  - `LAZYKIMICODE_VERSION`
  - `LAZYKIMICODE_SKIP_BOOTSTRAP`
  - `LAZYKIMICODE_MIGRATION_STATE_DIR`
  - `KIMI_CODE_HOME`
  - `KIMI_LOCAL_BIN_DIR`

  Note that `OMO_KIMI_*` and `OMO_*` aliases are still accepted for backward compatibility.

- [ ] **Step 4: Run lint on docs**

  Docs are not linted by the project eslint config, but verify no broken markdown links.

- [ ] **Step 5: Commit**

  ```bash
  git add README.md AGENTS.md docs/capabilities.md docs/superpowers/plans/lazykimicode-plan.md docs/audit-report.md
  git commit -m "docs: rebrand env vars and copy to LazyKimiCode, fix stale plan snippets"
  ```

---

## Task 7: Rebrand skills and sync script

**Files:**
- Modify: `scripts/sync-skills.mjs`
- Modify: `plugin/skills/*/SKILL.md` (regenerated)

**Interfaces:**
- Consumes: upstream `vendor/shared-skills/`
- Produces: `plugin/skills/` copies use `LazyKimiCode` branding and `LAZYKIMICODE_*` env vars

- [ ] **Step 1: Add rebrand transforms to `sync-skills.mjs`**

  After copying each skill file, apply replacements:

  ```javascript
  function rebrandSkill(content) {
    return content
      .replace(/## OMO Kimi K2\.7 Orchestration Calibration/g, '## LazyKimiCode K2.7 Orchestration Calibration')
      .replace(/OMO_KIMI_LSP_COMMAND/g, 'LAZYKIMICODE_LSP_COMMAND')
      .replace(/OMO_KIMI_LSP_ARGS/g, 'LAZYKIMICODE_LSP_ARGS')
      .replace(/OMO_SOURCE_ROOT/g, 'LAZYKIMICODE_SOURCE_ROOT')
      .replace(/OH_MY_KIMICODE_SOURCE_ROOT/g, 'LAZYKIMICODE_SOURCE_ROOT')
      .replace(/\bOmO\b/g, 'LazyKimiCode')
      .replace(/Oh My KimiCode \(OmO harness\)/g, 'LazyKimiCode');
  }
  ```

  Wire this into the copy loop so the generated `plugin/skills/` files are clean.

- [ ] **Step 2: Regenerate skills**

  ```bash
  pnpm run sync:skills
  ```

- [ ] **Step 3: Verify no `OMO`/`OmO` remains in `plugin/skills/`**

  ```bash
  grep -R "OMO\|OmO" plugin/skills/ || echo "clean"
  ```

  Expected: `clean`

- [ ] **Step 4: Run skill tests**

  ```bash
  pnpm vitest run tests/unit/skills/
  ```

  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add scripts/sync-skills.mjs plugin/skills/
  git commit -m "chore(skills): rebrand generated skill docs to LazyKimiCode via sync transform"
  ```

---

## Task 8: Clear stale limitation notes

**Files:**
- Modify: any comments or docs that still claim the three known limitations exist
- Modify: `tests/unit/components/comment-checker.test.ts` (add a test for TODO inside a block comment that starts inside a multi-line template literal, if missing)

**Interfaces:**
- Produces: limitation notes are removed because the code already handles the cases

- [ ] **Step 1: Remove or correct limitation comments**

  Search for and remove comments/doc lines such as:
  - "archive() / deleteTeam() have no file lock"
  - "comment-checker string detection is a line heuristic"
  - "LSP args do not support quoted spaces"

  Replace with accurate descriptions or remove entirely.

- [ ] **Step 2: Add coverage for edge cases if not already present**

  `tests/unit/components/comment-checker.test.ts` already covers multi-line template literals. Add one test for a TODO inside a block comment that is preceded by a multi-line template literal on the same file:

  ```typescript
  it('detects TODO after a multi-line template literal and block comment', () => {
    const content = 'const msg = `multi\nline`; /* TODO: real */\n';
    const markers = findStaleMarkers(content);
    expect(markers).toHaveLength(1);
    expect(markers[0].marker).toBe('TODO');
  });
  ```

- [ ] **Step 3: Run tests**

  ```bash
  pnpm vitest run tests/unit/components/comment-checker.test.ts tests/unit/components/lsp-args.test.ts tests/unit/components/teammode.test.ts
  ```

  Expected: PASS

- [ ] **Step 4: Commit**

  ```bash
  git add -A
  git commit -m "docs: remove stale limitation notes; add comment-checker regression test"
  ```

---

## Task 9: Final verification, commit, push, and CI check

**Files:**
- All modified files

- [ ] **Step 1: Full verification matrix**

  ```bash
  pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build
  ```

  Expected: lint/typecheck/test/build all green; final test count remains **40 files / 257 tests** (or higher if new tests were added).

- [ ] **Step 2: Audit remaining `OMO`/`OmO` references**

  ```bash
  grep -R "OMO_KIMI_\|OMO_TEAMS_DIR\|OMO_ULW_LOOP_STEER\|OMO_DISABLE_POSTHOG\|OMO_SOURCE_ROOT\|\\bOmO\\b" --include="*.{ts,tsx,mjs,js,json,md}" src/ plugin/ scripts/ tests/ docs/ README.md AGENTS.md package.json .github/ || echo "no legacy references in source"
  ```

  Expected exceptions:
  - `src/shared/env.ts` itself (fallback logic)
  - `vendor/shared-skills/` (upstream copy, not shipped after sync)
  - `docs/superpowers/plans/lazykimicode-plan.md` historical references (acceptable)

- [ ] **Step 3: Review git status**

  ```bash
  git status --short
  ```

  Ensure no unexpected untracked generated artifacts are about to be committed.

- [ ] **Step 4: Commit and push**

  ```bash
  git add -A
  git commit -m "chore: complete LazyKimiCode rebrand with OMO fallbacks

  - LAZYKIMICODE_* env vars are now primary; OMO_KIMI_* / OMO_* remain fallbacks
  - All source env reads route through src/shared/env.ts
  - Rebranded hooks, plugin manifest, package metadata, docs, and skills
  - CI prefers LAZYKIMICODE_POSTHOG_API_KEY with fallback to OMO_KIMI_POSTHOG_API_KEY
  - Removed stale limitation notes"
  git push origin main
  ```

- [ ] **Step 5: Check CI**

  ```bash
  gh run watch
  ```

  Expected: the `Release` workflow (if triggered by a tag) or any open PR checks pass.

---

## Self-review

**1. Spec coverage:**
- Rebrand env vars → Tasks 1, 2, 4
- Rebrand display strings/metadata → Task 3
- Rebrand docs → Task 6
- Rebrand skills → Task 7
- CI/build PostHog secret → Task 5
- Stale limitation notes → Task 8
- Final verification/push → Task 9

**2. Placeholder scan:**
- No TBD/TODO/"implement later" strings.
- Each task contains concrete file paths, commands, and expected outputs.

**3. Type consistency:**
- `getEnv` returns `string | undefined`, matching all existing `process.env` reads.
- `getEnvBool` returns `boolean`, replacing `=== '1'` checks.
- `isTelemetryDisabled` consolidates all disable paths.

---

## Execution Handoff

**Plan complete and saved to `docs/lazykimicode-rebrand-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh coder subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session with checkpoints.
