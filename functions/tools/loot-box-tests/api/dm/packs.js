import { json } from '../_shared/http.js';
import { ensurePacksBatchIdColumn } from '../_shared/schema.js';

export async function onRequestGet(context) {
  const DB = context.env.LOOT_CHEST_DB;
  if (!DB) return json({ error: 'Database not configured' }, 503);
  await ensurePacksBatchIdColumn(DB);
  const url = new URL(context.request.url);
  const dm_key = url.searchParams.get('dm_key');
  if (!dm_key || !dm_key.trim()) return json({ error: 'dm_key query is required' }, 400);

  let rows;
  try {
    rows = await DB.prepare(
      'SELECT id, batch_id, label, type, player_name, quantity, opens_used, slot_config, guaranteed_item_id, created_at FROM packs WHERE dm_key = ? ORDER BY created_at DESC'
    ).bind(dm_key.trim()).all();
  } catch (e) {
    const msg = String(e?.message || e || '');
    const schemaHint = msg.toLowerCase().includes('no such table')
      ? 'D1 schema missing. Apply schema-loot-chest.sql to LOOT_CHEST_DB.'
      : null;
    return json({ error: 'Database query failed', details: msg, hint: schemaHint }, 503);
  }

  const packs = (rows.results || []).map((row) => {
    const slotConfig =
      typeof row.slot_config === 'string' ? JSON.parse(row.slot_config) : row.slot_config;

    const opensUsed = Number(row.opens_used ?? 0);
    const rawJackpotIndex = slotConfig?.jackpot_open_index;
    const jackpotIndex =
      rawJackpotIndex != null && !Number.isNaN(Number(rawJackpotIndex)) ? Number(rawJackpotIndex) : null;

    const isBatchRow = row.batch_id != null && row.batch_id !== '';
    // New gamble batch rows have quantity=1 each and only one row carries guaranteed_item_id.
    // Legacy gamble rows still use jackpot_open_index against opens_used.
    const jackpot_opened = isBatchRow
      ? row.guaranteed_item_id != null && opensUsed > 0
      : (jackpotIndex != null ? opensUsed > jackpotIndex : false);

    return {
      id: row.id,
      batch_id: row.batch_id,
      label: row.label,
      type: row.type,
      player_name: row.player_name,
      quantity: row.quantity,
      opens_used: row.opens_used,
      slot_config: slotConfig,
      guaranteed_item_id: row.guaranteed_item_id,
      created_at: row.created_at,
      jackpot_opened,
    };
  });

  return json({ packs });
}
