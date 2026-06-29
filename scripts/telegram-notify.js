#!/usr/bin/env node
/**
 * telegram-notify — optional notification delivery stub.
 * Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable.
 */
const https = require('https');
const { readJsonFile } = require('../lib/store');
const path = require('path');

const memoryPath = path.join(__dirname, '..', '.memory', 'cortex.json');

function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('telegram-notify: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skipped');
    return Promise.resolve(false);
  }

  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const message = process.argv.slice(2).join(' ') ||
    'Cortex notification — no message provided';

  const memory = readJsonFile(memoryPath, null);
  const latestRun = memory?.agent_runs?.[0];
  const text = latestRun
    ? `*${latestRun.agent}*\n${latestRun.summary}${latestRun.action_required ? `\n\nAction: ${latestRun.action_required}` : ''}`
    : message;

  try {
    const sent = await sendTelegram(text);
    console.log(sent ? 'telegram-notify: sent' : 'telegram-notify: not configured');
  } catch (err) {
    console.error('telegram-notify: failed', err.message);
    process.exit(1);
  }
}

main();
