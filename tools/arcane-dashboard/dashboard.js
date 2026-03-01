/**
 * Arcane Dashboard – bootstrap, campaign selector, plugin API, shortcuts.
 * Plugin API: window.ArcaneDashboard.registerWidget(typeId, { title, icon, createElement, onLayoutLoad })
 */
(function () {
    'use strict';

    var STATE = window.ArcaneDashboardState;
    var LAYOUT = window.ArcaneDashboardLayout;
    if (!STATE || !LAYOUT) return;

    var widgetRegistry = {};
    var campaignId = '';

    function getLayout() {
        return STATE.getLayout(campaignId);
    }

    function saveLayout(layout) {
        STATE.setLayout(campaignId, layout);
    }

    function addWidget(typeId, title, defaultSize) {
        var layout = getLayout();
        layout.widgets = layout.widgets || [];
        var w = defaultSize && defaultSize.w ? defaultSize.w : 280;
        var h = defaultSize && defaultSize.h ? defaultSize.h : 200;
        var x = 20 + (layout.widgets.length * 30) % 200;
        var y = 20 + Math.floor(layout.widgets.length / 4) * 40;
        layout.widgets.push({
            id: 'w-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            type: typeId,
            title: title || typeId,
            x: x, y: y, w: w, h: h,
            pinned: false,
            visible: true
        });
        saveLayout(layout);
        refreshWidgetLayer();
    }

    function refreshWidgetLayer() {
        var layer = document.getElementById('ad-widget-layer');
        if (!layer) return;
        LAYOUT.setContainer(layer);
        var layout = getLayout();
        LAYOUT.setSnapEnabled(layout.snap !== false);
        var bodyRenderers = {};
        if (window.ArcaneDashboardWidgets) {
            bodyRenderers = window.ArcaneDashboardWidgets.getBodyRenderers();
        }
        LAYOUT.render(layout, campaignId, bodyRenderers);
    }

    function loadCampaigns() {
        var select = document.getElementById('ad-campaign-select');
        if (!select) return;
        var list = STATE.getCampaigns();
        var active = STATE.getActiveCampaignId();
        select.innerHTML = '<option value="">— No campaign —</option>';
        list.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            if (c.id === active) opt.selected = true;
            select.appendChild(opt);
        });
        campaignId = active;
    }

    function onCampaignChange() {
        var select = document.getElementById('ad-campaign-select');
        if (!select) return;
        campaignId = select.value || '';
        STATE.setActiveCampaignId(campaignId);
        refreshWidgetLayer();
        if (window.ArcaneDashboardWidgets && window.ArcaneDashboardWidgets.onCampaignChange) {
            window.ArcaneDashboardWidgets.onCampaignChange(campaignId);
        }
    }

    function newCampaign() {
        var name = prompt('Campaign name:', 'New Campaign');
        if (!name || !name.trim()) return;
        var id = 'camp-' + Date.now();
        var list = STATE.getCampaigns();
        list.push({ id: id, name: name.trim() });
        STATE.setCampaigns(list);
        STATE.setActiveCampaignId(id);
        campaignId = id;
        loadCampaigns();
        document.getElementById('ad-campaign-select').value = id;
        refreshWidgetLayer();
    }

    function debounce(fn, ms) {
        var t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, ms);
        };
    }

    LAYOUT.setOnLayoutChange(debounce(function () {
        saveLayout(getLayout());
    }, 300));

    function setupAddWidgetMenu() {
        var btn = document.getElementById('ad-add-widget');
        var menu = document.getElementById('ad-add-widget-menu');
        if (!btn || !menu) return;
        var types = [
            { id: 'initiative', title: 'Initiative Tracker', w: 260, h: 320 },
            { id: 'notes', title: 'Notes Vault', w: 320, h: 280 },
            { id: 'rules', title: 'Rule Search', w: 300, h: 240 },
            { id: 'random', title: 'Random Generator', w: 280, h: 260 }
        ];
        menu.innerHTML = '';
        types.forEach(function (t) {
            var item = document.createElement('button');
            item.type = 'button';
            item.role = 'menuitem';
            item.textContent = t.title;
            item.addEventListener('click', function () {
                addWidget(t.id, t.title, { w: t.w, h: t.h });
                menu.classList.add('hidden');
                btn.setAttribute('aria-expanded', 'false');
            });
            menu.appendChild(item);
        });
        btn.addEventListener('click', function () {
            var open = !menu.classList.contains('hidden');
            menu.classList.toggle('hidden', open);
            btn.setAttribute('aria-expanded', !open);
        });
        document.addEventListener('click', function (e) {
            if (!btn.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.add('hidden');
                btn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    function setupSnapToggle() {
        var cb = document.getElementById('ad-snap-toggle');
        if (!cb) return;
        var layout = getLayout();
        cb.checked = layout.snap !== false;
        cb.addEventListener('change', function () {
            layout.snap = cb.checked;
            saveLayout(layout);
            LAYOUT.setSnapEnabled(layout.snap);
        });
    }

    function setupWhisper() {
        var overlay = document.getElementById('ad-whisper-overlay');
        var btn = document.getElementById('ad-whisper-btn');
        if (!overlay || !btn) return;
        function toggle() {
            var on = overlay.classList.contains('hidden');
            overlay.classList.toggle('hidden', !on);
            overlay.setAttribute('aria-hidden', !on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            if (on) {
                if (window.ArcaneDashboardWidgets && window.ArcaneDashboardWidgets.updateWhisperView) {
                    window.ArcaneDashboardWidgets.updateWhisperView();
                }
                applyWhisperMask(true);
            } else {
                applyWhisperMask(false);
            }
        }
        function applyWhisperMask(whisperOn) {
            var layer = document.getElementById('ad-widget-layer');
            if (!layer) return;
            var layout = getLayout();
            (layout.widgets || []).forEach(function (w) {
                var el = layer.querySelector('[data-widget-id="' + w.id + '"]');
                if (!el) return;
                if (!whisperOn) {
                    el.style.visibility = w.visible !== false ? '' : 'hidden';
                    el.style.opacity = '';
                    return;
                }
                if (w.type === 'notes') {
                    el.style.visibility = 'hidden';
                    el.style.opacity = '0';
                    return;
                }
                if (w.type === 'initiative' || w.type === 'rules' || w.type === 'random') {
                    if (!w.pinned) {
                        el.style.visibility = 'hidden';
                        el.style.opacity = '0';
                    } else {
                        el.style.visibility = '';
                        el.style.opacity = '1';
                    }
                    return;
                }
                if (!w.pinned) {
                    el.style.visibility = 'hidden';
                    el.style.opacity = '0';
                } else {
                    el.style.visibility = '';
                    el.style.opacity = '1';
                }
            });
        }
        btn.addEventListener('click', toggle);
        window.ArcaneDashboardWhisperToggle = toggle;
    }

    function setupModals() {
        function helpModal() {
            var modal = document.getElementById('ad-help-modal');
            var body = document.getElementById('ad-help-body');
            if (!body) return;
            var remap = getShortcutRemap();
            var shortcuts = [
                { key: remap.whisper || 'W', desc: 'Whisper mode' },
                { key: remap.help || '?', desc: 'This help' },
                { key: 'G', desc: 'Focus Random Generator' },
                { key: 'N', desc: 'Focus Notes' }
            ];
            body.innerHTML = '<ul style="list-style:none;padding:0">' +
                shortcuts.map(function (s) { return '<li><kbd>' + s.key + '</kbd> – ' + s.desc + '</li>'; }).join('') +
                '</ul><p>Pin a widget to show it in whisper (player) view.</p>' +
                '<p class="ad-settings-hint">If a shortcut doesn\'t work (e.g. browser uses it), remap in Settings.</p>';
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
        }
        function closeHelp() {
            var modal = document.getElementById('ad-help-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden', 'true');
            }
        }
        document.getElementById('ad-help-btn').addEventListener('click', helpModal);
        document.getElementById('ad-help-close').addEventListener('click', closeHelp);
        document.getElementById('ad-help-modal').querySelector('.ad-modal-backdrop').addEventListener('click', closeHelp);

        function openSettings() {
            document.getElementById('ad-settings-modal').classList.remove('hidden');
            document.getElementById('ad-settings-modal').setAttribute('aria-hidden', 'false');
        }
        function closeSettings() {
            document.getElementById('ad-settings-modal').classList.add('hidden');
            document.getElementById('ad-settings-modal').setAttribute('aria-hidden', 'true');
        }
        document.getElementById('ad-settings-btn').addEventListener('click', openSettings);
        document.getElementById('ad-settings-close').addEventListener('click', closeSettings);
        document.getElementById('ad-settings-modal').querySelector('.ad-modal-backdrop').addEventListener('click', closeSettings);

        var remapWhisper = document.getElementById('ad-remap-whisper');
        var remapHelp = document.getElementById('ad-remap-help');
        if (remapWhisper && remapHelp) {
            var r = getShortcutRemap();
            remapWhisper.value = r.whisper || 'W';
            remapHelp.value = r.help || '?';
            remapWhisper.addEventListener('change', function () {
                r.whisper = remapWhisper.value || 'W';
                setShortcutRemap(r);
            });
            remapHelp.addEventListener('change', function () {
                r.help = remapHelp.value || '?';
                setShortcutRemap(r);
            });
        }
    }

    function setupExportImport() {
        document.getElementById('ad-export-btn').addEventListener('click', function () {
            if (!campaignId) { alert('Select a campaign first.'); return; }
            var json = JSON.stringify(STATE.exportCampaign(campaignId), null, 2);
            var blob = new Blob([json], { type: 'application/json' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'arcane-dashboard-' + campaignId + '.json';
            a.click();
            URL.revokeObjectURL(a.href);
        });
        document.getElementById('ad-import-file').addEventListener('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            var r = new FileReader();
            r.onload = function () {
                try {
                    var data = JSON.parse(r.result);
                    if (STATE.importCampaign(data)) {
                        loadCampaigns();
                        campaignId = STATE.getActiveCampaignId();
                        if (data.campaign && data.campaign.id) {
                            document.getElementById('ad-campaign-select').value = data.campaign.id;
                            campaignId = data.campaign.id;
                            STATE.setActiveCampaignId(campaignId);
                        }
                        refreshWidgetLayer();
                        if (window.ArcaneDashboardWidgets && window.ArcaneDashboardWidgets.onCampaignChange) {
                            window.ArcaneDashboardWidgets.onCampaignChange(campaignId);
                        }
                        alert('Campaign imported.');
                    }
                } catch (err) {
                    alert('Invalid JSON: ' + err.message);
                }
                e.target.value = '';
            };
            r.readAsText(file);
        });
        document.getElementById('ad-import-btn').addEventListener('click', function () {
            document.getElementById('ad-import-file').click();
        });
    }

    var MAX_BG_SIZE = 2 * 1024 * 1024;
    var MAX_BG_DIM = 1920;
    var BG_QUALITY = 0.75;

    function setupBackgroundUpload() {
        var input = document.getElementById('ad-bg-upload');
        if (!input) return;
        input.addEventListener('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            if (file.size > MAX_BG_SIZE) {
                alert('Image must be under 2 MB. Choose a smaller file or it will be compressed.');
            }
            var img = new Image();
            var url = URL.createObjectURL(file);
            img.onload = function () {
                var w = img.naturalWidth;
                var h = img.naturalHeight;
                if (w > MAX_BG_DIM || h > MAX_BG_DIM) {
                    if (w > h) {
                        h = Math.round(h * MAX_BG_DIM / w);
                        w = MAX_BG_DIM;
                    } else {
                        w = Math.round(w * MAX_BG_DIM / h);
                        h = MAX_BG_DIM;
                    }
                }
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(url);
                var dataUrl = canvas.toDataURL('image/jpeg', BG_QUALITY);
                if (dataUrl.length > MAX_BG_SIZE) {
                    dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                }
                var layout = getLayout();
                layout.background = dataUrl;
                saveLayout(layout);
                var bgEl = document.getElementById('ad-background');
                if (bgEl) {
                    bgEl.style.backgroundImage = 'url(' + dataUrl + ')';
                    bgEl.classList.remove('preset-nebula', 'preset-parchment');
                }
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                alert('Could not load image.');
            };
            img.src = url;
            e.target.value = '';
        });

        document.getElementById('ad-bg-preset-nebula').addEventListener('click', function () {
            var layout = getLayout();
            layout.background = null;
            layout.backgroundPreset = 'nebula';
            saveLayout(layout);
            applyBackground();
        });
        document.getElementById('ad-bg-preset-parchment').addEventListener('click', function () {
            var layout = getLayout();
            layout.background = null;
            layout.backgroundPreset = 'parchment';
            saveLayout(layout);
            applyBackground();
        });
    }

    function applyBackground() {
        var layout = getLayout();
        var bgEl = document.getElementById('ad-background');
        if (!bgEl) return;
        if (layout.background) {
            bgEl.style.backgroundImage = 'url(' + layout.background + ')';
            bgEl.classList.remove('preset-nebula', 'preset-parchment');
        } else {
            bgEl.style.backgroundImage = '';
            bgEl.classList.remove('preset-nebula', 'preset-parchment');
            if (layout.backgroundPreset === 'parchment') {
                bgEl.classList.add('preset-parchment');
            } else {
                bgEl.classList.add('preset-nebula');
            }
        }
    }

    function getShortcutRemap() {
        try {
            var raw = localStorage.getItem('v1-arcane-dashboard-shortcut-remap');
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return { whisper: 'W', help: '?' };
    }

    function setShortcutRemap(remap) {
        try {
            localStorage.setItem('v1-arcane-dashboard-shortcut-remap', JSON.stringify(remap));
        } catch (_) {}
    }

    function setupShortcuts() {
        document.addEventListener('keydown', function (e) {
            if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
            var remap = getShortcutRemap();
            var key = e.key;
            var whisperKey = (remap.whisper || 'W').toUpperCase();
            var helpKey = remap.help || '?';
            if (key === whisperKey || key === whisperKey.toLowerCase()) {
                if (window.ArcaneDashboardWhisperToggle) {
                    window.ArcaneDashboardWhisperToggle();
                    e.preventDefault();
                }
            } else if (key === helpKey) {
                var helpBtn = document.getElementById('ad-help-btn');
                if (helpBtn) { helpBtn.click(); e.preventDefault(); }
            }
        });
    }

    /** Public plugin API: register a widget type for future use */
    function registerWidget(typeId, config) {
        widgetRegistry[typeId] = config;
    }

    window.ArcaneDashboard = {
        registerWidget: registerWidget,
        getCampaignId: function () { return campaignId; },
        addWidget: addWidget,
        refreshWidgetLayer: refreshWidgetLayer
    };

    document.getElementById('ad-campaign-select').addEventListener('change', function () {
        onCampaignChange();
        applyBackground();
    });
    document.getElementById('ad-new-campaign').addEventListener('click', newCampaign);
    loadCampaigns();
    setupAddWidgetMenu();
    setupSnapToggle();
    setupWhisper();
    setupModals();
    setupExportImport();
    setupBackgroundUpload();
    setupShortcuts();
    applyBackground();
    LAYOUT.setContainer(document.getElementById('ad-widget-layer'));
    var layout = getLayout();
    LAYOUT.setSnapEnabled(layout.snap !== false);
    refreshWidgetLayer();
    applyBackground();
})();
