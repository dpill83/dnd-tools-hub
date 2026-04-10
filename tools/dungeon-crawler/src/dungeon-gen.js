/**
 * Procedural dungeon: recursive-backtracker maze + loop bores,
 * exit at max BFS distance from start, encounters by distance tier.
 */
import { MAP, MAP_W, MAP_H, CELL_WALL, CELL_EMPTY, CELL_DOOR_CLOSED, getCell } from './map.js';
import { isWalkable } from './map.js';
import { setEncounterLayout, isEncounterSpawnCell } from './encounters.js';
import { setTrapLayout } from './traps.js';
import { rand, randInt, shuffleInPlace } from './rng.js';

const STEP2 = [
  [0, -2],
  [2, 0],
  [0, 2],
  [-2, 0],
];
const STEP1 = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const CARD4 = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Farthest slots get the toughest foes (same roster count as the original hand map). */
const ENCOUNTER_SLOTS_NORMAL = ['ogre', 'skeleton', 'goblin', 'skeleton', 'goblin'];
const ENCOUNTER_SLOTS_HARD = ['ogre', 'shadow', 'skeleton', 'goblin', 'shadow'];

const START_X = 1;
const START_Y = 1;
const MIN_ENCOUNTER_DIST = 4;
const MIN_ENCOUNTER_DIST_FLOOR = 2;

function cellKey(x, y) {
  return `${x},${y}`;
}

function carveRecursiveBacktracker() {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      MAP[y][x] = CELL_WALL;
    }
  }

  const visited = new Set();
  const stack = [];

  function visit(x, y) {
    visited.add(cellKey(x, y));
    MAP[y][x] = CELL_EMPTY;
  }

  visit(START_X, START_Y);
  stack.push([START_X, START_Y]);

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const [cx, cy] = cur;
    const neighbors = [];
    for (let i = 0; i < 4; i++) {
      const [dx, dy] = STEP2[i];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 1 || ny < 1 || nx >= MAP_W - 1 || ny >= MAP_H - 1) continue;
      if (visited.has(cellKey(nx, ny))) continue;
      neighbors.push([nx, ny, STEP1[i][0], STEP1[i][1]]);
    }
    shuffleInPlace(neighbors);
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny, wx, wy] = neighbors[0];
    MAP[cy + wy][cx + wx] = CELL_EMPTY;
    visit(nx, ny);
    stack.push([nx, ny]);
  }
}

function isEmpty(ix, iy) {
  if (ix < 0 || iy < 0 || ix >= MAP_W || iy >= MAP_H) return false;
  return MAP[iy][ix] === CELL_EMPTY;
}

/** Knock a few holes in tree-walls so the maze has loops (less linear). */
function boreExtraPassages(attempts) {
  for (let n = 0; n < attempts; n++) {
    const x = 1 + randInt(0, MAP_W - 3);
    const y = 1 + randInt(0, MAP_H - 3);
    if (MAP[y][x] !== CELL_WALL) continue;
    const horiz = isEmpty(x - 1, y) && isEmpty(x + 1, y);
    const vert = isEmpty(x, y - 1) && isEmpty(x, y + 1);
    if (horiz || vert) MAP[y][x] = CELL_EMPTY;
  }
}

function bfsDistancesFrom(sx, sy) {
  /** @type {Map<string, number>} */
  const dist = new Map();
  const q = [[sx, sy, 0]];
  dist.set(cellKey(sx, sy), 0);
  let qi = 0;
  while (qi < q.length) {
    const [x, y, d] = q[qi++];
    for (const [dx, dy] of CARD4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const c = getCell(nx, ny);
      if (c !== CELL_EMPTY) continue;
      const k = cellKey(nx, ny);
      if (dist.has(k)) continue;
      dist.set(k, d + 1);
      q.push([nx, ny, d + 1]);
    }
  }
  return dist;
}

function pickFarthestReachableFloor(distMap) {
  let bestX = START_X;
  let bestY = START_Y;
  let bestD = -1;
  for (const [k, d] of distMap) {
    if (d > bestD) {
      bestD = d;
      const [x, y] = k.split(',').map(Number);
      bestX = x;
      bestY = y;
    }
  }
  return { x: bestX, y: bestY, dist: bestD };
}

function placeEncountersByDistance(distMap, exitX, exitY, slots) {
  const exitK = cellKey(exitX, exitY);

  /** @type {{ x: number, y: number, d: number }[]} */
  let candidates = [];
  let minDist = MIN_ENCOUNTER_DIST;
  while (true) {
    candidates = [];
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (MAP[y][x] !== CELL_EMPTY) continue;
        const k = cellKey(x, y);
        const d = distMap.get(k);
        if (d === undefined || d < minDist) continue;
        if (x === START_X && y === START_Y) continue;
        if (k === exitK) continue;
        candidates.push({ x, y, d });
      }
    }

    if (candidates.length >= slots.length || minDist <= MIN_ENCOUNTER_DIST_FLOOR) break;
    minDist -= 1;
  }

  candidates.sort((a, b) => b.d - a.d);

  /** @type {Record<string, string>} */
  const layout = {};
  for (let i = 0; i < slots.length && i < candidates.length; i++) {
    const { x, y } = candidates[i];
    layout[cellKey(x, y)] = slots[i];
  }
  setEncounterLayout(layout);
}

function walkableNeighborCount(ix, iy) {
  let n = 0;
  for (const [dx, dy] of CARD4) {
    if (isWalkable(ix + dx, iy + dy)) n++;
  }
  return n;
}

function buildMainPath(distMap, exitX, exitY) {
  let x = exitX;
  let y = exitY;
  let d = distMap.get(cellKey(x, y));
  const rev = [[x, y]];
  let guard = 0;
  while (!(x === START_X && y === START_Y) && guard < MAP_W * MAP_H) {
    guard++;
    /** @type {[number, number][]} */
    const nexts = [];
    for (const [dx, dy] of CARD4) {
      const nx = x + dx;
      const ny = y + dy;
      if (getCell(nx, ny) !== CELL_EMPTY) continue;
      if (distMap.get(cellKey(nx, ny)) !== d - 1) continue;
      nexts.push([nx, ny]);
    }
    if (!nexts.length) break;
    const pick = nexts[Math.floor(rand() * nexts.length)];
    x = pick[0];
    y = pick[1];
    d = distMap.get(cellKey(x, y));
    rev.push([x, y]);
  }
  return rev.reverse();
}

function placeTrapsByMainPath(distMap, exitX, exitY) {
  const mainPath = buildMainPath(distMap, exitX, exitY);

  /** @type {{ x: number, y: number, i: number, d: number }[]} */
  const candidates = [];
  for (let i = 1; i < mainPath.length - 1; i++) {
    const [x, y] = mainPath[i];
    if (!isWalkable(x, y)) continue;
    if (isEncounterSpawnCell(x, y)) continue;
    const d = distMap.get(cellKey(x, y));
    if (d === undefined || d < MIN_ENCOUNTER_DIST) continue;
    candidates.push({ x, y, i, d });
  }

  if (!candidates.length) {
    const empty = {};
    setTrapLayout(empty);
    return empty;
  }

  const trapCount = Math.min(candidates.length, Math.max(2, Math.floor(candidates.length / 7)));
  const chosen = [];
  const MIN_SEP_MANHATTAN = 3;
  const MIN_SEP_PATH_INDEX = 2;
  let attempts = 0;
  while (chosen.length < trapCount && attempts < 500) {
    attempts++;
    const c = candidates[Math.floor(rand() * candidates.length)];
    if (
      chosen.some((ch) => Math.abs(ch.x - c.x) + Math.abs(ch.y - c.y) < MIN_SEP_MANHATTAN) ||
      chosen.some((ch) => Math.abs(ch.i - c.i) < MIN_SEP_PATH_INDEX)
    ) {
      continue;
    }
    chosen.push(c);
  }

  chosen.sort((a, b) => a.i - b.i);

  /** @type {Record<string, any>} */
  const layout = {};
  for (let idx = 0; idx < chosen.length; idx++) {
    const c = chosen[idx];
    const hpCost = Math.min(10, 2 + Math.floor(c.d / 6));
    const torchLossTurns = Math.min(48, 14 + Math.floor(c.d / 10) * 8);
    const hpFallback = Math.min(8, 1 + Math.floor(c.d / 7));
    const kind = idx % 2 === 0 ? 'hp' : 'torch';

    layout[cellKey(c.x, c.y)] =
      kind === 'hp'
        ? { kind: 'hp', hpCost }
        : { kind: 'torch', torchLossTurns, hpFallback };
  }

  setTrapLayout(layout);
  return layout;
}

function isDoorChokepoint(ix, iy) {
  if (MAP[iy][ix] !== CELL_EMPTY) return false;
  const n = getCell(ix, iy - 1) === CELL_EMPTY;
  const s = getCell(ix, iy + 1) === CELL_EMPTY;
  const w = getCell(ix - 1, iy) === CELL_EMPTY;
  const e = getCell(ix + 1, iy) === CELL_EMPTY;
  const count = (n ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0) + (e ? 1 : 0);
  if (count !== 2) return false;
  // Opposite neighbors only: straight corridor choke.
  return (n && s && !w && !e) || (w && e && !n && !s);
}

function placeDoorsAtChokepoints(exitIx, exitIy, trapLayout) {
  const exitK = cellKey(exitIx, exitIy);
  const trapKeys = new Set(Object.keys(trapLayout ?? {}));

  /** @type {{ x: number, y: number }[]} */
  const candidates = [];
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (x === START_X && y === START_Y) continue;
      if (cellKey(x, y) === exitK) continue;
      if (isEncounterSpawnCell(x, y)) continue;
      if (trapKeys.has(cellKey(x, y))) continue;
      if (!isDoorChokepoint(x, y)) continue;
      candidates.push({ x, y });
    }
  }

  if (!candidates.length) return;

  // Keep doors sparse: just enough to activate the feature layer.
  const area = MAP_W * MAP_H;
  const desired = Math.min(candidates.length, Math.max(2, Math.floor(area * 0.03)));

  shuffleInPlace(candidates);
  const chosen = [];
  const MIN_SEP = 2;
  for (const c of candidates) {
    if (chosen.length >= desired) break;
    if (chosen.some((ch) => Math.abs(ch.x - c.x) + Math.abs(ch.y - c.y) < MIN_SEP)) continue;
    chosen.push(c);
  }

  for (const { x, y } of chosen) {
    MAP[y][x] = CELL_DOOR_CLOSED;
  }
}

/**
 * Fills {@link MAP}, assigns encounters, returns sunlit exit cell (farthest from start).
 * @returns {{ exitIx: number, exitIy: number }}
 */
export function generateProceduralDungeon(opts = {}) {
  carveRecursiveBacktracker();
  boreExtraPassages(Math.max(24, Math.floor((MAP_W * MAP_H) * 0.12)));

  const distMap = bfsDistancesFrom(START_X, START_Y);
  const { x: exitIx, y: exitIy } = pickFarthestReachableFloor(distMap);

  const slots = opts.hardMode ? ENCOUNTER_SLOTS_HARD : ENCOUNTER_SLOTS_NORMAL;
  placeEncountersByDistance(distMap, exitIx, exitIy, slots);
  const trapLayout = placeTrapsByMainPath(distMap, exitIx, exitIy);
  placeDoorsAtChokepoints(exitIx, exitIy, trapLayout);

  return { exitIx, exitIy };
}
