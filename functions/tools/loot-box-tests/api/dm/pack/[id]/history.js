import { json } from '../../../_shared/http.js';
import { ensurePacksBatchIdColumn } from '../../../_shared/schema.js';

export async function onRequestGet(context) {
  const DB = context.env.LOOT_CHEST_DB;
  if (!DB) return json({ error: 'Database not configured' }, 503);
  await ensurePacksBatchIdColumn(DB);
  const id = context.params.id;
  const url = new URL(context.request.url);
  const dm_key = url.searchParams.get('dm_key');
  if (!id) return json({ error: 'Pack id required' }, 400);
  if (!dm_key || !dm_key.trim()) return json({ error: 'dm_key query is required' }, 400);

  const pack = await DB.prepare(
    'SELECT id, batch_id FROM packs WHERE id = ? AND dm_key = ?'
  ).bind(id, dm_key.trim()).first();
  if (!pack) return json({ error: 'Pack not found' }, 404);

  let rows;
  if (pack.batch_id) {
    rows = await DB.prepare(`
      SELECT po.pack_id, po.mundane, po.reveal, po.opened_at
      FROM pack_opens po
      INNER JOIN packs p ON p.id = po.pack_id
      WHERE p.dm_key = ? AND p.batch_id = ?
      ORDER BY po.opened_at DESC
    `).bind(dm_key.trim(), pack.batch_id).all();
  } else {
    rows = await DB.prepare(
      'SELECT pack_id, mundane, reveal, opened_at FROM pack_opens WHERE pack_id = ? ORDER BY opened_at DESC'
    ).bind(id).all();
  }

  const history = (rows.results || []).map((row) => ({
    pack_id: row.pack_id,
    mundane: typeof row.mundane === 'string' ? JSON.parse(row.mundane) : row.mundane,
    reveal: typeof row.reveal === 'string' ? JSON.parse(row.reveal) : row.reveal,
    opened_at: row.opened_at,
  }));

  return json({ history, batch_id: pack.batch_id ?? null });
}
