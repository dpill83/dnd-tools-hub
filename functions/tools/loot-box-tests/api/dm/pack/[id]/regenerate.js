import { json, getBody } from '../../../_shared/http.js';

export async function onRequestPost(context) {
  const DB = context.env.DB;
  const id = context.params.id;
  const body = await getBody(context.request);
  if (!id) return json({ error: 'Pack id required' }, 400);

  const dm_key = (body?.dm_key ?? context.request.url && new URL(context.request.url).searchParams.get('dm_key'))?.trim();
  if (!dm_key) return json({ error: 'dm_key is required' }, 400);

  const pack = await DB.prepare(
    'SELECT id, dm_key, slot_config, guaranteed_item_id FROM packs WHERE id = ? AND dm_key = ?'
  ).bind(id, dm_key).first();

  if (!pack) return json({ error: 'Pack not found' }, 404);

  const slot_config = typeof pack.slot_config === 'string' ? JSON.parse(pack.slot_config) : pack.slot_config;
  const guaranteed_item_id = pack.guaranteed_item_id ?? null;
  const seed = JSON.stringify({ slot_config, guaranteed_item_id });

  await DB.prepare('UPDATE packs SET seed = ?, quantity = quantity + 1 WHERE id = ?').bind(seed, id).run();

  const row = await DB.prepare('SELECT quantity, seed FROM packs WHERE id = ?').bind(id).first();
  return json({ id, quantity: row?.quantity ?? null, seed: row?.seed ?? null });
}
