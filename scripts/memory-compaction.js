#!/usr/bin/env node
/**
 * memory-compaction — weekly compaction of agent_runs and resolved pain points.
 * Does not delete ideas or decisions; condenses noise for lower token cost.
 */
const path = require('path');
const { readJsonFile, writeJsonFile } = require('../lib/store');

const memoryPath = path.join(__dirname, '..', '.memory', 'cortex.json');
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function main() {
  const memory = readJsonFile(memoryPath, null);
  if (!memory) {
    console.error('memory-compaction: no memory file');
    process.exit(1);
  }

  const now = Date.now();
  let compactedRuns = 0;
  let compressedPain = 0;

  if (Array.isArray(memory.pain_points)) {
    memory.pain_points.forEach((p) => {
      if (p.status !== 'resolved' || !p.resolved_at) return;
      const resolvedAt = new Date(p.resolved_at).getTime();
      if (now - resolvedAt < TWO_WEEKS_MS) return;
      if (p.description.length > 80 && p.resolution) {
        p.description = p.resolution.slice(0, 120);
        compressedPain += 1;
      }
    });
  }

  if (Array.isArray(memory.agent_runs) && memory.agent_runs.length > 20) {
    const weekAgo = new Date(now - ONE_WEEK_MS).toISOString();
    const oldRuns = memory.agent_runs.filter((r) => r.created_at < weekAgo);
    const recentRuns = memory.agent_runs.filter((r) => r.created_at >= weekAgo);

    if (oldRuns.length > 5) {
      const byAgent = {};
      oldRuns.forEach((r) => {
        if (!byAgent[r.agent]) byAgent[r.agent] = { success: 0, failed: 0 };
        if (r.status === 'failed') byAgent[r.agent].failed += 1;
        else byAgent[r.agent].success += 1;
      });

      const summary = {
        agent: 'weekly-compaction',
        summary: `Weekly summary: ${oldRuns.length} runs compacted (${JSON.stringify(byAgent)})`,
        status: 'success',
        action_required: null,
        created_at: new Date().toISOString()
      };

      memory.agent_runs = [summary, ...recentRuns].slice(0, 50);
      compactedRuns = oldRuns.length;
    }
  }

  if (memory.project) memory.project.updated_at = new Date().toISOString();
  writeJsonFile(memoryPath, memory);

  console.log(`memory-compaction: compressed ${compressedPain} pain point(s), compacted ${compactedRuns} agent run(s)`);
}

main();
