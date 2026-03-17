import { json } from '../../../_shared/http.js';

export async function onRequestGet(context) {
  const DB = context.env.LOOT_CHEST_DB;
  if (!DB) return json({ error: 'Database not configured' }, 503);
  const id = context.params.id;
  const url = new URL(context.request.url);
  const dm_key = url.searchParams.get('dm_key');
  if (!id) return json({ error: 'Pack id required' }, 400);
  if (!dm_key || !dm_key.trim()) return json({ error: 'dm_key query is required' }, 400);

  const pack = await DB.prepare('SELECT id FROM packs WHERE id = ? AND dm_key = ?').bind(id, dm_key.trim()).first();
  if (!pack) return json({ error: 'Pack not found' }, 404);

  const rows = await DB.prepare(
    'SELECT pack_id, mundane, reveal, opened_at FROM pack_opens WHERE pack_id = ? ORDER BY opened_at DESC'
  ).bind(id).all();

  const history = (rows.results || []).map((row) => ({
    pack_id: row.pack_id,
    mundane: typeof row.mundane === 'string' ? JSON.parse(row.mundane) : row.mundane,
    reveal: typeof row.reveal === 'string' ? JSON.parse(row.reveal) : row.reveal,
    opened_at: row.opened_at,
  }));

  return json({ history });
}
