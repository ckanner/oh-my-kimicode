import { discoverRules, formatRulesContext } from './discover.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  const event = process.argv[3];
  const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();
  const rules = discoverRules(projectDir);
  const additionalContext = formatRulesContext(rules);
  const hookEventName =
    event === 'post-tool-use' ? 'PostToolUse' :
    event === 'post-compact' ? 'PostCompact' :
    event === 'user-prompt-submit' ? 'UserPromptSubmit' :
    'SessionStart';
  writeHookOutput({
    hookSpecificOutput: {
      hookEventName,
      additionalContext: additionalContext || 'No project rules found',
    },
  });
}

main().catch((e) => { console.error(e); process.exit(0); });
