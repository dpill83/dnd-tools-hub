import { json, optionsResponse } from '../_shared/http.js';
import { syncCleanupFromItems } from '../_shared/cleanup.js';
import { getLootTable } from '../_shared/loot-table-store.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost(context) {
  const DB = context.env.LOOT_CHEST_DB;
  const r2 = context.env.LOOT_TABLE_BUCKET;
  if (!DB) return json({ error: 'Database not configured' }, 503);

  try {
    const { data } = await getLootTable(r2);
    const result = await syncCleanupFromItems(DB, data.items);
    return json({ ok: true, ...result });
  } catch (e) {
    const status = e.status || 502;
    return json({ error: String(e.message || e), details: e.errors || undefined }, status);
  }
}
