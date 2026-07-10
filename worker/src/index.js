const ALLOWED_ORIGINS = new Set([
  'https://notesforyou.app',
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:8811',
]);

const RATE_LIMIT_PER_HOUR = 30;
const ANTHROPIC_MODEL = 'claude-haiku-4-5';

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Device-Id',
    'Access-Control-Max-Age': '86400',
  };
}

function buildPrompt(notes) {
  const body = notes.map(n => {
    const lines = (n.lines || []).join('\n');
    const tagPart = n.tags && n.tags.length ? ` (tags: ${n.tags.join(', ')})` : '';
    return `Note "${n.title || 'Untitled'}"${tagPart}:\n${lines}`;
  }).join('\n\n');

  return `You are summarizing a personal notes app for the user's dashboard. Notes can mix plain text with checklist items (marked "[ ] "). Checklist items shown here are still active/pending — anything checked off has already been removed from the data. Notes may have tags.

NOTES:
${body || '(no notes yet)'}

Write a short, plain, useful summary (4-8 lines max) of what's still active/pending, grouped by tag where it makes sense. Plain text only — no markdown of any kind (no **bold**, no # headers, no bullet dashes, no asterisks). No fluff. If there's nothing, say so briefly.`;
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '');
}

async function checkRateLimit(env, deviceId) {
  if (!deviceId) return false;
  const bucket = Math.floor(Date.now() / 3_600_000); // current hour
  const key = `rl:${deviceId}:${bucket}`;
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || '0', 10);
  if (current >= RATE_LIMIT_PER_HOUR) return false;
  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 3600 });
  return true;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/summarize' || request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers });
    }

    const deviceId = request.headers.get('X-Device-Id');
    const withinLimit = await checkRateLimit(env, deviceId);
    if (!withinLimit) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const notes = Array.isArray(payload.notes) ? payload.notes : [];
    const prompt = buildPrompt(notes);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return new Response(JSON.stringify({ error: 'Upstream API error' }), {
          status: 502,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      const rawSummary = (data.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
      const summary = stripMarkdown(rawSummary);

      return new Response(JSON.stringify({ summary: summary || '' }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Could not reach upstream API' }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
  },
};
