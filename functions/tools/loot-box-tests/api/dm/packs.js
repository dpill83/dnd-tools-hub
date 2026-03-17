import { json } from '../_shared/http.js';

export async function onRequestGet(context) {
  const DB = context.env.LOOT_CHEST_DB;
  if (!DB) return json({ error: 'Database not configured' }, 503);
  const url = new URL(context.request.url);
  const dm_key = url.searchParams.get('dm_key');
  if (!dm_key || !dm_key.trim()) return json({ error: 'dm_key query is required' }, 400);

  const rows = await DB.prepare(
    'SELECT id, label, type, player_name, quantity, slot_config, created_at FROM packs WHERE dm_key = ? ORDER BY created_at DESC'
  ).bind(dm_key.trim()).all();

  const packs = (rows.results || []).map((row) => ({
    id: row.id,
    label: row.label,
    type: row.type,
    player_name: row.player_name,
    quantity: row.quantity,
    slot_config: typeof row.slot_config === 'string' ? JSON.parse(row.slot_config) : row.slot_config,
    created_at: row.created_at,
  }));

  return json({ packs });
}
