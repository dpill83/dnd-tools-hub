(function () {
    'use strict';

    const STORAGE_KEY = 'dnd-ambience-sounds';
    const SCHEMA_VERSION = 2;
    const MAX_ICON_BYTES = 80 * 1024;
    const MAX_EMBED_LAYERS = 6;

    const EMOJIS = ['⚔️', '🍺', '⛺', '🌙', '🏰', '🌲', '🕳️', '🔥', '🌧️', '🌊', '🏘️', '🐉', '🦇', '📜', '🕯️', '🎵', '⚡', '❄️', '🌿', '🗡️'];

    function defaultState() {
        return {
            version: SCHEMA_VERSION,
            settings: {
                playbackMode: 'newTab',
                customColors: null,
                cardsPerRow: 1,
                cardSize: 'medium',
                startFromBeginning: true,
                cardSort: 'manual',
                floatingPlayer: false,
                embedMinimized: false,
                audioOnly: false,
                alwaysCollapseLayers: false,
                playerSlotsPerRow: 3
            },
            folders: [],
            profiles: [],
            playlists: [],
            groups: [],
            embedSlots: { layers: [] }
        };
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultState();
            const data = JSON.parse(raw);
            if (!data.version || !Array.isArray(data.profiles)) return defaultState();
            data.folders = Array.isArray(data.folders) ? data.folders : [];
            data.playlists = Array.isArray(data.playlists) ? data.playlists : [];
            data.groups = Array.isArray(data.groups) ? data.groups : [];
            data.settings = data.settings || defaultState().settings;
            var oldSlots = data.embedSlots;
            if (oldSlots && (oldSlots.layer1 != null || oldSlots.layer2 != null || oldSlots.soundEffect != null)) {
                var layers = [];
                [oldSlots.layer1, oldSlots.layer2].forEach(function (slot) {
                    if (slot && slot.embedUrl) layers.push({ id: 'layer-' + layers.length, type: 'ambience', profileId: slot.profileId, name: slot.name, embedUrl: slot.embedUrl, loop: slot.loop });
                });
                if (oldSlots.soundEffect && oldSlots.soundEffect.embedUrl) layers.push({ id: 'layer-' + layers.length, type: 'sfx', profileId: oldSlots.soundEffect.profileId, name: oldSlots.soundEffect.name, embedUrl: oldSlots.soundEffect.embedUrl, loop: oldSlots.soundEffect.loop });
                data.embedSlots = { layers: layers };
            } else if (!data.embedSlots || !Array.isArray(data.embedSlots.layers)) {
                data.embedSlots = { layers: [] };
            }
            if (!data.embedSlots.layers) data.embedSlots.layers = [];
            data.profiles.forEach(function (p) {
                p.starred = p.starred === true;
            });
            return data;
        } catch (_) {
            return defaultState();
        }
    }

    function saveState(state) {
        try {
            var toSave = {
                version: state.version,
                settings: state.settings,
                folders: state.folders,
                profiles: state.profiles,
                playlists: state.playlists,
                groups: state.groups,
                embedSlots: {
                    layers: (state.embedSlots && state.embedSlots.layers || []).map(function (l) {
                        return { id: l.id, type: l.type, profileId: l.profileId, name: l.name, embedUrl: l.embedUrl, loop: l.loop };
                    })
                }
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {
            console.error('Failed to save ambience state:', e);
        }
    }

    function isValidYouTubeUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return /^https?:\/\/(www\.)?(youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/)/i.test(url.trim());
    }

    function getVideoId(url) {
        const u = url.trim();
        const m = u.match(/(?:v=|\/embed\/|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return m ? m[1] : null;
    }

    function getEmbedUrl(url, options) {
        options = options || {};
        const id = getVideoId(url);
        if (!id) return null;
        var parts = [];
        if (options.autoplay !== false) parts.push('autoplay=1');
        if (state.settings && state.settings.startFromBeginning) parts.push('start=0');
        if (options.loop) {
            parts.push('loop=1');
            parts.push('playlist=' + id);
        }
        // Add origin to help with cross-origin issues and rel=0 to reduce external requests
        try {
            parts.push('origin=' + encodeURIComponent(window.location.origin));
        } catch (_) {}
        parts.push('rel=0');
        parts.push('modestbranding=1');
        parts.push('enablejsapi=1');
        return 'https://www.youtube.com/embed/' + id + '?' + parts.join('&');
    }

    function appendStartParam(url) {
        if (!url || typeof url !== 'string') return url;
        if (!(state.settings && state.settings.startFromBeginning)) return url;
        var u = url.replace(/[?&]t=\d+/g, '').replace(/&&/g, '&').replace(/\?&/, '?').replace(/[&?]$/, '');
        if (u.indexOf('?') >= 0) return u + '&t=0';
        return u + '?t=0';
    }

    function applyCustomColors(colors) {
        const page = document.getElementById('ambience-page');
        if (!page || !colors) return;
        Object.keys(colors).forEach(function (key) {
            page.style.setProperty(key, colors[key]);
        });
    }

    function clearCustomColors() {
        const page = document.getElementById('ambience-page');
        if (!page) return;
        ['--primary-color', '--accent-color', '--card-bg'].forEach(function (key) {
            page.style.removeProperty(key);
        });
    }

    let state = loadState();
    let filterFolderId = '';
    let editingProfileId = null;
    let pendingImportData = null;
    var pendingYTPlayers = [];

    function loadYouTubeAPI() {
        if (window.YT && window.YT.Player) return;
        if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
        var tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        var first = document.getElementsByTagName('script')[0];
        if (first && first.parentNode) first.parentNode.insertBefore(tag, first);
    }

    function updatePlayPauseButton(slotId, playerState) {
        var btn = document.querySelector('.embed-slot-play-pause[data-slot="' + slotId + '"]');
        if (!btn) return;
        var playing = playerState === 1;
        btn.textContent = playing ? '\u23F8' : '\u25B6';
        btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }

    function getLayerBySlotId(slotId) {
        var layers = state.embedSlots && state.embedSlots.layers;
        if (!layers) return null;
        for (var i = 0; i < layers.length; i++) if (layers[i].id === slotId) return layers[i];
        return null;
    }

    function attachYTPlayer(frame, slotId, slotEl) {
        if (!window.YT || !window.YT.Player) return;
        try {
            new window.YT.Player(frame, {
                events: {
                    onReady: function (ev) {
                        var layer = getLayerBySlotId(slotId);
                        if (layer) layer.player = ev.target;
                        var volEl = slotEl && slotEl.querySelector('.embed-slot-volume');
                        if (layer && layer.player && volEl) layer.player.setVolume(parseInt(volEl.value, 10) || 100);
                        updatePlayPauseButton(slotId, ev.target.getPlayerState ? ev.target.getPlayerState() : 0);
                    },
                    onStateChange: function (ev) {
                        updatePlayPauseButton(slotId, ev.data);
                    }
                }
            });
        } catch (e) {
            console.warn('YouTube player init failed', e);
        }
    }

    function attachYTPlayerWhenReady(frame, slotId, slotEl) {
        function doAttach() {
            if (window.YT && window.YT.Player) {
                attachYTPlayer(frame, slotId, slotEl);
            } else {
                pendingYTPlayers.push({ frame: frame, slotId: slotId, slotEl: slotEl });
            }
        }
        var layers = state.embedSlots && state.embedSlots.layers;
        var hasOtherPlayer = layers && layers.some(function (l) {
            return l.id !== slotId && l.player;
        });
        if (hasOtherPlayer) {
            setTimeout(doAttach, 100);
        } else {
            doAttach();
        }
    }

    window.onYouTubeIframeAPIReady = function () {
        pendingYTPlayers.forEach(function (args) {
            attachYTPlayer(args.frame, args.slotId, args.slotEl);
        });
        pendingYTPlayers.length = 0;
    };

    function getProfilesForView() {
        const list = state.profiles.slice();
        list.sort(function (a, b) {
            const ao = typeof a.order === 'number' ? a.order : 0;
            const bo = typeof b.order === 'number' ? b.order : 0;
            return ao - bo;
        });
        let result;
        if (filterFolderId === '__starred__') {
            result = list.filter(function (p) { return p.starred === true; });
        } else if (filterFolderId.indexOf('grp:') === 0) {
            const groupId = filterFolderId.slice(4);
            const grp = state.groups.find(function (x) { return x.id === groupId; });
            if (!grp || !Array.isArray(grp.profileIds)) return [];
            const byId = {};
            list.forEach(function (p) { byId[p.id] = p; });
            return grp.profileIds.map(function (id) { return byId[id]; }).filter(Boolean);
        } else if (filterFolderId.indexOf('pl:') === 0) {
            const playlistId = filterFolderId.slice(3);
            const pl = state.playlists.find(function (x) { return x.id === playlistId; });
            if (!pl || !Array.isArray(pl.profileIds)) return [];
            const byId = {};
            list.forEach(function (p) { byId[p.id] = p; });
            return pl.profileIds.map(function (id) { return byId[id]; }).filter(Boolean);
        } else if (filterFolderId) {
            result = list.filter(function (p) { return (p.folderId || '') === filterFolderId; });
        } else {
            result = list;
        }
        var sortMode = (state.settings && state.settings.cardSort) || 'manual';
        if (sortMode !== 'manual' && result.length > 1) {
            result = result.slice();
            if (sortMode === 'name-az') {
                result.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }); });
            } else if (sortMode === 'name-za') {
                result.sort(function (a, b) { return String(b.name || '').localeCompare(String(a.name || ''), undefined, { sensitivity: 'base' }); });
            } else if (sortMode === 'emoji') {
                result.sort(function (a, b) {
                    var ia = (a.icon && !a.icon.startsWith('data:')) ? a.icon : '\uffff';
                    var ib = (b.icon && !b.icon.startsWith('data:')) ? b.icon : '\uffff';
                    if (ia === ib) return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
                    return ia.localeCompare(ib, undefined, { sensitivity: 'base' });
                });
            } else if (sortMode === 'folder') {
                var folderById = {};
                state.folders.forEach(function (f) { folderById[f.id] = f; });
                result.sort(function (a, b) {
                    var fa = a.folderId ? (folderById[a.folderId] && folderById[a.folderId].name) || a.folderId : '';
                    var fb = b.folderId ? (folderById[b.folderId] && folderById[b.folderId].name) || b.folderId : '';
                    var cmp = fa.localeCompare(fb, undefined, { sensitivity: 'base' });
                    if (cmp !== 0) return cmp;
                    return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
                });
            }
        }
        return result;
    }

    function getViewSegments(profiles) {
        if (!profiles || profiles.length === 0) return [];
        if (filterFolderId.indexOf('grp:') === 0) {
            var groupId = filterFolderId.slice(4);
            var grp = state.groups.find(function (x) { return x.id === groupId; });
            if (!grp) return profiles.map(function (p) { return { type: 'card', profile: p }; });
            return [{ type: 'group', group: grp, profiles: profiles }];
        }
        var segments = [];
        var emittedGroupIds = {};
        var byId = {};
        profiles.forEach(function (p) { byId[p.id] = p; });
        for (var i = 0; i < profiles.length; i++) {
            var p = profiles[i];
            var g = getGroupContainingProfileId(p.id);
            if (!g) {
                segments.push({ type: 'card', profile: p });
            } else if (!emittedGroupIds[g.id]) {
                emittedGroupIds[g.id] = true;
                var groupProfiles = (g.profileIds || []).map(function (id) { return byId[id]; }).filter(Boolean);
                if (groupProfiles.length > 0) {
                    segments.push({ type: 'group', group: g, profiles: groupProfiles });
                }
            }
        }
        return segments;
    }

    function getNextOrder() {
        if (state.profiles.length === 0) return 0;
        const orders = state.profiles.map(function (p) { return typeof p.order === 'number' ? p.order : 0; });
        return Math.max.apply(null, orders) + 1;
    }

    function generateId() {
        return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    }

    function getGroupContainingProfileId(profileId) {
        if (!state.groups) return null;
        for (var i = 0; i < state.groups.length; i++) {
            var g = state.groups[i];
            if (Array.isArray(g.profileIds) && g.profileIds.indexOf(profileId) !== -1) return g;
        }
        return null;
    }

    function removeProfileFromAllGroups(profileId) {
        if (!state.groups) return;
        state.groups.forEach(function (g) {
            if (Array.isArray(g.profileIds)) g.profileIds = g.profileIds.filter(function (id) { return id !== profileId; });
        });
        state.groups = state.groups.filter(function (g) { return Array.isArray(g.profileIds) && g.profileIds.length > 0; });
    }

    function addCardToTargetGroup(sourceId, targetId) {
        if (sourceId === targetId) return;
        removeProfileFromAllGroups(sourceId);
        var targetGroup = getGroupContainingProfileId(targetId);
        if (targetGroup) {
            if (targetGroup.profileIds.indexOf(sourceId) === -1) targetGroup.profileIds.push(sourceId);
        } else {
            var groupNum = state.groups.length + 1;
            state.groups.push({
                id: generateId(),
                name: 'Group ' + groupNum,
                profileIds: [targetId, sourceId]
            });
        }
        saveState(state);
        renderFolderFilter();
        renderCards();
    }

    function reorderProfileToViewIndex(sourceId, viewInsertIndex) {
        if (filterFolderId !== '') return;
        removeProfileFromAllGroups(sourceId);
        var viewProfiles = getProfilesForView();
        var idx = viewProfiles.findIndex(function (p) { return p.id === sourceId; });
        if (idx === -1) return;
        var arr = viewProfiles.filter(function (p) { return p.id !== sourceId; });
        var sourceProfile = state.profiles.find(function (p) { return p.id === sourceId; });
        if (!sourceProfile) return;
        var insertAt = Math.max(0, Math.min(viewInsertIndex, arr.length));
        arr.splice(insertAt, 0, sourceProfile);
        arr.forEach(function (p, i) { p.order = i; });
        saveState(state);
        renderFolderFilter();
        renderCards();
    }

    function removeGroup(groupId) {
        state.groups = state.groups.filter(function (g) { return g.id !== groupId; });
        saveState(state);
        renderFolderFilter();
        renderCards();
    }

    function updateGroupName(grp, newName) {
        var name = (newName || '').trim();
        if (name) grp.name = name;
        saveState(state);
        renderFolderFilter();
        renderCards();
    }

    function applyGridLayout() {
        const grid = document.getElementById('ambience-cards-grid');
        if (!grid) return;
        const perRow = Math.min(4, Math.max(1, parseInt((state.settings && state.settings.cardsPerRow) || 1, 10) || 1));
        const size = (state.settings && state.settings.cardSize) || 'medium';
        if (!['small', 'medium', 'large'].includes(size)) state.settings.cardSize = 'medium';
        grid.classList.remove('cards-per-row-1', 'cards-per-row-2', 'cards-per-row-3', 'cards-per-row-4');
        grid.classList.add('cards-per-row-' + perRow);
        grid.classList.remove('card-size-small', 'card-size-medium', 'card-size-large');
        grid.classList.add('card-size-' + (['small', 'medium', 'large'].includes(size) ? size : 'medium'));
    }

    function renderFolderFilter() {
        const sel = document.getElementById('ambience-folder-filter');
        if (!sel) return;
        sel.innerHTML = '';
        const optAll = document.createElement('option');
        optAll.value = '';
        optAll.textContent = 'All';
        if (!filterFolderId) optAll.selected = true;
        sel.appendChild(optAll);
        const optStarred = document.createElement('option');
        optStarred.value = '__starred__';
        optStarred.textContent = '★ Starred';
        if (filterFolderId === '__starred__') optStarred.selected = true;
        sel.appendChild(optStarred);
        const folderGroup = document.createElement('optgroup');
        folderGroup.label = '— Folders —';
        state.folders.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (f) {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.name;
            if (f.id === filterFolderId) opt.selected = true;
            folderGroup.appendChild(opt);
        });
        sel.appendChild(folderGroup);
        const groupGroup = document.createElement('optgroup');
        groupGroup.label = '— Groups (drag cards together) —';
        state.groups.slice().forEach(function (grp) {
            const opt = document.createElement('option');
            opt.value = 'grp:' + grp.id;
            opt.textContent = grp.name || 'Group';
            if (filterFolderId === 'grp:' + grp.id) opt.selected = true;
            groupGroup.appendChild(opt);
        });
        sel.appendChild(groupGroup);
        const playlistGroup = document.createElement('optgroup');
        playlistGroup.label = '— Playlists —';
        state.playlists.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (pl) {
            const opt = document.createElement('option');
            opt.value = 'pl:' + pl.id;
            opt.textContent = pl.name;
            if (filterFolderId === 'pl:' + pl.id) opt.selected = true;
            playlistGroup.appendChild(opt);
        });
        sel.appendChild(playlistGroup);
        renderGroupButtons();
    }

    function renderGroupButtons() {
        const container = document.getElementById('ambience-group-buttons');
        if (!container) return;
        container.innerHTML = '';
        const hasGroups = state.groups.length > 0;
        const hasPlaylists = state.playlists.length > 0;
        if (!hasGroups && !hasPlaylists) return;
        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = 'ambience-btn group-btn' + (!filterFolderId ? ' active' : '');
        allBtn.setAttribute('aria-pressed', !filterFolderId ? 'true' : 'false');
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', function () {
            filterFolderId = '';
            renderFolderFilter();
            renderCards();
        });
        container.appendChild(allBtn);
        state.groups.forEach(function (grp) {
            var wrap = document.createElement('span');
            wrap.className = 'group-btn-wrap';
            const btn = document.createElement('button');
            btn.type = 'button';
            const isActive = filterFolderId === 'grp:' + grp.id;
            btn.className = 'ambience-btn group-btn' + (isActive ? ' active' : '');
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.textContent = grp.name || 'Group';
            btn.setAttribute('title', 'Drag a card onto another to add to this group');
            btn.addEventListener('click', function () {
                filterFolderId = 'grp:' + grp.id;
                renderFolderFilter();
                renderCards();
            });
            wrap.appendChild(btn);
            var renameBtn = document.createElement('button');
            renameBtn.type = 'button';
            renameBtn.className = 'ambience-btn small group-btn-rename';
            renameBtn.setAttribute('aria-label', 'Rename group');
            renameBtn.setAttribute('title', 'Rename group');
            renameBtn.textContent = '\u270E';
            renameBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var newName = prompt('Group name', grp.name || 'Group');
                if (newName != null) {
                    updateGroupName(grp, newName);
                }
            });
            wrap.appendChild(renameBtn);
            container.appendChild(wrap);
        });
        state.playlists.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (pl) {
            const btn = document.createElement('button');
            btn.type = 'button';
            const isActive = filterFolderId === 'pl:' + pl.id;
            btn.className = 'ambience-btn group-btn' + (isActive ? ' active' : '');
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.textContent = pl.name || 'Unnamed';
            btn.addEventListener('click', function () {
                filterFolderId = 'pl:' + pl.id;
                renderFolderFilter();
                renderCards();
            });
            container.appendChild(btn);
        });
    }

    function renderFoldersInForm() {
        const sel = document.getElementById('ambience-form-folder');
        if (!sel) return;
        const current = (sel.querySelector('option[value=""]') && sel.value) ? sel.value : '';
        sel.innerHTML = '<option value="">Uncategorized</option>';
        state.folders.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (f) {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.name;
            if (f.id === current) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    function buildCardElement(p, inGroup) {
        var cardGroup = inGroup ? null : getGroupContainingProfileId(p.id);
        const li = document.createElement('div');
        li.className = 'card' + (cardGroup ? ' card-in-group' : '');
        li.setAttribute('role', 'listitem');
        li.dataset.profileId = p.id;

        const header = document.createElement('div');
        header.className = 'card-header';
        if (cardGroup) {
            var groupBadge = document.createElement('span');
            groupBadge.className = 'card-group-badge';
            groupBadge.textContent = cardGroup.name || 'Group';
            groupBadge.setAttribute('title', 'In group. Drag another card here to add.');
            header.appendChild(groupBadge);
        }
        if (p.loop) {
            var loopBadge = document.createElement('span');
            loopBadge.className = 'card-loop-badge';
            loopBadge.textContent = '\u27F3';
            loopBadge.setAttribute('title', 'Loops continuously');
            loopBadge.setAttribute('aria-hidden', 'true');
            header.appendChild(loopBadge);
        }
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'card-drag-handle';
        handle.setAttribute('aria-label', 'Drag to reorder or onto another card to group');
        handle.textContent = '\u22EE\u22EE';
        handle.draggable = true;
        header.appendChild(handle);
        li.appendChild(header);

        const body = document.createElement('div');
        body.className = 'card-body';
        const iconWrap = document.createElement('div');
        iconWrap.className = 'card-icon';
        if (p.icon && p.icon.startsWith('data:')) {
            const img = document.createElement('img');
            img.src = p.icon;
            img.alt = '';
            iconWrap.appendChild(img);
        } else {
            iconWrap.textContent = p.icon || '🎵';
        }
        body.appendChild(iconWrap);
        const label = document.createElement('span');
        label.className = 'card-label';
        label.textContent = p.name || 'Unnamed';
        body.appendChild(label);
        const notesWrap = document.createElement('div');
        notesWrap.className = 'card-dm-notes-wrap';
        const notesInput = document.createElement('input');
        notesInput.type = 'text';
        notesInput.className = 'card-dm-notes';
        notesInput.placeholder = 'DM note…';
        notesInput.maxLength = 80;
        notesInput.value = p.dmNotes || '';
        notesInput.setAttribute('aria-label', 'DM note');
        notesInput.addEventListener('click', function (e) { e.stopPropagation(); });
        notesInput.addEventListener('blur', function () {
            var val = (notesInput.value || '').trim() || null;
            if (p.dmNotes !== val) {
                p.dmNotes = val;
                saveState(state);
            }
        });
        notesWrap.appendChild(notesInput);
        body.appendChild(notesWrap);
        li.appendChild(body);

        const actions = document.createElement('div');
        actions.className = 'card-actions';
        const starBtn = document.createElement('button');
        starBtn.type = 'button';
        starBtn.className = 'star-btn' + (p.starred ? ' starred' : '');
        starBtn.setAttribute('aria-label', p.starred ? 'Unstar' : 'Star');
        starBtn.textContent = p.starred ? '\u2605' : '\u2606';
        const linkBtn = document.createElement('button');
        linkBtn.type = 'button';
        linkBtn.className = 'card-link-btn';
        linkBtn.setAttribute('aria-label', 'Open in YouTube');
        linkBtn.setAttribute('title', 'Open in YouTube');
        linkBtn.textContent = '\uD83D\uDD17';
            const groupBtn = document.createElement('button');
            groupBtn.type = 'button';
            groupBtn.className = 'card-group-btn';
            groupBtn.setAttribute('aria-label', 'Add to group');
            groupBtn.setAttribute('title', 'Add to group');
            groupBtn.textContent = '\u2630';
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.setAttribute('aria-label', 'Edit');
            editBtn.textContent = '\u270E';
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.setAttribute('aria-label', 'Delete');
            delBtn.textContent = '\uD83D\uDDD1';
            actions.appendChild(starBtn);
            actions.appendChild(linkBtn);
            actions.appendChild(groupBtn);
            if (inGroup) {
                var removeFromGroupBtn = document.createElement('button');
                removeFromGroupBtn.type = 'button';
                removeFromGroupBtn.className = 'ambience-btn small card-remove-from-group';
                removeFromGroupBtn.setAttribute('aria-label', 'Remove from group');
                removeFromGroupBtn.setAttribute('title', 'Remove from group');
                removeFromGroupBtn.textContent = '\u2191';
                removeFromGroupBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    removeProfileFromAllGroups(p.id);
                    saveState(state);
                    renderCards();
                });
                actions.appendChild(removeFromGroupBtn);
            }
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            li.appendChild(actions);

        handle.addEventListener('click', function (e) { e.stopPropagation(); });
        starBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            p.starred = !p.starred;
            saveState(state);
            renderCards();
        });
        linkBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (p.url && isValidYouTubeUrl(p.url)) {
                window.open(appendStartParam(p.url), '_blank');
            }
        });
        groupBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            openPlaylistDropdown(groupBtn, p.id);
        });
        editBtn.addEventListener('click', function (e) { e.stopPropagation(); openFormModal(p.id); });
        delBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (confirm("Delete \"" + (p.name || "") + "\"?")) {
                state.profiles = state.profiles.filter(function (x) { return x.id !== p.id; });
                state.playlists.forEach(function (pl) {
                    if (Array.isArray(pl.profileIds)) pl.profileIds = pl.profileIds.filter(function (id) { return id !== p.id; });
                });
                removeProfileFromAllGroups(p.id);
                saveState(state);
                renderCards();
            }
        });

        li.addEventListener('click', function (e) {
            if (e.target.closest('.card-drag-handle, .card-actions, .card-dm-notes-wrap')) return;
            playProfile(p);
        });

        handle.addEventListener('dragstart', onDragStart);
        li.addEventListener('dragover', onDragOver);
        li.addEventListener('drop', onDrop);
        li.addEventListener('dragend', onDragEnd);
        li.addEventListener('dragleave', onDragLeave);

        return li;
    }

    function renderCards() {
        const grid = document.getElementById('ambience-cards-grid');
        const addNew = document.getElementById('ambience-add-new-card');
        if (!grid || !addNew) return;
        grid.querySelectorAll('.card-slot').forEach(function (el) { el.remove(); });

        const profiles = getProfilesForView();
        const segments = getViewSegments(profiles);
        const showInsertZones = filterFolderId === '';

        segments.forEach(function (seg, segIndex) {
            var slot = document.createElement('div');
            slot.className = 'card-slot';

            if (showInsertZones) {
                var zone = document.createElement('div');
                zone.className = 'insert-zone';
                zone.setAttribute('aria-label', 'Drop to reorder');
                zone.dataset.insertIndex = String(segIndex);
                zone.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    zone.classList.add('drag-over');
                });
                zone.addEventListener('dragleave', function () { zone.classList.remove('drag-over'); });
                zone.addEventListener('drop', function (e) {
                    e.preventDefault();
                    zone.classList.remove('drag-over');
                    var sourceId = e.dataTransfer.getData('application/x-ambience-profile-id');
                    if (!sourceId) return;
                    var idx = parseInt(zone.dataset.insertIndex, 10);
                    reorderProfileToViewIndex(sourceId, idx);
                });
                slot.appendChild(zone);
            }

            if (seg.type === 'card') {
                slot.appendChild(buildCardElement(seg.profile, false));
            } else {
                var grp = seg.group;
                var groupEl = document.createElement('div');
                groupEl.className = 'card-group';
                groupEl.dataset.groupId = grp.id;

                var headerEl = document.createElement('div');
                headerEl.className = 'card-group-header';
                headerEl.dataset.groupId = grp.id;
                headerEl.dataset.profileId = grp.profileIds && grp.profileIds[0] ? grp.profileIds[0] : '';
                var nameSpan = document.createElement('span');
                nameSpan.className = 'card-group-name';
                nameSpan.textContent = grp.name || 'Group';
                nameSpan.setAttribute('title', 'Click to rename');
                nameSpan.addEventListener('click', function () {
                    var newName = prompt('Group name', grp.name || 'Group');
                    if (newName != null) {
                        updateGroupName(grp, newName);
                    }
                });
                headerEl.appendChild(nameSpan);
                var ungroupBtn = document.createElement('button');
                ungroupBtn.type = 'button';
                ungroupBtn.className = 'ambience-btn small card-group-ungroup';
                ungroupBtn.setAttribute('aria-label', 'Ungroup all');
                ungroupBtn.setAttribute('title', 'Ungroup all');
                ungroupBtn.textContent = '\u2A2F';
                ungroupBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    removeGroup(grp.id);
                });
                headerEl.appendChild(ungroupBtn);
                headerEl.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    headerEl.classList.add('drag-over');
                });
                headerEl.addEventListener('dragleave', function () { headerEl.classList.remove('drag-over'); });
                headerEl.addEventListener('drop', function (e) {
                    e.preventDefault();
                    headerEl.classList.remove('drag-over');
                    var sourceId = e.dataTransfer.getData('application/x-ambience-profile-id');
                    if (!sourceId || !headerEl.dataset.profileId) return;
                    addCardToTargetGroup(sourceId, headerEl.dataset.profileId);
                });
                groupEl.appendChild(headerEl);

                var cardsWrap = document.createElement('div');
                cardsWrap.className = 'card-group-cards';
                seg.profiles.forEach(function (p) {
                    cardsWrap.appendChild(buildCardElement(p, true));
                });
                groupEl.appendChild(cardsWrap);
                slot.appendChild(groupEl);
            }

            grid.insertBefore(slot, addNew);
        });
    }

    function onDragStart(e) {
        const card = e.target.closest('.card');
        if (!card || !card.dataset.profileId) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.profileId);
        e.dataTransfer.setData('application/x-ambience-profile-id', card.dataset.profileId);
        card.classList.add('dragging');
        var grid = document.getElementById('ambience-cards-grid');
        if (grid) grid.classList.add('drag-active');
    }

    function onDragOver(e) {
        e.preventDefault();
        const card = e.target.closest('.card');
        if (!card || card.classList.contains('dragging') || card.classList.contains('add-new-card')) return;
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
    }

    function onDragLeave(e) {
        const card = e.target.closest('.card');
        if (card) card.classList.remove('drag-over');
    }

    function onDrop(e) {
        e.preventDefault();
        const card = e.target.closest('.card');
        if (!card || card.classList.contains('add-new-card')) return;
        card.classList.remove('drag-over');
        const sourceId = e.dataTransfer.getData('application/x-ambience-profile-id');
        if (!sourceId) return;
        const targetId = card.dataset.profileId;
        if (sourceId === targetId) return;
        addCardToTargetGroup(sourceId, targetId);
    }

    function onDragEnd(e) {
        const card = e.target.closest('.card');
        if (card) card.classList.remove('dragging');
        var grid = document.getElementById('ambience-cards-grid');
        if (grid) grid.classList.remove('drag-active');
        document.querySelectorAll('.insert-zone').forEach(function (z) { z.classList.remove('drag-over'); });
    }

    function playProfile(profile) {
        var mode = (state.settings && state.settings.playbackMode) || 'newTab';
        var url = profile.url;
        if (!url) return;
        var loop = profile.loop === true;
        
        if (mode === 'newTab') {
            if (loop) {
                var loopEmbedUrl = getEmbedUrl(url, { loop: true });
                if (loopEmbedUrl) window.open(loopEmbedUrl, '_blank');
            } else {
                window.open(appendStartParam(url), '_blank');
            }
            return;
        }
        openSlotMenu(profile);
    }

    function openSlotMenu(profile) {
        var existing = document.getElementById('ambience-slot-menu-overlay');
        if (existing) existing.remove();
        var overlay = document.createElement('div');
        overlay.id = 'ambience-slot-menu-overlay';
        overlay.className = 'slot-menu-overlay';
        overlay.setAttribute('aria-hidden', 'false');
        var pop = document.createElement('div');
        pop.id = 'ambience-slot-menu';
        pop.className = 'slot-menu-dialog';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-label', 'Add as');
        var layers = state.embedSlots && state.embedSlots.layers ? state.embedSlots.layers : [];
        if (layers.length >= MAX_EMBED_LAYERS) {
            var msg = document.createElement('p');
            msg.className = 'slot-menu-message';
            msg.textContent = 'Maximum layers (' + MAX_EMBED_LAYERS + ') reached.';
            pop.appendChild(msg);
        } else {
            ['ambience', 'sfx'].forEach(function (type) {
                var label = type === 'ambience' ? 'Ambience' : 'Sound Effect';
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ambience-btn secondary slot-menu-btn';
                btn.textContent = label;
                btn.addEventListener('click', function () {
                    addLayer(profile, type);
                    close();
                });
                pop.appendChild(btn);
            });
        }
        overlay.appendChild(pop);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function (ev) {
            if (ev.target === overlay) close();
        });
        function close() {
            var el = document.getElementById('ambience-slot-menu-overlay');
            if (el) el.remove();
            document.removeEventListener('keydown', onKey);
        }
        function onKey(e) {
            if (e.key === 'Escape') close();
        }
        document.addEventListener('keydown', onKey);
    }

    function openFormModal(profileId) {
        editingProfileId = profileId || null;
        const title = document.getElementById('ambience-form-title');
        title.textContent = profileId ? 'Edit song' : 'Add song';
        renderFoldersInForm();
        renderEmojiGrid(null);
        const nameInput = document.getElementById('ambience-form-name');
        const dmNotesInput = document.getElementById('ambience-form-dm-notes');
        const urlInput = document.getElementById('ambience-form-url');
        const folderSelect = document.getElementById('ambience-form-folder');
        const fileInput = document.getElementById('ambience-icon-file');
        const preview = document.getElementById('ambience-icon-preview');
        if (fileInput) fileInput.value = '';
        if (preview) preview.innerHTML = '';
        var loopEl = document.getElementById('ambience-form-loop');
        if (profileId) {
            const p = state.profiles.find(function (x) { return x.id === profileId; });
            if (p) {
                nameInput.value = p.name || '';
                if (dmNotesInput) dmNotesInput.value = p.dmNotes || '';
                urlInput.value = p.url || '';
                folderSelect.value = p.folderId || '';
                if (loopEl) loopEl.checked = p.loop === true;
                renderEmojiGrid(p.icon && !p.icon.startsWith('data:') ? p.icon : null);
                if (p.icon && p.icon.startsWith('data:')) {
                    preview.innerHTML = '<img src="' + p.icon + '" alt="">';
                }
            }
        } else {
            nameInput.value = '';
            if (dmNotesInput) dmNotesInput.value = '';
            urlInput.value = '';
            folderSelect.value = '';
            if (loopEl) loopEl.checked = false;
        }
        document.getElementById('ambience-form-url-error').classList.add('hidden');
        document.getElementById('ambience-form-overlay').classList.add('open');
        document.getElementById('ambience-form-overlay').setAttribute('aria-hidden', 'false');
        nameInput.focus();
    }

    function closeFormModal() {
        document.getElementById('ambience-form-overlay').classList.remove('open');
        document.getElementById('ambience-form-overlay').setAttribute('aria-hidden', 'true');
        editingProfileId = null;
    }

    function renderEmojiGrid(selected) {
        const grid = document.getElementById('ambience-emoji-grid');
        if (!grid) return;
        grid.innerHTML = '';
        EMOJIS.forEach(function (emoji) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = emoji;
            if (selected === emoji) btn.classList.add('selected');
            btn.addEventListener('click', function () {
                grid.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
                document.getElementById('ambience-icon-file').value = '';
                var pr = document.getElementById('ambience-icon-preview');
                if (pr) pr.innerHTML = '';
            });
            grid.appendChild(btn);
        });
    }

    function getSelectedEmoji() {
        const grid = document.getElementById('ambience-emoji-grid');
        const sel = grid && grid.querySelector('button.selected');
        return sel ? sel.textContent : null;
    }

    function saveProfileFromForm() {
        const nameInput = document.getElementById('ambience-form-name');
        const urlInput = document.getElementById('ambience-form-url');
        const folderSelect = document.getElementById('ambience-form-folder');
        const dmNotesInput = document.getElementById('ambience-form-dm-notes');
        const name = (nameInput && nameInput.value || '').trim();
        const url = (urlInput && urlInput.value || '').trim();
        const folderId = (folderSelect && folderSelect.value) || '';
        const dmNotes = (dmNotesInput && dmNotesInput.value || '').trim() || null;
        const errEl = document.getElementById('ambience-form-url-error');
        if (!name) {
            nameInput.focus();
            return;
        }
        if (!isValidYouTubeUrl(url)) {
            if (errEl) {
                errEl.textContent = 'Enter a valid YouTube URL (youtube.com/watch or youtu.be)';
                errEl.classList.remove('hidden');
            }
            urlInput.focus();
            return;
        }
        if (errEl) errEl.classList.add('hidden');

        const emoji = getSelectedEmoji();
        const fileInput = document.getElementById('ambience-icon-file');
        let icon = emoji || null;
        if (fileInput && fileInput.files && fileInput.files[0]) {
            var reader = new FileReader();
            reader.onload = function () {
                var dataUrl = reader.result;
                if (dataUrl.length > MAX_ICON_BYTES) {
                    if (errEl) {
                        errEl.textContent = 'Image too large; use a smaller image (under ~80KB).';
                        errEl.classList.remove('hidden');
                    }
                    return;
                }
                finishSave(dataUrl);
            };
            reader.readAsDataURL(fileInput.files[0]);
            return;
        }
        finishSave(icon);

        var loopEl = document.getElementById('ambience-form-loop');
        var loop = loopEl && loopEl.checked === true;
        function finishSave(iconValue) {
            if (editingProfileId) {
                const p = state.profiles.find(function (x) { return x.id === editingProfileId; });
                if (p) {
                    p.name = name;
                    p.url = url;
                    p.folderId = folderId || null;
                    p.icon = iconValue;
                    p.loop = loop;
                    p.dmNotes = dmNotes;
                }
            } else {
                state.profiles.push({
                    id: generateId(),
                    folderId: folderId || null,
                    order: getNextOrder(),
                    name: name,
                    url: url,
                    icon: iconValue,
                    starred: false,
                    loop: loop,
                    dmNotes: dmNotes
                });
            }
        saveState(state);
        closeFormModal();
        renderCards();
        }
    }

    function openSettingsModal() {
        const playback = (state.settings && state.settings.playbackMode) || 'newTab';
        const newTabRadio = document.getElementById('playback-newTab');
        const embedRadio = document.getElementById('playback-embed');
        if (newTabRadio) newTabRadio.checked = playback === 'newTab';
        if (embedRadio) embedRadio.checked = playback === 'embed';
        const startFromBeginning = state.settings && state.settings.startFromBeginning !== false;
        const startEl = document.getElementById('setting-start-from-beginning');
        if (startEl) startEl.checked = startFromBeginning;
        const floatingPlayer = state.settings && state.settings.floatingPlayer === true;
        const floatingEl = document.getElementById('setting-floating-player');
        if (floatingEl) floatingEl.checked = floatingPlayer;
        const audioOnly = state.settings && state.settings.audioOnly === true;
        const audioOnlyEl = document.getElementById('setting-audio-only');
        if (audioOnlyEl) audioOnlyEl.checked = audioOnly;
        const alwaysCollapseLayers = state.settings && state.settings.alwaysCollapseLayers === true;
        const alwaysCollapseEl = document.getElementById('setting-always-collapse-layers');
        if (alwaysCollapseEl) alwaysCollapseEl.checked = alwaysCollapseLayers;
        const colors = (state.settings && state.settings.customColors) || {};
        const primary = colors['--primary-color'] || '#1a472a';
        const accent = colors['--accent-color'] || '#d4af37';
        const card = colors['--card-bg'] || '#f8f9fa';
        document.getElementById('setting-primary').value = primary;
        document.getElementById('setting-primary-hex').value = primary;
        document.getElementById('setting-accent').value = accent;
        document.getElementById('setting-accent-hex').value = accent;
        document.getElementById('setting-card').value = card;
        document.getElementById('setting-card-hex').value = card;
        const perRow = Math.min(4, Math.max(1, parseInt((state.settings && state.settings.cardsPerRow) || 1, 10) || 1));
        const cardSize = (state.settings && state.settings.cardSize) || 'medium';
        const playerSlotsPerRow = Math.min(3, Math.max(1, parseInt((state.settings && state.settings.playerSlotsPerRow) || 3, 10) || 3));
        const perRowEl = document.getElementById('setting-cards-per-row');
        const sizeEl = document.getElementById('setting-card-size');
        const playerSlotsEl = document.getElementById('setting-player-slots-per-row');
        if (perRowEl) perRowEl.value = String(perRow);
        if (sizeEl) sizeEl.value = ['small', 'medium', 'large'].includes(cardSize) ? cardSize : 'medium';
        if (playerSlotsEl) playerSlotsEl.value = String(playerSlotsPerRow);
        renderFoldersList();
        renderPlaylistsList();
        document.getElementById('ambience-settings-overlay').classList.add('open');
        document.getElementById('ambience-settings-overlay').setAttribute('aria-hidden', 'false');
    }

    function closeSettingsModal() {
        state.settings = state.settings || {};
        state.settings.playbackMode = document.getElementById('playback-newTab').checked ? 'newTab' : 'embed';
        const startEl = document.getElementById('setting-start-from-beginning');
        if (startEl) state.settings.startFromBeginning = startEl.checked;
        const floatingEl = document.getElementById('setting-floating-player');
        if (floatingEl) state.settings.floatingPlayer = floatingEl.checked;
        const audioOnlyEl = document.getElementById('setting-audio-only');
        if (audioOnlyEl) state.settings.audioOnly = audioOnlyEl.checked;
        const alwaysCollapseEl = document.getElementById('setting-always-collapse-layers');
        if (alwaysCollapseEl) state.settings.alwaysCollapseLayers = alwaysCollapseEl.checked;
        const perRowEl = document.getElementById('setting-cards-per-row');
        const sizeEl = document.getElementById('setting-card-size');
        if (perRowEl) {
            const n = parseInt(perRowEl.value, 10);
            state.settings.cardsPerRow = (n >= 1 && n <= 4) ? n : 1;
        }
        if (sizeEl) {
            const s = sizeEl.value;
            state.settings.cardSize = ['small', 'medium', 'large'].includes(s) ? s : 'medium';
        }
        const playerSlotsEl = document.getElementById('setting-player-slots-per-row');
        if (playerSlotsEl) {
            const n = parseInt(playerSlotsEl.value, 10);
            state.settings.playerSlotsPerRow = (n >= 1 && n <= 3) ? n : 3;
        }
        const primary = document.getElementById('setting-primary-hex').value.trim();
        const accent = document.getElementById('setting-accent-hex').value.trim();
        const card = document.getElementById('setting-card-hex').value.trim();
        const hex = /^#[0-9A-Fa-f]{6}$/;
        if (hex.test(primary) || hex.test(accent) || hex.test(card)) {
            state.settings.customColors = {};
            if (hex.test(primary)) state.settings.customColors['--primary-color'] = primary;
            if (hex.test(accent)) state.settings.customColors['--accent-color'] = accent;
            if (hex.test(card)) state.settings.customColors['--card-bg'] = card;
            applyCustomColors(state.settings.customColors);
        }
        saveState(state);
        applyGridLayout();
        applyEmbedLayout();
        applyPlayerSlotsPerRow();
        var alwaysCollapse = state.settings && state.settings.alwaysCollapseLayers === true;
        document.querySelectorAll('.embed-slot').forEach(function (slotEl) {
            if (alwaysCollapse) slotEl.classList.add('collapsed');
            else slotEl.classList.remove('collapsed');
        });
        document.getElementById('ambience-settings-overlay').classList.remove('open');
        document.getElementById('ambience-settings-overlay').setAttribute('aria-hidden', 'true');
    }

    function getNextSlotId() {
        var layers = state.embedSlots && state.embedSlots.layers ? state.embedSlots.layers : [];
        var max = -1;
        layers.forEach(function (l) {
            var n = parseInt(String(l.id).replace(/^layer-/, ''), 10);
            if (!isNaN(n) && n > max) max = n;
        });
        return 'layer-' + (max + 1);
    }

    function addLayer(profile, type) {
        state.embedSlots = state.embedSlots || { layers: [] };
        if (!state.embedSlots.layers) state.embedSlots.layers = [];
        if (state.embedSlots.layers.length >= MAX_EMBED_LAYERS) return;
        var url = profile.url;
        if (!url) return;
        var loop = profile.loop === true;
        var autoplay = type !== 'sfx';
        var embedUrl = getEmbedUrl(url, { loop: loop, autoplay: autoplay });
        if (!embedUrl) return;
        loadYouTubeAPI();
        var slotId = getNextSlotId();
        state.embedSlots.layers.push({
            id: slotId,
            type: type,
            profileId: profile.id,
            name: profile.name || 'Unnamed',
            embedUrl: embedUrl,
            loop: loop
        });
        saveState(state);
        appendSlot(state.embedSlots.layers[state.embedSlots.layers.length - 1], state.embedSlots.layers.length);
        var area = document.getElementById('ambience-embed-area');
        if (area) {
            applyEmbedLayout();
            area.classList.remove('hidden');
        }
    }

    function appendSlot(layer, oneBasedIndex) {
        var container = document.getElementById('ambience-embed-slots');
        if (!container || !layer) return;
        var n = oneBasedIndex;
        var typeLabel = layer.type === 'ambience' ? 'ambience' : 'sfx';
        var labelText = 'Layer ' + n + ' (' + typeLabel + ')';
        var slotId = layer.id;
        var slotEl = document.createElement('div');
        slotEl.className = 'embed-slot' + ((state.settings && state.settings.alwaysCollapseLayers) ? ' collapsed' : '');
        slotEl.id = 'embed-slot-' + slotId;
        slotEl.dataset.slot = slotId;
        slotEl.innerHTML =
            '<div class="embed-slot-header">' +
            '<span class="embed-slot-label" data-slot="' + slotId + '" tabindex="0" role="button">' + (layer.name || labelText) + '</span>' +
            '<label class="embed-slot-volume-wrap"><span class="sr-only">Volume ' + labelText + '</span>' +
            '<input type="range" class="embed-slot-volume" data-slot="' + slotId + '" min="0" max="100" value="100" aria-label="Volume ' + labelText + '">' +
            '</label>' +
            '<button type="button" class="ambience-btn small embed-slot-play-pause" data-slot="' + slotId + '" aria-label="Pause">&#9208;</button>' +
            '<button type="button" class="ambience-btn small embed-slot-close" data-slot="' + slotId + '" aria-label="Stop ' + labelText + '">&#10005;</button>' +
            '</div>' +
            '<div class="embed-slot-wrapper">' +
            '<iframe class="embed-slot-frame" data-slot="' + slotId + '" title="YouTube ' + labelText + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>' +
            '</div>';
        container.appendChild(slotEl);
        var frame = slotEl.querySelector('.embed-slot-frame');
        var labelEl = slotEl.querySelector('.embed-slot-label');
        if (labelEl) labelEl.textContent = layer.name || labelText;
        frame.onload = function () {
            attachYTPlayerWhenReady(frame, slotId, slotEl);
        };
        frame.src = layer.embedUrl;
    }

    function removeLayer(slotId) {
        state.embedSlots = state.embedSlots || { layers: [] };
        var layers = state.embedSlots.layers || [];
        var idx = -1;
        for (var i = 0; i < layers.length; i++) {
            if (layers[i].id === slotId) { idx = i; break; }
        }
        if (idx === -1) return;
        var layer = layers[idx];
        if (layer.player && typeof layer.player.destroy === 'function') {
            try { layer.player.destroy(); } catch (_) {}
        }
        var slotEl = document.getElementById('embed-slot-' + slotId);
        if (slotEl) slotEl.remove();
        state.embedSlots.layers.splice(idx, 1);
        saveState(state);
        var container = document.getElementById('ambience-embed-slots');
        if (container && state.embedSlots.layers.length > 0) {
            state.embedSlots.layers.forEach(function (l, i) {
                var el = document.getElementById('embed-slot-' + l.id);
                if (el) {
                    var lbl = el.querySelector('.embed-slot-label');
                    var typeLabel = l.type === 'ambience' ? 'ambience' : 'sfx';
                    if (lbl) lbl.textContent = l.name || ('Layer ' + (i + 1) + ' (' + typeLabel + ')');
                }
            });
        }
        var area = document.getElementById('ambience-embed-area');
        if (area && (!state.embedSlots.layers || state.embedSlots.layers.length === 0)) {
            area.classList.add('hidden');
        }
    }

    function clearAllSlots() {
        state.embedSlots = state.embedSlots || { layers: [] };
        var layers = state.embedSlots.layers || [];
        layers.forEach(function (layer) {
            if (layer.player && typeof layer.player.destroy === 'function') {
                try { layer.player.destroy(); } catch (_) {}
            }
        });
        state.embedSlots.layers = [];
        saveState(state);
        var container = document.getElementById('ambience-embed-slots');
        if (container) container.innerHTML = '';
        var area = document.getElementById('ambience-embed-area');
        if (area) area.classList.add('hidden');
    }

    function renderEmbedSlots() {
        var container = document.getElementById('ambience-embed-slots');
        if (!container) return;
        var layers = state.embedSlots && state.embedSlots.layers ? state.embedSlots.layers : [];
        container.innerHTML = '';
        layers.forEach(function (layer, index) {
            var n = index + 1;
            var typeLabel = layer.type === 'ambience' ? 'ambience' : 'sfx';
            var labelText = 'Layer ' + n + ' (' + typeLabel + ')';
            var slotId = layer.id;
            var slotEl = document.createElement('div');
            slotEl.className = 'embed-slot' + ((state.settings && state.settings.alwaysCollapseLayers) ? ' collapsed' : '');
            slotEl.id = 'embed-slot-' + slotId;
            slotEl.dataset.slot = slotId;
            slotEl.innerHTML =
                '<div class="embed-slot-header">' +
                '<span class="embed-slot-label" data-slot="' + slotId + '" tabindex="0" role="button">' + (layer.name || labelText) + '</span>' +
                '<label class="embed-slot-volume-wrap"><span class="sr-only">Volume ' + labelText + '</span>' +
                '<input type="range" class="embed-slot-volume" data-slot="' + slotId + '" min="0" max="100" value="100" aria-label="Volume ' + labelText + '">' +
                '</label>' +
                '<button type="button" class="ambience-btn small embed-slot-play-pause" data-slot="' + slotId + '" aria-label="Pause">&#9208;</button>' +
                '<button type="button" class="ambience-btn small embed-slot-close" data-slot="' + slotId + '" aria-label="Stop ' + labelText + '">&#10005;</button>' +
                '</div>' +
                '<div class="embed-slot-wrapper">' +
                '<iframe class="embed-slot-frame" data-slot="' + slotId + '" title="YouTube ' + labelText + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>' +
                '</div>';
            container.appendChild(slotEl);
            var frame = slotEl.querySelector('.embed-slot-frame');
            var labelEl = slotEl.querySelector('.embed-slot-label');
            if (labelEl) labelEl.textContent = layer.name || labelText;
            frame.onload = function () {
                attachYTPlayerWhenReady(frame, slotId, slotEl);
            };
            frame.src = layer.embedUrl;
        });
    }

    function applyEmbedLayout() {
        var area = document.getElementById('ambience-embed-area');
        if (!area) return;
        var mode = (state.settings && state.settings.playbackMode) || 'newTab';
        var floating = mode === 'embed' && (state.settings && state.settings.floatingPlayer === true);
        var minimized = (state.settings && state.settings.embedMinimized === true) && floating;
        var audioOnly = state.settings && state.settings.audioOnly === true;
        if (floating) area.classList.add('floating'); else area.classList.remove('floating');
        if (minimized) area.classList.add('minimized'); else area.classList.remove('minimized');
        if (audioOnly) area.classList.add('audio-only'); else area.classList.remove('audio-only');
        if (floating) {
            area.style.left = '';
            area.style.top = '';
            area.style.right = '';
            area.style.bottom = '';
        }
    }

    function applyPlayerSlotsPerRow() {
        var container = document.getElementById('ambience-embed-slots');
        if (!container) return;
        var n = Math.min(3, Math.max(1, parseInt((state.settings && state.settings.playerSlotsPerRow) || 3, 10) || 3));
        container.classList.remove('player-slots-per-row-1', 'player-slots-per-row-2', 'player-slots-per-row-3');
        container.classList.add('player-slots-per-row-' + n);
    }

    function bindFloatingEmbedDrag() {
        var area = document.getElementById('ambience-embed-area');
        var handle = document.getElementById('ambience-embed-drag-handle');
        if (!area || !handle) return;
        var dragging = false;
        var startX, startY, startLeft, startTop;
        function onMouseDown(e) {
            if (!area.classList.contains('floating')) return;
            if (e.target.closest('.embed-header-actions')) return;
            e.preventDefault();
            var rect = area.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            startX = e.clientX;
            startY = e.clientY;
            dragging = true;
            area.style.right = '';
            area.style.bottom = '';
            area.style.left = startLeft + 'px';
            area.style.top = startTop + 'px';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
        function onMouseMove(e) {
            if (!dragging) return;
            var dx = e.clientX - startX;
            var dy = e.clientY - startY;
            area.style.left = (startLeft + dx) + 'px';
            area.style.top = (startTop + dy) + 'px';
        }
        function onMouseUp() {
            dragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        handle.addEventListener('mousedown', onMouseDown);
    }

    function renderFoldersList() {
        const ul = document.getElementById('ambience-folders-list');
        if (!ul) return;
        ul.innerHTML = '';
        state.folders.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (f) {
            const li = document.createElement('li');
            const input = document.createElement('input');
            input.type = 'text';
            input.value = f.name;
            input.setAttribute('aria-label', 'Folder name');
            input.addEventListener('change', function () {
                f.name = input.value.trim() || f.name;
                saveState(state);
                renderFolderFilter();
                renderCards();
            });
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ambience-btn secondary folder-item-remove';
            btn.textContent = 'Remove';
            btn.addEventListener('click', function () {
                state.profiles.forEach(function (p) { if (p.folderId === f.id) p.folderId = null; });
                state.folders = state.folders.filter(function (x) { return x.id !== f.id; });
                saveState(state);
                renderFolderFilter();
                renderFoldersInForm();
                renderCards();
                renderFoldersList();
            });
            li.appendChild(input);
            li.appendChild(btn);
            ul.appendChild(li);
        });
    }

    function addFolder() {
        const name = prompt('Folder name');
        if (!name || !name.trim()) return;
        const maxOrder = state.folders.reduce(function (m, f) { return Math.max(m, f.order || 0); }, -1);
        state.folders.push({ id: generateId(), name: name.trim(), order: maxOrder + 1 });
        saveState(state);
        renderFolderFilter();
        renderFoldersInForm();
        renderFoldersList();
    }

    let playlistDropdownClose = null;

    function openPlaylistDropdown(anchor, profileId) {
        var existing = document.getElementById('ambience-playlist-dropdown');
        if (existing) existing.remove();
        if (state.playlists.length === 0) {
            if (typeof alert === 'function') alert('No playlists yet. Create one in Settings.');
            return;
        }
        var pop = document.createElement('div');
        pop.id = 'ambience-playlist-dropdown';
        pop.className = 'playlist-dropdown';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-label', 'Add to playlist');
        state.playlists.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (pl) {
            var inPl = Array.isArray(pl.profileIds) && pl.profileIds.indexOf(profileId) !== -1;
            var label = document.createElement('label');
            label.className = 'playlist-dropdown-item';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = inPl;
            cb.setAttribute('aria-label', 'In playlist ' + (pl.name || ''));
            cb.addEventListener('change', function () {
                pl.profileIds = pl.profileIds || [];
                if (cb.checked) {
                    if (pl.profileIds.indexOf(profileId) === -1) pl.profileIds.push(profileId);
                } else {
                    pl.profileIds = pl.profileIds.filter(function (id) { return id !== profileId; });
                }
                saveState(state);
            });
            label.appendChild(cb);
            label.appendChild(document.createTextNode(pl.name || 'Unnamed'));
            pop.appendChild(label);
        });
        document.body.appendChild(pop);
        var rect = anchor.getBoundingClientRect();
        pop.style.position = 'fixed';
        pop.style.left = rect.left + 'px';
        pop.style.top = (rect.bottom + 4) + 'px';
        pop.style.zIndex = '1001';
        function outsideClick(ev) {
            if (pop.contains(ev.target) || anchor === ev.target || anchor.contains(ev.target)) return;
            close();
        }
        function close() {
            var el = document.getElementById('ambience-playlist-dropdown');
            if (el) el.remove();
            document.removeEventListener('click', outsideClick);
            document.removeEventListener('keydown', onKey);
            playlistDropdownClose = null;
        }
        function onKey(e) {
            if (e.key === 'Escape') close();
        }
        playlistDropdownClose = close;
        setTimeout(function () { document.addEventListener('click', outsideClick); }, 0);
        document.addEventListener('keydown', onKey);
    }

    function renderPlaylistsList() {
        const ul = document.getElementById('ambience-playlists-list');
        if (!ul) return;
        ul.innerHTML = '';
        state.playlists.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (pl) {
            const li = document.createElement('li');
            const input = document.createElement('input');
            input.type = 'text';
            input.value = pl.name;
            input.setAttribute('aria-label', 'Playlist name');
            input.addEventListener('change', function () {
                pl.name = input.value.trim() || pl.name;
                saveState(state);
                renderFolderFilter();
            });
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ambience-btn secondary folder-item-remove';
            btn.textContent = 'Remove';
            btn.addEventListener('click', function () {
                state.playlists = state.playlists.filter(function (x) { return x.id !== pl.id; });
                saveState(state);
                renderFolderFilter();
                renderPlaylistsList();
            });
            li.appendChild(input);
            li.appendChild(btn);
            ul.appendChild(li);
        });
    }

    function addPlaylist() {
        const name = prompt('Playlist name');
        if (!name || !name.trim()) return;
        const maxOrder = state.playlists.reduce(function (m, pl) { return Math.max(m, pl.order || 0); }, -1);
        state.playlists.push({ id: generateId(), name: name.trim(), order: maxOrder + 1, profileIds: [] });
        saveState(state);
        renderFolderFilter();
        renderPlaylistsList();
    }

    function exportData() {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'songbook-backup.json';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function importData(mode) {
        if (!pendingImportData) return;
        if (mode === 'replace') {
            state = pendingImportData;
            state.version = SCHEMA_VERSION;
            state.folders = state.folders || [];
            state.profiles = state.profiles || [];
            state.playlists = Array.isArray(state.playlists) ? state.playlists : [];
            state.groups = Array.isArray(state.groups) ? state.groups : [];
            state.settings = state.settings || defaultState().settings;
        } else {
            const existingIds = {};
            state.profiles.forEach(function (p) { existingIds[p.id] = true; });
            (pendingImportData.profiles || []).forEach(function (p) {
                if (!existingIds[p.id]) {
                    p.id = p.id || generateId();
                    state.profiles.push(p);
                    existingIds[p.id] = true;
                }
            });
            (pendingImportData.folders || []).forEach(function (f) {
                if (!state.folders.some(function (x) { return x.id === f.id; })) {
                    state.folders.push({ id: f.id || generateId(), name: f.name, order: f.order != null ? f.order : state.folders.length });
                }
            });
            if (pendingImportData.settings && pendingImportData.settings.playbackMode) {
                state.settings.playbackMode = pendingImportData.settings.playbackMode;
            }
            if (pendingImportData.settings && pendingImportData.settings.customColors) {
                state.settings.customColors = pendingImportData.settings.customColors;
            }
            (pendingImportData.playlists || []).forEach(function (pl) {
                if (!state.playlists.some(function (x) { return x.id === pl.id; })) {
                    state.playlists.push({
                        id: pl.id || generateId(),
                        name: pl.name || 'Playlist',
                        order: pl.order != null ? pl.order : state.playlists.length,
                        profileIds: Array.isArray(pl.profileIds) ? pl.profileIds.slice() : []
                    });
                }
            });
        }
        pendingImportData = null;
        state.profiles.forEach(function (p) { p.starred = p.starred === true; });
        saveState(state);
        applyCustomColors(state.settings.customColors || {});
        renderFolderFilter();
        renderFoldersInForm();
        renderCards();
        document.getElementById('ambience-import-choice-overlay').classList.remove('open');
        document.getElementById('ambience-import-choice-overlay').setAttribute('aria-hidden', 'true');
    }

    function bindEvents() {
        document.getElementById('ambience-add-new-card').addEventListener('click', function () { openFormModal(null); });
        document.getElementById('ambience-settings-btn').addEventListener('click', openSettingsModal);
        document.getElementById('ambience-settings-close').addEventListener('click', closeSettingsModal);
        document.getElementById('ambience-form').addEventListener('submit', function (e) { e.preventDefault(); saveProfileFromForm(); });
        document.getElementById('ambience-form-cancel').addEventListener('click', closeFormModal);
        document.getElementById('ambience-export-btn').addEventListener('click', exportData);
        document.getElementById('ambience-import-btn').addEventListener('click', function () { document.getElementById('ambience-import-file').click(); });
        document.getElementById('ambience-import-file').addEventListener('change', function () {
            const file = this.files && this.files[0];
            this.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function () {
                try {
                    const data = JSON.parse(reader.result);
                    if (!data || !Array.isArray(data.profiles)) {
                        alert('Invalid backup file.');
                        return;
                    }
                    pendingImportData = data;
                    document.getElementById('ambience-import-choice-overlay').classList.add('open');
                    document.getElementById('ambience-import-choice-overlay').setAttribute('aria-hidden', 'false');
                } catch (_) {
                    alert('Could not parse file.');
                }
            };
            reader.readAsText(file);
        });
        document.getElementById('ambience-preset-select').addEventListener('change', function () {
            const presetKey = this.value;
            this.value = '';
            if (!presetKey) return;
            function applyPreset(data) {
                if (!data || !Array.isArray(data.profiles)) {
                    alert('Invalid preset.');
                    return;
                }
                pendingImportData = data;
                document.getElementById('ambience-import-choice-overlay').classList.add('open');
                document.getElementById('ambience-import-choice-overlay').setAttribute('aria-hidden', 'false');
            }
            if (window.AMBIENCE_PRESETS && window.AMBIENCE_PRESETS[presetKey]) {
                applyPreset(window.AMBIENCE_PRESETS[presetKey]);
                return;
            }
            var presetUrls = { 'Bardify Music': 'Bardify-music.json', 'Sword Coast Soundscapes': 'Sword Coast Soundscapes-music.json' };
            var url = presetUrls[presetKey];
            if (!url) { alert('Unknown preset.'); return; }
            fetch(new URL(url, window.location.href).href).then(function (r) {
                if (!r.ok) throw new Error(r.statusText);
                return r.json();
            }).then(applyPreset).catch(function () {
                alert('Could not load preset from server. Use Import file to select the JSON file.');
            });
        });
        document.getElementById('ambience-import-replace').addEventListener('click', function () { importData('replace'); });
        document.getElementById('ambience-import-merge').addEventListener('click', function () { importData('merge'); });
        document.getElementById('ambience-import-cancel').addEventListener('click', function () {
            pendingImportData = null;
            document.getElementById('ambience-import-choice-overlay').classList.remove('open');
            document.getElementById('ambience-import-choice-overlay').setAttribute('aria-hidden', 'true');
        });
        document.getElementById('ambience-folder-filter').addEventListener('change', function () {
            filterFolderId = this.value || '';
            renderCards();
        });
        var sortEl = document.getElementById('ambience-sort');
        if (sortEl) {
            sortEl.value = (state.settings && state.settings.cardSort) || 'manual';
            sortEl.addEventListener('change', function () {
                state.settings = state.settings || {};
                state.settings.cardSort = this.value || 'manual';
                saveState(state);
                renderCards();
            });
        }
        document.getElementById('ambience-add-folder-btn').addEventListener('click', addFolder);
        document.getElementById('ambience-add-folder-settings').addEventListener('click', addFolder);
        var foldersSection = document.getElementById('ambience-folders-settings');
        var foldersToggle = document.getElementById('ambience-folders-toggle');
        if (foldersSection && foldersToggle) {
            function toggleFoldersSection() {
                var collapsed = foldersSection.classList.toggle('collapsed');
                foldersToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            }
            foldersToggle.addEventListener('click', toggleFoldersSection);
            foldersToggle.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleFoldersSection();
                }
            });
        }
        document.getElementById('ambience-add-playlist-settings').addEventListener('click', addPlaylist);
        document.getElementById('ambience-reset-colors').addEventListener('click', function () {
            state.settings.customColors = null;
            clearCustomColors();
            saveState(state);
            var primary = '#1a472a';
            var accent = '#d4af37';
            var card = '#f8f9fa';
            document.getElementById('setting-primary').value = primary;
            document.getElementById('setting-primary-hex').value = primary;
            document.getElementById('setting-accent').value = accent;
            document.getElementById('setting-accent-hex').value = accent;
            document.getElementById('setting-card').value = card;
            document.getElementById('setting-card-hex').value = card;
        });
        document.getElementById('ambience-embed-minimize').addEventListener('click', function (e) {
            e.stopPropagation();
            state.settings = state.settings || {};
            state.settings.embedMinimized = !state.settings.embedMinimized;
            saveState(state);
            applyEmbedLayout();
        });
        document.getElementById('ambience-embed-close').addEventListener('click', clearAllSlots);
        var embedTitleEl = document.getElementById('ambience-embed-title');
        if (embedTitleEl) {
            function toggleAllSlots() {
                var container = document.getElementById('ambience-embed-slots');
                if (!container) return;
                var slots = container.querySelectorAll('.embed-slot');
                var allCollapsed = slots.length > 0 && Array.prototype.every.call(slots, function (el) { return el.classList.contains('collapsed'); });
                slots.forEach(function (slotEl) {
                    if (allCollapsed) slotEl.classList.remove('collapsed');
                    else slotEl.classList.add('collapsed');
                });
            }
            embedTitleEl.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleAllSlots();
            });
            embedTitleEl.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleAllSlots();
                }
            });
        }
        var embedSlotsEl = document.getElementById('ambience-embed-slots');
        if (embedSlotsEl) {
            embedSlotsEl.addEventListener('click', function (e) {
                var closeBtn = e.target.closest('.embed-slot-close');
                if (closeBtn) {
                    var slotId = closeBtn.getAttribute('data-slot');
                    if (slotId) removeLayer(slotId);
                    return;
                }
                var playBtn = e.target.closest('.embed-slot-play-pause');
                if (playBtn) {
                    e.stopPropagation();
                    var slotId = playBtn.getAttribute('data-slot');
                    var layer = slotId ? getLayerBySlotId(slotId) : null;
                    if (!layer || !layer.player) return;
                    try {
                        if (typeof layer.player.getPlayerState !== 'function') return;
                        var stateCode = layer.player.getPlayerState();
                        if (stateCode === 1) layer.player.pauseVideo(); else layer.player.playVideo();
                    } catch (err) {
                        console.warn('Play/pause failed for slot ' + slotId, err);
                    }
                }
            });
            embedSlotsEl.addEventListener('click', function (e) {
                var label = e.target.closest('.embed-slot-label[data-slot]');
                if (label) {
                    e.preventDefault();
                    var slotId = label.getAttribute('data-slot');
                    var slotEl = document.getElementById('embed-slot-' + slotId);
                    if (slotEl) slotEl.classList.toggle('collapsed');
                }
            });
            embedSlotsEl.addEventListener('keydown', function (e) {
                var label = e.target.closest('.embed-slot-label[data-slot]');
                if (label && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    var slotId = label.getAttribute('data-slot');
                    var slotEl = document.getElementById('embed-slot-' + slotId);
                    if (slotEl) slotEl.classList.toggle('collapsed');
                }
            });
            embedSlotsEl.addEventListener('input', function (e) {
                var input = e.target.closest('.embed-slot-volume');
                if (!input) return;
                var slotId = input.getAttribute('data-slot');
                var layer = slotId ? getLayerBySlotId(slotId) : null;
                if (!layer || !layer.player) return;
                try {
                    if (typeof layer.player.setVolume === 'function') {
                        layer.player.setVolume(parseInt(input.value, 10) || 0);
                    }
                } catch (err) {
                    console.warn('Volume failed for slot ' + slotId, err);
                }
            });
        }
        bindFloatingEmbedDrag();
        document.getElementById('ambience-icon-file').addEventListener('change', function () {
            var grid = document.getElementById('ambience-emoji-grid');
            if (grid) grid.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
            var pr = document.getElementById('ambience-icon-preview');
            if (!pr || !this.files || !this.files[0]) return;
            pr.innerHTML = 'Selected: ' + this.files[0].name;
        });

        ['setting-primary', 'setting-accent', 'setting-card'].forEach(function (id, i) {
            var colorEl = document.getElementById(id);
            var hexId = id + '-hex';
            var hexEl = document.getElementById(hexId);
            if (!colorEl || !hexEl) return;
            colorEl.addEventListener('input', function () { hexEl.value = this.value; });
            hexEl.addEventListener('input', function () {
                if (/^#[0-9A-Fa-f]{6}$/.test(this.value)) colorEl.value = this.value;
            });
        });

        document.getElementById('ambience-form-overlay').addEventListener('click', function (e) {
            if (e.target === this) closeFormModal();
        });
        document.getElementById('ambience-settings-overlay').addEventListener('click', function (e) {
            if (e.target === this) closeSettingsModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (document.getElementById('ambience-form-overlay').classList.contains('open')) closeFormModal();
            else if (document.getElementById('ambience-settings-overlay').classList.contains('open')) closeSettingsModal();
            else if (document.getElementById('ambience-import-choice-overlay').classList.contains('open')) {
                pendingImportData = null;
                document.getElementById('ambience-import-choice-overlay').classList.remove('open');
            }
        });
    }

    function init() {
        loadYouTubeAPI();
        if (state.settings && state.settings.customColors) {
            applyCustomColors(state.settings.customColors);
        }
        applyGridLayout();
        applyEmbedLayout();
        applyPlayerSlotsPerRow();
        renderEmbedSlots();
        var area = document.getElementById('ambience-embed-area');
        var layers = state.embedSlots && state.embedSlots.layers ? state.embedSlots.layers : [];
        if (area) {
            if (layers.length === 0) area.classList.add('hidden');
            else area.classList.remove('hidden');
        }
        renderFolderFilter();
        var sortEl = document.getElementById('ambience-sort');
        if (sortEl) sortEl.value = (state.settings && state.settings.cardSort) || 'manual';
        renderFoldersInForm();
        renderCards();
        bindEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
