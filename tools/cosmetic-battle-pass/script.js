// D&D Cosmetic Battle Pass – main app (plan §§2–13)

(function () {
    'use strict';

    const SCHEMA_VERSION = '1.0.0';
    const STORAGE_KEY = 'dnd-cosmetic-battle-pass';
    const SOUND_STORAGE_KEY = 'dnd-cosmetic-battle-pass-sound';
    const GALLERY_CAP = 20;
    const MAX_TIERS_IN_PROMPT = 12;

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

    function getPortraitAsBase64() {
        const c = state.character || {};
        if (c.portraitDataUrl && c.portraitDataUrl.startsWith('data:')) return Promise.resolve(c.portraitDataUrl);
        if (c.portraitUrl) {
            const url = resolveImageUrl(c.portraitUrl);
            if (!url) return Promise.resolve(null);
            return fetch(url)
                .then(r => r.ok ? r.blob() : Promise.reject(new Error('Fetch failed')))
                .then(blob => new Promise((resolve, reject) => {
                    const r = new FileReader();
                    r.onload = () => resolve(r.result);
                    r.onerror = () => reject(new Error('Read failed'));
                    r.readAsDataURL(blob);
                }))
                .catch(() => null);
        }
        return Promise.resolve(null);
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
        soundEnabled: false
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
                }
            }
            const soundRaw = localStorage.getItem(SOUND_STORAGE_KEY);
            state.soundEnabled = soundRaw === 'true';
        } catch (_) {}
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
                gallery: state.gallery
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
        const pool = state.character.gearPool || [];
        const name = (state.character.name || '').trim() || 'Character';
        const reseed = String(state.reseedCounter);
        if (pool.length < 2) {
            saveState();
            return { nextMeta: unlocked._nextUnlock, list: [], newlyAdded: 0 };
        }

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
        const hasPortrait = (character.portraitDataUrl && character.portraitDataUrl.startsWith('data:')) || character.portraitUrl;
        const compositePrompt = hasPortrait
            ? `Take this exact character portrait and equip the character with this precisely upgraded gear: ${standaloneGearPrompt}. Keep original pose, face, clothing, lighting, and ${artStyle}. Preserve existing ${motif}.`
            : `Use this character prompt first to create a base portrait: "${placeholderCharacterPrompt}". Then equip that character with: ${standaloneGearPrompt}. Preserve pose, face, and ${artStyle}.`;

        return { standaloneGearPrompt, compositePrompt, placeholderCharacterPrompt };
    }

    function getActiveSubTiers() {
        return state.subTiers.filter(s => s.active).sort((a, b) => a.level - b.level || a.tier - b.tier);
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

    // --- Confetti (mini burst) ---
    function runMiniConfetti(container) {
        const colors = ['#ffd700', '#51cf66', '#ff6b6b', '#5eb8e0'];
        for (let i = 0; i < 25; i++) {
            const p = document.createElement('div');
            p.style.cssText = `position:absolute;left:50%;top:50%;width:6px;height:6px;background:${colors[i % colors.length]};border-radius:2px;pointer-events:none;`;
            p.style.transform = `translate(-50%,-50%) rotate(${i * 15}deg) translateY(-${20 + Math.random() * 30}px)`;
            p.style.animation = 'bp-confetti-fade 0.8s ease-out forwards';
            container.appendChild(p);
            setTimeout(() => p.remove(), 800);
        }
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

    function renderTierCard(s, level, themeName, container) {
        const gearLabel = (state.character.gearPool.find(g => g.id === s.selectedGearId) || {}).label || '—';
        const card = document.createElement('div');
        card.className = 'bp-tier-card' + (s.active ? ' active' : '');
        card.setAttribute('data-level', level);
        card.setAttribute('title', s.narrative);
        card.innerHTML = `
            <div class="bp-tier-icon">${getThemeEmoji(themeName)}</div>
            <div class="bp-tier-theme-name">${themeName} T${s.tier}</div>
            <div class="bp-tier-gear">${gearLabel}</div>
            <div class="bp-tier-narrative">${(s.narrative || '').slice(0, 60)}…</div>
            <div class="bp-tier-toggle-wrap">
                <input type="checkbox" id="tier-${s.level}-${s.tier}" ${s.active ? 'checked' : ''} aria-label="Include in look">
                <label for="tier-${s.level}-${s.tier}">Include in look</label>
            </div>
        `;
        const cb = card.querySelector('input[type="checkbox"]');
        cb.addEventListener('change', () => {
            s.active = cb.checked;
            card.classList.toggle('active', s.active);
            saveState();
            updateGenerateButton();
        });
        container.appendChild(card);
    }

    function renderAccordions() {
        const xp = state.currentXp + state.passXp;
        const currentLevel = getLevelFromXp(xp);

        const byLevel = {};
        state.subTiers.forEach(s => {
            if (!byLevel[s.level]) byLevel[s.level] = [];
            byLevel[s.level].push(s);
        });

        // 1) Current level only – visible tier cards with toggles (no accordion)
        const currentContainer = document.getElementById('bp-current-level-tiers');
        const currentHeading = document.getElementById('bp-current-level-num');
        const currentHint = document.getElementById('bp-current-level-hint');
        const otherSection = document.getElementById('bp-other-levels-section');
        const currentTiers = byLevel[currentLevel] || [];

        if (currentHeading) currentHeading.textContent = currentLevel;
        if (currentContainer) {
            currentContainer.innerHTML = '';
            if (currentTiers.length === 0) {
                currentContainer.innerHTML = '<p class="help-text bp-help-light">No tiers unlocked yet. Add at least 2 gear items (Gear tab) and enter XP to unlock tiers for this level.</p>';
            } else {
                const themeName = getThemeForLevelTier(currentLevel, 0);
                currentTiers.forEach(s => renderTierCard(s, currentLevel, themeName, currentContainer));
            }
        }
        if (currentHint) currentHint.textContent = currentTiers.length ? 'Toggle which tiers to include in your generated prompts.' : '';

        // 2) All other levels – accordions (default open)
        const container = document.getElementById('bp-accordions');
        const filterSearch = (document.getElementById('bp-filter-search') || {}).value || '';
        const search = filterSearch.toLowerCase();

        const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b).filter(L => L < currentLevel);
        if (otherSection) otherSection.classList.toggle('is-hidden', state.subTiers.length === 0);

        container.innerHTML = '';
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
            visible.forEach(s => renderTierCard(s, level, themeName, grid));
            content.appendChild(grid);
            headerBtn.addEventListener('click', () => {
                accordion.classList.toggle('open');
            });
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
        return (state.character.gearPool || []).length >= 2;
    }

    function isTabLocked(tabId) {
        if (state.currentXp === 0) {
            return ['character', 'gear', 'dashboard', 'generate'].includes(tabId);
        }
        const charOk = isCharacterSatisfied();
        const gearOk = isGearSatisfied();
        if (tabId === 'character') return false;
        if (tabId === 'gear') return !charOk;
        if (tabId === 'dashboard' || tabId === 'generate') return !charOk || !gearOk;
        return false;
    }

    function updateTabsForXp() {
        const tabOrder = ['xp', 'character', 'gear', 'dashboard', 'generate', 'settings'];
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
            renderAccordions();
            if (state.subTiers.length > before) {
                playUnlockSound();
                const wrap = document.getElementById('bp-confetti-wrap');
                if (wrap) runMiniConfetti(wrap);
            }
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
                renderAccordions();
                updateGenerateButton();
            }
            if (tabId === 'generate') runGeneratePrompts();
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

    function bindGearPool() {
        const listEl = document.getElementById('bp-gear-list');
        const searchEl = document.getElementById('bp-gear-search');
        const customEl = document.getElementById('bp-gear-custom');
        const addBtn = document.getElementById('bp-gear-add-custom');
        const poolEl = document.getElementById('bp-gear-pool');
        const errEl = document.getElementById('bp-gear-error');

        function renderPool() {
            poolEl.innerHTML = '';
            (state.character.gearPool || []).forEach(g => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'bp-gear-chip';
                chip.textContent = g.label + ' ×';
                chip.setAttribute('aria-label', 'Remove ' + g.label + ' from gear pool');
                chip.addEventListener('click', () => {
                    state.character.gearPool = state.character.gearPool.filter(x => x.id !== g.id);
                    saveState();
                    renderPool();
                    renderPredefinedList(searchEl.value);
                    syncTiersAfterGearChange();
                    updateTabsForXp();
                });
                poolEl.appendChild(chip);
            });
            const count = (state.character.gearPool || []).length;
            if (count < 2) {
                errEl.textContent = 'Add at least 2 items to your gear pool.';
                errEl.classList.remove('is-hidden');
            } else {
                errEl.classList.add('is-hidden');
            }
        }

        function renderPredefinedList(filter) {
            const q = (filter || '').toLowerCase();
            const poolIds = (state.character.gearPool || []).map(g => g.label);
            const frag = document.createDocumentFragment();
            PREDEFINED_GEAR
                .filter(label => !poolIds.includes(label) && (!q || label.toLowerCase().includes(q)))
                .forEach(label => {
                    const item = document.createElement('div');
                    item.className = 'bp-gear-list-item';
                    item.textContent = label;
                    item.addEventListener('click', () => {
                        const id = 'gear-' + label.replace(/\s/g, '-') + '-' + Date.now();
                        state.character.gearPool = state.character.gearPool || [];
                        state.character.gearPool.push({ id, label, custom: false });
                        saveState();
                        renderPool();
                        renderPredefinedList(searchEl.value);
                        syncTiersAfterGearChange();
                        updateTabsForXp();
                    });
                    frag.appendChild(item);
                });
            listEl.innerHTML = '';
            listEl.appendChild(frag);
        }

        if (searchEl) {
            searchEl.addEventListener('input', () => renderPredefinedList(searchEl.value));
        }
        addBtn.addEventListener('click', () => {
            const label = (customEl.value || '').trim();
            if (!label) return;
            const id = 'gear-custom-' + Date.now();
            state.character.gearPool = state.character.gearPool || [];
            state.character.gearPool.push({ id, label, custom: true });
            customEl.value = '';
            saveState();
            renderPool();
            syncTiersAfterGearChange();
            updateTabsForXp();
        });
        renderPool();
        renderPredefinedList();
    }

    function updateGenerateButton() { /* No button; kept for call-site compatibility */ }

    function runGeneratePrompts() {
        const statusEl = document.getElementById('bp-generate-status');
        const standaloneEl = document.getElementById('bp-standalone-prompt');
        const placeholderEl = document.getElementById('bp-placeholder-prompt');
        const compositeEl = document.getElementById('bp-composite-prompt');
        if (!statusEl || !standaloneEl) return;
        const active = getActiveSubTiers();
        if (active.length === 0) {
            statusEl.textContent = 'Add at least 2 gear items (Gear tab) and set your XP. Tiers will appear on the Tiers tab—toggle some on, then return here.';
            statusEl.style.color = 'var(--error)';
            statusEl.classList.remove('is-hidden');
            if (standaloneEl) standaloneEl.value = '';
            if (placeholderEl) placeholderEl.value = '';
            if (compositeEl) compositeEl.value = '';
            return;
        }
        if ((state.character.gearPool || []).length < 2) {
            statusEl.textContent = 'Add at least 2 items to your gear pool first (Gear tab).';
            statusEl.style.color = 'var(--error)';
            statusEl.classList.remove('is-hidden');
            return;
        }
        const result = buildCumulativePrompts(state.character, active, THEMES);
        standaloneEl.value = result.standaloneGearPrompt;
        placeholderEl.value = result.placeholderCharacterPrompt;
        compositeEl.value = result.compositePrompt;
        state.lastGeneratedState = {
            activeCount: active.length,
            activeSignature: JSON.stringify(active.map(s => ({ level: s.level, tier: s.tier, active: s.active })))
        };
        saveState();
        statusEl.textContent = 'Prompts generated. Copy and paste into your image AI.';
        statusEl.style.color = '';
        statusEl.classList.remove('is-hidden');
        const wrap = document.getElementById('bp-confetti-wrap');
        if (wrap) runMiniConfetti(wrap);
    }

    function bindGenerateAndExport() {
        const standaloneEl = document.getElementById('bp-standalone-prompt');
        const placeholderEl = document.getElementById('bp-placeholder-prompt');
        const compositeEl = document.getElementById('bp-composite-prompt');

        ['bp-copy-standalone', 'bp-copy-placeholder', 'bp-copy-composite'].forEach((id, i) => {
            const copyBtn = document.getElementById(id);
            const source = [standaloneEl, placeholderEl, compositeEl][i];
            if (copyBtn && source) {
                copyBtn.addEventListener('click', () => {
                    source.select();
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(source.value).catch(() => document.execCommand('copy'));
                    } else {
                        document.execCommand('copy');
                    }
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
                });
            }
        });

        const exportBtn = document.getElementById('bp-export-json');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const blob = new Blob([JSON.stringify({
                    schemaVersion: SCHEMA_VERSION,
                    character: state.character,
                    currentXp: state.currentXp,
                    passXp: state.passXp,
                    subTiers: state.subTiers,
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

    function bindGenerateImageApi() {
        const qualityEl = document.getElementById('bp-gen-quality');
        const modelEl = document.getElementById('bp-gen-model');
        const standaloneBtn = document.getElementById('bp-gen-standalone');
        const placeholderBtn = document.getElementById('bp-gen-placeholder');
        const compositeBtn = document.getElementById('bp-gen-composite');
        const resultWrap = document.getElementById('bp-gen-result-wrap');
        const resultStatus = document.getElementById('bp-gen-result-status');
        const resultImageWrap = document.getElementById('bp-gen-result-image-wrap');
        const resultActions = document.getElementById('bp-gen-result-actions');
        const addGalleryBtn = document.getElementById('bp-gen-add-gallery');
        const setPortraitBtn = document.getElementById('bp-gen-set-portrait');

        function getPromptFromButton(btnId) {
            const id = btnId === 'bp-gen-standalone' ? 'bp-standalone-prompt' : btnId === 'bp-gen-placeholder' ? 'bp-placeholder-prompt' : 'bp-composite-prompt';
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        }

        function setLoading(loading) {
            [standaloneBtn, placeholderBtn, compositeBtn].forEach(b => { if (b) b.disabled = loading; });
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
                if (resultStatus) resultStatus.textContent = 'Done. Add to gallery or set as portrait.';
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

        async function runGenerate(prompt, image) {
            if (!prompt) {
                showError('Generate prompts first (toggle tiers and ensure prompts are filled).');
                return;
            }
            setLoading(true);
            try {
                const body = {
                    prompt,
                    model: modelEl ? modelEl.value : 'gpt-image-1-mini',
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
        }

        if (standaloneBtn) standaloneBtn.addEventListener('click', () => runGenerate(getPromptFromButton('bp-gen-standalone')));
        if (placeholderBtn) placeholderBtn.addEventListener('click', () => runGenerate(getPromptFromButton('bp-gen-placeholder')));
        if (compositeBtn) compositeBtn.addEventListener('click', async () => {
            const prompt = getPromptFromButton('bp-gen-composite');
            const image = await getPortraitAsBase64();
            runGenerate(prompt, image || undefined);
        });

        if (addGalleryBtn) {
            addGalleryBtn.addEventListener('click', () => {
                if (!lastGenResult) return;
                if (state.gallery.length >= GALLERY_CAP) state.gallery.shift();
                state.gallery.push({
                    id: galleryEntryId(),
                    imageUrl: lastGenResult.imageUrl,
                    promptUsed: lastGenResult.promptUsed,
                    model: lastGenResult.model,
                    size: lastGenResult.size,
                    quality: lastGenResult.quality,
                    createdAt: lastGenResult.createdAt
                });
                saveState();
                renderGallery();
            });
        }
        if (setPortraitBtn) {
            setPortraitBtn.addEventListener('click', () => {
                if (!lastGenResult) return;
                state.character.portraitUrl = lastGenResult.imageUrl;
                state.character.portraitDataUrl = '';
                saveState();
                renderHeroPortrait();
            });
        }
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
            state.gallery = state.gallery.filter(e => e.id !== entryId);
            saveState();
            renderGallery();
        }
    }

    function bindGalleryAdd() {
        const addEl = document.getElementById('bp-gallery-add');
        const galleryEl = document.getElementById('bp-gallery');
        if (!addEl) return;
        addEl.addEventListener('change', (e) => {
            const f = e.target.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = async () => {
                let dataUrl = r.result;
                dataUrl = await compressImageDataUrl(dataUrl, 800);
                if (state.gallery.length >= GALLERY_CAP) state.gallery.shift();
                state.gallery.push({ id: galleryEntryId(), dataUrl, caption: 'Image ' + (state.gallery.length + 1) });
                saveState();
                renderGallery();
            };
            r.readAsDataURL(f);
            addEl.value = '';
        });
        if (galleryEl) {
            galleryEl.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-action][data-gallery-id]');
                if (!btn) return;
                handleGalleryAction(btn.getAttribute('data-action'), btn.getAttribute('data-gallery-id'));
            });
        }
    }

    function bindFilters() {
        const searchEl = document.getElementById('bp-filter-search');
        if (searchEl) searchEl.addEventListener('input', renderAccordions);
        const accordionsContainer = document.getElementById('bp-accordions');
        const turnOnAll = document.getElementById('bp-turn-on-all');
        const turnOffAll = document.getElementById('bp-turn-off-all');
        const expandAll = document.getElementById('bp-expand-all');
        const collapseAll = document.getElementById('bp-collapse-all');
        if (turnOnAll) turnOnAll.addEventListener('click', turnOnAllTiers);
        if (turnOffAll) turnOffAll.addEventListener('click', turnOffAllTiers);
        if (expandAll && accordionsContainer) {
            expandAll.addEventListener('click', () => {
                accordionsContainer.querySelectorAll('.bp-accordion').forEach(acc => acc.classList.add('open'));
            });
        }
        if (collapseAll && accordionsContainer) {
            collapseAll.addEventListener('click', () => {
                accordionsContainer.querySelectorAll('.bp-accordion').forEach(acc => acc.classList.remove('open'));
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
        bindGearPool();
        bindFilters();
        renderAccordions();
        bindGenerateAndExport();
        bindGenerateImageApi();
        bindReset();
        bindGalleryAdd();
        renderGallery();
        updateGenerateButton();
        updateXpSectionCopy();
        updateTabsForXp();
    }

    init();
})();
