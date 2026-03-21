/** Rarity strings as used in loot JSON (matches loot-constants / card UI). */
export const ALLOWED_RARITIES = [
  'Unknown',
  'Mundane',
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary',
];

const RARITY_TO_TIER = {
  Unknown: 0,
  Mundane: 0,
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  'Very Rare': 4,
  Legendary: 5,
};

/**
 * @param {unknown} body
 * @returns {{ ok: true, data: { items: object[] } } | { ok: false, errors: string[] }}
 */
export function validateAndNormalizeLootTable(body) {
  const errors = [];
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['Body must be a JSON object'] };
  }
  const items = body.items;
  if (!Array.isArray(items)) {
    return { ok: false, errors: ['Missing or invalid "items" array'] };
  }
  if (items.length < 1) {
    return { ok: false, errors: ['"items" must contain at least one entry'] };
  }
  if (items.length > 50000) {
    return { ok: false, errors: ['"items" exceeds maximum length (50000)'] };
  }

  const seenIds = new Set();

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const prefix = `items[${i}]`;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`${prefix}: must be an object`);
      continue;
    }

    const id = Number(raw.id);
    if (!Number.isInteger(id) || id < 0) {
      errors.push(`${prefix}: "id" must be a non-negative integer`);
    } else if (seenIds.has(id)) {
      errors.push(`${prefix}: duplicate id ${id}`);
    } else {
      seenIds.add(id);
    }

    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) {
      errors.push(`${prefix}: "name" must be a non-empty string`);
    }

    const rarity = typeof raw.rarity === 'string' ? raw.rarity.trim() : '';
    if (!ALLOWED_RARITIES.includes(rarity)) {
      errors.push(`${prefix}: invalid "rarity" (must be one of allowed values)`);
    }

    const category = typeof raw.category === 'string' ? raw.category.trim() : '';
    if (!category) {
      errors.push(`${prefix}: "category" must be a non-empty string`);
    }

    const valueNum = Number(raw.value);
    if (Number.isNaN(valueNum) || typeof raw.value === 'boolean') {
      errors.push(`${prefix}: "value" must be a number`);
    }

    if (errors.length > 50) {
      errors.push('…too many errors, stopping validation');
      break;
    }
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  const normalized = items.map((raw) => {
    const id = Number(raw.id);
    const name = String(raw.name).trim();
    const rarity = String(raw.rarity).trim();
    const category = String(raw.category).trim();
    const value = Number(raw.value);
    const tier = RARITY_TO_TIER[rarity];
    return {
      ...raw,
      id,
      name,
      rarity,
      category,
      value,
      tier,
    };
  });

  const data = { items: normalized };
  if (body.meta != null && typeof body.meta === 'object' && !Array.isArray(body.meta)) {
    data.meta = body.meta;
  }
  if (
    body.by_tier != null &&
    typeof body.by_tier === 'object' &&
    !Array.isArray(body.by_tier)
  ) {
    data.by_tier = body.by_tier;
  }

  return { ok: true, data };
}
