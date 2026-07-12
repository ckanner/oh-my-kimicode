---
name: teammode
description: "Kimi Code team orchestration: run a named team of cooperating Kimi workers with durable, script-managed state. MUST USE when the user asks Kimi to create, run, coordinate, inspect, archive, or delete a team of agents/sessions/subagents, or to work on something as a team in parallel. FIRST decides the orchestration shape: AgentSwarm for independent parallel members, or sequential/pipelined Agent calls when dependencies exist. The main session is always the leader; members are defined by a concrete part, ownership area, or perspective - never a vague job role; a bundled cross-platform script writes the .lazykimicode/teams state plus an auto-generated member field manual. Use a team when the work is not perfectly isolated but parallelizing helps; use plain subagents when scope is perfectly isolated or the goal is ambiguous. Triggers: team mode, teammode, make a team, run as a team, team of agents, coordinate agents, parallel Kimi agents, archive the team."
type: prompt
whenToUse: When the user asks for a team of agents to work in parallel.
---

# Teammode

Run a named team of cooperating Kimi workers under one leader, with durable state on disk.
This is a Kimi Code CLI workflow. It coordinates through Kimi's own `Agent` / `AgentSwarm`
primitives plus a bundled state script, on ONE of two orchestration shapes chosen up front:
`AgentSwarm` for parallel independent members, or sequential / pipelined `Agent` calls when
dependencies exist.

## When to use a team (and when to use plain subagents instead)

Use a TEAM when EITHER holds:
- the work does NOT split into perfectly isolated pieces, but doing it in parallel is clearly
  more convenient - members will need to see and react to each other's findings; or
- one task still needs exploration, yet its GOAL is already clear - parallel investigation under
  a fixed objective.

Use plain fire-and-forget subagents (`Agent(...)`) - NOT a team - when EITHER holds:
- the work IS perfectly isolated, so there is no coordination cost worth paying; or
- the GOAL is still ambiguous, where one mind should resolve direction before any fan-out.

A team buys cross-member coordination at a real overhead cost; only spend it when coordination
is the thing you actually need.

## Pick the orchestration shape FIRST - then tell the user

Before creating any team state, decide which shape this session can run.
Inspect your active tool list and select:

1. **AgentSwarm (preferred)** - select when the harness exposes `AgentSwarm` and the current
   wave's members have no hard dependencies inside the wave. Members are spawned from a single
   prompt template with a list of items; each item carries the member's concrete focus and
   deliverable.
2. **Sequential / pipelined Agent (fallback)** - select when `AgentSwarm` is not available, or
   when the work has ordering/dependencies that make a flat swarm inappropriate. Chain
   `Agent(prompt=..., subagent_type="coder"|"explore"|"plan")` calls; for mixed dependency
   graphs, run `AgentSwarm` on independent subsets, then an `Agent` integration step.
3. **No parallel harness available** - STOP before `init`. Tell the user which tools are
   missing; do not fake a team with partial tooling.

Then, BEFORE running `init`, tell the user in one line which shape you selected and why,
e.g. `Teammode shape: AgentSwarm (independent parallel members).` or
`Teammode shape: sequential Agent pipeline (dependencies present).`

Pass that choice to `init` as `--shape swarm` or `--shape pipeline`. The shape is recorded in
`team.json` and is IMMUTABLE for the team's lifetime: a swarm failure is a swarm blocker to
report, never permission to mix sequential agents into the same wave. Never probe by
trial-calling tools; read your tool list.

## You are the leader - orchestrate, do not implement

The main session is ALWAYS the team leader; you orchestrate directly and never spin up a
separate leader worker. Your job is orchestration, NOT writing product code: split the work
and assign each slice, hold live situational awareness of every member, verify and QA what
they deliver, relay findings between members, instruct and unblock, and synthesize the
result. DELEGATE every code edit to a member - if you catch yourself editing product files
while the team runs, that work was a member's slice you should have handed off. You own
direction, verification, and integration (the merge), not the keystrokes.

## Compose by part, ownership, or perspective - not by job title

A team is ALWAYS two or more members - never a single-member team. One worker on an isolated
job is a plain subagent, not a team; if you end up with a single member, either split off a
second distinct slice or drop the team and use a subagent.

Compose the team from what you actually KNOW about the work. Ground the split in real
knowledge of the problem, then divide it into clear, non-overlapping responsibilities - one
per aspect of the work - and give each member exactly one. No two members may own the same
thing. Define each member by a concrete slice: a specific part of the codebase, an ownership
area, or a distinct perspective/lens. Assigning a vague role ("backend dev", "release
analyst", "the tester") is an anti-pattern - it gives the member no real boundary and invites
overlap. Each member's `focus` names what they own concretely; the `lens` is one of `area`,
`ownership`, or `perspective`. Give each member a short, distinct `--name` too - its role or
what it watches (e.g. `app-server-lifecycle`, `mailbox-delivery`) - it labels the member
everywhere; never reuse one name for two members.

## Run the script - never hand-write team state

A bundled, dependency-free Node script owns all team state so you never author `team.json`
or the member manual by hand. Run it with `node` (or `bun`); it works on macOS, Linux, and
Windows. From the repository root, use `plugin/components/teammode/scripts/team.mjs`.

> **Build note:** `plugin/components/teammode/scripts/team.mjs` is produced by `pnpm run build`.
> For development, edit the source TypeScript at `src/components/teammode/scripts/team.ts`.

```
node plugin/components/teammode/scripts/team.mjs init        --name "<team>" --session-name "<session>" --shape swarm|pipeline [--session <leader_thread_id>] [--worktree] [--base-branch dev]
node plugin/components/teammode/scripts/team.mjs add-member  --team <session_id> --id A --name "<short role>" --focus "<part/ownership/perspective>" --lens area|ownership|perspective --deliverable "<...>" [--branch <branch>]
node plugin/components/teammode/scripts/team.mjs member-prompt --team <session_id> --id A
node plugin/components/teammode/scripts/team.mjs set-status   --team <session_id> --id A --status reported|blocked|active|archived [--note "<...>"]
node plugin/components/teammode/scripts/team.mjs worktree-add    --team <session_id> --id A [--base-branch <branch>]
node plugin/components/teammode/scripts/team.mjs worktree-remove --team <session_id> --id A [--force]
node plugin/components/teammode/scripts/team.mjs integrate       --team <session_id> [--id A]
node plugin/components/teammode/scripts/team.mjs archive      --team <session_id> [--id A] [--note "<...>"]
node plugin/components/teammode/scripts/team.mjs delete       --team <session_id> [--force]
node plugin/components/teammode/scripts/team.mjs status       --team <session_id>
```

`init` creates `.lazykimicode/teams/{session_id}/` containing `team.json` (the single durable state file:
team id, shape, the main-session leader, the member roster, status, worktree config, and a
lifecycle log), `guide.md` (the auto-generated member field manual), and `artifacts/` (a shared
exchange space). Re-running `init` is a safe no-op. Every mutating subcommand rewrites
`guide.md`, so the manual always matches the current team.

Mutating subcommands take a per-team state lock before reading and rewriting `team.json`. It is
safe to run independent `add-member`, `set-status`, `archive`, `delete`, `guide`, and worktree
mutation commands concurrently against the same team: they serialize and each command reads the
latest committed state before writing. If a command reports that team state is locked, do not
treat the intended mutation as complete; retry after the named command finishes, or inspect
`.lazykimicode/teams/.locks/{session_id}/owner.json` if the previous command crashed.

## Create the team and its members

`init` the team, then `add-member` once per member. What happens next depends on the shape.

**AgentSwarm teams:**
1. If a member needs an isolated worktree, run `worktree-add` BEFORE launching the swarm -
   `AgentSwarm` has no per-item cwd argument, so the path must ride in that item's context.
2. Build the swarm item list from `member-prompt` / `team.json`. Each item carries the member's
   `id`, `name`, `focus`, `lens`, `deliverable`, and any worktree path. Use a single
   `AgentSwarm` call with a prompt template that tells every member to read `guide.md` and
   `team.json`, focus only on its slice, and report back with `WORKING:` / `BLOCKED:` / `DONE:`
   markers. Do not set `agent_type`, `model`, or `reasoning_effort`.
3. Members are not durable runtime agents; they are one-shot `Agent` executions spawned by the
   swarm. A finished member's result is its final message. If you need to re-task a member,
   launch a new `Agent(prompt=...)` or a second swarm wave rather than trying to "wake" an old
   instance.

**Sequential / pipelined Agent teams:**
1. Create a durable worktree per colliding member with `worktree-add`. Always pass the worktree
   path in that member's prompt if `Agent` has no cwd argument.
2. Launch each member with `Agent(prompt=..., subagent_type="coder"|"explore"|"plan")` in
   dependency order. The prompt must be self-contained: it carries the member's `focus`,
   `lens`, `deliverable`, worktree path, and a pointer to `guide.md` / `team.json`.
3. Capture each member's final message as its report. Do not proceed to a dependent member until
   its prerequisites have reported `DONE:` (or have been explicitly unblocked).

On either shape, a member only counts once it is recorded in `team.json` with a `focus`, `lens`,
and `deliverable`. If the selected shape's tools stop working mid-run, STOP and say so (see Stop
rules); do not quietly switch shapes.

## Communication

Members push their findings through their final messages; you never poll them as a routine. The
address book is `team.json`, and the generated manual binds members to the hard rules, so you
mainly keep the channel open: expect frequent small inbound updates from each member - findings,
`WORKING:`/`BLOCKED:` markers, peer digests - rather than one final dump, and act on them as they
arrive.

- **AgentSwarm:** all members run concurrently inside the same swarm call. Collect every member's
  final message before you decide the next wave. If a member needs extra context while the swarm
  is running, you cannot message it mid-flight; instead, record the need in `artifacts/` or
  `team.json` and launch a follow-up `Agent(prompt=...)` or a second swarm.
- **Sequential Agent:** members run one after another (or in independent pipelined groups). Pass
  new context to a member by constructing its prompt; there is no separate mailbox.

All member-to-leader traffic is in English; when the END user addresses a member, that member
replies in the user's own language. Members hand off files and memos through the team
`artifacts/` directory and reference them by path.

## Let members work - do not rush them

Members heartbeat by sending `WORKING:` markers in their output whenever they hit a long pass.
So a member that is quiet between markers is **working, not stalled** - a stretch of silence is
the normal sound of focused work, not a problem to chase. Re-reading a calm member's state, or
sending "any update?" / "are you done?" / "hurry up" pings, interrupts that member and slows
the whole team. Trust the heartbeat and let them cook.

Message a member (or launch a follow-up Agent / swarm) only when one of these is true:
- you have new information, context, or a correction it needs to do its slice right;
- you are reassigning, narrowing, or unblocking its scope;
- a peer's result changes what it should do; or
- it has gone fully silent well past its heartbeat cadence AND that stall is blocking the team -
  then send one specific question, not a barrage.

Otherwise stay calm and keep the channel open: read inbound updates as they arrive and act on
them. A long-running member is alive; a heartbeat you have not received yet is not a failure.
Fallback only when a member is completed without its deliverable, explicitly `BLOCKED:`, or no
longer running - then unblock, reassign, or re-task that slice instead of waiting on it. Wait for
every required member's final report before you declare the team done - rushing toward "done"
while members are still mid-slice just produces half-built work you will have to redo.

## Worktrees - isolate members who would touch the same files

The moment two members' slices would edit the same files, give each its own git worktree so they
cannot clobber each other. Decide this whenever you see the collision - at team creation OR
mid-run, not only up front. For each colliding member run `worktree-add --team <id> --id <member>`:
it creates the worktree off the base branch on a derived branch, flips the team into worktree
mode, records it in `team.json`, and prints the `cd` path to hand that member. The member works
and commits only inside its own worktree. To land the work, `integrate --team <id>` merges every
member branch into your current branch with a merge commit (never a squash or rebase); resolve
any conflict it reports, then `worktree-remove` each worktree at cleanup.

Delivering the path differs by shape: on `AgentSwarm`, create the worktree BEFORE launching the
swarm so each item carries its own `cd` path; on sequential `Agent`, include the worktree path in
that member's prompt. Either way, record the worktree in `team.json` via `worktree-add` so
`guide.md`, `status`, and `member-prompt` all point at the same worktree-backed member.

When the member starts inside a worktree, it must verify the assigned cwd exists and contains the
repository checkout before editing. If the directory is missing, empty, or does not look like a
git worktree/repository yet, the member reports `BLOCKED: worktree not ready` to the leader and
waits instead of editing a parent checkout or an empty directory.

## Run a ulw-plan in parallel

When a decision-complete plan already exists at `.lazykimicode/plans/<slug>.md` (from ulw-plan), execute its
parallel waves as a team instead of one todo at a time. Map it directly:
- one wave's independent todos -> one swarm item / one Agent each; the todo's scope/files become
  that member's `focus`, and its acceptance criteria + QA become the member's `deliverable`.
- the plan's dependency matrix sets the shape: todos with no unmet dependency inside a wave run as
  concurrent swarm items; a todo that depends on another waits, so launch the next wave only after
  the blocking members report.
- todos in the same wave that touch overlapping files -> give those members worktrees (see above).

Keep the plan file as the shared spec: point each member at its todo by path, and verify the
member's result against that todo's acceptance criteria before you integrate.

## Archive, delete, and cleanup

DISBAND the team the moment it is no longer needed. A team exists only to do its work; once that
work is done, or the user no longer wants it, do not leave it lying around - archive every member,
then delete the team state only after archival evidence is clean or preserved. A finished team that
is never disbanded is a leak.

- `archive` closes the team: notify each active member, copy anything useful into `artifacts/`,
  then record the team as archived in `team.json`. Kimi `Agent` / `AgentSwarm` members are not
  durable runtime agents with a separate lifecycle - the durable `team.json` state IS the archive;
  never claim a member process itself was archived. Do not delete the team state after an archive
  blocker unless the evidence has been copied elsewhere or the user explicitly accepts that
  evidence loss.
- `delete` removes `.lazykimicode/teams/{session_id}` and refuses while the team is unarchived or any member
  is still active unless `--force`.
- When the work wraps up, land it the way the user asked: `integrate --team <id>` for a direct merge
  commit, or push each member branch and open a PR. Then `worktree-remove` each worktree, archive,
  and delete. Cleanup is real work; respect the user's instruction on how to land it.

## Stop rules

- Stop and ask before deleting an unarchived team while any member is still active.
- Member communication stays English unless the user explicitly requests otherwise; user-facing
  replies follow the user's language.
- Stop if the selected shape's tools (`AgentSwarm` or `Agent`) are unavailable or stop working;
  say so instead of faking it or silently switching shapes.

## Kimi Code Harness Compatibility

- Use `AgentSwarm` with a prompt template containing `{{item}}` to spawn parallel members. Each
  `item` should be a member description (id, name, focus, lens, deliverable, optional worktree
  path); the swarm prompt must instruct the member to read `guide.md` / `team.json`, stay in its
  scope, and report with `WORKING:` / `BLOCKED:` / `DONE:` markers.
- Use `Agent(prompt=..., subagent_type="coder")` for implementation members.
- Use `Agent(prompt=..., subagent_type="explore")` for research members.
- Use `Agent(prompt=..., subagent_type="plan")` for planning/review members.
- For mixed dependencies, run independent subsets with `AgentSwarm`, then a final `Agent` for
  integration.
- Use `Write` / `Edit` for all file edits performed by members; the leader verifies before
  integrating.
- Use `TodoList` to track team waves, member states, and integration steps.
- When finished, output `TEAM_ARCHIVED: <session_id>` after `archive`+`delete` (or
  `TEAM_INTEGRATED: <session_id>` if the work was landed).
