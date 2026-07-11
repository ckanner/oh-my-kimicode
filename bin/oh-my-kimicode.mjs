#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(__dirname, '..', 'scripts', 'install_local.mjs');

const args = process.argv.slice(2);
execSync(`node "${entry}" ${args.map((a) => `"${a}"`).join(' ')}`, { stdio: 'inherit' });
