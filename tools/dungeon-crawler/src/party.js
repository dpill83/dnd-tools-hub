/** strikerLabel: short hint for combat UI (damage profile + rider effect). */
export const PARTY = [
  {
    name: 'Sirpetez',
    class: 'Fighter',
    hp: 32,
    maxHp: 32,
    color: '#8b6914',
    strikerLabel: 'Heavy · taunt',
  },
  {
    name: 'Sir Robin',
    class: 'Paladin',
    hp: 28,
    maxHp: 28,
    color: '#4a7c9e',
    strikerLabel: 'Solid · −foe dmg',
  },
  {
    name: 'Zuzzu',
    class: 'Cleric',
    hp: 24,
    maxHp: 24,
    color: '#6b4f8b',
    strikerLabel: 'Balanced · bless',
  },
  {
    name: 'Ganjalf',
    class: 'Wizard',
    hp: 18,
    maxHp: 18,
    color: '#2a6b4a',
    strikerLabel: 'Light · hex',
  },
];

// Keep a stable baseline so run-start reset can restore progression mutations.
PARTY.forEach((p) => {
  p.baseMaxHp = p.maxHp;
});

const PORTRAIT = 48;

function drawPortrait(canvas, accent) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const skin = '#c4a574';
  const hair = accent;
  ctx.fillStyle = '#1a1510';
  ctx.fillRect(0, 0, PORTRAIT, PORTRAIT);
  ctx.fillStyle = hair;
  ctx.fillRect(10, 6, 28, 14);
  ctx.fillStyle = skin;
  ctx.fillRect(12, 16, 24, 22);
  ctx.fillStyle = '#2a2420';
  ctx.fillRect(16, 26, 4, 4);
  ctx.fillRect(28, 26, 4, 4);
  ctx.fillStyle = '#8b6914';
  ctx.fillRect(20, 34, 8, 3);
}

/** @param {HTMLElement} root */
export function initParty(root) {
  root.innerHTML = '';
  PARTY.forEach((ch, i) => {
    const card = document.createElement('div');
    card.className = 'party-card';
    card.dataset.index = String(i);

    const portrait = document.createElement('canvas');
    portrait.width = PORTRAIT;
    portrait.height = PORTRAIT;
    portrait.className = 'party-portrait';
    drawPortrait(portrait, ch.color);

    const meta = document.createElement('div');
    meta.className = 'party-meta';
    meta.innerHTML = `
      <div class="party-name">${ch.name}</div>
      <div class="party-class">${ch.class}</div>
      <div class="party-hp-wrap">
        <div class="party-hp-bar" data-hp-bar></div>
      </div>
      <div class="party-hp-text" data-hp-text></div>
    `;

    card.appendChild(portrait);
    card.appendChild(meta);
    root.appendChild(card);
  });
  renderParty();
}

export function renderParty() {
  const cards = document.querySelectorAll('.party-card');
  cards.forEach((card, i) => {
    const ch = PARTY[i];
    if (!ch) return;
    const bar = card.querySelector('[data-hp-bar]');
    const text = card.querySelector('[data-hp-text]');
    const pct = Math.max(0, (ch.hp / ch.maxHp) * 100);
    if (bar) bar.style.width = `${pct}%`;
    if (text) text.textContent = `HP ${ch.hp}/${ch.maxHp}`;
    card.classList.toggle('party-low-hp', ch.hp / ch.maxHp < 0.25);
  });
}

/**
 * Heal the living ally with the lowest current HP (among those below max).
 * @returns {{ name: string, amount: number } | null}
 */
export function healLowestInjured(amount) {
  const injured = PARTY.filter((p) => p.hp > 0 && p.hp < p.maxHp);
  if (!injured.length || amount <= 0) return null;
  injured.sort((a, b) => a.hp - b.hp);
  const t = injured[0];
  const before = t.hp;
  t.hp = Math.min(t.maxHp, t.hp + amount);
  const gained = t.hp - before;
  if (gained <= 0) return null;
  return { name: t.name, amount: gained };
}

export function partyNeedsRestHeal() {
  return PARTY.some((p) => p.hp > 0 && p.hp < p.maxHp);
}

/** Each living ally regains half of missing HP (rounded up). Returns total HP restored. */
export function applyShortRestHeal() {
  let total = 0;
  for (const p of PARTY) {
    if (p.hp <= 0) continue;
    if (p.hp >= p.maxHp) continue;
    const missing = p.maxHp - p.hp;
    const gain = Math.ceil(missing * 0.5);
    p.hp = Math.min(p.maxHp, p.hp + gain);
    total += gain;
  }
  return total;
}

export function resetPartyForRun() {
  PARTY.forEach((p) => {
    // Reset progression mutations back to the baseline max HP.
    p.maxHp = p.baseMaxHp;
    p.hp = p.maxHp;
  });
}
