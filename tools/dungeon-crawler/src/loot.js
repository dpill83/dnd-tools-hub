import { isWalkable, MAP_W, MAP_H } from './map.js';
import { isEncounterSpawnCell } from './encounters.js';
import { hasTrapAt } from './traps.js';
import { rand, shuffleInPlace } from './rng.js';
import {
  resetGearForRun,
  equipShield,
  equipRing,
  getTorchDurationBonusTurnsPerIgnite,
  getHasShield,
  getHasRing,
} from './gear.js';

const CARD = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Player start cell (matches main.js player 1.5, 1.5). */
const START_IX = 1;
const START_IY = 1;

/** Turns of bright vision after igniting a torch (any action advances time). */
const TORCH_LIGHT_PER_ITEM = 48;

/** Below this (while still lit), HUD / viewport warn that the torch is dying. */
export const TORCH_LOW_WARN_TURNS = 10;

/** Buy a healing potion out of combat (gold sink). */
export const POTION_BUY_PRICE = 25;

function cellKey(ix, iy) {
  return `${ix},${iy}`;
}

function walkableNeighborCount(ix, iy) {
  let n = 0;
  for (const [dx, dy] of CARD) {
    if (isWalkable(ix + dx, iy + dy)) n++;
  }
  return n;
}

const chestCells = new Set();
const openedChests = new Set();

let partyGold = 0;
let potions = 0;
let fireScrolls = 0;
let torches = 0;
/** While > 0, vision in the 3D view is brighter farther out. */
let torchLightTurnsRemaining = 0;

export function initLoot() {
  chestCells.clear();
  openedChests.clear();
  partyGold = 0;
  potions = 0;
  fireScrolls = 0;
  torches = 0;
  torchLightTurnsRemaining = 0;
  resetGearForRun();

  /** @type {{ k: string, ix: number, iy: number, deadEnd: boolean }[]} */
  const eligible = [];
  /** @type {{ k: string, ix: number, iy: number }[]} */
  const deadEnds = [];
  /** @type {{ k: string, ix: number, iy: number }[]} */
  const nonDeadEnds = [];
  for (let iy = 0; iy < MAP_H; iy++) {
    for (let ix = 0; ix < MAP_W; ix++) {
      if (!isWalkable(ix, iy)) continue;
      if (ix === START_IX && iy === START_IY) continue;
      if (isEncounterSpawnCell(ix, iy)) continue;
      if (hasTrapAt(ix, iy)) continue; // keep “risk or reward” distinct on a tile
      const k = cellKey(ix, iy);
      const deadEnd = walkableNeighborCount(ix, iy) === 1;
      eligible.push({ k, ix, iy, deadEnd });
      if (deadEnd) deadEnds.push({ k, ix, iy });
      else nonDeadEnds.push({ k, ix, iy });
    }
  }

  // Dead ends feel like “should be loot”, but not always: keep uncertainty.
  // High hit-rate keeps the reward loop, empty dead ends add risk/texture.
  const eligibleCount = eligible.length;
  const desired = Math.max(2, Math.floor(eligibleCount * 0.065));
  const deadEndChestChance = 0.75;

  for (const d of deadEnds) {
    if (rand() < deadEndChestChance) chestCells.add(d.k);
  }

  // If we still need more chests to hit the desired density, sprinkle in non-dead-ends.
  if (chestCells.size < desired && nonDeadEnds.length) {
    const deficit = desired - chestCells.size;
    const p = Math.min(0.18, deficit / Math.max(1, nonDeadEnds.length));
    for (const c of nonDeadEnds) {
      if (chestCells.size >= desired) break;
      if (rand() < p) chestCells.add(c.k);
    }
  }

  // Safety: ensure at least some loot even on unlucky rolls.
  if (chestCells.size < 2) {
    const shuffled = eligible.slice();
    shuffleInPlace(shuffled);
    for (const e of shuffled) {
      chestCells.add(e.k);
      if (chestCells.size >= 2) break;
    }
  }
}

export function getPartyGold() {
  return partyGold;
}

export function getPotionCount() {
  return potions;
}

export function getScrollCount() {
  return fireScrolls;
}

export function getTorchCount() {
  return torches;
}

export function getTorchLightTurnsRemaining() {
  return torchLightTurnsRemaining;
}

/** Ray distance shading: >1 sees farther (torch lit). */
export function getVisionBoost() {
  return torchLightTurnsRemaining > 0 ? 1.55 : 1;
}

/**
 * @returns {{ justExhausted: boolean }} `justExhausted` is true if light was on before the tick and is now 0.
 */
export function tickTorchLight(turns = 1) {
  if (torchLightTurnsRemaining <= 0) return { justExhausted: false };
  const before = torchLightTurnsRemaining;
  torchLightTurnsRemaining = Math.max(0, torchLightTurnsRemaining - turns);
  return { justExhausted: before > 0 && torchLightTurnsRemaining === 0 };
}

/**
 * Spend one torch from inventory; extends current light duration.
 * @returns {boolean}
 */
export function tryIgniteTorch() {
  if (torches <= 0) return false;
  torches -= 1;
  torchLightTurnsRemaining += TORCH_LIGHT_PER_ITEM + getTorchDurationBonusTurnsPerIgnite();
  return true;
}

/**
 * @returns {boolean}
 */
export function tryBuyPotionWithGold() {
  if (partyGold < POTION_BUY_PRICE) return false;
  partyGold -= POTION_BUY_PRICE;
  potions += 1;
  return true;
}

/**
 * @returns {boolean}
 */
export function tryConsumePotion() {
  if (potions <= 0) return false;
  potions -= 1;
  return true;
}

/**
 * @returns {boolean}
 */
export function tryConsumeScroll() {
  if (fireScrolls <= 0) return false;
  fireScrolls -= 1;
  return true;
}

/**
 * @returns {boolean}
 */
export function tryConsumeTorch() {
  if (torches <= 0) return false;
  torches -= 1;
  return true;
}

export function hasUnopenedChest(ix, iy) {
  const k = cellKey(ix, iy);
  return chestCells.has(k) && !openedChests.has(k);
}

/**
 * Open chest at player cell. Returns reward summary or null.
 * @returns {{ gold: number, salveHeal: number, gainedPotion: number, gainedScroll: number, gainedTorch: number } | null}
 */
export function tryOpenChest(ix, iy) {
  if (!hasUnopenedChest(ix, iy)) return null;
  const k = cellKey(ix, iy);
  openedChests.add(k);

  const seed = ix * 31 + iy * 17;
  const gold = 8 + (seed % 17);
  partyGold += gold;

  let salveHeal = 0;
  let gainedPotion = 0;
  let gainedScroll = 0;
  let gainedTorch = 0;

  // Small chance of equipment instead of flat consumables.
  // Deterministic per cell (via seed), but varied across runs by dungeon layout.
  const eqRoll = seed % 100;
  let gainedShield = 0;
  let gainedRing = 0;

  if (eqRoll < 6 && !getHasShield()) {
    equipShield();
    gainedShield = 1;
  } else if (eqRoll < 12 && !getHasRing()) {
    equipRing();
    gainedRing = 1;
  } else {
    const roll = seed % 11;
    if (roll < 4) {
      potions += 1;
      gainedPotion = 1;
    } else if (roll < 7) {
      fireScrolls += 1;
      gainedScroll = 1;
    } else if (roll < 9) {
      torches += 1;
      gainedTorch = 1;
    } else {
      salveHeal = 2 + (seed % 4);
    }
  }

  return { gold, salveHeal, gainedPotion, gainedScroll, gainedTorch, gainedShield, gainedRing };
}
