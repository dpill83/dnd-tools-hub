window.SpellDeck = window.SpellDeck || {};

(function (SD) {
  const CLASS_NAMES = [
    "Artificer", "Bard", "Blood Hunter", "Cleric", "Druid",
    "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"
  ];
  const CLASS_SET = new Set(CLASS_NAMES.map((n) => n.toLowerCase()));
  const PREP_ACTIONS = new Set(["prepare", "unprepare"]);
  const FREE_KINDS = new Set(["item", "feat", "feature", "subclass"]);

  function norm(value) {
    return String(value || "").toLowerCase().trim();
  }

  function isClassLabel(value) {
    return CLASS_SET.has(norm(value));
  }

  function accessesOf(spell) {
    if (Array.isArray(spell.accesses) && spell.accesses.length) return spell.accesses;
    if (spell.sourceKind || spell.sourceLabel || spell.grantedByFeature) {
      return [{
        sourceKind: spell.sourceKind,
        sourceLabel: spell.sourceLabel,
        accessManager: spell.accessManager,
        grantedByFeature: spell.grantedByFeature,
        sourceDetection: spell.sourceDetection
      }];
    }
    return [];
  }

  function prepAction(spell) {
    return norm(spell.ddbPrepAction);
  }

  function isAlwaysPrepared(spell) {
    return spell.alwaysPrepared === true || prepAction(spell) === "always prepared";
  }

  function hasClassPrepAccess(spell) {
    if (isAlwaysPrepared(spell)) return false;
    if (!(Number(spell.level) >= 1)) return false;
    if (!PREP_ACTIONS.has(prepAction(spell))) return false;
    const accesses = accessesOf(spell);
    if (accesses.some((a) => norm(a.sourceKind) === "class" || isClassLabel(a.sourceLabel) || isClassLabel(a.accessManager))) {
      return true;
    }
    if (norm(spell.sourceKind) === "class" || isClassLabel(spell.sourceLabel)) return true;
    if (Array.isArray(spell.classes) && spell.classes.some(isClassLabel) && PREP_ACTIONS.has(prepAction(spell))) {
      return true;
    }
    return false;
  }

  function hasFreeAccess(spell) {
    if (isAlwaysPrepared(spell)) return true;
    const action = prepAction(spell);
    if (Number(spell.level) === 0 && action && action !== "learn") return true;
    return accessesOf(spell).some((a) => FREE_KINDS.has(norm(a.sourceKind)));
  }

  function freeLabel(spell) {
    if (isAlwaysPrepared(spell)) return "Always prepared";
    if (Number(spell.level) === 0 && prepAction(spell) !== "learn") return "Cantrip";
    const hit = accessesOf(spell).find((a) => FREE_KINDS.has(norm(a.sourceKind)));
    if (!hit) return "Granted";
    return hit.sourceLabel || hit.grantedByFeature || hit.sourceKind;
  }

  function groupAlways(spell) {
    if (Number(spell.level) === 0 && !accessesOf(spell).some((a) => FREE_KINDS.has(norm(a.sourceKind)))) {
      return "cantrips";
    }
    if (accessesOf(spell).some((a) => FREE_KINDS.has(norm(a.sourceKind)))) return "gear";
    if (isAlwaysPrepared(spell)) return "domain";
    if (Number(spell.level) === 0) return "cantrips";
    return "domain";
  }

  SD.accessesOf = accessesOf;
  SD.isAlwaysPrepared = isAlwaysPrepared;
  SD.freeLabel = freeLabel;
  SD.groupAlways = groupAlways;

  SD.classifySpells = function classifySpells(spells) {
    const pool = [];
    const always = [];
    for (const spell of spells || []) {
      const inPool = hasClassPrepAccess(spell);
      const alwaysOn = hasFreeAccess(spell);
      if (!inPool && !alwaysOn) continue;
      const card = Object.assign({}, spell, {
        inPool,
        alwaysOn,
        overlap: inPool && alwaysOn
      });
      if (inPool) pool.push(card);
      if (alwaysOn) always.push(card);
    }
    return { pool, always };
  };
}(window.SpellDeck));
