import { json, getBody, optionsResponse } from '../_shared/http.js';
import { assignBucketsBalanced } from '../_shared/cleanup.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost(context) {
  const DB = context.env.LOOT_CHEST_DB;
  if (!DB) return json({ error: 'Database not configured' }, 503);

  const body = (await getBody(context.request)) || {};
  const reassignAll = !!body.reassignAll;

  try {
    const result = await assignBucketsBalanced(DB, { reassignAll });
    return json({ ok: true, ...result });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 502);
  }
}
