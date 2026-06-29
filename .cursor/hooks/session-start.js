#!/usr/bin/env node
/**
 * sessionStart hook — injects Cortex project memory, queue, and linked context.
 * Changelog v0.2 — Surfaces agent queue, linked project summaries, and signoff/digest commands.
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const memoryPath = path.join(rootDir, '.memory', 'cortex.json');
const inboxPath = path.join(rootDir, 'inbox', 'pending.json');
const queuePath = path.join(rootDir, 'queue', 'pending.json');

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function linkedProjectSummaries(memory) {
  const links = memory?.links || [];
  if (links.length === 0) return [];

  const lines = [];
  links.forEach((link) => {
    const linkedPath = path.join(rootDir, '.memory', `${link.project_id}.json`);
    const linked = readJson(linkedPath, null);
    if (linked?.project) {
      lines.push(`  - [${link.type}] ${linked.project.name} (${link.project_id}): ${linked.project.description?.slice(0, 80) || ''}`);
    }
  });
  return lines;
}

function main() {
  process.stdin.setEncoding('utf8');
  let input = '';
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    const memory = readJson(memoryPath, null);
    const inbox = readJson(inboxPath, { items: [] });
    const queue = readJson(queuePath, { items: [] });
    const pending = (inbox.items || []).filter((i) => i.status === 'pending');
    const queued = (queue.items || []).filter((i) => i.status === 'pending');
    const openPain = memory
      ? (memory.pain_points || []).filter((p) => p.status === 'open' || p.status === 'in_progress')
      : [];

    const lines = [
      '## Cortex session context',
      `- Project memory: \`.memory/cortex.json\``,
      `- Inbox pending: ${pending.length} item(s)`,
      `- Agent queue: ${queued.length} item(s) in \`queue/pending.json\``
    ];

    if (memory?.project) {
      lines.push(`- Active project: ${memory.project.name} (${memory.project.status})`);
    }

    if (queued.length > 0) {
      lines.push('- Queued for agents:');
      queued.slice(0, 5).forEach((q) => {
        lines.push(`  - [${q.target_agent}] ${q.content?.slice(0, 100) || q.inbox_id}`);
      });
    }

    if (openPain.length > 0) {
      lines.push('- Open blockers:');
      openPain.forEach((p) => lines.push(`  - [${p.id}] ${p.description}`));
    }

    const linked = linkedProjectSummaries(memory);
    if (linked.length > 0) {
      lines.push('- Linked projects:');
      linked.forEach((l) => lines.push(l));
    }

    lines.push('');
    lines.push('Agents: `agents/registry.json`. Skills: `.cursor/skills/`.');
    lines.push('Commits: `github-commit` skill; `[agent-change]` for agent/skill/hook edits.');
    lines.push('EOD: `npm run signoff`. Morning: `npm run digest`.');

    process.stdout.write(JSON.stringify({ additional_context: lines.join('\n') }));
    process.exit(0);
  });
}

main();
