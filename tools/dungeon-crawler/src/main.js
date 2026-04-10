import {
  isSolid,
  getCell,
  getWallStyleAt,
  getRoomIdAt,
  tryToggleDoor,
  isClosedDoor,
  isDoorCell,
  refreshWallStyles,
  setMapSize,
  MAP_W,
  MAP_H,
  CELL_WALL,
  CELL_DOOR_CLOSED,
  CELL_DOOR_OPEN,
} from './map.js';
import { generateProceduralDungeon } from './dungeon-gen.js';
import { createTextures } from './textures.js';
import { castRays, VIEW_W, VIEW_H, DIR_VECTORS } from './raycaster.js';
import {
  initParty,
  renderParty,
  PARTY,
  healLowestInjured,
  partyNeedsRestHeal,
  applyShortRestHeal,
  resetPartyForRun,
} from './party.js';
import {
  initLoot,
  hasUnopenedChest,
  tryOpenChest,
  getPartyGold,
  getPotionCount,
  getScrollCount,
  getTorchCount,
  getTorchLightTurnsRemaining,
  getVisionBoost,
  tickTorchLight,
  TORCH_LOW_WARN_TURNS,
  tryIgniteTorch,
  tryConsumeTorch,
  tryBuyPotionWithGold,
  POTION_BUY_PRICE,
} from './loot.js';
import {
  setupAudioUnlock,
  bindSoundToggle,
  playFootstep,
  playDoorOpen,
  playDoorClose,
  playCombatSwing,
  playCombatClash,
  playCombatHit,
  playLoot,
  playRest,
  syncAmbientDroneToTorch,
} from './audio.js';
import {
  isCombatActive,
  combatHandleKey,
  initCombatUi,
  tryStartEncounterAt,
  getCombatEnemyDrawSpec,
} from './combat.js';
import { resetEncounterProgress, getEncounterTypeAt } from './encounters.js';
import { drawEnemySprite } from './enemy-sprites.js';
import { resetTrapProgress, hasTrapAt, isTrapTriggeredAt, tryTriggerTrapAt } from './traps.js';
import { getBestWinStats, recordRun, formatDurationMs } from './run-history.js';
import { getSeed, setSeed, loadSeedFromStorage, makeRandomSeed, randInt } from './rng.js';

const player = { x: 1.5, y: 1.5, dir: 0 };

const FWD = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const STRAFE_R = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

const canvas = document.getElementById('view');
const msgBar = document.getElementById('msg-bar');
const exploreLogEl = document.getElementById('dc-explore-log');
/** Exploration message log (flavor accumulation). Toggle with `L`. */
const EXPLORE_LOG_MAX_LINES = 220;
let exploreLogEnabled = false;
const exploreLogLines = [];

const compassEl = document.getElementById('compass');
const turnNumEl = document.getElementById('dc-turn-num');
const stepNumEl = document.getElementById('dc-step-num');
const timePanelEl = document.getElementById('dc-time');
const goldNumEl = document.getElementById('dc-gold');
const restLeftEl = document.getElementById('dc-rest-left');
const potEl = document.getElementById('dc-pot');
const scrollEl = document.getElementById('dc-scroll');
const torchEl = document.getElementById('dc-torch');
const lightEl = document.getElementById('dc-light');
const partyPanel = document.getElementById('party-panel');
const viewportWrapEl = document.getElementById('viewport-wrap');

/** @type {'playing' | 'won' | 'lost'} */
let gamePhase = 'playing';

const endOverlayEl = document.getElementById('dc-end-overlay');
const endTitleEl = document.getElementById('dc-end-title');
const endLeadEl = document.getElementById('dc-end-lead');
const endStatsEl = document.getElementById('dc-end-stats');
const endDeathEl = document.getElementById('dc-end-death');
const endRestartBtn = document.getElementById('dc-end-restart');

/** Short rest: limited uses, costs several turns (time / supplies). */
const REST_MAX_USES_NORMAL = 3;
const REST_MAX_USES_HARD = 1;
const REST_TURN_COST = 10;
let restMaxUses = REST_MAX_USES_NORMAL;
let restsRemaining = restMaxUses;

const KEY_HARD_MODE = 'dungeon-crawler-hard-mode-v1';
let hardMode = false;

/** Clock turns advance on “time costs” (movement/doors/rest), not on free rotation. */
let turnCount = 0;
/** Successful tile moves only. */
let stepCount = 0;
/** Monotonic run start for replay timing. */
let runStartPerfMs = performance.now();
/** Last completed run duration in ms (for end overlay). */
let lastRunTimeMs = 0;

/** Power curve: reward clearing encounters with more capacity. */
const ENCOUNTER_MAX_HP_BONUS = 2;

const ctx = canvas.getContext('2d');
const textures = createTextures();

const WALL_MINI = ['#4a3530', '#505058', '#5a4838', '#3a4a42'];

const COMPASS = ['N', 'E', 'S', 'W'];
const MINI = 100;
let CELL = Math.min(MINI / MAP_W, MINI / MAP_H);
const MINI_PAD = 6;
let MINI_CACHE_W = MAP_W * CELL + 4;
let MINI_CACHE_H = MAP_H * CELL + 4;
const MINI_CELL_INSET = 2;

function recomputeMinimapGeometry() {
  CELL = Math.min(MINI / MAP_W, MINI / MAP_H);
  MINI_CACHE_W = MAP_W * CELL + 4;
  MINI_CACHE_H = MAP_H * CELL + 4;
  minimapStatic = null;
  minimapStaticCtx = null;
}

/** Sunlit exit — farthest reachable floor tile from start (set each generation). */
let exitIx = 1;
let exitIy = 1;

const ROOM_DESCRIPTORS = [
  'Room: A collapsed gallery. Water drips from the ceiling.',
  'Room: Scorch marks line the walls, as if something burned in place.',
  'Room: Damp stones sweat in the torchlight. The air tastes stale.',
  'Room: Old footsteps linger in the dust, but no bodies remain.',
  'Room: A narrow chapel where hymns never quite settle.',
  'Room: The corridor widens into a quiet chamber of broken tiles.',
  'Room: Strangler vines have braided the corners into thickets.',
  'Room: A room of shattered shields, their dents still sharp.',
  'Room: The ceiling is low here, forcing every breath to sound loud.',
  'Room: Foot-thick soot blankets the floor like a warning layer.',
  'Room: A scaffold of rusted beams looms over the hall.',
  'Room: The walls are carved with symbols that refuse to match any order.',
  'Room: Water pools in shallow bowls, reflecting faint green light.',
  'Room: This chamber smells of iron and old rain.',
  'Room: The stones ring hollow, as if the dungeon is listening back.',
  'Room: A storm of broken pottery crunches under your steps.',
  'Room: Signs of struggle: dragged marks lead nowhere fast.',
  'Room: The torch burns steadier here, then flickers when you blink.',
  'Room: A stretch of echoing stone, too empty to be natural.',
  'Room: Someone tried to barricade this room and failed.',
];

/** Room descriptions: show once per run per room id. */
const shownRoomIds = new Set();

function regenDungeonFromSeed() {
  resetEncounterProgress();
  resetTrapProgress();
  // Randomize map size per run (keep odd dimensions for nicer maze carving).
  const randOdd = (min, max) => {
    const a = Math.max(5, Math.floor(min));
    const b = Math.max(a, Math.floor(max));
    let v = randInt(a, b);
    if (v % 2 === 0) v += v === b ? -1 : 1;
    return Math.max(5, v);
  };
  setMapSize(randOdd(11, 17), randOdd(14, 20));
  recomputeMinimapGeometry();
  const r = generateProceduralDungeon({ hardMode });
  exitIx = r.exitIx;
  exitIy = r.exitIy;
  refreshWallStyles(textures.walls.length);
}

/** Offscreen: border + cells only. Rebuilt when doors or wall sectors change. */
let minimapStatic = null;
let minimapStaticCtx = null;

/** Minimap fog of war: only cells along sight lines from the party (no “through wall” radius). */
const visitedMinimapCells = new Set();

/** Max steps per LOS ray (closed door counts as wall). */
const MINIMAP_LOS_MAX = 10;

const MINIMAP_LOS_DIRS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

function minimapCellKey(ix, iy) {
  return `${ix},${iy}`;
}

/**
 * 8-way line-of-sight from (cx,cy): reveal each cell along each ray until a solid cell (inclusive).
 * @returns {boolean} true if any new cell was revealed
 */
function revealMinimapLosFrom(cx, cy) {
  let changed = false;
  for (const [dx, dy] of MINIMAP_LOS_DIRS) {
    let x = cx;
    let y = cy;
    for (let step = 0; step < MINIMAP_LOS_MAX; step++) {
      x += dx;
      y += dy;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) break;
      const k = minimapCellKey(x, y);
      if (!visitedMinimapCells.has(k)) {
        visitedMinimapCells.add(k);
        changed = true;
      }
      if (isSolid(x, y)) break;
    }
  }
  return changed;
}

/** Mark standing cell + everything visible along LOS from here. */
function revealMinimapFromPlayer() {
  const cx = Math.floor(player.x);
  const cy = Math.floor(player.y);
  let changed = false;
  const here = minimapCellKey(cx, cy);
  if (!visitedMinimapCells.has(here)) {
    visitedMinimapCells.add(here);
    changed = true;
  }
  return revealMinimapLosFrom(cx, cy) || changed;
}

function resetMinimapVisited() {
  visitedMinimapCells.clear();
  visitedMinimapCells.add(minimapCellKey(1, 1));
  revealMinimapLosFrom(1, 1);
}

function ensureMinimapCacheCanvas() {
  if (minimapStatic) return;
  minimapStatic = document.createElement('canvas');
  minimapStatic.width = Math.ceil(MINI_CACHE_W);
  minimapStatic.height = Math.ceil(MINI_CACHE_H);
  minimapStaticCtx = minimapStatic.getContext('2d');
}

function rebuildMinimapStatic() {
  ensureMinimapCacheCanvas();
  const m = minimapStaticCtx;
  m.fillStyle = 'rgba(0,0,0,0.65)';
  m.fillRect(0, 0, MINI_CACHE_W, MINI_CACHE_H);
  m.strokeStyle = '#2a4a2a';
  m.lineWidth = 1;
  m.strokeRect(0, 0, MINI_CACHE_W, MINI_CACHE_H);

  const FOG = '#070a07';

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const rx = MINI_CELL_INSET + x * CELL;
      const ry = MINI_CELL_INSET + y * CELL;
      const rw = Math.ceil(CELL);
      const rh = Math.ceil(CELL);

      if (!visitedMinimapCells.has(minimapCellKey(x, y))) {
        m.fillStyle = FOG;
        m.fillRect(rx, ry, rw, rh);
        continue;
      }

      const cell = getCell(x, y);
      if (cell === CELL_WALL) {
        const st = getWallStyleAt(x, y) % WALL_MINI.length;
        m.fillStyle = WALL_MINI[st];
      } else if (cell === CELL_DOOR_CLOSED) m.fillStyle = '#7a4a28';
      else if (cell === CELL_DOOR_OPEN) m.fillStyle = '#2a3a22';
      else m.fillStyle = '#1e2a1e';
      if (x === exitIx && y === exitIy && cell !== CELL_WALL && cell !== CELL_DOOR_CLOSED) {
        m.fillStyle = '#1a4a32';
      }
      if (cell !== CELL_WALL && cell !== CELL_DOOR_CLOSED && hasUnopenedChest(x, y)) {
        m.fillStyle = '#6b5a18';
      }
      m.fillRect(rx, ry, rw, rh);

      // Pressure plate markers (visible once the tile is discovered).
      if (cell !== CELL_WALL && cell !== CELL_DOOR_CLOSED && hasTrapAt(x, y)) {
        const triggered = isTrapTriggeredAt(x, y);
        const inset = 2;
        const px = rx + inset;
        const py = ry + inset;
        const pw = Math.max(1, rw - inset * 2);
        const ph = Math.max(1, rh - inset * 2);
        m.fillStyle = triggered ? '#3a1a1a' : '#8a7b2a';
        m.fillRect(px, py, pw, ph);
        m.strokeStyle = triggered ? '#c07a7a' : '#d9c56a';
        m.lineWidth = 1;
        m.strokeRect(px, py, pw, ph);
      }
    }
  }
}

// Seed controls initialize RNG and then start the first run.

function syncSeedUi() {
  const input = document.getElementById('dc-seed-input');
  if (input) input.value = String(getSeed());
}

function initSeedControls() {
  const params = new URLSearchParams(window.location.search);
  const urlSeed = params.get('seed');
  if (urlSeed != null && urlSeed !== '') {
    const n = Number(urlSeed);
    if (Number.isFinite(n)) setSeed(n >>> 0);
  } else if (!loadSeedFromStorage()) {
    setSeed(makeRandomSeed());
  }
  syncSeedUi();

  const input = document.getElementById('dc-seed-input');
  const apply = document.getElementById('dc-seed-apply');
  const btnNew = document.getElementById('dc-seed-new');
  const applySeed = () => {
    const raw = input?.value?.trim() ?? '';
    if (!raw) return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setSeed(n >>> 0);
    syncSeedUi();
    restartRun();
  };
  if (apply) apply.addEventListener('click', () => applySeed());
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applySeed();
    });
  }
  if (btnNew) {
    btnNew.addEventListener('click', () => {
      setSeed(makeRandomSeed());
      syncSeedUi();
      restartRun();
    });
  }
}

initSeedControls();
function loadHardMode() {
  try {
    hardMode = window.localStorage.getItem(KEY_HARD_MODE) === '1';
  } catch {
    hardMode = false;
  }
}

function syncHardModeUi() {
  const btn = document.getElementById('dc-hard-toggle');
  if (!btn) return;
  btn.setAttribute('aria-pressed', hardMode ? 'true' : 'false');
  btn.textContent = hardMode ? 'Hard: on' : 'Hard: off';
  btn.title = hardMode
    ? 'Hard mode: ogre kill only, 1 rest, shadows hunt the weakest'
    : 'Enable hard mode';
}

function initHardModeToggle() {
  loadHardMode();
  syncHardModeUi();
  const btn = document.getElementById('dc-hard-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    hardMode = !hardMode;
    try {
      window.localStorage.setItem(KEY_HARD_MODE, hardMode ? '1' : '0');
    } catch {
      /* ignore */
    }
    syncHardModeUi();
    restartRun();
  });
}

initHardModeToggle();
restartRun();

function shouldAppendToExploreLog(text) {
  const t = String(text ?? '').trim();
  if (!t) return false;
  // Avoid spamming with basic movement/rotation summaries.
  if (t === 'You advance…' || t === 'You turn.') return false;
  return (
    /(^|\\s)Trap!/.test(t) ||
    t.includes('Chest:') ||
    t.startsWith('Room:') ||
    t.includes('Iron shield found') ||
    t.includes('Mystic ring found') ||
    t.includes('The door') ||
    t.includes('Combat!') ||
    t.includes('Victory!') ||
    t.includes('Defeat.') ||
    t.startsWith('Short rest') ||
    t.includes('Your torch gutters out') ||
    t.includes('Blocked.')
  );
}

function renderExploreLogFromMemory() {
  if (!exploreLogEl) return;
  exploreLogEl.innerHTML = '';
  for (const line of exploreLogLines) {
    const p = document.createElement('p');
    p.className = 'dc-explore-log-line';
    p.textContent = line;
    exploreLogEl.appendChild(p);
  }
}

function toggleExploreLog() {
  exploreLogEnabled = !exploreLogEnabled;
  if (exploreLogEl) {
    exploreLogEl.hidden = !exploreLogEnabled;
    exploreLogEl.setAttribute('aria-hidden', String(!exploreLogEnabled));
  }
  if (exploreLogEnabled) renderExploreLogFromMemory();
}

function appendToExploreLog(text) {
  if (!shouldAppendToExploreLog(text)) return;
  exploreLogLines.push(text);
  let trimmed = false;
  if (exploreLogLines.length > EXPLORE_LOG_MAX_LINES) {
    exploreLogLines.shift();
    trimmed = true;
  }

  if (!exploreLogEnabled || !exploreLogEl) return;
  if (trimmed && exploreLogEl.firstElementChild) {
    exploreLogEl.removeChild(exploreLogEl.firstElementChild);
  }

  const p = document.createElement('p');
  p.className = 'dc-explore-log-line';
  p.textContent = text;
  exploreLogEl.appendChild(p);
}

function getRoomDescriptionText(roomId) {
  // Deterministic mapping from room id -> one-line descriptor.
  const idx = (Math.imul(roomId, 2654435761) >>> 0) % ROOM_DESCRIPTORS.length;
  return ROOM_DESCRIPTORS[idx];
}

function maybeDescribeRoomAt(ix, iy) {
  const roomId = getRoomIdAt(ix, iy);
  if (roomId < 0) return null;
  if (shownRoomIds.has(roomId)) return null;
  shownRoomIds.add(roomId);
  return getRoomDescriptionText(roomId);
}

function setMessage(text) {
  if (msgBar) msgBar.textContent = text;
  appendToExploreLog(text);
}

function snapToHalf(v) {
  return Math.floor(v) + 0.5;
}

/** Sub-cell resolution for line–grid tests (prevents clipping through wall corners on cardinal moves). */
const STEP_TRACE_SCALE = 16;

/**
 * Map cells a straight move from (px,py) to (nx,ny) passes through (DDA in scaled space).
 * Catches corner clipping on cardinals as well as diagonals.
 * @param {number} px
 * @param {number} py
 * @param {number} nx
 * @param {number} ny
 * @returns {Iterable<[number, number]>}
 */
function cellsAlongStep(px, py, nx, ny) {
  const sc = STEP_TRACE_SCALE;
  const x0 = Math.round(px * sc);
  const y0 = Math.round(py * sc);
  const x1 = Math.round(nx * sc);
  const y1 = Math.round(ny * sc);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  const seen = new Map();
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 1 : i / n;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    const cx = Math.floor(x / sc);
    const cy = Math.floor(y / sc);
    const key = cx + ',' + cy;
    if (!seen.has(key)) seen.set(key, [cx, cy]);
  }
  return seen.values();
}

function advanceTurn() {
  turnCount++;
  return tickTorchLight(1);
}

function advanceStep() {
  stepCount++;
}

function syncTorchViewportFx() {
  if (!viewportWrapEl) return;
  const L = getTorchLightTurnsRemaining();
  const low = L > 0 && L < TORCH_LOW_WARN_TURNS;
  viewportWrapEl.classList.toggle('dc-torch-low', low);
}

function updateTimeDisplay() {
  if (turnNumEl) turnNumEl.textContent = String(turnCount);
  if (stepNumEl) stepNumEl.textContent = String(stepCount);
  if (goldNumEl) goldNumEl.textContent = String(getPartyGold());
  if (restLeftEl) restLeftEl.textContent = String(restsRemaining);
  if (potEl) potEl.textContent = String(getPotionCount());
  if (scrollEl) scrollEl.textContent = String(getScrollCount());
  if (torchEl) torchEl.textContent = String(getTorchCount());
  if (lightEl) {
    const L = getTorchLightTurnsRemaining();
    lightEl.textContent = L > 0 ? String(L) : '—';
    lightEl.classList.toggle('dc-light--low', L > 0 && L < TORCH_LOW_WARN_TURNS);
  }
  syncTorchViewportFx();
  if (timePanelEl) {
    const L = getTorchLightTurnsRemaining();
    const lightDesc =
      L <= 0 ? 'off' : L < TORCH_LOW_WARN_TURNS ? `low (${L} turns left)` : `${L} turns`;
    timePanelEl.setAttribute(
      'aria-label',
      `Turn ${turnCount}, Step ${stepCount}, Gold ${getPartyGold()}, Rests ${restsRemaining}, Potions ${getPotionCount()}, Scrolls ${getScrollCount()}, Torches ${getTorchCount()}, Torch light ${lightDesc}`,
    );
  }
}

function partyHasLivingMember() {
  return PARTY.some((p) => p.hp > 0);
}

function tryStep(fwdSteps, strafeSteps) {
  if (gamePhase !== 'playing' || isCombatActive() || !partyHasLivingMember()) return;
  const d = player.dir;
  const [fx, fy] = FWD[d];
  const [sx, sy] = STRAFE_R[d];
  const dx = fx * fwdSteps + sx * strafeSteps;
  const dy = fy * fwdSteps + sy * strafeSteps;
  if (dx === 0 && dy === 0) return;

  let torchGutter = advanceTurn().justExhausted;

  const nx = player.x + dx;
  const ny = player.y + dy;
  const startCx = Math.floor(player.x);
  const startCy = Math.floor(player.y);

  /** @type {string[]} */
  const trapMsgs = [];

  /** Apply damage to every living hero (hp-cost traps). */
  function applyPartyDamage(amount) {
    if (amount <= 0) return;
    for (const p of PARTY) {
      if (p.hp <= 0) continue;
      p.hp = Math.max(0, p.hp - amount);
    }
    renderParty();
  }

  for (const [cx, cy] of cellsAlongStep(player.x, player.y, nx, ny)) {
    if (cx === startCx && cy === startCy) continue;
    if (isSolid(cx, cy)) {
      setMessage(torchGutter ? 'Your torch gutters out — blocked.' : 'Blocked.');
      playCombatClash();
      return;
    }

    const trap = tryTriggerTrapAt(cx, cy);
    if (!trap) continue;

    if (trap.kind === 'hp') {
      applyPartyDamage(trap.hpCost);
      trapMsgs.push(`Trap! Your party takes ${trap.hpCost} HP.`);
      if (!partyHasLivingMember()) {
        triggerDefeat(null);
        return;
      }
    } else if (trap.kind === 'torch') {
      const L = getTorchLightTurnsRemaining();
      if (L > 0) {
        const { justExhausted } = tickTorchLight(trap.torchLossTurns);
        if (justExhausted) torchGutter = true;
        const rem = getTorchLightTurnsRemaining();
        trapMsgs.push(
          justExhausted
            ? 'Trap! Your torch gutters out.'
            : `Trap! Your torch flickers — ${rem} turns left.`,
        );
      } else {
        const ok = tryConsumeTorch();
        if (ok) {
          trapMsgs.push('Trap! A torch is burned in the fumes.');
        } else {
          applyPartyDamage(trap.hpFallback);
          trapMsgs.push(`Trap! No torches left — you take ${trap.hpFallback} HP.`);
          if (!partyHasLivingMember()) {
            triggerDefeat(null);
            return;
          }
        }
      }
    }
  }

  player.x = snapToHalf(nx);
  player.y = snapToHalf(ny);
  advanceStep();
  const tcx = Math.floor(player.x);
  const tcy = Math.floor(player.y);
  const roomDesc = maybeDescribeRoomAt(tcx, tcy);
  playFootstep();
  if (tryStartEncounterAt(tcx, tcy)) {
    const msg = [torchGutter ? 'Your torch gutters out — combat!' : 'Combat!'];
    if (roomDesc) msg.push(roomDesc);
    if (trapMsgs.length) msg.push(trapMsgs.join(' '));
    setMessage(msg.join(' '));
    rebuildMinimapStatic();
    return;
  }
  const loot = tryOpenChest(tcx, tcy);
  if (loot) {
    const parts = [];
    if (torchGutter) parts.push('Your torch gutters out. ');
    if (roomDesc) parts.push(roomDesc);
    parts.push(`Chest: +${loot.gold} gp.`);
    if (loot.gainedPotion) parts.push(' Red vial (combat potion).');
    if (loot.gainedScroll) parts.push(' Resurrection scroll.');
    if (loot.gainedTorch) parts.push(' Bundle of torch.');
    if (loot.salveHeal > 0) {
      const heal = healLowestInjured(loot.salveHeal);
      if (heal) parts.push(` ${heal.name} +${heal.amount} HP (salve).`);
      else parts.push(' Salve unused — party hale.');
    }
    if (loot.gainedShield) parts.push(' Iron shield found (+1 permanent armor).');
    if (loot.gainedRing) parts.push(' Mystic ring found (torchlight lasts longer).');
    if (trapMsgs.length) parts.push(' ' + trapMsgs.join(' '));
    setMessage(parts.join(''));
    playLoot();
    renderParty();
  } else {
    const msg = [];
    if (torchGutter) msg.push('Your torch gutters out.');
    msg.push('You advance…');
    if (roomDesc) msg.push(roomDesc);
    if (trapMsgs.length) msg.push(trapMsgs.join(' '));
    setMessage(msg.join(' '));
  }
  rebuildMinimapStatic();
  tryExitVictory(tcx, tcy);
}

function tryMoveForward() {
  tryStep(1, 0);
}
function tryMoveBack() {
  tryStep(-1, 0);
}
function tryStrafe(side) {
  tryStep(0, side);
}

function turn(delta) {
  if (gamePhase !== 'playing' || isCombatActive() || !partyHasLivingMember()) return;
  player.dir = (player.dir + delta + 4) % 4;
  // Rotation is free (no time/torch cost). This keeps turns intuitive versus movement.
  setMessage('You turn.');
}

function tryUseDoor() {
  if (gamePhase !== 'playing' || isCombatActive() || !partyHasLivingMember()) return;
  const { justExhausted: torchGutter } = advanceTurn();
  const gutter = torchGutter ? 'Your torch gutters out. ' : '';
  const [dx, dy] = FWD[player.dir];
  const ix = Math.floor(player.x + dx);
  const iy = Math.floor(player.y + dy);
  const r = tryToggleDoor(ix, iy, player.x, player.y);
  if (r === 'open' || r === 'closed') {
    refreshWallStyles(textures.walls.length);
    rebuildMinimapStatic();
    // Door state changes room connectivity; allow room text to re-trigger on re-entry.
    shownRoomIds.clear();
  }
  if (r === 'open') {
    setMessage(`${gutter}The door opens.`);
    playDoorOpen();
  } else if (r === 'closed') {
    setMessage(`${gutter}The door shuts.`);
    playDoorClose();
  } else if (r === 'blocked') setMessage(`${gutter}You can't close the door from inside.`);
  else setMessage(torchGutter ? 'Your torch gutters out. Nothing to use there.' : 'Nothing to use there.');
}

function tryShortRest() {
  if (gamePhase !== 'playing' || isCombatActive() || !partyHasLivingMember()) return;
  if (restsRemaining <= 0) {
    setMessage('No short rests left for this delve.');
    return;
  }
  if (!partyNeedsRestHeal()) {
    setMessage('Everyone is hale — save your rests for after a fight.');
    return;
  }
  restsRemaining -= 1;
  turnCount += REST_TURN_COST;
  const { justExhausted: torchGutter } = tickTorchLight(REST_TURN_COST);
  const healed = applyShortRestHeal();
  let restMsg = `Short rest (${REST_TURN_COST} turns): bandages, water, a breather — +${healed} HP total. ${restsRemaining} rest${restsRemaining === 1 ? '' : 's'} left.`;
  if (torchGutter) restMsg += ' Your torch gutters out.';
  setMessage(restMsg);
  playRest();
  renderParty();
}

function tryLightTorch() {
  if (gamePhase !== 'playing' || isCombatActive() || !partyHasLivingMember()) return;
  const { justExhausted: torchGutter } = advanceTurn();
  if (!tryIgniteTorch()) {
    setMessage(
      torchGutter ? 'Your torch gutters out — no spare torches in your pack.' : 'No torches in your pack.',
    );
    playCombatClash();
    return;
  }
  setMessage('Torch lit — corridors stay bright for many turns.');
  playLoot();
}

function tryBuyPotionOutOfCombat() {
  if (gamePhase !== 'playing' || isCombatActive() || !partyHasLivingMember()) return;
  const { justExhausted: torchGutter } = advanceTurn();
  if (!tryBuyPotionWithGold()) {
    setMessage(
      torchGutter
        ? `Your torch gutters out. Need ${POTION_BUY_PRICE} gp to scrounge a potion.`
        : `Need ${POTION_BUY_PRICE} gp to scrounge a potion.`,
    );
    playCombatClash();
    return;
  }
  setMessage(
    torchGutter
      ? `Your torch gutters out. Scrounged a potion (−${POTION_BUY_PRICE} gp).`
      : `Scrounged a potion (−${POTION_BUY_PRICE} gp).`,
  );
  playLoot();
}

function tryCombatSwing() {
  if (gamePhase !== 'playing' || isCombatActive() || !partyHasLivingMember()) return;
  const { justExhausted: torchGutter } = advanceTurn();
  const gutter = torchGutter ? 'Your torch gutters out. ' : '';
  const [dx, dy] = FWD[player.dir];
  const ix = Math.floor(player.x + dx);
  const iy = Math.floor(player.y + dy);
  playCombatSwing();
  if (isClosedDoor(ix, iy)) {
    setMessage(`${gutter}You strike the door!`);
    playCombatHit();
  } else if (isSolid(ix, iy)) {
    setMessage(`${gutter}You strike the wall!`);
    playCombatClash();
  } else {
    setMessage(torchGutter ? 'Your torch gutters out. You swing through empty air.' : 'You swing through empty air.');
  }
}

function drawMinimap() {
  const ox = MINI_PAD;
  const oy = MINI_PAD;
  ctx.save();
  if (minimapStatic) {
    ctx.drawImage(minimapStatic, ox - MINI_CELL_INSET, oy - MINI_CELL_INSET);
  }
  const px = ox + player.x * CELL;
  const py = oy + player.y * CELL;
  ctx.fillStyle = '#6fda6f';
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
  const { dx, dy } = DIR_VECTORS[player.dir];
  ctx.strokeStyle = '#a8ffa8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + dx * 8, py + dy * 8);
  ctx.stroke();
  ctx.restore();
}

function updateCompass() {
  if (compassEl) compassEl.textContent = COMPASS[player.dir];
}

function drawCombatEnemySprite() {
  const spec = getCombatEnemyDrawSpec();
  if (!spec) return;
  const hpPct = spec.maxHp > 0 ? Math.max(0, spec.hp / spec.maxHp) : 0;
  const w = 96 + Math.floor(48 * hpPct);
  const h = Math.min(248, Math.floor(VIEW_H * 0.58));
  const x = (VIEW_W - w) / 2;
  const y = VIEW_H / 2 - h / 2 - 10;
  drawEnemySprite(ctx, spec.typeKey, x, y, w, h);
  const barW = w - 20;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x + 10, y + h - 26, barW, 12);
  ctx.fillStyle = '#2a6a2a';
  ctx.fillRect(x + 10, y + h - 26, Math.max(0, barW * hpPct), 12);
}

const CHEST_GRID_W = 28;
const CHEST_GRID_H = 24;

/** Pixel chest (wood + band) scaled into view; matches minimap “gold” dead-end loot. */
function drawChestSprite(x, y, w, h) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iw = Math.max(1, Math.floor(w));
  const ih = Math.max(1, Math.floor(h));
  ctx.translate(ix, iy);
  ctx.scale(iw / CHEST_GRID_W, ih / CHEST_GRID_H);
  const wood = '#3d2814';
  const lid = '#5c3d22';
  const band = '#c4a028';
  const iron = '#6a6a72';
  ctx.fillStyle = wood;
  ctx.fillRect(5, 10, 18, 12);
  ctx.fillStyle = lid;
  ctx.fillRect(4, 4, 20, 9);
  ctx.fillStyle = band;
  ctx.fillRect(3, 10, 22, 3);
  ctx.fillStyle = iron;
  ctx.fillRect(12, 7, 4, 8);
  ctx.fillStyle = '#2a1a0c';
  ctx.fillRect(6, 6, 3, 2);
  ctx.fillRect(19, 6, 3, 2);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = '#0a0a0c';
  ctx.lineWidth = Math.max(2, Math.floor(Math.min(iw, ih) * 0.028));
  ctx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);
  ctx.restore();
}

/**
 * Forward ray: draw first encounter or unopened chest before a blocking wall.
 * (Chests were minimap-only before — loop used to step past them and hit the wall with nothing drawn.)
 */
function drawWorldBillboardAhead() {
  const [fx, fy] = FWD[player.dir];
  let cx = Math.floor(player.x);
  let cy = Math.floor(player.y);
  for (let d = 1; d <= 8; d++) {
    cx += fx;
    cy += fy;
    if (isSolid(cx, cy)) return;
    const t = getEncounterTypeAt(cx, cy);
    if (t) {
      const h = Math.min(Math.floor(VIEW_H * 0.58), Math.floor(210 / d));
      const w = Math.max(32, Math.floor(h * 0.4));
      const px = Math.floor(VIEW_W / 2 - w / 2 + ((d + 1) % 3) * 2);
      const py = Math.floor(VIEW_H / 2 - h / 2 + Math.sin(Date.now() / 800) * 2);
      drawEnemySprite(ctx, t, px, py, w, h);
      return;
    }
    if (hasUnopenedChest(cx, cy)) {
      const h = Math.min(Math.floor(VIEW_H * 0.4), Math.floor(140 / d));
      const w = Math.max(40, Math.floor(h * 0.95));
      const px = Math.floor(VIEW_W / 2 - w / 2 + ((d + 1) % 3) * 2);
      const py = Math.floor(VIEW_H / 2 - h / 2 + 36);
      drawChestSprite(px, py, w, h);
      return;
    }
  }
}

function updateNavDoorHighlight() {
  const mid = document.querySelector('#nav-pad [data-nav="nav-mid"]');
  if (!mid) return;
  if (gamePhase !== 'playing' || isCombatActive()) {
    mid.classList.remove('nav-mid--door');
    mid.removeAttribute('title');
    return;
  }
  const [dx, dy] = FWD[player.dir];
  const ix = Math.floor(player.x + dx);
  const iy = Math.floor(player.y + dy);
  const door = isDoorCell(ix, iy);
  mid.classList.toggle('nav-mid--door', door);
  if (door) {
    const closed = isClosedDoor(ix, iy);
    mid.title = closed ? 'Closed door ahead — Space / F to open' : 'Open doorway — Space / F to close';
    mid.setAttribute('aria-label', closed ? 'Door ahead: open' : 'Door ahead: close');
  } else {
    mid.removeAttribute('title');
    mid.setAttribute('aria-label', 'Use door (clear hall ahead)');
  }
}

function render() {
  updateTimeDisplay();
  syncAmbientDroneToTorch();
  castRays(ctx, player, textures.walls, {
    isSolid,
    isClosedDoor,
    getWallStyleAt,
    doorTex: textures.door,
    floorTex: textures.floor,
    ceilingTex: textures.ceiling,
    visionBoost: getVisionBoost(),
    exitCell: { ix: exitIx, iy: exitIy },
  });
  if (!isCombatActive() && gamePhase === 'playing') {
    drawExitLightShaft();
    drawChestBillboards();
  }
  if (isCombatActive()) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawCombatEnemySprite();
  } else if (gamePhase === 'playing') {
    drawWorldBillboardAhead();
  }
  drawMinimap();
  updateCompass();
  updateNavDoorHighlight();
  renderParty();
  if (gamePhase === 'playing' && revealMinimapFromPlayer()) {
    rebuildMinimapStatic();
  }
}

function hasLineOfSightToCellCenter(ix, iy) {
  // Grid DDA from player to cell center; stop if a solid tile blocks.
  const x0 = player.x;
  const y0 = player.y;
  const x1 = ix + 0.5;
  const y1 = iy + 0.5;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 10);
  if (steps <= 0) return true;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx === ix && cy === iy) return true;
    if (isSolid(cx, cy)) return false;
  }
  return true;
}

function drawExitLightShaft() {
  if (exitIx == null || exitIy == null) return;
  if (isSolid(exitIx, exitIy)) return;
  if (!hasLineOfSightToCellCenter(exitIx, exitIy)) return;

  const { dx: dirX, dy: dirY, px: planeX, py: planeY } = DIR_VECTORS[player.dir];
  const relX = exitIx + 0.5 - player.x;
  const relY = exitIy + 0.5 - player.y;
  const invDet = 1 / (planeX * dirY - dirX * planeY);
  const camX = invDet * (dirY * relX - dirX * relY);
  const camY = invDet * (-planeY * relX + planeX * relY);
  if (camY <= 0.05) return; // behind or too close

  const screenX = Math.floor((VIEW_W / 2) * (1 + camX / camY));
  if (screenX < -40 || screenX > VIEW_W + 40) return;

  const dist = Math.max(0.2, camY);
  const w = Math.max(12, Math.floor(120 / dist));
  const h = Math.min(VIEW_H, Math.floor(VIEW_H * 0.92));
  const x = Math.floor(screenX - w / 2);
  const y = Math.floor((VIEW_H - h) / 2);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.max(0.08, Math.min(0.28, 0.22 / dist));

  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(80, 255, 160, 0)');
  g.addColorStop(0.15, 'rgba(80, 255, 160, 0.25)');
  g.addColorStop(0.5, 'rgba(80, 255, 160, 0.10)');
  g.addColorStop(0.85, 'rgba(80, 255, 160, 0.25)');
  g.addColorStop(1, 'rgba(80, 255, 160, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // Bright core.
  ctx.globalAlpha = Math.max(0.05, Math.min(0.18, 0.14 / dist));
  const coreW = Math.max(2, Math.floor(w * 0.22));
  ctx.fillStyle = 'rgba(160, 255, 210, 0.85)';
  ctx.fillRect(Math.floor(screenX - coreW / 2), y + 10, coreW, h - 20);

  ctx.restore();
}

function drawChestBillboards() {
  // Draw unopened chests as billboards at any view angle (not just straight-ahead).
  const { dx: dirX, dy: dirY, px: planeX, py: planeY } = DIR_VECTORS[player.dir];
  const invDet = 1 / (planeX * dirY - dirX * planeY);

  const px0 = Math.floor(player.x);
  const py0 = Math.floor(player.y);
  const R = 7;

  /** @type {{ camY: number, screenX: number, ix: number, iy: number }[]} */
  const visibles = [];

  for (let iy = py0 - R; iy <= py0 + R; iy++) {
    for (let ix = px0 - R; ix <= px0 + R; ix++) {
      if (!hasUnopenedChest(ix, iy)) continue;
      if (!hasLineOfSightToCellCenter(ix, iy)) continue;

      const relX = ix + 0.5 - player.x;
      const relY = iy + 0.5 - player.y;
      const camX = invDet * (dirY * relX - dirX * relY);
      const camY = invDet * (-planeY * relX + planeX * relY);
      if (camY <= 0.15) continue; // behind/too close
      if (camY > 9.5) continue;

      const screenX = (VIEW_W / 2) * (1 + camX / camY);
      if (screenX < -80 || screenX > VIEW_W + 80) continue;

      visibles.push({ camY, screenX, ix, iy });
    }
  }

  if (!visibles.length) return;
  visibles.sort((a, b) => b.camY - a.camY); // far-to-near

  // Cap draw calls for safety (small maps anyway).
  const maxDraw = 10;
  for (let i = 0; i < visibles.length && i < maxDraw; i++) {
    const v = visibles[i];
    const d = Math.max(0.35, v.camY);
    const h = Math.min(Math.floor(VIEW_H * 0.42), Math.floor(155 / d));
    const w = Math.max(34, Math.floor(h * 0.95));
    const x = Math.floor(v.screenX - w / 2);
    const y = Math.floor(VIEW_H / 2 - h / 2 + 46);
    drawChestSprite(x, y, w, h);
  }
}

function onKeyDown(e) {
  if (e.repeat) return;
  const k = e.key;
  if (isCombatActive()) {
    if (['1', '2', '3', '4', '5'].includes(k)) e.preventDefault();
    combatHandleKey(k);
    return;
  }
  if (gamePhase !== 'playing') {
    if (k === 'Enter') {
      e.preventDefault();
      restartRun();
    }
    return;
  }
  if (
    [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      ' ',
      'f',
      'F',
      'x',
      'X',
      'r',
      'R',
      't',
      'T',
      'g',
      'G',
    ].includes(k)
  ) {
    e.preventDefault();
  }
  switch (k) {
    case 'l':
    case 'L':
      toggleExploreLog();
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      tryMoveForward();
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      tryMoveBack();
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      turn(-1);
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      turn(1);
      break;
    case 'q':
    case 'Q':
      tryStrafe(-1);
      break;
    case 'e':
    case 'E':
      tryStrafe(1);
      break;
    case ' ':
    case 'f':
    case 'F':
      tryUseDoor();
      break;
    case 'x':
    case 'X':
      tryCombatSwing();
      break;
    case 'r':
    case 'R':
      tryShortRest();
      break;
    case 't':
    case 'T':
      tryLightTorch();
      break;
    case 'g':
    case 'G':
      tryBuyPotionOutOfCombat();
      break;
    default:
      return;
  }
  render();
}

function wireNav() {
  const pad = document.getElementById('nav-pad');
  if (!pad) return;
  const map = {
    // Diagonal = forward/back + strafe, relative to current facing.
    'nav-nw': () => tryStep(1, -1),
    'nav-n': () => tryMoveForward(),
    'nav-ne': () => tryStep(1, 1),
    'nav-w': () => tryStrafe(-1),
    'nav-mid': () => tryUseDoor(),
    'nav-e': () => tryStrafe(1),
    'nav-sw': () => tryStep(-1, -1),
    'nav-s': () => tryMoveBack(),
    'nav-se': () => tryStep(-1, 1),
  };
  pad.querySelectorAll('button[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (gamePhase !== 'playing' || isCombatActive()) return;
      const id = btn.getAttribute('data-nav');
      const fn = map[id];
      if (fn) fn();
      render();
    });
  });
}

function restsUsedCount() {
  return restMaxUses - restsRemaining;
}

function fillRunStats(container) {
  if (!container) return;
  const g = getPartyGold();
  const best = getBestWinStats();
  const rows = [
    ['Turns', String(turnCount)],
    ['Steps', String(stepCount)],
    ['Gold', String(g)],
    ['Short rests used', String(restsUsedCount())],
    ['Time', formatDurationMs(lastRunTimeMs)],
    ['Mode', hardMode ? 'Hard' : 'Normal'],
  ];
  if (best.bestTurns !== null) rows.push(['Best (turns)', String(best.bestTurns)]);
  if (best.bestTimeMs !== null) rows.push(['Best (time)', formatDurationMs(best.bestTimeMs)]);
  const statsHtml = rows
    .map(
      ([label, val]) =>
        `<span class="dc-end-stat-label">${label}</span><span class="dc-end-stat-val">${val}</span>`,
    )
    .join('');

  const fmtEntry = (e, rank, key) => {
    if (!e) return '';
    const mode = e.hardMode ? 'H' : 'N';
    const seed = Number.isFinite(e.seed) ? ` · seed ${e.seed}` : '';
    const extra = key === 'turns' ? ` · ${e.steps} steps` : ` · ${e.turns} turns`;
    return `<li><strong>#${rank}</strong> ${e[key]} ${key}${extra} · ${formatDurationMs(e.timeMs)} · ${mode}${seed}</li>`;
  };

  const topTurns = Array.isArray(best.topTurns) ? best.topTurns : [];
  const topSteps = Array.isArray(best.topSteps) ? best.topSteps : [];

  const boardHtml =
    topTurns.length || topSteps.length
      ? `<div class="dc-end-board">
          <div class="dc-end-board-title">Leaderboards (wins)</div>
          <div class="dc-end-board-cols">
            <div class="dc-end-board-col">
              <div class="dc-end-board-h">Top 5 by turns</div>
              <ol class="dc-end-board-list">${topTurns.map((e, i) => fmtEntry(e, i + 1, 'turns')).join('')}</ol>
            </div>
            <div class="dc-end-board-col">
              <div class="dc-end-board-h">Top 5 by steps</div>
              <ol class="dc-end-board-list">${topSteps.map((e, i) => fmtEntry(e, i + 1, 'steps')).join('')}</ol>
            </div>
          </div>
        </div>`
      : '';

  container.innerHTML = statsHtml + boardHtml;
}

function showEndOverlay(isWin, leadText, lastFoeName) {
  if (!endOverlayEl) return;
  const panel = endOverlayEl.querySelector('.dc-end-panel');
  if (panel) {
    panel.classList.toggle('dc-end-panel--loss', !isWin);
  }
  if (endTitleEl) endTitleEl.textContent = isWin ? 'Dungeon cleared' : 'Party fallen';
  if (endLeadEl) endLeadEl.textContent = leadText;
  fillRunStats(endStatsEl);

  if (endDeathEl) {
    if (isWin) {
      endDeathEl.hidden = true;
      endDeathEl.innerHTML = '';
    } else {
      const fallen = PARTY.filter((p) => p.hp <= 0);
      endDeathEl.hidden = fallen.length === 0;
      const names = fallen.map((p) => `<li>${p.name}</li>`).join('');
      const foe = lastFoeName
        ? `<p class="dc-end-foe">Last hostile: ${lastFoeName}</p>`
        : '';
      endDeathEl.innerHTML = `<h3>Fallen</h3><ul>${names}</ul>${foe}`;
    }
  }

  endOverlayEl.hidden = false;
  endOverlayEl.setAttribute('aria-hidden', 'false');
  if (endRestartBtn) endRestartBtn.focus();
}

function hideEndOverlay() {
  if (!endOverlayEl) return;
  endOverlayEl.hidden = true;
  endOverlayEl.setAttribute('aria-hidden', 'true');
}

function triggerVictory(leadText) {
  if (gamePhase !== 'playing') return;
  gamePhase = 'won';
  lastRunTimeMs = Math.floor(performance.now() - runStartPerfMs);
  recordRun({ victory: true, turnCount, stepCount, timeMs: lastRunTimeMs, seed: getSeed(), hardMode });
  playLoot();
  showEndOverlay(true, leadText, null);
  setMessage('Victory!');
}

function triggerDefeat(lastFoeName) {
  if (gamePhase !== 'playing') return;
  gamePhase = 'lost';
  lastRunTimeMs = Math.floor(performance.now() - runStartPerfMs);
  playCombatClash();
  showEndOverlay(false, 'Every hero has fallen. The dungeon keeps its secrets.', lastFoeName);
  setMessage('Defeat.');
}

function tryExitVictory(ix, iy) {
  if (gamePhase !== 'playing') return;
  if (hardMode) return; // Hard mode: ogre kill only.
  if (ix !== exitIx || iy !== exitIy) return;
  if (!partyHasLivingMember()) return;
  triggerVictory('You reach the sunlit exit. The dungeon lies behind you.');
}

function restartRun() {
  gamePhase = 'playing';
  hideEndOverlay();

  regenDungeonFromSeed();
  initLoot();
  resetPartyForRun();

  player.x = 1.5;
  player.y = 1.5;
  player.dir = 0;

  turnCount = 0;
  stepCount = 0;
  restMaxUses = hardMode ? REST_MAX_USES_HARD : REST_MAX_USES_NORMAL;
  restsRemaining = restMaxUses;
  lastRunTimeMs = 0;
  runStartPerfMs = performance.now();
  exploreLogLines.length = 0;
  if (exploreLogEl) exploreLogEl.innerHTML = '';
  shownRoomIds.clear();

  resetMinimapVisited();
  rebuildMinimapStatic();
  const startRoomDesc = maybeDescribeRoomAt(Math.floor(player.x), Math.floor(player.y));
  setMessage(
    `New run — procedural maze. Defeat the ogre or reach the farthest exit. Good luck.${startRoomDesc ? ' ' + startRoomDesc : ''}`,
  );
  renderParty();
  render();
}

function onCombatEndEvent(e) {
  const { victory, encounterType, enemyName, partyWipe } = e.detail || {};
  if (victory) {
    // +2 max HP after each cleared encounter to create a power curve.
    for (const p of PARTY) {
      if (p.hp <= 0) continue;
      p.maxHp += ENCOUNTER_MAX_HP_BONUS;
      p.hp = Math.min(p.maxHp, p.hp + ENCOUNTER_MAX_HP_BONUS);
    }
    renderParty();
    setMessage(`Encounter cleared — heroes gain +${ENCOUNTER_MAX_HP_BONUS} max HP.`);
  }
  if (victory && encounterType === 'ogre') {
    triggerVictory('The lesser ogre falls — the deepest halls are yours.');
  } else if (partyWipe) {
    triggerDefeat(enemyName || null);
  }
}

const restBtn = document.getElementById('dc-rest-btn');
if (restBtn) {
  restBtn.addEventListener('click', () => {
    if (gamePhase !== 'playing' || isCombatActive()) return;
    tryShortRest();
    render();
  });
}

if (endRestartBtn) {
  endRestartBtn.addEventListener('click', () => restartRun());
}

window.addEventListener('dc-combat-end', onCombatEndEvent);

if (viewportWrapEl) {
  window.addEventListener('dc-view-fx', (e) => {
    const d = e.detail || {};
    const el = viewportWrapEl;
    if (d.shake) {
      el.classList.remove('dc-fx-shake');
      void el.offsetWidth;
      el.classList.add('dc-fx-shake');
      window.setTimeout(() => el.classList.remove('dc-fx-shake'), 420);
    }
    if (d.enemyDeath) {
      el.classList.remove('dc-fx-enemy-death');
      void el.offsetWidth;
      el.classList.add('dc-fx-enemy-death');
      window.setTimeout(() => el.classList.remove('dc-fx-enemy-death'), 540);
    }
  });
}

initParty(partyPanel);
initCombatUi();
setupAudioUnlock();
bindSoundToggle();
document.addEventListener('keydown', onKeyDown);
window.addEventListener('dc-render', () => render());
wireNav();
setMessage('Welcome — new maze each run. Chests, T torch, G potion. Win: slay the ogre or stand on the green exit (farthest hall).');
render();
