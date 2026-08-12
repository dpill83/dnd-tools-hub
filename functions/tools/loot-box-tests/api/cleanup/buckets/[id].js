import { json, getBody, optionsResponse } from '../../_shared/http.js';
import {
  REVIEWERS,
  encodeBucketId,
  resolveBucketKey,
} from '../../_shared/cleanup.js';
import { getLootTable } from '../../_shared/loot-table-store.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const DB = context.env.LOOT_CHEST_DB;
  const r2 = context.env.LOOT_TABLE_BUCKET;
  if (!DB) return json({ error: 'Database not configured' }, 503);

  const id = context.params?.id;
  if (!id) return json({ error: 'bucket id required' }, 400);

  let bucketKey;
  try {
    bucketKey = await resolveBucketKey(DB, id);
  } catch (e) {
    if (e.code === 'AMBIGUOUS_SLUG') return json({ error: e.message }, 409);
    throw e;
  }
  if (!bucketKey) return json({ error: 'Bucket not found' }, 404);

  const bucket = await DB.prepare('SELECT * FROM cleanup_buckets WHERE bucket_key = ?')
    .bind(bucketKey)
    .first();
  if (!bucket) return json({ error: 'Bucket not found' }, 404);

  const itemRows = await DB.prepare(
    `SELECT item_id, bucket_key, reviewer, status, flag_reason, flag_note, flagged_at, reviewed_at, updated_at
     FROM cleanup_items WHERE bucket_key = ? ORDER BY item_id`
  )
    .bind(bucketKey)
    .all();

  let lootById = new Map();
  try {
    const { data } = await getLootTable(r2);
    for (const it of data.items || []) {
      lootById.set(Number(it.id), it);
    }
  } catch (e) {
    return json({ error: String(e.message || e) }, e.status || 502);
  }

  const items = (itemRows.results || []).map((row) => {
    const loot = lootById.get(Number(row.item_id)) || null;
    return {
      ...row,
      item_id: Number(row.item_id),
      name: loot?.name ?? null,
      item: loot,
    };
  });

  const unreviewed = items.filter((i) => i.status === 'unreviewed').length;
  const flagged = items.filter((i) => i.status === 'flagged').length;
  const needs_source = items.filter((i) => i.status === 'needs_source').length;
  const examined = items.length - unreviewed;

  return json({
    bucket: {
      ...bucket,
      bucket_id: encodeBucketId(bucket.bucket_key),
      examined,
      unreviewed,
      flagged,
      needs_source,
      review_complete: unreviewed === 0 && items.length > 0,
      cleanup_complete:
        items.length > 0 && unreviewed === 0 && flagged === 0 && needs_source === 0,
    },
    items,
  });
}

export async function onRequestPatch(context) {
  const DB = context.env.LOOT_CHEST_DB;
  if (!DB) return json({ error: 'Database not configured' }, 503);

  const id = context.params?.id;
  if (!id) return json({ error: 'bucket id required' }, 400);

  let bucketKey;
  try {
    bucketKey = await resolveBucketKey(DB, id);
  } catch (e) {
    if (e.code === 'AMBIGUOUS_SLUG') return json({ error: e.message }, 409);
    throw e;
  }
  if (!bucketKey) return json({ error: 'Bucket not found' }, 404);

  const body = await getBody(context.request);
  if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON body' }, 400);

  let assigned_to = body.assigned_to;
  if (assigned_to === '' || assigned_to === undefined) assigned_to = null;
  if (assigned_to != null && !REVIEWERS.includes(assigned_to)) {
    return json({ error: `assigned_to must be one of: ${REVIEWERS.join(', ')} or null` }, 400);
  }

  await DB.prepare(
    `UPDATE cleanup_buckets SET assigned_to = ?, updated_at = datetime('now') WHERE bucket_key = ?`
  )
    .bind(assigned_to, bucketKey)
    .run();

  const row = await DB.prepare('SELECT * FROM cleanup_buckets WHERE bucket_key = ?')
    .bind(bucketKey)
    .first();

  return json({
    ok: true,
    bucket: row ? { ...row, bucket_id: encodeBucketId(row.bucket_key) } : null,
  });
}
