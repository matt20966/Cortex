#!/usr/bin/env node
/**
 * self-improvement-review — scans recent agent runs for eval failures;
 * writes pending improvement notes to .memory/pending-improvements.json
 */
const path = require('path');
const fs = require('fs');
const { readJsonFile, writeJsonFile } = require('../lib/store');

const rootDir = path.join(__dirname, '..');
const memoryPath = path.join(rootDir, '.memory', 'cortex.json');
const pendingPath = path.join(rootDir, '.memory', 'pending-improvements.json');
const agentsDir = path.join(rootDir, 'agents');

function loadEvalSpec(agentId) {
  const evalPath = path.join(agentsDir, `${agentId}.eval.json`);
  if (!fs.existsSync(evalPath)) return null;
  return readJsonFile(evalPath, null);
}

function scoreRun(agentId, run) {
  const spec = loadEvalSpec(agentId);
  if (!spec) return { score: null, issues: [] };

  const issues = [];
  if (run.status === 'failed') {
    issues.push({ mode: 'failed-run', message: run.summary });
  }
  (spec.failure_modes || []).forEach((mode) => {
    if (mode.heuristic.includes('missing') && run.summary?.toLowerCase().includes('missing')) {
      issues.push({ mode: mode.id, message: mode.heuristic });
    }
  });

  return { score: issues.length === 0 ? 'pass' : 'review', issues };
}

function main() {
  const memory = readJsonFile(memoryPath, null);
  if (!memory) {
    console.error('self-improvement-review: no memory');
    process.exit(1);
  }

  const recent = (memory.agent_runs || []).slice(0, 10);
  const pending = readJsonFile(pendingPath, { items: [] });

  recent.forEach((run) => {
    const { score, issues } = scoreRun(run.agent, run);
    if (score === 'review' && issues.length > 0) {
      pending.items.push({
        id: `imp-${Date.now()}-${run.agent}`,
        agent: run.agent,
        run_summary: run.summary,
        issues,
        status: 'pending_review',
        created_at: new Date().toISOString()
      });
    }
  });

  pending.items = pending.items.slice(0, 20);
  writeJsonFile(pendingPath, pending);
  console.log(`self-improvement-review: ${pending.items.length} pending item(s)`);
}

main();
