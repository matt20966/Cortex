const fs = require('fs');
const path = require('path');

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

function enqueueItem(queuePath, entry) {
  const queue = readJsonFile(queuePath, { items: [] });
  if (!Array.isArray(queue.items)) queue.items = [];
  const item = {
    id: `queue-${Date.now()}`,
    status: 'pending',
    created_at: new Date().toISOString(),
    ...entry
  };
  queue.items.unshift(item);
  writeJsonFile(queuePath, queue);
  return item;
}

module.exports = { readJsonFile, writeJsonFile, enqueueItem };
