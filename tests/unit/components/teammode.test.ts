import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import {
  init,
  addMember,
  archive,
  deleteTeam,
  initTeam,
  addMemberFull,
  memberPrompt,
  setStatus,
  worktreeAdd,
  worktreeRemove,
  integrate,
  archiveTeam,
  deleteTeamSafe,
  status,
  getTeamsDir,
} from '../../../src/components/teammode/scripts/team.js';

describe('teammode', () => {
  let tmpDir: string;
  let originalCwd: string;
  let sessionId: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teammode-test-'));
    process.env.OMO_TEAMS_DIR = tmpDir;
    sessionId = 'session-1';
  });

  afterEach(() => {
    process.chdir(originalCwd);
    delete process.env.OMO_TEAMS_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes a team', () => {
    init(sessionId);
    expect(fs.existsSync(path.join(tmpDir, sessionId, 'team.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, sessionId, 'artifacts'))).toBe(true);
  });

  it('initializes a team with options', () => {
    initTeam({
      sessionName: sessionId,
      name: 'My Team',
      shape: 'pipeline',
      baseBranch: 'dev',
      session: 'leader-123',
      worktree: true,
    });
    const team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
    expect(team.name).toBe('My Team');
    expect(team.sessionName).toBe(sessionId);
    expect(team.shape).toBe('pipeline');
    expect(team.baseBranch).toBe('dev');
    expect(team.session).toBe('leader-123');
    expect(team.worktreeMode).toBe(true);
    const guide = fs.readFileSync(path.join(tmpDir, sessionId, 'guide.md'), 'utf-8');
    expect(guide).toContain('My Team');
    expect(guide).toContain('pipeline');
  });

  it('re-running init is a safe no-op', () => {
    initTeam({ sessionName: sessionId, name: 'First', shape: 'swarm' });
    initTeam({ sessionName: sessionId, name: 'Second', shape: 'pipeline' });
    const team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
    expect(team.name).toBe('First');
    expect(team.shape).toBe('swarm');
  });

  it('adds members with focus and lens', () => {
    init(sessionId);
    addMember(sessionId, 'auth', 'security');
    addMember(sessionId, 'ui', 'frontend');
    const team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
    expect(team.members).toHaveLength(2);
    expect(team.members[0].focus).toBe('auth');
    expect(team.members[1].lens).toBe('frontend');
  });

  it('adds a member with full fields', () => {
    initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
    addMemberFull({
      team: sessionId,
      id: 'A',
      name: 'Alice',
      focus: 'auth',
      lens: 'ownership',
      deliverable: 'Secure login flow',
      branch: 'feature/auth',
    });
    const team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
    expect(team.members).toHaveLength(1);
    const member = team.members[0];
    expect(member.id).toBe('A');
    expect(member.name).toBe('Alice');
    expect(member.focus).toBe('auth');
    expect(member.lens).toBe('ownership');
    expect(member.deliverable).toBe('Secure login flow');
    expect(member.branch).toBe('feature/auth');
    const guide = fs.readFileSync(path.join(tmpDir, sessionId, 'guide.md'), 'utf-8');
    expect(guide).toContain('Alice');
    expect(guide).toContain('Secure login flow');
  });

  it('rejects duplicate member ids', () => {
    initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
    addMemberFull({
      team: sessionId,
      id: 'A',
      name: 'Alice',
      focus: 'auth',
      lens: 'ownership',
      deliverable: 'Secure login flow',
    });
    expect(() =>
      addMemberFull({
        team: sessionId,
        id: 'A',
        name: 'Bob',
        focus: 'ui',
        lens: 'area',
        deliverable: 'Build UI',
      }),
    ).toThrow('already exists');
  });

  it('member-prompt output contains expected markers and focus/deliverable', () => {
    initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
    addMemberFull({
      team: sessionId,
      id: 'A',
      name: 'Alice',
      focus: 'auth',
      lens: 'ownership',
      deliverable: 'Secure login flow',
    });
    const prompt = memberPrompt(sessionId, 'A');
    expect(prompt).toContain('WORKING:');
    expect(prompt).toContain('BLOCKED:');
    expect(prompt).toContain('DONE:');
    expect(prompt).toContain('auth');
    expect(prompt).toContain('Secure login flow');
    expect(prompt).toContain('guide.md');
    expect(prompt).toContain('team.json');
  });

  it('set-status updates status and note', () => {
    initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
    addMemberFull({
      team: sessionId,
      id: 'A',
      name: 'Alice',
      focus: 'auth',
      lens: 'ownership',
      deliverable: 'Secure login flow',
    });
    setStatus(sessionId, 'A', 'blocked', 'waiting for API');
    const team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
    const member = team.members[0];
    expect(member.status).toBe('blocked');
    expect(member.statusNote).toBe('waiting for API');
    expect(member.reportedAt).toBeTruthy();
  });

  it('worktree-add creates worktree path', () => {
    const repoDir = path.join(tmpDir, 'repo');
    fs.mkdirSync(repoDir, { recursive: true });
    process.chdir(repoDir);
    execSync('git init', { stdio: 'ignore' });
    execSync('git config user.email "test@test.com"');
    execSync('git config user.name "Test"');
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# test');
    execSync('git add README.md');
    execSync('git commit -m "initial"');
    execSync('git checkout -b dev');

    initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm', baseBranch: 'dev' });
    addMemberFull({
      team: sessionId,
      id: 'A',
      name: 'Alice',
      focus: 'auth',
      lens: 'ownership',
      deliverable: 'Secure login flow',
    });

    worktreeAdd(sessionId, 'A');

    const team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
    const member = team.members[0];
    expect(member.worktreePath).toBeTruthy();
    expect(fs.existsSync(member.worktreePath)).toBe(true);
    expect(member.branch).toBe('A/dev');
    expect(team.worktreeMode).toBe(true);
  });

  it('archives a team', () => {
    init(sessionId);
    archive(sessionId);
    expect(fs.existsSync(path.join(tmpDir, sessionId))).toBe(false);
    const archived = fs.readdirSync(path.join(tmpDir, 'archive'));
    expect(archived.length).toBe(1);
  });

  it('archive with note sets archived and copies team dir', () => {
    initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
    archiveTeam(sessionId, undefined, 'completed sprint');
    const team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
    expect(team.archived).toBe(true);
    expect(team.archiveNote).toBe('completed sprint');
    const archived = fs.readdirSync(path.join(tmpDir, 'archive'));
    expect(archived.length).toBe(1);
  });

  it('archive with id archives only that member', () => {
    initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
    addMemberFull({
      team: sessionId,
      id: 'A',
      name: 'Alice',
      focus: 'auth',
      lens: 'ownership',
      deliverable: 'Secure login flow',
    });
    addMemberFull({
      team: sessionId,
      id: 'B',
      name: 'Bob',
      focus: 'ui',
      lens: 'area',
      deliverable: 'Build UI',
    });
    archiveTeam(sessionId, 'A', 'done');
    const team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
    expect(team.members[0].status).toBe('archived');
    expect(team.members[0].statusNote).toBe('done');
    expect(team.members[1].status).toBe('active');
    expect(team.archived).toBe(false);
  });

  it('deletes a team', () => {
    init(sessionId);
    deleteTeam(sessionId);
    expect(fs.existsSync(path.join(tmpDir, sessionId))).toBe(false);
  });

  it('delete refuses unarchived team without force', () => {
    initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
    expect(() => deleteTeamSafe(sessionId)).toThrow('not archived');
  });

  it('delete allows unarchived team with force', () => {
    initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
    deleteTeamSafe(sessionId, true);
    expect(fs.existsSync(path.join(tmpDir, sessionId))).toBe(false);
  });

  it('status prints formatted team json', () => {
    initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);
    status(sessionId);
    console.log = originalLog;
    const parsed = JSON.parse(logs[0]);
    expect(parsed.name).toBe('My Team');
    expect(parsed.shape).toBe('swarm');
  });

  it('uses custom teams dir from env', () => {
    expect(getTeamsDir()).toBe(tmpDir);
  });

  describe('worktreeRemove', () => {
    it('removes worktree, clears branch, and archives member', () => {
      const repoDir = path.join(tmpDir, 'repo');
      fs.mkdirSync(repoDir, { recursive: true });
      process.chdir(repoDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@test.com"');
      execSync('git config user.name "Test"');
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# test');
      execSync('git add README.md');
      execSync('git commit -m "initial"');

      initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
      addMemberFull({
        team: sessionId,
        id: 'A',
        name: 'Alice',
        focus: 'auth',
        lens: 'ownership',
        deliverable: 'Secure login flow',
      });
      worktreeAdd(sessionId, 'A');

      let team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
      const worktreePath = team.members[0].worktreePath;
      expect(fs.existsSync(worktreePath)).toBe(true);

      worktreeRemove(sessionId, 'A');

      expect(fs.existsSync(worktreePath)).toBe(false);
      team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
      expect(team.members[0].worktreePath).toBe('');
      expect(team.members[0].branch).toBe('');
      expect(team.members[0].status).toBe('archived');
      expect(team.members[0].statusNote).toBe('worktree removed');
    });

    it('deletes branch when deleteBranch is true', () => {
      const repoDir = path.join(tmpDir, 'repo');
      fs.mkdirSync(repoDir, { recursive: true });
      process.chdir(repoDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@test.com"');
      execSync('git config user.name "Test"');
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# test');
      execSync('git add README.md');
      execSync('git commit -m "initial"');

      initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
      addMemberFull({
        team: sessionId,
        id: 'A',
        name: 'Alice',
        focus: 'auth',
        lens: 'ownership',
        deliverable: 'Secure login flow',
      });
      worktreeAdd(sessionId, 'A');
      worktreeRemove(sessionId, 'A', false, true);

      const branches = execSync('git branch --list', { cwd: repoDir, encoding: 'utf-8' });
      expect(branches).not.toContain('A/main');
    });

    it('throws when member has no worktree', () => {
      initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
      addMemberFull({
        team: sessionId,
        id: 'A',
        name: 'Alice',
        focus: 'auth',
        lens: 'ownership',
        deliverable: 'Secure login flow',
      });
      expect(() => worktreeRemove(sessionId, 'A')).toThrow('has no worktree');
    });
  });

  describe('integrate', () => {
    it('merges member branch into base branch and updates status', () => {
      const repoDir = path.join(tmpDir, 'repo');
      fs.mkdirSync(repoDir, { recursive: true });
      process.chdir(repoDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@test.com"');
      execSync('git config user.name "Test"');
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# test');
      execSync('git add README.md');
      execSync('git commit -m "initial"');

      initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
      addMemberFull({
        team: sessionId,
        id: 'A',
        name: 'Alice',
        focus: 'auth',
        lens: 'ownership',
        deliverable: 'Secure login flow',
      });
      worktreeAdd(sessionId, 'A');

      const team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
      const worktreePath = team.members[0].worktreePath;
      fs.writeFileSync(path.join(worktreePath, 'feature.md'), '# feature');
      execSync('git add feature.md', { cwd: worktreePath });
      execSync('git commit -m "feature"', { cwd: worktreePath });

      integrate(sessionId, 'A');

      expect(fs.readFileSync(path.join(repoDir, 'feature.md'), 'utf-8')).toContain('# feature');
      const updated = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
      expect(updated.members[0].status).toBe('reported');
      expect(updated.members[0].statusNote).toContain('integrated into main');
    });



    it('checks out base branch when not currently on it', () => {
      const repoDir = path.join(tmpDir, 'repo');
      fs.mkdirSync(repoDir, { recursive: true });
      process.chdir(repoDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@test.com"');
      execSync('git config user.name "Test"');
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# test');
      execSync('git add README.md');
      execSync('git commit -m "initial"');

      initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
      addMemberFull({
        team: sessionId,
        id: 'A',
        name: 'Alice',
        focus: 'auth',
        lens: 'ownership',
        deliverable: 'Secure login flow',
      });
      worktreeAdd(sessionId, 'A');

      const team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
      const worktreePath = team.members[0].worktreePath;
      fs.writeFileSync(path.join(worktreePath, 'feature.md'), '# feature');
      execSync('git add feature.md', { cwd: worktreePath });
      execSync('git commit -m "feature"', { cwd: worktreePath });

      execSync('git checkout -b other');

      integrate(sessionId, 'A');

      const currentBranch = execSync('git branch --show-current', { cwd: repoDir, encoding: 'utf-8' }).trim();
      expect(currentBranch).toBe('main');
      expect(fs.readFileSync(path.join(repoDir, 'feature.md'), 'utf-8')).toContain('# feature');
    });

    it('aborts merge and reports conflict', () => {
      const repoDir = path.join(tmpDir, 'repo');
      fs.mkdirSync(repoDir, { recursive: true });
      process.chdir(repoDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@test.com"');
      execSync('git config user.name "Test"');
      fs.writeFileSync(path.join(repoDir, 'shared.txt'), 'base');
      execSync('git add shared.txt');
      execSync('git commit -m "initial"');

      initTeam({ sessionName: sessionId, name: 'My Team', shape: 'swarm' });
      addMemberFull({
        team: sessionId,
        id: 'A',
        name: 'Alice',
        focus: 'auth',
        lens: 'ownership',
        deliverable: 'Secure login flow',
      });
      worktreeAdd(sessionId, 'A');

      const team = JSON.parse(fs.readFileSync(path.join(tmpDir, sessionId, 'team.json'), 'utf-8'));
      const worktreePath = team.members[0].worktreePath;

      fs.writeFileSync(path.join(worktreePath, 'shared.txt'), 'A');
      execSync('git add shared.txt', { cwd: worktreePath });
      execSync('git commit -m "A change"', { cwd: worktreePath });

      fs.writeFileSync(path.join(repoDir, 'shared.txt'), 'main');
      execSync('git add shared.txt', { cwd: repoDir });
      execSync('git commit -m "main change"', { cwd: repoDir });

      expect(() => integrate(sessionId, 'A')).toThrow('Integration conflicts');

      expect(fs.readFileSync(path.join(repoDir, 'shared.txt'), 'utf-8')).toBe('main');
      const currentBranch = execSync('git branch --show-current', { cwd: repoDir, encoding: 'utf-8' }).trim();
      expect(currentBranch).toBe('main');
    });
  });
});
