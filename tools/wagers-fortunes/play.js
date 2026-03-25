(function () {
    'use strict';

    var STORAGE_KEY = 'dnd-wagers-fortunes';
    var SCHEMA_VERSION = '1.0.0';
    var Logic = window.WagersFortunesLogic;
    var Seed  = window.WagersFortunesSeed;

    var state = { games: [], sessionLog: [] };
    var ps    = { gameId: null, tierId: null, order: null, revealed: false, dmOverride: false };

    // ── Storage ──────────────────────────────────────────

    function loadState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed.schemaVersion === SCHEMA_VERSION && Array.isArray(parsed.games)) {
                    state.games      = parsed.games;
                    state.sessionLog = Array.isArray(parsed.sessionLog) ? parsed.sessionLog : [];
                }
            }
        } catch (e) {}
        // Seed demo data if nothing exists
        if (state.games.length === 0 && Seed && Seed.seedGame) {
            state.games.push(Seed.seedGame());
            saveState();
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                schemaVersion: SCHEMA_VERSION,
                games:         state.games,
                sessionLog:    state.sessionLog
            }));
        } catch (e) {}
    }

    // ── Helpers ──────────────────────────────────────────

    function getGame(id) {
        for (var i = 0; i < state.games.length; i++) {
            if (state.games[i].id === id) return state.games[i];
        }
        return null;
    }

    function getTier(gameId, tierId) {
        var game = getGame(gameId);
        if (!game || !game.tiers) return null;
        for (var i = 0; i < game.tiers.length; i++) {
            if (game.tiers[i].id === tierId) return game.tiers[i];
        }
        return null;
    }

    function lastPlaysByPlayer(log) {
        var byPlayer = {};
        for (var i = 0; i < log.length; i++) {
            var entry = log[i];
            var key = (entry.playerName || '').trim() || '_anonymous';
            if (!byPlayer[key] || entry.timestamp > byPlayer[key].timestamp) {
                byPlayer[key] = entry;
            }
        }
        return byPlayer;
    }

    function esc(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function show(id) {
        var el = typeof id === 'string' ? document.getElementById(id) : id;
        if (el) el.classList.remove('wfp-hidden');
    }

    function hide(id) {
        var el = typeof id === 'string' ? document.getElementById(id) : id;
        if (el) el.classList.add('wfp-hidden');
    }

    function el(id) { return document.getElementById(id); }

    // ── Setup flow ───────────────────────────────────────

    function initSetup() {
        ps.gameId   = null;
        ps.tierId   = null;
        ps.order    = null;
        ps.revealed = false;

        hide('wfp-play');
        hide('wfp-empty');
        show('wfp-setup');
        hide('wfp-step-game');
        hide('wfp-step-tier');
        hide('wfp-step-player');
        hide('wfp-limiter-msg');

        // Restore saved player name
        try {
            var saved = sessionStorage.getItem('dnd-wf-player-name');
            if (saved && el('wfp-player-name')) el('wfp-player-name').value = saved;
        } catch (e) {}

        if (state.games.length === 0) {
            hide('wfp-setup');
            show('wfp-empty');
            return;
        }

        if (state.games.length === 1) {
            ps.gameId = state.games[0].id;
            startTierStep();
        } else {
            renderGameCards();
            show('wfp-step-game');
        }
    }

    function renderGameCards() {
        var container = el('wfp-game-cards');
        if (!container) return;
        container.innerHTML = '';
        state.games.forEach(function (game) {
            var btn = document.createElement('button');
            btn.type      = 'button';
            btn.className = 'wfp-select-card';
            btn.innerHTML =
                '<span class="wfp-select-card-name">' + esc(game.name) + '</span>' +
                (game.locationTag
                    ? '<span class="wfp-select-card-meta">' + esc(game.locationTag) + '</span>'
                    : '') +
                '<span class="wfp-select-card-detail">' +
                    (game.tiers ? game.tiers.length : 0) + ' tier' +
                    (game.tiers && game.tiers.length !== 1 ? 's' : '') +
                '</span>';
            btn.addEventListener('click', function () {
                ps.gameId = game.id;
                hide('wfp-step-game');
                startTierStep();
            });
            container.appendChild(btn);
        });
    }

    function startTierStep() {
        var game = getGame(ps.gameId);
        if (!game || !game.tiers || game.tiers.length === 0) return;
        if (game.tiers.length === 1) {
            ps.tierId = game.tiers[0].id;
            startPlayerStep();
        } else {
            renderTierCards(game);
            show('wfp-step-tier');
        }
    }

    function renderTierCards(game) {
        var container = el('wfp-tier-cards');
        if (!container) return;
        container.innerHTML = '';
        game.tiers.forEach(function (tier) {
            var btn = document.createElement('button');
            btn.type      = 'button';
            btn.className = 'wfp-select-card wfp-tier-card';
            btn.innerHTML =
                '<span class="wfp-tier-gp">' + esc(String(tier.wagerGp)) + ' gp</span>' +
                '<span class="wfp-select-card-detail">' +
                    tier.boxes.length + ' box' + (tier.boxes.length !== 1 ? 'es' : '') +
                '</span>';
            btn.addEventListener('click', function () {
                ps.tierId = tier.id;
                hide('wfp-step-tier');
                startPlayerStep();
            });
            container.appendChild(btn);
        });
    }

    function startPlayerStep() {
        var game = getGame(ps.gameId);
        var tier = getTier(ps.gameId, ps.tierId);
        if (!game || !tier) return;
        var d = el('wfp-wager-display');
        if (d) d.textContent = game.name + ' · ' + tier.wagerGp + ' gp wager';
        show('wfp-step-player');
    }

    function startPlay() {
        var game = getGame(ps.gameId);
        var tier = getTier(ps.gameId, ps.tierId);
        if (!game || !tier) return;

        ps.dmOverride  = !!(el('wfp-dm-override') && el('wfp-dm-override').checked);
        var playerName = ((el('wfp-player-name') && el('wfp-player-name').value) || '').trim();

        try { sessionStorage.setItem('dnd-wf-player-name', playerName); } catch (e) {}

        if (!ps.dmOverride && game.limiter) {
            var check = Logic.checkLimiter(
                game.limiter,
                playerName || '_anonymous',
                lastPlaysByPlayer(state.sessionLog),
                Logic.getSessionId()
            );
            if (!check.allowed) {
                var msg = el('wfp-limiter-msg');
                if (msg) { msg.textContent = check.message || 'Not allowed at this time.'; show(msg); }
                return;
            }
        }

        hide('wfp-limiter-msg');
        hide('wfp-setup');
        show('wfp-play');
        renderPlayScreen(game, tier, playerName);
    }

    // ── Play screen ──────────────────────────────────────

    function renderPlayScreen(game, tier, playerName) {
        ps.order    = null;
        ps.revealed = false;

        var info = el('wfp-play-info');
        if (info) {
            info.textContent = game.name + ' · ' + tier.wagerGp + ' gp' +
                (playerName ? ' · ' + playerName : '');
        }

        var hintBtn = el('wfp-hint-btn');
        if (hintBtn) {
            if (game.hintCheck) {
                hintBtn.textContent =
                    '🎲 ' + (game.hintCheck.skill || 'Insight') + ' DC ' + (game.hintCheck.dc || 12);
                show(hintBtn);
            } else {
                hide(hintBtn);
            }
        }

        hide('wfp-hint-panel');
        hide('wfp-reveal');

        ps.order = game.shuffleBoxesEachRun
            ? Logic.shuffleBoxOrder(tier.boxes)
            : tier.boxes.slice();

        renderBoxCards();
    }

    var OUTCOME_ICONS = {
        win:           '✦',
        'break-even':  '≈',
        loss:          '✗',
        custom:        '✧'
    };

    var OUTCOME_LABELS = {
        win:           'Win',
        'break-even':  'Break Even',
        loss:          'Loss',
        custom:        'Custom'
    };

    function renderBoxCards() {
        var container = el('wfp-boxes');
        if (!container) return;
        container.innerHTML = '';

        ps.order.forEach(function (box) {
            var outcomeType = box.outcomeType || 'custom';
            var icon        = OUTCOME_ICONS[outcomeType]  || '✧';
            var label       = OUTCOME_LABELS[outcomeType] || outcomeType;

            var card = document.createElement('div');
            card.className = 'wfp-box-card';
            card.innerHTML =
                '<div class="wfp-box-face wfp-box-front">' +
                    '<div class="wfp-box-lid">🔒</div>' +
                    '<div class="wfp-box-body">' +
                        '<span class="wfp-box-glyph">?</span>' +
                        '<span class="wfp-box-label">' + esc(box.label) + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="wfp-box-face wfp-box-back" data-outcome="' + esc(outcomeType) + '">' +
                    '<span class="wfp-back-icon">' + icon + '</span>' +
                    '<span class="wfp-back-label">' + esc(label) + '</span>' +
                '</div>';

            card.addEventListener('click', function () {
                if (ps.revealed) return;
                revealBox(box, card);
            });

            container.appendChild(card);
        });
    }

    function revealBox(box, chosenCard) {
        if (ps.revealed) return;
        ps.revealed = true;

        document.querySelectorAll('.wfp-box-card').forEach(function (c) {
            c.classList.add(c === chosenCard ? 'wfp-box-picked' : 'wfp-box-unchosen');
        });

        // Write log entry (same schema as original tool)
        var playerName = '';
        try { playerName = sessionStorage.getItem('dnd-wf-player-name') || ''; } catch (e) {}
        var tier    = getTier(ps.gameId, ps.tierId);
        var summary = (box.outcomeType || 'custom') + ': ' + (box.revealText || '').slice(0, 50);
        var entry   = Logic.buildLogEntry(
            ps.gameId, ps.tierId, playerName,
            tier ? tier.wagerGp : 0,
            box.id, summary, Logic.getSessionId()
        );
        entry.dmOverride = ps.dmOverride;
        state.sessionLog.push(entry);
        saveState();

        // Show reveal after the flip animation finishes
        setTimeout(function () { showReveal(box); }, 620);
    }

    function showReveal(box) {
        var outcomeType = box.outcomeType || 'custom';

        var badge = el('wfp-outcome-badge');
        if (badge) {
            badge.textContent = OUTCOME_LABELS[outcomeType] || outcomeType;
            badge.setAttribute('data-outcome', outcomeType);
        }

        var textEl = el('wfp-reveal-text');
        if (textEl) textEl.textContent = box.revealText || '';

        var contentsEl = el('wfp-reveal-contents');
        if (contentsEl) contentsEl.textContent = box.contents || '';

        show('wfp-reveal');
    }

    // ── Hint panel ───────────────────────────────────────

    function openHintPanel() {
        var game = getGame(ps.gameId);
        if (!game || !game.hintCheck) return;
        var dc    = game.hintCheck.dc    || 12;
        var skill = game.hintCheck.skill || 'Insight';

        var promptEl = el('wfp-hint-prompt');
        if (promptEl) promptEl.textContent = skill + ' check — DC ' + dc;

        var rollEl = el('wfp-hint-roll');
        if (rollEl) rollEl.value = '';

        hide('wfp-hint-result');
        show('wfp-hint-panel');
    }

    function submitHint() {
        var game = getGame(ps.gameId);
        if (!game || !game.hintCheck) return;

        var dc        = game.hintCheck.dc || 12;
        var rollEl    = el('wfp-hint-roll');
        var roll      = parseInt(rollEl && rollEl.value, 10);
        var pass      = !isNaN(roll) && roll >= dc;
        var resultEl  = el('wfp-hint-result');
        if (!resultEl) return;

        if (pass) {
            var hintText = (game.hintCheck.hintStyle || '').trim() || 'One box might be worth your while…';
            resultEl.textContent = '✓ ' + hintText;
            resultEl.className   = 'wfp-hint-result wfp-hint-pass';
        } else {
            resultEl.textContent = '✗ The check fails — no hint.';
            resultEl.className   = 'wfp-hint-result wfp-hint-fail';
        }
        show(resultEl);
    }

    // ── Play again ───────────────────────────────────────

    function playAgain() {
        var game = getGame(ps.gameId);
        var tier = getTier(ps.gameId, ps.tierId);
        if (!game || !tier) { initSetup(); return; }

        ps.revealed = false;
        ps.order    = null;
        hide('wfp-reveal');
        hide('wfp-hint-panel');
        hide('wfp-hint-result');

        var playerName = '';
        try { playerName = sessionStorage.getItem('dnd-wf-player-name') || ''; } catch (e) {}
        renderPlayScreen(game, tier, playerName);
    }

    // ── Init ─────────────────────────────────────────────

    function init() {
        loadState();
        initSetup();

        el('wfp-start-btn')   && el('wfp-start-btn').addEventListener('click', startPlay);
        el('wfp-hint-btn')    && el('wfp-hint-btn').addEventListener('click', openHintPanel);
        el('wfp-hint-submit') && el('wfp-hint-submit').addEventListener('click', submitHint);
        el('wfp-hint-cancel') && el('wfp-hint-cancel').addEventListener('click', function () {
            hide('wfp-hint-panel');
        });
        el('wfp-play-again')  && el('wfp-play-again').addEventListener('click', playAgain);

        el('wfp-player-name') && el('wfp-player-name').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') startPlay();
        });
        el('wfp-hint-roll') && el('wfp-hint-roll').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') submitHint();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
