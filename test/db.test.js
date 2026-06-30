const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createDb,
  getDashboard,
  saveDashboard,
  addInboxItem,
  getInbox,
  saveProjectMemory,
  getProjectMemory
} = require('../lib/db');

describe('sqlite store', () => {
  let tmpDir;
  let dbPath;
  let bundle;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-db-'));
    dbPath = path.join(tmpDir, 'test.db');
    bundle = createDb(tmpDir, { dbPath });
  });

  after(() => {
    bundle.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('persists tasks, projects, skills, and daily notes', () => {
    const payload = {
      theme: 'dark-theme',
      dailyNotes: { '2026-06-30': 'Ship sqlite persistence' },
      projects: [{ id: 'proj-1', name: 'Cortex', status: 'active', color: '#6366f1' }],
      skills: [{ id: 'skill-1', name: 'Test Skill', path: '/skills/test' }],
      tasks: [{
        id: 'task-1',
        title: 'Wire database',
        status: 'todo',
        priority: 'high',
        projectId: 'proj-1'
      }],
      navUsage: { lastView: 'tasks', recentViews: [], pins: ['tasks'], views: {}, projects: {}, totalEvents: 0 }
    };

    const saved = saveDashboard(bundle.db, payload, { paths: bundle.paths });
    assert.ok(saved.updated_at);

    const loaded = getDashboard(bundle.db);
    assert.equal(loaded.theme, 'dark-theme');
    assert.equal(loaded.dailyNotes['2026-06-30'], 'Ship sqlite persistence');
    assert.equal(loaded.tasks.length, 1);
    assert.equal(loaded.projects[0].name, 'Cortex');
    assert.equal(loaded.skills[0].name, 'Test Skill');
  });

  it('mirrors dashboard data to dashboard.json', () => {
    const jsonPath = bundle.paths.dashboard;
    assert.ok(fs.existsSync(jsonPath));
    const onDisk = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.equal(onDisk.tasks[0].id, 'task-1');
    assert.equal(onDisk.dailyNotes['2026-06-30'], 'Ship sqlite persistence');
  });

  it('persists inbox items and exports pending.json', () => {
    const item = {
      id: 'inbox-test-1',
      content: 'remember this note',
      status: 'pending',
      route: 'unclassified',
      target_agent: null,
      created_at: new Date().toISOString(),
      processed_at: null
    };
    addInboxItem(bundle.db, item, bundle.paths);
    const inbox = getInbox(bundle.db);
    assert.equal(inbox.items.length, 1);
    assert.equal(inbox.items[0].content, 'remember this note');
    assert.ok(fs.existsSync(bundle.paths.inbox));
  });

  it('persists project memory and exports cortex.json', () => {
    const memory = {
      project: { id: 'cortex', name: 'Cortex', status: 'active', created_at: '2026-06-29T00:00:00.000Z' },
      ideas: [],
      research: [],
      decisions: [],
      pain_points: [],
      links: [],
      agent_runs: []
    };
    saveProjectMemory(bundle.db, memory, bundle.paths);
    const loaded = getProjectMemory(bundle.db);
    assert.equal(loaded.project.name, 'Cortex');
    assert.ok(fs.existsSync(bundle.paths.memory));
  });
});
