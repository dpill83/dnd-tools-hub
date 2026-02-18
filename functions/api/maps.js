/**
 * GET /api/maps – list maps (id, name).
 * POST /api/maps – create map. Body: { name, imageData (data URL), bounds: { width, height } }.
 * Requires: BATTLE_PASS_IMAGES (R2 bucket binding).
 */

import {
    getBucket,
    getIndex,
    appendToIndex,
    putJson,
    metaKey,
    markersKey,
    uploadMapImage,
    generateId,
} from './_lib/r2-maps.js';

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
    const list = await getIndex(bucket);
    return jsonResponse(list);
}

export async function onRequestPost(context) {
    const bucket = getBucket(context.env);
    if (!bucket) {
        return jsonResponse({ error: 'R2 not configured' }, 503);
    }

    let body;
    try {
        body = await context.request.json();
    } catch (_) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
        return jsonResponse({ error: 'name is required' }, 400);
    }

    const bounds = body.bounds;
    if (!bounds || typeof bounds.width !== 'number' || typeof bounds.height !== 'number') {
        return jsonResponse({ error: 'bounds with width and height is required' }, 400);
    }

    const imageData = typeof body.imageData === 'string' ? body.imageData : '';
    if (!imageData || !imageData.startsWith('data:image/')) {
        return jsonResponse({ error: 'imageData (data URL) is required' }, 400);
    }

    let imageKeyStored;
    const id = generateId();
    try {
        imageKeyStored = await uploadMapImage(bucket, id, imageData);
    } catch (e) {
        const msg = e.message || 'Upload failed';
        const status = msg.includes('too large') ? 413 : 400;
        return jsonResponse({ error: msg }, status);
    }

    const imageUrl = '/api/image/' + imageKeyStored;
    const meta = {
        id,
        name,
        bounds: { width: bounds.width, height: bounds.height },
        imageKey: imageKeyStored,
        imageUrl,
    };

    await putJson(bucket, metaKey(id), meta);
    await putJson(bucket, markersKey(id), []);
    await appendToIndex(bucket, { id, name });

    return jsonResponse({
        id,
        name,
        bounds: meta.bounds,
        imageUrl,
    }, 201);
}
