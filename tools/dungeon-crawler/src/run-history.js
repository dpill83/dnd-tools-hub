const STORAGE_KEY = 'dndc_run_history_v1';

/**
 * @typedef {{
 *   bestTurns: number | null,
 *   bestTimeMs: number | null
 *   topTurns?: LeaderEntry[],
 *   topSteps?: LeaderEntry[]
 * }} BestWinStats
 */

/**
 * @typedef {{
 *   turns: number,
 *   steps: number,
 *   timeMs: number,
 *   seed?: number,
 *   hardMode?: boolean
 * }} LeaderEntry
 */

function safeLoad() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bestTurns: null, bestTimeMs: null, topTurns: [], topSteps: [] };
    const parsed = JSON.parse(raw);
    return {
      bestTurns: typeof parsed?.bestTurns === 'number' ? parsed.bestTurns : null,
      bestTimeMs: typeof parsed?.bestTimeMs === 'number' ? parsed.bestTimeMs : null,
      topTurns: Array.isArray(parsed?.topTurns) ? parsed.topTurns : [],
      topSteps: Array.isArray(parsed?.topSteps) ? parsed.topSteps : [],
    };
  } catch {
    return { bestTurns: null, bestTimeMs: null, topTurns: [], topSteps: [] };
  }
}

function safeSave(stats) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore: private mode / storage blocked.
  }
}

function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/**
 * @returns {BestWinStats}
 */
export function getBestWinStats() {
  return safeLoad();
}

/**
 * Records a completed run. Only victories count as “best wins”.
 *
 * @param {{
 *   victory: boolean,
 *   turnCount: number,
 *   stepCount: number,
 *   timeMs: number
 * }} run
 */
export function recordRun(run) {
  if (!run?.victory) return;
  if (!Number.isFinite(run.turnCount) || !Number.isFinite(run.timeMs)) return;
  const stats = safeLoad();

  const next = { ...stats };
  if (next.bestTurns === null || run.turnCount < next.bestTurns) {
    next.bestTurns = run.turnCount;
  }
  if (next.bestTimeMs === null || run.timeMs < next.bestTimeMs) {
    next.bestTimeMs = run.timeMs;
  }

  /** @type {LeaderEntry} */
  const entry = {
    turns: Math.floor(run.turnCount),
    steps: Math.floor(run.stepCount ?? 0),
    timeMs: Math.floor(run.timeMs),
    seed: Number.isFinite(run.seed) ? (run.seed >>> 0) : undefined,
    hardMode: !!run.hardMode,
  };

  const insertSorted = (arr, cmp) => {
    const a = Array.isArray(arr) ? arr.slice() : [];
    a.push(entry);
    a.sort(cmp);
    return a.slice(0, 5);
  };

  next.topTurns = insertSorted(next.topTurns, (a, b) => a.turns - b.turns || a.steps - b.steps || a.timeMs - b.timeMs);
  next.topSteps = insertSorted(next.topSteps, (a, b) => a.steps - b.steps || a.turns - b.turns || a.timeMs - b.timeMs);

  safeSave(next);
}

export { formatDurationMs };

