import type { HookOutput } from './types.js';

export function serializeHookOutput(output: HookOutput): string {
  return JSON.stringify(output);
}

export function writeHookOutput(output: HookOutput): void {
  process.stdout.write(serializeHookOutput(output) + '\n');
}
