const fs = require('fs');
const os = require('os');
const path = require('path');

function normalizeFrontmatterLines(raw) {
  return raw.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.replace(/\r$/, ''));
}

function parseFrontmatter(raw) {
  const match = raw.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const meta = {};
  const lines = normalizeFrontmatterLines(match[1]);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const keyMatch = line.match(/^([\w-]+):\s*(.*)$/);
    if (!keyMatch) continue;

    const [, key, rest] = keyMatch;
    if (rest === '>-' || rest === '>' || rest === '|') {
      const parts = [];
      while (++i < lines.length && /^\s/.test(lines[i])) {
        const chunk = lines[i].replace(/^\s+/, '').trim();
        if (chunk) parts.push(chunk);
      }
      i--;
      meta[key] = parts.join(' ');
    } else {
      meta[key] = rest.replace(/^["']|["']$/g, '').trim();
    }
  }

  return meta;
}

function humanizeSkillId(id) {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function readSkillsFromDir(skillsDir, scope, pathPrefix) {
  if (!fs.existsSync(skillsDir)) return [];

  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) return null;

      const raw = fs.readFileSync(skillPath, 'utf8');
      const meta = parseFrontmatter(raw);
      const id = meta.name || entry.name;

      return {
        id,
        name: humanizeSkillId(id),
        description: meta.description || '',
        invocation: `Apply the **${id}** skill`,
        path: `${pathPrefix}/${entry.name}/SKILL.md`,
        scope,
        invoke_only: meta['disable-model-invocation'] === 'true'
      };
    })
    .filter(Boolean);
}

function listCursorSkills(rootDir, options = {}) {
  const projectSkills = readSkillsFromDir(
    path.join(rootDir, '.cursor', 'skills'),
    'project',
    '.cursor/skills'
  );

  const userSkillsDir = options.userSkillsDir || path.join(os.homedir(), '.cursor', 'skills');
  const userSkills = readSkillsFromDir(userSkillsDir, 'user', '~/.cursor/skills');

  const byId = new Map();
  for (const skill of userSkills) {
    byId.set(skill.id, skill);
  }
  for (const skill of projectSkills) {
    byId.set(skill.id, skill);
  }

  return Array.from(byId.values()).sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'project' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function writeSkillsRegistry(rootDir) {
  const skills = listCursorSkills(rootDir);
  const outDir = path.join(rootDir, 'skills');
  const outPath = path.join(outDir, 'registry.json');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify({ skills, updated_at: new Date().toISOString() }, null, 2)}\n`, 'utf8');
  return outPath;
}

module.exports = {
  listCursorSkills,
  parseFrontmatter,
  humanizeSkillId,
  writeSkillsRegistry,
  readSkillsFromDir
};
