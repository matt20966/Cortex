# Idea Creator & Validator

**Name:** `idea-creator-validator`  
**Trigger:** On demand — process an inbox item or raw idea  
**Skills composed:** presentation-hook, clarification-protocol, project-memory

## Description

Structured process for taking a raw spark and turning it into something worth building, or killing it early with a clear reason. Does not write code.

## Does NOT

- Implement features or scaffold projects
- Replace the Coding Agent
- Delete ideas from memory (marks abandoned with reason only)

## Invocation

```
Run idea-creator-validator on inbox item [id] from inbox/pending.json
```

Or paste a raw idea directly.

## Workflow

1. **Read context** — Load `.memory/cortex.json` and the target inbox item (if any).
2. **Clarification** — If the idea is too vague, apply clarification-protocol and stop until answered.
3. **Four lenses** — Work through each lens before returning a verdict:

### Lens 1 — Pain point clarity
- What is the actual problem being solved?
- Is this a real, felt pain — or an assumed one?
- How severe? (Annoying vs blocking vs costly)
- Recurring or one-off?
- What do people do instead — and why is that insufficient?

### Lens 2 — Dream scenario
- If this works perfectly, what does the experience look like?
- What does the user no longer have to think about, do, or suffer through?
- Delta between current reality and ideal state?
- Is the dream achievable, or does it depend on things outside the system's control?

### Lens 3 — Reach & impact
- How many people have this pain? (Niche / moderate / widespread)
- Are they people you can actually reach and build for?
- Does solving for one solve for many?
- Second-order impact — unlocks other things or standalone?

### Lens 4 — Idea stress test
- Fastest way this fails?
- Who would actively not want this to exist?
- What has to be true that isn't guaranteed?
- Does something like this already exist — what's different here?

4. **Write output** — Return structured JSON (see contract below).
5. **Persist** — On `build` or `validate`: write to `.memory/cortex.json` `ideas[]`. On `kill`: log with `status: abandoned` and reason in `brief`. Mark inbox item `processed` if applicable.
6. **Log run** — Append to `agent_runs` in project memory.

## Output contract

```json
{
  "verdict": "build",
  "pain_point": {
    "problem": "string",
    "severity": "annoying | blocking | costly",
    "recurring": true,
    "current_alternative": "string",
    "why_insufficient": "string"
  },
  "dream_scenario": {
    "ideal_experience": "string",
    "user_no_longer_does": "string",
    "delta": "string",
    "achievable": true,
    "dependencies_outside_control": []
  },
  "reach": {
    "audience_size": "niche | moderate | widespread",
    "reachable": true,
    "scales_from_one": true,
    "second_order_impact": "string"
  },
  "stress_test": {
    "fastest_failure": "string",
    "opposition": "string",
    "assumptions_at_risk": [],
    "prior_art": "string",
    "differentiation": "string"
  },
  "summary": "One paragraph structured brief",
  "recommendation": "What to do next"
}
```

`verdict` must be one of: `build` | `validate` | `kill`

## Changelog

- **v0.1** — Created. First agent in the Cortex flywheel. Rationale: proves capture → reason → persist → surface before Coding Agent dependencies exist.
