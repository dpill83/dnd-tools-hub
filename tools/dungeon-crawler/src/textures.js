function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

import { mulberry32 } from './rng.js';

const TEX = 64;

/** @param {number} style 0 red brick, 1 gray ashlar, 2 rubble, 3 mossy dark stone */
export function makeWallTexture(style) {
  const oc = makeCanvas(TEX, TEX);
  const c = oc.getContext('2d');
  const rand = mulberry32(0x9e3779b9 + style * 0x1000193);

  if (style === 0) {
    c.fillStyle = '#3a1a0a';
    c.fillRect(0, 0, TEX, TEX);
    const brickH = 12;
    const brickW = 28;
    for (let row = 0; row < 6; row++) {
      const offset = (row % 2) * 16;
      for (let col = -1; col < 3; col++) {
        const x = col * brickW + offset + 2;
        const y = row * brickH + 2;
        const r = 140 + Math.floor(rand() * 40);
        c.fillStyle = `rgb(${r},${Math.floor(r * 0.35)},${Math.floor(r * 0.15)})`;
        c.fillRect(x, y, brickW - 2, brickH - 2);
      }
    }
    return oc;
  }

  if (style === 1) {
    c.fillStyle = '#2a2a30';
    c.fillRect(0, 0, TEX, TEX);
    const bw = 20;
    const bh = 22;
    for (let row = 0; row < 4; row++) {
      const off = (row % 2) * (bw / 2);
      for (let col = -1; col < 5; col++) {
        const x = col * bw + off + 1;
        const y = row * bh + 1;
        const v = 72 + Math.floor(rand() * 35);
        c.fillStyle = `rgb(${v},${v},${Math.floor(v * 1.05)})`;
        c.fillRect(x, y, bw - 2, bh - 2);
      }
    }
    return oc;
  }

  if (style === 2) {
    c.fillStyle = '#352818';
    c.fillRect(0, 0, TEX, TEX);
    for (let i = 0; i < 120; i++) {
      const px = Math.floor(rand() * TEX);
      const py = Math.floor(rand() * TEX);
      const w = 4 + Math.floor(rand() * 10);
      const h = 3 + Math.floor(rand() * 8);
      const br = 55 + Math.floor(rand() * 45);
      c.fillStyle = `rgb(${br},${Math.floor(br * 0.72)},${Math.floor(br * 0.48)})`;
      c.fillRect(px, py, Math.min(w, TEX - px), Math.min(h, TEX - py));
    }
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 1;
    for (let y = 0; y < TEX; y += 8) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(TEX, y + (rand() - 0.5) * 4);
      c.stroke();
    }
    return oc;
  }

  // style === 3: mossy dark blocks
  c.fillStyle = '#1a2220';
  c.fillRect(0, 0, TEX, TEX);
  const gw = 16;
  const gh = 16;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const x = col * gw - 2;
      const y = row * gh - 2;
      const base = 32 + Math.floor(rand() * 28);
      c.fillStyle = `rgb(${Math.floor(base * 0.85)},${base},${Math.floor(base * 0.9)})`;
      c.fillRect(x, y, gw - 1, gh - 1);
      if (rand() > 0.55) {
        c.fillStyle = `rgba(20,${50 + Math.floor(rand() * 40)},30,0.45)`;
        c.fillRect(x + 2, y + 2, gw - 6, Math.floor(gh * 0.35));
      }
    }
  }
  return oc;
}

function makeStoneTexture(seedTint) {
  const oc = makeCanvas(TEX, TEX);
  const c = oc.getContext('2d');
  const base = seedTint === 'floor' ? 28 : 18;
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const t = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const n = t - Math.floor(t);
      const v = base + Math.floor(n * 22);
      c.fillStyle = `rgb(${v},${Math.floor(v * 0.95)},${Math.floor(v * 0.9)})`;
      c.fillRect(x, y, 1, 1);
    }
  }
  return oc;
}

/** Vertical wood planks + iron bands (64×64). */
export function makeDoorTexture() {
  const oc = makeCanvas(TEX, TEX);
  const c = oc.getContext('2d');
  c.fillStyle = '#2a1810';
  c.fillRect(0, 0, TEX, TEX);
  const plankW = 14;
  for (let col = 0; col < 5; col++) {
    const x = col * plankW + 2;
    const base = 55 + col * 7;
    c.fillStyle = `rgb(${base + 25},${Math.floor(base * 0.55)},${Math.floor(base * 0.28)})`;
    c.fillRect(x, 4, plankW - 2, 56);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(x + plankW - 4, 4, 2, 56);
  }
  c.fillStyle = '#3a3a42';
  c.fillRect(4, 18, 56, 5);
  c.fillRect(4, 40, 56, 5);
  c.strokeStyle = '#1a1a1e';
  c.lineWidth = 2;
  c.strokeRect(6, 22, 20, 18);
  c.fillStyle = 'rgba(20,30,45,0.65)';
  c.fillRect(8, 24, 16, 14);
  c.fillStyle = '#6a5a40';
  c.beginPath();
  c.arc(38, 34, 3, 0, Math.PI * 2);
  c.fill();
  return oc;
}

export const WALL_STYLE_COUNT = 4;

/**
 * 64×64 pixel-art foe for wall billboards / combat (procedural, no assets).
 * @param {'goblin' | 'skeleton' | 'ogre'} typeKey
 */
export function makeEnemyTexture(typeKey) {
  const oc = makeCanvas(TEX, TEX);
  const c = oc.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#000000';
  c.fillRect(0, 0, TEX, TEX);

  if (typeKey === 'goblin') {
    const skin = '#3a8a3a';
    const dark = '#2a6a2a';
    const eye = '#e8c020';
    c.fillStyle = dark;
    c.fillRect(14, 18, 14, 10);
    c.fillStyle = skin;
    c.fillRect(22, 10, 20, 16);
    c.fillRect(20, 22, 26, 20);
    c.fillStyle = eye;
    c.fillRect(26, 16, 5, 5);
    c.fillRect(37, 16, 5, 5);
    c.fillStyle = '#1a1a14';
    c.fillRect(28, 24, 4, 3);
    c.fillRect(32, 25, 4, 2);
    c.fillRect(30, 27, 6, 2);
    c.fillStyle = dark;
    c.fillRect(12, 26, 10, 16);
    c.fillRect(42, 24, 10, 14);
    c.fillRect(24, 40, 8, 18);
    c.fillRect(34, 40, 8, 18);
    c.fillStyle = '#888888';
    c.fillRect(50, 30, 5, 14);
    c.fillRect(48, 28, 4, 4);
    return oc;
  }

  if (typeKey === 'skeleton') {
    const bone = '#d8d0c8';
    const shade = '#8a8a96';
    const hole = '#0c0c10';
    c.fillStyle = bone;
    c.beginPath();
    c.arc(32, 13, 11, 0, Math.PI * 2);
    c.fill();
    c.fillRect(24, 22, 16, 8);
    c.fillStyle = hole;
    c.fillRect(24, 10, 6, 6);
    c.fillRect(34, 10, 6, 6);
    c.fillStyle = bone;
    c.fillRect(30, 28, 4, 6);
    c.fillRect(14, 32, 20, 4);
    c.fillRect(30, 32, 20, 4);
    c.fillRect(22, 37, 22, 3);
    c.fillRect(20, 41, 26, 3);
    c.fillRect(18, 45, 30, 3);
    c.fillStyle = shade;
    c.fillRect(31, 34, 2, 16);
    c.fillStyle = bone;
    c.fillRect(6, 33, 8, 22);
    c.fillRect(50, 33, 8, 22);
    c.fillRect(22, 50, 20, 6);
    c.fillRect(22, 56, 8, 8);
    c.fillRect(34, 56, 8, 8);
    return oc;
  }

  if (typeKey === 'ogre') {
    const body = '#6a3a18';
    const hi = '#8a4a20';
    const deep = '#4a2810';
    c.fillStyle = body;
    c.fillRect(6, 12, 52, 46);
    c.fillRect(12, 2, 40, 20);
    c.fillStyle = hi;
    c.fillRect(10, 18, 12, 30);
    c.fillRect(42, 18, 12, 30);
    c.fillRect(16, 6, 32, 6);
    c.fillStyle = deep;
    c.fillRect(24, 12, 5, 5);
    c.fillRect(35, 12, 5, 5);
    c.fillStyle = body;
    c.fillRect(16, 22, 32, 24);
    c.fillStyle = '#2a1810';
    c.fillRect(14, 26, 36, 10);
    c.fillStyle = deep;
    c.fillRect(14, 54, 14, 8);
    c.fillRect(36, 54, 14, 8);
    c.fillStyle = body;
    c.fillRect(16, 56, 10, 6);
    c.fillRect(38, 56, 10, 6);
    return oc;
  }

  return oc;
}

export function createTextures() {
  const walls = [];
  for (let s = 0; s < WALL_STYLE_COUNT; s++) {
    walls.push(makeWallTexture(s));
  }
  return {
    walls,
    door: makeDoorTexture(),
    floor: makeStoneTexture('floor'),
    ceiling: makeStoneTexture('ceiling'),
    enemySprites: {
      goblin: makeEnemyTexture('goblin'),
      skeleton: makeEnemyTexture('skeleton'),
      ogre: makeEnemyTexture('ogre'),
    },
  };
}
