# lazykimicode 剩余缺口修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 修复 Release workflow 发布的 zip 缺少 `dist/` 的问题，并在项目根目录提供默认 `.mcp.json` 远程 MCP 占位配置；同步更新审计报告与 Plan，移除已不存在的缺口。

**Architecture：** 修改 `.github/workflows/release.yml` 把 `dist/` 加入 zip 包；在项目根目录新建 `.mcp.json` 与 `plugin/.mcp.json` 保持一致；更新 `docs/superpowers/plans/audit-report.md` 和 `docs/superpowers/plans/lazykimicode-plan.md` 中剩余缺口列表，把 PostHog 注入和 bootstrap 验证标记为已实现。

**Tech Stack：** GitHub Actions YAML、JSON、Markdown、vitest

## Global Constraints

- 所有修改必须保留现有测试通过；`pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` 必须全部通过。
- `.mcp.json` 必须默认 `enabled: false`，避免无 API key 时触发远程调用。
- Release zip 必须包含 `dist/` 目录，因为 `bin/lazykimicode.mjs` 依赖 `dist/cli/index.mjs`。
- 文档更新只陈述事实，不得把已修复的缺口继续列为“剩余”。
- 每个 Task 结束时有独立可验证的交付物。

---

## File map

| 文件 | 职责 |
|------|------|
| `.github/workflows/release.yml` | GitHub Release 工作流；修改 zip 打包列表 |
| `.mcp.json` | 新建：项目根目录远程 MCP 默认占位配置 |
| `plugin/.mcp.json` | 已有参考：远程 MCP 占位配置 |
| `docs/superpowers/plans/audit-report.md` | 更新修复状态与剩余缺口列表 |
| `docs/superpowers/plans/lazykimicode-plan.md` | 更新状态块中的剩余缺口描述 |
| `tests/unit/install/remote-mcp.test.ts` | 新增：验证根目录 `.mcp.json` 与 `plugin/.mcp.json` 一致 |

---

### Task 1: Release workflow zip 包含 `dist/`

**Files:**
- Modify: `.github/workflows/release.yml:31`
- Verify: local build + zip + smoke test

**Interfaces:**
- Consumes: existing `pnpm run build` output (`dist/cli/index.mjs`)
- Produces: zip 命令包含 `dist/`，发布包可独立运行

- [x] **Step 1: 修改 release.yml**

把 `.github/workflows/release.yml:31` 从：

```yaml
      - run: zip -r lazykimicode.zip plugin scripts bin package.json
```

改为：

```yaml
      - run: zip -r lazykimicode.zip plugin scripts bin dist package.json
```

- [x] **Step 2: 本地验证 zip 包结构**

```bash
pnpm run build
rm -f lazykimicode.zip
zip -r lazykimicode.zip plugin scripts bin dist package.json
unzip -l lazykimicode.zip | grep -E 'dist/cli/index\.mjs|bin/lazykimicode\.mjs'
```

Expected output contains both `dist/cli/index.mjs` and `bin/lazykimicode.mjs`.

- [x] **Step 3: 本地 smoke test 发布包**

```bash
rm -rf /tmp/lazykimicode-release-test
mkdir /tmp/lazykimicode-release-test
unzip -q lazykimicode.zip -d /tmp/lazykimicode-release-test
node /tmp/lazykimicode-release-test/bin/lazykimicode.mjs --help
```

Expected: 帮助信息正常输出，不报错 `Built installer not found`。

- [x] **Step 4: 清理临时文件**

```bash
rm -f lazykimicode.zip
rm -rf /tmp/lazykimicode-release-test
```

- [x] **Step 5: 提交**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): include dist/ in release zip

The zip archive is meant to be runnable out of the box, but
bin/lazykimicode.mjs depends on dist/cli/index.mjs which was
not included. Adding dist/ makes the GitHub Release download
self-contained."
```

---

### Task 2: 项目根目录 `.mcp.json` 默认远程 MCP 占位

**Files:**
- Create: `.mcp.json`
- Create: `tests/unit/install/remote-mcp.test.ts`

**Interfaces:**
- Consumes: `plugin/.mcp.json` 作为参考
- Produces: 根目录 `.mcp.json` 与测试断言

- [x] **Step 1: 写 failing 测试**

创建 `tests/unit/install/remote-mcp.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('remote MCP defaults', () => {
  it('provides a root .mcp.json matching plugin/.mcp.json', () => {
    const rootMcp = path.join(ROOT, '.mcp.json');
    const pluginMcp = path.join(ROOT, 'plugin', '.mcp.json');
    expect(fs.existsSync(rootMcp)).toBe(true);
    const root = JSON.parse(fs.readFileSync(rootMcp, 'utf-8'));
    const plugin = JSON.parse(fs.readFileSync(pluginMcp, 'utf-8'));
    expect(root).toEqual(plugin);
  });

  it('keeps remote MCPs disabled by default', () => {
    const rootMcp = path.join(ROOT, '.mcp.json');
    const root = JSON.parse(fs.readFileSync(rootMcp, 'utf-8'));
    for (const [name, cfg] of Object.entries(root)) {
      expect((cfg as { enabled?: boolean }).enabled).toBe(false);
    }
  });
});
```

- [x] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/install/remote-mcp.test.ts
```

Expected: FAIL — `.mcp.json` does not exist.

- [x] **Step 3: 创建根目录 `.mcp.json`**

创建 `.mcp.json`：

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

- [x] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/install/remote-mcp.test.ts
```

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add .mcp.json tests/unit/install/remote-mcp.test.ts
git commit -m "feat(mcp): add default remote MCP placeholders at project root

Provides grep_app and context7 placeholders as a project-level
.mcp.json so users see the remote MCP guidance when opening a
repository. Both are disabled by default until an API key is set."
```

---

### Task 3: 同步更新审计报告与 Plan

**Files:**
- Modify: `docs/superpowers/plans/audit-report.md`
- Modify: `docs/superpowers/plans/lazykimicode-plan.md`

**Interfaces:**
- Consumes: Tasks 1–2 完成状态、已知实现状态
- Produces: 准确的剩余缺口列表

- [x] **Step 1: 更新 `docs/superpowers/plans/audit-report.md`**

在已有的“修复状态”章节中：

1. 标记 release workflow 缺 `dist/` 为已修复（Task 1）。
2. 标记远程 MCP 默认配置为已修复（Task 2）。
3. 把 PostHog release key 注入从 P1 移到“已实现/无需修复”。
4. 把 `bootstrap` 完整验证从 P1 移到“已实现/无需修复”。

同时更新“推荐修复优先级 TOP 5”和“下一步建议”以反映当前状态。

- [x] **Step 2: 更新 `docs/superpowers/plans/lazykimicode-plan.md` 状态块**

把状态块中的剩余缺口列表更新为：

```markdown
> **Status:** Partially implemented. Audit-remediation Tasks 1–4 and remaining-gap Tasks 1–3 are complete. The following minor/verification items remain:
> - Remote MCP defaults (`grep_app`, `context7`) are provided as disabled placeholders; actual enablement requires user API keys.
> - Release workflow now includes `dist/` in the zip; verify on next tag push.
```

- [x] **Step 3: 运行完整验证**

```bash
pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build
```

Expected: PASS（39 test files / 243 tests，build 成功）。

- [x] **Step 4: 提交**

```bash
git add docs/superpowers/plans/audit-report.md docs/superpowers/plans/lazykimicode-plan.md
git commit -m "docs: reconcile remaining gap status after Tasks 1–3

Marks release workflow dist/ inclusion and root .mcp.json as fixed.
Removes PostHog release key injection and bootstrap verification
from the open-gap list because they were already implemented."
```

---

## Self-review

**1. Spec coverage:**
- Release zip 包含 `dist/` → Task 1
- 根目录 `.mcp.json` → Task 2
- 文档同步 → Task 3
- 移除已实现的 PostHog / bootstrap 缺口 → Task 3

**2. Placeholder scan：**
- 无 TBD/TODO/"implement later"
- 所有代码块含实际内容
- 所有命令含预期输出

**3. Type consistency：**
- 测试使用 `vitest` 标准 API
- `.mcp.json` 为静态 JSON，无类型依赖

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-11-remaining-gaps-remediation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints

**Which approach?**
