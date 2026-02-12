// Wagers & Fortunes – storage, UI, and wiring
(function () {
    'use strict';

    var STORAGE_KEY = 'dnd-wagers-fortunes';
    var SCHEMA_VERSION = '1.0.0';
    var Logic = window.WagersFortunesLogic;
    var Seed = window.WagersFortunesSeed;

    var state = { games: [], sessionLog: [] };

    function loadState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed.schemaVersion === SCHEMA_VERSION && Array.isArray(parsed.games)) {
                    state.games = parsed.games;
                    state.sessionLog = Array.isArray(parsed.sessionLog) ? parsed.sessionLog : [];
                }
            }
        } catch (e) {}
        if (state.games.length === 0 && Seed && Seed.seedGame) {
            state.games.push(Seed.seedGame());
            saveState();
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                schemaVersion: SCHEMA_VERSION,
                games: state.games,
                sessionLog: state.sessionLog
            }));
        } catch (e) {}
    }

    function getGame(id) {
        for (var i = 0; i < state.games.length; i++) {
            if (state.games[i].id === id) return state.games[i];
        }
        return null;
    }

    var editorGame = null;

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

    // --- Tabs ---
    function switchTab(tabId) {
        document.querySelectorAll('.wf-tab').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });
        document.querySelectorAll('.wf-tab-content').forEach(function (panel) {
            panel.classList.toggle('hidden', panel.id !== 'wf-tab-' + tabId);
        });
        if (tabId === 'builder') renderGamesList();
        if (tabId === 'run') renderRunGame();
        if (tabId === 'log') renderLog();
    }

    // --- DM Builder ---
    function renderGamesList() {
        var container = document.getElementById('wf-games-list');
        if (!container) return;
        container.innerHTML = '';
        state.games.forEach(function (game) {
            var card = document.createElement('div');
            card.className = 'wf-game-card';
            card.innerHTML = '<h3 class="wf-game-name">' + escapeHtml(game.name) + '</h3>' +
                '<p class="wf-game-meta">' + escapeHtml(game.locationTag) + ' · ' + (game.tiers ? game.tiers.length : 0) + ' tier(s)</p>' +
                '<div class="wf-game-actions">' +
                '<button type="button" class="btn-secondary wf-edit-game" data-game-id="' + escapeHtml(game.id) + '">Edit</button>' +
                '<button type="button" class="btn-secondary wf-delete-game" data-game-id="' + escapeHtml(game.id) + '">Delete</button>' +
                '</div>';
            container.appendChild(card);
        });
        container.querySelectorAll('.wf-edit-game').forEach(function (btn) {
            btn.addEventListener('click', function () { openGameEditor(btn.getAttribute('data-game-id')); });
        });
        container.querySelectorAll('.wf-delete-game').forEach(function (btn) {
            btn.addEventListener('click', function () { deleteGame(btn.getAttribute('data-game-id')); });
        });
    }

    function escapeHtml(s) {
        if (s == null) return '';
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function openGameEditor(gameId) {
        var game = gameId ? getGame(gameId) : null;
        if (!game && gameId) return;
        var isNew = !game;
        if (isNew) {
            game = {
                id: Logic.genId(),
                name: '',
                locationTag: 'Waterdeep',
                description: '',
                numberOfBoxes: 3,
                shuffleBoxesEachRun: false,
                limiter: null,
                hintCheck: null,
                tiers: []
            };
        } else {
            game = JSON.parse(JSON.stringify(game));
        }
        var form = document.getElementById('wf-game-form');
        var wrap = document.getElementById('wf-builder-edit');
        if (!form || !wrap) return;
        document.getElementById('wf-game-id').value = game.id;
        document.getElementById('wf-game-name').value = game.name;
        document.getElementById('wf-game-location').value = game.locationTag || 'Waterdeep';
        document.getElementById('wf-game-description').value = game.description || '';
        document.getElementById('wf-game-number-of-boxes').value = game.numberOfBoxes || 3;
        document.getElementById('wf-game-shuffle').checked = !!game.shuffleBoxesEachRun;
        document.getElementById('wf-limiter-enabled').checked = !!game.limiter;
        document.getElementById('wf-hint-enabled').checked = !!game.hintCheck;
        if (game.limiter) {
            document.getElementById('wf-limiter-type').value = game.limiter.type || 'per-day';
            document.getElementById('wf-limiter-value').value = game.limiter.value != null ? game.limiter.value : '';
        } else {
            document.getElementById('wf-limiter-type').value = 'per-day';
            document.getElementById('wf-limiter-value').value = '';
        }
        if (game.hintCheck) {
            document.getElementById('wf-hint-skill').value = game.hintCheck.skill || 'Insight';
            document.getElementById('wf-hint-dc').value = game.hintCheck.dc != null ? game.hintCheck.dc : '';
            document.getElementById('wf-hint-style').value = game.hintCheck.hintStyle || '';
        } else {
            document.getElementById('wf-hint-skill').value = 'Insight';
            document.getElementById('wf-hint-dc').value = '';
            document.getElementById('wf-hint-style').value = '';
        }
        renderTiersInEditor(game);
        editorGame = game;
        wrap.classList.remove('hidden');
        document.getElementById('wf-builder-list').classList.add('hidden');
        document.getElementById('wf-game-form-title').textContent = isNew ? 'New Game' : 'Edit Game';
    }

    function renderTiersInEditor(game) {
        var container = document.getElementById('wf-tiers-container');
        if (!container) return;
        container.innerHTML = '';
        (game.tiers || []).forEach(function (tier, tIdx) {
            var tierEl = document.createElement('div');
            tierEl.className = 'wf-tier-editor';
            tierEl.setAttribute('data-tier-id', tier.id);
            var boxesHtml = (tier.boxes || []).map(function (box, bIdx) {
                return '<div class="wf-box-editor" data-box-id="' + escapeHtml(box.id) + '">' +
                    '<label>Label <input type="text" class="wf-box-label" value="' + escapeHtml(box.label) + '" placeholder="Box ' + (bIdx + 1) + '"></label>' +
                    '<label>Type <select class="wf-box-type"><option value="break-even"' + (box.outcomeType === 'break-even' ? ' selected' : '') + '>Break-even</option><option value="win"' + (box.outcomeType === 'win' ? ' selected' : '') + '>Win</option><option value="loss"' + (box.outcomeType === 'loss' ? ' selected' : '') + '>Loss</option><option value="custom"' + (box.outcomeType === 'custom' ? ' selected' : '') + '>Custom</option></select></label>' +
                    '<label>Reveal text (player) <input type="text" class="wf-box-reveal" value="' + escapeHtml(box.revealText || '') + '"></label>' +
                    '<label>Contents <textarea class="wf-box-contents" rows="2">' + escapeHtml(box.contents || '') + '</textarea></label>' +
                    '<label>Est. value (gp) <input type="number" class="wf-box-value" value="' + (box.estimatedValueGp != null ? box.estimatedValueGp : '') + '" min="0" step="1"></label>' +
                    '<label>Notes (DM only) <input type="text" class="wf-box-notes" value="' + escapeHtml(box.notes || '') + '"></label>' +
                    '</div>';
            }).join('');
            tierEl.innerHTML = '<h4>Tier: <input type="number" class="wf-tier-wager" value="' + (tier.wagerGp != null ? tier.wagerGp : '') + '" min="1" step="1"> gp</h4>' +
                '<div class="wf-boxes-list">' + boxesHtml + '</div>' +
                '<button type="button" class="btn-secondary wf-remove-tier" data-tier-id="' + escapeHtml(tier.id) + '">Remove tier</button>';
            container.appendChild(tierEl);
        });
        container.querySelectorAll('.wf-remove-tier').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (!editorGame) return;
                editorGame.tiers = (editorGame.tiers || []).filter(function (t) { return t.id !== btn.getAttribute('data-tier-id'); });
                renderTiersInEditor(editorGame);
            });
        });
    }

    function addTier() {
        if (!editorGame) return;
        var n = parseInt(document.getElementById('wf-game-number-of-boxes').value, 10) || 3;
        var tierId = Logic.genId();
        var boxes = [];
        for (var i = 0; i < n; i++) {
            boxes.push({
                id: Logic.genId(),
                tierId: tierId,
                label: 'Box ' + (i + 1),
                outcomeType: 'custom',
                contents: '',
                estimatedValueGp: 0,
                notes: '',
                revealText: ''
            });
        }
        editorGame.tiers = editorGame.tiers || [];
        editorGame.tiers.push({ id: tierId, gameId: editorGame.id, wagerGp: 10, boxes: boxes });
        renderTiersInEditor(editorGame);
    }

    function collectGameFromForm() {
        var gameId = document.getElementById('wf-game-id').value;
        var game = getGame(gameId) || {
            id: Logic.genId(),
            name: '',
            locationTag: 'Waterdeep',
            description: '',
            numberOfBoxes: 3,
            shuffleBoxesEachRun: false,
            limiter: null,
            hintCheck: null,
            tiers: []
        };
        game.name = (document.getElementById('wf-game-name').value || '').trim();
        game.locationTag = (document.getElementById('wf-game-location').value || '').trim() || 'Waterdeep';
        game.description = (document.getElementById('wf-game-description').value || '').trim();
        game.numberOfBoxes = parseInt(document.getElementById('wf-game-number-of-boxes').value, 10) || 3;
        game.shuffleBoxesEachRun = document.getElementById('wf-game-shuffle').checked;
        game.limiter = document.getElementById('wf-limiter-enabled').checked ? {
            type: document.getElementById('wf-limiter-type').value,
            value: document.getElementById('wf-limiter-value').value ? parseInt(document.getElementById('wf-limiter-value').value, 10) : undefined
        } : null;
        game.hintCheck = document.getElementById('wf-hint-enabled').checked ? {
            skill: (document.getElementById('wf-hint-skill').value || 'Insight').trim(),
            dc: document.getElementById('wf-hint-dc').value ? parseInt(document.getElementById('wf-hint-dc').value, 10) : undefined,
            hintStyle: (document.getElementById('wf-hint-style').value || '').trim()
        } : null;
        game.tiers = [];
        document.querySelectorAll('#wf-tiers-container .wf-tier-editor').forEach(function (tierEl) {
            var wagerInput = tierEl.querySelector('.wf-tier-wager');
            var wager = wagerInput ? parseFloat(wagerInput.value, 10) : 0;
            var tierId = tierEl.getAttribute('data-tier-id') || Logic.genId();
            var boxes = [];
            tierEl.querySelectorAll('.wf-box-editor').forEach(function (boxEl) {
                var boxId = boxEl.getAttribute('data-box-id') || Logic.genId();
                boxes.push({
                    id: boxId,
                    tierId: tierId,
                    label: (boxEl.querySelector('.wf-box-label') && boxEl.querySelector('.wf-box-label').value) || 'Box',
                    outcomeType: (boxEl.querySelector('.wf-box-type') && boxEl.querySelector('.wf-box-type').value) || 'custom',
                    revealText: (boxEl.querySelector('.wf-box-reveal') && boxEl.querySelector('.wf-box-reveal').value) || '',
                    contents: (boxEl.querySelector('.wf-box-contents') && boxEl.querySelector('.wf-box-contents').value) || '',
                    estimatedValueGp: boxEl.querySelector('.wf-box-value') ? parseFloat(boxEl.querySelector('.wf-box-value').value, 10) : 0,
                    notes: (boxEl.querySelector('.wf-box-notes') && boxEl.querySelector('.wf-box-notes').value) || ''
                });
            });
            game.tiers.push({ id: tierId, gameId: game.id, wagerGp: wager, boxes: boxes });
        });
        return game;
    }

    function saveGameFromForm() {
        var game = collectGameFromForm();
        var result = Logic.validateGame(game);
        var errEl = document.getElementById('wf-form-errors');
        if (errEl) {
            errEl.textContent = result.errors.length ? result.errors.join(' ') : '';
            errEl.classList.toggle('hidden', result.valid);
        }
        if (!result.valid) return;
        var idx = state.games.findIndex(function (g) { return g.id === game.id; });
        if (idx >= 0) state.games[idx] = game;
        else state.games.push(game);
        saveState();
        closeGameEditor();
    }

    function closeGameEditor() {
        document.getElementById('wf-builder-edit').classList.add('hidden');
        document.getElementById('wf-builder-list').classList.remove('hidden');
        renderGamesList();
    }

    function deleteGame(gameId) {
        if (!confirm('Delete this game? This cannot be undone.')) return;
        state.games = state.games.filter(function (g) { return g.id !== gameId; });
        saveState();
        renderGamesList();
    }

    function quickStartTemplate() {
        var gameId = document.getElementById('wf-game-id').value;
        var game = editorGame || getGame(gameId) || collectGameFromForm();
        editorGame = game;
        var n = parseInt(game.numberOfBoxes, 10) || 3;
        var wager = 15;
        var tierId = Logic.genId();
        var boxes = [];
        for (var i = 0; i < n; i++) {
            var label = n === 3 ? ['Box A', 'Box B', 'Box C'][i] : 'Box ' + (i + 1);
            var type = n === 3 ? ['break-even', 'win', 'loss'][i] : (i === 0 ? 'break-even' : (i === 1 ? 'win' : 'loss'));
            var val = n === 3 ? [wager, Math.round(wager * 1.5), 0][i] : (type === 'break-even' ? wager : (type === 'win' ? wager * 2 : 0));
            boxes.push({
                id: Logic.genId(),
                tierId: tierId,
                label: label,
                outcomeType: type,
                contents: type === 'break-even' ? 'Worth about the wager.' : (type === 'win' ? 'A pleasant surprise.' : 'Nothing or a minor setback.'),
                estimatedValueGp: val,
                notes: '',
                revealText: type === 'break-even' ? 'You break even.' : (type === 'win' ? 'You win!' : 'Better luck next time.')
            });
        }
        if (!game.tiers) game.tiers = [];
        game.tiers.push({ id: tierId, gameId: game.id, wagerGp: wager, boxes: boxes });
        document.getElementById('wf-game-id').value = game.id;
        renderTiersInEditor(game);
    }

    // --- Run Game ---
    var runState = { gameId: null, tierId: null, order: null, revealed: false, dmOverride: false, started: false };

    function renderRunGame() {
        var gameSelect = document.getElementById('wf-run-game');
        var tierSelect = document.getElementById('wf-run-tier');
        var boxesWrap = document.getElementById('wf-run-boxes');
        var revealWrap = document.getElementById('wf-run-reveal');
        var hintWrap = document.getElementById('wf-run-hint');
        if (!gameSelect || !tierSelect) return;

        gameSelect.innerHTML = '<option value="">Select game…</option>';
        state.games.forEach(function (g) {
            var opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            if (g.id === runState.gameId) opt.selected = true;
            gameSelect.appendChild(opt);
        });

        tierSelect.innerHTML = '<option value="">Select tier…</option>';
        if (runState.gameId) {
            var game = getGame(runState.gameId);
            if (game && game.tiers) {
                game.tiers.forEach(function (t) {
                    var opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = t.wagerGp + ' gp';
                    if (t.id === runState.tierId) opt.selected = true;
                    tierSelect.appendChild(opt);
                });
            }
        }

        document.getElementById('wf-run-player').value = '';
        if (revealWrap) revealWrap.classList.add('hidden');
        if (hintWrap) hintWrap.classList.add('hidden');
        runState.order = null;
        runState.revealed = false;
        runState.dmOverride = false;
        runState.started = false;
        document.getElementById('wf-dm-override') && (document.getElementById('wf-dm-override').checked = false);
        var playWrap = document.getElementById('wf-run-play-wrap');
        if (playWrap) playWrap.classList.add('hidden');
        renderRunBoxes();
    }

    function renderRunBoxes() {
        var boxesWrap = document.getElementById('wf-run-boxes');
        var tier = runState.tierId ? getTier(runState.gameId, runState.tierId) : null;
        if (!boxesWrap) return;
        boxesWrap.innerHTML = '';
        if (!runState.started || !tier || !tier.boxes || tier.boxes.length === 0) return;

        var game = getGame(runState.gameId);
        var boxes = tier.boxes;
        if (game && game.shuffleBoxesEachRun && !runState.order) {
            runState.order = Logic.shuffleBoxOrder(boxes);
        } else if (!runState.order) {
            runState.order = boxes.slice();
        }
        runState.order.forEach(function (box, idx) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wf-box-btn';
            btn.textContent = runState.revealed ? box.label + ' – ' + (box.revealText || '').slice(0, 30) + '…' : box.label;
            btn.setAttribute('data-box-id', box.id);
            if (runState.revealed) btn.disabled = true;
            btn.addEventListener('click', function () { revealBox(box); });
            boxesWrap.appendChild(btn);
        });
    }

    function revealBox(box) {
        if (runState.revealed) return;
        var game = getGame(runState.gameId);
        var tier = getTier(runState.gameId, runState.tierId);
        if (!tier) return;

        var revealWrap = document.getElementById('wf-run-reveal');
        if (revealWrap) {
            revealWrap.querySelector('.wf-reveal-text').textContent = box.revealText || '';
            revealWrap.querySelector('.wf-reveal-contents').textContent = box.contents || '';
            revealWrap.classList.remove('hidden');
        }
        runState.revealed = true;

        var playerName = (document.getElementById('wf-run-player') && document.getElementById('wf-run-player').value) || '';
        var summary = (box.outcomeType || 'custom') + ': ' + (box.revealText || '').slice(0, 50);
        var entry = Logic.buildLogEntry(runState.gameId, runState.tierId, playerName, tier.wagerGp, box.id, summary, Logic.getSessionId());
        entry.dmOverride = runState.dmOverride;
        state.sessionLog.push(entry);
        saveState();

        renderRunBoxes();
        document.getElementById('wf-run-again').classList.remove('hidden');
    }

    function runGamePlayAllowed() {
        var game = getGame(runState.gameId);
        if (!game || !game.limiter) return { allowed: true };
        var playerKey = (document.getElementById('wf-run-player') && document.getElementById('wf-run-player').value || '').trim() || '_anonymous';
        var lastByPlayer = lastPlaysByPlayer(state.sessionLog);
        return Logic.checkLimiter(game.limiter, playerKey, lastByPlayer, Logic.getSessionId());
    }

    function runGameStart() {
        var gameId = document.getElementById('wf-run-game').value;
        var tierId = document.getElementById('wf-run-tier').value;
        if (!gameId || !tierId) return;
        runState.gameId = gameId;
        runState.tierId = tierId;
        runState.order = null;
        runState.revealed = false;
        runState.dmOverride = document.getElementById('wf-dm-override') && document.getElementById('wf-dm-override').checked;

        var check = runGamePlayAllowed();
        if (!check.allowed && !runState.dmOverride) {
            alert(check.message || 'Not allowed.');
            return;
        }
        runState.started = true;
        document.getElementById('wf-run-reveal').classList.add('hidden');
        document.getElementById('wf-run-again').classList.add('hidden');
        var playWrap = document.getElementById('wf-run-play-wrap');
        if (playWrap) playWrap.classList.remove('hidden');
        renderRunBoxes();
    }

    function showHint() {
        var game = getGame(runState.gameId);
        var tier = getTier(runState.gameId, runState.tierId);
        if (!game || !game.hintCheck || !tier || !runState.order || runState.order.length === 0) return;
        var dc = game.hintCheck.dc != null ? game.hintCheck.dc : 12;
        var success = window.prompt('Enter roll total (or "s" for success / "f" for fail):', '');
        if (success === null) return;
        var pass = success.toLowerCase() === 's' || (parseInt(success, 10) >= dc);
        var hintEl = document.getElementById('wf-run-hint');
        if (!hintEl) return;
        if (pass) {
            var idx = Math.floor(Math.random() * runState.order.length);
            var box = runState.order[idx];
            var hintStyle = (game.hintCheck.hintStyle || '').trim() || 'One box might be worth your while; another is a dud.';
            hintEl.querySelector('.wf-hint-text').textContent = hintStyle;
            hintEl.classList.remove('hidden');
        } else {
            hintEl.querySelector('.wf-hint-text').textContent = 'The check fails—no hint.';
            hintEl.classList.remove('hidden');
        }
    }

    // --- Log ---
    function getFilteredLog() {
        var gameId = (document.getElementById('wf-log-game') && document.getElementById('wf-log-game').value) || '';
        var tierId = (document.getElementById('wf-log-tier') && document.getElementById('wf-log-tier').value) || '';
        var name = (document.getElementById('wf-log-name') && document.getElementById('wf-log-name').value || '').trim().toLowerCase();
        var list = state.sessionLog.slice();
        list.sort(function (a, b) { return b.timestamp - a.timestamp; });
        if (gameId) list = list.filter(function (e) { return e.gameId === gameId; });
        if (tierId) list = list.filter(function (e) { return e.tierId === tierId; });
        if (name) list = list.filter(function (e) { return (e.playerName || '').toLowerCase().indexOf(name) !== -1; });
        return list;
    }

    function renderLog() {
        var table = document.getElementById('wf-log-table');
        var gameFilter = document.getElementById('wf-log-game');
        var tierFilter = document.getElementById('wf-log-tier');
        if (!table) return;

        if (gameFilter) {
            gameFilter.innerHTML = '<option value="">All games</option>';
            state.games.forEach(function (g) {
                var opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.name;
                gameFilter.appendChild(opt);
            });
        }
        var logGameId = gameFilter && gameFilter.value ? gameFilter.value : '';
        if (tierFilter) {
            tierFilter.innerHTML = '<option value="">All tiers</option>';
            if (logGameId) {
                var logGame = getGame(logGameId);
                if (logGame && logGame.tiers) logGame.tiers.forEach(function (t) {
                    var opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = t.wagerGp + ' gp';
                    tierFilter.appendChild(opt);
                });
            }
        }

        var rows = getFilteredLog();
        var thead = table.querySelector('thead');
        var tbody = table.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        rows.forEach(function (entry) {
            var game = getGame(entry.gameId);
            var tier = getTier(entry.gameId, entry.tierId);
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + new Date(entry.timestamp).toLocaleString() + '</td>' +
                '<td>' + escapeHtml(game ? game.name : entry.gameId) + '</td>' +
                '<td>' + (tier ? tier.wagerGp + ' gp' : entry.tierId) + '</td>' +
                '<td>' + escapeHtml(entry.playerName || '—') + '</td>' +
                '<td>' + entry.wagerGp + '</td>' +
                '<td>' + escapeHtml(entry.chosenBoxId) + '</td>' +
                '<td>' + escapeHtml((entry.resultSummary || '').slice(0, 40)) + '</td>';
            tbody.appendChild(tr);
        });
    }

    function exportLogJson() {
        var list = getFilteredLog();
        var blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'wagers-fortunes-log.json';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function exportLogCsv() {
        var list = getFilteredLog();
        var headers = ['timestamp', 'gameId', 'tierId', 'playerName', 'wagerGp', 'chosenBoxId', 'resultSummary'];
        var line = function (arr) { return arr.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); };
        var csv = line(headers) + '\n' + list.map(function (e) {
            return line([
                new Date(e.timestamp).toISOString(),
                e.gameId,
                e.tierId,
                e.playerName || '',
                e.wagerGp,
                e.chosenBoxId,
                (e.resultSummary || '').replace(/\s+/g, ' ')
            ]);
        }).join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'wagers-fortunes-log.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    // --- Init ---
    function init() {
        loadState();

        document.querySelectorAll('.wf-tab').forEach(function (btn) {
            btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-tab')); });
        });

        document.getElementById('wf-new-game') && document.getElementById('wf-new-game').addEventListener('click', function () { openGameEditor(null); });
        document.getElementById('wf-save-game') && document.getElementById('wf-save-game').addEventListener('click', saveGameFromForm);
        document.getElementById('wf-cancel-game') && document.getElementById('wf-cancel-game').addEventListener('click', closeGameEditor);
        document.getElementById('wf-quick-start') && document.getElementById('wf-quick-start').addEventListener('click', quickStartTemplate);
        document.getElementById('wf-add-tier') && document.getElementById('wf-add-tier').addEventListener('click', addTier);

        document.getElementById('wf-run-game') && document.getElementById('wf-run-game').addEventListener('change', function () {
            runState.gameId = this.value;
            runState.tierId = null;
            renderRunGame();
        });
        document.getElementById('wf-run-tier') && document.getElementById('wf-run-tier').addEventListener('change', function () {
            runState.tierId = this.value;
            renderRunGame();
        });
        document.getElementById('wf-run-start') && document.getElementById('wf-run-start').addEventListener('click', runGameStart);
        document.getElementById('wf-run-again') &&         document.getElementById('wf-run-again').addEventListener('click', function () {
            runState.order = null;
            runState.revealed = false;
            document.getElementById('wf-run-reveal').classList.add('hidden');
            document.getElementById('wf-run-again').classList.add('hidden');
            document.getElementById('wf-run-hint').classList.add('hidden');
            renderRunBoxes();
        });
        document.getElementById('wf-hint-btn') && document.getElementById('wf-hint-btn').addEventListener('click', showHint);

        document.getElementById('wf-log-game') && document.getElementById('wf-log-game').addEventListener('change', function () {
            runState.gameId = this.value;
            var tierFilter = document.getElementById('wf-log-tier');
            if (tierFilter) tierFilter.value = '';
            renderLog();
        });
        document.getElementById('wf-log-tier') && document.getElementById('wf-log-tier').addEventListener('change', renderLog);
        document.getElementById('wf-log-name') && document.getElementById('wf-log-name').addEventListener('input', renderLog);
        document.getElementById('wf-export-json') && document.getElementById('wf-export-json').addEventListener('click', exportLogJson);
        document.getElementById('wf-export-csv') && document.getElementById('wf-export-csv').addEventListener('click', exportLogCsv);

        switchTab('builder');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
