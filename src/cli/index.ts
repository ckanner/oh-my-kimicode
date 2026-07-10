import { runKimiInstaller } from '../install/install-kimi.js';

const args = process.argv.slice(2);
const command = args[0] ?? 'install';

function extractArg(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

const options = {
  dryRun: args.includes('--dry-run'),
  noTui: args.includes('--no-tui'),
  autonomous: args.includes('--kimi-autonomous') || args.includes('--codex-autonomous'),
  kimiCodeHome: extractArg(args, '--kimi-code-home'),
  projectDirectory: extractArg(args, '--project-directory'),
  binDir: extractArg(args, '--bin-dir'),
};

if (command === 'install' || command === 'setup') {
  runKimiInstaller(options).catch((e) => { console.error(e); process.exit(1); });
} else if (command === 'uninstall') {
  console.log('Uninstall not yet implemented');
  process.exit(1);
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
