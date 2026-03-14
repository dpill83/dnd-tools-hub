/**
 * One-time script: reads Magic Item Master Table.csv and writes data/magic-items.json.
 * Run from repo root: node tools/party-loot-ledger/scripts/csv-to-magic-items.js
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'Magic Item Master Table.csv');
const OUT_PATH = path.join(__dirname, '..', 'data', 'magic-items.json');

const RARITY_KEYS = ['common', 'uncommon', 'rare', 'veryRare', 'legendary'];
const RARITY_TIER = { common: 2, uncommon: 3, rare: 3, veryRare: 4, legendary: 5 };
const TIER_VAL = { 2: 25, 3: 250, 4: 2500, 5: 10000 };

// Column indices per rarity: [rollCol, itemCol, sourceCol]
const RARITY_COLS = {
  common: [0, 1, 2],
  uncommon: [4, 5, 6],
  rare: [8, 9, 10],
  veryRare: [12, 13, 14],
  legendary: [16, 17, 18]
};

const RE_ROLL = /re\s*roll|dm\s*choice/i;
const DATA_START_ROW = 26;

function parseCSVLine(line) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let end = i + 1;
      while (end < line.length) {
        const next = line.indexOf('"', end);
        if (next === -1) break;
        if (line[next + 1] === '"') {
          end = next + 2;
          continue;
        }
        end = next;
        break;
      }
      out.push(line.slice(i + 1, end).replace(/""/g, '"').trim());
      i = end + 1;
      if (line[i] === ',') i++;
      continue;
    }
    const comma = line.indexOf(',', i);
    if (comma === -1) {
      out.push(line.slice(i).trim());
      break;
    }
    out.push(line.slice(i, comma).trim());
    i = comma + 1;
  }
  return out;
}

function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);
  const result = {
    common: [],
    uncommon: [],
    rare: [],
    veryRare: [],
    legendary: []
  };

  for (let r = DATA_START_ROW; r < lines.length; r++) {
    const row = parseCSVLine(lines[r]);
    for (const key of RARITY_KEYS) {
      const [rollCol, itemCol, sourceCol] = RARITY_COLS[key];
      const name = (row[itemCol] || '').trim();
      if (!name || RE_ROLL.test(name)) continue;
      const source = (row[sourceCol] || '').trim();
      const tier = RARITY_TIER[key];
      const val = TIER_VAL[tier];
      result[key].push({
        name,
        tier,
        val,
        note: source || key
      });
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log('Wrote', OUT_PATH);
  RARITY_KEYS.forEach(k => console.log('  ' + k + ':', result[k].length));
}

main();
