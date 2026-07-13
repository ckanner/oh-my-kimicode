---
name: init-deep
description: (builtin) Initialize hierarchical AGENTS.md knowledge base
type: prompt
whenToUse: When starting work on a new or unfamiliar codebase and you need a thorough project overview captured as AGENTS.md.
---

## LazyKimiCode K2.7 Orchestration Calibration

The following calibrations are inherited from Oh My OpenAgent's Kimi K2.7-native agent prompts. They govern how this skill behaves when running on Kimi K2.7 inside Kimi Code CLI. Tool names in these blocks that are not Kimi-native (`task()`, `background_output`, and other historical agent-runtime helpers) should be mapped to Kimi Code equivalents as described in the **Kimi Code Harness Compatibility** section of this skill.

<tool_loop_guard>
Never call the same tool with the same arguments more than twice in a row.
If a third identical call seems necessary, stop calling tools and report the blocker, missing evidence, or changed input that would justify another attempt.
Repeated identical tool calls are a loop signal, not persistence.
</tool_loop_guard>

<Anti_Duplication>
## Anti-Duplication Rule (CRITICAL)

Once you delegate exploration to explore/librarian agents, **DO NOT perform the same search yourself**.

### What this means:

**FORBIDDEN:**
- After firing explore/librarian, manually grep/search for the same information
- Re-doing the research the agents were just tasked with
- "Just quickly checking" the same files the background agents are checking

**ALLOWED:**
- Continue with **non-overlapping work** - work that doesn't depend on the delegated research
- Work on unrelated parts of the codebase
- Preparation work (e.g., setting up files, configs) that can proceed independently

### Wait for Results Properly:

When you need the delegated results but they're not ready:

1. **End your response** - do NOT continue with work that depends on those results
2. **Wait for the completion notification** - the system will trigger your next turn
3. **Then** collect results via `background_output(task_id="bg_...")`
4. **Do NOT** impatiently re-search the same topics while waiting
</Anti_Duplication>

<kimi_k27_calibration>
## Kimi K2.7 terminal-conditions / commitment framing

You are outcome-first by temperament. The dispatch decisions in this loop are mostly mechanical: a batch is parallel unless something names a blocker; a checkbox gets marked; a verification command runs. Make those calls directly and keep moving — do not enumerate alternative orderings or re-open a settled dispatch. Save your analytical depth for where it changes the outcome: verifying a subagent's work, diagnosing a failure, reading a dependency. That split — fast on the mechanical, deep on verification — is how you orchestrate well.

- Commit once. Choose an approach and execute it; reopen the choice only when new evidence contradicts it, never to reassure yourself.
- Orchestrate by default. Do the work yourself only when it is small, local, and you already hold full context.
- Parallelize. Independent reads, searches, and agent fires go out in one response; sequence only a real dependency.
- Stop when you can act. Once you have enough to proceed correctly, proceed — sufficient beats complete.
- Verify what you ship. A passing type check is not a working feature; confirm behavior before calling anything done.
</kimi_k27_calibration>

<parallel_by_default>
## Parallel by Default

Your default mode is parallel fan-out; sequential is the exception. For every batch, the question is not "should I parallelize these?" — it is "what blocks me from firing all of them in ONE message?" The answer is a NAMED dependency, and only two kinds count:

- **Input dependency**: Task B reads what Task A produced (a file, a value, a schema).
- **File conflict**: Task A and Task B modify the same file.

Everything else fires in the same response — one message, multiple `Agent` calls. Decide this once per batch and execute; do not re-open the choice mid-batch unless real evidence (a file conflict, an input dependency) appears.
</parallel_by_default>

<auto_continue>
## Auto-Continue (STRICT)

Never ask the user "should I continue", "proceed to the next task", or any approval-style question between plan steps. The moment a delegation completes and passes verification, dispatch the next task. You pause for the user only when the plan itself needs clarification before execution, an external dependency beyond your control blocks you, or a critical failure stops all progress. This is core to your role, not optional.
</auto_continue>

# /init-deep

Generate hierarchical AGENTS.md files. Root + complexity-scored subdirectories.

## Usage

```
/init-deep                      # Update mode: modify existing + create new where warranted
/init-deep --create-new         # Read existing → remove all → regenerate from scratch
/init-deep --max-depth=2        # Limit directory depth (default: 3)
```

---

## Workflow (High-Level)

1. **Discovery + Analysis** (concurrent)
   - Fire parallel explore agents immediately via `AgentSwarm`
   - Main session: bash structure + LSP/codegraph code map + read existing AGENTS.md
2. **Score & Decide** - Determine AGENTS.md locations from merged findings
3. **Generate** - Root first, then subdirs in parallel
4. **Review** - Deduplicate, trim, validate

<critical>
**Track ALL phases with `TodoList`. Mark in_progress → completed in real-time.**
```
TodoList.create([
  { id: "discovery", content: "Fire explore agents + LSP/codegraph map + read existing", status: "pending", priority: "high" },
  { id: "scoring", content: "Score directories, determine locations", status: "pending", priority: "high" },
  { id: "generate", content: "Generate AGENTS.md files (root + subdirs)", status: "pending", priority: "high" },
  { id: "review", content: "Deduplicate, validate, trim", status: "pending", priority: "medium" }
])
TodoList.update("discovery", { status: "in_progress" })
```
</critical>

---

## Phase 1: Discovery + Analysis (Concurrent)

**Mark "discovery" as in_progress.**

### Fire Parallel Explore Agents IMMEDIATELY

Don't wait—these run concurrently while the main session works. **Equip every agent with the code graph**: any task touching structure, entry points, dependencies, or hotspots MUST query `codegraph_*` (explore/search/callers/callees/impact) and `lsp_symbols` when present, and ground its claims in that data instead of guessing from conventions. Richer real-graph context per agent = a more accurate project map.

```
// Run all at once, collect results when AgentSwarm returns
AgentSwarm(
  prompt_template="init-deep exploration: {{item}}. Query codegraph_* and lsp_* tools if available. Report concise, evidence-backed findings only.",
  agents=[
    { subagent_type: "explore", item: "Project structure: map real layout via codegraph_explore/codegraph_files → REPORT deviations from standard patterns" },
    { subagent_type: "explore", item: "Entry points: FIND main files, trace reach via codegraph_callees + lsp_symbols → REPORT non-standard organization" },
    { subagent_type: "explore", item: "Conventions: FIND config files (.eslintrc, pyproject.toml, .editorconfig) → REPORT project-specific rules" },
    { subagent_type: "explore", item: "Anti-patterns: FIND 'DO NOT', 'NEVER', 'ALWAYS', 'DEPRECATED' comments → LIST forbidden patterns" },
    { subagent_type: "explore", item: "Build/CI: FIND .github/workflows, Makefile → REPORT non-standard patterns" },
    { subagent_type: "explore", item: "Test patterns: FIND test configs/structure; codegraph_callers on core modules to see what is covered → REPORT unique conventions" }
  ]
)
```

<dynamic-agents>
**DYNAMIC AGENT SPAWNING**: After bash analysis, spawn ADDITIONAL explore agents based on project scale:

| Factor | Threshold | Additional Agents |
|--------|-----------|-------------------|
| **Total files** | >100 | +1 per 100 files |
| **Total lines** | >10k | +1 per 10k lines |
| **Directory depth** | ≥4 | +2 for deep exploration |
| **Large files (>500 lines)** | >10 files | +1 for complexity hotspots |
| **Monorepo** | detected | +1 per package/workspace |
| **Multiple languages** | >1 | +1 per language |

```bash
# Measure project scale first
total_files=$(find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | wc -l)
total_lines=$(find . -type f \( -name "*.ts" -o -name "*.py" -o -name "*.go" \) -not -path '*/node_modules/*' -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
large_files=$(find . -type f \( -name "*.ts" -o -name "*.py" \) -not -path '*/node_modules/*' -exec wc -l {} + 2>/dev/null | awk '$1 > 500 {count++} END {print count+0}')
max_depth=$(find . -type d -not -path '*/node_modules/*' -not -path '*/.git/*' | awk -F/ '{print NF}' | sort -rn | head -1)
```

Example spawning (add these items to a second `AgentSwarm` call, or call `Agent` sequentially if the harness limits swarm size):
```
AgentSwarm(
  prompt_template="init-deep exploration: {{item}}. Query codegraph_* and lsp_* tools if available. Report concise, evidence-backed findings only.",
  agents=[
    { subagent_type: "explore", item: "Large file analysis: FIND files >500 lines, REPORT complexity hotspots" },
    { subagent_type: "explore", item: "Deep modules at depth 4+: FIND hidden patterns, internal conventions" },
    { subagent_type: "explore", item: "Cross-cutting concerns: FIND shared utilities across directories" }
    // ... more based on calculation
  ]
)
```
</dynamic-agents>

### Main Session: Concurrent Analysis

**While the explore agents run**, main session does:

#### 1. Bash Structural Analysis
```bash
# Directory depth + file counts
find . -type d -not -path '*/\.*' -not -path '*/node_modules/*' -not -path '*/venv/*' -not -path '*/dist/*' -not -path '*/build/*' | awk -F/ '{print NF-1}' | sort -n | uniq -c

# Files per directory (top 30)
find . -type f -not -path '*/\.*' -not -path '*/node_modules/*' | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -30

# Code concentration by extension
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.go" -o -name "*.rs" \) -not -path '*/node_modules/*' | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -20

# Existing AGENTS.md / CLAUDE.md
find . -type f \( -name "AGENTS.md" -o -name "CLAUDE.md" \) -not -path '*/node_modules/*' 2>/dev/null
```

#### 2. Read Existing AGENTS.md
```
For each existing file found:
  Read(path=file)
  Extract: key insights, conventions, anti-patterns
  Store in EXISTING_AGENTS map
```

If `--create-new`: Read all existing first (preserve context) → then delete all → regenerate.

#### 3. Code Map - drive LSP AND codegraph (do NOT skip)

Highest-signal source for the CODE MAP and the Symbol/Export/Reference scoring rows. Complementary, not alternatives - run BOTH when present, alongside the explore agents.

**LSP** - check `lsp_status`; model-facing names are `lsp_status`/`lsp_symbols`/`lsp_find_references`/`lsp_goto_definition` (some harnesses drop the `lsp_` prefix):
- `lsp_symbols` scope="document" on each entry point -> file outline.
- `lsp_symbols` scope="workspace", query by kind (class/interface/function) -> symbol inventory.
- `lsp_find_references` on top exports (line/character from the symbols result) -> reference centrality.

**codegraph** - when `codegraph_*` tools exist (check `codegraph_status`); a first-class peer to LSP, NOT a last resort:
- `codegraph_explore` -> overview; `codegraph_callers`/`codegraph_callees`/`codegraph_impact` -> centrality + blast radius for the scoring matrix; `codegraph_search`/`codegraph_files` -> symbol/file inventory.

Only if NEITHER exists: use explore agents + the ast-grep skill (`sg`), and mark centrality unmeasured in the CODE MAP.

### Collect Parallel Results

```
// AgentSwarm returns results when all members finish; merge them below
```

**Merge: bash + LSP/codegraph + existing + explore findings. Mark "discovery" as completed.**

---

## Phase 2: Scoring & Location Decision

**Mark "scoring" as in_progress.**

### Scoring Matrix

| Factor | Weight | High Threshold | Source |
|--------|--------|----------------|--------|
| File count | 3x | >20 | bash |
| Subdir count | 2x | >5 | bash |
| Code ratio | 2x | >70% | bash |
| Unique patterns | 1x | Has own config | explore |
| Module boundary | 2x | Has index.ts/__init__.py | bash |
| Symbol density | 2x | >30 symbols | LSP/cg |
| Export count | 2x | >10 exports | LSP/cg |
| Reference centrality | 3x | >20 refs | LSP/cg |

### Decision Rules

| Score | Action |
|-------|--------|
| **Root (.)** | ALWAYS create |
| **>15** | Create AGENTS.md |
| **8-15** | Create if distinct domain |
| **<8** | Skip (parent covers) |

### Output
```
AGENTS_LOCATIONS = [
  { path: ".", type: "root" },
  { path: "src/hooks", score: 18, reason: "high complexity" },
  { path: "src/api", score: 12, reason: "distinct domain" }
]
```

**Mark "scoring" as completed.**

---

## Phase 3: Generate AGENTS.md

**Mark "generate" as in_progress.**

<critical>
**File Writing Rule**: If AGENTS.md already exists at the target path → use `Edit` tool. If it does NOT exist → use `Write` tool.
NEVER use Write to overwrite an existing file. ALWAYS check existence first via `Read` or discovery results.
</critical>

### Root AGENTS.md (Full Treatment)

```markdown
# PROJECT KNOWLEDGE BASE

**Generated:** {TIMESTAMP}
**Commit:** {SHORT_SHA}
**Branch:** {BRANCH}

## OVERVIEW
{1-2 sentences: what + core stack}

## STRUCTURE
```
{root}/
├── {dir}/    # {non-obvious purpose only}
└── {entry}
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|

## CODE MAP
{From LSP/codegraph - skip only if neither exists or project <10 files}

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|

## CONVENTIONS
{ONLY deviations from standard}

## ANTI-PATTERNS (THIS PROJECT)
{Explicitly forbidden here}

## UNIQUE STYLES
{Project-specific}

## COMMANDS
```bash
{dev/test/build}
```

## NOTES
{Gotchas}
```

**Quality gates**: 50-150 lines, no generic advice, no obvious info.

### Subdirectory AGENTS.md (Parallel)

Launch writing agents for each location:

```
for loc in AGENTS_LOCATIONS (except root):
  Agent(
    subagent_type="coder",
    description="Generate AGENTS.md",
    prompt=`
      Generate AGENTS.md for: ${loc.path}
      - Reason: ${loc.reason}
      - 30-80 lines max
      - NEVER repeat parent content
      - Sections: OVERVIEW (1 line), STRUCTURE (if >5 subdirs), WHERE TO LOOK, CONVENTIONS (if different), ANTI-PATTERNS
      - Use Write if the file does not exist; use Edit if it already exists
    `
  )
```

Or use `AgentSwarm` with a prompt template containing `init-deep` when the locations are independent:
```
AgentSwarm(
  prompt_template="init-deep generate AGENTS.md for {{loc}}. Reason: {{reason}}. 30-80 lines max...",
  agents=AGENTS_LOCATIONS.filter(loc => loc.type !== "root").map(loc => ({ subagent_type: "coder", loc: loc.path, reason: loc.reason }))
)
```

**Wait for all. Mark "generate" as completed.**

---

## Phase 4: Review & Deduplicate

**Mark "review" as in_progress.**

For each generated file:
- Remove generic advice
- Remove parent duplicates
- Trim to size limits
- Verify telegraphic style

**Mark "review" as completed.**

---

## Final Report

```
=== init-deep Complete ===

Mode: {update | create-new}

Files:
  [OK] ./AGENTS.md (root, {N} lines)
  [OK] ./src/hooks/AGENTS.md ({N} lines)

Dirs Analyzed: {N}
AGENTS.md Created: {N}
AGENTS.md Updated: {N}

Hierarchy:
  ./AGENTS.md
  └── src/hooks/AGENTS.md
```

---

## Anti-Patterns

- **Static agent count**: MUST vary agents based on project size/depth
- **Sequential execution**: MUST parallel (explore + LSP + codegraph concurrent)
- **Ignoring existing**: ALWAYS read existing first, even with --create-new
- **Over-documenting**: Not every dir needs AGENTS.md
- **Redundancy**: Child never repeats parent
- **Generic content**: Remove anything that applies to ALL projects
- **Verbose style**: Telegraphic or die

---

## Kimi Code Harness Compatibility

- `task(...)` / `multi_agent_v1.spawn_agent` → `Agent(prompt=..., subagent_type="coder"|"explore"|"plan")`.
- Parallel explore or writing work → `AgentSwarm` with a prompt template containing `init-deep`.
- `background_output(task_id=...)` / `multi_agent_v1.wait_agent` → `Agent` runs to completion; `AgentSwarm` returns aggregated results.
- `codex_app.create_thread` / `send_message_to_thread` / `read_thread` → `AgentSwarm` or sequential `Agent` calls; Kimi has no thread concept.
- `apply_patch` / Codex write-edit → Kimi `Write` / `Edit` tools.
- `codex_app.set_thread_title` → remove; Kimi has no thread title.
- `browser:control-in-app-browser` → use the `kimi-webbridge` skill if available, otherwise `FetchURL`; Kimi Code CLI has no built-in browser tool. Ask the user if neither is sufficient.
- `team_*(...)` → `AgentSwarm`.
- `TodoWrite` → `TodoList` tool.
- LSP/codegraph tools are harness-dependent. If the current harness lacks them, fall back to `Bash`/`Grep`/`Read` and the `ast-grep` skill (`sg`).
