window.SpellDeck = window.SpellDeck || {};

(function (SD) {
  const SHAPE = { healing: 2, damage: 2, control: 2, defense: 2, utility: 2, movement: 1 };

  function coverage(deck) {
    const counts = {};
    for (const role of SD.ROLE_ORDER) counts[role] = 0;
    for (const spell of deck) {
      for (const role of SD.rolesFor(spell)) counts[role] += 1;
    }
    return counts;
  }

  function concCount(deck) {
    return deck.filter((s) => s.concentration).length;
  }

  function score(spell, deck) {
    const cov = coverage(deck);
    const roles = SD.rolesFor(spell);
    let pts = 0;
    for (const role of roles) {
      const have = cov[role] || 0;
      const want = SHAPE[role] || 0;
      if (have < want) pts += 8;
      else pts += 1;
    }
    if (spell.overlap) pts -= 12;
    if (concCount(deck) >= 5 && spell.concentration) pts -= 4;
    if (concCount(deck) >= 5 && !spell.concentration) pts += 3;
    pts += Math.min(Number(spell.level) || 0, 5);
    return pts;
  }

  function why(spell, deck) {
    if (spell.overlap) {
      return "Already on the table for free (" + SD.freeLabel(spell) + "). Spending a pick is usually a waste.";
    }
    const cov = coverage(deck);
    const role = SD.primaryRole(spell);
    const have = cov[role] || 0;
    const want = SHAPE[role] || 0;
    if (have < want) return LABEL_HINT[role] || "Fills a thin role in this deck.";
    if (spell.concentration && concCount(deck) >= 5) return "The mat is already concentration-heavy.";
    const desc = String(spell.description || "").split("\n")[0];
    return desc.length > 110 ? desc.slice(0, 107) + "…" : (desc || "A legal pick from this character's pool.");
  }

  const LABEL_HINT = {
    damage: "Your damage line is thin.",
    control: "Control is light on the mat.",
    healing: "Could use another healing card.",
    defense: "Little protection on the table.",
    utility: "A flexible problem-solver.",
    movement: "Gives the deck a movement option."
  };

  SD.dealHand = function dealHand(pool, deck, sideboard, offset) {
    const taken = new Set(deck.concat(sideboard).map((s) => s.id));
    const eligible = pool.filter((s) => !taken.has(s.id))
      .slice()
      .sort((a, b) => score(b, deck) - score(a, deck) || String(a.name).localeCompare(b.name));
    const start = Math.max(0, offset || 0) % Math.max(eligible.length, 1);
    const rotated = eligible.slice(start).concat(eligible.slice(0, start));
    return rotated.slice(0, 4).map((s) => Object.assign({}, s, { why: why(s, deck) }));
  };

  SD.coverage = coverage;
}(window.SpellDeck));
