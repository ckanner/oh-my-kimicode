import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getHookDefs } from '../../../src/install/hook-defs.js';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('hook consistency', () => {
  it('hook-defs.ts matches every src/components/*/hooks.json', () => {
    const componentsDir = path.join(ROOT, 'src', 'components');
    const components = fs.readdirSync(componentsDir).filter((name) => {
      return fs.existsSync(path.join(componentsDir, name, 'hooks.json'));
    });

    const defs = getHookDefs('0.1.3', '/tmp/cache');

    for (const component of components) {
      const hooksPath = path.join(componentsDir, component, 'hooks.json');
      const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf-8')) as Array<{
        event: string;
        matcher: string;
        timeout: number;
      }>;
      for (const hook of hooks) {
        const matched = defs.find(
          (d) =>
            d.event === hook.event &&
            d.command.includes(`/components/${component}/dist/cli.mjs`) &&
            d.matcher === hook.matcher,
        );
        expect(matched).toBeDefined();
      }
    }
  });
});
