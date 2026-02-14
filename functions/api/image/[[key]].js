/**
 * GET /api/image/...
 * Serves an image from R2 (key = path after /api/image/).
 * Requires: BATTLE_PASS_IMAGES (R2 bucket binding).
 */
export async function onRequestGet(context) {
    const { env, params } = context;
    const bucket = env.BATTLE_PASS_IMAGES;
    if (!bucket) {
        return new Response('R2 not configured', { status: 503 });
    }

    const keySegments = params.key;
    const key = Array.isArray(keySegments) ? keySegments.join('/') : String(keySegments || '');
    if (!key) {
        return new Response('Not found', { status: 404 });
    }

    const object = await bucket.get(key);
    if (!object) {
        return new Response('Not found', { status: 404 });
    }

    const contentType = object.httpMetadata?.contentType || 'image/png';
    return new Response(object.body, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
        },
    });
}
