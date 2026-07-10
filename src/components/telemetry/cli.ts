import { shouldEmitDailyActive, getDistinctId } from '../../shared/telemetry.js';
import { captureDailyActive } from './posthog.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  if (shouldEmitDailyActive()) {
    const id = getDistinctId();
    const result = await captureDailyActive(id);
    if (result.ok) {
      process.stderr.write(`telemetry: emitted daily_active for ${id}\n`);
    } else {
      process.stderr.write(`telemetry: capture skipped: ${result.reason}\n`);
    }
  }
  writeHookOutput({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '' } });
}

main().catch((e) => { console.error(e); process.exit(0); });
