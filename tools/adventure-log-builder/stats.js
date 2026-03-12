(function () {
    'use strict';

    const API_CAMPAIGNS = '/api/campaigns';
    const API_STATS = '/api/stats';

    var campaigns = [];
    var statsData = { players: [], sessions: [] };
    var currentMonth = new Date().getMonth();
    var currentYear = new Date().getFullYear();

    function escapeHtml(s) {
        if (s == null) return '';
        var div = document.createElement('div');
        div.textContent = String(s);
        return div.innerHTML;
    }

    function getStatsUrl() {
        var campaignId = document.getElementById('stats-campaign-filter').value;
        var uncampaigned = document.getElementById('stats-uncampaigned').checked;
        var url = API_STATS;
        if (uncampaigned) url += '?uncampaigned=true';
        else if (campaignId) url += '?campaign_id=' + encodeURIComponent(campaignId);
        return url;
    }

    function loadCampaigns() {
        return fetch(API_CAMPAIGNS)
            .then(function (res) { return res.ok ? res.json() : []; })
            .then(function (list) {
                campaigns = Array.isArray(list) ? list : [];
                var sel = document.getElementById('stats-campaign-filter');
                if (!sel) return;
                while (sel.options.length > 1) sel.remove(1);
                campaigns.forEach(function (c) {
                    var opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    sel.appendChild(opt);
                });
            });
    }

    function loadStats() {
        var wrap = document.getElementById('stats-players-table-wrap');
        var rewardsWrap = document.getElementById('stats-rewards-table-wrap');
        if (wrap) wrap.innerHTML = '<p class="alb-helper">Loading…</p>';
        fetch(getStatsUrl())
            .then(function (res) { return res.ok ? res.json() : { players: [], sessions: [] }; })
            .then(function (data) {
                statsData = { players: data.players || [], sessions: data.sessions || [] };
                renderPlayersTable();
                renderRewardsTable();
                renderCalendar();
            })
            .catch(function () {
                if (wrap) wrap.innerHTML = '<p class="alb-helper">Failed to load stats.</p>';
            });
    }

    function renderPlayersTable() {
        var wrap = document.getElementById('stats-players-table-wrap');
        if (!wrap) return;
        var players = statsData.players || [];
        if (players.length === 0) {
            wrap.innerHTML = '<p class="alb-helper">No player data for this filter.</p>';
            return;
        }
        var table = document.createElement('table');
        table.className = 'stats-table';
        table.setAttribute('aria-label', 'Sessions played and times DM\'d per player');
        table.innerHTML = '<thead><tr><th>Player</th><th>Sessions played</th><th>Times DM\'d</th></tr></thead><tbody></tbody>';
        var tbody = table.querySelector('tbody');
        players.forEach(function (p) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + escapeHtml(p.name) + '</td><td>' + (p.sessions_played || 0) + '</td><td>' + (p.sessions_dm || 0) + '</td>';
            tbody.appendChild(tr);
        });
        wrap.innerHTML = '';
        wrap.appendChild(table);
    }

    function renderRewardsTable() {
        var wrap = document.getElementById('stats-rewards-table-wrap');
        if (!wrap) return;
        var players = statsData.players || [];
        if (players.length === 0) {
            wrap.innerHTML = '';
            return;
        }
        var table = document.createElement('table');
        table.className = 'stats-table';
        table.setAttribute('aria-label', 'Total XP and gold per player');
        table.innerHTML = '<thead><tr><th>Player</th><th>Total XP</th><th>Total gold</th></tr></thead><tbody></tbody>';
        var tbody = table.querySelector('tbody');
        players.forEach(function (p) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + escapeHtml(p.name) + '</td><td>' + (p.total_xp || 0) + '</td><td>' + (p.total_gold || 0) + '</td>';
            tbody.appendChild(tr);
        });
        wrap.innerHTML = '';
        wrap.appendChild(table);
    }

    function sessionsByDate() {
        var byDate = {};
        (statsData.sessions || []).forEach(function (s) {
            var d = s.date;
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(s);
        });
        return byDate;
    }

    function renderCalendar() {
        var wrap = document.getElementById('stats-calendar-wrap');
        var labelEl = document.getElementById('stats-month-label');
        if (!wrap) return;

        var byDate = sessionsByDate();
        var firstDay = new Date(currentYear, currentMonth, 1);
        var lastDay = new Date(currentYear, currentMonth + 1, 0);
        var startDow = firstDay.getDay();
        var daysInMonth = lastDay.getDate();

        if (labelEl) labelEl.textContent = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });

        var weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var grid = document.createElement('div');
        grid.className = 'stats-calendar';
        weekdays.forEach(function (w) {
            var cell = document.createElement('div');
            cell.className = 'stats-calendar-weekday';
            cell.textContent = w;
            grid.appendChild(cell);
        });

        var pad = startDow;
        while (pad--) {
            var empty = document.createElement('div');
            empty.className = 'stats-calendar-day empty';
            grid.appendChild(empty);
        }

        for (var d = 1; d <= daysInMonth; d++) {
            var dateStr = currentYear + '-' + String(currentMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            var sessionsOnDay = byDate[dateStr] || [];
            var cell = document.createElement('div');
            cell.className = 'stats-calendar-day';
            cell.textContent = d;
            if (sessionsOnDay.length > 0) {
                cell.classList.add('has-session');
                cell.title = sessionsOnDay.map(function (s) {
                    return s.date + ': ' + (s.participants || []).map(function (p) {
                        return (p.player_name || '') + (p.character_name ? ' (' + p.character_name + ')' : '');
                    }).filter(Boolean).join(', ');
                }).join('\n');
            }
            grid.appendChild(cell);
        }

        wrap.innerHTML = '';
        wrap.appendChild(grid);
    }

    function init() {
        loadCampaigns().then(function () {
            loadStats();
        });

        document.getElementById('stats-campaign-filter').addEventListener('change', loadStats);
        document.getElementById('stats-uncampaigned').addEventListener('change', loadStats);

        document.getElementById('stats-prev-month').addEventListener('click', function () {
            currentMonth--;
            if (currentMonth < 0) { currentMonth = 11; currentYear--; }
            renderCalendar();
        });
        document.getElementById('stats-next-month').addEventListener('click', function () {
            currentMonth++;
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
            renderCalendar();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
