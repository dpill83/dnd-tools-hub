import { COLS, ItemType } from './constants.js';
import { rnd } from './util.js';

export function initPlayer() {
  return {
    x: 0,
    y: 0,
    hp: 15,
    maxHp: 15,
    atk: 3,
    def: 0,
    level: 1,
    xp: 0,
    gold: 0,
    poisonTurns: 0,
  };
}

export function monsterTypes() {
  return [
    { g: 'r', name: 'rat', hp: 3, atk: 1, def: 0, xp: 2, color: COLS.rat, poisonChance: 0.15 },
    { g: 'g', name: 'goblin', hp: 5, atk: 2, def: 0, xp: 5, color: COLS.goblin, poisonChance: 0 },
    { g: 'o', name: 'orc', hp: 10, atk: 3, def: 1, xp: 10, color: COLS.orc, poisonChance: 0 },
    { g: 'T', name: 'troll', hp: 18, atk: 5, def: 2, xp: 20, color: COLS.troll, poisonChance: 0 },
    { g: 'D', name: 'dragon', hp: 30, atk: 8, def: 3, xp: 50, color: COLS.dragon, poisonChance: 0 },
  ];
}

export function makeMonster({ x, y, floor }) {
  const types = monsterTypes();
  const tier = Math.min(Math.floor(floor / 2) + rnd(2), types.length - 1);
  const mt = types[tier];
  return { x, y, ...mt, maxHp: mt.hp, visible: false };
}

export function makeGold({ x, y, floor }) {
  return { x, y, type: ItemType.Gold, value: 5 + rnd(20) + floor * 3 };
}

export function makePotion({ x, y }) {
  return { x, y, type: ItemType.Potion };
}

export function makeSword({ x, y }) {
  return { x, y, type: ItemType.Sword };
}

export function makeShield({ x, y }) {
  return { x, y, type: ItemType.Shield };
}

export function makeTrap({ x, y, floor }) {
  return { x, y, type: ItemType.Trap, revealed: false, dmg: 2 + rnd(3) + Math.floor(floor / 2) };
}

