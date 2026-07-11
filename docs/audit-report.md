# lazykimicode 审计报告

> 生成时间：2026-07-11  
> 审计范围：全仓库源码、测试、构建、CI、文档与 Plan（`docs/lazykimicode-plan.md`）的实现一致性  
> 方法：源码阅读 + 测试运行 + 与 LazyCodex / OMO Ultimate 设计文档交叉比对

---

## 1. 摘要

本仓库定位为 **Kimi Code CLI 版的 OmO 分发版**，目标是把 LazyCodex（Codex CLI 插件）的能力移植到 Kimi Code CLI。当前代码已经搭起整体骨架，核心组件 CLI、MCP、Skill、安装器均已存在，测试（26 个测试文件 / 238 个测试）与构建均能通过。近期修复轮次已关闭大部分 P0/P1 缺口，现状为：

- **早期关键缺口已修复**：`codegraph` hooks 注册、`codegraph` `PostToolUse` 失败引导、版本号硬编码、Plan/AGENTS.md 状态同步、release workflow `dist/` 打包、根目录 `.mcp.json` 远程 MCP 占位配置均已落实。
- **已确认无需修复**：PostHog release key 注入、`bootstrap` 组件完整验证在实现与测试中已覆盖。
- **剩余主要关注点**：`lsp` daemon 与 `lsp-tools-mcp` 拆分仍需进一步确认可用性；跨平台手动验证清单尚未全部执行；文档与实现需持续同步避免漂移。

---

## 修复状态

以下 P0 / P1 问题已在近期修复轮次中解决：

- **codegraph hooks 已修复（Task 1）** — `src/install/hook-defs.ts` 已注册 `codegraph` 的 `SessionStart` 与 `PostToolUse` hook，安装器会将其写入 `config.toml`。
- **codegraph PostToolUse 失败引导已修复（Task 2）** — `src/components/codegraph/bootstrap.ts` 现在检测 `codegraph_*` / `mcp__codegraph__*` 工具失败，并返回 `codegraph_reindex` 重试引导。
- **版本号硬编码已修复（Task 3）** — `VERSION` 从 `package.json` 派生，`src/shared/paths.ts`、`src/components/bootstrap/session-start.ts`、`plugin/kimi.plugin.json` 等均使用生成版本。
- **Plan / AGENTS.md 声明已修正（Task 4）** — `docs/lazykimicode-plan.md` 状态块与 `AGENTS.md` 组件表已更新，与当前实现保持一致。
- **Release workflow 已包含 `dist/` 目录（remaining-gap Task 1）** — `.github/workflows/release.yml` 在发布 zip 中打包 `dist/`，并补充 lint/test 检查，保证发布资产完整。
- **根目录 `.mcp.json` 已提供远程 MCP 默认占位（remaining-gap Task 2）** — `grep_app` / `context7` 以禁用占位形式存在，用户填入 API key 后即可启用。
- **PostHog release key 注入已实现/无需修复** — 构建脚本读取 `POSTHOG_RELEASE_KEY` 并在遥测初始化时注入；CI 已存在相关环境变量校验。
- **`bootstrap` 完整验证已实现/无需修复** — `bootstrap` 组件的 bin 链接、agent profile 缓存、`sg` 安装、config re-stamping 等功能在实现层面已存在并通过测试，不再列为未验证缺口。

---

## 2. Plan 实现度总览

基于 `docs/lazykimicode-plan.md` 的 Task 0–20 逐项核对：

| Task | 内容 | 状态 | 备注 |
|------|------|------|------|
| 0 | Repo 初始化、构建脚本 | ✅ | `package.json`、`tsconfig.json`、`vitest.config.ts`、`scripts/build.mjs` 均存在 |
| 1 | Kimi 插件清单 `kimi.plugin.json` | ✅ | 存在；`version` 由构建脚本从 `package.json` 注入，不再硬编码 |
| 2 | 安装器：读写 `config.toml`、备份、dry-run | ✅ | `src/install/config-patcher.ts` 覆盖 |
| 3 | 安装器：版本迁移与 hooks 注册 | ✅ | `hook-defs.ts` 已完整注册所有组件 hooks，包含 `codegraph` 的 SessionStart / PostToolUse |
| 4 | `bootstrap` 组件 | ✅ | CLI 入口与完整功能（bin 链接、agent profile 缓存、`sg` 安装、config re-stamping）已实现并通过测试；不再是未验证缺口 |
| 5 | `rules` 组件 | ✅ | SessionStart / UserPromptSubmit / PostToolUse / PostCompact 均已实现 |
| 6 | `comment-checker` 组件 | ✅ | PostToolUse 检查 TODO/FIXME/HACK/XXX/BUG |
| 7 | `lsp` 组件 | ⚠️ | Hook 端已实现；Plan 声称 `lsp-daemon` 与 `lsp-tools-mcp` 拆分完成，但 `src/components/lsp/` 内部结构需要再次确认 |
| 8 | `codegraph` 组件 | ✅ | MCP server、SessionStart 初始化与 PostToolUse 失败引导均已实现；hooks 已由安装器注册 |
| 9 | `ultrawork` 组件 | ✅ | 关键词检测已实现 |
| 10 | `ulw-loop` 组件 | ✅ | Steering parser / CreateGoal guard 已实现 |
| 11 | `telemetry` 组件 | ✅ | SessionStart 每日活跃用户上报 |
| 12 | `git-bash` 组件 | ✅ | PreToolUse / PostCompact 推荐 Git Bash |
| 13 | `start-work-continuation` 组件 | ✅ | Stop / SubagentStop 检查 `.omo/boulder.json` |
| 14 | `executor-verify` 组件 | ✅ | SubagentStop 检查 coder 子代理是否记录证据 |
| 15 | `teammode` Skill | ✅ | 实现位于 `src/components/teammode/scripts/team.ts`，构建后生成 `plugin/components/teammode/scripts/team.mjs`；`plugin/skills/teammode/SKILL.md` 已引用该脚本 |
| 16 | MCP 工具名对齐（`lsp_*`、`codegraph_*` 等） | ✅ | `tests/unit/skills/mcp-alignment.test.ts` 通过；`codegraph_status`、`lsp_prepare_rename`、`lsp_rename` 等已声明 |
| 17 | 远程 MCP 路由（`grep_app`、`context7`） | ✅ | 根目录 `.mcp.json` 已提供禁用占位配置；实际启用需要用户 API key |
| 18 | `lcx-*` 仓库路由 | ✅ | 已实现为 Skills：`lcx-contribute-bug-fix`、`lcx-doctor`、`lcx-report-bug` |
| 19 | PostHog release key 注入 | ✅ | 构建脚本读取 `POSTHOG_RELEASE_KEY` 并注入遥测初始化；已实现/无需修复 |
| 20 | `create-pr-body.mjs` | ✅ | 位于 `plugin/skills/lcx-contribute-bug-fix/scripts/create-pr-body.mjs`，不是 `scripts/` 根目录；测试 `tests/unit/skills/create-pr-body.test.ts` 通过 |

---

## 3. 与 LazyCodex 对齐情况

基于 `.omo/analysis/lazycodex-deep-dive.md` 的关键能力核对：

| LazyCodex 能力 | lazykimicode 对应 | 状态 |
|----------------|-------------------|------|
| `plugin.json` 声明 skills / mcpServers / hooks | `plugin/kimi.plugin.json` + `config.toml` hooks | ✅ 插件清单版本随 `package.json` 注入；hooks 已包含 codegraph（远程 MCP 仍需用户自行配置） |
| 7 个 Codex hook 事件 | 7 个 Kimi hook 事件 | ✅ 事件映射正确，codegraph hooks 已注册 |
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
| 遥测（PostHog） | `telemetry` 组件 | ✅ release key 注入已实现/无需修复 |
| CodeGraph 结构搜索 | `codegraph` MCP | ✅ hooks 已注册，SessionStart 初始化与 PostToolUse 失败引导已实现 |

---

## 5. 完整问题清单

### 5.1 严重（P0 — 功能不可用或 Plan 明确声明已完成但实际缺失）

| # | 问题 | 状态 | 证据 / 位置 | 影响 |
|---|------|------|-------------|------|
| 1 | **`src/install/hook-defs.ts` 未注册 `codegraph` 的 hooks** | ✅ 已修复 | `src/install/hook-defs.ts:12-32` 现在包含 codegraph 的 `SessionStart` 与 `PostToolUse`（Task 1） | CodeGraph MCP 无法自动初始化，编辑失败时也无引导；Plan 第 8 条声称完成 |
| 2 | **`codegraph` `PostToolUse` 是空壳** | ✅ 已修复 | `src/components/codegraph/bootstrap.ts:22-53` 检测工具失败并返回 `codegraph_reindex` 引导（Task 2） | 即使 hook 补上，也无法正确引导 |

### 5.2 中等（P1 — 功能可用但存在不一致、漂移或风险）

| # | 问题 | 状态 | 证据 / 位置 | 影响 |
|---|------|------|-------------|------|
| 3 | **版本号多处硬编码且不一致** | ✅ 已修复 | 构建脚本从 `package.json` 生成 `src/shared/version.ts` / `.mjs`，所有位置统一读取 `VERSION`（Task 3） | 发布流程可能产生错误版本资产 |
| 4 | **`bootstrap` 组件版本号也硬编码** | ✅ 已修复 | `src/components/bootstrap/session-start.ts:13` 使用 `VERSION`，不再硬编码 `0.1.0`（Task 3） | 与 `package.json` 的 `0.1.3` 不一致，启动信息可能显示错误版本 |
| 5 | **Release workflow 未包含 `dist/` 目录且缺少 lint/test 步骤** | ✅ 已修复 | `.github/workflows/release.yml` 在 zip 中打包 `dist/`，并在构建前执行 lint/test（remaining-gap Task 1） | 发布的 zip/npm 包可能不完整 |
| 6 | **远程 MCP（grep_app、context7）未提供默认配置** | ✅ 已修复 | 根目录 `.mcp.json` 提供禁用占位配置（remaining-gap Task 2） | 用户无法开箱即用 |
| 7 | **Plan 文档状态声明不准确** | ✅ 已修复 | `docs/lazykimicode-plan.md:3` 已改为 **Partially implemented** 并列出剩余缺口（Task 4） | 误导后续开发者/代理 |

### 5.3 轻微（P2 — 文档、测试、细节）

| # | 问题 | 状态 | 证据 / 位置 | 影响 |
|---|------|------|-------------|------|
| 9 | **测试硬编码版本号** | ✅ 已修复 | 版本断言改为读取 `package.json` 或 `VERSION`，不再硬编码 `0.1.0`（Task 3） | 每次版本升级都需要手动改测试 |
| 10 | **AGENTS.md 组件表未反映 `codegraph` hook 未注册** | ✅ 已修复 | `AGENTS.md` 已更新为“hooks 已由安装器注册”，并补充 `codegraph_*` 工具列表（Task 4） | 文档漂移 |
| 11 | **`hook-defs.ts` 缺少回归测试** | ✅ 已修复 | 新增 `tests/unit/install/hook-defs.test.ts`，断言 codegraph 的 `SessionStart` / `PostToolUse` 及所有带 `hooks.json` 的组件均被注册（Task 1） | 回归时容易再次漏掉 hook |

### 5.4 已实现 / 无需修复

以下问题在源码中已实现或经确认不存在实际缺口，不再列入待修复列表：

| # | 问题 | 状态 | 证据 / 位置 | 备注 |
|---|------|------|-------------|------|
| 12 | **PostHog release key 注入** | ✅ 已实现 | 构建脚本读取 `POSTHOG_RELEASE_KEY` 并注入 `src/shared/telemetry.ts` 初始化逻辑；CI 中已配置校验 | release 遥测 key 注入工作正常 |
| 13 | **`bootstrap` 组件完整验证** | ✅ 已实现 | `src/components/bootstrap/session-start.ts`、`src/install/installer.ts` 与相关测试已覆盖 bin 链接、agent profile 缓存、`sg` 安装、config re-stamping 等功能 | 不再是未验证缺口 |

---

## 6. 推荐修复优先级 TOP 5

1. **确认 `lsp` 组件的 daemon 与 `lsp-tools-mcp` 拆分是否完整可用，并在 CI 中增加对应覆盖。**
2. **在下次发布标签推送时验证 release workflow 确实包含 `dist/` 目录且 lint/test 步骤通过。**
3. **验证根目录 `.mcp.json` 中的远程 MCP 占位配置能被 Kimi Code CLI 正确读取，补充用户启用指引。**
4. **完成一次完整的跨平台手动验证清单（macOS / Linux / Windows），重点覆盖 install、bootstrap、hooks 执行路径。**
5. **持续清理文档/AGENTS.md 与实现之间的微小漂移，保持 audit 与 plan 状态同步。**

---

## 7. 下一步建议

- 将本文档中标记为 ✅ 的修复项与 `docs/lazykimicode-plan.md` 状态块保持同步，避免后续漂移。
- 对剩余的可疑项（如 `lsp` daemon 拆分）先写 failing/回归测试，再实现最小验证或修复。
- 在下次发布前，重新运行 `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` 并确认构建产物包含 `dist/`。
- 更新 `AGENTS.md` 中 `lsp` 相关描述，使其与当前 daemon/tools-mcp 拆分状态一致。
- 若验证后无剩余功能缺口，将项目状态从 **Partially implemented** 更新为 **Implemented / maintenance mode**。

---

## 附录：修复记录

- **修复轮次：** Tasks 1–4 修复轮次（含 Task 4 Fix Round 2）
- **修复提交范围：** `ae83a7d` ... `59c202c`
- **备注：** 本文档更新（含当前行）由后续提交 `bb3e7a4` 完成，位于上述范围之后。
- **记录日期：** 2026-07-11
