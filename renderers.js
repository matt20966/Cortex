/**
 * Browser-side renderers for agent JSON output contracts.
 */
const CortexRenderers = {
  'idea-validation'(data) {
    const verdictClass = data.verdict === 'build' ? 'success' : data.verdict === 'kill' ? 'danger' : 'warning';
    let html = `<div class="agent-output-card idea-validation">
      <div class="agent-output-header">
        <span class="verdict-badge ${verdictClass}">${data.verdict}</span>
      </div>
      <p class="agent-output-summary">${escapeHtml(data.summary || '')}</p>`;

    if (data.pain_point?.problem) {
      html += `<div class="output-section"><strong>Pain point</strong><p>${escapeHtml(data.pain_point.problem)}</p></div>`;
    }
    if (data.dream_scenario?.ideal_experience) {
      html += `<div class="output-section"><strong>Dream scenario</strong><p>${escapeHtml(data.dream_scenario.ideal_experience)}</p></div>`;
    }
    if (data.recommendation) {
      html += `<div class="output-section"><strong>Next step</strong><p>${escapeHtml(data.recommendation)}</p></div>`;
    }
    html += '</div>';
    return html;
  },

  'daily-digest'(data) {
    let html = `<div class="agent-output-card daily-digest">
      <p class="digest-focus"><strong>Focus:</strong> ${escapeHtml(data.focus || '')}</p>`;

    if (data.priorities?.length) {
      html += '<div class="output-section"><strong>Priorities</strong><ul>';
      data.priorities.forEach((p) => {
        html += `<li><strong>${escapeHtml(p.item)}</strong> — ${escapeHtml(p.reason)}</li>`;
      });
      html += '</ul></div>';
    }

    if (data.blockers?.length) {
      html += '<div class="output-section"><strong>Blockers</strong><ul>';
      data.blockers.forEach((b) => {
        html += `<li>[${escapeHtml(b.id)}] ${escapeHtml(b.description)}</li>`;
      });
      html += '</ul></div>';
    }

    if (data.overnight_activity) {
      html += `<p class="text-muted">${escapeHtml(data.overnight_activity)}</p>`;
    }
    html += '</div>';
    return html;
  },

  'clarification-blocked'(data) {
    let html = `<div class="agent-output-card clarification-blocked">
      <p><strong>Blocked — ${data.questions.length} question(s) need answers:</strong></p><ol>`;
    data.questions.forEach((q) => {
      html += `<li>${escapeHtml(q.question)}</li>`;
    });
    html += '</ol>';
    if (data.assumptions?.length) {
      html += '<p class="text-muted"><strong>Assumptions:</strong> ' +
        data.assumptions.map(escapeHtml).join('; ') + '</p>';
    }
    html += '</div>';
    return html;
  },

  render(schemaType, data) {
    const fn = this[schemaType];
    if (!fn) {
      return `<pre class="agent-output-raw">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    }
    return fn(data);
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (typeof window !== 'undefined') {
  window.CortexRenderers = CortexRenderers;
}
