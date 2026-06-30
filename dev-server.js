const http = require('http');
const fs = require('fs');
const path = require('path');
const { classifyInboxContent } = require('./lib/router');
const { validate } = require('./lib/validate');
const { readJsonFile } = require('./lib/store');
const { listCursorSkills, writeSkillsRegistry } = require('./lib/skills-registry');
const {
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
  saveProjectMemory
} = require('./lib/db');

const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

let _dbBundle = null;

function ensureDb(options = {}) {
  if (options.db) {
    return { db: options.db, paths: options.paths };
  }
  if (!_dbBundle) {
    _dbBundle = createDb(rootDir, {
      dbPath: process.env.CORTEX_DB_PATH || undefined
    });
  }
  return _dbBundle;
}

function resetDbForTests() {
  if (_dbBundle?.db) {
    _dbBundle.db.close();
  }
  _dbBundle = null;
}

const paths = {
  digest: path.join(rootDir, 'digests', 'latest.json'),
  registry: path.join(rootDir, 'agents', 'registry.json')
};

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

let server;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function pushToQueue(inboxItem, dbBundle) {
  if (!inboxItem.target_agent) return null;
  const item = {
    id: `queue-${Date.now()}`,
    inbox_id: inboxItem.id,
    target_agent: inboxItem.target_agent,
    route: inboxItem.route,
    content: inboxItem.content,
    status: 'pending',
    created_at: new Date().toISOString(),
    processed_at: null
  };
  return addQueueItem(dbBundle.db, item, dbBundle.paths);
}

function handleApi(req, res, urlPath, dbBundle) {
  const { db } = dbBundle;
  const storePaths = dbBundle.paths;
  if (req.method === 'GET' && urlPath === '/api/memory/cortex') {
    const memory = getProjectMemory(db);
    if (!memory) {
      sendJson(res, 404, { error: 'Project memory not found' });
      return true;
    }
    sendJson(res, 200, memory);
    return true;
  }

  if (req.method === 'PATCH' && urlPath === '/api/memory/cortex') {
    readBody(req)
      .then((body) => {
        const result = validate('project-memory', body);
        if (!result.valid) {
          sendJson(res, 400, { error: 'Schema validation failed', details: result.errors });
          return;
        }
        const saved = saveProjectMemory(db, body, storePaths);
        sendJson(res, 200, saved);
      })
      .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
    return true;
  }

  if (req.method === 'GET' && urlPath === '/api/dashboard') {
    const dashboard = getDashboard(db);
    sendJson(res, 200, Object.keys(dashboard.dailyNotes || {}).length || dashboard.tasks.length || dashboard.projects.length
      ? dashboard
      : { ...createDefaultDashboard(), ...dashboard });
    return true;
  }

  if (req.method === 'PUT' && urlPath === '/api/dashboard') {
    readBody(req)
      .then((body) => {
        const result = validate('dashboard', body);
        if (!result.valid) {
          sendJson(res, 400, { error: 'Schema validation failed', details: result.errors });
          return;
        }
        const saved = saveDashboard(db, body, { paths: storePaths });
        sendJson(res, 200, saved);
      })
      .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
    return true;
  }

  if (req.method === 'GET' && urlPath === '/api/queue') {
    sendJson(res, 200, getQueue(db));
    return true;
  }

  if (req.method === 'GET' && urlPath === '/api/agents/registry') {
    const registry = readJsonFile(paths.registry, { agents: [] });
    sendJson(res, 200, registry);
    return true;
  }

  if (req.method === 'GET' && urlPath === '/api/skills/registry') {
    const skills = listCursorSkills(rootDir);
    try {
      writeSkillsRegistry(rootDir);
    } catch (err) {
      console.warn('Could not write skills/registry.json:', err.message);
    }
    sendJson(res, 200, { skills });
    return true;
  }

  if (req.method === 'GET' && urlPath === '/skills/registry.json') {
    const snapshot = readJsonFile(path.join(rootDir, 'skills', 'registry.json'), { skills: [] });
    sendJson(res, 200, snapshot);
    return true;
  }

  if (req.method === 'GET' && urlPath === '/api/digests/latest') {
    const digest = readJsonFile(paths.digest, null);
    if (!digest) {
      sendJson(res, 404, { error: 'No digest available' });
      return true;
    }
    sendJson(res, 200, digest);
    return true;
  }

  if (req.method === 'POST' && urlPath === '/api/validate') {
    readBody(req)
      .then((body) => {
        const schemaId = body.schema_id;
        const data = body.data;
        if (!schemaId || data === undefined) {
          sendJson(res, 400, { error: 'schema_id and data are required' });
          return;
        }
        try {
          const result = validate(schemaId, data);
          sendJson(res, 200, result);
        } catch (err) {
          sendJson(res, 400, { error: err.message });
        }
      })
      .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
    return true;
  }

  if (urlPath === '/api/inbox') {
    if (req.method === 'GET') {
      sendJson(res, 200, getInbox(db));
      return true;
    }

    if (req.method === 'POST') {
      readBody(req)
        .then((body) => {
          const content = (body.content || '').trim();
          if (!content) {
            sendJson(res, 400, { error: 'content is required' });
            return;
          }

          const classified = classifyInboxContent(content);
          const item = {
            id: `inbox-${Date.now()}`,
            content: classified.content,
            status: 'pending',
            route: classified.route,
            target_agent: classified.target_agent,
            created_at: new Date().toISOString(),
            processed_at: null
          };
          addInboxItem(db, item, storePaths);

          let queueItem = null;
          if (classified.target_agent) {
            queueItem = pushToQueue(item, dbBundle);
          }

          sendJson(res, 201, { ...item, queue_item: queueItem });
        })
        .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
      return true;
    }

    const patchMatch = urlPath.match(/^\/api\/inbox\/([^/]+)$/);
    if (req.method === 'PATCH' && patchMatch) {
      readBody(req)
        .then((body) => {
          const item = updateInboxItem(db, patchMatch[1], body, storePaths);
          if (!item) {
            sendJson(res, 404, { error: 'Inbox item not found' });
            return;
          }
          sendJson(res, 200, item);
        })
        .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
      return true;
    }
  }

  const queuePatch = urlPath.match(/^\/api\/queue\/([^/]+)$/);
  if (req.method === 'PATCH' && queuePatch) {
    readBody(req)
      .then((body) => {
        const item = updateQueueItem(db, queuePatch[1], body, storePaths);
        if (!item) {
          sendJson(res, 404, { error: 'Queue item not found' });
          return;
        }
        sendJson(res, 200, item);
      })
      .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
    return true;
  }

  return false;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function createServer(options = {}) {
  const dbBundle = ensureDb(options);

  return http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];

    if (urlPath.startsWith('/api/')) {
      if (handleApi(req, res, urlPath, dbBundle)) return;
      sendJson(res, 404, { error: 'API route not found' });
      return;
    }

    const requestPath = urlPath === '/' ? '/index.html' : urlPath;
    const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.join(rootDir, safePath);

    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        if (urlPath === '/') {
          sendFile(res, path.join(rootDir, 'index.html'));
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
        }
        return;
      }

      sendFile(res, filePath);
    });
  });
}

function startServer() {
  try {
    writeSkillsRegistry(rootDir);
  } catch (err) {
    console.warn('Could not write skills/registry.json on startup:', err.message);
  }
  server = createServer();
  server.listen(port, () => {
    console.log(`Site is running at http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`);
      process.exit(1);
      return;
    }
    console.error('Server error:', err);
    process.exit(1);
  });
}

process.on('SIGINT', () => {
  console.log('Stopping dev server...');
  if (server) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
});

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer,
  paths,
  ensureDb,
  resetDbForTests,
  readJsonFile,
  classifyInboxContent
};
