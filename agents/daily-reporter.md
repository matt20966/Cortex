# Daily Reporter

**Name:** `daily-reporter`  
**Trigger:** Morning schedule (future) or on demand  
**Skills composed:** presentation-hook, project-memory

## Description

Produces a short, skimmable morning digest — not a wall of text. Synthesises tasks, inbox, project memory, and blockers into a recommended focus for the day.

## Does NOT

- Modify tasks or memory directly (read-only synthesis)
- Send notifications (Telegram integration deferred)

## Invocation

```
Run daily-reporter for today's digest
```

## Data sources

1. `localStorage` task state (via user context or project brief)
2. `.memory/cortex.json` — new ideas since yesterday, open pain_points, recent agent_runs
3. `inbox/pending.json` — pending item count and summaries

## Output contract

```json
{
  "date": "2026-06-29",
  "focus": "One-line recommended focus for today",
  "priorities": [
    { "item": "string", "reason": "string" }
  ],
  "blockers": [
    { "id": "pain-001", "description": "string" }
  ],
  "inbox_pending": 2,
  "new_ideas": [
    { "id": "idea-002", "content": "string", "verdict": "validate" }
  ],
  "overnight_activity": "Summary of agent runs since yesterday or 'none'"
}
```

## Changelog

- **v0.1** — Created. Phase 2b of flywheel — agent synthesis layer on top of code-rendered Daily Report view.
