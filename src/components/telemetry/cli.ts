import { shouldEmitDailyActive, getDistinctId } from '../../shared/telemetry.js';
import { captureDailyActive } from './posthog.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  if (shouldEmitDailyActive()) {
    const id = getDistinctId();
    try {
      await captureDailyActive(id);
      process.stderr.write(`telemetry: emitted daily_active for ${id}\n`);
    } catch (e) {
      process.stderr.write(`telemetry: capture failed: ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }
  writeHookOutput({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '' } });
}

main().catch((e) => { console.error(e); process.exit(0); });
