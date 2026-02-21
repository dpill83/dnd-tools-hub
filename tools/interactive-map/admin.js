(function () {
    'use strict';

    const API_BASE = '';

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
    const editModal = document.getElementById('admin-edit-marker-modal');
    const editForm = document.getElementById('admin-edit-marker-form');
    const editName = document.getElementById('admin-edit-name');
    const editDescription = document.getElementById('admin-edit-description');
    const editType = document.getElementById('admin-edit-type');
    const editImageInput = document.getElementById('admin-edit-image');
    const editImageCurrent = document.getElementById('admin-edit-image-current');
    const editImageCurrentImg = document.getElementById('admin-edit-image-current-img');
    const editImageRemoveBtn = document.getElementById('admin-edit-image-remove');
    const editImagePreview = document.getElementById('admin-edit-image-preview');
    const editImagePreviewImg = document.getElementById('admin-edit-image-preview-img');
    const editImagePreviewClear = document.getElementById('admin-edit-image-preview-clear');
    const editCancelBtn = document.getElementById('admin-edit-cancel');

    let selectedMapId = null;
    let currentMarkers = [];
    let editingMarkerIndex = null;
    let pendingEditImageDataUrl = null;
    let editRemoveImage = false;

    function escapeHtml(s) {
        if (s == null || s === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(s);
        return div.innerHTML;
    }

    function renderMaps(maps) {
        if (!maps.length) {
            mapsList.innerHTML = '<p class="admin-hint">No maps yet. Upload one in the <a href="index.html">Interactive Map</a>.</p>';
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
                '<div class="marker-actions">' +
                '<button type="button" class="admin-btn admin-btn-select marker-edit-btn">Edit</button>' +
                '<button type="button" class="admin-btn admin-btn-danger marker-delete-btn">Delete</button>' +
                '</div>';
            li.querySelector('.marker-edit-btn').addEventListener('click', () => openEditModal(i));
            li.querySelector('.marker-delete-btn').addEventListener('click', () => deleteMarker(i));
            markersUl.appendChild(li);
        });
    }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => reject(new Error('Failed to read file'));
            r.readAsDataURL(file);
        });
    }

    function populateEditTypeSelect() {
        editType.innerHTML = '';
        LEGEND_ENTRIES.forEach(({ key, label }) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = label;
            editType.appendChild(opt);
        });
    }

    function openEditModal(index) {
        editingMarkerIndex = index;
        const m = currentMarkers[index];
        editName.value = m.name || '';
        editDescription.value = m.comment || m.description || '';
        editType.value = m.type || 'miscellaneous';
        editImageInput.value = '';
        pendingEditImageDataUrl = null;
        editRemoveImage = false;

        if (m.imageUrl) {
            editImageCurrent.classList.remove('hidden');
            editImageCurrentImg.src = m.imageUrl;
            editImageCurrentImg.alt = m.name || 'Marker image';
        } else {
            editImageCurrent.classList.add('hidden');
            editImageCurrentImg.removeAttribute('src');
        }
        editImagePreview.classList.add('hidden');
        editImagePreviewImg.removeAttribute('src');

        editModal.setAttribute('aria-hidden', 'false');
        editName.focus();
    }

    function closeEditModal() {
        editModal.setAttribute('aria-hidden', 'true');
        editingMarkerIndex = null;
        pendingEditImageDataUrl = null;
        editRemoveImage = false;
    }

    function saveEditMarker() {
        if (editingMarkerIndex == null || !selectedMapId) return;
        const m = currentMarkers[editingMarkerIndex];
        const name = editName.value.trim() || 'Unnamed';
        const comment = editDescription.value.trim();
        const type = editType.value || 'miscellaneous';

        const updated = {
            lat: m.lat,
            lng: m.lng,
            name,
            comment,
            type
        };
        if (pendingEditImageDataUrl) {
            updated.imageData = pendingEditImageDataUrl;
        } else if (!editRemoveImage && m.imageUrl) {
            updated.imageUrl = m.imageUrl;
        }

        currentMarkers[editingMarkerIndex] = updated;
        putMarkers(selectedMapId, currentMarkers).then(() => {
            loadMarkers();
            closeEditModal();
        }).catch((e) => {
            alert(e.message || 'Failed to save marker.');
        });
    }

    function setupEditModal() {
        populateEditTypeSelect();

        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveEditMarker();
        });
        editCancelBtn.addEventListener('click', closeEditModal);
        if (editModal.querySelector('.admin-modal-backdrop')) {
            editModal.querySelector('.admin-modal-backdrop').addEventListener('click', closeEditModal);
        }

        if (editImageRemoveBtn) {
            editImageRemoveBtn.addEventListener('click', () => {
                editRemoveImage = true;
                editImageCurrent.classList.add('hidden');
                editImageCurrentImg.removeAttribute('src');
                pendingEditImageDataUrl = null;
                editImagePreview.classList.add('hidden');
                editImageInput.value = '';
            });
        }

        if (editImageInput) {
            editImageInput.addEventListener('change', () => {
                const file = editImageInput.files && editImageInput.files[0];
                if (file && file.type.startsWith('image/')) {
                    fileToDataUrl(file).then((dataUrl) => {
                        pendingEditImageDataUrl = dataUrl;
                        editRemoveImage = false;
                        editImagePreviewImg.src = dataUrl;
                        editImagePreview.classList.remove('hidden');
                    }).catch(() => alert('Failed to read image.'));
                } else {
                    pendingEditImageDataUrl = null;
                    editImagePreview.classList.add('hidden');
                }
            });
        }

        if (editImagePreviewClear) {
            editImagePreviewClear.addEventListener('click', () => {
                pendingEditImageDataUrl = null;
                editImagePreview.classList.add('hidden');
                editImagePreviewImg.removeAttribute('src');
                editImageInput.value = '';
            });
        }

        editModal.addEventListener('paste', (e) => {
            const item = Array.from(e.clipboardData.items || []).find((i) => i.type.startsWith('image/'));
            if (item) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (blob) {
                    fileToDataUrl(blob).then((dataUrl) => {
                        pendingEditImageDataUrl = dataUrl;
                        editRemoveImage = false;
                        editImagePreviewImg.src = dataUrl;
                        editImagePreview.classList.remove('hidden');
                    }).catch(() => alert('Failed to read pasted image.'));
                }
            }
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
        setupEditModal();
        try {
            const maps = await getMaps();
            renderMaps(maps);
        } catch (e) {
            mapsList.innerHTML = '<p class="admin-error">' + escapeHtml(e.message) + '</p>';
        }
    }

    init();
})();
