/**
 * GET /api/maps/:id/markers – list markers for a map.
 * PUT /api/maps/:id/markers – replace markers. Body: { markers: [...] }.
 * Requires: BATTLE_PASS_IMAGES (R2 bucket binding).
 */

import { getBucket, getJson, putJson, markersKey } from '../../../_lib/r2-maps.js';

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

    const list = await getJson(bucket, markersKey(id));
    const markers = Array.isArray(list) ? list : [];
    return jsonResponse(markers);
}

export async function onRequestPut(context) {
    const bucket = getBucket(context.env);
    if (!bucket) {
        return jsonResponse({ error: 'R2 not configured' }, 503);
    }

    const id = context.params.id;
    if (!id) {
        return jsonResponse({ error: 'Map id required' }, 404);
    }

    let body;
    try {
        body = await context.request.json();
    } catch (_) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const markers = Array.isArray(body.markers) ? body.markers : [];
    await putJson(bucket, markersKey(id), markers);
    return jsonResponse(markers);
}
