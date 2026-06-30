#!/usr/bin/env node
/**
 * sync-skills-registry — export .cursor/skills (+ user skills) to skills/registry.json
 * so the Cortex UI can load skills without the live API.
 */
const path = require('path');
const { writeSkillsRegistry } = require('../lib/skills-registry');

const rootDir = path.join(__dirname, '..');
const outPath = writeSkillsRegistry(rootDir);
console.log(`Wrote ${outPath}`);
