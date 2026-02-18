(function () {
    'use strict';

    const API_BASE = '';

    function api(path) {
        return (API_BASE + path).replace(/\/+/g, '/');
    }

    async function getMaps() {
        const r = await fetch(api('/api/maps'));
        if (!r.ok) throw new Error('Failed to load maps');
        return r.json();
    }

    async function getMapMeta(id) {
        const r = await fetch(api('/api/maps/' + encodeURIComponent(id)));
        if (!r.ok) throw new Error('Map not found');
        return r.json();
    }

    async function getMarkers(id) {
        const r = await fetch(api('/api/maps/' + encodeURIComponent(id) + '/markers'));
        if (!r.ok) return [];
        return r.json();
    }

    async function putMarkers(id, markers) {
        const r = await fetch(api('/api/maps/' + encodeURIComponent(id) + '/markers'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markers }),
        });
        if (!r.ok) throw new Error('Failed to save markers');
        return r.json();
    }

    async function deleteMap(id) {
        const r = await fetch(api('/api/maps/' + encodeURIComponent(id)), { method: 'DELETE' });
        if (!r.ok) throw new Error('Failed to delete map');
        return r.json();
    }

    const mapsList = document.getElementById('maps-list');
    const markersSection = document.getElementById('markers-section');
    const markersPrompt = document.getElementById('markers-prompt');
    const markersList = document.getElementById('markers-list');
    const selectedMapName = document.getElementById('selected-map-name');
    const markersUl = document.getElementById('markers-ul');
    const clearAllBtn = document.getElementById('clear-all-markers');

    let selectedMapId = null;
    let currentMarkers = [];

    function escapeHtml(s) {
        if (s == null || s === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(s);
        return div.innerHTML;
    }

    function renderMaps(maps) {
        if (!maps.length) {
            mapsList.innerHTML = '<p class="admin-hint">No maps yet. Upload one in the <a href="tools/interactive-map/">Interactive Map</a>.</p>';
            return;
        }
        mapsList.innerHTML = maps.map((m) => {
            const isSelected = m.id === selectedMapId;
            return (
                '<div class="map-row' + (isSelected ? ' selected' : '') + '" data-map-id="' + escapeHtml(m.id) + '">' +
                '<div class="map-info">' +
                '<span class="map-name">' + escapeHtml(m.name) + '</span>' +
                '<span class="map-id">' + escapeHtml(m.id) + '</span>' +
                '</div>' +
                '<div class="map-actions">' +
                '<button type="button" class="admin-btn admin-btn-select map-select-btn">Select</button>' +
                '<button type="button" class="admin-btn admin-btn-danger map-delete-btn">Delete map</button>' +
                '</div>' +
                '</div>'
            );
        }).join('');

        mapsList.querySelectorAll('.map-row').forEach((row) => {
            const id = row.dataset.mapId;
            row.querySelector('.map-select-btn').addEventListener('click', () => selectMap(id));
            row.querySelector('.map-delete-btn').addEventListener('click', () => confirmDeleteMap(id));
        });
    }

    async function selectMap(id) {
        selectedMapId = id;
        const maps = await getMaps();
        renderMaps(maps);
        const meta = await getMapMeta(id);
        selectedMapName.textContent = meta.name;
        markersPrompt.classList.add('hidden');
        markersList.classList.remove('hidden');
        await loadMarkers();
    }

    async function loadMarkers() {
        if (!selectedMapId) return;
        currentMarkers = await getMarkers(selectedMapId);
        renderMarkers();
    }

    function renderMarkers() {
        markersUl.innerHTML = '';
        if (!currentMarkers.length) {
            markersUl.innerHTML = '<li class="marker-row"><span class="marker-meta">No markers on this map.</span></li>';
            return;
        }
        currentMarkers.forEach((m, i) => {
            const li = document.createElement('li');
            li.className = 'marker-row';
            li.innerHTML =
                '<div class="marker-info">' +
                '<span class="marker-name">' + escapeHtml(m.name || 'Unnamed') + '</span>' +
                '<span class="marker-meta">' + escapeHtml(m.type || 'miscellaneous') + ' @ (' + Number(m.lat).toFixed(1) + ', ' + Number(m.lng).toFixed(1) + ')</span>' +
                '</div>' +
                '<button type="button" class="admin-btn admin-btn-danger marker-delete-btn">Delete</button>';
            li.querySelector('.marker-delete-btn').addEventListener('click', () => deleteMarker(i));
            markersUl.appendChild(li);
        });
    }

    async function deleteMarker(index) {
        if (!selectedMapId) return;
        currentMarkers.splice(index, 1);
        await putMarkers(selectedMapId, currentMarkers);
        renderMarkers();
    }

    async function confirmDeleteMap(id) {
        if (!confirm('Delete this map and all its markers? This cannot be undone.')) return;
        try {
            await deleteMap(id);
            if (selectedMapId === id) {
                selectedMapId = null;
                markersList.classList.add('hidden');
                markersPrompt.classList.remove('hidden');
                markersPrompt.textContent = 'Select a map above to view and manage its markers.';
            }
            const maps = await getMaps();
            renderMaps(maps);
        } catch (e) {
            alert(e.message || 'Failed to delete map.');
        }
    }

    clearAllBtn.addEventListener('click', async () => {
        if (!selectedMapId) return;
        if (!confirm('Remove all markers from this map?')) return;
        try {
            await putMarkers(selectedMapId, []);
            currentMarkers = [];
            renderMarkers();
        } catch (e) {
            alert(e.message || 'Failed to clear markers.');
        }
    });

    async function init() {
        try {
            const maps = await getMaps();
            renderMaps(maps);
        } catch (e) {
            mapsList.innerHTML = '<p class="admin-error">' + escapeHtml(e.message) + '</p>';
        }
    }

    init();
})();
