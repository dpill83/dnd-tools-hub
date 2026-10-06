const fs = require("fs");
const path = require("path");
const vm = require("vm");

const assert = (c, m) => { if (!c) { console.error("FAIL", m); process.exit(1); } console.log("ok", m); };

const documentStub = {
    readyState: "complete",
    getElementById: function () { return null; },
    addEventListener: function () {}
};
const context = {
    document: documentStub,
    console: console,
    Date: Date,
    Math: Math,
    parseInt: parseInt,
    String: String,
    Array: Array,
    Object: Object,
    isNaN: isNaN,
    setTimeout: setTimeout,
    NodeFilter: { SHOW_TEXT: 4 }
};
context.window = context;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "statblock-dice.js"), "utf8"), context);
const DiceRoller = context.DiceRoller;

assert(DiceRoller.parseDiceExpr("2d8+6").count === 2 && DiceRoller.parseDiceExpr("2d8+6").sides === 8 && DiceRoller.parseDiceExpr("2d8+6").mod === 6, "parse 2d8+6");
assert(DiceRoller.formatExpression(1, 6, 0) === "1d6", "format 1d6");
assert(DiceRoller.formatNote("recharged") === "Recharged", "recharged note");
assert(DiceRoller.formatNote("no-recharge") === "No recharge", "no-recharge note");
assert(DiceRoller.canJoinPlusDamage(") bludgeoning plus 7 ("), "join plus");
assert(!DiceRoller.canJoinPlusDamage(") piercing, or 8 ("), "skip or");
assert(!DiceRoller.canJoinPlusDamage(") bludgeoning. The target takes 7 ("), "skip sentence");

const fakeBtn = function (attrs) {
    return { getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? String(attrs[k]) : null; } };
};
assert(DiceRoller.expressionFromButton(fakeBtn({ "data-roll": "recharge" })) === "1d6", "recharge expression");
assert(DiceRoller.expressionFromButton(fakeBtn({ "data-roll": "dice", "data-count": 2, "data-sides": 8, "data-mod": 6 })) === "2d8+6", "dice expression");

const breakdown = DiceRoller.formatBreakdown({
    groups: [
        { expression: "2d8+6", dice: [7, 2], modifier: 6, total: 15, type: "bludgeoning" },
        { expression: "2d6", dice: [4, 3], modifier: 0, total: 7, type: "psychic" }
    ],
    total: 22
});
assert(breakdown.indexOf("15 bludgeoning") >= 0 && breakdown.indexOf("7 psychic") >= 0 && breakdown.indexOf("total 22") >= 0, "total breakdown");

const legacy = DiceRoller.formatBreakdown({
    expression: "1d6",
    dice: [5],
    modifier: 0,
    total: 5,
    note: "recharged"
});
assert(legacy.indexOf("1d6") >= 0 && legacy.indexOf("Recharged") >= 0, "legacy recharge breakdown");

const rolled = [];
const originalPush = DiceRoller.push;
DiceRoller.push = function (record) { rolled.push(record); };
const originalEval = DiceRoller.evaluate;
DiceRoller.evaluate = function (expr) {
    if (expr === "2d8+6") return { dice: [7, 2], modifier: 6, total: 15, note: "" };
    if (expr === "2d6") return { dice: [4, 3], modifier: 0, total: 7, note: "" };
    return originalEval.call(this, expr);
};
DiceRoller.buildLabel = function () { return "Brazier \u00b7 Brass Crazier \u2014 Damage"; };
DiceRoller.rollDamageTotal(fakeBtn({
    "data-roll": "total",
    "data-exprs": "2d8+6|2d6",
    "data-types": "bludgeoning|psychic"
}));
assert(rolled.length === 1 && rolled[0].total === 22 && rolled[0].groups.length === 2, "rollDamageTotal sums");
assert(rolled[0].groups[0].type === "bludgeoning" && rolled[0].groups[1].total === 7, "rollDamageTotal groups");
DiceRoller.push = originalPush;
DiceRoller.evaluate = originalEval;

console.log("all tests passed");
