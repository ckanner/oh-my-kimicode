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
    { event: 'SessionStart', matcher: '^startup$', command: cli('auto-update', 'session-start'), timeout: 10 },
    { event: 'SessionStart', matcher: '.*', command: cli('rules', 'session-start'), timeout: 30 },
    { event: 'SessionStart', matcher: '.*', command: cli('codegraph', 'session-start'), timeout: 30 },
    { event: 'SessionStart', matcher: '.*', command: cli('telemetry', 'session-start'), timeout: 10 },
    { event: 'UserPromptSubmit', matcher: '.*', command: cli('rules', 'user-prompt-submit'), timeout: 30 },
    { event: 'UserPromptSubmit', matcher: '.*', command: cli('ultrawork', 'user-prompt-submit'), timeout: 10 },
    { event: 'UserPromptSubmit', matcher: '.*', command: cli('ulw-loop', 'user-prompt-submit'), timeout: 10 },
    { event: 'PreToolUse', matcher: '^Bash$', command: cli('git-bash', 'pre-tool-use'), timeout: 10 },
    { event: 'PreToolUse', matcher: '^(CreateGoal|create_goal)$', command: cli('ulw-loop', 'pre-tool-use'), timeout: 10 },
    { event: 'PostToolUse', matcher: '^(Write|Edit|apply_patch|multi_edit)$', command: cli('comment-checker', 'post-tool-use'), timeout: 30 },
    { event: 'PostToolUse', matcher: '^(Write|Edit|apply_patch|multi_edit)$', command: cli('lsp', 'post-tool-use'), timeout: 60 },
    { event: 'PostToolUse', matcher: '^(Write|Edit|apply_patch|multi_edit)$', command: cli('rules', 'post-tool-use'), timeout: 30 },
    { event: 'PostToolUse', matcher: '^(codegraph[._].*|mcp__codegraph__.*)$', command: cli('codegraph', 'post-tool-use'), timeout: 10 },
    { event: 'PostToolUse', matcher: '^(create_thread|codex_app\\.create_thread)$', command: cli('thread-title-hygiene', 'post-tool-use'), timeout: 5 },
    { event: 'PreCompact', matcher: '.*', command: cli('rules', 'pre-compact'), timeout: 5 },
    { event: 'PreCompact', matcher: '.*', command: cli('lsp', 'pre-compact'), timeout: 5 },
    { event: 'PostCompact', matcher: '.*', command: cli('rules', 'post-compact'), timeout: 10 },
    { event: 'PostCompact', matcher: '.*', command: cli('lsp', 'post-compact'), timeout: 10 },
    { event: 'PostCompact', matcher: '.*', command: cli('git-bash', 'post-compact'), timeout: 10 },
    { event: 'Stop', matcher: '.*', command: cli('start-work-continuation', 'stop'), timeout: 10 },
    { event: 'SubagentStop', matcher: '.*', command: cli('start-work-continuation', 'subagent-stop'), timeout: 10 },
    { event: 'SubagentStop', matcher: '^coder$', command: cli('executor-verify', 'subagent-stop'), timeout: 10 },
  ];
}
