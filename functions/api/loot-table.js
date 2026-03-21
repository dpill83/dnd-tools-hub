/**
 * GET/PUT /api/loot-table — single global loot table in R2 (key loot-table.json).
 * No authentication; PUT validates JSON shape only.
 */

import { validateAndNormalizeLootTable } from './lib/loot-table-validate.js';

const R2_KEY = 'loot-table.json';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(headers = {}) {
  return { ...CORS, ...headers };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: withCors({ 'Content-Type': 'application/json' }),
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCors() });
}

export async function onRequestGet(context) {
  const bucket = context.env.LOOT_TABLE_BUCKET;
  if (!bucket) {
    return json({ error: 'R2 bucket LOOT_TABLE_BUCKET is not configured' }, 503);
  }

  try {
    const obj = await bucket.get(R2_KEY);
    if (!obj) {
      return json({ error: 'loot-table.json not found in R2; seed the bucket' }, 404);
    }
    const text = await obj.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: 'Stored loot table is not valid JSON' }, 502);
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
      return json(
        { error: 'Stored loot table has invalid shape (expected at least { items: [] })' },
        502
      );
    }
    return json(parsed);
  } catch (e) {
    const msg = String(e?.message || e || 'read failed');
    return json({ error: 'Failed to read loot table from R2', details: msg }, 502);
  }
}

export async function onRequestPut(context) {
  const bucket = context.env.LOOT_TABLE_BUCKET;
  if (!bucket) {
    return json({ error: 'R2 bucket LOOT_TABLE_BUCKET is not configured' }, 503);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const result = validateAndNormalizeLootTable(body);
  if (!result.ok) {
    return json({ error: 'Validation failed', errors: result.errors }, 400);
  }

  const payload = JSON.stringify(result.data);
  try {
    await bucket.put(R2_KEY, payload, {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch (e) {
    const msg = String(e?.message || e || 'write failed');
    return json({ error: 'Failed to write loot table to R2', details: msg }, 502);
  }

  return json({ ok: true, itemCount: result.data.items.length });
}
