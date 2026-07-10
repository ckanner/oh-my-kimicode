import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { init, addMember, archive, deleteTeam } from '../../../src/components/teammode/scripts/team.js';

describe('teammode', () => {
  let tmpDir: string;
  let sessionId: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teammode-test-'));
    process.env.OMO_TEAMS_DIR = tmpDir;
    sessionId = 'session-1';
  });

  afterEach(() => {
    delete process.env.OMO_TEAMS_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes a team', () => {
    init(sessionId);
    expect(fs.existsSync(path.join(tmpDir, sessionId, 'team.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, sessionId, 'artifacts'))).toBe(true);
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

  it('archives a team', () => {
    init(sessionId);
    archive(sessionId);
    expect(fs.existsSync(path.join(tmpDir, sessionId))).toBe(false);
    const archived = fs.readdirSync(path.join(tmpDir, 'archive'));
    expect(archived.length).toBe(1);
  });

  it('deletes a team', () => {
    init(sessionId);
    deleteTeam(sessionId);
    expect(fs.existsSync(path.join(tmpDir, sessionId))).toBe(false);
  });
});
