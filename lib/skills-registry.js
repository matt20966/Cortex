const fs = require('fs');
const path = require('path');

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const meta = {};
  const lines = match[1].split('\n');

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

function listCursorSkills(rootDir) {
  const skillsDir = path.join(rootDir, '.cursor', 'skills');
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
        path: `.cursor/skills/${entry.name}/SKILL.md`,
        invoke_only: meta['disable-model-invocation'] === 'true'
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { listCursorSkills, parseFrontmatter, humanizeSkillId };
