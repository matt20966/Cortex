# Ideas & Trends Scout

**Name:** `ideas-trends-scout`  
**Trigger:** Schedule — weekly (Monday morning) and monthly (first Monday) — or on demand  
**Skills composed:** ideas-trends, presentation-hook, project-memory

## Description

Proactive horizon agent: scans for emerging ideas, tools, and trends relevant to Matt's active projects and interests. Writes structured research to project memory and queues promising sparks for validation. Complements on-demand `research-synthesiser` (deep dive on a known topic) and `idea-creator-validator` (verdict on a raw idea).

## Does NOT

- Run four-lens idea validation (hands off via inbox)
- Implement features or modify application code
- Replace `pain-points-resolver` (blocker-focused research)
- Present unsourced trends as fact

## Invocation

```
Run ideas-trends-scout weekly scan
```

```
Run ideas-trends-scout monthly digest
```

Optional scope override:

```
Run ideas-trends-scout weekly scan — focus: Cursor agents, MCP tooling
```

## Cadence

| Schedule | Invocation | Lookback | Depth |
|----------|------------|----------|-------|
| Weekly | `weekly scan` | 7 days | 3–5 signals, 0–2 opportunities |
| Monthly | `monthly digest` | 30 days | Thematic synthesis, ranked opportunities, stale-trend review |

Wire to Cursor Automations or `/loop` when scheduling infrastructure is ready. Until then, run on demand or via automation cron.

## Workflow

1. **Read context** — Load project memory and linked projects per ideas-trends skill.
2. **Determine cadence** — Parse invocation for `weekly` vs `monthly`; default to weekly if ambiguous.
3. **Scan** — Web search per scoped domains; apply ideas-trends filter and dedupe rules.
4. **Persist** — Write new `research[]` entries; queue `idea:` inbox items when warranted.
5. **Return digest** — Structured JSON for the presentation layer.
6. **Log run** — Append to `agent_runs` with cadence in summary.

## Data sources

1. `.memory/cortex.json` — ideas, research, decisions, pain_points, agent_runs
2. Linked `.memory/project.json` files via `links[]`
3. `inbox/pending.json` — overlap and pending capture context
4. Web search — releases, discourse, credible analysis (via web MCP)

## Output contract

```json
{
  "cadence": "weekly",
  "period": "2026-W26",
  "headline": "One-line summary of what matters this period",
  "trends": [
    {
      "title": "string",
      "signal": "What changed",
      "relevance": "Why it matters for active projects",
      "confidence": "high | medium | low",
      "source": "https://…"
    }
  ],
  "opportunities": [
    {
      "title": "string",
      "why_now": "string",
      "suggested_action": "validate | capture | ignore",
      "related_idea_id": "idea-002 or null"
    }
  ],
  "stale_watch": [
    { "research_id": "research-001", "note": "Signal unchanged — deprioritise unless new evidence" }
  ],
  "research_written": ["research-003"],
  "ideas_queued": 1,
  "recommendation": "What Matt should do next — one paragraph max"
}
```

`cadence` must be `weekly` or `monthly`. `stale_watch` is required for monthly; omit or use `[]` for weekly.

## Changelog

- **v0.1** — Created. Scheduled horizon scanning for ideas and trends; composes ideas-trends skill with web research and memory persistence.
