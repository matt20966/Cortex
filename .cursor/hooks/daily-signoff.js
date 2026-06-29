#!/usr/bin/env node
/**
 * daily-signoff — end-of-day sign-off: run tests, log result to memory, surface blockers.
 * Changelog v0.1 — Created. EOD quality gate: npm test before sign-off, pain_points on failure.
 */
const { execSync } = require('child_process');
const path = require('path');
const { readJsonFile, writeJsonFile } = require('../../lib/store');

const rootDir = path.resolve(__dirname, '..', '..');
const memoryPath = path.join(rootDir, '.memory', 'cortex.json');
const packagePath = path.join(rootDir, 'package.json');

function hasTestScript() {
  const pkg = readJsonFile(packagePath, {});
  return Boolean(pkg.scripts && pkg.scripts.test);
}

function runTests() {
  const output = execSync('npm test', { cwd: rootDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return { passed: true, output };
}

function getDirtyFiles() {
  try {
    const out = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function nextPainId(memory) {
  const existing = (memory.pain_points || [])
    .map((p) => p.id)
    .filter((id) => /^pain-\d+$/.test(id))
    .map((id) => Number(id.replace('pain-', '')));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `pain-${String(next).padStart(3, '0')}`;
}

function appendAgentRun(memory, run) {
  if (!Array.isArray(memory.agent_runs)) memory.agent_runs = [];
  memory.agent_runs.unshift(run);
  if (memory.agent_runs.length > 50) memory.agent_runs = memory.agent_runs.slice(0, 50);
}

function main() {
  const startedAt = new Date().toISOString();
  const dirty = getDirtyFiles();
  const memory = readJsonFile(memoryPath, null);

  if (!memory) {
    console.error('daily-signoff: project memory not found');
    process.exit(1);
  }
  if (!hasTestScript()) {
    console.error('daily-signoff: no npm test script');
    process.exit(1);
  }

  let testResult;
  try {
    testResult = runTests();
  } catch (err) {
    testResult = {
      passed: false,
      output: [err.stdout || '', err.stderr || '', err.message].filter(Boolean).join('\n')
    };
  }

  const now = new Date().toISOString();

  if (testResult.passed) {
    appendAgentRun(memory, {
      agent: 'daily-signoff',
      summary: dirty.length > 0
        ? `EOD sign-off: tests passed; ${dirty.length} uncommitted change(s) remain`
        : 'EOD sign-off: tests passed; working tree clean',
      status: 'success',
      action_required: dirty.length > 0
        ? `${dirty.length} uncommitted file(s) — apply github-commit skill before ending the day`
        : null,
      created_at: now
    });
    if (memory.project) memory.project.updated_at = now;
    writeJsonFile(memoryPath, memory);
    console.log('daily-signoff: tests passed');
    if (dirty.length > 0) {
      console.log(`daily-signoff: ${dirty.length} uncommitted file(s) remain`);
    }
    process.exit(0);
  }

  if (!Array.isArray(memory.pain_points)) memory.pain_points = [];
  const painId = nextPainId(memory);
  const failureSummary = testResult.output.trim().split('\n').slice(-8).join('\n');

  memory.pain_points.push({
    id: painId,
    description: `EOD sign-off blocked: test suite failed (${startedAt.split('T')[0]})`,
    status: 'open',
    resolution: null,
    created_at: now,
    resolved_at: null
  });

  appendAgentRun(memory, {
    agent: 'daily-signoff',
    summary: 'EOD sign-off: tests failed — no commit recommended',
    status: 'failed',
    action_required: `Fix failing tests (${painId})`,
    created_at: now
  });

  if (memory.project) memory.project.updated_at = now;
  writeJsonFile(memoryPath, memory);
  console.error('daily-signoff: tests failed');
  console.error(failureSummary);
  process.exit(1);
}

main();
