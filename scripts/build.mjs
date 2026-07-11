import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src/components');
const COMPONENTS = fs.readdirSync(SRC);

async function buildComponent(name) {
  const src = path.join(SRC, name, 'cli.ts');
  if (!fs.existsSync(src)) return;
  const outdir = path.join('plugin/components', name, 'dist');
  fs.mkdirSync(outdir, { recursive: true });
  await build({
    entryPoints: [src],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: path.join(outdir, 'cli.mjs'),
    external: ['@modelcontextprotocol/sdk'],
  });
}

async function buildMcp(name, outName, entry = null) {
  const src = entry
    ? path.join(SRC, name, entry)
    : fs.existsSync(path.join(SRC, name, 'mcp-server.ts'))
      ? path.join(SRC, name, 'mcp-server.ts')
      : fs.existsSync(path.join(SRC, name, 'serve.mjs'))
        ? path.join(SRC, name, 'serve.mjs')
        : null;
  if (!src || !fs.existsSync(src)) return;
  const outdir = path.join('plugin/components', name, 'dist');
  fs.mkdirSync(outdir, { recursive: true });
  await build({
    entryPoints: [src],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: path.join(outdir, outName),
    external: ['@modelcontextprotocol/sdk'],
  });
}

async function buildTeamScript() {
  const src = path.join(SRC, 'teammode', 'scripts', 'team.ts');
  if (!fs.existsSync(src)) return;
  const outdir = path.join('plugin/components/teammode/scripts');
  fs.mkdirSync(outdir, { recursive: true });
  await build({
    entryPoints: [src],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: path.join(outdir, 'team.mjs'),
  });
}

async function buildInstaller() {
  const outdir = path.join('dist', 'cli');
  fs.mkdirSync(outdir, { recursive: true });
  await build({
    entryPoints: ['src/cli/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: path.join(outdir, 'index.mjs'),
  });
  // Also write scripts/install_local.mjs as a thin wrapper for npm-published layout.
  fs.writeFileSync(
    path.join('scripts', 'install_local.mjs'),
    `#!/usr/bin/env node\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { fileURLToPath } from 'node:url';\nimport { spawnSync } from 'node:child_process';\n\nconst __dirname = path.dirname(fileURLToPath(import.meta.url));\nconst built = path.resolve(__dirname, '..', 'dist', 'cli', 'index.mjs');\nif (!fs.existsSync(built)) {\n  console.error('Built installer not found. Run \`pnpm run build\` first.');\n  process.exit(1);\n}\nconst result = spawnSync(process.execPath, [built, ...process.argv.slice(2)], { stdio: 'inherit' });\nprocess.exit(result.status ?? 1);\n`,
  );
}

async function main() {
  await Promise.all(COMPONENTS.map(buildComponent));
  await Promise.all([
    buildMcp('codegraph', 'serve.mjs'),
    buildMcp('lsp', 'mcp-server.mjs'),
    buildMcp('lsp', 'daemon.mjs', 'daemon.ts'),
    buildMcp('git-bash', 'mcp-server.mjs'),
    buildTeamScript(),
  ]);
  await buildInstaller();
  console.log('Build complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
