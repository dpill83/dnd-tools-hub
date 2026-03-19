-- Loot Chest: use with Cloudflare D1 binding LOOT_CHEST_DB (loot-chest-db).
-- Apply with: npx wrangler d1 execute LOOT_CHEST_DB --remote --file=schema-loot-chest.sql

CREATE TABLE IF NOT EXISTS packs (
  id TEXT PRIMARY KEY,
  dm_key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'shared',
  player_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  opens_used INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  slot_config TEXT NOT NULL DEFAULT '{}',
  guaranteed_item_id INTEGER,
  seed TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pack_opens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pack_id TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  mundane TEXT NOT NULL DEFAULT '[]',
  reveal TEXT,
  opened_at TEXT NOT NULL DEFAULT (datetime('now'))
);

