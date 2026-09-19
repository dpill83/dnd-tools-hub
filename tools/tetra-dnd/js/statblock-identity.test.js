const C = require("./statblock-identity.js");
const assert = (c, m) => { if (!c) { console.error("FAIL", m); process.exit(1); } console.log("ok", m); };
const data = { crs: { 1: { xp: "200", prof: 2 }, 3: { xp: "700", prof: 2 }, 8: { xp: "3900", prof: 3 } } };

const shenka = {
    schema: "cast-identity/v1", name: "Shenka the Prompter", kind: "npc", rank: "lieutenant",
    role: "stage manager and mask-maker", combatRole: "", look: "Small sharp-eyed goblin",
    size: "small", type: "humanoid", tag: "goblin", base: "custom", cr: 8, ref: "statBlocks[1]",
    fixed: {}, fixedText: "AC 16 (18 on the bookcase); HP 110; Note DC 16 Wis 18 (4d8) psychic",
    flags: ["named", "no-legendary"]
};
assert(C.isIdentity(shenka), "detect identity");
const m = C.expand(shenka, { data });
assert(m.name === "Shenka the Prompter", "name");
assert(m.schema === undefined && m.kind === undefined && m.fixedText === undefined && m.flags === undefined && m.look === undefined && m.ref === undefined, "no identity keys");
assert(m.size === "small" && m.type === "humanoid" && m.tag === "goblin", "size/type/tag");
assert(m.cr === 8, "cr");
assert(m.isLegendary === false && m.legendaries.length === 0, "no-legendary");
assert(m.customHP === true && m.hpText === "110", "fixedText HP");
assert(m.armorName === "other" && m.otherArmorDesc === "16 (18 on the bookcase)", "fixedText AC");
assert(m.actions.some((a) => /multiattack/i.test(a.name)), "lieutenant multiattack");
assert(m.actions.length >= 2, "has attack");
assert(m.languages.some((l) => l.name === "Common") && m.languages.some((l) => l.name === "Goblin"), "languages");
assert(m.darkvision === 60, "goblin darkvision");
assert(m.strPoints >= 10, "stats invented");
assert(Object.keys(C.blankMonster()).every((k) => k in m), "complete schema");
assert(!/Appearance/i.test(JSON.stringify(m.abilities)), "no appearance trait");

const monster = { name: "Goblin", strPoints: 8, hitDice: 2, actions: [{ name: "Scimitar", desc: "x" }] };
assert(!C.isIdentity(monster), "monster not identity");
assert(C.collectMembers(monster).length === 0, "monster collect empty");

const wrapped = {
    schema: "x",
    cast: [
        shenka,
        { schema: "cast-identity/v1", name: "Innkeeper", kind: "npc", rank: "standard", flags: ["non-combat"], fixed: {}, fixedText: "" }
    ]
};
const members = C.collectMembers(wrapped);
assert(members.length === 2, "two members");
assert(C.pickDefaultMember(members).name === "Shenka the Prompter", "default combat-capable");

const parsed = C.parseFixedText("AC 16 (18 on bookcase); HP 110; Note DC 16");
assert(parsed.armorName === "other" && parsed.hpText === "110" && parsed.customHP === true, "parseFixedText");

const fenced = C.unwrapJsonText("```json\n{\"schema\":\"cast-identity/v1\"}\n```");
assert(fenced.indexOf("schema") >= 0, "unwrap fence");

const minion = C.expand({
    schema: "cast-identity/v1", name: "Goblin Mook", kind: "monster", rank: "minion", combatRole: "",
    size: "small", type: "humanoid", tag: "goblin", base: "custom", cr: "1/8", fixed: {}, fixedText: "", flags: []
}, { data: { crs: { "1/8": { xp: "25", prof: 2 } } } });
assert(minion.hitDice === 1 && minion.isLegendary === false, "minion 1 HD");

const boss = C.expand({
    schema: "cast-identity/v1", name: "The Villain", kind: "npc", rank: "boss", combatRole: "leader",
    size: "medium", type: "humanoid", tag: "", base: "custom", cr: 10, fixed: {}, fixedText: "", flags: ["named"]
}, { data: { crs: { 10: { xp: "5900", prof: 4 } } } });
assert(boss.isLegendary === true && boss.legendaries.length === 3, "boss legendary");

const locked = C.expand({
    schema: "cast-identity/v1", name: "Locked", kind: "npc", rank: "boss", combatRole: "",
    size: "medium", type: "humanoid", tag: "", base: "custom", cr: 5,
    fixed: { hitDice: 12, isLegendary: false, actions: [{ name: "Cane", desc: "hit" }] },
    fixedText: "HP 99", flags: ["no-legendary"]
}, { data: { crs: { 5: { xp: "1800", prof: 3 } } } });
assert(locked.hitDice === 12, "fixed hitDice wins over rank");
assert(locked.actions.length === 1 && locked.actions[0].name === "Cane", "fixed actions replace");
assert(locked.isLegendary === false, "flags + fixed no legendary");
assert(locked.customHP === true && locked.hpText === "99", "fixedText HP when not in structured fixed");

const clone = C.blankMonster();
clone.name = "Knight";
clone.cr = 3;
clone.hitDice = 8;
clone.strPoints = 16;
clone.actions = [{ name: "Greatsword", desc: "hit" }];
clone.flySpeed = 40;
const scaled = C.expand({
    schema: "cast-identity/v1", name: "Sir Bob", kind: "npc", rank: "standard", combatRole: "",
    size: "medium", type: "humanoid", tag: "human", base: "knight", cr: 6, fixed: {}, fixedText: "", flags: ["no-fly"]
}, { clone: clone, data: { crs: { 6: { xp: "2300", prof: 3 } } } });
assert(scaled.name === "Sir Bob", "clone overlay name");
assert(scaled.flySpeed === 0, "no-fly");
assert(scaled.actions[0].name === "Greatsword", "kept clone attack");
assert(scaled.hitDice > 8, "scaled HD for CR");
assert(scaled.strPoints === 16, "kept clone stats");

console.log("ALL PASS");
