import { json, optionsResponse } from '../../../_shared/http.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const DB = context.env.LOOT_CHEST_DB;
  if (!DB) return json({ error: 'Database not configured' }, 503);

  const itemId = Number(context.params?.id);
  if (!Number.isInteger(itemId) || itemId < 0) {
    return json({ error: 'Invalid item id' }, 400);
  }

  try {
    const rows = await DB.prepare(
      `SELECT id, item_id, reviewer, field, old_value, new_value, note, created_at
       FROM cleanup_changes
       WHERE item_id = ?
       ORDER BY created_at ASC, id ASC`
    )
      .bind(itemId)
      .all();

    return json({
      item_id: itemId,
      changes: rows.results || [],
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 502);
  }
}
