---
name: pain-points
description: Track and research open project blockers. Pull pain points from memory, return fix briefs per hurdle. Use on schedule or when resolving blockers.
---

# Pain Points & Hurdles Skill

## When invoked

1. Read `.memory/project.json` or `.memory/cortex.json` `pain_points[]` where status is `open` or `in_progress`
2. Read project context: stack, decisions, what's been tried
3. For each open hurdle, return a brief: root cause, recommended fix, prior art

## Writing rules

- New pain points: status `open`, timestamped `created_at`
- On resolve: set `status: resolved`, `resolution`, `resolved_at`
- Never delete pain point entries

## Output contract

```json
{
  "pain_point_id": "pain-001",
  "root_cause": "string",
  "recommended_fix": "string",
  "prior_art": "string",
  "confidence": "high | medium | low"
}
```

## Changelog

- **v0.1** — Created. Active hurdle research per Cortex vision.
