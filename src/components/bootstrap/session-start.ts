import type { HookPayload, HookOutput } from '../../shared/types.js';
import { VERSION } from '../../shared/version.js';
import { getEnv, getKimiCodeHome, getProjectDir } from '../../shared/env.js';
import { runBootstrapProvisioning } from './provision.js';
import { readBoulder, hasUncheckedTasks, formatResumeContext } from '../start-work-continuation/boulder.js';

export interface BootstrapContext {
  version: string;
  cacheDir: string;
  binDir: string;
}

export function getBootstrapContext(): BootstrapContext {
  return {
    version: getEnv('VERSION') ?? VERSION,
    cacheDir: getEnv('PLUGIN_CACHE') ?? '',
    binDir: getEnv('BIN_DIR') ?? '',
  };
}

export function runSessionStart(_payload: HookPayload): HookOutput {
  const ctx = getBootstrapContext();
  let details = `(LazyKimiCode ${ctx.version}) Bootstrap provisioning complete`;

  if (ctx.cacheDir && ctx.binDir) {
    try {
      const kimiCodeHome = getKimiCodeHome();
      const result = runBootstrapProvisioning(ctx.cacheDir, ctx.binDir, kimiCodeHome);
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

  const projectDir = getProjectDir();
  try {
    const boulder = readBoulder(projectDir);
    if (boulder && hasUncheckedTasks(boulder)) {
      details += `\n${formatResumeContext(boulder)}`;
    }
  } catch (e) {
    details += `\nBoulder resume check failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  return {
    message: details,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      message: details,
    },
  };
}
