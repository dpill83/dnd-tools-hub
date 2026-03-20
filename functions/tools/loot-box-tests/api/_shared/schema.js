let ensuredBatchId = false;

export async function ensurePacksBatchIdColumn(DB) {
  if (ensuredBatchId) return;

  try {
    await DB.prepare('SELECT batch_id FROM packs LIMIT 1').first();
    ensuredBatchId = true;
    return;
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase();
    if (!msg.includes('no such column') || !msg.includes('batch_id')) throw e;
  }

  await DB.prepare('ALTER TABLE packs ADD COLUMN batch_id TEXT').run();
  ensuredBatchId = true;
}
