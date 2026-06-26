# Cortex
A all in one platform for managing workflows, agents and thoughts

# From Using AI to Having a Team of AI

Most people use AI the same way they use Google — ask a question, get an answer, move on. This project is about something different: replacing repetitive mental overhead with a network of specialised agents that run autonomously, collaborate, and escalate to you only when they genuinely need your input.

The shift isn't from no-AI to AI. It's from *you prompting AI* to *AI working for you*.

---

## What this is

A personal agent ecosystem built around the things I actually do every day — coding, research, planning, and shipping. Each agent has a narrow job and does it well. They share context, hand off to each other, and know when to ask a question rather than guess.

The goal is a setup where I can dump a rough idea, answer a handful of questions, and come back to a working project with tests, documentation, and a commit history that explains every decision.

---

## Agents

### Daily Brief
Pulls together what matters before the day starts — open PRs, research threads, outstanding tasks, anything flagged from the day before. One digest, no hunting.

### Coding Agent
Handles new features and fixes from a description. Scaffolds the project, writes the code, writes the tests, and commits with a proper message. Asks questions up front when the spec is ambiguous rather than building the wrong thing.

### Research Agent  
Given a topic or question, it goes deep — sources, synthesis, contradictions, open questions. Returns something you can actually act on, not a list of links.

### Idea Validator
Takes a rough idea and pressure-tests it. What's the assumption? What breaks it? What already exists? Useful before spending time building something that doesn't hold up.

---

## Skills (reusable across agents)

**Presentation hook** — a consistent way to surface information that's easy to scan. Agents don't dump walls of text; they format output for how you're going to use it.

**Diagram builder** — whenever something needs explaining, it produces a diagram. Architecture, flows, data models, decision trees. Visual first, prose second.

**Commit writer** — every code change gets a meaningful commit message. Conventional format, enough context that future-you understands why, not just what. Commits happen regularly, not in one giant dump at the end.

**Question protocol** — before starting any task where the brief is unclear, the agent asks. One focused question at a time, not a form to fill out. If it can make a reasonable assumption, it says so and proceeds.

**Project memory** — every project keeps a running log of design decisions, architecture choices, and what was tried and rejected. When you come back to something after three weeks, context is there.

**Idea inbox** — paste in a message thread, a voice note transcript, a jumble of notes. The agent structures it into a plan with open questions surfaced for you to answer.

**Test suite scaffolding** — every coding project gets a test suite. Not as an afterthought. Set up before the main code is written.

---

## How flows are managed

Agents don't run in isolation. There's a layer above them that routes work, tracks what's in progress, and handles handoffs — so the research agent can feed into the coding agent without you being the middleman.

One workspace connects to others. Context isn't siloed per session; the right information is available wherever it's needed.

---

## The fully autonomous build flow

The closest thing to the end goal: describe what you want to build, answer a short set of clarifying questions, and step away. The system:

- Structures the idea
- Makes design decisions (documenting each one)
- Scaffolds the project
- Writes the code and tests
- Opens the project in the browser
- Commits at meaningful checkpoints

You intervene when it genuinely needs a decision that only you can make. Not before.

---

## Project structure

```
/agents
  daily-brief/
  coding/
  research/
  validator/

/skills
  presentation/
  diagrams/
  commit-writer/
  question-protocol/
  project-memory/
  idea-inbox/
  test-scaffolding/

/orchestration
  flow-manager/
  workspace-bridge/

/hooks
  start          # opens the relevant workspace and surfaces today's context
```

---

## Principles

**Narrow agents over general ones.** A focused agent that does one thing well is more reliable and easier to improve than one that tries to do everything.

**Questions over assumptions.** When context is missing, ask. One question, clearly framed. Never guess on something that changes the output meaningfully.

**Memory is part of the system.** Decisions don't live in someone's head or buried in a chat history. They're logged, structured, and retrievable.

**Commits are documentation.** The git history should explain the project as well as any README. Regular, meaningful commits over infrequent bulk ones.

**Diagrams are first-class.** If something is complex enough to need explaining, it's complex enough to need a diagram.

---

## Status

Early build. Agents and skills are being developed and connected incrementally. The orchestration layer is the current focus.

---

## Why

Using AI well takes effort — good prompts, the right context, knowing what to ask. That effort compounds if you're doing it dozens of times a day. The point of this project is to front-load that effort into the system once, so the day-to-day overhead drops close to zero.

Less time managing AI. More time on the work that actually needs you.
