// Interactive Map – shared maps and markers via API. Leaflet + /api/maps.

(function () {
    'use strict';

    const LAST_MAP_KEY = 'interactive-map-last-map';
    const API_BASE = '';

    const TYPE_COLORS = {
        'city': '#2563eb',
        'inn': '#dc2626',
        'tavern': '#dc2626',
        'festhall': '#dc2626',
        'temple': '#eab308',
        'guildhall': '#16a34a',
        'business': '#9333ea',
        'warehouse': '#92400e',
        'noble': '#ea580c',
        'place': '#f8fafc',
        'street': '#f8fafc',
        'miscellaneous': '#6b7280'
    };

    const LEGEND_ENTRIES = [
        { key: 'city', label: 'City buildings' },
        { key: 'inn', label: 'Inns / Taverns / Festhalls' },
        { key: 'temple', label: 'Temples' },
        { key: 'guildhall', label: 'Guildhalls' },
        { key: 'business', label: 'Businesses' },
        { key: 'warehouse', label: 'Warehouses' },
        { key: 'noble', label: 'Noble villas' },
        { key: 'place', label: 'Places / Streets' },
        { key: 'miscellaneous', label: 'Miscellaneous' }
    ];

    let map = null;
    let imageOverlay = null;
    let markerLayer = null;
    let currentMapId = null;
    let pendingAddLatLng = null;
    let allMarkerLayers = [];
    let longPressTimer = null;

    const $ = (id) => document.getElementById(id);
    const mapSelect = $('wm-map-select');
    const searchInput = $('wm-search');
    const searchDropdown = $('wm-search-dropdown');
    const uploadZone = $('wm-upload-zone');
    const fileInput = $('wm-file-input');
    const mapContainer = $('wm-map-container');
    const detailContent = $('wm-detail-content');
    const legendList = $('wm-legend-list');
    const fab = $('wm-add-marker');
    const modal = $('wm-add-marker-modal');
    const addForm = $('wm-add-marker-form');
    const markerName = $('wm-marker-name');
    const markerComment = $('wm-marker-comment');
    const markerType = $('wm-marker-type');
    const markerImage = $('wm-marker-image');
    const markerImagePreview = $('wm-marker-image-preview');
    const markerImagePreviewImg = $('wm-marker-image-preview-img');
    const markerImageClear = $('wm-marker-image-clear');
    const modalCancel = $('wm-modal-cancel');
    let pendingMarkerImageDataUrl = null;

    function apiUrl(path) {
        return (API_BASE + path).replace(/\/+/g, '/');
    }

    function getMapList() {
        return fetch(apiUrl('/api/maps')).then((r) => {
            if (!r.ok) throw new Error('Failed to load maps');
            return r.json();
        });
    }

    function getMapMeta(id) {
        return fetch(apiUrl('/api/maps/' + encodeURIComponent(id))).then((r) => {
            if (!r.ok) throw new Error('Map not found');
            return r.json();
        });
    }

    function getMarkers(id) {
        return fetch(apiUrl('/api/maps/' + encodeURIComponent(id) + '/markers')).then((r) => {
            if (!r.ok) return [];
            return r.json();
        });
    }

    function putMarkers(id, markers) {
        return fetch(apiUrl('/api/maps/' + encodeURIComponent(id) + '/markers'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markers }),
        }).then(async (r) => {
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data.error || 'Failed to save markers');
            return data;
        });
    }

    function getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image'));
            };
            img.src = url;
        });
    }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => reject(r.error);
            r.readAsDataURL(file);
        });
    }

    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        getImageDimensions(file)
            .then(({ width, height }) =>
                fileToDataUrl(file).then((dataUrl) => ({ dataUrl, width, height, name: file.name }))
            )
            .then(({ dataUrl, width, height, name }) => {
                const displayName = name.replace(/\.[^.]+$/, '') || 'Untitled map';
                return fetch(apiUrl('/api/maps'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: displayName,
                        imageData: dataUrl,
                        bounds: { width, height },
                    }),
                }).then((res) => {
                    if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || 'Upload failed')));
                    return res.json();
                }).then((record) => ({ record, id: record.id }));
            })
            .then(({ record, id }) => {
                return refreshMapSelect().then(() => {
                    selectMapById(id);
                    showMapView(record);
                });
            })
            .catch((err) => {
                console.error('Upload failed', err);
                alert(err.message || 'Upload failed.');
            });
    }

    function refreshMapSelect() {
        return getMapList().then((maps) => {
            const current = mapSelect.value;
            mapSelect.innerHTML = '<option value="">— No map —</option>';
            maps.forEach((m) => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.name;
                mapSelect.appendChild(opt);
            });
            if (current && maps.some((m) => m.id === current)) mapSelect.value = current;
            return maps;
        }).catch((err) => {
            console.error('Failed to load map list', err);
            mapSelect.innerHTML = '<option value="">— No map —</option>';
            return [];
        });
    }

    function showMapView(record) {
        uploadZone.classList.add('hidden');
        mapContainer.setAttribute('aria-hidden', 'false');
        fab.classList.remove('wm-fab-hidden');

        const bounds = record.bounds;
        const southWest = L.latLng(0, 0);
        const northEast = L.latLng(bounds.height, bounds.width);
        const mapBounds = L.latLngBounds(southWest, northEast);

        if (!map) {
            map = L.map('wm-map-container', {
                crs: L.CRS.Simple,
                minZoom: -4,
                maxZoom: 4
            });
            map.fitBounds(mapBounds);
            map.on('contextmenu', onMapRightClick);
            map.getContainer().addEventListener('touchstart', onTouchStart, { passive: true });
            map.getContainer().addEventListener('touchend', onTouchEnd, { passive: true });
            map.getContainer().addEventListener('touchmove', onTouchMove, { passive: true });
        }

        if (imageOverlay) map.removeLayer(imageOverlay);
        imageOverlay = L.imageOverlay(record.imageUrl, mapBounds).addTo(map);
        map.fitBounds(mapBounds);

        currentMapId = record.id;
        localStorage.setItem(LAST_MAP_KEY, record.id);
        loadAndRenderMarkers();
        updateDetailPlaceholder('Click a marker.');
    }

    function showUploadView() {
        if (imageOverlay) {
            map.removeLayer(imageOverlay);
            imageOverlay = null;
        }
        clearMarkers();
        uploadZone.classList.remove('hidden');
        mapContainer.setAttribute('aria-hidden', 'true');
        fab.classList.add('wm-fab-hidden');
        currentMapId = null;
        updateDetailPlaceholder('Upload a map to get started.');
    }

    function selectMapById(id) {
        if (!id) {
            showUploadView();
            return;
        }
        getMapMeta(id).then((record) => {
            if (record) showMapView(record);
        }).catch((err) => {
            console.error('Failed to load map', err);
            updateDetailPlaceholder('Could not load map. It may have been removed.');
        });
    }

    function clearMarkers() {
        if (!markerLayer) return;
        map.removeLayer(markerLayer);
        markerLayer = null;
        allMarkerLayers = [];
    }

    function getColorForType(type) {
        const t = (type || 'miscellaneous').toLowerCase();
        return TYPE_COLORS[t] || TYPE_COLORS.miscellaneous;
    }

    function createMarkerLayer(markerData) {
        const color = getColorForType(markerData.type);
        const layer = L.circleMarker(L.latLng(markerData.lat, markerData.lng), {
            radius: 8,
            fillColor: color,
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.9
        });
        layer._markerData = markerData;
        const name = markerData.name || 'Unnamed';
        const desc = markerData.comment || markerData.description || '';
        layer.bindPopup(`<strong>${escapeHtml(name)}</strong><br>${escapeHtml(desc)}`, { maxWidth: 280 });
        layer.on('click', () => {
            updateDetailPanel(markerData);
        });
        return layer;
    }

    function escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function loadAndRenderMarkers() {
        clearMarkers();
        if (!map || !currentMapId) return;
        getMarkers(currentMapId).then((list) => {
            markerLayer = L.layerGroup();
            allMarkerLayers = [];
            (list || []).forEach((m) => {
                const layer = createMarkerLayer(m);
                markerLayer.addLayer(layer);
                allMarkerLayers.push({ layer, data: m });
            });
            markerLayer.addTo(map);
            applySearchFilter();
        }).catch((err) => {
            console.error('Failed to load markers', err);
        });
    }

    function matchesQuery(data, q) {
        if (!q) return true;
        return (data.name && data.name.toLowerCase().includes(q)) ||
            (data.type && data.type.toLowerCase().includes(q));
    }

    function getMatchingMarkers() {
        const q = (searchInput.value || '').trim().toLowerCase();
        if (!q) return [];
        return allMarkerLayers
            .filter(({ data }) => matchesQuery(data, q))
            .map(({ data }) => data);
    }

    function applySearchFilter() {
        const q = (searchInput.value || '').trim().toLowerCase();
        allMarkerLayers.forEach(({ layer, data }) => {
            const match = matchesQuery(data, q);
            layer.setStyle({ opacity: match ? 1 : 0.25, fillOpacity: match ? 0.9 : 0.2 });
        });
    }

    function showSearchDropdown() {
        const matches = getMatchingMarkers();
        if (matches.length === 0) {
            searchDropdown.classList.add('hidden');
            searchDropdown.innerHTML = '';
            return;
        }
        searchDropdown.innerHTML = matches.map((data) => {
            const name = escapeHtml(data.name || 'Unnamed');
            const type = escapeHtml(data.type || 'miscellaneous');
            return '<button type="button" class="wm-search-dropdown-item" role="option" data-lat="' + data.lat + '" data-lng="' + data.lng + '">' +
                '<span class="wm-search-dropdown-item-name">' + name + '</span>' +
                '<span class="wm-search-dropdown-item-type"> (' + type + ')</span>' +
                '</button>';
        }).join('');
        searchDropdown.classList.remove('hidden');
        searchDropdown.querySelectorAll('.wm-search-dropdown-item').forEach((btn) => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selectSearchResult(Number(btn.dataset.lat), Number(btn.dataset.lng));
            });
        });
    }

    function selectSearchResult(lat, lng) {
        const { data } = allMarkerLayers.find(({ data: d }) => d.lat === lat && d.lng === lng) || {};
        if (data) {
            updateDetailPanel(data);
            map.setView(L.latLng(lat, lng), map.getZoom(), { animate: true });
        }
        searchDropdown.classList.add('hidden');
        searchInput.blur();
    }

    function hideSearchDropdown() {
        setTimeout(() => searchDropdown.classList.add('hidden'), 150);
    }

    function updateDetailPlaceholder(text) {
        detailContent.innerHTML = '<p class="wm-detail-placeholder">' + escapeHtml(text) + '</p>';
    }

    function updateDetailPanel(data) {
        const name = data.name || 'Unnamed';
        const type = data.type || 'miscellaneous';
        const desc = (data.comment || data.description || '').trim();
        const imgHtml = data.imageUrl
            ? '<div class="wm-detail-image-wrap"><img class="wm-detail-image" src="' + escapeHtml(data.imageUrl) + '" alt="' + escapeHtml(name) + '"></div>'
            : '';
        detailContent.innerHTML =
            '<p class="wm-detail-name">' + escapeHtml(name) + '</p>' +
            '<p class="wm-detail-type">' + escapeHtml(type) + '</p>' +
            (desc ? '<div class="wm-detail-description">' + escapeHtml(desc) + '</div>' : '') +
            imgHtml;
    }

    function onMapRightClick(e) {
        if (!currentMapId) return;
        e.originalEvent.preventDefault();
        pendingAddLatLng = e.latlng;
        openAddMarkerModal();
    }

    function onTouchStart(e) {
        if (!currentMapId || e.touches.length !== 1) return;
        longPressTimer = setTimeout(() => {
            longPressTimer = null;
            const touch = e.touches[0];
            const el = map.getContainer();
            const rect = el.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            const latlng = map.containerPointToLatLng([x, y]);
            pendingAddLatLng = latlng;
            openAddMarkerModal();
        }, 500);
    }

    function onTouchEnd() {
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = null;
    }

    function onTouchMove() {
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = null;
    }

    function openAddMarkerModal() {
        markerName.value = '';
        markerComment.value = '';
        markerType.value = 'miscellaneous';
        if (markerImage) markerImage.value = '';
        pendingMarkerImageDataUrl = null;
        updateMarkerImagePreview(null);
        modal.setAttribute('aria-hidden', 'false');
        markerName.focus();
    }

    function updateMarkerImagePreview(dataUrl) {
        if (!markerImagePreview || !markerImagePreviewImg) return;
        if (!dataUrl) {
            pendingMarkerImageDataUrl = null;
            markerImagePreview.classList.add('hidden');
            markerImagePreviewImg.removeAttribute('src');
            return;
        }
        pendingMarkerImageDataUrl = dataUrl;
        markerImagePreviewImg.src = dataUrl;
        markerImagePreview.classList.remove('hidden');
    }

    function closeAddMarkerModal() {
        modal.setAttribute('aria-hidden', 'true');
        pendingAddLatLng = null;
    }

    function saveNewMarker() {
        if (!pendingAddLatLng || !currentMapId) return;
        const name = markerName.value.trim() || 'Unnamed';
        const comment = markerComment.value.trim();
        const type = markerType.value || 'miscellaneous';
        const baseMarker = {
            lat: pendingAddLatLng.lat,
            lng: pendingAddLatLng.lng,
            name,
            comment,
            type
        };
        const list = allMarkerLayers.map(({ data }) => data);
        const doSave = (newMarker) => {
            putMarkers(currentMapId, list.concat([newMarker])).then(() => {
                loadAndRenderMarkers();
                closeAddMarkerModal();
            }).catch((err) => {
                console.error('Failed to save marker', err);
                alert(err.message || 'Failed to save marker.');
            });
        };
        if (pendingMarkerImageDataUrl) {
            doSave({ ...baseMarker, imageData: pendingMarkerImageDataUrl });
        } else {
            const file = markerImage && markerImage.files && markerImage.files[0];
            if (file && file.type.startsWith('image/')) {
                fileToDataUrl(file).then((dataUrl) => {
                    doSave({ ...baseMarker, imageData: dataUrl });
                }).catch((err) => {
                    console.error('Failed to read image', err);
                    alert('Failed to read image.');
                });
            } else {
                doSave(baseMarker);
            }
        }
    }

    function populateLegend() {
        legendList.innerHTML = '';
        LEGEND_ENTRIES.forEach(({ key, label }) => {
            const li = document.createElement('li');
            const color = TYPE_COLORS[key] || TYPE_COLORS.miscellaneous;
            li.innerHTML = '<span class="wm-legend-swatch" style="background:' + color + '"></span><span>' + escapeHtml(label) + '</span>';
            legendList.appendChild(li);
        });
    }

    function populateTypeSelect() {
        markerType.innerHTML = '';
        LEGEND_ENTRIES.forEach(({ key, label }) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = label;
            markerType.appendChild(opt);
        });
    }

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) handleFile(file);
        fileInput.value = '';
    });

    uploadZone.addEventListener('click', (e) => {
        if (e.target !== fileInput) fileInput.click();
    });
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('wm-drag-over');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('wm-drag-over'));
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('wm-drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    mapSelect.addEventListener('change', () => selectMapById(mapSelect.value || null));

    searchInput.addEventListener('input', () => {
        applySearchFilter();
        showSearchDropdown();
    });
    searchInput.addEventListener('focus', () => showSearchDropdown());
    searchInput.addEventListener('blur', hideSearchDropdown);

    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveNewMarker();
    });
    modalCancel.addEventListener('click', closeAddMarkerModal);
    if (markerImage) {
        markerImage.addEventListener('change', () => {
            const file = markerImage.files && markerImage.files[0];
            if (file && file.type.startsWith('image/')) {
                fileToDataUrl(file).then(updateMarkerImagePreview).catch((err) => console.error('Failed to read image', err));
            } else {
                updateMarkerImagePreview(null);
            }
        });
    }
    if (markerImageClear) {
        markerImageClear.addEventListener('click', () => {
            updateMarkerImagePreview(null);
            if (markerImage) markerImage.value = '';
        });
    }
    modal.addEventListener('paste', (e) => {
        const item = Array.from(e.clipboardData.items || []).find((i) => i.type.startsWith('image/'));
        if (item) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob) {
                const r = new FileReader();
                r.onload = () => updateMarkerImagePreview(r.result);
                r.readAsDataURL(blob);
            }
        }
    });
    modal.querySelector('.wm-modal-backdrop').addEventListener('click', closeAddMarkerModal);

    fab.addEventListener('click', () => {
        if (!currentMapId) return;
        if (pendingAddLatLng) openAddMarkerModal();
        else alert('Right-click (or long-press on touch) on the map to set a location, then click + to add a marker.');
    });

    populateLegend();
    populateTypeSelect();

    refreshMapSelect().then((maps) => {
        const params = new URLSearchParams(window.location.search);
        const mapIdFromUrl = params.get('map');
        const lastId = localStorage.getItem(LAST_MAP_KEY);
        const idToSelect = mapIdFromUrl || (lastId && maps.some((m) => m.id === lastId) ? lastId : null);
        if (idToSelect) {
            mapSelect.value = idToSelect;
            selectMapById(idToSelect);
        } else {
            updateDetailPlaceholder('Upload a map to get started, or choose one from the list.');
        }
    });
})();
