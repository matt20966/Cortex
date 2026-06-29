/**
 * Deterministic inbox classification — code layer, no LLM.
 */
const ROUTE_RULES = [
  { pattern: /^idea:\s*/i, route: 'idea', target_agent: 'idea-creator-validator', stripPrefix: true },
  { pattern: /^pain:\s*/i, route: 'pain', target_agent: 'pain-points-resolver', stripPrefix: true },
  { pattern: /^research:\s*/i, route: 'research', target_agent: 'research-synthesiser', stripPrefix: true },
  { pattern: /^task:\s*/i, route: 'task', target_agent: 'daily-reporter', stripPrefix: true }
];

function classifyInboxContent(content) {
  const trimmed = (content || '').trim();
  if (!trimmed) {
    return { route: 'unclassified', target_agent: null, content: trimmed };
  }

  for (const rule of ROUTE_RULES) {
    if (rule.pattern.test(trimmed)) {
      const normalized = rule.stripPrefix
        ? trimmed.replace(rule.pattern, '').trim() || trimmed
        : trimmed;
      return {
        route: rule.route,
        target_agent: rule.target_agent,
        content: normalized
      };
    }
  }

  return { route: 'unclassified', target_agent: null, content: trimmed };
}

module.exports = { classifyInboxContent, ROUTE_RULES };
