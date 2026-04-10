// functions/api/openai/images.js
// Cloudflare Pages Function — forwards image generation requests to OpenAI
// Requires OPENAI_API_KEY set in Cloudflare Pages environment variables

export async function onRequestPost(context) {
  const { request, env } = context;

  // Fail gracefully if key is missing
  if (!env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Forward to OpenAI Images API
  // Using gpt-image-1 (latest). Swap to dall-e-3 if preferred.
  const payload = {
    model: body.model || 'dall-e-3',
    prompt: body.prompt,
    n: 1,
    size: body.size || '1792x1024',
    quality: body.quality || 'standard',
    response_format: 'url',
  };

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.error?.message || 'OpenAI error', status: response.status }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to reach OpenAI', detail: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
