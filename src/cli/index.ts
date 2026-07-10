import { runKimiInstaller, runKimiUninstaller, type InstallOptions, type UninstallOptions } from '../install/install-kimi.js';
import { runDoctor } from '../install/doctor.js';

const args = process.argv.slice(2);
const command = args[0] ?? 'install';

function extractArg(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

function hasFlag(argv: string[], ...flags: string[]): boolean {
  return flags.some((f) => argv.includes(f));
}

function parseInstallOptions(): InstallOptions {
  return {
    dryRun: hasFlag(args, '--dry-run'),
    noTui: hasFlag(args, '--no-tui'),
    autonomous: hasFlag(args, '--kimi-autonomous', '--codex-autonomous'),
    kimiCodeHome: extractArg(args, '--kimi-code-home'),
    projectDirectory: extractArg(args, '--project-directory'),
    binDir: extractArg(args, '--bin-dir'),
  };
}

function parseUninstallOptions(): UninstallOptions {
  return {
    kimiCodeHome: extractArg(args, '--kimi-code-home'),
    binDir: extractArg(args, '--bin-dir'),
    preserveRules: hasFlag(args, '--preserve-rules'),
  };
}

async function main(): Promise<void> {
  if (command === 'install' || command === 'setup') {
    await runKimiInstaller(parseInstallOptions());
  } else if (command === 'uninstall') {
    await runKimiUninstaller(parseUninstallOptions());
  } else if (command === 'doctor') {
    const results = runDoctor({ kimiCodeHome: extractArg(args, '--kimi-code-home'), binDir: extractArg(args, '--bin-dir') });
    let failed = false;
    for (const r of results) {
      console.log(`${r.ok ? '✓' : '✗'} ${r.name}: ${r.message}`);
      if (!r.ok) failed = true;
    }
    process.exit(failed ? 1 : 0);
  } else if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`Usage: oh-my-kimicode <command> [options]

Commands:
  install (default)   Install oh-my-kimicode hooks and plugin cache
  uninstall           Remove oh-my-kimicode hooks, cache, and bin links
  doctor              Run health checks on the installation
  help                Show this help

Install options:
  --dry-run           Show proposed changes without writing
  --no-tui            Skip interactive prompts
  --kimi-autonomous   Set default_permission_mode to auto
  --kimi-code-home    Override Kimi Code home directory
  --project-directory Override project directory
  --bin-dir           Override bin directory for managed binaries

Uninstall options:
  --preserve-rules    Keep ~/.omo/ rules and config
  --kimi-code-home    Override Kimi Code home directory
  --bin-dir           Override bin directory

Doctor options:
  --kimi-code-home    Override Kimi Code home directory
  --bin-dir           Override bin directory
`);
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
