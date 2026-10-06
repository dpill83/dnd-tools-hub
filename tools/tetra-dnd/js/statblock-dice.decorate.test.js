const fs = require("fs");
const path = require("path");

let JSDOM;
try {
    JSDOM = require("jsdom").JSDOM;
} catch (e) {
    console.log("skip decorate tests (jsdom not installed)");
    process.exit(0);
}

const assert = (c, m) => { if (!c) { console.error("FAIL", m); process.exit(1); } console.log("ok", m); };

const html = `<!DOCTYPE html>
<html><body>
<div id="stat-block">
  <div class="property-block">
    <div>
      <h4>Mind Blast (Recharge 5–6).</h4>
      <p>Hit: 15 (2d8 + 6) bludgeoning plus 7 (2d6) psychic damage.</p>
    </div>
  </div>
  <div class="property-block">
    <div>
      <h4>Longsword.</h4>
      <p>Hit: 7 (1d8 + 3) piercing, or 8 (1d10 + 3) piercing if used with two hands.</p>
    </div>
  </div>
  <div class="property-block">
    <div>
      <h4>Leadership (Recharges after a Short or Long Rest).</h4>
      <p>For 1 minute creatures gain a bonus.</p>
    </div>
  </div>
  <div class="property-block">
    <div>
      <h4>Breath Weapon (Recharge 6).</h4>
      <p>Each creature takes 22 (4d6) fire damage.</p>
    </div>
  </div>
  <p id="hit-points">71 (8d8+32)</p>
</div>
</body></html>`;

const dom = new JSDOM(html, { runScripts: "dangerously" });
const code = fs.readFileSync(path.join(__dirname, "statblock-dice.js"), "utf8");
const script = dom.window.document.createElement("script");
script.textContent = code;
dom.window.document.body.appendChild(script);
const root = dom.window.document.getElementById("stat-block");
dom.window.DiceRoller.decorate(root);

const recharge = root.querySelectorAll("[data-roll=\"recharge\"]");
assert(recharge.length === 2, "two recharge buttons");
assert(recharge[0].textContent.indexOf("Recharge 5") >= 0, "5-6 text");
assert(recharge[0].getAttribute("data-min") === "5" && recharge[0].getAttribute("data-max") === "6", "5-6 range");
assert(recharge[1].getAttribute("data-min") === "6" && recharge[1].getAttribute("data-max") === "6", "recharge 6");

const restH4 = root.querySelectorAll("h4")[2].textContent;
assert(restH4.indexOf("Recharges after a Short or Long Rest") >= 0, "rest recharge stays text");
assert(root.querySelectorAll("h4")[2].querySelector("[data-roll=\"recharge\"]") === null, "no button on rest recharge");

const totals = root.querySelectorAll("[data-roll=\"total\"]");
assert(totals.length === 1, "one total button");
assert(totals[0].getAttribute("data-exprs") === "2d8+6|2d6", "total exprs");
assert(totals[0].getAttribute("data-types") === "bludgeoning|psychic", "total types");

assert(root.querySelectorAll(".property-block")[1].querySelectorAll("[data-roll=\"total\"]").length === 0, "no total on or-chain");
assert(root.querySelector("#hit-points").querySelector("[data-roll=\"total\"]") === null, "no total on HP");
assert(root.querySelector("#hit-points .dice-roll").getAttribute("data-label") === "HP", "HP dice labeled");

console.log("decorate tests passed");
