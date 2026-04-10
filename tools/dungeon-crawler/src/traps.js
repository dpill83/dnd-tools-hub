/** Tile-layer: traps placed on walkable floor cells.
 *
 * Traps are separate from the map grid so they don't affect walkability / raycasting.
 */

let TRAPS_AT = {};
const TRIGGERED = new Set();

function trapKey(ix, iy) {
  return `${ix},${iy}`;
}

export function resetTrapProgress() {
  TRIGGERED.clear();
}

/** @param {Record<string, { kind: 'hp', hpCost: number } | { kind: 'torch', torchLossTurns: number, hpFallback: number }>} layout */
export function setTrapLayout(layout) {
  TRAPS_AT = { ...layout };
  TRIGGERED.clear(); // new run/layout, nothing triggered yet
}

export function hasTrapAt(ix, iy) {
  return TRAPS_AT[trapKey(ix, iy)] !== undefined;
}

export function isTrapTriggeredAt(ix, iy) {
  return TRIGGERED.has(trapKey(ix, iy));
}

export function getTrapAt(ix, iy) {
  return TRAPS_AT[trapKey(ix, iy)] ?? null;
}

/**
 * Marks trap as triggered and returns its data.
 * @returns {null | { kind: 'hp', hpCost: number } | { kind: 'torch', torchLossTurns: number, hpFallback: number }}
 */
export function tryTriggerTrapAt(ix, iy) {
  const k = trapKey(ix, iy);
  if (TRIGGERED.has(k)) return null;
  const t = TRAPS_AT[k];
  if (!t) return null;
  TRIGGERED.add(k);
  return t;
}

