export interface HookDef {
  event: string;
  matcher: string;
  command: string;
  timeout: number;
}

export function getHookDefs(version: string, pluginCache: string): HookDef[] {
  const cli = (name: string, event: string) =>
    `node "${pluginCache}/components/${name}/dist/cli.mjs" hook ${event}`;

  return [
    { event: 'SessionStart', matcher: '^startup$', command: cli('bootstrap', 'session-start'), timeout: 60 },
    { event: 'SessionStart', matcher: '.*', command: cli('rules', 'session-start'), timeout: 30 },
    { event: 'SessionStart', matcher: '.*', command: cli('telemetry', 'session-start'), timeout: 10 },
    { event: 'UserPromptSubmit', matcher: '.*', command: cli('rules', 'user-prompt-submit'), timeout: 30 },
    { event: 'UserPromptSubmit', matcher: '.*', command: cli('ultrawork', 'user-prompt-submit'), timeout: 10 },
    { event: 'UserPromptSubmit', matcher: '.*', command: cli('ulw-loop', 'user-prompt-submit'), timeout: 10 },
    { event: 'PreToolUse', matcher: '^Bash$', command: cli('git-bash', 'pre-tool-use'), timeout: 10 },
    { event: 'PreToolUse', matcher: '^CreateGoal$', command: cli('ulw-loop', 'pre-tool-use'), timeout: 10 },
    { event: 'PostToolUse', matcher: '^(Write|Edit)$', command: cli('comment-checker', 'post-tool-use'), timeout: 30 },
    { event: 'PostToolUse', matcher: '^(Write|Edit)$', command: cli('lsp', 'post-tool-use'), timeout: 60 },
    { event: 'PostToolUse', matcher: '^(Write|Edit)$', command: cli('rules', 'post-tool-use'), timeout: 30 },
    { event: 'PostCompact', matcher: '.*', command: cli('rules', 'post-compact'), timeout: 10 },
    { event: 'PostCompact', matcher: '.*', command: cli('lsp', 'post-compact'), timeout: 10 },
    { event: 'PostCompact', matcher: '.*', command: cli('git-bash', 'post-compact'), timeout: 10 },
    { event: 'Stop', matcher: '.*', command: cli('start-work-continuation', 'stop'), timeout: 10 },
    { event: 'SubagentStop', matcher: '.*', command: cli('start-work-continuation', 'subagent-stop'), timeout: 10 },
    { event: 'SubagentStop', matcher: '^coder$', command: cli('executor-verify', 'subagent-stop'), timeout: 10 },
  ];
}
