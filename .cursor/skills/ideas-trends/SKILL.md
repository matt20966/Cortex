---
name: ideas-trends
description: >-
  Proactive horizon scan for ideas, tools, and trends relevant to Matt's active
  projects and interests. Writes research to project memory; queues promising
  sparks to inbox. Use on weekly or monthly schedule, or when asked to scan for trends.
---

# Ideas & Trends Skill

Turns ambient signal into structured research and actionable opportunities — without waiting for a specific question.

## When invoked

- **Weekly scan** — lightweight pass: 3–5 emerging signals, quick relevance check, short summaries
- **Monthly digest** — deeper synthesis: connect dots across the month, rank opportunities, flag what changed since last run
- **On demand** — same workflow when Matt asks to scan trends for a domain or project

## Read first

1. `.memory/cortex.json` or `.memory/project.json` — `project`, `ideas[]`, `decisions[]`, `pain_points[]`, `research[]`, `links[]`
2. Linked project memories when `links[]` is non-empty
3. Recent `agent_runs` for this skill (avoid duplicate coverage)
4. `inbox/pending.json` — pending captures for overlap check

Infer scan scope from memory: active ideas, open pain points, project `for` / `description`, and prior `research[]` tags.

## Weekly vs monthly

| Cadence | Depth | Output |
|---------|-------|--------|
| **Weekly** | Surface-level; news, launches, discourse shifts | 3–5 trend signals; 0–2 opportunities worth capturing |
| **Monthly** | Synthesis across prior weekly runs + new sources | Thematic summary; ranked opportunities; stale-trend callouts |

Default weekly lookback: **7 days**. Default monthly lookback: **30 days**.

## Workflow

1. **Scope** — List 2–4 domains to scan from project context (e.g. AI agents, dev tooling, personal productivity). State assumptions if scope is broad.
2. **Search** — Use web search for each domain. Prefer primary sources, release notes, credible analysis. Skip paywalled or unsourced hype.
3. **Filter** — Keep only signals that plausibly affect Matt's active work. Drop generic AI news unless it changes how Cortex or linked projects should be built.
4. **Dedupe** — Skip trends already in `research[]` with the same thesis unless the signal materially changed.
5. **Write research** — Append to `research[]` (see shape below). Never delete prior research entries.
6. **Queue ideas** — For `suggested_action: validate`, prepend to `inbox/pending.json` with `idea:` prefix when the spark is concrete enough to validate.
7. **Log run** — Append to `agent_runs[]`; update `project.updated_at`.

## Research entry shape

```json
{
  "id": "research-NNN",
  "title": "Short trend or tool name",
  "summary": "2–4 sentences — what changed and why it matters here",
  "source": "https://…",
  "tags": ["agents", "cursor", "weekly"],
  "cadence": "weekly",
  "confidence": "high | medium | low",
  "created_at": "2026-06-30T12:00:00.000Z"
}
```

Increment `research-NNN` from the highest existing id in memory.

## Skill output contract

Return JSON matching the `trends-digest` schema (agent layer). The agent file owns the full contract; this skill supplies the research-writing rules above.

## Rules

- **Source everything** — no unsourced claims in `research[]` or trend bullets.
- **Relevance over volume** — five sharp signals beat twenty vague ones.
- **Do not validate here** — promising sparks go to inbox for `idea-creator-validator`; this skill scans and captures, not four-lens verdicts.
- **Do not implement** — no code changes unless explicitly asked in the same message.
- **Respect lineage** — ideas in memory are never deleted; reference existing `idea-*` ids when a trend relates to an active idea.

## Changelog

- **v0.1** — Created. Weekly/monthly horizon scanning with research persistence and inbox handoff to idea validation.
