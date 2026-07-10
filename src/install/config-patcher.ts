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

function existingHookKey(h: Record<string, unknown>): string {
  return `${h.event}|${h.matcher}|${normalizeCommand(String(h.command))}`;
}

function renderHookBlock(h: HookDef): string {
  return `\n[[hooks]]\nevent = ${JSON.stringify(h.event)}\nmatcher = ${JSON.stringify(h.matcher)}\ncommand = ${JSON.stringify(h.command)}\ntimeout = ${h.timeout}\n`;
}

export function patchConfigToml(
  configPath: string,
  hooks: HookDef[],
  dryRun = false,
): PatchResult {
  const raw = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '';
  const parsed = raw ? (toml.parse(raw) as Record<string, unknown>) : {};
  const existingHooks = (parsed.hooks ?? []) as Array<Record<string, unknown>>;
  const existingKeys = new Set(existingHooks.map(existingHookKey));

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

  let output: string;
  if (!raw.trim()) {
    // Empty file: produce clean TOML.
    parsed.hooks = toAdd.map((h) => ({
      event: h.event,
      matcher: h.matcher,
      command: h.command,
      timeout: h.timeout,
    }));
    output = toml.stringify(parsed as toml.TomlPrimitive);
  } else {
    // Preserve existing raw text (including comments and formatting) and append new hooks.
    const blocks = toAdd.map(renderHookBlock).join('');
    output = raw.trimEnd() + '\n' + blocks;
  }

  fs.writeFileSync(configPath, output, 'utf-8');
  return { backupPath, wrote: true, diff };
}
