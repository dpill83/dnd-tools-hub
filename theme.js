// Theme Management System
// Handles light/dark mode switching with localStorage persistence

(function() {
    'use strict';

    const THEME_KEY = 'dnd-hub-theme';
    const DARK_MODE_CLASS = 'dark-mode';

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
})();
