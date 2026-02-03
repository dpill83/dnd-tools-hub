// ============================================================================
// Adventure Packet Builder for LM Studio
// ============================================================================

const SCHEMA_VERSION = "1.0.0";
const STORAGE_KEY = "dndAdventurePacketBuilder";

let adventureData = {
    schemaVersion: SCHEMA_VERSION,
    title: "",
    partyLevel: null,
    partySize: 4,
    tone: "",
    setting: "",
    startingLocation: "",
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
    villainDiesEarlyPlan: "",
    rewards: {
        treasure: "",
        magicItems: "",
        experience: null,
        milestone: false,
        other: ""
    }
};

let idCounter = 0;

function generateId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
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
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
}

function toggleGuidance(button) {
    const content = button.nextElementSibling;
    const isActive = content.classList.contains("active");
    if (isActive) {
        content.classList.remove("active");
        button.classList.remove("active");
    } else {
        content.classList.add("active");
        button.classList.add("active");
    }
}

function collectFormData() {
    const form = document.getElementById("adventure-form");
    if (!form) return adventureData;
    const formData = new FormData(form);

    adventureData.title = formData.get("title") || "";
    adventureData.partyLevel = parseInt(formData.get("partyLevel"), 10) || null;
    adventureData.partySize = parseInt(formData.get("partySize"), 10) || 4;
    adventureData.tone = formData.get("tone") || "";
    adventureData.setting = formData.get("setting") || "";
    adventureData.startingLocation = formData.get("startingLocation") || "";
    adventureData.situation = formData.get("situation") || "";
    adventureData.conflict = formData.get("conflict") || "";
    adventureData.whatMakesItUnique = formData.get("whatMakesItUnique") || "";
    adventureData.stakes = formData.get("stakes") || "";
    adventureData.timePressure = formData.get("timePressure") || "";

    adventureData.hookType = formData.get("hookType") || "";
    adventureData.hookDetails = formData.get("hookDetails") || "";
    adventureData.whyPartyCares = formData.get("whyPartyCares") || "";
    adventureData.refusalPlan = formData.get("refusalPlan") || "";

    adventureData.expectedEnding = formData.get("expectedEnding") || "";
    adventureData.alternativeEndings[0] = formData.get("altEnding1") || "";
    adventureData.alternativeEndings[1] = formData.get("altEnding2") || "";
    adventureData.villainDiesEarlyPlan = formData.get("villainDiesEarlyPlan") || "";

    adventureData.rewards.treasure = formData.get("rewardsTreasure") || "";
    adventureData.rewards.magicItems = formData.get("rewardsMagicItems") || "";
    adventureData.rewards.experience = parseInt(formData.get("rewardsXP"), 10) || null;
    adventureData.rewards.milestone = formData.get("rewardsMilestone") === "on";
    adventureData.rewards.other = formData.get("rewardsOther") || "";

    return adventureData;
}

function normalizeAdventure(data) {
    const trimStr = (v) => (typeof v === "string" ? v.trim() : v);
    Object.keys(data).forEach((key) => {
        if (typeof data[key] === "string") {
            data[key] = trimStr(data[key]);
        } else if (Array.isArray(data[key])) {
            data[key].forEach((item) => {
                if (typeof item === "object" && item !== null) {
                    Object.keys(item).forEach((sk) => {
                        if (typeof item[sk] === "string") item[sk] = trimStr(item[sk]);
                    });
                }
            });
        } else if (typeof data[key] === "object" && data[key] !== null) {
            Object.keys(data[key]).forEach((sk) => {
                if (typeof data[key][sk] === "string") {
                    data[key][sk] = trimStr(data[key][sk]);
                }
            });
        }
    });

    data.threads.forEach((t) => { if (!t.id) t.id = generateId(); });
    data.encounters.forEach((e) => {
        if (!e.id) e.id = generateId();
        if (!e.type) e.type = [];
    });
    data.npcs.forEach((n) => { if (!n.id) n.id = generateId(); });
    data.locations.forEach((l) => { if (!l.id) l.id = generateId(); });
    data.perCharacterMotivation.forEach((p) => { if (!p.id) p.id = generateId(); });

    if (!data.partySize) data.partySize = 4;
    if (!data.threads) data.threads = [];
    if (!data.encounters) data.encounters = [];
    if (!data.npcs) data.npcs = [];
    if (!data.locations) data.locations = [];
    if (!data.perCharacterMotivation) data.perCharacterMotivation = [];
    if (!data.alternativeEndings) data.alternativeEndings = ["", ""];
    if (!data.rewards) data.rewards = { treasure: "", magicItems: "", experience: null, milestone: false, other: "" };

    return data;
}

function orNotSpecified(val) {
    if (val == null || val === "") return "(not specified)";
    const s = String(val).trim();
    return s || "(not specified)";
}

function generatePacket() {
    collectFormData();
    normalizeAdventure(adventureData);
    const d = adventureData;

    const lines = [];

    lines.push("[ADVENTURE PACKET]");
    lines.push(`Title: ${orNotSpecified(d.title)}`);
    lines.push("System: D&D 5e");
    lines.push(`Party: Level ${orNotSpecified(d.partyLevel)}, ${orNotSpecified(d.partySize)} players`);
    lines.push(`Tone: ${orNotSpecified(d.tone)}`);
    lines.push(`Setting: ${orNotSpecified(d.setting)}`);
    lines.push("");

    const premiseParts = [];
    if (d.situation && d.situation.trim()) premiseParts.push(d.situation.trim());
    if (d.conflict && d.conflict.trim()) premiseParts.push(d.conflict.trim());
    if (d.whatMakesItUnique && d.whatMakesItUnique.trim()) premiseParts.push(d.whatMakesItUnique.trim());
    if (d.stakes && d.stakes.trim()) premiseParts.push(d.stakes.trim());
    if (d.timePressure && d.timePressure.trim()) premiseParts.push(d.timePressure.trim());
    const premiseText = premiseParts.length ? premiseParts.join("\n\n") : orNotSpecified(null);

    lines.push("[PREMISE]");
    lines.push(premiseText);
    lines.push("");

    const hookType = (d.hookType && d.hookType.trim()) || "";
    const hookDetails = (d.hookDetails && d.hookDetails.trim()) || "";
    const hookStr = hookType && hookDetails
        ? `${hookType} — ${hookDetails}`
        : hookType || hookDetails || orNotSpecified(null);
    lines.push("[HOOK]");
    lines.push(hookStr);
    lines.push("");

    const threadItems = (d.threads || []).map((t) => (t.lead && t.lead.trim()) || null).filter(Boolean);
    if (threadItems.length) {
        lines.push("[THREADS]");
        threadItems.forEach((t) => lines.push(`- ${t}`));
        lines.push("");
    }

    const encounterItems = (d.encounters || []).filter((e) => {
        const hasName = e.name && String(e.name).trim();
        const hasObj = e.objective && String(e.objective).trim();
        const hasObst = e.obstacles && String(e.obstacles).trim();
        const hasClues = e.clues && String(e.clues).trim();
        const hasCons = e.consequences && String(e.consequences).trim();
        return hasName || hasObj || hasObst || hasClues || hasCons;
    });
    if (encounterItems.length) {
        lines.push("[ENCOUNTERS]");
        encounterItems.forEach((e, i) => {
            const name = (e.name && e.name.trim()) || "(unnamed)";
            const type = (e.type && e.type.length) ? e.type.join(", ") : orNotSpecified(null);
            const obj = (e.objective && e.objective.trim()) || orNotSpecified(null);
            const obst = (e.obstacles && e.obstacles.trim()) || orNotSpecified(null);
            const clues = (e.clues && e.clues.trim()) || orNotSpecified(null);
            const cons = (e.consequences && e.consequences.trim()) || orNotSpecified(null);
            lines.push(`${i + 1}) ${name} | ${type} | Objective: ${obj} | Obstacles: ${obst} | Clues: ${clues} | Consequences: ${cons}`);
        });
        lines.push("");
    }

    const npcItems = (d.npcs || []).filter((n) => (n.name && String(n.name).trim()));
    if (npcItems.length) {
        lines.push("[NPCS]");
        npcItems.forEach((n) => {
            const name = (n.name && n.name.trim()) || "(unnamed)";
            const role = (n.role && n.role.trim()) || orNotSpecified(null);
            const mot = (n.motivation && n.motivation.trim()) || orNotSpecified(null);
            const secret = (n.secret && n.secret.trim()) || orNotSpecified(null);
            lines.push(`- ${name} | Role: ${role} | Motivation: ${mot} | Secret: ${secret}`);
        });
        lines.push("");
    }

    const locItems = (d.locations || []).filter((l) => (l.name && String(l.name).trim()));
    if (locItems.length) {
        lines.push("[LOCATIONS]");
        locItems.forEach((l) => {
            const name = (l.name && l.name.trim()) || "(unnamed)";
            const vibe = (l.description && l.description.trim()) || orNotSpecified(null);
            const feat = (l.features && l.features.trim()) || orNotSpecified(null);
            lines.push(`- ${name} | Vibe: ${vibe} | Key Features: ${feat}`);
        });
        lines.push("");
    }

    lines.push("[ENDING]");
    lines.push(`Expected: ${orNotSpecified(d.expectedEnding)}`);
    const alts = [d.alternativeEndings[0], d.alternativeEndings[1]].filter((a) => a && a.trim()).join("; ");
    lines.push(`Alternatives: ${alts || orNotSpecified(null)}`);
    lines.push(`Failure / Retreat: ${orNotSpecified(d.villainDiesEarlyPlan)}`);
    lines.push("");

    lines.push("[REWARDS]");
    lines.push(`Treasure: ${orNotSpecified(d.rewards.treasure)}`);
    lines.push(`Magic Items: ${orNotSpecified(d.rewards.magicItems)}`);
    lines.push(`Other: ${orNotSpecified(d.rewards.other)}`);

    const out = document.getElementById("packet-output");
    if (out) out.value = lines.join("\n");
}

function copyPacket() {
    const el = document.getElementById("packet-output");
    if (!el || !el.value) return;
    const textarea = document.createElement("textarea");
    textarea.value = el.value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand("copy");
        const btn = document.getElementById("copy-packet-btn");
        if (btn) {
            const orig = btn.textContent;
            btn.textContent = "✓ Copied!";
            setTimeout(() => { btn.textContent = orig; }, 2000);
        }
    } catch (e) {
        alert("Failed to copy to clipboard");
    }
    document.body.removeChild(textarea);
}

function exportPacketTxt() {
    const el = document.getElementById("packet-output");
    if (!el || !el.value) return;
    const blob = new Blob([el.value], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${adventureData.title || "adventure"}_packet_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportJSON() {
    collectFormData();
    normalizeAdventure(adventureData);
    const json = JSON.stringify(adventureData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${adventureData.title || "adventure"}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            loadAdventureData(imported);
            const btn = document.getElementById("import-json-btn");
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = "✓ Imported!";
                setTimeout(() => { btn.textContent = orig; }, 2000);
            }
        } catch (err) {
            alert("Failed to import JSON: " + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = "";
}

const debouncedSave = debounce(() => {
    collectFormData();
    normalizeAdventure(adventureData);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(adventureData));
    } catch (e) {}
}, 500);

function saveToLocalStorage() {
    debouncedSave();
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            loadAdventureData(data);
        }
    } catch (e) {}
}

function migrateSchema(data) {
    if (!data.schemaVersion) data.schemaVersion = SCHEMA_VERSION;
    if (!data.threads) data.threads = [];
    if (!data.encounters) data.encounters = [];
    if (!data.npcs) data.npcs = [];
    if (!data.locations) data.locations = [];
    if (!data.perCharacterMotivation) data.perCharacterMotivation = [];
    if (!data.alternativeEndings) data.alternativeEndings = ["", ""];
    if (!data.rewards) data.rewards = { treasure: "", magicItems: "", experience: null, milestone: false, other: "" };
    if (!data.setting) data.setting = "";
    if (!data.startingLocation) data.startingLocation = "";
    data.encounters.forEach((e) => {
        if (e.obstacle != null && e.obstacles == null) e.obstacles = e.obstacle;
        if (e.informationRevealed != null && e.clues == null) e.clues = e.informationRevealed;
        if (e.consequence != null && e.consequences == null) e.consequences = e.consequence;
        if (!e.name) e.name = "";
        if (!e.type) e.type = [];
    });
    data.npcs.forEach((n) => { if (n.secret == null) n.secret = ""; });
    return data;
}

function loadAdventureData(data) {
    data = migrateSchema({ ...adventureData, ...data });
    adventureData = data;
    populateFormFromData(adventureData);
    renderThreads();
    renderEncounters();
    renderNPCs();
    renderLocations();
    renderPCMotivations();
}

function populateFormFromData(data) {
    const byId = (id) => document.getElementById(id);
    const set = (id, v) => { const el = byId(id); if (el) el.value = v != null ? v : ""; };
    set("title", data.title);
    set("party-level", data.partyLevel);
    set("party-size", data.partySize);
    set("tone", data.tone);
    set("setting", data.setting);
    set("starting-location", data.startingLocation);
    set("situation", data.situation);
    set("conflict", data.conflict);
    set("what-makes-unique", data.whatMakesItUnique);
    set("stakes", data.stakes);
    set("time-pressure", data.timePressure);
    set("hook-details", data.hookDetails);
    set("why-party-cares", data.whyPartyCares);
    set("refusal-plan", data.refusalPlan);
    set("expected-ending", data.expectedEnding);
    set("alt-ending-1", data.alternativeEndings && data.alternativeEndings[0]);
    set("alt-ending-2", data.alternativeEndings && data.alternativeEndings[1]);
    set("villain-dies-early", data.villainDiesEarlyPlan);

    const hookRadio = data.hookType && document.querySelector(`input[name="hookType"][value="${data.hookType}"]`);
    if (hookRadio) hookRadio.checked = true;

    const r = data.rewards || {};
    set("rewards-treasure", r.treasure);
    set("rewards-magic-items", r.magicItems);
    if (r.experience != null) set("rewards-xp", r.experience);
    const m = byId("rewards-milestone");
    if (m) m.checked = !!r.milestone;
    set("rewards-other", r.other);
}

function clearForm() {
    if (!confirm("Clear all form data?")) return;
    const form = document.getElementById("adventure-form");
    if (form) form.reset();

    adventureData = {
        schemaVersion: SCHEMA_VERSION,
        title: "",
        partyLevel: null,
        partySize: 4,
        tone: "",
        setting: "",
        startingLocation: "",
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
        villainDiesEarlyPlan: "",
        rewards: { treasure: "", magicItems: "", experience: null, milestone: false, other: "" }
    };

    const ids = ["threads-list", "encounters-list", "npcs-list", "locations-list", "pc-motivation-list"];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
    });
    const out = document.getElementById("packet-output");
    if (out) out.value = "";
    const pc = document.getElementById("party-size");
    if (pc) pc.value = 4;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

function rollHookTable() {
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
    const text = options[Math.floor(Math.random() * options.length)];
    const el = document.getElementById("hook-details");
    if (el) el.value = text;
    adventureData.hookDetails = text;
    saveToLocalStorage();
}

function addThread() {
    adventureData.threads.push({
        id: generateId(),
        lead: "",
        whereItPoints: "",
        costIfIgnored: ""
    });
    renderThreads();
    saveToLocalStorage();
}

function removeThread(id) {
    adventureData.threads = adventureData.threads.filter((t) => t.id !== id);
    renderThreads();
    saveToLocalStorage();
}

function renderThreads() {
    const container = document.getElementById("threads-list");
    if (!container) return;
    container.innerHTML = "";
    adventureData.threads.forEach((thread, index) => {
        const card = document.createElement("div");
        card.className = "thread-card";
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">Thread ${index + 1}</div>
                <button type="button" class="btn-remove" onclick="removeThread('${thread.id}')">Remove</button>
            </div>
            <div class="form-group">
                <label class="field-label">Lead</label>
                <input type="text" class="thread-lead" data-id="${thread.id}" value="${escapeText(thread.lead)}" placeholder="What players can investigate">
            </div>
            <div class="form-group">
                <label class="field-label">Where It Points</label>
                <input type="text" class="thread-where" data-id="${thread.id}" value="${escapeText(thread.whereItPoints)}" placeholder="Location/encounter/NPC">
            </div>
            <div class="form-group">
                <label class="field-label">Cost If Ignored</label>
                <input type="text" class="thread-cost" data-id="${thread.id}" value="${escapeText(thread.costIfIgnored)}" placeholder="Consequence if not pursued">
            </div>`;
        const leadEl = card.querySelector(".thread-lead");
        const whereEl = card.querySelector(".thread-where");
        const costEl = card.querySelector(".thread-cost");
        leadEl.addEventListener("input", (e) => { thread.lead = e.target.value; saveToLocalStorage(); });
        whereEl.addEventListener("input", (e) => { thread.whereItPoints = e.target.value; saveToLocalStorage(); });
        costEl.addEventListener("input", (e) => { thread.costIfIgnored = e.target.value; saveToLocalStorage(); });
        container.appendChild(card);
    });
}

function addEncounter() {
    adventureData.encounters.push({
        id: generateId(),
        name: "",
        type: [],
        objective: "",
        obstacles: "",
        clues: "",
        consequences: ""
    });
    renderEncounters();
    saveToLocalStorage();
}

function removeEncounter(id) {
    adventureData.encounters = adventureData.encounters.filter((e) => e.id !== id);
    renderEncounters();
    saveToLocalStorage();
}

function renderEncounters() {
    const container = document.getElementById("encounters-list");
    if (!container) return;
    container.innerHTML = "";
    const types = ["Exploration", "Social", "Combat"];
    adventureData.encounters.forEach((enc, index) => {
        const checkboxes = types.map((t) =>
            `<label><input type="checkbox" class="enc-type" data-id="${enc.id}" value="${t}" ${(enc.type || []).includes(t) ? "checked" : ""}> ${t}</label>`
        ).join("");
        const card = document.createElement("div");
        card.className = "encounter-card";
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">Encounter ${index + 1}</div>
                <button type="button" class="btn-remove" onclick="removeEncounter('${enc.id}')">Remove</button>
            </div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" class="enc-name" data-id="${enc.id}" value="${escapeText(enc.name)}" placeholder="Encounter name">
            </div>
            <div class="form-group">
                <label>Type</label>
                <div class="checkbox-group">${checkboxes}</div>
            </div>
            <div class="form-group">
                <label>Objective</label>
                <input type="text" class="enc-objective" data-id="${enc.id}" value="${escapeText(enc.objective)}" placeholder="What players want to accomplish">
            </div>
            <div class="form-group">
                <label>Obstacles</label>
                <input type="text" class="enc-obstacles" data-id="${enc.id}" value="${escapeText(enc.obstacles)}" placeholder="What stands in their way">
            </div>
            <div class="form-group">
                <label>Clues</label>
                <input type="text" class="enc-clues" data-id="${enc.id}" value="${escapeText(enc.clues)}" placeholder="Info/clue revealed">
            </div>
            <div class="form-group">
                <label>Consequences</label>
                <textarea class="enc-consequences" data-id="${enc.id}" rows="2" placeholder="What happens after (fail-forward)">${escapeText(enc.consequences)}</textarea>
            </div>`;
        const inputs = ["name", "objective", "obstacles", "clues", "consequences"];
        inputs.forEach((key) => {
            const sel = key === "consequences" ? ".enc-consequences" : `.enc-${key}`;
            const el = card.querySelector(sel);
            if (!el) return;
            const prop = key === "consequences" ? "consequences" : key;
            el.addEventListener("input", (e) => {
                enc[prop] = e.target.value;
                saveToLocalStorage();
            });
        });
        card.querySelectorAll(".enc-type").forEach((cb) => {
            cb.addEventListener("change", (e) => {
                enc.type = enc.type || [];
                if (e.target.checked) {
                    if (!enc.type.includes(e.target.value)) enc.type.push(e.target.value);
                } else {
                    enc.type = enc.type.filter((t) => t !== e.target.value);
                }
                saveToLocalStorage();
            });
        });
        container.appendChild(card);
    });
}

function addNPC() {
    adventureData.npcs.push({
        id: generateId(),
        name: "",
        role: "",
        motivation: "",
        secret: "",
        relationship: "",
        location: ""
    });
    renderNPCs();
    saveToLocalStorage();
}

function removeNPC(id) {
    adventureData.npcs = adventureData.npcs.filter((n) => n.id !== id);
    renderNPCs();
    saveToLocalStorage();
}

function renderNPCs() {
    const container = document.getElementById("npcs-list");
    if (!container) return;
    container.innerHTML = "";
    adventureData.npcs.forEach((npc, index) => {
        const card = document.createElement("div");
        card.className = "npc-card";
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
                <input type="text" class="npc-role" data-id="${npc.id}" value="${escapeText(npc.role)}" placeholder="Role">
            </div>
            <div class="form-group">
                <label>Motivation</label>
                <textarea class="npc-motivation" data-id="${npc.id}" rows="2" placeholder="What does this NPC want?">${escapeText(npc.motivation)}</textarea>
            </div>
            <div class="form-group">
                <label>Secret</label>
                <input type="text" class="npc-secret" data-id="${npc.id}" value="${escapeText(npc.secret)}" placeholder="Hidden secret">
            </div>
            <div class="form-group">
                <label>Relationship to Party</label>
                <input type="text" class="npc-relationship" data-id="${npc.id}" value="${escapeText(npc.relationship)}" placeholder="How they relate to party">
            </div>
            <div class="form-group">
                <label>Location</label>
                <input type="text" class="npc-location" data-id="${npc.id}" value="${escapeText(npc.location)}" placeholder="Where found">
            </div>`;
        ["name", "role", "motivation", "secret", "relationship", "location"].forEach((key) => {
            const sel = key === "motivation" ? ".npc-motivation" : `.npc-${key}`;
            const el = card.querySelector(sel);
            if (el) el.addEventListener("input", (e) => { npc[key] = e.target.value; saveToLocalStorage(); });
        });
        container.appendChild(card);
    });
}

function addLocation() {
    adventureData.locations.push({
        id: generateId(),
        name: "",
        description: "",
        features: ""
    });
    renderLocations();
    saveToLocalStorage();
}

function removeLocation(id) {
    adventureData.locations = adventureData.locations.filter((l) => l.id !== id);
    renderLocations();
    saveToLocalStorage();
}

function renderLocations() {
    const container = document.getElementById("locations-list");
    if (!container) return;
    container.innerHTML = "";
    adventureData.locations.forEach((loc, index) => {
        const card = document.createElement("div");
        card.className = "location-card";
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">Location ${index + 1}</div>
                <button type="button" class="btn-remove" onclick="removeLocation('${loc.id}')">Remove</button>
            </div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" class="loc-name" data-id="${loc.id}" value="${escapeText(loc.name)}" placeholder="Location name">
            </div>
            <div class="form-group">
                <label>Vibe / Description</label>
                <textarea class="loc-desc" data-id="${loc.id}" rows="2" placeholder="Description">${escapeText(loc.description)}</textarea>
            </div>
            <div class="form-group">
                <label>Key Features</label>
                <textarea class="loc-features" data-id="${loc.id}" rows="2" placeholder="Key features">${escapeText(loc.features)}</textarea>
            </div>`;
        card.querySelector(".loc-name").addEventListener("input", (e) => { loc.name = e.target.value; saveToLocalStorage(); });
        card.querySelector(".loc-desc").addEventListener("input", (e) => { loc.description = e.target.value; saveToLocalStorage(); });
        card.querySelector(".loc-features").addEventListener("input", (e) => { loc.features = e.target.value; saveToLocalStorage(); });
        container.appendChild(card);
    });
}

function addPCMotivation() {
    adventureData.perCharacterMotivation.push({ id: generateId(), pcName: "", reason: "" });
    renderPCMotivations();
    saveToLocalStorage();
}

function removePCMotivation(id) {
    adventureData.perCharacterMotivation = adventureData.perCharacterMotivation.filter((p) => p.id !== id);
    renderPCMotivations();
    saveToLocalStorage();
}

function renderPCMotivations() {
    const container = document.getElementById("pc-motivation-list");
    if (!container) return;
    container.innerHTML = "";
    adventureData.perCharacterMotivation.forEach((pc, index) => {
        const div = document.createElement("div");
        div.className = "form-group";
        div.style.cssText = "margin-bottom:1rem;padding:1rem;background:var(--card-bg, #f8f9fa);border-radius:4px;";
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                <label style="font-weight:600;">PC ${index + 1}</label>
                <button type="button" class="btn-remove" onclick="removePCMotivation('${pc.id}')">Remove</button>
            </div>
            <div class="form-group" style="margin-bottom:0.5rem;">
                <label>PC Name</label>
                <input type="text" class="pc-name" data-id="${pc.id}" value="${escapeText(pc.pcName)}" placeholder="Character name">
            </div>
            <div class="form-group">
                <label>Reason</label>
                <textarea class="pc-reason" data-id="${pc.id}" rows="2" placeholder="Why does this PC care?">${escapeText(pc.reason)}</textarea>
            </div>`;
        div.querySelector(".pc-name").addEventListener("input", (e) => { pc.pcName = e.target.value; saveToLocalStorage(); });
        div.querySelector(".pc-reason").addEventListener("input", (e) => { pc.reason = e.target.value; saveToLocalStorage(); });
        container.appendChild(div);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    loadFromLocalStorage();
    const form = document.getElementById("adventure-form");
    if (form) {
        form.addEventListener("input", debounce(saveToLocalStorage, 500));
        form.addEventListener("change", debounce(saveToLocalStorage, 500));
    }
});

function switchTab(tabName) {
    const manualSection = document.getElementById("manual-builder-section");
    const aiSection = document.getElementById("ai-assistant-section");
    const manualTab = document.getElementById("tab-manual");
    const aiTab = document.getElementById("tab-ai");
    if (tabName === "ai") {
        if (manualSection) manualSection.style.display = "none";
        if (aiSection) aiSection.style.display = "block";
        if (manualTab) manualTab.classList.remove("active");
        if (aiTab) aiTab.classList.add("active");
    } else {
        if (manualSection) manualSection.style.display = "block";
        if (aiSection) aiSection.style.display = "none";
        if (manualTab) manualTab.classList.add("active");
        if (aiTab) aiTab.classList.remove("active");
    }
}

function generateAIPrompt() {
    const partyLevel = document.getElementById("ai-party-level")?.value;
    const partySize = document.getElementById("ai-party-size")?.value || 4;
    const tone = document.getElementById("ai-tone")?.value || "Any";
    const adventureLength = document.getElementById("ai-adventure-length")?.value;
    const hookPreference = document.getElementById("ai-hook-preference")?.value;
    if (!partyLevel) {
        alert("Please enter a party level");
        return;
    }
    const prompt = `You are an expert D&D 5e adventure designer following the Dungeon Master's Guide principles.

Task: Create a complete D&D 5e adventure as a structured JSON object.

Requirements:
- Party Level: ${partyLevel}
- Party Size: ${partySize}
- Tone: ${tone === "Any" ? "Choose an appropriate tone" : tone}
- Adventure Length: ${adventureLength}
- Hook Type Preference: ${hookPreference === "Any" ? "Choose an appropriate hook type" : hookPreference}

DMG Principles to Follow:
1. Adventures are situations, not fixed plots - players are co-authors
2. Every encounter needs an objective (what players want) + obstacles (what stands in their way)
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
  "tone": "${tone === "Any" ? "[choose appropriate tone]" : tone}",
  "setting": "Broad setting (e.g., Waterdeep, Dock Ward)",
  "startingLocation": "Optional specific starting location (e.g., The Yawning Portal)",
  "situation": "What's happening in the world that needs heroes",
  "conflict": "The specific problem or threat that needs to be addressed",
  "whatMakesItUnique": "What makes this adventure special and memorable",
  "stakes": "What happens if ignored, if heroes fail, and if they succeed",
  "timePressure": "Any urgency, deadlines, or consequences of delay",
  "hookType": "${hookPreference === "Any" ? "[Patron|Supernatural|Happenstance]" : hookPreference}",
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
      "name": "Encounter name",
      "type": ["Exploration", "Social", "Combat"],
      "objective": "What players want to accomplish",
      "obstacles": "What stands in their way",
      "clues": "What clue or information is revealed",
      "consequences": "What happens after (success or fail-forward - must move story forward)"
    }
  ],
  "npcs": [
    {
      "name": "NPC name",
      "role": "NPC's role in the story",
      "motivation": "What this NPC wants",
      "secret": "Hidden secret about this NPC",
      "relationship": "How this NPC relates to the party",
      "location": "Where this NPC is found"
    }
  ],
  "locations": [
    {
      "name": "Location name",
      "description": "Description/vibe of the location",
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
    const promptOutput = document.getElementById("ai-prompt-output");
    const promptText = document.getElementById("ai-prompt-text");
    if (promptText) promptText.value = prompt;
    if (promptOutput) {
        promptOutput.style.display = "block";
        promptOutput.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

function copyAIPrompt() {
    const promptText = document.getElementById("ai-prompt-text");
    if (!promptText) return;
    promptText.select();
    promptText.setSelectionRange(0, 99999);
    try {
        document.execCommand("copy");
        const btn = event.target;
        if (btn) {
            const orig = btn.textContent;
            btn.textContent = "✓ Copied!";
            setTimeout(() => { btn.textContent = orig; }, 2000);
        }
    } catch (err) {
        alert("Failed to copy prompt. Please select and copy manually.");
    }
}

function validateAIData(data) {
    const errors = [];
    if (!data.title) errors.push("Missing title");
    if (!data.partyLevel) errors.push("Missing partyLevel");
    if (!data.situation) errors.push("Missing situation");
    if (!data.conflict) errors.push("Missing conflict");
    if (!data.hookType) errors.push("Missing hookType");
    if (!data.hookDetails) errors.push("Missing hookDetails");
    if (!data.encounters || !Array.isArray(data.encounters) || data.encounters.length === 0) {
        errors.push("Missing or empty encounters array");
    } else {
        data.encounters.forEach((enc, index) => {
            if (!enc.objective) errors.push(`Encounter ${index + 1} missing objective`);
            if (!enc.obstacles && !enc.obstacle) errors.push(`Encounter ${index + 1} missing obstacles`);
        });
    }
    return { errors };
}

function mapAIDataToSchema(aiData) {
    return {
        schemaVersion: SCHEMA_VERSION,
        title: aiData.title || "",
        partyLevel: aiData.partyLevel || null,
        partySize: aiData.partySize || 4,
        tone: aiData.tone || "",
        setting: aiData.setting || aiData.location || "",
        startingLocation: aiData.startingLocation || "",
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
        encounters: (aiData.encounters || []).map((e) => ({
            id: e.id || generateId(),
            name: e.name || "",
            type: e.type || [],
            objective: e.objective || "",
            obstacles: e.obstacles || e.obstacle || "",
            clues: e.clues || e.informationRevealed || "",
            consequences: e.consequences || e.consequence || ""
        })),
        npcs: (aiData.npcs || []).map((n) => ({
            id: n.id || generateId(),
            name: n.name || "",
            role: n.role || "",
            motivation: n.motivation || "",
            secret: n.secret || "",
            relationship: n.relationship || "",
            location: n.location || ""
        })),
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
    adventureData = { ...adventureData, ...data };
    adventureData.threads.forEach((t) => { if (!t.id) t.id = generateId(); });
    adventureData.encounters.forEach((e) => {
        if (!e.id) e.id = generateId();
        if (!e.type) e.type = [];
    });
    adventureData.npcs.forEach((n) => { if (!n.id) n.id = generateId(); });
    adventureData.locations.forEach((l) => { if (!l.id) l.id = generateId(); });
    populateFormFromData(adventureData);
    renderThreads();
    renderEncounters();
    renderNPCs();
    renderLocations();
    renderPCMotivations();
    saveToLocalStorage();
}

function parseAIResponse() {
    const responseInput = document.getElementById("ai-response-input");
    if (!responseInput) return;
    const text = responseInput.value.trim();
    const errorBox = document.getElementById("ai-parse-errors");
    const successBox = document.getElementById("ai-parse-success");
    const successMessage = document.getElementById("ai-parse-message");
    if (errorBox) errorBox.style.display = "none";
    if (successBox) successBox.style.display = "none";
    if (!text) {
        if (errorBox) {
            errorBox.style.display = "block";
            errorBox.textContent = "Please paste the AI response first.";
        }
        return;
    }
    try {
        let jsonText = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonText = jsonMatch[0];
        const aiData = JSON.parse(jsonText);
        const validation = validateAIData(aiData);
        if (validation.errors.length > 0) {
            if (errorBox) {
                errorBox.style.display = "block";
                errorBox.textContent = "Validation errors: " + validation.errors.join("; ");
            }
            return;
        }
        const mappedData = mapAIDataToSchema(aiData);
        populateFromAI(mappedData);
        if (successBox && successMessage) {
            successBox.style.display = "block";
            successMessage.textContent = "Form populated successfully! Switching to Manual Builder tab...";
        }
        setTimeout(() => {
            switchTab("manual");
            if (successBox) successBox.style.display = "none";
            const manualSection = document.getElementById("manual-builder-section");
            if (manualSection) manualSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 2000);
    } catch (err) {
        if (errorBox) {
            errorBox.style.display = "block";
            errorBox.textContent = "Failed to parse JSON: " + err.message + ". Please ensure the AI response is valid JSON.";
        }
        console.error("Parse error:", err);
    }
}

function clearAIResponse() {
    const input = document.getElementById("ai-response-input");
    const errorBox = document.getElementById("ai-parse-errors");
    const successBox = document.getElementById("ai-parse-success");
    if (input) input.value = "";
    if (errorBox) errorBox.style.display = "none";
    if (successBox) successBox.style.display = "none";
}

window.toggleGuidance = toggleGuidance;
window.rollHookTable = rollHookTable;
window.switchTab = switchTab;
window.generateAIPrompt = generateAIPrompt;
window.copyAIPrompt = copyAIPrompt;
window.parseAIResponse = parseAIResponse;
window.clearAIResponse = clearAIResponse;
window.generatePacket = generatePacket;
window.copyPacket = copyPacket;
window.exportPacketTxt = exportPacketTxt;
window.exportJSON = exportJSON;
window.importJSON = importJSON;
window.clearForm = clearForm;
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
