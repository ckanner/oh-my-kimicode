#!/usr/bin/env node
import fs from 'node:fs';

const INPUT_FIELD_ORDER = [
  'title',
  'targetRepository',
  'problem',
  'reproductionLogs',
  'approach',
  'confidence',
  'risks',
  'userVisibleBehaviorChanges',
  'verification',
];

function validateInput(input) {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Input must be a JSON object');
  }
  for (const key of ['title', 'targetRepository', 'problem', 'approach', 'verification']) {
    if (input[key] === undefined) {
      throw new Error(`Missing required field: ${key}`);
    }
  }
  if (!Array.isArray(input.verification)) {
    throw new Error('verification must be an array');
  }
}

function formatVerification(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function renderPrBody(input) {
  const sections = [
    ['## Problem Situation', input.problem],
    ['## Reproduction Logs', input.reproductionLogs],
    ['## Approach', input.approach],
    ['## Why I Am Confident', input.confidence],
    ['## Risks', input.risks],
    ['## User-Visible Behavior Changes', input.userVisibleBehaviorChanges],
    [
      '## Verification',
      input.verification.length ? formatVerification(input.verification) : '- No verification steps provided.',
    ],
    [
      '---',
      `This PR was debugged, implemented, and created with [Oh My KimiCode](https://github.com/ckanner/oh-my-kimicode).\nTag: oh-my-kimicode-generated`,
    ],
  ];

  return sections
    .filter(([, content]) => content !== undefined && content !== null && content !== '')
    .map(([heading, content]) => `${heading}\n\n${content}`)
    .join('\n\n');
}

function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: create-pr-body.mjs <input.json> <output.md>');
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const input = JSON.parse(raw);
  validateInput(input);

  // Preserve any extra fields supplied by the caller at the end so they are not lost.
  const extra = Object.fromEntries(Object.entries(input).filter(([key]) => !INPUT_FIELD_ORDER.includes(key)));
  const body = renderPrBody({ ...input, ...extra });

  fs.writeFileSync(outputPath, body, 'utf-8');
  console.log(`Wrote PR body to ${outputPath}`);
}

main();
