# D1 setup for Adventure Log Builder

The `/api/players`, `/api/characters`, `/api/campaigns`, `/api/sessions`, and `/api/stats` endpoints need a D1 database. If you see **503 Service Unavailable**, the `ADVENTURE_LOG_DB` binding is not configured.

## Option A: Cloudflare Dashboard (Git-connected Pages)

1. **Create a D1 database**
   - Dashboard → Workers & Pages → D1 → Create database
   - Name it e.g. `adventure-log-db` and create it.

2. **Bind it to your Pages project**
   - Go to your Pages project (e.g. `dnd-tools-hub`) → **Settings** → **Functions** → **D1 database bindings**
   - Add binding: **Variable name** `ADVENTURE_LOG_DB`, **D1 database** = the database you created.

3. **Apply the schema**
   - In the D1 dashboard, open your database → **Console**, or use Wrangler **from the project root** (where `schema.sql` and `wrangler.toml` are):
   - `cd path/to/dnd-tools-hub` then `npx wrangler d1 execute ADVENTURE_LOG_DB --remote --file=schema.sql`
   - (Use the same binding name and ensure the DB is selected.)

4. **Redeploy** the Pages project so the new binding is used.

## Option B: Wrangler (deploy from CLI)

1. **Create the database**
   ```bash
   npx wrangler d1 create adventure-log-db
   ```
   Copy the `database_id` from the output.

2. **Edit `wrangler.toml`** in the project root: set `database_id` under `[[d1_databases]]` to that value (replace `REPLACE_WITH_YOUR_D1_DATABASE_ID`).

3. **Apply the schema** (from the project root, where `schema.sql` lives):
   ```bash
   cd path/to/dnd-tools-hub
   npx wrangler d1 execute ADVENTURE_LOG_DB --remote --file=schema.sql
   ```

4. **Deploy**
   ```bash
   npx wrangler pages deploy ./path-to-your-static-output --project-name=dnd-tools-hub
   ```
   Or use your usual Pages deploy; the binding in `wrangler.toml` is used when Wrangler runs the deploy.

## Verify

After the binding is set and the schema is applied, open the Adventure Log Builder, click **Manage Players**, and add a player. You should no longer see 503.
