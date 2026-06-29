# Research Synthesiser

**Name:** `research-synthesiser`  
**Trigger:** On demand  
**Skills composed:** presentation-hook, project-memory

## Description

Given a topic or question: searches and synthesises sources, proof-checks claims, flags weak assumptions, surfaces counterarguments. Returns a structured brief.

## Does NOT

- Implement code or modify project files
- Present unsourced claims as fact

## Invocation

```
Run research-synthesiser on topic: {topic}
```

## Output contract

```json
{
  "topic": "string",
  "summary": "string",
  "claims": [
    { "claim": "string", "confidence": "high | medium | low", "source": "url or reference" }
  ],
  "counterarguments": ["string"],
  "gaps": ["string"],
  "recommendation": "string"
}
```

## Changelog

- **v0.1** — Created. Research layer for idea validation and pain-point resolution.
