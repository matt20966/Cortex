const { isConfigured, chatCompletion: defaultChatCompletion } = require('./openrouter');
const {
  getToolsForMode,
  executeTool,
  buildContextSnapshot,
  WRITE_TOOL_NAMES
} = require('./cortex-tools');

const MAX_TOOL_ROUNDS = 3;

function buildSystemPrompt(mode, snapshot) {
  const base = [
    'You are Cortex, a personal productivity assistant for Matt.',
    'Cortex stores: tasks/projects (dashboard), ideas/research/decisions/blockers (project memory), inbox captures, and daily notes.',
    snapshot
  ];

  if (mode === 'capture') {
    base.push(
      'The user is capturing information. Pick the best destination:',
      '- Actionable work → add_task',
      '- New concept → add_idea',
      '- Blocker → add_pain_point',
      '- Research finding → add_research',
      '- Architectural choice → add_decision',
      '- Ambiguous note → capture_to_inbox',
      'Also call append_daily_note with a short log line when capturing (unless the input is clearly only a question).',
      'You may call multiple tools in one turn when appropriate.',
      'After tools run, reply with one brief confirmation sentence for the user.'
    );
  } else {
    base.push(
      'The user is asking a question. Use read tools to fetch current data before answering.',
      'Answer clearly and concisely in plain text. Do not invent data — only use tool results and the snapshot.'
    );
  }

  return base.join('\n');
}

function normalizeHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((item) => {
      const role = item?.role === 'assistant' ? 'assistant' : 'user';
      const content = String(item?.content || '').trim();
      return content ? { role, content } : null;
    })
    .filter(Boolean)
    .slice(-12);
}

function parseToolArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function runAssistant({ mode, message, messages, dbBundle, chatCompletion = defaultChatCompletion }) {
  const text = String(message || '').trim();
  if (!text) {
    return { fallback: true, error: 'message is required' };
  }

  if (!isConfigured()) {
    return { fallback: true, reason: 'not_configured' };
  }

  const validMode = mode === 'question' ? 'question' : 'capture';
  const { db, paths } = dbBundle;
  const ctx = { db, paths };
  const tools = getToolsForMode(validMode);
  const temperature = validMode === 'capture' ? 0.3 : 0.7;
  const snapshot = buildContextSnapshot(db);

  const chatMessages = [
    { role: 'system', content: buildSystemPrompt(validMode, snapshot) },
    ...normalizeHistory(messages),
    { role: 'user', content: text }
  ];

  const actions = [];
  const refresh = new Set();

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const { message: assistantMessage } = await chatCompletion({
        messages: chatMessages,
        tools,
        temperature
      });

      const toolCalls = assistantMessage.tool_calls;
      if (!toolCalls || !toolCalls.length) {
        const reply = String(assistantMessage.content || '').trim();
        if (!reply && validMode === 'capture' && actions.length) {
          const summary = actions.map((a) => a.summary).join('; ');
          return {
            text: summary || 'Saved.',
            actions,
            refresh: [...refresh],
            provider: 'openrouter'
          };
        }
        if (!reply) {
          return { fallback: true, reason: 'empty_response' };
        }
        return {
          text: reply,
          actions,
          refresh: [...refresh],
          provider: 'openrouter'
        };
      }

      chatMessages.push({
        role: 'assistant',
        content: assistantMessage.content || null,
        tool_calls: toolCalls
      });

      for (const call of toolCalls) {
        const fnName = call.function?.name;
        const fnArgs = parseToolArgs(call.function?.arguments);
        let result;
        try {
          result = executeTool(ctx, fnName, fnArgs);
          if (result.summary && WRITE_TOOL_NAMES.has(fnName)) {
            actions.push({ tool: fnName, summary: result.summary });
          }
          if (result.refresh) {
            for (const r of result.refresh) refresh.add(r);
          }
        } catch (err) {
          result = { ok: false, error: err.message };
        }

        chatMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result)
        });
      }
    }

    return { fallback: true, reason: 'max_tool_rounds' };
  } catch (err) {
    if (err.code === 'NOT_CONFIGURED') {
      return { fallback: true, reason: 'not_configured' };
    }
    console.warn('Assistant error:', err.message);
    return { fallback: true, reason: 'error', error: err.message };
  }
}

module.exports = {
  runAssistant,
  buildSystemPrompt,
  MAX_TOOL_ROUNDS
};
