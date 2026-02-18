/**
 * Shared R2 helpers for interactive map: index, meta, markers, images.
 * Uses BATTLE_PASS_IMAGES bucket with prefix "maps/".
 */

const INDEX_KEY = 'maps/index.json';
const META_PREFIX = 'maps/meta/';
const MARKERS_PREFIX = 'maps/markers/';
const IMAGES_PREFIX = 'maps/images/';
const MARKER_IMAGES_PREFIX = 'maps/marker-images/';
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_MARKER_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

function getBucket(env) {
    return env.BATTLE_PASS_IMAGES || null;
}

function generateId() {
    return 'map-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

/**
 * @param {R2Bucket} bucket
 * @param {string} key
 * @returns {Promise<object|null>}
 */
export async function getJson(bucket, key) {
    const obj = await bucket.get(key);
    if (!obj) return null;
    const text = await obj.text();
    try {
        return JSON.parse(text);
    } catch (_) {
        return null;
    }
}

/**
 * @param {R2Bucket} bucket
 * @param {string} key
 * @param {object} data
 */
export async function putJson(bucket, key, data) {
    await bucket.put(key, JSON.stringify(data), {
        httpMetadata: { contentType: 'application/json' },
    });
}

/**
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function getIndex(bucket) {
    const list = await getJson(bucket, INDEX_KEY);
    return Array.isArray(list) ? list : [];
}

/**
 * @param {R2Bucket} bucket
 * @param {{id: string, name: string}} entry
 */
export async function appendToIndex(bucket, entry) {
    const list = await getIndex(bucket);
    if (list.some((e) => e.id === entry.id)) return;
    list.push(entry);
    await putJson(bucket, INDEX_KEY, list);
}

/**
 * @param {R2Bucket} bucket
 * @param {string} id
 */
export async function removeFromIndex(bucket, id) {
    const list = await getIndex(bucket);
    const filtered = list.filter((e) => e.id !== id);
    if (filtered.length === list.length) return;
    await putJson(bucket, INDEX_KEY, filtered);
}

export function metaKey(id) {
    return META_PREFIX + id + '.json';
}

export function markersKey(id) {
    return MARKERS_PREFIX + id + '.json';
}

export function imageKey(id, ext = 'png') {
    return IMAGES_PREFIX + id + '.' + ext;
}

/**
 * Decode data URL (e.g. data:image/png;base64,...) to Uint8Array.
 * @param {string} dataUrl
 * @param {number} [maxBytes=MAX_IMAGE_BYTES]
 * @returns {{ body: Uint8Array, contentType: string, ext: string }}
 */
export function decodeDataUrl(dataUrl, maxBytes = MAX_IMAGE_BYTES) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match) throw new Error('Invalid data URL');
    const contentType = match[1].trim();
    const b64 = match[2].replace(/\s/g, '');
    const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (binary.length > maxBytes) {
        const mb = Math.round(maxBytes / (1024 * 1024));
        throw new Error('Image too large (max ' + mb + ' MB)');
    }
    const ext = contentType === 'image/jpeg' || contentType === 'image/jpg' ? 'jpg' : 'png';
    return { body: binary, contentType, ext };
}

/**
 * Upload map image from data URL to R2.
 * @param {R2Bucket} bucket
 * @param {string} id
 * @param {string} dataUrl
 * @returns {string} imageKey for storage (e.g. maps/images/id.png)
 */
export async function uploadMapImage(bucket, id, dataUrl) {
    const { body, contentType, ext } = decodeDataUrl(dataUrl);
    const key = imageKey(id, ext);
    await bucket.put(key, body, {
        httpMetadata: { contentType },
    });
    return key;
}

/**
 * Upload marker image from data URL to R2.
 * @param {R2Bucket} bucket
 * @param {string} mapId
 * @param {string} dataUrl
 * @returns {string} imageKey for storage (e.g. maps/marker-images/mapId/timestamp-random.png)
 */
export async function uploadMarkerImage(bucket, mapId, dataUrl) {
    const { body, contentType, ext } = decodeDataUrl(dataUrl, MAX_MARKER_IMAGE_BYTES);
    const id = Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    const key = MARKER_IMAGES_PREFIX + mapId + '/' + id + '.' + ext;
    await bucket.put(key, body, {
        httpMetadata: { contentType },
    });
    return key;
}

export { getBucket, generateId, INDEX_KEY };
