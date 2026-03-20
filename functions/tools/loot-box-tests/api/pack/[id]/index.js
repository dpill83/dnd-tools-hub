import { json } from '../../_shared/http.js';
import { getOpensByPackId } from '../../_shared/pack-opens.js';

export async function onRequestGet(context) {
  const DB = context.env.LOOT_CHEST_DB;
  if (!DB) return json({ error: 'Database not configured' }, 503);
  const id = context.params.id;
  if (!id) return json({ error: 'Pack id required' }, 400);

  const row = await DB.prepare(
    'SELECT id, label, type, player_name, quantity, slot_config, created_at FROM packs WHERE id = ?'
  ).bind(id).first();

  if (!row) return json({ error: 'Pack not found' }, 404);

  const quantity = Number(row.quantity ?? 0);
  const opens = quantity < 1 ? await getOpensByPackId(DB, id) : undefined;

  return json({
    id: row.id,
    label: row.label,
    type: row.type,
    player_name: row.player_name,
    quantity: row.quantity,
    slot_config: typeof row.slot_config === 'string' ? JSON.parse(row.slot_config) : row.slot_config,
    created_at: row.created_at,
    ...(opens !== undefined ? { opens } : {}),
  });
}
