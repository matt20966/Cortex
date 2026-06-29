#!/usr/bin/env node
/**
 * stop hook — logs agent completion to memory and reminds to commit if dirty.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const memoryPath = path.join(rootDir, '.memory', 'cortex.json');

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getDirtyFiles() {
  try {
    const out = execSync('git status --porcelain', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    let hookInput = {};
    try {
      hookInput = input ? JSON.parse(input) : {};
    } catch {
      hookInput = {};
    }

    const dirty = getDirtyFiles();
    const memory = readJson(memoryPath, null);

    if (memory) {
      if (!Array.isArray(memory.agent_runs)) memory.agent_runs = [];

      const status = hookInput.status === 'error' ? 'failed' : 'success';
      const run = {
        agent: 'cursor-agent',
        summary: dirty.length > 0
          ? `Agent session completed with ${dirty.length} uncommitted change(s)`
          : (hookInput.loop_count && hookInput.loop_count > 0)
            ? `Agent session completed (${hookInput.loop_count} loop(s))`
            : 'Agent session completed',
        status,
        action_required: status === 'failed'
          ? 'Review session output for errors'
          : dirty.length > 0
            ? `${dirty.length} uncommitted file(s) — apply github-commit skill before ending session`
            : null,
        created_at: new Date().toISOString()
      };

      memory.agent_runs.unshift(run);
      if (memory.agent_runs.length > 50) {
        memory.agent_runs = memory.agent_runs.slice(0, 50);
      }
      if (memory.project) {
        memory.project.updated_at = new Date().toISOString();
      }
      writeJson(memoryPath, memory);
    }

    const output = {};
    if (dirty.length > 0) {
      const preview = dirty.slice(0, 5).map((line) => line.trim()).join('\n');
      const more = dirty.length > 5 ? `\n...and ${dirty.length - 5} more` : '';
      output.followup_message = [
        'Uncommitted changes remain. Apply the **github-commit** skill:',
        '- Run tests if applicable',
        '- Commit at a natural checkpoint with a conventional message (why, not just what)',
        '- Use `[agent-change]` prefix if agents/, .cursor/skills/, or hooks were modified',
        '',
        'Dirty files:',
        preview + more
      ].join('\n');
    }

    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  });
}

main();
