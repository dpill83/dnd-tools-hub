/**
 * GET /api/maps/:id – single map metadata (id, name, bounds, imageUrl).
 * Requires: BATTLE_PASS_IMAGES (R2 bucket binding).
 */

import { getBucket, getJson, metaKey } from '../../_lib/r2-maps.js';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function onRequestGet(context) {
    const bucket = getBucket(context.env);
    if (!bucket) {
        return jsonResponse({ error: 'R2 not configured' }, 503);
    }

    const id = context.params.id;
    if (!id) {
        return jsonResponse({ error: 'Map id required' }, 404);
    }

    const meta = await getJson(bucket, metaKey(id));
    if (!meta) {
        return jsonResponse({ error: 'Map not found' }, 404);
    }

    const imageUrl = meta.imageUrl || ('/api/image/' + (meta.imageKey || ''));
    return jsonResponse({
        id: meta.id,
        name: meta.name,
        bounds: meta.bounds,
        imageUrl,
    });
}
