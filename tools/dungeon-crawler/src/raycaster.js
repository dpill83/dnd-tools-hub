export const VIEW_W = 640;
export const VIEW_H = 400;
const TEX_SIZE = 64;

/** Direction and camera plane per cardinal facing (0=N, 1=E, 2=S, 3=W). */
export const DIR_VECTORS = [
  { dx: 0, dy: -1, px: 0.66, py: 0 },
  { dx: 1, dy: 0, px: 0, py: 0.66 },
  { dx: 0, dy: 1, px: -0.66, py: 0 },
  { dx: -1, dy: 0, px: 0, py: -0.66 },
];

/** @param {HTMLCanvasElement | OffscreenCanvas} tex */
function getTexPixels(tex) {
  const c = /** @type {HTMLCanvasElement & OffscreenCanvas} */ (tex);
  const tctx = c.getContext('2d', { willReadFrequently: true });
  return tctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
}

let cachedFloor = null;
let cachedCeil = null;
let cachedFloorSrc = null;
let cachedCeilSrc = null;

function ensureTexCache(floorTex, ceilTex) {
  if (floorTex !== cachedFloorSrc) {
    cachedFloor = getTexPixels(floorTex);
    cachedFloorSrc = floorTex;
  }
  if (ceilTex !== cachedCeilSrc) {
    cachedCeil = getTexPixels(ceilTex);
    cachedCeilSrc = ceilTex;
  }
}

/**
 * Perspective floor + ceiling (horizontal scanlines), then walls on top.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, dir: number }} player
 * @param {(HTMLCanvasElement | OffscreenCanvas)[]} wallTexes one texture per room/sector style
 * @param {{ isSolid: (x: number, y: number) => boolean, getWallStyleAt?: (x: number, y: number) => number, isClosedDoor?: (x: number, y: number) => boolean, doorTex?: HTMLCanvasElement | OffscreenCanvas, floorTex?: HTMLCanvasElement | OffscreenCanvas, ceilingTex?: HTMLCanvasElement | OffscreenCanvas, floorFill?: string, ceilingFill?: string, visionBoost?: number, exitCell?: { ix: number, iy: number } | null }} opts
 */
export function castRays(ctx, player, wallTexes, opts = {}) {
  const { isSolid } = opts;
  if (!isSolid || !wallTexes?.length) return;
  const doorTex = opts.doorTex;
  const isClosedDoor = opts.isClosedDoor ?? (() => false);
  const getWallStyleAt = opts.getWallStyleAt ?? (() => 0);
  const nWall = wallTexes.length;

  const { dx: dirX, dy: dirY, px: planeX, py: planeY } = DIR_VECTORS[player.dir];
  const posX = player.x;
  const posY = player.y;
  const halfH = VIEW_H / 2;
  const posZ = 0.5 * VIEW_H;

  const floorTex = opts.floorTex;
  const ceilTex = opts.ceilingTex;
  const useTextures = floorTex && ceilTex;

  if (useTextures) {
    ensureTexCache(floorTex, ceilTex);
    const floorPx = cachedFloor;
    const ceilPx = cachedCeil;
    const img = ctx.createImageData(VIEW_W, VIEW_H);
    const out = img.data;
    const rayDirX0 = dirX - planeX;
    const rayDirY0 = dirY - planeY;
    const rayDirX1 = dirX + planeX;
    const rayDirY1 = dirY + planeY;

    for (let y = 0; y < VIEW_H; y++) {
      const p = y - halfH;
      const rowOfs = y * VIEW_W * 4;
      if (p === 0) {
        for (let x = 0; x < VIEW_W; x++) {
          const di = rowOfs + x * 4;
          out[di] = 14;
          out[di + 1] = 14;
          out[di + 2] = 22;
          out[di + 3] = 255;
        }
        continue;
      }

      const isFloor = y > halfH;
      const rowDistance = posZ / p;
      const vBoost = opts.visionBoost ?? 1;
      const floorShadeK = 0.09 / vBoost;
      const shade = Math.max(0.22, Math.min(1, 1 - Math.abs(rowDistance) * floorShadeK));

      const stepX = (rowDistance * (rayDirX1 - rayDirX0)) / VIEW_W;
      const stepY = (rowDistance * (rayDirY1 - rayDirY0)) / VIEW_W;
      let fx = posX + rowDistance * rayDirX0;
      let fy = posY + rowDistance * rayDirY0;
      const src = isFloor ? floorPx : ceilPx;

      const ex = opts.exitCell;
      for (let x = 0; x < VIEW_W; x++) {
        const tx = Math.floor(TEX_SIZE * (fx - Math.floor(fx))) & (TEX_SIZE - 1);
        const ty = Math.floor(TEX_SIZE * (fy - Math.floor(fy))) & (TEX_SIZE - 1);
        const si = (ty * TEX_SIZE + tx) * 4;
        const di = rowOfs + x * 4;
        let cr = (src[si] * shade) | 0;
        let cg = (src[si + 1] * shade) | 0;
        let cb = (src[si + 2] * shade) | 0;
        if (
          ex &&
          isFloor &&
          Math.floor(fx) === ex.ix &&
          Math.floor(fy) === ex.iy &&
          !isSolid(ex.ix, ex.iy)
        ) {
          const k = 0.52 * shade;
          cr = Math.min(255, (cr * 0.48 + 28 * k) | 0);
          cg = Math.min(255, (cg * 0.55 + 210 * k) | 0);
          cb = Math.min(255, (cb * 0.48 + 72 * k) | 0);
        }
        out[di] = cr;
        out[di + 1] = cg;
        out[di + 2] = cb;
        out[di + 3] = 255;
        fx += stepX;
        fy += stepY;
      }
    }
    ctx.putImageData(img, 0, 0);
  } else {
    const floorFill = opts.floorFill ?? '#1a1a22';
    const ceilFill = opts.ceilingFill ?? '#0d0d12';
    ctx.fillStyle = ceilFill;
    ctx.fillRect(0, 0, VIEW_W, halfH);
    ctx.fillStyle = floorFill;
    ctx.fillRect(0, halfH, VIEW_W, halfH);
  }

  for (let x = 0; x < VIEW_W; x++) {
    const cameraX = (2 * x) / VIEW_W - 1;
    const rayDirX = dirX + planeX * cameraX;
    const rayDirY = dirY + planeY * cameraX;

    let mapX = Math.floor(posX);
    let mapY = Math.floor(posY);

    const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
    const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

    let stepX;
    let stepY;
    let sideDistX;
    let sideDistY;

    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (posX - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1 - posX) * deltaDistX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (posY - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1 - posY) * deltaDistY;
    }

    let hit = 0;
    let side = 0;

    for (let step = 0; step < 64 && !hit; step++) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      if (isSolid(mapX, mapY)) hit = 1;
    }

    let perpWallDist;
    if (side === 0) perpWallDist = (mapX - posX + (1 - stepX) / 2) / rayDirX;
    else perpWallDist = (mapY - posY + (1 - stepY) / 2) / rayDirY;

    const lineHeight = Math.floor(VIEW_H / perpWallDist);
    let drawStart = Math.floor(-lineHeight / 2 + VIEW_H / 2);
    let drawEnd = Math.floor(lineHeight / 2 + VIEW_H / 2);
    if (drawStart < 0) drawStart = 0;
    if (drawEnd >= VIEW_H) drawEnd = VIEW_H - 1;

    let wallX;
    if (side === 0) wallX = posY + perpWallDist * rayDirY;
    else wallX = posX + perpWallDist * rayDirX;
    wallX -= Math.floor(wallX);

    let texX = Math.floor(wallX * TEX_SIZE);
    if (side === 0 && rayDirX > 0) texX = TEX_SIZE - texX - 1;
    if (side === 1 && rayDirY < 0) texX = TEX_SIZE - texX - 1;

    const vBoost = opts.visionBoost ?? 1;
    const wallShadeK = 0.11 / vBoost;
    const shade = Math.max(0.28, 1 - perpWallDist * wallShadeK) * (side === 1 ? 0.72 : 1);
    const style = getWallStyleAt(mapX, mapY) % nWall;
    const colTex =
      doorTex && isClosedDoor(mapX, mapY) ? doorTex : wallTexes[style];
    ctx.globalAlpha = shade;
    ctx.drawImage(colTex, texX, 0, 1, TEX_SIZE, x, drawStart, 1, drawEnd - drawStart + 1);
    ctx.globalAlpha = 1;
  }
}
