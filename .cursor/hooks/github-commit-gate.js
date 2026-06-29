#!/usr/bin/env node
/**
 * beforeShellExecution — gates git commit when agent/skill/hook files are
 * staged without the [agent-change] marker and explanation (github-commit skill).
 */
const { execSync } = require('child_process');

const PROTECTED_PATTERNS = [
  /^agents\//,
  /^\.cursor\/skills\//,
  /^\.cursor\/hooks\//,
  /^\.cursor\/hooks\.json$/
];

const AGENT_CHANGE_MARKER = '[agent-change]';

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function isProtectedFile(filePath) {
  return PROTECTED_PATTERNS.some((pattern) => pattern.test(filePath));
}

function extractCommitMessage(command) {
  const mFlag = command.match(/-m\s+["']([^"']+)["']/);
  if (mFlag) return mFlag[1];
  const mBare = command.match(/-m\s+(\S+)/);
  if (mBare) return mBare[1];
  return '';
}

function allow() {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
  process.exit(0);
}

function ask(userMessage, agentMessage) {
  process.stdout.write(JSON.stringify({
    permission: 'ask',
    user_message: userMessage,
    agent_message: agentMessage
  }));
  process.exit(0);
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    let hookInput = {};
    try {
      hookInput = input ? JSON.parse(input) : {};
    } catch {
      allow();
      return;
    }

    const command = hookInput.command || '';
    if (!/\bgit\s+commit\b/.test(command)) {
      allow();
      return;
    }

    const staged = getStagedFiles();
    const protectedFiles = staged.filter(isProtectedFile);

    if (protectedFiles.length === 0) {
      allow();
      return;
    }

    const message = extractCommitMessage(command);
    if (message.includes(AGENT_CHANGE_MARKER)) {
      allow();
      return;
    }

    ask(
      `This commit modifies agent instructions or skills (${protectedFiles.join(', ')}). What changed and why? The agent must add [agent-change] to the commit subject and update the relevant changelog before committing.`,
      `Per the github-commit skill: protected paths (${protectedFiles.join(', ')}) require [agent-change] in the commit message, a changelog entry, and the human's explanation in the commit body. Update the changelog, then recommit with -m "[agent-change] type(scope): summary".`
    );
  });
}

main();
