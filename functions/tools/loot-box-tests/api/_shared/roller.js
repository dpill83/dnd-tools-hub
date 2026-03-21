import BUNDLED_LOOT from './loot-table.json';

const R2_KEY = 'loot-table.json';
const TTL_MS = 15_000;

let cachedLoot = null;
let cachedAt = 0;

/** Load loot table from R2 with short TTL cache; fall back to bundled JSON. */
export async function loadLootTable(env) {
  const now = Date.now();
  if (cachedLoot && now - cachedAt < TTL_MS) {
    return cachedLoot;
  }

  try {
    const bucket = env?.LOOT_TABLE_BUCKET;
    if (bucket) {
      const obj = await bucket.get(R2_KEY);
      if (obj) {
        const text = await obj.text();
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
          cachedLoot = parsed;
          cachedAt = now;
          return parsed;
        }
      }
    }
  } catch {
    /* fall through to bundled */
  }

  cachedLoot = BUNDLED_LOOT;
  cachedAt = now;
  return BUNDLED_LOOT;
}

function pickFromTier(loot, tiers, categories) {
  const tierSet = new Set(Array.isArray(tiers) ? tiers : [tiers]);
  const pool = (loot.items || []).filter(
    (item) =>
      tierSet.has(item.tier) &&
      (!categories?.length || categories.includes(item.category))
  );
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickById(loot, id) {
  const needle = Number(id);
  if (Number.isNaN(needle)) return null;
  return (loot.items || []).find((item) => Number(item?.id) === needle) || null;
}

function tiersInclusive(min, max) {
  const a = Number(min);
  const b = Number(max);
  if (Number.isNaN(a) || Number.isNaN(b)) return [];
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const out = [];
  for (let t = lo; t <= hi; t++) out.push(t);
  return out;
}

export async function rollItems(env, slot_config, guaranteed_item_id) {
  const loot = await loadLootTable(env);
  const {
    mundane_count,
    reveal_tier_min,
    reveal_tier_max,
    categories = [],
    filler_slots = null,
    pinned_mundane_item_ids = null,
  } = slot_config;

  const mundane = [];
  for (let i = 0; i < mundane_count; i++) {
    const pinnedId =
      Array.isArray(pinned_mundane_item_ids) ? pinned_mundane_item_ids[i] : null;
    const pinned = pinnedId != null ? pickById(loot, pinnedId) : null;
    if (pinned) {
      mundane.push(pinned);
      continue;
    }

    const slotCfg =
      Array.isArray(filler_slots) && filler_slots[i] ? filler_slots[i] : null;
    const tiers = slotCfg
      ? tiersInclusive(slotCfg.min_tier, slotCfg.max_tier)
      : [0, 1];

    const tierList = tiers.length ? tiers : [0, 1];
    let item = pickFromTier(loot, tierList, categories);
    if (!item) item = pickFromTier(loot, tierList, []);
    if (!item && tierList[0] !== 0) item = pickFromTier(loot, [0, 1], []);
    if (item) mundane.push(item);
  }

  let reveal = null;
  if (guaranteed_item_id != null) {
    reveal = pickById(loot, guaranteed_item_id);
  }
  if (!reveal) {
    const tiers = tiersInclusive(reveal_tier_min, reveal_tier_max);
    reveal = pickFromTier(loot, tiers.length ? tiers : [2, 3, 4, 5], categories);
  }
  if (!reveal) {
    reveal = pickFromTier(loot, [2, 3, 4, 5], []);
  }

  return { mundane, reveal };
}
