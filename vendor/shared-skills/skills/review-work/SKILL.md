---
name: review-work
description: "Post-implementation review orchestrator. Launches 5 parallel background sub-agents: Goal Verifier (Oracle), Code Reviewer (Oracle), Security Auditor (Oracle), QA Executor (hands-on), and Context Miner (context investigator). All must pass for review to pass. MUST USE after completing any significant implementation work. Triggers: 'review work', 'review my work', 'review changes', 'QA my work', 'verify implementation', 'check my work', 'validate changes', 'post-implementation review'."
type: prompt
whenToUse: After completing any significant implementation work and before claiming the task done or merging changes.
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

## Kimi Code Harness Compatibility

This skill is a Kimi Code CLI adaptation of the LazyCodex `review-work` orchestrator. In Kimi Code CLI, use the following tool mappings:

| LazyCodex / OpenCode concept | Kimi Code CLI equivalent |
| --- | --- |
| `task(subagent_type="oracle", ...)` | `Agent(subagent_type="coder", prompt=...)` — include all review context directly in the prompt and explicitly instruct the agent not to use tools (Oracle-style review). |
| `task(category="unspecified-high", ...)` | `Agent(subagent_type="coder", prompt=...)` — agent may use `Bash`, `Read`, `Grep`, `FetchURL`, or other available tools freely. |
| `multi_agent_v1.spawn_agent` / parallel background agents | `AgentSwarm` with a prompt template containing `review-work`, or sequential `Agent` calls if only synchronous execution is available. |
| `multi_agent_v1.wait_agent` / `background_output(task_id=...)` | `Agent` runs to completion and returns its final result. `AgentSwarm` collects results from all parallel agents. |
| `apply_patch` / Codex write or edit | `Write` / `Edit`. |
| `codex_app.set_thread_title` | Remove — Kimi has no thread title concept. |
| `browser:control-in-app-browser` / Codex browser plugin | Kimi Code CLI has no built-in browser tool. Use the `kimi-webbridge` skill if available, or `FetchURL` for static pages. For interactive browser automation, ask the user or use a project-specific Playwright/Cypress script via `Bash`. |
| `team_*(...)` | `AgentSwarm`. |

**Role-specific behavior must be described in a self-contained `prompt`.** Paste only the review context that worker needs. Oracle agents cannot read files in the original workflow; in Kimi, simulate this by explicitly instructing the Oracle agent: "Do NOT read files or run commands. Base your review solely on the context provided below."

For work likely to exceed a reasonable response window, require the child to emit `WORKING: <task> - <current phase>` before long passes and `BLOCKED: <reason>` only when progress stops. Treat a running `AgentSwarm` lane as alive. If an `Agent` call times out without a substantive deliverable, mark that review lane `INCONCLUSIVE`, do not count it as PASS, and retry with a smaller, more focused prompt. If the retry budget is exhausted, keep the lane `INCONCLUSIVE` and still emit a final aggregate result.

# Review Work - 5-Agent Parallel Review Orchestrator

Launch 5 specialized sub-agents in parallel to review completed implementation work from every angle. All 5 must pass for the review to pass. If even ONE fails, the review fails.

The 5 agents cover complementary concerns - together they form a comprehensive review that no single reviewer could match:

| # | Agent | Type | Role | Focus Level |
|---|-------|------|------|-------------|
| 1 | Goal Verifier | Oracle | Did we build what was asked? | MAIN |
| 2 | QA Executor | unspecified-high | Does it actually work? | MAIN |
| 3 | Code Reviewer | Oracle | Is the code well-written? | MAIN |
| 4 | Security Auditor | Oracle | Is it secure? | SUB |
| 5 | Context Miner | unspecified-high | Did we miss any context? | MAIN |

---

## Phase 0: Gather Review Context

Before launching agents, collect these inputs. Extract from conversation history first - the user's original request, constraints discussed, and decisions made are usually already in the thread. Only ask if truly missing.

<required_inputs>

- **GOAL**: The original objective. What was the user trying to achieve? Pull from the initial request in this conversation.
- **CONSTRAINTS**: Rules, requirements, or limitations. Tech stack restrictions, performance targets, API contracts, design patterns to follow, backward compatibility needs.
- **BACKGROUND**: Why this work was needed. Business context, user stories, related systems, prior decisions that informed the approach.
- **CHANGED_FILES**: Auto-collect via `git diff --name-only HEAD~1` or against the appropriate base (branch point, specific commit).
- **DIFF**: Auto-collect via `git diff HEAD~1` or against the appropriate base.
- **FILE_CONTENTS**: Read the full content of each changed file (not just the diff). Oracle agents cannot read files - they need full context in the prompt.
- **RUN_COMMAND**: How to start/run the application. Check `package.json` scripts, `Makefile`, `docker-compose.yml`, or ask the user.

</required_inputs>


Review PRs and branches from a dedicated review worktree only: create or attach one with `git worktree add <path> <branch>` before collecting changed files, diff, file contents, or running checks. The main worktree is read-only context; never checkout, test, or edit the review branch there.

**Auto-collection sequence:**

```bash
# 1. Get changed files
git diff --name-only HEAD~1  # or: git diff --name-only main...HEAD

# 2. Get diff
git diff HEAD~1  # or: git diff main...HEAD

# 3. Detect run command
# Check package.json -> "scripts.dev" or "scripts.start"
# Check Makefile -> default target
# Check docker-compose.yml -> services
```

For GOAL, CONSTRAINTS, BACKGROUND - review the full conversation history. The user's original message almost always contains the goal. Constraints often emerge during discussion. If anything critical is ambiguous, ask ONE focused question - not a checklist.

---

## Phase 1: Launch 5 Agents

Launch ALL 5 in parallel. In Kimi Code CLI, use `AgentSwarm` with a prompt template referencing `review-work`. Do not launch agents sequentially and do not wait between them.

**Oracle agents receive everything in the prompt** (they cannot read files or run commands). Include DIFF + FILE_CONTENTS + all context directly in the prompt text.

**unspecified-high agents are autonomous** - they can read files, run commands, and use tools. Give them goals and pointers, not raw content dumps.

---

### Agent 1: Goal & Constraint Verification (Oracle) - MAIN

This agent answers: "Did we build exactly what was asked, within the rules we were given?"

```
Agent(
  subagent_type="coder",
  prompt="""
<review_type>GOAL & CONSTRAINT VERIFICATION</review_type>

<original_goal>
{GOAL - paste the user's original request and any clarifications}
</original_goal>

<constraints>
{CONSTRAINTS - every rule, requirement, or limitation discussed}
</constraints>

<background>
{BACKGROUND - why this work was needed, broader context}
</background>

<changed_files>
{CHANGED_FILES - list of modified file paths}
</changed_files>

<file_contents>
{FILE_CONTENTS - full content of every changed file, clearly delimited per file}
</file_contents>

<diff>
{DIFF - the actual git diff}
</diff>

You are an Oracle reviewer. Do NOT read files or run commands. Base your review solely on the context provided above.

Review whether this implementation correctly and completely achieves the stated goal within the given constraints. Be obsessively thorough - the point of this review is to catch what the implementer missed.

REVIEW CHECKLIST:

1. **Goal Completeness**: Break the goal into every sub-requirement (explicit AND implied). For each, mark ACHIEVED / MISSED / PARTIAL. Missing even one implied requirement that a reasonable engineer would have addressed = PARTIAL at minimum.

2. **Constraint Compliance**: List every constraint. For each, verify compliance with specific code evidence. A constraint violated = automatic FAIL.

3. **Requirement Gaps**: Requirements the user clearly wanted but didn't spell out. Things implied by the goal or background that a thoughtful engineer would have included.

4. **Over-Engineering**: Anything added that wasn't requested - unnecessary abstractions, extra features, premature optimizations, speculative generality. Flag these as scope creep.

5. **Edge Cases**: Given the goal, what inputs or scenarios would break this? Trace through at least 5 edge cases mentally.

6. **Behavioral Correctness**: Walk through the code logic for 3+ representative scenarios. Does the code actually produce the expected behavior in each case?

OUTPUT FORMAT:
<verdict>PASS or FAIL</verdict>
<confidence>HIGH / MEDIUM / LOW</confidence>
<summary>1-3 sentence overall assessment</summary>
<goal_breakdown>
  For each sub-requirement:
  - [ACHIEVED/MISSED/PARTIAL] Requirement description
  - Evidence: specific code reference or gap
</goal_breakdown>
<constraint_compliance>
  For each constraint:
  - [ACHIEVED/MISSED] Constraint description - evidence
</constraint_compliance>
<findings>
  - [PASS/FAIL/WARN] Category: Description
  - File: path (line range if applicable)
  - Evidence: specific code or logic reference
</findings>
<blocking_issues>Issues that MUST be fixed. Empty if PASS.</blocking_issues>
""")
```

---

### Agent 2: QA via App Execution (unspecified-high) - MAIN

This agent answers: "Does it actually work when you run it?"

The QA agent follows a structured process: brainstorm scenarios exhaustively first, then self-review and augment, then create a task list, then execute systematically.

```
Agent(
  subagent_type="coder",
  prompt="""
<review_type>QA - HANDS-ON APP EXECUTION</review_type>

<original_goal>
{GOAL}
</original_goal>

<constraints>
{CONSTRAINTS}
</constraints>

<changed_files>
{CHANGED_FILES}
</changed_files>

<run_command>
{RUN_COMMAND - how to start the application, or "unknown" if not determined}
</run_command>

You are a QA engineer. Your job is to RUN the application and verify it works through hands-on testing. You do not review code - you test behavior.

MANDATORY PROCESS (follow in order):

### Step 1: Scenario Brainstorm

Before touching the app, write down EVERY test scenario you can think of. Be exhaustive. Think about:

- **Happy paths**: The primary use cases this implementation enables. What's the main thing the user wanted to do?
- **Boundary conditions**: Empty inputs, maximum-length inputs, zero values, negative numbers, special characters, unicode, very large datasets.
- **Error paths**: Invalid inputs, network failures, missing files, permission denied, timeout conditions.
- **Regression scenarios**: Existing features that touch the same code paths. Things that worked before and must still work.
- **State transitions**: What happens when you do things out of order? Rapid repeated actions? Concurrent usage?
- **UX scenarios** (if applicable): Layout on different sizes, keyboard navigation, screen reader compatibility, loading states, error messages.
- **Integration points**: Does this feature interact with external services, databases, or other modules? Test those boundaries.

Write each scenario as a one-liner with expected behavior. Aim for 15-30 scenarios minimum.

### Step 2: Scenario Augmentation

Review your scenario list with fresh eyes. For each scenario, ask:
- "What could go wrong here that I haven't considered?"
- "What would a malicious or careless user do?"
- "What environmental conditions could affect this?" (disk full, slow network, expired tokens)

Add at least 5 more scenarios from this reflection. Group scenarios by priority: P0 (must pass), P1 (should pass), P2 (nice to pass).

### Step 3: Create Task List

Convert your augmented scenario list into a structured task list. Each task = one test scenario with:
- Test name
- Steps to execute
- Expected result
- Priority (P0/P1/P2)

### Step 4: Execute Systematically

Work through the task list in priority order (P0 first). For each test:

1. Execute the test steps
2. Record actual result
3. Compare with expected result
4. Mark PASS or FAIL
5. If FAIL: capture evidence (terminal output snippet, error message, screenshot path if available)
6. Mark the task complete

**Execution guidance by app type:**
- **Web app**: Kimi Code CLI has no built-in browser tool. Use the `kimi-webbridge` skill if available, or `FetchURL` for static pages. For interactive browser automation, run Playwright/Cypress scripts via `Bash` or ask the user to provide a browser session.
- **CLI tool**: Run commands with various arguments, pipe inputs, check exit codes and output.
- **Library/SDK**: Write and execute a test script that imports and exercises the public API.
- **Backend API**: Use curl/httpie to hit endpoints with various payloads, verify response codes and bodies.
- **Mobile/Desktop**: If not directly runnable, write integration tests and execute them.

If the app cannot be started (build failure), that's an immediate FAIL - no need to continue.

### Step 5: Compile Results

OUTPUT FORMAT:
<verdict>PASS or FAIL</verdict>
<confidence>HIGH / MEDIUM / LOW</confidence>
<summary>1-3 sentence overall assessment</summary>
<scenario_coverage>
  Total scenarios: N
  P0: X tested, Y passed
  P1: X tested, Y passed
  P2: X tested, Y passed
</scenario_coverage>
<test_results>
  For each test:
  - [PASS/FAIL] Test name (Priority)
  - Steps: What you did
  - Expected: What should happen
  - Actual: What actually happened
  - Evidence: Terminal output snippet or screenshot path (if FAIL)
</test_results>
<blocking_issues>P0 or P1 failures only. Empty if PASS.</blocking_issues>
""")
```

---

### Agent 3: Code Quality Review (Oracle) - MAIN

This agent answers: "Is the code well-written, maintainable, and consistent with the codebase?"

```
Agent(
  subagent_type="coder",
  prompt="""
<review_type>CODE QUALITY REVIEW</review_type>

<changed_files>
{CHANGED_FILES}
</changed_files>

<file_contents>
{FILE_CONTENTS - full content of changed files AND neighboring files that show existing patterns}
</file_contents>

<diff>
{DIFF}
</diff>

<background>
{BACKGROUND}
</background>

You are a senior staff engineer conducting a code review. You are an Oracle reviewer: do NOT read files or run commands. Base your review solely on the context provided. Your standard: "Would I approve this PR without comments?"

REVIEW DIMENSIONS (examine each):

1. **Correctness**: Logic errors, off-by-one, null/undefined handling, race conditions, resource leaks, unhandled promise rejections.

2. **Pattern Consistency**: Does new code follow the codebase's established patterns? Compare with the neighboring files provided. Introducing a new pattern where one already exists = finding.

3. **Naming & Readability**: Clear variable/function/type names? Self-documenting code? Would another engineer understand this without explanation?

4. **Error Handling**: Errors properly caught, logged, and propagated? No empty catch blocks? No swallowed errors? User-facing errors are helpful?

5. **Type Safety**: Any `as any`, `@ts-ignore`, `@ts-expect-error`? Proper generic usage? Correct type narrowing? (If TypeScript/typed language)

6. **Performance**: N+1 queries? Unnecessary re-renders? Blocking I/O on hot paths? Memory leaks? Unbounded growth?

7. **Abstraction Level**: Right level of abstraction? No copy-paste duplication? But also no premature over-abstraction?

8. **Testing**: New behaviors covered by tests? Tests are meaningful, not just coverage padding? Test names describe scenarios?

9. **API Design**: Public interfaces clean and consistent with existing APIs? Breaking changes flagged?

10. **Tech Debt**: Does this introduce new tech debt? Or create coupling that will be painful to change?

Categorize each finding by severity:
- **CRITICAL**: Will cause bugs, data loss, or crashes in production
- **MAJOR**: Significant quality issue that should be fixed before merge
- **MINOR**: Improvement worth making but not blocking
- **NITPICK**: Style preference, optional

OUTPUT FORMAT:
<verdict>PASS or FAIL</verdict>
<confidence>HIGH / MEDIUM / LOW</confidence>
<summary>1-3 sentence overall assessment</summary>
<findings>
  - [CRITICAL/MAJOR/MINOR/NITPICK] Category: Description
  - File: path (line range)
  - Current: what the code does now
  - Suggestion: how to improve
</findings>
<blocking_issues>CRITICAL and MAJOR items only. Empty if PASS.</blocking_issues>
""")
```

---

### Agent 4: Security Review (Oracle) - SUB

This agent answers: "Are there security vulnerabilities in these changes?"

This is supplementary - it focuses exclusively on security. It does NOT comment on code style, architecture, or functionality unless those directly create a security risk.

```
Agent(
  subagent_type="coder",
  prompt="""
<review_type>SECURITY REVIEW (supplementary)</review_type>

<changed_files>
{CHANGED_FILES}
</changed_files>

<file_contents>
{FILE_CONTENTS - full content of changed files}
</file_contents>

<diff>
{DIFF}
</diff>

You are a security engineer and an Oracle reviewer: do NOT read files or run commands. Base your review solely on the context provided. Review this diff exclusively for security vulnerabilities and anti-patterns. Ignore code style, naming, architecture - unless it directly creates a security risk.

SECURITY CHECKLIST:

1. **Input Validation**: User inputs sanitized? SQL injection, XSS, command injection, SSRF vectors?
2. **Auth & AuthZ**: Authentication checks where needed? Authorization verified for each action? Privilege escalation paths?
3. **Secrets & Credentials**: Hardcoded secrets, API keys, tokens in code or config? Secrets in logs?
4. **Data Exposure**: Sensitive data in logs? PII in error messages? Over-exposed API responses?
5. **Dependencies**: New dependencies added? Known CVEs? Suspicious or unnecessary packages?
6. **Cryptography**: Proper algorithms? No custom crypto? Secure random? Proper key management?
7. **File & Path**: Path traversal? Unsafe file operations? Symlink following?
8. **Network**: CORS configured correctly? Rate limiting? TLS enforced? Certificate validation?
9. **Error Leakage**: Stack traces exposed to users? Internal details in error responses?
10. **Supply Chain**: Lockfile updated consistently? Dependency pinning?

OUTPUT FORMAT:
<verdict>PASS or FAIL</verdict>
<severity>CRITICAL / HIGH / MEDIUM / LOW / NONE</severity>
<summary>1-3 sentence overall assessment</summary>
<findings>
  - [CRITICAL/HIGH/MEDIUM/LOW] Category: Description
  - File: path (line range)
  - Risk: What could an attacker do?
  - Remediation: Specific fix
</findings>
<blocking_issues>CRITICAL and HIGH items only. Empty if PASS.</blocking_issues>
""")
```

---

### Agent 5: Context Mining (unspecified-high) - MAIN

This agent answers: "Did we miss any context that should have informed this implementation?"

```
Agent(
  subagent_type="coder",
  prompt="""
<review_type>CONTEXT MINING - MISSED REQUIREMENTS & BACKGROUND</review_type>

<original_goal>
{GOAL}
</original_goal>

<constraints>
{CONSTRAINTS}
</constraints>

<changed_files>
{CHANGED_FILES}
</changed_files>

<background>
{BACKGROUND}
</background>

You are an investigator. Your mission: search every accessible information source to find context that should have informed this implementation but might have been missed. The question: "Is there something we should have known but didn't?"

You may use `Bash`, `Read`, `Grep`, `FetchURL`, and any other available tools. You may NOT modify files.

SOURCES TO SEARCH (use every available tool):

1. **Git History** (ALWAYS search):
   - `git log --oneline -20 -- {each changed file}` - recent changes and their reasons
   - `git blame {critical sections}` - who wrote what and when
   - `git log --all --grep="{keywords from goal}"` - related commits
   - Look for reverted commits, TODO/FIXME/HACK comments in history

2. **GitHub** (if `gh` CLI available):
   - `gh issue list --search "{keywords}"` - related open/closed issues
   - `gh pr list --search "{keywords}" --state all` - related PRs and their review comments
   - Check if any issue is specifically linked to this work
   - Look at review comments on past PRs touching these files

3. **Communication Channels** (if MCP tools available):
   - Slack: search for messages mentioning the feature, file names, or related keywords
   - Notion: search for design docs, RFCs, ADRs related to this feature
   - Discord: relevant discussions

4. **Codebase Cross-References** (ALWAYS search):
   - Files that import or reference the changed modules
   - Tests that might need updating due to behavior changes
   - Documentation (README, docs/, comments) that references changed behavior
   - Config files that might need corresponding updates
   - Related features in the same domain

WHAT TO LOOK FOR:

- Requirements mentioned in issues/PRs that the implementation misses
- Past decisions explaining WHY code was written a certain way - and whether new changes respect those reasons
- Related systems or features affected by these changes
- Warnings from previous developers (PR review comments, inline TODOs, commit messages)
- Migration or deprecation notes that affect the changed code
- Design decisions documented outside the codebase (Notion, Slack, ADRs)

OUTPUT FORMAT:
<verdict>PASS or FAIL</verdict>
<confidence>HIGH / MEDIUM / LOW</confidence>
<summary>1-3 sentence overall assessment</summary>
<sources_searched>
  - [SEARCHED/SKIPPED] Source name - what was searched (or why it wasn't accessible)
</sources_searched>
<discovered_context>
  For each discovery:
  - Source: Where found (git commit abc123, GitHub issue #42, Slack message, etc.)
  - Finding: What was found
  - Relevance: How it relates to the current work
  - Impact: [BLOCKING / IMPORTANT / FYI]
</discovered_context>
<missed_requirements>Requirements the implementation should address but doesn't. Empty if none.</missed_requirements>
<blocking_issues>BLOCKING items only. Empty if PASS.</blocking_issues>
""")
```

---

## Phase 2: Wait & Collect

After launching all 5 agents in parallel via `AgentSwarm`, collect their results. Do not treat a timeout, ack-only reply, or empty child result as a PASS.

As each completes, preserve its result immediately; never lose a PASS/FAIL because another lane is still running. Store each verdict independently:

| Agent | Verdict | Notes |
|-------|---------|-------|
| 1. Goal Verification | pending/PASS/FAIL/INCONCLUSIVE | - |
| 2. QA Execution | pending/PASS/FAIL/INCONCLUSIVE | - |
| 3. Code Quality | pending/PASS/FAIL/INCONCLUSIVE | - |
| 4. Security | pending/PASS/FAIL/INCONCLUSIVE | - |
| 5. Context Mining | pending/PASS/FAIL/INCONCLUSIVE | - |

Do NOT deliver the final report until ALL 5 lanes have a terminal state: PASS, FAIL, or INCONCLUSIVE.
If a lane remains silent after the reliability followup, record it as inconclusive and respawn a smaller reviewer/worker for that exact lane. If it still remains unfinished after that retry, keep the lane INCONCLUSIVE and emit the final aggregate review result with the incomplete lane named. Do not spin in repeated wait/followup cycles.

---

## Phase 3: Deliver Verdict

<verdict_logic>

ALL 5 agents returned PASS → **REVIEW PASSED**
ANY agent returned FAIL → **REVIEW FAILED - criteria not met**
ANY lane is INCONCLUSIVE and none failed → **REVIEW INCONCLUSIVE - not approved**

</verdict_logic>

Compile the final report in this format:

```markdown
# Review Work - Final Report

## Overall Verdict: PASSED / FAILED / INCONCLUSIVE

| # | Review Area | Agent Type | Verdict | Confidence |
|---|------------|------------|---------|------------|
| 1 | Goal & Constraint Verification | Oracle | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |
| 2 | QA Execution | unspecified-high | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |
| 3 | Code Quality | Oracle | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |
| 4 | Security (supplementary) | Oracle | PASS/FAIL/INCONCLUSIVE | Severity |
| 5 | Context Mining | unspecified-high | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |

## Blocking Issues
[Aggregated from all agents - deduplicated, prioritized]

## Key Findings
[Top 5-10 most important findings across all agents, grouped by theme]

## Recommendations
[If FAILED: exactly what to fix, in priority order]
[If PASSED: non-blocking suggestions worth considering]
```

If FAILED - be specific. The user should know exactly what to fix and in what order. No vague "consider improving X" - state the problem, the file, and the fix.

If PASSED - keep it short. Highlight any non-blocking suggestions, but don't turn a passing review into a lecture.
