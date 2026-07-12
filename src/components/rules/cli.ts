import { discoverRules, formatRulesContext } from './discover.js';
import { writeHookOutput } from '../../shared/serialize.js';
import { getProjectDir } from '../../shared/env.js';

async function main() {
  const event = process.argv[3];
  const projectDir = getProjectDir();
  const rules = discoverRules(projectDir);
  const message = formatRulesContext(rules) || 'No project rules found';
  const hookEventName =
    event === 'post-tool-use' ? 'PostToolUse' :
    event === 'post-compact' ? 'PostCompact' :
    event === 'user-prompt-submit' ? 'UserPromptSubmit' :
    'SessionStart';
  writeHookOutput({
    message,
    hookSpecificOutput: {
      hookEventName,
      message,
    },
  });
}

main().catch((e) => { console.error(e); process.exit(0); });
