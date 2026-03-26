const ARTICLES = new Set(['the', 'a', 'an']);

export function normalizeInput(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return '';
  return s.replace(/\s+/g, ' ');
}

export function stripArticles(phrase) {
  const words = phrase.split(/\s+/g).filter(Boolean);
  while (words.length && ARTICLES.has(words[0])) words.shift();
  return words.join(' ');
}

export function splitVerbNoun(input) {
  const words = input.split(/\s+/);
  const verb = words[0] || '';
  const noun = stripArticles(words.slice(1).join(' '));
  return { verb, noun };
}

export function resolveItemFromNoun({ noun, inventoryKeys, items }) {
  if (!noun) return null;

  const n = noun.toLowerCase();
  for (const key of inventoryKeys) {
    if (key === n) return key;
    const def = items[key];
    if (!def) continue;
    if ((def.name || '').toLowerCase() === n) return key;
    if (Array.isArray(def.aliases) && def.aliases.some((a) => a.toLowerCase() === n)) return key;
  }
  return null;
}

export function resolveRoomItemFromNoun({ noun, roomItemKeys, items }) {
  if (!noun) return null;
  const n = noun.toLowerCase();
  return (
    roomItemKeys.find((k) => k === n) ||
    roomItemKeys.find((k) => (items[k]?.name || '').toLowerCase() === n) ||
    roomItemKeys.find((k) => Array.isArray(items[k]?.aliases) && items[k].aliases.some((a) => a.toLowerCase() === n)) ||
    null
  );
}

