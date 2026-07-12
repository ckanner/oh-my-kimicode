---
name: rules
description: Load and respect project rules from .lazykimicode/rules/ and AGENTS.md.
type: prompt
whenToUse: At session start and before any significant action to ground work in project conventions.
---

# Rules

Read and apply project rules in this order:

1. `AGENTS.md` in the project root.
2. `.lazykimicode/rules/*.md` in the project root.
3. Inherited conventions from the parent directories' `AGENTS.md` if present.

When rules conflict, the most specific rule wins. If a rule is unclear, follow it conservatively and note the ambiguity.

## Kimi Code Harness Compatibility

- Use `Read` to load rule files.
- Use `Glob` to discover `.lazykimicode/rules/*.md`.
- Use `Agent(subagent_type="explore")` for large rule sets.
