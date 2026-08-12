import { json, optionsResponse } from '../_shared/http.js';
import { encodeBucketId, FLAG_REASONS } from '../_shared/cleanup.js';
import { getLootTable } from '../_shared/loot-table-store.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const DB = context.env.LOOT_CHEST_DB;
  const r2 = context.env.LOOT_TABLE_BUCKET;
  if (!DB) return json({ error: 'Database not configured' }, 503);

  const url = new URL(context.request.url);
  const reason = url.searchParams.get('flag_reason');
  if (reason && !FLAG_REASONS.includes(reason)) {
    return json({ error: `flag_reason must be one of: ${FLAG_REASONS.join(', ')}` }, 400);
  }

  try {
    let query = `
      SELECT i.item_id, i.bucket_key, i.reviewer, i.status, i.flag_reason, i.flag_note,
             i.flagged_at, i.reviewed_at, i.updated_at,
             b.category, b.rarity, b.slug, b.assigned_to
      FROM cleanup_items i
      LEFT JOIN cleanup_buckets b ON b.bucket_key = i.bucket_key
      WHERE i.status = 'flagged'`;
    const binds = [];
    if (reason) {
      query += ' AND i.flag_reason = ?';
      binds.push(reason);
    }
    query += ' ORDER BY i.flagged_at DESC, i.item_id';

    const stmt = DB.prepare(query);
    const rows = binds.length ? await stmt.bind(...binds).all() : await stmt.all();

    let lootById = new Map();
    try {
      const { data } = await getLootTable(r2);
      for (const it of data.items || []) lootById.set(Number(it.id), it);
    } catch {
      /* still return flags without item payload */
    }

    const items = (rows.results || []).map((row) => {
      const loot = lootById.get(Number(row.item_id)) || null;
      return {
        item_id: Number(row.item_id),
        bucket_key: row.bucket_key,
        bucket_id: encodeBucketId(row.bucket_key),
        slug: row.slug,
        category: row.category,
        rarity: row.rarity,
        assigned_to: row.assigned_to,
        reviewer: row.reviewer,
        status: row.status,
        flag_reason: row.flag_reason,
        flag_note: row.flag_note,
        flagged_at: row.flagged_at,
        name: loot?.name ?? null,
        item: loot,
      };
    });

    return json({ items, flag_reasons: FLAG_REASONS });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 502);
  }
}
