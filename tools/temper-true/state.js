// ── STATE ──────────────────────────────────────────────────────────────────
const STATE_KEY = 'temper_true_state';

const defaultState = {
  currentScene: 0,
  currentBeat: 0,
  tags: {
    narrative: null,       // 'clean' | 'sour' | null
    trust: 'neutral',      // 'up' | 'neutral'
    letter: false,
    lot: null,             // 'clean' | 'shortcut' | null
    credit: false,
  },
  clues: { a: false, b: false, c: false },
  session: 1,
  choices: {},             // sceneId -> choiceIndex made
  sessionEnded: false,
};

let state = loadState();

function loadState() {
  try {
    const saved = localStorage.getItem(STATE_KEY);
    return saved ? { ...defaultState, ...JSON.parse(saved) } : { ...defaultState };
  } catch { return { ...defaultState }; }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function resetState() {
  state = { ...defaultState };
  localStorage.removeItem(STATE_KEY);
}

// ── DC MODIFIER based on tags ─────────────────────────────────────────────
function getDCMod() {
  let mod = 0;
  if (state.tags.narrative === 'sour') mod += 2;
  if (state.tags.trust === 'up') mod -= 1;
  if (state.tags.letter) mod -= 1; // Wessalen letter helps
  return mod;
}
