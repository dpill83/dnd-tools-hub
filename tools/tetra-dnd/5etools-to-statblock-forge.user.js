// ==UserScript==
// @name         5etools filtered Bestiary to Statblock Forge
// @namespace    dnd-tools-hub/statblock-forge
// @version      1.0.0
// @description  Export the current Bestiary search and filters as a Statblock Forge catalog.
// @match        https://5e.tools/bestiary.html*
// @match        https://www.5e.tools/bestiary.html*
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    const page = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const CATALOG_FORMAT = "statblock-forge/5etools-catalog/v1";
    const SIZE = {T: "tiny", S: "small", M: "medium", L: "large", H: "huge", G: "gargantuan"};
    const ALIGN = {L: "lawful", N: "neutral", C: "chaotic", G: "good", E: "evil", U: "unaligned", A: "any alignment"};
    const SKILL_STAT = {
        acrobatics: "dex", animalhandling: "wis", arcana: "int", athletics: "str",
        deception: "cha", history: "int", insight: "wis", intimidation: "cha",
        investigation: "int", medicine: "wis", nature: "int", perception: "wis",
        performance: "cha", persuasion: "cha", religion: "int", sleightofhand: "dex",
        stealth: "dex", survival: "wis"
    };

    function htmlText(html) {
        const el = document.createElement("div");
        el.innerHTML = String(html).replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div|li|tr|ul|ol)>/gi, "\n");
        return el.textContent.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    }

    function renderText(value) {
        if (value == null) return "";
        if (typeof value !== "string") return String(value);
        try { return htmlText(page.Renderer.get().render(value)); }
        catch (_) { return value.replace(/\{@\w+ ([^}|]+)(?:\|[^}]*)?}/g, "$1"); }
    }

    function entryText(entries) {
        if (!entries) return "";
        const list = Array.isArray(entries) ? entries : [entries];
        return list.map(entry => {
            if (typeof entry === "string") return renderText(entry);
            if (entry && typeof entry === "object") {
                try { return htmlText(page.Renderer.get().render(entry)); }
                catch (_) { return entryText(entry.entries || entry.items || ""); }
            }
            return String(entry);
        }).filter(Boolean).join("\n");
    }

    function spellcastingText(spellcasting) {
        const lines = [entryText(spellcasting.headerEntries)];
        const add = (label, list) => {
            if (Array.isArray(list) && list.length) lines.push(label + ": " + list.map(renderText).join(", "));
        };
        add("At will", spellcasting.will);
        for (const [key, value] of Object.entries(spellcasting.daily || {})) add(key.replace(/e$/, "") + "/day", value);
        for (const [key, value] of Object.entries(spellcasting.rest || {})) add(key.replace(/e$/, "") + "/rest", value);
        for (const [key, value] of Object.entries(spellcasting.weekly || {})) add(key.replace(/e$/, "") + "/week", value);
        for (const [key, value] of Object.entries(spellcasting.spells || {})) add("Level " + key, value.spells || value);
        lines.push(entryText(spellcasting.footerEntries));
        return lines.filter(Boolean).join("\n");
    }

    function actionItems(mon, key) {
        return (Array.isArray(mon[key]) ? mon[key] : []).map(item => ({
            name: renderText(item.name || ""),
            desc: entryText(item.entries || item.entry || item.headerEntries || [])
        }));
    }

    function groupItems(entries, defaultName) {
        return (Array.isArray(entries) ? entries : []).map(item => ({
            name: renderText(item.name || defaultName),
            desc: entryText(item.entries || item.entry || item)
        }));
    }

    function addSpellcasting(mon, result) {
        for (const sc of Array.isArray(mon.spellcasting) ? mon.spellcasting : []) {
            const bucket = {action: "actions", bonus: "bonusActions", reaction: "reactions", trait: "abilities"}[sc.displayAs] || "abilities";
            result[bucket].push({name: renderText(sc.name || "Spellcasting"), desc: spellcastingText(sc)});
        }
    }

    function alignment(value) {
        if (typeof value === "string") return ALIGN[value] || value;
        if (!Array.isArray(value) || !value.length) return "unaligned";
        if (typeof value[0] === "object") return value.map(it => alignment(it.alignment || it)).join(" or ");
        if (value.length === 2 && value[0] === "N" && value[1] === "N") return "neutral";
        return value.map(it => ALIGN[it] || it).join(" ");
    }

    function crNumber(cr) {
        const value = typeof cr === "object" ? cr.cr : cr;
        if (typeof value === "number") return value;
        const s = String(value || "0");
        if (s.includes("/")) { const [a, b] = s.split("/").map(Number); return a / b; }
        return Number(s);
    }

    function speedNumber(value) {
        if (value && typeof value === "object") value = value.number;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
    }

    function speedPart(key, value) {
        const number = speedNumber(value);
        if (!number) return "";
        const condition = value && typeof value === "object" ? renderText(value.condition || "") : "";
        return (key === "walk" ? "" : key + " ") + number + " ft." + (condition ? " " + condition : "");
    }

    function damageList(values, type, result) {
        for (const value of Array.isArray(values) ? values : []) {
            if (typeof value === "string") result.damagetypes.push({name: value, note: "", type});
            else if (value && typeof value === "object") {
                const name = [value.vulnerable, value.resist, value.immune].flat().filter(Boolean).join(", ");
                const note = renderText(value.note || value.preNote || "");
                result.specialdamage.push({name: [note, name].filter(Boolean).join(" ") || entryText(value), note: "", type});
            }
        }
    }

    function convert(mon) {
        if (!mon || !mon.name || !mon.source || !mon.hp || !mon.ac || !mon.speed || mon.str == null)
            throw new Error("Incomplete Bestiary record: " + (mon && mon.name || "unknown"));
        const type = typeof mon.type === "string" ? mon.type : mon.type.type;
        const tag = typeof mon.type === "object" && mon.type.tags
            ? mon.type.tags.map(it => typeof it === "string" ? it : it.tag).join(", ") : "";
        const size = Array.isArray(mon.size) ? mon.size[0] : mon.size;
        const ac = Array.isArray(mon.ac) ? mon.ac[0] : mon.ac;
        const acValue = typeof ac === "number" ? ac : ac && ac.ac;
        const acFrom = typeof ac === "object" && ac.from ? ac.from.map(renderText).join(", ") : "";
        const acText = String(acValue) + (acFrom ? " (" + acFrom + ")" : "");
        const hp = mon.hp.special ? renderText(mon.hp.special) :
            String(mon.hp.average) + (mon.hp.formula ? " (" + mon.hp.formula + ")" : "");
        const speeds = ["walk", "burrow", "climb", "fly", "swim"];
        const speedDesc = speeds.map(key => speedPart(key, mon.speed[key])).filter(Boolean).join(", ") || entryText(mon.speed.special);
        const cr = crNumber(mon.cr);
        if (!Number.isFinite(cr) || !Number.isFinite(Number(acValue)) || !hp)
            throw new Error("Unsupported core stats: " + mon.name);
        const prof = Math.max(2, Math.ceil(cr / 4) + 1);
        const result = {
            name: mon.name, listLabel: mon.name + " (" + mon.source + ")",
            size: SIZE[size] || "medium", type: String(type || "humanoid").toLowerCase(), tag,
            alignment: alignment(mon.alignment),
            hitDice: Number((mon.hp.formula || "").match(/^(\d+)d/i)?.[1] || 0),
            armorName: "other", shieldBonus: 0, natArmorBonus: 0, otherArmorDesc: acText,
            speed: speedNumber(mon.speed.walk), burrowSpeed: speedNumber(mon.speed.burrow),
            climbSpeed: speedNumber(mon.speed.climb), flySpeed: speedNumber(mon.speed.fly),
            swimSpeed: speedNumber(mon.speed.swim), hover: !!mon.speed.canHover,
            customHP: true, customSpeed: true, hpText: hp, speedDesc,
            strPoints: Number(mon.str), dexPoints: Number(mon.dex), conPoints: Number(mon.con),
            intPoints: Number(mon.int), wisPoints: Number(mon.wis), chaPoints: Number(mon.cha),
            blindsight: 0, blind: false, darkvision: 0, tremorsense: 0, truesight: 0, telepathy: 0,
            cr, customCr: "", customProf: prof,
            isLegendary: false, legendariesDescription: "", isLair: false, lairDescription: "",
            lairDescriptionEnd: "", isMythic: false, mythicDescription: "", isRegional: false,
            regionalDescription: "", regionalDescriptionEnd: "", properties: [],
            abilities: actionItems(mon, "trait"), actions: actionItems(mon, "action"),
            bonusActions: actionItems(mon, "bonus"), reactions: actionItems(mon, "reaction"),
            legendaries: actionItems(mon, "legendary"), mythics: actionItems(mon, "mythic"),
            lairs: [], regionals: [], sthrows: [], skills: [], damagetypes: [], specialdamage: [],
            conditions: [], languages: [], understandsBut: "", shortName: "", pluralName: "",
            doubleColumns: false, separationPoint: null,
            sourceSaveBonuses: {}, sourceSkillBonuses: {},
            sourcePassivePerception: Number.isFinite(Number(mon.passive)) ? Number(mon.passive) : null
        };
        result.isLegendary = result.legendaries.length > 0;
        result.isMythic = result.mythics.length > 0;
        if (mon.legendaryHeader) result.legendariesDescription = entryText(mon.legendaryHeader);
        if (mon.mythicHeader) result.mythicDescription = entryText(mon.mythicHeader);
        try {
            const group = page.DataUtil.monster.getLegendaryGroup(mon);
            if (group) {
                result.lairs = groupItems(group.lairActions, "Lair Action");
                result.regionals = groupItems(group.regionalEffects, "Regional Effect");
                result.isLair = result.lairs.length > 0;
                result.isRegional = result.regionals.length > 0;
            }
        } catch (_) { /* Some Bestiary builds do not expose legendary groups. */ }
        addSpellcasting(mon, result);
        for (const stat of ["str", "dex", "con", "int", "wis", "cha"]) {
            if (mon.save && mon.save[stat] != null) {
                result.sthrows.push({name: stat, order: result.sthrows.length});
                result.sourceSaveBonuses[stat] = Number(mon.save[stat]);
            }
        }
        for (const [skill, bonus] of Object.entries(mon.skill || {})) {
            if (skill === "other") continue;
            const key = skill.toLowerCase().replace(/[^a-z]/g, "");
            if (!SKILL_STAT[key]) continue;
            const skillName = skill.replace(/([a-z])([A-Z])/g, "$1 $2");
            result.skills.push({name: skillName, stat: SKILL_STAT[key]});
            result.sourceSkillBonuses[skillName] = Number(bonus);
        }
        damageList(mon.vulnerable, "v", result);
        damageList(mon.resist, "r", result);
        damageList(mon.immune, "i", result);
        for (const c of mon.conditionImmune || []) {
            if (typeof c === "string") result.conditions.push({name: c});
            else if (c && Array.isArray(c.conditionImmune)) {
                for (const condition of c.conditionImmune) result.conditions.push({name: condition});
            }
        }
        for (const sense of mon.senses || []) {
            const s = renderText(sense);
            const match = s.match(/^(blindsight|darkvision|tremorsense|truesight)\s+(\d+)/i);
            if (match) result[match[1].toLowerCase()] = Number(match[2]);
            if (/blind beyond/i.test(s)) result.blind = true;
        }
        for (const language of mon.languages || []) {
            const s = renderText(language);
            const tel = s.match(/telepathy\s+(\d+)/i);
            if (tel) result.telepathy = Number(tel[1]);
            const spoken = s.replace(/;?\s*telepathy\s+\d+\s*ft\.?/i, "").replace(/[;,\s]+$/, "").trim();
            if (spoken && spoken !== "—") result.languages.push({name: spoken});
        }
        result.doubleColumns = result.isLegendary || result.isMythic ||
            result.abilities.length + result.actions.length + result.bonusActions.length + result.reactions.length > 7;
        return result;
    }

    function slug(mon) {
        return (mon.source + "-" + mon.name).toLowerCase().normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }

    function download(data, name) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: "application/json"}));
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    function exportFiltered(button) {
        const bestiary = page.bestiaryPage;
        if (!bestiary || typeof bestiary._getEncounterBuilderCreatures !== "function")
            throw new Error("Bestiary data is still loading. Try again after the list appears.");
        const records = Array.from(bestiary._getEncounterBuilderCreatures());
        if (!records.length) throw new Error("The current filter has no monsters.");
        const monsters = Object.create(null);
        const source = [];
        const sourceLegendaryGroups = Object.create(null);
        for (const record of records) {
            const key = slug(record);
            if (!key || monsters[key]) throw new Error("Duplicate monster key: " + key);
            monsters[key] = convert(record);
            source.push(record);
            try {
                const group = page.DataUtil.monster.getLegendaryGroup(record);
                if (group) sourceLegendaryGroups[key] = group;
            } catch (_) { /* See convert(). */ }
        }
        const onlyXmm = records.every(mon => mon.source === "XMM");
        const catalog = {format: CATALOG_FORMAT, exportedAt: new Date().toISOString(),
            filterUrl: location.href, count: records.length, monsters, source, sourceLegendaryGroups};
        download(catalog, onlyXmm ? "MM25.json" : "StatblockForge-filtered-bestiary.json");
        button.textContent = "Exported " + records.length + " monsters";
        setTimeout(() => { button.textContent = "Export to Statblock Forge"; }, 5000);
    }

    function mount() {
        if (document.getElementById("statblock-forge-export")) return true;
        const target = document.getElementById("filter-search-group");
        if (!target) return false;
        const button = document.createElement("button");
        button.id = "statblock-forge-export";
        button.type = "button";
        button.className = "ve-btn ve-btn-primary";
        button.textContent = "Export to Statblock Forge";
        button.title = "Export every monster matching the current Bestiary search and filters";
        button.addEventListener("click", () => {
            try { exportFiltered(button); }
            catch (error) { alert("Statblock Forge export failed: " + error.message); }
        });
        target.appendChild(button);
        return true;
    }

    if (!mount()) {
        const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); });
        observer.observe(document.documentElement, {childList: true, subtree: true});
    }
})();
