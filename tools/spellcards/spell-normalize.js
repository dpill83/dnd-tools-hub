(function () {
  "use strict";

  function titleCase(word) {
    return String(word || "")
      .toLowerCase()
      .replace(/(^|\s|-)\w/g, function (m) {
        return m.toUpperCase();
      });
  }

  function clean5eTags(text) {
    if (!text) return "";
    var out = String(text);
    out = out.replace(/\{@[^}\s]+\s+([^}]+)\}/g, function (_, inner) {
      return String(inner).split("|")[0];
    });
    out = out.replace(/\{@[^}]+\}/g, "");
    return out.replace(/\s+/g, " ").trim();
  }

  function renderEntry(entry) {
    if (entry == null) return "";
    if (typeof entry === "string") return clean5eTags(entry);
    if (Array.isArray(entry)) {
      return entry.map(renderEntry).filter(Boolean).join("\n\n");
    }
    if (entry.type === "list" && Array.isArray(entry.items)) {
      return entry.items
        .map(function (item) {
          return "• " + renderEntry(item);
        })
        .join("\n");
    }
    if (entry.type === "entries" && Array.isArray(entry.entries)) {
      var heading = entry.name ? clean5eTags(entry.name) + "\n" : "";
      return heading + entry.entries.map(renderEntry).filter(Boolean).join("\n\n");
    }
    if (entry.entry) return renderEntry(entry.entry);
    if (Array.isArray(entry.entries)) return entry.entries.map(renderEntry).filter(Boolean).join("\n\n");
    return clean5eTags(JSON.stringify(entry));
  }

  function formatTime(time) {
    if (!Array.isArray(time) || !time.length) return "";
    var t = time[0];
    if (!t) return "";
    var count = t.number != null ? String(t.number) : "1";
    var unit = String(t.unit || "action");
    return count + " " + unit + (count === "1" ? "" : "s");
  }

  function formatRange(range) {
    if (!range || typeof range !== "object") return "";
    var d = range.distance || {};
    if (d.type === "self") return "Self";
    if (d.type === "touch") return "Touch";
    if (d.type === "sight") return "Sight";
    if (d.type === "unlimited") return "Unlimited";
    if (d.type === "feet" && d.amount != null) return d.amount + " feet";
    if (d.type === "miles" && d.amount != null) return d.amount + " miles";
    return titleCase(d.type || range.type || "");
  }

  function formatComponents(components) {
    if (!components || typeof components !== "object") return "";
    var parts = [];
    if (components.v) parts.push("V");
    if (components.s) parts.push("S");
    if (components.m) {
      var mat = "";
      if (typeof components.m === "string") mat = components.m;
      else if (components.m && typeof components.m.text === "string") mat = components.m.text;
      parts.push(mat ? "M (" + clean5eTags(mat) + ")" : "M");
    }
    return parts.join(", ");
  }

  function formatDuration(duration) {
    if (!Array.isArray(duration) || !duration.length) return "";
    var d = duration[0];
    if (!d) return "";
    if (d.type === "instant") return "Instantaneous";
    if (d.type === "permanent") return "Until dispelled";
    if (d.type === "special") return "Special";
    if (d.type === "timed" && d.duration) {
      var base = d.duration.amount + " " + d.duration.type + (d.duration.amount === 1 ? "" : "s");
      return d.concentration ? "Concentration, up to " + base : base;
    }
    return titleCase(d.type);
  }

  function classNamesForSpell(spell, classMapBySource) {
    var sourceBucket = classMapBySource[spell.source] || {};
    var fromSameSource = sourceBucket[spell.name] || null;
    var sourceInfo = fromSameSource;

    if (!sourceInfo) {
      var keys = Object.keys(classMapBySource);
      for (var i = 0; i < keys.length; i += 1) {
        var maybe = classMapBySource[keys[i]][spell.name];
        if (maybe) {
          sourceInfo = maybe;
          break;
        }
      }
    }

    var classEntries = (sourceInfo && (sourceInfo.class || sourceInfo.classVariant)) || [];
    var uniq = {};
    classEntries.forEach(function (c) {
      if (c && c.name) uniq[c.name] = true;
    });
    return Object.keys(uniq).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function buildClassMapBySource(rawSources) {
    var bySource = {};
    Object.keys(rawSources || {}).forEach(function (src) {
      bySource[src] = rawSources[src] || {};
    });
    return bySource;
  }

  function fetchClassMap() {
    return fetch("./spells/sources.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to fetch spell class mapping");
        return res.json();
      })
      .then(buildClassMapBySource);
  }

  function normalizeSpell(spell, classMapBySource) {
    var description = renderEntry(spell.entries || []);
    var higherLevels = "";
    if (Array.isArray(spell.entriesHigherLevel) && spell.entriesHigherLevel.length) {
      higherLevels = renderEntry(spell.entriesHigherLevel);
      higherLevels = higherLevels.replace(/^At Higher Levels\s*/i, "").trim();
    }

    var classNames = classNamesForSpell(spell, classMapBySource);

    return {
      name: spell.name || "",
      level: Number(spell.level) || 0,
      school: spell.school || "",
      time: formatTime(spell.time),
      range: formatRange(spell.range),
      components: formatComponents(spell.components),
      duration: formatDuration(spell.duration),
      classes: classNames.join(", "),
      ritual: !!(spell.meta && spell.meta.ritual),
      description: description,
      higherLevels: higherLevels
    };
  }

  function normalizeSpells(rawSpells) {
    return fetchClassMap().then(function (classMapBySource) {
      return (rawSpells || []).map(function (spell) {
        return normalizeSpell(spell, classMapBySource);
      });
    });
  }

  window.SpellNormalize = {
    normalizeSpells: normalizeSpells
  };
})();
