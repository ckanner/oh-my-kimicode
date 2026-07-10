#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const built = path.resolve(__dirname, '..', 'dist', 'cli', 'index.mjs');
if (!fs.existsSync(built)) {
  console.error('Built installer not found. Run `pnpm run build` first.');
  process.exit(1);
}
const result = spawnSync(process.execPath, [built, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
