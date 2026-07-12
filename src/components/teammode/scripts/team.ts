#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { getTeamsDir } from '../../../shared/env.js';

export interface TeamMember {
  id: string;
  name: string;
  focus: string;
  lens: 'area' | 'ownership' | 'perspective';
  deliverable: string;
  branch: string;
  worktreePath: string;
  status: 'active' | 'reported' | 'blocked' | 'archived';
  statusNote: string;
  joinedAt: string;
  reportedAt: string;
}

export interface Team {
  id: string;
  name: string;
  sessionName: string;
  shape: 'swarm' | 'pipeline';
  session: string;
  baseBranch: string;
  worktreeMode: boolean;
  createdAt: string;
  archived: boolean;
  archiveNote: string;
  members: TeamMember[];
}

export interface InitOptions {
  name?: string;
  sessionName?: string;
  shape?: 'swarm' | 'pipeline';
  session?: string;
  worktree?: boolean;
  baseBranch?: string;
}

export interface AddMemberOptions {
  team: string;
  id: string;
  name: string;
  focus: string;
  lens: 'area' | 'ownership' | 'perspective';
  deliverable: string;
  branch?: string;
}

export { getTeamsDir };

function teamDir(sessionId: string): string {
  return path.join(getTeamsDir(), sessionId);
}

function sleepSync(ms: number): void {
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, ms);
}

function lockDir(sessionId: string): string {
  // Keep locks outside the team directory so archive/delete can remove the team dir safely.
  return path.join(getTeamsDir(), '.locks', sessionId);
}

function withLock<T>(sessionId: string, fn: () => T): T {
  const dir = lockDir(sessionId);
  const ownerPath = path.join(dir, 'owner.json');
  fs.mkdirSync(dir, { recursive: true });

  const owner = { pid: process.pid, command: process.argv.slice(2).join(' ') };

  const maxRetries = 100;
  for (let i = 0; i < maxRetries; i++) {
    try {
      fs.writeFileSync(ownerPath, JSON.stringify(owner), { flag: 'wx' });
      try {
        return fn();
      } finally {
        fs.rmSync(ownerPath, { force: true });
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw err;
      sleepSync(Math.min(50 * (i + 1), 500));
    }
  }

  const existing = fs.existsSync(ownerPath) ? fs.readFileSync(ownerPath, 'utf-8') : 'unknown';
  throw new Error(`Failed to acquire lock for team ${sessionId}. Owner: ${existing}`);
}

function readTeamUnlocked(sessionId: string): Team | null {
  const teamPath = path.join(teamDir(sessionId), 'team.json');
  if (!fs.existsSync(teamPath)) return null;
  return JSON.parse(fs.readFileSync(teamPath, 'utf-8')) as Team;
}

function writeTeamUnlocked(sessionId: string, team: Team): void {
  const dir = teamDir(sessionId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'team.json'), JSON.stringify(team, null, 2));
}

function createDefaultTeam(sessionId: string): Team {
  return {
    id: sessionId,
    name: sessionId,
    sessionName: sessionId,
    shape: 'swarm',
    session: '',
    baseBranch: 'main',
    worktreeMode: false,
    createdAt: new Date().toISOString(),
    archived: false,
    archiveNote: '',
    members: [],
  };
}

function writeGuide(sessionId: string, team: Team): void {
  const dir = teamDir(sessionId);
  const lines: string[] = [
    `# Team Guide: ${team.name}`,
    '',
    `- Shape: ${team.shape}`,
    `- Base branch: ${team.baseBranch}`,
    `- Worktree mode: ${team.worktreeMode ? 'yes' : 'no'}`,
    `- Session: ${team.sessionName}`,
    `- Archived: ${team.archived ? 'yes' : 'no'}`,
    team.archiveNote ? `- Archive note: ${team.archiveNote}` : '',
    '',
    '## Members',
    '',
    '| ID | Name | Focus | Lens | Deliverable | Status | Worktree |',
    '|---|---|---|---|---|---|---|',
    ...team.members.map(
      (m) =>
        `| ${m.id} | ${m.name} | ${m.focus} | ${m.lens} | ${m.deliverable} | ${m.status} | ${m.worktreePath || '-'} |`,
    ),
    '',
    '## Hard rules',
    '',
    '- Read `guide.md` and `team.json` before starting work.',
    '- Stay strictly within your assigned focus and lens.',
    '- Verify your worktree path exists before editing files.',
    '- Report progress frequently using `WORKING:`, `BLOCKED:`, or `DONE:` markers.',
    '- Place shared artifacts in the `artifacts/` directory.',
    '- Do not edit files outside your assigned scope.',
  ];
  fs.writeFileSync(path.join(dir, 'guide.md'), lines.filter(Boolean).join('\n'), 'utf-8');
}

function withTeamRead<T>(sessionId: string, fn: (team: Team | null) => T): T {
  return withLock(sessionId, () => fn(readTeamUnlocked(sessionId)));
}

function withTeamWrite<T>(sessionId: string, fn: (team: Team) => T): T {
  return withLock(sessionId, () => {
    const team = readTeamUnlocked(sessionId);
    if (!team) throw new Error(`Team ${sessionId} not found`);
    const result = fn(team);
    writeTeamUnlocked(sessionId, team);
    writeGuide(sessionId, team);
    return result;
  });
}

function withTeamWriteOrCreate<T>(sessionId: string, fn: (team: Team) => T): T {
  return withLock(sessionId, () => {
    const team = readTeamUnlocked(sessionId) ?? createDefaultTeam(sessionId);
    const result = fn(team);
    writeTeamUnlocked(sessionId, team);
    writeGuide(sessionId, team);
    return result;
  });
}

function getRepoRoot(): string {
  return execSync('git rev-parse --show-toplevel').toString().trim();
}

function runGit(args: string[], cwd: string): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const err = result.stderr?.trim() || `git ${args.join(' ')} failed with status ${result.status}`;
    throw new Error(err);
  }
}

class CliUsageError extends Error {}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[key] = argv[i + 1];
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

export function initTeam(options: InitOptions): void {
  const sessionName = options.sessionName ?? options.name;
  if (!sessionName) throw new Error('--session-name or --name is required');

  withLock(sessionName, () => {
    const dir = teamDir(sessionName);
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(dir, 'artifacts'), { recursive: true });

    const existing = readTeamUnlocked(sessionName);
    if (existing) {
      console.log(`Team already exists at ${dir}`);
      return;
    }

    const team: Team = {
      id: options.name ?? sessionName,
      name: options.name ?? sessionName,
      sessionName,
      shape: options.shape ?? 'swarm',
      session: options.session ?? '',
      baseBranch: options.baseBranch ?? 'main',
      worktreeMode: options.worktree ?? false,
      createdAt: new Date().toISOString(),
      archived: false,
      archiveNote: '',
      members: [],
    };
    writeTeamUnlocked(sessionName, team);
    writeGuide(sessionName, team);
    console.log(`Team initialized at ${dir}`);
  });
}

export function init(sessionId: string): void {
  initTeam({ sessionName: sessionId, name: sessionId });
}

export function addMemberFull(options: AddMemberOptions): void {
  if (!options.team) throw new Error('--team is required');
  if (!options.id) throw new Error('--id is required');
  if (!options.name) throw new Error('--name is required');
  if (!options.focus) throw new Error('--focus is required');
  if (!options.lens) throw new Error('--lens is required');
  if (!options.deliverable) throw new Error('--deliverable is required');

  withTeamWrite(options.team, (team) => {
    if (team.members.some((m) => m.id === options.id)) {
      throw new Error(`Member ${options.id} already exists`);
    }
    team.members.push({
      id: options.id,
      name: options.name,
      focus: options.focus,
      lens: options.lens,
      deliverable: options.deliverable,
      branch: options.branch ?? '',
      worktreePath: '',
      status: 'active',
      statusNote: '',
      joinedAt: new Date().toISOString(),
      reportedAt: '',
    });
    console.log(`Added ${options.id}: focus=${options.focus}, lens=${options.lens}`);
  });
}

export function addMember(sessionId: string, focus?: string, lens?: string): void {
  withTeamWriteOrCreate(sessionId, (team) => {
    const id = `member-${team.members.length + 1}`;
    team.members.push({
      id,
      name: id,
      focus: focus ?? 'general',
      lens: (lens as TeamMember['lens']) ?? 'area',
      deliverable: '',
      branch: '',
      worktreePath: '',
      status: 'active',
      statusNote: '',
      joinedAt: new Date().toISOString(),
      reportedAt: '',
    });
    console.log(`Added ${id}: focus=${focus ?? 'general'}, lens=${lens ?? 'area'}`);
  });
}

export function memberPrompt(sessionId: string, memberId: string): string {
  return withTeamRead(sessionId, (team) => {
    if (!team) throw new Error(`Team ${sessionId} not found`);
    const member = team.members.find((m) => m.id === memberId);
    if (!member) throw new Error(`Member ${memberId} not found`);

    const dir = teamDir(sessionId);
    const prompt = `You are member ${member.id} (${member.name}) of team ${team.name}.
Focus: ${member.focus}
Lens: ${member.lens}
Deliverable: ${member.deliverable}
Worktree: ${member.worktreePath || '(none)'}

Before starting, read:
- ${path.join(dir, 'guide.md')}
- ${path.join(dir, 'team.json')}

Rules:
- Stay strictly within your focus and lens.
- Verify your worktree path exists before editing files.
- Report progress frequently using:
  - WORKING: <what you are doing>
  - BLOCKED: <what is blocking you>
  - DONE: <summary of completed deliverable>
`;
    console.log(prompt);
    return prompt;
  });
}

export function setStatus(
  sessionId: string,
  memberId: string,
  status: TeamMember['status'],
  note?: string,
): void {
  withTeamWrite(sessionId, (team) => {
    const member = team.members.find((m) => m.id === memberId);
    if (!member) throw new Error(`Member ${memberId} not found`);
    member.status = status;
    member.statusNote = note ?? '';
    if (status === 'reported' || status === 'blocked' || status === 'archived') {
      member.reportedAt = new Date().toISOString();
    }
    console.log(`Set ${memberId} status to ${status}`);
  });
}

export function worktreeAdd(
  sessionId: string,
  memberId: string,
  baseBranch?: string,
  branch?: string,
): void {
  withTeamWrite(sessionId, (team) => {
    const member = team.members.find((m) => m.id === memberId);
    if (!member) throw new Error(`Member ${memberId} not found`);

    const repoRoot = getRepoRoot();
    const base = baseBranch ?? team.baseBranch;
    const memberBranch = branch ?? `${memberId}/${base}`;
    const worktreePath = path.join(teamDir(sessionId), 'worktrees', memberId);

    runGit(['worktree', 'add', '-b', memberBranch, worktreePath, base], repoRoot);

    member.branch = memberBranch;
    member.worktreePath = worktreePath;
    team.worktreeMode = true;
    console.log(`Worktree added at ${worktreePath}`);
  });
}

export function worktreeRemove(
  sessionId: string,
  memberId: string,
  force = false,
  deleteBranch = false,
): void {
  withTeamWrite(sessionId, (team) => {
    const member = team.members.find((m) => m.id === memberId);
    if (!member) throw new Error(`Member ${memberId} not found`);
    if (!member.worktreePath) throw new Error(`Member ${memberId} has no worktree`);

    const worktreePath = path.resolve(member.worktreePath);
    const expectedPrefix = path.resolve(path.join(teamDir(sessionId), 'worktrees'));
    if (!worktreePath.startsWith(expectedPrefix + path.sep) && worktreePath !== expectedPrefix) {
      throw new Error(`Worktree path is outside the team worktrees directory: ${worktreePath}`);
    }
    if (!fs.existsSync(worktreePath)) {
      throw new Error(`Worktree path does not exist: ${worktreePath}`);
    }

    const repoRoot = getRepoRoot();
    const args = ['worktree', 'remove'];
    if (force) args.push('--force');
    args.push(worktreePath);
    runGit(args, repoRoot);

    if (deleteBranch && member.branch) {
      try {
        runGit(['branch', '-D', member.branch], repoRoot);
      } catch {
        // ignore branch deletion failures; worktree is already removed
      }
    }

    member.worktreePath = '';
    member.branch = '';
    member.status = 'archived';
    member.statusNote = 'worktree removed';
    member.reportedAt = new Date().toISOString();
    console.log(`Worktree removed for ${memberId}`);
  });
}

export function integrate(sessionId: string, memberId?: string): void {
  const conflicts: string[] = [];

  withTeamWrite(sessionId, (team) => {
    const repoRoot = getRepoRoot();
    const members = memberId
      ? team.members.filter((m) => m.id === memberId && m.branch)
      : team.members.filter((m) => m.branch && m.status !== 'archived');

    if (members.length === 0) {
      console.log('No branches to integrate');
      return;
    }

    const currentBranch = execSync('git branch --show-current', {
      cwd: repoRoot,
      encoding: 'utf-8',
    }).trim();
    if (currentBranch !== team.baseBranch) {
      runGit(['checkout', team.baseBranch], repoRoot);
    }

    for (const member of members) {
      try {
        runGit(['merge', '--no-edit', '--no-ff', member.branch], repoRoot);
        console.log(`Integrated ${member.id} from ${member.branch}`);

        try {
          runGit(['branch', '-D', member.branch], repoRoot);
        } catch {
          // ignore branch deletion failures; merge succeeded
        }

        member.status = 'reported';
        member.statusNote = `integrated into ${team.baseBranch}`;
        member.reportedAt = new Date().toISOString();
      } catch (err) {
        const message = (err as Error).message;
        conflicts.push(`${member.id} (${member.branch}): ${message}`);
        try {
          runGit(['merge', '--abort'], repoRoot);
        } catch {
          // ignore abort failures
        }
      }
    }
  });

  if (conflicts.length > 0) {
    throw new Error('Integration conflicts:\n' + conflicts.map((c) => `  ${c}`).join('\n'));
  }
}

export function archive(sessionId: string, memberId?: string, note?: string): void {
  if (memberId) {
    withTeamWrite(sessionId, (team) => {
      const member = team.members.find((m) => m.id === memberId);
      if (!member) throw new Error(`Member ${memberId} not found`);
      member.status = 'archived';
      member.statusNote = note ?? '';
      member.reportedAt = new Date().toISOString();
      console.log(`Archived member ${memberId}`);
    });
    return;
  }

  withLock(sessionId, () => {
    const team = readTeamUnlocked(sessionId);
    if (!team) throw new Error(`Team ${sessionId} not found`);
    team.archived = true;
    team.archiveNote = note ?? '';
    writeTeamUnlocked(sessionId, team);
    writeGuide(sessionId, team);

    const archiveDir = path.join(getTeamsDir(), 'archive');
    fs.mkdirSync(archiveDir, { recursive: true });
    const target = path.join(archiveDir, `${sessionId}-${Date.now()}`);
    fs.cpSync(teamDir(sessionId), target, { recursive: true });
    console.log(`Team archived to ${target}`);
  });
}

export function deleteTeam(sessionId: string, force = false): void {
  withLock(sessionId, () => {
    const team = readTeamUnlocked(sessionId);
    if (!team) {
      console.log('Team not found');
      return;
    }
    if (!team.archived && !force) {
      throw new Error(`Team ${sessionId} is not archived. Use --force to delete anyway.`);
    }
    const dir = teamDir(sessionId);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Team ${sessionId} deleted`);
  });
}

export function status(sessionId: string): void {
  withTeamRead(sessionId, (team) => {
    if (!team) {
      console.log('Team not found');
      return;
    }
    console.log(JSON.stringify(team, null, 2));
  });
}

function main(): void {
  const [, , cmd, ...rest] = process.argv;
  const args = parseArgs(rest);

  try {
    switch (cmd) {
      case 'init':
        initTeam({
          name: args.name as string | undefined,
          sessionName: args['session-name'] as string | undefined,
          shape: args.shape as 'swarm' | 'pipeline' | undefined,
          session: args.session as string | undefined,
          worktree: args.worktree === true,
          baseBranch: args['base-branch'] as string | undefined,
        });
        break;
      case 'add-member':
        addMemberFull({
          team: args.team as string,
          id: args.id as string,
          name: args.name as string,
          focus: args.focus as string,
          lens: args.lens as 'area' | 'ownership' | 'perspective',
          deliverable: args.deliverable as string,
          branch: args.branch as string | undefined,
        });
        break;
      case 'member-prompt':
        memberPrompt(args.team as string, args.id as string);
        break;
      case 'set-status':
        setStatus(
          args.team as string,
          args.id as string,
          args.status as TeamMember['status'],
          args.note as string | undefined,
        );
        break;
      case 'worktree-add':
        worktreeAdd(
          args.team as string,
          args.id as string,
          args['base-branch'] as string | undefined,
        );
        break;
      case 'worktree-remove':
        if (!args.team || !args.id) throw new CliUsageError('--team and --id are required');
        worktreeRemove(
          args.team as string,
          args.id as string,
          args.force === true,
          args['delete-branch'] === true,
        );
        break;
      case 'integrate':
        if (!args.team) throw new CliUsageError('--team is required');
        integrate(args.team as string, args.id as string | undefined);
        break;
      case 'archive':
        archive(
          args.team as string,
          args.id as string | undefined,
          args.note as string | undefined,
        );
        break;
      case 'delete':
        deleteTeam(args.team as string, args.force === true);
        break;
      case 'status':
        status(args.team as string);
        break;
      default:
        console.log(
          'Usage: team.ts {init|add-member|member-prompt|set-status|worktree-add|worktree-remove|integrate|archive|delete|status} ...',
        );
        process.exit(1);
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exit(err instanceof CliUsageError ? 1 : 0);
  }
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? '')) {
  main();
}
