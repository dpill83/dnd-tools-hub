import { json, getBody } from '../../_shared/http.js';
import { rollItems } from '../../_shared/roller.js';
import { getOpensByPackId } from '../../_shared/pack-opens.js';
import { ensurePacksBatchIdColumn } from '../../_shared/schema.js';

export async function onRequestPost(context) {
  const DB = context.env.LOOT_CHEST_DB;
  if (!DB) return json({ error: 'Database not configured' }, 503);
  await ensurePacksBatchIdColumn(DB);
  const id = context.params.id;
  if (!id) return json({ error: 'Pack id required' }, 400);

  const pack = await DB.prepare(
    'SELECT id, batch_id, label, quantity, opens_used, slot_config, guaranteed_item_id, seed FROM packs WHERE id = ?'
  ).bind(id).first();

  if (!pack) return json({ error: 'Pack not found' }, 404);
  const quantity = pack.quantity ?? 1;
  if (quantity < 1) {
    const opens = await getOpensByPackId(DB, id);
    return json({ label: pack.label ?? null, opens }, 410);
  }

  const slot_config = typeof pack.slot_config === 'string' ? JSON.parse(pack.slot_config) : pack.slot_config;
  const opens_used = Number(pack.opens_used ?? 0);
  const isBatchRow = pack.batch_id != null && pack.batch_id !== '';
  // Batch: guaranteed_item_id on this row is the source of truth (set at create on a random chest).
  // Non-batch: jackpot_open_index still means "Nth open of this same pack".
  const rawJackpotIndex = slot_config && slot_config.jackpot_open_index !== undefined && slot_config.jackpot_open_index !== null
    ? Number(slot_config.jackpot_open_index)
    : null;
  const jackpotOpenIndex = typeof rawJackpotIndex === 'number' && !Number.isNaN(rawJackpotIndex) ? rawJackpotIndex : null;
  const useJackpot = pack.guaranteed_item_id != null && (
    isBatchRow
      ? opens_used === 0
      : (jackpotOpenIndex !== null ? opens_used === jackpotOpenIndex : opens_used === 0)
  );
  const effectiveGuaranteedId = useJackpot ? (pack.guaranteed_item_id ?? undefined) : undefined;
  const { mundane, reveal } = await rollItems(context.env, slot_config, effectiveGuaranteedId);

  await DB.prepare(
    'UPDATE packs SET quantity = quantity - 1, opens_used = opens_used + 1 WHERE id = ?'
  ).bind(id).run();
  await DB.prepare(
    'INSERT INTO pack_opens (pack_id, mundane, reveal, opened_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ).bind(id, JSON.stringify(mundane), JSON.stringify(reveal)).run();

  return json({ mundane, reveal });
}
