/**
 * GET /api/maps/:id/markers – list markers for a map.
 * PUT /api/maps/:id/markers – replace markers. Body: { markers: [...] }.
 * Requires: BATTLE_PASS_IMAGES (R2 bucket binding).
 */

import { getBucket, getJson, putJson, markersKey, uploadMarkerImage } from '../../lib/r2-maps.js';

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

    let markers = Array.isArray(body.markers) ? body.markers : [];
    for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        const imageData = m && typeof m.imageData === 'string' && m.imageData.startsWith('data:image/') ? m.imageData : null;
        if (imageData) {
            try {
                const key = await uploadMarkerImage(bucket, id, imageData);
                const { imageData: _img, ...rest } = m;
                markers[i] = { ...rest, imageUrl: '/api/image/' + key };
            } catch (e) {
                return jsonResponse({ error: e.message || 'Failed to upload marker image' }, 400);
            }
        }
    }
    await putJson(bucket, markersKey(id), markers);
    return jsonResponse(markers);
}
