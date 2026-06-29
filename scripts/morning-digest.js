#!/usr/bin/env node
/**
 * morning-digest — assembles data for daily reporter; writes digests/latest.json.
 * Agent reasoning still runs in Cursor; this script does pre-agent code assembly.
 */
const path = require('path');
const { readJsonFile, writeJsonFile } = require('../lib/store');

const rootDir = path.resolve(__dirname, '..');
const paths = {
  memory: path.join(rootDir, '.memory', 'cortex.json'),
  inbox: path.join(rootDir, 'inbox', 'pending.json'),
  queue: path.join(rootDir, 'queue', 'pending.json'),
  dashboard: path.join(rootDir, '.memory', 'dashboard.json'),
  digest: path.join(rootDir, 'digests', 'latest.json')
};

function getYesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function main() {
  const memory = readJsonFile(paths.memory, null);
  const inbox = readJsonFile(paths.inbox, { items: [] });
  const queue = readJsonFile(paths.queue, { items: [] });
  const dashboard = readJsonFile(paths.dashboard, { tasks: [], projects: [] });

  const yesterday = getYesterdayIso();
  const today = new Date().toISOString().split('T')[0];

  const pendingInbox = (inbox.items || []).filter((i) => i.status === 'pending');
  const pendingQueue = (queue.items || []).filter((i) => i.status === 'pending');
  const openPain = memory
    ? (memory.pain_points || []).filter((p) => p.status === 'open' || p.status === 'in_progress')
    : [];
  const newIdeas = memory
    ? (memory.ideas || []).filter((i) => i.created_at > yesterday)
    : [];
  const recentRuns = memory
    ? (memory.agent_runs || []).filter((r) => r.created_at > yesterday)
    : [];

  const pendingTasks = (dashboard.tasks || []).filter((t) => t.status !== 'completed');
  const activeProjects = (dashboard.projects || []).filter((p) => p.status === 'active');

  const digest = {
    schema_type: 'daily-digest',
    assembled_at: new Date().toISOString(),
    date: today,
    focus: pendingTasks.length > 0
      ? `Complete ${pendingTasks.length} pending task(s) across ${activeProjects.length} active project(s)`
      : 'Review inbox and open blockers',
    priorities: pendingTasks.slice(0, 5).map((t) => ({
      item: t.title || t.name || 'Untitled task',
      reason: t.priority ? `${t.priority} priority` : 'Pending in dashboard'
    })),
    blockers: openPain.map((p) => ({ id: p.id, description: p.description })),
    inbox_pending: pendingInbox.length,
    queue_pending: pendingQueue.length,
    new_ideas: newIdeas.map((i) => ({
      id: i.id,
      content: i.content,
      verdict: i.verdict || null
    })),
    overnight_activity: recentRuns.length > 0
      ? `${recentRuns.length} agent run(s) since yesterday`
      : 'none',
    agent_invocation: 'Run daily-reporter for today\'s digest'
  };

  const dir = path.dirname(paths.digest);
  if (!require('fs').existsSync(dir)) {
    require('fs').mkdirSync(dir, { recursive: true });
  }
  writeJsonFile(paths.digest, digest);

  console.log(`morning-digest: wrote ${paths.digest}`);
  console.log(`  focus: ${digest.focus}`);
  console.log(`  inbox: ${digest.inbox_pending} pending, queue: ${digest.queue_pending}`);
  console.log(`  blockers: ${digest.blockers.length}, new ideas: ${digest.new_ideas.length}`);
}

main();
