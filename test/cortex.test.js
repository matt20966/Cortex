const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { classifyInboxContent } = require('../lib/router');
const { validate } = require('../lib/validate');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.on('error', reject);
  });
}

function request(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: urlPath,
      method,
      headers: payload
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        : {}
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = raw;
        try { json = raw ? JSON.parse(raw) : null; } catch { /* text */ }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('router', () => {
  it('classifies idea: prefix', () => {
    const r = classifyInboxContent('idea: auto-route inbox');
    assert.equal(r.route, 'idea');
    assert.equal(r.target_agent, 'idea-creator-validator');
    assert.equal(r.content, 'auto-route inbox');
  });

  it('falls back to unclassified', () => {
    const r = classifyInboxContent('random note');
    assert.equal(r.route, 'unclassified');
    assert.equal(r.target_agent, null);
  });
});

describe('validate', () => {
  it('validates idea-validation schema', () => {
    const result = validate('idea-validation', {
      verdict: 'build',
      summary: 'Worth building because pain is recurring',
      recommendation: 'Prototype inbox router'
    });
    assert.equal(result.valid, true);
  });

  it('rejects invalid verdict', () => {
    const result = validate('idea-validation', { verdict: 'maybe', summary: 'x', recommendation: 'y' });
    assert.equal(result.valid, false);
  });
});

describe('dev-server API', () => {
  let server;
  let port;
  let tmpDir;
  let createServer;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-api-'));
    process.env.CORTEX_DB_PATH = path.join(tmpDir, 'api-test.db');
    delete require.cache[require.resolve('../dev-server')];
    ({ createServer, resetDbForTests } = require('../dev-server'));
    server = createServer();
    port = await listen(server);
  });

  after(() => new Promise((resolve) => {
    server.close(() => {
      resetDbForTests();
      delete process.env.CORTEX_DB_PATH;
      fs.rmSync(tmpDir, { recursive: true, force: true });
      resolve();
    });
  }));

  it('GET /api/memory/cortex', async () => {
    const res = await request(port, 'GET', '/api/memory/cortex');
    assert.equal(res.status, 200);
    assert.equal(res.body.project.id, 'cortex');
  });

  it('GET /api/agents/registry', async () => {
    const res = await request(port, 'GET', '/api/agents/registry');
    assert.equal(res.status, 200);
    assert.ok(res.body.agents.length >= 2);
  });

  it('GET /api/skills/registry lists cursor skills', async () => {
    const res = await request(port, 'GET', '/api/skills/registry');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.skills));
    const dailyCompact = res.body.skills.find((s) => s.id === 'daily-compact');
    assert.ok(dailyCompact, 'daily-compact skill should be listed');
    assert.ok(dailyCompact.invocation.includes('daily-compact'));
  });

  it('POST /api/inbox routes idea: prefix', async () => {
    const res = await request(port, 'POST', '/api/inbox', {
      content: `idea: test routing ${Date.now()}`
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.route, 'idea');
    assert.equal(res.body.target_agent, 'idea-creator-validator');
    assert.ok(res.body.queue_item);
  });

  it('PUT /api/dashboard persists notes and tasks to sqlite', async () => {
    const payload = {
      theme: 'light-theme',
      dailyNotes: { '2026-06-30': 'Daily reflection note' },
      projects: [{ id: 'proj-api', name: 'API Project', status: 'active', color: '#22c55e' }],
      skills: [],
      tasks: [{ id: 'task-api', title: 'Persist me', status: 'todo', priority: 'medium', projectId: 'proj-api' }],
      navUsage: {
        lastView: 'tasks',
        recentViews: [],
        pins: ['tasks'],
        views: {},
        projects: {},
        moreExpanded: false,
        moreProjectsExpanded: false,
        totalEvents: 0
      }
    };
    const putRes = await request(port, 'PUT', '/api/dashboard', payload);
    assert.equal(putRes.status, 200);
    assert.ok(putRes.body.updated_at);

    const getRes = await request(port, 'GET', '/api/dashboard');
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.dailyNotes['2026-06-30'], 'Daily reflection note');
    assert.equal(getRes.body.tasks[0].title, 'Persist me');
    assert.equal(getRes.body.projects[0].name, 'API Project');
  });
});
