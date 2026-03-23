(function () {
  "use strict";

  var SOURCE_PRIORITY = {
    XPHB: 100,
    PHB: 90
  };

  function getSourceScore(source) {
    return SOURCE_PRIORITY[source] || 10;
  }

  function getSpellKey(spell) {
    return String((spell && spell.name) || "").trim().toLowerCase();
  }

  function fetchJson(path) {
    return fetch(path).then(function (res) {
      if (!res.ok) {
        throw new Error("Failed to fetch " + path + " (" + res.status + ")");
      }
      return res.json();
    });
  }

  function shouldReplace(currentSpell, incomingSpell) {
    var currentScore = getSourceScore(currentSpell && currentSpell.source);
    var incomingScore = getSourceScore(incomingSpell && incomingSpell.source);
    if (incomingScore !== currentScore) return incomingScore > currentScore;
    return false;
  }

  function mergeAndDedupe(spellFilePayloads) {
    var byName = {};

    spellFilePayloads.forEach(function (payload) {
      var spells = (payload && payload.spell) || [];
      spells.forEach(function (spell) {
        var key = getSpellKey(spell);
        if (!key) return;
        if (!byName[key] || shouldReplace(byName[key], spell)) {
          byName[key] = spell;
        }
      });
    });

    return Object.keys(byName)
      .map(function (k) {
        return byName[k];
      })
      .sort(function (a, b) {
        var levelA = Number(a.level) || 0;
        var levelB = Number(b.level) || 0;
        if (levelA !== levelB) return levelA - levelB;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }

  function loadAllRawSpells() {
    return fetchJson("./spells/index.json")
      .then(function (sourceMap) {
        var files = Object.keys(sourceMap || {}).map(function (sourceCode) {
          return "./spells/" + sourceMap[sourceCode];
        });
        return Promise.all(files.map(fetchJson));
      })
      .then(mergeAndDedupe);
  }

  window.SpellDataLoader = {
    loadAllRawSpells: loadAllRawSpells
  };
})();
