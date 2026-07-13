---
name: lcx-contribute-bug-fix
description: "Contribute a verified bug fix for LazyKimiCode, lazykimicode, bundled Kimi skills, hooks, MCP wiring, installer, marketplace sync, docs, packaging, or upstream Kimi Code CLI bugs. Opens a fork PR only for MoonshotAI/kimi-code; LazyKimiCode-owned defects become a verified-fix issue on ckanner/lazykimicode (never a PR — that repo is a generated distribution mirror). Use when the user asks to fix a bug, contribute a bug fix, contribute to fix bug, open a PR for a bug, or debug and PR an LazyKimiCode / Kimi Code CLI defect."
type: prompt
whenToUse: When the user asks to fix a bug, contribute a bug fix, open a PR for a bug, or debug and PR an LazyKimiCode or Kimi Code CLI defect.
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

# lcx-contribute-bug-fix

Use this skill to debug a concrete LazyKimiCode or Kimi Code CLI defect, implement the smallest correct fix in a fresh temporary workspace, and deliver it. Work in English, keep the body short, and support every claim with runtime or source evidence.

Route ownership the same way as `$lcx-report-bug`, but the deliverable differs by target:

- `ckanner/lazykimicode` for LazyKimiCode, lazykimicode, bundled skills, hooks, MCP wiring, installer behavior, marketplace sync, docs, or packaging. Deliverable: a verified-fix issue with the patch embedded. NEVER open a PR or push a branch against this repo — its contents are regenerated from the source tree on every release, so PRs there cannot be merged and will be closed.
- `MoonshotAI/kimi-code` for upstream Kimi Code CLI bugs that reproduce without LazyKimiCode or come from Kimi Code core behavior. Deliverable: a PR from a fork.

## Required Outcome

For `MoonshotAI/kimi-code`, create a fork PR that includes:

- a focused branch from a fresh `${TMPDIR:-/tmp}` clone/worktree
- reproduction logs from before the fix
- the smallest implementation that fixes the defect
- verification logs from after the fix
- apply `lazykimicode-generated` when label management is available
- the required LazyKimiCode footer tag `Tag: lazykimicode-generated`
- cleanup of temporary worktrees and clones

For `ckanner/lazykimicode`, create an issue (never a PR) that includes:

- reproduction logs from before the fix
- the root cause with source evidence
- the verified patch as a unified diff, produced and tested in a fresh `${TMPDIR:-/tmp}` clone/worktree
- verification logs from after the fix
- the `lazykimicode-generated` label and the footer tag `Tag: lazykimicode-generated`
- cleanup of temporary worktrees and clones

## Required Workflow

1. Read the user's bug report and identify the affected surface.
2. Invoke the `$debugging` skill for the investigation. If the skill namespace requires qualification, invoke it as `$debugging` and state that it is the lazykimicode debugging skill.
3. Materialize the latest sources under `LAZYKIMICODE_SOURCE_ROOT="${LAZYKIMICODE_SOURCE_ROOT:-${TMPDIR:-/tmp}/lazykimicode-sources}"`, then decide the target repository. Use `Agent(subagent_type="explore")` to compare the two checkouts when ownership is ambiguous. Sync both checkouts on every run and compare them before choosing. Validate cached checkouts before reuse so an incomplete `.git` directory cannot route the fix to the wrong repo:

```bash
LAZYKIMICODE_SOURCE_ROOT="${LAZYKIMICODE_SOURCE_ROOT:-${TMPDIR:-/tmp}/lazykimicode-sources}"
mkdir -p "$LAZYKIMICODE_SOURCE_ROOT"

valid_source_checkout() {
  DEST="$1"
  git -C "$DEST" rev-parse --is-inside-work-tree >/dev/null 2>&1 &&
    git -C "$DEST" config --get remote.origin.url >/dev/null 2>&1
}

recover_corrupt_source_checkout() {
  DEST="$1"
  if [ -e "$DEST" ] && ! valid_source_checkout "$DEST"; then
    QUARANTINED="$DEST.corrupt.$(date +%Y%m%d%H%M%S)"
    mv "$DEST" "$QUARANTINED"
    echo "Moved corrupt source cache $DEST to $QUARANTINED" >&2
  fi
}

sync_latest_source() {
  REPO="$1"; DEST="$2"
  recover_corrupt_source_checkout "$DEST"
  if [ ! -d "$DEST" ]; then
    gh repo clone "$REPO" "$DEST" -- --depth=1 \
      || git clone --depth=1 "https://github.com/$REPO" "$DEST"
  fi
  if ! valid_source_checkout "$DEST"; then
    echo "Source cache $DEST is not a usable git checkout after clone" >&2
    return 1
  fi
  git -C "$DEST" remote set-url origin "https://github.com/$REPO.git" >/dev/null 2>&1 || true
  DEFAULT_BRANCH="$(git -C "$DEST" remote show origin | sed -n '/HEAD branch/s/.*: //p')"
  if [ -z "$DEFAULT_BRANCH" ]; then
    DEFAULT_BRANCH="$(git -C "$DEST" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')"
  fi
  if [ -z "$DEFAULT_BRANCH" ]; then
    echo "Could not determine default branch for $REPO in $DEST" >&2
    return 1
  fi
  git -C "$DEST" fetch --depth=1 origin "$DEFAULT_BRANCH"
  git -C "$DEST" checkout -B "$DEFAULT_BRANCH" FETCH_HEAD
}
sync_latest_source ckanner/lazykimicode "$LAZYKIMICODE_SOURCE_ROOT/lazykimicode-source"
sync_latest_source MoonshotAI/kimi-code "$LAZYKIMICODE_SOURCE_ROOT/kimi-code-source"
```

4. Create a fresh temporary clone and branch under `${TMPDIR:-/tmp}`. Do not modify the user's current repository for the target fix unless the current repository is itself the requested target and the user explicitly asked for local edits. Use `Agent(subagent_type="coder")` to carry out the implementation inside the worktree.

```bash
TARGET_REPO="ckanner/lazykimicode" # or MoonshotAI/kimi-code
WORK_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/lazykimicode-fix-XXXXXX")"
gh repo clone "$TARGET_REPO" "$WORK_ROOT/repo" -- --depth=1
cd "$WORK_ROOT/repo"
BASE_BRANCH="$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')"
git fetch origin "$BASE_BRANCH" --depth=1
BRANCH_NAME="lazykimicode/bug-fix-<short-slug>"
git worktree add "$WORK_ROOT/worktree" -b "$BRANCH_NAME" "origin/$BASE_BRANCH"
cd "$WORK_ROOT/worktree"
```

If `gh` cannot clone, use `git clone --depth=1 "https://github.com/$TARGET_REPO" "$WORK_ROOT/repo"` and continue with the same worktree flow.

5. Reproduce the bug in the worktree through the real surface. Save exact command output to `${TMPDIR:-/tmp}/lazykimicode-fix-<short-slug>-repro.log`. Use `Agent(subagent_type="explore")` to identify the reproduction surface and `Agent(subagent_type="coder")` to run it.
6. Write or update a failing regression test before production changes. Confirm it fails for the bug, not for a missing fixture or typo.
7. Implement the smallest correct fix with `Write` / `Edit`. Avoid refactors unless the fix cannot be made safely without one.
8. Run the regression test, adjacent tests, and the smallest real-surface QA command that proves the user-visible behavior changed.
9. Commit the verified fix in the worktree. Inspect the status first so the delivered diff cannot be empty or stale:

```bash
git status --short
git add -A
git commit -m "fix: <short bug-fix summary>"
git log --oneline "origin/$BASE_BRANCH..HEAD"
```

10. Build the delivery body for the target:
   - `MoonshotAI/kimi-code`: generate the PR body with `scripts/create-pr-body.mjs` if it is present in the skill directory; otherwise produce the PR body manually from the PR Body Template below.
   - `ckanner/lazykimicode`: export the verified patch and write the issue body from the Verified-Fix Issue Template below:

```bash
PATCH_FILE="${TMPDIR:-/tmp}/lazykimicode-fix-<short-slug>.patch"
git diff "origin/$BASE_BRANCH"..HEAD > "$PATCH_FILE"
```

11. Ensure the generated label exists when the target repo allows label management. Keep the footer tag even when label creation is unavailable:

```bash
LABEL_ARGS=()
if gh label create lazykimicode-generated --repo "$TARGET_REPO" --color "7C3AED" --description "Created by LazyKimiCode" --force; then
  LABEL_ARGS=(--label lazykimicode-generated)
else
  echo "Label management unavailable for $TARGET_REPO; keeping the footer tag only."
fi
```

12. Deliver the fix.
   - `ckanner/lazykimicode`: create the verified-fix issue. Never push a branch to this repo and never run `gh pr create` against it:

```bash
ISSUE_BODY="${TMPDIR:-/tmp}/lazykimicode-fix-<short-slug>-issue.md"
gh issue create --repo ckanner/lazykimicode --title "<short fix title>" "${LABEL_ARGS[@]}" --body-file "$ISSUE_BODY"
```

   - `MoonshotAI/kimi-code`: fork, push the branch to the fork, and create the PR:

```bash
gh repo fork MoonshotAI/kimi-code --remote --remote-name fork
GH_USER="$(gh api user --jq .login)"
git push -u fork "$BRANCH_NAME"
gh pr create --repo MoonshotAI/kimi-code --base "$BASE_BRANCH" --head "$GH_USER:$BRANCH_NAME" --title "<short fix title>" "${LABEL_ARGS[@]}" --body-file "$PR_BODY"
```

13. Clean up:

```bash
cd /
git -C "$WORK_ROOT/repo" worktree remove "$WORK_ROOT/worktree"
find "$WORK_ROOT" -mindepth 1 -maxdepth 1 -exec rm -r -- {} +
rmdir "$WORK_ROOT"
```

Return the PR or issue URL, the reproduction command, the verification command, and the cleanup receipt.

## Verified-Fix Issue Template (ckanner/lazykimicode)

Write the issue body in English. Embed the patch verbatim so a maintainer can apply it to the source tree:

````markdown
## Problem Situation
[What failed for the user.]

## Reproduction Logs
[Exact failing command and relevant log excerpt.]

## Root Cause
[Confirmed cause with runtime and source evidence.]

## Verified Fix
[What changed and why this is the smallest correct fix.]

```diff
[Contents of $PATCH_FILE.]
```

## Verification
- [RED test output or repro before the fix]
- [GREEN test output after the fix]
- [Manual QA command and result]

---
This fix was debugged, implemented, and verified with [LazyKimiCode](https://github.com/ckanner/lazykimicode).
Tag: lazykimicode-generated
````

## PR Body Generator (MoonshotAI/kimi-code)

Use the bundled script to generate the PR body if it is available. Create a JSON file with this shape:

```json
{
  "title": "Fix short user-visible failure",
  "targetRepository": "MoonshotAI/kimi-code",
  "problem": "What is broken for the user.",
  "reproductionLogs": "Exact failing command, log excerpt, or trace.",
  "approach": "What changed and why this is the smallest correct fix.",
  "confidence": "Why the diagnosis and fix are strongly supported.",
  "risks": "Risk level and what could regress.",
  "userVisibleBehaviorChanges": "What changes for the user after the PR.",
  "verification": ["failing test before fix", "passing test after fix", "manual QA command"]
}
```

Run:

```bash
PR_INPUT="${TMPDIR:-/tmp}/lazykimicode-fix-<short-slug>-pr.json"
PR_BODY="${TMPDIR:-/tmp}/lazykimicode-fix-<short-slug>-pr.md"
node "<skill-root>/scripts/create-pr-body.mjs" "$PR_INPUT" "$PR_BODY"
```

If the script is not present, write the PR body manually from the PR Body Template below.

## PR Body Template (MoonshotAI/kimi-code)

The generated body must follow this structure:

```markdown
## Problem Situation
[What failed for the user.]

## Reproduction Logs
[Exact failing command and relevant log excerpt.]

## Approach
[What changed and why.]

## Why I Am Confident
[Evidence that proves the root cause and fix.]

## Risks
[Risk level and possible regressions.]

## User-Visible Behavior Changes
[What users experience after this PR.]

## Verification
- [RED test output or repro before the fix]
- [GREEN test output after the fix]
- [Manual QA command and result]

---
This PR was debugged, implemented, and created with [LazyKimiCode](https://github.com/ckanner/lazykimicode).
Tag: lazykimicode-generated
```

## Kimi Code Harness Compatibility

This skill is designed for the Kimi Code CLI plugin harness. Map its workflow and subagent needs to Kimi-native tools as follows:

| Codex / OpenCode concept | Kimi Code equivalent |
| --- | --- |
| `multi_agent_v1.spawn_agent({..., "agent_type": "explore"})` | `Agent(prompt=..., subagent_type="explore")` |
| `multi_agent_v1.spawn_agent({..., "agent_type": "coder"})` | `Agent(prompt=..., subagent_type="coder")` |
| `multi_agent_v1.spawn_agent({..., "agent_type": "plan"})` | `Agent(prompt=..., subagent_type="plan")` |
| `multi_agent_v1.wait_agent(...)` / `background_output(task_id=...)` | `Agent` runs to completion; use `AgentSwarm` to collect parallel results |
| `codex_app.create_thread` / `send_message_to_thread` / `read_thread` | Kimi has no persistent thread primitive; use sequential `Agent` calls or `AgentSwarm` |
| `codex_app.set_thread_title` | Remove — Kimi has no thread title concept |
| `apply_patch` / Codex write or edit | `Write` for new files, `Edit` for incremental changes |
| `browser:control-in-app-browser` (Codex) | Use the `kimi-webbridge` skill if available, or `FetchURL` for public pages; ask the user if neither is sufficient |

> **Fallback if `kimi-webbridge` is not available:** Use `FetchURL` to read the page, or ask the user to perform the browser step manually and paste the result.
| OpenCode `task(...)` helper | `Agent(...)` |
| `team_*(...)` / `teammode` | `AgentSwarm` |

When translating `load_skills=[...]`, name the skills inside the agent prompt. Kimi Code invokes skills by prompt context and skill name. If a code block below conflicts with this section, this section wins.

## Stop Conditions

Stop and ask one narrow question only when:

- the bug cannot be reproduced from available information
- target repository ownership remains ambiguous after comparing LazyKimiCode and upstream Kimi Code evidence
- authentication is missing for creating the issue or pushing and creating the PR
- the fix requires a product decision rather than a technical correction

Do not open:

- a PR or pushed branch targeting `ckanner/lazykimicode` — deliver the verified-fix issue instead, always
- a PR or verified-fix issue without a failing-before and passing-after test
- a PR or verified-fix issue without a real-surface QA command
- a PR or issue without the `Tag: lazykimicode-generated` footer
- a verified-fix issue without the patch embedded in a `diff` block
- a vague fix that does not identify the root cause
- a broad refactor disguised as a bug fix
