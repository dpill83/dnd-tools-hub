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

