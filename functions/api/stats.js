/**
 * GET /api/stats – optional ?campaign_id= or ?uncampaigned=true.
 * Returns { players: [{ id, name, sessions_played, sessions_dm, total_xp, total_gold }], sessions: [{ id, date, campaign_id, campaign_name, participants: [...] }] }.
 * participants: { player_id, player_name, character_id, character_name, role }.
 * Requires: ADVENTURE_LOG_DB.
 */

import { dbAll } from './lib/d1.js';

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
  const campaignIdParam = url.searchParams.get('campaign_id');
  const uncampaigned = url.searchParams.get('uncampaigned') === 'true';

  let sessionFilter = '';
  const params = [];
  if (uncampaigned) {
    sessionFilter = ' WHERE s.campaign_id IS NULL';
  } else if (campaignIdParam) {
    const cid = parseInt(campaignIdParam, 10);
    if (!Number.isInteger(cid) || cid < 1) {
      return jsonResponse({ error: 'Invalid campaign_id' }, 400);
    }
    sessionFilter = ' WHERE s.campaign_id = ?';
    params.push(cid);
  }

  const sessionsSql = `
    SELECT s.id, s.date, s.campaign_id, c.name as campaign_name
    FROM sessions s
    LEFT JOIN campaigns c ON c.id = s.campaign_id
    ${sessionFilter}
    ORDER BY s.date
  `;
  const sessionRows = await dbAll(env, sessionsSql, params);

  const sessionIds = sessionRows.map((s) => s.id);
  let participantRows = [];
  if (sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => '?').join(',');
    participantRows = await dbAll(
      env,
      `SELECT sp.session_id, sp.player_id, p.name as player_name, sp.character_id, ch.name as character_name, sp.role
       FROM session_players sp
       JOIN players p ON p.id = sp.player_id
       LEFT JOIN characters ch ON ch.id = sp.character_id
       WHERE sp.session_id IN (${placeholders})`,
      sessionIds
    );
  }

  const participantsBySession = {};
  sessionIds.forEach((id) => { participantsBySession[id] = []; });
  participantRows.forEach((row) => {
    participantsBySession[row.session_id].push({
      player_id: row.player_id,
      player_name: row.player_name,
      character_id: row.character_id,
      character_name: row.character_name,
      role: row.role,
    });
  });

  const sessions = sessionRows.map((s) => ({
    id: s.id,
    date: s.date,
    campaign_id: s.campaign_id,
    campaign_name: s.campaign_name || null,
    participants: participantsBySession[s.id] || [],
  }));

  const playerIds = [...new Set(participantRows.map((r) => r.player_id))];
  if (playerIds.length === 0) {
    return jsonResponse({ players: [], sessions });
  }

  let sessionFilterClause = '';
  let filterParams = [];
  if (uncampaigned) {
    sessionFilterClause = ' AND s.campaign_id IS NULL';
  } else if (campaignIdParam) {
    sessionFilterClause = ' AND s.campaign_id = ?';
    filterParams = [parseInt(campaignIdParam, 10)];
  }

  const playedRows = await dbAll(
    env,
    `SELECT sp.player_id, COUNT(*) as cnt
     FROM session_players sp
     JOIN sessions s ON s.id = sp.session_id
     WHERE sp.role != 'DM' ${sessionFilterClause}
     GROUP BY sp.player_id`,
    filterParams
  );
  const dmRows = await dbAll(
    env,
    `SELECT sp.player_id, COUNT(*) as cnt
     FROM session_players sp
     JOIN sessions s ON s.id = sp.session_id
     WHERE sp.role = 'DM' ${sessionFilterClause}
     GROUP BY sp.player_id`,
    filterParams
  );
  const rewardRows = await dbAll(
    env,
    `SELECT r.player_id, SUM(r.xp) as total_xp, SUM(r.gold) as total_gold
     FROM rewards r
     JOIN sessions s ON s.id = r.session_id
     WHERE 1=1 ${sessionFilterClause}
     GROUP BY r.player_id`,
    filterParams
  );

  const playerRows = await dbAll(
    env,
    `SELECT id, name FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})`,
    playerIds
  );

  const playedMap = {};
  playedRows.forEach((r) => { playedMap[r.player_id] = r.cnt; });
  const dmMap = {};
  dmRows.forEach((r) => { dmMap[r.player_id] = r.cnt; });
  const rewardMap = {};
  rewardRows.forEach((r) => {
    rewardMap[r.player_id] = { xp: r.total_xp || 0, gold: r.total_gold || 0 };
  });

  const players = playerRows.map((p) => ({
    id: p.id,
    name: p.name,
    sessions_played: playedMap[p.id] || 0,
    sessions_dm: dmMap[p.id] || 0,
    total_xp: (rewardMap[p.id] && rewardMap[p.id].xp) || 0,
    total_gold: (rewardMap[p.id] && rewardMap[p.id].gold) || 0,
  }));

  return jsonResponse({ players, sessions });
}
