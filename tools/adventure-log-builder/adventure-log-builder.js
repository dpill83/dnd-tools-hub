(function () {
    'use strict';

    const STORAGE_KEY = 'adventureLogDefaults';
    const STORAGE_KEY_GLOBAL = 'adventureLogGlobalDefaults';
    const STORAGE_KEY_PER_ADVENTURE = 'adventureLogPerAdventure';
    const API_PATH = '/api/adventure-log';
    const FILE_SEP = '\n\n--- File: ';
    const GLOBAL_RECENT_PLAYERS_CAP = 20;
    const CONFIDENCE_THRESHOLD = 70;

    let lastUncertainItems = null;
    let currentStep = 'form'; // 'form' | 'intake' | 'ready' | 'generating' | 'done'
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

    function setLoading(loading, step) {
        const checkBtn = document.getElementById('alb-check-btn');
        const genBtn = document.getElementById('alb-generate-btn');
        const intakeSubmitBtn = document.getElementById('alb-intake-submit-btn');
        [checkBtn, genBtn, intakeSubmitBtn].forEach(function (btn) {
            if (btn) btn.disabled = loading;
        });
        if (_loadingTimer) {
            clearTimeout(_loadingTimer);
            _loadingTimer = null;
        }
        if (loading) {
            setStatus(step === 'generate' ? 'Generating log…' : 'Checking…');
            setStatusHint(step === 'generate' ? 'This may take 30–60 seconds for long notes.' : '');
            _loadingTimer = setTimeout(function () {
                _loadingTimer = null;
                if (document.getElementById('alb-generate-btn') && document.getElementById('alb-generate-btn').disabled) {
                    setStatus('Still generating… (this can take a minute for long notes)');
                } else if (document.getElementById('alb-check-btn') && document.getElementById('alb-check-btn').disabled) {
                    setStatus('Still checking…');
                }
            }, 10000);
        } else {
            if (_loadingTimer) {
                clearTimeout(_loadingTimer);
                _loadingTimer = null;
            }
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

    function areMandatoryQuestionsFilled() {
        const questionsDiv = document.getElementById('alb-intake-questions');
        if (!questionsDiv) return true;
        const inputs = questionsDiv.querySelectorAll('[id^="alb-intake-q-"]');
        for (let i = 0; i < inputs.length; i++) {
            const v = (inputs[i].value || '').trim();
            if (v === '') return false;
        }
        return inputs.length === 0 || true;
    }

    function clampInt(n, min, max) {
        n = Number(n);
        if (!Number.isFinite(n)) return min;
        n = Math.round(n);
        if (n < min) return min;
        if (n > max) return max;
        return n;
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
        if (wrap) wrap.style.display = (currentStep === 'intake' || currentStep === 'ready') ? 'block' : 'none';
        if (valueEl) valueEl.textContent = lastConfidence + '%';
        if (fill) fill.style.width = lastConfidence + '%';
        if (meter) meter.setAttribute('aria-valuenow', String(lastConfidence));
        if (hintEl) {
            hintEl.textContent = lastConfidence >= CONFIDENCE_THRESHOLD
                ? 'Good to go. You can generate the log.'
                : ('Answer required questions and optionally clarify uncertain items until confidence reaches ' + CONFIDENCE_THRESHOLD + '%.');
        }
    }

    function updateButtonsEnabledState() {
        const checkBtn = document.getElementById('alb-check-btn');
        const genBtn = document.getElementById('alb-generate-btn');
        const intakeSubmitBtn = document.getElementById('alb-intake-submit-btn');

        if (checkBtn) checkBtn.disabled = false;
        if (intakeSubmitBtn) {
            intakeSubmitBtn.disabled = !areMandatoryQuestionsFilled();
            intakeSubmitBtn.textContent = currentStep === 'ready' ? 'Update confidence' : 'Continue';
        }
        if (genBtn) {
            genBtn.disabled = !(currentStep === 'ready' && lastConfidence >= CONFIDENCE_THRESHOLD);
        }
    }

    function render() {
        const intake = document.getElementById('alb-intake');
        const uncertain = document.getElementById('alb-uncertain');
        const intakeActions = document.getElementById('alb-intake-actions');
        const checkBtn = document.getElementById('alb-check-btn');
        const genBtn = document.getElementById('alb-generate-btn');
        const outputSection = document.getElementById('alb-output-section');
        const confidenceWrap = document.getElementById('alb-confidence');

        if (checkBtn) checkBtn.style.display = currentStep === 'form' ? 'inline-block' : 'none';
        if (genBtn) genBtn.style.display = currentStep === 'ready' ? 'inline-block' : 'none';

        const showIntakeArea = currentStep === 'intake' || currentStep === 'ready';
        if (intake) intake.style.display = showIntakeArea ? 'block' : 'none';
        if (uncertain) uncertain.style.display = showIntakeArea ? 'block' : 'none';
        if (intakeActions) intakeActions.style.display = showIntakeArea ? 'flex' : 'none';

        if (confidenceWrap) confidenceWrap.style.display = showIntakeArea ? 'block' : 'none';

        if (outputSection && currentStep !== 'done') {
            // Keep output visible only in done state.
            outputSection.style.display = 'none';
        }

        updateButtonsEnabledState();
    }

    function keyForUncertain(category, item) {
        return 'Uncertain ' + category + ': ' + item;
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
        const uncertain = document.getElementById('alb-uncertain');
        const intakeActions = document.getElementById('alb-intake-actions');
        if (!intake || !questionsDiv) return;

        questionsDiv.innerHTML = '';
        if (intakeActions) intakeActions.style.display = 'flex';

        lastUncertainItems = uncertainItems && (uncertainItems.names?.length || uncertainItems.rewards?.length || uncertainItems.outcomes?.length) ? uncertainItems : null;
        if (uncertain) uncertain.style.display = 'block';
        renderUncertainInputs(lastUncertainItems || {});
        setConfidence(confidence == null ? 0 : confidence);

        if (missingQuestions && missingQuestions.length > 0) {
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
                textarea.setAttribute('data-question', q);
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
        } else {
        }

        updateButtonsEnabledState();
    }

    function escapeHtml(s) {
        if (s == null) return '';
        const div = document.createElement('div');
        div.textContent = String(s);
        return div.innerHTML;
    }

    function collectIntakeAnswers() {
        const answers = {};
        document.querySelectorAll('[data-answer-key]').forEach(function (input) {
            const k = input.getAttribute('data-answer-key');
            if (!k) return;
            const v = (input.value || '').trim();
            if (v !== '') answers[k] = input.value || '';
        });
        return answers;
    }

    function runIntake() {
        const session = getSessionFromForm();
        const defaults = getDefaultsForRequest(session);
        const notesText = getNotesText();
        const transcriptText = getTranscriptText();
        const answers = collectIntakeAnswers();

        if (!notesText && !transcriptText) {
            setError('Add at least notes or transcript content.');
            return;
        }

        setError('');
        setLoading(true, 'intake');

        apiPost({
            step: 'intake',
            session: session,
            defaults: defaults,
            notesText: notesText,
            transcriptText: transcriptText,
            answers: answers
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
                if (missing.length > 0) {
                    setCurrentStep('intake');
                } else {
                    setCurrentStep('ready');
                }
            })
            .catch(function (err) {
                setLoading(false);
                setError(err.message || 'Request failed');
            });
    }

    function runGenerate() {
        const session = getSessionFromForm();
        const notesText = getNotesText();
        const transcriptText = getTranscriptText();
        const defaults = getDefaultsForRequest(session);
        const answers = collectIntakeAnswers();

        if (!notesText && !transcriptText) {
            setError('Add at least notes or transcript content.');
            return;
        }

        setError('');
        setCurrentStep('generating');
        setLoading(true, 'generate');

        apiPost({
            step: 'generate',
            session: session,
            defaults: defaults,
            notesText: notesText,
            transcriptText: transcriptText,
            answers: answers
        })
            .then(function (res) {
                return res.json().then(function (data) {
                    if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
                    return data;
                });
            })
            .then(function (data) {
                setLoading(false);
                if (data.log != null) {
                    updateStoredDefaults();
                    showOutput(data.log);
                    setCurrentStep('done');
                }
            })
            .catch(function (err) {
                setLoading(false);
                setCurrentStep('ready');
                setError(err.message || 'Request failed');
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
        const generateBtn = document.getElementById('alb-generate-btn');
        const intakeSubmitBtn = document.getElementById('alb-intake-submit-btn');

        if (checkBtn) {
            checkBtn.addEventListener('click', function () {
                runIntake();
            });
        }

        if (generateBtn) {
            generateBtn.addEventListener('click', runGenerate);
        }

        if (intakeSubmitBtn) {
            intakeSubmitBtn.addEventListener('click', function () {
                if (!areMandatoryQuestionsFilled()) {
                    setError('Please answer the required questions above.');
                    return;
                }
                runIntake();
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
