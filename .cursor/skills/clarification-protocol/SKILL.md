---
name: clarification-protocol
description: Batch clarifying questions upfront when blocked on ambiguous input. Returns structured JSON with questions and explicit assumptions. Use before proceeding when critical information is missing.
---

# Clarification Protocol

When an agent cannot proceed without more information, it does not guess or interrupt mid-task.

## Rules

1. Only ask questions that would **materially change** the output.
2. **Batch all questions upfront** — never interrupt mid-task for something that should have been asked at the start.
3. Number each question; keep them short — no preamble.
4. **Max 5 questions.** If more are needed, ask the 5 most critical and state explicit assumptions for the rest.

## When to invoke

- Raw idea is too vague to validate (missing problem, audience, or success criteria).
- Inbox item has no clear intent or project association.
- Task has a genuine fork that cannot be resolved from project memory.

## When NOT to invoke

- Reasonable defaults exist and are low-risk — state assumptions instead.
- Project memory already answers the question.
- The task is well-formed and scoped.

## Output contract

Return JSON only:

```json
{
  "blocked": true,
  "questions": [
    "1. Who is the primary user?",
    "2. What does success look like in one sentence?"
  ],
  "assumptions": [
    "Assuming this targets the Cortex project unless specified otherwise."
  ]
}
```

If not blocked:

```json
{
  "blocked": false,
  "questions": [],
  "assumptions": []
}
```

Wait for answers before continuing. Do not proceed past a blocked state without user input.

## Changelog

- **v0.1** — Created. Batch-question protocol for idea-creator-validator when inbox items or raw ideas lack enough context to validate.
