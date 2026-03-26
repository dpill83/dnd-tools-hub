import { CellType, H, W } from './constants.js';
import { idxOf, rnd } from './util.js';

function carveRoom(gridType, x, y, w, h) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const gx = x + dx;
      const gy = y + dy;
      gridType[idxOf(gx, gy, W)] = CellType.Floor;
    }
  }
}

function carveTunnel(gridType, x1, y1, x2, y2) {
  let cx = x1;
  let cy = y1;
  while (cx !== x2 || cy !== y2) {
    if (Math.random() < 0.5 && cx !== x2) cx += cx < x2 ? 1 : -1;
    else if (cy !== y2) cy += cy < y2 ? 1 : -1;
    else cx += cx < x2 ? 1 : -1;
    gridType[idxOf(cx, cy, W)] = CellType.Floor;
  }
}

function getRooms() {
  const rooms = [];
  const attempts = 60;
  for (let i = 0; i < attempts; i++) {
    const rw = 4 + rnd(7);
    const rh = 3 + rnd(5);
    const rx = 1 + rnd(W - rw - 2);
    const ry = 1 + rnd(H - rh - 2);
    const overlap = rooms.some(
      (r) => rx < r.x + r.w + 1 && rx + rw + 1 > r.x && ry < r.y + r.h + 1 && ry + rh + 1 > r.y,
    );
    if (!overlap)
      rooms.push({
        x: rx,
        y: ry,
        w: rw,
        h: rh,
        cx: rx + Math.floor(rw / 2),
        cy: ry + Math.floor(rh / 2),
      });
  }
  return rooms;
}

function floorCell(rooms) {
  const r = rooms[rnd(rooms.length)];
  return { x: r.x + 1 + rnd(r.w - 2), y: r.y + 1 + rnd(r.h - 2) };
}

function isDoorCandidate(gridType, x, y) {
  const t = gridType[idxOf(x, y, W)];
  if (t !== CellType.Floor) return false;
  const up = gridType[idxOf(x, y - 1, W)];
  const down = gridType[idxOf(x, y + 1, W)];
  const left = gridType[idxOf(x - 1, y, W)];
  const right = gridType[idxOf(x + 1, y, W)];
  const verticalCorridor = up === CellType.Wall && down === CellType.Wall && left === CellType.Floor && right === CellType.Floor;
  const horizontalCorridor = left === CellType.Wall && right === CellType.Wall && up === CellType.Floor && down === CellType.Floor;
  return verticalCorridor || horizontalCorridor;
}

function placeDoors(gridType) {
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      if (Math.random() > 0.06) continue;
      if (!isDoorCandidate(gridType, x, y)) continue;
      gridType[idxOf(x, y, W)] = CellType.DoorClosed;
    }
  }
}

export function generateLevel({ floor, gridType, gridVisible, gridSeen }) {
  gridType.fill(CellType.Wall);
  gridVisible.fill(false);
  gridSeen.fill(false);

  const rooms = getRooms();
  rooms.forEach((r) => carveRoom(gridType, r.x, r.y, r.w, r.h));
  for (let i = 1; i < rooms.length; i++) carveTunnel(gridType, rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
  if (!rooms.length) return generateLevel({ floor, gridType, gridVisible, gridSeen });

  // Start + stairs/amulet placement (match old behavior).
  const start = rooms[0];
  const startPos = { x: start.cx, y: start.cy };
  const stairRoom = rooms[rooms.length - 1];
  const stairsPos = { x: stairRoom.cx, y: stairRoom.cy };
  gridType[idxOf(stairsPos.x, stairsPos.y, W)] = floor >= 5 ? CellType.Amulet : CellType.Stairs;

  placeDoors(gridType);

  return { rooms, startPos, stairsPos };
}

export function randomFloorCell(rooms, { avoid }) {
  for (let tries = 0; tries < 200; tries++) {
    const p = floorCell(rooms);
    if (avoid && p.x === avoid.x && p.y === avoid.y) continue;
    return p;
  }
  return floorCell(rooms);
}

