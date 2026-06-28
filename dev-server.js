const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);
const watchedFiles = ['index.html', 'styles.css', 'app.js'];

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
let watchers = [];

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
    const requestPath = req.url === '/' ? '/index.html' : req.url;
    const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^\/+/, '');
    const filePath = path.join(rootDir, safePath);

    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        if (req.url === '/') {
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
      console.error(`Port ${port} is already in use. Stopping this instance.`);
      server.close(() => process.exit(1));
      return;
    }

    console.error('Server error:', err);
    process.exit(1);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }

    server.close(() => {
      server = null;
      resolve();
    });
  });
}

async function restartServer() {
  console.log('Restarting site because a watched file changed...');
  await stopServer();
  startServer();
}

function watchFiles() {
  watchedFiles.forEach((fileName) => {
    const absolutePath = path.join(rootDir, fileName);
    if (!fs.existsSync(absolutePath)) {
      return;
    }

    const watcher = fs.watch(absolutePath, () => {
      restartServer();
    });
    watchers.push(watcher);
  });
}

process.on('SIGINT', async () => {
  console.log('Stopping dev server...');
  for (const watcher of watchers) {
    watcher.close();
  }
  await stopServer();
  process.exit(0);
});

startServer();
watchFiles();
