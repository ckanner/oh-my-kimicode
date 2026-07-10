import fs from 'node:fs';
import * as toml from 'smol-toml';
import type { HookDef } from './hook-defs.js';

export interface PatchResult {
  backupPath?: string;
  wrote: boolean;
  diff: string;
}

function normalizeCommand(cmd: string): string {
  return cmd.replace(/\\"/g, '"').trim();
}

function hookKey(h: HookDef): string {
  return `${h.event}|${h.matcher}|${normalizeCommand(h.command)}`;
}

function hookFromDef(h: HookDef): Record<string, unknown> {
  return {
    event: h.event,
    matcher: h.matcher,
    command: h.command,
    timeout: h.timeout,
  };
}

export function patchConfigToml(
  configPath: string,
  hooks: HookDef[],
  dryRun = false,
): PatchResult {
  const raw = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '';
  const parsed = raw ? (toml.parse(raw) as Record<string, unknown>) : {};
  const existingHooks = (parsed.hooks ?? []) as Array<Record<string, unknown>>;
  const existingKeys = new Set(
    existingHooks.map((h) => `${h.event}|${h.matcher}|${normalizeCommand(String(h.command))}`),
  );

  const toAdd = hooks.filter((h) => !existingKeys.has(hookKey(h)));
  if (toAdd.length === 0) {
    return { wrote: false, diff: 'No changes needed' };
  }

  const diff = toAdd.map((h) => `+ [[hooks]] event=${h.event} matcher=${h.matcher}`).join('\n');

  if (dryRun) {
    return { wrote: false, diff };
  }

  const backupPath = raw ? `${configPath}.bak.${Date.now()}` : undefined;
  if (backupPath) fs.copyFileSync(configPath, backupPath);

  const newHooks = [...existingHooks, ...toAdd.map(hookFromDef)];
  parsed.hooks = newHooks;

  fs.writeFileSync(configPath, toml.stringify(parsed as toml.TomlPrimitive), 'utf-8');
  return { backupPath, wrote: true, diff };
}
