// D&D Cosmetic Battle Pass – main app (plan §§2–13)

(function () {
    'use strict';

    const SCHEMA_VERSION = '1.0.0';
    const STORAGE_KEY = 'dnd-cosmetic-battle-pass';
    const SOUND_STORAGE_KEY = 'dnd-cosmetic-battle-pass-sound';
    const GALLERY_CAP = 20;

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

    // --- State ---
    let state = {
        schemaVersion: SCHEMA_VERSION,
        character: {
            name: '',
            class: '',
            artStyle: 'epic high-fantasy',
            motif: '',
            portraitDataUrl: '',
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
                    state.gallery = Array.isArray(parsed.gallery) ? parsed.gallery.slice(0, GALLERY_CAP) : [];
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

        const parts = [];
        for (const s of activeSubTiers) {
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
        const compositePrompt = character.portraitDataUrl
            ? `Take this exact character portrait and equip the character with this precisely upgraded gear: ${standaloneGearPrompt}. Keep original pose, face, clothing, lighting, and ${artStyle}. Preserve existing ${motif}.`
            : `Use this character prompt first to create a base portrait: "${placeholderCharacterPrompt}". Then equip that character with: ${standaloneGearPrompt}. Preserve pose, face, and ${artStyle}.`;

        return { standaloneGearPrompt, compositePrompt, placeholderCharacterPrompt };
    }

    function getActiveSubTiers() {
        return state.subTiers.filter(s => s.active).sort((a, b) => a.level - b.level || a.tier - b.tier);
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
        const otherDetails = document.getElementById('bp-other-levels-details');
        const currentTiers = byLevel[currentLevel] || [];

        if (currentHeading) currentHeading.textContent = currentLevel;
        if (currentContainer) {
            currentContainer.innerHTML = '';
            if (currentTiers.length === 0) {
                currentContainer.innerHTML = '<p class="help-text" style="color:var(--text-light);">No tiers unlocked yet. Add at least 2 gear items (Character &amp; Gear tab) and enter XP to unlock tiers for this level.</p>';
            } else {
                const themeName = getThemeForLevelTier(currentLevel, 0);
                currentTiers.forEach(s => renderTierCard(s, currentLevel, themeName, currentContainer));
            }
        }
        if (currentHint) currentHint.textContent = currentTiers.length ? 'Toggle which tiers to include in your generated prompts.' : '';

        // 2) Other levels (past only) – accordions
        const container = document.getElementById('bp-accordions');
        const filterSearch = (document.getElementById('bp-filter-search') || {}).value || '';
        const filterLevel = (document.getElementById('bp-filter-level') || {}).value;
        const filterTheme = (document.getElementById('bp-filter-theme') || {}).value;
        const search = filterSearch.toLowerCase();

        const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b).filter(L => L < currentLevel);
        if (otherDetails) otherDetails.style.display = levels.length === 0 ? 'none' : 'block';

        container.innerHTML = '';
        for (const level of levels) {
            const themeName = getThemeForLevelTier(level, 0);
            if (filterLevel && String(level) !== filterLevel) continue;
            if (filterTheme && themeName !== filterTheme) continue;

            const cards = byLevel[level];
            const visible = cards.filter(s => {
                const gearLabel = (state.character.gearPool.find(g => g.id === s.selectedGearId) || {}).label || '';
                const text = `${level} ${themeName} ${gearLabel} ${s.narrative}`.toLowerCase();
                return !search || text.includes(search);
            });
            if (visible.length === 0) continue;

            const accordion = document.createElement('div');
            accordion.className = 'bp-accordion';
            accordion.innerHTML = `
                <button type="button" class="bp-accordion-header" aria-expanded="false">
                    <span>Level ${level} – ${themeName}</span>
                    <span class="bp-accordion-icon">▶</span>
                </button>
                <div class="bp-accordion-content"></div>
            `;
            const content = accordion.querySelector('.bp-accordion-content');
            const grid = document.createElement('div');
            grid.className = 'bp-tier-cards-grid';
            visible.forEach(s => renderTierCard(s, level, themeName, grid));
            content.appendChild(grid);
            accordion.querySelector('.bp-accordion-header').addEventListener('click', () => {
                accordion.classList.toggle('open');
            });
            container.appendChild(accordion);
        }
    }

    function getThemeEmoji(name) {
        const map = { Cotton: '🧵', Wool: '🧶', Lace: '🎀', Leather: '👜', Silk: '👘', Wood: '🪵', Pottery: '🫖', Tin: '🥫', Bronze: '🥉', Iron: '⚙️', Steel: '🔩', Porcelain: '🪆', Crystal: '💎', Silver: '🥈', Pearl: '🦪', Coral: '🪸', Ruby: '🔴', Sapphire: '🔵', Gold: '🥇', Diamond: '💠' };
        return map[name] || '✨';
    }

    function bindXpAndMilestone() {
        const xpInput = document.getElementById('bp-current-xp');
        const errEl = document.getElementById('bp-xp-error');
        const milestoneBtn = document.getElementById('bp-milestone-btn');

        xpInput.value = state.currentXp;
        xpInput.addEventListener('change', () => {
            const v = parseInt(xpInput.value, 10);
            if (isNaN(v) || v < 0) {
                xpInput.value = state.currentXp;
                return;
            }
            if (v < state.currentXp) {
                errEl.textContent = `XP cannot be lower than current (${state.currentXp}).`;
                errEl.style.display = 'block';
                xpInput.value = state.currentXp;
                return;
            }
            errEl.style.display = 'none';
            state.currentXp = v;
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

        milestoneBtn.addEventListener('click', () => {
            const level = getLevelFromXp(state.currentXp + state.passXp);
            state.currentXp = window.BattlePassData.XP_TABLE[level - 1] || 0;
            xpInput.value = state.currentXp;
            errEl.style.display = 'none';
            ensureUnlocks();
            renderDashboardHero();
            renderAccordions();
            saveState();
            updateGenerateButton();
        });
    }

    function bindTabs() {
        document.querySelectorAll('.bp-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const id = 'bp-tab-' + tab.getAttribute('data-tab');
                document.querySelectorAll('.bp-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.bp-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const panel = document.getElementById(id);
                if (panel) panel.classList.add('active');
            });
        });
    }

    function bindCharacterForm() {
        const ids = ['bp-char-name', 'bp-char-class', 'bp-art-style', 'bp-motif'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const key = id.replace('bp-char-', '').replace('bp-', '').replace(/-/g, '');
            const stateKey = key === 'name' ? 'name' : key === 'class' ? 'class' : key === 'artstyle' ? 'artStyle' : 'motif';
            el.value = state.character[stateKey] || (id === 'bp-art-style' ? 'epic high-fantasy' : '');
            el.addEventListener('input', () => {
                state.character[stateKey] = el.value;
                saveState();
            });
        });
        const fileEl = document.getElementById('bp-portrait-file');
        if (fileEl) {
            fileEl.addEventListener('change', (e) => {
                const f = e.target.files[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => {
                    state.character.portraitDataUrl = r.result;
                    saveState();
                };
                r.readAsDataURL(f);
            });
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
                setTimeout(() => { reseedBtn.textContent = 'Reseed (new gear/effects for future unlocks)'; }, 2000);
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
                const chip = document.createElement('span');
                chip.className = 'bp-gear-chip';
                chip.textContent = g.label;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = '×';
                btn.setAttribute('aria-label', 'Remove');
                btn.addEventListener('click', () => {
                    state.character.gearPool = state.character.gearPool.filter(x => x.id !== g.id);
                    saveState();
                    renderPool();
                    renderAccordions();
                });
                chip.appendChild(btn);
                poolEl.appendChild(chip);
            });
            const count = (state.character.gearPool || []).length;
            if (count < 2) {
                errEl.textContent = 'Add at least 2 items to your gear pool.';
                errEl.style.display = 'block';
            } else {
                errEl.style.display = 'none';
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
        });
        renderPool();
        renderPredefinedList();
    }

    function updateGenerateButton() {
        const btn = document.getElementById('bp-generate-btn');
        if (!btn) return;
        if (hasNewContentSinceLastGenerate()) {
            btn.classList.add('bp-pulse-available');
            btn.classList.remove('bp-success');
        } else {
            btn.classList.remove('bp-pulse-available');
        }
    }

    function bindGenerateAndExport() {
        const btn = document.getElementById('bp-generate-btn');
        const statusEl = document.getElementById('bp-generate-status');
        const standaloneEl = document.getElementById('bp-standalone-prompt');
        const placeholderEl = document.getElementById('bp-placeholder-prompt');
        const compositeEl = document.getElementById('bp-composite-prompt');

        function doGenerate() {
            const active = getActiveSubTiers();
            const result = buildCumulativePrompts(state.character, active, THEMES);
            standaloneEl.value = result.standaloneGearPrompt;
            placeholderEl.value = result.placeholderCharacterPrompt;
            compositeEl.value = result.compositePrompt;
            state.lastGeneratedState = {
                activeCount: active.length,
                activeSignature: JSON.stringify(active.map(s => ({ level: s.level, tier: s.tier, active: s.active })))
            };
            saveState();
            btn.classList.remove('bp-pulse-available');
            btn.classList.add('bp-success');
            statusEl.textContent = 'Prompts generated. Copy and paste into your image AI.';
            const wrap = document.getElementById('bp-confetti-wrap');
            if (wrap) runMiniConfetti(wrap);
        }

        btn.addEventListener('click', () => {
            if ((state.character.gearPool || []).length < 2) {
                statusEl.textContent = 'Add at least 2 items to your gear pool first.';
                statusEl.style.color = 'var(--error)';
                return;
            }
            doGenerate();
        });

        ['bp-copy-standalone', 'bp-copy-placeholder', 'bp-copy-composite'].forEach((id, i) => {
            const copyBtn = document.getElementById(id);
            const source = [standaloneEl, placeholderEl, compositeEl][i];
            if (copyBtn && source) {
                copyBtn.addEventListener('click', () => {
                    source.select();
                    document.execCommand('copy');
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

    function renderGallery() {
        const container = document.getElementById('bp-gallery');
        if (!container) return;
        container.innerHTML = '';
        (state.gallery || []).forEach((entry, i) => {
            const item = document.createElement('div');
            item.className = 'bp-gallery-item';
            const img = entry.dataUrl ? document.createElement('img') : null;
            if (img) {
                img.src = entry.dataUrl;
                img.alt = entry.caption || 'Gallery image';
            }
            const actions = document.createElement('div');
            actions.className = 'bp-gallery-item-actions';
            const dl = document.createElement('button');
            dl.textContent = 'Download';
            dl.addEventListener('click', () => {
                if (!entry.dataUrl) return;
                const a = document.createElement('a');
                a.href = entry.dataUrl;
                a.download = (entry.caption || 'battle-pass-image') + '.png';
                a.click();
            });
            const del = document.createElement('button');
            del.textContent = 'Delete';
            del.addEventListener('click', () => {
                state.gallery.splice(i, 1);
                saveState();
                renderGallery();
            });
            actions.appendChild(dl);
            actions.appendChild(del);
            item.appendChild(img || document.createElement('div'));
            item.appendChild(actions);
            container.appendChild(item);
        });
    }

    function bindGalleryAdd() {
        const addEl = document.getElementById('bp-gallery-add');
        if (!addEl) return;
        addEl.addEventListener('change', (e) => {
            const f = e.target.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = async () => {
                let dataUrl = r.result;
                dataUrl = await compressImageDataUrl(dataUrl, 800);
                if (state.gallery.length >= GALLERY_CAP) state.gallery.shift();
                state.gallery.push({ dataUrl, caption: 'Image ' + (state.gallery.length + 1) });
                saveState();
                renderGallery();
            };
            r.readAsDataURL(f);
            addEl.value = '';
        });
    }

    function bindFilters() {
        const levelSelect = document.getElementById('bp-filter-level');
        const themeSelect = document.getElementById('bp-filter-theme');
        if (levelSelect) {
            for (let i = 1; i <= 20; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = 'Level ' + i;
                levelSelect.appendChild(opt);
            }
            levelSelect.addEventListener('change', renderAccordions);
        }
        if (themeSelect) {
            window.BattlePassData.THEME_NAMES.forEach(n => {
                const opt = document.createElement('option');
                opt.value = n;
                opt.textContent = n;
                themeSelect.appendChild(opt);
            });
            themeSelect.addEventListener('change', renderAccordions);
        }
        const searchEl = document.getElementById('bp-filter-search');
        if (searchEl) searchEl.addEventListener('input', renderAccordions);
    }

    function init() {
        loadState();
        state.character.gearPool = state.character.gearPool || [];
        ensureUnlocks();
        renderDashboardHero();
        bindXpAndMilestone();
        bindTabs();
        bindCharacterForm();
        bindGearPool();
        bindFilters();
        renderAccordions();
        bindGenerateAndExport();
        bindGalleryAdd();
        renderGallery();
        updateGenerateButton();
    }

    init();
})();
