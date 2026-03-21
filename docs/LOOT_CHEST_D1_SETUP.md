## Loot Chest D1 setup (`LOOT_CHEST_DB`)

The Loot Chest endpoints under `functions/tools/loot-box-tests/api/*` require a Cloudflare D1 binding named `LOOT_CHEST_DB`.

### Binding

- **Binding name**: `LOOT_CHEST_DB`
- **Database name**: `loot-chest-db`
- **Database id**: `34526e64-3c3a-477b-8161-273a043aec57`

If you deploy via Wrangler, `wrangler.toml` already includes the binding.
If you deploy via Cloudflare Pages (Git-connected), make sure the Pages project also has a D1 binding configured with the same variable name `LOOT_CHEST_DB`.

### Apply schema

From the project root (where `schema-loot-chest.sql` lives):

```bash
npx wrangler d1 execute LOOT_CHEST_DB --remote --file=schema-loot-chest.sql
```

### Smoke tests

1) **Create a pack (DM dashboard)**

- Open `tools/loot-box-tests/dm.html` in the deployed site.
- Set a DM key.
- Fill out the pack options.
- Click **Create Pack**.

2) **Verify it lists from D1**

- Click **My Packs**.
- You should see the pack in the table (loaded from `GET /tools/loot-box-tests/api/dm/packs?dm_key=...`).

3) **Open the pack**

- From the pack modal, copy the share link (it should be `/tools/loot-box-tests/pack/<id>`).
- Open that link and click the chest to open.

Expected behavior:

- `POST /tools/loot-box-tests/api/pack/<id>/open` decrements `packs.quantity`.
- A row is inserted into `pack_opens`.
- The DM modal “Open History” section will populate after openings are recorded.

## Loot table in R2 (`LOOT_TABLE_BUCKET`)

The global loot table is served by **`GET /api/loot-table`** and edited with **`PUT /api/loot-table`** (see `functions/api/loot-table.js`). Pack rolls read the same data via the `LOOT_TABLE_BUCKET` binding in the Worker.

### Binding

- **Binding name**: `LOOT_TABLE_BUCKET`
- **Bucket name**: `loot-table` (create in the dashboard or `wrangler r2 bucket create loot-table`)

Add the binding to the **same** Cloudflare Pages project as `LOOT_CHEST_DB`. `wrangler.toml` includes `[[r2_buckets]]` for local reference.

### Seed `loot-table.json`

Upload the canonical file as object key **`loot-table.json`** (include `items`, and if present `by_tier` / `meta` — use `functions/tools/loot-box-tests/api/_shared/loot-table.json` as the source). Until this object exists, `GET /api/loot-table` returns **404** and the DM UI will fail to load loot; pack opens still fall back to the bundled JSON in the Worker.

### Editor page

- **`/tools/loot-box-tests/loot-editor.html`** — bookmarkable UI; `PUT` has no auth (validate JSON only).

