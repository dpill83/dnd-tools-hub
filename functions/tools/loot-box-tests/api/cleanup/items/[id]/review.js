import { json, getBody, optionsResponse } from '../../../_shared/http.js';
import {
  REVIEWERS,
  STATUSES,
  FLAG_REASONS,
  bucketKey,
  bucketSlug,
  encodeBucketId,
  refreshBucketCounts,
} from '../../../_shared/cleanup.js';
import {
  getLootTable,
  findItemInData,
  patchItem,
  serializeValue,
  PATCHABLE_FIELDS,
} from '../../../_shared/loot-table-store.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost(context) {
  const DB = context.env.LOOT_CHEST_DB;
  const r2 = context.env.LOOT_TABLE_BUCKET;
  if (!DB) return json({ error: 'Database not configured' }, 503);

  const itemId = Number(context.params?.id);
  if (!Number.isInteger(itemId) || itemId < 0) {
    return json({ error: 'Invalid item id' }, 400);
  }

  const body = await getBody(context.request);
  if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON body' }, 400);

  if (body.changes != null || body.old_value != null || body.diffs != null) {
    return json(
      { error: 'Client-supplied change history is not accepted; server computes diffs' },
      400
    );
  }

  const reviewer = body.reviewer;
  if (!REVIEWERS.includes(reviewer)) {
    return json({ error: `reviewer must be one of: ${REVIEWERS.join(', ')}` }, 400);
  }

  const status = body.status;
  if (!STATUSES.includes(status) || status === 'unreviewed') {
    return json({
      error: 'status must be reviewed, corrected, flagged, or needs_source',
    }, 400);
  }

  const note = typeof body.note === 'string' ? body.note.trim() : '';
  let fields = body.fields;
  if (fields != null && typeof fields !== 'object') {
    return json({ error: 'fields must be an object' }, 400);
  }
  if (fields) {
    const cleaned = {};
    for (const key of PATCHABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        cleaned[key] = fields[key];
      }
    }
    fields = cleaned;
  } else {
    fields = null;
  }

  let flag_reason = body.flag_reason ?? null;
  let flag_note = typeof body.flag_note === 'string' ? body.flag_note.trim() : '';

  if (status === 'flagged') {
    if (!FLAG_REASONS.includes(flag_reason)) {
      return json({ error: `flag_reason must be one of: ${FLAG_REASONS.join(', ')}` }, 400);
    }
    if (!flag_note) {
      return json({ error: 'flag_note is required when flagging' }, 400);
    }
  }

  let cleanupRow = await DB.prepare('SELECT * FROM cleanup_items WHERE item_id = ?')
    .bind(itemId)
    .first();
  if (!cleanupRow) {
    return json({ error: 'Cleanup row not found; run sync first' }, 404);
  }

  let r2Item = null;
  let diffs = [];
  let r2Updated = false;

  try {
    if (fields && Object.keys(fields).length > 0) {
      const result = await patchItem(r2, itemId, fields);
      r2Item = result.item;
      diffs = result.diffs;
      r2Updated = !result.skippedWrite;
    } else {
      const { data } = await getLootTable(r2);
      r2Item = findItemInData(data, itemId);
      if (!r2Item) return json({ error: `Item ${itemId} not found in loot table` }, 404);
      diffs = [];
    }
  } catch (e) {
    return json(
      { error: String(e.message || e), errors: e.errors || undefined },
      e.status || 502
    );
  }

  if (status === 'reviewed' && diffs.length > 0) {
    return json({
      error: 'Cannot mark reviewed with no changes when fields differ; use corrected',
      diffs,
    }, 400);
  }

  let effectiveStatus = status;
  if (diffs.length > 0 && (status === 'reviewed' || status === 'corrected')) {
    effectiveStatus = 'corrected';
  }

  const nextBucketKey = r2Item
    ? bucketKey(r2Item.category, r2Item.rarity)
    : cleanupRow.bucket_key;

  const stmts = [];

  // Ensure destination bucket exists when category/rarity moved
  if (nextBucketKey !== cleanupRow.bucket_key && r2Item) {
    stmts.push(
      DB.prepare(
        `INSERT INTO cleanup_buckets (bucket_key, slug, category, rarity, item_count, updated_at)
         VALUES (?, ?, ?, ?, 0, datetime('now'))
         ON CONFLICT(bucket_key) DO NOTHING`
      ).bind(
        nextBucketKey,
        bucketSlug(r2Item.category, r2Item.rarity),
        String(r2Item.category).trim(),
        String(r2Item.rarity).trim()
      )
    );
  }

  if (effectiveStatus === 'flagged') {
    stmts.push(
      DB.prepare(
        `UPDATE cleanup_items SET
           bucket_key = ?,
           reviewer = ?,
           status = 'flagged',
           flag_reason = ?,
           flag_note = ?,
           flagged_at = datetime('now'),
           reviewed_at = datetime('now'),
           updated_at = datetime('now')
         WHERE item_id = ?`
      ).bind(nextBucketKey, reviewer, flag_reason, flag_note, itemId)
    );
  } else {
    // reviewed / corrected / needs_source — clear flag fields on resolve
    stmts.push(
      DB.prepare(
        `UPDATE cleanup_items SET
           bucket_key = ?,
           reviewer = ?,
           status = ?,
           flag_reason = NULL,
           flag_note = NULL,
           flagged_at = NULL,
           reviewed_at = datetime('now'),
           updated_at = datetime('now')
         WHERE item_id = ?`
      ).bind(nextBucketKey, reviewer, effectiveStatus, itemId)
    );
  }

  for (const d of diffs) {
    stmts.push(
      DB.prepare(
        `INSERT INTO cleanup_changes (item_id, reviewer, field, old_value, new_value, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        itemId,
        reviewer,
        d.field,
        serializeValue(d.oldValue),
        serializeValue(d.newValue),
        note || null
      )
    );
  }

  stmts.push(
    DB.prepare(
      `INSERT INTO cleanup_reviewer_state (reviewer, last_bucket_key, last_item_id, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(reviewer) DO UPDATE SET
         last_bucket_key = excluded.last_bucket_key,
         last_item_id = excluded.last_item_id,
         updated_at = datetime('now')`
    ).bind(reviewer, nextBucketKey, itemId)
  );

  try {
    await DB.batch(stmts);
  } catch (e) {
    return json(
      {
        ok: false,
        partial: true,
        r2Updated,
        d1Error: String(e?.message || e),
        item: r2Item,
        diffs,
        message:
          'Item data may have been saved to R2, but cleanup metadata failed. Run sync or retry.',
      },
      207
    );
  }

  try {
    await refreshBucketCounts(DB, [cleanupRow.bucket_key, nextBucketKey]);
  } catch {
    /* counts refresh is best-effort; sync repairs */
  }

  const updated = await DB.prepare('SELECT * FROM cleanup_items WHERE item_id = ?')
    .bind(itemId)
    .first();

  return json({
    ok: true,
    r2Updated,
    partial: false,
    item: r2Item,
    cleanup: updated,
    diffs,
    bucket_id: encodeBucketId(nextBucketKey),
  });
}
