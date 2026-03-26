import { createInitialState, makeVisitedSet, syncVisitedArray } from './state.js';
import { createRooms } from './content/rooms.js';
import { items } from './content/items.js';
import { normalizeInput, splitVerbNoun, resolveItemFromNoun, resolveRoomItemFromNoun } from './commands.js';
import { saveGame, loadGame, clearSave, hasSave } from './storage.js';

export function createGame({ output, inputEl, enableDomEvents = true }) {
  let state = createInitialState();
  let rooms = null;
  let visited = makeVisitedSet(state);
  let mapCache = {};
  let autosaveTimer = null;
  let unknownCount = 0;

  const ctx = {
    get state() {
      return state;
    },
    items,
    getRoomItems(roomId) {
      return state.world.roomItems[roomId] || [];
    },
  };

  function initWorldFromContent() {
    rooms = createRooms();
    mapCache = {};
    state.world.roomItems = {};
    for (const [roomId, def] of Object.entries(rooms)) {
      state.world.roomItems[roomId] = Array.isArray(def.initialItems) ? [...def.initialItems] : [];
    }
  }

  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      if (state.flags.gameOver) return;
      syncVisitedArray(state, visited);
      saveGame({ state });
    }, 150);
  }

  // ─── ROOM ENTRY ───────────────────────────────────────────────────────────────
  function resolveLines(arr) {
    return arr
      .map((l) => (typeof l === 'function' ? l(ctx) : l))
      .filter((l) => l !== null && l !== undefined && String(l).trim() !== '');
  }

  function enterRoom(roomId) {
    state.room = roomId;
    const room = rooms[roomId];

    output.print('');
    output.print('--- ' + room.name + ' ---', 'label');

    const art = typeof room.art === 'function' ? room.art(ctx) : room.art;
    if (art) {
      const cached = mapCache[roomId] || art;
      output.printArt(cached);
    }
    output.print('');

    if (!visited.has(roomId)) {
      visited.add(roomId);
      resolveLines(room.first || []).forEach((l) => output.print(l));
    } else {
      resolveLines(room.look || []).forEach((l) => output.print(l));
    }

    output.print('');
  }

  // ─── LANTERN / TURN ──────────────────────────────────────────────────────────
  function tickTurn() {
    state.turnCount++;
    if (state.lanternLit) {
      state.lanternOil = Math.max(0, state.lanternOil - 2);
      if (state.lanternOil === 0) {
        state.lanternLit = false;
        output.print('Your lantern sputters and dies. The dark closes in.', 'warning');
      }
    }
  }

  function lightStatus() {
    if (!state.lanternLit) return 'Lantern: OUT';
    if (state.lanternOil >= 70) return 'Lantern: bright';
    if (state.lanternOil >= 30) return 'Lantern: dim';
    return 'Lantern: flickering';
  }

  function endGame() {
    state.flags.gameOver = true;
    inputEl.disabled = true;
  }

  // ─── COMBAT ──────────────────────────────────────────────────────────────────
  function doAttack() {
    if (state.room === 'junction' && !state.flags.ratsDead) {
      const hit = Math.random() < 0.7;
      if (hit) {
        state.flags.ratsDead = true;
        output.print('You swing hard. The rats scatter and the last one goes still.', 'success');
      } else {
        state.hp -= 2;
        output.print('You miss. Teeth find your calf. -2 HP', 'danger');
      }
      checkDeath();
      return;
    }

    if (state.room === 'deepchannel' && !state.flags.otyughDead) {
      const hit = Math.random() < 0.55;
      if (hit) {
        state.flags.otyughDead = true;
        output.print('Steel and stubbornness. The otyugh collapses into the filth.', 'success');
      } else {
        state.hp -= 4;
        output.print('A tentacle slams you into the wall. -4 HP', 'danger');
      }
      checkDeath();
      return;
    }

    if (state.room === 'stash' && !state.flags.thiefDead && !state.flags.thiefFled) {
      const hit = Math.random() < 0.6;
      if (hit) {
        state.flags.thiefDead = true;
        output.print('You move first. The thief drops without a sound.', 'success');
      } else {
        state.hp -= 3;
        output.print('The thief is faster. Pain blooms in your side. -3 HP', 'danger');
      }
      checkDeath();
      return;
    }

    output.print('There is nothing here to fight.');
  }

  function doFlee() {
    if (state.room === 'junction' && !state.flags.ratsDead) {
      output.print('You back away. The rats hiss but do not follow into the deeper water.', 'dim');
      enterRoom('tunnel');
      return;
    }

    if (state.room === 'deepchannel' && !state.flags.otyughDead) {
      output.print('You retreat, splashing hard. The otyugh lets you go.', 'dim');
      enterRoom('junction');
      return;
    }

    if (state.room === 'stash' && !state.flags.thiefDead && !state.flags.thiefFled) {
      state.flags.thiefFled = true;
      output.print('You step back fast. The thief vanishes into a side crack in the wall.', 'dim');
      enterRoom('deepchannel');
      return;
    }

    output.print('There is nothing to flee from.');
  }

  function checkDeath() {
    if (state.hp > 0) return;
    output.print('');
    output.print('You collapse in the dark. The sewer takes you.', 'danger');
    output.print('');
    output.print('  [ Refresh to play again ]', 'dim');
    endGame();
  }

  // ─── USE ─────────────────────────────────────────────────────────────────────
  function doUse(nounRaw) {
    const noun = String(nounRaw || '').trim().toLowerCase();
    const invKey = resolveItemFromNoun({ noun, inventoryKeys: state.inventory, items });

    if (!invKey) {
      if (noun === 'grate' || noun === 'ladder') {
        output.print('You cannot use that right now.');
        return;
      }
      output.print('You do not have that.');
      return;
    }

    if (invKey === 'ration') {
      if (state.hp >= state.maxHp) {
        output.print('You are not hungry. Or at least, you do not need it yet.', 'dim');
        return;
      }
      state.hp = Math.min(state.maxHp, state.hp + 3);
      output.print('You force down the hard ration. +3 HP', 'success');
      state.inventory = state.inventory.filter((k) => k !== 'ration');
      return;
    }

    if (invKey === 'letter') {
      state.flags.letterRead = true;
      output.print('');
      output.print('The letter is brief. Two names. A time. A gate.', 'warning');
      output.print('It smells like wax and lies.', 'warning');
      output.print('');
      output.print('You can POCKET it to keep it hidden.', 'dim');
      return;
    }

    if (invKey === 'torch') {
      state.flags.torchLit = true;
      output.print('You light the torch from your lantern. The shadows recoil.', 'success');
      return;
    }

    if (invKey === 'crowbar') {
      state.flags.crowbarUsed = true;
      output.print('You heft the crowbar. It feels honest in your hand.', 'dim');
      return;
    }

    if (invKey === 'whistle') {
      if (state.room !== 'drain') {
        output.print('You raise the whistle, then stop. You need the grate above you to matter.', 'dim');
        return;
      }
      if (state.flags.whistleUsed) {
        output.print('You already blew it. Now you need to get back here and wait for help.', 'dim');
        return;
      }
      state.flags.whistleUsed = true;
      output.print('You blow three sharp blasts. The sound climbs the shaft like a knife.', 'success');
      output.print('Now you have to survive long enough for someone to come.', 'warning');
      return;
    }

    output.print('Nothing happens.');
  }

  // ─── WIN ─────────────────────────────────────────────────────────────────────
  function triggerEscape() {
    state.flags.won = true;
    output.print('');
    output.print('A shadow crosses the grate above. Keys. Steel on steel.', 'success');
    output.print('A City Watch face peers down. Recognition. Relief.', 'success');
    output.print('He helps you up into the cold Waterdeep air.', 'success');
    output.print('');
    setTimeout(() => {
      output.print('YOU ESCAPED THE WATERDEEP SEWERS.', 'success');
      output.print('');
      output.print('  [ Refresh to play again ]', 'dim');
      endGame();
    }, 800);
  }

  // ─── COMMANDS ─────────────────────────────────────────────────────────────────
  function handle(raw) {
    const input = normalizeInput(raw);
    if (!input || state.flags.gameOver) return;

    output.echo(raw);
    tickTurn();
    if (state.flags.gameOver) return;

    const { verb: verbRaw, noun: nounRaw } = splitVerbNoun(input);
    const verb = verbRaw;
    const noun = nounRaw;

    function getExitDest(dir) {
      const exits = rooms[state.room].exits || {};
      const entry = exits[dir];
      if (!entry) return null;
      return typeof entry === 'function' ? entry(ctx) : entry;
    }

    // SAVE / LOAD
    if (verb === 'save') {
      syncVisitedArray(state, visited);
      saveGame({ state });
      output.print('Game saved.', 'success');
      scheduleAutosave();
      unknownCount = 0;
      return;
    }
    if (verb === 'load') {
      const loaded = loadGame();
      if (!loaded?.state) {
        output.print('No saved game found.', 'dim');
        unknownCount = 0;
        return;
      }
      state = loaded.state;
      if (!state.world || !state.world.roomItems) {
        state.world = { roomItems: {} };
        // Populate defaults so older saves still work.
        const freshRooms = createRooms();
        for (const [roomId, def] of Object.entries(freshRooms)) {
          state.world.roomItems[roomId] = Array.isArray(def.initialItems) ? [...def.initialItems] : [];
        }
      }
      visited = makeVisitedSet(state);
      rooms = createRooms();
      output.print('Game loaded.', 'success');
      enterRoom(state.room);
      unknownCount = 0;
      return;
    }
    if ((verb === 'clear' && noun === 'save') || input === 'clear save') {
      clearSave();
      output.print('Save cleared.', 'success');
      unknownCount = 0;
      return;
    }

    // ─ GO ─
    if (['go', 'move', 'walk', 'run', 'n', 's', 'e', 'w', 'north', 'south', 'east', 'west', 'up', 'climb', 'ladder'].includes(verb)) {
      const dirMap = { n: 'north', s: 'south', e: 'east', w: 'west', north: 'north', south: 'south', east: 'east', west: 'west', up: 'north', climb: 'north', ladder: 'north' };
      const dir = dirMap[verb] || dirMap[noun];
      if (!dir) {
        output.print('Which direction?');
        unknownCount = 0;
        return;
      }
      const dest = getExitDest(dir);
      if (dest) {
        if (dest === 'drain' && state.flags.whistleUsed && !state.flags.won) {
          enterRoom('drain');
          triggerEscape();
        } else {
          enterRoom(dest);
        }
      } else {
        output.print('You cannot go that way.');
      }
      scheduleAutosave();
      unknownCount = 0;
      return;
    }

    // ─ LOOK ─
    if (['look', 'l'].includes(verb) && !noun) {
      const room = rooms[state.room];
      output.print('');
      output.print('--- ' + room.name + ' ---', 'label');
      const art = typeof room.art === 'function' ? room.art(ctx) : room.art;
      if (art) {
        const cached = mapCache[state.room] || art;
        output.printArt(cached);
      }
      output.print('');
      resolveLines(room.look || []).forEach((l) => output.print(l));
      output.print('');
      unknownCount = 0;
      return;
    }

    // ─ EXAMINE ─
    if (['examine', 'x', 'inspect', 'read', 'look'].includes(verb) && noun) {
      const invKey = resolveItemFromNoun({ noun, inventoryKeys: state.inventory, items });
      if (invKey) {
        output.print(items[invKey]?.examine || 'Nothing more to learn from it.');
        if (invKey === 'letter' && !state.flags.letterRead) doUse('letter');
        scheduleAutosave();
        unknownCount = 0;
        return;
      }

      const worldExamine = {
        grate: 'Iron bars. Locked from the street side. You cannot open it from below without help.',
        ladder: 'Iron rungs hammered into the stone. They lead up to a surface grate.',
        crates: 'Wooden crates stamped with merchant marks. Mostly empty. Smuggled goods, long since moved.',
        maps: 'Routes through the sewer system, marked in red. Someone has been moving things through here for months.',
        channel: 'The water is black and moves slowly west. You do not want to know what is in it.',
        water: 'You do not want to know what is in it.',
        rats: state.flags.ratsDead ? 'Dead rats. Good.' : 'Big. Aggressive. Several of them.',
        otyugh: state.flags.otyughDead ? 'Dead. It takes up most of the cistern.' : 'A mass of rotting flesh, tentacles, and teeth. It feeds on waste. It is territorial.',
        thief: state.flags.thiefDead ? 'Dead. Shadow Thief, by the leathers.' : state.flags.thiefFled ? 'Gone.' : 'A Shadow Thief operative. Armed. Watching you.',
      };

      if (worldExamine[noun]) {
        output.print(worldExamine[noun]);
        unknownCount = 0;
        return;
      }

      output.print('You do not see that here.');
      unknownCount = 0;
      return;
    }

    // ─ TAKE ─
    if (['take', 'get', 'grab', 'pick'].includes(verb)) {
      const roomId = state.room;
      const roomItems = ctx.getRoomItems(roomId);
      const target = resolveRoomItemFromNoun({ noun, roomItemKeys: roomItems, items });

      if (target) {
        state.inventory.push(target);
        state.world.roomItems[roomId] = roomItems.filter((i) => i !== target);
        output.print('You take the ' + (items[target]?.name || target) + '.', 'success');
        if (target === 'letter') output.print('You should READ it.');
        scheduleAutosave();
        unknownCount = 0;
        return;
      }

      if (['grate', 'ladder', 'otyugh', 'thief', 'rats', 'crates', 'maps'].includes(noun)) {
        output.print('That is not something you can carry.');
        unknownCount = 0;
        return;
      }

      output.print('There is nothing like that to take.');
      unknownCount = 0;
      return;
    }

    // ─ INVENTORY ─
    if (['inventory', 'inv', 'i'].includes(verb)) {
      if (state.inventory.length === 0) {
        output.print('You carry nothing useful.');
      } else {
        output.print('You are carrying:');
        state.inventory.forEach((k) => output.print('  - ' + (items[k]?.name || k)));
      }
      output.print('HP: ' + state.hp + '/' + state.maxHp);
      output.print(lightStatus());
      unknownCount = 0;
      return;
    }

    // ─ ATTACK ─
    if (['attack', 'fight', 'kill', 'stab', 'hit', 'strike', 'slash'].includes(verb)) {
      doAttack();
      scheduleAutosave();
      unknownCount = 0;
      return;
    }

    // ─ FLEE ─
    if (['flee', 'escape', 'retreat', 'back'].includes(verb)) {
      doFlee();
      scheduleAutosave();
      unknownCount = 0;
      return;
    }

    // ─ USE ─
    if (['use', 'blow', 'light', 'eat', 'drink', 'read', 'open'].includes(verb)) {
      doUse(noun || verb);
      scheduleAutosave();
      unknownCount = 0;
      return;
    }

    // ─ POCKET ─
    if (['pocket', 'keep', 'hide'].includes(verb) && (noun === 'letter' || noun === 'wax-sealed letter')) {
      if (!state.inventory.includes('letter')) {
        output.print('You are not carrying the letter.');
        unknownCount = 0;
        return;
      }
      if (!state.flags.letterRead) {
        output.print('You should read it first.');
        unknownCount = 0;
        return;
      }
      state.flags.letterPocketed = true;
      output.print('You fold the letter and tuck it inside your coat.', 'success');
      output.print('This is evidence. Or leverage. You have not decided which.');
      scheduleAutosave();
      unknownCount = 0;
      return;
    }

    // ─ HELP ─
    if (['help', '?', 'h', 'commands'].includes(verb)) {
      output.print('');
      output.print('COMMANDS:', 'label');
      output.print('  LOOK              -- examine the room');
      output.print('  GO [direction]    -- north / south / east / west');
      output.print('  TAKE [item]       -- pick up an item');
      output.print('  EXAMINE [item]    -- look closely at something');
      output.print('  INVENTORY         -- check what you carry and your status');
      output.print('  ATTACK            -- fight whatever is here');
      output.print('  FLEE              -- try to back away from a fight');
      output.print('  USE [item]        -- use an item (whistle, torch, crowbar, ration)');
      output.print('  READ [item]       -- read the letter');
      output.print('  POCKET letter     -- keep the letter hidden on you');
      output.print('  SAVE              -- save the game');
      output.print('  LOAD              -- load the saved game');
      output.print('  CLEAR SAVE        -- delete the saved game');
      output.print('');
      unknownCount = 0;
      return;
    }

    // ─ FLAVOR ─
    if (['wait', 'rest'].includes(verb)) {
      const w = ['The sewer does not hurry for you.', 'Water drips. Something moves in the dark.', 'You wait. The smell does not improve.'];
      output.print(w[Math.floor(Math.random() * w.length)]);
      unknownCount = 0;
      return;
    }

    if (['listen', 'hear'].includes(verb)) {
      const s = {
        drain: 'The street above. Distant cart wheels. Voices.',
        tunnel: 'Your own breathing. The drip of water. Something scraping stone to the west.',
        collapse: 'Nothing. This section is dead.',
        junction: state.flags.ratsDead ? 'Quiet. Just the water.' : 'Squealing. Wet movement in the dark.',
        deepchannel: state.flags.otyughDead ? 'The body settling.' : 'Something large. Breathing through water.',
        stash: state.flags.thiefDead || state.flags.thiefFled ? 'Silence.' : 'The scrape of a blade being drawn.',
      };
      output.print(s[state.room] || 'Nothing useful.');
      unknownCount = 0;
      return;
    }

    if (['smell', 'sniff'].includes(verb)) {
      output.print('It smells like a sewer. Specifically, the worst part of a sewer.');
      unknownCount = 0;
      return;
    }

    unknownCount++;
    if (unknownCount >= 3) {
      output.print('That command does not work here. Type HELP for commands.', 'dim');
      unknownCount = 0;
    } else {
      const fallbacks = ['Nothing happens.', 'The sewer does not respond.', 'That is not something you can do here.', 'You try. Nothing comes of it.'];
      output.print(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
    }
  }

  // ─── INPUT + BOOT ─────────────────────────────────────────────────────────────
  function boot() {
    initWorldFromContent();

    const bootLines = [
      { text: 'DOWN IN THE DARK', cls: 'label', delay: 120 },
      { text: 'A Waterdeep Sewer Adventure', cls: 'dim', delay: 80 },
      { text: '──────────────────────────────', delay: 60 },
      { text: '', delay: 100 },
      { text: 'City Watch. Ward of North. Year of the Gauntlet.', cls: 'dim', delay: 60 },
      { text: '', delay: 300 },
      { text: '---', delay: 0 },
      { text: '', delay: 0 },
    ];

    bootLines.forEach((l) => output.enqueue([l]));
    const bootDuration = bootLines.reduce((a, b) => a + (b.delay ?? 40), 0) + 200;

    setTimeout(() => {
      // Try resume if a save exists
      if (hasSave()) {
        const loaded = loadGame();
        if (loaded?.state) {
          state = loaded.state;
          visited = makeVisitedSet(state);
          rooms = createRooms();
          output.print('Autosave restored.', 'dim', 0);
          enterRoom(state.room);
          return;
        }
      }

      state.inventory.push('whistle', 'badge', 'ration');
      enterRoom('drain');
      scheduleAutosave();
    }, bootDuration);
  }

  function wireInput() {
    const cmdHistory = [];
    let histIdx = -1;

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const raw = inputEl.value;
        if (raw.trim()) {
          cmdHistory.push(raw);
          histIdx = cmdHistory.length;
        }
        inputEl.value = '';
        handle(raw);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (histIdx > 0) {
          histIdx--;
          inputEl.value = cmdHistory[histIdx];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histIdx < cmdHistory.length - 1) {
          histIdx++;
          inputEl.value = cmdHistory[histIdx];
        } else {
          histIdx = cmdHistory.length;
          inputEl.value = '';
        }
      }
    });

    document.addEventListener('click', () => inputEl.focus());
  }

  if (enableDomEvents) wireInput();

  return { boot, handle };
}

