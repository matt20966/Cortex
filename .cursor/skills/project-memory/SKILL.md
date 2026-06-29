---
name: project-memory
description: Read and write git-tracked project memory at .memory/project.json. Use before acting on any Cortex project and after meaningful changes (ideas, decisions, pain points, research).
---

# Project Memory

Every project has structured memory at `PROJECT_ROOT/.memory/project.json` (or `.memory/cortex.json` for the Cortex repo itself). Read it before acting; write back after meaningful work.

## Before acting

1. Read `.memory/project.json` in the current project root (fallback: `.memory/cortex.json` if building Cortex itself).
2. If the project has `links`, read linked project memories for relevant context.
3. Use only entries relevant to the current task — do not dump the entire file into output.

## Writing rules

- **Ideas are never deleted.** Mark `replaced` or `abandoned` with a `supersedes` pointer to preserve lineage.
- **Every entry is timestamped** with ISO 8601 `created_at`.
- **Pain points** use status: `open` | `in_progress` | `resolved`. Populate `resolution` and `resolved_at` when resolved.
- **Decisions** include rationale and alternatives considered.
- Update `project.updated_at` on every write.

## Idea entry shape

```json
{
  "id": "idea-NNN",
  "content": "The idea or thought",
  "supersedes": null,
  "superseded_by": null,
  "status": "active",
  "verdict": "build",
  "brief": {},
  "created_at": "2026-06-29T12:00:00.000Z"
}
```

## Agent run log

Append to `agent_runs` when completing agent work:

```json
{
  "agent": "idea-creator-validator",
  "summary": "One-line description of what was done",
  "status": "success",
  "action_required": null,
  "created_at": "2026-06-29T12:00:00.000Z"
}
```

## Schema

Validate against `schemas/project-memory.json` when writing. Strict reject on schema failure — log the error, do not write partial data.

## Changelog

- **v0.1** — Created. Read/write contract for git-tracked project memory so agents share ideas, pain points, and run history across sessions.
