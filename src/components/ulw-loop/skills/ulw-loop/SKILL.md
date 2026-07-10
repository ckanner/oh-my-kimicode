---
name: ulw-loop
description: Self-referential execution loop with evidence-based completion
type: prompt
whenToUse: When a task is open-ended and should run until verified completion.
---

# ULW-Loop

Repeatedly plan, act, and verify until success criteria are met. Each cycle must produce evidence. If criteria are unmet, loop again with a revised plan.

## Kimi Code Harness Compatibility

- Use `CreateGoal` to set the objective (no budget).
- Use `Agent(subagent_type="coder")` for implementation.
- Use `Agent(subagent_type="plan")` for planning reviews.
- Output `EVIDENCE_RECORDED: <path>` after each cycle.
