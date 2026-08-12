-- Loot Chest: use with Cloudflare D1 binding LOOT_CHEST_DB (loot-chest-db).
-- Apply with: npx wrangler d1 execute LOOT_CHEST_DB --remote --file=schema-loot-chest.sql

CREATE TABLE IF NOT EXISTS packs (
  id TEXT PRIMARY KEY,
  dm_key TEXT NOT NULL,
  batch_id TEXT,
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

-- Loot table cleanup workflow (metadata only; loot items live in R2)
CREATE TABLE IF NOT EXISTS cleanup_buckets (
  bucket_key TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  category TEXT NOT NULL,
  rarity TEXT NOT NULL,
  assigned_to TEXT,
  item_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cleanup_items (
  item_id INTEGER PRIMARY KEY,
  bucket_key TEXT NOT NULL,
  reviewer TEXT,
  status TEXT NOT NULL DEFAULT 'unreviewed',
  flag_reason TEXT,
  flag_note TEXT,
  flagged_at TEXT,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cleanup_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  reviewer TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cleanup_reviewer_state (
  reviewer TEXT PRIMARY KEY,
  last_bucket_key TEXT,
  last_item_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cleanup_items_bucket ON cleanup_items(bucket_key);
CREATE INDEX IF NOT EXISTS idx_cleanup_items_status ON cleanup_items(status);
CREATE INDEX IF NOT EXISTS idx_cleanup_items_reviewer ON cleanup_items(reviewer);
CREATE INDEX IF NOT EXISTS idx_cleanup_buckets_slug ON cleanup_buckets(slug);
CREATE INDEX IF NOT EXISTS idx_cleanup_changes_item ON cleanup_changes(item_id);

