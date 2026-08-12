import { json, optionsResponse } from '../_shared/http.js';
import { getOverview, syncCleanupFromItems } from '../_shared/cleanup.js';
import { getLootTable } from '../_shared/loot-table-store.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const DB = context.env.LOOT_CHEST_DB;
  const r2 = context.env.LOOT_TABLE_BUCKET;
  if (!DB) return json({ error: 'Database not configured' }, 503);

  try {
    const countRow = await DB.prepare('SELECT COUNT(*) AS n FROM cleanup_buckets').first();
    if (!countRow || Number(countRow.n) === 0) {
      const { data } = await getLootTable(r2);
      await syncCleanupFromItems(DB, data.items);
    }
    const overview = await getOverview(DB);
    return json(overview);
  } catch (e) {
    const msg = String(e?.message || e || '');
    const schemaHint = msg.toLowerCase().includes('no such table')
      ? 'D1 schema missing. Apply schema-loot-chest.sql to LOOT_CHEST_DB.'
      : null;
    return json(
      { error: 'Failed to load overview', details: msg, hint: schemaHint },
      503
    );
  }
}
