(function () {
    'use strict';

    const API_PATH = '/api/adventure-log';
    const API_PLAYERS = '/api/players';
    const API_CHARACTERS = '/api/characters';
    const API_SESSIONS = '/api/sessions';
    const FILE_SEP = '\n\n--- File: ';
    const CONFIDENCE_THRESHOLD = 75;
    const AUTOCOMPLETE_DEBOUNCE_MS = 200;
    const MANAGE_PAGE_SIZE = 50;

    let lastUncertainItems = null;
    let accumulatedAnswers = {};
    let lastMissingCount = 0;
    let currentStep = 'form'; // 'form' | 'intake' | 'generating' | 'done'
    let lastConfidence = 0;

    function getDefaultsForRequest(session) {
        const nameList = (session.players || []).map(function (p) { return typeof p === 'string' ? p : (p && p.player); }).filter(Boolean);
        return {
            partOfCampaign: session.partOfCampaign || '',
            sessionDate: session.sessionDate || '',
            dm: session.dm || '',
            players: session.players || [],
            recentPlayers: nameList
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

    function debounce(fn, delay) {
        var t = null;
        return function () {
            var self = this, args = arguments;
            if (t) clearTimeout(t);
            t = setTimeout(function () { fn.apply(self, args); }, delay);
        };
    }

    function updatePlayerSuggestions(query) {
        const datalist = document.getElementById('alb-player-suggestions');
        if (!datalist) return;
        datalist.innerHTML = '';
        if (!query || !query.trim()) return;
        fetch(API_PLAYERS + '?q=' + encodeURIComponent(query.trim()))
            .then(function (res) { return res.ok ? res.json() : []; })
            .then(function (items) {
                if (!Array.isArray(items)) return;
                datalist.innerHTML = '';
                items.forEach(function (p) {
                    const name = p && (p.name != null) ? String(p.name) : '';
                    if (name) {
                        const opt = document.createElement('option');
                        opt.value = name;
                        datalist.appendChild(opt);
                    }
                });
            })
            .catch(function () {});
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
        var debouncedSuggest = debounce(function () {
            updatePlayerSuggestions(playerInput.value);
        }, AUTOCOMPLETE_DEBOUNCE_MS);
        playerInput.addEventListener('input', debouncedSuggest);
        playerInput.addEventListener('focus', function () { updatePlayerSuggestions(playerInput.value); });
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
                showOutput(fullText.trim());
                showRewardsPanel(fullText.trim());
                setCurrentStep('done');
            } else {
                onGenerateError('No content received from the API.');
            }
        })
        .catch(function (err) {
            onGenerateError(err.message || 'Request failed');
        });
    }

    function parseRewardsFromLog(logText, session) {
        var rows = [];
        var playerNames = (session.players || []).filter(function (p) {
            var c = (p.character || '').trim().toLowerCase();
            return c !== 'dm';
        }).map(function (p) { return (p.player || '').trim(); }).filter(Boolean);
        if (!playerNames.length) return rows;
        var rewardsSection = logText.match(/(?:##?\s*Rewards?[\s\S]*?)(?=##|\n---|\z)/i);
        var sectionText = rewardsSection ? rewardsSection[0] : logText;
        var xpMatch = sectionText.match(/(?:total\s+)?(?:xp|experience)[:\s]*(\d+)/i) || sectionText.match(/(\d+)\s*(?:xp|experience)/i);
        var goldMatch = sectionText.match(/(?:total\s+)?(?:gold|gp|g\.?p\.?)[:\s]*(\d+)/i) || sectionText.match(/(\d+)\s*(?:gp|gold)/i);
        var xp = xpMatch ? parseInt(xpMatch[1], 10) : 0;
        var gold = goldMatch ? parseInt(goldMatch[1], 10) : 0;
        var perPlayer = playerNames.length ? Math.floor(xp / playerNames.length) : 0;
        var goldPerPlayer = playerNames.length ? Math.floor(gold / playerNames.length) : 0;
        playerNames.forEach(function (name) {
            rows.push({ player_name: name, xp: perPlayer, gold: goldPerPlayer, notes: '' });
        });
        return rows;
    }

    function showRewardsPanel(logText) {
        var section = document.getElementById('alb-rewards-section');
        var wrap = document.getElementById('alb-rewards-table-wrap');
        var warningEl = document.getElementById('alb-rewards-warning');
        if (!section || !wrap) return;
        if (warningEl) { warningEl.style.display = 'none'; warningEl.textContent = ''; }
        var session = getSessionFromForm();
        var suggested = parseRewardsFromLog(logText, session);
        var playerNames = (session.players || []).filter(function (p) {
            var c = (p.character || '').trim().toLowerCase();
            return c !== 'dm';
        }).map(function (p) { return (p.player || '').trim(); }).filter(Boolean);
        var seen = {};
        var rows = [];
        suggested.forEach(function (r) {
            var n = (r.player_name || '').trim();
            if (n && !seen[n]) { seen[n] = true; rows.push({ player_name: n, xp: r.xp || 0, gold: r.gold || 0, notes: r.notes || '' }); }
        });
        playerNames.forEach(function (n) {
            if (n && !seen[n]) { seen[n] = true; rows.push({ player_name: n, xp: 0, gold: 0, notes: '' }); }
        });
        wrap.innerHTML = '';
        var table = document.createElement('table');
        table.innerHTML = '<thead><tr><th>Player</th><th>XP</th><th>Gold</th><th>Notes</th></tr></thead><tbody id="alb-rewards-tbody"></tbody>';
        var tbody = table.querySelector('#alb-rewards-tbody');
        rows.forEach(function (r, i) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + escapeHtml(r.player_name) + '</td><td><input type="number" min="0" data-reward-idx="' + i + '" data-reward-field="xp" value="' + (r.xp || 0) + '"></td><td><input type="number" min="0" data-reward-idx="' + i + '" data-reward-field="gold" value="' + (r.gold || 0) + '"></td><td><input type="text" data-reward-idx="' + i + '" data-reward-field="notes" value="' + (r.notes || '') + '" placeholder="Optional"></td>';
            tbody.appendChild(tr);
        });
        wrap.appendChild(table);
        section.style.display = 'block';
        window._albRewardsData = rows;
    }

    function collectRewardsFromPanel() {
        var data = window._albRewardsData;
        if (!Array.isArray(data)) return [];
        var inputs = document.querySelectorAll('#alb-rewards-table-wrap [data-reward-idx]');
        var byIdx = {};
        inputs.forEach(function (inp) {
            var idx = parseInt(inp.getAttribute('data-reward-idx'), 10);
            var field = inp.getAttribute('data-reward-field');
            if (!byIdx[idx]) byIdx[idx] = { player_name: data[idx] && data[idx].player_name || '', xp: 0, gold: 0, notes: '' };
            if (field === 'xp') byIdx[idx].xp = parseInt(inp.value, 10) || 0;
            else if (field === 'gold') byIdx[idx].gold = parseInt(inp.value, 10) || 0;
            else if (field === 'notes') byIdx[idx].notes = (inp.value || '').trim();
        });
        return Object.keys(byIdx).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return byIdx[k]; });
    }

    function saveRewardsAndStats() {
        var session = getSessionFromForm();
        var rewards = collectRewardsFromPanel();
        var attendees = (session.players || []).map(function (p) {
            var role = (p.character || '').trim().toLowerCase() === 'dm' ? 'DM' : 'PLAYER';
            return { player_name: (p.player || '').trim(), character_name: (p.character || '').trim(), role: role };
        }).filter(function (a) { return a.player_name || a.character_name; });
        var payload = {
            campaign_name: session.partOfCampaign || '',
            adventure: session.adventure || null,
            date: session.sessionDate || '',
            dm_player_name: session.dm || '',
            attendees: attendees,
            rewards: rewards
        };
        fetch(API_SESSIONS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
            .then(function (result) {
                var warningEl = document.getElementById('alb-rewards-warning');
                if (result.ok) {
                    if (result.data.warnings && result.data.warnings.length) {
                        if (warningEl) {
                            warningEl.textContent = result.data.warnings.join(' ');
                            warningEl.style.display = 'block';
                        }
                        setStatus('Session saved. Some rewards could not be matched: ' + result.data.warnings.join(' '));
                    } else {
                        if (warningEl) { warningEl.style.display = 'none'; warningEl.textContent = ''; }
                        setStatus('Session and rewards saved.');
                    }
                } else {
                    if (warningEl) {
                        warningEl.textContent = result.data.error || 'Failed to save session.';
                        warningEl.style.display = 'block';
                    }
                }
            })
            .catch(function (err) {
                var warningEl = document.getElementById('alb-rewards-warning');
                if (warningEl) {
                    warningEl.textContent = err.message || 'Failed to save session.';
                    warningEl.style.display = 'block';
                }
            });
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

    var managePlayersPage = 1;
    var managePlayersTotal = 0;
    var manageCharactersByPlayer = {};

    function openManageModal() {
        var modal = document.getElementById('alb-manage-players-modal');
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'false');
        managePlayersPage = 1;
        loadManagePage(1);
        document.body.style.overflow = 'hidden';
        var closeBtn = modal.querySelector('.alb-modal-close');
        if (closeBtn) closeBtn.focus();
    }

    function closeManageModal() {
        var modal = document.getElementById('alb-manage-players-modal');
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        var btn = document.getElementById('alb-manage-players-btn');
        if (btn) btn.focus();
    }

    function loadManagePage(page) {
        var listEl = document.getElementById('alb-manage-players-list');
        var pageInfo = document.getElementById('alb-manage-page-info');
        var prevBtn = document.getElementById('alb-manage-prev');
        var nextBtn = document.getElementById('alb-manage-next');
        if (!listEl) return;
        listEl.innerHTML = '<p class="alb-helper">Loading…</p>';
        fetch(API_PLAYERS + '?all=true&page=' + page + '&page_size=' + MANAGE_PAGE_SIZE)
            .then(function (res) { return res.ok ? res.json() : { items: [], total: 0 }; })
            .then(function (data) {
                var items = data.items || [];
                var total = data.total != null ? data.total : items.length;
                managePlayersTotal = total;
                if (prevBtn) prevBtn.disabled = page <= 1;
                if (nextBtn) nextBtn.disabled = page * MANAGE_PAGE_SIZE >= total;
                if (pageInfo) pageInfo.textContent = 'Page ' + page + ' of ' + (Math.ceil(total / MANAGE_PAGE_SIZE) || 1);
                if (items.length === 0) {
                    listEl.innerHTML = '<p class="alb-helper">No players yet. Add one below.</p>';
                    return;
                }
                var ids = items.map(function (p) { return p.id; }).filter(Boolean);
                return fetch(API_CHARACTERS + '?player_ids=' + ids.join(','))
                    .then(function (r) { return r.ok ? r.json() : []; })
                    .then(function (charData) {
                        manageCharactersByPlayer = {};
                        (charData || []).forEach(function (entry) {
                            var pid = entry.player_id;
                            manageCharactersByPlayer[pid] = entry.characters || [];
                        });
                        listEl.innerHTML = '';
                        items.forEach(function (p) {
                            var details = document.createElement('details');
                            details.className = 'alb-manage-player-row';
                            var chars = manageCharactersByPlayer[p.id] || [];
                            var charList = chars.map(function (c) { return '<li>' + escapeHtml(c.name) + '</li>'; }).join('');
                            var addCharId = 'alb-add-char-' + p.id;
                            details.innerHTML = '<summary>' + escapeHtml(p.name) + '</summary>' +
                                '<div class="alb-manage-character-list">' +
                                (charList ? '<ul>' + charList + '</ul>' : '') +
                                '<div class="alb-manage-add-char">' +
                                '<input type="text" id="' + addCharId + '" placeholder="New character name" data-player-id="' + p.id + '">' +
                                '<button type="button" class="alb-btn alb-add-char-btn" data-player-id="' + p.id + '">Add character</button>' +
                                '</div></div>';
                            var addBtn = details.querySelector('.alb-add-char-btn');
                            var addInput = details.querySelector('input[data-player-id]');
                            if (addBtn && addInput) {
                                addBtn.addEventListener('click', function () {
                                    var name = (addInput.value || '').trim();
                                    if (!name) return;
                                    fetch(API_CHARACTERS, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ player_id: p.id, name: name })
                                    })
                                        .then(function (res) { return res.ok ? res.json() : null; })
                                        .then(function (created) {
                                            if (created) {
                                                if (!manageCharactersByPlayer[p.id]) manageCharactersByPlayer[p.id] = [];
                                                manageCharactersByPlayer[p.id].push({ id: created.id, name: created.name });
                                                var ul = details.querySelector('.alb-manage-character-list ul');
                                                if (!ul) {
                                                    ul = document.createElement('ul');
                                                    details.querySelector('.alb-manage-character-list').insertBefore(ul, details.querySelector('.alb-manage-add-char'));
                                                }
                                                var li = document.createElement('li');
                                                li.textContent = created.name;
                                                ul.appendChild(li);
                                                addInput.value = '';
                                            }
                                        });
                                });
                            }
                            listEl.appendChild(details);
                        });
                    });
            })
            .catch(function () {
                if (listEl) listEl.innerHTML = '<p class="alb-helper">Failed to load players.</p>';
            });
    }

    function init() {
        initPlayersTable();

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

        var manageBtn = document.getElementById('alb-manage-players-btn');
        if (manageBtn) manageBtn.addEventListener('click', openManageModal);

        var modal = document.getElementById('alb-manage-players-modal');
        if (modal) {
            var closeBtn = modal.querySelector('.alb-modal-close');
            var backdrop = modal.querySelector('.alb-modal-backdrop');
            if (closeBtn) closeBtn.addEventListener('click', closeManageModal);
            if (backdrop) backdrop.addEventListener('click', closeManageModal);
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeManageModal();
            });
        }
        var managePrev = document.getElementById('alb-manage-prev');
        var manageNext = document.getElementById('alb-manage-next');
        if (managePrev) managePrev.addEventListener('click', function () { managePlayersPage--; loadManagePage(managePlayersPage); });
        if (manageNext) manageNext.addEventListener('click', function () { managePlayersPage++; loadManagePage(managePlayersPage); });

        var newPlayerName = document.getElementById('alb-new-player-name');
        var newPlayerChar = document.getElementById('alb-new-player-char');
        var addNewPlayerBtn = document.getElementById('alb-add-new-player-btn');
        if (addNewPlayerBtn && newPlayerName) {
            addNewPlayerBtn.addEventListener('click', function () {
                var name = (newPlayerName.value || '').trim();
                if (!name) return;
                fetch(API_PLAYERS, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name })
                })
                    .then(function (res) {
                        if (res.status === 409) throw new Error('Player already exists');
                        return res.ok ? res.json() : res.json().then(function (d) { throw new Error(d.error || 'Failed'); });
                    })
                    .then(function (player) {
                        var firstChar = (newPlayerChar && newPlayerChar.value) ? newPlayerChar.value.trim() : '';
                        if (firstChar) {
                            return fetch(API_CHARACTERS, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ player_id: player.id, name: firstChar })
                            }).then(function () { return player; });
                        }
                        return player;
                    })
                    .then(function () {
                        newPlayerName.value = '';
                        if (newPlayerChar) newPlayerChar.value = '';
                        loadManagePage(managePlayersPage);
                    })
                    .catch(function (err) {
                        setError(err.message || 'Could not add player');
                    });
            });
        }

        var saveRewardsBtn = document.getElementById('alb-save-rewards-btn');
        if (saveRewardsBtn) saveRewardsBtn.addEventListener('click', saveRewardsAndStats);

        setConfidence(0);
        setCurrentStep('form');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
