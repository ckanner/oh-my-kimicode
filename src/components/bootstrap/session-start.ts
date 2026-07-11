import type { HookPayload, HookOutput } from '../../shared/types.js';
import { VERSION } from '../../shared/version.js';
import { runBootstrapProvisioning } from './provision.js';
import { readBoulder, hasUncheckedTasks, formatResumeContext } from '../start-work-continuation/boulder.js';

export interface BootstrapContext {
  version: string;
  cacheDir: string;
  binDir: string;
}

export function getBootstrapContext(): BootstrapContext {
  return {
    version: process.env.OMO_KIMI_VERSION ?? VERSION,
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
      if (result.sgInstalled) parts.push('sg_installed=true');
      if (result.warnings.length) parts.push(`warnings=${result.warnings.join('; ')}`);
      details += `\n${parts.join('; ')}`;
    } catch (e) {
      details += `\nBootstrap provisioning error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();
  try {
    const boulder = readBoulder(projectDir);
    if (boulder && hasUncheckedTasks(boulder)) {
      details += `\n${formatResumeContext(boulder)}`;
    }
  } catch (e) {
    details += `\nBoulder resume check failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: details,
    },
  };
}
