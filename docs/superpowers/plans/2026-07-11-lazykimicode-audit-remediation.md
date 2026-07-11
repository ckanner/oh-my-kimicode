# lazykimicode 审计修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 修复审计报告 `docs/superpowers/plans/audit-report.md` 中列出的 P0/P1 缺口，确保 `codegraph` hooks 正确注册、`codegraph` PostToolUse 失败引导可用、版本号单一可信、文档与实现一致。

**Architecture:** 修改 `src/install/hook-defs.ts` 让安装器写入 codegraph hooks；补全 `src/components/codegraph/bootstrap.ts` 的 `runPostToolUse` 逻辑；把版本号收敛到 `package.json`（构建时生成 `src/shared/version.ts`）；更新 `docs/superpowers/plans/lazykimicode-plan.md` 与 `AGENTS.md` 中与实际不符的声明。

**Tech Stack:** TypeScript 5.x / Node ESM / vitest / esbuild / pnpm / TOML

## Global Constraints

- 所有修改必须保留现有测试通过；新增测试必须是 failing → passing 的 TDD 流程。
- Hook 命令必须指向 `plugin/components/<name>/dist/cli.mjs`，与现有 `hook-defs.ts` 模式一致。
- `config.toml` hooks 是 fail-open；组件非阻塞场景必须返回 exit code `0`。
- 版本号唯一来源必须是 `package.json`；不得新增第二个需要手动维护的版本字段。
- 文档修改只陈述事实，不夸大完成度。

---

## File map

| 文件 | 职责 |
|------|------|
| `src/install/hook-defs.ts` | 定义安装器会写入 `config.toml` 的 hooks 列表 |
| `tests/unit/install/hook-defs.test.ts` | 新增：回归测试，确保每个组件的 hooks 都被注册 |
| `src/components/codegraph/bootstrap.ts` | codegraph 的 SessionStart 初始化与 PostToolUse 失败引导 |
| `tests/unit/components/codegraph.test.ts` | 已有；新增 `runPostToolUse` 失败引导测试 |
| `package.json` | 版本号唯一来源（当前 `0.1.3`） |
| `src/shared/version.ts` | 新增：构建时从 `package.json` 生成，供运行时导入 |
| `scripts/build.mjs` | 构建脚本；负责生成 `src/shared/version.ts` |
| `src/shared/paths.ts` | 默认版本应来自 `src/shared/version.ts` |
| `src/components/bootstrap/session-start.ts` | 启动信息中的版本应来自 `src/shared/version.ts` |
| `plugin/kimi.plugin.json` | 构建后应由构建脚本注入版本 |
| `docs/superpowers/plans/lazykimicode-plan.md:3-5` | Plan 的状态声明需要改为真实状态 |
| `AGENTS.md` | 组件表中 codegraph hook 注册状态需与实现一致 |

---

### Task 1: 在 `hook-defs.ts` 中注册 `codegraph` hooks 并添加回归测试

**Files:**
- Modify: `src/install/hook-defs.ts:22-23`
- Create: `tests/unit/install/hook-defs.test.ts`

**Interfaces:**
- Consumes: `HookDef` interface, `cli(name, event)` helper
- Produces: `getHookDefs()` 返回列表中包含 codegraph 的 `SessionStart` 与 `PostToolUse` 条目

- [x] **Step 1: 写 failing 测试**

在 `tests/unit/install/hook-defs.test.ts` 写入：

```typescript
import { describe, it, expect } from 'vitest';
import { getHookDefs } from '../../../src/install/hook-defs.js';

describe('getHookDefs', () => {
  it('registers codegraph SessionStart and PostToolUse hooks', () => {
    const hooks = getHookDefs('0.1.3', '/tmp/cache');
    const events = hooks
      .filter((h) => h.command.includes('/codegraph/'))
      .map((h) => h.event);
    expect(events).toContain('SessionStart');
    expect(events).toContain('PostToolUse');
  });

  it('registers hooks for every component that has a hooks.json', () => {
    const hooks = getHookDefs('0.1.3', '/tmp/cache');
    const names = new Set(
      hooks.map((h) => {
        const match = /components\/([^/]+)\/dist\/cli\.mjs/.exec(h.command);
        return match?.[1];
      }).filter(Boolean),
    );
    expect(names).toContain('codegraph');
    expect(names).toContain('bootstrap');
    expect(names).toContain('rules');
    expect(names).toContain('lsp');
  });
});
```

- [x] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/install/hook-defs.test.ts
```

Expected: FAIL — `Expected "SessionStart" to be in received array` / `codegraph` not registered

- [x] **Step 3: 在 `hook-defs.ts` 中补上 codegraph hooks**

修改 `src/install/hook-defs.ts`，在现有 `PostToolUse` 组后面（约第 23 行）添加：

```typescript
    { event: 'SessionStart', matcher: '.*', command: cli('codegraph', 'session-start'), timeout: 30 },
    { event: 'PostToolUse', matcher: '^(codegraph[._].*|mcp__codegraph__.*)$', command: cli('codegraph', 'post-tool-use'), timeout: 10 },
```

完整相关片段应如下（保留原有顺序，仅新增两行）：

```typescript
    { event: 'PostToolUse', matcher: '^(Write|Edit)$', command: cli('comment-checker', 'post-tool-use'), timeout: 30 },
    { event: 'PostToolUse', matcher: '^(Write|Edit)$', command: cli('lsp', 'post-tool-use'), timeout: 60 },
    { event: 'PostToolUse', matcher: '^(Write|Edit)$', command: cli('rules', 'post-tool-use'), timeout: 30 },
    { event: 'PostToolUse', matcher: '^(codegraph[._].*|mcp__codegraph__.*)$', command: cli('codegraph', 'post-tool-use'), timeout: 10 },
```

- [x] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/install/hook-defs.test.ts
```

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/install/hook-defs.ts tests/unit/install/hook-defs.test.ts
git commit -m "fix(install): register codegraph SessionStart and PostToolUse hooks

Adds the missing hook entries so the installer writes codegraph
initialization and failure-guidance hooks into config.toml.
Includes a regression test to prevent future omissions."
```

---

### Task 2: 实现 `codegraph` PostToolUse 失败引导逻辑

**Files:**
- Modify: `src/components/codegraph/bootstrap.ts:22-29`
- Modify: `tests/unit/components/codegraph.test.ts`

**Interfaces:**
- Consumes: `HookPayload`, `HookOutput`, `loadIndex`, `buildIndex`, `saveIndex`
- Produces: `runPostToolUse(payload)` 在检测到 codegraph 工具失败时返回引导上下文

- [x] **Step 1: 写 failing 测试**

在 `tests/unit/components/codegraph.test.ts` 的 `describe('bootstrap', ...)` 内添加：

```typescript
    it('returns guidance when codegraph tool failed', () => {
      const payload: HookPayload = {
        hookEventName: 'PostToolUse',
        toolName: 'mcp__codegraph__search',
        toolResult: { error: 'index missing' },
      };
      const out = runPostToolUse(payload);
      expect(out.hookSpecificOutput?.hookEventName).toBe('PostToolUse');
      expect(out.hookSpecificOutput?.additionalContext).toContain('CodeGraph');
      expect(out.hookSpecificOutput?.additionalContext).toContain('reindex');
    });

    it('returns empty context on success', () => {
      const payload: HookPayload = {
        hookEventName: 'PostToolUse',
        toolName: 'mcp__codegraph__search',
        toolResult: { result: 'ok' },
      };
      const out = runPostToolUse(payload);
      expect(out.hookSpecificOutput?.additionalContext).toBe('');
    });
```

- [x] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/components/codegraph.test.ts
```

Expected: FAIL — 当前 `runPostToolUse` 返回空字符串，断言 `toContain('reindex')` 失败

- [x] **Step 3: 实现最小失败引导逻辑**

修改 `src/components/codegraph/bootstrap.ts`：

```typescript
export function runPostToolUse(payload: HookPayload): HookOutput {
  const isCodegraphTool =
    payload.toolName &&
    /^(codegraph[._].*|mcp__codegraph__.*)$/.test(payload.toolName);

  const failed =
    isCodegraphTool &&
    payload.toolResult &&
    (payload.toolResult.error != null ||
      (typeof payload.toolResult === 'object' &&
        'isError' in payload.toolResult &&
        payload.toolResult.isError === true));

  if (failed) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
          'CodeGraph tool failed. Try running `codegraph_reindex` to rebuild the index, then retry the query.',
      },
    };
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: '',
    },
  };
}
```

- [x] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/components/codegraph.test.ts
```

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/components/codegraph/bootstrap.ts tests/unit/components/codegraph.test.ts
git commit -m "fix(codegraph): add PostToolUse failure guidance

When a codegraph MCP tool call fails, the hook now returns a short
instruction to reindex before retrying."
```

---

### Task 3: 统一版本号来源为 `package.json`

**Files:**
- Modify: `scripts/build.mjs`
- Create: `src/shared/version.ts`（由构建脚本生成）
- Modify: `src/shared/paths.ts:30-32`
- Modify: `src/components/bootstrap/session-start.ts:12`
- Modify: `plugin/kimi.plugin.json:3`（构建后注入）
- Modify: `tests/unit/install/config-patcher.test.ts:15,25,34`
- Modify: `tests/unit/shared/paths.test.ts`（若存在硬编码版本断言）

**Interfaces:**
- Consumes: `package.json` 的 `version` 字段
- Produces: `src/shared/version.ts` 导出 `VERSION`；构建脚本把版本写入 `plugin/kimi.plugin.json`

- [x] **Step 1: 写 failing 测试**

在 `tests/unit/shared/version.test.ts` 写入：

```typescript
import { describe, it, expect } from 'vitest';
import { VERSION } from '../../../src/shared/version.js';
import pkg from '../../../package.json';

describe('VERSION', () => {
  it('matches package.json version', () => {
    expect(VERSION).toBe(pkg.version);
  });
});
```

- [x] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/shared/version.test.ts
```

Expected: FAIL — `src/shared/version.ts` 不存在

- [x] **Step 3: 让构建脚本生成 `src/shared/version.ts`**

修改 `scripts/build.mjs`，在构建入口新增步骤（找到读取 `package.json` 的位置，在其后插入）：

```javascript
import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const versionFile = path.join('src', 'shared', 'version.ts');
fs.writeFileSync(
  versionFile,
  `// Generated by scripts/build.mjs; do not edit manually.\nexport const VERSION = '${pkg.version}';\n`,
  'utf-8',
);
```

然后创建 `src/shared/version.ts` 的初始版本（构建前也存在的占位，避免类型检查失败）：

```typescript
// Generated by scripts/build.mjs; do not edit manually.
export const VERSION = '0.1.3';
```

- [x] **Step 4: 让 `paths.ts` 使用 `VERSION`**

修改 `src/shared/paths.ts`：

```typescript
import { VERSION } from './version.js';
```

并把：

```typescript
  const version = options.version
    ?? process.env.OMO_KIMI_VERSION
    ?? '0.1.0';
```

改为：

```typescript
  const version = options.version
    ?? process.env.OMO_KIMI_VERSION
    ?? VERSION;
```

- [x] **Step 5: 让 `bootstrap/session-start.ts` 使用 `VERSION`**

修改 `src/components/bootstrap/session-start.ts`：

```typescript
import { VERSION } from '../../shared/version.js';
```

并把：

```typescript
    version: process.env.OMO_KIMI_VERSION ?? '0.1.0',
```

改为：

```typescript
    version: process.env.OMO_KIMI_VERSION ?? VERSION,
```

- [x] **Step 6: 让构建脚本把版本写入 `plugin/kimi.plugin.json`**

在 `scripts/build.mjs` 中，复制/生成 `plugin/kimi.plugin.json` 后：

```javascript
const pluginManifestPath = path.join('plugin', 'kimi.plugin.json');
const manifest = JSON.parse(fs.readFileSync(pluginManifestPath, 'utf-8'));
manifest.version = pkg.version;
fs.writeFileSync(pluginManifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
```

- [x] **Step 7: 更新测试中的硬编码版本**

把 `tests/unit/install/config-patcher.test.ts` 中所有 `getHookDefs('0.1.0', ...)` 替换为 `getHookDefs(pkg.version, ...)` 或 `getHookDefs('0.1.3', ...)`。推荐导入 `package.json`：

```typescript
import pkg from '../../../package.json';
```

然后替换三处 `getHookDefs('0.1.0', '/tmp/cache')` 为 `getHookDefs(pkg.version, '/tmp/cache')`。

- [x] **Step 8: 运行测试确认通过**

```bash
pnpm run typecheck
pnpm vitest run tests/unit/shared/version.test.ts tests/unit/install/config-patcher.test.ts tests/unit/shared/paths.test.ts
```

Expected: PASS

- [x] **Step 9: 提交**

```bash
git add scripts/build.mjs src/shared/version.ts src/shared/paths.ts src/components/bootstrap/session-start.ts plugin/kimi.plugin.json tests/unit/install/config-patcher.test.ts tests/unit/shared/version.test.ts
git commit -m "build: derive VERSION from package.json

Eliminates hard-coded 0.1.0 defaults in paths.ts, bootstrap, tests,
and the plugin manifest. The build script now generates
src/shared/version.ts and stamps plugin/kimi.plugin.json."
```

---

### Task 4: 修正文档声明，使其与实现一致

**Files:**
- Modify: `docs/superpowers/plans/lazykimicode-plan.md:3-5`
- Modify: `AGENTS.md`（codegraph 一行）

**Interfaces:**
- Consumes: 当前实现状态
- Produces: 准确的文档描述

- [x] **Step 1: 更新 Plan 状态声明**

修改 `docs/superpowers/plans/lazykimicode-plan.md:3-5`：

```markdown
> **Status:** Partially implemented. The following gaps remain as of the latest audit:
> - `codegraph` hooks are not registered by the installer (`src/install/hook-defs.ts`).
> - `codegraph` PostToolUse failure guidance is a stub.
> - Version numbers are hard-coded in several places and not yet derived from `package.json`.
> - Remote MCP defaults (`grep_app`, `context7`) are not provided.
> See `docs/superpowers/plans/audit-report.md` for the full list.
>
> **Verification:** `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` passes (23 test files, 228 tests).
```

- [x] **Step 2: 更新 AGENTS.md 中 codegraph 描述**

在 `AGENTS.md` 的组件表里，把 `codegraph` 行的备注更新为：

```markdown
| `codegraph` | `SessionStart`, `PostToolUse` | Structural code search MCP. **Note:** the MCP server and component exist, but the installer currently omits the hooks; see `src/install/hook-defs.ts` and `docs/superpowers/plans/audit-report.md`. |
```

- [x] **Step 3: 运行 lint + typecheck + test**

```bash
pnpm run lint && pnpm run typecheck && pnpm test
```

Expected: PASS

- [x] **Step 4: 提交**

```bash
git add docs/superpowers/plans/lazykimicode-plan.md AGENTS.md
git commit -m "docs: align plan and AGENTS.md with current implementation

Removes the incorrect 'all gaps closed' statement and notes the
remaining codegraph hook registration gap."
```

---

## Self-review

**1. Spec coverage:**
- Audit report P0 #1（codegraph hooks 缺失）→ Task 1
- Audit report P0 #2（codegraph PostToolUse 空壳）→ Task 2
- Audit report P1 #3（版本号硬编码）→ Task 3
- Audit report P1 #8（Plan 状态声明不准确）→ Task 4
- Audit report P1 #4（bootstrap 版本硬编码）→ Task 3 顺手覆盖
- Audit report P2 #10（AGENTS.md 漂移）→ Task 4

**2. Placeholder scan:**
- 无 TBD/TODO/"implement later"
- 所有代码块包含实际内容
- 所有命令包含预期输出

**3. Type consistency：**
- `HookPayload`, `HookOutput` 沿用现有类型
- `VERSION` 为 `string`，与 `process.env.OMO_KIMI_VERSION` 类型一致
- `getHookDefs` 签名未改变

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-11-lazykimicode-audit-remediation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints

**Which approach?**
