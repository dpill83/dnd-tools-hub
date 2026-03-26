import { CellType, FOV_RADIUS, H, W } from './constants.js';
import { idxOf, inBounds } from './util.js';

function isOpaque(gridType, x, y) {
  const t = gridType[idxOf(x, y, W)];
  return t === CellType.Wall || t === CellType.DoorClosed;
}

function markLineVisible({ x0, y0, x1, y1, gridType, gridVisible, gridSeen }) {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;
  while (true) {
    const i = idxOf(x, y, W);
    gridVisible[i] = true;
    gridSeen[i] = true;

    if (x === x1 && y === y1) break;
    if (isOpaque(gridType, x, y) && !(x === x0 && y === y0)) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

export function computeFov({ player, gridType, gridVisible, gridSeen }) {
  gridVisible.fill(false);

  const px = player.x;
  const py = player.y;
  const r = FOV_RADIUS;

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const tx = px + dx;
      const ty = py + dy;
      if (!inBounds(tx, ty, W, H)) continue;

      markLineVisible({ x0: px, y0: py, x1: tx, y1: ty, gridType, gridVisible, gridSeen });
    }
  }
}

