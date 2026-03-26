const STORAGE_KEY = 'waterdeepTextAdventure:v1';

export function saveGame(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasSave() {
  return localStorage.getItem(STORAGE_KEY) != null;
}

