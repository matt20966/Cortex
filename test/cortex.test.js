const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createServer } = require('../dev-server');
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

  before(async () => {
    server = createServer();
    port = await listen(server);
  });

  after(() => new Promise((resolve) => server.close(resolve)));

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

  it('POST /api/inbox routes idea: prefix', async () => {
    const res = await request(port, 'POST', '/api/inbox', {
      content: `idea: test routing ${Date.now()}`
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.route, 'idea');
    assert.equal(res.body.target_agent, 'idea-creator-validator');
    assert.ok(res.body.queue_item);
  });
});
