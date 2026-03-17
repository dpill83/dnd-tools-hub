import { json } from '../../../_shared/http.js';

export async function onRequestGet(context) {
  const DB = context.env.LOOT_CHEST_DB;
  if (!DB) return json({ error: 'Database not configured' }, 503);
  const id = context.params.id;
  const url = new URL(context.request.url);
  const dm_key = url.searchParams.get('dm_key');
  if (!id) return json({ error: 'Pack id required' }, 400);
  if (!dm_key || !dm_key.trim()) return json({ error: 'dm_key query is required' }, 400);

  const row = await DB.prepare(
    'SELECT id, dm_key, label, type, player_name, quantity, slot_config, guaranteed_item_id, seed, created_at FROM packs WHERE id = ? AND dm_key = ?'
  ).bind(id, dm_key.trim()).first();

  if (!row) return json({ error: 'Pack not found' }, 404);

  return json({
    id: row.id,
    dm_key: row.dm_key,
    label: row.label,
    type: row.type,
    player_name: row.player_name,
    quantity: row.quantity,
    slot_config: typeof row.slot_config === 'string' ? JSON.parse(row.slot_config) : row.slot_config,
    guaranteed_item_id: row.guaranteed_item_id,
    seed: row.seed,
    created_at: row.created_at,
  });
}
