/** Encounter archetypes (hp, damage range [min,max]). */
export const ENCOUNTER_TYPES = {
  goblin: { name: 'Goblin skirmisher', maxHp: 16, atk: [2, 6] },
  skeleton: { name: 'Restless bones', maxHp: 20, atk: [3, 7] },
  ogre: { name: 'Lesser ogre', maxHp: 36, atk: [5, 10] },
  shadow: { name: 'Hollow shadow', maxHp: 22, atk: [4, 9] },
};

/** Sparse "x,y" -> type key; replaced each procedural generation. */
let ENCOUNTER_AT = {};

const defeated = new Set();

export function encounterKey(ix, iy) {
  return `${ix},${iy}`;
}

/** Replace all spawn points (called from dungeon generator). */
export function setEncounterLayout(layout) {
  ENCOUNTER_AT = { ...layout };
}

/** True if this tile is reserved for a scripted encounter (chests skip these cells). */
export function isEncounterSpawnCell(ix, iy) {
  return ENCOUNTER_AT[encounterKey(ix, iy)] !== undefined;
}

export function getEncounterTypeAt(ix, iy) {
  const k = encounterKey(ix, iy);
  if (defeated.has(k)) return null;
  return ENCOUNTER_AT[k] ?? null;
}

export function markEncounterDefeated(ix, iy) {
  defeated.add(encounterKey(ix, iy));
}

export function resetEncounterProgress() {
  defeated.clear();
}
