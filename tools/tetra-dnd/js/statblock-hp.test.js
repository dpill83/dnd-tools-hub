const fs = require("fs");
const path = require("path");

let JSDOM;
try {
    JSDOM = require("jsdom").JSDOM;
} catch (e) {
    console.log("skip hp tracker tests (jsdom not installed)");
    process.exit(0);
}

const assert = (c, m) => { if (!c) { console.error("FAIL", m); process.exit(1); } console.log("ok", m); };

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { runScripts: "dangerously" });
const script = dom.window.document.createElement("script");
script.textContent = fs.readFileSync(path.join(__dirname, "statblock-hp.js"), "utf8");
dom.window.document.body.appendChild(script);

const withTemp = dom.window.HpTracker.createEntryEl({
    id: "a", name: "Mind Flayer", current: 40, max: 80, temp: 12
});
assert(withTemp.querySelector(".hp-tracker-temp").textContent === "+12 temp", "temp badge");
assert(withTemp.querySelector(".hp-tracker-hp-values").textContent.indexOf("40") >= 0, "current in values");
assert(withTemp.querySelector(".hp-tracker-hp-values").textContent.indexOf("temp") < 0, "temp outside values");
assert(withTemp.querySelector("[data-action=\"temp\"]"), "temp button");

const dead = dom.window.HpTracker.createEntryEl({
    id: "b", name: "Mind Flayer", current: 0, max: 80, temp: 12
});
assert(dead.className.indexOf("hp-tracker-entry--dead") >= 0, "dead class");
assert(dead.querySelector(".hp-tracker-temp").textContent === "+12 temp", "temp still shown when dead");

const none = dom.window.HpTracker.createEntryEl({
    id: "c", name: "Goblin", current: 7, max: 7, temp: 0
});
assert(none.querySelector(".hp-tracker-temp") === null, "no badge at 0");

dom.window.HpTracker.entries = [];
dom.window.HpTracker.adjustId = "x";
dom.window.HpTracker.adjustMode = "temp";
dom.window.HpTracker.modalAmount = { value: "12" };
dom.window.HpTracker.findEntry = function () { return { id: "x", current: 40, max: 80, temp: 0 }; };
const entry = dom.window.HpTracker.findEntry();
dom.window.HpTracker.findEntry = function () { return entry; };
dom.window.HpTracker.persistEntries = function () {};
dom.window.HpTracker.render = function () {};
dom.window.HpTracker.applyAdjust();
assert(entry.temp === 12 && entry.current === 40, "temp replace does not change current");

console.log("hp tracker tests passed");
