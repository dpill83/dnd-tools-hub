const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "..", "5etools-to-statblock-forge.user.js"), "utf8");

async function run(records) {
    let button;
    let fileName;
    let blob;
    const alerts = [];
    const target = {appendChild(child) { button = child; }};
    const document = {
        body: {appendChild() {}},
        getElementById(id) { return id === "filter-search-group" ? target : null; },
        createElement(tag) {
            if (tag === "div") {
                let html = "";
                return {
                    set innerHTML(value) { html = value; },
                    get textContent() { return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&"); }
                };
            }
            return {
                addEventListener(_, handler) { this.handler = handler; },
                click() { if (this.handler) this.handler(); else fileName = this.download; },
                remove() {}
            };
        }
    };
    const page = {
        bestiaryPage: {_getEncounterBuilderCreatures: () => records},
        Renderer: {get: () => ({render: value => String(value).replace(/\{@\w+ ([^}|]+)(?:\|[^}]*)?}/g, "$1")})}
    };
    vm.runInNewContext(script, {
        unsafeWindow: page, document, window: page, location: {href: "https://5e.tools/bestiary.html#filter"},
        URL: {createObjectURL(value) { blob = value; return "blob:test"; }, revokeObjectURL() {}},
        Blob, alert: message => alerts.push(message), setTimeout() {}
    });
    button.click();
    return {fileName, catalog: blob ? JSON.parse(await blob.text()) : null, alerts};
}

const base = {
    name: "Aarakocra Aeromancer", source: "XMM", size: ["M"], type: "elemental",
    alignment: ["N"], ac: [16], hp: {average: 66, formula: "12d8 + 12"},
    speed: {walk: 20, fly: 50}, str: 10, dex: 16, con: 12, int: 13, wis: 17, cha: 12,
    save: {dex: "+5", wis: "+5"}, skill: {arcana: "+3", perception: "+7"},
    passive: 17, languages: ["Aarakocra", "Primordial (Auran)"], cr: "4",
    spellcasting: [{name: "Spellcasting", displayAs: "action", headerEntries: ["Casts spells."], will: ["Gust of Wind"]}],
    action: [{name: "Wind Staff", entries: ["7 Bludgeoning damage."]}]
};

(async () => {
    const success = await run([base]);
    assert.equal(success.fileName, "MM25.json");
    assert.equal(success.catalog.format, "statblock-forge/5etools-catalog/v1");
    assert.equal(success.catalog.count, 1);
    assert.equal(success.catalog.source[0].name, base.name);
    const converted = success.catalog.monsters["xmm-aarakocra-aeromancer"];
    assert.equal(converted.hpText, "66 (12d8 + 12)");
    assert.equal(converted.otherArmorDesc, "16");
    assert.equal(converted.sourceSaveBonuses.dex, 5);
    assert.equal(converted.sourceSkillBonuses.perception, 7);
    assert.equal(converted.sourcePassivePerception, 17);
    assert.equal(converted.actions.length, 2);
    assert.equal(success.alerts.length, 0);

    const broom = await run([{...base, name: "Animated Broom", speed: {walk: 5, fly: {number: 50, condition: "(hover)"}, canHover: true}}]);
    const broomPreset = broom.catalog.monsters["xmm-animated-broom"];
    assert.equal(broomPreset.flySpeed, 50);
    assert.equal(broomPreset.speedDesc, "5 ft., fly 50 ft. (hover)");

    const empty = await run([]);
    assert.equal(empty.catalog, null);
    assert.match(empty.alerts[0], /no monsters/i);

    const incomplete = await run([{name: "Incomplete", source: "XMM"}]);
    assert.equal(incomplete.catalog, null);
    assert.match(incomplete.alerts[0], /Incomplete Bestiary record/);
    console.log("5etools exporter: 4 checks passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
