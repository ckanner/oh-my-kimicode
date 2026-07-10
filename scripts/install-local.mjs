#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

console.error('[install-local] started');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.error('[install-local] __dirname', __dirname);
const built = path.resolve(__dirname, '..', 'dist', 'cli', 'index.mjs');
console.error('[install-local] built', built);
if (!fs.existsSync(built)) {
  console.error('Built installer not found. Run `pnpm run build` first.');
  process.exit(1);
}
const builtUrl = pathToFileURL(built).href;
console.error('[install-local] builtUrl', builtUrl);
await import(builtUrl);
