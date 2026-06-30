const DEFAULT_TIMEOUT_MS = 60_000;

function getConfig() {
  return {
    apiKey: String(process.env.OPENROUTER_API_KEY || '').trim(),
    model: String(process.env.OPENROUTER_MODEL || 'openrouter/free').trim(),
    baseUrl: String(process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').trim().replace(/\/+$/, ''),
    siteUrl: String(process.env.OPENROUTER_SITE_URL || 'http://localhost:3000').trim(),
    appName: String(process.env.OPENROUTER_APP_NAME || 'Cortex').trim()
  };
}

function isConfigured() {
  return Boolean(getConfig().apiKey);
}

function getChatStatus() {
  const { model } = getConfig();
  return {
    configured: isConfigured(),
    model
  };
}

async function chatCompletion({ messages, tools, temperature = 0.7, model } = {}) {
  const config = getConfig();
  if (!config.apiKey) {
    const err = new Error('OPENROUTER_API_KEY is not configured');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const body = {
    model: model || config.model,
    messages,
    temperature
  };
  if (tools && tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
        'HTTP-Referer': config.siteUrl,
        'X-Title': config.appName
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const raw = await response.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const message = data?.error?.message || raw || `OpenRouter error (${response.status})`;
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }

    const choice = data?.choices?.[0];
    if (!choice?.message) {
      throw new Error('Empty response from OpenRouter');
    }

    return {
      message: choice.message,
      model: data?.model || body.model
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  getConfig,
  isConfigured,
  getChatStatus,
  chatCompletion
};
