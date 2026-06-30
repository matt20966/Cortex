---
name: daily-compact
description: >-
  Compacts and organises daily brain dumps — daily notes, tasks, and inbox captures.
  Removes or archives stale completed and overdue tasks. Use when the user invokes
  daily compact, asks to compact their brain dump, tidy daily notes, or prune old tasks.
disable-model-invocation: true
---

# Daily Compact

End-of-day hygiene: turn unstructured captures into organised state, then drop noise so tomorrow starts clean.

## When invoked

User says something like: **daily compact**, **compact my brain dump**, **tidy today's notes**, **prune old tasks**.

Also run when the user pastes a raw brain dump and asks you to compact it — merge pasted text with existing sources below.

## Read first

1. `.memory/dashboard.json` — `dailyNotes`, `tasks[]`
2. `inbox/pending.json` — `items[]` where `status === "pending"`
3. `.memory/cortex.json` or `.memory/project.json` — active ideas and open pain points (context only; do not duplicate into notes)
4. User paste in chat, if any

Use [project-memory](project-memory/SKILL.md) rules when promoting content into memory (ideas never deleted; pain points never deleted).

## Workflow

```
Task progress:
- [ ] 1. Ingest all sources
- [ ] 2. Extract and classify
- [ ] 3. Organise and write back
- [ ] 4. Prune stale tasks and old notes
- [ ] 5. Present compact summary
```

### 1. Ingest

Collect every unstructured line from:

- `dailyNotes` for today and the last 7 calendar days (keys are `YYYY-MM-DD`)
- Pending inbox items
- User paste (if provided)

### 2. Extract and classify

For each distinct thought, assign **one** bucket:

| Bucket | Criteria | Destination |
|--------|----------|-------------|
| **Task** | Clear action with an owner (Matt) | `dashboard.tasks[]` — dedupe by similar title |
| **Capture** | Idea, pain, research, or ambiguous note | `inbox/pending.json` with route prefix (`idea:`, `pain:`, `research:`, `task:`) per `lib/router.js` |
| **Reference** | Fact, link, or context worth keeping | Today's `dailyNotes[today]` as a short bullet |
| **Noise** | Duplicates, done-and-forgotten, empty fragments | Drop (log in summary only) |

Merge duplicates across notes, inbox, and tasks. Prefer the clearest wording.

### 3. Organise and write back

**Today's notes** — Replace rambling `dailyNotes[today]` with a compact structure:

```markdown
## Focus
- [1–3 priorities for tomorrow]

## Captured
- [Bullets for reference-only items]

## Routed
- [What went to tasks or inbox, with ids]
```

**Tasks** — Create or update tasks with: `id`, `title`, `description`, `projectId`, `dueDate`, `priority`, `status`. Default new tasks to `status: "pending"`.

**Inbox** — New captures via `inbox/pending.json` (prepend). Mark source inbox items `processed` when absorbed into tasks or notes.

Set `updated_at` on every file you write. Validate dashboard against `schemas/dashboard.json`.

### 4. Prune stale items

Apply unless the user overrides in the same message:

| Target | Rule | Action |
|--------|------|--------|
| Completed tasks | `status === "completed"` and completed or due **> 14 days** ago | **Remove** from `tasks[]` |
| Stale pending tasks | `status !== "completed"`, due date **> 30 days** ago | **Remove** (note in summary — user can recreate if still wanted) |
| Old daily notes | Date key **> 7 days** before today | **Roll up** into `dailyNotes.compacted` as one line per day (`YYYY-MM-DD: first 120 chars…`), then **delete** the day key |
| Processed inbox | `status === "processed"` and **> 14 days** old | **Remove** from `items[]` |

Never delete ideas or pain points from project memory. For automated agent-run compression, suggest `npm run compact` (weekly script) — that is separate from this skill.

### 5. Present summary

Lead with the answer. Use this shape:

```markdown
## Daily compact — {date}

### Tomorrow's focus
1. …

### Organised
- **Tasks:** N created, M updated
- **Inbox:** N routed, M processed
- **Notes:** today's dump → compact sections

### Pruned
- X completed tasks (>14d)
- Y stale pending tasks (>30d overdue)
- Z day-keys rolled into compacted

### Still open
- [Top 3–5 items needing a decision or agent run]
```

Append to `.memory/cortex.json` `agent_runs[]`:

```json
{
  "agent": "daily-compact",
  "summary": "Compacted notes; +2 tasks; pruned 5 stale",
  "status": "success",
  "action_required": null,
  "created_at": "<ISO8601>"
}
```

Update `project.updated_at` when touching cortex memory.

## Rules

- **Dedupe aggressively** — same intent in notes, inbox, and tasks counts once.
- **Don't invent tasks** — only create tasks from explicit or clearly implied actions.
- **Ask at most one question** — only if pruning would remove something ambiguous and high-stakes; otherwise state the assumption and proceed.
- **Preserve lineage** — if a pruned task title matters, include it in the summary's Pruned section.

## Changelog

- **v0.1** — Created. Daily brain-dump compaction for dashboard notes, tasks, and inbox with stale-item pruning.
