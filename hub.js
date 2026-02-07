(function () {
    'use strict';

    const STORAGE_KEY = 'dnd-hub-starred';
    const SORT_STORAGE_KEY = 'dnd-hub-sort';
    const DEFAULT_ORDER = [
        'tools/ai-dm-prompt-builder/',
        'tools/adventure-packet-builder/',
        'tools/adventure-maker/',
        'tools/char-sheet/',
        'tools/combat-turn-helper/',
        'tools/cassalanter-inquiry-runner/',
        'tools/cassalanter-inquiry-wizard/',
        'tools/playstyle-quiz/',
        'tools/legacy-project-builder/',
        'tools/songbook/',
        'tools/qbasic-editor/'
    ];

    function getStarred() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (_) {
            return {};
        }
    }

    function setStarred(obj) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    }

    function getSort() {
        const v = localStorage.getItem(SORT_STORAGE_KEY);
        return (v === 'name-asc' || v === 'name-desc' || v === 'emoji') ? v : 'default';
    }

    function setSort(value) {
        localStorage.setItem(SORT_STORAGE_KEY, value);
    }

    function getCardTitle(card) {
        const el = card.querySelector('.tool-title');
        return el ? (el.textContent || '').trim() : '';
    }

    function getCardEmoji(card) {
        const el = card.querySelector('.tool-icon');
        return el ? (el.textContent || '').trim() : '';
    }

    function applyOrder() {
        const grid = document.querySelector('.tools-grid');
        if (!grid) return;

        const starred = getStarred();
        const sortBy = getSort();
        const cards = Array.from(grid.querySelectorAll('.tool-card'));

        const starredList = [];
        const unstarredList = [];
        cards.forEach(function (card) {
            const href = card.getAttribute('data-tool-href') || card.getAttribute('href') || '';
            if (starred[href]) starredList.push(card);
            else unstarredList.push(card);
        });

        starredList.sort(function (a, b) {
            const hrefA = a.getAttribute('data-tool-href') || a.getAttribute('href') || '';
            const hrefB = b.getAttribute('data-tool-href') || b.getAttribute('href') || '';
            return (starred[hrefB] || 0) - (starred[hrefA] || 0);
        });

        unstarredList.sort(function (a, b) {
            if (sortBy === 'default') {
                const iA = DEFAULT_ORDER.indexOf(a.getAttribute('data-tool-href') || a.getAttribute('href') || '');
                const iB = DEFAULT_ORDER.indexOf(b.getAttribute('data-tool-href') || b.getAttribute('href') || '');
                return (iA < 0 ? 999 : iA) - (iB < 0 ? 999 : iB);
            }
            if (sortBy === 'name-asc' || sortBy === 'name-desc') {
                const ta = getCardTitle(a);
                const tb = getCardTitle(b);
                const cmp = (ta || '').localeCompare(tb || '', undefined, { sensitivity: 'base' });
                return sortBy === 'name-desc' ? -cmp : cmp;
            }
            if (sortBy === 'emoji') {
                const ea = getCardEmoji(a);
                const eb = getCardEmoji(b);
                return (ea || '').localeCompare(eb || '', undefined, { sensitivity: 'base' });
            }
            return 0;
        });

        starredList.concat(unstarredList).forEach(function (card) {
            grid.appendChild(card);
        });
    }

    function updateStarButtons() {
        const starred = getStarred();
        document.querySelectorAll('.tool-card-star').forEach(function (btn) {
            const card = btn.closest('.tool-card');
            const href = card ? (card.getAttribute('data-tool-href') || card.getAttribute('href') || '') : '';
            const isStarred = !!starred[href];
            btn.textContent = isStarred ? '★' : '☆';
            btn.setAttribute('aria-label', isStarred ? 'Unstar this tool' : 'Star this tool');
            btn.title = isStarred ? 'Unstar to remove from top' : 'Star to pin to top';
            btn.classList.toggle('starred', isStarred);
        });
    }

    function clearAllStars() {
        setStarred({});
        applyOrder();
        updateStarButtons();
    }

    function toggleStar(e) {
        e.preventDefault();
        e.stopPropagation();
        const btn = e.currentTarget;
        const card = btn.closest('.tool-card');
        if (!card) return;

        const href = card.getAttribute('data-tool-href') || card.getAttribute('href') || '';
        const starred = getStarred();

        if (starred[href]) {
            delete starred[href];
        } else {
            starred[href] = Date.now();
        }
        setStarred(starred);
        applyOrder();
        updateStarButtons();
    }

    function init() {
        var sortSelect = document.getElementById('sort-by');
        if (sortSelect) {
            sortSelect.value = getSort();
            sortSelect.addEventListener('change', function () {
                setSort(sortSelect.value);
                applyOrder();
            });
        }
        applyOrder();
        updateStarButtons();
        document.querySelectorAll('.tool-card-star').forEach(function (btn) {
            btn.addEventListener('click', toggleStar);
        });
        var clearBtn = document.getElementById('clear-stars');
        if (clearBtn) clearBtn.addEventListener('click', clearAllStars);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
