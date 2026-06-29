---
name: github-commit
description: Auto-commit at natural checkpoints with conventional commit messages. Gates agent and skill instruction changes behind a required human explanation and changelog entry. Use when a feature reaches working state, tests pass, refactor completes, or scaffold is laid down.
---

# GitHub Commit Skill

Commits happen at natural checkpoints — no prompting for routine work, no silent commits for agent instruction changes.

## When to commit

Commit when any of these is true:

- A feature or function reaches a working state
- Tests pass after a fix (run tests first if the project has them)
- A refactor completes without breaking anything
- A config or scaffold is laid down before real work begins
- A session ends with meaningful uncommitted changes (see stop-hook reminder)

Do **not** commit mid-task on broken or untested code.

## Commit message format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <why — not just what>

<body — optional, 1-3 sentences on rationale>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `build`, `ci`

Describe **why** the change was made, not only what files changed.

### Examples

```
feat(inbox): add API routes so Quick Add persists to git-tracked inbox

Quick Add previously only wrote to localStorage. Inbox items must survive
across sessions and be readable by Cursor agents.
```

```
fix(daily-report): surface project memory blockers in morning digest
```

## Agent and skill changes — non-negotiable

Any commit that modifies **agent instructions, eval specs, skills, or hooks** requires a logged reason before it proceeds.

Protected paths:

- `agents/**`
- `.cursor/skills/**`
- `.cursor/hooks/**`
- `.cursor/hooks.json`

### Required steps for protected changes

1. **Ask the human** (if not already provided): "What changed and why?"
2. **Update the changelog** in the affected agent `.md` or skill `SKILL.md` before committing.
3. **Prefix the commit subject** with `[agent-change]` so the commit gate allows it.
4. **Include the human's explanation** in the commit body verbatim or paraphrased faithfully.

Example:

```
[agent-change] feat(agents): add four-lens validation to idea-creator-validator

Rationale: Inbox items were passing through without structured stress-testing.
Added reach and stress-test lenses per Cortex vision doc.
Changelog: agents/idea-creator-validator.md v0.2
```

The `beforeShellExecution` hook blocks `git commit` on protected paths without `[agent-change]` in the message. Do not bypass with `--no-verify`.

## Push policy

- Push after commit when the branch is ahead of remote and tests pass (if applicable).
- Never force-push to `main` or `master`.
- Never push secrets (`.env`, credentials).

## Workflow at a checkpoint

1. `git status` — review what changed
2. Run tests if the project has them (`npm test` or project-specific command)
3. Stage relevant files only — not unrelated changes
4. Write the commit message (conventional format; `[agent-change]` if protected)
5. `git commit`
6. `git push` when ready

## Session end

If the stop hook reports uncommitted changes, either commit at a checkpoint using this skill or leave a note in project memory explaining why work is intentionally uncommitted.

## Changelog

- **v0.1** — Created. Defines conventional commit workflow; gates commits touching agents, skills, or hooks behind `[agent-change]` subject prefix and changelog entry.
