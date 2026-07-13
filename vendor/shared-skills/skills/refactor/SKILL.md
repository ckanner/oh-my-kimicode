---
name: refactor
description: "Intelligent refactor command. Triggers: refactor, refactoring, cleanup, restructure, extract, simplify, modernize."
type: prompt
whenToUse: When improving code structure without changing external behavior.
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

# Intelligent Refactor Command

## Usage
```
/refactor <refactoring-target> [--scope=<file|module|project>] [--strategy=<safe|aggressive>]

Arguments:
  refactoring-target: What to refactor. Can be:
    - File path: src/auth/handler.ts
    - Symbol name: "AuthService class"
    - Pattern: "all functions using deprecated API"
    - Description: "extract validation logic into separate module"

Options:
  --scope: Refactoring scope (default: module)
    - file: Single file only
    - module: Module/directory scope
    - project: Entire codebase

  --strategy: Risk tolerance (default: safe)
    - safe: Conservative, maximum test coverage required
    - aggressive: Allow broader changes with adequate coverage
```

## What This Command Does

Performs intelligent, deterministic refactoring with full codebase awareness. Unlike blind search-and-replace, this command:

1. **Understands your intent** - Analyzes what you actually want to achieve
2. **Maps the codebase** - Builds a definitive codemap before touching anything
3. **Assesses risk** - Evaluates test coverage and determines verification strategy
4. **Plans meticulously** - Creates a detailed plan with a Plan agent
5. **Executes precisely** - Step-by-step refactoring with LSP and AST-grep
6. **Verifies constantly** - Runs tests after each change to ensure zero regression

---

# PHASE 0: INTENT GATE (MANDATORY FIRST STEP)

**BEFORE ANY ACTION, classify and validate the request.**

## Step 0.1: Parse Request Type

| Signal | Classification | Action |
|--------|----------------|--------|
| Specific file/symbol | Explicit | Proceed to codebase analysis |
| "Refactor X to Y" | Clear transformation | Proceed to codebase analysis |
| "Improve", "Clean up" | Open-ended | **MUST ask**: "What specific improvement?" |
| Ambiguous scope | Uncertain | **MUST ask**: "Which modules/files?" |
| Missing context | Incomplete | **MUST ask**: "What's the desired outcome?" |

## Step 0.2: Validate Understanding

Before proceeding, confirm:
- [ ] Target is clearly identified
- [ ] Desired outcome is understood
- [ ] Scope is defined (file/module/project)
- [ ] Success criteria can be articulated

**If ANY of above is unclear, ASK CLARIFYING QUESTION:**

```
I want to make sure I understand the refactoring goal correctly.

**What I understood**: [interpretation]
**What I'm unsure about**: [specific ambiguity]

Options I see:
1. [Option A] - [implications]
2. [Option B] - [implications]

**My recommendation**: [suggestion with reasoning]

Should I proceed with [recommendation], or would you prefer differently?
```

## Step 0.3: Create Initial Todos

**IMMEDIATELY after understanding the request, create todos:**

```
TodoList([
  {"id": "phase-1", "content": "PHASE 1: Codebase Analysis - launch parallel explore agents", "status": "pending", "priority": "high"},
  {"id": "phase-2", "content": "PHASE 2: Build Codemap - map dependencies and impact zones", "status": "pending", "priority": "high"},
  {"id": "phase-3", "content": "PHASE 3: Test Assessment - analyze test coverage and verification strategy", "status": "pending", "priority": "high"},
  {"id": "phase-4", "content": "PHASE 4: Plan Generation - invoke Plan agent for detailed refactoring plan", "status": "pending", "priority": "high"},
  {"id": "phase-5", "content": "PHASE 5: Execute Refactoring - step-by-step with continuous verification", "status": "pending", "priority": "high"},
  {"id": "phase-6", "content": "PHASE 6: Final Verification - full test suite and regression check", "status": "pending", "priority": "high"}
])
```

---

# PHASE 1: CODEBASE ANALYSIS (PARALLEL EXPLORATION)

**Mark phase-1 as in_progress.**

## 1.1: Launch Parallel Explore Agents

Fire ALL of these simultaneously using `AgentSwarm`. The prompt template must contain `{{item}}` and reference the refactor mission.

```
AgentSwarm(
  prompt="You are an explore subagent assisting with a refactor. Your mission is: {{item}}. Focus only on this mission. Report file paths, line numbers, usage patterns, dependency chains, and concise findings.",
  items=[
    "Find all occurrences and definitions of [TARGET].",
    "Find all code that imports, uses, or depends on [TARGET].",
    "Find similar code patterns to [TARGET] in the codebase.",
    "Find all test files related to [TARGET].",
    "Find architectural patterns and module organization around [TARGET]."
  ]
)
```

`AgentSwarm` runs to completion and returns the combined member reports.

## 1.2: Direct Tool Exploration (WHILE SWARM RUNS)

While the swarm is running, use direct tools:

### LSP Tools for Precise Analysis:

```typescript
// Find definition(s) (when an LSP tool is available)
lsp_goto_definition(filePath, line, character)  // Where is it defined?

// Find ALL usages across workspace
lsp_find_references(filePath, line, character)  // include declaration if needed

// Get file structure (use Read if no LSP outline tool is available)
Read(filePath)  // Hierarchical outline can be inspected manually

// Get current diagnostics
lsp_diagnostics(filePath)  // Errors, warnings before we start
```

### AST-Grep Skill for Pattern Analysis:

```bash
// Find structural patterns
sg scan --pattern 'function $NAME($$$) { $$$ }' --lang ts src/

// Preview refactoring first
sg scan --pattern '[old_pattern]' --rewrite '[new_pattern]' --lang ts src/
```

### Grep for Text Patterns:

```
Grep(pattern="[search_term]", path="src/", glob="*.ts")
```

## 1.3: Collect Swarm Results

Aggregate the `AgentSwarm` output into the findings used in Phase 2.

**Mark phase-1 as completed after all results are collected.**

---

# PHASE 2: BUILD CODEMAP (DEPENDENCY MAPPING)

**Mark phase-2 as in_progress.**

## 2.1: Construct Definitive Codemap

Based on Phase 1 results, build:

```
## CODEMAP: [TARGET]

### Core Files (Direct Impact)
- `path/to/file.ts:L10-L50` - Primary definition
- `path/to/file2.ts:L25` - Key usage

### Dependency Graph
```
[TARGET]
├── imports from:
│   ├── module-a (types)
│   └── module-b (utils)
├── imported by:
│   ├── consumer-1.ts
│   ├── consumer-2.ts
│   └── consumer-3.ts
└── used by:
    ├── handler.ts (direct call)
    └── service.ts (dependency injection)
```

### Impact Zones
| Zone | Risk Level | Files Affected | Test Coverage |
|------|------------|----------------|---------------|
| Core | HIGH | 3 files | 85% covered |
| Consumers | MEDIUM | 8 files | 70% covered |
| Edge | LOW | 2 files | 50% covered |

### Established Patterns
- Pattern A: [description] - used in N places
- Pattern B: [description] - established convention
```

## 2.2: Identify Refactoring Constraints

Based on codemap:
- **MUST follow**: [existing patterns identified]
- **MUST NOT break**: [critical dependencies]
- **Safe to change**: [isolated code zones]
- **Requires migration**: [breaking changes impact]

**Mark phase-2 as completed.**

---

# PHASE 3: TEST ASSESSMENT (VERIFICATION STRATEGY)

**Mark phase-3 as in_progress.**

## 3.1: Detect Test Infrastructure

```bash
# Check for test commands
Bash(command="cat package.json | jq '.scripts | keys[] | select(test(\"test\"))'")

# Or for Python
Bash(command="ls -la pytest.ini pyproject.toml setup.cfg")

# Or for Go
Bash(command="ls -la *_test.go")
```

## 3.2: Analyze Test Coverage

```
// Find all tests related to target
Agent(
  subagent_type="explore",
  prompt="Analyze test coverage for [TARGET]:
  1. Which test files cover this code?
  2. What test cases exist?
  3. Are there integration tests?
  4. What edge cases are tested?
  5. Estimated coverage percentage?"
)
```

## 3.3: Determine Verification Strategy

Based on test analysis:

| Coverage Level | Strategy |
|----------------|----------|
| HIGH (>80%) | Run existing tests after each step |
| MEDIUM (50-80%) | Run tests + add safety assertions |
| LOW (<50%) | **PAUSE**: Propose adding tests first |
| NONE | **BLOCK**: Refuse aggressive refactoring |

**If coverage is LOW or NONE, ask user:**

```
Test coverage for [TARGET] is [LEVEL].

**Risk Assessment**: Refactoring without adequate tests is dangerous.

Options:
1. Add tests first, then refactor (RECOMMENDED)
2. Proceed with extra caution, manual verification required
3. Abort refactoring

Which approach do you prefer?
```

## 3.4: Document Verification Plan

```
## VERIFICATION PLAN

### Test Commands
- Unit: `bun test` / `npm test` / `pytest` / etc.
- Integration: [command if exists]
- Type check: `tsc --noEmit` / `pyright` / etc.

### Verification Checkpoints
After each refactoring step:
1. lsp_diagnostics → zero new errors
2. Run test command → all pass
3. Type check → clean

### Regression Indicators
- [Specific test that must pass]
- [Behavior that must be preserved]
- [API contract that must not change]
```

**Mark phase-3 as completed.**

---

# PHASE 4: PLAN GENERATION (PLAN AGENT)

**Mark phase-4 as in_progress.**

## 4.1: Invoke Plan Agent

```
Agent(
  subagent_type="plan",
  prompt="Create a detailed refactoring plan:

  ## Refactoring Goal
  [User's original request]

  ## Codemap (from Phase 2)
  [Insert codemap here]

  ## Test Coverage (from Phase 3)
  [Insert verification plan here]

  ## Constraints
  - MUST follow existing patterns: [list]
  - MUST NOT break: [critical paths]
  - MUST run tests after each step

  ## Requirements
  1. Break down into atomic refactoring steps
  2. Each step must be independently verifiable
  3. Order steps by dependency (what must happen first)
  4. Specify exact files and line ranges for each step
  5. Include rollback strategy for each step
  6. Define commit checkpoints"
)
```

## 4.2: Review and Validate Plan

After receiving plan from the Plan agent:

1. **Verify completeness**: All identified files addressed?
2. **Verify safety**: Each step reversible?
3. **Verify order**: Dependencies respected?
4. **Verify verification**: Test commands specified?

## 4.3: Register Detailed Todos

Convert Plan agent output into granular todos:

```
TodoList([
  // Each step from the plan becomes a todo
  {"id": "refactor-1", "content": "Step 1: [description]", "status": "pending", "priority": "high"},
  {"id": "verify-1", "content": "Verify Step 1: run tests", "status": "pending", "priority": "high"},
  {"id": "refactor-2", "content": "Step 2: [description]", "status": "pending", "priority": "medium"},
  {"id": "verify-2", "content": "Verify Step 2: run tests", "status": "pending", "priority": "medium"},
  // ... continue for all steps
])
```

**Mark phase-4 as completed.**

---

# PHASE 5: EXECUTE REFACTORING (DETERMINISTIC EXECUTION)

**Mark phase-5 as in_progress.**

## 5.1: Execution Protocol

For EACH refactoring step:

### Pre-Step
1. Mark step todo as `in_progress`
2. Read current file state
3. Verify `lsp_diagnostics` is at baseline

### Execute Step
Use the appropriate tool:

**For Symbol Renames:**
```typescript
// If an LSP rename tool is available:
lsp_prepare_rename(filePath, line, character)  // Validate rename is possible
lsp_rename(filePath, line, character, newName)  // Execute rename

// If no LSP rename tool is available, use a coder Agent or manual Edit with Grep verification:
Agent(
  subagent_type="coder",
  prompt="Rename [OLD_NAME] to [NEW_NAME] in [FILES]. Verify every reference is updated and no other symbols with the same name are affected."
)
```

**For Pattern Transformations:**
```bash
// Preview first
sg scan --pattern '[pattern]' --rewrite '[rewrite]' --lang ts path/to/file.ts

// If preview looks good, apply
sg scan --pattern '[pattern]' --rewrite '[rewrite]' --lang ts path/to/file.ts --apply
```

**For Structural Changes:**
```typescript
// Use Edit tool for precise changes
Edit(path=filePath, old_string=oldString, new_string=newString)
```

### Post-Step Verification (MANDATORY)

```typescript
// 1. Check diagnostics
lsp_diagnostics(filePath)  // Must be clean or same as baseline

// 2. Run tests
Bash(command="bun test")  // Or appropriate test command

// 3. Type check
Bash(command="tsc --noEmit")  // Or appropriate type check
```

### Step Completion
1. If verification passes → Mark step todo as `completed`
2. If verification fails → **STOP AND FIX**

## 5.2: Failure Recovery Protocol

If ANY verification fails:

1. **STOP** immediately
2. **REVERT** the failed change
3. **DIAGNOSE** what went wrong
4. **OPTIONS**:
   - Fix the issue and retry
   - Skip this step (if optional)
   - Consult a Plan agent for help
   - Ask user for guidance

**NEVER proceed to next step with broken tests.**

## 5.3: Commit Checkpoints

After each logical group of changes (only when the user has authorized commits):

```bash
Bash(command="git add [changed-files]")
Bash(command="git commit -m \"refactor(scope): description

[details of what was changed and why]\"")
```

**Mark phase-5 as completed when all refactoring steps are done.**

---

# PHASE 6: FINAL VERIFICATION (REGRESSION CHECK)

**Mark phase-6 as in_progress.**

## 6.1: Full Test Suite

```bash
# Run complete test suite
Bash(command="bun test")  # or npm test, pytest, go test, etc.
```

## 6.2: Type Check

```bash
# Full type check
Bash(command="tsc --noEmit")  # or equivalent
```

## 6.3: Lint Check

```bash
# Run linter
Bash(command="eslint .")  # or equivalent
```

## 6.4: Build Verification (if applicable)

```bash
# Ensure build still works
Bash(command="bun run build")  # or npm run build, etc.
```

## 6.5: Final Diagnostics

```typescript
// Check all changed files
for (file of changedFiles) {
  lsp_diagnostics(file)  // Must all be clean
}
```

## 6.6: Generate Summary

```markdown
## Refactoring Complete

### What Changed
- [List of changes made]

### Files Modified
- `path/to/file.ts` - [what changed]
- `path/to/file2.ts` - [what changed]

### Verification Results
- Tests: PASSED (X/Y passing)
- Type Check: CLEAN
- Lint: CLEAN
- Build: SUCCESS

### No Regressions Detected
All existing tests pass. No new errors introduced.
```

End the session with:

```
EVIDENCE_RECORDED: <test-output>
```

**Mark phase-6 as completed.**

---

# CRITICAL RULES

## NEVER DO
- Skip `lsp_diagnostics` check after changes
- Proceed with failing tests
- Make changes without understanding impact
- Use `as any`, `@ts-ignore`, `@ts-expect-error`
- Delete tests to make them pass
- Commit broken code
- Refactor without understanding existing patterns

## ALWAYS DO
- Understand before changing
- Preview before applying (`sg scan --pattern ... --rewrite ... --lang ...`)
- Verify after every change
- Follow existing codebase patterns
- Keep todos updated in real-time
- Commit at logical checkpoints (when authorized)
- Report issues immediately

## ABORT CONDITIONS
If any of these occur, **STOP and consult user**:
- Test coverage is zero for target code
- Changes would break public API
- Refactoring scope is unclear
- 3 consecutive verification failures
- User-defined constraints violated

---

# Tool Usage Philosophy

You already know these tools. Use them intelligently:

## LSP Tools
Leverage LSP tools for precision analysis when they are configured. Key patterns:
- **Understand before changing**: `lsp_goto_definition` to grasp context
- **Impact analysis**: `lsp_find_references` to map all usages before modification
- **Safe refactoring**: `lsp_prepare_rename` → `lsp_rename` for symbol renames (when available)
- **Continuous verification**: `lsp_diagnostics` after every change

## AST-Grep
Use the `ast-grep` skill or the `sg` CLI for structural transformations.
**Critical**: Always preview first, review, then execute.

## Agents
- `Agent(subagent_type="explore")`: Parallel/sequential codebase pattern discovery
- `Agent(subagent_type="plan")`: Detailed refactoring plan generation and architectural review
- `Agent(subagent_type="coder")`: Precise, mechanical code changes

## Deprecated Code & Library Migration
When you encounter deprecated methods/APIs during refactoring:
1. Fire `Agent(subagent_type="explore")` or use `WebSearch`/`FetchURL` to find the recommended modern alternative
2. **DO NOT auto-upgrade to latest version** unless user explicitly requests migration
3. If user requests library migration, research latest API docs before making changes

---

## Kimi Code Harness Compatibility

This skill is designed for the Kimi Code CLI harness.

- Use `Agent(prompt=..., subagent_type="explore")` for broad codebase scans and test analysis.
- Use `AgentSwarm` with a prompt template containing `{{item}}` (and the word `refactor`) to run parallel exploration tasks.
- Use `Agent(subagent_type="plan")` for detailed refactoring plan generation.
- Use `Agent(subagent_type="coder")` for mechanical edits and structural changes.
- Use `Write` / `Edit` for file creation and modification.
- Use `Bash` for test, type-check, lint, build, and `sg` commands.
- Use `Grep` for text-based search.
- Use `Read` for file inspection.
- Use `FetchURL` or the `kimi-webbridge` skill for web-based documentation (Kimi Code CLI has no built-in browser tool).
- Use the `ast-grep` skill for structural search and rewrite.
- Use `TodoList` for progress tracking.
- Kimi has no per-skill agent TOMLs, no thread titles, and no `codex_app.*` thread APIs; replace any thread-style coordination with `AgentSwarm` or sequential `Agent` calls.
- Output `EVIDENCE_RECORDED: <test-output>` after the final verification.

---

# Team Mode Protocol (active when parallel multi-agent execution is appropriate)

Team mode uses Kimi-native `AgentSwarm` instead of Codex `team_*` tools. The rules below **override Phase 4-6** above when parallel execution is beneficial.

## Phase 4 override: Plan agent staffing requirement

When invoking the Plan agent in Phase 4.1, append this additional requirement:

```
7. (REQUIRED when team mode is active) Output a Team Staffing Recommendation section with these fields — missing fields fail Phase 5 dispatch:
   - total_atomic_steps: integer
   - file_independent_steps: integer (parallelizable, no cross-file blocker)
   - cross_file_dependent_steps: integer (has blockers)
   - per_step_assignment: [{step_id, assigned_to: 'coder-mechanical' | 'coder-reasoning', blockedBy: [step_ids], rationale}]
   - dispatch_path_recommendation: 'swarm' | 'sequential' with reason
   - rationale for the composition
```

**Classification rules** the plan agent must apply to each step:
- `coder-mechanical`: mechanical edits — LSP rename, extract variable, inline, simple move, signature change without call-site logic.
- `coder-reasoning`: logic-preserving refactors that need reasoning — extract function, restructure conditional, pattern transformation, cross-file API change.
- Recommend `swarm` path when `file_independent_steps >= 3`; recommend `sequential` otherwise.

## Phase 5 override: Dispatch path selection

Read the Team Staffing Recommendation from Phase 4. If any required field is missing, fail here and re-request the plan with the exact missing field names. Do not proceed with a partial plan.

Then choose the path:

- **Swarm path (5.1-S)**: when the plan recommends `swarm` AND `file_independent_steps >= 3`. Dispatch file-independent steps in parallel via `AgentSwarm`; execute cross-file dependent steps sequentially with `Agent`.
- **Sequential path (5.1-L)**: otherwise. Use the original 5.1 / 5.2 / 5.3 flow from above.

Record the chosen path in the `TodoList`.

## Phase 5.1-S: `refactor-squad` swarm execution

**Precondition checks** (fail hard if any step fails):

1. Load the `teammode` skill for lifecycle, message protocol, and limits.
2. Ensure no active refactor-squad state exists for this session; if an orphan exists, archive/delete it with `node plugin/components/teammode/scripts/team.mjs`.
3. Prepare a concise Intent Card and Verification Spec.

**Swarm spec**:

Members are `Agent(subagent_type="coder")` instances spawned by `AgentSwarm`. Encode the required expertise in the prompt template or per-item instructions rather than relying on per-skill agent TOMLs.

```
AgentSwarm(
  prompt="You are a coder subagent in the refactor squad. Your step is: {{item}}. Follow the per-step instructions exactly — no scope expansion. After edits, run lsp_diagnostics on touched files and report a concise summary (files touched, diagnostics status, key changes). Do not run the full test suite; do not git commit.",
  items=[
    "<file-independent step 1 details>",
    "<file-independent step 2 details>",
    ...
  ]
)
```

Rationale for this composition:
- Mechanical and reasoning edits are both handled by `coder` agents, with the per-item prompt controlling the required depth.
- Verification runs OUTSIDE the swarm because `AgentSwarm` members are focused workers, not verifiers.

**Swarm lifecycle** (one swarm per batch, reused until that batch is complete):

1. Broadcast the refactor Intent Card ONCE:
   ```
   Agent(
     subagent_type="coder",
     prompt="Shared context for all refactor-squad members: <codemap summary + constraints + established patterns from Phase 2>"
   )
   ```
   Note: this is a single shared briefing; do not inline the full Intent Card into every swarm item.

2. Broadcast the verification spec ONCE:
   ```
   Agent(
     subagent_type="coder",
     prompt="Verification spec for this refactor: <exact test/typecheck/lint commands + expected pass counts + regression indicators from Phase 3.4>"
   )
   ```

3. Dispatch the file-independent steps via `AgentSwarm`. For cross-file dependent steps, run `Agent(subagent_type="coder")` calls one at a time in dependency order.

**Leader monitoring loop**:

While any step is pending:

- Wait for member results. Avoid tight polling.
- On a worker completion report, immediately dispatch an **external verifier** — verification runs OUTSIDE the swarm using a separate `Agent`:
  ```
  Agent(
    subagent_type="plan",
    prompt="Verify these touched files: <files>. Run the verification spec commands and return either PASS or FAIL:<failing test + specific error + suggested revert hunks>."
  )
  ```
  If `plan` is unavailable, fall back to `Agent(subagent_type="coder")` with an explicit verifier role.
- On a verifier PASS: make the commit checkpoint for that step (see original 5.3, only if authorized). Proceed.
- On a verifier FAIL: Lead decides:
  - **Retry with fix hint**: Re-run the original step with the failure details added to its prompt.
  - **Escalate**: after three FAIL cycles on the same step, STOP and consult the user with full evidence.
- On a member UNCLEAR message: re-harvest context via a targeted `Agent(subagent_type="explore")` outside the swarm, broadcast an updated Intent Card fragment, then reassign.

Proceed to Phase 6 only when every swarm/sequential step is completed AND every paired verifier task returned PASS.

## Phase 6 override: Team cleanup before summary

If Phase 5 used the swarm path, archive the refactor-squad state BEFORE producing the 6.6 summary. Every exit path — success, escalation, abort — must cleanup; orphan states poison the next session's precondition check.

1. Archive the team state with `node plugin/components/teammode/scripts/team.mjs archive`.
2. Confirm no residual refactor-squad state remains.

Append to the 6.6 summary a "Dispatch path" line and, when the swarm path was used, swarm metrics (tasks dispatched, verifier runs, batches executed).

## MUST NOT (team mode)

- Lead never edits files directly — orchestrate only.
- Do not inline the Intent Card or verify-spec into swarm item descriptions — rely on the broadcasts.
- Do not spawn multiple overlapping swarms for the same refactor session.
- Do not run tests from the Lead — the external verifier owns that lane.
- Do not put `Agent(subagent_type="plan")` or `Agent(subagent_type="explore")` into the `AgentSwarm`; use them via separate `Agent` calls outside the swarm when needed.
