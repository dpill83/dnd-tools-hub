CREATE TABLE IF NOT EXISTS packs (
  id TEXT PRIMARY KEY,
  dm_key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('shared','personal')),
  player_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  opens_used INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  slot_config TEXT NOT NULL,
  guaranteed_item_id INTEGER,
  seed TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opens (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES packs(id),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  items_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_packs_dm_key ON packs(dm_key);
CREATE INDEX IF NOT EXISTS idx_opens_pack_id ON opens(pack_id);
