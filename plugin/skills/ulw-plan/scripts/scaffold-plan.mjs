#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

function usage() {
  console.error('Usage: node scaffold-plan.mjs <slug> [--clear|--unclear] [--reset] [--force]');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 1) usage();

const slug = args[0];
const isClear = args.includes('--clear');
const isUnclear = args.includes('--unclear');
const reset = args.includes('--reset');
const force = args.includes('--force');

if (isClear && isUnclear) {
  console.error('Cannot use both --clear and --unclear');
  process.exit(1);
}

const draftsDir = join(cwd, '.lazykimicode', 'drafts');
const plansDir = join(cwd, '.lazykimicode', 'plans');
mkdirSync(draftsDir, { recursive: true });
mkdirSync(plansDir, { recursive: true });

const draftPath = join(draftsDir, `${slug}.md`);
const planPath = join(plansDir, `${slug}.md`);

if (!reset && existsSync(draftPath) && existsSync(planPath)) {
  console.log(`Plan artifacts already exist for "${slug}". Use --reset to regenerate, --force to discard edits.`);
  process.exit(0);
}

if (reset && !force && (existsSync(draftPath) || existsSync(planPath))) {
  console.error(`Artifacts exist for "${slug}". Use --force to overwrite.`);
  process.exit(1);
}

const intent = isClear ? 'clear' : isUnclear ? 'unclear' : 'TBD';

const draftTemplate = `---
slug: ${slug}
intent: ${intent}
review_required: false
status: exploring
---

# Draft: ${slug}

## Decisions made
<!-- Append defaults and owner-decisions as you go. -->

## Open forks
<!-- Questions only the user can answer. -->

## Evidence ledger
<!-- Links to files, commands, search results. -->

## Approval gate
- status: exploring
- pending action: write .lazykimicode/plans/${slug}.md
- approach: TBD
`;

const planTemplate = `---
slug: ${slug}
intent: ${intent}
review_required: false
---

## TL;DR (For humans)
<!-- One-paragraph summary of the plan. -->

## Goal
<!-- Exact desired outcome. -->

## Background
<!-- Evidence and constraints discovered during exploration. -->

## Decisions
<!-- Defaults adopted and owner-decisions recorded. -->

## Todos
<!-- Append task batches below. Each todo must have: description, dependencies, acceptance criteria, QA (happy + failure paths, exact tool + invocation), commit guidance, references. -->

## Risk register
<!-- Risks and mitigations. -->

## Dependency matrix
<!-- Map tasks and their blockers. -->

## Verification wave
<!-- Final checks before handoff. -->
`;

writeFileSync(draftPath, draftTemplate);
writeFileSync(planPath, planTemplate);

console.log(`Created ${draftPath}`);
console.log(`Created ${planPath}`);
