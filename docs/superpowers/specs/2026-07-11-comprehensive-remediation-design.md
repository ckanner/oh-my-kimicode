# lazykimicode 全面修复设计

> **Scope:** 修复上一轮 comprehensive review 中发现的所有源码捷径、plugin/skill 缺口、测试覆盖不足、文档漂移问题。
> **Status:** Approved and implemented.

---

## 1. Goal

对 review 中列出的全部问题逐项修复或给出等效的工程处理，确保：

1. 源码实现与其在 `AGENTS.md` / Plan 中的宣称一致，无 stub、无捷径。
2. Plugin manifest、skills、hooks 与实际能力一致。
3. 测试覆盖到 CLI / MCP 边界，回归测试能真正防止回退。
4. 文档（README、AGENTS.md、capabilities.md、Plan）与代码状态一致，无过时声明。

---

## 2. Source Code Fixes

### 2.1 `start-work-continuation`：实现真正的 resume

**问题：** 当前只 block stop，不会 resume。

**设计：**
- 在 `.omo/boulder.json` 存在未完成任务时，`runStop` / `runSubagentStop` 除了 `decision: 'block'` 外，返回 `additionalContext` 包含：
  - 未完成任务清单
  - 建议的下一步动作
  - 明确指令：“请继续完成这些任务后再结束会话。”
- 当用户没有主动要求 stop 而是会话因其他原因中断后恢复时，`SessionStart` 的 `rules` hook 或 bootstrap 应检测 `.omo/boulder.json` 并提示继续（此部分 `rules` 已能读取项目文件，可复用）。
- 测试：添加 integration test，创建含未完成任务 `boulder.json`，验证 hook 返回 `decision: 'block'` 且上下文包含任务标题。

### 2.2 `git-bash` MCP：`findBashPath` 真实校验

**问题：** `try` 块直接返回字符串，未检查文件是否存在。

**设计：**
- 使用 `fs.existsSync(candidate)` 逐个检查候选路径。
- 候选顺序：Git Bash (`C:\Program Files\Git\bin\bash.exe`, `C:\Program Files (x86)\Git\bin\bash.exe`) → WSL → `bash.exe` on PATH。
- 找不到时返回 `null`，MCP server 返回清晰错误。
- 测试：mock `fs.existsSync` 验证路径查找顺序；在 Windows 集成路径上补充测试。

### 2.3 LSP：统一 project root 与 languageId

**问题：**
- `diagnostics.ts` 与 `mcp-server.ts` 使用 `process.cwd()`。
- stateless fallback 的 `languageId` 映射错误（`ts` → 应为 `typescript`）。
- diagnostics 发送空 `contentChanges`。

**设计：**
- 所有 LSP 入口读取 `OMO_KIMI_PROJECT`（默认 `process.cwd()`）作为 root URI，并统一传到 handler。
- 新增 `languageIdFromExtension(ext)` 函数，映射：
  - `ts`/`tsx` → `typescript`/`typescriptreact`
  - `js`/`jsx` → `javascript`/`javascriptreact`
  - `py` → `python`, `go` → `go`, `rs` → `rust`, `md` → `markdown`, 其余 fallback 到 `plaintext`。
- diagnostics 在调用 `textDocument/didChange` 前读取文件当前内容，发送完整 `textDocument/didOpen` + `contentChanges`。
- 测试：
  - 单元测试 `languageIdFromExtension`
  - mock transport 验证 diagnostics 发送的 `contentChanges` 包含真实文件内容
  - 验证 root URI 来自 `OMO_KIMI_PROJECT`

### 2.4 `comment-checker`：支持块注释

**问题：** 正则只匹配行内/行尾注释，不匹配 `/* TODO */`。

**设计：**
- 重写检测逻辑：先按语言提取所有注释文本（行注释 + 块注释），再在注释文本中搜索 `TODO|FIXME|HACK|XXX|BUG`。
- 语言注释提取：
  - `//` / `#` 行注释
  - `/* ... */` 块注释（支持嵌套简单的 C 风格）
  - `<!-- ... -->` HTML/XML
  - `"""..."""` / `'''...'''` Python docstring（可选，避免误报）
- 报告时附带行号。
- 测试：添加 `/* TODO */`、`<!-- FIXME -->`、混合注释的通过/失败用例。

### 2.5 `codegraph` parser：在能力范围内提升并文档化局限

**问题：** 纯正则解析，能力有限。

**设计：**
- 不引入新依赖（避免 tree-sitter 等重型依赖）。
- 扩展正则以覆盖更多常见模式：
  - Rust：`enum`, `trait`, `mod`, `impl Trait for`
  - Go：方法接收者 `func (r *Receiver) Method()`
  - TS/JS：class methods、object method shorthand、arrow functions 在变量声明中
- 明确文档化：parser 是轻量启发式，不支持宏、复杂泛型、动态代码等。
- 测试：为上述新增模式添加用例。

### 2.6 Telemetry：本地/开发环境行为明确

**问题：** placeholder key 导致普通安装 telemetry 恒为 skipped。

**设计：**
- 保持 CI release workflow 的 `sed` 替换机制不变。
- 在 `scripts/build.mjs` 中增加一个 **dev build 警告**：如果 `OMO_KIMI_POSTHOG_API_KEY` 环境变量未设置，打印 `telemetry API key not injected; telemetry will be skipped in this build`。
- 在 `README.md` / `AGENTS.md` 中说明：release build 才会注入真实 key；本地构建 telemetry 默认不发送。
- 测试：验证 `OMO_KIMI_POSTHOG_API_KEY` 存在时 `captureEvent` 不 skip。

### 2.7 `hook-defs.ts` 与 `hooks.json` 一致性校验

**问题：** 手写数组可能再次漂移。

**设计：**
- 在 `scripts/sync-hooks.mjs` 或 build 脚本中增加一致性检查：
  - 读取 `src/components/*/hooks.json`
  - 与 `src/install/hook-defs.ts` 返回的 hooks 列表比较
  - 不一致时 build 失败并打印差异
- 或者让 `getHookDefs()` 在 build 时从 `plugin/hooks/*.json` 生成（更彻底，但改动较大）。
- 推荐方案：**build-time consistency check**，改动最小。

### 2.8 CLI 增强

**问题：** 缺少 `version` 命令，flag 解析有缺陷。

**设计：**
- 添加 `lazykimicode version` / `lazykimicode -v` / `--version`，输出 `package.json` version。
- `extractArg` 检查 `argv[idx + 1]` 不以 `-` 开头。
- 测试：CLI 单元测试覆盖 version 和非法 flag。

---

## 3. Plugin / Skill Fixes

### 3.1 `git_bash` MCP manifest 声明

**问题：** `plugin/kimi.plugin.json` 没声明 `git_bash`，但文档说它是 plugin MCP。

**设计：**
- 在 `plugin/kimi.plugin.json` 的 `mcpServers` 中添加 `git_bash`：
  ```json
  "git_bash": {
    "command": "node",
    "args": ["./components/git-bash/dist/mcp-server.mjs"],
    "cwd": "./"
  }
  ```
- 由于它只在 Windows 有意义，skillInstructions / AGENTS.md 保持 “Windows 优先使用 git_bash MCP” 的提示。
- 测试：验证 `plugin/kimi.plugin.json` 包含 `git_bash`。

### 3.2 `kimi-webbridge` skill 处理

**问题：** 多个 skill 引用它，但仓库没提供。

**设计：**
- 方案 A（推荐）：不复制整个 webbridge skill 进来（避免维护外部技能）。
- 方案 B：在相关 skill 中把 “if available” 改为明确 fallback：
  - 如果没有 `kimi-webbridge`，使用 `FetchURL` / `WebSearch` 工具完成等效操作，或提示用户浏览器步骤无法自动执行。
- 对所有引用 `kimi-webbridge` 的 SKILL.md 增加统一 fallback 段落。

### 3.3 `frontend` / `programming` skill 引用缺失 references

**问题：** skill 指示 “READ references/... FIRST”，但 references 不存在。

**设计：**
- 给这些 skill 增加“如果 references 目录不存在”的 fallback：
  - 使用项目已有文件、通用知识、或要求用户提供设计资料。
- 不尝试凭空创建大量 reference 文档（超出范围）。

### 3.4 Skill sync 测试完整性

**问题：** `tests/unit/skills/sync.test.ts` 的 `EXPECTED_SKILLS` 漏了 `rules`。

**设计：**
- 让测试动态读取 `plugin/skills/` 目录，断言每个实际存在的 skill 都在预期列表中，反之亦然（双向检查）。

---

## 4. Test Coverage Improvements

### 4.1 MCP Server 入口测试

为以下文件添加直接测试：
- `src/components/codegraph/serve.mjs`：测试 `tools/list` 返回 9 个工具，`tools/call` 对 `codegraph_search` / `codegraph_status` / 未知工具的响应。
- `src/components/lsp/mcp-server.ts`：测试 7 个 LSP 工具的 list/call。
- `src/components/lsp/daemon.ts`：测试持久化 daemon 的 init/tool dispatch。

### 4.2 CLI 包装测试

对每个 `src/components/*/cli.ts` 增加基于 `spawnSync` 的测试，覆盖：
- 正确 event
- 未知 event 返回空上下文
- JSON parse error fail-open
- 至少一个真实行为验证

### 4.3 回归测试强化

- `hook-defs.test.ts`：
  - 动态读取 `plugin/hooks/*.json` 与 `getHookDefs()` 输出做 diff 比较
  - 断言 codegraph `PostToolUse` matcher 完全等于 `^(codegraph[._].*|mcp__codegraph__.*)$`
- `version.test.ts`：
  - 在临时目录运行 `scripts/build.mjs`，断言生成的 `version.ts` 和 `plugin/kimi.plugin.json` 与 `package.json` 一致
- `remote-mcp.test.ts`：
  - 断言每个 entry 包含 `url` 和 `note`

### 4.4 移除弱断言

- `bootstrap.test.ts` 中 `warnings.length >= 0` 替换为对具体 warning 结构的断言或至少 `Array.isArray`。
- `rules` integration 增加断言输出包含真实规则文本。

### 4.5 端到端测试

- 在 `tests/integration/` 增加：
  - `uninstall.test.ts`：验证 uninstall 后 config.toml 无 lazykimicode hooks/MCP。
  - `doctor.test.ts`：验证 doctor 在完整安装后返回 ok。
  - `release-zip.test.ts`：运行 `pnpm run build && zip ... && unzip && node bin/lazykimicode.mjs --help`。

---

## 5. Documentation Fixes

### 5.1 `AGENTS.md`

- `codegraph` 行：把 “remote MCP defaults not yet provided” 改为 “remote MCP defaults are provided as disabled placeholders in `.mcp.json` and `plugin/.mcp.json`; user must enable after adding API keys”。
- `git-bash` 行：说明 plugin manifest 已声明 `git_bash` MCP，Windows 安装器也会写入 `config.toml`。
- 组件表中的 `start-work-continuation`：把 “Resume work” 改为 “Block stop and prompt to resume when Boulder has unchecked tasks”。
- 更新 test count 为 38/220。

### 5.2 `docs/capabilities.md`

- 更新 “Latest result” 为 39 test files / 243 tests。

### 5.3 `docs/superpowers/plans/lazykimicode-plan.md`

- 移除 `zod` 用于 manifest/config validation 的声明，改为 “TOML parsing via smol-toml; zod is listed as a dependency but not currently used in source”。
- 修正文件路径引用（`docs/...` → `docs/superpowers/plans/...` 或不引用路径）。
- 把所有已完成的 Task checkbox 改为 `- [x]`。
- 移除或更新 `// TODO: send to PostHog` 和 `// TODO: add-member...` 代码示例（这些功能已实现）。

### 5.4 `docs/superpowers/plans/2026-07-11-lazykimicode-audit-remediation.md` 与 `2026-07-11-remaining-gaps-remediation.md`

- 把所有已完成的 checkbox 改为 `- [x]`。
- `2026-07-11-remaining-gaps-design.md` 状态改为 “Approved and implemented”。

### 5.5 `README.md`

- 确认安装说明、环境变量、MCP 描述与当前实现一致。
- 增加 telemetry 说明：release build 注入 PostHog key，本地构建默认不发送。

---

## 6. Out of Scope

- 重写 `codegraph` 为基于 tree-sitter 的解析器（仅做启发式增强 + 文档化局限）。
- 实现真正的浏览器自动化（`kimi-webbridge` 不随仓库提供，只做 fallback）。
- 引入 `zod` 做实体验证（仅修正文档声明）。
- 改写 Git 历史移除已删除的 docs（已在 `75a332c` 处理）。

---

## 7. Success Criteria

- [x] `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` 全部通过。
- [x] 新增测试 ≥ 30 个，覆盖 CLI/MCP 边界和强化回归。
- [x] `AGENTS.md`、`README.md`、`capabilities.md`、Plan 文档与代码一致。
- [x] 所有 review 中发现的问题都有对应修复或明确的文档化说明；剩余未决事项已在 `docs/superpowers/plans/audit-report.md` 与 `docs/superpowers/plans/2026-07-11-remaining-gaps-remediation.md` 中记录。
