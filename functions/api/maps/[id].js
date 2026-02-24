/**
 * GET /api/maps/:id – single map metadata (id, name, bounds, imageUrl).
 * DELETE /api/maps/:id – delete map (image, meta, markers, index entry).
 * Requires: BATTLE_PASS_IMAGES (R2 bucket binding).
 */

import { getBucket, getIndex, getJson, metaKey, markersKey, putJson, removeFromIndex, INDEX_KEY } from '../lib/r2-maps.js';

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
    const response = {
        id: meta.id,
        name: meta.name,
        bounds: meta.bounds,
        imageUrl,
    };
    if (typeof meta.mapWidthFeet === 'number' && meta.mapWidthFeet > 0) {
        response.mapWidthFeet = meta.mapWidthFeet;
    }
    return jsonResponse(response);
}

export async function onRequestPatch(context) {
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

    let body;
    try {
        body = await context.request.json();
    } catch (_) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (typeof body.name === 'string') {
        const trimmed = body.name.trim();
        meta.name = trimmed || meta.name;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'mapWidthFeet')) {
        const v = body.mapWidthFeet;
        if (v == null || v === '') {
            delete meta.mapWidthFeet;
        } else if (typeof v === 'number' && v > 0) {
            meta.mapWidthFeet = v;
        }
    }

    await putJson(bucket, metaKey(id), meta);
    if (meta.name) {
        const list = await getIndex(bucket);
        const idx = list.findIndex((e) => e.id === id);
        if (idx !== -1) {
            list[idx] = { ...list[idx], name: meta.name };
            await putJson(bucket, INDEX_KEY, list);
        }
    }

    const imageUrl = meta.imageUrl || ('/api/image/' + (meta.imageKey || ''));
    const response = { id: meta.id, name: meta.name, bounds: meta.bounds, imageUrl };
    if (meta.mapWidthFeet != null) response.mapWidthFeet = meta.mapWidthFeet;
    return jsonResponse(response);
}

export async function onRequestDelete(context) {
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

    const imageKey = meta.imageKey;
    const keysToDelete = [metaKey(id), markersKey(id)];
    if (imageKey) keysToDelete.push(imageKey);

    await Promise.all(keysToDelete.map((key) => bucket.delete(key)));
    await removeFromIndex(bucket, id);

    return jsonResponse({ deleted: id }, 200);
}
