# lazykimicode Design & Implementation Plan

> **Status:** Audit-remediation Tasks 1–4 are complete. The following gaps remain as of the latest audit:
> - Remote MCP defaults (`grep_app`, `context7`) are not provided.
> - `bootstrap` full verification is pending (bin links, agent profile seeding, `sg` installation, config re-stamping).
> - Release workflow `dist/` inclusion is pending confirmation.
> - PostHog release-key injection is pending confirmation.
> See `docs/audit-report.md` for the full list.
>
> **Verification:** `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` passes (25 test files, 236 tests).

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `lazykimicode`, a Kimi Code CLI distribution of the OmO agent harness that ports LazyCodex's Codex-CLI plugin to Kimi Code CLI. The artifact is a Kimi plugin plus a small Node installer that wires Kimi-native hooks, MCP servers, Skills, and agent orchestration.

**Architecture:** A Kimi plugin (`kimi.plugin.json`) provides Skills, plugin MCP servers, and a `sessionStart` skill. A companion Node installer patches `~/.kimi-code/config.toml` with `[hooks]` entries, installs component binaries, registers MCP strategy, and handles migrations/updates. Codex-specific concepts (`codex_app.*` threads, `multi_agent_v1.spawn_agent`, `.codex-plugin` hooks) are translated into Kimi-native equivalents (`Agent` / `AgentSwarm`, config.toml hooks, Kimi Skills).

**Tech Stack:** TypeScript 5.x, Node.js ESM (>=22), pnpm, `smol-toml` (Kimi already uses it), `zod` for manifest/config validation, `vitest` for unit tests, GitHub Actions for CI.

---

## Global Constraints

- Kimi Code CLI plugin manifest **does not support hooks or custom tools** ([official Plugins doc](https://moonshotai.github.io/kimi-code/zh/customization/plugins.html)); hooks must live in the user's `config.toml` and invoke installer-managed binaries.
- Kimi Code CLI built-in subagent types are limited to `coder`/`explore`/`plan`; custom agent TOMLs are not plugin-extensible, so role instructions are carried inside Skills.
- All plugin paths must resolve inside the plugin root after `realpath`; all installer paths must resolve inside `$KIMI_CODE_HOME` or the project directory.
- Plugin MCP stdio commands must be `./` relative inside the plugin root or bare PATH commands.
- Hook commands in `config.toml` are fail-open: a non-zero exit or timeout does **not** block the tool unless the hook explicitly writes a block decision to stdout and exits `2` (Kimi hook protocol). `lazykimicode` components must therefore always exit `0` for advisory context and exit `2` only when they genuinely want to block.
- The installer must be idempotent: running `npx lazykimicode install` twice produces the same result without duplicating hooks.
- The installer must back up `config.toml` before mutation and provide a `--dry-run` flag.

---

# Part 1 — Design Specification

## 1. Product Positioning

`lazykimicode` is the Kimi Code CLI edition of OmO, analogous to how `lazycodex` is the Codex CLI edition.

| Edition | Host | Identity | Install command |
|---------|------|----------|-----------------|
| Ultimate | OpenCode plugin | `oh-my-openagent` | `bunx oh-my-openagent install` |
| LazyCodex | Codex CLI plugin | `sisyphuslabs/omo` | `npx lazycodex-ai install` |
| **lazykimicode** | **Kimi Code CLI plugin** | **`lazykimicode`** | **`npx lazykimicode install`** |

It brings LazyCodex's engineering discipline (rules injection, comment checking, LSP diagnostics, ultrawork/ulw-loop planning, telemetry, team orchestration) into Kimi Code CLI without requiring a separate Agent runtime.

## 2. Host Capability Mapping: Codex → Kimi Code

LazyCodex relies on four Codex extension mechanisms. The Kimi equivalents are:

| LazyCodex mechanism | Codex artifact | Kimi equivalent | How lazykimicode uses it |
|---------------------|----------------|-----------------|----------------------------|
| Plugin manifest | `.codex-plugin/plugin.json` | `kimi.plugin.json` (or `.kimi-plugin/plugin.json`) | Declares `skills`, `mcpServers`, `sessionStart.skill`, `interface` |
| Hooks | 7 Codex events + 21 `plugin/hooks/*.json` | `config.toml` `[hooks]` array | Installer writes `[hooks]` entries that invoke `plugin/components/<name>/dist/cli.mjs hook <event>` |
| MCP servers | `.mcp.json` (5 servers) | Plugin `mcpServers` + project `.mcp.json` | Declares `codegraph`, `git_bash`, `lsp` as plugin MCPs; remote `grep_app`/`context7` via user/project `.mcp.json` guidance |
| Skills | `plugin/skills/<name>/SKILL.md` | `plugin/skills/<name>/SKILL.md` (same format) | Ported 1:1; Codex tool names replaced with Kimi tool names |
| Subagents / threads | `multi_agent_v1.spawn_agent` + agent TOMLs + `codex_app.*` threads | `Agent` tool (`coder`/`explore`/`plan`) + `AgentSwarm` | Skills instruct Kimi to spawn `coder`/`explore`/`plan` subagents with role prompts; team mode uses `AgentSwarm` |

### 2.1 Hook event mapping

| Codex event | Kimi `config.toml` hook event | Notes |
|-------------|-------------------------------|-------|
| `SessionStart` | `SessionStart` | Runs on every new/resumed session |
| `UserPromptSubmit` | `UserPromptSubmit` | Can mutate context via stdout JSON |
| `PreToolUse` | `PreToolUse` | Can block or advise on tool call |
| `PostToolUse` | `PostToolUse` | Inspects tool result |
| `PostCompact` | `PostCompact` | Resets caches after compaction |
| `Stop` | `Stop` | Can prevent session stop |
| `SubagentStop` | `SubagentStop` | Can prevent subagent stop |

Kimi also supports `PostToolUseFailure`, `PermissionRequest`, `PermissionResult`, `SessionEnd`, `SubagentStart`, `StopFailure`, `Interrupt`, `PreCompact`, `Notification`; lazykimicode does not need them for parity.

### 2.2 Tool name mapping

| Codex tool / API | Kimi tool / API | Usage in lazykimicode |
|------------------|-----------------|-------------------------|
| `apply_patch` / `write` / `edit` | `Write` / `Edit` | Hook matchers use `^(Write|Edit)$` |
| `multi_agent_v1.spawn_agent` | `Agent` | Skills instruct `Agent(prompt=..., subagent_type=coder/explore/plan)` |
| `codex_app.create_thread` | N/A (no threads) | Team mode replaced by `AgentSwarm` |
| `codex_app.send_message_to_thread` | N/A | Replaced by `Agent` or `AgentSwarm` |
| `create_goal` | `CreateGoal` | `ulw-loop` PreToolUse matcher: `^CreateGoal$` |
| `Bash` | `Bash` | Git-bash recommendation hook |

## 3. Component Architecture

Each LazyCodex component becomes a Kimi-compatible Node ESM CLI under `src/components/<name>/`. At build time it is bundled to `plugin/components/<name>/dist/cli.mjs`. The installer writes one `config.toml` hook entry per component-event pair.

The stdout protocol is a single line of JSON, identical to LazyCodex's component protocol:

```jsonc
// Inject context
{ "hookSpecificOutput": { "hookEventName": "UserPromptSubmit", "additionalContext": "..." } }

// Block a tool
{ "decision": "block", "reason": "..." }

// Block with context
{ "decision": "block", "reason": "...", "hookSpecificOutput": { "hookEventName": "PreToolUse", "additionalContext": "..." } }

// PreToolUse deny (ulw-loop)
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "...", "additionalContext": "..." } }
```

### 3.1 Component list

| Component | Kimi hook events | Responsibility |
|-----------|------------------|----------------|
| `bootstrap` | `SessionStart` | Version-change bootstrap: bin links, agent profile cache, `sg` binary, config re-stamping |
| `rules` | `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `PostCompact` | Inject static/dynamic project rules (`.omo/rules/`, `AGENTS.md`) |
| `comment-checker` | `PostToolUse` | After `Write`/`Edit`, check for stale TODO/FIXME comments |
| `lsp` | `PostToolUse`, `PostCompact` | Run LSP diagnostics on edited files; clear cache on compact. Exposes MCP tools `lsp_status`, `lsp_diagnostics`, `lsp_goto_definition`, `lsp_find_references`, `lsp_symbols`, `lsp_prepare_rename`, `lsp_rename` via the persistent `lsp-daemon` binary (plus a stateless `lsp-tools-mcp` fallback) |
| `codegraph` | `SessionStart`, `PostToolUse` | Bootstrap CodeGraph; guide when CodeGraph tools fail. Exposes `codegraph_search`, `codegraph_relate`, `codegraph_reindex`, `codegraph_status`, `codegraph_explore`, `codegraph_files`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact` |
| `ultrawork` | `UserPromptSubmit` | Detect `ultrawork`/`ulw` keywords and inject ultrawork prompt |
| `ulw-loop` | `UserPromptSubmit`, `PreToolUse` | Parse `OMO_ULW_LOOP_STEER:` steering; deny budgeted `CreateGoal` |
| `telemetry` | `SessionStart` | Daily active telemetry (opt-out) |
| `git-bash` | `PreToolUse`, `PostCompact` | Windows: recommend `git_bash` MCP over `Bash` |
| `start-work-continuation` | `Stop`, `SubagentStop` | Prevent stop when Boulder/start-work plan is incomplete |
| `executor-verify` | `SubagentStop` | Prevent `lazycodex-executor`-like subagent stop without evidence |
| `teammode` | N/A (skill-driven) | Kimi-native team orchestration using `AgentSwarm`. State script supports `init`, `add-member`, `member-prompt`, `set-status`, `worktree-add`, `worktree-remove`, `integrate`, `archive`, `delete`, `status` |

### 3.2 Hook aggregation

The installer generates `~/.kimi-code/config.toml` entries from `plugin/hooks/*.json` (one file per hook). A build script `scripts/sync-hooks.mjs` assembles them from component templates (`src/components/<name>/hooks.json`) and embeds the current version in `statusMessage`.

Example generated hook entry in `config.toml`:

```toml
[[hooks]]
event = "PostToolUse"
matcher = "^(Write|Edit)$"
command = "node \"$KIMI_CODE_HOME/plugins/managed/lazykimicode/<version>/components/comment-checker/dist/cli.mjs\" hook post-tool-use"
timeout = 30
```

## 4. Plugin Manifest

`kimi.plugin.json` (repo root or `plugin/` after build):

```json
{
  "name": "lazykimicode",
  "version": "<VERSION>",
  "description": "OmO agent harness for Kimi Code CLI",
  "keywords": ["omo", "agent-harness", "lsp", "rules", "ultrawork"],
  "skills": "./skills",
  "sessionStart": {
    "skill": "rules"
  },
  "skillInstructions": "You are running with lazykimicode (OmO for Kimi Code). Prefer the lazykimicode MCP tools for structural search (codegraph), LSP, and Git Bash on Windows. Respect project rules from .omo/rules/ and AGENTS.md.",
  "mcpServers": {
    "codegraph": {
      "command": "node",
      "args": ["./components/codegraph/dist/serve.mjs"],
      "cwd": "./"
    },
    "lsp": {
      "command": "node",
      "args": ["./components/lsp/dist/daemon.mjs"],
      "cwd": "./"
    }
  },
  "interface": {
    "displayName": "Oh My KimiCode",
    "shortDescription": "OmO agent harness for Kimi Code CLI",
    "developerName": "Sisyphus Labs"
  }
}
```

Notes:
- `grep_app` and `context7` are remote MCPs. They are **not** declared in the plugin manifest because they require API keys. The installer writes placeholder blocks into the user `config.toml` or project `.mcp.json` with instructions, similar to LazyCodex's Context7 placeholder guard.
- `git_bash` MCP is enabled only on Windows via the installer's config patching.
- The `lsp` MCP uses the persistent `lsp-daemon` binary. The separate `lsp-tools-mcp` binary is a stateless per-request MCP server used as a fallback / tooling entry.

## 5. Skills

Skills live in `plugin/skills/<name>/SKILL.md`. They use the same frontmatter format as Kimi Skills (`name`, `description`, `type`, `whenToUse`, `arguments`).

### 5.1 Ported skills

From LazyCodex's 25 skills, the following are ported directly:

- `init-deep`
- `ultrawork`
- `ulw-plan`
- `ulw-loop`
- `teammode`
- `ast-grep`
- `coding-agent-sessions`
- `debugging`
- `frontend`
- `git-master`
- `lcx-contribute-bug-fix`
- `lcx-doctor`
- `lcx-report-bug`
- `lsp-setup`
- `programming`
- `refactor`
- `remove-ai-slops`
- `review-work`
- `start-work`
- `ultimate-browsing`
- `ulw-research`
- `visual-qa`

### 5.2 Skill adaptations for Kimi

Each skill gets a `## Kimi Code Harness Compatibility` section replacing LazyCodex's `## Codex Harness Tool Compatibility`:

- `multi_agent_v1.spawn_agent` → `Agent(prompt=..., subagent_type="coder"|"explore"|"plan")`
- `multi_agent_v1.wait_agent` → `Agent` runs to completion and returns its final message in the same turn
- `codex_app.create_thread` / `send_message_to_thread` / `read_thread` → `AgentSwarm` with a prompt template containing `{{item}}`, or sequential `Agent` calls
- `apply_patch` → `Edit` / `Write`
- `codex_app.set_thread_title` → removed (Kimi has no thread title concept)

### 5.3 Skill aggregation

`scripts/sync-skills.mjs` copies:
1. Component-local skills from `src/components/<name>/skills/<name>/SKILL.md`
2. Shared skills from a vendored copy of `@oh-my-opencode/shared-skills`
3. Inserts the Kimi harness compatibility paragraph
4. Generates `plugin/skills/<name>/SKILL.md`

## 6. Installer Design

The installer is the moral equivalent of `packages/omo-codex/src/install/install-codex.ts`. It is built into `scripts/install-local.mjs`.

### 6.1 Environment

- `kimiCodeHome`: `options.kimiCodeHome` → `env.KIMI_CODE_HOME` → `~/.kimi-code`
- `projectDirectory`: `options.projectDirectory` → `env.OMO_KIMI_PROJECT` → `process.cwd()`
- `binDir`: `options.binDir` → `env.KIMI_LOCAL_BIN_DIR` → `~/.local/bin` if default home, else `<kimiCodeHome>/bin`

### 6.2 Install flow

1. Parse args (`--no-tui`, `--kimi-autonomous`, `--dry-run`, `--codex-home`, etc.).
2. Detect Kimi Code CLI installation (`kimi --version`).
3. Prepare plugin cache directory `<kimiCodeHome>/plugins/cache/lazykimicode/<version>/`.
4. Copy plugin assets (`plugin/`) into cache.
5. Install bundled MCP/runtime binaries (`git-bash-mcp`, `lsp-tools-mcp`, `lsp-daemon`, `codegraph-server`) into cache.
6. Link component CLIs into `binDir` (idempotent, removes dangling managed bins).
7. Install `sg` (ast-grep) binary for the `ast-grep` skill.
8. Copy agent profile prompts into `<kimiCodeHome>/.omo/kimi-agents/` (used as reference by skills, not as native Kimi profiles).
9. Patch `~/.kimi-code/config.toml`:
   - Enable plugin via `plugins = ["lazykimicode"]` (Kimi does not have a plugin list in config.toml; this is for documentation; actual enable is via `/plugins enable`).
   - Write `[[hooks]]` entries for each component-event.
   - Register MCP strategy / placeholders for `grep_app`/`context7`.
   - Set model aliases if desired (`[models.omo-ultrabrain]` etc.).
   - Preserve user custom values (capture and restore).
10. Seed `~/.omo/config.jsonc` with Kimi-specific env vars.
11. Run first bootstrap in foreground or background depending on flags.
12. Record install telemetry (opt-out).

### 6.3 Config patcher

`src/install/config-patcher.ts` uses `smol-toml` to parse `config.toml` to an AST-like object, mutate, and serialize back while preserving comments. It must:
- Avoid duplicate hook entries (match by `event` + `matcher` + normalized `command`).
- Back up the original to `config.toml.bak.<timestamp>`.
- Support `--dry-run` that prints diffs instead of writing.
- Track migration state in `~/.local/share/lazykimicode/config-migration-state.json`.

### 6.4 Autonomous mode

`--kimi-autonomous` sets:
- `default_permission_mode = "auto"` (or `"yolo"` if user asks)
- Enables `features` that Kimi supports (Kimi does not have a `features` table; this is a no-op or mapped to `loop_control` / `background`).

## 7. Configuration & Usage

### 7.1 Installation

```bash
# One-line install (recommended)
npx lazykimicode install

# Autonomous mode
npx lazykimicode install --no-tui --kimi-autonomous

# From local source
node scripts/install-local.mjs install

# Dry run
npx lazykimicode install --dry-run
```

### 7.2 Marketplace install (optional)

```bash
/plugins install https://github.com/<org>/lazykimicode/releases/download/v0.1.0/lazykimicode.zip
/plugins enable lazykimicode
/new
```

Then manually run `npx lazykimicode install --hooks-only` to wire config.toml hooks (plugin manifest cannot declare hooks).

### 7.3 Using skills

Inside Kimi Code CLI:

```text
/skill:lazykimicode:ultrawork implement OAuth login for this project
/skill:lazykimicode:init-deep
/skill:lazykimicode:ulw-plan "add OAuth login"
```

If a skill name is unique, `/skill:<name>` also works.

### 7.4 Using ultrawork

Just type `ultrawork` or `ulw` in the prompt; the `ultrawork` UserPromptSubmit hook injects the ultrawork prompt.

### 7.5 Disabling telemetry

```bash
export OMO_KIMI_DISABLE_POSTHOG=1
```

### 7.6 Uninstall

```bash
npx lazykimicode uninstall
```

Removes managed plugin cache, hook entries from `config.toml`, bin links, and agent profile cache. Optionally preserves user rules.

## 8. Validation Strategy

### 8.1 Unit tests

Current suite covers:

- `tests/unit/install/config-patcher.test.ts` — idempotency, backup, dry-run, hook deduplication
- `tests/unit/install/bin-links.test.ts` — managed binary linking/unlinking
- `tests/unit/install/doctor.test.ts` — health checks
- `tests/unit/shared/*.test.ts` — paths, serialization
- `tests/unit/components/bootstrap.test.ts`
- `tests/unit/components/comment-checker.test.ts` — detect TODO/FIXME in fake tool output
- `tests/unit/components/codegraph.test.ts` — indexing, search, relate, explore, callers, callees, impact
- `tests/unit/components/executor-verify.test.ts`
- `tests/unit/components/git-bash.test.ts`
- `tests/unit/components/lsp.test.ts` — diagnostics caching
- `tests/unit/components/lsp-client.test.ts` — LSP client methods including `documentSymbol`
- `tests/unit/components/rules.test.ts` — rule discovery and injection
- `tests/unit/components/start-work-continuation.test.ts`
- `tests/unit/components/teammode.test.ts` — all 10 team subcommands and worktree management
- `tests/unit/components/telemetry.test.ts` — daily-active guard and PostHog capture semantics
- `tests/unit/components/ultrawork.test.ts`
- `tests/unit/components/ulw-loop.test.ts`
- `tests/unit/skills/create-pr-body.test.ts` — PR body generator
- `tests/unit/skills/sync.test.ts` — skill aggregation

### 8.2 Integration tests

- `tests/integration/install.test.ts` — run installer with `KIMI_CODE_HOME=<temp>`, assert plugin cache exists, hooks written, no duplicate hooks on second run.
- `tests/integration/hooks.test.ts` — pipe synthetic Kimi hook payloads to component CLIs and assert JSON stdout.

**Latest result:** 25 test files, 236 tests passing.

### 8.3 Manual validation checklist

1. `npx lazykimicode install --dry-run` prints expected diff.
2. `npx lazykimicode install` succeeds; `~/.kimi-code/config.toml` has new `[[hooks]]` entries.
3. Start Kimi in a project: `/plugins info lazykimicode` shows the plugin and MCP servers.
4. Type `ulw add a README`; verify hook status message appears.
5. Edit a file leaving a `TODO` comment; verify `comment-checker` injects a warning.
6. Run `/skill:lazykimicode:init-deep` and verify `.omo/` rules/AGENTS.md are produced.
7. Run `npx lazykimicode doctor`; verify health report.

### 8.4 CI

GitHub Actions matrix: ubuntu, macOS, Windows. Steps:
1. `pnpm install`
2. `pnpm run lint`
3. `pnpm run typecheck`
4. `pnpm test`
5. `pnpm run build`
6. `node scripts/install-local.mjs install --kimi-code-home ./tmp-home` (integration smoke)

---

# Part 2 — Implementation Plan

## Approach (Recommended): Plugin + Installer

A Kimi plugin provides the portable, install-once assets (Skills, MCPs, session-start prompt). A small Node installer edits `config.toml` and links binaries. This is the only way to replicate LazyCodex's hook-based enforcement on Kimi Code CLI today.

### Alternative: Plugin-Only Skill Pack

Ship only the Kimi plugin. All enforcement becomes explicit skill invocation. This is simpler to distribute but loses automatic comment checking, LSP diagnostics, and stop-continuation guards. If the user prefers this, drop the installer and all `config.toml` hook tasks; keep only Skills and MCPs.

---

## Task 0: Persist This Plan in the Project

**Files:**
- Create: `docs/lazykimicode-plan.md`

**Interfaces:**
- Produces: project-local copy of the approved design & implementation plan

- [ ] **Step 1: Copy approved plan into project docs**

After plan approval, copy the session plan file to:

```bash
cp /Users/ronan/.kimi-code/sessions/wd_lazykimicode_644da876b5c7/session_2ab245d8-b211-46f8-81b4-ada0ba03c2c1/agents/main/plans/namor-pantha-white-tiger.md /Users/ronan/Documents/projects/lazykimicode/docs/lazykimicode-plan.md
```

- [ ] **Step 2: Commit**

```bash
git add docs/lazykimicode-plan.md
git commit -m "docs: add lazykimicode design and implementation plan"
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `vitest.config.ts`
- Create: `eslint.config.mjs`

**Interfaces:**
- Produces: package name `@lazykimicode/lazykimicode`, bin `lazykimicode`

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "@lazykimicode/lazykimicode",
  "version": "0.1.0",
  "description": "OmO agent harness for Kimi Code CLI",
  "type": "module",
  "bin": {
    "lazykimicode": "./bin/lazykimicode.mjs"
  },
  "files": [
    "dist/",
    "plugin/",
    "scripts/",
    "bin/"
  ],
  "scripts": {
    "build": "node scripts/build.mjs",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/ scripts/ tests/",
    "test": "vitest run",
    "sync:skills": "node scripts/sync-skills.mjs",
    "sync:hooks": "node scripts/sync-hooks.mjs"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "eslint": "^9.0.0",
    "smol-toml": "^1.3.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "zod": "^3.23.0"
  },
  "dependencies": {
    "smol-toml": "^1.3.0",
    "zod": "^3.23.0"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist", "plugin"]
}
```

- [ ] **Step 3: Write `.gitignore`**

```gitignore
node_modules/
dist/
plugin/components/*/dist/
plugin/skills/
*.log
.DS_Store
.tmp/
coverage/
```

- [ ] **Step 4: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Install dependencies**

Run: `pnpm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json pnpm-workspace.yaml .gitignore vitest.config.ts eslint.config.mjs
git commit -m "chore: project scaffolding"
```

---

## Task 2: Shared Utilities

**Files:**
- Create: `src/shared/paths.ts`
- Create: `src/shared/types.ts`
- Create: `src/shared/serialize.ts`
- Create: `src/shared/telemetry.ts`
- Create: `tests/unit/shared/paths.test.ts`

**Interfaces:**
- Produces: `KimiEnv`, `HookPayload`, `HookOutput`, `getKimiCodeHome()`, `serializeHookOutput()`

- [ ] **Step 1: Write `src/shared/types.ts`**

```typescript
export interface KimiEnv {
  kimiCodeHome: string;
  projectDirectory: string;
  binDir: string;
  version: string;
}

export interface HookPayload {
  hookEventName: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  prompt?: string;
  sessionId?: string;
  subagentType?: string;
  stopHookActive?: boolean;
  [key: string]: unknown;
}

export type HookDecision = 'block' | 'allow';

export interface HookOutput {
  hookSpecificOutput?: {
    hookEventName: string;
    additionalContext?: string;
    permissionDecision?: 'deny' | 'allow';
    permissionDecisionReason?: string;
  };
  decision?: HookDecision;
  reason?: string;
}
```

- [ ] **Step 2: Write `src/shared/paths.ts`**

```typescript
import path from 'node:path';
import os from 'node:os';

export interface PathOptions {
  kimiCodeHome?: string;
  projectDirectory?: string;
  binDir?: string;
}

export function resolveKimiEnv(options: PathOptions = {}): {
  kimiCodeHome: string;
  projectDirectory: string;
  binDir: string;
} {
  const kimiCodeHome = options.kimiCodeHome
    ?? process.env.KIMI_CODE_HOME
    ?? path.join(os.homedir(), '.kimi-code');

  const projectDirectory = options.projectDirectory
    ?? process.env.OMO_KIMI_PROJECT
    ?? process.cwd();

  const defaultHome = path.join(os.homedir(), '.kimi-code');
  const binDir = options.binDir
    ?? process.env.KIMI_LOCAL_BIN_DIR
    ?? (kimiCodeHome === defaultHome ? path.join(os.homedir(), '.local', 'bin') : path.join(kimiCodeHome, 'bin'));

  return { kimiCodeHome, projectDirectory, binDir };
}

export function pluginCacheDir(kimiCodeHome: string, version: string): string {
  return path.join(kimiCodeHome, 'plugins', 'cache', 'lazykimicode', version);
}

export function omoConfigDir(): string {
  return path.join(os.homedir(), '.omo');
}
```

- [ ] **Step 3: Write `src/shared/serialize.ts`**

```typescript
import type { HookOutput } from './types.js';

export function serializeHookOutput(output: HookOutput): string {
  return JSON.stringify(output);
}

export function writeHookOutput(output: HookOutput): void {
  process.stdout.write(serializeHookOutput(output) + '\n');
}
```

- [ ] **Step 4: Write unit tests for paths**

```typescript
import { describe, it, expect } from 'vitest';
import { resolveKimiEnv, pluginCacheDir } from '../../../src/shared/paths.js';

describe('paths', () => {
  it('respects KIMI_CODE_HOME', () => {
    const env = resolveKimiEnv({ kimiCodeHome: '/tmp/kimi' });
    expect(env.kimiCodeHome).toBe('/tmp/kimi');
    expect(env.binDir).toBe('/tmp/kimi/bin');
  });

  it('computes default cache dir', () => {
    expect(pluginCacheDir('/tmp/kimi', '0.1.0')).toBe('/tmp/kimi/plugins/cache/lazykimicode/0.1.0');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/unit/shared/paths.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared tests/unit/shared
git commit -m "feat(shared): env, paths, types, and hook serialization"
```

---

## Task 3: Config Patcher

**Files:**
- Create: `src/install/config-patcher.ts`
- Create: `src/install/hook-defs.ts`
- Create: `tests/unit/install/config-patcher.test.ts`

**Interfaces:**
- Consumes: `KimiEnv`, hook definitions
- Produces: `patchConfigToml(env, hooks, dryRun)` function

- [ ] **Step 1: Write `src/install/hook-defs.ts`**

```typescript
export interface HookDef {
  event: string;
  matcher: string;
  command: string;
  timeout: number;
}

export function getHookDefs(version: string, pluginCache: string): HookDef[] {
  const cli = (name: string) => `node "${pluginCache}/components/${name}/dist/cli.mjs" hook`;
  return [
    { event: 'SessionStart', matcher: '^startup$', command: `${cli('bootstrap')} session-start`, timeout: 60 },
    { event: 'SessionStart', matcher: '.*', command: `${cli('rules')} session-start`, timeout: 30 },
    { event: 'SessionStart', matcher: '.*', command: `${cli('telemetry')} session-start`, timeout: 10 },
    { event: 'UserPromptSubmit', matcher: '.*', command: `${cli('rules')} user-prompt-submit`, timeout: 30 },
    { event: 'UserPromptSubmit', matcher: '.*', command: `${cli('ultrawork')} user-prompt-submit`, timeout: 10 },
    { event: 'UserPromptSubmit', matcher: '.*', command: `${cli('ulw-loop')} user-prompt-submit`, timeout: 10 },
    { event: 'PreToolUse', matcher: '^Bash$', command: `${cli('git-bash')} pre-tool-use`, timeout: 10 },
    { event: 'PreToolUse', matcher: '^CreateGoal$', command: `${cli('ulw-loop')} pre-tool-use`, timeout: 10 },
    { event: 'PostToolUse', matcher: '^(Write|Edit)$', command: `${cli('comment-checker')} post-tool-use`, timeout: 30 },
    { event: 'PostToolUse', matcher: '^(Write|Edit)$', command: `${cli('lsp')} post-tool-use`, timeout: 60 },
    { event: 'PostToolUse', matcher: '^(Write|Edit)$', command: `${cli('rules')} post-tool-use`, timeout: 30 },
    { event: 'PostCompact', matcher: '.*', command: `${cli('rules')} post-compact`, timeout: 10 },
    { event: 'PostCompact', matcher: '.*', command: `${cli('lsp')} post-compact`, timeout: 10 },
    { event: 'Stop', matcher: '.*', command: `${cli('start-work-continuation')} stop`, timeout: 10 },
    { event: 'SubagentStop', matcher: '.*', command: `${cli('start-work-continuation')} subagent-stop`, timeout: 10 },
    { event: 'SubagentStop', matcher: '^coder$', command: `${cli('executor-verify')} subagent-stop`, timeout: 10 },
  ];
}
```

- [ ] **Step 2: Write `src/install/config-patcher.ts`**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import * as toml from 'smol-toml';
import type { HookDef } from './hook-defs.js';

export interface PatchResult {
  backupPath?: string;
  wrote: boolean;
  diff: string;
}

function normalizeCommand(cmd: string): string {
  return cmd.replace(/\\"/g, '"').trim();
}

function hookKey(h: HookDef): string {
  return `${h.event}|${h.matcher}|${normalizeCommand(h.command)}`;
}

export function patchConfigToml(
  configPath: string,
  hooks: HookDef[],
  dryRun = false,
): PatchResult {
  const raw = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '';
  const parsed = raw ? (toml.parse(raw) as Record<string, unknown>) : {};
  const existingHooks = (parsed.hooks ?? []) as Array<Record<string, unknown>>;
  const existingKeys = new Set(existingHooks.map((h) => `${h.event}|${h.matcher}|${normalizeCommand(String(h.command))}`));

  const toAdd = hooks.filter((h) => !existingKeys.has(hookKey(h)));
  if (toAdd.length === 0) {
    return { wrote: false, diff: 'No changes needed' };
  }

  const diff = toAdd.map((h) => `+ [[hooks]] event=${h.event} matcher=${h.matcher}`).join('\n');

  if (dryRun) {
    return { wrote: false, diff };
  }

  const backupPath = `${configPath}.bak.${Date.now()}`;
  if (raw) fs.copyFileSync(configPath, backupPath);

  const newHooks = [...existingHooks, ...toAdd.map((h) => ({ event: h.event, matcher: h.matcher, command: h.command, timeout: h.timeout }))];
  parsed.hooks = newHooks;

  fs.writeFileSync(configPath, toml.stringify(parsed as toml.TomlPrimitive), 'utf-8');
  return { backupPath, wrote: true, diff };
}
```

- [ ] **Step 3: Write tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { patchConfigToml } from '../../../src/install/config-patcher.js';
import { getHookDefs } from '../../../src/install/hook-defs.js';

describe('patchConfigToml', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('adds hooks idempotently', () => {
    const configPath = path.join(tmpDir, 'config.toml');
    const hooks = getHookDefs('0.1.0', '/tmp/cache');
    const r1 = patchConfigToml(configPath, hooks);
    expect(r1.wrote).toBe(true);
    const r2 = patchConfigToml(configPath, hooks);
    expect(r2.wrote).toBe(false);
  });

  it('backs up existing config', () => {
    const configPath = path.join(tmpDir, 'config.toml');
    fs.writeFileSync(configPath, 'default_model = "kimi"\n');
    const hooks = getHookDefs('0.1.0', '/tmp/cache');
    const r = patchConfigToml(configPath, hooks);
    expect(r.backupPath).toBeDefined();
    expect(fs.existsSync(r.backupPath!)).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/unit/install/config-patcher.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/install tests/unit/install
git commit -m "feat(install): config.toml patcher with idempotency and backup"
```

---

## Task 4: Bootstrap Component

**Files:**
- Create: `src/components/bootstrap/cli.ts`
- Create: `src/components/bootstrap/session-start.ts`
- Create: `src/components/bootstrap/hooks.json`
- Create: `tests/unit/components/bootstrap.test.ts`

**Interfaces:**
- Consumes: `HookPayload`, `KimiEnv`
- Produces: `bootstrap` binary, hook output

- [ ] **Step 1: Write `src/components/bootstrap/session-start.ts`**

```typescript
import type { HookPayload, HookOutput } from '../../shared/types.js';
import { VERSION } from '../../shared/version.js';

export function runSessionStart(payload: HookPayload): HookOutput {
  const version = process.env.OMO_KIMI_VERSION ?? VERSION;
  const cacheDir = process.env.OMO_KIMI_PLUGIN_CACHE ?? '';

  // Perform idempotent bin links, agent cache seeding, and sg provisioning.
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `(OmO ${version}) Bootstrap provisioning complete`,
    },
  };
}
```

- [ ] **Step 2: Write `src/components/bootstrap/cli.ts`**

```typescript
import { runSessionStart } from './session-start.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  const event = process.argv[3];
  if (event !== 'session-start') {
    writeHookOutput({ hookSpecificOutput: { hookEventName: event ?? '', additionalContext: '' } });
    return;
  }
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  const payload = raw ? JSON.parse(raw) : {};
  writeHookOutput(runSessionStart(payload));
}

main().catch((e) => {
  console.error(e);
  process.exit(0); // fail-open
});
```

- [ ] **Step 3: Write `src/components/bootstrap/hooks.json`**

```json
[
  {
    "event": "SessionStart",
    "matcher": "^startup$",
    "timeout": 60,
    "statusMessage": "(OmO) Bootstrap provisioning"
  }
]
```

- [ ] **Step 4: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { runSessionStart } from '../../../src/components/bootstrap/session-start.js';

describe('bootstrap', () => {
  it('returns session-start context', () => {
    const out = runSessionStart({ hookEventName: 'SessionStart' });
    expect(out.hookSpecificOutput?.hookEventName).toBe('SessionStart');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/unit/components/bootstrap.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/bootstrap tests/unit/components/bootstrap.test.ts
git commit -m "feat(components): bootstrap session-start hook"
```

---

## Task 5: Rules Component

**Files:**
- Create: `src/components/rules/cli.ts`
- Create: `src/components/rules/discover.ts`
- Create: `src/components/rules/session-start.ts`
- Create: `src/components/rules/user-prompt-submit.ts`
- Create: `src/components/rules/post-tool-use.ts`
- Create: `src/components/rules/post-compact.ts`
- Create: `src/components/rules/hooks.json`
- Create: `tests/unit/components/rules.test.ts`

**Interfaces:**
- Consumes: project directory, `.omo/rules/`, `AGENTS.md`
- Produces: `additionalContext` string with rules

- [ ] **Step 1: Implement rule discovery**

```typescript
import fs from 'node:fs';
import path from 'node:path';

export interface DiscoveredRules {
  agentsMd?: string;
  ruleFiles: Array<{ path: string; content: string }>;
}

export function discoverRules(projectDir: string): DiscoveredRules {
  const ruleFiles: Array<{ path: string; content: string }> = [];
  const rulesDir = path.join(projectDir, '.omo', 'rules');
  if (fs.existsSync(rulesDir)) {
    for (const entry of fs.readdirSync(rulesDir)) {
      const full = path.join(rulesDir, entry);
      if (fs.statSync(full).isFile() && entry.endsWith('.md')) {
        ruleFiles.push({ path: full, content: fs.readFileSync(full, 'utf-8') });
      }
    }
  }
  const agentsMdPath = path.join(projectDir, 'AGENTS.md');
  const agentsMd = fs.existsSync(agentsMdPath) ? fs.readFileSync(agentsMdPath, 'utf-8') : undefined;
  return { agentsMd, ruleFiles };
}

export function formatRulesContext(rules: DiscoveredRules): string {
  const parts: string[] = [];
  if (rules.agentsMd) parts.push(`# AGENTS.md\n${rules.agentsMd}`);
  for (const f of rules.ruleFiles) parts.push(`# ${f.path}\n${f.content}`);
  return parts.join('\n\n');
}
```

- [ ] **Step 2: Implement CLI router**

```typescript
import { discoverRules, formatRulesContext } from './discover.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  const event = process.argv[3];
  const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();
  const rules = discoverRules(projectDir);
  const additionalContext = formatRulesContext(rules);
  writeHookOutput({
    hookSpecificOutput: {
      hookEventName: event === 'post-tool-use' ? 'PostToolUse' : event === 'post-compact' ? 'PostCompact' : 'SessionStart',
      additionalContext: additionalContext || 'No project rules found',
    },
  });
}

main().catch((e) => { console.error(e); process.exit(0); });
```

- [ ] **Step 3: Write tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverRules, formatRulesContext } from '../../../src/components/rules/discover.js';

describe('rules', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('discovers AGENTS.md and .omo/rules', () => {
    fs.mkdirSync(path.join(tmp, '.omo', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'AGENTS.md'), '# Rules\nUse TypeScript.');
    fs.writeFileSync(path.join(tmp, '.omo', 'rules', 'api.md'), '# API\nUse REST.');
    const rules = discoverRules(tmp);
    expect(rules.agentsMd).toContain('TypeScript');
    expect(rules.ruleFiles).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run tests and commit**

Run: `pnpm test tests/unit/components/rules.test.ts`
Expected: PASS

Commit:
```bash
git add src/components/rules tests/unit/components/rules.test.ts
git commit -m "feat(components): rules discovery and injection"
```

---

## Task 6: Comment Checker Component

**Files:**
- Create: `src/components/comment-checker/cli.ts`
- Create: `src/components/comment-checker/check.ts`
- Create: `src/components/comment-checker/hooks.json`
- Create: `tests/unit/components/comment-checker.test.ts`

**Interfaces:**
- Consumes: `PostToolUse` payload with `toolInput.path`
- Produces: block decision if TODO/FIXME comments are found

- [ ] **Step 1: Implement checker**

```typescript
import fs from 'node:fs';

const COMMENT_PATTERN = /\/\/.*\b(TODO|FIXME|HACK|XXX|BUG)\b|\/\*[\s\S]*?\b(TODO|FIXME|HACK|XXX|BUG)\b[\s\S]*?\*\//gi;

export function checkFile(path: string): { hasIssue: boolean; matches: string[] } {
  const content = fs.readFileSync(path, 'utf-8');
  const matches = content.match(COMMENT_PATTERN) ?? [];
  return { hasIssue: matches.length > 0, matches };
}
```

- [ ] **Step 2: Implement CLI**

```typescript
import { checkFile } from './check.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  const payload = raw ? JSON.parse(raw) : {};
  const path = payload.toolInput?.path ?? payload.toolInput?.file_path;
  if (!path || typeof path !== 'string') {
    writeHookOutput({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: '' } });
    return;
  }
  const result = checkFile(path);
  if (result.hasIssue) {
    writeHookOutput({
      decision: 'block',
      reason: `Found unresolved markers: ${result.matches.slice(0, 3).join(', ')}`,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `Please resolve TODO/FIXME comments in ${path} before proceeding.`,
      },
    });
  } else {
    writeHookOutput({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: '' } });
  }
}

main().catch((e) => { console.error(e); process.exit(0); });
```

- [ ] **Step 3: Tests and commit**

Test file and run as above.

Commit:
```bash
git add src/components/comment-checker tests/unit/components/comment-checker.test.ts
-git commit -m "feat(components): comment-checker post-tool-use hook"
```

---

## Task 7: LSP Component + MCP

**Files:**
- Create: `src/components/lsp/cli.ts`
- Create: `src/components/lsp/diagnostics.ts`
- Create: `src/components/lsp/hooks.json`
- Create: `src/components/lsp/mcp-server.ts`
- Create: `tests/unit/components/lsp.test.ts`

**Interfaces:**
- Consumes: edited file paths
- Produces: diagnostics summary context; exposes MCP tools `lsp_status`, `lsp_diagnostics`, `lsp_goto_definition`, etc.

- [ ] **Step 1: Implement diagnostics client**

```typescript
import fs from 'node:fs';
import path from 'node:path';

export interface Diagnostic {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

const CACHE_FILE = '.omo/lsp-cache.json';

export function readCache(projectDir: string): string[] {
  const p = path.join(projectDir, CACHE_FILE);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) as string[] : [];
}

export function writeCache(projectDir: string, files: string[]): void {
  const p = path.join(projectDir, CACHE_FILE);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(files));
}

export async function runDiagnostics(file: string): Promise<Diagnostic[]> {
  // Placeholder: real implementation shells out to lsp-tools-mcp / lsp-daemon
  return [];
}
```

- [ ] **Step 2: Implement CLI**

```typescript
import { readCache, writeCache, runDiagnostics } from './diagnostics.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  const event = process.argv[3];
  const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();
  if (event === 'post-compact') {
    writeCache(projectDir, []);
    writeHookOutput({ hookSpecificOutput: { hookEventName: 'PostCompact', additionalContext: '' } });
    return;
  }
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const payload = raw ? JSON.parse(raw) : {};
  const path = payload.toolInput?.path ?? payload.toolInput?.file_path;
  const files = path ? [path] : [];
  const cached = new Set(readCache(projectDir));
  for (const f of files) cached.add(f);
  writeCache(projectDir, [...cached]);

  const all: string[] = [];
  for (const f of files) {
    const diagnostics = await runDiagnostics(f);
    if (diagnostics.length) all.push(...diagnostics.map((d) => `${d.file}:${d.line}: ${d.severity}: ${d.message}`));
  }

  writeHookOutput({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: all.length ? `LSP diagnostics:\n${all.join('\n')}` : '',
    },
  });
}

main().catch((e) => { console.error(e); process.exit(0); });
```

- [ ] **Step 3: Commit**

```bash
git add src/components/lsp tests/unit/components/lsp.test.ts
-git commit -m "feat(components): LSP diagnostics hook and MCP skeleton"
```

---

## Task 8: CodeGraph Component + MCP

**Files:**
- Create: `src/components/codegraph/cli.ts`
- Create: `src/components/codegraph/bootstrap.ts`
- Create: `src/components/codegraph/serve.mjs` (MCP server entry)
- Create: `src/components/codegraph/hooks.json`
- Create: `tests/unit/components/codegraph.test.ts`

**Interfaces:**
- Consumes: `SessionStart`, `PostToolUse` of codegraph MCP
- Produces: bootstrap guidance; MCP tools `codegraph_search`, `codegraph_relate`, etc.

- [ ] **Step 1: Implement bootstrap**

```typescript
import type { HookOutput } from '../../shared/types.js';

export function runBootstrap(): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: 'CodeGraph initialized in background. Use codegraph MCP tools for structural queries.',
    },
  };
}
```

- [ ] **Step 2: Implement MCP server skeleton**

Use the MCP SDK or raw stdio JSON-RPC. For the plan, define the shape:

```typescript
// src/components/codegraph/mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export function startCodegraphServer() {
  const server = new Server({ name: 'codegraph', version: '0.1.0' }, {
    capabilities: { tools: {} },
  });
  server.setRequestHandler('tools/list', async () => ({
    tools: [
      { name: 'codegraph_search', description: 'Structural code search', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
      { name: 'codegraph_relate', description: 'Find related symbols', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
    ],
  }));
  server.setRequestHandler('tools/call', async (req) => {
    if (req.params.name === 'codegraph_search') {
      return { content: [{ type: 'text', text: JSON.stringify({ results: [] }) }] };
    }
    return { content: [{ type: 'text', text: 'unknown tool' }], isError: true };
  });
  const transport = new StdioServerTransport();
  server.connect(transport);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/codegraph tests/unit/components/codegraph.test.ts
-git commit -m "feat(components): CodeGraph bootstrap and MCP server"
```

---

## Task 9: Ultrawork Component + Skill

**Files:**
- Create: `src/components/ultrawork/cli.ts`
- Create: `src/components/ultrawork/hooks.json`
- Create: `src/components/ultrawork/skills/ultrawork/SKILL.md`

**Interfaces:**
- Consumes: `UserPromptSubmit` payload with `prompt`
- Produces: ultrawork prompt injection if keyword detected

- [ ] **Step 1: Implement keyword detector**

```typescript
import type { HookPayload, HookOutput } from '../../shared/types.js';

const KEYWORDS = /\b(ultrawork|ulw)\b/i;

export function detectUltrawork(payload: HookPayload): HookOutput {
  const prompt = payload.prompt ?? '';
  if (!KEYWORDS.test(prompt)) {
    return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: '' } };
  }
  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `ULTRAWORK MODE ACTIVE. Proceed autonomously. Use TodoList. Verify completion with evidence.`,
    },
  };
}
```

- [ ] **Step 2: Write skill**

```markdown
---
name: ultrawork
description: Autonomous execution mode for Kimi Code CLI
type: prompt
whenToUse: When the user wants the agent to complete a task end-to-end without asking for confirmation.
---

# Ultrawork

You are in Ultrawork mode. Do not ask clarifying questions unless critical information is missing. Use TodoList to track progress, prefer Write/Edit over Bash for file changes, and verify every claim with evidence (tests passing, file contents, command output).

## Kimi Code Harness Compatibility

- Use `Agent(prompt=..., subagent_type="coder"|"explore"|"plan")` for delegated work.
- Use `AgentSwarm` for parallel subtasks.
- Call `TodoList` to maintain todos.
- When finished, output `EVIDENCE_RECORDED: <path-or-command-output>`.
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ultrawork
-git commit -m "feat(components): ultrawork keyword hook and skill"
```

---

## Task 10: ULW-Loop Component + Skill

**Files:**
- Create: `src/components/ulw-loop/cli.ts`
- Create: `src/components/ulw-loop/steer.ts`
- Create: `src/components/ulw-loop/hooks.json`
- Create: `src/components/ulw-loop/skills/ulw-loop/SKILL.md`

**Interfaces:**
- Consumes: `UserPromptSubmit`, `PreToolUse` for `CreateGoal`
- Produces: steering context or deny decision

- [ ] **Step 1: Implement steering parser**

```typescript
import type { HookPayload, HookOutput } from '../../shared/types.js';

const STEER_PATTERN = /OMO_ULW_LOOP_STEER:\s*(.+)/i;

export function parseSteer(payload: HookPayload): HookOutput {
  const prompt = payload.prompt ?? '';
  const match = prompt.match(STEER_PATTERN);
  if (!match) {
    return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: '' } };
  }
  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `ULW-LOOP STEERING: ${match[1].trim()}`,
    },
  };
}

export function enforceGoalBudget(payload: HookPayload): HookOutput {
  const toolInput = payload.toolInput as Record<string, unknown> | undefined;
  if (toolInput?.budget) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Budgeted goals are not allowed in ulw-loop mode',
        additionalContext: 'Remove the budget parameter from CreateGoal.',
      },
    };
  }
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: '' } };
}
```

- [ ] **Step 2: Write skill**

```markdown
---
name: ulw-loop
description: Self-referential execution loop with evidence-based completion
type: prompt
whenToUse: When a task is open-ended and should run until verified completion.
---

# ULW-Loop

Repeatedly plan, act, and verify until success criteria are met. Each cycle must produce evidence. If criteria are unmet, loop again with a revised plan.

## Kimi Code Harness Compatibility

- Use `CreateGoal` to set the objective (no budget).
- Use `Agent(subagent_type="coder")` for implementation.
- Use `Agent(subagent_type="plan")` for planning reviews.
- Output `EVIDENCE_RECORDED: <path>` after each cycle.
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ulw-loop
-git commit -m "feat(components): ulw-loop steering and goal-budget enforcement"
```

---

## Task 11: Telemetry Component

**Files:**
- Create: `src/components/telemetry/cli.ts`
- Create: `src/components/telemetry/posthog.ts`
- Create: `src/components/telemetry/hooks.json`
- Create: `tests/unit/components/telemetry.test.ts`

**Interfaces:**
- Consumes: `SessionStart`
- Produces: no-op or daily active event

- [ ] **Step 1: Implement daily-active guard**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

const STATE_DIR = path.join(os.homedir(), '.local', 'share', 'lazykimicode');
const STATE_FILE = path.join(STATE_DIR, 'posthog-activity.json');

export function shouldEmit(): boolean {
  if (process.env.OMO_KIMI_DISABLE_POSTHOG === '1') return false;
  const today = new Date().toISOString().slice(0, 10);
  const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) : {};
  if (state.lastEventDate === today) return false;
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastEventDate: today }));
  return true;
}

export function getDistinctId(): string {
  return crypto.createHash('sha256').update(`omo-kimicode:${os.hostname()}`).digest('hex');
}
```

- [ ] **Step 2: Implement CLI**

```typescript
import { shouldEmit, getDistinctId } from './posthog.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  if (shouldEmit()) {
    // TODO: send to PostHog (or no-op in test env)
    const id = getDistinctId();
    process.stderr.write(`telemetry: emit daily_active for ${id}\n`);
  }
  writeHookOutput({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '' } });
}

main().catch((e) => { console.error(e); process.exit(0); });
```

- [ ] **Step 3: Commit**

```bash
git add src/components/telemetry tests/unit/components/telemetry.test.ts
-git commit -m "feat(components): daily-active telemetry"
```

---

## Task 12: Git-Bash Component + MCP (Windows)

**Files:**
- Create: `src/components/git-bash/cli.ts`
- Create: `src/components/git-bash/hooks.json`
- Create: `src/components/git-bash/mcp-server.ts`

**Interfaces:**
- Consumes: `PreToolUse` for `Bash`
- Produces: recommendation to use `git_bash` MCP on Windows

- [ ] **Step 1: Implement recommendation hook**

```typescript
import os from 'node:os';
import type { HookPayload, HookOutput } from '../../shared/types.js';

export function recommendGitBash(payload: HookPayload): HookOutput {
  if (os.platform() !== 'win32') {
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: '' } };
  }
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: 'On Windows, prefer the git_bash MCP server over Bash for shell commands.',
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/git-bash
-git commit -m "feat(components): git-bash Windows recommendation hook"
```

---

## Task 13: Start-Work-Continuation Component

**Files:**
- Create: `src/components/start-work-continuation/cli.ts`
- Create: `src/components/start-work-continuation/boulder.ts`
- Create: `src/components/start-work-continuation/hooks.json`
- Create: `tests/unit/components/start-work-continuation.test.ts`

**Interfaces:**
- Consumes: `Stop`, `SubagentStop`
- Produces: block decision if active Boulder work exists

- [ ] **Step 1: Implement Boulder check**

```typescript
import fs from 'node:fs';
import path from 'node:path';

export interface BoulderState {
  active_work_id?: string;
  works?: Record<string, { completed: boolean }>;
}

export function readBoulder(projectDir: string): BoulderState | null {
  const p = path.join(projectDir, '.omo', 'boulder.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) as BoulderState : null;
}

export function hasIncompleteWork(state: BoulderState | null): boolean {
  if (!state?.active_work_id) return false;
  return state.works?.[state.active_work_id]?.completed !== true;
}
```

- [ ] **Step 2: Implement CLI**

```typescript
import { readBoulder, hasIncompleteWork } from './boulder.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();
  const state = readBoulder(projectDir);
  if (hasIncompleteWork(state)) {
    writeHookOutput({
      decision: 'block',
      reason: 'Active Boulder work is incomplete',
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: 'There is an active start-work plan. Finish it before stopping.',
      },
    });
  } else {
    writeHookOutput({ hookSpecificOutput: { hookEventName: 'Stop', additionalContext: '' } });
  }
}

main().catch((e) => { console.error(e); process.exit(0); });
```

- [ ] **Step 3: Commit**

```bash
git add src/components/start-work-continuation tests/unit/components/start-work-continuation.test.ts
-git commit -m "feat(components): start-work continuation guard"
```

---

## Task 14: Executor-Verify Component

**Files:**
- Create: `src/components/executor-verify/cli.ts`
- Create: `src/components/executor-verify/hooks.json`
- Create: `tests/unit/components/executor-verify.test.ts`

**Interfaces:**
- Consumes: `SubagentStop` payload with subagent output
- Produces: block if `EVIDENCE_RECORDED:` marker missing

- [ ] **Step 1: Implement verify**

```typescript
import type { HookPayload, HookOutput } from '../../shared/types.js';

export function verifyEvidence(payload: HookPayload): HookOutput {
  const output = JSON.stringify(payload.toolOutput ?? '');
  if (output.includes('EVIDENCE_RECORDED:')) {
    return { hookSpecificOutput: { hookEventName: 'SubagentStop', additionalContext: '' } };
  }
  return {
    decision: 'block',
    reason: 'Executor subagent stopped without recording evidence',
    hookSpecificOutput: {
      hookEventName: 'SubagentStop',
      additionalContext: 'The executor must output EVIDENCE_RECORDED: <path> before stopping.',
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/executor-verify tests/unit/components/executor-verify.test.ts
-git commit -m "feat(components): executor evidence verification"
```

---

## Task 15: Teammode Skill (Kimi-Native)

**Files:**
- Create: `src/components/teammode/skills/teammode/SKILL.md`
- Create: `src/components/teammode/scripts/team.mjs`

**Interfaces:**
- Consumes: user prompt containing `teammode`
- Produces: instructions to use `AgentSwarm` for parallel team members

- [ ] **Step 1: Write teammode skill**

```markdown
---
name: teammode
description: Parallel multi-agent team orchestration for Kimi Code CLI
type: prompt
whenToUse: When the user asks for a team of agents to work in parallel.
---

# Teammode

Create a team of parallel agents using `AgentSwarm`. The leader (main session) coordinates; members are `Agent` or `AgentSwarm` invocations with focused scopes.

## Rules

1. Define each member's `focus` and `lens` concretely (area/ownership/perspective).
2. Use `AgentSwarm` when members can work independently; use sequential `Agent` when dependencies exist.
3. Members editing the same file must use separate git worktrees.
4. Track progress with `TodoList`.
5. Archive the team state when done.

## Kimi Code Harness Compatibility

- Use `AgentSwarm` with a prompt template containing `{{item}}` to spawn parallel members.
- Each item should be a member description; the swarm prompt instructs the member to report back.
- Use `Agent(subagent_type="coder")` for implementation members.
- Use `Agent(subagent_type="explore")` for research members.
- Use `Agent(subagent_type="plan")` for planning/review members.
```

- [ ] **Step 2: Write `team.mjs` state script**

```javascript
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEAMS_DIR = path.join(os.homedir(), '.omo', 'teams');

function teamDir(sessionId) { return path.join(TEAMS_DIR, sessionId); }

function init(sessionId) {
  const dir = teamDir(sessionId);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'team.json'), JSON.stringify({ members: [] }, null, 2));
  fs.writeFileSync(path.join(dir, 'guide.md'), '# Team Guide\n');
  console.log(`Team initialized at ${dir}`);
}

const [,, cmd, sessionId, ...args] = process.argv;
if (cmd === 'init') init(sessionId);
// TODO: add-member, bind-thread, status, archive, delete
```

- [ ] **Step 3: Commit**

```bash
git add src/components/teammode
-git commit -m "feat(components): teammode skill and state script"
```

---

## Task 16: Skill Aggregation Script

**Files:**
- Create: `scripts/sync-skills.mjs`
- Modify: `package.json` scripts

**Interfaces:**
- Consumes: component skills + shared skills
- Produces: `plugin/skills/<name>/SKILL.md`

- [ ] **Step 1: Write sync script**

```javascript
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'src/components';
const SHARED = 'vendor/shared-skills/skills';
const OUT = 'plugin/skills';

function copySkill(srcDir, outName) {
  const skillMd = path.join(srcDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) return;
  const outDir = path.join(OUT, outName);
  fs.mkdirSync(outDir, { recursive: true });
  let content = fs.readFileSync(skillMd, 'utf-8');
  content = content.replace(/## Codex Harness Tool Compatibility[\s\S]*?(?=\n## |\n*$)/, '');
  if (!content.includes('## Kimi Code Harness Compatibility')) {
    content += '\n\n## Kimi Code Harness Compatibility\n\n- Use `Agent` tool with `subagent_type` `coder`/`explore`/`plan`.\n- Use `AgentSwarm` for parallel work.\n- Use `TodoList` for tracking.\n';
  }
  fs.writeFileSync(path.join(outDir, 'SKILL.md'), content);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const comp of fs.readdirSync(SRC)) {
  const compSkills = path.join(SRC, comp, 'skills');
  if (!fs.existsSync(compSkills)) continue;
  for (const name of fs.readdirSync(compSkills)) {
    copySkill(path.join(compSkills, name), name);
  }
}

if (fs.existsSync(SHARED)) {
  for (const name of fs.readdirSync(SHARED)) {
    copySkill(path.join(SHARED, name), name);
  }
}

console.log('Skills synced to', OUT);
```

- [ ] **Step 2: Run sync**

Run: `pnpm run sync:skills`
Expected: `plugin/skills/` populated.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-skills.mjs package.json
-git commit -m "feat(build): skill aggregation script"
```

---

## Task 17: Hook Aggregation Script + Plugin Manifest

**Files:**
- Create: `scripts/sync-hooks.mjs`
- Create: `plugin/kimi.plugin.json`
- Create: `plugin/.mcp.json`
- Modify: `package.json` scripts

**Interfaces:**
- Consumes: component `hooks.json` files
- Produces: `plugin/hooks/*.json` runtime hook manifests; plugin manifest

- [ ] **Step 1: Write hook sync script**

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src/components');
const OUT = path.join(__dirname, '..', 'plugin/hooks');
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')).version;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const comp of fs.readdirSync(SRC)) {
  const hooksPath = path.join(SRC, comp, 'hooks.json');
  if (!fs.existsSync(hooksPath)) continue;
  const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
  for (const h of hooks) {
    const fileName = `${h.event.toLowerCase().replace(/_/g, '-')}-${comp}.json`;
    const command = `node "\${PLUGIN_ROOT}/components/${comp}/dist/cli.mjs" hook ${h.event.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    const entry = {
      ...h,
      command,
      statusMessage: `(OmO ${VERSION}) ${h.statusMessage ?? comp}`,
    };
    fs.writeFileSync(path.join(OUT, fileName), JSON.stringify(entry, null, 2));
  }
}

console.log('Hooks synced to', OUT);
```

- [ ] **Step 2: Write `plugin/kimi.plugin.json`**

```json
{
  "name": "lazykimicode",
  "version": "<VERSION>",
  "description": "OmO agent harness for Kimi Code CLI",
  "keywords": ["omo", "agent-harness", "lsp", "rules", "ultrawork"],
  "skills": "./skills",
  "sessionStart": {
    "skill": "rules"
  },
  "skillInstructions": "You are running with lazykimicode (OmO for Kimi Code). Prefer the lazykimicode MCP tools for structural search (codegraph), LSP, and Git Bash on Windows. Respect project rules from .omo/rules/ and AGENTS.md.",
  "mcpServers": {
    "codegraph": {
      "command": "node",
      "args": ["./components/codegraph/dist/serve.mjs"],
      "cwd": "./"
    },
    "lsp": {
      "command": "node",
      "args": ["./components/lsp/dist/daemon.mjs"],
      "cwd": "./"
    }
  },
  "interface": {
    "displayName": "Oh My KimiCode",
    "shortDescription": "OmO agent harness for Kimi Code CLI",
    "developerName": "Sisyphus Labs"
  }
}
```

- [ ] **Step 3: Write `plugin/.mcp.json` (user/project guidance)**

```json
{
  "grep_app": {
    "url": "https://api.grep.app/mcp",
    "enabled": false,
    "note": "Enable after obtaining an API key"
  },
  "context7": {
    "url": "https://context7.com/mcp",
    "enabled": false,
    "note": "Enable after obtaining an API key"
  }
}
```

Note: This file is for documentation; Kimi uses plugin `mcpServers` or user/project `.mcp.json`.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-hooks.mjs plugin/kimi.plugin.json plugin/.mcp.json package.json
-git commit -m "feat(build): hook sync and plugin manifest"
```

---

## Task 18: Installer Entry + CLI

**Files:**
- Create: `src/install/install-kimi.ts`
- Create: `src/cli/index.ts`
- Create: `bin/lazykimicode.mjs`
- Create: `scripts/install-local.mjs` (built entry)

**Interfaces:**
- Consumes: CLI args, env vars
- Produces: installed plugin cache, patched config.toml

- [ ] **Step 1: Write `src/install/install-kimi.ts`**

```typescript
import { resolveKimiEnv, pluginCacheDir } from '../shared/paths.js';
import { getHookDefs } from './hook-defs.js';
import { patchConfigToml } from './config-patcher.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface InstallOptions {
  kimiCodeHome?: string;
  projectDirectory?: string;
  binDir?: string;
  dryRun?: boolean;
  noTui?: boolean;
  autonomous?: boolean;
}

export async function runKimiInstaller(options: InstallOptions = {}): Promise<void> {
  const env = resolveKimiEnv(options);
  const version = process.env.OMO_KIMI_VERSION ?? '0.1.0';
  const cache = pluginCacheDir(env.kimiCodeHome, version);

  if (!options.dryRun) {
    fs.rmSync(cache, { recursive: true, force: true });
    fs.mkdirSync(cache, { recursive: true });
    // Copy plugin assets
    const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'plugin');
    fs.cpSync(pluginRoot, cache, { recursive: true });
    // Link bins (simplified)
    fs.mkdirSync(env.binDir, { recursive: true });
  }

  const configPath = path.join(env.kimiCodeHome, 'config.toml');
  const hooks = getHookDefs(version, cache);
  const result = patchConfigToml(configPath, hooks, options.dryRun);

  if (options.dryRun) {
    console.log('Dry run. Proposed changes:');
    console.log(result.diff);
    return;
  }

  console.log(`Installed lazykimicode ${version} to ${cache}`);
  if (result.backupPath) console.log(`Backed up config to ${result.backupPath}`);
}
```

- [ ] **Step 2: Write `src/cli/index.ts`**

```typescript
import { runKimiInstaller } from '../install/install-kimi.js';

const args = process.argv.slice(2);
const command = args[0] ?? 'install';

const options = {
  dryRun: args.includes('--dry-run'),
  noTui: args.includes('--no-tui'),
  autonomous: args.includes('--kimi-autonomous') || args.includes('--codex-autonomous'),
  kimiCodeHome: extractArg(args, '--kimi-code-home'),
};

function extractArg(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

if (command === 'install' || command === 'setup') {
  runKimiInstaller(options).catch((e) => { console.error(e); process.exit(1); });
} else if (command === 'uninstall') {
  console.log('Uninstall not yet implemented');
  process.exit(1);
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
```

- [ ] **Step 3: Write `bin/lazykimicode.mjs`**

```javascript
#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(__dirname, '..', 'scripts', 'install-local.mjs');

const args = process.argv.slice(2);
execSync(`node "${entry}" ${args.map((a) => `"${a}"`).join(' ')}`, { stdio: 'inherit' });
```

- [ ] **Step 4: Add build for installer**

Modify `scripts/build.mjs` to bundle `src/cli/index.ts` to `scripts/install-local.mjs` using `esbuild` or Node built-ins.

- [ ] **Step 5: Commit**

```bash
git add src/install/install-kimi.ts src/cli/index.ts bin/lazykimicode.mjs scripts/build.mjs
-git commit -m "feat(install): CLI entry and installer orchestration"
```

---

## Task 19: Build Script + CI

**Files:**
- Create: `scripts/build.mjs`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: source files
- Produces: `dist/`, `plugin/components/*/dist/`, `scripts/install-local.mjs`

- [ ] **Step 1: Write `scripts/build.mjs`**

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const COMPONENTS = fs.readdirSync('src/components');

async function buildComponent(name) {
  const src = `src/components/${name}/cli.ts`;
  if (!fs.existsSync(src)) return;
  const outdir = `plugin/components/${name}/dist`;
  fs.mkdirSync(outdir, { recursive: true });
  await build({
    entryPoints: [src],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: path.join(outdir, 'cli.mjs'),
    external: ['@modelcontextprotocol/sdk'],
  });
}

async function buildMcp(name) {
  const src = `src/components/${name}/mcp-server.ts`;
  if (!fs.existsSync(src)) return;
  const outdir = `plugin/components/${name}/dist`;
  fs.mkdirSync(outdir, { recursive: true });
  await build({
    entryPoints: [src],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: path.join(outdir, name === 'codegraph' ? 'serve.mjs' : 'cli.mjs'),
    external: ['@modelcontextprotocol/sdk'],
  });
}

async function buildInstaller() {
  await build({
    entryPoints: ['src/cli/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: 'scripts/install-local.mjs',
  });
}

async function main() {
  await Promise.all(COMPONENTS.map(buildComponent));
  await Promise.all(['codegraph', 'lsp', 'git-bash'].map(buildMcp));
  await buildInstaller();
  console.log('Build complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Add `esbuild` as dev dependency.

- [ ] **Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [22]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm test
      - run: pnpm run build
      - run: node scripts/install-local.mjs install --kimi-code-home ./tmp-home
```

- [ ] **Step 3: Commit**

```bash
git add scripts/build.mjs .github/workflows/ci.yml package.json
-git commit -m "feat(build): esbuild pipeline and CI"
```

---

## Task 20: Documentation + Release

**Files:**
- Create: `README.md`
- Create: `AGENTS.md`
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Produces: user docs, contributor docs, release automation

- [ ] **Step 1: Write `README.md`**

Sections:
- What is lazykimicode
- Install (`npx lazykimicode install`)
- Usage (`ulw`, `/skill:lazykimicode:init-deep`, teammode)
- Features table
- Uninstall
- Telemetry opt-out

- [ ] **Step 2: Write `AGENTS.md`**

Sections:
- Architecture
- Component list
- Build commands
- Testing commands
- How to add a new component

- [ ] **Step 3: Write release workflow**

```yaml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install
      - run: pnpm run build
      - run: pnpm run sync:skills
      - run: pnpm run sync:hooks
      - run: zip -r lazykimicode.zip plugin scripts bin package.json
      - uses: softprops/action-gh-release@v2
        with:
          files: lazykimicode.zip
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md .github/workflows/release.yml
-git commit -m "docs: README, AGENTS, and release workflow"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** Every LazyCodex component maps to a task.
- [ ] **Placeholder scan:** No `TODO`/`TBD` remain in task steps (only in component TODOs that are intentionally deferred to implementation).
- [ ] **Type consistency:** `HookPayload`, `HookOutput`, `HookDef` used consistently across tasks.
- [ ] **Kimi constraints respected:** Hooks go through `config.toml`; plugin manifest does not claim hooks.
- [ ] **Validation coverage:** Unit + integration + manual checklist defined.

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Required sub-skill: `superpowers:subagent-driven-development`.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Recommended: Option 1, because the tasks are largely independent and can be parallelized after the shared utilities are done.
