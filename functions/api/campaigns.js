/**
 * GET /api/campaigns – list all (id, name), ordered by created_at.
 * POST /api/campaigns – upsert-or-create by name (optional; sessions endpoint can create campaigns).
 * Requires: ADVENTURE_LOG_DB (D1 binding).
 */

import { dbGet, dbAll, dbRun } from './lib/d1.js';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const env = context.env;
  if (!env.ADVENTURE_LOG_DB) {
    return jsonResponse({ error: 'D1 not configured' }, 503);
  }

  const rows = await dbAll(env, 'SELECT id, name, created_at FROM campaigns ORDER BY created_at');
  return jsonResponse(rows);
}

export async function onRequestPost(context) {
  const env = context.env;
  if (!env.ADVENTURE_LOG_DB) {
    return jsonResponse({ error: 'D1 not configured' }, 503);
  }

  let body;
  try {
    body = await context.request.json();
  } catch (_) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return jsonResponse({ error: 'name is required' }, 400);
  }

  let row = await dbGet(env, 'SELECT id, name, created_at FROM campaigns WHERE name = ?', [name]);
  if (row) {
    return jsonResponse(row);
  }

  await dbRun(env, 'INSERT INTO campaigns (name, created_at) VALUES (?, datetime(\'now\'))', [name]);
  row = await dbGet(env, 'SELECT id, name, created_at FROM campaigns WHERE name = ?', [name]);
  return jsonResponse(row, 201);
}
