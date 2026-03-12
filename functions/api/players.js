/**
 * GET /api/players?q=... – autocomplete (case-insensitive LIKE, limit 20).
 * GET /api/players?all=true&page=1&page_size=50 – paginated list for Manage Players modal.
 * POST /api/players – body { name }; trim, unique; 409 if duplicate.
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

  const url = new URL(context.request.url);
  const all = url.searchParams.get('all') === 'true';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('page_size') || '50', 10)));
  const q = (url.searchParams.get('q') || '').trim();

  if (all) {
    const offset = (page - 1) * pageSize;
    const countResult = await dbGet(env, 'SELECT COUNT(*) as n FROM players');
    const total = (countResult && countResult.n != null) ? countResult.n : 0;
    const items = await dbAll(
      env,
      'SELECT id, name, created_at FROM players ORDER BY LOWER(name) LIMIT ? OFFSET ?',
      [pageSize, offset]
    );
    return jsonResponse({ items, page, page_size: pageSize, total });
  }

  if (!q) {
    const items = await dbAll(env, 'SELECT id, name FROM players ORDER BY created_at DESC LIMIT 20');
    return jsonResponse(items);
  }

  const pattern = '%' + q.toLowerCase() + '%';
  const items = await dbAll(
    env,
    'SELECT id, name FROM players WHERE LOWER(name) LIKE ? ORDER BY LOWER(name) LIMIT 20',
    [pattern]
  );
  return jsonResponse(items);
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

  const existing = await dbGet(env, 'SELECT id FROM players WHERE LOWER(TRIM(name)) = LOWER(?)', [name]);
  if (existing) {
    return jsonResponse({ error: 'Player with this name already exists' }, 409);
  }

  await dbRun(env, 'INSERT INTO players (name, created_at) VALUES (?, datetime(\'now\'))', [name]);
  const row = await dbGet(env, 'SELECT id, name, created_at FROM players WHERE name = ?', [name]);
  return jsonResponse(row, 201);
}
