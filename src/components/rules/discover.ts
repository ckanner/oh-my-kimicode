import fs from 'node:fs';
import path from 'node:path';

export interface DiscoveredRules {
  agentsMd?: string;
  ruleFiles: Array<{ path: string; content: string }>;
}

export function discoverRules(projectDir: string): DiscoveredRules {
  const ruleFiles: Array<{ path: string; content: string }> = [];
  const rulesDir = path.join(projectDir, '.lazykimicode', 'rules');
  if (fs.existsSync(rulesDir)) {
    for (const entry of fs.readdirSync(rulesDir)) {
      const full = path.join(rulesDir, entry);
      if (fs.statSync(full).isFile() && entry.endsWith('.md')) {
        ruleFiles.push({ path: full, content: fs.readFileSync(full, 'utf-8') });
      }
    }
  }
  const agentsMdPath = path.join(projectDir, 'AGENTS.md');
  const agentsMd = fs.existsSync(agentsMdPath) ? fs.readFileSync(agentsMdPath, 'utf-8') : undefined;
  return { agentsMd, ruleFiles };
}

export function formatRulesContext(rules: DiscoveredRules): string {
  const parts: string[] = [];
  if (rules.agentsMd) parts.push(`# AGENTS.md\n${rules.agentsMd}`);
  for (const f of rules.ruleFiles) parts.push(`# ${f.path}\n${f.content}`);
  return parts.join('\n\n');
}
