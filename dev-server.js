const http = require('http');
const fs = require('fs');
const path = require('path');
const { classifyInboxContent } = require('./lib/router');
const { validate } = require('./lib/validate');
const { readJsonFile, writeJsonFile, enqueueItem } = require('./lib/store');

const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

const paths = {
  memory: path.join(rootDir, '.memory', 'cortex.json'),
  inbox: path.join(rootDir, 'inbox', 'pending.json'),
  queue: path.join(rootDir, 'queue', 'pending.json'),
  dashboard: path.join(rootDir, '.memory', 'dashboard.json'),
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

function pushToQueue(inboxItem) {
  if (!inboxItem.target_agent) return null;
  return enqueueItem(paths.queue, {
    inbox_id: inboxItem.id,
    target_agent: inboxItem.target_agent,
    route: inboxItem.route,
    content: inboxItem.content
  });
}

function handleApi(req, res, urlPath) {
  if (req.method === 'GET' && urlPath === '/api/memory/cortex') {
    const memory = readJsonFile(paths.memory, null);
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
        if (body.project) {
          body.project.updated_at = new Date().toISOString();
        }
        writeJsonFile(paths.memory, body);
        sendJson(res, 200, body);
      })
      .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
    return true;
  }

  if (req.method === 'GET' && urlPath === '/api/dashboard') {
    const dashboard = readJsonFile(paths.dashboard, null);
    sendJson(res, 200, dashboard || { theme: 'light-theme', dailyNotes: {}, projects: [], skills: [], tasks: [] });
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
        body.updated_at = new Date().toISOString();
        writeJsonFile(paths.dashboard, body);
        sendJson(res, 200, body);
      })
      .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
    return true;
  }

  if (req.method === 'GET' && urlPath === '/api/queue') {
    const queue = readJsonFile(paths.queue, { items: [] });
    sendJson(res, 200, queue);
    return true;
  }

  if (req.method === 'GET' && urlPath === '/api/agents/registry') {
    const registry = readJsonFile(paths.registry, { agents: [] });
    sendJson(res, 200, registry);
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
      const inbox = readJsonFile(paths.inbox, { items: [] });
      sendJson(res, 200, inbox);
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
          const inbox = readJsonFile(paths.inbox, { items: [] });
          if (!Array.isArray(inbox.items)) inbox.items = [];

          const item = {
            id: `inbox-${Date.now()}`,
            content: classified.content,
            status: 'pending',
            route: classified.route,
            target_agent: classified.target_agent,
            created_at: new Date().toISOString()
          };
          inbox.items.unshift(item);
          writeJsonFile(paths.inbox, inbox);

          let queueItem = null;
          if (classified.target_agent) {
            queueItem = pushToQueue(item);
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
          const inbox = readJsonFile(paths.inbox, { items: [] });
          const item = (inbox.items || []).find((entry) => entry.id === patchMatch[1]);
          if (!item) {
            sendJson(res, 404, { error: 'Inbox item not found' });
            return;
          }

          if (body.status) item.status = body.status;
          if (body.status === 'processed') {
            item.processed_at = new Date().toISOString();
          }
          writeJsonFile(paths.inbox, inbox);
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
        const queue = readJsonFile(paths.queue, { items: [] });
        const item = (queue.items || []).find((entry) => entry.id === queuePatch[1]);
        if (!item) {
          sendJson(res, 404, { error: 'Queue item not found' });
          return;
        }
        if (body.status) item.status = body.status;
        if (body.status === 'processed') {
          item.processed_at = new Date().toISOString();
        }
        writeJsonFile(paths.queue, queue);
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

function createServer() {
  return http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];

    if (urlPath.startsWith('/api/')) {
      if (handleApi(req, res, urlPath)) return;
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

module.exports = { createServer, paths, readJsonFile, writeJsonFile, classifyInboxContent };
