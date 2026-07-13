---
name: ultraresearch
description: Legacy alias for ulw-research. Use when the user invokes ultraresearch, /ultraresearch, or $ultraresearch; immediately load and follow the ulw-research skill.
type: prompt
whenToUse: When the user asks for ultraresearch, /ultraresearch, or $ultraresearch.
---

# Ultraresearch Alias

`ultraresearch` is the legacy name for `ulw-research`.

When this skill is selected, immediately load `../ulw-research/SKILL.md` and follow it as the source of truth. Treat `/ultraresearch`, `$ultraresearch`, and plain `ultraresearch` exactly like `/ulw-research`, `$ulw-research`, and plain `ulw-research`.

## Kimi Code Harness Compatibility

- Use `Read` to load `../ulw-research/SKILL.md` when this skill is invoked.
- Use `Agent(subagent_type="explore"|"coder"|"plan")` for the multi-step research workflow as instructed by `ulw-research`.
- Use `AgentSwarm` when `ulw-research` calls for parallel independent research passes.
- Kimi has no thread-title concept; drop any `codex_app.set_thread_title` or thread-management instructions from `ulw-research`.
- Kimi does not support per-skill agent TOML files (e.g. `agents/openai.yaml`); do not copy or reference them.
