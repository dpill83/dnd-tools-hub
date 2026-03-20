import { json, getBody } from '../../../_shared/http.js';
import { ensurePacksBatchIdColumn } from '../../../_shared/schema.js';

export async function onRequestPost(context) {
  const DB = context.env.LOOT_CHEST_DB;
  if (!DB) return json({ error: 'Database not configured' }, 503);
  await ensurePacksBatchIdColumn(DB);

  const id = context.params.id;
  if (!id) return json({ error: 'Pack id required' }, 400);

  const body = await getBody(context.request);
  const fromUrl = context.request.url ? new URL(context.request.url).searchParams.get('dm_key') : null;
  const dm_key = (body?.dm_key ?? fromUrl)?.trim();
  if (!dm_key) return json({ error: 'dm_key is required' }, 400);

  const pack = await DB.prepare(
    'SELECT id, batch_id FROM packs WHERE id = ? AND dm_key = ?'
  ).bind(id, dm_key).first();

  if (!pack) return json({ error: 'Pack not found' }, 404);

  if (pack.batch_id) {
    await DB.prepare('DELETE FROM packs WHERE dm_key = ? AND batch_id = ?').bind(dm_key, pack.batch_id).run();
    return json({ ok: true, batch_id: pack.batch_id });
  }

  // pack_opens has ON DELETE CASCADE via packs(id), so we only need to delete the pack row.
  await DB.prepare('DELETE FROM packs WHERE id = ? AND dm_key = ?').bind(id, dm_key).run();
  return json({ ok: true, batch_id: null });
}

