/**
 * Loads shared header.html and footer.html into placeholders on tool pages.
 * Use: add <div id="hub-header-placeholder"></div> and <div id="hub-footer-placeholder"></div>,
 * then load this script after theme.js so the injected theme toggle works.
 */
(function () {
    'use strict';

    var HEADER_ID = 'hub-header-placeholder';
    var FOOTER_ID = 'hub-footer-placeholder';

    function getBaseUrl() {
        var script = document.currentScript;
        if (!script || !script.src) return '';
        var path = script.src.replace(/[#?].*$/, '');
        return path.substring(0, path.lastIndexOf('/') + 1);
    }

    function bindThemeToggle() {
        var btn = document.getElementById('theme-toggle');
        if (btn && typeof window.toggleTheme === 'function') {
            btn.addEventListener('click', window.toggleTheme);
            var theme = typeof window.getCurrentTheme === 'function' ? window.getCurrentTheme() : 'light';
            var icon = btn.querySelector('.theme-icon');
            if (icon) icon.textContent = theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
        }
    }

    function inject(placeholderId, html) {
        var el = document.getElementById(placeholderId);
        if (!el || !html) return;
        el.innerHTML = html.trim();
        if (placeholderId === HEADER_ID) bindThemeToggle();
    }

    var base = getBaseUrl();
    if (!base) return;

    function fetchAndInject(url, placeholderId) {
        fetch(url)
            .then(function (r) { return r.ok ? r.text() : Promise.reject(new Error(url)); })
            .then(function (html) { inject(placeholderId, html); })
            .catch(function () { /* ignore missing fragment */ });
    }

    if (document.getElementById(HEADER_ID)) fetchAndInject(base + 'header.html', HEADER_ID);
    if (document.getElementById(FOOTER_ID)) fetchAndInject(base + 'footer.html', FOOTER_ID);
})();
