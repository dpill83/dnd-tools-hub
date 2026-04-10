/** Grid cell types */
export const CELL_EMPTY = 0;
export const CELL_WALL = 1;
export const CELL_DOOR_CLOSED = 2;
export const CELL_DOOR_OPEN = 3;

export let MAP_W = 13;
export let MAP_H = 16;

/** Mutable grid; filled by procedural generator (walls until carved). */
export let MAP = Array.from({ length: MAP_H }, () => Array.from({ length: MAP_W }, () => CELL_WALL));

export function setMapSize(w, h) {
  const nextW = Math.max(5, Math.floor(w));
  const nextH = Math.max(5, Math.floor(h));
  MAP_W = nextW;
  MAP_H = nextH;
  MAP = Array.from({ length: MAP_H }, () => Array.from({ length: MAP_W }, () => CELL_WALL));
  // Reset derived layers; they must be recomputed after generation/door changes.
  wallStyle = null;
  roomLabels = null;
}

export function getCell(ix, iy) {
  if (ix < 0 || iy < 0 || ix >= MAP_W || iy >= MAP_H) return CELL_WALL;
  return MAP[iy][ix];
}

/** Blocks movement and line of sight (walls + closed doors). */
export function isSolid(ix, iy) {
  const c = getCell(ix, iy);
  return c === CELL_WALL || c === CELL_DOOR_CLOSED;
}

export function isClosedDoor(ix, iy) {
  return getCell(ix, iy) === CELL_DOOR_CLOSED;
}

export function isDoorCell(ix, iy) {
  const c = getCell(ix, iy);
  return c === CELL_DOOR_CLOSED || c === CELL_DOOR_OPEN;
}

/**
 * Toggle door open/closed. Returns 'open', 'closed', or null if not a door.
 * Refuses to close if the player is standing on that tile.
 */
export function tryToggleDoor(ix, iy, playerX, playerY) {
  const c = getCell(ix, iy);
  if (c === CELL_DOOR_CLOSED) {
    MAP[iy][ix] = CELL_DOOR_OPEN;
    return 'open';
  }
  if (c === CELL_DOOR_OPEN) {
    const px = Math.floor(playerX);
    const py = Math.floor(playerY);
    if (px === ix && py === iy) return 'blocked';
    MAP[iy][ix] = CELL_DOOR_CLOSED;
    return 'closed';
  }
  return null;
}

export function isWalkable(ix, iy) {
  const c = getCell(ix, iy);
  return c === CELL_EMPTY || c === CELL_DOOR_OPEN;
}

/** Brick-wall style index 0..count-1 per cell (doors ignored). */
let wallStyle = null;
/** Room id label per walkable cell; walls/doors not in a room are -1. */
let roomLabels = null;

function floodFillRoom(sx, sy, id, labels) {
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
    if (labels[y][x] >= 0) continue;
    if (!isWalkable(x, y)) continue;
    labels[y][x] = id;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

/**
 * Recompute room connectivity (open doors merge rooms) and assign each
 * brick wall a texture style from adjacent room ids.
 * @param {number} styleCount number of wall texture variants (e.g. 4)
 */
export function refreshWallStyles(styleCount) {
  const labels = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(-1));
  let nextRoom = 0;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (!isWalkable(x, y) || labels[y][x] >= 0) continue;
      floodFillRoom(x, y, nextRoom, labels);
      nextRoom++;
    }
  }
  roomLabels = labels;
  const ws = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (getCell(x, y) !== CELL_WALL) continue;
      let minR = 9999;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const r = labels[ny][nx];
        if (r >= 0 && r < minR) minR = r;
      }
      ws[y][x] = minR === 9999 ? 0 : minR % styleCount;
    }
  }
  wallStyle = ws;
}

/** Style index for brick at (ix,iy); safe for any cell (doors/walls). */
export function getWallStyleAt(ix, iy) {
  if (!wallStyle || iy < 0 || ix < 0 || iy >= MAP_H || ix >= MAP_W) return 0;
  return wallStyle[iy][ix];
}

/**
 * Room id for a walkable cell based on current door connectivity.
 * @returns {number} room id >= 0, or -1 if not in a room (wall/out of bounds)
 */
export function getRoomIdAt(ix, iy) {
  if (!roomLabels || iy < 0 || ix < 0 || iy >= MAP_H || ix >= MAP_W) return -1;
  return roomLabels[iy][ix];
}
