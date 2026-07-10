import fs from 'node:fs';
import path from 'node:path';

export interface BoulderState {
  active_work_id?: string;
  works?: Record<string, { completed: boolean }>;
}

export function readBoulder(projectDir: string): BoulderState | null {
  const p = path.join(projectDir, '.omo', 'boulder.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) as BoulderState : null;
}

export function hasIncompleteWork(state: BoulderState | null): boolean {
  if (!state?.active_work_id) return false;
  return state.works?.[state.active_work_id]?.completed !== true;
}
