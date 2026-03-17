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

export function rollItems(slot_config, guaranteed_item_id) {
  const {
    mundane_count,
    reveal_tier_min,
    reveal_tier_max,
    categories = [],
  } = slot_config;

  const mundane = [];
  for (let i = 0; i < mundane_count; i++) {
    const item = pickFromTier([0, 1], categories);
    if (item) mundane.push(item);
  }

  let reveal = null;
  if (guaranteed_item_id != null) {
    reveal =
      LOOT.items.find((item) => item.id === guaranteed_item_id) || null;
  }
  if (!reveal) {
    const tiers = [];
    for (let t = reveal_tier_min; t <= reveal_tier_max; t++) tiers.push(t);
    reveal = pickFromTier(tiers, categories);
  }
  if (!reveal) {
    reveal = pickFromTier([2, 3, 4, 5], []);
  }

  return { mundane, reveal };
}

