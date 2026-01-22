// ============================================================================
// Adventure Maker - D&D 5e Adventure Authoring Tool
// ============================================================================

// ============================================================================
// Constants and Schema Versions
// ============================================================================

const SCHEMA_VERSION = "1.0.0";
const CAMPAIGN_SETTINGS_KEY = "dndCampaignSettings";
const ADVENTURE_DRAFT_KEY = "dndAdventureMakerDraft";
const UI_STATE_KEY = "adventureMakerUIState";

// ============================================================================
// Data Models
// ============================================================================

let campaignSettings = {
    schemaVersion: SCHEMA_VERSION,
    campaignHub: "Waterdeep",
    recurringNPCs: [],
    recurringLocations: [],
    recurringFactions: []
};

let adventureDraft = {
    schemaVersion: SCHEMA_VERSION,
    adventureId: null,
    createdAt: null,
    lastModified: null,
    setup: {
        partyLevel: null,
        partySize: 4,
        tone: "",
        setting: "",
        settingCustom: "",
        adventureLength: "Medium (4-6 sessions)",
        constraints: {
            recurringNPCIds: [],
            recurringLocationIds: [],
            recurringFactionIds: [],
            specialItems: "",
            themes: ""
        }
    },
    premise: {
        situation: "",
        conflict: "",
        whatMakesItUnique: "",
        stakes: "",
        timePressure: ""
    },
    hook: {
        hookType: "",
        hookDetails: "",
        whyPartyCares: "",
        refusalPlan: ""
    },
    threads: [],
    encounters: [],
    npcs: [],
    locations: [],
    endings: {
        expected: "",
        alternatives: ["", ""],
        villainDiesEarly: ""
    },
    rewards: {
        treasure: "",
        magicItems: "",
        experience: null,
        milestone: false,
        other: ""
    }
};

let uiState = {
    expandedSections: {},
    allExpanded: false
};

// ============================================================================
// Utility Functions
// ============================================================================

function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function escapeText(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function truncateText(text, maxLength) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
}

// ============================================================================
// Navigation
// ============================================================================

function initNavigation() {
    const navItems = document.querySelectorAll('.step-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            if (view) {
                switchView(view);
            }
        });
    });
}

function switchView(viewName) {
    // Update nav
    document.querySelectorAll('.step-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNavItem = document.querySelector(`.step-item[data-view="${viewName}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }

    // Update views
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`view-${viewName}`).classList.add('active');

    // Load data for view
    if (viewName === 'builder') {
        renderBuilderSections();
    } else if (viewName === 'campaign') {
        renderCampaignSettings();
    } else if (viewName === 'module') {
        // Module generator view - no special initialization needed
    }
}

// ============================================================================
// Adventure Setup
// ============================================================================

function initSetup() {
    loadCampaignSettings();
    loadAdventureDraft();
    populateSetupForm();
    populateLocationDropdown();
    populateRecurringPickers();
    
    // Handle tone "Other" option
    const toneSelect = document.getElementById('setup-tone');
    const toneOther = document.getElementById('setup-tone-other');
    if (toneSelect && toneOther) {
        toneSelect.addEventListener('change', () => {
            toneOther.style.display = toneSelect.value === 'Other' ? 'block' : 'none';
        });
    }

    // Handle setting "Other" option
    const settingSelect = document.getElementById('setup-setting');
    const settingOther = document.getElementById('setup-setting-other');
    if (settingSelect && settingOther) {
        settingSelect.addEventListener('change', () => {
            settingOther.style.display = settingSelect.value === 'Other' ? 'block' : 'none';
        });
    }

    // Auto-save on change
    const setupForm = document.getElementById('setup-form');
    if (setupForm) {
        setupForm.addEventListener('input', debounce(saveSetup, 500));
        setupForm.addEventListener('change', debounce(saveSetup, 500));
    }
}

function populateLocationDropdown() {
    const select = document.getElementById('setup-setting');
    const hub = campaignSettings.campaignHub || "Waterdeep";
    
    // Clear existing options except first
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Add campaign hub
    const hubOption = document.createElement('option');
    hubOption.value = hub;
    hubOption.textContent = hub;
    select.appendChild(hubOption);
    
    // Add recurring locations
    campaignSettings.recurringLocations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.name;
        option.textContent = loc.name;
        select.appendChild(option);
    });
    
    // Add "Other" option
    const otherOption = document.createElement('option');
    otherOption.value = 'Other';
    otherOption.textContent = 'Other...';
    select.appendChild(otherOption);
}

function populateSetupForm() {
    const setup = adventureDraft.setup;
    if (setup.partyLevel) document.getElementById('setup-party-level').value = setup.partyLevel;
    if (setup.partySize) document.getElementById('setup-party-size').value = setup.partySize;
    if (setup.tone) {
        if (['Heroic', 'Grimdark', 'Mystery', 'Horror', 'Comedy', 'Political', 'Epic'].includes(setup.tone)) {
            document.getElementById('setup-tone').value = setup.tone;
        } else {
            document.getElementById('setup-tone').value = 'Other';
            document.getElementById('setup-tone-other').value = setup.tone;
            document.getElementById('setup-tone-other').style.display = 'block';
        }
    }
    if (setup.setting) {
        if (setup.settingCustom) {
            document.getElementById('setup-setting').value = 'Other';
            document.getElementById('setup-setting-other').value = setup.settingCustom;
            document.getElementById('setup-setting-other').style.display = 'block';
        } else {
            document.getElementById('setup-setting').value = setup.setting;
        }
    }
    if (setup.adventureLength) document.getElementById('setup-length').value = setup.adventureLength;
    if (setup.constraints.specialItems) document.getElementById('setup-special-items').value = setup.constraints.specialItems;
    if (setup.constraints.themes) document.getElementById('setup-themes').value = setup.constraints.themes;
}

function collectSetupData() {
    const toneSelect = document.getElementById('setup-tone');
    const tone = toneSelect.value === 'Other' ? document.getElementById('setup-tone-other').value : toneSelect.value;
    
    const settingSelect = document.getElementById('setup-setting');
    const setting = settingSelect.value === 'Other' ? document.getElementById('setup-setting-other').value : settingSelect.value;
    const settingCustom = settingSelect.value === 'Other' ? setting : '';

    adventureDraft.setup = {
        partyLevel: parseInt(document.getElementById('setup-party-level').value) || null,
        partySize: parseInt(document.getElementById('setup-party-size').value) || 4,
        tone: tone,
        setting: settingSelect.value === 'Other' ? '' : setting,
        settingCustom: settingCustom,
        adventureLength: document.getElementById('setup-length').value,
        constraints: {
            recurringNPCIds: Array.from(document.getElementById('setup-npcs-select').selectedOptions).map(opt => opt.value),
            recurringLocationIds: Array.from(document.getElementById('setup-locations-select').selectedOptions).map(opt => opt.value),
            recurringFactionIds: Array.from(document.getElementById('setup-factions-select').selectedOptions).map(opt => opt.value),
            specialItems: document.getElementById('setup-special-items').value,
            themes: document.getElementById('setup-themes').value
        }
    };
}

function saveSetup() {
    collectSetupData();
    adventureDraft.lastModified = new Date().toISOString();
    if (!adventureDraft.adventureId) {
        adventureDraft.adventureId = generateId();
        adventureDraft.createdAt = new Date().toISOString();
    }
    localStorage.setItem(ADVENTURE_DRAFT_KEY, JSON.stringify(adventureDraft));
}

function navigateToBuilder() {
    saveSetup();
    switchView('builder');
}

function toggleConstraints() {
    const section = document.querySelector('.constraints-section');
    section.classList.toggle('expanded');
}

// ============================================================================
// Adventure Builder - Progressive Disclosure
// ============================================================================

const BUILDER_SECTIONS = [
    { id: 'premise', title: 'Premise/Situation', fields: ['situation', 'conflict', 'whatMakesItUnique', 'stakes', 'timePressure'] },
    { id: 'hook', title: 'Hook', fields: ['hookType', 'hookDetails', 'whyPartyCares', 'refusalPlan'] },
    { id: 'threads', title: 'Threads', isArray: true },
    { id: 'encounters', title: 'Encounters', isArray: true },
    { id: 'npcs', title: 'NPCs', isArray: true },
    { id: 'locations', title: 'Locations', isArray: true },
    { id: 'endings', title: 'Endings', fields: ['expected', 'alternatives', 'villainDiesEarly'] },
    { id: 'rewards', title: 'Rewards', fields: ['treasure', 'magicItems', 'experience', 'milestone', 'other'] }
];

function renderBuilderSections() {
    const container = document.getElementById('builder-sections');
    container.innerHTML = '';

    BUILDER_SECTIONS.forEach(section => {
        const card = createSectionCard(section);
        container.appendChild(card);
    });

    // Restore expanded state
    restoreSectionStates();
}

function createSectionCard(section) {
    const card = document.createElement('div');
    card.className = 'section-card';
    card.id = `section-${section.id}`;
    card.dataset.sectionId = section.id;

    const summary = generateSectionSummary(section);
    const isExpanded = uiState.expandedSections[section.id] || false;

    card.innerHTML = `
        <div class="section-header" onclick="toggleSection('${section.id}')">
            <h3>${section.title}</h3>
            <span class="section-toggle">${isExpanded ? '▼' : '▶'}</span>
        </div>
        <div class="section-summary">${summary}</div>
        <div class="section-content">${generateSectionContent(section)}</div>
    `;

    if (isExpanded) {
        card.classList.add('expanded');
    }

    return card;
}

function generateSectionSummary(section) {
    if (section.isArray) {
        const items = adventureDraft[section.id] || [];
        const count = items.length;
        let summary = `<strong>${count}</strong> ${section.title.toLowerCase()}`;
        
        if (section.id === 'threads' && count > 0) {
            summary += '<br>';
            items.slice(0, 3).forEach((item, idx) => {
                summary += `${idx + 1}. ${truncateText(item.lead || '', 40)} → ${truncateText(item.whereItPoints || '', 30)}<br>`;
            });
        } else if (section.id === 'encounters' && count > 0) {
            summary += '<br>';
            items.slice(0, 3).forEach((item, idx) => {
                const types = (item.type || []).join(', ');
                summary += `${idx + 1}. ${truncateText(item.objective || '', 30)} vs ${truncateText(item.obstacle || '', 30)} [${types}]<br>`;
            });
        } else if (section.id === 'npcs' && count > 0) {
            const recurringCount = items.filter(n => n.isRecurring).length;
            if (recurringCount > 0) summary += ` (${recurringCount} recurring)`;
            summary += '<br>';
            items.slice(0, 5).forEach(item => {
                const recurring = item.isRecurring ? ' [RECURRING]' : '';
                summary += `- ${item.name || '[Unnamed]'} - ${item.role || ''} (${item.location || ''})${recurring}<br>`;
            });
        } else if (section.id === 'locations' && count > 0) {
            const recurringCount = items.filter(l => l.isRecurring).length;
            if (recurringCount > 0) summary += ` (${recurringCount} recurring)`;
            summary += '<br>';
            items.slice(0, 5).forEach(item => {
                const recurring = item.isRecurring ? ' [RECURRING]' : '';
                summary += `- ${item.name || '[Unnamed]'} - ${truncateText(item.description || '', 50)}${recurring}<br>`;
            });
        }
        
        return summary;
    } else {
        const data = adventureDraft[section.id] || {};
        let summary = '';
        
        if (section.id === 'premise') {
            summary = `${truncateText(data.situation || '', 60)} | Conflict: ${truncateText(data.conflict || '', 40)} | Stakes: ${truncateText(data.stakes || '', 40)}`;
        } else if (section.id === 'hook') {
            summary = `${data.hookType || ''} - ${truncateText(data.hookDetails || '', 60)}`;
        } else if (section.id === 'endings') {
            summary = `Expected: ${truncateText(data.expected || '', 50)} | ${(data.alternatives || []).filter(a => a).length} alternatives`;
        } else if (section.id === 'rewards') {
            const hasTreasure = data.treasure ? 'Yes' : 'No';
            const hasItems = data.magicItems ? 'Yes' : 'No';
            const xp = data.milestone ? 'Milestone' : (data.experience || 'None');
            summary = `Treasure: ${hasTreasure} | Magic Items: ${hasItems} | XP: ${xp}`;
        }
        
        return summary || 'No content yet';
    }
}

function generateSectionContent(section) {
    if (section.isArray) {
        return generateArraySectionContent(section);
    } else {
        return generateFieldSectionContent(section);
    }
}

function generateFieldSectionContent(section) {
    const data = adventureDraft[section.id] || {};
    let html = '';

    if (section.id === 'premise') {
        html = `
            <div class="form-group">
                <label>Situation *</label>
                <textarea class="field-input" data-section="premise" data-field="situation" rows="3">${escapeText(data.situation || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Conflict *</label>
                <textarea class="field-input" data-section="premise" data-field="conflict" rows="3">${escapeText(data.conflict || '')}</textarea>
            </div>
            <div class="form-group">
                <label>What Makes It Unique</label>
                <textarea class="field-input" data-section="premise" data-field="whatMakesItUnique" rows="2">${escapeText(data.whatMakesItUnique || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Stakes</label>
                <textarea class="field-input" data-section="premise" data-field="stakes" rows="2">${escapeText(data.stakes || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Time Pressure</label>
                <textarea class="field-input" data-section="premise" data-field="timePressure" rows="2">${escapeText(data.timePressure || '')}</textarea>
            </div>
        `;
    } else if (section.id === 'hook') {
        html = `
            <div class="form-group">
                <label>Hook Type *</label>
                <select class="field-input" data-section="hook" data-field="hookType">
                    <option value="">Select...</option>
                    <option value="Patron" ${data.hookType === 'Patron' ? 'selected' : ''}>Patron</option>
                    <option value="Supernatural" ${data.hookType === 'Supernatural' ? 'selected' : ''}>Supernatural</option>
                    <option value="Happenstance" ${data.hookType === 'Happenstance' ? 'selected' : ''}>Happenstance</option>
                </select>
            </div>
            <div class="form-group">
                <label>Hook Details</label>
                <textarea class="field-input" data-section="hook" data-field="hookDetails" rows="3">${escapeText(data.hookDetails || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Why Party Cares</label>
                <textarea class="field-input" data-section="hook" data-field="whyPartyCares" rows="2">${escapeText(data.whyPartyCares || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Refusal Plan</label>
                <textarea class="field-input" data-section="hook" data-field="refusalPlan" rows="2">${escapeText(data.refusalPlan || '')}</textarea>
            </div>
        `;
    } else if (section.id === 'endings') {
        html = `
            <div class="form-group">
                <label>Expected Ending</label>
                <textarea class="field-input" data-section="endings" data-field="expected" rows="3">${escapeText(data.expected || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Alternative Ending 1</label>
                <textarea class="field-input" data-section="endings" data-field="alternatives" data-index="0" rows="2">${escapeText((data.alternatives || [''])[0] || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Alternative Ending 2</label>
                <textarea class="field-input" data-section="endings" data-field="alternatives" data-index="1" rows="2">${escapeText((data.alternatives || ['', ''])[1] || '')}</textarea>
            </div>
            <div class="form-group">
                <label>If Villain Dies Early</label>
                <textarea class="field-input" data-section="endings" data-field="villainDiesEarly" rows="2">${escapeText(data.villainDiesEarly || '')}</textarea>
            </div>
        `;
    } else if (section.id === 'rewards') {
        html = `
            <div class="form-group">
                <label>Treasure</label>
                <textarea class="field-input" data-section="rewards" data-field="treasure" rows="2">${escapeText(data.treasure || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Magic Items</label>
                <textarea class="field-input" data-section="rewards" data-field="magicItems" rows="2">${escapeText(data.magicItems || '')}</textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Experience Points</label>
                    <input type="number" class="field-input" data-section="rewards" data-field="experience" value="${data.experience || ''}" min="0">
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" class="field-input" data-section="rewards" data-field="milestone" ${data.milestone ? 'checked' : ''}>
                        Milestone Leveling
                    </label>
                </div>
            </div>
            <div class="form-group">
                <label>Other Rewards</label>
                <textarea class="field-input" data-section="rewards" data-field="other" rows="2">${escapeText(data.other || '')}</textarea>
            </div>
        `;
    }

    // Add event listeners after rendering
    setTimeout(() => {
        attachFieldListeners(section.id);
    }, 0);

    return html;
}

function generateArraySectionContent(section) {
    const items = adventureDraft[section.id] || [];
    let html = `<div id="${section.id}-list">`;

    items.forEach((item, index) => {
        html += generateArrayItem(section.id, item, index);
    });

    html += `</div>`;
    html += `<button type="button" class="btn-secondary" onclick="addArrayItem('${section.id}')">+ Add ${section.title.slice(0, -1)}</button>`;

    // Add event listeners
    setTimeout(() => {
        attachArrayItemListeners(section.id);
    }, 0);

    return html;
}

function generateArrayItem(type, item, index) {
    if (type === 'threads') {
        return `
            <div class="thread-card" data-id="${item.id}">
                <div class="card-header">
                    <div class="card-title">Thread ${index + 1}</div>
                    <button type="button" class="btn-remove" onclick="removeArrayItem('${type}', '${item.id}')">Remove</button>
                </div>
                <div class="form-group">
                    <label>Lead *</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="lead" value="${escapeText(item.lead || '')}" placeholder="What players can investigate">
                </div>
                <div class="form-group">
                    <label>Where It Points</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="whereItPoints" value="${escapeText(item.whereItPoints || '')}" placeholder="Where this lead goes">
                </div>
                <div class="form-group">
                    <label>Cost If Ignored</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="costIfIgnored" value="${escapeText(item.costIfIgnored || '')}" placeholder="What happens if players don't pursue this">
                </div>
            </div>
        `;
    } else if (type === 'encounters') {
        const typeCheckboxes = ['Exploration', 'Social', 'Combat'].map(t => 
            `<label><input type="checkbox" class="array-field-checkbox" data-type="${type}" data-id="${item.id}" data-field="type" value="${t}" ${(item.type || []).includes(t) ? 'checked' : ''}> ${t}</label>`
        ).join('');
        
        return `
            <div class="encounter-card" data-id="${item.id}">
                <div class="card-header">
                    <div class="card-title">Encounter ${index + 1}</div>
                    <button type="button" class="btn-remove" onclick="removeArrayItem('${type}', '${item.id}')">Remove</button>
                </div>
                <div class="form-group">
                    <label>Objective *</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="objective" value="${escapeText(item.objective || '')}" placeholder="What players want to accomplish">
                </div>
                <div class="form-group">
                    <label>Obstacle *</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="obstacle" value="${escapeText(item.obstacle || '')}" placeholder="What stands in their way">
                </div>
                <div class="form-group">
                    <label>What It Accomplishes</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="whatItAccomplishes" value="${escapeText(item.whatItAccomplishes || '')}">
                </div>
                <div class="form-group">
                    <label>Information Revealed</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="informationRevealed" value="${escapeText(item.informationRevealed || '')}">
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <div class="checkbox-group">${typeCheckboxes}</div>
                </div>
                <div class="form-group">
                    <label>Trigger</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="trigger" value="${escapeText(item.trigger || '')}">
                </div>
                <div class="form-group">
                    <label>Consequence</label>
                    <textarea class="array-field" data-type="${type}" data-id="${item.id}" data-field="consequence" rows="2">${escapeText(item.consequence || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>Difficulty Note</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="difficultyNote" value="${escapeText(item.difficultyNote || '')}">
                </div>
                <div class="form-group">
                    <label>Treasure</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="treasure" value="${escapeText(item.treasure || '')}">
                </div>
            </div>
        `;
    } else if (type === 'npcs') {
        return `
            <div class="npc-card" data-id="${item.id}">
                <div class="card-header">
                    <div class="card-title">NPC ${index + 1}${item.isRecurring ? ' <span class="recurring-badge">RECURRING</span>' : ''}</div>
                    <button type="button" class="btn-remove" onclick="removeArrayItem('${type}', '${item.id}')">Remove</button>
                </div>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="name" value="${escapeText(item.name || '')}">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="role" value="${escapeText(item.role || '')}">
                </div>
                <div class="form-group">
                    <label>Motivation</label>
                    <textarea class="array-field" data-type="${type}" data-id="${item.id}" data-field="motivation" rows="2">${escapeText(item.motivation || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>Relationship</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="relationship" value="${escapeText(item.relationship || '')}">
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="location" value="${escapeText(item.location || '')}">
                </div>
            </div>
        `;
    } else if (type === 'locations') {
        return `
            <div class="location-card" data-id="${item.id}">
                <div class="card-header">
                    <div class="card-title">Location ${index + 1}${item.isRecurring ? ' <span class="recurring-badge">RECURRING</span>' : ''}</div>
                    <button type="button" class="btn-remove" onclick="removeArrayItem('${type}', '${item.id}')">Remove</button>
                </div>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" class="array-field" data-type="${type}" data-id="${item.id}" data-field="name" value="${escapeText(item.name || '')}">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea class="array-field" data-type="${type}" data-id="${item.id}" data-field="description" rows="3">${escapeText(item.description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>Features</label>
                    <textarea class="array-field" data-type="${type}" data-id="${item.id}" data-field="features" rows="2">${escapeText(item.features || '')}</textarea>
                </div>
            </div>
        `;
    }
    return '';
}

function attachFieldListeners(sectionId) {
    const inputs = document.querySelectorAll(`[data-section="${sectionId}"]`);
    inputs.forEach(input => {
        input.addEventListener('input', debounce(() => {
            updateField(sectionId, input);
            updateSectionSummary(sectionId);
            saveDraft();
        }, 300));
        input.addEventListener('change', () => {
            updateField(sectionId, input);
            updateSectionSummary(sectionId);
            saveDraft();
        });
    });
}

function attachArrayItemListeners(type) {
    const inputs = document.querySelectorAll(`.array-field[data-type="${type}"]`);
    inputs.forEach(input => {
        input.addEventListener('input', debounce(() => {
            updateArrayField(type, input);
            updateSectionSummary(type);
            saveDraft();
        }, 300));
    });

    const checkboxes = document.querySelectorAll(`.array-field-checkbox[data-type="${type}"]`);
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateArrayFieldCheckbox(type, checkbox);
            saveDraft();
        });
    });
}

function updateField(sectionId, input) {
    const field = input.getAttribute('data-field');
    const value = input.type === 'checkbox' ? input.checked : input.value;
    
    if (!adventureDraft[sectionId]) {
        adventureDraft[sectionId] = {};
    }

    if (field === 'alternatives') {
        const index = parseInt(input.getAttribute('data-index'));
        if (!adventureDraft[sectionId].alternatives) {
            adventureDraft[sectionId].alternatives = ['', ''];
        }
        adventureDraft[sectionId].alternatives[index] = value;
    } else {
        adventureDraft[sectionId][field] = value;
    }
}

function updateArrayField(type, input) {
    const id = input.getAttribute('data-id');
    const field = input.getAttribute('data-field');
    const value = input.value;

    const item = adventureDraft[type].find(i => i.id === id);
    if (item) {
        item[field] = value;
    }
}

function updateArrayFieldCheckbox(type, checkbox) {
    const id = checkbox.getAttribute('data-id');
    const field = checkbox.getAttribute('data-field');
    const value = checkbox.value;
    const checked = checkbox.checked;

    const item = adventureDraft[type].find(i => i.id === id);
    if (item) {
        if (!item[field]) item[field] = [];
        if (checked && !item[field].includes(value)) {
            item[field].push(value);
        } else if (!checked) {
            item[field] = item[field].filter(v => v !== value);
        }
    }
}

function addArrayItem(type) {
    const newItem = { id: generateId() };
    
    if (type === 'threads') {
        newItem.lead = '';
        newItem.whereItPoints = '';
        newItem.costIfIgnored = '';
    } else if (type === 'encounters') {
        newItem.objective = '';
        newItem.obstacle = '';
        newItem.whatItAccomplishes = '';
        newItem.informationRevealed = '';
        newItem.type = [];
        newItem.trigger = '';
        newItem.consequence = '';
        newItem.difficultyNote = '';
        newItem.treasure = '';
    } else if (type === 'npcs') {
        newItem.name = '';
        newItem.role = '';
        newItem.motivation = '';
        newItem.relationship = '';
        newItem.location = '';
        newItem.isRecurring = false;
        newItem.recurringNPCId = null;
    } else if (type === 'locations') {
        newItem.name = '';
        newItem.description = '';
        newItem.features = '';
        newItem.isRecurring = false;
        newItem.recurringLocationId = null;
    }

    if (!adventureDraft[type]) {
        adventureDraft[type] = [];
    }
    adventureDraft[type].push(newItem);
    
    // Re-render the section
    const section = BUILDER_SECTIONS.find(s => s.id === type);
    const card = document.getElementById(`section-${type}`);
    if (card) {
        const wasExpanded = card.classList.contains('expanded');
        const content = card.querySelector('.section-content');
        content.innerHTML = generateArraySectionContent(section);
        attachArrayItemListeners(type);
        if (wasExpanded) {
            card.classList.add('expanded');
        }
        updateSectionSummary(type);
    }
    
    saveDraft();
}

function removeArrayItem(type, id) {
    adventureDraft[type] = adventureDraft[type].filter(item => item.id !== id);
    
    // Re-render the section
    const section = BUILDER_SECTIONS.find(s => s.id === type);
    const card = document.getElementById(`section-${type}`);
    if (card) {
        const wasExpanded = card.classList.contains('expanded');
        const content = card.querySelector('.section-content');
        content.innerHTML = generateArraySectionContent(section);
        attachArrayItemListeners(type);
        if (wasExpanded) {
            card.classList.add('expanded');
        }
        updateSectionSummary(type);
    }
    
    saveDraft();
}

function toggleSection(sectionId) {
    const card = document.getElementById(`section-${sectionId}`);
    if (card) {
        card.classList.toggle('expanded');
        uiState.expandedSections[sectionId] = card.classList.contains('expanded');
        saveUIState();
        
        // Update toggle icon
        const toggle = card.querySelector('.section-toggle');
        if (toggle) {
            toggle.textContent = card.classList.contains('expanded') ? '▼' : '▶';
        }
    }
}

function toggleAllSections() {
    const allExpanded = uiState.allExpanded;
    const cards = document.querySelectorAll('.section-card');
    
    cards.forEach(card => {
        const sectionId = card.dataset.sectionId;
        if (allExpanded) {
            card.classList.remove('expanded');
            uiState.expandedSections[sectionId] = false;
        } else {
            card.classList.add('expanded');
            uiState.expandedSections[sectionId] = true;
        }
        
        const toggle = card.querySelector('.section-toggle');
        if (toggle) {
            toggle.textContent = allExpanded ? '▶' : '▼';
        }
    });
    
    uiState.allExpanded = !allExpanded;
    const btn = document.getElementById('expand-all-btn');
    if (btn) {
        btn.textContent = allExpanded ? 'Expand All' : 'Collapse All';
    }
    
    saveUIState();
}

function updateSectionSummary(sectionId) {
    const section = BUILDER_SECTIONS.find(s => s.id === sectionId);
    if (!section) return;
    
    const card = document.getElementById(`section-${sectionId}`);
    if (card) {
        const summaryEl = card.querySelector('.section-summary');
        if (summaryEl) {
            summaryEl.innerHTML = generateSectionSummary(section);
        }
    }
}

function restoreSectionStates() {
    Object.keys(uiState.expandedSections).forEach(sectionId => {
        if (uiState.expandedSections[sectionId]) {
            const card = document.getElementById(`section-${sectionId}`);
            if (card) {
                card.classList.add('expanded');
                const toggle = card.querySelector('.section-toggle');
                if (toggle) {
                    toggle.textContent = '▼';
                }
            }
        }
    });
}

// ============================================================================
// AI Integration
// ============================================================================

function generateAIPrompt() {
    collectSetupData();
    
    if (!adventureDraft.setup.partyLevel) {
        alert('Please set party level in Adventure Setup first.');
        return;
    }

    const prompt = buildDeepResearchPrompt();
    
    const outputDiv = document.getElementById('ai-prompt-output');
    const textarea = document.getElementById('ai-prompt-text');
    textarea.value = prompt;
    outputDiv.style.display = 'block';
    outputDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function buildDeepResearchPrompt() {
    const setup = adventureDraft.setup;
    const campaignContext = buildCampaignContext();
    
    let prompt = `You are an expert D&D 5e adventure designer specializing in deep, detailed adventure creation.

TASK: Perform deep research and expansion on this adventure framework. Generate comprehensive, detailed content that enriches every aspect while maintaining DMG principles.

ADVENTURE FRAMEWORK:

Party Level: ${setup.partyLevel}
Party Size: ${setup.partySize}
Tone: ${setup.tone || '[Not specified]'}
Setting: ${setup.setting || setup.settingCustom || '[Not specified]'}
Adventure Length: ${setup.adventureLength}

${campaignContext}

PREMISE/SITUATION:
Situation: ${adventureDraft.premise.situation || '[Not specified]'}
Conflict: ${adventureDraft.premise.conflict || '[Not specified]'}
What Makes It Unique: ${adventureDraft.premise.whatMakesItUnique || '[Not specified]'}
Stakes: ${adventureDraft.premise.stakes || '[Not specified]'}
Time Pressure: ${adventureDraft.premise.timePressure || '[Not specified]'}

HOOK:
Type: ${adventureDraft.hook.hookType || '[Not specified]'}
Details: ${adventureDraft.hook.hookDetails || '[Not specified]'}
Why Party Cares: ${adventureDraft.hook.whyPartyCares || '[Not specified]'}
Refusal Plan: ${adventureDraft.hook.refusalPlan || '[Not specified]'}

THREADS:
${adventureDraft.threads.map((t, i) => `${i + 1}. ${t.lead || '[Not specified]'} → ${t.whereItPoints || ''} (Cost if ignored: ${t.costIfIgnored || ''})`).join('\n') || '[No threads yet]'}

ENCOUNTERS:
${adventureDraft.encounters.map((e, i) => `${i + 1}. Objective: ${e.objective || ''} | Obstacle: ${e.obstacle || ''} | Type: ${(e.type || []).join(', ')}`).join('\n') || '[No encounters yet]'}

NPCS:
${adventureDraft.npcs.map(n => `- ${n.name || '[Unnamed]'}: ${n.role || ''} (${n.location || ''})`).join('\n') || '[No NPCs yet]'}

LOCATIONS:
${adventureDraft.locations.map(l => `- ${l.name || '[Unnamed]'}: ${l.description || ''}`).join('\n') || '[No locations yet]'}

ENDINGS:
Expected: ${adventureDraft.endings.expected || '[Not specified]'}
Alternatives: ${adventureDraft.endings.alternatives.filter(a => a).join(' | ') || '[Not specified]'}
Villain Dies Early: ${adventureDraft.endings.villainDiesEarly || '[Not specified]'}

REWARDS:
${JSON.stringify(adventureDraft.rewards, null, 2)}

REQUIREMENTS:
1. Maintain DMG principles: situations over plots, player agency, fail-forward design
2. Expand each encounter with rich detail while preserving objective + obstacle structure
3. Deepen NPCs with personality, voice, secrets, and motivations
4. Enrich locations with sensory details, history, and interactive elements
5. Strengthen threads with clear consequences and multiple pathways
6. Ensure all content is level-appropriate for party level ${setup.partyLevel}
7. Maintain tone: ${setup.tone || 'appropriate to the adventure'}

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this exact schema (no markdown, no explanations):

{
  "premise": {
    "situation": "String (expanded, 2-3 sentences)",
    "conflict": "String (expanded, 2-3 sentences)",
    "whatMakesItUnique": "String (expanded, 1-2 sentences)",
    "stakes": "String (expanded, 2-3 sentences)",
    "timePressure": "String (expanded, 1-2 sentences, or empty if none)"
  },
  "hook": {
    "hookDetails": "String (expanded, 2-3 sentences)",
    "whyPartyCares": "String (expanded, 2-3 sentences)",
    "refusalPlan": "String (expanded, 1-2 sentences)"
  },
  "threads": [
    {
      "id": "String (must match original thread ID if exists, or new UUID)",
      "lead": "String (expanded, 1-2 sentences)",
      "whereItPoints": "String (expanded, 1 sentence)",
      "costIfIgnored": "String (expanded, 1-2 sentences)"
    }
  ],
  "encounters": [
    {
      "id": "String (must match original encounter ID if exists, or new UUID)",
      "objective": "String (expanded, 1-2 sentences)",
      "obstacle": "String (expanded, 2-3 sentences)",
      "whatItAccomplishes": "String (expanded, 2-3 sentences)",
      "informationRevealed": "String (expanded, 1-2 sentences)",
      "type": ["Exploration", "Social", "Combat"],
      "trigger": "String (expanded, 1-2 sentences)",
      "consequence": "String (expanded, 2-3 sentences, must include fail-forward)",
      "difficultyNote": "String (specific DC or CR suggestions)",
      "treasure": "String (expanded, or empty)"
    }
  ],
  "npcs": [
    {
      "id": "String (must match original NPC ID if exists, or new UUID)",
      "name": "String",
      "role": "String (expanded, 1 sentence)",
      "motivation": "String (expanded, 2-3 sentences)",
      "relationship": "String (expanded, 1-2 sentences)",
      "location": "String"
    }
  ],
  "locations": [
    {
      "id": "String (must match original location ID if exists, or new UUID)",
      "name": "String",
      "description": "String (expanded, 3-4 sentences)",
      "features": "String (expanded, 2-3 sentences, bullet points or comma-separated)"
    }
  ],
  "endings": {
    "expected": "String (expanded, 2-3 sentences)",
    "alternatives": [
      "String (expanded, 2-3 sentences)",
      "String (expanded, 2-3 sentences)"
    ],
    "villainDiesEarly": "String (expanded, 1-2 sentences)"
  },
  "rewards": {
    "treasure": "String (expanded, specific amounts/types)",
    "magicItems": "String (expanded, specific items with brief descriptions)",
    "experience": null,
    "milestone": true,
    "other": "String (expanded, or empty)"
  }
}

Important: 
- Preserve original IDs for existing items
- Expand all text fields with rich detail
- Output ONLY JSON, no markdown code blocks
- Ensure all required fields are filled`;

    return prompt;
}

function buildCampaignContext() {
    if (campaignSettings.recurringNPCs.length === 0 && 
        campaignSettings.recurringLocations.length === 0 && 
        campaignSettings.recurringFactions.length === 0) {
        return '';
    }

    let context = '\nCAMPAIGN CONTEXT:\n';
    context += `Campaign Hub: ${campaignSettings.campaignHub}\n`;
    
    if (campaignSettings.recurringNPCs.length > 0) {
        context += '\nRecurring NPCs:\n';
        campaignSettings.recurringNPCs.forEach(npc => {
            context += `- ${npc.name}: ${npc.role} (${npc.defaultLocation || ''}) - ${npc.motivation || ''}\n`;
        });
    }
    
    if (campaignSettings.recurringLocations.length > 0) {
        context += '\nRecurring Locations:\n';
        campaignSettings.recurringLocations.forEach(loc => {
            context += `- ${loc.name}: ${loc.description || ''}\n`;
        });
    }
    
    if (campaignSettings.recurringFactions.length > 0) {
        context += '\nRecurring Factions:\n';
        campaignSettings.recurringFactions.forEach(faction => {
            context += `- ${faction.name}: ${faction.goals || ''}\n`;
        });
    }
    
    return context;
}

function copyAIPrompt() {
    const textarea = document.getElementById('ai-prompt-text');
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    
    try {
        document.execCommand('copy');
        alert('Prompt copied to clipboard!');
    } catch (err) {
        alert('Failed to copy. Please select and copy manually.');
    }
}

function openChatGPT() {
    window.open('https://chat.openai.com', '_blank');
}

function parseAIResponseFromTextarea() {
    const textarea = document.getElementById('ai-response-textarea');
    if (!textarea) {
        alert('Response textarea not found');
        return;
    }
    
    const jsonText = textarea.value.trim();
    if (!jsonText) {
        alert('Please paste the AI response first.');
        return;
    }
    
    try {
        let cleanedText = jsonText;
        
        // Remove markdown code blocks if present
        cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        cleanedText = cleanedText.trim();
        
        // Try to find JSON object
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanedText = jsonMatch[0];
        }
        
        const aiData = JSON.parse(cleanedText);
        parseAIResponse(aiData);
        
        // Clear the textarea after successful parse
        textarea.value = '';
    } catch (err) {
        alert('Failed to parse AI response: ' + err.message + '\n\nPlease ensure the response is valid JSON.');
        console.error('Parse error:', err);
    }
}

function clearAIResponse() {
    const textarea = document.getElementById('ai-response-textarea');
    if (textarea) {
        textarea.value = '';
    }
    const statusDiv = document.getElementById('ai-parse-status');
    if (statusDiv) {
        statusDiv.style.display = 'none';
    }
}

function parseAIResponse(aiData) {
    const changedSections = {};
    
    // Store pre-parse state for change detection
    const preParseState = JSON.parse(JSON.stringify(adventureDraft));
    
    // Update premise
    if (aiData.premise) {
        if (aiData.premise.situation) {
            adventureDraft.premise.situation = aiData.premise.situation;
            changedSections.premise = true;
        }
        if (aiData.premise.conflict) {
            adventureDraft.premise.conflict = aiData.premise.conflict;
            changedSections.premise = true;
        }
        if (aiData.premise.whatMakesItUnique) {
            adventureDraft.premise.whatMakesItUnique = aiData.premise.whatMakesItUnique;
            changedSections.premise = true;
        }
        if (aiData.premise.stakes) {
            adventureDraft.premise.stakes = aiData.premise.stakes;
            changedSections.premise = true;
        }
        if (aiData.premise.timePressure !== undefined) {
            adventureDraft.premise.timePressure = aiData.premise.timePressure;
            changedSections.premise = true;
        }
    }
    
    // Update hook (preserve hookType if not in AI response)
    if (aiData.hook) {
        if (aiData.hook.hookType) {
            adventureDraft.hook.hookType = aiData.hook.hookType;
            changedSections.hook = true;
        }
        // Preserve existing hookType if AI doesn't provide it
        if (aiData.hook.hookDetails) {
            adventureDraft.hook.hookDetails = aiData.hook.hookDetails;
            changedSections.hook = true;
        }
        if (aiData.hook.whyPartyCares) {
            adventureDraft.hook.whyPartyCares = aiData.hook.whyPartyCares;
            changedSections.hook = true;
        }
        if (aiData.hook.refusalPlan) {
            adventureDraft.hook.refusalPlan = aiData.hook.refusalPlan;
            changedSections.hook = true;
        }
    }
    
    // Update threads (preserve IDs, merge)
    if (aiData.threads && Array.isArray(aiData.threads)) {
        aiData.threads.forEach(aiThread => {
            const existing = adventureDraft.threads.find(t => t.id === aiThread.id);
            if (existing) {
                Object.assign(existing, aiThread);
            } else {
                adventureDraft.threads.push(aiThread);
            }
        });
        if (aiData.threads.length > 0) changedSections.threads = true;
    }
    
    // Update encounters (preserve IDs, merge)
    if (aiData.encounters && Array.isArray(aiData.encounters)) {
        aiData.encounters.forEach(aiEncounter => {
            const existing = adventureDraft.encounters.find(e => e.id === aiEncounter.id);
            if (existing) {
                Object.assign(existing, aiEncounter);
            } else {
                adventureDraft.encounters.push(aiEncounter);
            }
        });
        if (aiData.encounters.length > 0) changedSections.encounters = true;
    }
    
    // Update NPCs (preserve IDs, merge)
    if (aiData.npcs && Array.isArray(aiData.npcs)) {
        aiData.npcs.forEach(aiNPC => {
            const existing = adventureDraft.npcs.find(n => n.id === aiNPC.id);
            if (existing) {
                Object.assign(existing, aiNPC);
            } else {
                adventureDraft.npcs.push(aiNPC);
            }
        });
        if (aiData.npcs.length > 0) changedSections.npcs = true;
    }
    
    // Update locations (preserve IDs, merge)
    if (aiData.locations && Array.isArray(aiData.locations)) {
        aiData.locations.forEach(aiLocation => {
            const existing = adventureDraft.locations.find(l => l.id === aiLocation.id);
            if (existing) {
                Object.assign(existing, aiLocation);
            } else {
                adventureDraft.locations.push(aiLocation);
            }
        });
        if (aiData.locations.length > 0) changedSections.locations = true;
    }
    
    // Update endings
    if (aiData.endings) {
        if (aiData.endings.expected) {
            adventureDraft.endings.expected = aiData.endings.expected;
            changedSections.endings = true;
        }
        if (aiData.endings.alternatives) {
            adventureDraft.endings.alternatives = aiData.endings.alternatives;
            changedSections.endings = true;
        }
        if (aiData.endings.villainDiesEarly) {
            adventureDraft.endings.villainDiesEarly = aiData.endings.villainDiesEarly;
            changedSections.endings = true;
        }
    }
    
    // Update rewards
    if (aiData.rewards) {
        if (aiData.rewards.treasure !== undefined) {
            adventureDraft.rewards.treasure = aiData.rewards.treasure;
            changedSections.rewards = true;
        }
        if (aiData.rewards.magicItems !== undefined) {
            adventureDraft.rewards.magicItems = aiData.rewards.magicItems;
            changedSections.rewards = true;
        }
        if (aiData.rewards.experience !== undefined) {
            adventureDraft.rewards.experience = aiData.rewards.experience;
            changedSections.rewards = true;
        }
        if (aiData.rewards.milestone !== undefined) {
            adventureDraft.rewards.milestone = aiData.rewards.milestone;
            changedSections.rewards = true;
        }
        if (aiData.rewards.other !== undefined) {
            adventureDraft.rewards.other = aiData.rewards.other;
            changedSections.rewards = true;
        }
    }
    
    // Save draft
    saveDraft();
    
    // Re-render builder sections
    renderBuilderSections();
    
    // Highlight changed sections
    Object.keys(changedSections).forEach(sectionId => {
        const card = document.getElementById(`section-${sectionId}`);
        if (card) {
            card.classList.add('changed');
            setTimeout(() => {
                card.classList.remove('changed');
            }, 3000);
        }
    });
    
    // Auto-collapse all, then expand first changed section
    document.querySelectorAll('.section-card').forEach(card => {
        card.classList.remove('expanded');
    });
    
    const firstChanged = Object.keys(changedSections)[0];
    if (firstChanged) {
        setTimeout(() => {
            toggleSection(firstChanged);
            const card = document.getElementById(`section-${firstChanged}`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 100);
    }
    
    // Show success message
    const statusDiv = document.getElementById('ai-parse-status');
    const changedCount = Object.keys(changedSections).length;
    statusDiv.innerHTML = `<div class="warning-box" style="background-color: #d4edda; border-color: #28a745; color: #155724;">
        <strong>✓ Success!</strong> Imported ${changedCount} section(s) from AI. Review and refine.
    </div>`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

// ============================================================================
// Campaign Settings
// ============================================================================

function renderCampaignSettings() {
    populateCampaignForm();
    renderCampaignNPCs();
    renderCampaignLocations();
    renderCampaignFactions();
    populateRecurringPickers();
    updateCleanupButton();
}

function populateCampaignForm() {
    document.getElementById('campaign-hub').value = campaignSettings.campaignHub || 'Waterdeep';
}

function renderCampaignNPCs() {
    const container = document.getElementById('campaign-npcs-list');
    container.innerHTML = '';
    
    campaignSettings.recurringNPCs.forEach((npc, index) => {
        const card = document.createElement('div');
        card.className = 'npc-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${npc.name || `NPC ${index + 1}`}</div>
                <button type="button" class="btn-remove" onclick="removeCampaignNPC('${npc.id}')">Remove</button>
            </div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" class="campaign-npc-field" data-id="${npc.id}" data-field="name" value="${escapeText(npc.name || '')}">
            </div>
            <div class="form-group">
                <label>Role</label>
                <input type="text" class="campaign-npc-field" data-id="${npc.id}" data-field="role" value="${escapeText(npc.role || '')}">
            </div>
            <div class="form-group">
                <label>Motivation</label>
                <textarea class="campaign-npc-field" data-id="${npc.id}" data-field="motivation" rows="2">${escapeText(npc.motivation || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Default Location</label>
                <input type="text" class="campaign-npc-field" data-id="${npc.id}" data-field="defaultLocation" value="${escapeText(npc.defaultLocation || '')}">
            </div>
        `;
        container.appendChild(card);
    });
    
    attachCampaignListeners('npc');
}

function renderCampaignLocations() {
    const container = document.getElementById('campaign-locations-list');
    container.innerHTML = '';
    
    campaignSettings.recurringLocations.forEach((loc, index) => {
        const card = document.createElement('div');
        card.className = 'location-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${loc.name || `Location ${index + 1}`}</div>
                <button type="button" class="btn-remove" onclick="removeCampaignLocation('${loc.id}')">Remove</button>
            </div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" class="campaign-location-field" data-id="${loc.id}" data-field="name" value="${escapeText(loc.name || '')}">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea class="campaign-location-field" data-id="${loc.id}" data-field="description" rows="3">${escapeText(loc.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Features</label>
                <textarea class="campaign-location-field" data-id="${loc.id}" data-field="features" rows="2">${escapeText(loc.features || '')}</textarea>
            </div>
        `;
        container.appendChild(card);
    });
    
    attachCampaignListeners('location');
}

function renderCampaignFactions() {
    const container = document.getElementById('campaign-factions-list');
    container.innerHTML = '';
    
    campaignSettings.recurringFactions.forEach((faction, index) => {
        const card = document.createElement('div');
        card.className = 'form-section';
        card.style.marginBottom = '1rem';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${faction.name || `Faction ${index + 1}`}</div>
                <button type="button" class="btn-remove" onclick="removeCampaignFaction('${faction.id}')">Remove</button>
            </div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" class="campaign-faction-field" data-id="${faction.id}" data-field="name" value="${escapeText(faction.name || '')}">
            </div>
            <div class="form-group">
                <label>Goals</label>
                <textarea class="campaign-faction-field" data-id="${faction.id}" data-field="goals" rows="2">${escapeText(faction.goals || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Relationships</label>
                <textarea class="campaign-faction-field" data-id="${faction.id}" data-field="relationships" rows="2">${escapeText(faction.relationships || '')}</textarea>
            </div>
        `;
        container.appendChild(card);
    });
    
    attachCampaignListeners('faction');
}

function attachCampaignListeners(type) {
    const inputs = document.querySelectorAll(`.campaign-${type}-field`);
    inputs.forEach(input => {
        input.addEventListener('input', debounce(() => {
            updateCampaignField(type, input);
            saveCampaignSettings();
            updateCleanupButton();
        }, 500));
    });
}

function updateCampaignField(type, input) {
    const id = input.getAttribute('data-id');
    const field = input.getAttribute('data-field');
    const value = input.value;
    
    const array = campaignSettings[`recurring${type.charAt(0).toUpperCase() + type.slice(1)}s`];
    const item = array.find(i => i.id === id);
    if (item) {
        item[field] = value;
    }
}

function addCampaignNPC() {
    const npc = {
        id: generateId(),
        name: '',
        role: '',
        motivation: '',
        defaultLocation: '',
        notes: '',
        createdAt: new Date().toISOString(),
        usedIn: []
    };
    campaignSettings.recurringNPCs.push(npc);
    renderCampaignNPCs();
    populateRecurringPickers();
    saveCampaignSettings();
    updateCleanupButton();
}

function addCampaignLocation() {
    const location = {
        id: generateId(),
        name: '',
        description: '',
        features: '',
        createdAt: new Date().toISOString(),
        usedIn: []
    };
    campaignSettings.recurringLocations.push(location);
    renderCampaignLocations();
    populateRecurringPickers();
    saveCampaignSettings();
    updateCleanupButton();
}

function addCampaignFaction() {
    const faction = {
        id: generateId(),
        name: '',
        goals: '',
        relationships: '',
        createdAt: new Date().toISOString(),
        usedIn: []
    };
    campaignSettings.recurringFactions.push(faction);
    renderCampaignFactions();
    populateRecurringPickers();
    saveCampaignSettings();
    updateCleanupButton();
}

function removeCampaignNPC(id) {
    const npc = campaignSettings.recurringNPCs.find(n => n.id === id);
    const name = npc?.name || 'this NPC';
    if (confirm(`Are you sure you want to remove "${name}"? This cannot be undone.`)) {
        campaignSettings.recurringNPCs = campaignSettings.recurringNPCs.filter(n => n.id !== id);
        renderCampaignNPCs();
        populateRecurringPickers();
        saveCampaignSettings();
        updateCleanupButton();
    }
}

function removeCampaignLocation(id) {
    const loc = campaignSettings.recurringLocations.find(l => l.id === id);
    const name = loc?.name || 'this location';
    if (confirm(`Are you sure you want to remove "${name}"? This cannot be undone.`)) {
        campaignSettings.recurringLocations = campaignSettings.recurringLocations.filter(l => l.id !== id);
        renderCampaignLocations();
        populateRecurringPickers();
        saveCampaignSettings();
        updateCleanupButton();
    }
}

function removeCampaignFaction(id) {
    const faction = campaignSettings.recurringFactions.find(f => f.id === id);
    const name = faction?.name || 'this faction';
    if (confirm(`Are you sure you want to remove "${name}"? This cannot be undone.`)) {
        campaignSettings.recurringFactions = campaignSettings.recurringFactions.filter(f => f.id !== id);
        renderCampaignFactions();
        populateRecurringPickers();
        saveCampaignSettings();
        updateCleanupButton();
    }
}

function hasBlankEntries() {
    // Check for blank NPCs
    const hasBlankNPCs = campaignSettings.recurringNPCs.some(npc => {
        const hasName = npc.name && npc.name.trim() !== '';
        const hasContent = npc.role || npc.motivation || npc.defaultLocation;
        return !hasName && !hasContent;
    });
    
    // Check for blank Locations
    const hasBlankLocations = campaignSettings.recurringLocations.some(loc => {
        const hasName = loc.name && loc.name.trim() !== '';
        const hasContent = loc.description || loc.features;
        return !hasName && !hasContent;
    });
    
    // Check for blank Factions
    const hasBlankFactions = campaignSettings.recurringFactions.some(faction => {
        const hasName = faction.name && faction.name.trim() !== '';
        const hasContent = faction.goals || faction.relationships;
        return !hasName && !hasContent;
    });
    
    return hasBlankNPCs || hasBlankLocations || hasBlankFactions;
}

function updateCleanupButton() {
    const cleanupBtn = document.getElementById('cleanup-btn');
    if (cleanupBtn) {
        cleanupBtn.style.display = hasBlankEntries() ? 'inline-block' : 'none';
    }
}

function cleanupCampaignSettings() {
    let removed = 0;
    
    // Remove blank NPCs
    const npcCount = campaignSettings.recurringNPCs.length;
    campaignSettings.recurringNPCs = campaignSettings.recurringNPCs.filter(npc => {
        const hasName = npc.name && npc.name.trim() !== '';
        const hasContent = npc.role || npc.motivation || npc.defaultLocation;
        return hasName || hasContent;
    });
    removed += npcCount - campaignSettings.recurringNPCs.length;
    
    // Remove blank Locations
    const locCount = campaignSettings.recurringLocations.length;
    campaignSettings.recurringLocations = campaignSettings.recurringLocations.filter(loc => {
        const hasName = loc.name && loc.name.trim() !== '';
        const hasContent = loc.description || loc.features;
        return hasName || hasContent;
    });
    removed += locCount - campaignSettings.recurringLocations.length;
    
    // Remove blank Factions
    const factionCount = campaignSettings.recurringFactions.length;
    campaignSettings.recurringFactions = campaignSettings.recurringFactions.filter(faction => {
        const hasName = faction.name && faction.name.trim() !== '';
        const hasContent = faction.goals || faction.relationships;
        return hasName || hasContent;
    });
    removed += factionCount - campaignSettings.recurringFactions.length;
    
    if (removed > 0) {
        renderCampaignNPCs();
        renderCampaignLocations();
        renderCampaignFactions();
        populateRecurringPickers();
        saveCampaignSettings();
        updateCleanupButton();
        alert(`Cleaned up ${removed} blank or unnamed ${removed === 1 ? 'entry' : 'entries'}.`);
    } else {
        alert('No blank or unnamed entries found.');
        updateCleanupButton();
    }
}

function populateRecurringPickers() {
    // Populate NPCs picker
    const npcsSelect = document.getElementById('setup-npcs-select');
    if (npcsSelect) {
        npcsSelect.innerHTML = '';
        if (campaignSettings.recurringNPCs.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No recurring NPCs yet. Add them in Campaign Settings.';
            option.disabled = true;
            npcsSelect.appendChild(option);
        } else {
            campaignSettings.recurringNPCs.forEach(npc => {
                const option = document.createElement('option');
                option.value = npc.id;
                option.textContent = npc.name || '[Unnamed NPC]';
                npcsSelect.appendChild(option);
            });
        }
    }
    
    // Populate Locations picker
    const locationsSelect = document.getElementById('setup-locations-select');
    if (locationsSelect) {
        locationsSelect.innerHTML = '';
        if (campaignSettings.recurringLocations.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No recurring locations yet. Add them in Campaign Settings.';
            option.disabled = true;
            locationsSelect.appendChild(option);
        } else {
            campaignSettings.recurringLocations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc.id;
                option.textContent = loc.name || '[Unnamed Location]';
                locationsSelect.appendChild(option);
            });
        }
    }
    
    // Populate Factions picker
    const factionsSelect = document.getElementById('setup-factions-select');
    if (factionsSelect) {
        factionsSelect.innerHTML = '';
        if (campaignSettings.recurringFactions.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No recurring factions yet. Add them in Campaign Settings.';
            option.disabled = true;
            factionsSelect.appendChild(option);
        } else {
            campaignSettings.recurringFactions.forEach(faction => {
                const option = document.createElement('option');
                option.value = faction.id;
                option.textContent = faction.name || '[Unnamed Faction]';
                factionsSelect.appendChild(option);
            });
        }
    }
}

function saveCampaignSettings() {
    campaignSettings.campaignHub = document.getElementById('campaign-hub').value;
    campaignSettings.schemaVersion = SCHEMA_VERSION;
    localStorage.setItem(CAMPAIGN_SETTINGS_KEY, JSON.stringify(campaignSettings));
    
    // Update location dropdown in setup
    populateLocationDropdown();
}

// ============================================================================
// Export/Import
// ============================================================================

function exportJSON() {
    collectSetupData();
    adventureDraft.lastModified = new Date().toISOString();
    
    const json = JSON.stringify(adventureDraft, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adventure_${adventureDraft.adventureId || Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportAdventureJSON() {
    collectSetupData();
    adventureDraft.lastModified = new Date().toISOString();
    
    // Create a clean export version with all data
    const exportData = {
        ...adventureDraft,
        campaignContext: {
            hub: campaignSettings.campaignHub,
            recurringNPCs: campaignSettings.recurringNPCs.filter(npc => 
                adventureDraft.setup.constraints.recurringNPCIds.includes(npc.id)
            ),
            recurringLocations: campaignSettings.recurringLocations.filter(loc => 
                adventureDraft.setup.constraints.recurringLocationIds.includes(loc.id)
            ),
            recurringFactions: campaignSettings.recurringFactions.filter(faction => 
                adventureDraft.setup.constraints.recurringFactionIds.includes(faction.id)
            )
        }
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adventure_module_data_${adventureDraft.adventureId || Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            
            // Handle schema migration if needed
            if (imported.schemaVersion !== SCHEMA_VERSION) {
                imported = migrateSchema(imported, imported.schemaVersion, SCHEMA_VERSION);
            }
            
            adventureDraft = imported;
            saveDraft();
            
            // Refresh current view
            if (document.getElementById('view-setup').classList.contains('active')) {
                populateSetupForm();
            } else if (document.getElementById('view-builder').classList.contains('active')) {
                renderBuilderSections();
            }
            
            alert('Adventure imported successfully!');
        } catch (err) {
            alert('Failed to import JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function migrateSchema(data, fromVersion, toVersion) {
    // Basic migration - ensure all required fields exist
    if (!data.setup) data.setup = adventureDraft.setup;
    if (!data.premise) data.premise = adventureDraft.premise;
    if (!data.hook) data.hook = adventureDraft.hook;
    if (!data.threads) data.threads = [];
    if (!data.encounters) data.encounters = [];
    if (!data.npcs) data.npcs = [];
    if (!data.locations) data.locations = [];
    if (!data.endings) data.endings = adventureDraft.endings;
    if (!data.rewards) data.rewards = adventureDraft.rewards;
    
    data.schemaVersion = SCHEMA_VERSION;
    return data;
}

// ============================================================================
// Persistence
// ============================================================================

function saveDraft() {
    adventureDraft.lastModified = new Date().toISOString();
    if (!adventureDraft.adventureId) {
        adventureDraft.adventureId = generateId();
        adventureDraft.createdAt = new Date().toISOString();
    }
    adventureDraft.schemaVersion = SCHEMA_VERSION;
    localStorage.setItem(ADVENTURE_DRAFT_KEY, JSON.stringify(adventureDraft));
}

function loadAdventureDraft() {
    const saved = localStorage.getItem(ADVENTURE_DRAFT_KEY);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.schemaVersion !== SCHEMA_VERSION) {
                adventureDraft = migrateSchema(data, data.schemaVersion, SCHEMA_VERSION);
            } else {
                adventureDraft = { ...adventureDraft, ...data };
            }
        } catch (err) {
            console.error('Failed to load adventure draft:', err);
        }
    }
}

function loadCampaignSettings() {
    const saved = localStorage.getItem(CAMPAIGN_SETTINGS_KEY);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.schemaVersion !== SCHEMA_VERSION) {
                campaignSettings.schemaVersion = SCHEMA_VERSION;
            }
            campaignSettings = { ...campaignSettings, ...data };
        } catch (err) {
            console.error('Failed to load campaign settings:', err);
        }
    }
}

function saveUIState() {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(uiState));
}

function loadUIState() {
    const saved = localStorage.getItem(UI_STATE_KEY);
    if (saved) {
        try {
            uiState = { ...uiState, ...JSON.parse(saved) };
        } catch (err) {
            console.error('Failed to load UI state:', err);
        }
    }
}

// ============================================================================
// Initialization
// ============================================================================

function init() {
    loadCampaignSettings();
    loadAdventureDraft();
    loadUIState();
    initNavigation();
    initSetup();
    
    // Auto-save campaign hub changes
    const campaignHubInput = document.getElementById('campaign-hub');
    if (campaignHubInput) {
        campaignHubInput.addEventListener('input', debounce(saveCampaignSettings, 500));
    }
}

// ============================================================================
// Module Generator
// ============================================================================

function generateModulePrompt() {
    collectSetupData();
    
    // Validate that we have content
    if (!adventureDraft.premise.situation || !adventureDraft.premise.conflict) {
        alert('Please fill in at least the Premise/Situation section in Adventure Builder before generating a module prompt.');
        return;
    }
    
    const moduleStyle = document.getElementById('module-style').value;
    const includeIntro = document.getElementById('module-intro').checked;
    const includeChapters = document.getElementById('module-chapters').checked;
    const includeNPCs = document.getElementById('module-npcs').checked;
    const includeLocations = document.getElementById('module-locations').checked;
    const includeTreasure = document.getElementById('module-treasure').checked;
    const includeMaps = document.getElementById('module-maps').checked;
    
    const prompt = buildModulePrompt(moduleStyle, {
        includeIntro,
        includeChapters,
        includeNPCs,
        includeLocations,
        includeTreasure,
        includeMaps
    });
    
    const outputDiv = document.getElementById('module-prompt-output');
    const textarea = document.getElementById('module-prompt-text');
    textarea.value = prompt;
    outputDiv.style.display = 'block';
    outputDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function buildModulePrompt(style, options) {
    const setup = adventureDraft.setup;
    
    let prompt = `You are an expert D&D 5e adventure module writer. Your task is to create a comprehensive, publication-ready adventure module in the style of official D&D modules.

ROLE:
You are writing a D&D 5e adventure module that will be used by Dungeon Masters to run engaging, well-structured adventures. Your writing should be clear, detailed, and follow the format and style of official D&D adventure modules.

OUTPUT FORMAT:
Create a full adventure module document that includes:`;

    if (options.includeIntro) {
        prompt += `
- **Introduction**: Adventure overview, background, and how to use this module`;
    }
    if (options.includeChapters) {
        prompt += `
- **Chapter Structure**: Break the adventure into logical chapters or sections, each with:
  - Clear chapter title and overview
  - Detailed encounter descriptions
  - NPC interactions and dialogue suggestions
  - Location descriptions with sensory details
  - Player decision points and branching paths
  - Consequences for different player choices`;
    }
    if (options.includeNPCs) {
        prompt += `
- **NPC Appendix**: Detailed NPC descriptions including:
  - Physical appearance
  - Personality traits and mannerisms
  - Motivations and goals
  - Suggested dialogue
  - Role in the adventure`;
    }
    if (options.includeLocations) {
        prompt += `
- **Locations Appendix**: Comprehensive location descriptions including:
  - Visual, auditory, and sensory details
  - Key features and interactive elements
  - History and significance
  - Map descriptions (if applicable)`;
    }
    if (options.includeTreasure) {
        prompt += `
- **Treasure & Rewards**: Detailed treasure listings with:
  - Specific amounts and types
  - Magic item descriptions
  - Story rewards and consequences`;
    }
    if (options.includeMaps) {
        prompt += `
- **Map Descriptions**: Detailed descriptions of areas that can be used to create maps`;
    }

    prompt += `

STYLE GUIDELINES:
Based on the selected style "${style}", follow these guidelines:`;

    if (style === 'official') {
        prompt += `
- Format similar to "Hoard of the Dragon Queen" or "Tyranny of Dragons"
- Clear chapter structure with numbered encounters
- Boxed text for read-aloud descriptions
- Detailed NPC stat blocks and motivations
- Comprehensive location descriptions
- Multiple paths and player agency
- Level-appropriate challenges and rewards`;
    } else if (style === 'detailed') {
        prompt += `
- Format similar to "Curse of Strahd" or "Descent into Avernus"
- Rich atmospheric descriptions
- Deep character development
- Complex interwoven storylines
- Extensive location details
- Multiple endings and player choices
- Dark themes and moral complexity`;
    } else if (style === 'concise') {
        prompt += `
- Format similar to "Lost Mine of Phandelver" or "Dragon of Icespire Peak"
- Clear, straightforward structure
- Easy-to-follow encounter flow
- Essential NPC details without overwhelming information
- Focused location descriptions
- Clear objectives and outcomes
- Beginner-friendly presentation`;
    }

    prompt += `

GUARDRAILS AND REQUIREMENTS:
1. **Maintain DMG Principles**: 
   - Adventures are situations, not fixed plots
   - Players are co-authors - provide multiple paths and outcomes
   - Fail-forward design - failures should advance the story
   - Player agency - avoid railroading

2. **Structure Requirements**:
   - Use clear headings and subheadings
   - Include boxed text for read-aloud descriptions (format as [BOXED TEXT])
   - Number encounters and key locations
   - Provide clear transition text between scenes

3. **Content Requirements**:
   - All encounters must have clear objectives and obstacles
   - NPCs should have distinct voices and motivations
   - Locations should be vivid and interactive
   - Include suggested DCs for skill checks
   - Provide level-appropriate challenges (Party Level: ${setup.partyLevel || 'Not specified'})

4. **Tone and Style**:
   - Maintain the tone: ${setup.tone || 'Appropriate to the adventure'}
   - Write in present tense for descriptions
   - Use active voice
   - Be specific and detailed, not vague

5. **Player Agency**:
   - Provide multiple solutions to problems
   - Include "What if the players..." sections for common deviations
   - Avoid single-outcome scenarios
   - Reward creative problem-solving

6. **Completeness**:
   - Include all information a DM needs to run the adventure
   - Provide stat blocks or references for monsters
   - Include treasure and reward details
   - Add notes for scaling difficulty if needed

ADVENTURE DATA:
I will upload a JSON file containing all the adventure data. This file includes:
- Adventure setup (party level, tone, setting, length)
- Premise and situation details
- Hook and motivation information
- Threads (investigatable leads)
- Detailed encounters with objectives and obstacles
- NPC descriptions and motivations
- Location descriptions and features
- Ending scenarios
- Rewards and treasure

YOUR TASK:
1. Wait for me to upload the JSON file
2. Read and understand the complete adventure structure
3. Transform this data into a full adventure module document following the style and format requirements above
4. Ensure all sections are comprehensive and publication-ready
5. Maintain the adventure's core structure while expanding it into a full module format
6. Add appropriate detail, atmosphere, and DM guidance throughout

OUTPUT:
Generate the complete adventure module document. Structure it clearly with all requested sections. Make it ready for a DM to pick up and run with minimal additional preparation.

Begin by acknowledging you understand the task and are ready for the JSON file upload.`;

    return prompt;
}

function copyModulePrompt() {
    const textarea = document.getElementById('module-prompt-text');
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    
    try {
        document.execCommand('copy');
        alert('Module prompt copied to clipboard!');
    } catch (err) {
        alert('Failed to copy. Please select and copy manually.');
    }
}

// Make functions available globally
window.toggleSection = toggleSection;
window.toggleAllSections = toggleAllSections;
window.addArrayItem = addArrayItem;
window.removeArrayItem = removeArrayItem;
window.toggleConstraints = toggleConstraints;
window.navigateToBuilder = navigateToBuilder;
window.saveSetup = saveSetup;
window.generateAIPrompt = generateAIPrompt;
window.copyAIPrompt = copyAIPrompt;
window.openChatGPT = openChatGPT;
window.parseAIResponseFromTextarea = parseAIResponseFromTextarea;
window.clearAIResponse = clearAIResponse;
window.exportJSON = exportJSON;
window.exportAdventureJSON = exportAdventureJSON;
window.importJSON = importJSON;
window.addCampaignNPC = addCampaignNPC;
window.addCampaignLocation = addCampaignLocation;
window.addCampaignFaction = addCampaignFaction;
window.removeCampaignNPC = removeCampaignNPC;
window.removeCampaignLocation = removeCampaignLocation;
window.removeCampaignFaction = removeCampaignFaction;
window.cleanupCampaignSettings = cleanupCampaignSettings;
window.saveCampaignSettings = saveCampaignSettings;
window.switchView = switchView;
window.generateModulePrompt = generateModulePrompt;
window.copyModulePrompt = copyModulePrompt;

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}