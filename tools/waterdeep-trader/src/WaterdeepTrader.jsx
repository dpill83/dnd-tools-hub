import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DISTRICTS = {
  field: {
    id: "field", name: "Field Ward", emoji: "🌾",
    desc: "Outside the city walls. Desperate folk. Dirt-cheap, dirt-rough.",
    x: 50, y: 12,
    baseModifiers: { grain: 1.5, timber: 1.3, contraband: 1.4, weapons: 1.1, silks: 0.7, books: 0.65, spices: 0.8, alchemical: 0.75, magical: 0.6 },
  },
  sea: {
    id: "sea", name: "Sea Ward", emoji: "🌊",
    desc: "Old money and magic. Temples, villas, wizard towers.",
    x: 25, y: 34,
    baseModifiers: { magical: 1.6, alchemical: 1.4, silks: 1.2, books: 1.3, contraband: 0.7, grain: 1.0, weapons: 0.9, timber: 0.85, spices: 1.1 },
  },
  north: {
    id: "north", name: "North Ward", emoji: "🏘️",
    desc: "Prosperous merchants and guild halls. Steady trade.",
    x: 75, y: 34,
    baseModifiers: { grain: 1.15, silks: 1.1, books: 1.1, contraband: 0.8, spices: 1.0, weapons: 1.0, timber: 1.05, alchemical: 0.95, magical: 0.9 },
  },
  castle: {
    id: "castle", name: "Castle Ward", emoji: "🏰",
    desc: "Seat of power. Lords, nobles, and their coin.",
    x: 18, y: 56,
    baseModifiers: { silks: 1.4, books: 1.5, spices: 1.3, contraband: 0.6, grain: 1.1, weapons: 0.9, timber: 0.8, alchemical: 1.2, magical: 1.3 },
  },
  dead: {
    id: "dead", name: "City of the Dead", emoji: "🪦", mapShort: "Dead",
    desc: "Tombs, ossuaries, and whispered trade in relics and rare components.",
    x: 82, y: 56,
    baseModifiers: { magical: 1.55, books: 1.45, contraband: 1.15, silks: 0.85, spices: 0.9, grain: 0.7, weapons: 0.9, timber: 0.75, alchemical: 1.2 },
  },
  trade: {
    id: "trade", name: "Trade Ward", emoji: "⚖️",
    desc: "The beating heart of commerce. Fair prices, fierce competition.",
    x: 50, y: 56,
    baseModifiers: { silks: 1.0, books: 1.0, spices: 1.0, contraband: 0.85, grain: 1.0, weapons: 1.0, timber: 1.0, alchemical: 1.0, magical: 1.0 },
  },
  dock: {
    id: "dock", name: "Dock Ward", emoji: "⚓",
    desc: "Rough and ready. Smugglers, sailors, the desperate and the bold.",
    x: 32, y: 80,
    baseModifiers: { contraband: 1.7, timber: 1.2, weapons: 1.2, grain: 0.85, spices: 0.9, silks: 0.8, books: 0.7, alchemical: 0.8, magical: 0.7 },
  },
  south: {
    id: "south", name: "South Ward", emoji: "⚒️",
    desc: "Craftsmen and laborers. Raw materials flow through here.",
    x: 68, y: 80,
    baseModifiers: { timber: 1.4, weapons: 1.3, grain: 1.2, silks: 0.85, books: 0.8, contraband: 0.9, spices: 0.9, alchemical: 0.9, magical: 0.75 },
  },
};

const GOODS = {
  spices:     { name: "Spices",            emoji: "🌶️", basePrice: 80,  legal: true,  cargoSize: 1 },
  silks:      { name: "Fine Silks",        emoji: "🧵", basePrice: 140, legal: true,  cargoSize: 1 },
  alchemical: { name: "Alchemical Supplies",emoji: "⚗️",basePrice: 110, legal: true,  cargoSize: 1 },
  weapons:    { name: "Steel & Weapons",   emoji: "⚔️", basePrice: 95,  legal: true,  cargoSize: 2 },
  grain:      { name: "Grain & Livestock", emoji: "🌾", basePrice: 40,  legal: true,  cargoSize: 2 },
  contraband: { name: "Contraband",        emoji: "💀", basePrice: 200, legal: false, cargoSize: 1 },
  magical:    { name: "Magical Components",emoji: "✨", basePrice: 180, legal: true,  cargoSize: 1 },
  timber:     { name: "Timber & Stone",    emoji: "🪵", basePrice: 55,  legal: true,  cargoSize: 3 },
  books:      { name: "Books & Scrolls",   emoji: "📜", basePrice: 65,  legal: true,  cargoSize: 1 },
};

const FACTIONS = {
  watch:    { name: "City Watch",      emoji: "🛡️", color: "#4a90d9" },
  thieves:  { name: "Shadow Thieves",  emoji: "🗡️", color: "#9b59b6" },
  guild:    { name: "Merchant's Guild",emoji: "⚖️", color: "#e6a817" },
};

/* Fast travel graph (8 nodes, edges per design spec) */
const CONNECTIONS = [
  ["field", "sea"], ["field", "north"],
  ["sea", "north"], ["sea", "castle"],
  ["north", "castle"], ["north", "trade"], ["north", "dead"],
  ["castle", "trade"], ["castle", "dock"],
  ["trade", "dead"], ["trade", "dock"], ["trade", "south"],
  ["dock", "south"],
];

const CARGO_CAPACITY = 20;

// ── TIME SYSTEM ──────────────────────────────────────────────────────────────
// All time tracked in minutes. Clock displays as "Day N · HH:MM" starting 08:00.

const START_HOUR = 8; // 08:00 Day 1

/** Per-difficulty total hours → minutes */
const DIFFICULTY_TOTAL_HOURS = { easy: 90, normal: 72, hard: 54 };

/** Base transaction time in minutes per district */
const DISTRICT_TEMPO = {
  trade: 15, castle: 20, north: 20, sea: 25, south: 25, dock: 30, field: 40, dead: 35,
};

/** Travel cost in minutes between district pairs */
const TRAVEL_COSTS = {
  "field-sea":   60, "field-north":  60,
  "sea-north":   60, "sea-castle":   60,
  "north-castle":60, "north-trade":  60, "north-dead": 60,
  "castle-trade":60, "castle-dock":  60,
  "trade-dead":  60, "trade-dock":   60, "trade-south":60,
  "dock-south":  60,
};

function travelMinutes(fromId, toId) {
  const key = [fromId, toId].sort().join("-");
  return TRAVEL_COSTS[key] || 60;
}

function qtyTier(qty) {
  if (qty <= 2)  return 1.0;
  if (qty <= 5)  return 1.5;
  if (qty <= 10) return 2.0;
  return 2.5;
}

function txnMinutes(districtId, qty) {
  return Math.round((DISTRICT_TEMPO[districtId] || 20) * qtyTier(qty));
}

/** Convert elapsed minutes → { day, str } */
function formatClock(elapsedMinutes) {
  const totalMins = START_HOUR * 60 + elapsedMinutes;
  const day  = Math.floor(totalMins / (24 * 60)) + 1;
  const h    = Math.floor((totalMins % (24 * 60)) / 60);
  const m    = totalMins % 60;
  return { day, str: `Day ${day} · ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}` };
}

/** "+45 min" or "+2 hr 15 min" */
function fmtDelta(mins) {
  if (mins < 60) return `+${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `+${h} hr ${m} min` : `+${h} hr`;
}

/** Easy / Normal / Hard — starting purse, time limit, and victory threshold. */
const DIFFICULTY_PRESETS = {
  easy:   { id: "easy",   label: "Easy",   startGold: 650, totalMinutes: 90*60,  winGold: 9000  },
  normal: { id: "normal", label: "Normal", startGold: 400, totalMinutes: 72*60,  winGold: 12000 },
  hard:   { id: "hard",   label: "Hard",   startGold: 275, totalMinutes: 54*60,  winGold: 15500 },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getConnected(districtId) {
  return CONNECTIONS
    .filter(([a, b]) => a === districtId || b === districtId)
    .map(([a, b]) => (a === districtId ? b : a));
}

/** Two-line labels for map nodes (full ward names). */
function districtMapLabelLines(name) {
  if (name === "City of the Dead") return ["City of the", "Dead"];
  if (name.endsWith(" Ward")) return [name.slice(0, -5), "Ward"];
  return [name, ""];
}

function generateMarket(districtId, day, volatilitySeeds, factions) {
  const district = DISTRICTS[districtId];
  const market = {};
  /** Deterministic 5–10% legal discount for high guild rep (varies by day + ward). */
  const guildLegalMult =
    factions.guild > 65
      ? 0.9 + (((day * 17 + districtId.charCodeAt(0)) % 6) * 0.01)
      : 1;
  Object.entries(GOODS).forEach(([key, good]) => {
    const mod = district.baseModifiers[key] || 1.0;
    const seed = volatilitySeeds[`${districtId}-${key}`] || 1.0;
    const dayNoise = Math.sin(day * 0.3 + key.charCodeAt(0) * 0.7) * 0.12;
    let price = Math.round(good.basePrice * mod * seed * (1 + dayNoise));
    if (!good.legal && factions.thieves > 65) price = Math.round(price * 0.88);
    if (good.legal && factions.guild > 65) price = Math.round(price * guildLegalMult);
    if (factions.watch < 35 && (districtId === "castle" || districtId === "north")) price = Math.round(price * 1.1);
    if (!good.legal && districtId === "dock" && factions.thieves > 80) price = Math.round(price * 0.92);
    market[key] = Math.max(10, price);
  });
  return market;
}

/** Buy price is in `market`; contraband with high thieves rep uses a higher implicit sell rate. */
function sellUnitPrice(goodKey, buyPrice, districtId, factions) {
  const good = GOODS[goodKey];
  if (!good.legal && factions.thieves > 65) {
    let divisor = 0.88;
    if (districtId === "dock" && factions.thieves > 80) divisor *= 0.92;
    return Math.max(10, Math.round((buyPrice / divisor) * 1.12));
  }
  return buyPrice;
}

function generateVolatilitySeeds() {
  const seeds = {};
  Object.keys(DISTRICTS).forEach(d => {
    Object.keys(GOODS).forEach(g => {
      seeds[`${d}-${g}`] = 0.75 + Math.random() * 0.5;
    });
  });
  return seeds;
}

const GUILD_WHISPER_BOOSTS = [
  { district: "sea", good: "silks", multiplier: 1.65 },
  { district: "castle", good: "spices", multiplier: 1.55 },
  { district: "dock", good: "timber", multiplier: 1.7 },
  { district: "south", good: "weapons", multiplier: 1.5 },
  { district: "dead", good: "magical", multiplier: 1.45 },
];

// ── DYNAMIC SUPPLY ────────────────────────────────────────────────────────────
/** Goods always stocked here regardless of rotation */
const ANCHOR_GOODS = {
  dock:   ["contraband","timber","weapons"],
  field:  ["grain","timber"],
  south:  ["weapons","grain","alchemical"],
  trade:  ["spices","books"],
  north:  ["silks","books"],
  castle: ["silks","magical"],
  sea:    ["magical","alchemical"],
  dead:   ["books","magical"],
};

/** Which goods each ward actively WANTS to buy (pays sell premium) */
const BUYING_PREMIUM = {
  dock:   ["grain","spices"],
  field:  ["alchemical","books"],
  south:  ["timber","contraband"],
  trade:  ["weapons","grain"],
  north:  ["alchemical","spices"],
  castle: ["books","silks","spices"],
  sea:    ["silks","contraband"],
  dead:   ["alchemical","contraband"],
};

/** Generate rotating availability for a ward (anchors + 2-3 random extras) */
function generateAvailability(districtId, seeds, factions, marketBoosts) {
  const anchors = ANCHOR_GOODS[districtId] || [];
  const pool = Object.keys(GOODS).filter(g => !anchors.includes(g));
  // Weighted shuffle using seed
  const seed = Object.values(seeds).reduce((a,b) => a+b, 0);
  const shuffled = pool.slice().sort((a,b) => {
    const ha = Math.sin(seed * 13.7 + a.charCodeAt(0)) * 0.5 + 0.5;
    const hb = Math.sin(seed * 13.7 + b.charCodeAt(0)) * 0.5 + 0.5;
    return ha - hb;
  });
  // High guild rep → one extra slot
  const slots = factions.guild > 70 ? 3 : 2;
  const rotating = shuffled.slice(0, slots);
  // If a marketBoost exists for this district, ensure that good is available
  const boost = marketBoosts[districtId];
  if (boost && !anchors.includes(boost.good) && !rotating.includes(boost.good)) {
    rotating[rotating.length - 1] = boost.good;
  }
  return [...new Set([...anchors, ...rotating])];
}

// ── UPGRADE SHOP ──────────────────────────────────────────────────────────────
const PERMANENT_UPGRADES = [
  { id: "reinforced_cart",   name: "Reinforced Cart",       cost: 400,  icon: "🛒", desc: "+6 cargo capacity",              effect: { cargoBonus: 6 } },
  { id: "guild_membership",  name: "Guild Membership",      cost: 600,  icon: "📜", desc: "+15 Guild rep, unlocks pricing", effect: { factionChange: { guild: 15 } } },
  { id: "merchants_rep",     name: "Merchant's Reputation", cost: 800,  icon: "🏅", desc: "All transactions 25% faster",    effect: { txnSpeedBonus: 0.25 } },
  { id: "second_cart",       name: "Second Cart",           cost: 1200, icon: "🐂", desc: "+12 cargo capacity",             effect: { cargoBonus: 12 }, requires: "reinforced_cart" },
];

const CONSUMABLES = [
  { id: "bribe_kit",    name: "Bribe Kit",       cost: 80,  icon: "💰", desc: "Skip next Watch encounter, free",    uses: 3 },
  { id: "fast_pass",    name: "Fast Pass",        cost: 100, icon: "⚡", desc: "Next travel costs 30 min only",     uses: 3 },
  { id: "market_report",name: "Market Report",   cost: 60,  icon: "🗺️", desc: "Peek prices at any one ward",       uses: 3 },
  { id: "decoy_crate",  name: "Decoy Crate",      cost: 120, icon: "📦", desc: "Next contraband inspection clear",  uses: 3 },
];

/** Which upgrades each ward sells. Trade always has all. Others get 1-2. */
function getShopInventory(districtId, seeds, ownedUpgrades) {
  if (districtId === "trade") {
    return {
      permanent: PERMANENT_UPGRADES.filter(u => !ownedUpgrades.includes(u.id) && (!u.requires || ownedUpgrades.includes(u.requires))),
      consumables: CONSUMABLES,
    };
  }
  // Other wards: seed-based 1 permanent + 1 consumable, 40% chance of having a shop at all
  const seed = Object.values(seeds).reduce((a,b) => a+b, 0);
  const hasShop = Math.sin(seed * 7.3 + districtId.charCodeAt(0)) > 0.2;
  if (!hasShop) return null;
  const pi = Math.floor(Math.abs(Math.sin(seed * 3.1 + districtId.charCodeAt(0)) * 100)) % PERMANENT_UPGRADES.length;
  const ci = Math.floor(Math.abs(Math.cos(seed * 5.7 + districtId.charCodeAt(0)) * 100)) % CONSUMABLES.length;
  const perm = PERMANENT_UPGRADES[pi];
  return {
    permanent: (!ownedUpgrades.includes(perm.id) && (!perm.requires || ownedUpgrades.includes(perm.requires))) ? [perm] : [],
    consumables: [CONSUMABLES[ci]],
  };
}

// ── D20 RESOLUTION ───────────────────────────────────────────────────────────
/**
 * Roll a d20 with modifiers and return { roll, total, dc, success, crit, fumble, tier }
 * modifier: +/- integer added to roll
 * dc: difficulty class (2 / 5 / 10 / 15 / 20)
 * tier: "crit" | "success" | "partial" | "fail" | "fumble"
 */
function d20Roll(modifier = 0, dc = 10) {
  const roll = Math.ceil(Math.random() * 20);
  const total = roll + modifier;
  const crit   = roll === 20;
  const fumble = roll === 1;
  let tier;
  if (crit)              tier = "crit";
  else if (fumble)       tier = "fumble";
  else if (total >= dc + 5) tier = "crit";       // beat DC by 5+ = exceptional
  else if (total >= dc)    tier = "success";
  else if (total >= dc - 4) tier = "partial";    // close but not quite
  else                   tier = "fail";
  return { roll, modifier, total, dc, crit, fumble, tier,
    success: tier === "crit" || tier === "success" };
}

/** Rep-to-modifier: thieves 0→-3, 50→0, 100→+4 */
function thievesModifier(rep) { return Math.round((rep - 50) / 16); }
/** Rep-to-modifier: watch 0→-4, 50→0, 100→+3 */
function watchModifier(rep)   { return Math.round((rep - 50) / 14); }
/** Guild modifier */
function guildModifier(rep)   { return Math.round((rep - 50) / 16); }

/** Produce a roll summary string for the log */
function rollSummary(r) {
  const tierLabel = { crit:"CRITICAL SUCCESS", success:"SUCCESS", partial:"PARTIAL", fail:"FAIL", fumble:"FUMBLE" }[r.tier];
  return `[d20: ${r.roll}${r.modifier >= 0 ? "+" : ""}${r.modifier} = ${r.total} vs DC ${r.dc} — ${tierLabel}]`;
}

/** Steal one random non-quest cargo item */
function stealCargo(cargo, pct = 0.4) {
  const stealable = cargo.filter(c => !c.questLocked && c.qty > 0);
  if (!stealable.length) return { newCargo: cargo, stolen: null };
  const victim = stealable[Math.floor(Math.random() * stealable.length)];
  const qty = Math.max(1, Math.ceil(victim.qty * pct));
  const newCargo = cargo.map(c =>
    c.good === victim.good && !c.questLocked ? { ...c, qty: c.qty - qty } : c
  ).filter(c => c.qty > 0);
  return { newCargo, stolen: { good: victim.good, qty } };
}

const EVENTS = [
  {
    id: "watch_patrol",
    title: "City Watch Patrol",
    desc: "Two Watchmen step into the road, hands raised. 'Halt, merchant. Routine inspection.' Their eyes drift to your cart.",
    condition: (state) => state.cargo.some(c => c.good === "contraband") && state.factions.watch < 60,
    options: [
      // ── SOCIAL: Bribe — scales with gold ─────────────────────────────────
      {
        label: "Slip them a bribe",
        labelFn: (state) => {
          const bribe = Math.max(40, Math.round(state.gold * 0.05));
          return `Slip them a bribe (${bribe}gp — 5% of purse)`;
        },
        effect: (state) => {
          const bribe = Math.max(40, Math.round(state.gold * 0.05));
          return { gold: state.gold - bribe, timeCost: 45, factionChange: { watch: -2 },
            log: `You press ${bribe}gp into the sergeant's palm. He coughs, looks away. (+45 min)`,
            rollDisplay: { type: "social", label: "Bribed", note: `${bribe}gp` } };
        },
      },
      // ── SOCIAL: Persuasion — d20 + watch modifier + guild bonus ──────────
      {
        label: "Talk your way out (Social — d20 Persuasion)",
        effect: (state) => {
          const mod = watchModifier(state.factions.watch) + guildModifier(state.factions.guild);
          const dc = state.factions.watch < 30 ? 16 : state.factions.watch < 50 ? 13 : 10;
          const r = d20Roll(mod, dc);
          if (r.tier === "crit") {
            return { timeCost: 15, factionChange: { watch: 3 },
              log: `${rollSummary(r)} You explain you're on Guild business. They wave you through with apologies. (+15 min)`,
              rollDisplay: { ...r, type: "social" } };
          } else if (r.tier === "success") {
            return { timeCost: 30, factionChange: { watch: 1 },
              log: `${rollSummary(r)} A plausible story. They let you pass after a cursory look. (+30 min)`,
              rollDisplay: { ...r, type: "social" } };
          } else if (r.tier === "partial") {
            const bribe = Math.max(30, Math.round(state.gold * 0.03));
            return { gold: state.gold - bribe, timeCost: 45, factionChange: { watch: -1 },
              log: `${rollSummary(r)} Words almost work. They want a "processing fee" of ${bribe}gp to close the matter. (+45 min)`,
              rollDisplay: { ...r, type: "social" } };
          } else if (r.tier === "fumble") {
            return { gold: state.gold - 200, timeCost: 90,
              cargo: state.cargo.filter(c => c.good !== "contraband"),
              factionChange: { watch: -6 },
              log: `${rollSummary(r)} You contradict yourself twice. Contraband seized, 200gp fine, name logged. (+90 min)`,
              rollDisplay: { ...r, type: "social" } };
          } else {
            return { gold: state.gold - 150, timeCost: 90,
              cargo: state.cargo.filter(c => c.good !== "contraband"),
              factionChange: { watch: -4 },
              log: `${rollSummary(r)} They don't buy it. Contraband confiscated, 150gp fine. (+90 min)`,
              rollDisplay: { ...r, type: "social" } };
          }
        },
      },
      // ── EXPLORATION: Slip away — find a back route, d20 + thieves modifier
      {
        label: "Duck away — find a back route (Exploration — d20)",
        effect: (state) => {
          // Knowing the city (thieves rep = street knowledge) helps here
          const mod = thievesModifier(state.factions.thieves);
          const dc = 12;
          const r = d20Roll(mod, dc);
          if (r.tier === "crit") {
            return { timeCost: 10, factionChange: { thieves: 1 },
              log: `${rollSummary(r)} You know every back alley in Waterdeep. You're three streets over before they notice. (+10 min)`,
              rollDisplay: { ...r, type: "exploration" } };
          } else if (r.tier === "success") {
            return { timeCost: 25, factionChange: {},
              log: `${rollSummary(r)} A quick turn through the fish market. You emerge clean on the other side. (+25 min)`,
              rollDisplay: { ...r, type: "exploration" } };
          } else if (r.tier === "partial") {
            return { timeCost: 45, factionChange: { watch: -1 },
              log: `${rollSummary(r)} You find a route but it's slow — loading yards and back streets. (+45 min)`,
              rollDisplay: { ...r, type: "exploration" } };
          } else if (r.tier === "fumble") {
            return { gold: state.gold - 200, timeCost: 90,
              cargo: state.cargo.filter(c => c.good !== "contraband"),
              factionChange: { watch: -5 },
              log: `${rollSummary(r)} Wrong alley — dead end. They corner you. Contraband taken, 200gp fine. (+90 min)`,
              rollDisplay: { ...r, type: "exploration" } };
          } else {
            const bribe = Math.max(40, Math.round(state.gold * 0.04));
            return { gold: state.gold - bribe, timeCost: 60, factionChange: { watch: -2 },
              log: `${rollSummary(r)} You get turned around. Back where you started, with less time and a suspicious sergeant. ${bribe}gp to smooth it over. (+1 hr)`,
              rollDisplay: { ...r, type: "exploration" } };
          }
        },
      },
    ],
  },
  {
    id: "thieves_toll",
    title: "Shadow Thief Toll",
    desc: "A cloaked figure steps from the shadows, one hand resting on a blade. 'The Guild extends its hospitality, merchant. A modest contribution — and you'll see your destination.'",
    condition: (state) => state.factions.thieves < 70,
    options: [
      // ── SOCIAL: Pay a percentage of current gold ─────────────────────────
      {
        label: "Pay the toll",
        labelFn: (state) => {
          const toll = Math.max(20, Math.round(state.gold * 0.06));
          return `Pay the toll (${toll}gp — 6% of purse)`;
        },
        effect: (state) => {
          const toll = Math.max(20, Math.round(state.gold * 0.06));
          return { gold: state.gold - toll, timeCost: 30,
            log: `You hand over ${toll}gp without a word. The figure bows and steps aside. (+30 min)`,
            factionChange: { thieves: 2 },
            rollDisplay: { type: "social", label: "Paid", note: `${toll}gp` } };
        },
      },
      // ── SOCIAL: Negotiate — roll d20 + thieves modifier ──────────────────
      {
        label: "Negotiate (Social — d20 + Guild standing)",
        effect: (state) => {
          const mod = thievesModifier(state.factions.thieves);
          // DC scales: low rep = DC 15 (they're hostile), higher = DC 10
          const dc = state.factions.thieves < 30 ? 15 : state.factions.thieves < 50 ? 12 : 10;
          const r = d20Roll(mod, dc);
          const toll = Math.max(20, Math.round(state.gold * 0.06));
          if (r.tier === "crit") {
            return { timeCost: 15, factionChange: { thieves: 3 },
              log: `${rollSummary(r)} You talk circles around the cutpurse — he actually apologizes. Free passage. (+15 min)`,
              rollDisplay: { ...r, type: "social" } };
          } else if (r.tier === "success") {
            const half = Math.round(toll / 2);
            return { gold: state.gold - half, timeCost: 20, factionChange: { thieves: 1 },
              log: `${rollSummary(r)} You haggle it down to ${half}gp. Grudging respect earned. (+20 min)`,
              rollDisplay: { ...r, type: "social" } };
          } else if (r.tier === "partial") {
            return { gold: state.gold - toll, timeCost: 35, factionChange: { thieves: 0 },
              log: `${rollSummary(r)} Words help but not enough. Full toll, slower exit. (+35 min)`,
              rollDisplay: { ...r, type: "social" } };
          } else if (r.tier === "fumble") {
            const { newCargo, stolen } = stealCargo(state.cargo, 0.5);
            return { gold: state.gold - toll, timeCost: 45, cargo: newCargo, factionChange: { thieves: -4 },
              log: `${rollSummary(r)} You insulted the wrong person. Full toll paid${stolen ? ` and ${stolen.qty}x ${GOODS[stolen.good].name} lifted while you argued` : ""}. (+45 min)`,
              rollDisplay: { ...r, type: "social" } };
          } else {
            return { gold: state.gold - toll, timeCost: 40, factionChange: { thieves: -1 },
              log: `${rollSummary(r)} Negotiation failed. Full toll, sour looks. (+40 min)`,
              rollDisplay: { ...r, type: "social" } };
          }
        },
      },
      // ── COMBAT (risk-resolution): Attempt to flee — d20 + thieves modifier
      {
        label: "Attempt to flee (Combat — d20 roll)",
        effect: (state) => {
          const mod = thievesModifier(state.factions.thieves);
          // DC based on how motivated they are to catch you
          const dc = state.factions.thieves < 20 ? 18
                   : state.factions.thieves < 35 ? 15
                   : state.factions.thieves < 50 ? 12
                   : 8;
          const r = d20Roll(mod, dc);
          if (r.tier === "crit") {
            return { timeCost: 10, factionChange: { thieves: -2 },
              log: `${rollSummary(r)} You vanish like smoke — through a market stall, over a fence, gone. They never had a chance. (+10 min)`,
              rollDisplay: { ...r, type: "combat" } };
          } else if (r.tier === "success") {
            return { timeCost: 20, factionChange: { thieves: -3 },
              log: `${rollSummary(r)} You bolt through a crowded alley. They lose you after two blocks. (+20 min)`,
              rollDisplay: { ...r, type: "combat" } };
          } else if (r.tier === "partial") {
            const { newCargo, stolen } = stealCargo(state.cargo, 0.3);
            return { timeCost: 30, cargo: newCargo, factionChange: { thieves: -3 },
              log: `${rollSummary(r)} You escape, but they caught your cart — ${stolen ? `${stolen.qty}x ${GOODS[stolen.good].name} gone` : "nothing taken"}. (+30 min)`,
              rollDisplay: { ...r, type: "combat" } };
          } else if (r.tier === "fumble") {
            const toll = Math.max(20, Math.round(state.gold * 0.06));
            const penalty = Math.round(toll * 2.5);
            return { gold: state.gold - Math.min(state.gold, penalty), timeCost: 60, factionChange: { thieves: -6 },
              log: `${rollSummary(r)} Catastrophic. You trip, scatter goods, attract a crowd. They take ${penalty}gp and leave you in the mud. (+1 hr)`,
              rollDisplay: { ...r, type: "combat" } };
          } else {
            const toll = Math.max(20, Math.round(state.gold * 0.06));
            const penalty = Math.round(toll * 1.5);
            return { gold: state.gold - Math.min(state.gold, penalty), timeCost: 45, factionChange: { thieves: -4 },
              log: `${rollSummary(r)} They run you down two streets over. You pay double for the trouble. (+45 min)`,
              rollDisplay: { ...r, type: "combat" } };
          }
        },
      },
    ],
  },
  {
    id: "market_tip",
    title: "Merchant's Tip",
    desc: "A red-faced merchant leans close. 'Between you and me — silks are fetching double in Sea Ward today. Storm delayed the shipment.'",
    condition: () => true,
    options: [
      { label: "Thank them and take note", effect: () => ({ timeCost: 15, log: "You file the tip away. Knowledge is coin. (+15 min)", factionChange: { guild: 1 }, marketBoost: { district: "sea", good: "silks", multiplier: 1.8 } }) },
    ],
  },
  {
    id: "dockworkers_strike",
    title: "Dockworkers' Strike",
    desc: "The Dock Ward is in uproar. Longshoremen have walked off the job. Timber and grain prices are spiking.",
    condition: () => true,
    options: [
      { label: "Noted", effect: () => ({ timeCost: 10, log: "The strike makes timber and grain scarce at the docks. (+10 min)", marketBoost: { district: "dock", good: "timber", multiplier: 2.0 } }) },
    ],
  },
  {
    id: "noble_feast",
    title: "A Noble's Grand Feast",
    desc: "Lord Haereth is throwing a feast for three hundred guests. Luxury goods are flying off the shelves in Castle Ward.",
    condition: () => true,
    options: [
      { label: "Make haste to Castle Ward", effect: () => ({ timeCost: 10, log: "Spices and silks are in short supply at the castle. (+10 min)", marketBoost: { district: "castle", good: "spices", multiplier: 1.9 } }) },
    ],
  },
  {
    id: "fog_delay",
    title: "Sea Fog Rolls In",
    desc: "A thick fog off the harbor slows all movement through the city. Travel costs +1 extra day.",
    condition: () => true,
    options: [
      { label: "Wait it out", effect: (state) => ({ timeCost: 180, log: "You lose 3 hours to the fog. The city breathes, unhurried. (+3 hr)" }) },
    ],
  },
  {
    id: "cargo_quest",
    title: "Urgent Delivery",
    desc: "A nervous clerk rushes up. 'Please — I'll pay 300gp to have these alchemical supplies delivered to Field Ward within 5 days. Discreetly.'",
    condition: (state) => !state.quests.some(q => q.id === "cargo_quest_active") && state.cargo.reduce((s,c)=>s+GOODS[c.good].cargoSize*c.qty,0) + 3 <= CARGO_CAPACITY,
    options: [
      { label: "Accept the job", effect: (state) => ({ timeCost: 20, log: "You take the crate. Field Ward within 12 hours. (+20 min)", quests: [...state.quests, { id:"cargo_quest_active", label:"Deliver alchemical to Field Ward", deadlineMinutes: state.elapsed + 12*60, reward:300, destDistrict:"field", goodRequired:"alchemical", cargoAdded:true }], cargo: [...state.cargo, { good:"alchemical", qty:3, paid:0, questLocked:true }] }) },
      { label: "Decline", effect: () => ({ log: "You shake your head. The clerk slinks away." }) },
    ],
  },
  {
    id: "cargo_quest_premium",
    title: "Guild Contract",
    desc: "A seal-stamped missive finds you: the Merchant's Guild needs rare magical components run to Sea Ward within 7 days. 'Five hundred gold for a member in good standing.'",
    condition: (state) =>
      state.factions.guild > 70 &&
      !state.quests.some(q => q.id === "cargo_quest_premium_active") &&
      state.cargo.reduce((s, c) => s + GOODS[c.good].cargoSize * c.qty, 0) + GOODS.magical.cargoSize * 2 <= CARGO_CAPACITY,
    options: [
      {
        label: "Accept the contract",
        effect: (state) => ({
          timeCost: 20,
          log: "You sign for the sealed crate. Sea Ward within 20 hours — 500gp on delivery. (+20 min)",
          quests: [
            ...state.quests,
            {
              id: "cargo_quest_premium_active",
              label: "Guild: magical components to Sea Ward",
              deadlineMinutes: state.elapsed + 20*60,
              reward: 500,
              destDistrict: "sea",
              goodRequired: "magical",
              cargoAdded: true,
            },
          ],
          cargo: [...state.cargo, { good: "magical", qty: 2, paid: 0, questLocked: true }],
          factionChange: { guild: 2 },
        }),
      },
      { label: "Decline politely", effect: () => ({ log: "The courier bows and seeks another carrier." }) },
    ],
  },
  // ── NEW: Chain delivery quest ─────────────────────────────────────────────
  {
    id: "chain_quest",
    title: "Two-Leg Haul",
    desc: "A sweating courier hands you a manifest. 'Pick up weapons from South Ward, run them through Trade, deliver to Castle. 700gp if you make it in 18 hours.'",
    condition: (state) =>
      !state.quests.some(q => q.id === "chain_leg1" || q.id === "chain_leg2") &&
      state.cargo.reduce((s,c) => s + GOODS[c.good].cargoSize * c.qty, 0) + GOODS.weapons.cargoSize * 2 <= CARGO_CAPACITY,
    options: [
      { label: "Take the contract", effect: (state) => ({
          timeCost: 20,
          log: "Two-leg haul accepted: South Ward → Castle Ward within 18 hours. (+20 min)",
          quests: [...state.quests, {
            id: "chain_leg1", label: "Haul: Pick up weapons at South Ward",
            deadlineMinutes: state.elapsed + 18*60, reward: 0,
            destDistrict: "south", goodRequired: "weapons", cargoAdded: false,
            chainNext: { id: "chain_leg2", label: "Haul: Deliver weapons to Castle Ward",
              destDistrict: "castle", goodRequired: "weapons", reward: 700 },
          }],
        })
      },
      { label: "Too complicated", effect: () => ({ log: "You wave off the courier. Some jobs aren't worth the routing." }) },
    ],
  },
  // ── NEW: Toll road obstacle ───────────────────────────────────────────────
  {
    id: "toll_road",
    title: "Road Toll",
    desc: "City workers have thrown up a checkpoint on this stretch. 'Forty gold, merchant. Repairs on the King's Way.'",
    condition: () => true,
    options: [
      { label: "Pay the toll (40gp)", effect: (state) => ({ gold: state.gold - 40, timeCost: 15, log: "You pay the toll. The barrier lifts. (+15 min)" }) },
      { label: "Argue — waste time", effect: () => ({ timeCost: 45, log: "You argue for half an hour. They don't budge. You pay nothing but lose time. (+45 min)" }) },
    ],
  },
  // ── NEW: Rival merchant undercuts you ─────────────────────────────────────
  {
    id: "rival_merchant",
    title: "Rival in the Market",
    desc: "A Sembian merchant got here before you. He's flooded the stalls with the same goods you're carrying — prices are soft today.",
    condition: (state) => state.cargo.some(c => !c.questLocked && c.qty > 0),
    options: [
      { label: "Sell anyway at reduced prices", effect: (state) => ({ timeCost: 20, rivalActive: true, log: "You offload at a discount. The Sembian watches from across the square. (+20 min)" }) },
      { label: "Wait him out — lose 2 hours", effect: () => ({ timeCost: 120, log: "You nurse a drink until he clears out. Market recovers. (+2 hr)" }) },
    ],
  },
  // ── NEW: Cargo theft (low thieves rep) ───────────────────────────────────
  {
    id: "cargo_theft",
    title: "Sticky Fingers",
    desc: "You reach your destination and find a crate unsealed. Someone helped themselves to your goods en route.",
    condition: (state) => state.factions.thieves < 35 && state.cargo.some(c => !c.questLocked),
    options: [
      { label: "Curse your luck and move on", effect: (state) => {
          const stealable = state.cargo.filter(c => !c.questLocked);
          if (stealable.length === 0) return { log: "Nothing taken — your cargo was locked down." };
          const victim = stealable[Math.floor(Math.random() * stealable.length)];
          const stolen = Math.max(1, Math.floor(victim.qty * 0.3));
          const newCargo = state.cargo.map(c =>
            c.good === victim.good && !c.questLocked ? { ...c, qty: c.qty - stolen } : c
          ).filter(c => c.qty > 0);
          return { cargo: newCargo, log: `${stolen}x ${GOODS[victim.good].name} gone. Someone cut your ropes. Thieves Guild doesn't protect the unaffiliated.` };
        }
      },
    ],
  },
  // ── NEW: Planted tip (bad intel, inverse of whisper boost) ───────────────
  {
    id: "planted_tip",
    title: "Bad Intel",
    desc: "That tip about prices in Castle Ward? It was planted. A rival wanted you chasing a ghost route while he cleaned up Trade Ward.",
    condition: (state) => Object.keys(state.marketBoosts || {}).length > 0,
    options: [
      { label: "Cut your losses", effect: (state) => ({
          timeCost: 10,
          log: "The tip was wrong. You've been played. Boosts cleared.",
          clearBoosts: true,
        })
      },
    ],
  },
  {
    id: "arrest_warrant",
    title: "Wanted at the Gates",
    desc: "Watch sergeants have your description. A junior Watchman is watching your cart from across the square — hand near his whistle.",
    condition: (state) => state.factions.watch < 25,
    options: [
      // ── SOCIAL: Pay a fixer ───────────────────────────────────────────────
      {
        label: "Pay a fixer to clear your name",
        labelFn: (state) => `Pay a fixer (${state.gold >= 250 ? "250gp" : "can't afford it"})`,
        effect: (state) =>
          state.gold < 250
            ? { log: "You don't have 250gp. The fixer shrugs and walks away." }
            : { gold: state.gold - 250, timeCost: 60, factionChange: { watch: 8, thieves: -2 },
                log: "Coin changes hands in a back room. The warrant is 'misfiled.' (+1 hr)",
                rollDisplay: { type: "social", label: "Fixer paid", note: "250gp" } },
      },
      // ── SOCIAL: Bluff the Watchman — d20 + watch modifier + guild ────────
      {
        label: "Bluff the Watchman (Social — d20 Deception)",
        effect: (state) => {
          const mod = watchModifier(state.factions.watch) + guildModifier(state.factions.guild);
          const dc = 16; // Hard — they have your description
          const r = d20Roll(mod, dc);
          if (r.tier === "crit") {
            return { timeCost: 20, factionChange: { watch: 5 },
              log: `${rollSummary(r)} You convince him the warrant describes a different merchant — wrong cart color, wrong name. He apologizes. (+20 min)`,
              rollDisplay: { ...r, type: "social" } };
          } else if (r.tier === "success") {
            return { timeCost: 30, factionChange: { watch: 2 },
              log: `${rollSummary(r)} Close enough. He lets you through but files a note. (+30 min)`,
              rollDisplay: { ...r, type: "social" } };
          } else if (r.tier === "partial") {
            const fine = Math.round(state.gold * 0.08);
            return { gold: state.gold - fine, timeCost: 60, factionChange: { watch: -1 },
              log: `${rollSummary(r)} He's half-convinced but calls a superior. ${fine}gp "administrative fee" to go away. (+1 hr)`,
              rollDisplay: { ...r, type: "social" } };
          } else if (r.tier === "fumble") {
            return { gold: state.gold - Math.min(state.gold, 300), timeCost: 120, factionChange: { watch: -8 },
              log: `${rollSummary(r)} You overcomplicate the lie. Two more Watchmen arrive. 300gp fine and 2 hours lost. (+2 hr)`,
              rollDisplay: { ...r, type: "social" } };
          } else {
            return { gold: state.gold - Math.min(state.gold, 200), timeCost: 90, factionChange: { watch: -3 },
              log: `${rollSummary(r)} He doesn't buy it. 200gp fine, your name written down twice. (+90 min)`,
              rollDisplay: { ...r, type: "social" } };
          }
        },
      },
      // ── EXPLORATION: Vanish into the city — d20 + thieves modifier ────────
      {
        label: "Vanish into the city (Exploration — d20)",
        effect: (state) => {
          const mod = thievesModifier(state.factions.thieves);
          const dc = 13;
          const r = d20Roll(mod, dc);
          if (r.tier === "crit") {
            return { timeCost: 15, factionChange: { watch: -2, thieves: 2 },
              log: `${rollSummary(r)} You dissolve into the morning crowd like you were never there. The Watchman scratches his head. (+15 min)`,
              rollDisplay: { ...r, type: "exploration" } };
          } else if (r.tier === "success") {
            return { timeCost: 40, factionChange: { watch: -3 },
              log: `${rollSummary(r)} A long route through the warehouse district. You emerge two wards over, clean. (+40 min)`,
              rollDisplay: { ...r, type: "exploration" } };
          } else if (r.tier === "partial") {
            return { timeCost: 120, factionChange: { watch: -1 },
              log: `${rollSummary(r)} You lose them but lose 2 hours wandering. (+2 hr)`,
              rollDisplay: { ...r, type: "exploration" } };
          } else if (r.tier === "fumble") {
            return { gold: state.gold - Math.min(state.gold, 250), timeCost: 180, factionChange: { watch: -8 },
              log: `${rollSummary(r)} You run straight into a second patrol. Arrested, processed, fined 250gp. Three hours gone. (+3 hr)`,
              rollDisplay: { ...r, type: "exploration" } };
          } else {
            return { timeCost: 360, factionChange: { watch: 3 },
              log: `${rollSummary(r)} You lie low in a warehouse for 6 hours until the shift changes. The heat fades. (+6 hr)`,
              rollDisplay: { ...r, type: "exploration" } };
          }
        },
      },
    ],
  },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function WaterdeepTrader() {
  const [phase, setPhase] = useState("menu"); // menu | game | win | lose
  const [menuDifficulty, setMenuDifficulty] = useState("normal");
  /** Set when a run starts; drives win/time limits during play. */
  const [run, setRun] = useState(null);
  const [elapsed, setElapsed] = useState(0); // minutes elapsed
  const [gold, setGold] = useState(500);
  const [location, setLocation] = useState("trade");
  const [cargo, setCargo] = useState([]); // [{good, qty, paid, questLocked}]
  const [factions, setFactions] = useState({ watch: 50, thieves: 50, guild: 50 });
  const [quests, setQuests] = useState([]);
  const [log, setLog] = useState(["You arrive at Trade Ward with 500gp and an empty cart. Make your fortune."]);
  const [seeds, setSeeds] = useState(() => generateVolatilitySeeds());
  const [marketBoosts, setMarketBoosts] = useState({});
  const [event, setEvent] = useState(null);
  const [tab, setTab] = useState("market");
  const [toast, setToast] = useState(null);
  const [rollResult, setRollResult] = useState(null); // shown in modal after roll
  const [activeFactionInfo, setActiveFactionInfo] = useState(null); // key of tapped faction
  const toastTimer = useRef(null);
  const logRef = useRef(null);

  // ── Dynamic supply & upgrades ──
  const [ownedUpgrades, setOwnedUpgrades] = useState([]);      // ids of bought permanent upgrades
  const [consumables, setConsumables] = useState({});           // { bribe_kit: 2, fast_pass: 1, ... }
  const [priceMemory, setPriceMemory] = useState({});           // { districtId: { goodKey: { price, elapsed } } }
  const [availability, setAvailability] = useState({});         // { districtId: [goodKey, ...] }
  const [rivalActive, setRivalActive] = useState(false);        // rival merchant debuff this visit
  const [txnSpeedBonus, setTxnSpeedBonus] = useState(0);        // 0–1 fraction reduction

  function showToast(msg, reward) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, reward });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // Derived
  const cargoCapacity = CARGO_CAPACITY
    + (ownedUpgrades.includes("reinforced_cart") ? 6 : 0)
    + (ownedUpgrades.includes("second_cart") ? 12 : 0);
  const cargoUsed = cargo.reduce((s, c) => s + GOODS[c.good].cargoSize * c.qty, 0);
  const market = useCallback((districtId) => {
    const base = generateMarket(districtId, formatClock(elapsed).day, seeds, factions);
    const boost = marketBoosts[districtId];
    if (boost) base[boost.good] = Math.round(base[boost.good] * boost.multiplier);
    return base;
  }, [elapsed, seeds, marketBoosts, factions]);

  const currentMarket = market(location);
  const baseConnected = getConnected(location);
  const connected =
    factions.watch < 20 && location !== "castle"
      ? baseConnected.filter((id) => id !== "castle")
      : baseConnected;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => {
    if (!run) return;
    if (gold >= run.winGold) setPhase("win");
    if (elapsed >= run.totalMinutes) setPhase("lose");
  }, [gold, elapsed, run]);

  function addLog(msg) {
    setLog(prev => [...prev.slice(-49), msg]);
  }

  function applyEffect(eff) {
    if (!eff) return;
    if (eff.gold !== undefined) setGold(eff.gold);
    if (eff.cargo !== undefined) setCargo(eff.cargo);
    if (eff.quests !== undefined) setQuests(eff.quests);
    if (eff.factionChange) {
      setFactions(prev => {
        const next = { ...prev };
        Object.entries(eff.factionChange).forEach(([k, v]) => {
          next[k] = Math.max(0, Math.min(100, (next[k] || 50) + v));
        });
        return next;
      });
    }
    if (eff.marketBoost) {
      setMarketBoosts(prev => ({ ...prev, [eff.marketBoost.district]: { good: eff.marketBoost.good, multiplier: eff.marketBoost.multiplier } }));
    }
    if (eff.timeCost && run) setElapsed(e => Math.min(run.totalMinutes, e + eff.timeCost));
    if (eff.rivalActive) setRivalActive(true);
    if (eff.clearBoosts) setMarketBoosts({});
    if (eff.log) addLog(`📜 ${eff.log}`);
  }

  function buy(goodKey, qty, opts = {}) {
    // Check dynamic availability
    const avail = availability[location] || Object.keys(GOODS);
    if (!avail.includes(goodKey)) return addLog(`❌ ${GOODS[goodKey].name} isn't available here right now.`);

    let price = currentMarket[goodKey];
    if (opts.guildStockroom && goodKey !== "contraband" && GOODS[goodKey].legal && factions.guild > 75 && location === "trade") {
      price = Math.round(price * 0.92);
    }
    const good = GOODS[goodKey];
    const totalCost = price * qty;
    const spaceNeeded = good.cargoSize * qty;
    if (gold < totalCost) return addLog("❌ Not enough gold.");
    if (cargoUsed + spaceNeeded > cargoCapacity) return addLog("❌ Not enough cargo space.");
    setGold(g => g - totalCost);
    setCargo(prev => {
      const existing = prev.find(c => c.good === goodKey && !c.questLocked);
      if (existing) return prev.map(c => c.good === goodKey && !c.questLocked ? { ...c, qty: c.qty + qty, paid: Math.round((c.paid * c.qty + price * qty) / (c.qty + qty)) } : c);
      return [...prev, { good: goodKey, qty, paid: price, questLocked: false }];
    });
    const rawMins = txnMinutes(location, qty);
    const mins = Math.max(5, Math.round(rawMins * (1 - txnSpeedBonus)));
    if (run) setElapsed(e => Math.min(run.totalMinutes, e + mins));
    addLog(`🛒 Bought ${qty}x ${good.name} for ${totalCost}gp (${price}gp each). ${fmtDelta(mins)}`);
  }

  function sell(goodKey, qty) {
    const item = cargo.find(c => c.good === goodKey && !c.questLocked);
    if (!item || item.qty < qty) return addLog("❌ You don't have that many.");
    let unit = sellUnitPrice(goodKey, currentMarket[goodKey], location, factions);
    // Buying premium — ward wants this good
    const buyingHere = (BUYING_PREMIUM[location] || []).includes(goodKey);
    if (buyingHere) unit = Math.round(unit * 1.15);
    // Rival merchant debuff
    if (rivalActive) unit = Math.round(unit * 0.80);
    const totalGain = unit * qty;
    const profit = totalGain - item.paid * qty;
    setGold(g => g + totalGain);
    setCargo(prev =>
      prev.map(c => c.good === goodKey && !c.questLocked ? { ...c, qty: c.qty - qty } : c).filter(c => c.qty > 0)
    );
    const rawMins = txnMinutes(location, qty);
    const mins = Math.max(5, Math.round(rawMins * (1 - txnSpeedBonus)));
    if (run) setElapsed(e => Math.min(run.totalMinutes, e + mins));
    const premNote = buyingHere ? " [wanted here +15%]" : "";
    const rivalNote = rivalActive ? " [rival -20%]" : "";
    addLog(`💰 Sold ${qty}x ${GOODS[goodKey].name} for ${totalGain}gp. Profit: ${profit >= 0 ? "+" : ""}${profit}gp.${premNote}${rivalNote} ${fmtDelta(mins)}`);
  }

  // Called on arrival at a district — resolves any quests whose destination matches
  function resolveQuestsAtDistrict(destId, currentCargo, currentQuests) {
    let updatedCargo = [...currentCargo];
    let updatedQuests = [...currentQuests];
    let goldBonus = 0;
    let factionBonus = 0;
    let resolved = false;

    currentQuests.forEach(q => {
      if (!q.complete && q.destDistrict === destId) {
        const questCargo = currentCargo.find(c => c.good === q.goodRequired && c.questLocked);
        if (questCargo) {
          goldBonus += q.reward;
          factionBonus += 5;
          updatedCargo = updatedCargo.filter(c => !(c.good === q.goodRequired && c.questLocked));
          updatedQuests = updatedQuests.map(qq => qq.id === q.id ? { ...qq, complete: true } : qq);
          addLog(`✅ Quest complete! Delivered ${GOODS[q.goodRequired].name} to ${DISTRICTS[destId].name}. Reward: ${q.reward}gp.`);
          showToast(`Delivered ${GOODS[q.goodRequired].name} to ${DISTRICTS[destId].name}`, q.reward);
          resolved = true;
        }
      }
    });

    if (resolved) {
      setGold(g => g + goldBonus);
      setCargo(updatedCargo);
      setQuests(updatedQuests);
      setFactions(prev => ({ ...prev, guild: Math.min(100, prev.guild + factionBonus) }));
    }

    return { updatedCargo, updatedQuests };
  }

  function travel(destId) {
    const travelCost = travelMinutes(location, destId);
    const newElapsed = run ? Math.min(run.totalMinutes, elapsed + travelCost) : elapsed + travelCost;
    const clock = formatClock(newElapsed);

    const newSeeds = generateVolatilitySeeds();
    setElapsed(newElapsed);
    setLocation(destId);
    setSeeds(newSeeds);
    setRivalActive(false); // rival debuff clears on travel

    // Record price memory for destination (using new seeds)
    const arrivedMarket = generateMarket(destId, formatClock(newElapsed).day, newSeeds, factions);
    const boostAtDest = marketBoosts[destId];
    if (boostAtDest) arrivedMarket[boostAtDest.good] = Math.round(arrivedMarket[boostAtDest.good] * boostAtDest.multiplier);
    setPriceMemory(prev => ({
      ...prev,
      [destId]: Object.fromEntries(
        Object.keys(GOODS).map(g => [g, { price: arrivedMarket[g], elapsed: newElapsed }])
      ),
    }));

    // Regenerate availability for destination
    const newAvail = generateAvailability(destId, newSeeds, factions, marketBoosts);
    setAvailability(prev => ({ ...prev, [destId]: newAvail }));

    addLog(`🗺️ ${clock.str}: Traveled to ${DISTRICTS[destId].name}. ${fmtDelta(travelCost)}`);

    // Check expired quests by clock time
    let liveCargo = cargo;
    let liveQuests = quests;
    const expired = liveQuests.filter(q => !q.complete && q.deadlineMinutes && newElapsed > q.deadlineMinutes);
    if (expired.length > 0) {
      expired.forEach(q => addLog(`⚠️ Quest failed: "${q.label}" — deadline passed.`));
      liveQuests = liveQuests.filter(q => !expired.find(e => e.id === q.id));
      liveCargo = liveCargo.filter(c => !c.questLocked);
      setQuests(liveQuests);
      setCargo(liveCargo);
    }

    // Chain quest: arriving at leg1 pickup point adds cargo and converts to leg2
    liveQuests = liveQuests.map(q => {
      if (!q.complete && q.cargoAdded === false && q.destDistrict === destId) {
        const hasStock = availability[destId] ? availability[destId].includes(q.goodRequired) : true;
        if (hasStock) {
          const spaceNeeded = GOODS[q.goodRequired].cargoSize * 2;
          if (cargoUsed + spaceNeeded <= cargoCapacity) {
            liveCargo = [...liveCargo, { good: q.goodRequired, qty: 2, paid: 0, questLocked: true }];
            addLog(`📦 Picked up ${GOODS[q.goodRequired].name} for chain delivery.`);
            if (q.chainNext) {
              return { ...q.chainNext, deadlineMinutes: q.deadlineMinutes, complete: false, cargoAdded: true };
            }
            return { ...q, cargoAdded: true };
          }
        }
      }
      return q;
    });
    setQuests(liveQuests);
    setCargo(liveCargo);

    const { updatedCargo, updatedQuests } = resolveQuestsAtDistrict(destId, liveCargo, liveQuests);

    const eventState = { cargo: updatedCargo, quests: updatedQuests, elapsed: newElapsed, factions };
    const eligibleEvents = EVENTS.filter((e) => e.condition(eventState));
    let eventChance = 0.45;
    if (factions.watch < 40) eventChance += 0.15;
    if (factions.thieves > 65) eventChance -= 0.1;
    eventChance = Math.max(0.12, Math.min(0.85, eventChance));

    if (eligibleEvents.length > 0 && Math.random() < eventChance) {
      const chosen = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
      setEvent(chosen);
    } else if (factions.guild > 70 && Math.random() < 0.16) {
      const tip = GUILD_WHISPER_BOOSTS[Math.floor(Math.random() * GUILD_WHISPER_BOOSTS.length)];
      setMarketBoosts((prev) => ({
        ...prev,
        [tip.district]: { good: tip.good, multiplier: tip.multiplier },
      }));
      addLog(`📜 Guild whisper: ${GOODS[tip.good].name} is moving in ${DISTRICTS[tip.district].name}.`);
    }
  }

  function handleEventOption(option) {
    const state = { gold, cargo, elapsed, quests, factions, marketBoosts };
    const effect = option.effect(state);
    applyEffect(effect);
    if (effect && effect.rollDisplay) {
      setRollResult(effect.rollDisplay);
      // Don't close the event yet — show the roll result, then dismiss
    } else {
      setEvent(null);
    }
  }

  function buyUpgrade(upgrade, isConsumable = false) {
    if (gold < upgrade.cost) return addLog(`❌ Not enough gold for ${upgrade.name}.`);
    setGold(g => g - upgrade.cost);
    if (isConsumable) {
      setConsumables(prev => ({ ...prev, [upgrade.id]: Math.min(3, (prev[upgrade.id] || 0) + 1) }));
      addLog(`✅ Bought ${upgrade.name} (x${(consumables[upgrade.id] || 0) + 1}). ${upgrade.desc}`);
    } else {
      setOwnedUpgrades(prev => [...prev, upgrade.id]);
      // Apply permanent effects
      if (upgrade.effect.txnSpeedBonus) setTxnSpeedBonus(prev => Math.min(0.5, prev + upgrade.effect.txnSpeedBonus));
      if (upgrade.effect.factionChange) {
        setFactions(prev => {
          const next = { ...prev };
          Object.entries(upgrade.effect.factionChange).forEach(([k,v]) => {
            next[k] = Math.max(0, Math.min(100, (next[k] || 50) + v));
          });
          return next;
        });
      }
      addLog(`✅ Purchased ${upgrade.name}. ${upgrade.desc}`);
    }
  }

  function useConsumable(id) {
    if (!consumables[id] || consumables[id] <= 0) return;
    setConsumables(prev => ({ ...prev, [id]: prev[id] - 1 }));
    if (id === "fast_pass") {
      addLog("⚡ Fast Pass used — next travel costs 30 min.");
      // We store this as a one-shot flag; travel() will check it
      setConsumables(prev => ({ ...prev, __fast_pass_pending: true }));
    }
    if (id === "bribe_kit") {
      addLog("💰 Bribe Kit ready — next Watch encounter auto-resolved.");
      setConsumables(prev => ({ ...prev, __bribe_pending: true }));
    }
    if (id === "decoy_crate") {
      addLog("📦 Decoy Crate set — next contraband inspection will find nothing.");
      setConsumables(prev => ({ ...prev, __decoy_pending: true }));
    }
  }

  function startGame() {
    const cfg = DIFFICULTY_PRESETS[menuDifficulty] || DIFFICULTY_PRESETS.normal;
    setRun({ totalMinutes: cfg.totalMinutes, winGold: cfg.winGold });
    setPhase("game");
    setElapsed(0);
    setGold(cfg.startGold);
    setLocation("trade");
    setCargo([]);
    setFactions({ watch: 50, thieves: 50, guild: 50 });
    setQuests([]);
    setLog([`Day 1 · 08:00 — You arrive at Trade Ward with ${cfg.startGold.toLocaleString()}gp and an empty cart. Make your fortune.`]);
    const initSeeds = generateVolatilitySeeds();
    setSeeds(initSeeds);
    setMarketBoosts({});
    setEvent(null);
    setTab("market");
    setOwnedUpgrades([]);
    setConsumables({});
    setPriceMemory({});
    setRivalActive(false);
    setTxnSpeedBonus(0);
    setRollResult(null);
    setActiveFactionInfo(null);
    // Generate initial availability for Trade Ward
    setAvailability({ trade: generateAvailability("trade", initSeeds, { watch:50, thieves:50, guild:50 }, {}) });
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  const gold_pct = run ? Math.min(100, (gold / run.winGold) * 100) : 0;
  const cargo_pct = (cargoUsed / cargoCapacity) * 100;
  const timeLeft = run ? run.totalMinutes - elapsed : 0;
  const timePct  = run ? Math.max(0, timeLeft / run.totalMinutes) : 1;
  const clock    = formatClock(elapsed);
  const timeUrgent  = timeLeft < 240;  // < 4 hours
  const timeWarning = timeLeft < 480;  // < 8 hours

  if (phase === "menu") {
    return (
      <MenuScreen
        difficulty={menuDifficulty}
        onDifficulty={setMenuDifficulty}
        onStart={startGame}
      />
    );
  }
  if (phase === "win") return <EndScreen win={true} elapsed={elapsed} gold={gold} run={run} onRestart={startGame} />;
  if (phase === "lose") return <EndScreen win={false} elapsed={elapsed} gold={gold} run={run} onRestart={startGame} />;

  const dist = DISTRICTS[location];

  const TABS = [
    { id: "market", label: "🏪", full: "Market" },
    { id: "travel", label: "🗺️", full: "Travel" },
    { id: "quests", label: "📋", full: "Quests" },
    { id: "cargo",  label: "📦", full: "Cargo" },
    { id: "log",    label: "📜", full: "Log" },
  ];

  return (
    <div style={styles.root}>
      <div style={styles.texture} />

      {/* EVENT MODAL */}
      {event && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <span style={styles.modalIcon}>
                {event.id === "watch_patrol" ? "🛡️" : event.id === "thieves_toll" ? "🗡️" : event.id === "arrest_warrant" ? "⚠️" : "⚔️"}
              </span>
              <span style={styles.modalTitle}>{event.title}</span>
            </div>
            <p style={styles.modalDesc}>{event.desc}</p>

            {rollResult ? (
              // ── Roll result screen ──────────────────────────────────────
              <div>
                <RollResultDisplay result={rollResult} />
                <button style={{...styles.modalBtn, marginTop:12, textAlign:"center", background:"#1a2a1a", borderColor:"#3a5a3a", color:"#a0c4a0"}}
                  onClick={() => { setRollResult(null); setEvent(null); }}>
                  Continue →
                </button>
              </div>
            ) : (
              // ── Option buttons ──────────────────────────────────────────
              <div style={styles.modalOptions}>
                {event.options.map((opt, i) => {
                  // Support dynamic labels based on state
                  const state = { gold, cargo, elapsed, quests, factions };
                  const label = opt.labelFn ? opt.labelFn(state) : opt.label;
                  const isPillar = opt.label && (
                    opt.label.includes("Social") || opt.label.includes("Exploration") ||
                    opt.label.includes("Combat") || opt.label.includes("d20")
                  );
                  const pillarColor = opt.label?.includes("Social") ? "#4a90d9"
                    : opt.label?.includes("Exploration") ? "#6abf6a"
                    : opt.label?.includes("Combat") ? "#e05c5c"
                    : null;
                  return (
                    <button key={i} style={{
                      ...styles.modalBtn,
                      borderLeftColor: pillarColor || "#3a3020",
                      borderLeftWidth: pillarColor ? 3 : 1,
                    }} onClick={() => handleEventOption(opt)}>
                      {pillarColor && (
                        <span style={{fontSize:10, color: pillarColor, display:"block", marginBottom:2, letterSpacing:1}}>
                          {opt.label?.includes("Social") ? "⚡ SOCIAL" : opt.label?.includes("Exploration") ? "🗺️ EXPLORATION" : "⚔️ COMBAT"}
                        </span>
                      )}
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOP BAR — compact on mobile */}
      <div style={styles.topBar}>
        <div style={styles.topTitle}>⚓ WATERDEEP TRADER</div>
        <div style={styles.topStats}>
          <StatChip label="Gold" value={`${gold.toLocaleString()}gp`} icon="🪙" color="#e6a817" />
          <div style={styles.statChip} title={`${Math.floor(timeLeft/60)}h ${timeLeft%60}m remaining`}>
            <span style={{ fontSize: 10, color: timeUrgent ? "#e05c5c" : timeWarning ? "#e08c2a" : "#aaa" }}>CLOCK</span>
            <span style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: 12,
              color: timeUrgent ? "#e05c5c" : timeWarning ? "#e08c2a" : "#a0c4a0" }}>{clock.str}</span>
            <div style={styles.miniBar}>
              <div style={{ ...styles.miniBarFill, width: `${timePct * 100}%`,
                background: timeUrgent ? "#e05c5c" : timeWarning ? "#e08c2a" : "#4a90d9" }} />
            </div>
          </div>
          <div style={styles.statChip}>
            <span style={{ color: "#aaa", fontSize: 10 }}>CARGO</span>
            <div style={styles.miniBar}>
              <div style={{ ...styles.miniBarFill, width: `${cargo_pct}%`, background: cargo_pct > 80 ? "#e05c5c" : "#e6a817" }} />
            </div>
            <span style={{ color: "#e6a817", fontSize: 11, fontFamily: "monospace" }}>{cargoUsed}/{cargoCapacity}</span>
          </div>
          <div style={styles.statChip}>
            <span style={{ color: "#aaa", fontSize: 10 }}>GOAL</span>
            <div style={styles.miniBar}>
              <div style={{ ...styles.miniBarFill, width: `${gold_pct}%`, background: "#e6a817" }} />
            </div>
            <span style={{ color: "#e6a817", fontSize: 11, fontFamily: "monospace" }}>{Math.round(gold_pct)}%</span>
          </div>
        </div>
      </div>

      {/* FACTION BARS */}
      <div style={styles.factionBar}>
        {Object.entries(FACTIONS).map(([key, f]) => {
          const val = factions[key];
          return (
            <button key={key} onClick={() => setActiveFactionInfo(activeFactionInfo === key ? null : key)}
              style={{ ...styles.factionItem, background:"transparent", border:"none", cursor:"pointer",
                padding:"4px 6px", borderRadius:4,
                outline: activeFactionInfo === key ? `1px solid ${f.color}55` : "none" }}>
              <span style={{ fontSize: 13 }}>{f.emoji}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize: 10, color: "#888", whiteSpace:"nowrap", textAlign:"left", marginBottom:2 }}>{f.name}</div>
                <div style={styles.factionTrack}>
                  <div style={{ ...styles.factionFill, width: `${val}%`, background: f.color }} />
                </div>
              </div>
              <span style={{ fontSize: 10, color: f.color, fontFamily: "monospace", minWidth: 22, textAlign:"right" }}>{val}</span>
            </button>
          );
        })}
      </div>

      {/* FACTION INFO PANEL — shown when a bar is tapped */}
      {activeFactionInfo && (() => {
        const key = activeFactionInfo;
        const f = FACTIONS[key];
        const val = factions[key];
        const infos = {
          watch: {
            what: "The City Watch enforces Waterdeep's laws. Their opinion of you affects patrols, bribes, and district access.",
            thresholds: [
              { range: "81–100", color: "#6abf6a", label: "Above reproach — patrols ignore you" },
              { range: "61–80",  color: "#a0c4a0", label: "Good standing — minimal scrutiny" },
              { range: "41–60",  color: "#888",    label: "Neutral — contraband will be checked" },
              { range: "21–40",  color: "#e08c2a", label: "Suspicious — price markups in Castle & North Ward" },
              { range: "16–20",  color: "#e05c5c", label: "Wanted — arrest events, surcharges everywhere" },
              { range: "0–15",   color: "#9b3a3a", label: "Outlaw — Castle Ward gates are closed to you" },
            ],
            how: "Rises: paying fines, successful persuasion, fixer payments. Falls: bribes, failed bluffs, contraband caught.",
          },
          thieves: {
            what: "The Shadow Thieves control Waterdeep's underworld. Reputation with them affects tolls, contraband prices, and street safety.",
            thresholds: [
              { range: "81–100", color: "#c084f5", label: "Connected — Guild stockroom open, tolls gone" },
              { range: "66–80",  color: "#9b59b6", label: "Known — reduced toll events, contraband discounts" },
              { range: "36–65",  color: "#888",    label: "Neutral — tolls apply, standard rates" },
              { range: "16–35",  color: "#e08c2a", label: "Distrusted — cargo theft risk, heavy tolls" },
              { range: "0–15",   color: "#e05c5c", label: "Marked — frequent theft, worst flee DCs" },
            ],
            how: "Rises: paying tolls, successful negotiations, declining to rat them out. Falls: refusing tolls, running from them, Watch bribes.",
          },
          guild: {
            what: "The Merchant's Guild sets trade standards across Waterdeep. High standing unlocks discounts, intel, and premium contracts.",
            thresholds: [
              { range: "86–100", color: "#f5d060", label: "Master Merchant — max discounts + all perks" },
              { range: "76–85",  color: "#e6a817", label: "Senior Member — bulk pricing at Trade Ward" },
              { range: "71–75",  color: "#c9a84c", label: "Member — premium quests unlocked" },
              { range: "66–70",  color: "#a07820", label: "Associate — 7% discount on legal goods" },
              { range: "46–65",  color: "#888",    label: "Registered — market tips available" },
              { range: "0–45",   color: "#555",    label: "Unknown — no Guild perks" },
            ],
            how: "Rises: completing quests, accepting Guild contracts, buying Guild Membership upgrade. Falls: declining contracts.",
          },
        };
        const info = infos[key];
        return (
          <div style={{ background:"#0c0a06", borderBottom:`1px solid ${f.color}33`, padding:"10px 14px", zIndex:5 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div>
                <span style={{ fontSize:16, marginRight:6 }}>{f.emoji}</span>
                <span style={{ color: f.color, fontWeight:"bold", fontSize:14 }}>{f.name}</span>
                <span style={{ color:"#555", fontSize:12, marginLeft:8 }}>currently {val}</span>
              </div>
              <button onClick={() => setActiveFactionInfo(null)}
                style={{ background:"transparent", border:"none", color:"#555", fontSize:16, cursor:"pointer", padding:"0 4px" }}>✕</button>
            </div>
            <p style={{ color:"#888", fontSize:12, margin:"0 0 8px", lineHeight:1.5 }}>{info.what}</p>
            <div style={{ display:"flex", flexDirection:"column", gap:3, marginBottom:8 }}>
              {info.thresholds.map(t => (
                <div key={t.range} style={{ display:"flex", gap:8, alignItems:"center",
                  opacity: (() => { const [lo,hi] = t.range.split("–").map(Number); return val >= lo && val <= hi ? 1 : 0.45; })() }}>
                  <span style={{ fontFamily:"monospace", fontSize:10, color: t.color, minWidth:52 }}>{t.range}</span>
                  <span style={{ fontSize:11, color: t.color }}>
                    {(() => { const [lo,hi] = t.range.split("–").map(Number); return val >= lo && val <= hi ? "▶ " : ""; })()}
                    {t.label}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ color:"#555", fontSize:11, margin:0, fontStyle:"italic" }}>{info.how}</p>
          </div>
        );
      })()}

      {/* LOCATION HEADER — full width, compact */}
      <div style={styles.locationCard}>
        <div style={styles.locationEmoji}>{dist.emoji}</div>
        <div style={{minWidth:0}}>
          <div style={styles.locationName}>{dist.name}</div>
          <div style={styles.locationDesc}>{dist.desc}</div>
        </div>
      </div>

      {/* TABS — full width */}
      <div style={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }}
            onClick={() => setTab(t.id)}
          >
            <span style={{fontSize:15}}>{t.label}</span>
            <span style={{fontSize:10, display:"block", marginTop:1}}>{t.full}</span>
          </button>
        ))}
      </div>

      {/* SINGLE SCROLLABLE CONTENT AREA */}
      <div style={styles.tabContent}>
        {tab === "market" && (
          <MarketTab
            market={currentMarket}
            cargo={cargo}
            gold={gold}
            cargoUsed={cargoUsed}
            cargoCapacity={cargoCapacity}
            onBuy={buy}
            onSell={sell}
            quests={quests}
            location={location}
            factions={factions}
            availability={availability[location] || Object.keys(GOODS)}
            buyingPremium={BUYING_PREMIUM[location] || []}
            rivalActive={rivalActive}
            shopInventory={getShopInventory(location, seeds, ownedUpgrades)}
            onBuyUpgrade={buyUpgrade}
            consumables={consumables}
            onUseConsumable={useConsumable}
          />
        )}
        {tab === "travel" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <MapView
              location={location}
              connected={connected}
              onTravel={(id) => { travel(id); setTab("market"); }}
              fullscreen={false}
              subline="Map or list below — 1 day per move"
              castleBlocked={factions.watch < 20 && location !== "castle"}
            />
            <TravelTab
              connected={connected}
              location={location}
              onTravel={(id) => { travel(id); setTab("market"); }}
              elapsed={elapsed}
              run={run}
              castleBlocked={factions.watch < 20 && location !== "castle"}
              priceMemory={priceMemory}
            />
          </div>
        )}
        {tab === "quests" && <QuestsTab quests={quests} elapsed={elapsed} />}
        {tab === "cargo" && <CargoTab cargo={cargo} market={currentMarket} location={location} factions={factions} />}
        {tab === "log"    && (
          <div style={{display:"flex", flexDirection:"column", gap:6}}>
            <div style={styles.logTitle}>📜 Captain's Log</div>
            {log.slice().reverse().map((entry, i) => (
              <div key={i} style={{ ...styles.logEntry, opacity: 1 - i * 0.04, fontSize: i === 0 ? 14 : 13 }}>{entry}</div>
            ))}
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "#1a2a12", border: "1px solid #4a8a2a",
          borderRadius: 10, padding: "12px 20px", zIndex: 200,
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.7)",
          animation: "slideUp 0.3s ease",
          maxWidth: "90vw",
        }}>
          <span style={{fontSize: 24}}>✅</span>
          <div>
            <div style={{color:"#6abf6a", fontWeight:"bold", fontSize:14}}>Quest Complete!</div>
            <div style={{color:"#c8b87a", fontSize:13, marginTop:2}}>{toast.msg}</div>
          </div>
          <div style={{
            marginLeft: 8, background: "#2a4a1a", border: "1px solid #4a8a2a",
            borderRadius: 6, padding: "4px 10px", color:"#a0c4a0",
            fontFamily:"monospace", fontWeight:"bold", fontSize:15, flexShrink:0,
          }}>+{toast.reward}gp</div>
        </div>
      )}
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
    </div>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function RollResultDisplay({ result }) {
  if (!result) return null;

  // Simple paid/skipped display (no roll)
  if (!result.roll) {
    return (
      <div style={{ background:"#0f0d08", border:"1px solid #3a3020", borderRadius:8, padding:"14px 16px", textAlign:"center" }}>
        <div style={{ fontSize:36, marginBottom:6 }}>{result.type === "social" ? "🗣️" : "🗺️"}</div>
        <div style={{ color:"#e6d5a8", fontSize:16, fontWeight:"bold" }}>{result.label}</div>
        {result.note && <div style={{ color:"#888", fontSize:13, marginTop:4 }}>{result.note}</div>}
      </div>
    );
  }

  const tierData = {
    crit:    { emoji:"🌟", label:"CRITICAL SUCCESS", color:"#f5d060", bg:"rgba(245,208,96,0.08)" },
    success: { emoji:"✅", label:"SUCCESS",          color:"#6abf6a", bg:"rgba(106,191,106,0.08)" },
    partial: { emoji:"⚡", label:"PARTIAL SUCCESS",  color:"#e08c2a", bg:"rgba(224,140,42,0.08)" },
    fail:    { emoji:"❌", label:"FAIL",             color:"#e05c5c", bg:"rgba(224,92,92,0.08)"  },
    fumble:  { emoji:"💀", label:"FUMBLE",           color:"#9b3a3a", bg:"rgba(155,58,58,0.12)" },
  };
  const t = tierData[result.tier] || tierData.fail;
  const typeIcon = result.type === "social" ? "🗣️" : result.type === "exploration" ? "🗺️" : "⚔️";
  const typeLabel = result.type === "social" ? "Social" : result.type === "exploration" ? "Exploration" : "Combat";

  return (
    <div style={{ background: t.bg, border:`1px solid ${t.color}44`, borderRadius:8, padding:"16px", textAlign:"center" }}>
      <div style={{ fontSize:11, color:"#666", letterSpacing:2, marginBottom:8 }}>{typeIcon} {typeLabel.toUpperCase()} CHECK</div>
      {/* Die face */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginBottom:12 }}>
        <div style={{ background:"#13100a", border:`2px solid ${t.color}`, borderRadius:8,
          width:56, height:56, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:24, fontFamily:"monospace", fontWeight:"bold", color:t.color,
          boxShadow:`0 0 12px ${t.color}44` }}>
          {result.roll}
        </div>
        <div style={{ textAlign:"left" }}>
          <div style={{ fontSize:12, color:"#888" }}>
            {result.roll}
            {result.modifier !== 0 && <span style={{ color: result.modifier > 0 ? "#6abf6a" : "#e05c5c" }}>
              {result.modifier > 0 ? " +" : " "}{result.modifier}
            </span>}
            {" = "}<span style={{ color:"#e6d5a8", fontWeight:"bold" }}>{result.total}</span>
          </div>
          <div style={{ fontSize:11, color:"#555" }}>vs DC {result.dc}</div>
        </div>
      </div>
      {/* Outcome */}
      <div style={{ fontSize:20, marginBottom:4 }}>{t.emoji}</div>
      <div style={{ fontSize:16, fontWeight:"bold", color:t.color, letterSpacing:1 }}>{t.label}</div>
    </div>
  );
}

function StatChip({ label, value, icon, color }) {
  return (
    <div style={styles.statChip}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ color: "#aaa", fontSize: 11 }}>{label}</span>
      <span style={{ color, fontFamily: "monospace", fontWeight: "bold", fontSize: 14 }}>{value}</span>
    </div>
  );
}

function MarketTab({ market, cargo, gold, cargoUsed, cargoCapacity, onBuy, onSell, quests, location, factions, availability, buyingPremium, rivalActive, shopInventory, onBuyUpgrade, consumables, onUseConsumable }) {
  const [qty, setQty] = useState(1);
  const [hideUnavailable, setHideUnavailable] = useState(false);

  const deliverableHere = quests.filter(
    q => !q.complete && q.destDistrict === location && cargo.some(c => c.good === q.goodRequired && c.questLocked)
  );

  const showGuildStock = location === "trade" && factions.guild > 75;
  const showDockShadow = location === "dock" && factions.thieves > 80;
  const goodKeysOrdered = showDockShadow
    ? [...Object.keys(GOODS).filter((k) => k !== "contraband"), "contraband"]
    : Object.keys(GOODS);

  return (
    <div>
      {deliverableHere.map(q => (
        <div key={q.id} style={styles.deliveryBanner}>
          <span style={{fontSize:18}}>📦</span>
          <div>
            <div style={{color:"#e6a817",fontWeight:"bold",fontSize:13}}>Quest Delivery Ready!</div>
            <div style={{color:"#a0c4a0",fontSize:12,marginTop:2}}>Reward: {q.reward}gp — resolves on next travel ✓</div>
          </div>
        </div>
      ))}

      {showDockShadow && (
        <div style={{ ...styles.deliveryBanner, background: "rgba(45, 25, 55, 0.35)", borderColor: "#4a2a5a", marginBottom: 10 }}>
          <span style={{ fontSize: 18 }}>🗡️</span>
          <div>
            <div style={{ color: "#c090d8", fontWeight: "bold", fontSize: 13 }}>Shadow channel (Dock)</div>
            <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>Your contacts move contraband at keener rates in this ward.</div>
          </div>
        </div>
      )}

      {/* Qty selector + filter */}
      <div style={{...styles.qtyRow, justifyContent:"space-between"}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <span style={styles.sectionLabel}>Qty:</span>
          {[1,5,10].map(q => (
            <button key={q} style={{ ...styles.qtyBtn, ...(qty===q ? styles.qtyBtnActive : {}) }} onClick={() => setQty(q)}>{q}</button>
          ))}
        </div>
        <label style={{display:"flex", alignItems:"center", gap:5, cursor:"pointer", color:"#666", fontSize:11, userSelect:"none"}}>
          <input
            type="checkbox"
            checked={hideUnavailable}
            onChange={e => setHideUnavailable(e.target.checked)}
            style={{accentColor:"#e6a817", cursor:"pointer"}}
          />
          Hide not stocked
        </label>
      </div>

      {/* Card-per-good layout */}
      <div style={{display:"flex", flexDirection:"column", gap:6}}>
        {goodKeysOrdered.filter(key => !hideUnavailable || availability.includes(key)).map((key) => {
          const good = GOODS[key];
          const isAvailable = availability.includes(key);
          const buyPrice = market[key];
          let sellPrice = sellUnitPrice(key, buyPrice, location, factions);
          const isBuyingHere = buyingPremium.includes(key);
          if (isBuyingHere) sellPrice = Math.round(sellPrice * 1.15);
          if (rivalActive) sellPrice = Math.round(sellPrice * 0.80);
          const splitPrice = !good.legal && factions.thieves > 65;
          const heldItem = cargo.find(c => c.good === key && !c.questLocked);
          const held = heldItem?.qty || 0;
          const paid = heldItem?.paid || 0;
          const pnlTotal = held > 0 ? (sellPrice - paid) * held : null;
          const canBuy = isAvailable && gold >= buyPrice * qty && cargoUsed + good.cargoSize * qty <= cargoCapacity;
          const canSell = held >= qty;
          const isQuestLocked = cargo.some(c => c.good === key && c.questLocked);
          const isIllicit = !good.legal;

          return (
            <div key={key} style={{
              background: isIllicit ? "rgba(155,89,182,0.07)" : held > 0 ? "rgba(40,60,30,0.25)" : "#0f0d08",
              border: `1px solid ${held > 0 ? "#2a4020" : isIllicit ? "#2a1a3a" : "#1e1a10"}`,
              borderRadius: 6,
              padding: "8px 10px",
            }}>
              {/* Row 1: name + price + pnl badge */}
              <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:5}}>
                <span style={{fontSize:16, flexShrink:0}}>{good.emoji}</span>
                <span style={{color: isAvailable ? "#e6d5a8" : "#4a4030", fontSize:13, fontWeight:"bold", flex:1, minWidth:0}}>
                  {good.name}
                  {isIllicit && <span style={{color:"#9b59b6",fontSize:10,marginLeft:5}}>[illicit]</span>}
                  {isQuestLocked && <span style={{color:"#e6a817",fontSize:10,marginLeft:5}}>[quest]</span>}
                  {isBuyingHere && <span style={{color:"#6abf6a",fontSize:10,marginLeft:5}}>▲ wanted</span>}
                  {!isAvailable && <span style={{color:"#555",fontSize:10,marginLeft:5}}>[not stocked]</span>}
                </span>
                {/* Price */}
                <span style={{ fontFamily: "monospace", color: "#e6a817", fontWeight: "bold", fontSize: splitPrice ? 12 : 14, flexShrink: 0, textAlign: "right" }}>
                  {splitPrice ? (
                    <>
                      <span style={{ display: "block" }}>buy {buyPrice}gp</span>
                      <span style={{ display: "block", color: "#a0c4a0" }}>sell {sellPrice}gp</span>
                    </>
                  ) : (
                    `${buyPrice}gp`
                  )}
                </span>
              </div>

              {/* Row 2: held info + buy/sell buttons */}
              <div style={{display:"flex", alignItems:"center", gap:6}}>
                {/* Held / paid / pnl — left side */}
                <div style={{flex:1, fontSize:11, fontFamily:"monospace", display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
                  {held > 0 ? (
                    <>
                      <span style={{color:"#888"}}>held: <span style={{color:"#c8b87a"}}>{held}</span></span>
                      <span style={{color:"#666"}}>paid: <span style={{color:"#888"}}>{paid}gp</span></span>
                      <span style={{
                        color: pnlTotal >= 0 ? "#6abf6a" : "#e05c5c",
                        fontWeight:"bold",
                      }}>
                        {pnlTotal >= 0 ? "▲" : "▼"}{Math.abs(pnlTotal)}gp
                      </span>
                    </>
                  ) : (
                    <span style={{color:"#444"}}>not held · {good.cargoSize}u/ea</span>
                  )}
                </div>

                {/* Buttons — right side, always visible */}
                <button
                  style={{
                    ...styles.tradeBtn, ...styles.buyBtn,
                    opacity: canBuy ? 1 : 0.28,
                    cursor: canBuy ? "pointer" : "default",
                    padding: "5px 14px", fontSize: 13,
                  }}
                  onClick={() => canBuy && onBuy(key, qty, {})}
                >Buy</button>
                <button
                  style={{
                    ...styles.tradeBtn, ...styles.sellBtn,
                    opacity: canSell ? 1 : 0.28,
                    cursor: canSell ? "pointer" : "default",
                    padding: "5px 14px", fontSize: 13,
                  }}
                  onClick={() => canSell && onSell(key, qty)}
                >Sell</button>
              </div>
            </div>
          );
        })}
      </div>

      {showGuildStock && (
        <>
          <div style={{ ...styles.sectionLabel, marginTop: 16, marginBottom: 8, color: "#e6a817", letterSpacing: 1 }}>
            ⚖️ Guild stockroom (bulk pricing)
          </div>
          <div style={{ color: "#666", fontSize: 11, marginBottom: 8 }}>
            Member rate: 8% off list buy on legal goods (uses qty above).
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(GOODS)
              .filter(([, g]) => g.legal)
              .map(([key, good]) => {
                const listBuy = market[key];
                const bulkBuy = Math.round(listBuy * 0.92);
                const canBuy =
                  gold >= bulkBuy * qty && cargoUsed + good.cargoSize * qty <= cargoCapacity;
                return (
                  <div
                    key={`guild-${key}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      background: "rgba(230, 168, 23, 0.06)",
                      border: "1px solid #3a3020",
                      borderRadius: 6,
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{good.emoji}</span>
                    <span style={{ flex: 1, color: "#e6d5a8", fontSize: 12, fontWeight: "bold" }}>{good.name}</span>
                    <span style={{ fontFamily: "monospace", color: "#c9a84c", fontSize: 12 }}>{bulkBuy}gp</span>
                    <button
                      type="button"
                      style={{
                        ...styles.tradeBtn,
                        ...styles.buyBtn,
                        opacity: canBuy ? 1 : 0.28,
                        cursor: canBuy ? "pointer" : "default",
                        padding: "4px 12px",
                        fontSize: 12,
                      }}
                      onClick={() => canBuy && onBuy(key, qty, { guildStockroom: true })}
                    >
                      Buy
                    </button>
                  </div>
                );
              })}
          </div>
        </>
      )}
      {/* ── UPGRADE SHOP ── */}
      {shopInventory && (shopInventory.permanent.length > 0 || shopInventory.consumables.length > 0) && (
        <div style={{ marginTop: 18 }}>
          <div style={{ color: "#e6a817", fontSize: 12, letterSpacing: 1, marginBottom: 8, borderTop: "1px solid #2a2010", paddingTop: 12 }}>
            🏪 {location === "trade" ? "Trade Ward Emporium" : "Local Trader"} — Upgrades
          </div>

          {rivalActive && (
            <div style={{ background:"#200a0a", border:"1px solid #5a2a2a", borderRadius:5, padding:"8px 10px", marginBottom:10, fontSize:12, color:"#e05c5c" }}>
              ⚔️ Rival merchant active — sell prices –20% this visit
            </div>
          )}

          {/* Consumables in hand */}
          {Object.entries(consumables).filter(([k,v]) => !k.startsWith("__") && v > 0).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color:"#888", fontSize:11, marginBottom:4 }}>In hand:</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {CONSUMABLES.filter(c => consumables[c.id] > 0).map(c => (
                  <button key={c.id} style={{ background:"#1a1a08", border:"1px solid #5a5020", borderRadius:5, padding:"4px 10px", color:"#e6d5a8", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}
                    onClick={() => onUseConsumable(c.id)}>
                    {c.icon} {c.name} ×{consumables[c.id]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {shopInventory.permanent.length > 0 && (
            <>
              <div style={{ color:"#888", fontSize:11, marginBottom:6 }}>Permanent:</div>
              {shopInventory.permanent.map(u => (
                <div key={u.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:"#0f0d08", border:"1px solid #2a2010", borderRadius:5, marginBottom:6 }}>
                  <span style={{fontSize:16}}>{u.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{color:"#e6d5a8", fontSize:12, fontWeight:"bold"}}>{u.name}</div>
                    <div style={{color:"#666", fontSize:11}}>{u.desc}</div>
                  </div>
                  <button style={{ background: gold >= u.cost ? "#1a3a1a" : "#1a1508", border:"1px solid #3a3020", borderRadius:4, padding:"4px 12px", color: gold >= u.cost ? "#a0c4a0" : "#444", cursor: gold >= u.cost ? "pointer" : "default", fontSize:12, fontFamily:"inherit", fontWeight:"bold", flexShrink:0 }}
                    onClick={() => gold >= u.cost && onBuyUpgrade(u, false)}>
                    {u.cost}gp
                  </button>
                </div>
              ))}
            </>
          )}

          {shopInventory.consumables.length > 0 && (
            <>
              <div style={{ color:"#888", fontSize:11, marginBottom:6, marginTop:8 }}>Consumables:</div>
              {shopInventory.consumables.map(u => (
                <div key={u.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:"#0f0d08", border:"1px solid #2a2010", borderRadius:5, marginBottom:6 }}>
                  <span style={{fontSize:16}}>{u.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{color:"#e6d5a8", fontSize:12, fontWeight:"bold"}}>{u.name} {consumables[u.id] > 0 && <span style={{color:"#888",fontSize:10}}>×{consumables[u.id]}</span>}</div>
                    <div style={{color:"#666", fontSize:11}}>{u.desc}</div>
                  </div>
                  <button style={{ background: gold >= u.cost ? "#1a2a3a" : "#1a1508", border:"1px solid #2a3a4a", borderRadius:4, padding:"4px 12px", color: gold >= u.cost ? "#a0b4c4" : "#444", cursor: gold >= u.cost ? "pointer" : "default", fontSize:12, fontFamily:"inherit", fontWeight:"bold", flexShrink:0 }}
                    onClick={() => gold >= u.cost && onBuyUpgrade(u, true)}>
                    {u.cost}gp
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TravelTab({ connected, location, onTravel, elapsed, run, castleBlocked, priceMemory }) {
  const timeLeft = run ? run.totalMinutes - elapsed : 0;
  return (
    <div>
      {castleBlocked && (
        <div style={{ ...styles.warning, marginBottom: 12, background: "#1a0a12", border: "1px solid #5a2a2a" }}>
          🛡️ Wanted — the gates will not have you. Castle Ward refuses entry until Watch regard improves.
        </div>
      )}
      <div style={styles.sectionLabel}>Reachable Districts</div>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8 }}>
        {connected.map(id => {
          const d = DISTRICTS[id];
          const cost = travelMinutes(location, id);
          const arrClock = formatClock(elapsed + cost);
          const tooLate = cost > timeLeft;
          const mem = priceMemory[id];
          const hoursAgo = mem ? Math.round((elapsed - Object.values(mem)[0].elapsed) / 60) : null;
          const stale = hoursAgo !== null && hoursAgo >= 8;
          const topGoods = mem ? Object.entries(mem).sort((a,b) => b[1].price - a[1].price).slice(0, 3) : [];

          return (
            <div key={id}>
              <button style={{...styles.travelCard, opacity: tooLate ? 0.4 : 1, width:"100%"}}
                onClick={() => !tooLate && onTravel(id)}>
                <span style={{fontSize:22}}>{d.emoji}</span>
                <div style={{flex:1,textAlign:"left"}}>
                  <div style={{color:"#e6d5a8",fontWeight:"bold",fontSize:14}}>{d.name}</div>
                  <div style={{color:"#888",fontSize:12}}>{d.desc}</div>
                </div>
                <div style={{textAlign:"right", flexShrink:0}}>
                  <div style={{color: cost >= 120 ? "#e08c2a" : "#888", fontSize:12}}>{fmtDelta(cost)}</div>
                  <div style={{color:"#555", fontSize:11}}>arr {arrClock.str.split(" · ")[1]}</div>
                </div>
              </button>
              {/* Price memory strip */}
              <div style={{display:"flex", gap:6, flexWrap:"wrap", paddingLeft:4, marginTop:3, marginBottom:4}}>
                {!mem ? (
                  <span style={{fontSize:10,color:"#3a3020",fontStyle:"italic"}}>No intel — never visited</span>
                ) : (
                  <>
                    {topGoods.map(([g, {price}]) => (
                      <span key={g} style={{fontSize:10, fontFamily:"monospace",
                        color: stale ? "#3a3028" : "#7a6a4a",
                        background: stale ? "transparent" : "#13100a",
                        padding:"1px 5px", borderRadius:3}}>
                        {GOODS[g]?.emoji} {stale ? "???" : price+"gp"}
                      </span>
                    ))}
                    <span style={{fontSize:10, color: stale ? "#e05c5c" : "#444", marginLeft:2}}>
                      {stale ? "stale" : hoursAgo === 0 ? "just now" : `${hoursAgo}h ago`}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {timeLeft < 480 && <div style={styles.warning}>⚠️ {Math.floor(timeLeft/60)}h {timeLeft%60}m remaining!</div>}
    </div>
  );
}

function QuestsTab({ quests, elapsed }) {
  const active = quests.filter(q => !q.complete);
  if (active.length === 0) return <div style={{color:"#666",padding:16,textAlign:"center"}}>No active quests. Events may offer contracts.</div>;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {active.map((q,i) => {
        const minsLeft   = q.deadlineMinutes != null ? q.deadlineMinutes - elapsed : null;
        const urgent     = minsLeft != null && minsLeft < 120;
        const dueClock   = q.deadlineMinutes != null ? formatClock(q.deadlineMinutes).str : null;
        return (
          <div key={i} style={{...styles.questCard, borderColor: urgent?"#e05c5c":"#3a3020"}}>
            <div style={{color:urgent?"#e05c5c":"#e6d5a8",fontWeight:"bold",fontSize:13}}>{q.label}</div>
            {dueClock && (
              <div style={{color:urgent?"#e05c5c":"#888",fontSize:12}}>
                Due: {dueClock}
                {minsLeft != null && ` · ${minsLeft >= 60 ? Math.floor(minsLeft/60)+"h " : ""}${minsLeft%60}m left`}
              </div>
            )}
            <div style={{color:"#a0c4a0",fontSize:12}}>Reward: {q.reward}gp</div>
          </div>
        );
      })}
    </div>
  );
}

function CargoTab({ cargo, market, location, factions }) {
  if (cargo.length === 0) return <div style={{color:"#666",padding:16,textAlign:"center"}}>Your cart is empty.</div>;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {cargo.map((item, i) => {
        const good = GOODS[item.good];
        const currentPrice = sellUnitPrice(item.good, market[item.good], location, factions);
        const pnl = (currentPrice - item.paid) * item.qty;
        return (
          <div key={i} style={styles.cargoItem}>
            <span style={{fontSize:18}}>{good.emoji}</span>
            <div style={{flex:1}}>
              <div style={{color:"#e6d5a8",fontSize:13}}>{good.name} {item.questLocked && <span style={{color:"#9b59b6",fontSize:10}}>[quest]</span>}</div>
              <div style={{color:"#888",fontSize:12}}>Qty: {item.qty} · Paid: {item.paid}gp · Size: {good.cargoSize * item.qty}u</div>
            </div>
            <span style={{fontFamily:"monospace",color:pnl>=0?"#a0c4a0":"#e05c5c",fontSize:13}}>{pnl>=0?"+":""}{pnl}gp</span>
          </div>
        );
      })}
    </div>
  );
}

function MapView({ location, connected, onTravel, fullscreen, subline, castleBlocked }) {
  const shell = {
    ...styles.mapFastTravelShell,
    padding: fullscreen ? "14px 16px 16px" : "12px 14px 14px",
  };
  const sub =
    subline != null
      ? `${subline}${castleBlocked ? " · Castle Ward blocked" : ""}`
      : fullscreen
        ? "Tap a linked ward to move"
        : castleBlocked
          ? "Waterdeep · Castle Ward blocked"
          : "Waterdeep";
  const lineMuted = "rgba(140, 118, 72, 0.28)";
  const lineActive = "rgba(212, 175, 72, 0.82)";
  const lineWidth = { idle: 0.38, active: 0.55 };
  const nodeR = { current: 4.9, reach: 4.35, far: 4.1 };

  return (
    <div style={shell}>
      <div style={styles.mapFastTravelHeader}>
        <span style={styles.mapFastTravelTitle}>Fast travel</span>
        <span style={styles.mapFastTravelSub}>{sub}</span>
      </div>
      <svg
        viewBox="0 0 100 94"
        style={{
          width: "100%",
          display: "block",
          maxHeight: fullscreen ? 360 : 240,
        }}
      >
        <defs>
          <radialGradient id="wt-node-current" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#3d3018" />
            <stop offset="100%" stopColor="#0c0a07" />
          </radialGradient>
        </defs>
        {CONNECTIONS.map(([a, b], i) => {
          const da = DISTRICTS[a];
          const db = DISTRICTS[b];
          const isActive =
            (a === location && connected.includes(b)) ||
            (b === location && connected.includes(a));
          return (
            <line
              key={i}
              x1={da.x}
              y1={da.y}
              x2={db.x}
              y2={db.y}
              stroke={isActive ? lineActive : lineMuted}
              strokeWidth={isActive ? lineWidth.active : lineWidth.idle}
              strokeLinecap="round"
            />
          );
        })}
        {Object.entries(DISTRICTS).map(([id, d]) => {
          const isCurrent = id === location;
          const isReachable = connected.includes(id);
          const r = isCurrent ? nodeR.current : isReachable ? nodeR.reach : nodeR.far;
          const [line1, line2] = districtMapLabelLines(d.name);
          const fill = isCurrent ? "url(#wt-node-current)" : "#090806";
          const stroke = isCurrent
            ? "#e6c45a"
            : isReachable
              ? "#9a7b38"
              : "rgba(72, 62, 48, 0.55)";
          const sw = isCurrent ? 0.95 : isReachable ? 0.55 : 0.42;
          const labelFill = isCurrent ? "#f2e6c8" : isReachable ? "#c4a574" : "#5a5348";
          const labelY = d.y + r + 3.1;
          const fs = fullscreen ? 3.05 : 2.85;
          return (
            <g
              key={id}
              onClick={() => isReachable && onTravel(id)}
              style={{ cursor: isReachable ? "pointer" : "default" }}
            >
              {isCurrent ? (
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={r + 1.2}
                  fill="none"
                  stroke="rgba(230, 196, 90, 0.22)"
                  strokeWidth={0.35}
                />
              ) : null}
              <circle
                cx={d.x}
                cy={d.y}
                r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth={sw}
              />
              <text
                x={d.x}
                y={labelY}
                textAnchor="middle"
                fill={labelFill}
                fontSize={fs}
                fontFamily="'Palatino Linotype', Palatino, Georgia, serif"
                style={{ userSelect: "none" }}
              >
                <tspan x={d.x} dy="0">
                  {line1}
                </tspan>
                {line2 ? (
                  <tspan x={d.x} dy={fs * 1.15}>
                    {line2}
                  </tspan>
                ) : null}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={styles.mapFastTravelLegend}>
        <span style={{ color: "#e6c45a" }}>● Here</span>
        <span style={{ color: "#9a7b38" }}>● Reachable</span>
        <span style={{ color: "#4a4338" }}>● Elsewhere</span>
      </div>
    </div>
  );
}

function MenuScreen({ difficulty, onDifficulty, onStart }) {
  const cfg = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.normal;
  return (
    <div style={{...styles.root, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:20, padding:"16px"}}>
      <div style={styles.texture} />
      <div style={{textAlign:"center", zIndex:1}}>
        <div style={{fontSize:64, marginBottom:8}}>⚓</div>
        <div style={{fontFamily:"'Palatino Linotype', Palatino, serif", fontSize:42, color:"#e6a817", letterSpacing:4, textShadow:"0 2px 20px rgba(230,168,23,0.4)"}}>
          WATERDEEP TRADER
        </div>
        <div style={{color:"#888", marginTop:8, fontSize:15, fontStyle:"italic", letterSpacing:2}}>
          A merchant's tale in the City of Splendors
        </div>
      </div>

      <div style={{ zIndex: 1, width: "100%", maxWidth: 480 }}>
        <div style={{ color: "#888", fontSize: 11, letterSpacing: 2, marginBottom: 8, textAlign: "center" }}>DIFFICULTY</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {Object.values(DIFFICULTY_PRESETS).map((d) => (
            <button
              key={d.id}
              type="button"
              style={{
                ...styles.difficultyBtn,
                ...(difficulty === d.id ? styles.difficultyBtnActive : {}),
              }}
              onClick={() => onDifficulty(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{...styles.menuCard, zIndex:1}}>
        <p style={{color:"#c8b87a", lineHeight:1.7, fontSize:14, margin:0}}>
          You arrive in Waterdeep with <strong style={{color:"#e6a817"}}>{cfg.startGold.toLocaleString()} gold pieces</strong> and an empty cart.
          Trade between the city's eight wards, run cargo for coin, navigate faction politics,
          and weather random fortune — all within <strong style={{color:"#e6a817"}}>{Math.round(cfg.totalMinutes/60)} hours</strong>. Every transaction costs time.
        </p>
        <p style={{color:"#888", fontSize:13, marginTop:12, marginBottom:0}}>
          Goal: Accumulate <strong style={{color:"#e6a817"}}>{cfg.winGold.toLocaleString()}gp</strong> to establish yourself as a power in the city.
        </p>
      </div>
      <button style={{...styles.startBtn, zIndex:1}} onClick={onStart}>
        Begin Trading
      </button>
    </div>
  );
}

function EndScreen({ win, elapsed, gold, run, onRestart }) {
  const { str } = formatClock(elapsed);
  const hoursUsed = Math.round(elapsed / 60);
  const totalHours = run ? Math.round(run.totalMinutes / 60) : 72;
  return (
    <div style={{...styles.root, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:24}}>
      <div style={styles.texture} />
      <div style={{textAlign:"center", zIndex:1}}>
        <div style={{fontSize:64}}>{win ? "👑" : "💀"}</div>
        <div style={{fontFamily:"'Palatino Linotype', serif", fontSize:36, color: win?"#e6a817":"#e05c5c", marginTop:8}}>
          {win ? "Fortune Secured!" : "Time's Up."}
        </div>
        <div style={{color:"#888", marginTop:12, fontSize:14}}>
          {win
            ? `You amassed ${gold.toLocaleString()}gp by ${str} (${hoursUsed}h of ${totalHours}h used). Waterdeep will remember your name.`
            : `The season ended at ${str}. You finished with only ${gold.toLocaleString()}gp. The city is unforgiving.`
          }
        </div>
      </div>
      <button style={{...styles.startBtn, zIndex:1}} onClick={onRestart}>Play Again</button>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = {
  root: {
    height: "100vh", background: "#0d0b07", color: "#c8b87a",
    fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', serif",
    position: "relative", display: "flex", flexDirection: "column", overflow: "hidden",
  },
  texture: {
    position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
    backgroundImage: `
      radial-gradient(ellipse at 20% 80%, rgba(60,40,10,0.3) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(40,30,5,0.2) 0%, transparent 50%)
    `,
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 16px", background: "#0a0805",
    borderBottom: "1px solid #2a2010", zIndex: 10, flexWrap: "wrap", gap: 8,
  },
  topTitle: {
    fontFamily: "'Palatino Linotype', serif", fontSize: 18, color: "#e6a817",
    letterSpacing: 2, textShadow: "0 1px 8px rgba(230,168,23,0.3)",
  },
  topStats: { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" },
  statChip: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 2, padding: "4px 10px", background: "#13100a",
    border: "1px solid #2a2010", borderRadius: 4, minWidth: 70,
  },
  miniBar: { width: 70, height: 4, background: "#2a2010", borderRadius: 2, overflow: "hidden" },
  miniBarFill: { height: "100%", borderRadius: 2, transition: "width 0.5s ease" },
  factionBar: {
    display: "flex", gap: 8, padding: "5px 12px", background: "#090705",
    borderBottom: "1px solid #1a1508", zIndex: 10,
  },
  factionItem: { display: "flex", alignItems: "center", gap: 5, flex: 1 },
  factionName: { color: "#888", fontSize: 11, whiteSpace: "nowrap" },
  factionTrack: { flex: 1, height: 3, background: "#2a2010", borderRadius: 2, overflow: "hidden" },
  factionFill: { height: "100%", borderRadius: 2, transition: "width 0.5s" },
  locationCard: {
    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
    background: "#0f0d08", borderBottom: "1px solid #2a2010", flexShrink: 0,
  },
  locationEmoji: { fontSize: 28, flexShrink: 0 },
  locationName: { color: "#e6d5a8", fontWeight: "bold", fontSize: 16, letterSpacing: 1 },
  locationDesc: { color: "#888", fontSize: 12, marginTop: 1 },
  tabs: {
    display: "flex", borderBottom: "1px solid #2a2010", background: "#0a0805", flexShrink: 0,
  },
  tab: {
    flex: 1, padding: "6px 2px", background: "transparent", border: "none",
    color: "#555", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
    borderBottom: "2px solid transparent", transition: "all 0.2s", lineHeight: 1.2,
  },
  tabActive: { color: "#e6a817", borderBottomColor: "#e6a817", background: "#0f0d08" },
  tabContent: { flex: 1, overflow: "auto", padding: 12, zIndex: 1 },
  qtyRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionLabel: { color: "#888", fontSize: 12 },
  qtyBtn: {
    padding: "3px 12px", background: "#1a1508", border: "1px solid #3a3020",
    color: "#888", cursor: "pointer", borderRadius: 3, fontSize: 13, fontFamily: "inherit",
  },
  qtyBtnActive: { background: "#3a2a08", color: "#e6a817", borderColor: "#6b5a3a" },
  marketTable: { display: "flex", flexDirection: "column", gap: 2 },
  tableHeader: {
    display: "flex", padding: "4px 8px", color: "#555", fontSize: 11,
    borderBottom: "1px solid #2a2010", marginBottom: 4, letterSpacing: 1,
  },
  tableRow: {
    display: "flex", alignItems: "center", padding: "6px 8px",
    borderRadius: 4, border: "1px solid #1a1508", gap: 4,
  },
  tradeBtn: {
    padding: "3px 10px", border: "none", borderRadius: 3, cursor: "pointer",
    fontSize: 12, fontFamily: "inherit", fontWeight: "bold", transition: "opacity 0.2s",
  },
  buyBtn: { background: "#1a3a1a", color: "#a0c4a0" },
  sellBtn: { background: "#3a1a1a", color: "#c4a0a0" },
  travelCard: {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
    background: "#0f0d08", border: "1px solid #2a2010", borderRadius: 6,
    cursor: "pointer", color: "inherit", fontFamily: "inherit", transition: "border-color 0.2s",
  },
  warning: { color: "#e05c5c", fontSize: 13, marginTop: 16, padding: "8px 12px", background: "#200a0a", borderRadius: 4 },
  questCard: { padding: "10px 14px", background: "#0f0d08", border: "1px solid #3a3020", borderRadius: 6 },
  cargoItem: {
    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
    background: "#0f0d08", border: "1px solid #2a2010", borderRadius: 5,
  },
  deliveryBanner: {
    display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px",
    background: "#1a1800", border: "1px solid #6b5a1a", borderRadius: 6,
    marginBottom: 12,
  },
  mapFastTravelShell: {
    background:
      "radial-gradient(ellipse 130% 90% at 50% 0%, rgba(72, 58, 32, 0.28) 0%, transparent 52%), linear-gradient(165deg, #100e0a 0%, #060504 55%, #030201 100%)",
    border: "1px solid rgba(201, 162, 39, 0.2)",
    borderRadius: 10,
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.035), inset 0 0 72px rgba(0, 0, 0, 0.42), 0 4px 22px rgba(0, 0, 0, 0.4)",
  },
  mapFastTravelHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(201, 162, 39, 0.12)",
  },
  mapFastTravelTitle: {
    fontFamily: "'Palatino Linotype', Palatino, Georgia, serif",
    fontSize: 13,
    letterSpacing: "0.35em",
    textTransform: "uppercase",
    color: "#c9a84c",
    fontWeight: 600,
  },
  mapFastTravelSub: {
    fontSize: 11,
    color: "#6b6358",
    letterSpacing: "0.12em",
  },
  mapFastTravelLegend: {
    display: "flex",
    flexWrap: "wrap",
    gap: 14,
    fontSize: 10,
    color: "#5a5348",
    marginTop: 8,
    justifyContent: "center",
    letterSpacing: "0.06em",
  },
  logTitle: { color: "#555", fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  logEntry: { color: "#a09070", lineHeight: 1.6, borderBottom: "1px solid #13100a", paddingBottom: 6, marginBottom: 2 },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 100,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
  },
  modal: {
    background: "#13100a", border: "2px solid #6b5a3a", borderRadius: 8,
    padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.8)",
  },
  modalHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  modalIcon: { fontSize: 28 },
  modalTitle: { fontFamily: "'Palatino Linotype', serif", fontSize: 20, color: "#e6a817", letterSpacing: 1 },
  modalDesc: { color: "#c8b87a", lineHeight: 1.7, fontSize: 14, margin: "0 0 18px" },
  modalOptions: { display: "flex", flexDirection: "column", gap: 8 },
  modalBtn: {
    padding: "10px 16px", background: "#1a1508", border: "1px solid #3a3020",
    color: "#e6d5a8", cursor: "pointer", borderRadius: 4, fontFamily: "inherit",
    fontSize: 13, textAlign: "left", transition: "background 0.2s",
  },
  menuCard: {
    background: "#0f0d08", border: "1px solid #3a3020", borderRadius: 8,
    padding: "20px 24px", maxWidth: 480, width: "100%",
  },
  startBtn: {
    padding: "14px 40px", background: "#3a2a08", border: "2px solid #e6a817",
    color: "#e6a817", fontSize: 16, fontFamily: "'Palatino Linotype', serif",
    letterSpacing: 2, cursor: "pointer", borderRadius: 4,
    boxShadow: "0 0 20px rgba(230,168,23,0.2)", transition: "all 0.2s",
  },
  difficultyBtn: {
    flex: "1 1 90px",
    minWidth: 88,
    padding: "10px 14px",
    background: "#13100a",
    border: "1px solid #3a3020",
    color: "#888",
    fontSize: 14,
    fontFamily: "inherit",
    cursor: "pointer",
    borderRadius: 6,
    transition: "all 0.2s",
  },
  difficultyBtnActive: {
    background: "#2a2208",
    borderColor: "#e6a817",
    color: "#e6d5a8",
    boxShadow: "0 0 12px rgba(230,168,23,0.15)",
  },
};
