import { rollItems } from './roller.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const API_PREFIX = '/tools/loot-box-tests/api';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

async function getBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (!pathname.startsWith(API_PREFIX)) {
      return new Response(null, { status: 404 });
    }

    const path = pathname.slice(API_PREFIX.length) || '/';
    const DB = env.DB;

    // POST /api/pack/create
    if (request.method === 'POST' && path === '/pack/create') {
      const body = await getBody(request);
      if (!body || typeof body.dm_key !== 'string' || !body.dm_key.trim()) {
        return json({ error: 'dm_key is required' }, 400);
      }
      if (!body.label || typeof body.label !== 'string' || !body.label.trim()) {
        return json({ error: 'label is required' }, 400);
      }
      if (!body.type || !['shared', 'personal'].includes(body.type)) {
        return json({ error: 'type must be shared or personal' }, 400);
      }
      if (body.type === 'personal' && (!body.player_name || typeof body.player_name !== 'string')) {
        return json({ error: 'player_name is required for personal packs' }, 400);
      }
      const quantity = body.quantity != null ? parseInt(body.quantity, 10) : 1;
      if (isNaN(quantity) || quantity < 1 || quantity > 20) {
        return json({ error: 'quantity must be 1–20' }, 400);
      }
      if (!body.slot_config || typeof body.slot_config !== 'object') {
        return json({ error: 'slot_config is required' }, 400);
      }

      const slot_config = body.slot_config;
      const guaranteed_item_id = body.guaranteed_item_id != null ? body.guaranteed_item_id : null;
      const seed = JSON.stringify({ slot_config, guaranteed_item_id });

      let id;
      for (let attempts = 0; attempts < 10; attempts++) {
        id = generateId();
        const existing = await DB.prepare('SELECT 1 FROM packs WHERE id = ?').bind(id).first();
        if (!existing) break;
      }
      if (!id) return json({ error: 'Could not generate unique id' }, 500);

      const slotConfigStr = JSON.stringify(slot_config);
      await DB.prepare(
        `INSERT INTO packs (id, dm_key, label, type, player_name, quantity, slot_config, guaranteed_item_id, seed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          body.dm_key.trim(),
          body.label.trim(),
          body.type,
          body.type === 'personal' ? (body.player_name || '').trim() : null,
          quantity,
          slotConfigStr,
          guaranteed_item_id,
          seed
        )
        .run();

      const row = await DB.prepare('SELECT created_at FROM packs WHERE id = ?').bind(id).first();
      return json({
        id,
        label: body.label.trim(),
        type: body.type,
        quantity,
        created_at: row.created_at,
        pack_url: '/pack/' + id,
      });
    }

    // GET /api/pack/:id
    const packIdMatch = path.match(/^\/pack\/([a-z0-9]+)$/);
    if (request.method === 'GET' && packIdMatch) {
      const id = packIdMatch[1];
      const row = await DB.prepare('SELECT * FROM packs WHERE id = ?').bind(id).first();
      if (!row) return json({ error: 'Pack not found' }, 404);
      if (row.active === 0) {
        return json(
          {
            error: 'This chest is empty',
            label: row.label,
            type: row.type,
            player_name: row.player_name,
          },
          410
        );
      }
      return json({
        id: row.id,
        label: row.label,
        type: row.type,
        player_name: row.player_name,
        active: row.active,
        opens_used: row.opens_used,
        quantity: row.quantity,
        slot_config: JSON.parse(row.slot_config),
        created_at: row.created_at,
      });
    }

    // POST /api/pack/:id/open
    const packOpenMatch = path.match(/^\/pack\/([a-z0-9]+)\/open$/);
    if (request.method === 'POST' && packOpenMatch) {
      const id = packOpenMatch[1];
      const row = await DB.prepare('SELECT * FROM packs WHERE id = ?').bind(id).first();
      if (!row) return json({ error: 'Pack not found' }, 404);
      if (row.active === 0) return json({ error: 'This chest is empty' }, 410);

      const slot_config = JSON.parse(row.slot_config);
      const guaranteed_item_id = row.guaranteed_item_id;
      const { mundane, reveal } = rollItems(slot_config, guaranteed_item_id);

      let openId;
      for (let attempts = 0; attempts < 10; attempts++) {
        openId = generateId();
        const existing = await DB.prepare('SELECT 1 FROM opens WHERE id = ?').bind(openId).first();
        if (!existing) break;
      }
      if (!openId) return json({ error: 'Could not generate open id' }, 500);

      const items_json = JSON.stringify({ mundane, reveal });
      await DB.prepare('INSERT INTO opens (id, pack_id, items_json) VALUES (?, ?, ?)')
        .bind(openId, id, items_json)
        .run();

      const newOpensUsed = row.opens_used + 1;
      const exhausted = newOpensUsed >= row.quantity;
      await DB.prepare(
        'UPDATE packs SET opens_used = ?, active = ? WHERE id = ?'
      )
        .bind(newOpensUsed, exhausted ? 0 : 1, id)
        .run();

      return json({
        open_id: openId,
        items: { mundane, reveal },
        exhausted,
      });
    }

    // GET /api/dm/packs?dm_key=xxx
    if (request.method === 'GET' && path === '/dm/packs') {
      const dm_key = url.searchParams.get('dm_key');
      if (!dm_key) return json({ error: 'dm_key is required' }, 400);
      const { results } = await DB.prepare(
        'SELECT * FROM packs WHERE dm_key = ? ORDER BY created_at DESC'
      )
        .bind(dm_key)
        .all();
      const packs = (results || []).map((row) => ({
        ...row,
        slot_config: JSON.parse(row.slot_config || '{}'),
      }));
      return json(packs);
    }

    // GET /api/dm/pack/:id/history?dm_key=xxx
    const historyMatch = path.match(/^\/dm\/pack\/([a-z0-9]+)\/history$/);
    if (request.method === 'GET' && historyMatch) {
      const id = historyMatch[1];
      const dm_key = url.searchParams.get('dm_key');
      if (!dm_key) return json({ error: 'dm_key is required' }, 400);
      const packRow = await DB.prepare('SELECT * FROM packs WHERE id = ?').bind(id).first();
      if (!packRow) return json({ error: 'Pack not found' }, 404);
      if (packRow.dm_key !== dm_key) return json({ error: 'Invalid DM key for this pack' }, 403);
      const { results: opens } = await DB.prepare(
        'SELECT * FROM opens WHERE pack_id = ? ORDER BY opened_at DESC LIMIT 50'
      )
        .bind(id)
        .all();
      const opensList = (opens || []).map((o) => ({
        id: o.id,
        opened_at: o.opened_at,
        items: JSON.parse(o.items_json || '{}'),
      }));
      return json({
        pack: { ...packRow, slot_config: JSON.parse(packRow.slot_config || '{}') },
        opens: opensList,
      });
    }

    // POST /api/dm/pack/:id/regenerate
    const regenMatch = path.match(/^\/dm\/pack\/([a-z0-9]+)\/regenerate$/);
    if (request.method === 'POST' && regenMatch) {
      const id = regenMatch[1];
      const body = await getBody(request);
      const dm_key = body?.dm_key;
      if (!dm_key) return json({ error: 'dm_key is required' }, 400);
      const row = await DB.prepare('SELECT * FROM packs WHERE id = ?').bind(id).first();
      if (!row) return json({ error: 'Pack not found' }, 404);
      if (row.dm_key !== dm_key) return json({ error: 'Invalid DM key for this pack' }, 403);

      const seed = JSON.parse(row.seed || '{}');
      const { slot_config, guaranteed_item_id } = seed;
      const slotConfigStr = JSON.stringify(slot_config || {});
      const newSeed = JSON.stringify({ slot_config: slot_config || {}, guaranteed_item_id: guaranteed_item_id ?? null });

      let newId;
      for (let attempts = 0; attempts < 10; attempts++) {
        newId = generateId();
        const existing = await DB.prepare('SELECT 1 FROM packs WHERE id = ?').bind(newId).first();
        if (!existing) break;
      }
      if (!newId) return json({ error: 'Could not generate unique id' }, 500);

      await DB.prepare(
        `INSERT INTO packs (id, dm_key, label, type, player_name, quantity, opens_used, active, slot_config, guaranteed_item_id, seed)
         VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`
      )
        .bind(
          newId,
          row.dm_key,
          row.label,
          row.type,
          row.player_name,
          row.quantity,
          slotConfigStr,
          guaranteed_item_id ?? null,
          newSeed
        )
        .run();

      return json({ id: newId, pack_url: '/pack/' + newId });
    }

    // PATCH /api/dm/pack/:id
    const patchMatch = path.match(/^\/dm\/pack\/([a-z0-9]+)$/);
    if (request.method === 'PATCH' && patchMatch) {
      const id = patchMatch[1];
      const body = await getBody(request);
      const dm_key = body?.dm_key;
      if (!dm_key) return json({ error: 'dm_key is required' }, 400);
      const active = body.active != null ? (body.active ? 1 : 0) : undefined;
      if (active === undefined) return json({ error: 'active is required' }, 400);

      const row = await DB.prepare('SELECT * FROM packs WHERE id = ?').bind(id).first();
      if (!row) return json({ error: 'Pack not found' }, 404);
      if (row.dm_key !== dm_key) return json({ error: 'Invalid DM key for this pack' }, 403);

      await DB.prepare('UPDATE packs SET active = ? WHERE id = ?').bind(active, id).run();
      const updated = await DB.prepare('SELECT * FROM packs WHERE id = ?').bind(id).first();
      return json({ ...updated, slot_config: JSON.parse(updated.slot_config || '{}') });
    }

    return json({ error: 'Not found' }, 404);
  },
};
