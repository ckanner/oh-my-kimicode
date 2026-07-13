---
name: frontend
description: "MUST USE for frontend/web UI/UX/visual work: building, styling, redesigning pages/components, React setup, performance audits, visual QA, taste, and polish. Routes four rulesets: design taste router and brand references; perfection for Playwright/Chromium Lighthouse/Core Web Vitals; ui-ux-db palettes/fonts/guidelines; designpowers personas/accessibility/critique/handoff; plus curl-only lazyweb real-app-screen research for design direction. Triggers: frontend, UI, UX, design, redesign, styling, layout, animation, motion, premium, luxury, minimal, brutalist, Awwwards, DESIGN.md, mockup, React, Lighthouse, accessibility, WCAG, Core Web Vitals, looks generic, make it pretty, like X brand, lazyweb, design research."
type: prompt
whenToUse: When building, redesigning, auditing, or generating mockups for frontend, web UI, UX, visual design, styling, layout, animation, performance, accessibility, or SEO work.
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

# Frontend

This file is a router, not a rulebook. The rules live in four rulesets under `references/`; your first job is to load the smallest set of files that covers the request, state which you loaded in one sentence, then execute under their guidance. Loading nothing and freestyling produces the generic AI-slop output this skill exists to prevent; loading everything wastes context and creates contradictory instructions.

> **Fallback if `references/` are not present:** Use the project's existing code style, `AGENTS.md`, and general engineering knowledge. Ask the user for specific design constraints if needed.

**The bar is not clean-and-correct — it is work a senior designer at Linear, Stripe, or Supabase would ship.** Correct-but-flat is a failure, not a finish. Protect the surface as hard as you protect the build: design is a first-class deliverable, not a one-shot decision you lock and walk away from.

## Phase 0 — Route (before any UI work)

| Request involves… | Read |
|---|---|
| ANY UI implementation, styling, redesign, mockup, or visual decision | `references/design/README.md` FIRST. It enforces two mandatory gates — the Design System Gate (a `DESIGN.md` must exist before any component is written) and the React Dev Tooling Gate (react-grab / react-scan / react-doctor installed by default) — then routes to the taste and brand references below. |
| Writing or modifying frontend code, OR auditing performance / SEO / accessibility / quality | ALSO `references/perfection/README.md`. Lighthouse 100 in every category, measured on real Playwright Chromium (never the `lighthouse` CLI), achieved through architecture — never by dropping animations or hiding content. |
| Looking up a concrete style, color palette, font pairing, chart type, landing-page structure, or UX guideline — or generating a project design system from keywords | `references/ui-ux-db/README.md`. A searchable CSV database with a CLI; a lookup tool, not a posture. Load on demand; `design` stays the source of truth for taste and the `DESIGN.md` contract. |
| ANY implementation or redesign that creates or updates `DESIGN.md` — plus explicit operating-layer asks (personas, critique, debt, handoff, synthetic user testing) | `references/designpowers/README.md` + `references/designpowers/lane-c-review.md`. An internal frontend ruleset, not a separate skill: lane-c is the Phase Final flatness/critique reviewer, and its accessibility-constraints and accepted-debt language fills the required `DESIGN.md` sections. Load other lanes only when their phase applies. |

**For implementation work, design + perfection load together.** A page that hits Lighthouse 100 but looks like AI slop has failed; a page that looks beautiful but ships a 2 MB bundle has failed. Both win or neither does.

## Design System and Component Workflow

Every implementation must choose one of these branches before UI code changes:

1. **Concrete visual reference:** the user supplied a reference — treat it as the visual contract, then handle it by kind:
   - **Static visual reference** (screenshot, generated mockup, Stitch / image-generator output, Figma export, overview, or annotated packet): load `references/design/image-to-code-skill.md` plus the relevant design/perfection files, extract the reference's exact tokens, layout geometry, copy, spacing, states, and responsive intent into `DESIGN.md`, then implement reusable primitives against that contract.
   - **Live site or URL reference** (the user names a site to clone or gives a URL): load `references/design/clone-from-url.md`. Kimi Code CLI has no built-in browser tool, so use the `ultimate-browsing` skill, `FetchURL`, or ask the user for help extracting runtime truth — tokens, layout geometry, default/hover/focus/active states, transitions and keyframes, and downloaded assets — into `DESIGN.md`, then clone-code reusable primitives against that contract.
   Final QA for both runs the `visual-qa` skill in reference-fidelity mode: compare the actual UI against the reference pixel-by-pixel and verify the code is an extensible design-system implementation, not a screenshot-matched one-off.
2. **Greenfield or fresh setup:** if the user gave no concrete visual reference, design research is a build step with named deliverables — not exploration to be budgeted. Exploration-stop instincts ("enough exploration", two-wave caps) do not apply here. Fire every research lane IN PARALLEL before `DESIGN.md` is written, and open `DESIGN.md` with a `## 0. Research Log` section recording each lane's deliverable — a lane with no Research Log line did not run. Skip a lane only when its tool or network is genuinely unavailable, and name the skip in `DESIGN.md`:
   - **Embedded references:** use `references/design/_INDEX.md` to shortlist 2-3 plausible Layer B references, then read exactly one Layer A style skill and one Layer B reference in full — every line, no partial reads (they are 200-500 lines; a sliced read produces the flattened token set this gate exists to prevent). Log the shortlist, the pick, and why. Use `open-design` only when the curated set has no fit; add `ui-ux-db` lookups for palette/type/domain questions.
   - **Lazyweb real-product screens:** READ `references/design/lazyweb.md` FIRST and run its recipe verbatim — do not improvise curl calls against lazyweb.com; the recipe mints its own anonymous token. Log the queries run, how many screens you actually VIEWED, and the layout grammar harvested — never pixel copies.
   - **Concept drafts:** generate 2-3 concept drafts (via an available image-generation tool or skill), each seeded with the loaded Layer A + Layer B tokens (palette, type, material); pick the strongest and treat the chosen draft as the reference-fidelity contract. Log the draft paths and the pick. If no image generator is available, skip this lane and name the skip in `DESIGN.md`.
   Synthesize every lane into `DESIGN.md`. Treat sources as source material, not mood labels: extract tokens, layout grammar, component anatomy, interaction states, motion, and taste decisions, then recombine them into project-specific primitives. Never freestyle past the selected references, never copy logos or brand-specific copy. Then run the Primitive Showcase Gate (`references/design/README.md` Phase 0) before any product screen.
3. **Existing project with `DESIGN.md` or a component system:** read it, follow it, and update it before implementation only when the requested work needs a new token, primitive, state, motion rule, accessibility constraint, accepted debt, or reference-fidelity requirement.
4. **Existing project with UI but no `DESIGN.md` and no reusable component layer:** STOP and ask the user one focused question: should you preserve the current look with copy-nearby styling, or extract a real `DESIGN.md` plus reusable components before continuing? Do not silently choose.

For implementation, redesign, or design-system work that creates or updates `DESIGN.md`, `references/designpowers/README.md` + `lane-c-review.md` are part of the default load — feed their personas, accessibility, critique, debt, handoff, and role-reference guidance into the branch above. The resulting `DESIGN.md` is the implementation contract: tokens, typography, spacing, primitives, motion, responsive behavior, accessibility constraints, and accepted debt must be named there before code uses them. Verify component primitives, states, and final screens with real visual QA evidence; pass design-system decisions, implementation evidence, and unresolved debt into the `review-work` skill for significant implementation work.

## Ruleset 1 — design (`references/design/`)

The reference library has one architecture file, 12 taste skills (Layer A — *how to execute*), and 70 brand design systems (Layer B — *what it should look like*). Most non-trivial tasks load **one Layer A + one Layer B**. `README.md` carries the full routing flow, stacking rules, anti-patterns, and the mandatory browser-based Design QA phase; `_INDEX.md` catalogs all 83 files with mood-to-brand mappings — read it whenever routing is not obvious from the tables below.

### Layer 0 — architecture

| File | Read when |
|---|---|
| `design-system-architecture.md` | The project has no `DESIGN.md` (defines the structure you must create first — 8 sections plus a greenfield-only `## 0. Research Log`), or you are extracting a design system from existing UI code. |

### Layer A — taste skills (pick AT MOST ONE style skill; they encode opposing philosophies)

| File | Read when the user says… |
|---|---|
| `taste-skill.md` | Neutral or operational UI with no surface ambition — internal tools, dashboards, "just make it usable". The safe default; do NOT settle here when the brief signals glossy / premium / startup-grade craft. |
| `gpt-tasteskill.md` | "Awwwards-tier", "wow factor", "cinematic", "scroll-triggered" marketing/landing experiences. |
| `minimalist-skill.md` | "minimal", "clean", "Notion-like", "Linear-like", "editorial". |
| `brutalist-skill.md` | "brutalist", "raw", "Swiss", "experimental", "anti-design". |
| `soft-skill.md` | "premium", "luxury", "calm", "expensive", "elegant", AND glossy / glassy / liquid-glass / startup-grade product surfaces — pair with a high-craft Layer B (`supabase`, `linear.app`, `vercel`, `stripe`). |
| `redesign-skill.md` | Improving EXISTING UI — "this looks bad", "fix the design". Audit-first workflow; never use on greenfield. |
| `image-to-code-skill.md` | "Generate the design first, then code it." Pair with one imagegen file below. |
| `output-skill.md` | Stacks on any style skill when output is incomplete — placeholders, `// TODO`, half-done components. |
| `stitch-skill.md` | Stacks on any style skill for Google Stitch compatibility or a `DESIGN.md` doc export. A complete worked export ships as `stitch-design-example.md`. |
| `imagegen-frontend-web.md` / `imagegen-frontend-mobile.md` / `imagegen-brandkit.md` | Image-only output (mockup, app-screen concepts, brand board). These NEVER write code — switch to `image-to-code-skill.md` if code is wanted. |

### Layer B — brand design systems (orthogonal to Layer A; stack freely)

When the user names a brand or site — "Linear-style", "like Stripe's landing", "Aside-style browser agent" — load `references/design/<brand>.md` as the token source of truth (palette, type scale, components, do/don'ts). Coverage includes `aside` `apple` `stripe` `linear.app` `notion` `vercel` `claude` `figma` `airbnb` `nike` `tesla` `spotify` `raycast` `revolut` and ~56 more; the full list with mood shortcuts is in `_INDEX.md`. Extract the tokens and apply them to the project's own content — never copy logos or trademarked imagery. If the named brand is missing, fall back to a Layer A mood match or the `open-design` skill.

### React dev tooling

| File | Read when |
|---|---|
| `react-dev-tooling-skill.md` | A React project lacks react-grab / react-scan / react-doctor, or you need per-framework install snippets and the dev-only gating pattern (`NODE_ENV === 'development'`). |

## Ruleset 2 — perfection (`references/perfection/`)

| File | Read when |
|---|---|
| `README.md` | Any frontend code is written or audited. Carries the seven tenets: real-browser audits only, 100-in-every-category floor, fix-at-the-architecture, never weaken UX for points, design-system compliance checks, and the response format for audit reports. |
| `react-perf-tooling.md` | Before ANY React audit. The Playwright + `playwright-lighthouse` + `react-scan/lite` injection recipe, per-route render budgets, and the React-specific root-cause checklist. Lighthouse 100 with 30+ unnecessary renders is NOT done. |

Audit CLI (build for production first; never measure a dev server):

```bash
uv run $SKILL_DIR/scripts/perfection/lighthouse-audit.py https://localhost:3000
```

Run mobile AND desktop presets, 3–5 runs, take the median, diagnose from the JSON report.

## Ruleset 3 — ui-ux-db (`references/ui-ux-db/`)

`README.md` documents the search CLI and the master-plus-overrides persistence pattern. The CLI (run from the ruleset directory so it finds `data/`):

```bash
python3 $SKILL_DIR/references/ui-ux-db/scripts/search.py "<query>" --design-system -p "Project"   # full design-system generation
python3 $SKILL_DIR/references/ui-ux-db/scripts/search.py "<query>" --domain <domain>             # targeted lookup
python3 $SKILL_DIR/references/ui-ux-db/scripts/search.py "<query>" --stack <stack>               # stack best practices
```

Domains: `product` `style` `typography` `color` `landing` `chart` `ux` `react` `web` `prompt`. Stacks: `html-tailwind` (default) `react` `nextjs` `vue` `svelte` `astro` `swiftui` `react-native` `flutter` `shadcn` `jetpack-compose`.

## Ruleset 4 — designpowers (`references/designpowers/`)

`README.md` routes design operating-layer guidance from the pinned `Owl-Listener/designpowers` reference corpus into the existing frontend workflow. Load it — together with `lane-c-review.md` — for every implementation or redesign that creates or updates `DESIGN.md`, and additionally when a task needs explicit personas, accessibility and cognitive constraints, design critique, design debt, handoff, synthetic user testing, motion guidance, or role-reference prompts. It does not replace this frontend skill, `visual-qa`, `ulw-plan`, `start-work`, or `review-work`; it supplies richer design context that must first be distilled into the project `DESIGN.md`, then used as the design-system contract for implementation and verification.

## Quick routes — most common requests

| Request | Load |
|---|---|
| "Build a landing page" (no direction given) | `design/README.md` + `design/_INDEX.md` shortlist → exactly one Layer B reference + `design/taste-skill.md` + `perfection/README.md` |
| "Aside-style AI browser / browser agent page" | `design/README.md` + `design/aside.md` + `design/taste-skill.md` + `perfection/README.md` |
| "Linear-style landing page" | `design/README.md` + `design/linear.app.md` + `design/taste-skill.md` + `perfection/README.md` |
| "Premium SaaS hero like Stripe" | `design/README.md` + `design/stripe.md` + `design/soft-skill.md` + `perfection/README.md` |
| "Improve this existing dashboard" | `design/README.md` + `design/redesign-skill.md` + `perfection/README.md` |
| "Build this screenshot / image-generator mock / Stitch output exactly" | `design/README.md` + `design/image-to-code-skill.md` + `perfection/README.md` + `visual-qa` reference-fidelity mode |
| "Audit my site" / "make this page faster" | `perfection/README.md` (+ `perfection/react-perf-tooling.md` if React) |
| "Mockup image of a fintech app" — no code | `design/imagegen-frontend-mobile.md` (+ a Layer B brand if named) |
| "What palette/fonts fit a wellness brand?" | `ui-ux-db/README.md` → search CLI |
| "What do shipped apps in this space look like?" / design-direction research | `design/lazyweb.md` (curl-only) + `design/_INDEX.md` shortlist |
| "Set up this React project" | `design/README.md` + `design/react-dev-tooling-skill.md` |
| "Use designpowers", "make the design workflow stronger", "add personas/accessibility/debt/handoff" | `design/README.md` + `designpowers/README.md` (+ `perfection/README.md` if implementation or audit follows) |

## Shared axioms (all four rulesets agree — apply always)

- **No design system = no UI work.** `DESIGN.md` exists before components do; every color, font size, and spacing value traces back to a token in it.
- **Concrete reference = contract.** When a screenshot, generated mockup, overview, or annotated reference exists, the implementation must match its pixels, copy, component structure, and responsive intent unless the user explicitly accepts a deviation.
- **Never weaken UX OR flatten the surface to buy points.** No dropping animations, hiding content, simplifying interactions, or replacing rendered/lit material with flat fills and flat geometric primitives for a Lighthouse score or a deadline. Hit 100 AND keep the surface dimensional — both, or neither.
- **No emojis as icons.** SVG icon sets only (Lucide, Heroicons, Radix, Phosphor).
- **GPU-composited animation only** — `transform`, `opacity`, `filter`; never animate layout properties.
- **Slop animation is forbidden — motion serves meaning.** Every animation or hover must map to a real interaction, state change, or affordance. A hover that changes nothing, motion on a non-interactive element, or a decorative micro-animation with no informational purpose is slop — do not add it.
- **Done is the `visual-qa` dual-oracle gate, not your own glance.** A frontend design task is verified through `visual-qa` (real browser at 375 / 768 / 1280px, every page, with interaction states and motion driven and inspected) until the dual-oracle completion gate passes on fresh evidence.

## When to load something else instead

| Situation | Load |
|---|---|
| Brand/style not among the 70 in `references/design/`, or the user says "Open Design" | `open-design` skill — the local nexu-io/open-design library (137+ design skills, 150+ design systems) |
| Driving a browser for the Design QA phase | `visual-qa` skill. For live-site extraction, use `ultimate-browsing`, `FetchURL`, or ask the user; Kimi Code CLI has no built-in browser tool. |
| Pure TypeScript/logic work with zero visual surface | `programming` skill alone — this skill adds nothing there |

## Activation

Use for any frontend, web UI, UX, visual, design, styling, layout, animation, performance, accessibility, or SEO work — building, redesigning, auditing, or generating mockups. Not for backend, CLI, or pure-logic tasks with no visual surface.

## Kimi Code Harness Compatibility

- Inline skill references (`visual-qa`, `review-work`, `start-work`, `ulw-plan`) are resolved by the Kimi Code skill system when those skills are installed in the same workspace.
- For parallel research and multi-lane design exploration, use `AgentSwarm` with a prompt template containing `frontend` and the lane name, or fire sequential `Agent(prompt=..., subagent_type="explore")` calls.
- For implementation, use `Agent(prompt=..., subagent_type="coder")`.
- For file writes and edits, use `Write` and `Edit`.
- Kimi Code CLI has no built-in browser tool. Use the `ultimate-browsing` skill, `FetchURL`, or ask the user when live-site extraction or real-browser QA is required.
- Replace Codex-only runtime concepts (`codex_app.*`, `multi_agent_v1/v2.*`, `lazycodex-gate-reviewer`, per-skill agent YAMLs) with the `Agent` / `AgentSwarm` patterns above.
- Run audit and search scripts through `Bash`; capture output as evidence (`EVIDENCE_RECORDED: <path-or-output>`).
