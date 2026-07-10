#!/usr/bin/env node
console.error('[install-local] script started');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const built = path.resolve(__dirname, '..', 'dist', 'cli', 'index.mjs');
if (!fs.existsSync(built)) {
  console.error('Built installer not found. Run `pnpm run build` first.');
  process.exit(1);
}
const builtUrl = new URL('file:///' + built.replace(/\\/g, '/')).href;
console.error(`[install-local] importing ${builtUrl}`);
await import(builtUrl);
