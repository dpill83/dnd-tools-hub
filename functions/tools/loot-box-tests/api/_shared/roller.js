import LOOT from './loot-table.json';

function pickFromTier(tiers, categories) {
  const tierSet = new Set(Array.isArray(tiers) ? tiers : [tiers]);
  const pool = (LOOT.items || []).filter(
    (item) =>
      tierSet.has(item.tier) &&
      (!categories?.length || categories.includes(item.category))
  );
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickById(id) {
  const needle = Number(id);
  if (Number.isNaN(needle)) return null;
  return (LOOT.items || []).find((item) => Number(item?.id) === needle) || null;
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

export function rollItems(slot_config, guaranteed_item_id) {
  const {
    mundane_count,
    reveal_tier_min,
    reveal_tier_max,
    categories = [],
    filler_slots = null, // [{ min_tier, max_tier }] (optional)
    pinned_mundane_item_ids = null, // number[] (optional)
  } = slot_config;

  const mundane = [];
  for (let i = 0; i < mundane_count; i++) {
    const pinnedId =
      Array.isArray(pinned_mundane_item_ids) ? pinned_mundane_item_ids[i] : null;
    const pinned = pinnedId != null ? pickById(pinnedId) : null;
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
    // Try with selected categories; if empty pool, fall back to any category.
    let item = pickFromTier(tierList, categories);
    if (!item) item = pickFromTier(tierList, []);
    if (!item && tierList[0] !== 0) item = pickFromTier([0, 1], []);
    if (item) mundane.push(item);
  }

  let reveal = null;
  if (guaranteed_item_id != null) {
    reveal = pickById(guaranteed_item_id);
  }
  if (!reveal) {
    const tiers = tiersInclusive(reveal_tier_min, reveal_tier_max);
    reveal = pickFromTier(tiers.length ? tiers : [2, 3, 4, 5], categories);
  }
  if (!reveal) {
    reveal = pickFromTier([2, 3, 4, 5], []);
  }

  return { mundane, reveal };
}

