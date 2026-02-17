// Interactive Map – upload-first, multi-map, markers, search. Leaflet + IndexedDB + localStorage.

(function () {
    'use strict';

    const IDB_NAME = 'interactive-map-db';
    const IDB_VERSION = 1;
    const MAP_STORE = 'maps';
    const LAST_MAP_KEY = 'interactive-map-last-map';
    const USER_MARKERS_PREFIX = 'interactive-map-user-markers-';

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

    let idb = null;
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
    const modalCancel = $('wm-modal-cancel');

    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => { idb = req.result; resolve(idb); };
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(MAP_STORE)) {
                    const store = db.createObjectStore(MAP_STORE, { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                }
            };
        });
    }

    function saveMap(record) {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(MAP_STORE, 'readwrite');
            tx.objectStore(MAP_STORE).put(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function getAllMaps() {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(MAP_STORE, 'readonly');
            const req = tx.objectStore(MAP_STORE).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    function getMap(id) {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(MAP_STORE, 'readonly');
            const req = tx.objectStore(MAP_STORE).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function deleteMap(id) {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(MAP_STORE, 'readwrite');
            tx.objectStore(MAP_STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function generateId() {
        return 'map-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
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
        getImageDimensions(file).then(({ width, height }) => {
            return fileToDataUrl(file).then((dataUrl) => ({ dataUrl, width, height, name: file.name }));
        }).then(({ dataUrl, width, height, name }) => {
            const id = generateId();
            const displayName = name.replace(/\.[^.]+$/, '') || 'Untitled map';
            const record = { id, name: displayName, imageData: dataUrl, bounds: { height, width } };
            return saveMap(record).then(() => ({ record, id }));
        }).then(({ record, id }) => {
            refreshMapSelect().then(() => {
                selectMapById(id);
                showMapView(record);
            });
        }).catch((err) => console.error('Upload failed', err));
    }

    function refreshMapSelect() {
        return getAllMaps().then((maps) => {
            const current = mapSelect.value;
            mapSelect.innerHTML = '<option value="">— No map —</option>';
            maps.forEach((m) => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.name;
                mapSelect.appendChild(opt);
            });
            if (current && maps.some((m) => m.id === current)) mapSelect.value = current;
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
                minZoom: -2,
                maxZoom: 4
            });
            map.fitBounds(mapBounds);
            map.on('contextmenu', onMapRightClick);
            map.getContainer().addEventListener('touchstart', onTouchStart, { passive: true });
            map.getContainer().addEventListener('touchend', onTouchEnd, { passive: true });
            map.getContainer().addEventListener('touchmove', onTouchMove, { passive: true });
        }

        if (imageOverlay) map.removeLayer(imageOverlay);
        imageOverlay = L.imageOverlay(record.imageData, mapBounds).addTo(map);
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
        getMap(id).then((record) => {
            if (record) showMapView(record);
        });
    }

    function clearMarkers() {
        if (!markerLayer) return;
        map.removeLayer(markerLayer);
        markerLayer = null;
        allMarkerLayers = [];
    }

    function getUserMarkers(mapId) {
        try {
            const raw = localStorage.getItem(USER_MARKERS_PREFIX + mapId);
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    }

    function setUserMarkers(mapId, list) {
        localStorage.setItem(USER_MARKERS_PREFIX + mapId, JSON.stringify(list));
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
        const list = getUserMarkers(currentMapId);
        markerLayer = L.layerGroup();
        allMarkerLayers = [];
        list.forEach((m) => {
            const layer = createMarkerLayer(m);
            markerLayer.addLayer(layer);
            allMarkerLayers.push({ layer, data: m });
        });
        markerLayer.addTo(map);
        applySearchFilter();
    }

    function applySearchFilter() {
        const q = (searchInput.value || '').trim().toLowerCase();
        allMarkerLayers.forEach(({ layer, data }) => {
            const match = !q ||
                (data.name && data.name.toLowerCase().includes(q)) ||
                (data.type && data.type.toLowerCase().includes(q));
            layer.setStyle({ opacity: match ? 1 : 0.25, fillOpacity: match ? 0.9 : 0.2 });
        });
    }

    function updateDetailPlaceholder(text) {
        detailContent.innerHTML = '<p class="wm-detail-placeholder">' + escapeHtml(text) + '</p>';
    }

    function updateDetailPanel(data) {
        const name = data.name || 'Unnamed';
        const type = data.type || 'miscellaneous';
        const desc = (data.comment || data.description || '').trim();
        detailContent.innerHTML =
            '<p class="wm-detail-name">' + escapeHtml(name) + '</p>' +
            '<p class="wm-detail-type">' + escapeHtml(type) + '</p>' +
            (desc ? '<div class="wm-detail-description">' + escapeHtml(desc) + '</div>' : '');
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
        modal.setAttribute('aria-hidden', 'false');
        markerName.focus();
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
        const list = getUserMarkers(currentMapId);
        const newMarker = {
            lat: pendingAddLatLng.lat,
            lng: pendingAddLatLng.lng,
            name,
            comment,
            type
        };
        list.push(newMarker);
        setUserMarkers(currentMapId, list);
        loadAndRenderMarkers();
        closeAddMarkerModal();
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

    searchInput.addEventListener('input', () => applySearchFilter());

    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveNewMarker();
    });
    modalCancel.addEventListener('click', closeAddMarkerModal);
    modal.querySelector('.wm-modal-backdrop').addEventListener('click', closeAddMarkerModal);

    fab.addEventListener('click', () => {
        if (!currentMapId) return;
        if (pendingAddLatLng) openAddMarkerModal();
        else alert('Right-click (or long-press on touch) on the map to set a location, then click + to add a marker.');
    });

    populateLegend();
    populateTypeSelect();

    openDB().then(() => refreshMapSelect()).then(() => {
        const lastId = localStorage.getItem(LAST_MAP_KEY);
        if (lastId) {
            getMap(lastId).then((record) => {
                if (record) {
                    mapSelect.value = lastId;
                    showMapView(record);
                }
            });
        }
    }).catch((err) => console.error('IndexedDB init failed', err));
})();
