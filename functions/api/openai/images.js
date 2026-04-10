/**
 * POST /api/openai/images
 * Proxies to https://api.openai.com/v1/images/generations with the server-side API key.
 * Requires: OPENAI_API_KEY (Pages project secret / env).
 */

const OPENAI_URL = 'https://api.openai.com/v1/images/generations';

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
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
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

  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return new Response(JSON.stringify({ error: 'prompt is required' }), {
      status: 400,
      headers: withCors({ 'Content-Type': 'application/json' }),
    });
  }

  const payload = {
    model: body.model || 'dall-e-3',
    prompt: body.prompt,
    n: 1,
    size: body.size || '1792x1024',
    quality: body.quality || 'standard',
    response_format: 'url',
  };

  const upstream = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: withCors({
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'no-store',
    }),
  });
}

