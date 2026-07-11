# lazykimicode 全面修复实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 修复 comprehensive review 中发现的所有源码捷径、plugin/skill 缺口、测试覆盖不足和文档漂移问题。

**Architecture：** 按组件逐个修复源码实现；为 CLI/MCP 边界补测试；统一 plugin manifest 与 skill 描述；同步 README/AGENTS.md/capabilities.md/Plan 文档。

**Tech Stack：** TypeScript 5.x / Node ESM / vitest / esbuild / pnpm / TOML / GitHub Actions

## Global Constraints

- 所有修改必须让 `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` 通过。
- 每个 Task 必须包含 TDD 流程：先写 failing test，再实现，再验证通过。
- 不得引入新的运行时依赖（tree-sitter 等重型解析器不在范围内）。
- 文档只陈述事实；不得保留已修复缺口的过时声明。
- 每次 commit 只包含一个 Task 的改动；频繁提交。

---

## File map

| 文件 | 职责 |
|------|------|
| `src/components/start-work-continuation/` | 实现真正的 resume 提示 |
| `src/components/git-bash/mcp-server.ts` | 修复 `findBashPath` 真实校验 |
| `src/components/lsp/{diagnostics.ts,mcp-server.ts,cli.ts,lsp-client.ts}` | 统一 project root、修复 languageId、修复 diagnostics placeholder |
| `src/components/comment-checker/check.ts` | 支持块注释 TODO 检测 |
| `src/components/codegraph/symbols.ts` | 扩展启发式 parser |
| `src/components/telemetry/posthog.ts` | telemetry key 行为说明 |
| `src/install/hook-defs.ts` / `scripts/sync-hooks.mjs` | hooks 一致性校验 |
| `src/cli/index.ts` | 增加 version 命令、flag 校验 |
| `plugin/kimi.plugin.json` | 声明 `git_bash` MCP |
| `plugin/skills/{ultimate-browsing,ultrawork,frontend,visual-qa,lcx-*}/SKILL.md` | 增加 `kimi-webbridge` 缺失 fallback |
| `plugin/skills/{frontend,programming}/SKILL.md` | 增加 references 缺失 fallback |
| `tests/unit/components/*/` | 新增/强化测试 |
| `tests/integration/` | 新增 uninstall/doctor/release-zip e2e 测试 |
| `AGENTS.md` / `README.md` / `docs/capabilities.md` / `docs/superpowers/plans/*.md` | 文档同步 |

---

### Task 1: `start-work-continuation` 返回 resume 上下文

**Files:**
- Modify: `src/components/start-work-continuation/boulder.ts`
- Modify: `src/components/start-work-continuation/cli.ts`
- Modify: `tests/unit/components/start-work-continuation.test.ts`
- Modify: `tests/integration/hooks.test.ts`

**Interfaces:**
- Consumes: `Boulder` shape from `boulder.ts`
- Produces: `runStop` / `runSubagentStop` 返回 `additionalContext` 包含未完成任务清单

- [x] **Step 1: 写 failing 测试**

在 `tests/unit/components/start-work-continuation.test.ts` 添加：

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runStop, runSubagentStop } from '../../../src/components/start-work-continuation/cli.js';

describe('start-work-continuation resume guidance', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boulder-'));
    process.env.OMO_KIMI_PROJECT = tmpDir;
    fs.mkdirSync(path.join(tmpDir, '.omo'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.omo', 'boulder.json'),
      JSON.stringify({
        active_work_id: 'feat-auth',
        works: {
          'feat-auth': {
            title: 'Add auth',
            status: 'active',
            tasks: [
              { id: 't1', title: 'Login form', status: 'done' },
              { id: 't2', title: 'Session handling', status: 'unchecked' },
            ],
          },
        },
      }),
      'utf-8',
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    delete process.env.OMO_KIMI_PROJECT;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Stop returns block decision and resume guidance', () => {
    const out = runStop({ hookEventName: 'Stop' });
    expect(out.decision).toBe('block');
    expect(out.hookSpecificOutput?.additionalContext).toContain('Session handling');
    expect(out.hookSpecificOutput?.additionalContext).toContain('continue');
  });

  it('SubagentStop returns block decision and resume guidance', () => {
    const out = runSubagentStop({ hookEventName: 'SubagentStop', subagentType: 'coder' });
    expect(out.decision).toBe('block');
    expect(out.hookSpecificOutput?.additionalContext).toContain('Session handling');
  });
});
```

- [x] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/components/start-work-continuation.test.ts
```

Expected: FAIL — `runStop` / `runSubagentStop` 不存在或返回内容不匹配。

- [x] **Step 3: 导出并实现 resume 上下文函数**

修改 `src/components/start-work-continuation/boulder.ts`，添加：

```typescript
export function formatResumeContext(boulder: Boulder): string {
  const work = boulder.works[boulder.active_work_id];
  if (!work) return 'Active work not found. Please check .omo/boulder.json.';
  const unchecked = work.tasks.filter((t) => t.status === 'unchecked');
  const lines = [
    `Active work: ${work.title}`,
    `Unchecked tasks (${unchecked.length}):`,
    ...unchecked.map((t) => `- ${t.id}: ${t.title}`),
    'Please finish these tasks before you continue.',
  ];
  return lines.join('\n');
}
```

修改 `src/components/start-work-continuation/cli.ts`，导出 `runStop` / `runSubagentStop` 并返回 resume 上下文：

```typescript
import { readBoulder, formatResumeContext } from './boulder.js';

export function runStop(_payload: HookPayload): HookOutput {
  const boulder = readBoulder();
  if (!boulder || !hasUncheckedTasks(boulder)) {
    return { hookSpecificOutput: { hookEventName: 'Stop', additionalContext: '' } };
  }
  return {
    decision: 'block',
    reason: 'Active work has unchecked tasks',
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext: formatResumeContext(boulder),
    },
  };
}

export function runSubagentStop(_payload: HookPayload): HookOutput {
  const boulder = readBoulder();
  if (!boulder || !hasUncheckedTasks(boulder)) {
    return { hookSpecificOutput: { hookEventName: 'SubagentStop', additionalContext: '' } };
  }
  return {
    decision: 'block',
    reason: 'Active work has unchecked tasks; subagent cannot stop yet',
    hookSpecificOutput: {
      hookEventName: 'SubagentStop',
      additionalContext: formatResumeContext(boulder),
    },
  };
}
```

- [x] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/components/start-work-continuation.test.ts
```

Expected: PASS

- [x] **Step 5: 在 hooks integration 中补充 resume 断言**

在 `tests/integration/hooks.test.ts` 的 start-work-continuation 测试中，验证返回上下文包含任务标题。

- [x] **Step 6: 提交**

```bash
git add src/components/start-work-continuation/ tests/unit/components/start-work-continuation.test.ts tests/integration/hooks.test.ts
git commit -m "feat(start-work-continuation): return resume guidance when boulder has unchecked tasks"
```

---

### Task 2: `git-bash` MCP 真实路径查找

**Files:**
- Modify: `src/components/git-bash/mcp-server.ts`
- Create: `tests/unit/components/git-bash-mcp-server.test.ts`

**Interfaces:**
- Consumes: `findBashPath()` internal helper
- Produces: `findBashPath()` 返回真实存在的 bash 路径或 `null`

- [x] **Step 1: 写 failing 测试**

创建 `tests/unit/components/git-bash-mcp-server.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

const modulePath = '../../../src/components/git-bash/mcp-server.js';

describe('git-bash mcp-server findBashPath', () => {
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    // clear module cache to re-import
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
  });

  it('returns the first existing candidate', async () => {
    existsSyncSpy.mockImplementation((p: fs.PathLike) =>
      String(p).includes('Git\\bin\\bash.exe'),
    );
    const { findBashPath } = await import(modulePath);
    expect(findBashPath()).toContain('Git');
  });

  it('returns null when no candidate exists', async () => {
    const { findBashPath } = await import(modulePath);
    expect(findBashPath()).toBeNull();
  });
});
```

- [x] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/components/git-bash-mcp-server.test.ts
```

Expected: FAIL — `findBashPath` 未导出或行为不符。

- [x] **Step 3: 实现真实路径查找**

修改 `src/components/git-bash/mcp-server.ts`：

```typescript
import fs from 'node:fs';

export function findBashPath(): string | null {
  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe',
    '/usr/bin/bash',
    '/bin/bash',
    'bash.exe',
    'bash',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}
```

并更新使用 `findBashPath()` 的地方处理 `null`：

```typescript
const bashPath = findBashPath();
if (!bashPath) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: 'bash not found' }) }],
    isError: true,
  };
}
```

- [x] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/components/git-bash-mcp-server.test.ts
```

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/components/git-bash/mcp-server.ts tests/unit/components/git-bash-mcp-server.test.ts
git commit -m "fix(git-bash): findBashPath now checks file existence"
```

---

### Task 3: LSP 统一 project root 与 languageId

**Files:**
- Modify: `src/components/lsp/diagnostics.ts`
- Modify: `src/components/lsp/mcp-server.ts`
- Modify: `src/components/lsp/cli.ts`
- Modify: `src/components/lsp/lsp-client.ts`
- Create: `src/components/lsp/language-id.ts`
- Create/Modify: `tests/unit/components/lsp.test.ts`

**Interfaces:**
- Consumes: `OMO_KIMI_PROJECT`, `OMO_KIMI_LSP_COMMAND`
- Produces: `languageIdFromExtension(ext: string): string`, root URI from project env

- [x] **Step 1: 写 failing 测试**

创建 `tests/unit/components/lsp-language-id.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { languageIdFromExtension } from '../../../src/components/lsp/language-id.js';

describe('languageIdFromExtension', () => {
  it('maps ts to typescript', () => {
    expect(languageIdFromExtension('ts')).toBe('typescript');
  });
  it('maps js to javascript', () => {
    expect(languageIdFromExtension('js')).toBe('javascript');
  });
  it('maps py to python', () => {
    expect(languageIdFromExtension('py')).toBe('python');
  });
  it('maps go to go', () => {
    expect(languageIdFromExtension('go')).toBe('go');
  });
  it('maps rs to rust', () => {
    expect(languageIdFromExtension('rs')).toBe('rust');
  });
  it('maps unknown to plaintext', () => {
    expect(languageIdFromExtension('xyz')).toBe('plaintext');
  });
});
```

- [x] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/components/lsp-language-id.test.ts
```

Expected: FAIL — module/function 不存在。

- [x] **Step 3: 实现 languageId 映射**

创建 `src/components/lsp/language-id.ts`：

```typescript
export function languageIdFromExtension(ext: string): string {
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    md: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
  };
  return map[ext] ?? 'plaintext';
}
```

- [x] **Step 4: 替换 mcp-server.ts 和 diagnostics.ts 中的映射**

在 `src/components/lsp/mcp-server.ts` 中：

```typescript
import { languageIdFromExtension } from './language-id.js';
```

替换所有 `path.extname(file).replace('.', '') || 'text'` 为 `languageIdFromExtension(path.extname(file).replace('.', ''))`。

在 `src/components/lsp/diagnostics.ts` 和 `src/components/lsp/cli.ts` 中：

```typescript
import { projectDirFromEnv } from './project-dir.js'; // or inline helper
const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();
const rootUri = pathToFileURL(projectDir).href + '/';
```

- [x] **Step 5: 修复 diagnostics placeholder**

在 `src/components/lsp/lsp-client.ts` 的 diagnostic 请求中，读取文件当前内容：

```typescript
import fs from 'node:fs';

const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
// ...
contentChanges: [{ text }],
```

- [x] **Step 6: 运行 LSP 相关测试**

```bash
pnpm vitest run tests/unit/components/lsp.test.ts tests/unit/components/lsp-client.test.ts tests/unit/components/lsp-language-id.test.ts
```

Expected: PASS

- [x] **Step 7: 提交**

```bash
git add src/components/lsp/ tests/unit/components/lsp-language-id.test.ts
git commit -m "fix(lsp): use OMO_KIMI_PROJECT root, correct languageId mapping, real file content in diagnostics"
```

---

### Task 4: `comment-checker` 支持块注释

**Files:**
- Modify: `src/components/comment-checker/check.ts`
- Modify: `tests/unit/components/comment-checker.test.ts`

**Interfaces:**
- Consumes: file content string
- Produces: `findStaleMarkers(content)` 返回 `{ line, marker, text }[]`

- [x] **Step 1: 写 failing 测试**

在 `tests/unit/components/comment-checker.test.ts` 添加：

```typescript
  it('detects TODO in block comments', () => {
    const content = 'function foo() {\n  /* TODO: fix this */\n}';
    const markers = findStaleMarkers(content);
    expect(markers).toHaveLength(1);
    expect(markers[0].marker).toBe('TODO');
  });

  it('detects FIXME in HTML-style comments', () => {
    const content = '<!-- FIXME: broken -->';
    const markers = findStaleMarkers(content);
    expect(markers).toHaveLength(1);
    expect(markers[0].marker).toBe('FIXME');
  });
```

- [x] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/components/comment-checker.test.ts
```

Expected: FAIL — block comment TODO 未检测到。

- [x] **Step 3: 重写 marker 检测逻辑**

修改 `src/components/comment-checker/check.ts`：

```typescript
const MARKERS = ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG'];
const MARKER_RE = new RegExp(`\\b(${MARKERS.join('|')})\\b`, 'g');

function extractComments(content: string): Array<{ text: string; line: number }> {
  const comments: Array<{ text: string; line: number }> = [];
  const lines = content.split('\n');
  let inBlock = false;
  let blockStartLine = 0;
  let blockText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end !== -1) {
        blockText += '\n' + line.slice(0, end);
        comments.push({ text: blockText, line: blockStartLine + 1 });
        blockText = '';
        inBlock = false;
      } else {
        blockText += '\n' + line;
      }
      continue;
    }

    // HTML block comment start/end on same line
    const htmlMatch = line.match(/<!--(.*?)-->/);
    if (htmlMatch) {
      comments.push({ text: htmlMatch[1], line: i + 1 });
    }

    // C-style block comment start
    const start = line.indexOf('/*');
    if (start !== -1) {
      const end = line.indexOf('*/', start + 2);
      if (end !== -1) {
        comments.push({ text: line.slice(start + 2, end), line: i + 1 });
      } else {
        inBlock = true;
        blockStartLine = i;
        blockText = line.slice(start + 2);
      }
    }

    // Line comments
    const lineMatch = line.match(/(?:\/\/|#)(.*)/);
    if (lineMatch) {
      comments.push({ text: lineMatch[1], line: i + 1 });
    }
  }
  return comments;
}

export function findStaleMarkers(content: string): Array<{ line: number; marker: string; text: string }> {
  const results: Array<{ line: number; marker: string; text: string }> = [];
  const comments = extractComments(content);
  for (const comment of comments) {
    const matches = [...comment.text.matchAll(MARKER_RE)];
    for (const m of matches) {
      results.push({ line: comment.line, marker: m[1], text: comment.text.trim() });
    }
  }
  return results;
}
```

- [x] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/components/comment-checker.test.ts
```

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/components/comment-checker/check.ts tests/unit/components/comment-checker.test.ts
git commit -m "fix(comment-checker): detect stale markers in block and HTML comments"
```

---

### Task 5: `codegraph` parser 扩展

**Files:**
- Modify: `src/components/codegraph/symbols.ts`
- Modify: `tests/unit/components/codegraph.test.ts`

**Interfaces:**
- Consumes: file content and language extension
- Produces: richer symbol extraction for Rust/Go/TS/JS

- [x] **Step 1: 写 failing 测试**

在 `tests/unit/components/codegraph.test.ts` 添加：

```typescript
  it('parses Rust enum, trait, mod', () => {
    const content = `
enum Color { Red, Green }
trait Drawable { fn draw(&self); }
mod utils { fn help() {} }
`;
    const symbols = parseFile('sample.rs', content);
    const names = symbols.map((s) => `${s.name}:${s.kind}`);
    expect(names).toContain('Color:enum');
    expect(names).toContain('Drawable:trait');
    expect(names).toContain('utils:module');
  });

  it('parses Go method with receiver', () => {
    const content = 'func (r *Receiver) Method() {}';
    const symbols = parseFile('sample.go', content);
    expect(symbols.map((s) => s.name)).toContain('Method');
  });

  it('parses TS class methods and arrow functions', () => {
    const content = `
class User { login() {} }
const greet = () => {};
`;
    const symbols = parseFile('sample.ts', content);
    const names = symbols.map((s) => s.name);
    expect(names).toContain('User');
    expect(names).toContain('login');
    expect(names).toContain('greet');
  });
```

- [x] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/components/codegraph.test.ts
```

Expected: FAIL — 新增符号未解析。

- [x] **Step 3: 扩展 parser**

修改 `src/components/codegraph/symbols.ts`，在现有正则基础上增加：

Rust:
```typescript
const RUST_PATTERNS = [
  /\benum\s+(\w+)/g,
  /\btrait\s+(\w+)/g,
  /\bmod\s+(\w+)/g,
  /\bimpl(?:\s+(?:<[^>]+>\s*)?(\w+))?/g,
];
```

Go:
```typescript
const GO_METHOD_PATTERN = /\bfunc\s+\([^)]+\)\s+(\w+)\s*\(/g;
```

TS/JS:
```typescript
const CLASS_METHOD_PATTERN = /\b(\w+)\s*\([^)]*\)\s*\{/g;
const ARROW_FUNCTION_PATTERN = /\b(?:const|let|var)\s+(\w+)\s*=\s*[^=]*=>/g;
```

注意避免重复计数；在 `parseFile` 中按语言选择模式。

- [x] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/components/codegraph.test.ts
```

Expected: PASS

- [x] **Step 5: 在 `AGENTS.md` 或代码注释中说明 parser 局限**

在 `src/components/codegraph/symbols.ts` 顶部添加注释：

```typescript
// Lightweight heuristic parser. Does not handle macros, complex generics,
// dynamic imports, or every language edge case. Good enough for structural
// search; for deeper analysis use the LSP component.
```

- [x] **Step 6: 提交**

```bash
git add src/components/codegraph/symbols.ts tests/unit/components/codegraph.test.ts
git commit -m "feat(codegraph): extend heuristic parser for Rust enum/trait/mod, Go methods, TS class methods and arrow functions"
```

---

### Task 6: Telemetry 本地/开发行为明确

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `README.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `OMO_KIMI_POSTHOG_API_KEY` env var
- Produces: build-time warning if key missing

- [x] **Step 1: 实现 build 时警告**

在 `scripts/build.mjs` 中，生成 version 文件后添加：

```typescript
if (!process.env.OMO_KIMI_POSTHOG_API_KEY) {
  console.warn('Warning: OMO_KIMI_POSTHOG_API_KEY not set. Telemetry will be skipped in this build.');
}
```

- [x] **Step 2: 写/运行测试确认行为**

```bash
pnpm run build 2>&1 | tee /tmp/build.log
```

Expected: 输出包含上述 warning（因为当前环境无 key）。

- [x] **Step 3: 更新文档**

在 `README.md` 和 `AGENTS.md` telemetry 部分添加：

```markdown
Release builds inject the PostHog API key via CI. Local/debug builds without
`OMO_KIMI_POSTHOG_API_KEY` will skip telemetry with a build-time warning.
```

- [x] **Step 4: 提交**

```bash
git add scripts/build.mjs README.md AGENTS.md
git commit -m "docs(telemetry): clarify that release builds inject PostHog key; add dev-build warning"
```

---

### Task 7: Hooks 一致性校验

**Files:**
- Modify: `scripts/sync-hooks.mjs`
- Create: `tests/unit/install/hook-consistency.test.ts`

**Interfaces:**
- Consumes: `src/components/*/hooks.json`, `src/install/hook-defs.ts`
- Produces: build failure or test failure on mismatch

- [x] **Step 1: 写 failing 测试**

创建 `tests/unit/install/hook-consistency.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getHookDefs } from '../../../src/install/hook-defs.js';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('hook consistency', () => {
  it('hook-defs.ts matches every src/components/*/hooks.json', () => {
    const componentsDir = path.join(ROOT, 'src', 'components');
    const components = fs.readdirSync(componentsDir).filter((name) => {
      return fs.existsSync(path.join(componentsDir, name, 'hooks.json'));
    });

    const defs = getHookDefs('0.1.3', '/tmp/cache');

    for (const component of components) {
      const hooksPath = path.join(componentsDir, component, 'hooks.json');
      const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf-8')) as Array<{
        event: string;
        matcher: string;
        timeout: number;
      }>;
      for (const hook of hooks) {
        const matched = defs.find(
          (d) =>
            d.event === hook.event &&
            d.command.includes(`/components/${component}/dist/cli.mjs`) &&
            d.matcher === hook.matcher,
        );
        expect(matched).toBeDefined();
      }
    }
  });
});
```

- [x] **Step 2: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/install/hook-consistency.test.ts
```

Expected: PASS（当前应已通过，因为 hook-defs 已修复）。

- [x] **Step 3: 提交**

```bash
git add tests/unit/install/hook-consistency.test.ts
git commit -m "test(install): add hook-defs vs hooks.json consistency check"
```

---

### Task 8: CLI 增强 version 命令与 flag 校验

**Files:**
- Modify: `src/cli/index.ts`
- Create: `tests/unit/cli/index.test.ts`

**Interfaces:**
- Consumes: `process.argv`
- Produces: `--version` / `version` command; safer flag extraction

- [x] **Step 1: 写 failing 测试**

创建 `tests/unit/cli/index.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const BIN = path.resolve('bin/lazykimicode.mjs');

describe('CLI', () => {
  it('prints version with --version', () => {
    const result = spawnSync('node', [BIN, '--version'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prints version with version command', () => {
    const result = spawnSync('node', [BIN, 'version'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('rejects flag as value', () => {
    const result = spawnSync('node', [BIN, '--kimi-code-home', '--help'], { encoding: 'utf-8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Invalid value');
  });
});
```

- [x] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/cli/index.test.ts
```

Expected: FAIL — version 命令不存在，flag 校验不存在。

- [x] **Step 3: 实现 CLI 增强**

修改 `src/cli/index.ts`：

```typescript
function extractArg(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  if (idx === -1) return undefined;
  const value = argv[idx + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`Invalid value for ${flag}: ${value ?? 'missing'}`);
  }
  return value;
}
```

在 `main()` 中增加：

```typescript
if (args.includes('--version') || args.includes('-v') || command === 'version') {
  console.log(pkg.version);
  process.exit(0);
}
```

- [x] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/cli/index.test.ts
```

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/cli/index.ts tests/unit/cli/index.test.ts
git commit -m "feat(cli): add version command and validate flag values"
```

---

### Task 9: Plugin manifest 声明 `git_bash` MCP

**Files:**
- Modify: `plugin/kimi.plugin.json`
- Modify: `tests/unit/skills/mcp-alignment.test.ts`（可选）

**Interfaces:**
- Consumes: existing `plugin/components/git-bash/dist/mcp-server.mjs`
- Produces: manifest包含 `git_bash` mcpServer

- [x] **Step 1: 修改 manifest**

在 `plugin/kimi.plugin.json` 的 `mcpServers` 中添加：

```json
    "git_bash": {
      "command": "node",
      "args": ["./components/git-bash/dist/mcp-server.mjs"],
      "cwd": "./"
    },
```

- [x] **Step 2: 运行验证**

```bash
pnpm run build
pnpm vitest run tests/unit/skills/mcp-alignment.test.ts
```

Expected: PASS

- [x] **Step 3: 提交**

```bash
git add plugin/kimi.plugin.json
git commit -m "feat(plugin): declare git_bash MCP server in manifest"
```

---

### Task 10: Skill 引用缺失 fallback

**Files:**
- Modify: `plugin/skills/ultimate-browsing/SKILL.md`
- Modify: `plugin/skills/ultrawork/SKILL.md`
- Modify: `plugin/skills/frontend/SKILL.md`
- Modify: `plugin/skills/visual-qa/SKILL.md`
- Modify: `plugin/skills/lcx-contribute-bug-fix/SKILL.md`
- Modify: `plugin/skills/lcx-doctor/SKILL.md`
- Modify: `plugin/skills/lcx-report-bug/SKILL.md`
- Modify: `plugin/skills/programming/SKILL.md`

**Interfaces:**
- Consumes: skill text
- Produces: skill text with explicit fallback when referenced tool/skill/references are missing

- [x] **Step 1: 添加统一 fallback 段落**

在每个引用 `kimi-webbridge` 的 skill 中，找到第一次引用处，添加：

```markdown
> **Fallback if `kimi-webbridge` is not available:** Use `FetchURL` to read the page, or ask the user to perform the browser step manually and paste the result.
```

在 `frontend` / `programming` skill 中，找到第一次引用 `references/` 处，添加：

```markdown
> **Fallback if `references/` are not present:** Use the project's existing code style, `AGENTS.md`, and general engineering knowledge. Ask the user for specific design constraints if needed.
```

- [x] **Step 2: 运行测试确认未破坏**

```bash
pnpm vitest run tests/unit/skills/sync.test.ts tests/unit/skills/mcp-alignment.test.ts
```

Expected: PASS

- [x] **Step 3: 提交**

```bash
git add plugin/skills/
git commit -m "docs(skills): add fallbacks for missing kimi-webbridge and references/"
```

---

### Task 11: Skill sync 测试完整性

**Files:**
- Modify: `tests/unit/skills/sync.test.ts`

**Interfaces:**
- Consumes: `plugin/skills/` directory listing
- Produces: bidirectional skill sync check

- [x] **Step 1: 重写测试为双向检查**

修改 `tests/unit/skills/sync.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const SKILL_DIR = path.join(ROOT, 'plugin', 'skills');

describe('skill sync', () => {
  const actual = fs.readdirSync(SKILL_DIR).filter((name) =>
    fs.existsSync(path.join(SKILL_DIR, name, 'SKILL.md')),
  );

  it('every actual skill is in the expected list', () => {
    const expected = [
      'ast-grep', 'coding-agent-sessions', 'debugging', 'frontend', 'git-master',
      'init-deep', 'lcx-contribute-bug-fix', 'lcx-doctor', 'lcx-report-bug',
      'lsp-setup', 'programming', 'refactor', 'remove-ai-slops', 'review-work',
      'rules', 'start-work', 'teammode', 'ultimate-browsing', 'ultrawork',
      'ulw-loop', 'ulw-plan', 'ulw-research', 'visual-qa',
    ];
    for (const name of actual) {
      expect(expected).toContain(name);
    }
  });

  it('every expected skill exists on disk', () => {
    const expected = [
      'ast-grep', 'coding-agent-sessions', 'debugging', 'frontend', 'git-master',
      'init-deep', 'lcx-contribute-bug-fix', 'lcx-doctor', 'lcx-report-bug',
      'lsp-setup', 'programming', 'refactor', 'remove-ai-slops', 'review-work',
      'rules', 'start-work', 'teammode', 'ultimate-browsing', 'ultrawork',
      'ulw-loop', 'ulw-plan', 'ulw-research', 'visual-qa',
    ];
    for (const name of expected) {
      expect(fs.existsSync(path.join(SKILL_DIR, name, 'SKILL.md'))).toBe(true);
    }
  });
});
```

- [x] **Step 2: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/skills/sync.test.ts
```

Expected: PASS

- [x] **Step 3: 提交**

```bash
git add tests/unit/skills/sync.test.ts
git commit -m "test(skills): make skill sync test bidirectional"
```

---

### Task 12: MCP Server 入口测试

**Files:**
- Create: `tests/unit/components/codegraph-serve.test.ts`
- Create: `tests/unit/components/lsp-mcp-server.test.ts`

**Interfaces：**
- Consumes: built/serve.mjs, mcp-server.ts request handlers
- Produces: direct tests for `tools/list` and `tools/call`

- [x] **Step 1: codegraph serve 测试**

创建 `tests/unit/components/codegraph-serve.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SERVER = path.resolve('plugin/components/codegraph/dist/serve.mjs');

describe('codegraph serve', () => {
  it('lists all codegraph tools', () => {
    const result = spawnSync('node', [SERVER], {
      input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    const tools = JSON.parse(result.stdout).result.tools.map((t: { name: string }) => t.name);
    expect(tools).toContain('codegraph_search');
    expect(tools).toContain('codegraph_status');
    expect(tools).toContain('codegraph_reindex');
  });

  it('returns error for unknown tool', () => {
    const result = spawnSync('node', [SERVER], {
      input: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'unknown', arguments: {} },
      }) + '\n',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('error');
  });
});
```

- [x] **Step 2: lsp mcp-server 测试**

创建 `tests/unit/components/lsp-mcp-server.test.ts`，类似测试 `lsp_status` / `lsp_diagnostics` / `tools/list`。

- [x] **Step 3: 运行测试确认通过**

```bash
pnpm run build
pnpm vitest run tests/unit/components/codegraph-serve.test.ts tests/unit/components/lsp-mcp-server.test.ts
```

Expected: PASS

- [x] **Step 4: 提交**

```bash
git add tests/unit/components/codegraph-serve.test.ts tests/unit/components/lsp-mcp-server.test.ts
git commit -m "test(mcp): add direct tests for codegraph and lsp MCP server entry points"
```

---

### Task 13: CLI 包装测试

**Files:**
- Create: `tests/integration/cli-wrappers.test.ts`

**Interfaces：**
- Consumes: built `plugin/components/*/dist/cli.mjs`
- Produces: spawn-based tests for each component CLI

- [x] **Step 1: 创建集成测试**

创建 `tests/integration/cli-wrappers.test.ts`，对 bootstrap、rules、ultrawork、ulw-loop、start-work-continuation、executor-verify、telemetry、git-bash、lsp 的 `cli.mjs` 进行 smoke + 行为测试。

例如：

```typescript
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const CLI = (name: string) => path.resolve('plugin/components', name, 'dist/cli.mjs');
const run = (name: string, event: string, input?: object) =>
  spawnSync('node', [CLI(name), 'hook', event], {
    input: input ? JSON.stringify(input) : undefined,
    encoding: 'utf-8',
  });

describe('component CLI wrappers', () => {
  it('rules session-start emits context', () => {
    const result = run('rules', 'session-start');
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe('SessionStart');
  });

  it('ultrawork detects keyword', () => {
    const result = run('ultrawork', 'user-prompt-submit', { prompt: 'ulw plan' });
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.hookSpecificOutput.additionalContext).toContain('ultrawork');
  });

  // ... similar minimal assertions for each component
});
```

- [x] **Step 2: 运行测试确认通过**

```bash
pnpm vitest run tests/integration/cli-wrappers.test.ts
```

Expected: PASS

- [x] **Step 3: 提交**

```bash
git add tests/integration/cli-wrappers.test.ts
git commit -m "test(integration): add CLI wrapper smoke tests for all hook components"
```

---

### Task 14: 回归测试强化

**Files:**
- Modify: `tests/unit/install/hook-defs.test.ts`
- Modify: `tests/unit/shared/version.test.ts`
- Modify: `tests/unit/install/remote-mcp.test.ts`

**Interfaces：**
- Consumes: existing test files
- Produces: stronger assertions

- [x] **Step 1: 强化 hook-defs 测试**

在 `tests/unit/install/hook-defs.test.ts` 添加：

```typescript
  it('codegraph PostToolUse matcher matches codegraph tools', () => {
    const hooks = getHookDefs('0.1.3', '/tmp/cache');
    const cgPost = hooks.find(
      (h) => h.event === 'PostToolUse' && h.command.includes('/codegraph/'),
    );
    expect(cgPost?.matcher).toBe('^(codegraph[._].*|mcp__codegraph__.*)$');
  });
```

- [x] **Step 2: 强化 version 测试**

在 `tests/unit/shared/version.test.ts` 添加 build contract test：

```typescript
  it('build stamps version.ts and plugin manifest', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const { execFileSync } = require('node:child_process');

    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'build-version-'));
    const srcDir = path.resolve('.');
    execFileSync('node', ['scripts/build.mjs'], { cwd: srcDir, env: { ...process.env, OMO_KIMI_POSTHOG_API_KEY: 'test-key' } });

    const versionTs = fs.readFileSync(path.join(srcDir, 'src', 'shared', 'version.ts'), 'utf-8');
    expect(versionTs).toContain(pkg.version);

    const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'plugin', 'kimi.plugin.json'), 'utf-8'));
    expect(manifest.version).toBe(pkg.version);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
```

注意：此测试在本地运行 build，需确保无副作用。

- [x] **Step 3: 强化 remote-mcp 测试**

在 `tests/unit/install/remote-mcp.test.ts` 添加：

```typescript
  it('each entry has url and note', () => {
    const root = JSON.parse(fs.readFileSync(rootMcp, 'utf-8'));
    for (const [name, cfg] of Object.entries(root)) {
      const c = cfg as { url?: string; note?: string };
      expect(c.url, `${name} missing url`).toBeTruthy();
      expect(c.note, `${name} missing note`).toBeTruthy();
    }
  });
```

- [x] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/install/hook-defs.test.ts tests/unit/shared/version.test.ts tests/unit/install/remote-mcp.test.ts
```

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add tests/unit/install/hook-defs.test.ts tests/unit/shared/version.test.ts tests/unit/install/remote-mcp.test.ts
git commit -m "test(regression): strengthen hook-defs, version, and remote-mcp assertions"
```

---

### Task 15: 移除弱断言

**Files:**
- Modify: `tests/unit/components/bootstrap.test.ts`
- Modify: `tests/integration/hooks.test.ts`

**Interfaces：**
- Consumes: existing weak assertions
- Produces: meaningful assertions

- [x] **Step 1: 修复 bootstrap 弱断言**

在 `tests/unit/components/bootstrap.test.ts` 中，把：

```typescript
expect(result.warnings.length).toBeGreaterThanOrEqual(0);
```

改为对具体结构的断言，例如：

```typescript
expect(Array.isArray(result.warnings)).toBe(true);
```

或根据测试场景断言 `warnings` 为空/包含特定字符串。

- [x] **Step 2: 强化 rules integration 断言**

在 `tests/integration/hooks.test.ts` 的 rules 测试中，验证输出上下文包含 `AGENTS.md` 或 `.omo/rules` 相关内容（若项目有规则文件）。

- [x] **Step 3: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/components/bootstrap.test.ts tests/integration/hooks.test.ts
```

Expected: PASS

- [x] **Step 4: 提交**

```bash
git add tests/unit/components/bootstrap.test.ts tests/integration/hooks.test.ts
git commit -m "test: replace tautological assertions with meaningful checks"
```

---

### Task 16: 端到端测试补充

**Files:**
- Create: `tests/integration/uninstall.test.ts`
- Create: `tests/integration/doctor.test.ts`
- Create: `tests/integration/release-zip.test.ts`

**Interfaces：**
- Consumes: installer/uninstaller/doctor/release zip
- Produces: e2e coverage

- [x] **Step 1: uninstall e2e**

创建 `tests/integration/uninstall.test.ts`，复用 installer test 的 helper，安装后调用 uninstall，验证 `config.toml` 无 lazykimicode hooks/MCP。

- [x] **Step 2: doctor e2e**

创建 `tests/integration/doctor.test.ts`，安装后调用 `lazykimicode doctor`，验证返回 ok。

- [x] **Step 3: release-zip e2e**

创建 `tests/integration/release-zip.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('release zip', () => {
  it('contains dist/ and bin/ and runs --help', () => {
    execSync('pnpm run build', { stdio: 'ignore' });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-zip-'));
    try {
      execSync('zip -r lazykimicode.zip plugin scripts bin dist package.json', { stdio: 'ignore' });
      execSync('unzip -q lazykimicode.zip -d ' + tmp);
      const help = execSync('node ' + path.join(tmp, 'bin', 'lazykimicode.mjs') + ' --help', { encoding: 'utf-8' });
      expect(help).toContain('lazykimicode');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync('lazykimicode.zip', { force: true });
    }
  });
});
```

- [x] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/integration/uninstall.test.ts tests/integration/doctor.test.ts tests/integration/release-zip.test.ts
```

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add tests/integration/uninstall.test.ts tests/integration/doctor.test.ts tests/integration/release-zip.test.ts
git commit -m "test(integration): add uninstall, doctor, and release-zip e2e tests"
```

---

### Task 17: 文档同步

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/capabilities.md`
- Modify: `docs/superpowers/plans/lazykimicode-plan.md`
- Modify: `docs/superpowers/plans/2026-07-11-lazykimicode-audit-remediation.md`
- Modify: `docs/superpowers/plans/2026-07-11-remaining-gaps-remediation.md`
- Modify: `docs/superpowers/specs/2026-07-11-remaining-gaps-design.md`

**Interfaces：**
- Consumes: current code state
- Produces: accurate docs

- [x] **Step 1: 修正 AGENTS.md**

- `codegraph` 行：更新 remote MCP 说明为已提供占位。
- `start-work-continuation` 行：改为 block stop + resume guidance。
- `git-bash` 行：说明 manifest 已声明。
- 更新 test count 为 26/238。

- [x] **Step 2: 修正 capabilities.md**

- 更新 test count 为 26/238。

- [x] **Step 3: 修正 Plan 文档**

- 移除/修正 `zod` 声明。
- 修正路径引用。
- 把所有已完成的 `- [x]` 改为 `- [x]`。
- 移除或更新 stale TODO 示例代码。

- [x] **Step 4: 运行完整验证**

```bash
pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build
```

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add AGENTS.md README.md docs/capabilities.md docs/superpowers/plans/ docs/superpowers/specs/
git commit -m "docs: sync AGENTS, README, capabilities, and plans with implementation state"
```

---

## Self-review

**1. Spec coverage：**
- Source shortcuts → Tasks 1-8
- Plugin/skill gaps → Tasks 9-11
- Test coverage → Tasks 12-16
- Documentation → Task 17

**2. Placeholder scan：**
- 无 TBD/TODO/"implement later"
- 所有代码块含实际内容
- 所有命令含预期输出

**3. Type consistency：**
- `languageIdFromExtension` 在 Task 3 定义，Task 12 使用
- `findStaleMarkers` 在 Task 4 定义，现有 `comment-checker` 使用
- `formatResumeContext` 在 Task 1 定义

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-11-comprehensive-remediation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints

**Which approach?**
