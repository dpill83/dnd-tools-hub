/**
 * Random generator widget – tables, roll, optional animation, persist per campaign.
 */
(function () {
    'use strict';

    var STATE = window.ArcaneDashboardState;
    if (!STATE) return;

    function getData(campaignId) {
        return STATE.getTables(campaignId);
    }

    function saveData(campaignId, data) {
        STATE.setTables(campaignId, data);
    }

    function renderBody(body, widget, campaignId) {
        var data = getData(campaignId);
        var tables = data.tables || [];

        body.innerHTML = '';

        function addTable() {
            var name = prompt('Table name:', '');
            if (!name || !name.trim()) return;
            tables.push({ id: 't' + Date.now(), name: name.trim(), entries: [] });
            saveData(campaignId, { tables: tables });
            reRender();
        }

        function rollTable(t) {
            if (!t.entries || t.entries.length === 0) {
                alert('Add entries first.');
                return;
            }
            var idx = Math.floor(Math.random() * t.entries.length);
            var result = t.entries[idx];
            var resultEl = body.querySelector('[data-result-for="' + t.id + '"]');
            if (resultEl) {
                resultEl.textContent = typeof result === 'string' ? result : (result.text || JSON.stringify(result));
                resultEl.classList.add('rolled');
                setTimeout(function () { resultEl.classList.remove('rolled'); }, 400);
            }
        }

        function reRender() {
            body.innerHTML = '';
            var addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'ad-widget-btn';
            addBtn.textContent = '+ Table';
            addBtn.addEventListener('click', addTable);
            body.appendChild(addBtn);

            tables.forEach(function (t) {
                var block = document.createElement('div');
                block.className = 'ad-random-block';
                var title = document.createElement('div');
                title.className = 'ad-random-title';
                title.textContent = t.name || 'Unnamed';
                var rollBtn = document.createElement('button');
                rollBtn.type = 'button';
                rollBtn.className = 'ad-widget-btn';
                rollBtn.textContent = 'Roll';
                rollBtn.addEventListener('click', function () { rollTable(t); });
                var resultEl = document.createElement('div');
                resultEl.className = 'ad-random-result';
                resultEl.dataset.resultFor = t.id;
                resultEl.textContent = '—';
                var entriesList = document.createElement('div');
                entriesList.className = 'ad-random-entries';
                (t.entries || []).forEach(function (e) {
                    var span = document.createElement('span');
                    span.className = 'ad-random-entry';
                    span.textContent = typeof e === 'string' ? e : (e.text || '');
                    entriesList.appendChild(span);
                });
                var addEntryBtn = document.createElement('button');
                addEntryBtn.type = 'button';
                addEntryBtn.className = 'ad-widget-btn';
                addEntryBtn.textContent = '+ Entry';
                addEntryBtn.addEventListener('click', function () {
                    var val = prompt('Entry text:', '');
                    if (val == null) return;
                    t.entries = t.entries || [];
                    t.entries.push(val.trim() || val);
                    saveData(campaignId, { tables: tables });
                    reRender();
                });
                block.appendChild(title);
                block.appendChild(rollBtn);
                block.appendChild(resultEl);
                block.appendChild(entriesList);
                block.appendChild(addEntryBtn);
                body.appendChild(block);
            });
        }

        reRender();
    }

    window.ArcaneDashboardWidgets._renderers.random = renderBody;
})();
