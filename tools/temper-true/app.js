// ── SCENE INDEX (0-based, SCENES[0] = scene1 data) ────────────────────────
// state.currentScene: 0 = scene1, 1 = scene2 ... 8 = scene9

let currentCriticalResolve = null;
let pendingContinue = null;

// ── UI HELPERS ────────────────────────────────────────────────────────────

function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), duration);
}

function getParchmentScroller() {
  return document.querySelector('.parchment-content');
}

function scrollSheetToTop() {
  const scroller = getParchmentScroller();
  if (scroller) scroller.scrollTop = 0;
}

function transitionSheet(updateFn) {
  const scroller = getParchmentScroller();
  if (!scroller) {
    updateFn?.();
    return;
  }

  // Fade out quickly, swap content, fade in, and keep the view at top.
  scroller.classList.add('fading');
  scroller.classList.remove('entering');

  setTimeout(() => {
    updateFn?.();
    scrollSheetToTop();
    scroller.classList.remove('fading');
    scroller.classList.add('entering');
    setTimeout(() => scroller.classList.remove('entering'), 260);
  }, 180);
}

function resetSheetUI() {
  document.getElementById('sceneProse').innerHTML = '';
  document.getElementById('choices').innerHTML = '';
  document.getElementById('llmResponse').classList.remove('visible', 'loading');
  document.getElementById('llmResponse').textContent = '';
  document.getElementById('continueSceneBtn').classList.remove('visible');
  document.getElementById('diceInputRow').style.display = 'none';
  setRitualPanel(false);
  pendingContinue = null;
}

// ── IMAGE GENERATION (OPT-IN) ──────────────────────────────────────────────

const IMAGE_STYLE = 'oil painting illustration, dark fantasy, Waterdeep city, candlelit, noir atmosphere, detailed, cinematic composition, warm amber and deep navy palette, no text';

const SCENE_IMAGE_PROMPTS = {
  scene2: {
    prompt: `A Twilight Domain cleric in a priest collar and armor stands in a pool of lantern light on a wet cobblestone alley at dusk. He faces a small crowd of neighbors. Steam curls from a smithy window. Blue hour light fades behind rooftops. ${IMAGE_STYLE}`,
    cacheKey: 'tt_img_scene2',
  },
  scene4: {
    prompt: `Interior of a harbor registry office in a fantasy city. A stone-front room, barred counter, two city guards with halberds. A cleric in Radiant Watch armor faces a suspicious clerk across the counter. Salt and ink in the air. ${IMAGE_STYLE}`,
    cacheKey: 'tt_img_scene4',
  },
  scene7: {
    prompt: `A fantasy blacksmith's fitting room at night. A water genasi armorsmith holds a glowing steel billet suspended on a leather thong, listening to its ring. Lanternlight illuminates test plates laid out on a chalk-marked floor. Steam from a quench basin. ${IMAGE_STYLE}`,
    cacheKey: 'tt_img_scene7',
  },
};

let imageGenerationEnabled = false;

/** DevTools: filter by "Temper-True AI" to see when narration/images run and why they might skip or fail. */
function logTemperAI(level, event, detail) {
  const prefix = '[Temper-True AI]';
  const line = `${prefix} ${event}`;
  if (level === 'error') console.error(line, detail ?? '');
  else if (level === 'warn') console.warn(line, detail ?? '');
  else console.info(line, detail ?? '');
}

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
  if (!imageGenerationEnabled) hideIllustration();
}

async function generateSceneImage(sceneId, opts = {}) {
  if (!imageGenerationEnabled && !opts.layoutPreview) {
    logTemperAI('info', 'image:skipped', {
      sceneId,
      reason: 'illustrations_toggle_off',
      hint: 'Enable “Scene illustrations” in the header or use ?pinSketch=1 for layout preview.',
    });
    return;
  }

  const config = SCENE_IMAGE_PROMPTS[sceneId];
  if (!config) {
    logTemperAI('info', 'image:skipped', { sceneId, reason: 'no_illustration_for_this_scene' });
    return;
  }

  const bypassCache = !!opts.bypassCache;
  if (!bypassCache) {
    const cached = localStorage.getItem(config.cacheKey);
    if (cached) {
      logTemperAI('info', 'image:cache_hit', { sceneId, cacheKey: config.cacheKey });
      displaySketchParchment(cached, sceneId);
      return;
    }
  } else {
    logTemperAI('info', 'image:cache_bypass', { sceneId });
  }

  showSketchParchmentLoading();

  const t0 = performance.now();
  logTemperAI('info', 'image:request_start', {
    sceneId,
    model: 'dall-e-3',
    layoutPreview: !!opts.layoutPreview,
  });

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
      logTemperAI('warn', 'image:request_failed', {
        sceneId,
        httpStatus: response.status,
        error: data.error ?? data,
      });
      hideIllustration();
      return;
    }

    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      logTemperAI('warn', 'image:no_url_in_response', { sceneId, keys: data ? Object.keys(data) : [] });
      hideIllustration();
      return;
    }

    try {
      // OpenAI image URLs are short-lived signed links; stale entries 403 until refetched (see displaySketchParchment onerror).
      localStorage.setItem(config.cacheKey, imageUrl);
    } catch {
      // localStorage full — skip caching
      logTemperAI('warn', 'image:cache_write_failed', { sceneId });
    }

    logTemperAI('info', 'image:request_ok', {
      sceneId,
      ms: Math.round(performance.now() - t0),
    });
    displaySketchParchment(imageUrl, sceneId);
  } catch (err) {
    logTemperAI('error', 'image:network_or_parse_error', { sceneId, message: err?.message ?? String(err) });
    hideIllustration();
  }
}

function showSketchParchmentLoading() {
  const parchment = document.getElementById('sketchParchment');
  const loading = document.getElementById('sketchLoading');
  const img = document.getElementById('sketchImage');
  if (!parchment || !loading || !img) return;
  img.removeAttribute('src');
  img.classList.remove('loaded');
  img.onerror = null;
  img.onload = null;
  loading.classList.add('active');
  parchment.style.display = 'block';
  parchment.onclick = null;
}

function openIllustrationLightbox(url) {
  const lb = document.getElementById('illustrationLightbox');
  const lbImg = document.getElementById('illustrationLightboxImg');
  if (!lb || !lbImg) return;
  lbImg.src = url;
  lb.classList.add('open');
  lb.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
}

function closeIllustrationLightbox() {
  const lb = document.getElementById('illustrationLightbox');
  const lbImg = document.getElementById('illustrationLightboxImg');
  if (!lb) return;
  lb.classList.remove('open');
  lb.setAttribute('hidden', '');
  document.body.style.overflow = '';
  if (lbImg) lbImg.removeAttribute('src');
}

function displaySketchParchment(url, sceneId) {
  const parchment = document.getElementById('sketchParchment');
  const img = document.getElementById('sketchImage');
  const loading = document.getElementById('sketchLoading');
  if (!parchment || !img) return;
  if (loading) loading.classList.remove('active');

  img.onload = () => img.classList.add('loaded');
  img.onerror = () => {
    img.onerror = null;
    if (!sceneId) {
      hideIllustration();
      return;
    }
    const cfg = SCENE_IMAGE_PROMPTS[sceneId];
    if (cfg) {
      try {
        localStorage.removeItem(cfg.cacheKey);
      } catch {
        /* ignore */
      }
    }
    logTemperAI('warn', 'image:load_failed_refetch', {
      sceneId,
      reason: 'url_expired_or_blocked',
    });
    generateSceneImage(sceneId, { bypassCache: true });
  };

  parchment.onclick = () => openIllustrationLightbox(url);
  img.src = url;
  if (img.complete) img.classList.add('loaded');
  parchment.style.display = 'block';
}

function hideSketchParchment() {
  const parchment = document.getElementById('sketchParchment');
  const img = document.getElementById('sketchImage');
  const loading = document.getElementById('sketchLoading');
  if (parchment) {
    parchment.style.display = 'none';
    parchment.onclick = null;
  }
  if (loading) loading.classList.remove('active');
  if (img) {
    img.removeAttribute('src');
    img.classList.remove('loaded');
    img.onerror = null;
    img.onload = null;
  }
}

function hideIllustration() {
  closeIllustrationLightbox();
  const el = document.getElementById('sceneIllustration');
  if (el) {
    el.classList.remove('visible');
    el.innerHTML = '';
  }
  hideSketchParchment();
}

function updateChronicle() {
  const s = state;

  // Tags
  const tagMap = {
    'tag-narrative': {
      text: s.tags.narrative === 'clean' ? 'Narrative: Clean' : s.tags.narrative === 'sour' ? 'Narrative: Sour' : 'Narrative: Unset',
      cls: s.tags.narrative === 'clean' ? 'earned' : s.tags.narrative === 'sour' ? 'bad' : '',
    },
    'tag-trust': {
      text: `Shop Trust: ${s.tags.trust === 'up' ? 'Up' : 'Neutral'}`,
      cls: s.tags.trust === 'up' ? 'earned' : '',
    },
    'tag-letter': {
      text: `Wessalen Letter: ${s.tags.letter ? 'Yes' : 'No'}`,
      cls: s.tags.letter ? 'earned' : '',
    },
    'tag-lot': {
      text: s.tags.lot === 'clean' ? 'Steel: Clean Lot' : s.tags.lot === 'shortcut' ? 'Steel: Shortcut' : 'Steel: Unresolved',
      cls: s.tags.lot === 'clean' ? 'earned' : s.tags.lot === 'shortcut' ? 'bad' : '',
    },
    'tag-credit': {
      text: `Public Credit: ${s.tags.credit ? 'Yes' : 'No'}`,
      cls: s.tags.credit ? 'earned' : '',
    },
  };

  for (const [id, { text, cls }] of Object.entries(tagMap)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.querySelector('.tag-text').textContent = text;
    el.className = 'tag ' + cls;
  }

  // Clues
  for (const letter of ['a', 'b', 'c']) {
    const el = document.getElementById(`clue-${letter}`);
    if (el) el.classList.toggle('found', !!s.clues[letter]);
  }

  // Session
  const si = document.getElementById('sessionIndicator');
  if (si) si.textContent = `Session ${s.session === 2 ? 'Two' : 'One'}`;
}

function setRitualPanel(visible, name = '', desc = '', dc = '', onRoll = null) {
  const panel = document.getElementById('ritual');
  panel.classList.toggle('visible', visible);
  if (!visible) return;
  document.getElementById('ritualName').textContent = name;
  document.getElementById('ritualDesc').textContent = desc;
  document.getElementById('ritualDC').textContent = dc;
  document.getElementById('diceDisplay').classList.remove('visible', 'rolling');
  document.getElementById('ritualRollBtn').disabled = false;
  currentCriticalResolve = onRoll;
}

/**
 * Layout/CSS: append ?pinCritical=1 and/or ?pinSketch=1 to this page’s URL, reload, then tweak CSS.
 * - pinCritical: .ritual on the main parchment.
 * - pinSketch: .sketch-parchment (left scene illustration) in styles.css — uses layoutPreview so images run even if the illustrations toggle is off.
 * Skips the title, shows Scene 2 + the Public Narrative critical check. Does not save game state.
 * Roll does not advance the story (preview only). Remove the query param when finished.
 */
function applyCriticalCheckLayoutPreview() {
  const sceneIx = 1;
  const sceneData = SCENES[sceneIx];
  const beat = sceneData && sceneData.beats && sceneData.beats[1];
  if (!beat || beat.type !== 'critical-check') return;

  document.getElementById('titleScreen').style.display = 'none';
  const ch = document.getElementById('cliffhangerScreen');
  if (ch) ch.classList.remove('visible');

  hideIllustration();
  generateSceneImage(sceneData.id, { layoutPreview: true });
  document.getElementById('sceneLabel').textContent = sceneData.label;
  document.getElementById('sceneTitle').textContent = sceneData.title;
  document.getElementById('sceneLocation').textContent = sceneData.location;
  resetSheetUI();

  const proseEl = document.getElementById('sceneProse');
  const p = document.createElement('p');
  p.style.fontStyle = 'italic';
  p.textContent = `Critical Check: ${beat.name}. Roll to resolve.`;
  proseEl.appendChild(p);

  const adjustedDC = Math.max(8, beat.baseDC + getDCMod());
  setRitualPanel(true, beat.name, beat.desc, String(adjustedDC), null);
}

// ── SCENE RENDERING ───────────────────────────────────────────────────────

function renderScene(sceneIndex) {
  const sceneData = SCENES[sceneIndex];
  if (!sceneData) return;

  state.currentScene = sceneIndex;
  state.currentBeat = 0;
  if (sceneData.session) state.session = sceneData.session;
  saveState();

  hideIllustration();
  generateSceneImage(sceneData.id);

  document.getElementById('sceneLabel').textContent = sceneData.label;
  document.getElementById('sceneTitle').textContent = sceneData.title;
  document.getElementById('sceneLocation').textContent = sceneData.location;
  resetSheetUI();
  updateChronicle();
  scrollSheetToTop();

  // Start with first beat
  processBeat(sceneIndex, 0);
}

function processBeat(sceneIndex, beatIndex) {
  const sceneData = SCENES[sceneIndex];
  state.currentBeat = beatIndex;
  saveState();

  if (beatIndex >= sceneData.beats.length) {
    // Scene complete — show end prose and continue button
    showEndProse(sceneIndex);
    return;
  }

  const beat = sceneData.beats[beatIndex];

  if (beat.type === 'prose') {
    transitionSheet(() => {
      resetSheetUI();
      renderProse(beat.text, () => {
        processBeat(sceneIndex, beatIndex + 1);
      });
    });
  } else if (beat.type === 'manual-check') {
    transitionSheet(() => {
      resetSheetUI();
      showManualCheck(beat, sceneData, () => {
        processBeat(sceneIndex, beatIndex + 1);
      });
    });
  } else if (beat.type === 'critical-check') {
    transitionSheet(() => {
      resetSheetUI();
      showCriticalCheck(beat, sceneData, () => {
        processBeat(sceneIndex, beatIndex + 1);
      });
    });
  } else if (beat.type === 'choices') {
    transitionSheet(() => {
      resetSheetUI();
      showChoices(beat, sceneData, () => {
        processBeat(sceneIndex, beatIndex + 1);
      });
    });
  }
}

function renderProse(textArray, onDone) {
  const proseEl = document.getElementById('sceneProse');
  proseEl.innerHTML = '';
  textArray.forEach(t => {
    const resolved = typeof t === 'function' ? t(state) : t;
    if (!resolved) return;
    const p = document.createElement('p');
    p.textContent = resolved;
    proseEl.appendChild(p);
  });
  // Show continue button briefly, then auto-advance after a moment
  // For prose-only beats, auto-show continue
  showContinueBtn(onDone);
}

function showContinueBtn(onDone) {
  const btn = document.getElementById('continueSceneBtn');
  btn.classList.add('visible');
  pendingContinue = () => {
    btn.classList.remove('visible');
    if (onDone) onDone();
  };
}

function showManualCheck(beat, sceneData, onDone) {
  const dcMod = getDCMod();
  const adjustedDC = Math.max(8, beat.baseDC + dcMod);

  // Present the check as the current "sheet" content (no old prose above).
  const proseEl = document.getElementById('sceneProse');
  proseEl.innerHTML = '';
  const p = document.createElement('p');
  p.style.fontStyle = 'italic';
  p.textContent = `Check: ${beat.skill}. Enter your roll to resolve.`;
  proseEl.appendChild(p);

  const row = document.getElementById('diceInputRow');
  document.getElementById('diceSkill').textContent = beat.skill;
  document.getElementById('diceDC').textContent = adjustedDC;
  document.getElementById('diceValue').value = '';
  row.style.display = 'flex';

  document.getElementById('diceSubmitBtn').onclick = () => {
    const rolled = parseInt(document.getElementById('diceValue').value);
    if (isNaN(rolled) || rolled < 1) return;
    row.style.display = 'none';

    const success = rolled >= adjustedDC;
    if (success && beat.onSuccess) beat.onSuccess(state);
    if (!success && beat.onFail) beat.onFail(state);
    saveState();
    updateChronicle();

    const responseText = success ? beat.successText : beat.failText;
    transitionSheet(() => {
      resetSheetUI();
      showLLMResponse(responseText, sceneData, () => onDone());
    });

    if (success) showToast('✓ Success');
    else showToast('✗ Failure — carry on');
  };
}

function showCriticalCheck(beat, sceneData, onDone) {
  const dcMod = getDCMod();
  const adjustedDC = Math.max(8, beat.baseDC + dcMod);

  // Present the check as the current "sheet" content (no old prose above).
  const proseEl = document.getElementById('sceneProse');
  proseEl.innerHTML = '';
  const p = document.createElement('p');
  p.style.fontStyle = 'italic';
  p.textContent = `Critical Check: ${beat.name}. Roll to resolve.`;
  proseEl.appendChild(p);

  setRitualPanel(true, beat.name, beat.desc, adjustedDC, (rolled) => {
    const success = rolled >= adjustedDC;
    if (success && beat.onSuccess) beat.onSuccess(state);
    if (!success && beat.onFail) beat.onFail(state);
    saveState();
    updateChronicle();
    setRitualPanel(false);

    transitionSheet(() => {
      resetSheetUI();
      const proseEl2 = document.getElementById('sceneProse');
      const p2 = document.createElement('p');
      p2.style.fontStyle = 'italic';
      p2.style.color = success ? '#2a4a1a' : '#5a1a0a';
      p2.textContent = success
        ? `The dice favor you. (Rolled ${rolled} vs DC ${adjustedDC})`
        : `The dice do not. (Rolled ${rolled} vs DC ${adjustedDC})`;
      proseEl2.appendChild(p2);
      showContinueBtn(onDone);
    });
  });
}

function showChoices(beat, sceneData, onDone) {
  const choicesEl = document.getElementById('choices');
  choicesEl.innerHTML = '';

  if (beat.prompt) {
    const prompt = document.createElement('div');
    prompt.style.cssText = 'font-family:Cinzel,serif;font-size:11px;letter-spacing:2px;color:#6b4e2a;margin-bottom:8px;text-transform:uppercase;';
    prompt.textContent = beat.prompt;
    choicesEl.appendChild(prompt);
  }

  beat.items.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<span class="choice-num">${String.fromCharCode(65 + i)}</span><span>${item.label.replace(/^[A-D\d] — /, '')}<br><small style="color:#8a6e3a;font-size:13px;">${item.text}</small></span>`;
    btn.onclick = () => {
      choicesEl.innerHTML = '';
      if (item.effect) item.effect(state);
      saveState();
      updateChronicle();

      // Get LLM reaction to choice
      transitionSheet(() => {
        resetSheetUI();
        callLLM(sceneData, item.label, item.text, () => onDone());
      });
    };
    choicesEl.appendChild(btn);
  });
}

function showEndProse(sceneIndex) {
  const sceneData = SCENES[sceneIndex];
  transitionSheet(() => {
    resetSheetUI();
    const proseEl = document.getElementById('sceneProse');

    if (sceneData.endProse) {
      sceneData.endProse.forEach(t => {
        const resolved = typeof t === 'function' ? t(state) : t;
        if (!resolved) return;
        const p = document.createElement('p');
        p.style.fontStyle = 'italic';
        p.textContent = resolved;
        proseEl.appendChild(p);
      });
    }

    if (sceneData.isCliffhanger) {
      showContinueBtn(() => {
        document.getElementById('cliffhangerScreen').classList.add('visible');
      });
    } else if (sceneData.isFinal) {
      showFinalScreen();
    } else {
      showContinueBtn(() => {
        advanceScene();
      });
    }
  });
}

function advanceScene() {
  const nextIndex = state.currentScene + 1;
  if (nextIndex >= SCENES.length) {
    showFinalScreen();
    return;
  }

  const scene = document.getElementById('scene');
  scene.classList.add('fading');
  setTimeout(() => {
    scene.classList.remove('fading');
    renderScene(nextIndex);
    scene.classList.add('entering');
    setTimeout(() => scene.classList.remove('entering'), 500);
  }, 400);
}

function showFinalScreen() {
  const proseEl = document.getElementById('sceneProse');
  const divider = document.createElement('div');
  divider.style.cssText = 'height:1px;background:linear-gradient(90deg,transparent,#c9a45c,transparent);margin:20px 0;';
  proseEl.appendChild(divider);

  const ending = document.createElement('div');
  ending.style.cssText = 'font-family:Cinzel,serif;font-size:11px;letter-spacing:3px;color:#8a6e3a;text-align:center;margin-top:8px;';
  ending.textContent = '— Finis —';
  proseEl.appendChild(ending);

  const summary = document.createElement('div');
  summary.style.cssText = 'margin-top:12px;font-size:13px;color:#6b4e2a;font-style:italic;text-align:center;line-height:1.6;';
  summary.textContent = state.tags.lot === 'clean'
    ? 'The armor is honest. The maker\'s mark is earned. The Cassalanter thread remains — quiet, patient, waiting.'
    : 'The armor is fast. The mark awaits re-verification. Someone, somewhere, believes they helped you.';
  proseEl.appendChild(summary);

  showToast('Adventure complete. Progress saved.', 4000);
}

// ── LLM INTEGRATION ───────────────────────────────────────────────────────

async function callLLM(sceneData, choiceLabel, choiceText, onDone) {
  const responseEl = document.getElementById('llmResponse');
  responseEl.classList.add('visible', 'loading');
  responseEl.textContent = '';

  const context = typeof sceneData.llmContext === 'function' ? sceneData.llmContext(state) : '';
  const dcMod = getDCMod();

  const systemPrompt = `You are the narrator of Temper-True, a solo D&D adventure set in Waterdeep for George Ward, a Twilight Domain Cleric. Your prose is grounded, atmospheric, and morally weighted. You write in second person. Keep responses to 2-4 sentences. Never explain mechanics. React to the choice made and the current consequence tags. ${state.tags.narrative === 'sour' ? 'The city is watching with suspicion. NPCs are cooler.' : 'The city is listening. NPCs are cautiously respectful.'} ${state.tags.trust === 'up' ? 'Steam and Steel trust George.' : ''} ${state.tags.letter ? 'George carries Wessalen\'s formal backing.' : ''} DC modifier in effect: ${dcMod > 0 ? '+' + dcMod + ' (reputation friction)' : dcMod < 0 ? dcMod + ' (earned trust)' : 'none'}.`;

  const userPrompt = `Scene context: ${context}\n\nGeorge chose: "${choiceLabel}" — ${choiceText}\n\nWrite a short reactive narration (2-4 sentences, second person) describing the immediate consequence of this choice in the world. Focus on sensory detail and NPC reaction. Do not summarize the choice back.`;

  const t0 = performance.now();
  logTemperAI('info', 'narration:request_start', {
    scene: sceneData.id,
    choice: choiceLabel,
    model: 'claude-sonnet-4-20250514',
  });

  try {
    const response = await fetch('/api/anthropic/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      logTemperAI('warn', 'narration:request_failed', {
        scene: sceneData.id,
        httpStatus: response.status,
        error: data.error ?? data,
      });
      responseEl.classList.remove('loading');
      responseEl.textContent = 'The story continues...';
      showContinueBtn(onDone);
      return;
    }

    const text = data.content?.[0]?.text || '';
    if (!text) {
      logTemperAI('warn', 'narration:empty_text', { scene: sceneData.id, raw: data });
    } else {
      logTemperAI('info', 'narration:request_ok', {
        scene: sceneData.id,
        ms: Math.round(performance.now() - t0),
        chars: text.length,
      });
    }
    responseEl.classList.remove('loading');
    responseEl.textContent = text || 'The story continues...';
    showContinueBtn(onDone);
  } catch (err) {
    logTemperAI('error', 'narration:network_or_parse_error', {
      scene: sceneData.id,
      message: err?.message ?? String(err),
    });
    responseEl.classList.remove('loading');
    responseEl.textContent = 'The story continues...';
    showContinueBtn(onDone);
  }
}

async function showLLMResponse(staticText, sceneData, onDone) {
  const responseEl = document.getElementById('llmResponse');
  responseEl.classList.add('visible');
  responseEl.textContent = staticText;
  showContinueBtn(onDone);
}

// ── DICE ROLL (Critical) ──────────────────────────────────────────────────

document.getElementById('ritualRollBtn').addEventListener('click', () => {
  const btn = document.getElementById('ritualRollBtn');
  const display = document.getElementById('diceDisplay');

  btn.disabled = true;

  // Animate through random numbers
  let ticks = 0;
  const maxTicks = 12;
  const interval = setInterval(() => {
    display.classList.add('visible');
    display.textContent = Math.floor(Math.random() * 20) + 1;
    ticks++;
    if (ticks >= maxTicks) {
      clearInterval(interval);
      const finalRoll = Math.floor(Math.random() * 20) + 1;
      display.textContent = finalRoll;
      display.classList.add('rolling');
      if (currentCriticalResolve) {
        setTimeout(() => currentCriticalResolve(finalRoll), 600);
      }
    }
  }, 80);
});

// ── CONTINUE BUTTON ───────────────────────────────────────────────────────

document.getElementById('continueSceneBtn').addEventListener('click', () => {
  if (pendingContinue) {
    const fn = pendingContinue;
    pendingContinue = null;
    fn();
  }
});

// ── TITLE SCREEN ──────────────────────────────────────────────────────────

document.getElementById('newGameBtn').addEventListener('click', () => {
  resetState();
  document.getElementById('titleScreen').style.display = 'none';
  renderScene(0);
});

document.getElementById('continueBtn').addEventListener('click', () => {
  const saved = localStorage.getItem(STATE_KEY);
  if (!saved) {
    showToast('No saved game found.');
    return;
  }
  document.getElementById('titleScreen').style.display = 'none';
  renderScene(state.currentScene);
});

// ── CLIFFHANGER ───────────────────────────────────────────────────────────

document.getElementById('endSession1Btn').addEventListener('click', () => {
  state.sessionEnded = true;
  state.session = 2;
  saveState();
  document.getElementById('cliffhangerScreen').classList.remove('visible');
  showToast('Session One saved. Resume anytime.', 3500);
  // Return to title
  setTimeout(() => {
    document.getElementById('titleScreen').style.display = 'flex';
  }, 1000);
});

// ── INIT ──────────────────────────────────────────────────────────────────

// Check if there's a saved game to offer
const hasSave = !!localStorage.getItem(STATE_KEY);
if (!hasSave) {
  document.getElementById('continueBtn').style.opacity = '0.3';
  document.getElementById('continueBtn').disabled = true;
}

loadImageToggleState();
const imageToggle = document.getElementById('imageToggle');
if (imageToggle) imageToggle.addEventListener('click', toggleImageGeneration);
updateChronicle();

const _layoutParams = new URLSearchParams(window.location.search);
if (_layoutParams.has('pinCritical') || _layoutParams.has('pinSketch')) {
  applyCriticalCheckLayoutPreview();
}

(function initIllustrationLightbox() {
  const lb = document.getElementById('illustrationLightbox');
  const closeBtn = document.getElementById('illustrationLightboxClose');
  if (!lb || !closeBtn) return;
  lb.addEventListener('click', (e) => {
    if (e.target === lb) closeIllustrationLightbox();
  });
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeIllustrationLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!lb.classList.contains('open')) return;
    closeIllustrationLightbox();
  });
})();
