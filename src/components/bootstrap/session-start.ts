import type { HookPayload, HookOutput } from '../../shared/types.js';
import { runBootstrapProvisioning } from './provision.js';

export interface BootstrapContext {
  version: string;
  cacheDir: string;
  binDir: string;
}

export function getBootstrapContext(): BootstrapContext {
  return {
    version: process.env.OMO_KIMI_VERSION ?? '0.1.0',
    cacheDir: process.env.OMO_KIMI_PLUGIN_CACHE ?? '',
    binDir: process.env.OMO_KIMI_BIN_DIR ?? '',
  };
}

export function runSessionStart(_payload: HookPayload): HookOutput {
  const ctx = getBootstrapContext();
  let details = `(OmO ${ctx.version}) Bootstrap provisioning complete`;

  if (ctx.cacheDir && ctx.binDir) {
    try {
      const kimiCodeHome = process.env.KIMI_CODE_HOME ?? '';
      const result = runBootstrapProvisioning(ctx.cacheDir, ctx.binDir, kimiCodeHome || process.cwd());
      const parts = [
        `bins=${result.binLinksOk ? 'ok' : 'failed'}`,
        `agents=${result.agentCacheDir}`,
        `sg=${result.sgAvailable ? (result.sgPath ?? 'available') : 'missing'}`,
      ];
      if (result.warnings.length) parts.push(`warnings=${result.warnings.join('; ')}`);
      details += `\n${parts.join('; ')}`;
    } catch (e) {
      details += `\nBootstrap provisioning error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: details,
    },
  };
}
