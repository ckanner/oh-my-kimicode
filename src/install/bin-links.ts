import fs from 'node:fs';
import path from 'node:path';

export const MANAGED_BINS = ['git-bash-mcp', 'lsp-tools-mcp', 'lsp-daemon', 'codegraph-server'];

export interface BinTarget {
  name: string;
  target: string;
}

export function getManagedBinTargets(cache: string): BinTarget[] {
  return [
    { name: 'git-bash-mcp', target: path.join(cache, 'components', 'git-bash', 'dist', 'mcp-server.mjs') },
    { name: 'lsp-tools-mcp', target: path.join(cache, 'components', 'lsp', 'dist', 'mcp-server.mjs') },
    { name: 'lsp-daemon', target: path.join(cache, 'components', 'lsp', 'dist', 'daemon.mjs') },
    { name: 'codegraph-server', target: path.join(cache, 'components', 'codegraph', 'dist', 'serve.mjs') },
  ];
}

export function getComponentBinTargets(cache: string): BinTarget[] {
  const targets: BinTarget[] = [];
  const componentsDir = path.join(cache, 'components');
  if (!fs.existsSync(componentsDir)) return targets;
  for (const name of fs.readdirSync(componentsDir)) {
    const cli = path.join(componentsDir, name, 'dist', 'cli.mjs');
    if (fs.existsSync(cli)) {
      targets.push({ name: `omo-${name}`, target: cli });
    }
  }
  return targets;
}

export function getBinTargets(cache: string): BinTarget[] {
  return [...getManagedBinTargets(cache), ...getComponentBinTargets(cache)];
}

export function linkManagedBins(cache: string, binDir: string): string[] {
  fs.mkdirSync(binDir, { recursive: true });
  const linked: string[] = [];
  for (const { name, target } of getBinTargets(cache)) {
    if (!fs.existsSync(target)) continue;
    const linkPath = path.join(binDir, name);
    try { fs.rmSync(linkPath, { force: true }); } catch {
      // ignore
    }
    const relative = path.relative(binDir, target);
    fs.symlinkSync(relative, linkPath, 'file');
    linked.push(name);
  }
  return linked;
}

export function unlinkManagedBins(binDir: string, cache?: string): string[] {
  const names = cache ? getBinTargets(cache).map((t) => t.name) : MANAGED_BINS;
  const removed: string[] = [];
  for (const name of names) {
    const linkPath = path.join(binDir, name);
    try {
      if (fs.existsSync(linkPath)) {
        fs.rmSync(linkPath, { force: true });
        removed.push(name);
      }
    } catch {
      // ignore
    }
  }
  return removed;
}
