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

/** Brighter tiles and glyphs for comfort=1; fog < seen < lit floor/wall ordering preserved. */
export const COMFORT_COLS = Object.freeze({
  floor: '#4d4d68',
  wall: '#3a3a52',
  player: '#f2f2e6',
  orc: '#7cdb7c',
  goblin: '#5cc55c',
  rat: '#c09860',
  troll: '#a080d8',
  dragon: '#f08080',
  gold: '#f0e860',
  stairs: '#7cc8f0',
  potion: '#f080c8',
  sword: '#b0d0f0',
  shield: '#d8b888',
  amulet: '#f0d830',
  seen: '#2e2e44',
  fog: '#222232',
  door: '#a0a0b8',
  trap: '#c88888',
});

/**
 * On narrow screens, nudge only unexplored fog + “memory” (seen) so OLEDs stay readable.
 * Lit tiles keep COLS.floor / COLS.wall so FoW stays: darkest unexplored < dim memory < bright LOS.
 * Comfort mode uses COMFORT_COLS; on narrow viewports, fog/seen are nudged slightly brighter still.
 */
export function getRenderPalette() {
  if (typeof window === 'undefined' || !window.matchMedia) return COLS;
  const comfort =
    typeof document !== 'undefined' && document.documentElement.classList.contains('rogue-comfort');
  const narrow = window.matchMedia('(max-width: 520px)').matches;

  if (comfort) {
    if (narrow) {
      return {
        ...COMFORT_COLS,
        fog: '#282838',
        seen: '#383852',
      };
    }
    return COMFORT_COLS;
  }

  if (narrow) {
    return {
      ...COLS,
      fog: '#12121c',
      seen: '#1e1e32',
    };
  }
  return COLS;
}

