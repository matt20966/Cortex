const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA_VERSION = 1;

function defaultPaths(rootDir) {
  const memoryDir = path.join(rootDir, '.memory');
  return {
    db: path.join(memoryDir, 'cortex.db'),
    memory: path.join(memoryDir, 'cortex.json'),
    dashboard: path.join(memoryDir, 'dashboard.json'),
    inbox: path.join(rootDir, 'inbox', 'pending.json'),
    queue: path.join(rootDir, 'queue', 'pending.json')
  };
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function createDefaultDashboard() {
  return {
    theme: 'light-theme',
    dailyNotes: {},
    projects: [],
    skills: [],
    tasks: [],
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
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_notes (
      note_date TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inbox_items (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      route TEXT,
      target_agent TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS queue_items (
      id TEXT PRIMARY KEY,
      inbox_id TEXT,
      target_agent TEXT,
      route TEXT,
      content TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS project_memory (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version');
  if (!row) {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('schema_version', String(SCHEMA_VERSION));
  }
}

function isDashboardEmpty(db) {
  const taskCount = db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n;
  const projectCount = db.prepare('SELECT COUNT(*) AS n FROM projects').get().n;
  const noteCount = db.prepare('SELECT COUNT(*) AS n FROM daily_notes').get().n;
  const theme = db.prepare('SELECT value FROM meta WHERE key = ?').get('theme');
  return taskCount === 0 && projectCount === 0 && noteCount === 0 && !theme;
}

function importDashboardFromJson(db, dashboard, paths) {
  const now = dashboard.updated_at || new Date().toISOString();
  saveDashboard(db, { ...createDefaultDashboard(), ...dashboard }, { syncJson: false });
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('updated_at', now);
  exportDashboardJson(db, paths);
}

function importInboxFromJson(db, inbox, paths) {
  const items = Array.isArray(inbox?.items) ? inbox.items : [];
  if (!items.length) return;
  const existing = db.prepare('SELECT COUNT(*) AS n FROM inbox_items').get().n;
  if (existing > 0) return;

  const insert = db.prepare(`
    INSERT INTO inbox_items (id, content, status, route, target_agent, created_at, processed_at)
    VALUES (@id, @content, @status, @route, @target_agent, @created_at, @processed_at)
  `);
  const tx = db.transaction(() => {
    for (const item of items) {
      insert.run({
        id: item.id,
        content: item.content,
        status: item.status || 'pending',
        route: item.route || null,
        target_agent: item.target_agent || null,
        created_at: item.created_at,
        processed_at: item.processed_at || null
      });
    }
  });
  tx();
  exportInboxJson(db, paths);
}

function importQueueFromJson(db, queue, paths) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  if (!items.length) return;
  const existing = db.prepare('SELECT COUNT(*) AS n FROM queue_items').get().n;
  if (existing > 0) return;

  const insert = db.prepare(`
    INSERT INTO queue_items (id, inbox_id, target_agent, route, content, status, created_at, processed_at)
    VALUES (@id, @inbox_id, @target_agent, @route, @content, @status, @created_at, @processed_at)
  `);
  const tx = db.transaction(() => {
    for (const item of items) {
      insert.run({
        id: item.id,
        inbox_id: item.inbox_id || null,
        target_agent: item.target_agent || null,
        route: item.route || null,
        content: item.content || null,
        status: item.status || 'pending',
        created_at: item.created_at,
        processed_at: item.processed_at || null
      });
    }
  });
  tx();
  exportQueueJson(db, paths);
}

function importMemoryFromJson(db, memory, paths) {
  if (!memory) return;
  const existing = db.prepare('SELECT id FROM project_memory WHERE id = ?').get('cortex');
  if (existing) return;
  const now = memory.project?.updated_at || new Date().toISOString();
  db.prepare(`
    INSERT INTO project_memory (id, data, updated_at) VALUES (?, ?, ?)
  `).run('cortex', JSON.stringify(memory), now);
  exportMemoryJson(db, paths);
}

function migrateFromJsonFiles(db, paths) {
  if (isDashboardEmpty(db)) {
    const dashboard = readJsonFile(paths.dashboard, null);
    if (dashboard) importDashboardFromJson(db, dashboard, paths);
  }

  importInboxFromJson(db, readJsonFile(paths.inbox, { items: [] }), paths);
  importQueueFromJson(db, readJsonFile(paths.queue, { items: [] }), paths);
  importMemoryFromJson(db, readJsonFile(paths.memory, null), paths);
}

function getDashboard(db) {
  const themeRow = db.prepare('SELECT value FROM meta WHERE key = ?').get('theme');
  const navRow = db.prepare('SELECT value FROM meta WHERE key = ?').get('navUsage');
  const updatedRow = db.prepare('SELECT value FROM meta WHERE key = ?').get('updated_at');

  const dailyNotes = {};
  for (const row of db.prepare('SELECT note_date, content FROM daily_notes ORDER BY note_date').all()) {
    dailyNotes[row.note_date] = row.content;
  }

  const tasks = db.prepare('SELECT data FROM tasks ORDER BY sort_order ASC').all()
    .map((row) => JSON.parse(row.data));
  const projects = db.prepare('SELECT data FROM projects ORDER BY sort_order ASC').all()
    .map((row) => JSON.parse(row.data));
  const skills = db.prepare('SELECT data FROM skills ORDER BY sort_order ASC').all()
    .map((row) => JSON.parse(row.data));

  let navUsage = createDefaultDashboard().navUsage;
  if (navRow?.value) {
    try {
      navUsage = JSON.parse(navRow.value);
    } catch {
      /* keep default */
    }
  }

  const dashboard = {
    theme: themeRow?.value || 'light-theme',
    dailyNotes,
    projects,
    skills,
    tasks,
    navUsage
  };
  if (updatedRow?.value) dashboard.updated_at = updatedRow.value;
  return dashboard;
}

function saveDashboard(db, data, { syncJson = true, paths } = {}) {
  const now = new Date().toISOString();
  const insertNote = db.prepare(`
    INSERT INTO daily_notes (note_date, content, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(note_date) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `);
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, data, sort_order, updated_at) VALUES (?, ?, ?, ?)
  `);
  const insertProject = db.prepare(`
    INSERT INTO projects (id, data, sort_order, updated_at) VALUES (?, ?, ?, ?)
  `);
  const insertSkill = db.prepare(`
    INSERT INTO skills (id, data, sort_order, updated_at) VALUES (?, ?, ?, ?)
  `);
  const upsertMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');

  const tx = db.transaction(() => {
    upsertMeta.run('theme', data.theme || 'light-theme');
    upsertMeta.run('navUsage', JSON.stringify(data.navUsage || createDefaultDashboard().navUsage));
    upsertMeta.run('updated_at', now);

    const noteEntries = Object.entries(data.dailyNotes || {});
    db.prepare('DELETE FROM daily_notes').run();
    for (const [date, content] of noteEntries) {
      if (content != null && content !== '') {
        insertNote.run(date, content, now);
      }
    }

    db.prepare('DELETE FROM tasks').run();
    (data.tasks || []).forEach((task, index) => {
      insertTask.run(task.id, JSON.stringify(task), index, now);
    });

    db.prepare('DELETE FROM projects').run();
    (data.projects || []).forEach((project, index) => {
      insertProject.run(project.id, JSON.stringify(project), index, now);
    });

    db.prepare('DELETE FROM skills').run();
    (data.skills || []).forEach((skill, index) => {
      insertSkill.run(skill.id, JSON.stringify(skill), index, now);
    });
  });
  tx();

  const saved = getDashboard(db);
  saved.updated_at = now;
  if (syncJson && paths) exportDashboardJson(db, paths, saved);
  return saved;
}

function exportDashboardJson(db, paths, dashboard = null) {
  const payload = dashboard || getDashboard(db);
  writeJsonFile(paths.dashboard, payload);
}

function getInbox(db) {
  const items = db.prepare(`
    SELECT id, content, status, route, target_agent, created_at, processed_at
    FROM inbox_items
    ORDER BY created_at DESC
  `).all();
  return { items };
}

function addInboxItem(db, item, paths) {
  db.prepare(`
    INSERT INTO inbox_items (id, content, status, route, target_agent, created_at, processed_at)
    VALUES (@id, @content, @status, @route, @target_agent, @created_at, @processed_at)
  `).run(item);
  exportInboxJson(db, paths);
  return item;
}

function updateInboxItem(db, id, patch, paths) {
  const item = db.prepare('SELECT * FROM inbox_items WHERE id = ?').get(id);
  if (!item) return null;
  if (patch.status) item.status = patch.status;
  if (patch.status === 'processed') {
    item.processed_at = new Date().toISOString();
  }
  db.prepare(`
    UPDATE inbox_items SET status = ?, processed_at = ? WHERE id = ?
  `).run(item.status, item.processed_at || null, id);
  exportInboxJson(db, paths);
  return item;
}

function exportInboxJson(db, paths) {
  writeJsonFile(paths.inbox, getInbox(db));
}

function getQueue(db) {
  const items = db.prepare(`
    SELECT id, inbox_id, target_agent, route, content, status, created_at, processed_at
    FROM queue_items
    ORDER BY created_at DESC
  `).all();
  return { items };
}

function addQueueItem(db, item, paths) {
  db.prepare(`
    INSERT INTO queue_items (id, inbox_id, target_agent, route, content, status, created_at, processed_at)
    VALUES (@id, @inbox_id, @target_agent, @route, @content, @status, @created_at, @processed_at)
  `).run(item);
  exportQueueJson(db, paths);
  return item;
}

function updateQueueItem(db, id, patch, paths) {
  const item = db.prepare('SELECT * FROM queue_items WHERE id = ?').get(id);
  if (!item) return null;
  if (patch.status) item.status = patch.status;
  if (patch.status === 'processed') {
    item.processed_at = new Date().toISOString();
  }
  db.prepare(`
    UPDATE queue_items SET status = ?, processed_at = ? WHERE id = ?
  `).run(item.status, item.processed_at || null, id);
  exportQueueJson(db, paths);
  return item;
}

function exportQueueJson(db, paths) {
  writeJsonFile(paths.queue, getQueue(db));
}

function getProjectMemory(db, id = 'cortex') {
  const row = db.prepare('SELECT data FROM project_memory WHERE id = ?').get(id);
  if (!row) return null;
  return JSON.parse(row.data);
}

function saveProjectMemory(db, memory, paths, id = 'cortex') {
  const now = new Date().toISOString();
  if (memory.project) memory.project.updated_at = now;
  db.prepare(`
    INSERT INTO project_memory (id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(id, JSON.stringify(memory), now);
  exportMemoryJson(db, paths, memory);
  return memory;
}

function exportMemoryJson(db, paths, memory = null) {
  const payload = memory || getProjectMemory(db);
  if (payload) writeJsonFile(paths.memory, payload);
}

function createDb(rootDir, options = {}) {
  const paths = { ...defaultPaths(rootDir), ...options.paths };
  if (options.dbPath) paths.db = options.dbPath;

  const memoryDir = path.dirname(paths.db);
  if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });

  const db = new Database(paths.db);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  migrateFromJsonFiles(db, paths);

  return { db, paths };
}

module.exports = {
  SCHEMA_VERSION,
  createDb,
  createDefaultDashboard,
  getDashboard,
  saveDashboard,
  getInbox,
  addInboxItem,
  updateInboxItem,
  getQueue,
  addQueueItem,
  updateQueueItem,
  getProjectMemory,
  saveProjectMemory,
  exportDashboardJson,
  exportInboxJson,
  exportQueueJson,
  exportMemoryJson,
  defaultPaths
};
