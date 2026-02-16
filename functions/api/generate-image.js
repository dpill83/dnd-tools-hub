/**
 * POST /api/generate-image
 * Body: { prompt, model?, size?, quality?, image? }
 * When image (base64 data URL) is provided: uses Images Edits API to edit the portrait.
 * Otherwise: uses Images Generations API for text-to-image.
 * Requires: OPENAI_API_KEY, BATTLE_PASS_IMAGES (R2 bucket binding).
 */
const GENERATIONS_URL = 'https://api.openai.com/v1/images/generations';
const EDITS_URL = 'https://api.openai.com/v1/images/edits';
const ALLOWED_MODELS = ['gpt-image-1-mini', 'gpt-image-1.5', 'gpt-image-1'];
const DEFAULT_MODEL = 'gpt-image-1-mini';
const DEFAULT_SIZE = '1024x1536';
const DEFAULT_QUALITY = 'medium';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function randomId() {
    return Math.random().toString(36).slice(2, 10);
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const apiKey = env.OPENAI_API_KEY;
    const bucket = env.BATTLE_PASS_IMAGES;

    if (!apiKey) {
        return jsonResponse({ error: 'OPENAI_API_KEY not configured' }, 503);
    }
    if (!bucket) {
        return jsonResponse({ error: 'R2 bucket (BATTLE_PASS_IMAGES) not configured' }, 503);
    }

    let body;
    try {
        body = await request.json();
    } catch (_) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
        return jsonResponse({ error: 'prompt is required' }, 400);
    }

    const model = ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
    const size = ['1024x1024', '1024x1536', '1536x1024'].includes(body.size) ? body.size : DEFAULT_SIZE;
    const quality = ['low', 'medium', 'high'].includes(body.quality) ? body.quality : DEFAULT_QUALITY;

    const image = typeof body.image === 'string' && body.image.startsWith('data:image/') ? body.image : null;
    const apiUrl = image ? EDITS_URL : GENERATIONS_URL;
    const openaiBody = image
        ? { images: [{ image_url: image }], prompt, model, size, quality, n: 1 }
        : { model, prompt, n: 1, size, quality };

    let openaiRes;
    try {
        openaiRes = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(openaiBody),
        });
    } catch (e) {
        return jsonResponse({ error: 'OpenAI request failed', details: String(e.message) }, 502);
    }

    const openaiData = await openaiRes.json().catch(() => ({}));
    if (!openaiRes.ok) {
        const err = openaiData.error;
        const msg =
            (typeof err === 'string' ? err : err?.message) ||
            openaiData.message ||
            openaiRes.statusText ||
            'Request failed';
        const status = openaiRes.status >= 500 ? 502 : 400;
        return jsonResponse({ error: msg, details: err?.code || err?.type }, status);
    }

    const imageData = openaiData.data?.[0]?.b64_json;
    if (!imageData) {
        return jsonResponse({ error: 'No image data in OpenAI response' }, 502);
    }

    const binary = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));
    const key = `generated/${Date.now()}-${randomId()}.png`;

    try {
        await bucket.put(key, binary, {
            httpMetadata: { contentType: 'image/png' },
        });
    } catch (e) {
        return jsonResponse({ error: 'R2 upload failed', details: String(e.message) }, 502);
    }

    const imageUrl = `/api/image/${key}`;
    const createdAt = new Date().toISOString();

    return jsonResponse({
        imageUrl,
        promptUsed: prompt,
        model,
        size,
        quality,
        createdAt,
    });
}
