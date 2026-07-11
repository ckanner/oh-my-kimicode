import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src/components');
const OUT = path.join(ROOT, 'plugin/hooks');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')).version;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

function toKebab(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function getComponentFromCommand(command) {
  const match = /components\/([^/]+)\/dist\/cli\.mjs/.exec(command);
  return match?.[1];
}

async function loadHookDefs() {
  const tmp = path.join(os.tmpdir(), `hook-defs-${Date.now()}.mjs`);
  await build({
    entryPoints: [path.join(ROOT, 'src/install/hook-defs.ts')],
    bundle: false,
    platform: 'node',
    format: 'esm',
    outfile: tmp,
  });
  const url = `${pathToFileURL(tmp).href}?${Date.now()}`;
  const mod = await import(url);
  try {
    fs.unlinkSync(tmp);
  } catch {
    // ignore cleanup failure
  }
  return mod.getHookDefs(VERSION, '${PLUGIN_ROOT}');
}

async function validateHooks(defs) {
  const components = fs.readdirSync(SRC).filter((name) =>
    fs.existsSync(path.join(SRC, name, 'hooks.json')),
  );

  // Every hooks.json entry must be represented in hook-defs.ts.
  for (const component of components) {
    const hooksPath = path.join(SRC, component, 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
    for (const hook of hooks) {
      const matched = defs.find(
        (d) =>
          d.event === hook.event &&
          d.matcher === hook.matcher &&
          getComponentFromCommand(d.command) === component,
      );
      if (!matched) {
        throw new Error(
          `Hook mismatch: src/components/${component}/hooks.json defines event=${hook.event} matcher=${hook.matcher} but hook-defs.ts has no matching entry.`,
        );
      }
    }
  }

  // Every hook-defs.ts entry must be represented in a hooks.json file.
  for (const def of defs) {
    const component = getComponentFromCommand(def.command);
    if (!component) {
      throw new Error(`Invalid hook command in hook-defs.ts: ${def.command}`);
    }
    const hooksPath = path.join(SRC, component, 'hooks.json');
    if (!fs.existsSync(hooksPath)) {
      throw new Error(
        `Missing hooks.json: hook-defs.ts references component "${component}" but src/components/${component}/hooks.json does not exist.`,
      );
    }
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
    const matched = hooks.find(
      (h) => h.event === def.event && h.matcher === def.matcher,
    );
    if (!matched) {
      throw new Error(
        `Hook mismatch: hook-defs.ts references ${component} event=${def.event} matcher=${def.matcher} but src/components/${component}/hooks.json does not define it.`,
      );
    }
  }
}

async function main() {
  const defs = await loadHookDefs();
  await validateHooks(defs);

  for (const comp of fs.readdirSync(SRC)) {
    const hooksPath = path.join(SRC, comp, 'hooks.json');
    if (!fs.existsSync(hooksPath)) continue;
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
    for (const h of hooks) {
      const fileName = `${toKebab(h.event)}-${comp}.json`;
      const command = `node "\${PLUGIN_ROOT}/components/${comp}/dist/cli.mjs" hook ${toKebab(h.event)}`;
      const entry = {
        ...h,
        command,
        statusMessage: `(OmO ${VERSION}) ${h.statusMessage ?? comp}`,
      };
      fs.writeFileSync(path.join(OUT, fileName), JSON.stringify(entry, null, 2));
    }
  }

  console.log('Hooks synced to', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
