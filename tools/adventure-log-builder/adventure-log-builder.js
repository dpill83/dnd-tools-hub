(function () {
    'use strict';

    const STORAGE_KEY = 'adventureLogDefaults';
    const STORAGE_KEY_GLOBAL = 'adventureLogGlobalDefaults';
    const STORAGE_KEY_PER_ADVENTURE = 'adventureLogPerAdventure';
    const API_PATH = '/api/adventure-log';
    const FILE_SEP = '\n\n--- File: ';
    const GLOBAL_RECENT_PLAYERS_CAP = 20;
    const CONFIDENCE_THRESHOLD = 80;

    let lastUncertainItems = null;
    let accumulatedAnswers = {};
    let lastMissingCount = 0;
    let currentStep = 'form'; // 'form' | 'intake' | 'generating' | 'done'
    let lastConfidence = 0;

    function getDefaults() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return {};
    }

    function saveDefaults(obj) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
        } catch (_) {}
    }

    function getGlobalDefaults() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_GLOBAL);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return { recentPlayers: [] };
    }

    function saveGlobalDefaults(obj) {
        try {
            localStorage.setItem(STORAGE_KEY_GLOBAL, JSON.stringify(obj));
        } catch (_) {}
    }

    function getPerAdventureDefaults() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PER_ADVENTURE);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return {};
    }

    function savePerAdventureDefaults(obj) {
        try {
            localStorage.setItem(STORAGE_KEY_PER_ADVENTURE, JSON.stringify(obj));
        } catch (_) {}
    }

    function getAdventureKey(adventure, partOfCampaign) {
        const p = (partOfCampaign || '').trim();
        const a = (adventure || '').trim();
        if (!p && !a) return '_default';
        if (p && !a) return p;
        if (!p && a) return '_default|' + a;
        return p + '|' + a;
    }

    function mergeRecentPlayers(existing, newPlayers, cap) {
        const seen = {};
        const out = [];
        (newPlayers || []).forEach(function (p) {
            const k = (p || '').trim().toLowerCase();
            if (k && !seen[k]) {
                seen[k] = true;
                out.push((p || '').trim());
            }
        });
        (existing || []).forEach(function (p) {
            const k = (p || '').trim().toLowerCase();
            if (k && !seen[k]) {
                seen[k] = true;
                out.push((p || '').trim());
            }
        });
        return out.slice(0, cap);
    }

    function getDefaultsForRequest(session) {
        const d = getDefaults();
        const global = getGlobalDefaults();
        const perAdv = getPerAdventureDefaults();
        const key = getAdventureKey(session.adventure, session.partOfCampaign);
        const adv = (key && perAdv[key]) ? perAdv[key] : null;
        const playersArray = (adv && adv.players && Array.isArray(adv.players)) ? adv.players : (d.players && Array.isArray(d.players) ? d.players : []);
        const nameList = playersArray.map(function (p) { return typeof p === 'string' ? p : (p && p.player); }).filter(Boolean);
        const dmFromPlayers = (Array.isArray(playersArray) && playersArray.length) ? (playersArray.find(function (p) {
            const c = (p && typeof p === 'object' && p.character) ? String(p.character).trim().toLowerCase() : '';
            return c === 'dm';
        }) || {}) : {};
        const dm = (dmFromPlayers.player != null) ? String(dmFromPlayers.player).trim() : '';
        return {
            partOfCampaign: d.partOfCampaign || '',
            sessionDate: adv ? adv.sessionDate : d.sessionDate,
            dm: dm,
            players: playersArray,
            recentPlayers: nameList.length ? nameList : (d.recentPlayers || global.recentPlayers || [])
        };
    }

    function getSessionFromForm() {
        const adventure = (document.getElementById('alb-adventure') && document.getElementById('alb-adventure').value) || '';
        const partOfCampaign = (document.getElementById('alb-part-of-campaign') && document.getElementById('alb-part-of-campaign').value) || '';
        const sessionDate = (document.getElementById('alb-session-date') && document.getElementById('alb-session-date').value) || '';
        const discordThreadLink = (document.getElementById('alb-discord-thread') && document.getElementById('alb-discord-thread').value) || '';
        const tbody = document.getElementById('alb-players-tbody');
        const players = [];
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(function (tr) {
                const playerInput = tr.querySelector('.alb-input-player');
                const characterInput = tr.querySelector('.alb-input-character');
                const player = (playerInput && playerInput.value) ? playerInput.value.trim() : '';
                const character = (characterInput && characterInput.value) ? characterInput.value.trim() : '';
                if (player || character) {
                    players.push({ player: player, character: character });
                }
            });
        }
        const dmRow = players.find(function (p) { return (p.character || '').trim().toLowerCase() === 'dm'; });
        const dm = dmRow ? (dmRow.player || '').trim() : '';
        return {
            adventure: adventure.trim(),
            partOfCampaign: partOfCampaign.trim(),
            sessionDate: sessionDate.trim(),
            discordThreadLink: discordThreadLink.trim(),
            dm: dm,
            players: players
        };
    }

    function getRecentPlayerNames() {
        const global = getGlobalDefaults();
        const d = getDefaults();
        const perAdv = getPerAdventureDefaults();
        const adventureEl = document.getElementById('alb-adventure');
        const campaignEl = document.getElementById('alb-part-of-campaign');
        const adventure = (adventureEl && adventureEl.value) ? adventureEl.value.trim() : (d.adventure || '');
        const partOfCampaign = (campaignEl && campaignEl.value) ? campaignEl.value.trim() : (d.partOfCampaign || '');
        const key = getAdventureKey(adventure, partOfCampaign);
        const adv = (key && perAdv[key]) ? perAdv[key] : null;
        const fromAdv = (adv && adv.players && Array.isArray(adv.players)) ? adv.players.map(function (p) { return typeof p === 'string' ? p : (p && p.player); }).filter(Boolean) : [];
        const fromGlobal = global.recentPlayers || [];
        const fromD = (d.players && Array.isArray(d.players)) ? d.players.map(function (p) { return typeof p === 'string' ? p : (p && p.player); }).filter(Boolean) : (d.recentPlayers || []);
        const seen = {};
        const out = [];
        fromAdv.concat(fromD).concat(fromGlobal).forEach(function (name) {
            const k = (name || '').trim().toLowerCase();
            if (k && !seen[k]) {
                seen[k] = true;
                out.push((name || '').trim());
            }
        });
        return out.slice(0, GLOBAL_RECENT_PLAYERS_CAP);
    }

    function refreshPlayerSuggestions() {
        const datalist = document.getElementById('alb-player-suggestions');
        if (!datalist) return;
        datalist.innerHTML = '';
        getRecentPlayerNames().forEach(function (name) {
            const opt = document.createElement('option');
            opt.value = name;
            datalist.appendChild(opt);
        });
    }

    function addPlayerRow(player, character) {
        const tbody = document.getElementById('alb-players-tbody');
        if (!tbody) return;
        player = player || '';
        character = character || '';
        const tr = document.createElement('tr');
        const playerId = 'alb-player-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        tr.innerHTML =
            '<td><label for="' + playerId + '" class="alb-sr-only">Player name</label><input type="text" class="alb-input-player" id="' + playerId + '" list="alb-player-suggestions" placeholder="Player name" autocomplete="off"></td>' +
            '<td><label for="' + playerId + '-char" class="alb-sr-only">Character name</label><input type="text" class="alb-input-character" id="' + playerId + '-char" placeholder="Character name"></td>' +
            '<td class="alb-row-remove"><button type="button" class="alb-row-remove-btn" aria-label="Remove this row">\u2012</button></td>';
        const playerInput = tr.querySelector('.alb-input-player');
        const characterInput = tr.querySelector('.alb-input-character');
        if (playerInput) playerInput.value = player;
        if (characterInput) characterInput.value = character;
        tr.querySelector('.alb-row-remove-btn').addEventListener('click', function () {
            tr.remove();
        });
        tbody.appendChild(tr);
    }

    function initPlayersTable() {
        const tbody = document.getElementById('alb-players-tbody');
        const addBtn = document.getElementById('alb-add-player-btn');
        if (!tbody || !addBtn) return;
        if (tbody.querySelectorAll('tr').length === 0) {
            addPlayerRow('', '');
        }
        addBtn.addEventListener('click', function () {
            addPlayerRow('', '');
        });
        refreshPlayerSuggestions();
    }

    function prefillForm() {
        const d = getDefaults();
        const global = getGlobalDefaults();
        const perAdv = getPerAdventureDefaults();
        const adventureEl = document.getElementById('alb-adventure');
        const partOfCampaignEl = document.getElementById('alb-part-of-campaign');
        const dateEl = document.getElementById('alb-session-date');
        const tbody = document.getElementById('alb-players-tbody');

        if (partOfCampaignEl && d.partOfCampaign) partOfCampaignEl.value = d.partOfCampaign;
        if (adventureEl && d.adventure) adventureEl.value = d.adventure;

        const adventureKey = getAdventureKey(d.adventure, d.partOfCampaign);
        const adventureSpecific = (adventureKey && perAdv[adventureKey]) ? perAdv[adventureKey] : null;
        let lastPlayers = adventureSpecific && adventureSpecific.players ? adventureSpecific.players : (d.players || []);
        if (!Array.isArray(lastPlayers)) {
            lastPlayers = (d.recentPlayers && Array.isArray(d.recentPlayers)) ? d.recentPlayers.map(function (name) { return { player: name, character: '' }; }) : [];
        } else if (lastPlayers.length && typeof lastPlayers[0] === 'string') {
            lastPlayers = lastPlayers.map(function (name) { return { player: name, character: '' }; });
        } else if (lastPlayers.length && lastPlayers[0] && 'status' in lastPlayers[0]) {
            lastPlayers = lastPlayers.map(function (row) { return { player: row.player, character: row.character || '' }; });
        }

        if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);

        if (tbody && lastPlayers.length > 0) {
            tbody.innerHTML = '';
            lastPlayers.forEach(function (row) {
                addPlayerRow(
                    typeof row === 'string' ? row : (row && row.player),
                    typeof row === 'string' ? '' : (row && row.character)
                );
            });
        }
        refreshPlayerSuggestions();
    }

    function readFiles(files, callback) {
        if (!files || !files.length) {
            callback('', []);
            return;
        }
        const names = [];
        const results = new Array(files.length);
        let done = 0;
        const total = files.length;
        function onFileDone(index, text) {
            results[index] = text;
            done++;
            if (done === total) {
                const combined = results.map(function (text, j) {
                    return j === 0 ? text : FILE_SEP + names[j] + ' ---\n\n' + text;
                }).join('');
                callback(combined, names);
            }
        }
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const name = file.name || 'file';
            names.push(name);
            const reader = new FileReader();
            reader.onload = function (e) {
                onFileDone(i, (e.target && e.target.result) || '');
            };
            reader.onerror = function () {
                onFileDone(i, '');
            };
            reader.readAsText(file, 'UTF-8');
        }
    }

    function setupDropZone(zoneId, inputId, textareaId, filesLabelId) {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);
        const textarea = document.getElementById(textareaId);
        const filesLabel = document.getElementById(filesLabelId);
        if (!zone || !input || !textarea) return;

        function handleFiles(fileList) {
            if (!fileList || !fileList.length) return;
            const files = Array.from(fileList).filter(function (f) {
                const n = (f.name || '').toLowerCase();
                return n.endsWith('.txt') || n.endsWith('.md');
            });
            if (!files.length) return;
            readFiles(files, function (text, names) {
                const existing = textarea.value ? textarea.value + '\n\n' : '';
                textarea.value = existing + (existing && text ? FILE_SEP + names.join(', ') + ' ---\n\n' : '') + text;
                filesLabel.textContent = (filesLabel.textContent ? filesLabel.textContent + '; ' : '') + names.join(', ');
            });
        }

        zone.addEventListener('click', function (e) {
            if (e.target !== input) input.click();
        });
        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            zone.classList.add('alb-drag-over');
        });
        zone.addEventListener('dragleave', function () {
            zone.classList.remove('alb-drag-over');
        });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            zone.classList.remove('alb-drag-over');
            if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        });
        input.addEventListener('change', function () {
            if (input.files) handleFiles(input.files);
            input.value = '';
        });
    }

    function setStatus(msg) {
        const el = document.getElementById('alb-status');
        if (el) el.textContent = msg || '';
    }

    function setError(msg) {
        const el = document.getElementById('alb-error');
        if (!el) return;
        if (msg) {
            el.textContent = msg;
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    }

    var _loadingTimer = null;
    var _chunkTimer = null;

    function clearChunkTimer() {
        if (_chunkTimer) { clearTimeout(_chunkTimer); _chunkTimer = null; }
    }

    function resetChunkTimer() {
        clearChunkTimer();
        _chunkTimer = setTimeout(function () {
            _chunkTimer = null;
            setStreamWarning('Still working — this sometimes takes a while for long notes');
        }, 15000);
    }

    function setStreamWarning(msg) {
        const el = document.getElementById('alb-stream-warning');
        if (!el) return;
        if (msg) {
            el.textContent = msg;
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
            el.textContent = '';
        }
    }

    function showStreamPanel() {
        const pre = document.getElementById('alb-stream-pre');
        if (pre) pre.textContent = '';
        setStreamWarning('');
    }

    function hideStreamPanel() {
        clearChunkTimer();
    }

    function appendStreamChunk(text) {
        const pre = document.getElementById('alb-stream-pre');
        if (!pre) return;
        pre.textContent += text;
        pre.scrollTop = pre.scrollHeight;
        resetChunkTimer();
    }

    function setLoading(loading, step) {
        const checkBtn = document.getElementById('alb-check-btn');
        const intakeSubmitBtn = document.getElementById('alb-intake-submit-btn');
        [checkBtn, intakeSubmitBtn].forEach(function (btn) {
            if (btn) btn.disabled = loading;
        });
        if (_loadingTimer) { clearTimeout(_loadingTimer); _loadingTimer = null; }
        if (loading) {
            setStatus(step === 'generate' ? 'Generating log…' : 'Checking…');
            if (step === 'generate') {
                setStatusHint('This may take 30–60 seconds for long notes.');
            } else {
                setStatusHint('');
                _loadingTimer = setTimeout(function () {
                    _loadingTimer = null;
                    const submitBtn = document.getElementById('alb-intake-submit-btn');
                    if (submitBtn && submitBtn.disabled) setStatus('Still checking…');
                }, 10000);
            }
        } else {
            if (_loadingTimer) { clearTimeout(_loadingTimer); _loadingTimer = null; }
            clearChunkTimer();
            setStatus('');
            setStatusHint('');
        }
    }

    function setStatusHint(msg) {
        const el = document.getElementById('alb-status-hint');
        if (el) el.textContent = msg || '';
    }

    function getNotesText() {
        const el = document.getElementById('alb-notes-text');
        return el ? el.value.trim() : '';
    }

    function getTranscriptText() {
        const el = document.getElementById('alb-transcript-text');
        return el ? el.value.trim() : '';
    }

    function apiPost(payload) {
        return fetch(API_PATH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }

    function clampInt(n, min, max) {
        n = Number(n);
        if (!Number.isFinite(n)) return min;
        n = Math.round(n);
        if (n < min) return min;
        if (n > max) return max;
        return n;
    }

    function isReadyToGenerate() {
        return lastMissingCount === 0 && lastConfidence >= CONFIDENCE_THRESHOLD;
    }

    function areMandatoryQuestionsFilled() {
        const questionsDiv = document.getElementById('alb-intake-questions');
        if (!questionsDiv) return true;
        const inputs = questionsDiv.querySelectorAll('[id^="alb-intake-q-"]');
        for (let i = 0; i < inputs.length; i++) {
            if ((inputs[i].value || '').trim() === '') return false;
        }
        return true;
    }

    function setCurrentStep(step) {
        currentStep = step;
        render();
    }

    function setConfidence(confidence) {
        lastConfidence = clampInt(confidence, 0, 100);
        const wrap = document.getElementById('alb-confidence');
        const valueEl = document.getElementById('alb-confidence-value');
        const hintEl = document.getElementById('alb-confidence-hint');
        const fill = document.getElementById('alb-meter-fill');
        const meter = wrap ? wrap.querySelector('.alb-meter') : null;
        if (valueEl) valueEl.textContent = lastConfidence + '%';
        if (fill) fill.style.width = lastConfidence + '%';
        if (meter) meter.setAttribute('aria-valuenow', String(lastConfidence));
        if (hintEl) {
            hintEl.textContent = isReadyToGenerate()
                ? 'Confidence threshold met — ready to generate the log.'
                : ('Answer all questions and optionally clarify uncertain items to reach ' + CONFIDENCE_THRESHOLD + '% confidence.');
        }
    }

    function updateButtonsEnabledState() {
        const checkBtn = document.getElementById('alb-check-btn');
        const intakeSubmitBtn = document.getElementById('alb-intake-submit-btn');

        if (checkBtn) checkBtn.disabled = false;

        if (intakeSubmitBtn) {
            if (isReadyToGenerate()) {
                intakeSubmitBtn.textContent = 'Generate log';
                intakeSubmitBtn.disabled = false;
            } else {
                intakeSubmitBtn.textContent = 'Continue';
                intakeSubmitBtn.disabled = !areMandatoryQuestionsFilled();
            }
        }
    }

    function render() {
        const intake = document.getElementById('alb-intake');
        const uncertain = document.getElementById('alb-uncertain');
        const intakeActions = document.getElementById('alb-intake-actions');
        const checkBtn = document.getElementById('alb-check-btn');
        const confidenceWrap = document.getElementById('alb-confidence');
        const outputSection = document.getElementById('alb-output-section');
        const streamPanel = document.getElementById('alb-stream-panel');

        const showIntakeArea = currentStep === 'intake';
        const showStream = currentStep === 'generating';

        if (checkBtn) checkBtn.style.display = currentStep === 'form' ? 'inline-block' : 'none';
        if (confidenceWrap) confidenceWrap.style.display = showIntakeArea && lastConfidence > 0 ? 'block' : 'none';
        if (intake) intake.style.display = showIntakeArea ? 'block' : 'none';
        if (uncertain) uncertain.style.display = showIntakeArea ? 'block' : 'none';
        if (intakeActions) intakeActions.style.display = showIntakeArea ? 'flex' : 'none';
        if (streamPanel) streamPanel.style.display = showStream ? 'block' : 'none';

        if (outputSection && currentStep !== 'done') {
            outputSection.style.display = 'none';
        }

        updateButtonsEnabledState();
    }

    function keyForUncertain(category, item) {
        return 'Uncertain ' + category + ': ' + item;
    }

    function repopulateFromAccumulated() {
        document.querySelectorAll('[data-answer-key]').forEach(function (input) {
            const k = input.getAttribute('data-answer-key');
            if (k && accumulatedAnswers[k] != null && (input.value || '').trim() === '') {
                input.value = accumulatedAnswers[k];
            }
        });
    }

    function renderUncertainInputs(uncertainItems) {
        const uncertainContent = document.getElementById('alb-uncertain-content');
        if (!uncertainContent) return;

        uncertainContent.innerHTML = '';
        const groups = [
            { key: 'names', label: 'Names', category: 'name' },
            { key: 'rewards', label: 'Rewards', category: 'reward' },
            { key: 'outcomes', label: 'Outcomes', category: 'outcome' },
        ];

        let any = false;
        groups.forEach(function (g) {
            const items = (uncertainItems && Array.isArray(uncertainItems[g.key])) ? uncertainItems[g.key] : [];
            if (!items.length) return;
            any = true;

            const title = document.createElement('div');
            title.className = 'alb-section-title';
            title.textContent = g.label;
            uncertainContent.appendChild(title);

            items.forEach(function (raw, idx) {
                const item = String(raw == null ? '' : raw).trim();
                if (!item) return;
                const wrap = document.createElement('div');
                wrap.className = 'alb-intake-item alb-intake-item-textarea';
                const id = 'alb-uncertain-' + g.key + '-' + idx;
                const label = document.createElement('label');
                label.setAttribute('for', id);
                label.textContent = item;
                wrap.appendChild(label);
                const textarea = document.createElement('textarea');
                textarea.id = id;
                textarea.rows = 2;
                textarea.className = 'alb-intake-textarea';
                textarea.setAttribute('data-answer-key', keyForUncertain(g.category, item));
                textarea.placeholder = 'Optional clarification (what should this be exactly?)';
                wrap.appendChild(textarea);
                uncertainContent.appendChild(wrap);
            });
        });

        if (!any) {
            const p = document.createElement('p');
            p.className = 'alb-helper';
            p.textContent = 'No uncertain items detected.';
            uncertainContent.appendChild(p);
        }

        uncertainContent.querySelectorAll('textarea').forEach(function (el) {
            el.addEventListener('input', updateButtonsEnabledState);
            el.addEventListener('change', updateButtonsEnabledState);
        });
    }

    function showIntake(missingQuestions, uncertainItems, confidence) {
        const intake = document.getElementById('alb-intake');
        const questionsDiv = document.getElementById('alb-intake-questions');
        if (!intake || !questionsDiv) return;

        lastMissingCount = (missingQuestions || []).length;
        lastUncertainItems = uncertainItems && (uncertainItems.names?.length || uncertainItems.rewards?.length || uncertainItems.outcomes?.length) ? uncertainItems : null;

        questionsDiv.innerHTML = '';
        renderUncertainInputs(lastUncertainItems || {});

        if (lastMissingCount > 0) {
            missingQuestions.forEach(function (q, i) {
                const wrap = document.createElement('div');
                wrap.className = 'alb-intake-item alb-intake-item-textarea';
                const id = 'alb-intake-q-' + i;
                const label = document.createElement('label');
                label.setAttribute('for', id);
                label.textContent = q;
                wrap.appendChild(label);
                const textarea = document.createElement('textarea');
                textarea.id = id;
                textarea.setAttribute('data-answer-key', q);
                textarea.rows = 3;
                textarea.className = 'alb-intake-textarea';
                wrap.appendChild(textarea);
                questionsDiv.appendChild(wrap);
            });
            questionsDiv.querySelectorAll('.alb-intake-textarea').forEach(function (el) {
                el.addEventListener('input', updateButtonsEnabledState);
                el.addEventListener('change', updateButtonsEnabledState);
            });
        }

        repopulateFromAccumulated();
        setConfidence(confidence == null ? 0 : confidence);
        updateButtonsEnabledState();
    }

    function escapeHtml(s) {
        if (s == null) return '';
        const div = document.createElement('div');
        div.textContent = String(s);
        return div.innerHTML;
    }

    function collectIntakeAnswers() {
        document.querySelectorAll('[data-answer-key]').forEach(function (input) {
            const k = input.getAttribute('data-answer-key');
            if (!k) return;
            const v = (input.value || '').trim();
            if (v !== '') accumulatedAnswers[k] = v;
        });
        return accumulatedAnswers;
    }

    function runIntake() {
        const notesText = getNotesText();
        const transcriptText = getTranscriptText();

        if (!notesText && !transcriptText) {
            setError('Add at least notes or transcript content.');
            return;
        }

        if (currentStep === 'form') {
            accumulatedAnswers = {};
        } else {
            collectIntakeAnswers();
        }

        const session = getSessionFromForm();
        const defaults = getDefaultsForRequest(session);

        setError('');
        setCurrentStep('intake');
        setLoading(true, 'intake');

        apiPost({
            step: 'intake',
            session: session,
            defaults: defaults,
            notesText: notesText,
            transcriptText: transcriptText,
            previousAnswers: accumulatedAnswers
        })
            .then(function (res) {
                return res.json().then(function (data) {
                    if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
                    return data;
                });
            })
            .then(function (data) {
                setLoading(false);
                const missing = data.missingQuestions || [];
                const uncertainItems = data.uncertainItems || {};
                const confidence = data.confidence == null ? 0 : data.confidence;
                showIntake(missing, uncertainItems, confidence);
                render();
            })
            .catch(function (err) {
                setLoading(false);
                if (currentStep !== 'form') setCurrentStep('intake');
                setError(err.message || 'Request failed');
            });
    }

    function runGenerate() {
        const notesText = getNotesText();
        const transcriptText = getTranscriptText();

        if (!notesText && !transcriptText) {
            setError('Add at least notes or transcript content.');
            return;
        }

        collectIntakeAnswers();

        const session = getSessionFromForm();
        const defaults = getDefaultsForRequest(session);

        setError('');
        setCurrentStep('generating');
        showStreamPanel();
        setLoading(true, 'generate');

        function onGenerateError(msg) {
            hideStreamPanel();
            setLoading(false);
            setCurrentStep('intake');
            setError(msg || 'Request failed');
        }

        function readStream(reader, decoder, fullText) {
            return reader.read().then(function (result) {
                if (result.done) {
                    return fullText;
                }
                var buffer = decoder.decode(result.value, { stream: true });
                var lines = buffer.split('\n');
                for (var i = 0; i < lines.length; i++) {
                    var trimmed = lines[i].trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;
                    try {
                        var parsed = JSON.parse(trimmed.slice(6));
                        if (parsed.error) throw new Error(parsed.error);
                        if (typeof parsed.chunk === 'string' && parsed.chunk) {
                            fullText += parsed.chunk;
                            appendStreamChunk(parsed.chunk);
                        }
                    } catch (parseErr) {
                        if (parseErr.message && parseErr.message !== 'Unexpected token') {
                            throw parseErr;
                        }
                    }
                }
                return readStream(reader, decoder, fullText);
            });
        }

        fetch(API_PATH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                step: 'generate',
                session: session,
                defaults: defaults,
                notesText: notesText,
                transcriptText: transcriptText,
                answers: accumulatedAnswers
            })
        })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (data) {
                    throw new Error(data.error || res.statusText || 'Request failed');
                });
            }
            var reader = res.body.getReader();
            var decoder = new TextDecoder();
            return readStream(reader, decoder, '');
        })
        .then(function (fullText) {
            hideStreamPanel();
            setLoading(false);
            if (fullText && fullText.trim()) {
                updateStoredDefaults();
                showOutput(fullText.trim());
                setCurrentStep('done');
            } else {
                onGenerateError('No content received from the API.');
            }
        })
        .catch(function (err) {
            onGenerateError(err.message || 'Request failed');
        });
    }

    function updateStoredDefaults() {
        const session = getSessionFromForm();
        const d = getDefaults();
        d.partOfCampaign = session.partOfCampaign || d.partOfCampaign;
        d.adventure = session.adventure || d.adventure;
        d.sessionDate = session.sessionDate || d.sessionDate;
        if (session.players && session.players.length) {
            d.players = session.players;
            d.recentPlayers = session.players.map(function (p) { return p.player; }).filter(Boolean);
        }
        saveDefaults(d);

        const adventureKey = getAdventureKey(session.adventure, session.partOfCampaign);
        if (adventureKey) {
            const perAdv = getPerAdventureDefaults();
            perAdv[adventureKey] = {
                sessionDate: session.sessionDate || '',
                players: session.players || []
            };
            savePerAdventureDefaults(perAdv);
        }

        if (session.players && session.players.length) {
            const global = getGlobalDefaults();
            const names = session.players.map(function (p) { return p.player; }).filter(Boolean);
            global.recentPlayers = mergeRecentPlayers(global.recentPlayers, names, GLOBAL_RECENT_PLAYERS_CAP);
            saveGlobalDefaults(global);
        }
    }

    function showOutput(logText) {
        const section = document.getElementById('alb-output-section');
        const body = document.getElementById('alb-output-body');
        if (!section || !body) return;

        body.classList.remove('editing');
        body.innerHTML = '';
        const pre = document.createElement('pre');
        pre.id = 'alb-output-pre';
        pre.textContent = logText;
        body.appendChild(pre);
        section.style.display = 'block';

        currentOutputText = logText;
        bindOutputButtons();
    }

    let currentOutputText = '';

    function bindOutputButtons() {
        const copyBtn = document.getElementById('alb-copy-btn');
        const downloadBtn = document.getElementById('alb-download-btn');
        const editBtn = document.getElementById('alb-edit-output-btn');
        const regenBtn = document.getElementById('alb-regenerate-btn');

        function getCurrentOutputText() {
            const body = document.getElementById('alb-output-body');
            if (!body) return currentOutputText;
            const textarea = body.querySelector('textarea');
            if (textarea) return textarea.value;
            const pre = body.querySelector('#alb-output-pre');
            return pre ? pre.textContent : currentOutputText;
        }

        if (copyBtn) {
            copyBtn.onclick = function () {
                const text = getCurrentOutputText();
                navigator.clipboard.writeText(text).then(function () {
                    setStatus('Copied to clipboard.');
                    setTimeout(setStatus, 2000);
                }).catch(function () {
                    setError('Copy failed');
                });
            };
        }

        if (downloadBtn) {
            downloadBtn.onclick = function () {
                const text = getCurrentOutputText();
                const session = getSessionFromForm();
                const datePart = (session.sessionDate || 'date').replace(/\s+/g, '-');
                const name = 'adventure-log-' + (session.adventure || 'log').replace(/\s+/g, '-') + '-' + datePart + '.md';
                const blob = new Blob([text], { type: 'text/markdown' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = name;
                a.click();
                URL.revokeObjectURL(a.href);
                setStatus('Downloaded.');
                setTimeout(setStatus, 2000);
            };
        }

        if (editBtn) {
            editBtn.onclick = function () {
                const body = document.getElementById('alb-output-body');
                const text = getCurrentOutputText();
                if (!body) return;
                body.classList.add('editing');
                body.innerHTML = '';
                const textarea = document.createElement('textarea');
                textarea.value = text;
                body.appendChild(textarea);
            };
        }

        if (regenBtn) {
            regenBtn.onclick = function () {
                runGenerate();
            };
        }
    }

    function init() {
        initPlayersTable();
        prefillForm();

        setupDropZone('alb-notes-drop', 'alb-notes-input', 'alb-notes-text', 'alb-notes-files');
        setupDropZone('alb-transcript-drop', 'alb-transcript-input', 'alb-transcript-text', 'alb-transcript-files');

        const checkBtn = document.getElementById('alb-check-btn');
        const intakeSubmitBtn = document.getElementById('alb-intake-submit-btn');

        if (checkBtn) {
            checkBtn.addEventListener('click', function () {
                runIntake();
            });
        }

        if (intakeSubmitBtn) {
            intakeSubmitBtn.addEventListener('click', function () {
                if (isReadyToGenerate()) {
                    runGenerate();
                } else {
                    if (!areMandatoryQuestionsFilled()) {
                        setError('Please answer the required questions above.');
                        return;
                    }
                    runIntake();
                }
            });
        }

        setConfidence(0);
        setCurrentStep('form');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
