import type { HookPayload, HookOutput } from '../../shared/types.js';

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
  // Idempotent provisioning is performed by the installer; this hook just confirms.
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `(OmO ${ctx.version}) Bootstrap provisioning complete`,
    },
  };
}
