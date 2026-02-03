// ============================================================================
// D&D 5e Adventure Builder - DMG-Faithful Implementation
// ============================================================================

// ============================================================================
// Core Structure & Data Model
// ============================================================================

const SCHEMA_VERSION = "1.0.0";

let adventureData = {
    schemaVersion: SCHEMA_VERSION,
    // Section 1: Premise
    title: "",
    partyLevel: null,
    partySize: 4,
    tone: "",
    location: "",
    situation: "",
    conflict: "",
    whatMakesItUnique: "",
    stakes: "",
    timePressure: "",
    // Section 2: Hook
    hookType: "",
    hookDetails: "",
    whyPartyCares: "",
    perCharacterMotivation: [],
    refusalPlan: "",
    // Section 3: Threads
    threads: [],
    // Section 4: Encounters
    encounters: [],
    // Section 5: NPCs
    npcs: [],
    // Section 6: Locations
    locations: [],
    // Section 7: Ending
    expectedEnding: "",
    alternativeEndings: ["", ""],
    rewards: {
        treasure: "",
        magicItems: "",
        experience: null,
        milestone: false,
        other: ""
    },
    villainDiesEarlyPlan: ""
};

// Counter for generating IDs
let idCounter = 0;

// ============================================================================
// Utility Functions
// ============================================================================

function generateId() {
    // Use crypto.randomUUID if available, otherwise fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `id_${Date.now()}_${++idCounter}`;
}

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function escapeText(text) {
    // Ensure safe text rendering (no HTML injection)
    // Escapes HTML entities and quotes for use in HTML attributes
    if (!text) return "";
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        const btn = document.getElementById('copy-btn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.disabled = false;
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    }
    
    document.body.removeChild(textarea);
}

// ============================================================================
// UI Helper Functions
// ============================================================================

function toggleGuidance(button) {
    const content = button.nextElementSibling;
    const isActive = content.classList.contains('active');
    
    if (isActive) {
        content.classList.remove('active');
        button.classList.remove('active');
    } else {
        content.classList.add('active');
        button.classList.add('active');
    }
}

// Handle tone dropdown
document.addEventListener('DOMContentLoaded', function() {
    const toneSelect = document.getElementById('tone');
    const toneOther = document.getElementById('tone-other');
    
    if (toneSelect && toneOther) {
        toneSelect.addEventListener('change', function() {
            toneOther.style.display = this.value === 'Other' ? 'block' : 'none';
        });
    }

    // Load from localStorage on page load
    loadFromLocalStorage();
});

// ============================================================================
// Pipeline Functions
// ============================================================================

// 1. Collect
function collectFormData() {
    const form = document.getElementById('adventure-form');
    const formData = new FormData(form);
    
    adventureData.title = formData.get('title') || "";
    adventureData.partyLevel = parseInt(formData.get('partyLevel')) || null;
    adventureData.partySize = parseInt(formData.get('partySize')) || 4;
    adventureData.tone = formData.get('tone') === 'Other' ? formData.get('toneOther') : (formData.get('tone') || "");
    adventureData.location = formData.get('location') || "";
    adventureData.situation = formData.get('situation') || "";
    adventureData.conflict = formData.get('conflict') || "";
    adventureData.whatMakesItUnique = formData.get('whatMakesItUnique') || "";
    adventureData.stakes = formData.get('stakes') || "";
    adventureData.timePressure = formData.get('timePressure') || "";
    
    // Hook
    adventureData.hookType = formData.get('hookType') || "";
    adventureData.hookDetails = formData.get('hookDetails') || "";
    adventureData.whyPartyCares = formData.get('whyPartyCares') || "";
    adventureData.refusalPlan = formData.get('refusalPlan') || "";
    
    // Ending
    adventureData.expectedEnding = formData.get('expectedEnding') || "";
    adventureData.alternativeEndings[0] = formData.get('altEnding1') || "";
    adventureData.alternativeEndings[1] = formData.get('altEnding2') || "";
    adventureData.villainDiesEarlyPlan = formData.get('villainDiesEarlyPlan') || "";
    
    // Rewards
    adventureData.rewards.treasure = formData.get('rewardsTreasure') || "";
    adventureData.rewards.magicItems = formData.get('rewardsMagicItems') || "";
    adventureData.rewards.experience = parseInt(formData.get('rewardsXP')) || null;
    adventureData.rewards.milestone = formData.get('rewardsMilestone') === 'on';
    adventureData.rewards.other = formData.get('rewardsOther') || "";
    
    // Threads, Encounters, NPCs, Locations are managed separately
    // They'll be collected when rendering
    
    return adventureData;
}

// 2. Validate
function validateAdventure(data) {
    const errors = [];
    const warnings = [];
    
    // Hard errors
    if (!data.situation || data.situation.trim() === "") {
        errors.push("Situation is required");
    }
    if (!data.conflict || data.conflict.trim() === "") {
        errors.push("Conflict is required");
    }
    if (!data.hookType || data.hookType === "") {
        errors.push("Hook type is required");
    }
    
    // Check for at least one encounter with objective + obstacle
    const validEncounters = data.encounters.filter(e => 
        e.objective && e.objective.trim() !== "" && 
        e.obstacle && e.obstacle.trim() !== ""
    );
    if (validEncounters.length === 0) {
        errors.push("At least one encounter with objective and obstacle is required");
    }
    
    // Warnings (non-blocking)
    if (data.threads.length < 2) {
        warnings.push("DMG recommends 2-3 threads. Consider adding more.");
    }
    if (!data.stakes || data.stakes.trim() === "") {
        warnings.push("Stakes not specified. Consider adding what happens if ignored/failed/succeeded.");
    }
    if (data.encounters.some(e => !e.consequence || e.consequence.trim() === "")) {
        warnings.push("Some encounters are missing consequences (fail-forward). Consider adding them.");
    }
    
    return { errors, warnings };
}

// 3. Normalize
function normalizeAdventure(data) {
    // Trim all text fields
    Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string') {
            data[key] = data[key].trim();
        } else if (Array.isArray(data[key])) {
            data[key].forEach(item => {
                if (typeof item === 'object') {
                    Object.keys(item).forEach(subKey => {
                        if (typeof item[subKey] === 'string') {
                            item[subKey] = item[subKey].trim();
                        }
                    });
                }
            });
        } else if (typeof data[key] === 'object' && data[key] !== null) {
            Object.keys(data[key]).forEach(subKey => {
                if (typeof data[key][subKey] === 'string') {
                    data[key][subKey] = data[key][subKey].trim();
                }
            });
        }
    });
    
    // Ensure IDs exist
    data.threads.forEach(thread => {
        if (!thread.id) thread.id = generateId();
    });
    data.encounters.forEach(encounter => {
        if (!encounter.id) encounter.id = generateId();
        if (!encounter.objective) encounter.objective = "";
        if (!encounter.obstacle) encounter.obstacle = "";
        if (!encounter.linkedNpcIds) encounter.linkedNpcIds = [];
        if (!encounter.linkedThreadIds) encounter.linkedThreadIds = [];
        if (!encounter.type) encounter.type = [];
    });
    data.npcs.forEach(npc => {
        if (!npc.id) npc.id = generateId();
    });
    data.locations.forEach(location => {
        if (!location.id) location.id = generateId();
    });
    data.perCharacterMotivation.forEach(pc => {
        if (!pc.id) pc.id = generateId();
    });
    
    // Default party size
    if (!data.partySize) data.partySize = 4;
    
    // Ensure arrays exist
    if (!data.threads) data.threads = [];
    if (!data.encounters) data.encounters = [];
    if (!data.npcs) data.npcs = [];
    if (!data.locations) data.locations = [];
    if (!data.perCharacterMotivation) data.perCharacterMotivation = [];
    if (!data.alternativeEndings) data.alternativeEndings = ["", ""];
    
    return data;
}

// 4. Auto-fill
function autoFillDefaults(data) {
    const suggestions = [];
    
    // Suggest stakes if missing
    if (!data.stakes || data.stakes.trim() === "") {
        suggestions.push({ field: "stakes", suggestion: "What happens if ignored? If heroes fail? If they succeed?" });
    }
    
    // Suggest second thread if fewer than 2
    if (data.threads.length < 2 && data.encounters.length > 0) {
        suggestions.push({ field: "threads", suggestion: "Consider adding a second thread based on your first encounter's information revealed." });
    }
    
    // Suggest rewards if empty
    if (!data.rewards.treasure && !data.rewards.magicItems && !data.rewards.experience && !data.rewards.milestone) {
        suggestions.push({ field: "rewards", suggestion: `Consider ${data.partyLevel ? 'level-' + data.partyLevel : ''} appropriate rewards (treasure, magic items, XP/milestone).` });
    }
    
    // Suggest consequences for encounters
    data.encounters.forEach((encounter, index) => {
        if (!encounter.consequence || encounter.consequence.trim() === "") {
            suggestions.push({ field: `encounter_${index}`, suggestion: "Add a consequence that moves the story forward (fail-forward design)." });
        }
    });
    
    return suggestions;
}

// 5. Expand Tables (Hook Roll)
function rollHookTable() {
    // Get hook type from form
    const hookTypeInput = document.querySelector('input[name="hookType"]:checked');
    const hookType = hookTypeInput ? hookTypeInput.value : null;
    
    if (!hookType) {
        alert("Please select a hook type first");
        return;
    }
    
    const tables = {
        Patron: [
            "A local noble needs help recovering stolen artifacts",
            "The town guard captain requests aid investigating strange disappearances",
            "A merchant guild pays handsomely for protection on a dangerous trade route",
            "A religious leader asks the party to investigate heresy",
            "The king's advisor needs messengers for a sensitive diplomatic mission",
            "A wealthy patron offers gold to clear a haunted manor"
        ],
        Supernatural: [
            "Strange lights appear in the sky every night",
            "Animals are behaving erratically, fleeing the area",
            "A magical storm has been raging for days",
            "People report seeing visions of the dead",
            "Plants are withering in a spreading circle",
            "A mysterious fog that traps travelers appears at dusk"
        ],
        Happenstance: [
            "The party finds a dying messenger with a cryptic message",
            "Travelers discover an abandoned campsite with signs of struggle",
            "A strange object falls from the sky near the party",
            "The party gets lost and stumbles upon a hidden ruin",
            "A body washes ashore with mysterious wounds",
            "The party's rest is interrupted by screams in the distance"
        ]
    };
    
    const options = tables[hookType] || ["A mysterious event draws the party's attention"];
    const randomHook = options[Math.floor(Math.random() * options.length)];
    
    document.getElementById('hook-details').value = randomHook;
    adventureData.hookDetails = randomHook;
    
    // Save to localStorage
    debouncedSave();
}

// 6. Compile Encounters
function compileEncounters(data) {
    const compiled = {
        encounters: [...data.encounters],
        threadConnections: {}
    };
    
    // Build connections: informationRevealed → thread/encounter
    data.encounters.forEach((encounter, index) => {
        if (encounter.informationRevealed) {
            // Check if information revealed links to a thread
            const matchingThread = data.threads.find(t => 
                encounter.informationRevealed.toLowerCase().includes(t.lead.toLowerCase()) ||
                encounter.informationRevealed.toLowerCase().includes(t.whereItPoints.toLowerCase())
            );
            
            if (matchingThread) {
                if (!encounter.linkedThreadIds.includes(matchingThread.id)) {
                    encounter.linkedThreadIds.push(matchingThread.id);
                }
                compiled.threadConnections[encounter.id] = matchingThread.id;
            }
        }
    });
    
    // Suggest encounter order based on reveals
    // This is a simple linear ordering - could be enhanced with graph algorithms
    compiled.suggestedOrder = data.encounters.map(e => e.id);
    
    return compiled;
}

// 7. Render Template
function renderTemplate(data, templateType) {
    const compiled = compileEncounters(data);
    const output = document.getElementById('template-output');
    
    if (templateType === 'build') {
        output.value = generateBuildPrompt(data, compiled);
    } else {
        output.value = generateRunPrompt(data, compiled);
    }
    
    // Enable copy button
    document.getElementById('copy-btn').disabled = false;
}

function generateBuildPrompt(data, compiled) {
    let prompt = `IMPORTANT: This adventure is a SITUATION, not a fixed plot. Players are co-authors.
- Offer multiple branches and outcomes
- Never force a single outcome
- If players go off-track, adapt the situation accordingly
- All encounters should allow for creative problem-solving

Generate detailed adventure content based on this structure.

================================================================================
ADVENTURE OVERVIEW
================================================================================

Title: ${data.title || '[Adventure Title]'}
Party Level: ${data.partyLevel || '[Level]'}
Party Size: ${data.partySize || 4}
Tone: ${data.tone || '[Tone]'}

Situation: ${data.situation || '[Situation]'}

Conflict: ${data.conflict || '[Conflict]'}

What Makes It Unique and Fun: ${data.whatMakesItUnique || '[What makes this special]'}

Stakes: ${data.stakes || '[What happens if ignored/failed/succeeded]'}

Time Pressure: ${data.timePressure || '[Any urgency or deadlines]'}

Primary Location: ${data.location || '[Location]'}

================================================================================
HOOK AND MOTIVATION
================================================================================

Hook Type: ${data.hookType || '[Patron/Supernatural/Happenstance]'}
Hook Details: ${data.hookDetails || '[How the party gets involved]'}

Why This Party Cares: ${data.whyPartyCares || '[Why this specific party]'}

`;

    if (data.perCharacterMotivation && data.perCharacterMotivation.length > 0) {
        prompt += `Per-Character Motivation:\n`;
        data.perCharacterMotivation.forEach(pc => {
            prompt += `- ${pc.pcName || '[PC Name]'}: ${pc.reason || '[Reason]'}\n`;
        });
        prompt += `\n`;
    }
    
    prompt += `Refusal Plan: ${data.refusalPlan || '[What happens if party says no]'}

================================================================================
LEADS AND THREADS
================================================================================

`;

    if (data.threads && data.threads.length > 0) {
        data.threads.forEach((thread, index) => {
            prompt += `Thread ${index + 1}:
  Lead: ${thread.lead || '[What players can investigate]'}
  Where It Points: ${thread.whereItPoints || '[Destination]'}
  Cost If Ignored: ${thread.costIfIgnored || '[Consequence]'}

`;
        });
    } else {
        prompt += `[Add 2-3 threads that players can investigate]

`;
    }
    
    prompt += `================================================================================
ENCOUNTERS
================================================================================

`;

    if (data.encounters && data.encounters.length > 0) {
        data.encounters.forEach((encounter, index) => {
            prompt += `Encounter ${index + 1}:
  Objective: ${encounter.objective || '[What players want to accomplish]'}
  Obstacle: ${encounter.obstacle || '[What stands in their way]'}
  What It Accomplishes: ${encounter.whatItAccomplishes || '[Story purpose]'}
  Information Revealed: ${encounter.informationRevealed || '[Clue/info]'}${encounter.informationRevealed && compiled.threadConnections[encounter.id] ? ' → [Links to thread]' : ''}
  Type: ${(encounter.type && encounter.type.length > 0) ? encounter.type.join(', ') : '[Exploration/Social/Combat]'}
  Trigger: ${encounter.trigger || '[How players arrive]'}
  Location: ${getLocationName(encounter.location, data.locations)}
  Consequence: ${encounter.consequence || '[What happens after, including fail-forward]'}
  Difficulty: ${encounter.difficultyNote || '[DC suggestions or CR]'}
  Linked NPCs: ${getLinkedNPCs(encounter.linkedNpcIds, data.npcs)}
  Linked Threads: ${getLinkedThreads(encounter.linkedThreadIds, data.threads)}
  Treasure: ${encounter.treasure || '[If any]'}

`;
        });
    } else {
        prompt += `[Add encounters with objective + obstacle]

`;
    }
    
    prompt += `================================================================================
NPCS
================================================================================

`;

    if (data.npcs && data.npcs.length > 0) {
        data.npcs.forEach(npc => {
            prompt += `${npc.name || '[NPC Name]'}:
  Role: ${npc.role || '[Role]'}
  Motivation: ${npc.motivation || '[Motivation]'}
  Relationship to Party: ${npc.relationship || '[Relationship]'}
  Location: ${npc.location || '[Location]'}

`;
        });
    } else {
        prompt += `[Add NPCs]

`;
    }
    
    prompt += `================================================================================
LOCATIONS
================================================================================

`;

    if (data.locations && data.locations.length > 0) {
        data.locations.forEach(location => {
            prompt += `${location.name || '[Location Name]'}:
  Description: ${location.description || '[Description]'}
  Features: ${location.features || '[Key features]'}

`;
        });
    } else {
        prompt += `[Add locations]

`;
    }
    
    prompt += `================================================================================
ENDING OPTIONS
================================================================================

Expected Ending: ${data.expectedEnding || '[What you think will happen]'}

Alternative Ending 1: ${data.alternativeEndings[0] || '[First alternative]'}

Alternative Ending 2: ${data.alternativeEndings[1] || '[Second alternative]'}

If Villain Dies Early: ${data.villainDiesEarlyPlan || '[Contingency plan]'}

Rewards:
  Treasure: ${data.rewards.treasure || '[Gold, gems, art objects]'}
  Magic Items: ${data.rewards.magicItems || '[Level-appropriate items]'}
  Experience: ${data.rewards.experience || (data.rewards.milestone ? 'Milestone Leveling' : '[XP or milestone]')}
  Other: ${data.rewards.other || '[Reputation, allies, story resources]'}

`;
    
    return prompt;
}

function generateRunPrompt(data, compiled) {
    let prompt = `Role: You are a Dungeon Master (DM) running a D&D 5th edition adventure for a party of players.

Your role as DM:
- Narrate the world and describe what players see, hear, and experience
- Control NPCs (non-player characters) and give them voices and motivations
- Manage encounters (exploration, social interaction, and combat)
- Adjudicate player actions and determine outcomes based on D&D 5e rules
- Describe consequences and how the world reacts to player choices
- Keep the story moving forward while letting players drive the action

You are RUNNING this D&D 5e adventure RIGHT NOW. This is an ACTIVE GAME SESSION. 

DO NOT:
- Analyze or review the adventure
- Ask "What do you want next?" or "What do you want to do with this?"
- Offer options like "A. DM run sheet, B. Balance pass, C. Surgical edits" etc.
- Ask meta-questions about what direction to go
- Treat this as a document to analyze or edit

DO THIS IMMEDIATELY:
- START RUNNING THE GAME RIGHT NOW
- Begin with the hook scene below
- Describe the opening scene naturally
- Wait for player actions in their own words
- React to what they do - you are the Dungeon Master, not an analyst

This adventure is a SITUATION, not a fixed plot. Players are co-authors. You are running it live, in real-time, as their DM.

CRITICAL INSTRUCTIONS FOR RUNNING THE GAME:
- Present scenes naturally and describe what the players see/hear/experience
- WAIT for players to describe their actions in their own words - do NOT present menu-style choices like "Pick one: A, B, or C"
- NEVER say "Pick one" or "Choose from these options" or "Do your own thing"
- NEVER ask "What do you want next?" or offer analysis/editing options
- Players will tell you what they want to do - you react to their actions
- Build the story collaboratively through natural conversation and dialogue
- Adapt the situation based on whatever the players decide to do
- Use the encounter structure (objective + obstacle) but let players discover and solve creatively
- Present information and scenes, then wait for player input - don't offer structured choices
- The story emerges from player actions, not from a menu of options

================================================================================
RUN SHEET
================================================================================

Title: ${data.title || '[Adventure Title]'}
Party Level: ${data.partyLevel || '[Level]'}
Party Size: ${data.partySize || 4}
Hook: ${data.hookType || '[Hook Type]'} - ${data.hookDetails || '[Hook Details]'}
Stakes: ${data.stakes || '[Stakes]'}
Tone: ${data.tone || '[Tone]'}

Threads (2-3 things players can pursue):
`;

    if (data.threads && data.threads.length > 0) {
        data.threads.forEach((thread, index) => {
            prompt += `${index + 1}. ${thread.lead || '[Lead]'} → ${thread.whereItPoints || '[Destination]'}\n`;
        });
    } else {
        prompt += `[Add threads]\n`;
    }
    
    prompt += `\nEncounter Summary:\n`;
    if (data.encounters && data.encounters.length > 0) {
        data.encounters.forEach((encounter, index) => {
            prompt += `${index + 1}. ${encounter.objective || '[Objective]'} vs ${encounter.obstacle || '[Obstacle]'}`;
            if (encounter.informationRevealed) {
                prompt += ` → Reveals: ${encounter.informationRevealed}`;
            }
            prompt += `\n`;
        });
    }
    
    prompt += `\nNPC Quick Reference:\n`;
    if (data.npcs && data.npcs.length > 0) {
        data.npcs.forEach(npc => {
            prompt += `- ${npc.name || '[Name]'}: ${npc.role || '[Role]'} (${npc.location || '[Location]'}) - ${npc.motivation || '[Motivation]'}\n`;
        });
    }
    
    prompt += `\nLocation Quick Reference:\n`;
    if (data.locations && data.locations.length > 0) {
        data.locations.forEach(location => {
            prompt += `- ${location.name || '[Name]'}: ${location.description || '[Description]'}\n`;
        });
    }
    
    prompt += `\n================================================================================
SCENE-BY-SCENE STRUCTURE
================================================================================

`;

    if (data.encounters && data.encounters.length > 0) {
        data.encounters.forEach((encounter, index) => {
            prompt += `Scene ${index + 1}: ${encounter.trigger || '[How they arrive]'}
  Objective: ${encounter.objective || '[What players want]'}
  Obstacle: ${encounter.obstacle || '[What stands in way]'}
  Information Revealed: ${encounter.informationRevealed || '[What they learn]'}${encounter.informationRevealed && compiled.threadConnections[encounter.id] ? ' → [Next lead/thread]' : ''}
  Player Approach: Wait for players to describe what they do - they may use exploration, social interaction, combat, or any creative solution. React to their described actions.
  Consequence: ${encounter.consequence || '[What happens after, including fail-forward]'}
  Location: ${getLocationName(encounter.location, data.locations)}
  Linked NPCs: ${getLinkedNPCs(encounter.linkedNpcIds, data.npcs)}

`;
        });
    }
    
    prompt += `================================================================================
ENDING SCENARIOS
================================================================================

Expected: ${data.expectedEnding || '[Expected ending]'}

Alternative 1: ${data.alternativeEndings[0] || '[Alternative 1]'}

Alternative 2: ${data.alternativeEndings[1] || '[Alternative 2]'}

If Villain Dies Early: ${data.villainDiesEarlyPlan || '[Contingency]'}

Rewards:
${data.rewards.treasure ? `  Treasure: ${data.rewards.treasure}\n` : ''}${data.rewards.magicItems ? `  Magic Items: ${data.rewards.magicItems}\n` : ''}${data.rewards.experience ? `  XP: ${data.rewards.experience}\n` : ''}${data.rewards.milestone ? `  Milestone Leveling\n` : ''}${data.rewards.other ? `  Other: ${data.rewards.other}\n` : ''}

================================================================================
REMINDER: COLLABORATIVE STORYTELLING
================================================================================

Remember: You are co-creating the story with the players through dialogue. 

WRONG approach:
- "What do you do? Pick one: A) Question Sister Merrow, B) Go to graveyard, C) Go to the inn"

RIGHT approach:
- Present the scene, describe what's happening, then simply wait. The players will tell you what they want to do in their own words.
- Example: "Sister Merrow slides the pouch forward. The chapel is quiet except for the rain on the roof. What do you do?" [Then wait for player input]
- Players might say: "I examine the broken reliquary more closely" or "I ask her about the fence at the Copper Kettle" or anything else. React to their actual words, not pre-written options.

Build the story together naturally. No menus, no choice lists, no "Pick one" - just present the world and react to player actions.

================================================================================
START THE GAME NOW - NO EXCEPTIONS
================================================================================

YOU MUST START IMMEDIATELY. Do not ask any questions. Do not analyze. Do not offer options.

BEGIN RIGHT NOW: Start with the hook scene. Present the opening scene based on the hook details above (${data.hookType || '[Hook Type]'} - ${data.hookDetails || '[Hook Details]'}). 

Describe what the players see, hear, and experience. Set the scene naturally. Then wait for them to describe their actions in their own words. 

FORBIDDEN RESPONSES:
- "What do you want next?"
- "Pick one: A. DM run sheet, B. Balance pass..."
- "Before I do anything heavy, one quick check..."
- Any meta-questions or analysis requests

REQUIRED RESPONSE:
Start describing the opening scene of the adventure. The players are at the table right now. Begin with: "You find yourselves..." or similar opening narration based on the hook above. Then wait for their actions.

`;
    
    return prompt;
}

// Helper functions for rendering
function getLocationName(locationId, locations) {
    if (!locationId || !locations) return '[Location]';
    const location = locations.find(l => l.id === locationId);
    return location ? (location.name || '[Location Name]') : '[Location]';
}

function getLinkedNPCs(npcIds, npcs) {
    if (!npcIds || !npcs || npcIds.length === 0) return '[None]';
    const names = npcIds.map(id => {
        const npc = npcs.find(n => n.id === id);
        return npc ? (npc.name || '[NPC Name]') : null;
    }).filter(Boolean);
    return names.length > 0 ? names.join(', ') : '[None]';
}

function getLinkedThreads(threadIds, threads) {
    if (!threadIds || !threads || threadIds.length === 0) return '[None]';
    const leads = threadIds.map(id => {
        const thread = threads.find(t => t.id === id);
        return thread ? (thread.lead || '[Thread Lead]') : null;
    }).filter(Boolean);
    return leads.length > 0 ? leads.join(', ') : '[None]';
}

// 8. Export
function exportJSON() {
    collectFormData();
    normalizeAdventure(adventureData);
    
    const json = JSON.stringify(adventureData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${adventureData.title || 'adventure'}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportRunPrompt() {
    collectFormData();
    normalizeAdventure(adventureData);
    
    // Validate
    const validation = validateAdventure(adventureData);
    if (validation.errors.length > 0) {
        alert('Cannot export: ' + validation.errors.join('; '));
        return;
    }
    
    // Compile encounters
    const compiled = compileEncounters(adventureData);
    
    // Generate run prompt
    const prompt = generateRunPrompt(adventureData, compiled);
    
    // Export as text file
    const blob = new Blob([prompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${adventureData.title || 'adventure'}_DM_Prompt_${Date.now()}.txt`;
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
            loadAdventureData(imported);
            
            // Show success message
            const btn = document.getElementById('import-json-btn');
            const originalText = btn.textContent;
            btn.textContent = '✓ Imported!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        } catch (err) {
            alert('Failed to import JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// 9. Persist
const debouncedSave = debounce(() => {
    collectFormData();
    normalizeAdventure(adventureData);
    localStorage.setItem('dndAdventureBuilder', JSON.stringify(adventureData));
}, 500);

function saveToLocalStorage() {
    debouncedSave();
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('dndAdventureBuilder');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            loadAdventureData(data);
        } catch (err) {
            console.error('Failed to load from localStorage:', err);
        }
    }
}

function loadAdventureData(data) {
    // Handle schema migration if needed
    if (data.schemaVersion !== SCHEMA_VERSION) {
        data = migrateSchema(data, data.schemaVersion, SCHEMA_VERSION);
    }
    
    adventureData = { ...adventureData, ...data };
    
    // Populate form fields
    populateFormFromData(adventureData);
    
    // Render dynamic sections
    renderThreads();
    renderEncounters();
    renderNPCs();
    renderLocations();
    renderPCMotivations();
}

function populateFormFromData(data) {
    if (data.title !== undefined) document.getElementById('title').value = data.title || '';
    if (data.partyLevel !== undefined) document.getElementById('party-level').value = data.partyLevel || '';
    if (data.partySize !== undefined) document.getElementById('party-size').value = data.partySize || 4;
    if (data.tone) {
        if (['Heroic', 'Grimdark', 'Mystery', 'Horror', 'Comedy', 'Political'].includes(data.tone)) {
            document.getElementById('tone').value = data.tone;
        } else {
            document.getElementById('tone').value = 'Other';
            document.getElementById('tone-other').value = data.tone;
            document.getElementById('tone-other').style.display = 'block';
        }
    }
    if (data.location !== undefined) document.getElementById('location').value = data.location || '';
    if (data.situation !== undefined) document.getElementById('situation').value = data.situation || '';
    if (data.conflict !== undefined) document.getElementById('conflict').value = data.conflict || '';
    if (data.whatMakesItUnique !== undefined) document.getElementById('what-makes-unique').value = data.whatMakesItUnique || '';
    if (data.stakes !== undefined) document.getElementById('stakes').value = data.stakes || '';
    if (data.timePressure !== undefined) document.getElementById('time-pressure').value = data.timePressure || '';
    
    if (data.hookType) {
        const hookRadio = document.querySelector(`input[name="hookType"][value="${data.hookType}"]`);
        if (hookRadio) {
            hookRadio.checked = true;
        }
    }
    if (data.hookDetails !== undefined) document.getElementById('hook-details').value = data.hookDetails || '';
    if (data.whyPartyCares !== undefined) document.getElementById('why-party-cares').value = data.whyPartyCares || '';
    if (data.refusalPlan !== undefined) document.getElementById('refusal-plan').value = data.refusalPlan || '';
    
    if (data.expectedEnding !== undefined) document.getElementById('expected-ending').value = data.expectedEnding || '';
    if (data.alternativeEndings) {
        if (data.alternativeEndings[0] !== undefined) document.getElementById('alt-ending-1').value = data.alternativeEndings[0] || '';
        if (data.alternativeEndings[1] !== undefined) document.getElementById('alt-ending-2').value = data.alternativeEndings[1] || '';
    }
    if (data.villainDiesEarlyPlan !== undefined) document.getElementById('villain-dies-early').value = data.villainDiesEarlyPlan || '';
    
    if (data.rewards) {
        if (data.rewards.treasure !== undefined) document.getElementById('rewards-treasure').value = data.rewards.treasure || '';
        if (data.rewards.magicItems !== undefined) document.getElementById('rewards-magic-items').value = data.rewards.magicItems || '';
        if (data.rewards.experience !== undefined && data.rewards.experience !== null) document.getElementById('rewards-xp').value = data.rewards.experience;
        if (data.rewards.milestone !== undefined) document.getElementById('rewards-milestone').checked = data.rewards.milestone === true;
        if (data.rewards.other !== undefined) document.getElementById('rewards-other').value = data.rewards.other || '';
    }
}

// Schema Migration
function migrateSchema(data, fromVersion, toVersion) {
    // For now, just ensure schemaVersion is set
    if (!data.schemaVersion) {
        data.schemaVersion = toVersion;
    }
    
    // Ensure all required arrays exist
    if (!data.threads) data.threads = [];
    if (!data.encounters) data.encounters = [];
    if (!data.npcs) data.npcs = [];
    if (!data.locations) data.locations = [];
    if (!data.perCharacterMotivation) data.perCharacterMotivation = [];
    if (!data.alternativeEndings) data.alternativeEndings = ["", ""];
    if (!data.rewards) data.rewards = { treasure: "", magicItems: "", experience: null, milestone: false, other: "" };
    
    return data;
}

// ============================================================================
// Main Generation Function
// ============================================================================

function generateTemplate() {
    // Collect form data
    collectFormData();
    
    // Normalize
    normalizeAdventure(adventureData);
    
    // Validate
    const validation = validateAdventure(adventureData);
    
    // Show validation errors/warnings
    showValidationErrors(validation.errors, validation.warnings);
    
    if (validation.errors.length > 0) {
        return; // Don't generate if there are hard errors
    }
    
    // Auto-fill suggestions
    const suggestions = autoFillDefaults(adventureData);
    if (suggestions.length > 0) {
        // Could show these to user, but for now just continue
        console.log('Auto-fill suggestions:', suggestions);
    }
    
    // Compile encounters
    const compiled = compileEncounters(adventureData);
    
    // Get template type
    const templateType = document.querySelector('input[name="templateType"]:checked').value;
    
    // Render
    renderTemplate(adventureData, templateType);
    
    // Save to localStorage
    saveToLocalStorage();
}

function showValidationErrors(errors, warnings) {
    const errorBox = document.getElementById('validation-errors');
    const warningBox = document.getElementById('validation-warnings');
    
    if (errors.length > 0) {
        errorBox.style.display = 'block';
        errorBox.textContent = 'Errors: ' + errors.join('; ');
    } else {
        errorBox.style.display = 'none';
    }
    
    if (warnings.length > 0) {
        warningBox.style.display = 'block';
        warningBox.textContent = 'Warnings: ' + warnings.join('; ');
    } else {
        warningBox.style.display = 'none';
    }
}

function clearForm() {
    if (confirm('Are you sure you want to clear all form data?')) {
        document.getElementById('adventure-form').reset();
        adventureData = {
            schemaVersion: SCHEMA_VERSION,
            title: "",
            partyLevel: null,
            partySize: 4,
            tone: "",
            location: "",
            situation: "",
            conflict: "",
            whatMakesItUnique: "",
            stakes: "",
            timePressure: "",
            hookType: "",
            hookDetails: "",
            whyPartyCares: "",
            perCharacterMotivation: [],
            refusalPlan: "",
            threads: [],
            encounters: [],
            npcs: [],
            locations: [],
            expectedEnding: "",
            alternativeEndings: ["", ""],
            rewards: { treasure: "", magicItems: "", experience: null, milestone: false, other: "" },
            villainDiesEarlyPlan: ""
        };
        
        document.getElementById('threads-list').innerHTML = '';
        document.getElementById('encounters-list').innerHTML = '';
        document.getElementById('npcs-list').innerHTML = '';
        document.getElementById('locations-list').innerHTML = '';
        document.getElementById('pc-motivation-list').innerHTML = '';
        document.getElementById('template-output').value = '';
        document.getElementById('validation-errors').style.display = 'none';
        document.getElementById('validation-warnings').style.display = 'none';
        
        localStorage.removeItem('dndAdventureBuilder');
    }
}

function toggleLivePreview() {
    const checkbox = document.getElementById('live-preview');
    if (checkbox.checked) {
        // Add event listeners for live preview
        document.getElementById('adventure-form').addEventListener('input', debounce(generateTemplate, 300));
        document.getElementById('adventure-form').addEventListener('change', debounce(generateTemplate, 300));
    } else {
        // Remove event listeners (would need to store references)
        // For simplicity, just regenerate on manual button click
    }
}

// ============================================================================
// Dynamic Section Rendering
// ============================================================================

// Thread Management
function addThread() {
    const thread = {
        id: generateId(),
        lead: "",
        whereItPoints: "",
        costIfIgnored: ""
    };
    
    adventureData.threads.push(thread);
    renderThreads();
    saveToLocalStorage();
}

function removeThread(id) {
    adventureData.threads = adventureData.threads.filter(t => t.id !== id);
    
    // Unlink from encounters
    adventureData.encounters.forEach(encounter => {
        encounter.linkedThreadIds = encounter.linkedThreadIds.filter(tid => tid !== id);
    });
    
    renderThreads();
    renderEncounters(); // Re-render to update dropdowns
    saveToLocalStorage();
}

function renderThreads() {
    const container = document.getElementById('threads-list');
    container.innerHTML = '';
    
    adventureData.threads.forEach((thread, index) => {
        const card = document.createElement('div');
        card.className = 'thread-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">Thread ${index + 1}</div>
                <button type="button" class="btn-remove" onclick="removeThread('${thread.id}')">Remove</button>
            </div>
            <div class="form-group">
                <label class="field-label">Lead <span class="required-indicator">*</span></label>
                <input type="text" class="thread-lead" data-id="${thread.id}" value="${escapeText(thread.lead)}" placeholder="What players can investigate">
            </div>
            <div class="form-group">
                <label class="field-label">Where It Points</label>
                <input type="text" class="thread-where" data-id="${thread.id}" value="${escapeText(thread.whereItPoints)}" placeholder="Where this lead goes (location/encounter/NPC)">
            </div>
            <div class="form-group">
                <label class="field-label">Cost If Ignored</label>
                <input type="text" class="thread-cost" data-id="${thread.id}" value="${escapeText(thread.costIfIgnored)}" placeholder="What happens if players don't pursue this">
            </div>
        `;
        
        // Add event listeners
        card.querySelector('.thread-lead').addEventListener('input', (e) => {
            thread.lead = e.target.value;
            saveToLocalStorage();
        });
        card.querySelector('.thread-where').addEventListener('input', (e) => {
            thread.whereItPoints = e.target.value;
            saveToLocalStorage();
        });
        card.querySelector('.thread-cost').addEventListener('input', (e) => {
            thread.costIfIgnored = e.target.value;
            saveToLocalStorage();
        });
        
        container.appendChild(card);
    });
}

// Encounter Management
function addEncounter() {
    const encounter = {
        id: generateId(),
        objective: "",
        obstacle: "",
        whatItAccomplishes: "",
        informationRevealed: "",
        type: [],
        trigger: "",
        location: "",
        consequence: "",
        difficultyNote: "",
        linkedNpcIds: [],
        linkedThreadIds: [],
        treasure: ""
    };
    
    adventureData.encounters.push(encounter);
    renderEncounters();
    saveToLocalStorage();
}

function removeEncounter(id) {
    adventureData.encounters = adventureData.encounters.filter(e => e.id !== id);
    renderEncounters();
    saveToLocalStorage();
}

function renderEncounters() {
    const container = document.getElementById('encounters-list');
    container.innerHTML = '';
    
    adventureData.encounters.forEach((encounter, index) => {
        const card = document.createElement('div');
        card.className = 'encounter-card';
        
        const typeCheckboxes = ['Exploration', 'Social', 'Combat'].map(type => 
            `<label><input type="checkbox" class="encounter-type" data-id="${encounter.id}" value="${type}" ${encounter.type.includes(type) ? 'checked' : ''}> ${type}</label>`
        ).join('');
        
        const npcOptions = adventureData.npcs.map(npc => 
            `<option value="${npc.id}" ${encounter.linkedNpcIds.includes(npc.id) ? 'selected' : ''}>${escapeText(npc.name || '[NPC Name]')}</option>`
        ).join('');
        
        const threadOptions = adventureData.threads.map(thread => 
            `<option value="${thread.id}" ${encounter.linkedThreadIds.includes(thread.id) ? 'selected' : ''}>${escapeText(thread.lead || '[Thread Lead]')}</option>`
        ).join('');
        
        const locationOptions = adventureData.locations.map(loc => 
            `<option value="${loc.id}" ${encounter.location === loc.id ? 'selected' : ''}>${escapeText(loc.name || '[Location Name]')}</option>`
        ).join('');
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">Encounter ${index + 1}</div>
                <button type="button" class="btn-remove" onclick="removeEncounter('${encounter.id}')">Remove</button>
            </div>
            <div class="form-group">
                <label class="field-label">Objective <span class="required-indicator">*</span></label>
                <input type="text" class="encounter-objective required-field" data-id="${encounter.id}" value="${escapeText(encounter.objective)}" placeholder="What players want to accomplish">
            </div>
            <div class="form-group">
                <label class="field-label">Obstacle <span class="required-indicator">*</span></label>
                <input type="text" class="encounter-obstacle required-field" data-id="${encounter.id}" value="${escapeText(encounter.obstacle)}" placeholder="What stands in their way">
            </div>
            <div class="form-group">
                <label class="field-label">What It Accomplishes</label>
                <input type="text" class="encounter-accomplishes" data-id="${encounter.id}" value="${escapeText(encounter.whatItAccomplishes)}" placeholder="What this encounter achieves in the story">
            </div>
            <div class="form-group">
                <label class="field-label">Information Revealed</label>
                <input type="text" class="encounter-reveals" data-id="${encounter.id}" value="${escapeText(encounter.informationRevealed)}" placeholder="What clue/info is revealed (links to next lead/thread)">
            </div>
            <div class="form-group">
                <label>Type</label>
                <div class="checkbox-group">${typeCheckboxes}</div>
            </div>
            <div class="form-group">
                <label>Trigger</label>
                <input type="text" class="encounter-trigger" data-id="${encounter.id}" value="${escapeText(encounter.trigger)}" placeholder="How players arrive at this encounter">
            </div>
            <div class="form-group">
                <label>Location</label>
                <select class="encounter-location" data-id="${encounter.id}">
                    <option value="">[No Location]</option>
                    ${locationOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="field-label">Consequence</label>
                <textarea class="encounter-consequence" data-id="${encounter.id}" rows="2" placeholder="What happens after (success or fail-forward)">${escapeText(encounter.consequence)}</textarea>
            </div>
            <div class="form-group">
                <label>Difficulty Note</label>
                <input type="text" class="encounter-difficulty" data-id="${encounter.id}" value="${escapeText(encounter.difficultyNote)}" placeholder="DC suggestions or CR">
            </div>
            <div class="form-group">
                <label>NPCs Involved</label>
                <select class="encounter-npcs" data-id="${encounter.id}" multiple>
                    ${npcOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Linked Threads</label>
                <select class="encounter-threads" data-id="${encounter.id}" multiple>
                    ${threadOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Treasure</label>
                <input type="text" class="encounter-treasure" data-id="${encounter.id}" value="${escapeText(encounter.treasure)}" placeholder="Treasure if any">
            </div>
        `;
        
        // Add event listeners
        const inputs = {
            objective: card.querySelector('.encounter-objective'),
            obstacle: card.querySelector('.encounter-obstacle'),
            accomplishes: card.querySelector('.encounter-accomplishes'),
            reveals: card.querySelector('.encounter-reveals'),
            trigger: card.querySelector('.encounter-trigger'),
            location: card.querySelector('.encounter-location'),
            consequence: card.querySelector('.encounter-consequence'),
            difficulty: card.querySelector('.encounter-difficulty'),
            treasure: card.querySelector('.encounter-treasure')
        };
        
        Object.keys(inputs).forEach(key => {
            if (inputs[key]) {
                inputs[key].addEventListener('input', (e) => {
                    encounter[key === 'accomplishes' ? 'whatItAccomplishes' : 
                            key === 'reveals' ? 'informationRevealed' : 
                            key === 'difficulty' ? 'difficultyNote' : key] = e.target.value;
                    saveToLocalStorage();
                });
            }
        });
        
        card.querySelectorAll('.encounter-type').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!encounter.type.includes(e.target.value)) {
                        encounter.type.push(e.target.value);
                    }
                } else {
                    encounter.type = encounter.type.filter(t => t !== e.target.value);
                }
                saveToLocalStorage();
            });
        });
        
        const npcSelect = card.querySelector('.encounter-npcs');
        if (npcSelect) {
            npcSelect.addEventListener('change', (e) => {
                encounter.linkedNpcIds = Array.from(e.target.selectedOptions).map(opt => opt.value);
                saveToLocalStorage();
            });
        }
        
        const threadSelect = card.querySelector('.encounter-threads');
        if (threadSelect) {
            threadSelect.addEventListener('change', (e) => {
                encounter.linkedThreadIds = Array.from(e.target.selectedOptions).map(opt => opt.value);
                saveToLocalStorage();
            });
        }
        
        container.appendChild(card);
    });
}

// NPC Management
function addNPC() {
    const npc = {
        id: generateId(),
        name: "",
        role: "",
        motivation: "",
        relationship: "",
        location: ""
    };
    
    adventureData.npcs.push(npc);
    renderNPCs();
    renderEncounters(); // Re-render to update dropdowns
    saveToLocalStorage();
}

function removeNPC(id) {
    adventureData.npcs = adventureData.npcs.filter(n => n.id !== id);
    
    // Unlink from encounters
    adventureData.encounters.forEach(encounter => {
        encounter.linkedNpcIds = encounter.linkedNpcIds.filter(nid => nid !== id);
    });
    
    renderNPCs();
    renderEncounters();
    saveToLocalStorage();
}

function renderNPCs() {
    const container = document.getElementById('npcs-list');
    container.innerHTML = '';
    
    adventureData.npcs.forEach((npc, index) => {
        const card = document.createElement('div');
        card.className = 'npc-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">NPC ${index + 1}</div>
                <button type="button" class="btn-remove" onclick="removeNPC('${npc.id}')">Remove</button>
            </div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" class="npc-name" data-id="${npc.id}" value="${escapeText(npc.name)}" placeholder="NPC name">
            </div>
            <div class="form-group">
                <label>Role</label>
                <input type="text" class="npc-role" data-id="${npc.id}" value="${escapeText(npc.role)}" placeholder="NPC role">
            </div>
            <div class="form-group">
                <label>Motivation</label>
                <textarea class="npc-motivation" data-id="${npc.id}" rows="2" placeholder="What does this NPC want?">${escapeText(npc.motivation)}</textarea>
            </div>
            <div class="form-group">
                <label>Relationship to Party</label>
                <input type="text" class="npc-relationship" data-id="${npc.id}" value="${escapeText(npc.relationship)}" placeholder="How does this NPC relate to the party?">
            </div>
            <div class="form-group">
                <label>Location</label>
                <input type="text" class="npc-location" data-id="${npc.id}" value="${escapeText(npc.location)}" placeholder="Where is this NPC?">
            </div>
        `;
        
        // Add event listeners
        card.querySelector('.npc-name').addEventListener('input', (e) => {
            npc.name = e.target.value;
            saveToLocalStorage();
        });
        card.querySelector('.npc-role').addEventListener('input', (e) => {
            npc.role = e.target.value;
            saveToLocalStorage();
        });
        card.querySelector('.npc-motivation').addEventListener('input', (e) => {
            npc.motivation = e.target.value;
            saveToLocalStorage();
        });
        card.querySelector('.npc-relationship').addEventListener('input', (e) => {
            npc.relationship = e.target.value;
            saveToLocalStorage();
        });
        card.querySelector('.npc-location').addEventListener('input', (e) => {
            npc.location = e.target.value;
            saveToLocalStorage();
        });
        
        container.appendChild(card);
    });
}

// Location Management
function addLocation() {
    const location = {
        id: generateId(),
        name: "",
        description: "",
        features: ""
    };
    
    adventureData.locations.push(location);
    renderLocations();
    renderEncounters(); // Re-render to update dropdowns
    saveToLocalStorage();
}

function removeLocation(id) {
    adventureData.locations = adventureData.locations.filter(l => l.id !== id);
    
    // Unlink from encounters
    adventureData.encounters.forEach(encounter => {
        if (encounter.location === id) {
            encounter.location = "";
        }
    });
    
    renderLocations();
    renderEncounters();
    saveToLocalStorage();
}

function renderLocations() {
    const container = document.getElementById('locations-list');
    container.innerHTML = '';
    
    adventureData.locations.forEach((location, index) => {
        const card = document.createElement('div');
        card.className = 'location-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">Location ${index + 1}</div>
                <button type="button" class="btn-remove" onclick="removeLocation('${location.id}')">Remove</button>
            </div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" class="location-name" data-id="${location.id}" value="${escapeText(location.name)}" placeholder="Location name">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea class="location-description" data-id="${location.id}" rows="2" placeholder="Location description">${escapeText(location.description)}</textarea>
            </div>
            <div class="form-group">
                <label>Features</label>
                <textarea class="location-features" data-id="${location.id}" rows="2" placeholder="Key features of this location">${escapeText(location.features)}</textarea>
            </div>
        `;
        
        // Add event listeners
        card.querySelector('.location-name').addEventListener('input', (e) => {
            location.name = e.target.value;
            saveToLocalStorage();
        });
        card.querySelector('.location-description').addEventListener('input', (e) => {
            location.description = e.target.value;
            saveToLocalStorage();
        });
        card.querySelector('.location-features').addEventListener('input', (e) => {
            location.features = e.target.value;
            saveToLocalStorage();
        });
        
        container.appendChild(card);
    });
}

// PC Motivation Management
function addPCMotivation() {
    const pc = {
        id: generateId(),
        pcName: "",
        reason: ""
    };
    
    adventureData.perCharacterMotivation.push(pc);
    renderPCMotivations();
    saveToLocalStorage();
}

function removePCMotivation(id) {
    adventureData.perCharacterMotivation = adventureData.perCharacterMotivation.filter(pc => pc.id !== id);
    renderPCMotivations();
    saveToLocalStorage();
}

function renderPCMotivations() {
    const container = document.getElementById('pc-motivation-list');
    container.innerHTML = '';
    
    adventureData.perCharacterMotivation.forEach((pc, index) => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.style.marginBottom = '1rem';
        div.style.padding = '1rem';
        div.style.backgroundColor = '#f8f9fa';
        div.style.borderRadius = '4px';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label style="font-weight: 600;">PC ${index + 1}</label>
                <button type="button" class="btn-remove" onclick="removePCMotivation('${pc.id}')">Remove</button>
            </div>
            <div class="form-group" style="margin-bottom: 0.5rem;">
                <label>PC Name</label>
                <input type="text" class="pc-name" data-id="${pc.id}" value="${escapeText(pc.pcName)}" placeholder="Character name">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Reason</label>
                <textarea class="pc-reason" data-id="${pc.id}" rows="2" placeholder="Why does this PC care?">${escapeText(pc.reason)}</textarea>
            </div>
        `;
        
        // Add event listeners
        div.querySelector('.pc-name').addEventListener('input', (e) => {
            pc.pcName = e.target.value;
            saveToLocalStorage();
        });
        div.querySelector('.pc-reason').addEventListener('input', (e) => {
            pc.reason = e.target.value;
            saveToLocalStorage();
        });
        
        container.appendChild(div);
    });
}

// ============================================================================
// Tab Navigation
// ============================================================================

function switchTab(tabName) {
    const manualSection = document.getElementById('manual-builder-section');
    const aiSection = document.getElementById('ai-assistant-section');
    const manualTab = document.getElementById('tab-manual');
    const aiTab = document.getElementById('tab-ai');
    
    if (tabName === 'ai') {
        manualSection.style.display = 'none';
        aiSection.style.display = 'block';
        manualTab.classList.remove('active');
        aiTab.classList.add('active');
    } else {
        manualSection.style.display = 'block';
        aiSection.style.display = 'none';
        manualTab.classList.add('active');
        aiTab.classList.remove('active');
    }
}

// ============================================================================
// AI Prompt Generator
// ============================================================================

function generateAIPrompt() {
    const partyLevel = document.getElementById('ai-party-level').value;
    const partySize = document.getElementById('ai-party-size').value || 4;
    const tone = document.getElementById('ai-tone').value || 'Any';
    const adventureLength = document.getElementById('ai-adventure-length').value;
    const hookPreference = document.getElementById('ai-hook-preference').value;
    
    if (!partyLevel) {
        alert('Please enter a party level');
        return;
    }
    
    const prompt = `You are an expert D&D 5e adventure designer following the Dungeon Master's Guide principles.

Task: Create a complete D&D 5e adventure as a structured JSON object.

Requirements:
- Party Level: ${partyLevel}
- Party Size: ${partySize}
- Tone: ${tone === 'Any' ? 'Choose an appropriate tone' : tone}
- Adventure Length: ${adventureLength}
- Hook Type Preference: ${hookPreference === 'Any' ? 'Choose an appropriate hook type' : hookPreference}

DMG Principles to Follow:
1. Adventures are situations, not fixed plots - players are co-authors
2. Every encounter needs an objective (what players want) + obstacle (what stands in their way)
3. Include 2-3 threads (investigatable options) so choices matter
4. Mix exploration, social, and combat encounters
5. Include fail-forward consequences that move the story forward
6. Plan multiple endings based on player choices
7. Use hook types: Patron, Supernatural, or Happenstance

JSON Schema - Output ONLY valid JSON (no markdown, no explanations, just the JSON object):

{
  "title": "Adventure Title (creative and descriptive)",
  "partyLevel": ${partyLevel},
  "partySize": ${partySize},
  "tone": "${tone === 'Any' ? '[choose appropriate tone]' : tone}",
  "location": "Primary location name",
  "situation": "What's happening in the world that needs heroes",
  "conflict": "The specific problem or threat that needs to be addressed",
  "whatMakesItUnique": "What makes this adventure special and memorable",
  "stakes": "What happens if ignored, if heroes fail, and if they succeed",
  "timePressure": "Any urgency, deadlines, or consequences of delay",
  "hookType": "${hookPreference === 'Any' ? '[Patron|Supernatural|Happenstance]' : hookPreference}",
  "hookDetails": "How the party gets involved in the adventure",
  "whyPartyCares": "Why this specific party cares about the situation",
  "refusalPlan": "What happens if the party says no or refuses",
  "threads": [
    {
      "lead": "What players can investigate (first thread)",
      "whereItPoints": "Where this lead goes (location/encounter/NPC)",
      "costIfIgnored": "What happens if players don't pursue this thread"
    },
    {
      "lead": "What players can investigate (second thread)",
      "whereItPoints": "Where this lead goes (location/encounter/NPC)",
      "costIfIgnored": "What happens if players don't pursue this thread"
    }
  ],
  "encounters": [
    {
      "objective": "What players want to accomplish",
      "obstacle": "What stands in their way",
      "whatItAccomplishes": "What this encounter achieves in the story",
      "informationRevealed": "What clue or information is revealed (chains to next lead/thread)",
      "type": ["Exploration", "Social", "Combat"],
      "trigger": "How players arrive at this encounter",
      "consequence": "What happens after (success or fail-forward - must move story forward)",
      "difficultyNote": "DC suggestions for exploration/social or CR for combat",
      "treasure": "Treasure if any (leave empty if none)"
    }
  ],
  "npcs": [
    {
      "name": "NPC name",
      "role": "NPC's role in the story",
      "motivation": "What this NPC wants",
      "relationship": "How this NPC relates to the party",
      "location": "Where this NPC is found"
    }
  ],
  "locations": [
    {
      "name": "Location name",
      "description": "Description of the location",
      "features": "Key features of this location"
    }
  ],
  "expectedEnding": "What you think will happen (expected ending)",
  "alternativeEndings": [
    "First alternative ending based on player choices",
    "Second alternative ending based on player choices"
  ],
  "villainDiesEarlyPlan": "Contingency plan if the main threat is eliminated early",
  "rewards": {
    "treasure": "Gold, gems, art objects appropriate for level ${partyLevel}",
    "magicItems": "Magic items appropriate for level ${partyLevel}",
    "experience": null,
    "milestone": true,
    "other": "Reputation, allies, story resources, etc."
  }
}

Important: 
- Output ONLY the JSON object, starting with { and ending with }
- Do NOT include markdown code blocks (\`\`\`json or \`\`\`)
- Do NOT include explanations or text before/after the JSON
- Ensure all required fields are filled
- Include at least 3-5 encounters for a ${adventureLength.toLowerCase()} adventure
- Include 2-3 threads so players have choices
- Make encounters varied (mix exploration, social, combat)`;

    const promptOutput = document.getElementById('ai-prompt-output');
    const promptText = document.getElementById('ai-prompt-text');
    promptText.value = prompt;
    promptOutput.style.display = 'block';
    
    // Scroll to prompt output
    promptOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function copyAIPrompt() {
    const promptText = document.getElementById('ai-prompt-text');
    promptText.select();
    promptText.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        document.execCommand('copy');
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    } catch (err) {
        alert('Failed to copy prompt. Please select and copy manually.');
    }
}

// ============================================================================
// AI Response Parser
// ============================================================================

function parseAIResponse() {
    const responseInput = document.getElementById('ai-response-input').value.trim();
    const errorBox = document.getElementById('ai-parse-errors');
    const successBox = document.getElementById('ai-parse-success');
    const successMessage = document.getElementById('ai-parse-message');
    
    errorBox.style.display = 'none';
    successBox.style.display = 'none';
    
    if (!responseInput) {
        errorBox.style.display = 'block';
        errorBox.textContent = 'Please paste the AI response first.';
        return;
    }
    
    try {
        // Try to extract JSON from response (handle markdown code blocks)
        let jsonText = responseInput;
        
        // Remove markdown code blocks if present
        jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        jsonText = jsonText.trim();
        
        // Try to find JSON object in the text (in case AI added extra text)
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonText = jsonMatch[0];
        }
        
        // Parse JSON
        const aiData = JSON.parse(jsonText);
        
        // Validate required fields
        const validation = validateAIData(aiData);
        if (validation.errors.length > 0) {
            errorBox.style.display = 'block';
            errorBox.textContent = 'Validation errors: ' + validation.errors.join('; ');
            return;
        }
        
        // Map AI data to our schema
        const mappedData = mapAIDataToSchema(aiData);
        
        // Populate form
        populateFromAI(mappedData);
        
        // Show success
        successBox.style.display = 'block';
        successMessage.textContent = 'Form populated successfully! Switching to Manual Builder tab...';
        
        // Switch to manual builder tab after a short delay
        setTimeout(() => {
            switchTab('manual');
            successBox.style.display = 'none';
            // Scroll to top of form
            document.getElementById('manual-builder-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 2000);
        
    } catch (err) {
        errorBox.style.display = 'block';
        errorBox.textContent = 'Failed to parse JSON: ' + err.message + '. Please ensure the AI response is valid JSON.';
        console.error('Parse error:', err);
    }
}

function validateAIData(data) {
    const errors = [];
    
    if (!data.title) errors.push('Missing title');
    if (!data.partyLevel) errors.push('Missing partyLevel');
    if (!data.situation) errors.push('Missing situation');
    if (!data.conflict) errors.push('Missing conflict');
    if (!data.hookType) errors.push('Missing hookType');
    if (!data.hookDetails) errors.push('Missing hookDetails');
    
    if (!data.encounters || !Array.isArray(data.encounters) || data.encounters.length === 0) {
        errors.push('Missing or empty encounters array');
    } else {
        data.encounters.forEach((enc, index) => {
            if (!enc.objective) errors.push(`Encounter ${index + 1} missing objective`);
            if (!enc.obstacle) errors.push(`Encounter ${index + 1} missing obstacle`);
        });
    }
    
    return { errors };
}

function mapAIDataToSchema(aiData) {
    // Map AI response to our schema structure
    return {
        schemaVersion: SCHEMA_VERSION,
        title: aiData.title || "",
        partyLevel: aiData.partyLevel || null,
        partySize: aiData.partySize || 4,
        tone: aiData.tone || "",
        location: aiData.location || "",
        situation: aiData.situation || "",
        conflict: aiData.conflict || "",
        whatMakesItUnique: aiData.whatMakesItUnique || "",
        stakes: aiData.stakes || "",
        timePressure: aiData.timePressure || "",
        hookType: aiData.hookType || "",
        hookDetails: aiData.hookDetails || "",
        whyPartyCares: aiData.whyPartyCares || "",
        refusalPlan: aiData.refusalPlan || "",
        perCharacterMotivation: aiData.perCharacterMotivation || [],
        threads: aiData.threads || [],
        encounters: aiData.encounters || [],
        npcs: aiData.npcs || [],
        locations: aiData.locations || [],
        expectedEnding: aiData.expectedEnding || "",
        alternativeEndings: aiData.alternativeEndings || ["", ""],
        rewards: {
            treasure: aiData.rewards?.treasure || "",
            magicItems: aiData.rewards?.magicItems || "",
            experience: aiData.rewards?.experience || null,
            milestone: aiData.rewards?.milestone !== undefined ? aiData.rewards.milestone : false,
            other: aiData.rewards?.other || ""
        },
        villainDiesEarlyPlan: aiData.villainDiesEarlyPlan || ""
    };
}

function populateFromAI(data) {
    // Set adventure data
    adventureData = { ...adventureData, ...data };
    
    // Generate IDs for items that don't have them
    adventureData.threads.forEach(thread => {
        if (!thread.id) thread.id = generateId();
    });
    adventureData.encounters.forEach(encounter => {
        if (!encounter.id) encounter.id = generateId();
        if (!encounter.linkedNpcIds) encounter.linkedNpcIds = [];
        if (!encounter.linkedThreadIds) encounter.linkedThreadIds = [];
        if (!encounter.type) encounter.type = [];
    });
    adventureData.npcs.forEach(npc => {
        if (!npc.id) npc.id = generateId();
    });
    adventureData.locations.forEach(location => {
        if (!location.id) location.id = generateId();
    });
    
    // Populate form fields
    populateFormFromData(adventureData);
    
    // Render dynamic sections
    renderThreads();
    renderEncounters();
    renderNPCs();
    renderLocations();
    renderPCMotivations();
    
    // Save to localStorage
    saveToLocalStorage();
}

function clearAIResponse() {
    document.getElementById('ai-response-input').value = '';
    document.getElementById('ai-parse-errors').style.display = 'none';
    document.getElementById('ai-parse-success').style.display = 'none';
}

// Make functions available globally
window.toggleGuidance = toggleGuidance;
window.rollHookTable = rollHookTable;
window.switchTab = switchTab;
window.generateAIPrompt = generateAIPrompt;
window.copyAIPrompt = copyAIPrompt;
window.parseAIResponse = parseAIResponse;
window.clearAIResponse = clearAIResponse;
window.generateTemplate = generateTemplate;
window.copyToClipboard = () => {
    const text = document.getElementById('template-output').value;
    if (text) {
        copyToClipboard(text);
    }
};
window.exportJSON = exportJSON;
window.exportRunPrompt = exportRunPrompt;
window.importJSON = importJSON;
window.clearForm = clearForm;
window.toggleLivePreview = toggleLivePreview;
window.addThread = addThread;
window.removeThread = removeThread;
window.addEncounter = addEncounter;
window.removeEncounter = removeEncounter;
window.addNPC = addNPC;
window.removeNPC = removeNPC;
window.addLocation = addLocation;
window.removeLocation = removeLocation;
window.addPCMotivation = addPCMotivation;
window.removePCMotivation = removePCMotivation;

// Add auto-save listeners
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('adventure-form');
    if (form) {
        form.addEventListener('input', debounce(saveToLocalStorage, 500));
        form.addEventListener('change', debounce(saveToLocalStorage, 500));
    }
});
