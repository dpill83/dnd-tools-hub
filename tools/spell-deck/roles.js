window.SpellDeck = window.SpellDeck || {};

(function (SD) {
  const TAG_ROLE = {
    HEALING: "healing",
    DAMAGE: "damage",
    CONTROL: "control",
    DEBUFF: "control",
    WARDING: "defense",
    BUFF: "defense",
    MOVEMENT: "movement"
  };
  const ORDER = ["damage", "control", "healing", "defense", "utility", "movement"];
  const LABEL = {
    damage: "DAMAGE",
    control: "CONTROL",
    healing: "HEALING",
    defense: "DEFENSE",
    utility: "UTILITY",
    movement: "MOVEMENT"
  };

  function rolesFor(spell) {
    const tags = Array.isArray(spell.tags) ? spell.tags : [];
    const found = [];
    for (const tag of tags) {
      const role = TAG_ROLE[String(tag).toUpperCase()];
      if (role && found.indexOf(role) < 0) found.push(role);
    }
    if (!found.length) found.push("utility");
    return found;
  }

  function castTag(spell) {
    const bits = [];
    const time = String(spell.castingTime || "").toLowerCase();
    if (time.indexOf("bonus") >= 0) bits.push("BONUS");
    else if (time.indexOf("reaction") >= 0) bits.push("REACTION");
    else if (time.indexOf("action") >= 0) bits.push("ACTION");
    if (spell.concentration) bits.push("CONC");
    if (spell.ritual) bits.push("RITUAL");
    return bits.join(" · ");
  }

  SD.ROLE_ORDER = ORDER;
  SD.ROLE_LABEL = LABEL;
  SD.rolesFor = rolesFor;
  SD.primaryRole = function (spell) { return rolesFor(spell)[0]; };
  SD.castTag = castTag;
}(window.SpellDeck));
