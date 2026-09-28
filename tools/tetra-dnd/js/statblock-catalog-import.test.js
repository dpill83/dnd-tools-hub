const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "statblock-script.js"), "utf8");
const start = source.indexOf("var MonsterPresets = (function () {");
const end = source.indexOf("// Document ready function", start);
assert.ok(start >= 0 && end > start);
const snippet = source.slice(start, end);

const saved = new Map();
const indexedDB = {
    open() {
        const request = {};
        queueMicrotask(() => {
            request.result = {
                createObjectStore() {}, close() {},
                transaction() {
                    const transaction = {
                        objectStore() {
                            return {
                                get(key) {
                                    const getRequest = {};
                                    queueMicrotask(() => {
                                        getRequest.result = saved.get(key);
                                        getRequest.onsuccess();
                                    });
                                    return getRequest;
                                },
                                put(value, key) {
                                    saved.set(key, value);
                                    queueMicrotask(() => transaction.oncomplete());
                                }
                            };
                        }
                    };
                    return transaction;
                }
            };
            request.onupgradeneeded();
            request.onsuccess();
        });
        return request;
    }
};
const storage = new Map();
const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
};
const readSharedJson = async url => JSON.parse(fs.readFileSync(path.join(__dirname, "..", url), "utf8"));
const alerts = [];
const context = vm.createContext({
    indexedDB, localStorage, document: {getElementById() { return null; }},
    window: {alert(message) { alerts.push(message); }},
    $: {getJSON: readSharedJson},
    fetch: async () => { throw new Error("offline"); },
    console, Promise, Object, Date
});
vm.runInContext(snippet, context);

const monster = {name: "Aarakocra Aeromancer", hpText: "66 (12d8 + 12)", otherArmorDesc: "16", actions: [], abilities: []};
const catalog = {
    format: "statblock-forge/5etools-catalog/v1", count: 1,
    monsters: {"xmm-aarakocra-aeromancer": monster}
};

(async () => {
    await context.MonsterPresets.importCatalogFile({name: "MM25.json", text: async () => JSON.stringify(catalog)});
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /Imported 1 monsters/);
    assert.equal(context.MonsterPresets.getCustomPreset("xmm-aarakocra-aeromancer").name, monster.name);
    assert.equal(context.MonsterPresets.getCustomPreset("xmm-aarakocra-aeromancer").listLabel, "Aarakocra Aeromancer (MM25)");
    assert.equal(saved.get("5etools")["xmm-aarakocra-aeromancer"].name, monster.name);

    await context.MonsterPresets.importCatalogFile({text: async () => JSON.stringify({...catalog, count: 2})});
    assert.match(alerts[1], /Catalog import failed/);
    assert.equal(saved.get("5etools")["xmm-aarakocra-aeromancer"].name, monster.name);

    const reopened = vm.createContext({
        indexedDB, localStorage, document: {getElementById() { return null; }},
        window: {alert(message) { alerts.push(message); }},
        $: {getJSON: readSharedJson},
        fetch: async () => { throw new Error("offline"); },
        console, Promise, Object, Date
    });
    vm.runInContext(snippet, reopened);
    await reopened.MonsterPresets.loadMonsterList();
    assert.equal(reopened.MonsterPresets.getCustomPreset("xmm-aarakocra-aeromancer").name, monster.name);
    assert.ok(Object.keys(reopened.MonsterPresets.getCustomMonsters()).length >= 503);
    assert.equal(reopened.MonsterPresets.getCustomPreset("xmm-animated-broom").name, "Animated Broom");
    assert.equal(reopened.MonsterPresets.getCustomPreset("mind-flayer").name, "Mind Flayer");
    assert.ok(reopened.MonsterPresets.getCustomPreset("xmm-aarakocra-aeromancer").actions.length > 0);
    const cachedList = JSON.parse(storage.get("open5e-monster-list-2024")).list;
    assert.ok(cachedList.some(item => item.slug === "xmm-animated-broom"));
    assert.equal(cachedList.find(item => item.slug === "xmm-sahuagin-baron").name, "Sahuagin Baron (MM25)");
    assert.equal(reopened.MonsterPresets.getCustomPreset("xmm-sahuagin-baron").name, "Sahuagin Baron");
    console.log("Statblock Forge catalog import: 12 checks passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
