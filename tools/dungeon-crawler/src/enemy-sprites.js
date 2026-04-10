/**
 * Simple pixel silhouettes for 3D view (fillRect + occasional arc, party-style).
 * Drawn in a fixed grid then scaled to the requested rectangle.
 */

const GW = 24;
const GH = 44;

/**
 * @param {CanvasRenderingContext2D} ctx context with transform: origin top-left of sprite, one unit = one pixel in grid
 * @param {string} typeKey
 */
function drawInGrid(ctx, typeKey) {
  switch (typeKey) {
    case 'goblin':
      drawGoblin(ctx);
      break;
    case 'skeleton':
      drawSkeleton(ctx);
      break;
    case 'ogre':
      drawOgre(ctx);
      break;
    case 'shadow':
      drawShadow(ctx);
      break;
    default:
      drawFallback(ctx);
  }
}

function drawGoblin(ctx) {
  const dark = '#1a5c2e';
  const mid = '#2d8f42';
  const hi = '#4aba5c';

  ctx.fillStyle = mid;
  ctx.fillRect(9, 4, 6, 8);
  ctx.fillRect(10, 6, 2, 2);
  ctx.fillRect(12, 6, 2, 2);
  ctx.fillStyle = dark;
  ctx.fillRect(7, 11, 10, 5);
  ctx.fillRect(5, 14, 14, 12);
  ctx.fillRect(3, 15, 4, 9);
  ctx.fillRect(17, 17, 4, 7);
  ctx.fillRect(7, 25, 4, 11);
  ctx.fillRect(13, 25, 4, 11);
  ctx.fillStyle = hi;
  ctx.fillRect(8, 12, 3, 3);
  ctx.fillRect(6, 18, 2, 4);
}

function drawSkeleton(ctx) {
  const bone = '#d8d0c8';
  const shade = '#8a8a96';
  const hole = '#0c0c10';

  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.arc(12, 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(8, 12, 10, 4);
  ctx.fillStyle = hole;
  ctx.fillRect(8, 6, 3, 3);
  ctx.fillRect(13, 6, 3, 3);
  ctx.fillStyle = bone;
  ctx.fillRect(11, 16, 2, 4);
  ctx.fillRect(6, 17, 6, 2);
  ctx.fillRect(12, 17, 6, 2);
  ctx.fillRect(9, 20, 8, 2);
  ctx.fillRect(8, 23, 10, 2);
  ctx.fillRect(7, 26, 12, 2);
  ctx.fillStyle = shade;
  ctx.fillRect(11, 18, 2, 11);
  ctx.fillStyle = bone;
  ctx.fillRect(3, 18, 4, 12);
  ctx.fillRect(17, 18, 4, 12);
  ctx.fillRect(8, 30, 8, 3);
  ctx.fillRect(7, 33, 4, 10);
  ctx.fillRect(13, 33, 4, 10);
}

function drawOgre(ctx) {
  const body = '#5c3d1a';
  const deep = '#3d2810';
  const lump = '#7a5230';

  ctx.fillStyle = body;
  ctx.fillRect(6, 2, 12, 12);
  ctx.fillStyle = deep;
  ctx.fillRect(8, 6, 2, 2);
  ctx.fillRect(14, 6, 2, 2);
  ctx.fillStyle = body;
  ctx.fillRect(3, 13, 18, 19);
  ctx.fillRect(0, 15, 5, 13);
  ctx.fillRect(19, 16, 5, 12);
  ctx.fillStyle = lump;
  ctx.fillRect(5, 16, 4, 5);
  ctx.fillRect(15, 18, 4, 4);
  ctx.fillStyle = deep;
  ctx.fillRect(6, 30, 5, 12);
  ctx.fillRect(13, 30, 5, 12);
  ctx.fillStyle = body;
  ctx.fillRect(7, 31, 3, 10);
  ctx.fillRect(14, 31, 3, 10);
}

function drawShadow(ctx) {
  const deep = '#0b0b12';
  const mid = '#222040';
  const hi = '#5a5ae0';

  // Head/torso wisp
  ctx.fillStyle = deep;
  ctx.fillRect(8, 4, 8, 10);
  ctx.fillStyle = mid;
  ctx.fillRect(7, 12, 10, 12);
  ctx.fillRect(6, 22, 12, 10);
  ctx.fillStyle = hi;
  ctx.fillRect(10, 8, 2, 2);
  ctx.fillRect(13, 8, 2, 2);

  // Tendrils
  ctx.fillStyle = deep;
  ctx.fillRect(5, 28, 4, 12);
  ctx.fillRect(15, 28, 4, 12);
  ctx.fillRect(9, 32, 6, 10);
  ctx.fillStyle = mid;
  ctx.fillRect(6, 30, 3, 9);
  ctx.fillRect(15, 30, 3, 9);
}

function drawFallback(ctx) {
  ctx.fillStyle = '#5a5a62';
  ctx.fillRect(8, 5, 8, 8);
  ctx.fillRect(6, 13, 12, 15);
  ctx.fillRect(7, 27, 4, 11);
  ctx.fillRect(13, 27, 4, 11);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} typeKey
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {{ outline?: boolean }} [opts]
 */
export function drawEnemySprite(ctx, typeKey, x, y, w, h, opts = {}) {
  const outline = opts.outline !== false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iw = Math.max(1, Math.floor(w));
  const ih = Math.max(1, Math.floor(h));
  ctx.translate(ix, iy);
  ctx.scale(iw / GW, ih / GH);
  drawInGrid(ctx, typeKey);
  ctx.restore();
  if (outline) {
    ctx.save();
    ctx.strokeStyle = '#0a0a0c';
    ctx.lineWidth = Math.max(2, Math.floor(Math.min(iw, ih) * 0.028));
    ctx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);
    ctx.restore();
  }
}
