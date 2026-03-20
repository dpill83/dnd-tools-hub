import { json, getBody } from '../_shared/http.js';
import { generateId } from '../_shared/ids.js';
import { ensurePacksBatchIdColumn } from '../_shared/schema.js';

async function generateUniquePackId(DB) {
  for (let attempts = 0; attempts < 20; attempts++) {
    const id = generateId();
    const existing = await DB.prepare('SELECT 1 FROM packs WHERE id = ?').bind(id).first();
    if (!existing) return id;
  }
  return null;
}

function generateBatchId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const rand = Math.random().toString(16).slice(2, 10);
  return 'batch-' + Date.now().toString(16) + '-' + rand;
}

export async function onRequestPost(context) {
  const DB = context.env.LOOT_CHEST_DB;
  if (!DB) return json({ error: 'Database not configured' }, 503);
  await ensurePacksBatchIdColumn(DB);
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
  const isGambleBatch =
    body.type === 'shared' &&
    slot_config &&
    slot_config.jackpot_open_index != null;
  const slotConfigStr = JSON.stringify(slot_config);

  if (isGambleBatch) {
    const batch_id = generateBatchId();
    const jackpotIndex = Number(slot_config.jackpot_open_index);
    const dmKey = body.dm_key.trim();
    const label = body.label.trim();
    const playerName = body.type === 'personal' ? (body.player_name || '').trim() : null;
    const created = [];

    for (let i = 0; i < quantity; i++) {
      const id = await generateUniquePackId(DB);
      if (!id) return json({ error: 'Could not generate unique id' }, 500);

      const rowGuaranteedId =
        Number.isInteger(jackpotIndex) && jackpotIndex === i ? guaranteed_item_id : null;
      const rowSeed = JSON.stringify({ slot_config, guaranteed_item_id: rowGuaranteedId });

      await DB.prepare(`
        INSERT INTO packs (id, dm_key, batch_id, label, type, player_name, quantity, slot_config, guaranteed_item_id, seed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        dmKey,
        batch_id,
        label,
        body.type,
        playerName,
        1,
        slotConfigStr,
        rowGuaranteedId,
        rowSeed
      ).run();

      created.push({ id, pack_url: '/pack/' + id });
    }

    return json({
      batch_id,
      label: body.label.trim(),
      type: body.type,
      quantity,
      ids: created.map((p) => p.id),
      pack_urls: created.map((p) => p.pack_url),
      packs: created,
    });
  }

  const id = await generateUniquePackId(DB);
  if (!id) return json({ error: 'Could not generate unique id' }, 500);
  const seed = JSON.stringify({ slot_config, guaranteed_item_id });
  await DB.prepare(`
    INSERT INTO packs (id, dm_key, batch_id, label, type, player_name, quantity, slot_config, guaranteed_item_id, seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.dm_key.trim(),
    null,
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
