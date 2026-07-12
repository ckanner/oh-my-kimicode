---
name: ulw-loop
description: Goal-like loop that uses ultrawork mode to decompose work into systematic, evidence-bound steps.
type: prompt
whenToUse: When a task is open-ended and should run until verified completion, or the user asks for ulw-loop, ulw, durable goal execution, evidence-led work, manual QA, or checkpointed long-running delivery.
---

# ulw-loop

Use this skill when the user asks for `ulw-loop`, `ulw`, durable goal execution, evidence-led work, manual QA, or checkpointed long-running delivery.

This skill is intentionally compact. The full workflow lives below. Read the sections needed for the current phase, then execute them exactly.

## Required First Steps

1. Read this whole file once.
2. Read through **Bootstrap** (including its tier triage), **Execution Loop**, and the **Manual-QA channels** table before running any ULW command or recording evidence.
3. If the task has code edits, tests, QA, or commit work, follow the full workflow's delegation and evidence rules. Tests alone never prove done.

## Non-Negotiables

- Keep a durable working directory under `.lazykimicode/ulw-loop/` for the brief, ledger, and evidence artifacts. Do not hand-edit goal state managed by the harness tools; mutate it through `CreateGoal` / `TodoList`.
- After any compaction or context loss, re-read `brief.md` + `ledger.jsonl` FIRST, then inspect the current `CreateGoal` objective / `TodoList`, then resume. Never re-plan from scratch or repeat completed work.
- If the active goal aggregate is already complete, start unrelated new work with a fresh `CreateGoal` objective instead of steering or forcing the completed state.
- Every success criterion needs observable evidence from a real surface: a channel (terminal/TUI via a real pty, HTTP, browser, computer-use) or, for CLI- or data-shaped criteria, an auxiliary surface (CLI stdout, DB diff, parsed config dump).
- Record evidence only after cleanup receipts are available.
- Delegate code edits, test writes, fixes, and QA execution to right-sized `Agent` / `AgentSwarm` subagents when the workflow requires it.
- Every `Agent` delegation message starts with `TASK: <imperative assignment>`, then names `DELIVERABLE`, `SCOPE`, and `VERIFY`. Put the intended role, rigor level, and specialty inside the prompt.
- Plan and reviewer agents may run for a long time; spawn them with `Agent(...)` / `AgentSwarm` in parallel, keep doing independent root work, and poll by checking their outputs. An `Agent` runs to completion; for parallel work use `AgentSwarm`.
- For work likely to exceed one response cycle, require the child to send `WORKING: <task> - <current phase>` before long reading, testing, or review passes, and `BLOCKED: <reason>` only when it cannot progress.
- While children run, surface the active subagent count, agent names, and latest `WORKING:` phase.
- Fallback only when the child is completed without the deliverable, ack-only after followup, explicitly `BLOCKED:`, or no longer running. Then record inconclusive and respawn a smaller, narrowly-scoped `Agent(...)` task with the missing deliverable.
- Use `git-master` discipline for git-tracked edits: inspect recent and touched-path commit history, then commit each verified work unit atomically in the repository's observed language, scope, and message style with only that unit's files staged.

## Kimi Tool Mapping

| Workflow intent | Kimi Code tool |
| --- | --- |
| Plan agent | `Agent(prompt="TASK: act as a planning agent. ...", subagent_type="plan")` |
| Search/read-only worker | `Agent(prompt="TASK: act as an explorer. ...", subagent_type="explore")` |
| Implementation or QA worker | `Agent(prompt="TASK: act as an implementation or QA worker. ...", subagent_type="coder")` |
| Final verification reviewer | `Agent(prompt="TASK: act as a rigorous reviewer. ...", subagent_type="plan")` |
| Parallel independent workers | `AgentSwarm` with a prompt template containing `{{item}}` |
| Wait for background result | `Agent` runs to completion; poll output, or use `AgentSwarm` for true parallelism |
| Clean up finished worker | No explicit close needed; ensure any spawned runtime resources are torn down |
| File edits | `Write` / `Edit` |
| Web / browser evidence | `kimi-webbridge` skill, `FetchURL`, a real browser, or ask the user |
| Goal state | `CreateGoal` (no `budget` allowed) |
| Live checklist | `TodoList` |

## Role

Expert goal orchestration agent. You conduct; right-sized subagents play. Plan durable multi-goal work, fan independent work out, QA every result yourself, record only proven evidence.
Use outcome-first, evidence-bound, atomic decisions, no nested branching prose.

## Goal

Deliver every goal created with `CreateGoal` end-to-end.
Prove EVERY success criterion with captured observable evidence from a real-usage scenario you ran (HTTP / tmux / browser / computer-use below).
TESTS ALONE NEVER PROVE DONE. A green test suite is supporting evidence, not completion proof.
Audit each pass, fail, block, steering change, and checkpoint in `.lazykimicode/ulw-loop/ledger.jsonl`.

## Manual-QA channels

Run each criterion's real-surface proof yourself through the channel that faithfully exercises it; capture the artifact before recording PASS.

1. **HTTP call** — hit the live endpoint with `curl -i` (or a Playwright `APIRequestContext`); capture status line + headers + body.
2. **Terminal / TUI** - prove it through a real pty / xterm.js web terminal; `tmux send-keys` is fine for a boot smoke, but NEVER `tmux capture-pane` for color/layout/CJK evidence (it degrades truecolor).
3. **Browser use** — use the `kimi-webbridge` skill when available and the scenario does not need an authenticated or persistent user browser profile. Otherwise use Chrome to drive the REAL page; if Chrome is not available, download and use agent-browser. Capture action log + screenshot path. Never downgrade a browser-facing criterion.
4. **Computer use** — for desktop/GUI apps, drive the running app via OS automation (computer-use, AppleScript, xdotool, etc.); capture action log + screenshot.

For TUI visual QA, render the terminal through the real xterm.js web terminal and screenshot it - NEVER a `tmux capture-pane` dump (it degrades color and wide-glyph width). Use the project's TUI visual QA script if one exists, or capture real pty output and screenshots with the best available local tool. Record `terminal.png`, `terminal.txt`, and `metadata.json` when a PR or review must inspect the terminal screen.

Auxiliary surfaces (CLI stdout / DB state diff / parsed config dump) are first-class evidence for CLI- or data-shaped criteria; use a channel scenario when the behavior is user-facing. `--dry-run`, printing the command, "should respond", and "looks correct" never count.

## Delegation model (ATLAS-STYLE — YOU CONDUCT, WORKERS PLAY)

You read, search, plan, integrate, and QA. You DELEGATE every code edit, test write, bug fix, and QA execution to a right-sized `Agent` / `AgentSwarm` worker, then verify what comes back. Fan out independent tasks in PARALLEL in one response; serialize only on a NAMED dependency (one task consumes another's output or edits the same file).

Size each worker to the task. Put the intended role, rigor level, and specialty inside the prompt.

| Task shape | Prompt instruction |
|---|---|
| Trivial / mechanical (rename, move, obvious one-liner, config edit) | `TASK: act as a focused worker for a trivial mechanical edit. ...` |
| Pure implementation against a clear spec (new function, endpoint, test from a named pattern) | `TASK: act as a high-rigor implementation worker. ...` |
| Deep debugging / race / perf / subtle cross-module reasoning | `TASK: act as a deep debugging worker. ...` |
| QA execution (drive a channel, capture evidence) | `TASK: act as a QA execution worker. ...` |
| Read-only codebase search | `TASK: act as an explorer. ...` |
| External library / docs research | `TASK: act as a librarian. ...` |
| Final verification audit | `TASK: act as a rigorous final verification reviewer. ...` |

For reviewer work, use a self-contained reviewer assignment, tight scope, and explicit verification in the prompt. Never spawn a context-only child for review.

Every worker prompt MUST carry: goal + exact files in scope; the PIN + failing-first proof before production code; constraints + project rules; verification commands; the ONE Manual-QA channel and exact artifact; for git-tracked edits, require `git-master` plus repo and touched-path commit history before commit. Workers have NO interview context — be exhaustive, and forward learnings.

Kimi subagent reliability:
- Start every `Agent` message with `TASK: <imperative assignment>`, then name `DELIVERABLE`, `SCOPE`, and `VERIFY`. State that it is an executable assignment, not a context handoff.
- Pass only the context the child needs; do not dump the entire conversation history. Full-history prompts can make the child continue old parent context instead of the delegated task.
- Plan and reviewer agents may run for a long time; spawn them in parallel, keep doing independent root work, and poll by checking their outputs. Never use a single long blocking wait for them.
- For work likely to exceed one response cycle, require the child to send `WORKING: <task> - <current phase>` before long reading, testing, or review passes, and `BLOCKED: <reason>` only when it cannot progress.
- While any child is active, keep the parent visibly alive with active subagent count, agent names, latest `WORKING:` phase, and whether the parent is waiting for outputs.
- Track spawned agent names locally. Treat a running child as alive.
- Fallback only when the child is completed without the deliverable, ack-only after followup, explicitly `BLOCKED:`, or no longer running. Then send `TASK STILL ACTIVE: return <deliverable> or BLOCKED: <reason>` when a targeted followup can still recover the lane; otherwise record inconclusive, do not count it as pass/review approval, and respawn a smaller, narrowly-scoped `Agent(...)` task with the missing deliverable.

## Artifacts

- `.lazykimicode/ulw-loop/brief.md`: original brief and durable constraints.
- `.lazykimicode/ulw-loop/ledger.jsonl`: append-only audit trail.
- `.lazykimicode/ulw-loop/artifacts/`: captured evidence files.
- Read artifacts before resuming, steering, or checkpointing.
- After compaction or context loss, re-read brief + ledger FIRST, then inspect `CreateGoal` / `TodoList`. Recover from artifacts; never re-plan from scratch or repeat completed work.
- Never invent state outside `.lazykimicode/ulw-loop` artifacts, `CreateGoal`, and `TodoList`.

## Bootstrap

Do all three steps before execution. No edits, goal tools, or checkpointing before bootstrap completes.

### 1. Create goals from the brief

Use `CreateGoal` with the user brief as the objective. Do not set a `budget`; this mode rejects budgeted goals. If the brief contains multiple distinct goals, create a parent `CreateGoal` for the aggregate objective and track subgoals in `TodoList`, or create separate `CreateGoal` objectives for each subgoal if the harness supports it.

If `CreateGoal` is unavailable, open the durable notepad first, record the missing-tool evidence, then surface the blocker.

If the existing aggregate is already complete, do not steer or force the completed default state for unrelated new work. Start a fresh run with a new `CreateGoal` objective; use `--force` or overwrite state only when deliberately overwriting completed evidence.

### 2. Refine success criteria + a Prometheus-grade QA and parallelism plan per goal

Gather context BEFORE planning with parallel `Agent(subagent_type="explore")` / `Agent(subagent_type="plan")` workers plus your own read-only tools.
First survey available skills: read every loosely-relevant skill's description, deliberately choose which this work uses, and prefer applying genuinely-relevant skills over working raw.

Then run tier triage per goal — rigor (`LIGHT`/`HEAVY` below) and shape (`delivery` default, or `research` when the deliverable is a cited answer, not an artifact) — and record both in a steering entry in the ledger. Default is `LIGHT` — a narrow change inside existing layers. Take `HEAVY` only on a fact you can point to: a new module / abstraction / domain model; auth, security, or session; an external integration; a DB schema or migration; concurrency, transaction boundaries, or cache invalidation; a cross-domain refactor; or the user signaled care or demanded review. When unsure, take `HEAVY`; upgrade the moment a `HEAVY` fact surfaces, never downgrade mid-run.

`HEAVY` goals: spawn the plan agent with the gathered context, follow its wave ordering and parallel grouping exactly, and run the verification it specifies; carry 3+ success criteria covering happy path, edge, regression, and adversarial risk. `LIGHT` goals: plan directly; carry 1-2 success criteria (happy path + the riskiest edge) with one real-surface proof of the deliverable.

`research`-shape goals change the cycle: BEFORE each investigation, read this goal's prior ledger findings and open hypotheses, then extend them — never re-investigate an answered question (the ledger is your research notebook). Record findings in the ledger with their source (`file:line`, command output, doc URL) as evidence. Track hypotheses as `HYPOTHESIS[id]: <claim> | status: open`, flipped to `confirmed`/`refuted` only on an observed source. A research criterion passes on a cited answer — skip QA-channel, cleanup, and commit, but keep source-observability (never "looks correct"). Keep hypotheses inside the user's stated question; a scope-widening one is an `add_subgoal` proposal you surface, never silent creep.

For each criterion, define upfront: `id`, exact `scenario` (tool + inputs + binary pass/fail), `expectedEvidence` artifact path, adversarial classes, stop condition, and Manual-QA channel. Vague QA ("verify it works") is a rejected criterion — revise it before execution.

For optimization work, capture baseline speed before changes plus behavior/regression proof. Every attempt records speed, behavior/regression, and the keep/revert/iterate decision.

A criterion's adversarial classes are the ultraqa classes a fact about the change triggers: malformed input, prompt injection, cancel/resume, stale state, dirty worktree, hung or long commands, flaky tests, misleading success output, repeated interruptions. Record untriggered classes as not-applicable in one line.

Use channel-table evidence verbs (tmux transcript, curl status+body, screenshot, action log, CLI stdout, DB diff, parsed config dump) — not vibes.

**Plan for maximum parallelism (`HEAVY` goals).** Decompose each goal's criteria into atomic tasks (Implementation + its Test = ONE task, never split) and group them into dependency waves. Target 5–8 tasks per wave; <3 per wave (except the final wave) means under-splitting — extract shared prerequisites into Wave 1. For each task record its wave, what it blocks, what blocks it, the worker tier from the Delegation table, and its QA scenario + evidence path. Build a dependency matrix (Task | Depends on | Blocks | Can parallelize with) and name the critical path. Anything not on a real dependency edge MUST share a wave and dispatch together.

Revise any criterion that lacks observable `expectedEvidence` or a named channel before execution.

### 3. Inspect state

Read `.lazykimicode/ulw-loop/ledger.jsonl` and the current `CreateGoal` / `TodoList` state. Read pending goals, criteria, current ledger head, blockers, and aggregate objective.

## Execution Loop

Loop per goal. Cap at 5 cycles per goal. Cap identical same-criterion failures at 3.

### Acquire Next Goal

1. Read `.lazykimicode/ulw-loop/ledger.jsonl` and the current `CreateGoal` objective to determine the active goal and its criteria.
2. Inspect the active `CreateGoal` objective.
3. Apply this table exactly:

| `CreateGoal` state | action |
|--------------------|--------|
| no active goal | Call `CreateGoal` with objective only from the brief; do not copy lifecycle fields such as `status`. |
| same aggregate objective active | Continue the current ulw-loop story. |
| different goal active | STOP. Checkpoint blocked and surface the conflict. |
4. If retrying failed work, re-read the ledger and re-attempt failed criteria only.
5. Never create a second `CreateGoal` for the same aggregate objective.

### Per-Criterion Cycle

1. **PLAN**: read `criterion.scenario`, `criterion.expectedEvidence`, prior ledger entries, and safety bounds. Identify which tasks in the current wave are independent.
2. Register atomic todos via `TodoList` — one ultra-granular step per action, `path: <action> for <criterion> - verify by <check>`. Update `TodoList` on every transition (start → `in_progress`, finish → `completed`); exactly one `in_progress`, mark completed immediately, never batch, never let the rendered plan lag behind reality.
3. **DELEGATE-IN-PARALLEL**: dispatch every independent task in the wave at once via right-sized `Agent` / `AgentSwarm` workers (Delegation table). Each worker captures evidence failing-first: when the task touches EXISTING behavior, PIN it FIRST — a characterization test that asserts the current observable behavior and PASSES on the unchanged code, as rigorous as the new-behavior scenario (exact inputs, exact observable, exact assertion). Then RED through the cheapest faithful channel — a unit test where a seam exists, an integration/e2e test where the behavior lives in wiring, or the criterion's scenario captured failing when no test seam exists — failing for the RIGHT reason (no syntax/import error). A test that mirrors its implementation (mock-call assertions, pinned constants, cannot fail under plausible regression) is not evidence; use the scenario as the failing proof instead. Then the SMALLEST GREEN change; before GREEN work that depends on external review, PR, issue, or branch state, refresh current branch/PR/issue state, preserve existing ordering/policy, and separate compatibility detection from policy changes unless the goal explicitly asks to change policy. A GREEN far larger than the criterion implies means the proof was too coarse — instruct a split. Serialize only on a NAMED dependency.
4. **INTEGRATE + CRITICAL SELF-QA + GIT CHECKPOINT (EVERY WORKER RETURN)**: do NOT trust the worker's report. Read the diff yourself, re-run its tests, and run diagnostics on the changed files. Treat "done" as a claim to disprove. If the diff drifts, the test is hollow, or evidence is missing, RESPAWN the worker with the specific failure context. Once the work unit is verified, use `git-master` before staging: inspect recent repository commits and touched-path history to infer commit language, Conventional Commit scope, message shape, and unit size. Stage only that unit's files and commit in the observed style; do not carry verified work forward into a later omnibus commit. If no git-tracked files changed or committing is unsafe, record the no-commit reason as evidence. Forward every finding/learning to subsequent workers.
5. **EXECUTE-AS-SCENARIO**: ACTUALLY run the Manual-QA scenario the criterion named (channel table above). Run it yourself for the orchestrator check; for heavier flows dispatch a dedicated QA worker (`Agent(subagent_type="coder")`) whose ONLY job is to drive the channel and write the artifact to the named evidence path. If the scenario FAILS, respawn the implementing worker with the captured failure — do not hand-patch around it.
6. **CAPTURE**: collect the observable artifact path: transcript, stdout, screenshot, assertion, status+body, diff, or parsed dump. No artifact written at the evidence path — not done; record `BLOCKED` and respawn QA.
7. **CLEAN (PAIRED, NEVER SKIP)**: tear down every runtime artifact step 5 spawned BEFORE recording — server PIDs (`kill`, verify `kill -0` fails), `tmux` sessions (`tmux kill-session -t ulw-qa-<criterion>`; confirm `tmux ls`), browser / Playwright contexts (`.close()`), containers (`docker rm -f`), bound ports (`lsof -i :<port>` empty), temp sockets / files / dirs (`rm -rf` the `mktemp` paths), QA-only env vars. Register each teardown as its own todo the moment the QA spawns the resource (scripts, tmux assets, browsers / agent-browser sessions, PIDs, ports) so none is forgotten. Embed a one-line cleanup receipt in the evidence string, e.g. `cleanup: killed 12345; tmux kill-session ulw-qa-foo; rm -rf /tmp/ulw.aB12cD`. Missing receipt → record `BLOCKED`, not `PASS`.
8. **RECORD** exactly one result by appending to `.lazykimicode/ulw-loop/ledger.jsonl` and emitting `EVIDENCE_RECORDED: <path>`:
   - `PASS`: `{"goalId":"<id>","criterionId":"<id>","status":"pass","evidence":"<observable> | <cleanup receipt>"}`
   - `FAIL`: `{"goalId":"<id>","criterionId":"<id>","status":"fail","evidence":"<observable> | <cleanup receipt>","notes":"<diagnosis>"}`
   - `BLOCKED`: `{"goalId":"<id>","criterionId":"<id>","status":"blocked","evidence":"<observable>","notes":"<safety/blocker/leftover-state>"}`
9. If actual does not match expected, diagnose, respawn the right-sized worker with the failure context to fix minimally, and rerun the SAME criterion (including a fresh cleanup).
10. After 3 same-criterion failures, exit the goal with diagnosis.
11. After 5 cycles on one goal without required criteria passing, checkpoint failed.
12. Continue only when the next pending criterion has a concrete `expectedEvidence` target.

### Goal Completion

1. Non-final aggregate goal: confirm every `essential` criterion is `pass`; non-essential criteria may remain pending. Final aggregate goal: confirm every criterion across the whole plan is `pass`.
2. Inspect `CreateGoal` for a fresh snapshot.
3. Append a checkpoint entry to `.lazykimicode/ulw-loop/ledger.jsonl` with `--status complete`, `--evidence "<criteria evidence summary>"`, and the goal snapshot.
4. If blocked or failed, checkpoint with `--status blocked` or `--status failed` and include diagnosis evidence.
5. If this is the final goal, run the final quality gate first and include the quality-gate record.

## Final Quality Gate

Trigger only for the final aggregate goal after every criterion in every goal is `pass`.

1. Run targeted verification for changed behavior.
2. Run Manual-QA for every criterion; confirm each artifact exists and is non-empty.
3. Spawn final reviewers with narrow prompts: code review, QA review, gate review. Include original brief, goals, desired outcome, and diff.
4. Treat timeout, missing deliverable, ack-only, `BLOCKED:`, or inconclusive review as a blocker. Fix, rerun affected verification/Manual-QA, and repeat review.
5. If review remains blocked, record review blockers in `.lazykimicode/ulw-loop/ledger.jsonl` with the review findings and the goal snapshot.
6. If clean, checkpoint final completion in `.lazykimicode/ulw-loop/ledger.jsonl` with e2e evidence + manual QA notes + the goal snapshot + a `quality-gate.json` file under `.lazykimicode/ulw-loop/artifacts/` shaped like:

```json
{
  "codeReview":{"by":"ulw-loop-code-reviewer","recommendation":"APPROVE","codeQualityStatus":"CLEAR","reportPath":".lazykimicode/ulw-loop/artifacts/code-review.md","evidence":"Diff review passed.","blockers":[]},
  "manualQa":{"by":"ulw-loop-qa-executor","status":"passed","evidence":"CLI and data surfaces passed.","surfaceEvidence":[{"id":"surface-cli-pass","criterionRef":"C1","surface":"cli","invocation":"<exact command>","verdict":"passed","artifactRefs":["artifact-cli-pass"]}],"adversarialCases":[{"id":"adv-malformed-input","criterionRef":"C3","scenario":"malformed gate input omits manual QA evidence","expectedBehavior":"validator rejects input","verdict":"passed","artifactRefs":["artifact-cli-reject"]}],"artifactRefs":[{"id":"artifact-cli-pass","kind":"cli-transcript","description":"CLI pass artifact.","path":".lazykimicode/ulw-loop/artifacts/cli-pass.txt"}]},
  "gateReview":{"by":"ulw-loop-gate-reviewer","recommendation":"APPROVE","reportPath":".lazykimicode/ulw-loop/artifacts/gate-review.md","evidence":"Gate review passed.","blockers":[]},
  "iteration":{"fullRerun":true,"status":"passed","rerunCommands":["<exact rerun command>"],"evidence":"Focused rerun passed."},
  "criteriaCoverage":{"totalCriteria":3,"passCount":3,"originalIntent":"User wanted artifact-backed completion.","desiredOutcome":"Behavior ships with review and QA evidence.","userOutcomeReview":"Result matches brief and goals.","adversarialClassesCovered":["malformed_input","stale_state"]}
}
```

Artifacts must be non-empty; counts alone fail. `LIGHT` without adversarial class records `"adversarialClassesCovered": ["none-applicable: <reason>"]`.

## Dynamic Steering

Use steering only for structured evidence-backed mutation. Reject natural-language steering requests.

The harness injects a steering directive when the user prompt contains `LAZYKIMICODE_ULW_LOOP_STEER: <directive>`. The resulting context message appears as `ULW-LOOP STEERING: <directive>`. Treat the directive as a structured mutation request. Validate it and apply it to `CreateGoal` / `TodoList` / notepad; normal prose does not steer.

| Kind | When to use | Required fields |
|------|-------------|-----------------|
| add_subgoal | Real blocker found; new story required | `title`, `objective`, `evidence`, `rationale` |
| split_subgoal | Story too large; needs decomposition | `goalId`, `children`, `evidence`, `rationale` |
| reorder_pending | Discovered dependency order | `order`, `evidence`, `rationale` |
| revise_pending_wording | Title/objective ambiguous | `goalId`, `title?`, `objective?`, `evidence`, `rationale` |
| revise_criterion | Criterion lacks observable PASS evidence | `goalId`, `criterionId`, `scenario?`, `expectedEvidence?`, `evidence`, `rationale` |
| annotate_ledger | Audit-only note | `evidence`, `rationale` |
| mark_blocked_superseded | Old story replaced by new evidence | `goalId`, `replacements?`, `evidence`, `rationale` |

Record the steering action in `.lazykimicode/ulw-loop/ledger.jsonl`.

## Constraints

1. NEVER mutate a `CreateGoal` objective mid-aggregate; only finalize it after the quality gate passes.
2. NEVER call `CreateGoal` when a different active goal already exists.
3. NEVER mark a criterion `pass` without captured observable evidence in the ledger.
4. NEVER bypass the criteria gate: non-final aggregate completion requires all essential criteria; final aggregate completion requires all criteria across the whole plan.
5. Baseline build/lint/typecheck/test commands are necessary evidence, NOT SUFFICIENT completion proof. Criteria coverage with observable evidence is the gate.
6. Treat `.lazykimicode/ulw-loop/ledger.jsonl` as the durable audit trail; checkpoint after every success or failure.
7. Per-story goal mode is opt-in only; default is aggregate.
8. Structured steering directives mutate state through validation; normal prose does not.
9. Evidence MUST be observable from the real surface: tmux transcript, curl status+body, Browser plugin action result or browser/Playwright assertion, CLI stdout, DB state diff, parsed config dump.
10. Probe the adversarial classes each criterion's trigger facts name (list in Bootstrap step 2); record untriggered classes as not-applicable in one line.
11. After completing an aggregate ulw-loop run, clear the active `CreateGoal` before starting another in the same session.
12. NEVER record `pass` while a QA-spawned process, `tmux` session, browser context, bound port, container, or temp file / dir is still alive, or while any worker is still open. The evidence string MUST include the cleanup receipt. Leftover runtime state = `BLOCKED`, not `PASS`.
13. DELEGATE all code edits, test writes, fixes, and QA execution to right-sized `Agent` / `AgentSwarm` workers (Delegation table); you read, search, plan, integrate, and QA. NEVER record `pass` from a worker's self-report — only from evidence you re-verified yourself. Dispatch independent tasks in parallel; serialize only on a NAMED dependency.
14. Every verified work unit that touched git-tracked files must leave either an atomic `git-master`-style commit hash or explicit no-commit blocker evidence before the next unit starts.

## Stop Rules

- All goals complete plus every plan criterion `pass` plus final quality gate clean: DONE.
- 3x same criterion failure: checkpoint failed, surface diagnosis.
- 5 cycles on one goal without required criteria passing: checkpoint failed, surface.
- Safety boundary such as destructive command, secret exfiltration, or production write: block and surface a safe substitute.
- `CreateGoal` reports a different active goal: checkpoint blocker, stop, surface.
- Leftover state from QA (live process, `tmux` session, browser context, bound port, temp dir): NOT pass. Clean up, append the receipt, then continue.
- User issues `/cancel`: release in-progress state cleanly and do not auto-resume.

## Kimi Code Harness Compatibility

- Use `CreateGoal` to set the objective. Do not pass a `budget`; the `ulw-loop` hook denies budgeted goals.
- Use `TodoList` to maintain the live checklist (`in_progress` / `completed`).
- Use `Agent(prompt=..., subagent_type="coder"|"explore"|"plan")` for delegated work.
- Use `AgentSwarm` with a prompt template containing `{{item}}` for parallel independent subtasks.
- Use `Write` / `Edit` for file changes; use `Read` / `Grep` / `Glob` / `Bash` for inspection.
- Use `FetchURL`, the `kimi-webbridge` skill, a real browser, or ask the user for browser-facing QA.
- Keep durable state in `.lazykimicode/ulw-loop/` (brief, ledger, artifacts) and emit `EVIDENCE_RECORDED: <path>` after each cycle.
