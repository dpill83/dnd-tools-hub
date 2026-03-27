export const W = 60;
export const H = 24;
export const FOV_RADIUS = 6;

export const CellType = Object.freeze({
  Wall: 0,
  Floor: 1,
  Stairs: 2,
  Amulet: 3,
  DoorClosed: 4,
  DoorOpen: 5,
});

export const ItemType = Object.freeze({
  Gold: 'gold',
  Potion: 'potion',
  Sword: 'sword',
  Shield: 'shield',
  Trap: 'trap',
});

export const COLS = Object.freeze({
  floor: '#2a2a3a',
  wall: '#1a1a2a',
  player: '#e8e8d0',
  orc: '#6cba6c',
  goblin: '#4caa4c',
  rat: '#a0804c',
  troll: '#8c6cba',
  dragon: '#e06c6c',
  gold: '#e0d96c',
  stairs: '#6cb4e0',
  potion: '#e06cba',
  sword: '#a0c0e0',
  shield: '#c0a070',
  amulet: '#e0c020',
  seen: '#141420',
  fog: '#0f0f18',
  door: '#7f7f9a',
  trap: '#b07070',
});

/**
 * On narrow screens, nudge only unexplored fog + “memory” (seen) so OLEDs stay readable.
 * Lit tiles keep COLS.floor / COLS.wall so FoW stays: darkest unexplored < dim memory < bright LOS.
 */
export function getRenderPalette() {
  if (typeof window === 'undefined' || !window.matchMedia) return COLS;
  if (!window.matchMedia('(max-width: 520px)').matches) return COLS;
  return {
    ...COLS,
    fog: '#12121c',
    seen: '#1e1e32',
  };
}

