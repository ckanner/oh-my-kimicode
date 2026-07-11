# lazykimicode 剩余缺口修复设计

> **Scope:** 修复审计报告 `docs/superpowers/plans/audit-report.md` 中尚未关闭、且经复核后确实需要改动的剩余缺口。
> **Status:** Approved and implemented.

---

## 1. Goal

完成以下两项真实缺口修复，并同步更新文档：

1. **Release workflow 发布的 zip 缺少 `dist/` 目录**，导致 GitHub Release 下载包无法运行。
2. **项目根目录缺少 `.mcp.json` 默认远程 MCP 配置**，用户打开新项目时看不到 `grep_app` / `context7` 占位指引。

同时澄清/移除以下两项已不存在的缺口：

- PostHog release key 注入：已实现，应从剩余缺口列表移除。
- `bootstrap` 组件完整功能验证：已实现，应从剩余缺口列表移除。

---

## 2. Background

### 2.1 Release zip 现状

`.github/workflows/release.yml:31`：

```yaml
- run: zip -r lazykimicode.zip plugin scripts bin package.json
```

`bin/lazykimicode.mjs` 是入口包装脚本，实际调用 `dist/cli/index.mjs`。zip 包若不含 `dist/`，解压后 `npx lazykimicode` / `node bin/lazykimicode.mjs install` 会失败。

### 2.2 远程 MCP 现状

- `plugin/.mcp.json` 已包含 `grep_app` 和 `context7` 的占位配置（`enabled: false`，附带 `note`）。
- 安装器会在用户 `~/.kimi-code/config.toml` 中写入注释形式的占位块。
- 但项目根目录没有 `.mcp.json`，用户在新仓库中不会自动获得远程 MCP 指引。

### 2.3 已实现但误标为缺口的项

- **PostHog release key 注入**：`.github/workflows/release.yml:21-27` 已通过 `sed` 在 CI 中将 `phc_placeholder_replace_in_build` 替换为 `secrets.OMO_KIMI_POSTHOG_API_KEY`。
- **`bootstrap` 组件**：`src/components/bootstrap/provision.ts` 已实现 bin 链接、agent profile 缓存、`sg` 安装与失败回退。

---

## 3. Design

### 3.1 Release workflow：zip 包含 `dist/`

**改动：**

修改 `.github/workflows/release.yml:31`：

```yaml
- run: zip -r lazykimicode.zip plugin scripts bin dist package.json
```

**原因：**

`pnpm run build` 在 zip 打包前已经生成 `dist/cli/index.mjs`，`bin/lazykimicode.mjs` 依赖该文件。包含 `dist/` 后，GitHub Release 的 zip 包可直接使用。

**验证：**

- 本地运行 `pnpm run build` 后执行 `zip -r lazykimicode.zip plugin scripts bin dist package.json`。
- 解压到临时目录，运行 `node bin/lazykimicode.mjs --help`，应正常输出帮助信息。

---

### 3.2 远程 MCP 默认配置：项目根目录 `.mcp.json`

**改动：**

在项目根目录新建 `.mcp.json`，内容与 `plugin/.mcp.json` 一致：

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

**原因：**

Kimi Code CLI 会读取项目根目录的 `.mcp.json` 作为项目级 MCP 配置。提供默认占位文件后，用户打开仓库即可在 MCP 列表中看到 `grep_app` / `context7` 的指引，且默认 `enabled: false` 不会触发实际调用。

**验证：**

- 文件存在且为合法 JSON。
- `pnpm test` 仍通过（新增文件不影响现有测试）。

---

### 3.3 文档同步

**改动：**

更新 `docs/superpowers/plans/audit-report.md` 和 `docs/superpowers/plans/lazykimicode-plan.md`：

1. 在 `docs/superpowers/plans/audit-report.md` 的“修复状态”章节中：
   - 标记 release workflow 缺 `dist/` 为待修复（或修复后标记为已修复）。
   - 标记远程 MCP 默认配置为待修复（或修复后标记为已修复）。
   - 移除 PostHog release key 注入和 bootstrap 完整验证的缺口（标记为“已实现/无需修复”）。

2. 在 `docs/superpowers/plans/lazykimicode-plan.md` 状态块中：
   - 移除 PostHog 和 bootstrap 的剩余缺口描述。
   - 更新 release workflow 和远程 MCP 缺口状态。

---

## 4. Out of Scope

- 不修改 `plugin/.mcp.json` 的内容（已足够作为占位）。
- 不改变 PostHog 注入机制（当前 `sed` 方案已工作）。
- 不扩展 `bootstrap` 功能（当前实现已满足 Plan 要求）。
- 不修改 `.github/workflows/release.yml` 中除 zip 列表外的其他步骤。

---

## 5. Success Criteria

- [x] `.github/workflows/release.yml` 的 zip 命令包含 `dist/`。
- [x] 项目根目录存在 `.mcp.json`，内容与 `plugin/.mcp.json` 一致。
- [x] `docs/superpowers/plans/audit-report.md` 和 `docs/superpowers/plans/lazykimicode-plan.md` 中的缺口列表反映真实状态。
- [x] `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` 全部通过。
