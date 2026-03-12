/**
 * POST /api/sessions – single atomic request: create session, session_players, and rewards.
 * Body: campaign_name, adventure, date, dm_player_name?, attendees: [{ player_name, character_name, role }], rewards: [{ player_name, xp, gold, notes }].
 * campaign_name empty -> campaign_id NULL. Reward player_name matched case-insensitive trimmed; unmatched -> warnings[].
 * Requires: ADVENTURE_LOG_DB. Use result.meta.last_row_id from session INSERT for session_id.
 */

import { dbGet, dbAll, dbRun } from './lib/d1.js';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalize(name) {
  return (name == null ? '' : String(name)).trim().toLowerCase();
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

  const campaignName = typeof body.campaign_name === 'string' ? body.campaign_name.trim() : '';
  const adventure = typeof body.adventure === 'string' ? body.adventure.trim() || null : null;
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  const dmPlayerName = typeof body.dm_player_name === 'string' ? body.dm_player_name.trim() : '';
  const attendees = Array.isArray(body.attendees) ? body.attendees : [];
  const rewards = Array.isArray(body.rewards) ? body.rewards : [];

  if (!date) {
    return jsonResponse({ error: 'date is required' }, 400);
  }

  let campaignId = null;
  if (campaignName) {
    let campaign = await dbGet(env, 'SELECT id FROM campaigns WHERE name = ?', [campaignName]);
    if (!campaign) {
      await dbRun(env, 'INSERT INTO campaigns (name, created_at) VALUES (?, datetime(\'now\'))', [campaignName]);
      campaign = await dbGet(env, 'SELECT id FROM campaigns WHERE name = ?', [campaignName]);
    }
    if (campaign) campaignId = campaign.id;
  }

  const nameToPlayerId = {};
  const nameToCharacterId = {};
  let dmPlayerId = null;

  for (const a of attendees) {
    const playerName = (a.player_name != null ? String(a.player_name) : '').trim();
    const characterName = (a.character_name != null ? String(a.character_name) : '').trim();
    const role = (a.role != null ? String(a.role) : 'PLAYER').trim().toUpperCase() || 'PLAYER';

    if (!playerName) continue;

    let player = await dbGet(env, 'SELECT id FROM players WHERE LOWER(TRIM(name)) = ?', [playerName.toLowerCase()]);
    if (!player) {
      await dbRun(env, 'INSERT INTO players (name, created_at) VALUES (?, datetime(\'now\'))', [playerName]);
      player = await dbGet(env, 'SELECT id FROM players WHERE name = ?', [playerName]);
    }
    if (!player) continue;

    const pid = player.id;
    nameToPlayerId[normalize(playerName)] = pid;
    if (role === 'DM') dmPlayerId = pid;

    let characterId = null;
    if (characterName) {
      let char = await dbGet(env, 'SELECT id FROM characters WHERE player_id = ? AND LOWER(TRIM(name)) = ?', [pid, characterName.toLowerCase()]);
      if (!char) {
        await dbRun(env, 'INSERT INTO characters (player_id, name, created_at) VALUES (?, ?, datetime(\'now\'))', [pid, characterName]);
        char = await dbGet(env, 'SELECT id FROM characters WHERE player_id = ? AND name = ?', [pid, characterName]);
      }
      if (char) characterId = char.id;
    }

    nameToCharacterId[pid + ':' + normalize(characterName)] = characterId;
  }

  if (dmPlayerName && !dmPlayerId) {
    const n = normalize(dmPlayerName);
    if (nameToPlayerId[n] != null) dmPlayerId = nameToPlayerId[n];
    else {
      let player = await dbGet(env, 'SELECT id FROM players WHERE LOWER(TRIM(name)) = ?', [dmPlayerName.toLowerCase()]);
      if (player) dmPlayerId = player.id;
    }
  }

  const runResult = await dbRun(
    env,
    'INSERT INTO sessions (campaign_id, adventure, date, dm_player_id, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
    [campaignId, adventure, date, dmPlayerId]
  );
  const sessionId = runResult.meta && runResult.meta.last_row_id != null
    ? runResult.meta.last_row_id
    : null;

  if (sessionId == null) {
    return jsonResponse({ error: 'Failed to create session' }, 500);
  }

  const spStatements = [];
  for (const a of attendees) {
    const playerName = (a.player_name != null ? String(a.player_name) : '').trim();
    const characterName = (a.character_name != null ? String(a.character_name) : '').trim();
    const role = (a.role != null ? String(a.role) : 'PLAYER').trim().toUpperCase() || 'PLAYER';
    if (!playerName) continue;
    const pid = nameToPlayerId[normalize(playerName)];
    if (pid == null) continue;
    const characterId = nameToCharacterId[pid + ':' + normalize(characterName)] ?? null;
    spStatements.push(
      env.ADVENTURE_LOG_DB.prepare(
        'INSERT INTO session_players (session_id, player_id, character_id, role) VALUES (?, ?, ?, ?)'
      ).bind(sessionId, pid, characterId, role)
    );
  }

  if (spStatements.length > 0) {
    await env.ADVENTURE_LOG_DB.batch(spStatements);
  }

  const warnings = [];
  for (const r of rewards) {
    const playerName = (r.player_name != null ? String(r.player_name) : '').trim();
    const pid = nameToPlayerId[normalize(playerName)];
    if (pid == null) {
      warnings.push("Reward for unknown player '" + playerName + "' was not saved (no matching attendee name).");
      continue;
    }
    const xp = Number(r.xp);
    const gold = Number(r.gold);
    const notes = typeof r.notes === 'string' ? r.notes.trim() || null : null;
    await dbRun(
      env,
      'INSERT INTO rewards (session_id, player_id, xp, gold, notes) VALUES (?, ?, ?, ?, ?)',
      [sessionId, pid, Number.isFinite(xp) ? Math.round(xp) : 0, Number.isFinite(gold) ? Math.round(gold) : 0, notes]
    );
  }

  return jsonResponse({ session_id: sessionId, warnings: warnings.length ? warnings : undefined });
}
