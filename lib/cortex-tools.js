const { classifyInboxContent } = require('./router');
const { validate } = require('./validate');
const {
  getDashboard,
  saveDashboard,
  getInbox,
  addInboxItem,
  addQueueItem,
  getProjectMemory,
  saveProjectMemory
} = require('./db');

const READ_TOOL_NAMES = new Set([
  'get_tasks',
  'get_projects',
  'get_inbox',
  'get_ideas',
  'get_pain_points',
  'get_decisions',
  'get_research',
  'get_daily_notes'
]);

const WRITE_TOOL_NAMES = new Set([
  'add_task',
  'add_idea',
  'add_pain_point',
  'add_research',
  'add_decision',
  'capture_to_inbox',
  'append_daily_note'
]);

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function nowIso() {
  return new Date().toISOString();
}

function pushInboxToQueue(inboxItem, db, paths) {
  if (!inboxItem.target_agent) return null;
  const item = {
    id: `queue-${Date.now()}`,
    inbox_id: inboxItem.id,
    target_agent: inboxItem.target_agent,
    route: inboxItem.route,
    content: inboxItem.content,
    status: 'pending',
    created_at: nowIso(),
    processed_at: null
  };
  return addQueueItem(db, item, paths);
}

function createInboxItem(content) {
  const classified = classifyInboxContent(content);
  return {
    id: `inbox-${Date.now()}`,
    content: classified.content,
    status: 'pending',
    route: classified.route,
    target_agent: classified.target_agent,
    created_at: nowIso(),
    processed_at: null
  };
}

function saveMemoryPatch(db, paths, patchFn) {
  const memory = getProjectMemory(db);
  if (!memory) throw new Error('Project memory not found');
  patchFn(memory);
  const result = validate('project-memory', memory);
  if (!result.valid) {
    throw new Error(`Memory validation failed: ${result.errors?.[0]?.message || 'invalid'}`);
  }
  saveProjectMemory(db, memory, paths);
  return memory;
}

const READ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_tasks',
      description: 'List tasks. Use for questions about todos, overdue work, or priorities.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['open', 'completed', 'all'], description: 'Filter by status (default open)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_projects',
      description: 'List projects.',
      parameters: {
        type: 'object',
        properties: {
          active_only: { type: 'boolean', description: 'Only active projects' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_inbox',
      description: 'List pending inbox captures.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_ideas',
      description: 'List active ideas from project memory.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pain_points',
      description: 'List open blockers and pain points.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_decisions',
      description: 'List recorded project decisions.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_research',
      description: 'List research entries from project memory.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_daily_notes',
      description: 'Read daily notes for today and yesterday.',
      parameters: { type: 'object', properties: {} }
    }
  }
];

const WRITE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: 'Create a new task when the user wants actionable work tracked.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Optional details' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          due_date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
          project_id: { type: 'string', description: 'Optional project id' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_idea',
      description: 'Save a new idea to project memory and queue for validation.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Idea text' }
        },
        required: ['content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_pain_point',
      description: 'Record a blocker or pain point.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'What is blocking progress' }
        },
        required: ['description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_research',
      description: 'Save a research note or finding.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          source: { type: 'string' }
        },
        required: ['title', 'summary']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_decision',
      description: 'Record an architectural or product decision.',
      parameters: {
        type: 'object',
        properties: {
          decision: { type: 'string' },
          rationale: { type: 'string' }
        },
        required: ['decision', 'rationale']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'capture_to_inbox',
      description: 'Generic capture when no more specific destination fits. Also logs to daily notes if append_daily_note is not called separately.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string' }
        },
        required: ['content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'append_daily_note',
      description: 'Append a timestamped line to today\'s daily notes journal.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' }
        },
        required: ['text']
      }
    }
  }
];

function getToolsForMode(mode) {
  if (mode === 'question') return READ_TOOLS;
  return [...WRITE_TOOLS, ...READ_TOOLS];
}

function executeTool(ctx, name, args) {
  const { db, paths } = ctx;
  const refresh = new Set();

  switch (name) {
    case 'get_tasks': {
      const dashboard = getDashboard(db);
      const filter = args.status || 'open';
      let tasks = dashboard.tasks || [];
      if (filter === 'open') tasks = tasks.filter((t) => t.status !== 'completed');
      else if (filter === 'completed') tasks = tasks.filter((t) => t.status === 'completed');
      return { ok: true, data: { tasks, count: tasks.length } };
    }

    case 'get_projects': {
      const dashboard = getDashboard(db);
      let projects = dashboard.projects || [];
      if (args.active_only) projects = projects.filter((p) => p.status === 'active');
      return { ok: true, data: { projects, count: projects.length } };
    }

    case 'get_inbox': {
      const inbox = getInbox(db);
      const pending = (inbox.items || []).filter((i) => i.status === 'pending');
      return { ok: true, data: { items: pending, count: pending.length } };
    }

    case 'get_ideas': {
      const memory = getProjectMemory(db);
      const ideas = (memory?.ideas || []).filter((i) => i.status !== 'replaced' && i.status !== 'abandoned');
      return { ok: true, data: { ideas, count: ideas.length } };
    }

    case 'get_pain_points': {
      const memory = getProjectMemory(db);
      const painPoints = (memory?.pain_points || []).filter((p) => p.status !== 'resolved');
      return { ok: true, data: { pain_points: painPoints, count: painPoints.length } };
    }

    case 'get_decisions': {
      const memory = getProjectMemory(db);
      return { ok: true, data: { decisions: memory?.decisions || [] } };
    }

    case 'get_research': {
      const memory = getProjectMemory(db);
      return { ok: true, data: { research: memory?.research || [] } };
    }

    case 'get_daily_notes': {
      const dashboard = getDashboard(db);
      const today = todayStr();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().split('T')[0];
      return {
        ok: true,
        data: {
          today: dashboard.dailyNotes?.[today] || '',
          yesterday: dashboard.dailyNotes?.[yesterdayKey] || ''
        }
      };
    }

    case 'add_task': {
      const title = String(args.title || '').trim();
      if (!title) throw new Error('title is required');
      const dashboard = getDashboard(db);
      const task = {
        id: `task-${Date.now()}`,
        title,
        description: String(args.description || '').trim(),
        projectId: args.project_id || null,
        dueDate: args.due_date || null,
        priority: args.priority || 'medium',
        status: 'todo'
      };
      dashboard.tasks = [task, ...(dashboard.tasks || [])];
      saveDashboard(db, dashboard, { paths });
      refresh.add('dashboard');
      return {
        ok: true,
        summary: `Added task: ${title}`,
        data: { task },
        refresh: [...refresh]
      };
    }

    case 'add_idea': {
      const content = String(args.content || '').trim();
      if (!content) throw new Error('content is required');
      const idea = {
        id: `idea-${Date.now()}`,
        content,
        status: 'active',
        supersedes: null,
        superseded_by: null,
        created_at: nowIso()
      };
      saveMemoryPatch(db, paths, (memory) => {
        memory.ideas = [...(memory.ideas || []), idea];
      });
      refresh.add('memory');

      const inboxItem = createInboxItem(`idea: ${content}`);
      addInboxItem(db, inboxItem, paths);
      const queueItem = pushInboxToQueue(inboxItem, db, paths);
      refresh.add('inbox');
      if (queueItem) refresh.add('queue');

      return {
        ok: true,
        summary: `Saved idea: ${content.slice(0, 80)}`,
        data: { idea, inbox_id: inboxItem.id },
        refresh: [...refresh]
      };
    }

    case 'add_pain_point': {
      const description = String(args.description || '').trim();
      if (!description) throw new Error('description is required');
      const pain = {
        id: `pain-${Date.now()}`,
        description,
        status: 'open',
        created_at: nowIso()
      };
      saveMemoryPatch(db, paths, (memory) => {
        memory.pain_points = [...(memory.pain_points || []), pain];
      });
      refresh.add('memory');

      const inboxItem = createInboxItem(`pain: ${description}`);
      addInboxItem(db, inboxItem, paths);
      const queueItem = pushInboxToQueue(inboxItem, db, paths);
      refresh.add('inbox');
      if (queueItem) refresh.add('queue');

      return {
        ok: true,
        summary: `Recorded blocker: ${description.slice(0, 80)}`,
        data: { pain_point: pain },
        refresh: [...refresh]
      };
    }

    case 'add_research': {
      const title = String(args.title || '').trim();
      const summary = String(args.summary || '').trim();
      if (!title || !summary) throw new Error('title and summary are required');
      const entry = {
        id: `research-${Date.now()}`,
        title,
        summary,
        source: String(args.source || '').trim() || undefined,
        created_at: nowIso()
      };
      saveMemoryPatch(db, paths, (memory) => {
        memory.research = [...(memory.research || []), entry];
      });
      refresh.add('memory');

      const inboxItem = createInboxItem(`research: ${title} — ${summary}`);
      addInboxItem(db, inboxItem, paths);
      pushInboxToQueue(inboxItem, db, paths);
      refresh.add('inbox');
      refresh.add('queue');

      return {
        ok: true,
        summary: `Saved research: ${title}`,
        data: { research: entry },
        refresh: [...refresh]
      };
    }

    case 'add_decision': {
      const decision = String(args.decision || '').trim();
      const rationale = String(args.rationale || '').trim();
      if (!decision || !rationale) throw new Error('decision and rationale are required');
      const entry = {
        id: `dec-${Date.now()}`,
        decision,
        rationale,
        created_at: nowIso()
      };
      saveMemoryPatch(db, paths, (memory) => {
        memory.decisions = [...(memory.decisions || []), entry];
      });
      refresh.add('memory');
      return {
        ok: true,
        summary: `Recorded decision: ${decision.slice(0, 80)}`,
        data: { decision: entry },
        refresh: [...refresh]
      };
    }

    case 'capture_to_inbox': {
      const content = String(args.content || '').trim();
      if (!content) throw new Error('content is required');
      const inboxItem = createInboxItem(content);
      addInboxItem(db, inboxItem, paths);
      const queueItem = pushInboxToQueue(inboxItem, db, paths);
      refresh.add('inbox');
      if (queueItem) refresh.add('queue');
      return {
        ok: true,
        summary: `Captured to inbox: ${content.slice(0, 80)}`,
        data: { inbox_id: inboxItem.id, route: inboxItem.route },
        refresh: [...refresh]
      };
    }

    case 'append_daily_note': {
      const text = String(args.text || '').trim();
      if (!text) throw new Error('text is required');
      const dashboard = getDashboard(db);
      const date = todayStr();
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const entry = `[${timeStr}] ${text}`;
      const existing = dashboard.dailyNotes?.[date] || '';
      dashboard.dailyNotes = { ...dashboard.dailyNotes, [date]: existing ? `${existing}\n${entry}` : entry };
      saveDashboard(db, dashboard, { paths });
      refresh.add('dashboard');
      return {
        ok: true,
        summary: 'Logged to today\'s notes',
        data: { date },
        refresh: [...refresh]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function buildContextSnapshot(db) {
  const dashboard = getDashboard(db);
  const inbox = getInbox(db);
  const memory = getProjectMemory(db);
  const openTasks = (dashboard.tasks || []).filter((t) => t.status !== 'completed').length;
  const pendingInbox = (inbox.items || []).filter((i) => i.status === 'pending').length;
  const openPain = (memory?.pain_points || []).filter((p) => p.status !== 'resolved').length;
  const activeIdeas = (memory?.ideas || []).filter((i) => i.status !== 'replaced' && i.status !== 'abandoned').length;
  return `Snapshot: ${openTasks} open tasks, ${(dashboard.projects || []).length} projects, ${pendingInbox} inbox pending, ${openPain} blockers, ${activeIdeas} active ideas. Today: ${todayStr()}.`;
}

module.exports = {
  READ_TOOLS,
  WRITE_TOOLS,
  READ_TOOL_NAMES,
  WRITE_TOOL_NAMES,
  getToolsForMode,
  executeTool,
  buildContextSnapshot
};
