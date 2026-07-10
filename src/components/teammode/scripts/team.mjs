#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEAMS_DIR = path.join(os.homedir(), '.omo', 'teams');

function teamDir(sessionId) {
  return path.join(TEAMS_DIR, sessionId);
}

function init(sessionId) {
  const dir = teamDir(sessionId);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'team.json'), JSON.stringify({ members: [] }, null, 2));
  fs.writeFileSync(path.join(dir, 'guide.md'), '# Team Guide\n');
  console.log(`Team initialized at ${dir}`);
}

function status(sessionId) {
  const dir = teamDir(sessionId);
  const teamPath = path.join(dir, 'team.json');
  if (!fs.existsSync(teamPath)) {
    console.log('Team not found');
    return;
  }
  const team = JSON.parse(fs.readFileSync(teamPath, 'utf-8'));
  console.log(JSON.stringify(team, null, 2));
}

function archive(sessionId) {
  const dir = teamDir(sessionId);
  const archiveDir = path.join(TEAMS_DIR, 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.renameSync(dir, path.join(archiveDir, `${sessionId}-${Date.now()}`));
  console.log(`Team archived`);
}

const [, , cmd, sessionId, ...args] = process.argv;

switch (cmd) {
  case 'init':
    init(sessionId);
    break;
  case 'status':
    status(sessionId);
    break;
  case 'archive':
    archive(sessionId);
    break;
  default:
    console.log(`Unknown command: ${cmd}`);
    process.exit(1);
}
