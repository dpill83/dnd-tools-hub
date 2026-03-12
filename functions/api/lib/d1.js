/**
 * D1 helpers for Adventure Log Builder. Use env.ADVENTURE_LOG_DB.
 * dbAll returns result.results so callers get an array; use result.meta.last_row_id from dbRun for inserted row IDs.
 */

function getDb(env) {
  return env.ADVENTURE_LOG_DB;
}

/**
 * Run a SELECT that returns a single row. Returns null when no row.
 * @param {object} env - request env with ADVENTURE_LOG_DB
 * @param {string} sql
 * @param {unknown[]} [params]
 * @returns {Promise<object|null>}
 */
export async function dbGet(env, sql, params = []) {
  const db = getDb(env);
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  return await bound.first();
}

/**
 * Run a SELECT that returns multiple rows. Returns array of rows (D1 .all() returns { results, success, meta }).
 * @param {object} env - request env with ADVENTURE_LOG_DB
 * @param {string} sql
 * @param {unknown[]} [params]
 * @returns {Promise<object[]>}
 */
export async function dbAll(env, sql, params = []) {
  const db = getDb(env);
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const result = await bound.all();
  return result.results || [];
}

/**
 * Run INSERT/UPDATE/DELETE. Use result.meta.last_row_id for the inserted row ID after an INSERT.
 * @param {object} env - request env with ADVENTURE_LOG_DB
 * @param {string} sql
 * @param {unknown[]} [params]
 * @returns {Promise<{ meta?: { last_row_id?: number } }>}
 */
export async function dbRun(env, sql, params = []) {
  const db = getDb(env);
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  return await bound.run();
}
