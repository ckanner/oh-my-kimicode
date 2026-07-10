---
name: teammode
description: Parallel multi-agent team orchestration for Kimi Code CLI
type: prompt
whenToUse: When the user asks for a team of agents to work in parallel.
---

# Teammode

Create a team of parallel agents using `AgentSwarm`. The leader (main session) coordinates; members are `Agent` or `AgentSwarm` invocations with focused scopes.

## Rules

1. Define each member's `focus` and `lens` concretely (area/ownership/perspective).
2. Use `AgentSwarm` when members can work independently; use sequential `Agent` when dependencies exist.
3. Members editing the same file must use separate git worktrees.
4. Track progress with `TodoList`.
5. Use the bundled `team.mjs` script (`node plugin/components/teammode/scripts/team.mjs <cmd>`) to manage team state (init, add-member, status, archive, delete).
6. Archive the team state when done.

## Kimi Code Harness Compatibility

- Use `AgentSwarm` with a prompt template containing `{{item}}` to spawn parallel members.
- Each item should be a member description; the swarm prompt instructs the member to report back.
- Use `Agent(subagent_type="coder")` for implementation members.
- Use `Agent(subagent_type="explore")` for research members.
- Use `Agent(subagent_type="plan")` for planning/review members.
