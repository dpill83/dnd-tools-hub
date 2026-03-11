(function () {
    'use strict';

    const STORAGE_KEY = 'adventureLogDefaults';
    const STORAGE_KEY_GLOBAL = 'adventureLogGlobalDefaults';
    const STORAGE_KEY_PER_ADVENTURE = 'adventureLogPerAdventure';
    const API_PATH = '/api/adventure-log';
    const FILE_SEP = '\n\n--- File: ';
    const GLOBAL_RECENT_PLAYERS_CAP = 20;

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
        const a = (adventure || '').trim();
        const p = (partOfCampaign || '').trim();
        return a + (p ? '|' + p : '');
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
        return {
            adventure: d.adventure || '',
            partOfCampaign: d.partOfCampaign || '',
            sessionDate: adv ? adv.sessionDate : d.sessionDate,
            sessionNumber: adv ? adv.sessionNumber : d.sessionNumber,
            dm: adv ? adv.dm : d.dm,
            players: playersArray,
            recentPlayers: nameList.length ? nameList : (d.recentPlayers || global.recentPlayers || [])
        };
    }

    function getSessionFromForm() {
        const adventure = (document.getElementById('alb-adventure') && document.getElementById('alb-adventure').value) || '';
        const partOfCampaign = (document.getElementById('alb-part-of-campaign') && document.getElementById('alb-part-of-campaign').value) || '';
        const sessionDate = (document.getElementById('alb-session-date') && document.getElementById('alb-session-date').value) || '';
        const sessionNumber = (document.getElementById('alb-session-number') && document.getElementById('alb-session-number').value) || '';
        const dm = (document.getElementById('alb-dm') && document.getElementById('alb-dm').value) || '';
        const tbody = document.getElementById('alb-players-tbody');
        const players = [];
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(function (tr) {
                const playerInput = tr.querySelector('.alb-input-player');
                const characterInput = tr.querySelector('.alb-input-character');
                const statusSelect = tr.querySelector('.alb-select-status');
                const player = (playerInput && playerInput.value) ? playerInput.value.trim() : '';
                const character = (characterInput && characterInput.value) ? characterInput.value.trim() : '';
                const status = (statusSelect && statusSelect.value) ? statusSelect.value : 'Present';
                if (player || character) {
                    players.push({ player: player, character: character, status: status });
                }
            });
        }
        return {
            adventure: adventure.trim(),
            partOfCampaign: partOfCampaign.trim(),
            sessionDate: sessionDate.trim(),
            sessionNumber: sessionNumber.trim(),
            dm: dm.trim(),
            players: players
        };
    }

    function getRecentPlayerNames() {
        const global = getGlobalDefaults();
        const d = getDefaults();
        const perAdv = getPerAdventureDefaults();
        const key = getAdventureKey(d.adventure, d.partOfCampaign);
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

    function addPlayerRow(player, character, status) {
        const tbody = document.getElementById('alb-players-tbody');
        if (!tbody) return;
        player = player || '';
        character = character || '';
        status = status || 'Present';
        const tr = document.createElement('tr');
        const playerId = 'alb-player-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        tr.innerHTML =
            '<td><label for="' + playerId + '" class="alb-sr-only">Player name</label><input type="text" class="alb-input-player" id="' + playerId + '" list="alb-player-suggestions" placeholder="Player name" autocomplete="off"></td>' +
            '<td><label for="' + playerId + '-char" class="alb-sr-only">Character name</label><input type="text" class="alb-input-character" id="' + playerId + '-char" placeholder="Character name"></td>' +
            '<td><label for="' + playerId + '-status" class="alb-sr-only">Status</label><select class="alb-select-status" id="' + playerId + '-status" aria-label="Status"><option value="Present"' + (status === 'Present' ? ' selected' : '') + '>Present</option><option value="Absent"' + (status === 'Absent' ? ' selected' : '') + '>Absent</option></select></td>' +
            '<td class="alb-row-remove"><button type="button" class="alb-row-remove-btn" aria-label="Remove this row">\u2012</button></td>';
        const playerInput = tr.querySelector('.alb-input-player');
        const characterInput = tr.querySelector('.alb-input-character');
        const statusSelect = tr.querySelector('.alb-select-status');
        if (playerInput) playerInput.value = player;
        if (characterInput) characterInput.value = character;
        if (statusSelect) statusSelect.value = status;
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
            addPlayerRow('', '', 'Present');
        }
        addBtn.addEventListener('click', function () {
            addPlayerRow('', '', 'Present');
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
        const numEl = document.getElementById('alb-session-number');
        const dmEl = document.getElementById('alb-dm');
        const tbody = document.getElementById('alb-players-tbody');

        if (adventureEl && d.adventure) adventureEl.value = d.adventure;
        if (partOfCampaignEl && d.partOfCampaign) partOfCampaignEl.value = d.partOfCampaign;

        const adventureKey = getAdventureKey(d.adventure, d.partOfCampaign);
        const adventureSpecific = (adventureKey && perAdv[adventureKey]) ? perAdv[adventureKey] : null;
        const lastDate = adventureSpecific ? adventureSpecific.sessionDate : d.sessionDate;
        const lastNum = adventureSpecific ? adventureSpecific.sessionNumber : d.sessionNumber;
        const lastDm = adventureSpecific ? adventureSpecific.dm : d.dm;
        let lastPlayers = adventureSpecific && adventureSpecific.players ? adventureSpecific.players : (d.players || []);
        if (!Array.isArray(lastPlayers)) {
            lastPlayers = (d.recentPlayers && Array.isArray(d.recentPlayers)) ? d.recentPlayers.map(function (name) { return { player: name, character: '', status: 'Present' }; }) : [];
        } else if (lastPlayers.length && typeof lastPlayers[0] === 'string') {
            lastPlayers = lastPlayers.map(function (name) { return { player: name, character: '', status: 'Present' }; });
        }

        if (dateEl && lastDate) dateEl.value = String(lastDate).trim().replace(/\//g, '-');
        if (numEl && lastNum != null && lastNum !== '') numEl.value = String(lastNum);
        if (dmEl && lastDm) dmEl.value = lastDm;

        if (tbody && lastPlayers.length > 0) {
            tbody.innerHTML = '';
            lastPlayers.forEach(function (row) {
                addPlayerRow(
                    typeof row === 'string' ? row : (row && row.player),
                    typeof row === 'string' ? '' : (row && row.character),
                    typeof row === 'string' ? 'Present' : (row && row.status) || 'Present'
                );
            });
        }
        refreshPlayerSuggestions();

        if (dateEl && !dateEl.value && lastDate) {
            try {
                const iso = String(lastDate).trim().replace(/\//g, '-');
                const next = new Date(iso);
                if (!isNaN(next.getTime())) {
                    dateEl.value = next.toISOString().slice(0, 10);
                }
            } catch (_) {}
        }
        if (numEl && numEl.value === '' && lastNum != null && lastNum !== '') {
            const n = parseInt(lastNum, 10);
            if (!isNaN(n)) numEl.value = String(n + 1);
        }
    }

    function readFiles(files, callback) {
        if (!files || !files.length) {
            callback('', []);
            return;
        }
        const names = [];
        let combined = '';
        let done = 0;
        const total = files.length;
        function onLoad() {
            done++;
            if (done === total) callback(combined, names);
        }
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const name = file.name || 'file';
            names.push(name);
            const reader = new FileReader();
            reader.onload = function (e) {
                const text = (e.target && e.target.result) || '';
                combined += (combined ? FILE_SEP + name + ' ---\n\n' : '') + text;
                onLoad();
            };
            reader.onerror = onLoad;
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

    function setLoading(loading) {
        const checkBtn = document.getElementById('alb-check-btn');
        const genBtn = document.getElementById('alb-generate-btn');
        const genAfter = document.getElementById('alb-generate-after-intake');
        [checkBtn, genBtn, genAfter].forEach(function (btn) {
            if (btn) btn.disabled = loading;
        });
        setStatus(loading ? 'Sending…' : '');
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

    function showIntake(missingQuestions, uncertainItems) {
        const intake = document.getElementById('alb-intake');
        const questionsDiv = document.getElementById('alb-intake-questions');
        const genAfter = document.getElementById('alb-generate-after-intake');
        const uncertain = document.getElementById('alb-uncertain');
        const uncertainContent = document.getElementById('alb-uncertain-content');
        if (!intake || !questionsDiv) return;

        questionsDiv.innerHTML = '';
        intake.style.display = 'none';
        uncertain.style.display = 'none';

        if (missingQuestions && missingQuestions.length > 0) {
            intake.style.display = 'block';
            missingQuestions.forEach(function (q, i) {
                const wrap = document.createElement('div');
                wrap.className = 'alb-intake-item';
                const id = 'alb-intake-q-' + i;
                wrap.innerHTML = '<label for="' + id + '">' + escapeHtml(q) + '</label><input type="text" id="' + id + '" data-question="' + escapeHtml(q) + '">';
                questionsDiv.appendChild(wrap);
            });
            if (genAfter) genAfter.style.display = 'inline-block';
        } else {
            if (genAfter) genAfter.style.display = 'none';
        }

        if (uncertainItems && (uncertainItems.names?.length || uncertainItems.rewards?.length || uncertainItems.outcomes?.length)) {
            uncertain.style.display = 'block';
            let html = '';
            if (uncertainItems.names && uncertainItems.names.length) {
                html += '<p><strong>Names:</strong></p><ul><li>' + uncertainItems.names.map(escapeHtml).join('</li><li>') + '</li></ul>';
            }
            if (uncertainItems.rewards && uncertainItems.rewards.length) {
                html += '<p><strong>Rewards:</strong></p><ul><li>' + uncertainItems.rewards.map(escapeHtml).join('</li><li>') + '</li></ul>';
            }
            if (uncertainItems.outcomes && uncertainItems.outcomes.length) {
                html += '<p><strong>Outcomes:</strong></p><ul><li>' + uncertainItems.outcomes.map(escapeHtml).join('</li><li>') + '</li></ul>';
            }
            if (uncertainContent) uncertainContent.innerHTML = html;
        }
    }

    function escapeHtml(s) {
        if (s == null) return '';
        const div = document.createElement('div');
        div.textContent = String(s);
        return div.innerHTML;
    }

    function collectIntakeAnswers() {
        const answers = {};
        document.querySelectorAll('[id^="alb-intake-q-"]').forEach(function (input) {
            const q = input.getAttribute('data-question');
            if (q) answers[q] = input.value || '';
        });
        return answers;
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
        setLoading(true);

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
                    document.getElementById('alb-intake').style.display = 'none';
                    document.getElementById('alb-uncertain').style.display = 'none';
                }
            })
            .catch(function (err) {
                setLoading(false);
                setError(err.message || 'Request failed');
            });
    }

    function updateStoredDefaults() {
        const session = getSessionFromForm();
        const d = getDefaults();
        d.adventure = session.adventure || d.adventure;
        d.partOfCampaign = session.partOfCampaign || d.partOfCampaign;
        d.sessionDate = session.sessionDate || d.sessionDate;
        d.sessionNumber = session.sessionNumber != null && session.sessionNumber !== '' ? session.sessionNumber : d.sessionNumber;
        d.dm = session.dm || d.dm;
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
                sessionNumber: session.sessionNumber != null && session.sessionNumber !== '' ? session.sessionNumber : '',
                dm: session.dm || '',
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
                bindOutputButtons();
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
        const genAfter = document.getElementById('alb-generate-after-intake');

        if (checkBtn) {
            checkBtn.addEventListener('click', function () {
                const session = getSessionFromForm();
                const defaults = getDefaultsForRequest(session);
                const notesText = getNotesText();
                const transcriptText = getTranscriptText();

                if (!notesText && !transcriptText) {
                    setError('Add at least notes or transcript content.');
                    return;
                }
                setError('');
                setLoading(true);

                apiPost({
                    step: 'intake',
                    session: session,
                    defaults: defaults,
                    notesText: notesText,
                    transcriptText: transcriptText
                })
                    .then(function (res) {
                        return res.json().then(function (data) {
                            if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
                            return data;
                        });
                    })
                    .then(function (data) {
                        setLoading(false);
                        showIntake(data.missingQuestions || [], data.uncertainItems);
                        if (!(data.missingQuestions && data.missingQuestions.length > 0)) {
                            generateBtn.style.display = 'inline-block';
                            setStatus('No missing fields. You can generate.');
                        }
                    })
                    .catch(function (err) {
                        setLoading(false);
                        setError(err.message || 'Request failed');
                    });
            });
        }

        if (generateBtn) {
            generateBtn.addEventListener('click', runGenerate);
        }

        if (genAfter) {
            genAfter.addEventListener('click', function () {
                runGenerate();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
