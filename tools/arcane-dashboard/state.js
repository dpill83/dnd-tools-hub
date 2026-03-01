/**
 * Arcane Dashboard state – versioned localStorage, campaigns, layout.
 * Keys use v1- prefix for future schema migrations.
 */
(function () {
    'use strict';

    const VERSION = 'v1';
    const PREFIX = VERSION + '-arcane-dashboard-';
    const KEY_CAMPAIGNS = PREFIX + 'campaigns';
    const KEY_ACTIVE = PREFIX + 'active-campaign';

    function layoutKey(campaignId) { return PREFIX + 'layout-' + campaignId; }
    function initiativeKey(campaignId) { return PREFIX + 'initiative-' + campaignId; }
    function notesKey(campaignId) { return PREFIX + 'notes-' + campaignId; }
    function tablesKey(campaignId) { return PREFIX + 'tables-' + campaignId; }

    function get(key, defaultValue) {
        try {
            const raw = localStorage.getItem(key);
            if (raw == null) return defaultValue;
            return JSON.parse(raw);
        } catch (_) {
            return defaultValue;
        }
    }

    function set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Arcane Dashboard: localStorage set failed', e);
        }
    }

    function getCampaigns() {
        return get(KEY_CAMPAIGNS, []);
    }

    function setCampaigns(list) {
        set(KEY_CAMPAIGNS, list);
    }

    function getActiveCampaignId() {
        return localStorage.getItem(KEY_ACTIVE) || '';
    }

    function setActiveCampaignId(id) {
        localStorage.setItem(KEY_ACTIVE, id || '');
    }

    function getLayout(campaignId) {
        return get(layoutKey(campaignId), { widgets: [], snap: true, background: null });
    }

    function setLayout(campaignId, layout) {
        set(layoutKey(campaignId), layout);
    }

    function getInitiative(campaignId) {
        return get(initiativeKey(campaignId), { entries: [], currentIndex: 0 });
    }

    function setInitiative(campaignId, data) {
        set(initiativeKey(campaignId), data);
    }

    function getNotes(campaignId) {
        return get(notesKey(campaignId), { sections: [], encrypted: {} });
    }

    function setNotes(campaignId, data) {
        set(notesKey(campaignId), data);
    }

    function getTables(campaignId) {
        return get(tablesKey(campaignId), { tables: [] });
    }

    function setTables(campaignId, data) {
        set(tablesKey(campaignId), data);
    }

    /** Export full campaign data for backup/portability */
    function exportCampaign(campaignId) {
        const campaigns = getCampaigns();
        const campaign = campaigns.find(function (c) { return c.id === campaignId; });
        return {
            version: VERSION,
            exportedAt: new Date().toISOString(),
            campaign: campaign || { id: campaignId, name: 'Unknown' },
            layout: getLayout(campaignId),
            initiative: getInitiative(campaignId),
            notes: getNotes(campaignId),
            tables: getTables(campaignId)
        };
    }

    /** Import campaign from JSON; merge or replace by campaign id */
    function importCampaign(json) {
        if (!json || !json.campaign || !json.campaign.id) return false;
        const id = json.campaign.id;
        const name = json.campaign.name || 'Imported';
        const campaigns = getCampaigns();
        if (!campaigns.some(function (c) { return c.id === id; })) {
            campaigns.push({ id: id, name: name });
            setCampaigns(campaigns);
        }
        if (json.layout) setLayout(id, json.layout);
        if (json.initiative) setInitiative(id, json.initiative);
        if (json.notes) setNotes(id, json.notes);
        if (json.tables) setTables(id, json.tables);
        return true;
    }

    window.ArcaneDashboardState = {
        VERSION: VERSION,
        getCampaigns: getCampaigns,
        setCampaigns: setCampaigns,
        getActiveCampaignId: getActiveCampaignId,
        setActiveCampaignId: setActiveCampaignId,
        getLayout: getLayout,
        setLayout: setLayout,
        getInitiative: getInitiative,
        setInitiative: setInitiative,
        getNotes: getNotes,
        setNotes: setNotes,
        getTables: getTables,
        setTables: setTables,
        exportCampaign: exportCampaign,
        importCampaign: importCampaign
    };
})();
