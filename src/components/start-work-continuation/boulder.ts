import fs from 'node:fs';
import path from 'node:path';
import { getProjectDir } from '../../shared/env.js';

export interface Task {
  id: string;
  title: string;
  status: 'unchecked' | 'done' | string;
}

export interface Work {
  title: string;
  status: string;
  tasks?: Task[];
  completed?: boolean;
}

export interface Boulder {
  active_work_id: string;
  works: Record<string, Work>;
}

export function readBoulder(projectDir?: string): Boulder | null {
  const dir = projectDir ?? getProjectDir();
  const p = path.join(dir, '.omo', 'boulder.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) as Boulder : null;
}

export function hasUncheckedTasks(boulder: Boulder | null): boolean {
  if (!boulder?.active_work_id) return false;
  const work = boulder.works?.[boulder.active_work_id];
  if (!work) return false;
  if (Array.isArray(work.tasks)) {
    return work.tasks.some((t) => t.status === 'unchecked');
  }
  // Legacy schema: work.completed flag; treat incomplete work as unchecked.
  return !work.completed;
}

export function formatResumeContext(boulder: Boulder): string {
  const work = boulder.works[boulder.active_work_id];
  if (!work) return 'Active work not found. Please check .omo/boulder.json.';
  const tasks = Array.isArray(work.tasks) ? work.tasks : [];
  const unchecked = tasks.filter((t) => t.status === 'unchecked');

  if (tasks.length === 0) {
    return [
      `Active work: ${work.title}`,
      `Status: ${work.status}${work.completed === false ? ' (incomplete)' : ''}`,
      'Please finish this work before you continue.',
    ].join('\n');
  }

  const lines = [
    `Active work: ${work.title}`,
    `Unchecked tasks (${unchecked.length}):`,
    ...unchecked.map((t) => `- ${t.id}: ${t.title}`),
    'Please finish these tasks before you continue.',
  ];
  return lines.join('\n');
}
