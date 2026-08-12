import { json, optionsResponse } from '../_shared/http.js';
import { REVIEWERS, encodeBucketId } from '../_shared/cleanup.js';
import { getLootTable, findItemInData } from '../_shared/loot-table-store.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  const DB = context.env.LOOT_CHEST_DB;
  const r2 = context.env.LOOT_TABLE_BUCKET;
  if (!DB) return json({ error: 'Database not configured' }, 503);

  const url = new URL(context.request.url);
  const reviewer = url.searchParams.get('reviewer');
  if (!REVIEWERS.includes(reviewer)) {
    return json({ error: `reviewer query must be one of: ${REVIEWERS.join(', ')}` }, 400);
  }

  try {
    const state = await DB.prepare(
      'SELECT reviewer, last_bucket_key, last_item_id, updated_at FROM cleanup_reviewer_state WHERE reviewer = ?'
    )
      .bind(reviewer)
      .first();

    if (!state || !state.last_bucket_key) {
      // Fall back: first incomplete assigned bucket
      const fallback = await DB.prepare(
        `SELECT b.bucket_key, b.slug, b.category, b.rarity, b.item_count,
                SUM(CASE WHEN i.status = 'unreviewed' THEN 1 ELSE 0 END) AS unreviewed,
                SUM(CASE WHEN i.status != 'unreviewed' THEN 1 ELSE 0 END) AS examined
         FROM cleanup_buckets b
         LEFT JOIN cleanup_items i ON i.bucket_key = b.bucket_key
         WHERE b.assigned_to = ?
         GROUP BY b.bucket_key
         HAVING unreviewed > 0
         ORDER BY b.category, b.rarity
         LIMIT 1`
      )
        .bind(reviewer)
        .first();

      if (!fallback) {
        return json({ reviewer, resume: null });
      }

      const nextItem = await DB.prepare(
        `SELECT item_id FROM cleanup_items
         WHERE bucket_key = ? AND status = 'unreviewed'
         ORDER BY item_id LIMIT 1`
      )
        .bind(fallback.bucket_key)
        .first();

      return json({
        reviewer,
        resume: {
          bucket_key: fallback.bucket_key,
          bucket_id: encodeBucketId(fallback.bucket_key),
          slug: fallback.slug,
          category: fallback.category,
          rarity: fallback.rarity,
          item_count: Number(fallback.item_count) || 0,
          examined: Number(fallback.examined) || 0,
          next_item_id: nextItem ? Number(nextItem.item_id) : null,
          from_state: false,
        },
      });
    }

    const bucket = await DB.prepare(
      'SELECT bucket_key, slug, category, rarity, item_count, assigned_to FROM cleanup_buckets WHERE bucket_key = ?'
    )
      .bind(state.last_bucket_key)
      .first();

    const counts = await DB.prepare(
      `SELECT
         SUM(CASE WHEN status = 'unreviewed' THEN 1 ELSE 0 END) AS unreviewed,
         SUM(CASE WHEN status != 'unreviewed' THEN 1 ELSE 0 END) AS examined
       FROM cleanup_items WHERE bucket_key = ?`
    )
      .bind(state.last_bucket_key)
      .first();

    let nextItemId = Number(state.last_item_id);
    const lastStatus = await DB.prepare(
      'SELECT status FROM cleanup_items WHERE item_id = ?'
    )
      .bind(nextItemId)
      .first();

    if (!lastStatus || lastStatus.status !== 'unreviewed') {
      const next = await DB.prepare(
        `SELECT item_id FROM cleanup_items
         WHERE bucket_key = ? AND status = 'unreviewed' AND item_id > ?
         ORDER BY item_id LIMIT 1`
      )
        .bind(state.last_bucket_key, nextItemId)
        .first();
      if (next) {
        nextItemId = Number(next.item_id);
      } else {
        const firstUnreviewed = await DB.prepare(
          `SELECT item_id FROM cleanup_items
           WHERE bucket_key = ? AND status = 'unreviewed'
           ORDER BY item_id LIMIT 1`
        )
          .bind(state.last_bucket_key)
          .first();
        nextItemId = firstUnreviewed ? Number(firstUnreviewed.item_id) : null;
      }
    }

    let itemName = null;
    if (nextItemId != null) {
      try {
        const { data } = await getLootTable(r2);
        const it = findItemInData(data, nextItemId);
        itemName = it?.name ?? null;
      } catch {
        /* ignore */
      }
    }

    return json({
      reviewer,
      resume: bucket
        ? {
            bucket_key: bucket.bucket_key,
            bucket_id: encodeBucketId(bucket.bucket_key),
            slug: bucket.slug,
            category: bucket.category,
            rarity: bucket.rarity,
            item_count: Number(bucket.item_count) || 0,
            examined: Number(counts?.examined) || 0,
            last_item_id: Number(state.last_item_id),
            next_item_id: nextItemId,
            next_item_name: itemName,
            from_state: true,
            updated_at: state.updated_at,
          }
        : null,
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 502);
  }
}
