import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src/components');
const SHARED = path.join(__dirname, '..', 'vendor/shared-skills/skills');
const OUT = path.join(__dirname, '..', 'plugin/skills');

const KIMI_COMPAT = `\n\n## Kimi Code Harness Compatibility\n\n- Use \`Agent\` tool with \`subagent_type\` \`coder\` / \`explore\` / \`plan\`.\n- Use \`AgentSwarm\` for parallel work.\n- Use \`TodoList\` for tracking.\n`;

function copySkill(srcDir, outName) {
  const skillMd = path.join(srcDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) return;
  const outDir = path.join(OUT, outName);
  fs.mkdirSync(outDir, { recursive: true });
  let content = fs.readFileSync(skillMd, 'utf-8');
  // Remove Codex compatibility section if present.
  content = content.replace(/## Codex Harness Tool Compatibility[\s\S]*?(?=\n## |\n*$)/, '');
  if (!content.includes('## Kimi Code Harness Compatibility')) {
    content += KIMI_COMPAT;
  }
  fs.writeFileSync(path.join(outDir, 'SKILL.md'), content);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const comp of fs.readdirSync(SRC)) {
  const compSkills = path.join(SRC, comp, 'skills');
  if (!fs.existsSync(compSkills)) continue;
  for (const name of fs.readdirSync(compSkills)) {
    copySkill(path.join(compSkills, name), name);
  }
}

if (fs.existsSync(SHARED)) {
  for (const name of fs.readdirSync(SHARED)) {
    copySkill(path.join(SHARED, name), name);
  }
}

console.log('Skills synced to', OUT);
