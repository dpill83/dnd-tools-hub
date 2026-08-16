window.SpellDeck = window.SpellDeck || {};

(function (SD) {
  function klassOf(data) {
    const prep = data && data.metadata && data.metadata.preparation;
    const list = prep && Array.isArray(prep.classes) ? prep.classes : [];
    return list[0] || {};
  }

  function classLine(klass) {
    const bits = [klass.name, klass.subclass, klass.level != null ? "Level " + klass.level : ""]
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    return bits.join(" · ") || "Imported character";
  }

  function reliableSlots(prep, klass) {
    const raw = (klass && klass.spellSlots) || (prep && prep.spellSlots) || null;
    if (Array.isArray(raw) && raw.length) return raw;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    return null;
  }

  SD.parseSnapshot = function parseSnapshot(data) {
    if (!data || typeof data !== "object" || !Array.isArray(data.spells)) {
      throw new Error("This file is not a Spell Pool export.");
    }
    const prep = data.metadata && data.metadata.preparation;
    const klass = klassOf(data);
    const budget = Number(klass.preparedMax);
    if (!Number.isFinite(budget) || budget < 1) {
      throw new Error("This export has no preparation budget.");
    }
    const name = String((prep && prep.characterName) || "").trim() || "Imported character";
    return {
      name,
      classLine: classLine(klass),
      budget,
      spellSlots: reliableSlots(prep, klass),
      spells: data.spells,
      preparedUsed: Number(klass.preparedUsed) || 0
    };
  };
}(window.SpellDeck));
