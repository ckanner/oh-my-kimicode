---
name: lsp-setup
description: "Configure a Language Server (LSP) for a specific language so lazykimicode diagnostics, go-to-definition, find-references, and rename work. Use when you need to: configure LSP, lsp setup, set up or install a language server, fix 'no LSP server configured' / 'server not installed', choose between servers (basedpyright vs pyright vs ty vs ruff), or wire OMO_KIMI_LSP_COMMAND / OMO_KIMI_LSP_ARGS. Routes by file extension to references/<language>/README.md for the exact builtin server, per-OS install commands (macOS/Linux/Windows), config snippets, initialization options, alternatives, and troubleshooting. Covers typescript, python, go, rust, c/c++, java, kotlin, c#/razor, swift, ruby, php, dart, elixir, zig, lua, bash, yaml, terraform, haskell, julia."
type: prompt
whenToUse: When setting up or troubleshooting LSP diagnostics for a project.
---

# LSP Setup

Configure the right Language Server for a project so the LSP MCP tools
(`lsp_diagnostics`, `lsp_goto_definition`, `lsp_find_references`) actually
work. This skill is an index: detect what a project needs, install the server,
wire the lazykimicode harness, then verify with a real roundtrip.

The list of servers we ship as **builtin** is the source of truth in the
reference table below and in `src/components/lsp/`. The per-language references
mirror it.

---

## PHASE 0 — LANGUAGE GATE (run first)

Identify the language from the file extension, then **read the matching
reference before installing or configuring anything**.

| Extension(s) | Reference |
|---|---|
| `.ts .tsx .js .jsx .mjs .cjs .mts .cts .vue .svelte .astro` | `references/typescript/README.md` |
| `.py .pyi` | `references/python/README.md` |
| `.go` | `references/go/README.md` |
| `.rs` | `references/rust/README.md` |
| `.c .cpp .cc .cxx .h .hpp .hh .hxx` | `references/c-cpp/README.md` |
| `.java` | `references/java/README.md` |
| `.kt .kts` | `references/kotlin/README.md` |
| `.cs .razor .cshtml` | `references/csharp/README.md` |
| `.swift` | `references/swift/README.md` |
| `.rb .rake .gemspec .ru` | `references/ruby/README.md` |
| `.php` | `references/php/README.md` |
| `.dart` | `references/dart/README.md` |
| `.ex .exs` | `references/elixir/README.md` |
| `.zig .zon` | `references/zig/README.md` |
| `.lua` | `references/lua/README.md` |
| `.sh .bash .zsh .ksh` | `references/bash/README.md` |
| `.yaml .yml` | `references/yaml/README.md` |
| `.tf .tfvars` | `references/terraform/README.md` |
| `.hs .lhs` | `references/haskell/README.md` |
| `.jl` | `references/julia/README.md` |

---

## WORKFLOW — detect → install → configure → verify

### 1. Detect

Scan the project to see which languages are present and whether each server is
installed and configured.

Inspect manually:

```bash
# List language files in the project
find <projectDir> -type f \( -name '*.ts' -o -name '*.py' -o -name '*.go' -o -name '*.rs' \) | head -50

# Check whether a server is installed
command -v typescript-language-server
command -v pyright
command -v gopls
command -v rust-analyzer
```

For each detected language report: builtin server id, the executable it needs
on `PATH`, whether that executable is installed, an install hint, and whether a
project config already references it.

### 2. Install

Open `references/<language>/README.md` and run the install command for your OS.
Then confirm the executable resolves:

```bash
command -v <server-executable>   # e.g. typescript-language-server, gopls, rust-analyzer
```

### 3. Configure

lazykimicode wires the LSP client through environment variables. Most builtin
servers need **no config** — they are resolved automatically by file extension.
Set these variables only to: pick between competing servers, pass custom args,
override the project root, or point to a non-builtin server.

Environment variables:

- `OMO_KIMI_LSP_COMMAND` — the language server executable (e.g.
  `typescript-language-server`, `pyright-langserver`, `rust-analyzer`).
- `OMO_KIMI_LSP_ARGS` — space-separated arguments passed to the executable
  (e.g. `--stdio` for servers that need it).

Examples:

```bash
# TypeScript / JavaScript
export OMO_KIMI_LSP_COMMAND=typescript-language-server
export OMO_KIMI_LSP_ARGS="--stdio"

# Python with pyright
export OMO_KIMI_LSP_COMMAND=pyright-langserver
export OMO_KIMI_LSP_ARGS="--stdio"

# Go
export OMO_KIMI_LSP_COMMAND=gopls

# Rust
export OMO_KIMI_LSP_COMMAND=rust-analyzer
```

If the project uses a per-project config file (`.omo/lsp.json` or
`.kimi-code/mcp.json`), prefer project-local wiring over exported env vars.
Project entries win over user entries; explicit env vars win over defaults.

Each language reference gives a ready-to-paste snippet.

### 4. Verify

Run a real diagnostics roundtrip against a source file. This spawns the server,
opens the file, requests diagnostics, and reports `OK`/`FAIL`.

Verify through the lazykimicode LSP MCP tools directly:

- Call `lsp_status` to check harness status.
- Call `lsp_diagnostics` with `{"file": "<path/to/file.ext>"}` to request diagnostics for a file.

`OK` = the server started and answered. `FAIL: language server not installed`
= go back to step 2. Other `FAIL` text carries the server/startup error.
`SKIP` = the engine source could not be located; check that `OMO_KIMI_LSP_COMMAND`
is set and the binary is on `PATH`, then call the LSP tool again.

---

## Notes

This skill does not ship helper scripts. Use the `Bash`, `Read`, and LSP MCP
commands shown in each phase above.

---

## Kimi Code Harness Compatibility

- Use `Bash` to verify the LSP binary, install packages, and run manual checks.
- Use `Read` to inspect `references/<language>/README.md`, project config files,
  and source files before diagnosing.
- Use `Write` / `Edit` to create or update project config files
  (`.omo/lsp.json`, `.kimi-code/mcp.json`, shell profile exports, etc.).
- Use `Agent(prompt=..., subagent_type="coder"|"explore"|"plan")` when you need a
  subordinate reasoning pass for a language-specific install or troubleshooting
  investigation.
- Use `AgentSwarm` with a prompt template referencing `lsp-setup` when you need
  parallel independent detection across multiple languages or candidate servers.
- Kimi has no thread-title concept; drop any `codex_app.set_thread_title` or
  thread-management instructions.
- Kimi does not support per-skill agent TOML files (e.g. `agents/openai.yaml`);
  do not copy or reference them.
- Kimi Code CLI has no built-in browser tool. Browser-dependent install steps
  (e.g., downloading a server release asset) should use the `kimi-webbridge`
  skill if available, or be handed off to the user with exact instructions.
