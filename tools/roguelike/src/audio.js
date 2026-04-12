/**
 * Lightweight 8-bit-style SFX via Web Audio API (no external files).
 * Requires a user gesture before playback on most browsers (see setupAudioUnlock).
 */

const KEY_ENABLED = 'roguelike-sfx-enabled';

let ctx = null;
let enabled = true;

function loadEnabled() {
  try {
    enabled = localStorage.getItem(KEY_ENABLED) !== '0';
  } catch {
    enabled = true;
  }
}

function saveEnabled() {
  try {
    localStorage.setItem(KEY_ENABLED, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function isSfxEnabled() {
  return enabled;
}

export function setSfxEnabled(v) {
  enabled = !!v;
  saveEnabled();
  updateToggleUi();
}

function scheduleTone(t0, freq, dur, vol, type = 'square') {
  const c = getCtx();
  if (!c || !enabled) return;

  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  const v = Math.min(0.2, vol * 0.09);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, v), t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function playSequence(steps) {
  const c = getCtx();
  if (!c || !enabled || c.state === 'suspended') return;
  let t = c.currentTime + 0.001;
  for (const s of steps) {
    if (s.rest) {
      t += s.rest;
      continue;
    }
    scheduleTone(t, s.freq, s.dur, s.vol ?? 1, s.type ?? 'square');
    t += s.dur + (s.gap ?? 0.02);
  }
}

/** Call once on startup; attaches one-time pointer listener to resume AudioContext. */
export function setupAudioUnlock() {
  loadEnabled();
  updateToggleUi();
  const resume = () => {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', resume, { passive: true, capture: true });
  window.addEventListener('keydown', resume, { passive: true, capture: true });
}

export function playSfx(name) {
  if (!enabled) return;
  const c = getCtx();
  if (!c || c.state === 'suspended') return;

  const now = c.currentTime + 0.001;

  switch (name) {
    case 'move':
      scheduleTone(now, 520, 0.028, 0.35, 'square');
      break;
    case 'door':
      playSequence([
        { freq: 180, dur: 0.05, vol: 0.5 },
        { freq: 220, dur: 0.07, vol: 0.45, gap: 0.01 },
      ]);
      break;
    case 'playerHit':
      scheduleTone(now, 380, 0.06, 0.55, 'square');
      scheduleTone(now + 0.04, 280, 0.05, 0.35, 'square');
      break;
    case 'kill':
      playSequence([
        { freq: 660, dur: 0.06, vol: 0.45 },
        { freq: 880, dur: 0.08, vol: 0.5, gap: 0.02 },
        { freq: 1320, dur: 0.1, vol: 0.35, gap: 0.02 },
      ]);
      break;
    case 'hurt':
      scheduleTone(now, 165, 0.1, 0.65, 'sawtooth');
      break;
    case 'gold':
      playSequence([
        { freq: 1318, dur: 0.04, vol: 0.35 },
        { freq: 1760, dur: 0.08, vol: 0.45, gap: 0.02 },
      ]);
      break;
    case 'item':
      playSequence([
        { freq: 523, dur: 0.05, vol: 0.4 },
        { freq: 784, dur: 0.07, vol: 0.45, gap: 0.02 },
      ]);
      break;
    case 'wait':
      scheduleTone(now, 300, 0.04, 0.25, 'triangle');
      break;
    case 'descend':
      playSequence([
        { freq: 196, dur: 0.1, vol: 0.5 },
        { freq: 147, dur: 0.12, vol: 0.45, gap: 0.02 },
      ]);
      break;
    case 'win':
      playSequence([
        { freq: 523, dur: 0.1, vol: 0.45 },
        { freq: 659, dur: 0.1, vol: 0.45, gap: 0.02 },
        { freq: 784, dur: 0.12, vol: 0.5, gap: 0.02 },
        { freq: 1046, dur: 0.2, vol: 0.4, gap: 0.03 },
      ]);
      break;
    case 'death':
      playSequence([
        { freq: 300, dur: 0.08, vol: 0.55 },
        { freq: 220, dur: 0.1, vol: 0.5, gap: 0.02 },
        { freq: 150, dur: 0.15, vol: 0.6, gap: 0.02 },
        { freq: 90, dur: 0.25, vol: 0.5, gap: 0.02 },
      ]);
      break;
    case 'levelUp':
      playSequence([
        { freq: 523, dur: 0.08, vol: 0.45 },
        { freq: 659, dur: 0.08, vol: 0.45, gap: 0.02 },
        { freq: 784, dur: 0.12, vol: 0.5, gap: 0.02 },
      ]);
      break;
    case 'deny':
      scheduleTone(now, 140, 0.08, 0.4, 'square');
      break;
    case 'noop':
      scheduleTone(now, 200, 0.03, 0.2, 'square');
      break;
    default:
      break;
  }
}

function updateToggleUi() {
  const btn = document.getElementById('btn-audio-toggle');
  if (!btn) return;
  btn.setAttribute('aria-checked', enabled ? 'true' : 'false');
  btn.setAttribute('aria-label', enabled ? 'Sound on. Press to mute.' : 'Sound off. Press to turn sound on.');
  btn.title = enabled ? 'Turn sound off' : 'Turn sound on';
  const on = btn.querySelector('.rogue-audio-svg-on');
  const off = btn.querySelector('.rogue-audio-svg-off');
  if (on && off) {
    on.toggleAttribute('hidden', !enabled);
    off.toggleAttribute('hidden', enabled);
    return;
  }
  btn.textContent = enabled ? '🔊' : '🔇';
}

export function bindAudioToggle() {
  const btn = document.getElementById('btn-audio-toggle');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    setSfxEnabled(!enabled);
    if (!enabled) return;
    const c = getCtx();
    const play = () => playSfx('noop');
    if (c && c.state === 'suspended') c.resume().then(play).catch(play);
    else play();
  });
}
