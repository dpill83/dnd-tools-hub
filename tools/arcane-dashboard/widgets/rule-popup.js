/**
 * Rule popups widget – searchable list, floating card. Data from static JSON or import.
 */
(function () {
    'use strict';

    var STATE = window.ArcaneDashboardState;
    if (!STATE) return;

    var rulesData = window.ArcaneDashboardRulesData || [
        { title: 'Advantage', body: 'When you have advantage, roll two d20s and use the higher. Disadvantage: roll two and use the lower.', keywords: 'advantage disadvantage d20' },
        { title: 'Conditions', body: 'Conditions alter a creature\'s capabilities. See appendix A in the PHB for full list (blinded, charmed, frightened, etc.).', keywords: 'condition blinded charmed' }
    ];

    function renderBody(body, widget, campaignId) {
        body.innerHTML = '';

        var searchWrap = document.createElement('div');
        searchWrap.className = 'ad-rules-search-wrap';
        var search = document.createElement('input');
        search.type = 'search';
        search.placeholder = 'Search rules, spells…';
        search.className = 'ad-rules-search';
        search.setAttribute('aria-label', 'Search rules');
        var results = document.createElement('div');
        results.className = 'ad-rules-results';

        function runSearch() {
            var q = (search.value || '').trim().toLowerCase();
            if (!q) {
                results.innerHTML = '<p class="ad-rules-hint">Enter a keyword to search.</p>';
                return;
            }
            var matches = rulesData.filter(function (r) {
                var title = (r.title || '').toLowerCase();
                var body = (r.body || '').toLowerCase();
                var kw = (r.keywords || '').toLowerCase();
                return title.indexOf(q) >= 0 || body.indexOf(q) >= 0 || kw.indexOf(q) >= 0;
            });
            results.innerHTML = '';
            if (matches.length === 0) {
                results.innerHTML = '<p class="ad-rules-hint">No matches.</p>';
                return;
            }
            matches.slice(0, 20).forEach(function (r) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ad-rules-result-item';
                btn.textContent = r.title || 'Untitled';
                btn.addEventListener('click', function () { showCard(r); });
                results.appendChild(btn);
            });
        }

        function showCard(rule) {
            var existing = document.getElementById('ad-rule-card');
            if (existing) existing.remove();
            var card = document.createElement('div');
            card.id = 'ad-rule-card';
            card.className = 'ad-rule-card';
            card.innerHTML = '<h3 class="ad-rule-card-title">' + escapeHtml(rule.title || '') + '</h3><div class="ad-rule-card-body">' + (rule.body ? escapeHtml(rule.body).replace(/\n/g, '<br>') : '') + '</div><button type="button" class="ad-rule-card-close">Close</button>';
            card.querySelector('.ad-rule-card-close').addEventListener('click', function () { card.remove(); });
            document.body.appendChild(card);
        }

        function escapeHtml(s) {
            var div = document.createElement('div');
            div.textContent = s;
            return div.innerHTML;
        }

        search.addEventListener('input', runSearch);
        search.addEventListener('keydown', function (e) { if (e.key === 'Enter') runSearch(); });
        searchWrap.appendChild(search);
        body.appendChild(searchWrap);
        body.appendChild(results);
        results.innerHTML = '<p class="ad-rules-hint">Enter a keyword to search.</p>';
    }

    window.ArcaneDashboardWidgets._renderers.rules = renderBody;
})();
