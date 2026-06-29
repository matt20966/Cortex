#!/usr/bin/env node
/**
 * sessionStart hook — injects Cortex project memory summary into agent context.
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const memoryPath = path.join(rootDir, '.memory', 'cortex.json');
const inboxPath = path.join(rootDir, 'inbox', 'pending.json');

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    const memory = readJson(memoryPath, null);
    const inbox = readJson(inboxPath, { items: [] });
    const pending = (inbox.items || []).filter((i) => i.status === 'pending');
    const openPain = memory
      ? (memory.pain_points || []).filter((p) => p.status === 'open' || p.status === 'in_progress')
      : [];

    const lines = [
      '## Cortex session context',
      `- Project memory: \`.memory/cortex.json\``,
      `- Inbox pending: ${pending.length} item(s) in \`inbox/pending.json\``,
    ];

    if (memory && memory.project) {
      lines.push(`- Active project: ${memory.project.name} (${memory.project.status})`);
    }

    if (openPain.length > 0) {
      lines.push('- Open blockers:');
      openPain.forEach((p) => lines.push(`  - [${p.id}] ${p.description}`));
    }

    if (pending.length > 0) {
      lines.push('- Pending inbox (latest):');
      pending.slice(0, 3).forEach((item) => {
        lines.push(`  - [${item.id}] ${item.content.slice(0, 120)}`);
      });
    }

    lines.push('');
    lines.push('Agents: see `agents/` directory. Skills: `.cursor/skills/` and personal `presentation-hook`.');
    lines.push('Commits: apply `github-commit` skill at checkpoints; `[agent-change]` required for agent/skill edits.');

    const output = {
      additional_context: lines.join('\n')
    };

    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  });
}

main();
