// Cast Viewer identity (cast-identity/v1) → complete .monster object.
// Deterministic clone/overlay only. Does not keep identity keys on the result.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.CastIdentity = api;
})(typeof window !== "undefined" ? window : this, function () {
    var RANKS = { minion: true, standard: true, lieutenant: true, boss: true };
    var COMBAT_ROLES = {
        brute: { str: 16, dex: 10, con: 16, int: 8, wis: 10, cha: 8, armor: "natural armor", nat: 2, speed: 30, atk: "str", skill: null, save: "con" },
        soldier: { str: 14, dex: 12, con: 14, int: 10, wis: 12, cha: 10, armor: "chain mail", nat: 0, speed: 30, atk: "str", skill: null, save: "str" },
        skirmisher: { str: 12, dex: 16, con: 12, int: 10, wis: 12, cha: 10, armor: "leather armor", nat: 0, speed: 40, atk: "dex", skill: "stealth", save: "dex" },
        artillery: { str: 10, dex: 16, con: 12, int: 12, wis: 12, cha: 10, armor: "leather armor", nat: 0, speed: 30, atk: "dex", skill: "perception", save: "dex" },
        controller: { str: 10, dex: 12, con: 12, int: 16, wis: 14, cha: 12, armor: "none", nat: 0, speed: 30, atk: "int", skill: "arcana", save: "int" },
        lurker: { str: 12, dex: 16, con: 12, int: 10, wis: 14, cha: 8, armor: "leather armor", nat: 0, speed: 30, atk: "dex", skill: "stealth", save: "dex" },
        leader: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 16, armor: "chain shirt", nat: 0, speed: 30, atk: "str", skill: "persuasion", save: "cha" }
    };
    var KNOWN_FLAGS = {
        named: 1, "no-legendary": 1, legendary: 1, "no-fly": 1, "no-swim": 1, "no-burrow": 1,
        undead: 1, construct: 1, fiend: 1, "no-magic": 1, "recharge-ok": 1, "no-recharge": 1
    };
    var IDENTITY_ONLY = {
        schema: 1, kind: 1, rank: 1, role: 1, combatRole: 1, look: 1, base: 1, ref: 1,
        clone: 1, fixed: 1, fixedText: 1, flags: 1, edition: 1, appearsIn: 1, portraitPrompt: 1
    };
    var SKILL_STAT = {
        acrobatics: "dex", "animal handling": "wis", arcana: "int", athletics: "str", deception: "cha",
        history: "int", insight: "wis", intimidation: "cha", investigation: "int", medicine: "wis",
        nature: "int", perception: "wis", performance: "cha", persuasion: "cha", religion: "int",
        "sleight of hand": "dex", stealth: "dex", survival: "wis"
    };

    function blankMonster() {
        return {
            name: "Monster", size: "medium", type: "humanoid", tag: "", alignment: "any alignment",
            hitDice: 5, armorName: "none", shieldBonus: 0, natArmorBonus: 3, otherArmorDesc: "10 (armor)",
            speed: 30, burrowSpeed: 0, climbSpeed: 0, flySpeed: 0, hover: false, swimSpeed: 0,
            customHP: false, customSpeed: false, hpText: "4 (1d8)", speedDesc: "30 ft.",
            strPoints: 10, dexPoints: 10, conPoints: 10, intPoints: 10, wisPoints: 10, chaPoints: 10,
            blindsight: 0, blind: false, darkvision: 0, tremorsense: 0, truesight: 0, telepathy: 0,
            cr: 1, customCr: "", customProf: 2, isLegendary: false, legendariesDescription: "",
            isLair: false, lairDescription: "", lairDescriptionEnd: "", isMythic: false, mythicDescription: "",
            isRegional: false, regionalDescription: "", regionalDescriptionEnd: "",
            properties: [], abilities: [], actions: [], bonusActions: [], reactions: [],
            legendaries: [], mythics: [], lairs: [], regionals: [], sthrows: [], skills: [],
            damagetypes: [], specialdamage: [], conditions: [], languages: [], understandsBut: "",
            shortName: "", pluralName: "", doubleColumns: false, separationPoint: null
        };
    }

    function unwrapJsonText(text) {
        var raw = String(text || "").trim();
        var fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
        return fenced ? fenced[1].trim() : raw;
    }

    function isIdentity(obj) {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
        if (obj.schema === "cast-identity/v1") return true;
        if (obj.strPoints != null && (obj.actions !== undefined || obj.hitDice != null)) return false;
        return obj.kind != null && (obj.rank != null || obj.fixed != null || obj.fixedText != null);
    }

    function collectMembers(parsed) {
        if (Array.isArray(parsed)) return parsed.filter(isIdentity);
        if (parsed && Array.isArray(parsed.cast)) return parsed.cast.filter(isIdentity);
        if (parsed && Array.isArray(parsed.members)) return parsed.members.filter(isIdentity);
        if (isIdentity(parsed)) return [parsed];
        return [];
    }

    function isCombatCapable(obj) {
        var flags = Array.isArray(obj.flags) ? obj.flags : [];
        if (flags.indexOf("non-combat") >= 0) return false;
        if (obj.fixedText && String(obj.fixedText).trim()) return true;
        if (obj.cr != null && obj.cr !== "") return true;
        if (obj.rank === "lieutenant" || obj.rank === "boss" || obj.rank === "minion") return true;
        if (obj.combatRole) return true;
        if (obj.combat && (obj.combat.summary || obj.combat.fullStatBlock)) return true;
        return false;
    }

    function pickDefaultMember(members) {
        for (var i = 0; i < members.length; i++) {
            if (isCombatCapable(members[i])) return members[i];
        }
        return members[0] || null;
    }

    function isNoClone(base) {
        var b = String(base || "").trim().toLowerCase();
        return !b || b === "custom" || b === "none" || b === "-";
    }

    function crNumber(cr) {
        if (cr === "1/8") return 0.125;
        if (cr === "1/4") return 0.25;
        if (cr === "1/2") return 0.5;
        var n = typeof cr === "number" ? cr : parseFloat(cr);
        return isFinite(n) ? n : 1;
    }

    function crKey(cr, crsTable) {
        if (cr == null || cr === "") return "1";
        if (crsTable && crsTable[cr] != null) return String(cr);
        var n = crNumber(cr);
        if (n === 0) return "0";
        if (n === 0.125) return "1/8";
        if (n === 0.25) return "1/4";
        if (n === 0.5) return "1/2";
        if (Number.isInteger(n) && n >= 1 && n <= 30) return String(n);
        return String(cr);
    }

    function defaultCombatRole(identity) {
        var role = String(identity.combatRole || "").trim().toLowerCase();
        if (COMBAT_ROLES[role]) return role;
        if (identity.kind === "monster") return "brute";
        if (identity.rank === "boss") return "leader";
        return "soldier";
    }

    function completeMonster(partial) {
        var out = blankMonster();
        if (!partial || typeof partial !== "object") return out;
        Object.keys(out).forEach(function (k) {
            if (partial[k] === undefined) return;
            try {
                out[k] = JSON.parse(JSON.stringify(partial[k]));
            } catch (e) {
                out[k] = partial[k];
            }
        });
        return out;
    }

    function parseFixedText(text) {
        var out = {};
        var raw = String(text || "");
        if (!raw.trim()) return out;
        var ac = raw.match(/\bAC\s+(\d+(?:\s*\([^)]+\))?)/i);
        if (ac) {
            out.armorName = "other";
            out.otherArmorDesc = ac[1].trim();
        }
        var hp = raw.match(/\bHP\s+(\d+(?:\s*\([^)]+\))?)/i);
        if (hp) {
            out.hpText = hp[1].trim();
            out.customHP = true;
        }
        return out;
    }

    function addSkill(mon, name) {
        var key = String(name || "").toLowerCase();
        var stat = SKILL_STAT[key];
        if (!stat) return;
        if (mon.skills.some(function (s) { return s.name.toLowerCase() === key; })) return;
        mon.skills.push({ name: key, stat: stat });
    }

    function addSthrow(mon, name) {
        var order = { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 };
        if (order[name] == null) return;
        if (mon.sthrows.some(function (s) { return s.name === name; })) return;
        mon.sthrows.push({ name: name, order: order[name] });
        mon.sthrows.sort(function (a, b) { return a.order - b.order; });
    }

    function addLang(mon, name) {
        if (!name) return;
        if (mon.languages.some(function (l) { return l.name.toLowerCase() === name.toLowerCase(); })) return;
        mon.languages.push({ name: name });
    }

    function attackName(identity, spec, role) {
        if (spec.atk === "dex" && spec.armor === "leather armor" && identity.kind === "monster") return "Bite";
        if (spec.atk === "int") return "Mind Spike";
        if (spec.atk === "dex") return role === "artillery" ? "Shortbow" : "Shortsword";
        return identity.kind === "monster" ? "Slam" : "Longsword";
    }

    function attackDesc(spec, role) {
        var abil = spec.atk.toUpperCase();
        var melee = spec.atk !== "dex" || role !== "artillery";
        if (spec.atk === "int") {
            return "_Ranged Spell Attack:_ [" + abil + " ATK] to hit, range 60 ft., one target. _Hit:_ [" + abil + " 2D6] psychic damage.";
        }
        if (!melee) {
            return "_Ranged Weapon Attack:_ [" + abil + " ATK] to hit, range 80/320 ft., one target. _Hit:_ [" + abil + " 1D8] piercing damage.";
        }
        var dmg = spec.atk === "dex" ? "piercing" : "slashing";
        return "_Melee Weapon Attack:_ [" + abil + " ATK] to hit, reach 5 ft., one target. _Hit:_ [" + abil + " 1D8] " + dmg + " damage.";
    }

    function standardHitDice(crNum) {
        return Math.max(1, Math.round(2 + crNum * 2.2));
    }

    function ensureAttack(mon, identity) {
        if (mon.actions.length) return;
        var role = defaultCombatRole(identity);
        var spec = COMBAT_ROLES[role];
        mon.actions.push({ name: attackName(identity, spec, role), desc: attackDesc(spec, role) });
    }

    function fillSkeleton(mon, identity, opts) {
        var role = defaultCombatRole(identity);
        var spec = COMBAT_ROLES[role];
        var crNum = crNumber(mon.cr);
        var bump = Math.min(6, Math.floor(crNum / 4));
        mon.strPoints = spec.str + (spec.atk === "str" ? bump : 0);
        mon.dexPoints = spec.dex + (spec.atk === "dex" ? bump : 0);
        mon.conPoints = spec.con + bump;
        mon.intPoints = spec.int + (spec.atk === "int" ? bump : 0);
        mon.wisPoints = spec.wis;
        mon.chaPoints = spec.cha + (role === "leader" ? bump : 0);
        mon.armorName = spec.armor;
        mon.natArmorBonus = spec.nat;
        mon.speed = spec.speed;
        mon.hitDice = standardHitDice(crNum);
        addSthrow(mon, spec.save);
        if (spec.skill) addSkill(mon, spec.skill);
        if (identity.kind === "npc") {
            addLang(mon, "Common");
            if (identity.tag) addLang(mon, identity.tag.charAt(0).toUpperCase() + identity.tag.slice(1));
        }
        var darkTypes = { undead: 1, fiend: 1, aberration: 1, monstrosity: 1, ooze: 1 };
        var darkTags = { goblin: 1, orc: 1, elf: 1, drow: 1, kobold: 1 };
        if (darkTypes[mon.type] || darkTags[String(mon.tag || "").toLowerCase()]) mon.darkvision = 60;
        if (identity.kind === "monster" && mon.type !== "humanoid") mon.darkvision = Math.max(mon.darkvision, 60);
        ensureAttack(mon, identity);
        var crs = opts && opts.data && opts.data.crs;
        var key = crKey(mon.cr, crs);
        if (crs && crs[key]) mon.customProf = crs[key].prof;
    }

    function applyRank(mon, rank, hadClone) {
        if (rank === "minion") {
            mon.hitDice = 1;
            return;
        }
        if (!hadClone) {
            if (rank === "lieutenant") mon.hitDice = Math.max(mon.hitDice, Math.round(mon.hitDice * 1.75));
            if (rank === "boss") mon.hitDice = Math.max(mon.hitDice, Math.round(mon.hitDice * 2.5));
        } else {
            if (rank === "lieutenant") mon.hitDice = Math.round(mon.hitDice * 1.75);
            if (rank === "boss") mon.hitDice = Math.round(mon.hitDice * 2.5);
        }
        if (rank === "lieutenant" || rank === "boss") {
            var hasMulti = mon.actions.some(function (a) { return /multiattack/i.test(a.name); });
            if (!hasMulti && mon.actions.length) {
                mon.actions.unshift({
                    name: "Multiattack",
                    desc: "The [MON] makes two attacks."
                });
            }
        }
        if (rank === "boss") {
            mon.isLegendary = true;
            if (!mon.legendaries.length) {
                mon.legendaries = [
                    { name: "Attack", desc: "The [MON] makes one attack." },
                    { name: "Move", desc: "The [MON] moves up to its speed without provoking opportunity attacks." },
                    { name: "Detect", desc: "The [MON] makes a Wisdom (Perception) check." }
                ];
            }
            if (!mon.legendariesDescription) {
                mon.legendariesDescription = "The " + (mon.name || "creature") + " can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The " + (mon.name || "creature") + " regains spent legendary actions at the start of its turn.";
            }
            mon.doubleColumns = true;
        }
    }

    function applyFlags(mon, flags) {
        (flags || []).forEach(function (flag) {
            if (!KNOWN_FLAGS[flag]) return;
            if (flag === "no-legendary") {
                mon.isLegendary = false;
                mon.legendaries = [];
                mon.legendariesDescription = "";
            }
            if (flag === "legendary") mon.isLegendary = true;
            if (flag === "no-fly") { mon.flySpeed = 0; mon.hover = false; }
            if (flag === "no-swim") mon.swimSpeed = 0;
            if (flag === "no-burrow") mon.burrowSpeed = 0;
            if (flag === "undead") {
                mon.type = "undead";
                mon.damagetypes.push({ name: "poison", note: "", type: "i" });
                mon.conditions.push({ name: "poisoned" });
                mon.conditions.push({ name: "exhaustion" });
            }
            if (flag === "construct") {
                mon.type = "construct";
                mon.damagetypes.push({ name: "poison", note: "", type: "i" });
                mon.conditions.push({ name: "poisoned" }, { name: "charmed" }, { name: "exhaustion" });
            }
            if (flag === "fiend") mon.type = "fiend";
            if (flag === "no-magic") {
                ["abilities", "actions", "bonusActions"].forEach(function (arr) {
                    mon[arr] = mon[arr].filter(function (a) {
                        return !/spellcasting/i.test(a.name || "") && !/spellcasting/i.test(a.desc || "");
                    });
                });
            }
            if (flag === "no-recharge") {
                ["abilities", "actions", "bonusActions", "reactions"].forEach(function (arr) {
                    mon[arr] = mon[arr].filter(function (a) { return !/recharge/i.test(a.name || ""); });
                });
            }
        });
    }

    function applyFixed(mon, fixed) {
        if (!fixed || typeof fixed !== "object" || Array.isArray(fixed)) return;
        Object.keys(fixed).forEach(function (k) {
            if (IDENTITY_ONLY[k] || !Object.prototype.hasOwnProperty.call(mon, k)) return;
            mon[k] = fixed[k];
        });
        if (fixed.hpText != null && fixed.customHP === undefined) mon.customHP = true;
    }

    function overlayIdentity(mon, identity) {
        if (identity.name) mon.name = String(identity.name).trim();
        if (identity.size) mon.size = String(identity.size).trim().toLowerCase();
        if (identity.type) mon.type = String(identity.type).trim().toLowerCase();
        if (identity.tag != null) mon.tag = String(identity.tag).trim();
        if (identity.cr != null && identity.cr !== "") mon.cr = identity.cr;
        if (identity.alignment) mon.alignment = String(identity.alignment).trim();
    }

    function scaleHitDiceForCr(mon, fromCr, toCr) {
        var a = crNumber(fromCr);
        var b = crNumber(toCr);
        if (a === b) return;
        mon.hitDice = Math.max(1, Math.round(mon.hitDice * (b + 1) / (a + 1)));
    }

    function expand(identity, opts) {
        opts = opts || {};
        var clone = opts.clone ? completeMonster(opts.clone) : null;
        var hadClone = !!clone;
        var mon = clone || blankMonster();
        var rank = RANKS[identity.rank] ? identity.rank : "standard";
        var cloneCr = hadClone ? mon.cr : null;
        overlayIdentity(mon, identity);
        if (!hadClone) fillSkeleton(mon, identity, opts);
        else if (identity.cr != null && identity.cr !== "" && cloneCr != null) scaleHitDiceForCr(mon, cloneCr, identity.cr);
        if (!hadClone || rank !== "standard") applyRank(mon, rank, hadClone);
        ensureAttack(mon, identity);
        applyFlags(mon, identity.flags);
        var parsedText = parseFixedText(identity.fixedText);
        var structured = identity.fixed && typeof identity.fixed === "object" ? identity.fixed : {};
        Object.keys(parsedText).forEach(function (k) {
            if (structured[k] === undefined) mon[k] = parsedText[k];
        });
        applyFixed(mon, structured);
        var crs = opts.data && opts.data.crs;
        var key = crKey(mon.cr, crs);
        if (crs && crs[key]) mon.customProf = crs[key].prof;
        mon.separationPoint = null;
        return completeMonster(mon);
    }

    function noteText(identity, usedClone) {
        var parts = ["Expanded from identity"];
        if (identity.base && !isNoClone(identity.base)) parts.push("base: " + identity.base);
        else if (usedClone) parts.push("cloned");
        else parts.push("base: custom");
        if (identity.cr != null && identity.cr !== "") parts.push("CR " + identity.cr);
        if (identity.rank) parts.push(identity.rank);
        if (identity.combatRole) parts.push(identity.combatRole);
        return parts.join(" · ");
    }

    return {
        unwrapJsonText: unwrapJsonText,
        isIdentity: isIdentity,
        collectMembers: collectMembers,
        isCombatCapable: isCombatCapable,
        pickDefaultMember: pickDefaultMember,
        isNoClone: isNoClone,
        parseFixedText: parseFixedText,
        expand: expand,
        completeMonster: completeMonster,
        blankMonster: blankMonster,
        noteText: noteText,
        crKey: crKey
    };
});
