function parseJsonField(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Chronological opens for a single pack (player-facing; no dm_key). */
export async function getOpensByPackId(DB, packId) {
  const rows = await DB.prepare(
    'SELECT mundane, reveal, opened_at FROM pack_opens WHERE pack_id = ? ORDER BY opened_at ASC'
  )
    .bind(packId)
    .all();
  return (rows.results || []).map((row) => ({
    opened_at: row.opened_at,
    mundane: parseJsonField(row.mundane, []),
    reveal: parseJsonField(row.reveal, null),
  }));
}
