/**
 * Retro SFX + quiet dungeon ambience via Web Audio API (loot-box pattern).
 * No external files; lazy AudioContext + resume on user gesture.
 * Ambience: looped pink-ish noise through moving bandpass (air / stone hall), not a tonal hum.
 */

import { getTorchLightTurnsRemaining } from './loot.js';

const KEY_ENABLED = 'dungeon-crawler-sfx-enabled';

let audioCtx = null;
let enabled = true;

/** @type {{ noiseSrc: AudioBufferSourceNode, lfo: OscillatorNode, lfo2: OscillatorNode, masterGain: GainNode, ctx: AudioContext } | null} */
let ambient = null;

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

function getAudioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    audioCtx = new AC({ latencyHint: 'interactive' });
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSfxEnabled() {
  return enabled;
}

export function setSfxEnabled(v) {
  enabled = !!v;
  saveEnabled();
  syncToggleUi();
  if (enabled) {
    getAudioCtx()
      ?.resume()
      .then(() => startAmbientDrone())
      .catch(() => {});
  } else {
    stopAmbientDrone();
  }
}

function stopAmbientDrone() {
  if (!ambient) return;
  const { noiseSrc, lfo, lfo2, masterGain, ctx } = ambient;
  ambient = null;
  const t = ctx.currentTime;
  try {
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.linearRampToValueAtTime(0, t + 0.45);
    const stopT = t + 0.5;
    noiseSrc.stop(stopT);
    lfo.stop(stopT);
    lfo2.stop(stopT);
  } catch {
    /* nodes may already be stopped */
  }
}

/** ~1.5s loop of pink-ish noise (Paul Kellet-style filter). */
function createDungeonAirNoiseBuffer(ctx) {
  const dur = 1.5;
  const rate = ctx.sampleRate;
  const n = Math.floor(rate * dur);
  const buffer = ctx.createBuffer(1, n, rate);
  const d = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    d[i] = pink * 0.045;
    b6 = white * 0.115926;
  }
  return buffer;
}

/** Moving filtered noise + faint breath on level (still quiet vs SFX). */
function startAmbientDrone() {
  if (!enabled || ambient) return;
  const ctx = getAudioCtx();
  if (!ctx) return;

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = createDungeonAirNoiseBuffer(ctx);
  noiseSrc.loop = true;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 180;
  hp.Q.value = 0.7;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 520;
  bp.Q.value = 0.45;

  const airGain = ctx.createGain();
  airGain.gain.value = 1.15;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.035;
  const lfoFreqMod = ctx.createGain();
  lfoFreqMod.gain.value = 380;
  lfo.connect(lfoFreqMod);
  lfoFreqMod.connect(bp.frequency);

  const lfo2 = ctx.createOscillator();
  lfo2.type = 'sine';
  lfo2.frequency.value = 0.013;
  const lfoQMod = ctx.createGain();
  lfoQMod.gain.value = 0.22;
  lfo2.connect(lfoQMod);
  lfoQMod.connect(bp.Q);

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0;

  noiseSrc.connect(hp);
  hp.connect(bp);
  bp.connect(airGain);
  airGain.connect(masterGain);
  masterGain.connect(ctx.destination);

  const t = ctx.currentTime;
  noiseSrc.start(t);
  lfo.start(t);
  lfo2.start(t);
  masterGain.gain.linearRampToValueAtTime(0.038, t + 2.4);

  ambient = { noiseSrc, lfo, lfo2, masterGain, ctx, bp };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * Darken / shift ambience as torch light fades.
 * Called from main render loop.
 */
export function syncAmbientDroneToTorch() {
  if (!ambient) return;
  const { masterGain, ctx } = ambient;

  // Current torch-light is measured in “turns remaining”.
  // Base torch provides 48 turns; our ring adds +12.
  const maxTurns = 60;
  const L = getTorchLightTurnsRemaining();
  const ratio = clamp01(L / maxTurns);

  // Lower center frequency and reduce gain as the dungeon grows darker.
  const targetFreq = 360 + ratio * 220;
  const targetGain = 0.001 + ratio * 0.037; // near-silent at no light; fuller at bright

  const t = ctx.currentTime;
  try {
    // masterGain is smoothed, avoid zipper noise.
    masterGain.gain.setTargetAtTime(targetGain, t, 0.18);

    // Bandpass filter is modulated by LFO already; adjust the center frequency only.
    // (We don't replace the LFO; just retarget bp.frequency.)
    if (ambient.bp) {
      ambient.bp.frequency.setTargetAtTime(targetFreq, t, 0.18);
    }
  } catch {
    /* ignore */
  }
}

/** First click/key resumes context (autoplay policy); starts ambient when sound is on. */
export function setupAudioUnlock() {
  loadEnabled();
  syncToggleUi();
  const resume = () => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const p = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    p.then(() => {
      if (enabled && !ambient) startAmbientDrone();
    }).catch(() => {});
  };
  window.addEventListener('pointerdown', resume, { passive: true, capture: true });
  window.addEventListener('keydown', resume, { passive: true, capture: true });
}

export function bindSoundToggle() {
  const btn = document.getElementById('dc-sound-toggle');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    setSfxEnabled(!enabled);
    if (enabled) {
      const ctx = getAudioCtx();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => playFootstep()).catch(() => {});
      } else {
        playFootstep();
      }
    }
  });
}

function syncToggleUi() {
  const btn = document.getElementById('dc-sound-toggle');
  if (!btn) return;
  btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  btn.textContent = enabled ? 'Sound: on' : 'Sound: off';
  btn.title = enabled ? 'Turn sound off' : 'Turn sound on';
}

function run(fn) {
  if (!enabled) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    fn(ctx, ctx.currentTime);
  } catch {
    /* ignore */
  }
}

/** One step on stone — short bandpassed click. */
export function playFootstep() {
  run((ctx, t) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(380, t);
    filter.Q.value = 1.2;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.06);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  });
}

/** Creak + latch — door opening. */
export function playDoorOpen() {
  run((ctx, t) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(70, t);
    osc1.frequency.linearRampToValueAtTime(45, t + 0.45);
    gain1.gain.setValueAtTime(0, t);
    gain1.gain.linearRampToValueAtTime(0.14, t + 0.04);
    gain1.gain.linearRampToValueAtTime(0, t + 0.55);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(200, t + 0.08);
    osc2.frequency.linearRampToValueAtTime(120, t + 0.4);
    gain2.gain.setValueAtTime(0, t + 0.08);
    gain2.gain.linearRampToValueAtTime(0.06, t + 0.14);
    gain2.gain.linearRampToValueAtTime(0, t + 0.48);

    osc1.connect(gain1);
    gain1.connect(filter);
    osc2.connect(gain2);
    gain2.connect(filter);
    filter.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.65);
    osc2.start(t + 0.08);
    osc2.stop(t + 0.55);

    const pop = ctx.createOscillator();
    const pg = ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(620, t + 0.42);
    pop.frequency.exponentialRampToValueAtTime(200, t + 0.52);
    pg.gain.setValueAtTime(0, t + 0.42);
    pg.gain.linearRampToValueAtTime(0.12, t + 0.44);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
    pop.connect(pg);
    pg.connect(ctx.destination);
    pop.start(t + 0.42);
    pop.stop(t + 0.62);
  });
}

/** Thud + short rattle — door closing. */
export function playDoorClose() {
  run((ctx, t) => {
    const boom = ctx.createOscillator();
    const bg = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(95, t);
    boom.frequency.exponentialRampToValueAtTime(38, t + 0.2);
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(0.28, t + 0.02);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    boom.connect(bg);
    bg.connect(ctx.destination);
    boom.start(t);
    boom.stop(t + 0.4);

    const rattle = ctx.createOscillator();
    const rg = ctx.createGain();
    rattle.type = 'square';
    rattle.frequency.setValueAtTime(180, t + 0.05);
    rattle.frequency.linearRampToValueAtTime(90, t + 0.12);
    rg.gain.setValueAtTime(0, t + 0.05);
    rg.gain.linearRampToValueAtTime(0.05, t + 0.06);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    rattle.connect(rg);
    rg.connect(ctx.destination);
    rattle.start(t + 0.05);
    rattle.stop(t + 0.18);
  });
}

/** Sword whoosh / swing (no target). */
export function playCombatSwing() {
  run((ctx, t) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.14);
    filter.Q.value = 0.7;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  });
}

/** Metal on stone — blocked move or parry. */
export function playCombatClash() {
  run((ctx, t) => {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o1.type = 'square';
    o2.type = 'square';
    o1.frequency.setValueAtTime(320, t);
    o2.frequency.setValueAtTime(335, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o1.connect(g);
    o2.connect(g);
    g.connect(ctx.destination);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 0.12);
    o2.stop(t + 0.12);
  });
}

/** Hit connect — for future combat; also satisfying on "practice" strike. */
export function playCombatHit() {
  run((ctx, t) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.15);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.22);

    const hi = ctx.createOscillator();
    const hg = ctx.createGain();
    hi.type = 'square';
    hi.frequency.setValueAtTime(440, t);
    hi.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    hg.gain.setValueAtTime(0, t);
    hg.gain.linearRampToValueAtTime(0.08, t + 0.002);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    hi.connect(hg);
    hg.connect(ctx.destination);
    hi.start(t);
    hi.stop(t + 0.12);
  });
}

/** Short coin / chest chime. */
export function playLoot() {
  run((ctx, t) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(660, t + 0.14);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.24);

    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(1320, t + 0.06);
    o2.frequency.exponentialRampToValueAtTime(990, t + 0.12);
    g2.gain.setValueAtTime(0, t + 0.06);
    g2.gain.linearRampToValueAtTime(0.06, t + 0.065);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.start(t + 0.06);
    o2.stop(t + 0.2);
  });
}

/** Soft exhale / camp tone for short rest. */
export function playRest() {
  run((ctx, t) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.35);
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.4);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.58);
  });
}
