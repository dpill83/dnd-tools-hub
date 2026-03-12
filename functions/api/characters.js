/**
 * GET /api/characters?player_id=1 – list characters for one player.
 * GET /api/characters?player_ids=1,2,3 – batched: characters for all listed player IDs (for Manage Players modal).
 * POST /api/characters – body { player_id, name }; enforce UNIQUE(player_id, name).
 * Requires: ADVENTURE_LOG_DB (D1 binding).
 */

import { dbGet, dbAll, dbRun } from './lib/d1.js';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parsePlayerIds(param) {
  if (!param || typeof param !== 'string') return [];
  return param
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export async function onRequestGet(context) {
  const env = context.env;
  if (!env.ADVENTURE_LOG_DB) {
    return jsonResponse({ error: 'D1 not configured' }, 503);
  }

  const url = new URL(context.request.url);
  const playerId = url.searchParams.get('player_id');
  const playerIdsParam = url.searchParams.get('player_ids');
  const playerIds = parsePlayerIds(playerIdsParam);

  if (playerIds.length > 0) {
    const placeholders = playerIds.map(() => '?').join(',');
    const rows = await dbAll(
      env,
      `SELECT id, player_id, name, created_at FROM characters WHERE player_id IN (${placeholders}) ORDER BY player_id, LOWER(name)`,
      playerIds
    );
    const byPlayer = {};
    playerIds.forEach((id) => { byPlayer[id] = []; });
    rows.forEach((r) => {
      if (!byPlayer[r.player_id]) byPlayer[r.player_id] = [];
      byPlayer[r.player_id].push({ id: r.id, name: r.name });
    });
    return jsonResponse(
      playerIds.map((pid) => ({ player_id: pid, characters: byPlayer[pid] || [] }))
    );
  }

  const singleId = playerId != null ? parseInt(playerId, 10) : NaN;
  if (!Number.isInteger(singleId) || singleId < 1) {
    return jsonResponse({ error: 'player_id or player_ids is required' }, 400);
  }

  const items = await dbAll(
    env,
    'SELECT id, name, created_at FROM characters WHERE player_id = ? ORDER BY LOWER(name)',
    [singleId]
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

  const playerId = body.player_id != null ? parseInt(body.player_id, 10) : NaN;
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  if (!Number.isInteger(playerId) || playerId < 1) {
    return jsonResponse({ error: 'player_id is required' }, 400);
  }
  if (!name) {
    return jsonResponse({ error: 'name is required' }, 400);
  }

  const player = await dbGet(env, 'SELECT id FROM players WHERE id = ?', [playerId]);
  if (!player) {
    return jsonResponse({ error: 'Player not found' }, 404);
  }

  const existing = await dbGet(env, 'SELECT id FROM characters WHERE player_id = ? AND LOWER(TRIM(name)) = LOWER(?)', [playerId, name]);
  if (existing) {
    return jsonResponse({ error: 'Character with this name already exists for this player' }, 409);
  }

  await dbRun(env, 'INSERT INTO characters (player_id, name, created_at) VALUES (?, ?, datetime(\'now\'))', [playerId, name]);
  const row = await dbGet(env, 'SELECT id, player_id, name, created_at FROM characters WHERE player_id = ? AND name = ?', [playerId, name]);
  return jsonResponse(row, 201);
}
