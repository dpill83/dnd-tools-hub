/**
 * Initiative Tracker widget – entries, sort, roll, next turn, persist.
 */
(function () {
    'use strict';

    var STATE = window.ArcaneDashboardState;
    if (!STATE) return;

    window.ArcaneDashboardWidgets = window.ArcaneDashboardWidgets || {
        _renderers: {},
        onCampaignChange: function () {},
        updateWhisperView: function () {}
    };

    function getData(campaignId) {
        return STATE.getInitiative(campaignId);
    }

    function saveData(campaignId, data) {
        STATE.setInitiative(campaignId, data);
    }

    function renderBody(body, widget, campaignId) {
        var data = getData(campaignId);
        var entries = data.entries || [];
        var currentIndex = data.currentIndex != null ? data.currentIndex : 0;

        body.innerHTML = '';

        var list = document.createElement('div');
        list.className = 'ad-init-list';
        list.setAttribute('data-init-list', 'true');

        function renderList() {
            list.innerHTML = '';
            entries.forEach(function (entry, i) {
                var row = document.createElement('div');
                row.className = 'ad-init-row' + (i === currentIndex ? ' current' : '');
                row.dataset.index = String(i);
                var nameEl = document.createElement('span');
                nameEl.className = 'ad-init-name';
                nameEl.textContent = entry.name || 'Unnamed';
                if (entry.type === 'npc') nameEl.classList.add('npc');
                var valEl = document.createElement('span');
                valEl.className = 'ad-init-value';
                valEl.textContent = entry.value != null ? entry.value : '—';
                row.appendChild(nameEl);
                row.appendChild(valEl);
                row.addEventListener('click', function () {
                    currentIndex = i;
                    data.currentIndex = currentIndex;
                    saveData(campaignId, data);
                    renderList();
                    if (window.ArcaneDashboardWidgets && window.ArcaneDashboardWidgets.updateWhisperView) {
                        window.ArcaneDashboardWidgets.updateWhisperView();
                    }
                });
                list.appendChild(row);
            });
        }

        function addEntry() {
            var name = prompt('Name:', '');
            if (name == null || !name.trim()) return;
            entries.push({ name: name.trim(), value: null, type: 'pc' });
            entries.sort(function (a, b) {
                var va = a.value != null ? a.value : -999;
                var vb = b.value != null ? b.value : -999;
                return vb - va;
            });
            saveData(campaignId, { entries: entries, currentIndex: currentIndex });
            renderList();
        }

        function rollAll() {
            entries.forEach(function (e) {
                var mod = e.mod != null ? e.mod : 0;
                e.value = Math.floor(Math.random() * 20) + 1 + mod;
            });
            entries.sort(function (a, b) { return (b.value || 0) - (a.value || 0); });
            currentIndex = 0;
            data.currentIndex = 0;
            data.entries = entries;
            saveData(campaignId, data);
            renderList();
            if (window.ArcaneDashboardWidgets && window.ArcaneDashboardWidgets.updateWhisperView) {
                window.ArcaneDashboardWidgets.updateWhisperView();
            }
        }

        function nextTurn() {
            if (entries.length === 0) return;
            currentIndex = (currentIndex + 1) % entries.length;
            data.currentIndex = currentIndex;
            saveData(campaignId, data);
            renderList();
            if (window.ArcaneDashboardWidgets && window.ArcaneDashboardWidgets.updateWhisperView) {
                window.ArcaneDashboardWidgets.updateWhisperView();
            }
        }

        function clearAll() {
            if (!confirm('Clear all initiative entries?')) return;
            entries = [];
            currentIndex = 0;
            saveData(campaignId, { entries: [], currentIndex: 0 });
            renderList();
            if (window.ArcaneDashboardWidgets && window.ArcaneDashboardWidgets.updateWhisperView) {
                window.ArcaneDashboardWidgets.updateWhisperView();
            }
        }

        var btns = document.createElement('div');
        btns.className = 'ad-init-btns';
        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'ad-widget-btn';
        addBtn.textContent = '+ Add';
        addBtn.addEventListener('click', addEntry);
        var rollBtn = document.createElement('button');
        rollBtn.type = 'button';
        rollBtn.className = 'ad-widget-btn';
        rollBtn.textContent = 'Roll';
        rollBtn.addEventListener('click', rollAll);
        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'ad-widget-btn';
        nextBtn.textContent = 'Next';
        nextBtn.addEventListener('click', nextTurn);
        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'ad-widget-btn';
        clearBtn.textContent = 'Clear';
        clearBtn.addEventListener('click', clearAll);
        btns.appendChild(addBtn);
        btns.appendChild(rollBtn);
        btns.appendChild(nextBtn);
        btns.appendChild(clearBtn);
        body.appendChild(btns);
        body.appendChild(list);
        renderList();
    }

    window.ArcaneDashboardWidgets._renderers.initiative = renderBody;
    window.ArcaneDashboardWidgets.getBodyRenderers = function () { return this._renderers; };

    window.ArcaneDashboardWidgets.getInitiativeData = getData;
    window.ArcaneDashboardWidgets.getInitiativeCurrentIndex = function (cid) {
        return (getData(cid).currentIndex != null ? getData(cid).currentIndex : 0);
    };

    window.ArcaneDashboardWidgets.updateWhisperView = function () {
        var campaignId = window.ArcaneDashboard ? window.ArcaneDashboard.getCampaignId() : '';
        var el = document.getElementById('ad-whisper-initiative');
        var msgEl = document.getElementById('ad-whisper-message');
        if (!el) return;
        if (!campaignId) {
            el.textContent = '';
            if (msgEl) msgEl.textContent = 'DM is checking something.';
            return;
        }
        var data = getData(campaignId);
        var entries = data.entries || [];
        var idx = data.currentIndex != null ? data.currentIndex : 0;
        var current = entries[idx];
        if (current && current.name) {
            el.textContent = 'Current turn: ' + current.name;
            if (msgEl) msgEl.textContent = '';
        } else {
            el.textContent = entries.length ? 'Current turn: —' : '';
            if (msgEl) msgEl.textContent = entries.length ? '' : 'DM is checking something.';
        }
    };
})();
