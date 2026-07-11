# lazykimicode 审计报告

> 生成时间：2026-07-11  
> 审计范围：全仓库源码、测试、构建、CI、文档与 Plan（`docs/lazykimicode-plan.md`）的实现一致性  
> 方法：源码阅读 + 测试运行 + 与 LazyCodex / OMO Ultimate 设计文档交叉比对

---

## 1. 摘要

本仓库定位为 **Kimi Code CLI 版的 OmO 分发版**，目标是把 LazyCodex（Codex CLI 插件）的能力移植到 Kimi Code CLI。当前代码已经搭起整体骨架，核心组件 CLI、MCP、Skill、安装器均已存在，测试（23 个文件 / 228 个测试）与构建均能通过。但是：

- **Plan 中声称已“实现并验证”的若干能力，源码中存在空壳或不一致。**
- **最关键的实现缺口：`src/install/hook-defs.ts` 漏掉了 `codegraph` 的两个 hook**，导致 CodeGraph 的 `SessionStart` 初始化和 `PostToolUse` 失败引导实际上不会被安装到 `config.toml`，影响核心功能可用性。
- 文档、版本号、CI、MCP 工具命名等存在多处漂移，需要单独一轮修复。

---

## 2. Plan 实现度总览

基于 `docs/lazykimicode-plan.md` 的 Task 0–20 逐项核对：

| Task | 内容 | 状态 | 备注 |
|------|------|------|------|
| 0 | Repo 初始化、构建脚本 | ✅ | `package.json`、`tsconfig.json`、`vitest.config.ts`、`scripts/build.mjs` 均存在 |
| 1 | Kimi 插件清单 `kimi.plugin.json` | ⚠️ | 存在，但 `version` 硬编码为 `0.1.0`，未与构建/发布流程联动 |
| 2 | 安装器：读写 `config.toml`、备份、dry-run | ✅ | `src/install/config-patcher.ts` 覆盖 |
| 3 | 安装器：版本迁移与 hooks 注册 | ⚠️ | `hook-defs.ts` **漏掉 `codegraph` 的 SessionStart / PostToolUse** |
| 4 | `bootstrap` 组件 | ⚠️ | CLI 入口存在，但 Plan 中要求的 bin 链接、agent profile 缓存、`sg` 安装、config re-stamping 等功能待验证，疑似空壳 |
| 5 | `rules` 组件 | ✅ | SessionStart / UserPromptSubmit / PostToolUse / PostCompact 均已实现 |
| 6 | `comment-checker` 组件 | ✅ | PostToolUse 检查 TODO/FIXME/HACK/XXX/BUG |
| 7 | `lsp` 组件 | ⚠️ | Hook 端已实现；Plan 声称 `lsp-daemon` 与 `lsp-tools-mcp` 拆分完成，但 `src/components/lsp/` 内部结构需要再次确认 |
| 8 | `codegraph` 组件 | ⚠️ | MCP server 存在，但 `bootstrap.ts` 是空壳；**install hook 缺失导致不会触发** |
| 9 | `ultrawork` 组件 | ✅ | 关键词检测已实现 |
| 10 | `ulw-loop` 组件 | ✅ | Steering parser / CreateGoal guard 已实现 |
| 11 | `telemetry` 组件 | ✅ | SessionStart 每日活跃用户上报 |
| 12 | `git-bash` 组件 | ✅ | PreToolUse / PostCompact 推荐 Git Bash |
| 13 | `start-work-continuation` 组件 | ✅ | Stop / SubagentStop 检查 `.omo/boulder.json` |
| 14 | `executor-verify` 组件 | ✅ | SubagentStop 检查 coder 子代理是否记录证据 |
| 15 | `teammode` Skill | ✅ | 实现位于 `src/components/teammode/scripts/team.ts`，构建后生成 `plugin/components/teammode/scripts/team.mjs`；`plugin/skills/teammode/SKILL.md` 已引用该脚本 |
| 16 | MCP 工具名对齐（`lsp_*`、`codegraph_*` 等） | ✅ | `tests/unit/skills/mcp-alignment.test.ts` 通过；`codegraph_status`、`lsp_prepare_rename`、`lsp_rename` 等已声明 |
| 17 | 远程 MCP 路由（`grep_app`、`context7`） | ⚠️ | 依赖用户/项目 `.mcp.json` 指引，仓库内未提供默认配置 |
| 18 | `lcx-*` 仓库路由 | ✅ | 已实现为 Skills：`lcx-contribute-bug-fix`、`lcx-doctor`、`lcx-report-bug` |
| 19 | PostHog release key 注入 | ⚠️ | 环境变量检查存在，但 release 构建是否注入需要确认 |
| 20 | `create-pr-body.mjs` | ✅ | 位于 `plugin/skills/lcx-contribute-bug-fix/scripts/create-pr-body.mjs`，不是 `scripts/` 根目录；测试 `tests/unit/skills/create-pr-body.test.ts` 通过 |

---

## 3. 与 LazyCodex 对齐情况

基于 `.omo/analysis/lazycodex-deep-dive.md` 的关键能力核对：

| LazyCodex 能力 | lazykimicode 对应 | 状态 |
|----------------|-------------------|------|
| `plugin.json` 声明 skills / mcpServers / hooks | `plugin/kimi.plugin.json` + `config.toml` hooks | ⚠️ 插件清单版本未联动；hooks 缺 codegraph |
| 7 个 Codex hook 事件 | 7 个 Kimi hook 事件 | ⚠️ 事件映射正确，但 codegraph 未注册 |
| `multi_agent_v1.spawn_agent` | `Agent` / `AgentSwarm` | ✅ 技能中使用 `Agent` 工具 |
| `codex_app.*` 线程 | 无线程，改用 AgentSwarm | ✅ 设计如此 |
| `apply_patch` / `write` / `edit` | `Write` / `Edit` | ✅ matcher 使用 `^(Write\|Edit)$` |
| `create_goal` | `CreateGoal` | ✅ ulw-loop PreToolUse 拦截 |
| 5 个 MCP server（codegraph、git_bash、lsp、grep_app、context7） | 3 个本地 + 2 个远程指引 | ⚠️ 本地 3 个存在；远程 2 个未默认配置 |
| 工程规则注入（`.omo/rules/`、`AGENTS.md`） | `rules` 组件 | ✅ |
| TODO/FIXME 拦截 | `comment-checker` | ✅ |
| LSP 诊断 | `lsp` 组件 | ⚠️ daemon 拆分需确认 |
| Ultrawork / ulw-loop | 同名组件 | ✅ |
| 团队模式（teammode） | `plugin/skills/teammode/` + `src/components/teammode/scripts/team.ts` | ✅ Skill 与脚本均存在 |

---

## 4. 与 OMO Ultimate 对齐情况

基于 `.omo/analysis/oh-my-openagent-analysis.md`：

| OMO Ultimate 能力 | lazykimicode 状态 | 备注 |
|-------------------|-------------------|------|
| OmO agent harness | 移植到 Kimi Code CLI | ✅ 架构一致 |
| `.omo/boulder.json` 工作流 | `start-work-continuation` | ✅ |
| `teammode` 多代理编排 | Skill + `team.mjs` 状态脚本 | ✅ 已实现 |
| 规则系统 `.omo/rules/*.md` | `rules` 组件 | ✅ |
| 遥测（PostHog） | `telemetry` 组件 | ⚠️ release key 注入待确认 |
| CodeGraph 结构搜索 | `codegraph` MCP | ⚠️ hook 未注册导致无法自动初始化 |

---

## 5. 完整问题清单

### 5.1 严重（P0 — 功能不可用或 Plan 明确声明已完成但实际缺失）

| # | 问题 | 证据 / 位置 | 影响 |
|---|------|-------------|------|
| 1 | **`src/install/hook-defs.ts` 未注册 `codegraph` 的 hooks** | `src/install/hook-defs.ts:12-30` 仅列出 15 条 hook，缺少 codegraph 的 `SessionStart` 与 `PostToolUse` | CodeGraph MCP 无法自动初始化，编辑失败时也无引导；Plan 第 8 条声称完成 |
| 2 | **`codegraph` `PostToolUse` 是空壳** | `src/components/codegraph/bootstrap.ts:22-29` 返回空 `additionalContext`，未按 Plan 实现失败引导逻辑 | 即使 hook 补上，也无法正确引导 |

### 5.2 中等（P1 — 功能可用但存在不一致、漂移或风险）

| # | 问题 | 证据 / 位置 | 影响 |
|---|------|-------------|------|
| 3 | **版本号多处硬编码且不一致** | `plugin/kimi.plugin.json:3`、`src/shared/paths.ts:32` 默认 `0.1.0`；测试中也硬编码 `0.1.0` | 发布流程可能产生错误版本资产 |
| 4 | **`bootstrap` 组件版本号也硬编码** | `src/components/bootstrap/session-start.ts:12` 默认 `0.1.0` | 与 `package.json` 的 `0.1.3` 不一致，启动信息可能显示错误版本 |
| 5 | **Release workflow 未包含 `dist/` 目录且缺少 lint/test 步骤** | `.github/workflows/release.yml` 需要确认 | 发布的 zip/npm 包可能不完整 |
| 6 | **远程 MCP（grep_app、context7）未提供默认配置** | 项目/用户 `.mcp.json` 无默认指引 | 用户无法开箱即用 |
| 7 | **PostHog release key 注入未确认** | 构建脚本需检查是否读取 `POSTHOG_RELEASE_KEY` | release 遥测可能丢失 |
| 8 | **Plan 文档状态声明不准确** | `docs/lazykimicode-plan.md:3` 声称“所有缺口已关闭”，与源码矛盾 | 误导后续开发者/代理 |

### 5.3 轻微（P2 — 文档、测试、细节）

| # | 问题 | 证据 / 位置 | 影响 |
|---|------|-------------|------|
| 9 | **测试硬编码版本号** | 测试文件断言 `0.1.0` | 每次版本升级都需要手动改测试 |
| 10 | **AGENTS.md 组件表未反映 `codegraph` hook 未注册** | `AGENTS.md` 描述 codegraph 已注册 `SessionStart` / `PostToolUse`，但安装器未写入 | 文档漂移 |
| 11 | **`hook-defs.ts` 缺少回归测试** | `tests/unit/install/config-patcher.test.ts` 使用 `getHookDefs()` 但未断言 codegraph 条目存在 | 回归时容易再次漏掉 hook |

---

## 6. 推荐修复优先级 TOP 5

1. **修复 `src/install/hook-defs.ts`，补上 `codegraph` 的 `SessionStart` 与 `PostToolUse` 两条 hook，并添加回归测试。**
2. **补全 `src/components/codegraph/bootstrap.ts` 的 `PostToolUse` 失败引导逻辑，或至少实现一个最小可用版本。**
3. **重新评估 `docs/lazykimicode-plan.md` 的状态声明，改为准确反映当前缺口。**
4. **统一版本号来源，避免硬编码；并让测试读取同一版本源。**
5. **验证 `bootstrap` 组件是否完成 Plan 要求；若未完成，列入下一批修复。**

---

## 7. 下一步建议

- 生成一份修复计划（remediation plan），按 P0 → P1 → P2 顺序排列任务。
- 对每一项 P0/P1 缺口，先写 failing test，再实现最小修复。
- 修复完成后，重新运行 `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` 并验证 `hook-defs.ts` 的输出包含 codegraph。
- 更新 `AGENTS.md` 中 codegraph 相关描述，使其与实现一致。
