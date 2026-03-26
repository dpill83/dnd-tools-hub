export function rnd(n) {
  return Math.floor(Math.random() * n);
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function idxOf(x, y, W) {
  return y * W + x;
}

export function inBounds(x, y, W, H) {
  return x >= 0 && x < W && y >= 0 && y < H;
}

