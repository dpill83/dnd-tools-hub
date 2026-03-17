# Loot Chest — Backend Build Plan

## Overview

Add a Cloudflare Workers + D1 backend to the existing D&D Loot Chest app. **Project root:** `tools/loot-box-tests/` is the Cloudflare project root — all paths in this plan are relative to that folder. No files are added at the monorepo root. New files are `pack.html`, `dm.html`, `_redirects`, and a `worker/` subfolder for the API.

---

## Current file structure (do not change)

All paths below are relative to **`tools/loot-box-tests/`** (the Cloudflare project root).

```
tools/loot-box-tests/
  index.html            ← chest experience, client-side roll (demo mode)
  loot-table.html       ← loot browser page
  loot-table.json       ← item data
  _redirects            ← ADD THIS (Cloudflare Pages routing)
  assets/
    css/
      base.css
      scene.css
      cards.css
      effects.css
      responsive.css
      loot-card-modal.css
    js/
      loot-constants.js
      loot-display.js
      loot-audio.js
      loot-animation.js
    images/
    audio/
```

## New files to create

All paths relative to **`tools/loot-box-tests/`**.

```
tools/loot-box-tests/
  pack.html             ← player pack opening (API-driven)
  dm.html               ← DM dashboard
  _redirects            ← routing rules
  worker/
    src/
      index.js          ← all API routes
      roller.js         ← item rolling logic
      loot-table.json   ← copy of root loot-table.json
    wrangler.toml
    schema.sql
```

---

## 1. Database — D1

### `worker/schema.sql`

```sql
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
```

### `worker/wrangler.toml`

Worker-only config (no static bucket). The frontend is deployed as Cloudflare Pages with project root `tools/loot-box-tests/`; this Worker is attached to handle `/api/*` only (see Deployment below).

```toml
name = "loot-chest"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "loot-chest-db"
database_id = "REPLACE_AFTER_CREATION"
```

### Deployment: Pages + Worker (Option B)

- **Frontend:** The Pages project is `dnd-tools-hub`; the app lives at `https://dnd-tools-hub.pages.dev/tools/loot-box-tests/`. Pages serves all static assets. Do not use Pages Functions.
- **API (Option B):** Deploy the Worker separately: run `wrangler deploy` from the `worker/` directory. Then in the Cloudflare dashboard add a **Worker Route** for `dnd-tools-hub.pages.dev/tools/loot-box-tests/api/*` pointing to the `loot-chest` Worker. The Worker handles only requests to that path; all other traffic is served by Pages.

### Setup commands (run in order)

```bash
wrangler d1 create loot-chest-db
# Copy the database_id from output into wrangler.toml

wrangler d1 execute loot-chest-db --file=worker/schema.sql
```

---

## 2. Data shapes

### `slot_config` — stored as JSON string in the `slot_config` column

```json
{
  "mundane_count": 3,
  "reveal_tier_min": 3,
  "reveal_tier_max": 5,
  "categories": ["Weapon", "Armor", "Potion"],
  "cr_hint": 8
}
```

- `mundane_count` — number of mundane/common items (1–5)
- `reveal_tier_min` / `reveal_tier_max` — tier range for the reveal card (0=Mundane through 5=Legendary)
- `categories` — filter items by category. Empty array = all categories allowed
- `cr_hint` — stored for reference only, used to auto-suggest tiers in the UI

### `seed` — stored as JSON string

```json
{
  "slot_config": { ... },
  "guaranteed_item_id": 42
}
```

Stored at creation time. Used to regenerate an exhausted pack with the same original config.

### Pack `id` — 6-character alphanumeric slug

```js
function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
```

Always collision-check against DB before inserting.

### CR to tier suggestion mapping

| CR    | reveal_tier_min | reveal_tier_max |
|-------|----------------|----------------|
| 1–4   | 1              | 2              |
| 5–8   | 2              | 3              |
| 9–12  | 3              | 4              |
| 13–16 | 3              | 5              |
| 17–20 | 4              | 5              |

---

## 3. Worker — `worker/src/roller.js`

Import the loot table directly:

```js
import LOOT from './loot-table.json';
```

### `pickFromTier(tiers, categories)`

- `tiers` — array of tier numbers
- `categories` — array of category strings. If empty, no category filter
- Build pool from `LOOT.items` where `item.tier` is in `tiers` AND (`categories` is empty OR `item.category` is in `categories`)
- Return one random item or `null` if pool is empty

### `rollItems(slot_config, guaranteed_item_id)`

```js
function rollItems(slot_config, guaranteed_item_id) {
  const { mundane_count, reveal_tier_min, reveal_tier_max, categories = [] } = slot_config;

  // Roll mundane items from tier 0–1
  const mundane = [];
  for (let i = 0; i < mundane_count; i++) {
    const item = pickFromTier([0, 1], categories);
    if (item) mundane.push(item);
  }

  // Roll reveal item
  let reveal = null;

  // Use guaranteed item if specified
  if (guaranteed_item_id != null) {
    reveal = LOOT.items.find(item => item.id === guaranteed_item_id) || null;
  }

  // Otherwise roll from tier range
  if (!reveal) {
    const tiers = [];
    for (let t = reveal_tier_min; t <= reveal_tier_max; t++) tiers.push(t);
    reveal = pickFromTier(tiers, categories);
  }

  // Fallback to any magic item
  if (!reveal) {
    reveal = pickFromTier([2, 3, 4, 5], []);
  }

  return { mundane, reveal };
}

export { rollItems };
```

---

## 4. Worker — `worker/src/index.js`

### CORS headers

```js
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

Handle `OPTIONS` preflight: return `new Response(null, { status: 204, headers: CORS })`.

Only handle requests where `pathname.startsWith('/api/')`. All other requests fall through to Cloudflare Pages static assets (when this Worker is attached to the Pages project with root `tools/loot-box-tests/`).

### Helper: `json(data, status = 200)`

```js
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
```

### Route: `POST /api/pack/create`

Request body:
```json
{
  "dm_key": "string (required)",
  "label": "string (required)",
  "type": "shared | personal (required)",
  "player_name": "string (optional, required if type=personal)",
  "quantity": "integer 1–20 (required)",
  "slot_config": { "mundane_count": 3, "reveal_tier_min": 3, "reveal_tier_max": 5, "categories": [], "cr_hint": 8 },
  "guaranteed_item_id": "integer (optional)"
}
```

- Validate required fields. Return 400 with `{ error: "..." }` for missing/invalid fields
- Generate unique 6-char id (collision-check with DB)
- Set `seed = JSON.stringify({ slot_config, guaranteed_item_id: guaranteed_item_id ?? null })`
- Insert into `packs`
- Return `{ id, label, type, quantity, created_at, pack_url: "/pack/" + id }`

### Route: `GET /api/pack/:id`

- Look up pack by id
- Not found → 404 `{ error: "Pack not found" }`
- `active = 0` → 410 `{ error: "This chest is empty", label, type, player_name }`
- Found and active → return `{ id, label, type, player_name, active, opens_used, quantity, slot_config: JSON.parse(slot_config), created_at }`

### Route: `POST /api/pack/:id/open`

- Look up pack by id
- Not found → 404
- `active = 0` → 410 `{ error: "This chest is empty" }`
- Import `rollItems` from `roller.js`
- Parse `slot_config` and `guaranteed_item_id` from pack row
- Call `rollItems(slot_config, guaranteed_item_id)`
- Generate unique 6-char open id
- Insert into `opens`: `{ id, pack_id, items_json: JSON.stringify({ mundane, reveal }) }`
- Increment `opens_used` by 1 with `UPDATE packs SET opens_used = opens_used + 1 WHERE id = ?`
- If `opens_used + 1 >= quantity`, also set `active = 0`
- Return `{ open_id, items: { mundane, reveal }, exhausted: (opens_used + 1 >= quantity) }`

### Route: `GET /api/dm/packs?dm_key=xxx`

- Require `dm_key` query param → 400 if missing
- `SELECT * FROM packs WHERE dm_key = ? ORDER BY created_at DESC`
- Return array of pack objects with `slot_config` parsed from JSON string

### Route: `GET /api/dm/pack/:id/history?dm_key=xxx`

- Require `dm_key` query param
- Look up pack, validate `pack.dm_key === dm_key` → 403 if mismatch
- `SELECT * FROM opens WHERE pack_id = ? ORDER BY opened_at DESC LIMIT 50`
- Return `{ pack, opens: [{ id, opened_at, items: JSON.parse(items_json) }] }`

### Route: `POST /api/dm/pack/:id/regenerate`

Request body: `{ dm_key }`

- Look up pack, validate dm_key → 403 if mismatch
- Parse `seed` JSON to get original `slot_config` and `guaranteed_item_id`
- Create new pack with same config, same quantity as original, `opens_used = 0`, `active = 1`, new generated id
- Return `{ id, pack_url: "/pack/" + id }`

### Route: `PATCH /api/dm/pack/:id`

Request body: `{ dm_key, active }`

- Look up pack, validate dm_key → 403 if mismatch
- `UPDATE packs SET active = ? WHERE id = ?`
- Return updated pack row

---

## 5. Routing — `_redirects`

Place this file at the **project root** (`tools/loot-box-tests/_redirects`):

```
/pack/*  /pack.html  200
/dm      /dm.html    200
```

---

## 6. Frontend — `pack.html`

Copy `index.html` as the starting point. Make only these changes:

### On page load

- **Disable the chest click handler** until the initial `GET /api/pack/:id` check completes. Keep the chest non-clickable (e.g. hide or disable the button, or ignore clicks) until the response is in; then either show the chest as clickable (pack active) or call `showEmptyScreen` (404/410). This prevents a race where the user clicks before the status check finishes.
- Parse pack id and call the API:

```js
// Parse pack id from URL: /pack/x7k2m9
const packId = location.pathname.match(/\/pack\/([a-z0-9]+)/)?.[1];

if (!packId) {
  // Show error — no pack id
}

// Check if pack is active (chest must stay disabled until this resolves)
const res = await fetch('/api/pack/' + packId);
if (res.status === 404) { showEmptyScreen('Pack not found.'); return; }
if (res.status === 410) {
  const data = await res.json();
  showEmptyScreen(data.label + ' — This chest has already been claimed.');
  return;
}
const pack = await res.json();
// Now enable chest click handler
// Show pack label somewhere subtle on screen (optional)
```

### `showEmptyScreen(message)`

Replace the chest with a simple centered message:
- Dark background already exists
- Show closed chest image
- Show message in Cinzel font, gold color
- No click handler

### On first chest click (replace `rollChest()` call)

```js
// Instead of rollChest(), call the API
const openRes = await fetch('/api/pack/' + packId + '/open', { method: 'POST' });
if (openRes.status === 410) { showEmptyScreen('This chest has already been claimed.'); return; }
const openData = await openRes.json();
currentRoll = openData.items; // { mundane: [...], reveal: {...} }
// Then run the existing animation as normal
```

### Remove from pack.html

- `rollChest()` function
- `pickFromTier()` function  
- `getEmbeddedLoot()` function
- The loot-table.json fetch on first click
- `LOOT` variable

### Reset button ("Open Another")

- **Hide the "Open Another" reset button** on pack.html. After one open the page shows either the chest result or the empty screen; there is no re-opening. Do not show a reset button that would suggest another open is possible.

### Keep everything else unchanged

All animation code, CSS references, JS module references, audio, card flip — all identical to `index.html` (except the reset button as above).

Add a small "DM Dashboard" link in the corner:
```html
<a href="/dm" id="dm-link">DM ↗</a>
```

---

## 7. Frontend — `dm.html`

Use `dm_dashboard_mockup.html` as the exact starting point — it already has the correct dark fantasy aesthetic, CSS variables, layout, and component styles. Wire it to the real API.

### Key entry variables

```js
const API_BASE = ''; // same-origin, no prefix needed
let dmKey = sessionStorage.getItem('dm_key') || '';
```

### DM key flow

- On submit of dm_key input: store in `sessionStorage`, call `loadPacks()`
- `loadPacks()` calls `GET /api/dm/packs?dm_key=` + dmKey
- On success: render pack list
- On error: show inline error message "Could not load packs. Check your key."
- If `dmKey` already in `sessionStorage` on page load: call `loadPacks()` automatically

### Pack list rendering

For each pack, render a pack card showing:
- Label, type badge (Shared/Personal), status badge (Active/Exhausted)
- Player name if `type === 'personal'`
- `opens_used / quantity` with a progress bar
- CR hint and reveal tier range from `slot_config`
- Created date formatted as `Mar 14, 2026`
- Action buttons:
  - **View History** — always shown, calls history endpoint
  - **Deactivate** — only if `active = 1`, calls `PATCH /api/dm/pack/:id` with `{ active: 0 }`
  - **Regenerate** — only if `active = 0`, calls `POST /api/dm/pack/:id/regenerate`, shows new link

### Create pack form

Fields:
- **Label** — text input, required
- **Type** — radio: Shared / Personal. Showing Player Name field only when Personal is selected
- **Player Name** — text input, shown only for Personal type
- **CR Hint** — range slider 1–20. On change, auto-update Reveal Tier Min/Max selects using the CR→tier table and show helper text e.g. "Suggested: Rare – Very Rare"
- **Reveal Tier Min** — select: Mundane / Common / Uncommon / Rare / Very Rare / Legendary
- **Reveal Tier Max** — same select options
- **Mundane Item Count** — range slider 1–5
- **Categories** — checkboxes for all 9 categories. Unchecked = all categories allowed
- **Guaranteed Item** — text search input. On input with 2+ chars, filter `loot-table.json` client-side by `item.name.toLowerCase().includes(query)`, show dropdown of up to 8 matches with name and rarity. Clicking a result sets `guaranteed_item_id`. Show a clear button when an item is selected.
- **Quantity** — number input 1–20, default 1

On submit: `POST /api/pack/create` with all fields. On success: show result panel.

### After pack creation — result panel

Show in place of the form:
- Pack label and type
- Pack stats (quantity, CR hint, tiers, categories)
- Shareable URL: full URL including origin e.g. `https://yourdomain.com/pack/x7k2m9` with Copy button
- QR code generated client-side using qrcode.js:
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  ```
  ```js
  new QRCode(document.getElementById('qr-container'), {
    text: fullPackUrl,
    width: 160,
    height: 160,
    colorDark: '#c9a84c',
    colorLight: '#050300',
  });
  ```
- **Download QR as PNG** button — render QR canvas to PNG and trigger download
- **Create Another** button — resets the form
- **Back to Packs** button — reloads the pack list

### History modal

When View History is clicked:
- Call `GET /api/dm/pack/:id/history?dm_key=` + dmKey
- Show a modal overlay (use existing `zoom-dim` pattern from the chest) with:
  - Pack label at top
  - List of opens, newest first, max 50
  - Each open shows: timestamp, list of items (mundane in grey, reveal item highlighted in gold/amber)
- Click outside to close

### Error handling

Every API call must show a visible error on failure:
- Network error → "Could not reach server"
- 400 → show `response.error`
- 403 → "Invalid DM key for this pack"
- 404 → "Pack not found"
- 410 → "Pack is exhausted"
- 5xx → "Server error, try again"

---

## 8. `index.html` — minimal changes only

In `tools/loot-box-tests/index.html`, add one small link in the corner:
```html
<a href="/dm" id="dm-link" title="DM Dashboard">DM ↗</a>
```

Style it like the existing `#loot-table-btn` — small, unobtrusive, gold tint.

**Do not change anything else in index.html.**

---

## 9. Build order

Execute in this exact order. Do not move to the next step until the current one works.

1. Create `worker/wrangler.toml` and `worker/schema.sql`
2. Run `wrangler d1 create loot-chest-db`, update `database_id`, run schema migration
3. Build `worker/src/roller.js` — test `rollItems()` with a few manual calls in Node
4. Build `worker/src/index.js` — all seven routes
5. Deploy the Worker: run `wrangler deploy` from `worker/`; add Worker Route in dashboard for `dnd-tools-hub.pages.dev/tools/loot-box-tests/api/*` → `loot-chest`. Test all API routes against the live deployment URL.
6. Create `_redirects` at project root (`tools/loot-box-tests/`)
7. Build `pack.html` from `index.html` — wire API, remove client-side rolling; disable chest until GET pack resolves; hide "Open Another"
8. Build `dm.html` from `dm_dashboard_mockup.html` — wire all API calls
9. Add DM link to `index.html` (in `tools/loot-box-tests/`)
10. Test end to end at `https://dnd-tools-hub.pages.dev/tools/loot-box-tests/`

---

## 10. Definition of done

The build is complete when all of these work:

1. All seven API routes return correct responses (test against live deployment URL after Worker Route is attached)
2. A DM can go to `/dm`, enter a key, create a shared pack, and get a working link and downloadable QR
3. Opening that link shows the chest, runs the full animation with items from the API, and logs the open to D1
4. Opening the same link after quantity is exhausted shows the empty chest screen
5. The DM can view history and see exactly what was rolled in each open
6. A personal pack with a guaranteed item always reveals that item as the back card

---

## 11. What does not change

- All chest animation code in `index.html`
- All four CSS files
- All four JS modules (`loot-constants.js`, `loot-display.js`, `loot-audio.js`, `loot-animation.js`)
- `loot-table.html`
- `loot-table.json` at project root (`tools/loot-box-tests/`)
- Any existing `assets/` folder structure
