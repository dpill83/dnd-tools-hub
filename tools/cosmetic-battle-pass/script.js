// D&D Cosmetic Battle Pass – main app (plan §§2–13)

(function () {
    'use strict';

    const SCHEMA_VERSION = '1.0.0';
    const STORAGE_KEY = 'dnd-cosmetic-battle-pass';
    const SOUND_STORAGE_KEY = 'dnd-cosmetic-battle-pass-sound';
    const GALLERY_CAP = 20;
    const MAX_TIERS_IN_PROMPT = 12;

    const GEAR_TYPES = ['Breastplate', 'Shield', 'Mace', 'Boots', 'Pants', 'Cloak', 'Belt', 'Gloves', 'Helm', 'Accent', 'None'];
    const LOADOUT_MATERIALS = ['Cotton', 'Wool', 'Lace', 'Leather'];
    const LOADOUT_TIERS = ['T0', 'T1', 'T2', 'T3'];

    function getCurrentTierMaterial() {
        const xp = state.currentXp + state.passXp;
        const level = getLevelFromXp(xp);
        const theme = getThemeForLevelTier(level, 0);
        return LOADOUT_MATERIALS.includes(theme) ? theme : 'Leather';
    }

    function getLoadoutDefaults() {
        const mat = getCurrentTierMaterial();
        return [
            { gearType: 'Breastplate', material: mat, tier: 'T0' },
            { gearType: 'Shield', material: mat, tier: 'T0' },
            { gearType: 'Mace', material: mat, tier: 'T0' },
            { gearType: 'Accent', material: mat, tier: 'T0' }
        ];
    }

    const PROMPT_TEMPLATES = {
        0: 'Fantasy [class] [gear] with basic [theme] [application] on the handle/edges, simple etched [motif] details starting to show, battle-ready and worn, [artStyle] D&D art style.',
        1: 'Fantasy [gear] for a [class], with added [theme] [application] over prior design, central [motif] emerging strongly, consistent with other equipped items.',
        2: 'Upgraded [class] [gear] with thicker or more intricate [theme] [application] over previous elements, reinforced structure and subtle [effect] from the material, building directly on prior active tiers.',
        3: 'Matched evolving set featuring [gear] fully layered with ornate [theme] details incorporating all prior active upgrades across equipped items, prominent [motif], elegant relic vibe, [artStyle] high-fantasy composition, highly detailed.',
        4: 'Matched evolving set featuring [gear] fully layered with ornate [theme] details incorporating all prior active upgrades across equipped items, prominent [motif], elegant relic vibe, [artStyle] high-fantasy composition, highly detailed.'
    };

    const NARRATIVE_TEMPLATES = {
        0: '[Theme] adds the first touch of durability and character.',
        1: '[Theme] reinforces your look and ties your gear together.',
        2: '[Theme] deepens the integration and adds subtle [effect].',
        3: '[Theme] completes the matched set with an elegant relic feel.',
        4: '[Theme] completes the matched set with legendary brilliance.'
    };

    const PREDEFINED_GEAR = [
        'Longsword', 'Shortsword', 'Greatsword', 'Dagger', 'Warhammer', 'Mace', 'Quarterstaff', 'Shortbow', 'Longbow', 'Crossbow, light', 'Crossbow, heavy',
        'Leather armor', 'Studded leather', 'Chain shirt', 'Scale mail', 'Breastplate', 'Half plate', 'Ring mail', 'Chain mail', 'Splint', 'Plate',
        'Shield', 'Holy symbol', 'Spellcasting focus', 'Explorer\'s pack', 'Dungeoneer\'s pack', 'Scholar\'s pack', 'Priest\'s pack',
        'Rope, hempen', 'Rope, silk', 'Thieves\' tools', 'Healer\'s kit', 'Climbing kit', 'Disguise kit'
    ];

    // Deterministic hash (plan §8)
    function hashSeed(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
        return Math.abs(h);
    }

    function deterministicIndex(seed, length) {
        return length <= 0 ? 0 : (seed % length + length) % length;
    }

    function resolveImageUrl(url) {
        if (!url) return '';
        if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url;
        if (url.startsWith('/')) return window.location.origin + url;
        return url;
    }

    function getPortraitSrc() {
        const c = state.character || {};
        if (c.portraitDataUrl && c.portraitDataUrl.startsWith('data:')) return c.portraitDataUrl;
        if (c.portraitUrl) return c.portraitUrl;
        return '';
    }

    function getPortraitAsBase64() {
        const src = getPortraitSrc();
        if (!src) return Promise.resolve(null);
        if (src.startsWith('data:')) return Promise.resolve(src);
        const url = resolveImageUrl(src);
        if (!url) return Promise.resolve(null);
        return fetch(url)
            .then(r => r.ok ? r.blob() : Promise.reject(new Error('Fetch failed')))
            .then(blob => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Read failed'));
                reader.readAsDataURL(blob);
            }))
            .catch(() => null);
    }

    // --- State ---
    let state = {
        schemaVersion: SCHEMA_VERSION,
        character: {
            name: '',
            class: '',
            artStyle: 'epic high-fantasy',
            motif: '',
            portraitDataUrl: '',
            portraitUrl: '',
            gearPool: []
        },
        currentXp: 0,
        passXp: 0,
        reseedCounter: 0,
        subTiers: [],
        gallery: [],
        lastGeneratedState: null,
        soundEnabled: false,
        look: { slots: [] },
        catalog: { customGear: [] }
    };

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.schemaVersion === SCHEMA_VERSION) {
                    state.character = { ...state.character, ...parsed.character };
                    state.currentXp = Math.max(0, parseInt(parsed.currentXp, 10) || 0);
                    state.passXp = Math.max(0, parseInt(parsed.passXp, 10) || 0);
                    state.reseedCounter = parseInt(parsed.reseedCounter, 10) || 0;
                    state.subTiers = Array.isArray(parsed.subTiers) ? parsed.subTiers : [];
                    state.gallery = Array.isArray(parsed.gallery) ? parsed.gallery.slice(0, GALLERY_CAP).map((e, i) => ({ ...e, id: e.id || 'g' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 8) })) : [];
                    if (parsed.look && Array.isArray(parsed.look.slots) && parsed.look.slots.length === 4) {
                        state.look = { slots: parsed.look.slots };
                    } else {
                        state.look = { slots: getLoadoutDefaults().map(s => ({ ...s })) };
                    }
                    if (parsed.catalog && Array.isArray(parsed.catalog.customGear)) {
                        state.catalog = { customGear: parsed.catalog.customGear };
                    }
                }
            }
            const soundRaw = localStorage.getItem(SOUND_STORAGE_KEY);
            state.soundEnabled = soundRaw === 'true';
        } catch (_) {}
        if (!state.look || !Array.isArray(state.look.slots) || state.look.slots.length !== 4) {
            state.look = { slots: getLoadoutDefaults().map(s => ({ ...s })) };
        }
        if (!state.catalog || !Array.isArray(state.catalog.customGear)) {
            state.catalog = { customGear: [] };
        }
    }

    function saveState() {
        try {
            const toSave = {
                schemaVersion: SCHEMA_VERSION,
                character: state.character,
                currentXp: state.currentXp,
                passXp: state.passXp,
                reseedCounter: state.reseedCounter,
                subTiers: state.subTiers,
                gallery: state.gallery,
                look: state.look,
                catalog: state.catalog
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (_) {}
    }

    const { getLevelFromXp, getAllUnlockedSubTiers, getThemeForLevelTier, THEMES } = window.BattlePassData;

    function ensureUnlocks() {
        const xp = state.currentXp + state.passXp;
        const unlocked = getAllUnlockedSubTiers(xp);
        const nextMeta = unlocked._nextUnlock;
        const list = unlocked.filter(x => !x._nextUnlock);
        const userPool = state.character.gearPool || [];
        const pool = userPool.length >= 2 ? userPool : GEAR_TYPES.filter(g => g !== 'None').slice(0, 6).map((label, i) => ({ id: 'default-' + i, label, custom: false }));
        const name = (state.character.name || '').trim() || 'Character';
        const reseed = String(state.reseedCounter);

        for (const u of list) {
            if (state.subTiers.some(s => s.level === u.level && s.tier === u.tier)) continue;

            const seedStr = name + u.level + u.tier + reseed;
            const seed = hashSeed(seedStr);
            const gearIndex = deterministicIndex(seed, pool.length);
            const themeName = getThemeForLevelTier(u.level, u.tier);
            const theme = THEMES[themeName];
            const appList = theme && theme.application ? theme.application : ['detail'];
            const effectList = theme && theme.effect ? theme.effect : ['effect'];
            const app = appList[deterministicIndex(seed + 1, appList.length)];
            const effect = effectList[deterministicIndex(seed + 2, effectList.length)];

            const gearId = pool[gearIndex] ? pool[gearIndex].id : (pool[0] && pool[0].id);
            const gearLabel = (pool.find(g => g.id === gearId) || {}).label || 'gear';

            let narrative = (NARRATIVE_TEMPLATES[u.tier] || NARRATIVE_TEMPLATES[0])
                .replace('[Theme]', themeName).replace('[effect]', effect);

            state.subTiers.push({
                level: u.level,
                tier: u.tier,
                xpThreshold: u.xpThreshold,
                selectedGearId: gearId,
                active: true,
                narrative,
                rewardGold: 30,
                application: app,
                effect
            });
        }
        saveState();
        return { nextMeta, list, newlyAdded: state.subTiers.length - (list.length - (unlocked._nextUnlock ? 0 : 1)) };
    }

    function buildCumulativePrompts(character, activeSubTiers, themesData) {
        const cls = character.class || 'adventurer';
        const artStyle = character.artStyle || 'epic high-fantasy';
        const motif = character.motif || 'personal motif';
        const gearById = {};
        (character.gearPool || []).forEach(g => { gearById[g.id] = g.label; });

        const capped = activeSubTiers.length > MAX_TIERS_IN_PROMPT
            ? activeSubTiers.slice(-MAX_TIERS_IN_PROMPT)
            : activeSubTiers;
        const parts = [];
        for (const s of capped) {
            const themeName = getThemeForLevelTier(s.level, s.tier);
            const gear = gearById[s.selectedGearId] || 'gear';
            const app = s.application || 'detail';
            const effect = s.effect || 'effect';
            const template = PROMPT_TEMPLATES[s.tier] || PROMPT_TEMPLATES[0];
            const filled = template
                .replace(/\[class\]/g, cls)
                .replace(/\[gear\]/g, gear)
                .replace(/\[theme\]/g, themeName)
                .replace(/\[application\]/g, app)
                .replace(/\[motif\]/g, motif)
                .replace(/\[artStyle\]/g, artStyle)
                .replace(/\[effect\]/g, effect);
            parts.push(filled);
        }

        const standaloneGearPrompt = parts.length ? parts.join(' ') : 'No active tiers—toggle some on.';
        const placeholderCharacterPrompt = `Fantasy ${cls} adventurer in starting gear, ${artStyle} D&D art style.`;
        const hasPortrait = !!getPortraitSrc();
        const compositePrompt = hasPortrait
            ? `Take this exact character portrait and equip the character with this precisely upgraded gear: ${standaloneGearPrompt}. Keep original pose, face, clothing, lighting, and ${artStyle}. Preserve existing ${motif}.`
            : `Use this character prompt first to create a base portrait: "${placeholderCharacterPrompt}". Then equip that character with: ${standaloneGearPrompt}. Preserve pose, face, and ${artStyle}.`;

        return { standaloneGearPrompt, compositePrompt, placeholderCharacterPrompt };
    }

    function getActiveSubTiers() {
        return state.subTiers.filter(s => s.active).sort((a, b) => a.level - b.level || a.tier - b.tier);
    }

    function getLoadoutSummary() {
        const slots = state.look?.slots || [];
        return slots.map(s => {
            const gt = (s.gearType || 'Accent').trim() || 'Accent';
            if (gt === 'None') return null;
            const mat = (s.material || 'Leather').trim() || 'Leather';
            const t = (s.tier || 'T0').trim() || 'T0';
            const label = gt === 'Accent' ? `${gt}: ${mat} ${t} (generic trim)` : `${gt}: ${mat} ${t}`;
            return label;
        }).filter(Boolean);
    }

    function turnOnAllTiers() {
        state.subTiers.forEach(s => { s.active = true; });
        saveState();
        renderAccordions();
        updateGenerateButton();
    }

    function turnOffAllTiers() {
        state.subTiers.forEach(s => { s.active = false; });
        saveState();
        renderAccordions();
        updateGenerateButton();
    }

    function hasNewContentSinceLastGenerate() {
        if (!state.lastGeneratedState) return true;
        const active = getActiveSubTiers();
        const prev = state.lastGeneratedState;
        if (prev.activeCount !== active.length) return true;
        const str = JSON.stringify(active.map(s => ({ level: s.level, tier: s.tier, active: s.active })));
        return str !== prev.activeSignature;
    }

    // --- Unlock sound (optional) ---
    function playUnlockSound() {
        if (!state.soundEnabled) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(523, ctx.currentTime);
            osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
        } catch (_) {}
    }

    // --- UI ---
    function renderDashboardHero() {
        const xp = state.currentXp + state.passXp;
        const level = getLevelFromXp(xp);
        const hero = document.getElementById('bp-dashboard-hero');
        const levelEl = document.getElementById('bp-hero-level');
        const themeEl = document.getElementById('bp-hero-theme');
        const fillEl = document.getElementById('bp-progress-fill');
        const ringEl = document.getElementById('bp-ring-fill');
        const nextEl = document.getElementById('bp-next-unlock-text');

        hero.setAttribute('data-level', Math.min(level, 20));
        levelEl.textContent = level;
        themeEl.textContent = getThemeForLevelTier(level, 0);

        const thresholds = window.BattlePassData.getSubTierThresholds(level);
        const startXp = thresholds[0] ? thresholds[0].xp : 0;
        const endXp = level === 20 ? 355000 : window.BattlePassData.XP_TABLE[level];
        const range = endXp - startXp;
        const pct = range ? Math.min(100, ((xp - startXp) / range) * 100) : 0;
        fillEl.style.width = pct + '%';

        const markersEl = document.getElementById('bp-progress-tier-markers');
        if (markersEl) {
            markersEl.innerHTML = '';
            for (let i = 1; i < thresholds.length; i++) {
                const t = thresholds[i];
                const leftPct = range ? ((t.xp - startXp) / range) * 100 : 0;
                const div = document.createElement('div');
                div.className = 'bp-progress-tier-marker';
                div.style.left = leftPct + '%';
                div.setAttribute('data-tier', 'T' + t.tier);
                div.setAttribute('title', 'Tier ' + t.tier);
                markersEl.appendChild(div);
            }
        }

        const unlocked = getAllUnlockedSubTiers(xp);
        const next = unlocked._nextUnlock;
        if (next) {
            const circumference = 2 * Math.PI * 16;
            const prevThreshold = next.tier === 0 ? startXp : (thresholds[next.tier - 1] ? thresholds[next.tier - 1].xp : startXp);
            const range = next.xp - prevThreshold;
            const ringPct = range <= 0 ? 0 : Math.min(1, (xp - prevThreshold) / range);
            ringEl.style.strokeDasharray = circumference;
            ringEl.style.strokeDashoffset = circumference * (1 - ringPct);
            nextEl.textContent = `Next unlock in ${next.need} XP (Level ${next.level} Tier ${next.tier})`;
        } else {
            ringEl.style.strokeDashoffset = '0';
            nextEl.textContent = 'Max tier reached!';
        }
        renderHeroPortrait();
        renderAtAGlance();
    }

    function renderAtAGlance() {
        const el = document.getElementById('bp-at-a-glance');
        if (!el) return;
        const xp = state.currentXp + state.passXp;
        const level = getLevelFromXp(xp);
        const themeName = getThemeForLevelTier(level, 0);
        const unlocked = getAllUnlockedSubTiers(xp);
        const next = unlocked._nextUnlock;
        const nextText = next ? `${next.need} XP to L${next.level}T${next.tier}` : 'Max tier';
        el.innerHTML = '<span>XP: ' + xp.toLocaleString() + '</span><span>Level: ' + level + '</span><span>Tier: ' + themeName + '</span><span>Next: ' + nextText + '</span><span>' + (state.character.name || state.character.class || '—') + '</span>';
    }

    function renderCharacterCard() {
        const nameEl = document.getElementById('bp-char-card-name');
        const classEl = document.getElementById('bp-char-card-class');
        if (nameEl) nameEl.textContent = (state.character.name || '').trim() || '—';
        if (classEl) classEl.textContent = (state.character.class || '').trim() || '—';
        renderHeroPortrait();
        renderGeneratePreview();
    }

    function renderHeroPortrait() {
        const imgEl = document.getElementById('bp-hero-portrait-img');
        const placeholderEl = document.getElementById('bp-hero-portrait-placeholder');
        const c = state.character || {};
        const url = (c.portraitDataUrl && c.portraitDataUrl.startsWith('data:'))
            ? c.portraitDataUrl
            : (c.portraitUrl || c.portraitDataUrl || '');
        const src = url ? resolveImageUrl(url) : '';
        if (imgEl && placeholderEl) {
            if (src) {
                imgEl.src = src;
                imgEl.classList.add('bp-hero-portrait-visible');
                placeholderEl.classList.add('is-hidden');
            } else {
                imgEl.removeAttribute('src');
                imgEl.classList.remove('bp-hero-portrait-visible');
                placeholderEl.classList.remove('is-hidden');
            }
        }
    }

    function renderTierCardReadOnly(s, level, themeName, container) {
        const gearLabel = (state.character.gearPool.find(g => g.id === s.selectedGearId) || {}).label || '—';
        const card = document.createElement('div');
        card.className = 'bp-tier-card';
        card.setAttribute('data-level', level);
        card.setAttribute('title', s.narrative);
        card.innerHTML = `
            <div class="bp-tier-icon">${getThemeEmoji(themeName)}</div>
            <div class="bp-tier-theme-name">${themeName} T${s.tier}</div>
            <div class="bp-tier-gear">${gearLabel}</div>
            <div class="bp-tier-narrative">${(s.narrative || '').slice(0, 60)}…</div>
        `;
        container.appendChild(card);
    }

    function getGearTypesForLoadout() {
        const custom = (state.catalog?.customGear || []).map(g => g.name || g.label).filter(Boolean);
        return [...GEAR_TYPES, ...custom.filter(n => !GEAR_TYPES.includes(n))];
    }

    function getUsedGearTypes(excludeSlotIndex) {
        const slots = state.look?.slots || [];
        const used = new Set();
        slots.forEach((s, i) => {
            if (i === excludeSlotIndex) return;
            const gt = (s.gearType || '').trim();
            if (gt && gt !== 'Accent' && gt !== 'None') used.add(gt);
        });
        return used;
    }

    function getGearIconSvg(gearType) {
        const icons = {
            Breastplate: '<path d="M12 2 L6 6 L6 10 L12 14 L18 10 L18 6 Z" fill="currentColor" stroke="currentColor" stroke-width="1"/>',
            Shield: '<path d="M12 2 L20 6 L20 14 L12 22 L4 14 L4 6 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
            Mace: '<path d="M12 2 L12 14 M10 10 L14 10 M12 14 L10 18 M12 14 L14 18" fill="none" stroke="currentColor" stroke-width="1.5"/>',
            Boots: '<path d="M6 14 L10 14 L10 20 L6 20 Z M14 14 L18 14 L18 20 L14 20 Z" fill="currentColor" stroke="currentColor" stroke-width="1"/>',
            Pants: '<path d="M8 4 L8 16 L6 20 L10 20 L10 16 M16 4 L16 16 L14 20 L18 20 L18 16" fill="none" stroke="currentColor" stroke-width="1"/>',
            Cloak: '<path d="M12 2 L20 8 L20 18 L12 22 L4 18 L4 8 Z" fill="none" stroke="currentColor" stroke-width="1"/>',
            Belt: '<path d="M4 10 L20 10 M4 12 L20 12" stroke="currentColor" stroke-width="1.5"/>',
            Gloves: '<path d="M6 8 L10 12 L10 18 L6 18 Z M14 8 L18 12 L18 18 L14 18 Z" fill="currentColor" stroke="currentColor" stroke-width="1"/>',
            Helm: '<path d="M12 2 L18 6 L18 12 L12 16 L6 12 L6 6 Z" fill="none" stroke="currentColor" stroke-width="1"/>',
            Accent: '<circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
            None: '<path d="M4 4 L20 20 M20 4 L4 20" stroke="currentColor" stroke-width="1.5"/>'
        };
        const path = icons[gearType] || icons.Accent;
        return `<svg class="bp-gear-icon" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
    }

    function renderLoadoutSlot(slot, index) {
        const used = getUsedGearTypes(index);
        const gt = slot.gearType || 'Accent';
        const mat = slot.material || 'Leather';
        const tier = slot.tier || 'T0';
        const gearTypes = getGearTypesForLoadout();
        const gearOptions = gearTypes.map(g => {
            const disabled = used.has(g) && g !== 'Accent' && g !== 'None' ? ' disabled' : '';
            const sel = gt === g ? ' selected' : '';
            return `<option value="${g}"${sel}${disabled}>${g}</option>`;
        }).join('');
        const matChips = LOADOUT_MATERIALS.map(m => {
            const active = mat === m ? ' bp-mat-chip-active' : '';
            return `<button type="button" class="bp-mat-chip bp-mat-${m.toLowerCase()}${active}" data-action="set-material" data-slot="${index}" data-value="${m}" aria-pressed="${mat === m}">${m}</button>`;
        }).join('');
        const tierSteps = LOADOUT_TIERS.map(t => {
            const active = tier === t ? ' bp-tier-step-active' : '';
            return `<button type="button" class="bp-tier-step bp-tier-${t.toLowerCase()}${active}" data-action="set-tier" data-slot="${index}" data-value="${t}" aria-pressed="${tier === t}">${t.replace('T', '')}</button>`;
        }).join('');
        return `
            <div class="bp-loadout-slot bp-gear-card card" data-slot-index="${index}">
                <div class="bp-gear-card-header">
                    <span class="bp-gear-icon-wrap">${getGearIconSvg(gt)}</span>
                    <div class="bp-gear-header-middle">
                        <span class="bp-slot-label">Slot ${index + 1}</span>
                        <select class="bp-gear-select" data-action="set-gear" data-slot="${index}" data-field="gearType" aria-label="Gear type">${gearOptions}</select>
                    </div>
                    <div class="bp-gear-header-chips">
                        <span class="bp-summary-chip bp-mat-chip bp-mat-${mat.toLowerCase()}">${mat}</span>
                        <span class="bp-summary-chip bp-tier-chip bp-tier-${tier.toLowerCase()}">${tier}</span>
                    </div>
                </div>
                <div class="bp-gear-card-body">
                    <div class="bp-mat-chip-group" role="group" aria-label="Material">
                        ${matChips}
                    </div>
                    <div class="bp-tier-step-group" role="group" aria-label="Tier">
                        ${tierSteps}
                    </div>
                </div>
            </div>
        `;
    }

    function renderLoadout() {
        const grid = document.getElementById('bp-loadout-grid');
        if (!grid) return;
        const slots = state.look?.slots || [];
        grid.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const slot = slots[i] || { gearType: 'Accent', material: 'Leather', tier: 'T0' };
            grid.insertAdjacentHTML('beforeend', renderLoadoutSlot(slot, i));
        }
    }

    function renderAccordions() {
        const xp = state.currentXp + state.passXp;
        const currentLevel = getLevelFromXp(xp);
        const byLevel = {};
        state.subTiers.forEach(s => {
            if (!byLevel[s.level]) byLevel[s.level] = [];
            byLevel[s.level].push(s);
        });
        const container = document.getElementById('bp-accordions');
        if (!container) return;
        const filterSearch = (document.getElementById('bp-filter-search') || {}).value || '';
        const search = filterSearch.toLowerCase();
        const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
        container.innerHTML = '';
        if (state.subTiers.length === 0) {
            container.innerHTML = '<p class="help-text bp-help-light">Add at least 2 gear items (Gear tab) and enter XP to unlock tiers.</p>';
            return;
        }
        for (const level of levels) {
            const themeName = getThemeForLevelTier(level, 0);
            const cards = byLevel[level];
            const visible = cards.filter(s => {
                const gearLabel = (state.character.gearPool.find(g => g.id === s.selectedGearId) || {}).label || '';
                const text = `${level} ${themeName} ${gearLabel} ${s.narrative}`.toLowerCase();
                return !search || text.includes(search);
            });
            if (visible.length === 0) continue;
            const accordion = document.createElement('div');
            accordion.className = 'bp-accordion open';
            accordion.innerHTML = `
                <button type="button" class="bp-accordion-header" aria-expanded="true">
                    <span>Level ${level} – ${themeName}</span>
                    <span class="bp-accordion-icon">▶</span>
                </button>
                <div class="bp-accordion-content"></div>
            `;
            const content = accordion.querySelector('.bp-accordion-content');
            const headerBtn = accordion.querySelector('.bp-accordion-header');
            const grid = document.createElement('div');
            grid.className = 'bp-tier-cards-grid';
            visible.forEach(s => renderTierCardReadOnly(s, level, themeName, grid));
            content.appendChild(grid);
            headerBtn.addEventListener('click', () => accordion.classList.toggle('open'));
            container.appendChild(accordion);
        }
    }

    function syncTiersAfterGearChange() {
        ensureUnlocks();
        renderDashboardHero();
        renderAccordions();
        updateGenerateButton();
    }

    function getThemeEmoji(name) {
        const map = { Cotton: '🧵', Wool: '🧶', Lace: '🎀', Leather: '👜', Silk: '👘', Wood: '🪵', Pottery: '🫖', Tin: '🥫', Bronze: '🥉', Iron: '⚙️', Steel: '🔩', Porcelain: '🪆', Crystal: '💎', Silver: '🥈', Pearl: '🦪', Coral: '🪸', Ruby: '🔴', Sapphire: '🔵', Gold: '🥇', Diamond: '💠' };
        return map[name] || '✨';
    }

    function updateXpSectionCopy() {
        const heading = document.getElementById('bp-xp-heading');
        const help = document.getElementById('bp-xp-help');
        const label = document.getElementById('bp-xp-label');
        if (!heading || !help || !label) return;
        if (state.currentXp === 0) {
            heading.textContent = 'Enter current XP';
            help.textContent = 'Set your starting XP to unlock the other tabs. This cannot be undone.';
            label.textContent = 'Current XP';
        } else {
            heading.textContent = 'Set new XP level';
            help.textContent = 'Adding more XP updates which tiers are unlocked. You cannot reduce XP. Changes are saved immediately.';
            label.textContent = 'Current XP';
        }
    }

    function isCharacterSatisfied() {
        return ((state.character && state.character.class) || '').trim() !== '';
    }

    function isGearSatisfied() {
        return true;
    }

    function isTabLocked(tabId) {
        if (state.currentXp === 0) {
            return ['character', 'catalog', 'dashboard', 'generate'].includes(tabId);
        }
        const charOk = isCharacterSatisfied();
        const gearOk = isGearSatisfied();
        if (tabId === 'character') return false;
        if (tabId === 'catalog') return !charOk;
        if (tabId === 'dashboard' || tabId === 'generate') return !charOk || !gearOk;
        return false;
    }

    function updateTabsForXp() {
        const tabOrder = ['xp', 'character', 'catalog', 'dashboard', 'generate', 'settings'];
        let activeTabId = null;
        document.querySelectorAll('.bp-tab').forEach(tab => {
            const tabId = tab.getAttribute('data-tab');
            const locked = isTabLocked(tabId);
            if (locked) {
                tab.classList.add('bp-tab-disabled');
                tab.setAttribute('aria-disabled', 'true');
            } else {
                tab.classList.remove('bp-tab-disabled');
                tab.removeAttribute('aria-disabled');
            }
            if (tab.classList.contains('active')) activeTabId = tabId;
        });
        if (activeTabId && isTabLocked(activeTabId)) {
            const firstUnlocked = tabOrder.find(id => !isTabLocked(id));
            const tab = document.querySelector('.bp-tab[data-tab="' + firstUnlocked + '"]');
            const panel = document.getElementById('bp-tab-' + firstUnlocked);
            if (tab && panel) {
                document.querySelectorAll('.bp-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.bp-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                panel.classList.add('active');
            }
        }
    }

    function bindXpAndMilestone() {
        const xpInput = document.getElementById('bp-current-xp');
        const errEl = document.getElementById('bp-xp-error');

        xpInput.value = state.currentXp;
        xpInput.addEventListener('change', () => {
            const v = parseInt(xpInput.value, 10);
            if (isNaN(v) || v < 0) {
                xpInput.value = state.currentXp;
                return;
            }
            if (v < state.currentXp) {
                errEl.textContent = `XP cannot be lower than current (${state.currentXp.toLocaleString()}).`;
                errEl.classList.remove('is-hidden');
                xpInput.value = state.currentXp;
                return;
            }
            if (v !== state.currentXp) {
                const newLevel = getLevelFromXp(v + state.passXp);
                const msg = state.currentXp === 0
                    ? `You are about to set your current XP to ${v.toLocaleString()}. This will put you in level ${newLevel}. This cannot be undone. Do you confirm?`
                    : `You are about to add ${(v - state.currentXp).toLocaleString()} XP to your current XP. This will put you in level ${newLevel}. Do you confirm?`;
                if (!confirm(msg)) {
                    xpInput.value = state.currentXp;
                    return;
                }
            }
            errEl.classList.add('is-hidden');
            state.currentXp = v;
            updateXpSectionCopy();
            updateTabsForXp();
            const before = state.subTiers.length;
            ensureUnlocks();
            renderDashboardHero();
            if (state.subTiers.length > before) playUnlockSound();
            saveState();
            updateGenerateButton();
        });
    }

    function bindTabs() {
        const app = document.querySelector('.battle-pass-app');
        if (!app) return;
        app.addEventListener('click', (e) => {
            const tab = e.target.closest('.bp-tab');
            if (!tab || tab.classList.contains('bp-tab-disabled')) return;
            const tabId = tab.getAttribute('data-tab');
            const id = 'bp-tab-' + tabId;
            document.querySelectorAll('.bp-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.bp-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById(id);
            if (panel) panel.classList.add('active');
            tab.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
            if (tabId === 'dashboard') {
                ensureUnlocks();
                renderDashboardHero();
                renderLoadout();
                updateGenerateButton();
            }
            if (tabId === 'catalog') renderCatalog();
            if (tabId === 'generate') renderGeneratePreview();
        });
    }

    const ART_STYLE_OPTIONS = ['epic high-fantasy', 'dark fantasy', 'classic D&D illustration', 'painterly fantasy', 'cinematic fantasy'];

    function bindCharacterForm() {
        const ids = ['bp-char-name', 'bp-char-class', 'bp-art-style', 'bp-motif'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const key = id.replace('bp-char-', '').replace('bp-', '').replace(/-/g, '');
            const stateKey = key === 'name' ? 'name' : key === 'class' ? 'class' : key === 'artstyle' ? 'artStyle' : 'motif';
            let initial = state.character[stateKey] || (id === 'bp-art-style' ? 'epic high-fantasy' : '');
            if (id === 'bp-art-style' && !ART_STYLE_OPTIONS.includes(initial)) {
                initial = 'epic high-fantasy';
                state.character.artStyle = initial;
                saveState();
            }
            el.value = initial;
            const event = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(event, () => {
                state.character[stateKey] = el.value;
                saveState();
                renderCharacterCard();
                updateTabsForXp();
            });
        });
        const portraitTrigger = document.getElementById('bp-portrait-trigger');
        const canonicalPortraitInput = document.getElementById('bp-hero-portrait-file');
        if (portraitTrigger && canonicalPortraitInput) {
            portraitTrigger.addEventListener('click', () => canonicalPortraitInput.click());
        }
        const soundEl = document.getElementById('bp-sound-toggle');
        if (soundEl) {
            soundEl.checked = state.soundEnabled;
            soundEl.addEventListener('change', () => {
                state.soundEnabled = soundEl.checked;
                try { localStorage.setItem(SOUND_STORAGE_KEY, soundEl.checked ? 'true' : 'false'); } catch (_) {}
            });
        }
        const reseedBtn = document.getElementById('bp-reseed-btn');
        if (reseedBtn) {
            reseedBtn.addEventListener('click', () => {
                state.reseedCounter += 1;
                saveState();
                reseedBtn.textContent = 'Reseeded! Future unlocks will use new choices.';
                setTimeout(() => { reseedBtn.textContent = 'Reseed future unlocks (new random gear/effects for next tiers only)'; }, 2000);
            });
        }
    }

    function renderCatalog() {
        const grid = document.getElementById('bp-catalog-gear-grid');
        const customList = document.getElementById('bp-custom-gear-list');
        if (!grid) return;
        const gearTypes = getGearTypesForLoadout();
        grid.innerHTML = gearTypes.filter(g => g !== 'None').map(g => {
            const svg = getGearIconSvg(g);
            return `<div class="bp-catalog-gear-item" aria-label="${g}"><span class="bp-catalog-gear-icon">${svg}</span><span class="bp-catalog-gear-name">${g}</span></div>`;
        }).join('');
        if (customList) {
            const custom = state.catalog?.customGear || [];
            customList.innerHTML = custom.map((g, i) => {
                const name = g.name || g.label || '';
                const emoji = g.emoji || '';
                return `<span class="bp-custom-gear-chip"><span class="bp-custom-gear-emoji">${emoji}</span>${name} <button type="button" class="bp-custom-gear-remove" data-index="${i}" aria-label="Remove ${name}">×</button></span>`;
            }).join('');
        }
    }

    function bindCatalog() {
        const grid = document.getElementById('bp-catalog-gear-grid');
        const nameEl = document.getElementById('bp-custom-gear-name');
        const emojiEl = document.getElementById('bp-custom-gear-emoji');
        const addBtn = document.getElementById('bp-catalog-add-custom');
        const customList = document.getElementById('bp-custom-gear-list');
        if (addBtn && nameEl) {
            addBtn.addEventListener('click', () => {
                const name = (nameEl.value || '').trim();
                if (!name) return;
                if (GEAR_TYPES.includes(name)) return;
                state.catalog = state.catalog || { customGear: [] };
                state.catalog.customGear = state.catalog.customGear || [];
                if (state.catalog.customGear.some(g => (g.name || g.label) === name)) return;
                state.catalog.customGear.push({ name, emoji: (emojiEl?.value || '').trim().slice(0, 2) });
                nameEl.value = '';
                if (emojiEl) emojiEl.value = '';
                saveState();
                renderCatalog();
                renderLoadout();
                renderGeneratePreview();
            });
        }
        if (customList) {
            customList.addEventListener('click', (e) => {
                const btn = e.target.closest('.bp-custom-gear-remove');
                if (!btn) return;
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                if (isNaN(idx)) return;
                state.catalog.customGear = (state.catalog?.customGear || []).filter((_, i) => i !== idx);
                saveState();
                renderCatalog();
                renderLoadout();
                renderGeneratePreview();
            });
        }
    }

    function updateGenerateButton() { renderGeneratePreview(); }

    function bindGenerateAndExport() {
        const composedEl = document.getElementById('bp-composed-prompt');
        const copyBtn = document.getElementById('bp-copy-prompt');
        if (copyBtn && composedEl) {
            copyBtn.addEventListener('click', () => {
                composedEl.select();
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(composedEl.value).catch(() => document.execCommand('copy'));
                } else {
                    document.execCommand('copy');
                }
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
            });
        }

        const exportBtn = document.getElementById('bp-export-json');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const blob = new Blob([JSON.stringify({
                    schemaVersion: SCHEMA_VERSION,
                    character: state.character,
                    currentXp: state.currentXp,
                    passXp: state.passXp,
                    subTiers: state.subTiers,
                    look: state.look,
                    catalog: state.catalog,
                    exportedAt: new Date().toISOString()
                }, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'cosmetic-battle-pass-build.json';
                a.click();
                URL.revokeObjectURL(a.href);
            });
        }
    }

    let lastGenResult = null;

    function buildLookPrompt() {
        const summary = getLoadoutSummary();
        if (!summary || summary.length === 0) return null;
        const cls = state.character.class || 'adventurer';
        const artStyle = state.character.artStyle || 'epic high-fantasy';
        const motif = state.character.motif || 'personal motif';
        const loadoutList = summary.join('; ');
        if (!loadoutList) return null;
        const placeholderCharacterPrompt = `Fantasy ${cls} adventurer in starting gear, ${artStyle} D&D art style.`;
        const hasPortrait = !!getPortraitSrc();
        const gearPrompt = `Equip the character with: ${loadoutList}.`;
        const compositePrompt = hasPortrait
            ? `Take this exact character portrait and ${gearPrompt.toLowerCase()} Keep original pose, face, clothing, lighting, and ${artStyle}. Preserve existing ${motif}.`
            : `Use this character prompt first to create a base portrait: "${placeholderCharacterPrompt}". Then ${gearPrompt.toLowerCase()} Preserve pose, face, and ${artStyle}.`;
        return compositePrompt;
    }

    function renderCurrentBuild() {
        const container = document.getElementById('bp-build-chips');
        if (!container) return;
        const slots = state.look?.slots || [];
        const labels = slots.map(s => {
            const gt = (s.gearType || 'Accent').trim() || 'Accent';
            if (gt === 'None') return null;
            const mat = (s.material || 'Leather').trim() || 'Leather';
            const t = (s.tier || 'T0').trim() || 'T0';
            return `${mat} ${t} ${gt}`;
        }).filter(Boolean);
        container.innerHTML = labels.length === 0
            ? '<span class="bp-build-chip bp-build-empty">All slots None</span>'
            : labels.map(l => `<span class="bp-build-chip">${l}</span>`).join('');
    }

    function renderGeneratePreview() {
        const portraitEl = document.getElementById('bp-gen-preview-portrait');
        const modelEl = document.getElementById('bp-gen-preview-model');
        const composedEl = document.getElementById('bp-composed-prompt');
        const qualityEl = document.getElementById('bp-gen-quality');
        const modelSelectEl = document.getElementById('bp-gen-model');
        const prompt = buildLookPrompt();

        if (portraitEl) {
            portraitEl.textContent = getPortraitSrc() ? 'Portrait base: Current portrait' : 'Portrait base: No portrait yet, generating from scratch';
        }
<｜tool▁call▁end｜><｜tool▁call▁begin｜>
Read
        if (modelEl && modelSelectEl && qualityEl) {
            modelEl.textContent = 'Model: ' + (modelSelectEl.value || 'gpt-image-1-mini') + ' · Quality: ' + (qualityEl.value || 'medium');
        }
        if (composedEl) composedEl.value = prompt || '';
        renderCurrentBuild();
    }

    function bindGenerateLook() {
        const btn = document.getElementById('bp-gen-generate-look');
        const qualityEl = document.getElementById('bp-gen-quality');
        const modelSelectEl = document.getElementById('bp-gen-model');
        const resultWrap = document.getElementById('bp-gen-result-wrap');
        const resultStatus = document.getElementById('bp-gen-result-status');
        const resultImageWrap = document.getElementById('bp-gen-result-image-wrap');
        const resultActions = document.getElementById('bp-gen-result-actions');
        const setPortraitBtn = document.getElementById('bp-gen-set-portrait');

        function setLoading(loading) {
            if (btn) btn.disabled = loading;
            if (resultWrap) {
                resultWrap.classList.remove('bp-gen-result-hidden');
                resultWrap.classList.add('bp-gen-result-visible');
            }
            if (resultStatus) { resultStatus.style.color = ''; resultStatus.textContent = loading ? 'Generating image…' : ''; }
            if (loading) {
                if (resultImageWrap) resultImageWrap.innerHTML = '';
                if (resultActions) {
                    resultActions.classList.add('bp-gen-result-hidden');
                    resultActions.classList.remove('bp-gen-result-visible');
                }
            }
        }

        function renderGenResult(data) {
            lastGenResult = data;
            if (!resultImageWrap || !data || !data.imageUrl) return;
            resultImageWrap.innerHTML = '';
            const img = document.createElement('img');
            img.alt = 'Generated image';
            img.className = 'bp-gen-result-img';
            const src = resolveImageUrl(data.imageUrl);
            img.onload = () => {
                if (resultStatus) resultStatus.textContent = 'Done. Saved to gallery. Set as portrait below.';
                if (resultActions) {
                    resultActions.classList.remove('bp-gen-result-hidden');
                    resultActions.classList.add('bp-gen-result-visible');
                }
                if (resultWrap) resultWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            };
            img.onerror = () => {
                if (resultStatus) {
                    resultStatus.textContent = 'Image failed to load. src: ' + (src ? src.slice(0, 80) + '…' : 'empty');
                    resultStatus.style.color = 'var(--error)';
                }
                if (resultActions) {
                    resultActions.classList.add('bp-gen-result-hidden');
                    resultActions.classList.remove('bp-gen-result-visible');
                }
            };
            resultImageWrap.appendChild(img);
            img.src = src;
        }

        function showResult(result) {
            lastGenResult = result;
            if (resultStatus) resultStatus.textContent = 'Generated. Loading image…';
            if (resultStatus) resultStatus.style.color = '';
            if (resultWrap) {
                resultWrap.classList.remove('bp-gen-result-hidden');
                resultWrap.classList.add('bp-gen-result-visible');
            }
            if (resultImageWrap && result.imageUrl) renderGenResult(result);
            if (result?.imageUrl) {
                if (state.gallery.length >= GALLERY_CAP) state.gallery.shift();
                state.gallery.push({
                    id: galleryEntryId(),
                    imageUrl: result.imageUrl,
                    promptUsed: result.promptUsed,
                    model: result.model,
                    size: result.size,
                    quality: result.quality,
                    createdAt: result.createdAt
                });
                saveState();
                renderGallery();
            }
        }

        function showError(msg) {
            lastGenResult = null;
            if (resultStatus) {
                resultStatus.textContent = msg;
                resultStatus.style.color = 'var(--error)';
            }
            if (resultImageWrap) resultImageWrap.innerHTML = '';
            if (resultActions) {
                resultActions.classList.add('bp-gen-result-hidden');
                resultActions.classList.remove('bp-gen-result-visible');
            }
        }

        if (btn) {
            btn.addEventListener('click', async () => {
                const prompt = buildLookPrompt();
                if (!prompt) {
                    showError('Set at least one loadout slot to a gear type other than None.');
                    return;
                }
                setLoading(true);
                try {
                    const image = await getPortraitAsBase64();
                    const body = {
                        prompt,
                        model: modelSelectEl ? modelSelectEl.value : 'gpt-image-1-mini',
                        size: '1024x1536',
                        quality: qualityEl ? qualityEl.value : 'medium'
                    };
                    if (image) body.image = image;
                    const res = await fetch('/api/generate-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        showError(data.error || res.statusText || 'Request failed');
                        return;
                    }
                    showResult(data);
                } catch (e) {
                    showError('Network error: ' + (e.message || 'failed'));
                } finally {
                    setLoading(false);
                }
            });
        }

        if (setPortraitBtn) {
            setPortraitBtn.addEventListener('click', () => {
                if (!lastGenResult) return;
                state.character.portraitUrl = lastGenResult.imageUrl;
                state.character.portraitDataUrl = '';
                saveState();
                renderHeroPortrait();
                renderGeneratePreview();
            });
        }
        if (qualityEl) qualityEl.addEventListener('change', renderGeneratePreview);
        if (modelSelectEl) modelSelectEl.addEventListener('change', renderGeneratePreview);
    }

    function compressImageDataUrl(dataUrl, maxSize) {
        maxSize = maxSize || 800;
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > maxSize || h > maxSize) {
                    if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                    else { w = Math.round(w * maxSize / h); h = maxSize; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(dataUrl); return; }
                ctx.drawImage(img, 0, 0, w, h);
                try {
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                } catch (_) {
                    resolve(dataUrl);
                }
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    }

    function galleryEntryId() {
        return 'g' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    }

    function renderGallery() {
        const container = document.getElementById('bp-gallery');
        if (!container) return;
        container.innerHTML = '';
        (state.gallery || []).forEach((entry) => {
            const id = entry.id || galleryEntryId();
            if (!entry.id) entry.id = id;
            const item = document.createElement('div');
            item.className = 'bp-gallery-item';
            item.setAttribute('data-gallery-id', id);
            const rawSrc = entry.dataUrl || entry.imageUrl;
            const src = rawSrc ? resolveImageUrl(rawSrc) : '';
            const img = src ? document.createElement('img') : null;
            if (img) {
                img.src = src;
                img.alt = entry.caption || entry.promptUsed?.slice(0, 40) || 'Gallery image';
            }
            const actions = document.createElement('div');
            actions.className = 'bp-gallery-item-actions';
            const dl = document.createElement('button');
            dl.type = 'button';
            dl.className = 'btn-secondary';
            dl.textContent = 'Download';
            dl.setAttribute('data-action', 'download');
            dl.setAttribute('data-gallery-id', id);
            const setPortrait = document.createElement('button');
            setPortrait.type = 'button';
            setPortrait.className = 'btn-secondary';
            setPortrait.textContent = 'Set portrait';
            setPortrait.setAttribute('data-action', 'set-portrait');
            setPortrait.setAttribute('data-gallery-id', id);
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn-secondary';
            del.textContent = 'Delete';
            del.setAttribute('data-action', 'delete');
            del.setAttribute('data-gallery-id', id);
            actions.appendChild(dl);
            actions.appendChild(setPortrait);
            actions.appendChild(del);
            item.appendChild(img || document.createElement('div'));
            item.appendChild(actions);
            container.appendChild(item);
        });
    }

    function handleGalleryAction(action, entryId) {
        const entry = (state.gallery || []).find(e => e.id === entryId);
        if (!entry) return;
        if (action === 'download') {
            const rawSrc = entry.dataUrl || entry.imageUrl;
            const href = rawSrc ? resolveImageUrl(rawSrc) : '';
            if (entry.dataUrl) {
                const a = document.createElement('a');
                a.href = entry.dataUrl;
                a.download = (entry.caption || 'battle-pass-image') + '.png';
                a.click();
            } else if (entry.imageUrl) {
                const a = document.createElement('a');
                a.href = resolveImageUrl(entry.imageUrl);
                a.download = (entry.promptUsed?.slice(0, 20) || 'generated') + '.png';
                a.target = '_blank';
                a.rel = 'noopener';
                a.click();
            }
        } else if (action === 'set-portrait') {
            if (entry.dataUrl) {
                state.character.portraitDataUrl = entry.dataUrl;
                state.character.portraitUrl = '';
            } else if (entry.imageUrl) {
                state.character.portraitUrl = entry.imageUrl;
                state.character.portraitDataUrl = '';
            }
            saveState();
            renderCharacterCard();
        } else if (action === 'delete') {
            if (!confirm('Delete this image from the gallery?')) return;
            state.gallery = state.gallery.filter(e => e.id !== entryId);
            saveState();
            renderGallery();
        }
    }

    function openLightbox(src) {
        const lightbox = document.getElementById('bp-lightbox');
        const imgEl = lightbox?.querySelector('.bp-lightbox-img');
        if (!lightbox || !imgEl) return;
        imgEl.src = src;
        lightbox.classList.add('bp-lightbox-open');
        lightbox.setAttribute('aria-hidden', 'false');
    }

    function closeLightbox() {
        const lightbox = document.getElementById('bp-lightbox');
        const imgEl = lightbox?.querySelector('.bp-lightbox-img');
        if (!lightbox || !imgEl) return;
        lightbox.classList.remove('bp-lightbox-open');
        lightbox.setAttribute('aria-hidden', 'true');
        imgEl.removeAttribute('src');
    }

    function bindLightbox() {
        const lightbox = document.getElementById('bp-lightbox');
        if (!lightbox) return;
        const closeBtn = lightbox.querySelector('.bp-lightbox-close');
        const backdrop = lightbox.querySelector('.bp-lightbox-backdrop');
        if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
        if (backdrop) backdrop.addEventListener('click', closeLightbox);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.classList.contains('bp-lightbox-open')) {
                closeLightbox();
            }
        });
    }

    function bindGalleryAdd() {
        const galleryEl = document.getElementById('bp-gallery');
        if (galleryEl) {
            galleryEl.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-action][data-gallery-id]');
                if (btn) {
                    handleGalleryAction(btn.getAttribute('data-action'), btn.getAttribute('data-gallery-id'));
                    return;
                }
                const img = e.target.closest('.bp-gallery-item img');
                if (img && img.src) {
                    openLightbox(img.src);
                }
            });
        }
    }

    function bindLoadout() {
        const grid = document.getElementById('bp-loadout-grid');
        const resetBtn = document.getElementById('bp-loadout-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                state.look = { slots: getLoadoutDefaults().map(s => ({ ...s })) };
                saveState();
                renderLoadout();
                renderGeneratePreview();
            });
        }
        if (grid) {
            function updateSlot(idx, field, value) {
                if (isNaN(idx) || idx < 0 || idx > 3) return;
                if (!state.look) state.look = { slots: getLoadoutDefaults().map(s => ({ ...s })) };
                while (state.look.slots.length <= idx) {
                    state.look.slots.push({ gearType: 'Accent', material: 'Leather', tier: 'T0' });
                }
                state.look.slots[idx] = { ...state.look.slots[idx], [field]: value };
                saveState();
                renderLoadout();
                renderGeneratePreview();
            }
            grid.addEventListener('change', (e) => {
                const sel = e.target.closest('select[data-action="set-gear"]');
                if (!sel) return;
                const idx = parseInt(sel.getAttribute('data-slot'), 10);
                updateSlot(idx, 'gearType', sel.value);
            });
            grid.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action="set-material"], [data-action="set-tier"]');
                if (!btn) return;
                const action = btn.getAttribute('data-action');
                const idx = parseInt(btn.getAttribute('data-slot'), 10);
                const value = btn.getAttribute('data-value');
                if (action === 'set-material') updateSlot(idx, 'material', value);
                else if (action === 'set-tier') updateSlot(idx, 'tier', value);
            });
        }
    }

    function resetEverything() {
        if (!confirm('Reset everything? This clears your character, XP, tiers, and gallery. This cannot be undone.')) return;
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(SOUND_STORAGE_KEY);
        } catch (_) {}
        location.reload();
    }

    function bindReset() {
        const btn = document.getElementById('bp-reset-all');
        if (btn) btn.addEventListener('click', resetEverything);
    }

    function bindHeroPortrait() {
        const fileEl = document.getElementById('bp-hero-portrait-file');
        const wrap = document.getElementById('bp-hero-portrait-wrap');
        if (fileEl) {
            fileEl.addEventListener('change', (e) => {
                const f = e.target.files[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = async () => {
                    let dataUrl = r.result;
                    dataUrl = await compressImageDataUrl(dataUrl, 800);
                    state.character.portraitDataUrl = dataUrl;
                    state.character.portraitUrl = '';
                    saveState();
                    renderHeroPortrait();
                    renderGeneratePreview();
                };
                r.readAsDataURL(f);
                fileEl.value = '';
            });
        }
        function triggerUpload() {
            if (fileEl) fileEl.click();
        }
        if (wrap) {
            wrap.addEventListener('click', triggerUpload);
            wrap.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerUpload();
                }
            });
        }
    }

    function init() {
        loadState();
        state.character.gearPool = state.character.gearPool || [];
        ensureUnlocks();
        renderDashboardHero();
        renderCharacterCard();
        bindHeroPortrait();
        bindXpAndMilestone();
        bindTabs();
        bindCharacterForm();
        bindCatalog();
        bindLoadout();
        renderCatalog();
        renderLoadout();
        bindGenerateAndExport();
        bindGenerateLook();
        bindReset();
        bindLightbox();
        bindGalleryAdd();
        renderGallery();
        updateGenerateButton();
        updateXpSectionCopy();
        updateTabsForXp();
    }

    init();
})();
