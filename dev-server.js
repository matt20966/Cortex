const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

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

const memoryPath = path.join(rootDir, '.memory', 'cortex.json');
const inboxPath = path.join(rootDir, 'inbox', 'pending.json');

let server;

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err.message);
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

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

function handleApi(req, res, urlPath) {
  if (req.method === 'GET' && urlPath === '/api/memory/cortex') {
    const memory = readJsonFile(memoryPath, null);
    if (!memory) {
      sendJson(res, 404, { error: 'Project memory not found' });
      return true;
    }
    sendJson(res, 200, memory);
    return true;
  }

  if (urlPath === '/api/inbox') {
    if (req.method === 'GET') {
      const inbox = readJsonFile(inboxPath, { items: [] });
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

          const inbox = readJsonFile(inboxPath, { items: [] });
          if (!Array.isArray(inbox.items)) {
            inbox.items = [];
          }

          const item = {
            id: `inbox-${Date.now()}`,
            content,
            status: 'pending',
            created_at: new Date().toISOString()
          };
          inbox.items.unshift(item);
          writeJsonFile(inboxPath, inbox);
          sendJson(res, 201, item);
        })
        .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
      return true;
    }

    const patchMatch = urlPath.match(/^\/api\/inbox\/([^/]+)$/);
    if (req.method === 'PATCH' && patchMatch) {
      readBody(req)
        .then((body) => {
          const inbox = readJsonFile(inboxPath, { items: [] });
          const item = (inbox.items || []).find((entry) => entry.id === patchMatch[1]);
          if (!item) {
            sendJson(res, 404, { error: 'Inbox item not found' });
            return;
          }

          if (body.status) {
            item.status = body.status;
          }
          if (body.status === 'processed') {
            item.processed_at = new Date().toISOString();
          }
          writeJsonFile(inboxPath, inbox);
          sendJson(res, 200, item);
        })
        .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
      return true;
    }
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
      if (handleApi(req, res, urlPath)) {
        return;
      }
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

startServer();
