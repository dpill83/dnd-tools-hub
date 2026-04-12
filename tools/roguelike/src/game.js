import { CellType, H, ItemType, W } from './constants.js';
import { initPlayer, makeGold, makeMonster, makePotion, makeShield, makeSword, makeTrap } from './entities.js';
import { computeFov } from './fov.js';
import { generateLevel, randomFloorCell } from './mapgen.js';
import { renderToElement } from './render.js';
import { idxOf, inBounds, rnd } from './util.js';
import { bindAudioToggle, playSfx, setupAudioUnlock } from './audio.js';

function makeState() {
  const gridType = new Uint8Array(W * H);
  const gridVisible = new Uint8Array(W * H);
  const gridSeen = new Uint8Array(W * H);

  return {
    gridType,
    gridVisible,
    gridSeen,

    player: initPlayer(),
    monsters: [],
    items: [],
    monsterAt: new Int16Array(W * H),
    itemAt: new Int16Array(W * H),

    floor: 1,
    gameOver: false,
    won: false,
    /** @type {'story' | 'endless'} */
    runMode: 'story',

    log: [],
  };
}

function resetLookupTables(state) {
  state.monsterAt.fill(-1);
  state.itemAt.fill(-1);
  for (let i = 0; i < state.monsters.length; i++) {
    const m = state.monsters[i];
    state.monsterAt[idxOf(m.x, m.y, W)] = i;
  }
  for (let i = 0; i < state.items.length; i++) {
    const it = state.items[i];
    state.itemAt[idxOf(it.x, it.y, W)] = i;
  }
}

function setLogHtml(state) {
  const el = document.getElementById('log-text');
  if (!el) return;
  el.innerHTML = state.log
    .slice(0, 3)
    .map((l) => `<span class="${l.cls || ''}">${l.msg}</span>`)
    .join(' &nbsp; ');
}

function addLog(state, msg, cls) {
  state.log.unshift({ msg, cls });
  if (state.log.length > 5) state.log.pop();
  setLogHtml(state);
}

function updateStats(state) {
  document.getElementById('s-hp').textContent = `${state.player.hp}/${state.player.maxHp}`;
  document.getElementById('s-atk').textContent = String(state.player.atk);
  document.getElementById('s-def').textContent = String(state.player.def);
  document.getElementById('s-lvl').textContent = String(state.player.level);
  document.getElementById('s-xp').textContent = String(state.player.xp);
  document.getElementById('s-gold').textContent = String(state.player.gold);
  document.getElementById('s-floor').textContent = String(state.floor);
}

function recomputeVisibility(state) {
  computeFov({
    player: state.player,
    gridType: state.gridType,
    gridVisible: state.gridVisible,
    gridSeen: state.gridSeen,
  });

  // Update monster "visible" flag for behavior parity.
  for (let i = 0; i < state.monsters.length; i++) {
    const m = state.monsters[i];
    m.visible = !!state.gridVisible[idxOf(m.x, m.y, W)];
  }
}

function cellBlocksMove(cellType) {
  return cellType === CellType.Wall || cellType === CellType.DoorClosed;
}

function generateAndPopulateLevel(state) {
  state.monsters = [];
  state.items = [];

  const { rooms, startPos } = generateLevel({
    floor: state.floor,
    gridType: state.gridType,
    gridVisible: state.gridVisible,
    gridSeen: state.gridSeen,
    runMode: state.runMode,
  });

  state.player.x = startPos.x;
  state.player.y = startPos.y;

  const numMonsters = 3 + state.floor + rnd(3);
  for (let i = 0; i < numMonsters; i++) {
    if (rooms.length < 2) break;
    const pos = randomFloorCell(rooms.slice(1), { avoid: startPos });
    state.monsters.push(makeMonster({ ...pos, floor: state.floor }));
  }

  const goldCount = 3 + rnd(4) + state.floor;
  for (let i = 0; i < goldCount; i++) {
    const pos = randomFloorCell(rooms, { avoid: startPos });
    state.items.push(makeGold({ ...pos, floor: state.floor }));
  }

  if (rnd(3) === 0) state.items.push(makePotion(randomFloorCell(rooms, { avoid: startPos })));
  if (rnd(4) === 0) state.items.push(makeSword(randomFloorCell(rooms, { avoid: startPos })));
  if (rnd(4) === 0) state.items.push(makeShield(randomFloorCell(rooms, { avoid: startPos })));

  // Content addition: traps.
  const trapCount = Math.max(0, Math.floor(state.floor / 2) - 1) + rnd(2);
  for (let i = 0; i < trapCount; i++) state.items.push(makeTrap({ ...randomFloorCell(rooms, { avoid: startPos }), floor: state.floor }));

  resetLookupTables(state);
  recomputeVisibility(state);
}

function autoPickupGold(state) {
  const pIdx = idxOf(state.player.x, state.player.y, W);
  const itIndex = state.itemAt[pIdx];
  if (itIndex === -1) return;
  const it = state.items[itIndex];
  if (it.type !== ItemType.Gold) return;

  state.player.gold += it.value;
  state.items.splice(itIndex, 1);
  addLog(state, `You find ${it.value} gold.`, 's-gold');
  playSfx('gold');
  resetLookupTables(state);
}

function triggerTrapIfPresent(state) {
  const pIdx = idxOf(state.player.x, state.player.y, W);
  const itIndex = state.itemAt[pIdx];
  if (itIndex === -1) return;
  const it = state.items[itIndex];
  if (it.type !== ItemType.Trap || it.revealed) return;

  it.revealed = true;
  state.player.hp -= it.dmg;
  addLog(state, `A trap snaps! You take ${it.dmg} damage.`, 'dead');
  playSfx('hurt');
  if (state.player.hp <= 0) {
    state.gameOver = true;
    addLog(state, 'You have died. Press R to restart.', 'dead');
    if (state.runMode === 'endless') addLog(state, `You reached floor ${state.floor}.`, 's-xp');
    playSfx('death');
  }
}

function checkLevelUp(state) {
  const needed = state.player.level * 15;
  if (state.player.xp >= needed) {
    playSfx('levelUp');
    state.player.level++;
    state.player.maxHp += 5;
    state.player.hp = state.player.maxHp;
    state.player.atk += 1;
    // Content/balance tweak: keep XP overflow rather than reset-to-0.
    state.player.xp -= needed;
    addLog(state, `LEVEL UP! Now level ${state.player.level}. +5 max HP, +1 ATK!`, 's-xp');
  }
}

function attackMonster(state, mx, my) {
  const mIdx = state.monsterAt[idxOf(mx, my, W)];
  if (mIdx === -1) return;
  const m = state.monsters[mIdx];

  const dmg = Math.max(1, state.player.atk + rnd(3) - m.def);
  m.hp -= dmg;
  if (m.hp <= 0) {
    playSfx('kill');
    state.player.xp += m.xp;
    const drop = rnd(4) === 0 ? Math.floor(m.xp / 2) : 0;
    if (drop > 0) state.items.push({ x: mx, y: my, type: ItemType.Gold, value: drop });
    state.monsters.splice(mIdx, 1);
    addLog(state, `You kill the ${m.name}! +${m.xp} XP.`, 's-xp');
    checkLevelUp(state);
    resetLookupTables(state);
  } else {
    playSfx('playerHit');
    addLog(state, `You hit ${m.name} for ${dmg}. (${m.hp} HP left)`);
  }
}

function applyEndOfTurnEffects(state) {
  if (state.player.poisonTurns > 0 && !state.gameOver) {
    state.player.poisonTurns--;
    state.player.hp -= 1;
    addLog(state, 'Poison burns your veins (-1 HP).', 'dead');
    playSfx('hurt');
    if (state.player.hp <= 0) {
      state.gameOver = true;
      addLog(state, 'You have died. Press R to restart.', 'dead');
      if (state.runMode === 'endless') addLog(state, `You reached floor ${state.floor}.`, 's-xp');
      playSfx('death');
    }
  }
}

function monsterTurns(state) {
  for (let i = 0; i < state.monsters.length; i++) {
    const m = state.monsters[i];

    if (!m.visible) {
      if (rnd(4) === 0) {
        const dirs = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];
        const d = dirs[rnd(4)];
        const nx = m.x + d[0];
        const ny = m.y + d[1];
        if (!inBounds(nx, ny, W, H)) continue;
        const t = state.gridType[idxOf(nx, ny, W)];
        if (t === CellType.Floor || t === CellType.DoorOpen) {
          const nIdx = idxOf(nx, ny, W);
          if (state.monsterAt[nIdx] === -1 && !(nx === state.player.x && ny === state.player.y)) {
            state.monsterAt[idxOf(m.x, m.y, W)] = -1;
            m.x = nx;
            m.y = ny;
            state.monsterAt[nIdx] = i;
          }
        }
      }
      continue;
    }

    const dx = Math.sign(state.player.x - m.x);
    const dy = Math.sign(state.player.y - m.y);
    const dist = Math.abs(state.player.x - m.x) + Math.abs(state.player.y - m.y);
    if (dist === 1) {
      const dmg = Math.max(0, m.atk + rnd(3) - state.player.def);
      state.player.hp -= dmg;
      if (dmg > 0) {
        addLog(state, `${m.name} hits you for ${dmg}!`, 'dead');
        playSfx('hurt');
      } else addLog(state, `${m.name} attacks but misses.`);

      if (m.poisonChance && dmg > 0 && Math.random() < m.poisonChance) {
        state.player.poisonTurns = Math.max(state.player.poisonTurns, 4);
        addLog(state, `The ${m.name}'s bite poisons you!`, 'dead');
      }

      if (state.player.hp <= 0) {
        state.gameOver = true;
        addLog(state, 'You have died. Press R to restart.', 'dead');
        if (state.runMode === 'endless') addLog(state, `You reached floor ${state.floor}.`, 's-xp');
        playSfx('death');
        return;
      }
    } else {
      const tryX1 = m.x + dx;
      const tryY1 = m.y;
      const tryX2 = m.x;
      const tryY2 = m.y + dy;

      const candidates = [
        { x: tryX1, y: tryY1 },
        { x: tryX2, y: tryY2 },
      ];

      for (const c of candidates) {
        if (!inBounds(c.x, c.y, W, H)) continue;
        const cIdx = idxOf(c.x, c.y, W);
        if (c.x === state.player.x && c.y === state.player.y) continue;
        if (state.monsterAt[cIdx] !== -1) continue;
        const t = state.gridType[cIdx];
        if (t !== CellType.Floor && t !== CellType.DoorOpen) continue;

        state.monsterAt[idxOf(m.x, m.y, W)] = -1;
        m.x = c.x;
        m.y = c.y;
        state.monsterAt[cIdx] = i;
        break;
      }
    }
  }
}

function tryMove(state, dx, dy) {
  if (state.gameOver) return;
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (!inBounds(nx, ny, W, H)) return;

  const nIdx = idxOf(nx, ny, W);
  const cellType = state.gridType[nIdx];
  if (cellType === CellType.DoorClosed) {
    // Content addition: doors. Opening costs a turn.
    state.gridType[nIdx] = CellType.DoorOpen;
    addLog(state, 'You open the door.');
    playSfx('door');
    monsterTurns(state);
    applyEndOfTurnEffects(state);
    recomputeVisibility(state);
    updateStats(state);
    return;
  }

  if (cellBlocksMove(cellType)) return;

  const mIdx = state.monsterAt[nIdx];
  if (mIdx !== -1) {
    attackMonster(state, nx, ny);
    monsterTurns(state);
    applyEndOfTurnEffects(state);
    recomputeVisibility(state);
    updateStats(state);
    return;
  }

  state.player.x = nx;
  state.player.y = ny;
  playSfx('move');
  autoPickupGold(state);
  triggerTrapIfPresent(state);
  if (!state.gameOver) {
    monsterTurns(state);
    applyEndOfTurnEffects(state);
  }
  recomputeVisibility(state);
  updateStats(state);
}

function grabItem(state) {
  const pIdx = idxOf(state.player.x, state.player.y, W);
  const itIndex = state.itemAt[pIdx];
  if (itIndex === -1) {
    addLog(state, 'Nothing here.');
    playSfx('noop');
    return;
  }
  const it = state.items[itIndex];

  if (it.type === ItemType.Gold) {
    state.player.gold += it.value;
    state.items.splice(itIndex, 1);
    addLog(state, `Picked up ${it.value} gold.`, 's-gold');
    playSfx('gold');
  } else if (it.type === ItemType.Potion) {
    const h = 5 + rnd(8);
    state.player.hp = Math.min(state.player.hp + h, state.player.maxHp);
    state.items.splice(itIndex, 1);
    addLog(state, `Potion restores ${h} HP!`, 's-hp');
    playSfx('item');
  } else if (it.type === ItemType.Sword) {
    state.player.atk += 2;
    state.items.splice(itIndex, 1);
    addLog(state, 'You grab a sword. +2 ATK!');
    playSfx('item');
  } else if (it.type === ItemType.Shield) {
    state.player.def += 1;
    state.items.splice(itIndex, 1);
    addLog(state, 'You find a shield. +1 DEF!');
    playSfx('item');
  } else if (it.type === ItemType.Trap) {
    // allow disarming once revealed
    if (!it.revealed) {
      addLog(state, 'You fumble around but find nothing.');
      playSfx('noop');
    } else {
      state.items.splice(itIndex, 1);
      addLog(state, 'You dismantle the trap.');
      playSfx('item');
    }
  }

  resetLookupTables(state);
  monsterTurns(state);
  applyEndOfTurnEffects(state);
  recomputeVisibility(state);
  updateStats(state);
}

/** Touch “Use”: stairs or amulet → descend; otherwise grab/pick up. */
function useInteract(state) {
  const t = state.gridType[idxOf(state.player.x, state.player.y, W)];
  if (t === CellType.Stairs || t === CellType.Amulet) {
    descend(state);
  } else {
    grabItem(state);
  }
}

function descend(state) {
  const t = state.gridType[idxOf(state.player.x, state.player.y, W)];
  if (t === CellType.Amulet) {
    state.won = true;
    state.gameOver = true;
    addLog(state, 'You seize the Amulet of Yendor! YOU WIN! Press R to restart.', 's-xp');
    playSfx('win');
    return;
  }
  if (t !== CellType.Stairs) {
    addLog(state, 'No stairs here.');
    playSfx('deny');
    return;
  }
  state.floor++;
  playSfx('descend');
  generateAndPopulateLevel(state);
  state.player.maxHp = Math.min(state.player.maxHp + 2, 50);
  state.player.hp = Math.min(state.player.hp + 4, state.player.maxHp);
  addLog(state, `Floor ${state.floor}. The darkness deepens...`);
  updateStats(state);
}

function setHelpVisible(visible) {
  const help = document.getElementById('rogue-help');
  if (!help) return;
  help.hidden = !visible;
  const wrap = document.getElementById('rogue-wrap');
  if (visible) document.getElementById('rogue-help-close')?.focus();
  else wrap?.focus();
}

function setGameMenuVisible(visible) {
  const menu = document.getElementById('rogue-game-menu');
  if (!menu) return;
  menu.hidden = !visible;
  const wrap = document.getElementById('rogue-wrap');
  if (visible) document.getElementById('rogue-game-menu-close')?.focus();
  else wrap?.focus();
}

function startGame(state) {
  state.player = initPlayer();
  state.floor = 1;
  state.gameOver = false;
  state.won = false;
  state.log = [];
  if (state.runMode === 'endless') {
    addLog(state, 'Endless — descend as deep as you can. Death ends the run.');
  } else {
    addLog(state, 'You descend into the dungeon. Find the Amulet of Yendor on floor 5!');
  }
  generateAndPopulateLevel(state);
  updateStats(state);
}

function main() {
  const wrap = document.getElementById('rogue-wrap');
  const canvas = document.getElementById('rogue-canvas');
  if (!wrap || !canvas) return;

  setupAudioUnlock();
  bindAudioToggle();

  const state = makeState();
  const urlMode = new URLSearchParams(window.location.search).get('mode');
  if (urlMode !== 'story' && urlMode !== 'endless') {
    window.location.replace(new URL('index.html', window.location.href).href);
    return;
  }
  state.runMode = urlMode;
  startGame(state);
  renderToElement(canvas, state);
  wrap.focus();

  document.getElementById('rogue-help-close')?.addEventListener('click', () => setHelpVisible(false));
  document.getElementById('rogue-help')?.addEventListener('click', (e) => {
    if (e.target?.id === 'rogue-help') setHelpVisible(false);
  });

  document.getElementById('rogue-game-menu')?.addEventListener('click', (e) => {
    if (e.target?.id === 'rogue-game-menu') setGameMenuVisible(false);
  });

  const render = () => renderToElement(canvas, state);

  const helpEl = () => document.getElementById('rogue-help');
  const helpOpen = () => {
    const h = helpEl();
    return !!(h && !h.hidden);
  };

  const menuEl = () => document.getElementById('rogue-game-menu');
  const menuOpen = () => {
    const m = menuEl();
    return !!(m && !m.hidden);
  };

  const blockedByOverlay = () => helpOpen() || menuOpen();

  const bindButton = (id, handler) => {
    const el = document.getElementById(id);
    if (!el) return;

    let lastPointerDownAt = 0;
    const run = (e, kind) => {
      if (e) e.preventDefault();
      wrap.focus();
      handler(kind);
    };

    el.addEventListener(
      'pointerdown',
      (e) => {
        lastPointerDownAt = performance.now();
        run(e, 'pointerdown');
      },
      { passive: false }
    );
    el.addEventListener('click', (e) => {
      // Avoid double-trigger when a click follows pointerdown.
      if (performance.now() - lastPointerDownAt < 500) {
        e.preventDefault();
        return;
      }
      run(e, 'click');
    });
  };

  /** Hold to repeat moves (same idea as holding a movement key on desktop). */
  const bindMoveHold = (id, dx, dy) => {
    const el = document.getElementById(id);
    if (!el) return;

    const REPEAT_MS = 115;
    const INITIAL_DELAY_MS = 340;
    let repeatTimer = 0;
    let initialDelayTimer = 0;
    let lastPointerDownAt = 0;
    let suppressClickUntil = 0;

    const clearTimers = () => {
      if (repeatTimer) {
        clearInterval(repeatTimer);
        repeatTimer = 0;
      }
      if (initialDelayTimer) {
        clearTimeout(initialDelayTimer);
        initialDelayTimer = 0;
      }
    };

    const tryStep = () => {
      if (blockedByOverlay() || state.gameOver) {
        clearTimers();
        return;
      }
      tryMove(state, dx, dy);
      render();
    };

    const endHold = () => {
      clearTimers();
      suppressClickUntil = performance.now() + 400;
    };

    el.addEventListener(
      'pointerdown',
      (e) => {
        e.preventDefault();
        lastPointerDownAt = performance.now();
        wrap.focus();
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        clearTimers();
        tryStep();
        initialDelayTimer = window.setTimeout(() => {
          initialDelayTimer = 0;
          repeatTimer = window.setInterval(tryStep, REPEAT_MS);
        }, INITIAL_DELAY_MS);
      },
      { passive: false }
    );

    el.addEventListener('pointerup', endHold);
    el.addEventListener('pointercancel', endHold);
    el.addEventListener('lostpointercapture', endHold);

    el.addEventListener('click', (e) => {
      if (performance.now() < suppressClickUntil) {
        e.preventDefault();
        return;
      }
      if (performance.now() - lastPointerDownAt < 500) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      wrap.focus();
      tryStep();
    });
  };

  const doWait = () => {
    playSfx('wait');
    monsterTurns(state);
    applyEndOfTurnEffects(state);
    recomputeVisibility(state);
    updateStats(state);
  };

  const toggleHelp = () => {
    setHelpVisible(helpEl()?.hidden ?? true);
  };

  // Touch controls (mobile-friendly); hold D-pad to repeat moves like keyboard repeat.
  bindMoveHold('btn-move-up', 0, -1);
  bindMoveHold('btn-move-down', 0, 1);
  bindMoveHold('btn-move-left', -1, 0);
  bindMoveHold('btn-move-right', 1, 0);
  bindButton('btn-act-use', () => {
    if (blockedByOverlay() || state.gameOver) return;
    useInteract(state);
    render();
  });
  bindButton('btn-act-wait', () => {
    if (blockedByOverlay() || state.gameOver) return;
    doWait();
    render();
  });
  bindButton('btn-act-menu', () => {
    setGameMenuVisible(!menuOpen());
  });
  bindButton('btn-menu-help', () => {
    setGameMenuVisible(false);
    toggleHelp();
  });
  bindButton('btn-menu-restart', () => {
    setGameMenuVisible(false);
    startGame(state);
    render();
  });
  bindButton('rogue-game-menu-close', () => {
    setGameMenuVisible(false);
  });

  wrap.addEventListener('keydown', (e) => {
    const k = e.key;

    if (k === '?') {
      e.preventDefault();
      if (menuOpen()) setGameMenuVisible(false);
      toggleHelp();
      return;
    }

    if (menuOpen()) {
      if (k === 'Escape') {
        e.preventDefault();
        setGameMenuVisible(false);
      }
      return;
    }

    if (helpOpen()) {
      if (k === 'Escape') setHelpVisible(false);
      return;
    }

    if (state.gameOver) {
      if (k === 'r' || k === 'R') {
        startGame(state);
        render();
      }
      return;
    }

    const moves = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      w: [0, -1],
      s: [0, 1],
      a: [-1, 0],
      d: [1, 0],
      k: [0, -1],
      j: [0, 1],
      h: [-1, 0],
      l: [1, 0],
    };

    if (moves[k]) {
      e.preventDefault();
      tryMove(state, moves[k][0], moves[k][1]);
    } else if (k === 'g' || k === 'G') {
      e.preventDefault();
      grabItem(state);
    } else if (k === '>' || k === 'e' || k === 'E' || k === 'Enter') {
      e.preventDefault();
      descend(state);
    } else if (k === '.' || k === '5') {
      e.preventDefault();
      doWait();
    } else if (k === 'r' || k === 'R') {
      startGame(state);
    }

    render();
  });

  wrap.addEventListener('click', () => wrap.focus());
  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      render();
    });
  });
}

if (typeof document !== 'undefined') {
  main();
}

