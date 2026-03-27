/**
 * POST /api/anthropic/messages
 * Proxies to https://api.anthropic.com/v1/messages with the server-side API key.
 * Body: same JSON as Anthropic Messages API (model, max_tokens, system, messages, …).
 * Requires: ANTHROPIC_API_KEY (Pages project secret / env).
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(headers = {}) {
  return { ...CORS, ...headers };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCors() });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 503,
      headers: withCors({ 'Content-Type': 'application/json' }),
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: withCors({ 'Content-Type': 'application/json' }),
    });
  }

  if (!body || typeof body !== 'object') {
    return new Response(JSON.stringify({ error: 'Body must be a JSON object' }), {
      status: 400,
      headers: withCors({ 'Content-Type': 'application/json' }),
    });
  }

  const upstream = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: withCors({
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
    }),
  });
}
