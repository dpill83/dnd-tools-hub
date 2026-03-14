/**
 * Reads Hansi Loot Table - Items.csv and writes data/hansi-loot.json.
 * Run from repo root: node tools/party-loot-ledger/scripts/csv-to-hansi-loot.js
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'Hansi Loot Table - Items.csv');
const OUT_PATH = path.join(__dirname, '..', 'data', 'hansi-loot.json');

const RARITY_TEXT_TO_TIER = { Mundane: 0, Common: 1, Uncommon: 2, Rare: 3, 'Very Rare': 4, Legendary: 5 };

function parseCSVRows(raw) {
  const rows = [];
  let i = 0;
  while (i < raw.length) {
    const row = [];
    while (i < raw.length) {
      if (raw[i] === '"') {
        let end = i + 1;
        while (end < raw.length) {
          const next = raw.indexOf('"', end);
          if (next === -1) break;
          if (raw[next + 1] === '"') {
            end = next + 2;
            continue;
          }
          end = next;
          break;
        }
        row.push(raw.slice(i + 1, end).replace(/""/g, '"').trim());
        i = end + 1;
        if (raw[i] === ',') {
          i++;
        } else if (raw[i] === '\r' || raw[i] === '\n' || i >= raw.length) {
          break;
        }
        continue;
      }
      const nextComma = raw.indexOf(',', i);
      const nextNewline = raw.indexOf('\n', i);
      const nextCr = raw.indexOf('\r', i);
      let end = nextComma;
      if (nextNewline !== -1 && (end === -1 || nextNewline < end)) end = nextNewline;
      if (nextCr !== -1 && (end === -1 || nextCr < end)) end = nextCr;
      if (end === -1) end = raw.length;
      row.push(raw.slice(i, end).trim());
      i = end;
      if (raw[i] === ',') {
        i++;
      } else {
        if (raw[i] === '\r') i++;
        if (raw[i] === '\n') i++;
        break;
      }
    }
    if (row.some(cell => cell.length > 0)) rows.push(row);
  }
  return rows;
}

function parseValue(str) {
  if (!str || typeof str !== 'string') return 0;
  const cleaned = str.replace(/\s*gp\s*$/i, '').replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function rarityToTier(rarityNumStr, rarityText) {
  const n = parseInt(rarityNumStr, 10);
  if (!isNaN(n)) {
    if (n <= 5) return n - 1;
    return 5;
  }
  const t = RARITY_TEXT_TO_TIER[rarityText && rarityText.trim()];
  return typeof t === 'number' ? t : 0;
}

function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSVRows(raw);
  const header = rows[0] || [];
  const itemIdx = header.indexOf('Item');
  const descIdx = header.indexOf('Description');
  const valueIdx = header.indexOf('Est. Value');
  const rarityIdx = header.indexOf('Rarity');
  const categoryIdx = header.indexOf('Category');
  const rarityNumIdx = header.indexOf('Rarity Number');
  const authorIdx = header.indexOf('Author');

  const items = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = (row[itemIdx] || '').trim();
    if (!name) continue;
    const description = (row[descIdx] || '').trim();
    const val = parseValue(row[valueIdx]);
    const category = (row[categoryIdx] || '').trim() || 'Treasure';
    const tier = rarityToTier(row[rarityNumIdx], row[rarityIdx]);
    const author = (row[authorIdx] || '').trim();
    let note = description;
    if (author) note = note ? note + ' (Source: ' + author + ')' : 'Source: ' + author;
    items.push({ name, tier, val, note, category });
  }

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort();
  const out = { items, categories };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', OUT_PATH, '—', items.length, 'items, categories:', categories.join(', '));
}

main();
