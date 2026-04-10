import { PARTY, renderParty, partyNeedsRestHeal, healLowestInjured } from './party.js';
import { ENCOUNTER_TYPES, getEncounterTypeAt, markEncounterDefeated } from './encounters.js';
import { playCombatHit, playCombatSwing, playCombatClash } from './audio.js';
import {
  getPotionCount,
  getScrollCount,
  tryConsumePotion,
  tryConsumeScroll,
} from './loot.js';
import { getPermanentArmorBonus } from './gear.js';

/** Rounds of enemy actions before Spell is ready again. */
const SPELL_COOLDOWN_ENEMY_TURNS = 3;

/** @typedef {'quick' | 'normal' | 'heavy'} EnemyIntent */

/** @type {{ ix: number, iy: number, typeKey: string, enemy: { name: string, maxHp: number, hp: number, atk: number[] }, armorBonus: number, waiting: boolean, strikerIndex: number, spellCooldown: number, enemyIntent: EnemyIntent, tauntPartyIndex: number | null, enemyDamagePenalty: number } | null} */
let combat = null;

/** Chance the enemy honors a fighter's taunt on their next swing. */
const TAUNT_HIT_CHANCE = 0.72;

let overlayEl = null;
let logEl = null;
let enemyNameEl = null;
let enemyHpBarEl = null;
let enemyHpTextEl = null;
let btnAttack = null;
let btnDefend = null;
let btnSpell = null;
let btnPotion = null;
let btnScroll = null;
let strikerRowEl = null;
/** @type {HTMLButtonElement[]} */
let strikerBtns = [];

export function isCombatActive() {
  return combat !== null;
}

function roll(range) {
  const [a, b] = range;
  return a + Math.floor(Math.random() * (b - a + 1));
}

function logLine(text, className) {
  if (!logEl) return;
  const p = document.createElement('p');
  p.className = className ? `combat-log-line ${className}` : 'combat-log-line';
  p.textContent = text;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

function syncEnemyUi() {
  if (!combat || !enemyNameEl || !enemyHpBarEl || !enemyHpTextEl) return;
  const e = combat.enemy;
  enemyNameEl.textContent = e.name;
  const pct = Math.max(0, (e.hp / e.maxHp) * 100);
  enemyHpBarEl.style.width = `${pct}%`;
  enemyHpTextEl.textContent = `HP ${Math.max(0, e.hp)}/${e.maxHp}`;
}

function firstLivingPartyIndex() {
  const i = PARTY.findIndex((p) => p.hp > 0);
  return i >= 0 ? i : 0;
}

function syncStrikerRow() {
  if (!combat || !strikerBtns.length) return;
  const sel = combat.strikerIndex;
  PARTY.forEach((ch, i) => {
    const b = strikerBtns[i];
    if (!b) return;
    const alive = ch.hp > 0;
    b.disabled = !alive || combat.waiting;
    b.textContent = `${ch.name} — ${ch.strikerLabel ?? 'Attack'}`;
    const active = alive && i === sel;
    b.classList.toggle('combat-striker-btn--active', active);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  if (PARTY[sel] && PARTY[sel].hp <= 0) {
    combat.strikerIndex = firstLivingPartyIndex();
    syncStrikerRow();
  }
}

function syncSpellButtonLabel() {
  if (!btnSpell || !combat) return;
  const cd = combat.spellCooldown;
  btnSpell.textContent = cd > 0 ? `Spell (${cd})` : 'Spell';
}

function setCombatButtonsEnabled(on) {
  if (!combat) {
    [btnAttack, btnDefend, btnSpell, btnPotion, btnScroll].forEach((b) => {
      if (b) b.disabled = true;
    });
    return;
  }
  const potN = getPotionCount();
  const scrN = getScrollCount();
  if (btnPotion) btnPotion.textContent = `Potion (${potN})`;
  if (btnScroll) btnScroll.textContent = `Scroll (${scrN})`;

  const spellLocked = combat.spellCooldown > 0;
  if (btnAttack) btnAttack.disabled = !on;
  if (btnDefend) btnDefend.disabled = !on;
  if (btnSpell) btnSpell.disabled = !on || spellLocked;
  syncSpellButtonLabel();
  syncStrikerRow();
  if (btnPotion && btnScroll) {
    const canPotion = potN > 0 && partyNeedsRestHeal();
    btnPotion.disabled = !on || !canPotion;
    btnScroll.disabled = !on || scrN <= 0;
  }
}

function showOverlay() {
  if (overlayEl) {
    overlayEl.hidden = false;
    overlayEl.setAttribute('aria-hidden', 'false');
  }
}

function hideOverlay() {
  if (overlayEl) {
    overlayEl.hidden = true;
    overlayEl.setAttribute('aria-hidden', 'true');
  }
  if (logEl) logEl.innerHTML = '';
}

/**
 * Weighted intent: ogre favors heavies, goblin favors quick, skeleton mixed.
 * @param {string} typeKey
 * @returns {EnemyIntent}
 */
function rollEnemyIntentType(typeKey) {
  const r = Math.random();
  if (typeKey === 'ogre') {
    if (r < 0.48) return 'heavy';
    if (r < 0.78) return 'normal';
    return 'quick';
  }
  if (typeKey === 'goblin') {
    if (r < 0.52) return 'quick';
    if (r < 0.82) return 'normal';
    return 'heavy';
  }
  if (r < 0.38) return 'heavy';
  if (r < 0.72) return 'normal';
  return 'quick';
}

/**
 * @param {string} name
 * @param {EnemyIntent} intent
 */
function telegraphLine(name, intent) {
  if (intent === 'heavy') return `${name} rears back — a crushing blow is coming!`;
  if (intent === 'quick') return `${name} feints; a lightning strike is next!`;
  return `${name} shifts stance, probing for an opening.`;
}

/**
 * @param {{ atk: number[] }} enemy
 * @param {EnemyIntent} intent
 */
function rollEnemyDamageWithIntent(enemy, intent) {
  const [a, b] = enemy.atk;
  const span = Math.max(0, b - a);
  if (intent === 'quick') {
    const hi = a + Math.floor(span * 0.45);
    return roll([a, Math.max(a, hi)]);
  }
  if (intent === 'heavy') {
    const lo = a + Math.floor(span * 0.35);
    const hi = b + Math.max(2, Math.floor(span * 0.55));
    return roll([Math.min(lo, b), hi]);
  }
  return roll([a, b]);
}

/**
 * Class-based weapon damage when leading the attack (not a flat +0–+3 ladder).
 * @param {{ class: string }} striker
 */
function rollPlayerAttackDamage(striker) {
  const c = striker.class;
  if (c === 'Fighter') return roll([6, 12]);
  if (c === 'Paladin') return roll([5, 10]);
  if (c === 'Cleric') return roll([4, 9]);
  if (c === 'Wizard') return roll([3, 7]);
  return roll([4, 10]);
}

function rollAndLogNextIntent() {
  if (!combat) return;
  combat.enemyIntent = rollEnemyIntentType(combat.typeKey);
  logLine(telegraphLine(combat.enemy.name, combat.enemyIntent), 'combat-tell');
}

function notifyRender() {
  window.dispatchEvent(new CustomEvent('dc-render'));
}

function fxShake(px = 8) {
  window.dispatchEvent(new CustomEvent('dc-view-fx', { detail: { shake: px } }));
}

function fxEnemyDeath() {
  window.dispatchEvent(new CustomEvent('dc-view-fx', { detail: { enemyDeath: true } }));
}

/**
 * @param {string} closeLine
 */
function scheduleVictoryAfterKill(closeLine) {
  logLine(closeLine);
  fxEnemyDeath();
  setTimeout(() => {
    if (!combat) return;
    endCombat(true);
  }, 420);
}

export function getCombatEnemyDrawSpec() {
  if (!combat) return null;
  return {
    typeKey: combat.typeKey,
    hp: combat.enemy.hp,
    maxHp: combat.enemy.maxHp,
  };
}

function endCombat(victory) {
  const typeKey = combat?.typeKey ?? null;
  const enemyName = combat?.enemy?.name ?? null;
  if (victory && combat) {
    markEncounterDefeated(combat.ix, combat.iy);
    playCombatHit();
  }
  combat = null;
  hideOverlay();
  setCombatButtonsEnabled(false);

  const partyWipe = !victory && PARTY.every((p) => p.hp <= 0);
  window.dispatchEvent(
    new CustomEvent('dc-combat-end', {
      detail: { victory, encounterType: typeKey, enemyName, partyWipe },
    }),
  );
  notifyRender();
}

function enemyTurn() {
  if (!combat) return;

  const e = combat.enemy;
  const intent = combat.enemyIntent;
  let dmg = rollEnemyDamageWithIntent(e, intent);
  const pen = combat.enemyDamagePenalty;
  if (pen > 0) {
    dmg -= pen;
    combat.enemyDamagePenalty = 0;
    logLine(`Hexed guard — the blow lands softer (−${pen}).`, 'combat-tell combat-rider combat-rider--hex combat-flash');
  }
  const armor = combat.armorBonus;
  const permArmor = getPermanentArmorBonus();
  dmg -= permArmor;
  dmg -= armor;
  if (intent === 'heavy' && armor >= 5) {
    dmg -= 2;
    logLine('Your guard absorbs the worst of the blow!', 'combat-rider combat-rider--guard combat-flash');
  }
  combat.armorBonus = 0;
  if (dmg < 1) dmg = 1;

  const alive = PARTY.map((p, i) => ({ p, i })).filter(({ p }) => p.hp > 0);
  if (alive.length === 0) {
    logLine('The party has fallen…');
    playCombatClash();
    endCombat(false);
    return;
  }

  let targetEntry = null;
  if (combat.typeKey === 'shadow') {
    // Hard mode enemy: hunts the weakest member (ignores taunt).
    targetEntry = alive.reduce((best, cur) => (cur.p.hp < best.p.hp ? cur : best), alive[0]);
    logLine(`${e.name} slithers toward the weakest heartbeat…`, 'combat-tell combat-rider combat-rider--shadow combat-flash');
    combat.tauntPartyIndex = null;
  } else {
    const tauntI = combat.tauntPartyIndex;
    combat.tauntPartyIndex = null;
    if (tauntI != null && Math.random() < TAUNT_HIT_CHANCE) {
      const tp = PARTY[tauntI];
      if (tp && tp.hp > 0) {
        targetEntry = { p: tp, i: tauntI };
        logLine(`${e.name} lunges at the one who pressed the attack!`, 'combat-tell');
      }
    }
    if (!targetEntry) {
      targetEntry = alive[Math.floor(Math.random() * alive.length)];
    }
  }
  const { p: target } = targetEntry;
  target.hp = Math.max(0, target.hp - dmg);
  const intentTag = intent === 'heavy' ? ' (heavy)' : intent === 'quick' ? ' (quick)' : '';
  logLine(`${e.name} strikes ${target.name} for ${dmg} damage${intentTag}.`);
  fxShake(Math.min(18, 6 + Math.floor(dmg * 0.55)));
  playCombatSwing();
  renderParty();

  if (PARTY.every((p) => p.hp <= 0)) {
    logLine('Defeat.');
    endCombat(false);
    return;
  }

  if (combat.spellCooldown > 0) combat.spellCooldown -= 1;

  rollAndLogNextIntent();

  combat.waiting = false;
  setCombatButtonsEnabled(true);
  notifyRender();
}

function scheduleEnemyTurn() {
  combat.waiting = true;
  setCombatButtonsEnabled(false);
  queueMicrotask(() => enemyTurn());
}

function getStriker() {
  if (!combat) return null;
  let i = combat.strikerIndex;
  if (!PARTY[i] || PARTY[i].hp <= 0) {
    i = firstLivingPartyIndex();
    combat.strikerIndex = i;
  }
  return PARTY[i];
}

export function combatPlayerAttack() {
  if (!combat || combat.waiting) return;
  const striker = getStriker();
  if (!striker || striker.hp <= 0) return;
  const idx = combat.strikerIndex;
  const dmg = rollPlayerAttackDamage(striker);
  combat.enemy.hp -= dmg;
  combat.armorBonus = 0;

  const cls = striker.class;
  const rider = [];
  let riderClass = '';
  if (cls === 'Fighter') {
    combat.tauntPartyIndex = idx;
    rider.push('The foe turns on them!');
    riderClass = 'combat-rider combat-rider--taunt';
  } else {
    combat.tauntPartyIndex = null;
  }
  if (cls === 'Wizard') {
    combat.enemyDamagePenalty = 3;
    rider.push('Arcane hex weakens the next enemy swing (−3).');
    riderClass = 'combat-rider combat-rider--hex';
  }
  if (cls === 'Paladin') {
    combat.enemyDamagePenalty = 2;
    rider.push('Divine pressure rattles the foe (−2 next hit).');
    riderClass = 'combat-rider combat-rider--pressure';
  }
  let clericHealed = false;
  if (cls === 'Cleric') {
    const h = healLowestInjured(2);
    if (h) {
      rider.push(`${h.name} catches +${h.amount} HP from the blessing.`);
      clericHealed = true;
      riderClass = 'combat-rider combat-rider--bless';
    }
  }

  const main = `${striker.name} strikes for ${dmg} damage.`;
  logLine(rider.length ? `${main} ${rider.join(' ')}` : main, rider.length ? `${riderClass} combat-flash` : '');
  fxShake(5);
  playCombatHit();
  syncEnemyUi();
  if (clericHealed) renderParty();

  if (combat.enemy.hp <= 0) {
    scheduleVictoryAfterKill(`${combat.enemy.name} is defeated!`);
    return;
  }
  notifyRender();
  scheduleEnemyTurn();
}

export function combatPlayerDefend() {
  if (!combat || combat.waiting) return;
  combat.armorBonus = 5;
  logLine('The party raises shields and guards (+5 vs next hit; +2 more vs a heavy swing).');
  playCombatClash();
  notifyRender();
  scheduleEnemyTurn();
}

export function combatPlayerSpell() {
  if (!combat || combat.waiting) return;
  if (combat.spellCooldown > 0) return;

  const living = PARTY.filter((p) => p.hp > 0);
  const hurt = living.filter((p) => p.hp < p.maxHp);
  if (hurt.length > 0) {
    let target = hurt[0];
    let bestR = target.hp / target.maxHp;
    for (const p of hurt) {
      const r = p.hp / p.maxHp;
      if (r < bestR) {
        bestR = r;
        target = p;
      }
    }
    const heal = 10;
    target.hp = Math.min(target.maxHp, target.hp + heal);
    logLine(`Healing light washes over ${target.name} (+${heal} HP).`);
    renderParty();
  } else {
    const smite = roll([5, 9]);
    combat.enemy.hp -= smite;
    logLine(`Arcane bolt for ${smite} damage!`);
    fxShake(4);
    syncEnemyUi();
    if (combat.enemy.hp <= 0) {
      scheduleVictoryAfterKill(`${combat.enemy.name} is unmade!`);
      return;
    }
  }
  combat.spellCooldown = SPELL_COOLDOWN_ENEMY_TURNS;
  syncSpellButtonLabel();
  playCombatHit();
  notifyRender();
  scheduleEnemyTurn();
}

export function combatPlayerPotion() {
  if (!combat || combat.waiting) return;
  if (getPotionCount() <= 0 || !partyNeedsRestHeal()) return;
  if (!tryConsumePotion()) return;
  combat.armorBonus = 0;
  const h = healLowestInjured(14);
  logLine(
    h
      ? `${h.name} drinks a potion (+${h.amount} HP).`
      : 'The potion fizzes — no one needed it.',
  );
  playCombatHit();
  renderParty();
  notifyRender();
  scheduleEnemyTurn();
}

export function combatPlayerScroll() {
  if (!combat || combat.waiting) return;
  if (getScrollCount() <= 0) return;
  if (!tryConsumeScroll()) return;
  combat.armorBonus = 0;
  const dead = PARTY.filter((p) => p.hp <= 0);
  if (dead.length > 0) {
    // Resurrection scroll use: revive one fallen ally (no extra UI needed).
    const target = dead[0];
    const restored = Math.max(1, Math.ceil(target.maxHp * 0.5));
    target.hp = restored;
    logLine(`The scroll flares — ${target.name} rises with ${restored} HP!`);
    fxShake(5);
    playCombatHit();
    renderParty();
  } else {
    // Offensive use: burn the scroll for big damage (decision: save it for insurance or spend it now).
    const dmg = roll([11, 20]);
    combat.enemy.hp -= dmg;
    logLine(`The scroll detonates — ${dmg} searing damage!`);
    fxShake(7);
    playCombatHit();
    syncEnemyUi();

    if (combat.enemy.hp <= 0) {
      scheduleVictoryAfterKill(`${combat.enemy.name} is undone by the blast!`);
      return;
    }
  }
  notifyRender();
  scheduleEnemyTurn();
}

/** Keyboard shortcuts 1–5 during combat (letters stay for dungeon when not fighting). */
export function combatHandleKey(key) {
  if (!combat || combat.waiting) return false;
  if (key === '1') {
    combatPlayerAttack();
    return true;
  }
  if (key === '2') {
    combatPlayerDefend();
    return true;
  }
  if (key === '3') {
    if (combat.spellCooldown > 0) return true;
    combatPlayerSpell();
    return true;
  }
  if (key === '4') {
    combatPlayerPotion();
    return true;
  }
  if (key === '5') {
    combatPlayerScroll();
    return true;
  }
  return false;
}

function setCombatStriker(index) {
  if (!combat || combat.waiting) return;
  const ch = PARTY[index];
  if (!ch || ch.hp <= 0) return;
  combat.strikerIndex = index;
  syncStrikerRow();
  notifyRender();
}

/**
 * Start combat if this tile has an uncleared encounter.
 * @returns {boolean} true if combat started (caller should re-render)
 */
export function tryStartEncounterAt(ix, iy) {
  const type = getEncounterTypeAt(ix, iy);
  if (!type) return false;
  const def = ENCOUNTER_TYPES[type];
  if (!def) return false;

  combat = {
    ix,
    iy,
    typeKey: type,
    enemy: { name: def.name, maxHp: def.maxHp, hp: def.maxHp, atk: def.atk.slice() },
    armorBonus: 0,
    waiting: false,
    strikerIndex: firstLivingPartyIndex(),
    spellCooldown: 0,
    enemyIntent: rollEnemyIntentType(type),
    tauntPartyIndex: null,
    enemyDamagePenalty: 0,
  };

  showOverlay();
  logLine(`Ambush! ${def.name} bars the way.`);
  logLine(telegraphLine(combat.enemy.name, combat.enemyIntent), 'combat-tell');
  syncEnemyUi();
  syncStrikerRow();
  setCombatButtonsEnabled(true);
  return true;
}

export function initCombatUi() {
  overlayEl = document.getElementById('combat-overlay');
  logEl = document.getElementById('combat-log');
  enemyNameEl = document.getElementById('combat-enemy-name');
  enemyHpBarEl = document.getElementById('combat-enemy-hp-bar');
  enemyHpTextEl = document.getElementById('combat-enemy-hp-text');
  btnAttack = document.getElementById('combat-btn-attack');
  btnDefend = document.getElementById('combat-btn-defend');
  btnSpell = document.getElementById('combat-btn-spell');
  btnPotion = document.getElementById('combat-btn-potion');
  btnScroll = document.getElementById('combat-btn-scroll');
  strikerRowEl = document.getElementById('combat-striker-row');
  strikerBtns = [];

  if (strikerRowEl) {
    strikerRowEl.innerHTML = '';
    PARTY.forEach((ch, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'combat-striker-btn';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => setCombatStriker(i));
      strikerRowEl.appendChild(b);
      strikerBtns.push(b);
    });
  }

  if (btnAttack) btnAttack.addEventListener('click', () => combatPlayerAttack());
  if (btnDefend) btnDefend.addEventListener('click', () => combatPlayerDefend());
  if (btnSpell) btnSpell.addEventListener('click', () => combatPlayerSpell());
  if (btnPotion) btnPotion.addEventListener('click', () => combatPlayerPotion());
  if (btnScroll) btnScroll.addEventListener('click', () => combatPlayerScroll());

  hideOverlay();
}
