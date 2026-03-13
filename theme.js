// Theme Management System
// Handles light/dark mode switching with localStorage persistence

(function() {
    'use strict';

    const THEME_KEY = 'dnd-hub-theme';
    const DARK_MODE_CLASS = 'dark-mode';
    const THEME_VARS_KEY = 'dnd-hub-theme-vars-v1';
    const THEME_STYLE_ID = 'dnd-hub-theme-overrides';

    // Get saved theme preference or default to system preference
    function getInitialTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved) {
            return saved;
        }
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    // Apply theme variable overrides from config object
    function applyThemeVariables(config) {
        if (!config || typeof config !== 'object') return;

        const head = document.head || document.getElementsByTagName('head')[0];
        if (!head) return;

        let styleTag = document.getElementById(THEME_STYLE_ID);
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = THEME_STYLE_ID;
            head.appendChild(styleTag);
        }

        const lightVars = config.light || {};
        const darkVars = config.dark || {};

        function serializeVars(vars) {
            return Object.keys(vars)
                .filter((key) => key.startsWith('--'))
                .map((key) => `    ${key}: ${vars[key]};`)
                .join('\n');
        }

        const lightBlock = Object.keys(lightVars).length
            ? `:root {\n${serializeVars(lightVars)}\n}\n`
            : '';

        const darkBlock = Object.keys(darkVars).length
            ? `.dark-mode {\n${serializeVars(darkVars)}\n}\n`
            : '';

        styleTag.textContent = `${lightBlock}${darkBlock}`;
    }

    function loadThemeVariables() {
        try {
            const raw = localStorage.getItem(THEME_VARS_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed;
        } catch (e) {
            return null;
        }
    }

    function saveThemeVariables(config) {
        if (!config || typeof config !== 'object') return;
        localStorage.setItem(THEME_VARS_KEY, JSON.stringify(config));
        applyThemeVariables(config);
    }

    // Apply theme to document
    function applyTheme(theme) {
        const html = document.documentElement;
        if (theme === 'dark') {
            html.classList.add(DARK_MODE_CLASS);
        } else {
            html.classList.remove(DARK_MODE_CLASS);
        }
        localStorage.setItem(THEME_KEY, theme);
        updateThemeIcon(theme);
    }

    // Update theme toggle button icon
    function updateThemeIcon(theme) {
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('.theme-icon');
            if (icon) {
                icon.textContent = theme === 'dark' ? '☀️' : '🌙';
            }
        }
    }

    // Toggle between light and dark
    function toggleTheme() {
        const currentTheme = document.documentElement.classList.contains(DARK_MODE_CLASS) ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    }

    // Initialize theme on page load
    function initTheme() {
        const theme = getInitialTheme();
        applyTheme(theme);

        const overrides = loadThemeVariables();
        if (overrides) {
            applyThemeVariables(overrides);
        }

        // Set up theme toggle button
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleTheme);
        }

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                // Only update if user hasn't set a preference
                if (!localStorage.getItem(THEME_KEY)) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }

    // Expose toggle function globally for manual calls if needed
    window.toggleTheme = toggleTheme;
    window.getCurrentTheme = function() {
        return document.documentElement.classList.contains(DARK_MODE_CLASS) ? 'dark' : 'light';
    };
    window.getThemeVariables = loadThemeVariables;
    window.setThemeVariables = saveThemeVariables;
})();
