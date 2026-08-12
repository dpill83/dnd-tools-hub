export const REVIEWERS = ['Dan', 'Ted', 'Dani'];

export const STATUSES = [
  'unreviewed',
  'reviewed',
  'corrected',
  'flagged',
  'needs_source',
];

export const FLAG_REASONS = [
  'value',
  'rarity',
  'mechanics',
  'source',
  'duplicate',
  'missing',
  'category',
  'other',
];

const BATCH_SIZE = 80;

/** Canonical bucket identity — never slugify for identity. */
export function bucketKey(category, rarity) {
  return `${String(category ?? '').trim()}\0${String(rarity ?? '').trim()}`;
}

/** Presentation / route-friendly slug (not unique by guarantee). */
export function bucketSlug(category, rarity) {
  return `${slugPart(category)}-${slugPart(rarity)}`;
}

function slugPart(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

export function encodeBucketId(key) {
  const bytes = new TextEncoder().encode(key);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBucketId(id) {
  if (id == null || id === '') return null;
  try {
    const b64 = String(id).replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Resolve route id: base64url bucket_key, or unique slug. */
export async function resolveBucketKey(DB, id) {
  const decoded = decodeBucketId(id);
  if (decoded != null) {
    const row = await DB.prepare('SELECT bucket_key FROM cleanup_buckets WHERE bucket_key = ?')
      .bind(decoded)
      .first();
    if (row) return decoded;
  }
  const slug = String(id);
  const rows = await DB.prepare('SELECT bucket_key FROM cleanup_buckets WHERE slug = ?')
    .bind(slug)
    .all();
  const list = rows.results || [];
  if (list.length === 1) return list[0].bucket_key;
  if (list.length > 1) {
    const err = new Error('Ambiguous bucket slug; use encoded bucket_key');
    err.code = 'AMBIGUOUS_SLUG';
    throw err;
  }
  return null;
}

async function runBatches(DB, statements) {
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const chunk = statements.slice(i, i + BATCH_SIZE);
    if (chunk.length) await DB.batch(chunk);
  }
}

/**
 * Reconcile D1 cleanup tables with current R2 items.
 * Preserves review status when moving items between buckets.
 * Deletes orphan cleanup_items / cleanup_changes; prunes empty buckets.
 */
export async function syncCleanupFromItems(DB, items) {
  const byKey = new Map();
  const itemIds = new Set();

  for (const raw of items || []) {
    const id = Number(raw.id);
    if (!Number.isInteger(id) || id < 0) continue;
    itemIds.add(id);
    const category = String(raw.category ?? '').trim();
    const rarity = String(raw.rarity ?? '').trim();
    const key = bucketKey(category, rarity);
    if (!byKey.has(key)) {
      byKey.set(key, {
        bucket_key: key,
        slug: bucketSlug(category, rarity),
        category,
        rarity,
        item_ids: [],
      });
    }
    byKey.get(key).item_ids.push(id);
  }

  const stmts = [];

  for (const b of byKey.values()) {
    stmts.push(
      DB.prepare(
        `INSERT INTO cleanup_buckets (bucket_key, slug, category, rarity, item_count, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(bucket_key) DO UPDATE SET
           slug = excluded.slug,
           category = excluded.category,
           rarity = excluded.rarity,
           item_count = excluded.item_count,
           updated_at = datetime('now')`
      ).bind(b.bucket_key, b.slug, b.category, b.rarity, b.item_ids.length)
    );
  }

  for (const b of byKey.values()) {
    for (const itemId of b.item_ids) {
      stmts.push(
        DB.prepare(
          `INSERT INTO cleanup_items (item_id, bucket_key, status, updated_at)
           VALUES (?, ?, 'unreviewed', datetime('now'))
           ON CONFLICT(item_id) DO UPDATE SET
             bucket_key = excluded.bucket_key,
             updated_at = datetime('now')`
        ).bind(itemId, b.bucket_key)
      );
    }
  }

  await runBatches(DB, stmts);

  const existing = await DB.prepare('SELECT item_id FROM cleanup_items').all();
  const orphanIds = (existing.results || [])
    .map((r) => Number(r.item_id))
    .filter((id) => !itemIds.has(id));

  const orphanStmts = [];
  for (const id of orphanIds) {
    orphanStmts.push(DB.prepare('DELETE FROM cleanup_changes WHERE item_id = ?').bind(id));
    orphanStmts.push(DB.prepare('DELETE FROM cleanup_items WHERE item_id = ?').bind(id));
  }
  await runBatches(DB, orphanStmts);

  const liveKeys = [...byKey.keys()];
  if (liveKeys.length === 0) {
    await DB.prepare('DELETE FROM cleanup_buckets').run();
  } else {
    const placeholders = liveKeys.map(() => '?').join(',');
    await DB.prepare(
      `DELETE FROM cleanup_buckets WHERE bucket_key NOT IN (${placeholders})`
    )
      .bind(...liveKeys)
      .run();
  }

  return {
    itemCount: itemIds.size,
    bucketCount: byKey.size,
    orphansRemoved: orphanIds.length,
  };
}

/**
 * Greedy LPT: assign buckets by item count to balance load.
 * @param {{ reassignAll?: boolean }} opts
 */
export async function assignBucketsBalanced(DB, opts = {}) {
  const reassignAll = !!opts.reassignAll;
  const rows = await DB.prepare(
    'SELECT bucket_key, item_count, assigned_to FROM cleanup_buckets ORDER BY item_count DESC, category, rarity'
  ).all();
  const buckets = rows.results || [];

  const totals = Object.fromEntries(REVIEWERS.map((r) => [r, 0]));
  const assignments = [];

  if (!reassignAll) {
    for (const b of buckets) {
      if (b.assigned_to && REVIEWERS.includes(b.assigned_to)) {
        totals[b.assigned_to] += Number(b.item_count) || 0;
      }
    }
  }

  const toAssign = reassignAll
    ? buckets
    : buckets.filter((b) => !b.assigned_to || !REVIEWERS.includes(b.assigned_to));

  toAssign.sort(
    (a, b) =>
      Number(b.item_count) - Number(a.item_count) ||
      String(a.bucket_key).localeCompare(String(b.bucket_key))
  );

  for (const b of toAssign) {
    let best = REVIEWERS[0];
    for (const r of REVIEWERS) {
      if (totals[r] < totals[best]) best = r;
    }
    totals[best] += Number(b.item_count) || 0;
    assignments.push({ bucket_key: b.bucket_key, assigned_to: best });
  }

  const stmts = assignments.map((a) =>
    DB.prepare(
      `UPDATE cleanup_buckets SET assigned_to = ?, updated_at = datetime('now') WHERE bucket_key = ?`
    ).bind(a.assigned_to, a.bucket_key)
  );
  await runBatches(DB, stmts);

  return { assigned: assignments.length, totals };
}

/**
 * Recompute item_count for the given bucket keys (and delete buckets with zero items).
 */
export async function refreshBucketCounts(DB, bucketKeys) {
  const keys = [...new Set((bucketKeys || []).filter(Boolean))];
  for (const key of keys) {
    const row = await DB.prepare(
      'SELECT COUNT(*) AS n FROM cleanup_items WHERE bucket_key = ?'
    )
      .bind(key)
      .first();
    const n = Number(row?.n) || 0;
    if (n === 0) {
      await DB.prepare('DELETE FROM cleanup_buckets WHERE bucket_key = ?').bind(key).run();
    } else {
      await DB.prepare(
        `UPDATE cleanup_buckets SET item_count = ?, updated_at = datetime('now') WHERE bucket_key = ?`
      )
        .bind(n, key)
        .run();
    }
  }
}

export async function getOverview(DB) {
  const statusRows = await DB.prepare(
    `SELECT status, COUNT(*) AS n FROM cleanup_items GROUP BY status`
  ).all();
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  let total = 0;
  for (const row of statusRows.results || []) {
    const s = row.status;
    const n = Number(row.n) || 0;
    if (byStatus[s] != null) byStatus[s] = n;
    total += n;
  }
  const examined =
    byStatus.reviewed + byStatus.corrected + byStatus.flagged + byStatus.needs_source;

  const bucketRows = await DB.prepare(
    `SELECT
       b.bucket_key, b.slug, b.category, b.rarity, b.assigned_to, b.item_count,
       SUM(CASE WHEN i.status = 'unreviewed' THEN 1 ELSE 0 END) AS unreviewed,
       SUM(CASE WHEN i.status IN ('reviewed','corrected','flagged','needs_source') THEN 1 ELSE 0 END) AS examined,
       SUM(CASE WHEN i.status = 'flagged' THEN 1 ELSE 0 END) AS flagged,
       SUM(CASE WHEN i.status = 'needs_source' THEN 1 ELSE 0 END) AS needs_source,
       SUM(CASE WHEN i.status = 'corrected' THEN 1 ELSE 0 END) AS corrected,
       SUM(CASE WHEN i.status = 'reviewed' THEN 1 ELSE 0 END) AS reviewed
     FROM cleanup_buckets b
     LEFT JOIN cleanup_items i ON i.bucket_key = b.bucket_key
     GROUP BY b.bucket_key
     ORDER BY b.category, b.rarity`
  ).all();

  const buckets = (bucketRows.results || []).map((b) => {
    const itemCount = Number(b.item_count) || 0;
    const examinedN = Number(b.examined) || 0;
    const flaggedN = Number(b.flagged) || 0;
    const needsSourceN = Number(b.needs_source) || 0;
    const unreviewedN = Number(b.unreviewed) || 0;
    return {
      bucket_key: b.bucket_key,
      bucket_id: encodeBucketId(b.bucket_key),
      slug: b.slug,
      category: b.category,
      rarity: b.rarity,
      assigned_to: b.assigned_to || null,
      item_count: itemCount,
      examined: examinedN,
      unreviewed: unreviewedN,
      flagged: flaggedN,
      needs_source: needsSourceN,
      corrected: Number(b.corrected) || 0,
      reviewed: Number(b.reviewed) || 0,
      review_complete: unreviewedN === 0 && itemCount > 0,
      cleanup_complete:
        itemCount > 0 && unreviewedN === 0 && flaggedN === 0 && needsSourceN === 0,
    };
  });

  const reviewers = REVIEWERS.map((name) => {
    const mine = buckets.filter((b) => b.assigned_to === name);
    const assigned = mine.reduce((s, b) => s + b.item_count, 0);
    const reviewed = mine.reduce((s, b) => s + b.examined, 0);
    const flagged = mine.reduce((s, b) => s + b.flagged, 0);
    return {
      reviewer: name,
      assigned,
      reviewed,
      remaining: Math.max(0, assigned - reviewed),
      flagged,
      buckets: mine.length,
    };
  });

  return {
    total,
    examined,
    percent: total ? Math.round((examined / total) * 1000) / 10 : 0,
    byStatus,
    reviewers,
    buckets,
  };
}
