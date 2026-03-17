import { json, getBody } from '../_shared/http.js';
import { generateId } from '../_shared/ids.js';

export async function onRequestPost(context) {
  const DB = context.env.DB;
  const body = await getBody(context.request);

  if (!body || typeof body.dm_key !== 'string' || !body.dm_key.trim()) {
    return json({ error: 'dm_key is required' }, 400);
  }
  if (!body.label || typeof body.label !== 'string' || !body.label.trim()) {
    return json({ error: 'label is required' }, 400);
  }
  if (!body.type || !['shared', 'personal'].includes(body.type)) {
    return json({ error: 'type must be shared or personal' }, 400);
  }
  if (body.type === 'personal' && (!body.player_name || typeof body.player_name !== 'string')) {
    return json({ error: 'player_name is required for personal packs' }, 400);
  }

  const quantity = body.quantity != null ? parseInt(body.quantity, 10) : 1;
  if (isNaN(quantity) || quantity < 1 || quantity > 20) {
    return json({ error: 'quantity must be 1-20' }, 400);
  }
  if (!body.slot_config || typeof body.slot_config !== 'object') {
    return json({ error: 'slot_config is required' }, 400);
  }

  const slot_config = body.slot_config;
  const guaranteed_item_id = body.guaranteed_item_id != null ? body.guaranteed_item_id : null;
  const seed = JSON.stringify({ slot_config, guaranteed_item_id });

  let id;
  for (let attempts = 0; attempts < 10; attempts++) {
    id = generateId();
    const existing = await DB.prepare('SELECT 1 FROM packs WHERE id = ?').bind(id).first();
    if (!existing) break;
  }
  if (!id) return json({ error: 'Could not generate unique id' }, 500);

  const slotConfigStr = JSON.stringify(slot_config);
  await DB.prepare(`
    INSERT INTO packs (id, dm_key, label, type, player_name, quantity, slot_config, guaranteed_item_id, seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.dm_key.trim(),
    body.label.trim(),
    body.type,
    body.type === 'personal' ? (body.player_name || '').trim() : null,
    quantity,
    slotConfigStr,
    guaranteed_item_id,
    seed
  ).run();

  const row = await DB.prepare('SELECT created_at FROM packs WHERE id = ?').bind(id).first();

  return json({
    id,
    label: body.label.trim(),
    type: body.type,
    quantity,
    created_at: row?.created_at ?? null,
    pack_url: '/pack/' + id,
  });
}
