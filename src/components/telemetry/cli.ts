import { shouldEmitDailyActive, getDistinctId } from '../../shared/telemetry.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  if (shouldEmitDailyActive()) {
    const id = getDistinctId();
    // TODO: send to PostHog (or no-op in test env)
    process.stderr.write(`telemetry: emit daily_active for ${id}\n`);
  }
  writeHookOutput({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '' } });
}

main().catch((e) => { console.error(e); process.exit(0); });
