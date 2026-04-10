// ── IMAGE GENERATION ─────────────────────────────────────────────────────
// Add all of this inside your <script> block

// ── Image prompts per critical scene ──────────────────────────────────────
// These are tuned for DALL-E 3 with a consistent Waterdeep noir style.
// The style suffix is appended to every prompt for visual coherence.

const IMAGE_STYLE = 'oil painting illustration, dark fantasy, Waterdeep city, candlelit, noir atmosphere, detailed, cinematic composition, warm amber and deep navy palette, no text';

const SCENE_IMAGE_PROMPTS = {
  'scene2': {
    prompt: `A Twilight Domain cleric in a priest collar and armor stands in a pool of lantern light on a wet cobblestone alley at dusk. He faces a small crowd of neighbors. Steam curls from a smithy window. Blue hour light fades behind rooftops. ${IMAGE_STYLE}`,
    cacheKey: 'img_scene2',
  },
  'scene4': {
    prompt: `Interior of a harbor registry office in a fantasy city. A stone-front room, barred counter, two city guards with halberds. A cleric in Radiant Watch armor faces a suspicious clerk across the counter. Salt and ink in the air. ${IMAGE_STYLE}`,
    cacheKey: 'img_scene4',
  },
  'scene7': {
    prompt: `A fantasy blacksmith's fitting room at night. A water genasi armorsmith holds a glowing steel billet suspended on a leather thong, listening to its ring. Lanternlight illuminates test plates laid out on a chalk-marked floor. Steam from a quench basin. ${IMAGE_STYLE}`,
    cacheKey: 'img_scene7',
  },
};

// ── Image generation state ─────────────────────────────────────────────────
let imageGenerationEnabled = false;

function loadImageToggleState() {
  imageGenerationEnabled = localStorage.getItem('temper_true_images') === 'on';
  const toggle = document.getElementById('imageToggle');
  if (toggle) toggle.classList.toggle('on', imageGenerationEnabled);
}

function toggleImageGeneration() {
  imageGenerationEnabled = !imageGenerationEnabled;
  localStorage.setItem('temper_true_images', imageGenerationEnabled ? 'on' : 'off');
  const toggle = document.getElementById('imageToggle');
  if (toggle) toggle.classList.toggle('on', imageGenerationEnabled);
  showToast(imageGenerationEnabled ? 'Scene illustrations: On' : 'Scene illustrations: Off');
}

// ── Main image generation function ────────────────────────────────────────
async function generateSceneImage(sceneId) {
  if (!imageGenerationEnabled) return;

  const config = SCENE_IMAGE_PROMPTS[sceneId];
  if (!config) return;

  // Check localStorage cache first
  const cached = localStorage.getItem(config.cacheKey);
  if (cached) {
    displaySceneImage(cached);
    return;
  }

  // Show loading state
  showIllustrationLoading();

  try {
    const response = await fetch('/api/openai/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: config.prompt,
        size: '1792x1024',
        quality: 'standard',
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.warn('Image generation failed:', data.error || response.status);
      hideIllustration();
      return;
    }

    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      hideIllustration();
      return;
    }

    // Cache the URL in localStorage
    // Note: DALL-E URLs expire after ~1 hour. For persistent cache,
    // you'd want to proxy/store the image in R2. For now, cache per session.
    try {
      localStorage.setItem(config.cacheKey, imageUrl);
    } catch {
      // localStorage full — skip caching, still display
    }

    displaySceneImage(imageUrl);

  } catch (err) {
    console.warn('Image generation error:', err);
    hideIllustration();
  }
}

// ── DOM helpers ───────────────────────────────────────────────────────────

function showIllustrationLoading() {
  const el = document.getElementById('sceneIllustration');
  if (!el) return;
  el.innerHTML = `<div class="scene-illustration-loading"><span>Rendering scene...</span></div>`;
  el.classList.add('visible');
}

function displaySceneImage(url) {
  const el = document.getElementById('sceneIllustration');
  if (!el) return;
  el.innerHTML = `<img src="${url}" alt="Scene illustration">`;
  el.classList.add('visible');
  // Fade in once loaded
  const img = el.querySelector('img');
  if (img) {
    img.onload = () => img.classList.add('loaded');
    // If already cached by browser
    if (img.complete) img.classList.add('loaded');
  }
}

function hideIllustration() {
  const el = document.getElementById('sceneIllustration');
  if (el) {
    el.classList.remove('visible');
    el.innerHTML = '';
  }
}

// ── Hook into renderScene ─────────────────────────────────────────────────
// In your existing renderScene() function, add this line after the scene
// data is loaded and before processBeat() is called:
//
//   hideIllustration();
//   generateSceneImage(sceneData.id);
//
// That's all — it checks if the scene has a prompt config and fires if so.

// ── Cache invalidation note ───────────────────────────────────────────────
// DALL-E URLs expire. If you want persistent images, store them in
// Cloudflare R2 via a separate worker. For now, clearing cache:
function clearImageCache() {
  Object.values(SCENE_IMAGE_PROMPTS).forEach(c => localStorage.removeItem(c.cacheKey));
  showToast('Image cache cleared.');
}
