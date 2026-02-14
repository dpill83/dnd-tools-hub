(function () {
    'use strict';

    const API_BASE = 'https://www.dnd5eapi.co';
    const SCHOOLS = [
        'Abjuration', 'Conjuration', 'Divination', 'Enchantment',
        'Evocation', 'Illusion', 'Necromancy', 'Transmutation'
    ];

    let spellList = [];
    let spellDetailCache = {};
    let selectedIndices = new Set();

    const $ = (id) => document.getElementById(id);

    function setStatus(msg, isError = false) {
        const el = $('stj-load-status');
        if (!el) return;
        el.textContent = msg;
        el.className = 'stj-status' + (isError ? ' stj-status-error' : '');
    }

    function showToast(msg) {
        const el = $('stj-toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 2500);
    }

    function buildExportSpell(raw) {
        const desc = Array.isArray(raw.desc) ? raw.desc.join(' ') : (raw.desc || '');
        const out = {
            name: raw.name,
            level: raw.level,
            school: raw.school?.name || '',
            casting_time: raw.casting_time || '',
            range: raw.range || '',
            components: Array.isArray(raw.components) ? raw.components.join(', ') : (raw.components || ''),
            duration: raw.duration || '',
            concentration: !!raw.concentration,
            ritual: !!raw.ritual,
            description: desc
        };
        if (Array.isArray(raw.higher_level) && raw.higher_level.length > 0) {
            out.at_higher_levels = raw.higher_level.join(' ');
        }
        if (raw.material) {
            out.material = raw.material;
        }
        return out;
    }

    function fetchSpellDetail(index) {
        if (spellDetailCache[index]) return Promise.resolve(spellDetailCache[index]);
        return fetch(`${API_BASE}/api/spells/${index}`)
            .then((r) => {
                if (!r.ok) throw new Error(r.statusText);
                return r.json();
            })
            .then((data) => {
                spellDetailCache[index] = data;
                return data;
            });
    }

    function loadSpellList() {
        setStatus('Loading spell list…');
        fetch(`${API_BASE}/api/spells`)
            .then((r) => {
                if (!r.ok) throw new Error('Could not load spells');
                return r.json();
            })
            .then((data) => {
                spellList = data.results || [];
                spellList.sort((a, b) => {
                    if (a.level !== b.level) return a.level - b.level;
                    return (a.name || '').localeCompare(b.name || '');
                });
                setStatus(`Loaded ${spellList.length} spells. Loading details for filters…`);
                renderSpellList();
                populateSchoolFilter();
                loadDetailsInBatches();
            })
            .catch((err) => {
                setStatus('Failed to load spells. Check your connection and try again.', true);
                console.error(err);
            });
    }

    function loadDetailsInBatches() {
        const BATCH = 15;
        let i = 0;
        function next() {
            const batch = spellList.slice(i, i + BATCH).map((s) => s.index);
            i += BATCH;
            if (batch.length === 0) {
                setStatus(`Loaded ${spellList.length} spells.`);
                renderSpellList();
                return;
            }
            Promise.all(batch.map((index) => fetchSpellDetail(index))).then(() => {
                renderSpellList();
                if (i < spellList.length) setTimeout(next, 50);
                else setStatus(`Loaded ${spellList.length} spells.`);
            }).catch(() => {
                setStatus(`Loaded spell list. Some details may be missing.`);
                renderSpellList();
            });
        }
        next();
    }

    function populateSchoolFilter() {
        const sel = $('stj-school');
        if (!sel) return;
        sel.innerHTML = '<option value="">All schools</option>' +
            SCHOOLS.map((s) => `<option value="${s}">${s}</option>`).join('');
    }

    function getFilteredList() {
        const levelVal = ($('stj-level') || {}).value;
        const schoolVal = ($('stj-school') || {}).value;
        const searchVal = (($('stj-search') || {}).value || '').trim().toLowerCase();
        return spellList.filter((s) => {
            if (levelVal !== '' && String(s.level) !== levelVal) return false;
            if (searchVal && !(s.name || '').toLowerCase().includes(searchVal)) return false;
            if (schoolVal) {
                const detail = spellDetailCache[s.index];
                const school = detail?.school?.name || '';
                if (school !== schoolVal) return false;
            }
            return true;
        });
    }

    function renderSpellList() {
        const listEl = $('stj-spell-list');
        if (!listEl) return;
        const filtered = getFilteredList();
        listEl.innerHTML = filtered.map((s) => {
            const checked = selectedIndices.has(s.index);
            const levelLabel = s.level === 0 ? 'Cantrip' : `Level ${s.level}`;
            return `<label class="stj-spell-row" role="listitem">
                <input type="checkbox" class="stj-spell-cb" data-index="${escapeAttr(s.index)}" ${checked ? 'checked' : ''}>
                <span class="stj-spell-name">${escapeHtml(s.name)}</span>
                <span class="stj-spell-meta">${escapeHtml(levelLabel)}</span>
            </label>`;
        }).join('');

        listEl.querySelectorAll('.stj-spell-cb').forEach((cb) => {
            cb.addEventListener('change', onSpellCheck);
        });
    }

    function escapeAttr(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML.replace(/"/g, '&quot;');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str == null ? '' : str;
        return div.innerHTML;
    }

    function onSpellCheck(e) {
        const index = e.target.dataset.index;
        if (e.target.checked) selectedIndices.add(index);
        else selectedIndices.delete(index);
        updateSelectedUI();
    }

    function updateSelectedUI() {
        const listEl = $('stj-selected-list');
        const countEl = $('stj-selected-count');
        const exportBtn = $('stj-export-json');
        const copyBtn = $('stj-copy-clipboard');
        if (!listEl) return;

        const selected = Array.from(selectedIndices);
        if (countEl) countEl.textContent = `(${selected.length})`;
        if (exportBtn) exportBtn.disabled = selected.length === 0;
        if (copyBtn) copyBtn.disabled = selected.length === 0;

        const items = selected.map((idx) => {
            const s = spellList.find((x) => x.index === idx);
            return { index: idx, name: s ? s.name : idx };
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        listEl.innerHTML = items.length === 0
            ? '<p class="stj-empty">No spells selected. Check spells above to add them.</p>'
            : items.map((item) => `<div class="stj-selected-item" role="listitem">
                    <span>${escapeHtml(item.name)}</span>
                    <button type="button" class="stj-remove" data-index="${escapeAttr(item.index)}" aria-label="Remove">×</button>
                </div>`).join('');

        listEl.querySelectorAll('.stj-remove').forEach((btn) => {
            btn.addEventListener('click', () => {
                selectedIndices.delete(btn.dataset.index);
                const cb = document.querySelector(`.stj-spell-cb[data-index="${btn.dataset.index}"]`);
                if (cb) cb.checked = false;
                updateSelectedUI();
            });
        });
    }

    function buildExportPayload() {
        const selected = Array.from(selectedIndices);
        const promises = selected.map((index) => fetchSpellDetail(index));
        return Promise.all(promises).then((details) => details.map(buildExportSpell));
    }

    function doExport(download) {
        const selected = Array.from(selectedIndices);
        if (selected.length === 0) {
            showToast('Select at least one spell.');
            return;
        }
        const exportBtn = $('stj-export-json');
        const copyBtn = $('stj-copy-clipboard');
        if (exportBtn) exportBtn.disabled = true;
        if (copyBtn) copyBtn.disabled = true;
        setStatus('Loading spell details…');
        buildExportPayload()
            .then((arr) => {
                const json = JSON.stringify(arr, null, 2);
                if (download) {
                    const blob = new Blob([json], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'spells.json';
                    a.click();
                    URL.revokeObjectURL(a.href);
                    showToast('Downloaded spells.json');
                } else {
                    navigator.clipboard.writeText(json).then(
                        () => showToast('Copied to clipboard'),
                        () => showToast('Could not copy to clipboard')
                    );
                }
            })
            .catch((err) => {
                showToast('Export failed. Try again.');
                console.error(err);
            })
            .finally(() => {
                setStatus(`Loaded ${spellList.length} spells.`);
                if (exportBtn) exportBtn.disabled = selectedIndices.size === 0;
                if (copyBtn) copyBtn.disabled = selectedIndices.size === 0;
            });
    }

    function initFilters() {
        const level = $('stj-level');
        const school = $('stj-school');
        const search = $('stj-search');
        if (level) level.addEventListener('change', renderSpellList);
        if (school) school.addEventListener('change', renderSpellList);
        if (search) {
            search.addEventListener('input', () => renderSpellList());
        }
    }

    function initExport() {
        const exportBtn = $('stj-export-json');
        const copyBtn = $('stj-copy-clipboard');
        if (exportBtn) exportBtn.addEventListener('click', () => doExport(true));
        if (copyBtn) copyBtn.addEventListener('click', () => doExport(false));
    }

    function init() {
        initFilters();
        initExport();
        updateSelectedUI();
        loadSpellList();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
