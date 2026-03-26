export function createInitialState() {
  return {
    room: 'drain',
    inventory: [],
    hp: 12,
    maxHp: 12,
    lanternOil: 100,
    lanternLit: true,
    turnCount: 0,
    flags: {
      ratsDead: false,
      otyughDead: false,
      thiefDead: false,
      thiefFled: false,
      letterRead: false,
      letterPocketed: false,
      gateReached: false,
      whistleUsed: false,
      torchLit: false,
      crowbarUsed: false,
      gameOver: false,
      won: false,
    },
    world: {
      roomItems: {},
    },
    visited: [],
  };
}

export function cloneState(state) {
  return structuredClone(state);
}

export function makeVisitedSet(state) {
  return new Set(state.visited || []);
}

export function syncVisitedArray(state, visitedSet) {
  state.visited = Array.from(visitedSet);
}
