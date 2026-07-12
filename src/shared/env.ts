import os from 'node:os';
import path from 'node:path';

/**
 * Read a LazyKimiCode environment variable.
 *
 * All harness configuration uses the `LAZYKIMICODE_*` namespace.
 */
export function getEnv(name: string, fallback?: string): string | undefined {
  return process.env[`LAZYKIMICODE_${name}`] ?? fallback;
}

/** Read a boolean-ish env var; returns true only when the value is exactly '1' or 'true'. */
export function getEnvBool(name: string): boolean {
  const value = process.env[`LAZYKIMICODE_${name}`];
  if (value === undefined) return false;
  return value === '1' || value.toLowerCase() === 'true';
}

/** Return true if anonymous telemetry should be disabled. */
export function isTelemetryDisabled(): boolean {
  const disabledValue = process.env.LAZYKIMICODE_DISABLE_POSTHOG;
  if (disabledValue === '1' || disabledValue?.toLowerCase() === 'true') {
    return true;
  }

  const telemetryValue = process.env.LAZYKIMICODE_SEND_ANONYMOUS_TELEMETRY;
  if (telemetryValue !== undefined) {
    return ['0', 'false', 'no'].includes(telemetryValue.toLowerCase());
  }
  return false;
}

/** Project directory override. */
export function getProjectDir(): string {
  return process.env.LAZYKIMICODE_PROJECT ?? process.cwd();
}

/** Kimi Code home directory override. */
export function getKimiCodeHome(): string {
  return process.env.KIMI_CODE_HOME ?? path.join(os.homedir(), '.kimi-code');
}

/** Managed binary directory override. */
export function getBinDir(kimiCodeHomeOverride?: string): string {
  const defaultHome = path.join(os.homedir(), '.kimi-code');
  const kimiCodeHome = kimiCodeHomeOverride ?? getKimiCodeHome();
  return (
    getEnv('BIN_DIR') ??
    process.env.KIMI_LOCAL_BIN_DIR ??
    (kimiCodeHome === defaultHome
      ? path.join(os.homedir(), '.local', 'bin')
      : path.join(kimiCodeHome, 'bin'))
  );
}

/** Team-mode state directory. */
export function getTeamsDir(): string {
  return process.env.LAZYKIMICODE_TEAMS_DIR ?? path.join(os.homedir(), '.lazykimicode', 'teams');
}

/** User configuration directory. `.lazykimicode` is the LazyKimiCode harness convention. */
export function getConfigDir(): string {
  return process.env.LAZYKIMICODE_CONFIG_DIR ?? path.join(os.homedir(), '.lazykimicode');
}

/** Telemetry state file override. */
export function getStateFile(): string | undefined {
  return getEnv('STATE_FILE');
}

/** Telemetry state directory override. */
export function getStateDir(): string {
  return (
    getEnv('STATE_DIR') ??
    path.join(os.homedir(), '.local', 'share', 'lazykimicode')
  );
}
