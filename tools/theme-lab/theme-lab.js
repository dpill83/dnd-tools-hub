(function () {
    'use strict';

    const DEFAULT_LIGHT = {
        '--primary-color': '#1a472a',
        '--primary-light': '#2d5a3d',
        '--secondary-color': '#8b4513',
        '--accent-color': '#d4af37',
        '--background': '#f5f5f5',
        '--surface': '#ffffff',
        '--text': '#333333',
        '--text-light': '#666666',
        '--border': '#dddddd',
        '--error': '#dc3545',
        '--warning': '#ffc107',
        '--success': '#28a745',
        '--shadow': 'rgba(0, 0, 0, 0.1)',
        '--shadow-hover': 'rgba(0, 0, 0, 0.15)',
        '--input-bg': '#f8f9fa',
        '--card-bg': '#f8f9fa'
    };

    const DEFAULT_DARK = {
        '--primary-color': '#4a9b5f',
        '--primary-light': '#5cb377',
        '--secondary-color': '#b87333',
        '--accent-color': '#f4d03f',
        '--background': '#1a1a1a',
        '--surface': '#2d2d2d',
        '--text': '#e0e0e0',
        '--text-light': '#b0b0b0',
        '--border': '#404040',
        '--error': '#ff6b6b',
        '--warning': '#ffd93d',
        '--success': '#51cf66',
        '--shadow': 'rgba(0, 0, 0, 0.3)',
        '--shadow-hover': 'rgba(0, 0, 0, 0.4)',
        '--input-bg': '#353535',
        '--card-bg': '#353535'
    };

    /** Curated palettes for "Surprise me" – each is a full light + dark theme with consistent contrast and semantics. */
    const SURPRISE_PALETTES = [
        {
            name: 'Forest',
            light: {
                '--primary-color': '#1a472a',
                '--primary-light': '#2d5a3d',
                '--secondary-color': '#5d4e37',
                '--accent-color': '#c9a227',
                '--background': '#f0f4ef',
                '--surface': '#ffffff',
                '--text': '#2c2c2c',
                '--text-light': '#5a5a5a',
                '--border': '#c5d4c4',
                '--error': '#c53030',
                '--warning': '#d69e2e',
                '--success': '#276749',
                '--shadow': 'rgba(0, 0, 0, 0.08)',
                '--shadow-hover': 'rgba(0, 0, 0, 0.12)',
                '--input-bg': '#f8faf8',
                '--card-bg': '#f8faf8'
            },
            dark: {
                '--primary-color': '#68d391',
                '--primary-light': '#9ae6b4',
                '--secondary-color': '#c4a574',
                '--accent-color': '#faf089',
                '--background': '#1a2421',
                '--surface': '#2d3d36',
                '--text': '#e8f0ec',
                '--text-light': '#9cb5a8',
                '--border': '#3d5249',
                '--error': '#fc8181',
                '--warning': '#f6e05e',
                '--success': '#68d391',
                '--shadow': 'rgba(0, 0, 0, 0.35)',
                '--shadow-hover': 'rgba(0, 0, 0, 0.45)',
                '--input-bg': '#354d42',
                '--card-bg': '#354d42'
            }
        },
        {
            name: 'Ocean',
            light: {
                '--primary-color': '#2c5282',
                '--primary-light': '#2b6cb0',
                '--secondary-color': '#2b6cb0',
                '--accent-color': '#ed8936',
                '--background': '#ebf8ff',
                '--surface': '#ffffff',
                '--text': '#2d3748',
                '--text-light': '#4a5568',
                '--border': '#bee3f8',
                '--error': '#c53030',
                '--warning': '#d69e2e',
                '--success': '#276749',
                '--shadow': 'rgba(0, 0, 0, 0.08)',
                '--shadow-hover': 'rgba(0, 0, 0, 0.12)',
                '--input-bg': '#ebf8ff',
                '--card-bg': '#ebf8ff'
            },
            dark: {
                '--primary-color': '#63b3ed',
                '--primary-light': '#90cdf4',
                '--secondary-color': '#90cdf4',
                '--accent-color': '#fbd38d',
                '--background': '#1a202c',
                '--surface': '#2d3748',
                '--text': '#e2e8f0',
                '--text-light': '#a0aec0',
                '--border': '#4a5568',
                '--error': '#fc8181',
                '--warning': '#f6e05e',
                '--success': '#68d391',
                '--shadow': 'rgba(0, 0, 0, 0.3)',
                '--shadow-hover': 'rgba(0, 0, 0, 0.4)',
                '--input-bg': '#2d3748',
                '--card-bg': '#2d3748'
            }
        },
        {
            name: 'Parchment',
            light: {
                '--primary-color': '#744210',
                '--primary-light': '#975a16',
                '--secondary-color': '#744210',
                '--accent-color': '#b7791f',
                '--background': '#faf5eb',
                '--surface': '#fefdfb',
                '--text': '#3d2914',
                '--text-light': '#6b5344',
                '--border': '#e8dcc8',
                '--error': '#c53030',
                '--warning': '#b7791f',
                '--success': '#276749',
                '--shadow': 'rgba(55, 45, 25, 0.1)',
                '--shadow-hover': 'rgba(55, 45, 25, 0.15)',
                '--input-bg': '#f5efe3',
                '--card-bg': '#f5efe3'
            },
            dark: {
                '--primary-color': '#d69e2e',
                '--primary-light': '#ecc94b',
                '--secondary-color': '#d69e2e',
                '--accent-color': '#ecc94b',
                '--background': '#211a12',
                '--surface': '#352d22',
                '--text': '#f0e6d8',
                '--text-light': '#c4b59a',
                '--border': '#4a3f2e',
                '--error': '#fc8181',
                '--warning': '#f6e05e',
                '--success': '#68d391',
                '--shadow': 'rgba(0, 0, 0, 0.35)',
                '--shadow-hover': 'rgba(0, 0, 0, 0.45)',
                '--input-bg': '#3d3428',
                '--card-bg': '#3d3428'
            }
        },
        {
            name: 'Dungeon',
            light: {
                '--primary-color': '#553c9a',
                '--primary-light': '#6b46c1',
                '--secondary-color': '#805ad5',
                '--accent-color': '#d69e2e',
                '--background': '#faf5ff',
                '--surface': '#ffffff',
                '--text': '#322659',
                '--text-light': '#553c9a',
                '--border': '#e9d8fd',
                '--error': '#c53030',
                '--warning': '#d69e2e',
                '--success': '#276749',
                '--shadow': 'rgba(0, 0, 0, 0.08)',
                '--shadow-hover': 'rgba(0, 0, 0, 0.12)',
                '--input-bg': '#faf5ff',
                '--card-bg': '#faf5ff'
            },
            dark: {
                '--primary-color': '#9f7aea',
                '--primary-light': '#b794f4',
                '--secondary-color': '#b794f4',
                '--accent-color': '#f6e05e',
                '--background': '#1a1625',
                '--surface': '#2d2640',
                '--text': '#e9d8fd',
                '--text-light': '#b794f4',
                '--border': '#44337a',
                '--error': '#fc8181',
                '--warning': '#f6e05e',
                '--success': '#68d391',
                '--shadow': 'rgba(0, 0, 0, 0.4)',
                '--shadow-hover': 'rgba(0, 0, 0, 0.5)',
                '--input-bg': '#352d45',
                '--card-bg': '#352d45'
            }
        },
        {
            name: 'Ember',
            light: {
                '--primary-color': '#c05621',
                '--primary-light': '#dd6b20',
                '--secondary-color': '#9c4221',
                '--accent-color': '#ecc94b',
                '--background': '#fffaf0',
                '--surface': '#ffffff',
                '--text': '#2d2d2d',
                '--text-light': '#5a4a42',
                '--border': '#fbd38d',
                '--error': '#c53030',
                '--warning': '#d69e2e',
                '--success': '#276749',
                '--shadow': 'rgba(0, 0, 0, 0.08)',
                '--shadow-hover': 'rgba(0, 0, 0, 0.12)',
                '--input-bg': '#fffaf0',
                '--card-bg': '#fffaf0'
            },
            dark: {
                '--primary-color': '#ed8936',
                '--primary-light': '#f6ad55',
                '--secondary-color': '#dd6b20',
                '--accent-color': '#faf089',
                '--background': '#1a1410',
                '--surface': '#2d2218',
                '--text': '#fef3e8',
                '--text-light': '#c4a574',
                '--border': '#553c2e',
                '--error': '#fc8181',
                '--warning': '#f6e05e',
                '--success': '#68d391',
                '--shadow': 'rgba(0, 0, 0, 0.35)',
                '--shadow-hover': 'rgba(0, 0, 0, 0.45)',
                '--input-bg': '#35281e',
                '--card-bg': '#35281e'
            }
        },
        {
            name: 'Slate',
            light: {
                '--primary-color': '#2d3748',
                '--primary-light': '#4a5568',
                '--secondary-color': '#4a5568',
                '--accent-color': '#4299e1',
                '--background': '#f7fafc',
                '--surface': '#ffffff',
                '--text': '#1a202c',
                '--text-light': '#718096',
                '--border': '#e2e8f0',
                '--error': '#c53030',
                '--warning': '#d69e2e',
                '--success': '#276749',
                '--shadow': 'rgba(0, 0, 0, 0.06)',
                '--shadow-hover': 'rgba(0, 0, 0, 0.1)',
                '--input-bg': '#edf2f7',
                '--card-bg': '#edf2f7'
            },
            dark: {
                '--primary-color': '#a0aec0',
                '--primary-light': '#cbd5e0',
                '--secondary-color': '#a0aec0',
                '--accent-color': '#63b3ed',
                '--background': '#171923',
                '--surface': '#2d3748',
                '--text': '#e2e8f0',
                '--text-light': '#a0aec0',
                '--border': '#4a5568',
                '--error': '#fc8181',
                '--warning': '#f6e05e',
                '--success': '#68d391',
                '--shadow': 'rgba(0, 0, 0, 0.3)',
                '--shadow-hover': 'rgba(0, 0, 0, 0.4)',
                '--input-bg': '#2d3748',
                '--card-bg': '#2d3748'
            }
        }
    ];

    const COLOR_LIKE_KEYS = new Set([
        '--primary-color',
        '--primary-light',
        '--secondary-color',
        '--accent-color',
        '--background',
        '--surface',
        '--text',
        '--text-light',
        '--border',
        '--error',
        '--warning',
        '--success',
        '--input-bg',
        '--card-bg'
    ]);

    function getInitialConfig() {
        if (typeof window.getThemeVariables === 'function') {
            const existing = window.getThemeVariables();
            if (existing && typeof existing === 'object') {
                return {
                    light: { ...DEFAULT_LIGHT, ...(existing.light || {}) },
                    dark: { ...DEFAULT_DARK, ...(existing.dark || {}) }
                };
            }
        }
        return {
            light: { ...DEFAULT_LIGHT },
            dark: { ...DEFAULT_DARK }
        };
    }

    function createVarRow(mode, name, value) {
        const row = document.createElement('div');
        row.className = 'var-row';

        const label = document.createElement('label');
        label.className = 'var-label';
        label.innerHTML = `<span>${readableLabel(name)}</span><span class="var-name">${name}</span>`;

        const inputRow = document.createElement('div');
        inputRow.className = 'var-input-row';

        const isColorLike = COLOR_LIKE_KEYS.has(name);
        let colorInput = null;

        if (isColorLike) {
            colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = toColorOrDefault(value);
            colorInput.addEventListener('input', () => {
                textInput.value = colorInput.value;
                textInput.dispatchEvent(new Event('input', { bubbles: true }));
            });
            inputRow.appendChild(colorInput);
        }

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = value || '';
        textInput.dataset.mode = mode;
        textInput.dataset.varName = name;
        inputRow.appendChild(textInput);

        row.appendChild(label);
        row.appendChild(inputRow);
        return row;
    }

    function readableLabel(name) {
        const trimmed = name.replace(/^--/, '');
        return trimmed
            .split('-')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    function toColorOrDefault(value) {
        if (typeof value !== 'string') return '#000000';
        const match = value.trim().match(/^#([0-9a-fA-F]{6})$/);
        return match ? value : '#000000';
    }

    function collectConfigFromInputs(config) {
        const result = {
            light: { ...config.light },
            dark: { ...config.dark }
        };

        const inputs = document.querySelectorAll('.var-input-row input[type="text"]');
        inputs.forEach((input) => {
            const mode = input.dataset.mode;
            const name = input.dataset.varName;
            if (!mode || !name) return;
            const value = input.value.trim();
            if (!value) return;
            if (mode === 'light') {
                result.light[name] = value;
            } else if (mode === 'dark') {
                result.dark[name] = value;
            }
        });

        return result;
    }

    function updateJsonTextarea(config) {
        const textarea = document.getElementById('config-json');
        if (!textarea) return;
        textarea.value = JSON.stringify(config, null, 2);
    }

    function applyConfig(config) {
        if (typeof window.setThemeVariables === 'function') {
            window.setThemeVariables(config);
        }
        updateJsonTextarea(config);
    }

    function renderInputs(config) {
        const lightRoot = document.getElementById('light-vars');
        const darkRoot = document.getElementById('dark-vars');
        if (!lightRoot || !darkRoot) return;

        lightRoot.innerHTML = '';
        darkRoot.innerHTML = '';

        Object.keys(config.light).forEach((name) => {
            lightRoot.appendChild(createVarRow('light', name, config.light[name]));
        });
        Object.keys(config.dark).forEach((name) => {
            darkRoot.appendChild(createVarRow('dark', name, config.dark[name]));
        });
    }

    function initTabs() {
        const tabs = Array.from(document.querySelectorAll('.mode-tab'));
        const panels = Array.from(document.querySelectorAll('.mode-panel'));

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const mode = tab.getAttribute('data-mode');
                tabs.forEach((t) => {
                    t.classList.toggle('active', t === tab);
                    t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
                });
                panels.forEach((panel) => {
                    panel.classList.toggle(
                        'hidden',
                        panel.getAttribute('data-mode-panel') !== mode
                    );
                });
            });
        });
    }

    function pickSurprisePalette() {
        const i = Math.floor(Math.random() * SURPRISE_PALETTES.length);
        const preset = SURPRISE_PALETTES[i];
        return {
            light: { ...DEFAULT_LIGHT, ...preset.light },
            dark: { ...DEFAULT_DARK, ...preset.dark }
        };
    }

    function initButtons(config) {
        const btnSurprise = document.getElementById('btn-surprise');
        const btnSave = document.getElementById('btn-save');
        const btnReset = document.getElementById('btn-reset');
        const btnClear = document.getElementById('btn-clear');
        const btnApplyJson = document.getElementById('btn-apply-json');
        const textarea = document.getElementById('config-json');

        if (btnSurprise) {
            btnSurprise.addEventListener('click', () => {
                const next = pickSurprisePalette();
                config.light = next.light;
                config.dark = next.dark;
                renderInputs(config);
                applyConfig(next);
            });
        }

        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const updated = collectConfigFromInputs(config);
                config.light = updated.light;
                config.dark = updated.dark;
                applyConfig(config);
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', () => {
                config.light = { ...DEFAULT_LIGHT };
                config.dark = { ...DEFAULT_DARK };
                renderInputs(config);
                applyConfig(config);
            });
        }

        if (btnClear) {
            btnClear.addEventListener('click', () => {
                const empty = { light: {}, dark: {} };
                config.light = { ...DEFAULT_LIGHT };
                config.dark = { ...DEFAULT_DARK };
                renderInputs(config);
                if (typeof window.setThemeVariables === 'function') {
                    window.setThemeVariables(empty);
                }
                updateJsonTextarea(empty);
            });
        }

        if (btnApplyJson && textarea) {
            btnApplyJson.addEventListener('click', () => {
                try {
                    const parsed = JSON.parse(textarea.value);
                    if (!parsed || typeof parsed !== 'object') return;
                    const next = {
                        light: { ...DEFAULT_LIGHT, ...(parsed.light || {}) },
                        dark: { ...DEFAULT_DARK, ...(parsed.dark || {}) }
                    };
                    config.light = next.light;
                    config.dark = next.dark;
                    renderInputs(config);
                    applyConfig(next);
                } catch (e) {
                    // ignore invalid JSON
                }
            });
        }
    }

    function init() {
        const config = getInitialConfig();
        renderInputs(config);
        updateJsonTextarea({
            light: config.light,
            dark: config.dark
        });
        initTabs();
        initButtons(config);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

