---
name: agent-directory
description: Audit agent registry for overlap; gate new agent creation. Maintenance mode reports duplicates; creation mode recommends extend vs new vs skill extraction.
---

# Agent Directory Skill

## Maintenance mode

Audit `agents/` and `agents/registry.json`:

1. **Overlap candidates** — agents with similar scope; recommend merge, skill extract, or clarify boundary
2. **Skill extraction** — instruction blocks duplicated across agents
3. **Naming audit** — inconsistent or ambiguous agent names

Output structured report; no instruction changes without `[agent-change]` commit.

## Creation mode (gate before new agents)

1. Read all agents in `agents/` and skills in `.cursor/skills/`
2. Find closest existing agents
3. Recommend: **new agent** | **extend existing** | **new skill only** | **combine agents**
4. If new agent: compose from existing skills, init changelog v0.1

## Changelog

- **v0.1** — Created. Keeps agent registry legible as Cortex grows.
