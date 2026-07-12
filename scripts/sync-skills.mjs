import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src/components');
const SHARED = path.join(__dirname, '..', 'vendor/shared-skills/skills');
const OUT = path.join(__dirname, '..', 'plugin/skills');

const KIMI_COMPAT = `\n\n## Kimi Code Harness Compatibility\n\n- Use \`Agent\` tool with \`subagent_type\` \`coder\` / \`explore\` / \`plan\`.\n- Use \`AgentSwarm\` for parallel work.\n- Use \`TodoList\` for tracking.\n`;

const TEXT_EXTENSIONS = new Set(['.md', '.mjs', '.js', '.json', '.yaml', '.yml', '.sh', '.txt']);

function isTextFile(name) {
  const ext = path.extname(name).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || !ext;
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else if (isTextFile(entry.name)) {
      const content = fs.readFileSync(srcPath, 'utf-8');
      fs.writeFileSync(dstPath, rebrandSkillContent(content), 'utf-8');
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function rebrandSkillContent(content) {
  return content
    .replace(/## OMO Kimi K2\.7 Orchestration Calibration/g, '## LazyKimiCode K2.7 Orchestration Calibration')
    .replace(/OMO_KIMI_LSP_COMMAND/g, 'LAZYKIMICODE_LSP_COMMAND')
    .replace(/OMO_KIMI_LSP_ARGS/g, 'LAZYKIMICODE_LSP_ARGS')
    .replace(/OMO_SOURCE_ROOT/g, 'LAZYKIMICODE_SOURCE_ROOT')
    .replace(/OH_MY_KIMICODE_SOURCE_ROOT/g, 'LAZYKIMICODE_SOURCE_ROOT')
    .replace(/Oh My KimiCode \(OmO harness\)/g, 'LazyKimiCode')
    .replace(/Oh My KimiCode/g, 'LazyKimiCode')
    .replace(/\bOmO\b/g, 'LazyKimiCode')
    .replace(/\.omo\b/g, '.lazykimicode');
}

function rewriteSkillMd(content) {
  // Strip any legacy Codex compatibility section.
  content = content.replace(/## Codex Harness Tool Compatibility[\s\S]*?(?=\n## |\n*$)/, '');
  // Strip the LazyCodex-specific agent YAML references; Kimi does not load agent TOMLs from skills.
  content = content.replace(/agents\/openai\.yaml[\s\S]{0,200}?\n\n/, '\n');
  content = rebrandSkillContent(content);
  const hasCompat = content.includes('## Kimi Code Harness Compatibility') ||
    content.includes('# Kimi Code Harness Compatibility');
  if (!hasCompat) {
    content += KIMI_COMPAT;
  }
  return content;
}

function copySkill(srcDir, outName) {
  const skillMd = path.join(srcDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) return;
  const outDir = path.join(OUT, outName);
  fs.mkdirSync(outDir, { recursive: true });

  // Copy everything except SKILL.md; transform text files during copy.
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(outDir, entry.name);
    if (entry.name === 'SKILL.md') continue;
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else if (isTextFile(entry.name)) {
      const content = fs.readFileSync(srcPath, 'utf-8');
      fs.writeFileSync(dstPath, rebrandSkillContent(content), 'utf-8');
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }

  let content = fs.readFileSync(skillMd, 'utf-8');
  content = rewriteSkillMd(content);
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
