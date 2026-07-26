/**
 * Griffon's Saddlebag → Loot Forge import mapping + merge helpers.
 * Browser: window.LootGsbImport. Node: module.exports.
 */
(function (root) {
  'use strict';

  var ALLOWED_RARITIES = [
    'Unknown',
    'Mundane',
    'Common',
    'Uncommon',
    'Rare',
    'Very Rare',
    'Legendary',
  ];

  var RARITY_TO_TIER = {
    Unknown: 0,
    Mundane: 0,
    Common: 1,
    Uncommon: 2,
    Rare: 3,
    'Very Rare': 4,
    Legendary: 5,
  };

  /** Non-zero medians from the existing Loot Forge table. */
  var GP_BY_RARITY = {
    Common: 20,
    Uncommon: 180,
    Rare: 1000,
    'Very Rare': 5000,
    Legendary: 5000,
  };

  var RARITY_MAP = {
    Artifact: 'Legendary',
    Varies: 'Rare',
  };

  var PLAIN_TYPES_NO_PROPERTY = {
    'wondrous item': true,
    'wonderous item': true,
    ring: true,
    potion: true,
  };

  function normalizeName(name) {
    return String(name || '')
      .trim()
      .toLowerCase();
  }

  function mapRarity(rawRarity) {
    var r = String(rawRarity || '').trim();
    if (RARITY_MAP[r]) {
      return { rarity: RARITY_MAP[r], originalRarity: r };
    }
    return { rarity: r, originalRarity: null };
  }

  function normalizeCategory(rawType) {
    var t = String(rawType || '').trim();
    var lower = t.toLowerCase();
    if (lower.indexOf('weapon') === 0) return 'Weapon';
    if (lower.indexOf('armor') === 0) return 'Armor';
    if (lower === 'potion') return 'Potion';
    if (lower === 'ring') return 'Ring';
    if (
      lower === 'wondrous item' ||
      lower === 'wonderous item' ||
      lower === 'rod' ||
      lower === 'staff' ||
      lower === 'wand' ||
      lower === 'scroll'
    ) {
      return 'Wondrous Item';
    }
    return 'Wondrous Item';
  }

  function shouldStoreTypeProperty(rawType) {
    var t = String(rawType || '').trim();
    if (!t) return false;
    var lower = t.toLowerCase();
    if (PLAIN_TYPES_NO_PROPERTY[lower]) return false;
    return true;
  }

  function buildProperties(rawType, originalRarity) {
    var props = [];
    if (shouldStoreTypeProperty(rawType)) {
      props.push(String(rawType).trim());
    }
    if (originalRarity) {
      props.push('Original rarity: ' + originalRarity);
    }
    return props.length ? props : undefined;
  }

  function valueForRarity(rarity) {
    var v = GP_BY_RARITY[rarity];
    return typeof v === 'number' ? v : 0;
  }

  /**
   * Map one GSB record to a Loot Forge item without assigning id.
   * @returns {{ ok: true, item: object } | { ok: false, error: string }}
   */
  function mapGriffonsItem(raw) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'item must be an object' };
    }
    var name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) return { ok: false, error: 'missing name' };

    var mapped = mapRarity(raw.rarity);
    if (ALLOWED_RARITIES.indexOf(mapped.rarity) === -1) {
      return { ok: false, error: 'invalid rarity "' + raw.rarity + '"' };
    }

    var category = normalizeCategory(raw.type);
    if (!category) return { ok: false, error: 'missing category' };

    var value = valueForRarity(mapped.rarity);
    var item = {
      name: name,
      rarity: mapped.rarity,
      category: category,
      value: value,
      tier: RARITY_TO_TIER[mapped.rarity],
      description: typeof raw.description === 'string' ? raw.description : '',
      author:
        typeof raw.author === 'string' && raw.author.trim()
          ? raw.author.trim()
          : "The Griffon's Saddlebag",
    };

    if (value > 0) item.value_raw = value + ' gp';

    var props = buildProperties(raw.type, mapped.originalRarity);
    if (props) item.properties = props;

    if (raw.requirement != null && String(raw.requirement).trim()) {
      item.requirements = String(raw.requirement).trim();
    }

    return { ok: true, item: item };
  }

  function isGriffonsPayload(json) {
    if (!json || typeof json !== 'object') return false;
    var meta = json.metadata;
    if (meta && typeof meta === 'object') {
      var src = String(meta.source || '');
      if (/griffon/i.test(src)) return true;
    }
    var items = json.items;
    if (!Array.isArray(items) || !items.length) return false;
    var sample = items[0];
    if (!sample || typeof sample !== 'object') return false;
    if (typeof sample.type === 'string' && sample.icon && typeof sample.icon === 'object') {
      return true;
    }
    if (typeof sample.id === 'string' && String(sample.id).indexOf('gsb-') === 0) {
      return true;
    }
    return false;
  }

  function isLootPayload(json) {
    if (!json || typeof json !== 'object') return false;
    if (!Array.isArray(json.items) || !json.items.length) return false;
    var sample = json.items[0];
    if (!sample || typeof sample !== 'object') return false;
    return (
      typeof sample.category === 'string' &&
      typeof sample.rarity === 'string' &&
      sample.name != null
    );
  }

  /**
   * Normalize a generic loot-table item without assigning id.
   * Strips icon if present is not required — leave as-is for generic imports.
   */
  function normalizeLootItem(raw) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'item must be an object' };
    }
    var name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) return { ok: false, error: 'missing name' };

    var rarity = typeof raw.rarity === 'string' ? raw.rarity.trim() : '';
    if (ALLOWED_RARITIES.indexOf(rarity) === -1) {
      return { ok: false, error: 'invalid rarity "' + rarity + '"' };
    }

    var category = typeof raw.category === 'string' ? raw.category.trim() : '';
    if (!category) return { ok: false, error: 'missing category' };

    var valueNum = Number(raw.value);
    if (Number.isNaN(valueNum) || typeof raw.value === 'boolean') {
      return { ok: false, error: 'invalid value' };
    }

    var item = Object.assign({}, raw);
    item.name = name;
    item.rarity = rarity;
    item.category = category;
    item.value = valueNum;
    item.tier = RARITY_TO_TIER[rarity];
    delete item.id;

    if (item.requirement != null && item.requirements == null) {
      item.requirements = item.requirement;
      delete item.requirement;
    }

    return { ok: true, item: item };
  }

  function maxItemId(items) {
    var max = -1;
    for (var i = 0; i < items.length; i++) {
      var id = Number(items[i] && items[i].id);
      if (Number.isInteger(id) && id > max) max = id;
    }
    return max;
  }

  /**
   * Rebuild meta from the final items array (deterministic).
   * Preserves unrelated meta keys; refreshes total / rarities / tiers.
   */
  function rebuildMeta(doc) {
    var items = Array.isArray(doc.items) ? doc.items : [];
    var rarityOrder = ALLOWED_RARITIES;
    var seenR = {};
    var seenT = {};
    var rarities = [];
    var tiers = [];

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it) continue;
      var r = it.rarity;
      if (r && !seenR[r]) {
        seenR[r] = true;
      }
      var t = it.tier;
      if (typeof t === 'number' && !seenT[t]) {
        seenT[t] = true;
      }
    }

    for (var j = 0; j < rarityOrder.length; j++) {
      if (seenR[rarityOrder[j]]) rarities.push(rarityOrder[j]);
    }
    Object.keys(seenR).forEach(function (k) {
      if (rarities.indexOf(k) === -1) rarities.push(k);
    });

    for (var tier = 0; tier <= 5; tier++) {
      if (seenT[tier]) tiers.push(tier);
    }
    Object.keys(seenT)
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      })
      .forEach(function (k) {
        if (tiers.indexOf(k) === -1) tiers.push(k);
      });

    var prev = doc.meta && typeof doc.meta === 'object' && !Array.isArray(doc.meta) ? doc.meta : {};
    doc.meta = Object.assign({}, prev, {
      total: items.length,
      rarities: rarities,
      tiers: tiers,
    });
    return doc;
  }

  /**
   * Parse payload → normalize → validate → dedupe by name → assign IDs → append → rebuild meta.
   * @returns {{ ok: true, added: number, skipped: number, errors: string[] } | { ok: false, error: string, errors?: string[] }}
   */
  function mergeImportIntoDoc(doc, payload) {
    if (!doc || typeof doc !== 'object') {
      return { ok: false, error: 'doc must be an object' };
    }
    if (!Array.isArray(doc.items)) doc.items = [];

    var errors = [];
    var mapped = [];
    var itemsIn;
    var mapper;

    if (isGriffonsPayload(payload)) {
      itemsIn = payload.items;
      mapper = mapGriffonsItem;
    } else if (isLootPayload(payload)) {
      itemsIn = payload.items;
      mapper = normalizeLootItem;
    } else if (Array.isArray(payload)) {
      itemsIn = payload;
      mapper =
        payload[0] && typeof payload[0].type === 'string' && !payload[0].category
          ? mapGriffonsItem
          : normalizeLootItem;
    } else {
      return { ok: false, error: 'Unrecognized JSON shape (expected Griffon or loot-table items)' };
    }

    for (var i = 0; i < itemsIn.length; i++) {
      var result = mapper(itemsIn[i]);
      if (!result.ok) {
        errors.push('items[' + i + ']: ' + result.error);
        if (errors.length > 50) {
          errors.push('…too many errors, stopping');
          break;
        }
        continue;
      }
      mapped.push(result.item);
    }

    if (!mapped.length && errors.length) {
      return { ok: false, error: 'Validation failed', errors: errors };
    }

    var existingNames = {};
    for (var e = 0; e < doc.items.length; e++) {
      var n = normalizeName(doc.items[e] && doc.items[e].name);
      if (n) existingNames[n] = true;
    }

    var toAdd = [];
    var skipped = 0;
    var batchNames = {};
    for (var m = 0; m < mapped.length; m++) {
      var key = normalizeName(mapped[m].name);
      if (!key || existingNames[key] || batchNames[key]) {
        skipped++;
        continue;
      }
      batchNames[key] = true;
      toAdd.push(mapped[m]);
    }

    var nextId = maxItemId(doc.items) + 1;
    if (nextId < 0) nextId = 0;

    for (var a = 0; a < toAdd.length; a++) {
      toAdd[a].id = nextId++;
      doc.items.push(toAdd[a]);
    }

    rebuildMeta(doc);

    return {
      ok: true,
      added: toAdd.length,
      skipped: skipped,
      errors: errors,
    };
  }

  /** Body text for cards: string properties stay preferred; arrays are descriptors only. */
  function itemBodyText(item) {
    if (!item) return '';
    if (Array.isArray(item.properties)) {
      return item.description || '';
    }
    if (item.properties != null && item.properties !== '') {
      return String(item.properties);
    }
    return item.description || '';
  }

  function formatPropertiesForEditor(properties) {
    if (Array.isArray(properties)) return properties.join('\n');
    if (properties == null) return '';
    return String(properties);
  }

  /**
   * Set value to 0 only when missing, null, or blank string.
   * Leaves nonblank invalid values alone for the API validator to reject.
   * @returns {{ repaired: number, missing: number, nullish: number, blank: number, skippedInvalid: number }}
   */
  function repairMissingValues(doc) {
    var stats = {
      repaired: 0,
      missing: 0,
      nullish: 0,
      blank: 0,
      skippedInvalid: 0,
    };
    var items = Array.isArray(doc && doc.items) ? doc.items : [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item || typeof item !== 'object') continue;

      var hasValue = Object.prototype.hasOwnProperty.call(item, 'value');
      if (!hasValue) {
        item.value = 0;
        stats.missing++;
        stats.repaired++;
        continue;
      }

      if (item.value === null || item.value === undefined) {
        item.value = 0;
        stats.nullish++;
        stats.repaired++;
        continue;
      }

      if (typeof item.value === 'string' && item.value.trim() === '') {
        item.value = 0;
        stats.blank++;
        stats.repaired++;
        continue;
      }

      // Nonblank but still invalid for the validator (boolean, NaN, object, etc.)
      if (typeof item.value === 'boolean' || Number.isNaN(Number(item.value))) {
        stats.skippedInvalid++;
      }
    }

    return stats;
  }

  var api = {
    ALLOWED_RARITIES: ALLOWED_RARITIES,
    RARITY_TO_TIER: RARITY_TO_TIER,
    GP_BY_RARITY: GP_BY_RARITY,
    normalizeName: normalizeName,
    mapGriffonsItem: mapGriffonsItem,
    isGriffonsPayload: isGriffonsPayload,
    isLootPayload: isLootPayload,
    normalizeLootItem: normalizeLootItem,
    maxItemId: maxItemId,
    rebuildMeta: rebuildMeta,
    mergeImportIntoDoc: mergeImportIntoDoc,
    repairMissingValues: repairMissingValues,
    itemBodyText: itemBodyText,
    formatPropertiesForEditor: formatPropertiesForEditor,
  };

  root.LootGsbImport = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
