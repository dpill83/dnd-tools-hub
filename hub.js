(function () {
    'use strict';

    const STORAGE_KEY = 'dnd-hub-starred';

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

    function applyOrder() {
        const grid = document.querySelector('.tools-grid');
        if (!grid) return;

        const starred = getStarred();
        const cards = Array.from(grid.querySelectorAll('.tool-card'));

        cards.sort(function (a, b) {
            const hrefA = a.getAttribute('data-tool-href') || a.getAttribute('href') || '';
            const hrefB = b.getAttribute('data-tool-href') || b.getAttribute('href') || '';
            const tsA = starred[hrefA];
            const tsB = starred[hrefB];

            if (tsA && tsB) return tsB - tsA;
            if (tsA) return -1;
            if (tsB) return 1;
            return 0;
        });

        cards.forEach(function (card) {
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
        applyOrder();
        updateStarButtons();
        document.querySelectorAll('.tool-card-star').forEach(function (btn) {
            btn.addEventListener('click', toggleStar);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
