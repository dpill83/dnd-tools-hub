import { json, getBody } from '../../_shared/http.js';
import { rollItems } from '../../_shared/roller.js';

export async function onRequestPost(context) {
  const DB = context.env.DB;
  const id = context.params.id;
  if (!id) return json({ error: 'Pack id required' }, 400);

  const pack = await DB.prepare(
    'SELECT id, quantity, slot_config, guaranteed_item_id, seed FROM packs WHERE id = ?'
  ).bind(id).first();

  if (!pack) return json({ error: 'Pack not found' }, 404);
  const quantity = pack.quantity ?? 1;
  if (quantity < 1) return json({ error: 'Pack has no openings left' }, 400);

  const slot_config = typeof pack.slot_config === 'string' ? JSON.parse(pack.slot_config) : pack.slot_config;
  const { mundane, reveal } = rollItems(slot_config, pack.guaranteed_item_id ?? undefined);

  await DB.prepare('UPDATE packs SET quantity = quantity - 1 WHERE id = ?').bind(id).run();
  await DB.prepare(
    'INSERT INTO pack_opens (pack_id, mundane, reveal, opened_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ).bind(id, JSON.stringify(mundane), JSON.stringify(reveal)).run();

  return json({ mundane, reveal });
}
