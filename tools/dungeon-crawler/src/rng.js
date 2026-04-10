/** Seeded RNG for shareable dungeon layouts (mulberry32). */

/**
 * @param {number} seed
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEY_SEED = 'dungeon-crawler-seed-v1';

let currentSeed = 1;
let rng = mulberry32(currentSeed);

export function getSeed() {
  return currentSeed >>> 0;
}

/**
 * @param {number} seed
 */
export function setSeed(seed) {
  currentSeed = (seed >>> 0) || 1;
  rng = mulberry32(currentSeed);
  try {
    window.localStorage.setItem(KEY_SEED, String(currentSeed >>> 0));
  } catch {
    /* ignore */
  }
}

export function loadSeedFromStorage() {
  try {
    const raw = window.localStorage.getItem(KEY_SEED);
    if (!raw) return false;
    const n = Number(raw);
    if (!Number.isFinite(n)) return false;
    setSeed(n >>> 0);
    return true;
  } catch {
    return false;
  }
}

export function rand() {
  return rng();
}

/**
 * @param {number} min
 * @param {number} max
 */
export function randInt(min, max) {
  const a = Math.floor(min);
  const b = Math.floor(max);
  if (b <= a) return a;
  return a + Math.floor(rand() * (b - a + 1));
}

/**
 * @template T
 * @param {T[]} arr
 */
export function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function makeRandomSeed() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  } catch {
    return ((Date.now() ^ (Date.now() >>> 7)) >>> 0) || 1;
  }
}

