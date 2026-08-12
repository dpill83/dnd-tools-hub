import { validateAndNormalizeLootTable } from '../../../../api/lib/loot-table-validate.js';

const R2_KEY = 'loot-table.json';
const MAX_ATTEMPTS = 5;

/** Fields clients may patch on a loot item (id/tier are server-owned). */
export const PATCHABLE_FIELDS = [
  'name',
  'description',
  'category',
  'rarity',
  'value',
  'value_raw',
  'weight',
  'properties',
  'requirements',
  'author',
  'icon',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serializeValue(v) {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function valuesEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na === nb) return true;
  }
  return serializeValue(a) === serializeValue(b);
}

/**
 * Server-side diffs between current item and proposed patch fields.
 * Never trusts client old_value.
 */
export function computeItemDiffs(current, patchFields) {
  const diffs = [];
  if (!patchFields || typeof patchFields !== 'object') return diffs;
  for (const field of PATCHABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patchFields, field)) continue;
    const newValue = patchFields[field];
    const oldValue = current[field];
    if (valuesEqual(oldValue, newValue)) continue;
    diffs.push({
      field,
      oldValue: oldValue === undefined ? null : oldValue,
      newValue: newValue === undefined ? null : newValue,
    });
  }
  return diffs;
}

export async function getLootTable(r2Bucket) {
  if (!r2Bucket) {
    const err = new Error('R2 bucket LOOT_TABLE_BUCKET is not configured');
    err.status = 503;
    throw err;
  }
  const obj = await r2Bucket.get(R2_KEY);
  if (!obj) {
    const err = new Error('loot-table.json not found in R2; seed the bucket');
    err.status = 404;
    throw err;
  }
  const text = await obj.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const err = new Error('Stored loot table is not valid JSON');
    err.status = 502;
    throw err;
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
    const err = new Error('Stored loot table has invalid shape (expected at least { items: [] })');
    err.status = 502;
    throw err;
  }
  const etag = obj.httpEtag || obj.etag || null;
  return { data, etag };
}

function isPreconditionFailure(result, error) {
  if (result && result.httpStatusCode === 412) return true;
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('precondition') ||
    msg.includes('412') ||
    msg.includes('etag') ||
    msg.includes('conflict') ||
    msg.includes('contention') ||
    msg.includes('too many requests') ||
    msg.includes('429')
  );
}

/**
 * Patch one item by id with ETag-conditional put + retry/backoff.
 * @returns {{ item: object, diffs: object[], etag: string|null, data: object }}
 */
export async function patchItem(r2Bucket, itemId, patchFields) {
  const id = Number(itemId);
  if (!Number.isInteger(id) || id < 0) {
    const err = new Error('Invalid item id');
    err.status = 400;
    throw err;
  }

  let lastError = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(50 * Math.pow(2, attempt - 1));
    }

    const { data, etag } = await getLootTable(r2Bucket);
    const idx = data.items.findIndex((it) => Number(it.id) === id);
    if (idx < 0) {
      const err = new Error(`Item ${id} not found`);
      err.status = 404;
      throw err;
    }

    const current = data.items[idx];
    const diffs = computeItemDiffs(current, patchFields);
    if (diffs.length === 0) {
      return { item: current, diffs: [], etag, data, skippedWrite: true };
    }

    const nextItem = { ...current };
    for (const d of diffs) {
      if (d.newValue === null || d.newValue === undefined || d.newValue === '') {
        if (d.field === 'name' || d.field === 'category' || d.field === 'rarity') {
          nextItem[d.field] = d.newValue == null ? '' : d.newValue;
        } else if (d.field === 'value') {
          nextItem[d.field] = Number(d.newValue) || 0;
        } else {
          delete nextItem[d.field];
        }
      } else {
        nextItem[d.field] = d.newValue;
      }
    }

    const nextDoc = {
      ...data,
      items: data.items.map((it, i) => (i === idx ? nextItem : it)),
    };

    const validated = validateAndNormalizeLootTable(nextDoc);
    if (!validated.ok) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.errors = validated.errors;
      throw err;
    }

    const payload = JSON.stringify(validated.data);
    const putOptions = {
      httpMetadata: { contentType: 'application/json' },
    };
    if (etag) {
      putOptions.onlyIf = { etagMatches: etag };
    }

    try {
      const result = await r2Bucket.put(R2_KEY, payload, putOptions);
      // R2 returns null / incomplete when onlyIf fails on some runtimes
      if (result == null && etag) {
        lastError = new Error('R2 precondition failed');
        continue;
      }
      if (result && typeof result === 'object' && result.httpStatusCode === 412) {
        lastError = new Error('R2 precondition failed (412)');
        continue;
      }

      const written = validated.data.items.find((it) => Number(it.id) === id);
      const newEtag = result?.httpEtag || result?.etag || null;
      return {
        item: written,
        diffs: diffs.map((d) => ({
          field: d.field,
          oldValue: d.oldValue,
          newValue: d.newValue,
        })),
        etag: newEtag,
        data: validated.data,
        skippedWrite: false,
      };
    } catch (e) {
      lastError = e;
      if (isPreconditionFailure(null, e) && attempt < MAX_ATTEMPTS - 1) {
        continue;
      }
      if (attempt < MAX_ATTEMPTS - 1 && isPreconditionFailure(null, e)) continue;
      const err = new Error(String(e?.message || e || 'R2 write failed'));
      err.status = 502;
      throw err;
    }
  }

  const err = new Error(
    `R2 write contention after ${MAX_ATTEMPTS} attempts: ${String(lastError?.message || lastError || '')}`
  );
  err.status = 409;
  throw err;
}

export function findItemInData(data, itemId) {
  const id = Number(itemId);
  return (data?.items || []).find((it) => Number(it.id) === id) || null;
}

export { serializeValue };
