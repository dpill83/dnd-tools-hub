var SpellSlots = {
    STORAGE_KEY: "tetra-spell-slots-v1",
    // "1st lvl (4 slots)" / "2nd level (3 slots)" / "3rd-level (2 slots)"
    SLOT_PAREN_RE: /(\d+(?:st|nd|rd|th)[-\s]+(?:lvl|level)\s*)(\((\d+)\s*slots?\))/gi,

    byMonster: {},
    clickBound: false,
    currentMaxByLevel: {},

    init: function () {
        this.rehydrate();
        this.bindClick();
    },

    getMonsterKey: function () {
        if (typeof mon !== "undefined" && mon && mon.name) {
            var fromMon = String(mon.name).trim();
            if (fromMon) return fromMon;
        }
        var nameEl = document.getElementById("monster-name");
        if (nameEl) {
            var fromDom = nameEl.textContent.trim();
            if (fromDom) return fromDom;
        }
        return "Creature";
    },

    rehydrate: function () {
        try {
            var raw = sessionStorage.getItem(this.STORAGE_KEY);
            if (!raw) {
                this.byMonster = {};
                return;
            }
            var parsed = JSON.parse(raw);
            this.byMonster = parsed && typeof parsed === "object" ? parsed : {};
        } catch (e) {
            this.byMonster = {};
        }
    },

    persist: function () {
        try {
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.byMonster));
        } catch (e) { /* ignore quota */ }
    },

    getMonsterState: function () {
        var key = this.getMonsterKey();
        if (!this.byMonster[key] || typeof this.byMonster[key] !== "object") {
            this.byMonster[key] = {};
        }
        return this.byMonster[key];
    },

    ensureLevel: function (level, max) {
        var state = this.getMonsterState();
        var key = String(level);
        var maxSlots = Math.max(0, parseInt(max, 10) || 0);
        if (!state[key] || typeof state[key] !== "object") {
            state[key] = { max: maxSlots, used: 0 };
        } else {
            state[key].max = maxSlots;
            state[key].used = Math.max(0, Math.min(maxSlots, parseInt(state[key].used, 10) || 0));
        }
        this.currentMaxByLevel[key] = maxSlots;
        return state[key];
    },

    getLevelState: function (level) {
        var key = String(level);
        var state = this.getMonsterState();
        if (state[key] && typeof state[key] === "object") return state[key];
        var max = this.currentMaxByLevel[key];
        if (max == null) return null;
        return this.ensureLevel(level, max);
    },

    spend: function (level) {
        var entry = this.getLevelState(level);
        if (!entry) return false;
        if (entry.used >= entry.max) return false;
        entry.used += 1;
        this.persist();
        this.refreshDom();
        return true;
    },

    restoreOne: function (level) {
        var entry = this.getLevelState(level);
        if (!entry) return false;
        if (entry.used <= 0) return false;
        entry.used -= 1;
        this.persist();
        this.refreshDom();
        return true;
    },

    restoreLevel: function (level) {
        var entry = this.getLevelState(level);
        if (!entry) return false;
        if (entry.used <= 0) return false;
        entry.used = 0;
        this.persist();
        this.refreshDom();
        return true;
    },

    restAll: function () {
        var state = this.getMonsterState();
        Object.keys(state).forEach(function (key) {
            if (state[key] && typeof state[key] === "object") state[key].used = 0;
        });
        this.persist();
        this.refreshDom();
    },

    remaining: function (level) {
        var entry = this.getLevelState(level);
        if (!entry) return 0;
        return Math.max(0, entry.max - entry.used);
    },

    ordinalLabel: function (level) {
        var n = parseInt(level, 10) || 0;
        var suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
        return n + suffix;
    },

    createTracker: function (level, max) {
        var entry = this.ensureLevel(level, max);
        var wrap = document.createElement("span");
        wrap.className = "spell-slot-tracker";
        wrap.setAttribute("data-level", String(level));
        wrap.setAttribute("data-max", String(entry.max));
        wrap.setAttribute("data-used", String(entry.used));
        wrap.setAttribute("role", "group");
        wrap.setAttribute(
            "aria-label",
            this.ordinalLabel(level) + "-level spell slots, " +
            (entry.max - entry.used) + " of " + entry.max + " remaining"
        );

        for (var i = 0; i < entry.max; i++) {
            var spent = i < entry.used;
            var pip = document.createElement("button");
            pip.type = "button";
            pip.className = "spell-slot-pip" + (spent ? " is-spent" : "");
            pip.setAttribute("data-level", String(level));
            pip.setAttribute("data-index", String(i));
            pip.setAttribute("aria-pressed", spent ? "true" : "false");
            pip.setAttribute(
                "title",
                spent
                    ? "Restore a " + this.ordinalLabel(level) + "-level slot"
                    : "Spend a " + this.ordinalLabel(level) + "-level slot"
            );
            pip.textContent = spent ? "\u25CB" : "\u25CF";
            wrap.appendChild(pip);
        }

        var rest = document.createElement("button");
        rest.type = "button";
        rest.className = "spell-slot-rest";
        rest.setAttribute("data-action", "rest-level");
        rest.setAttribute("data-level", String(level));
        rest.setAttribute("title", "Restore all " + this.ordinalLabel(level) + "-level slots");
        rest.setAttribute("aria-label", "Restore all " + this.ordinalLabel(level) + "-level slots");
        rest.textContent = "\u21BA";
        wrap.appendChild(rest);

        return wrap;
    },

    refreshDom: function () {
        var root = document.getElementById("stat-block");
        if (!root) return;
        var self = this;
        root.querySelectorAll(".spell-slot-tracker").forEach(function (tracker) {
            var level = parseInt(tracker.getAttribute("data-level"), 10);
            var max = parseInt(tracker.getAttribute("data-max"), 10);
            var entry = self.ensureLevel(level, max);
            var parent = tracker.parentNode;
            if (!parent) return;
            parent.replaceChild(self.createTracker(level, entry.max), tracker);
        });
        if (typeof SpellLinker !== "undefined" && SpellLinker.updateSpendButton) {
            SpellLinker.updateSpendButton();
        }
    },

    isInsideTracker: function (node) {
        var parent = node.parentElement;
        while (parent) {
            if (parent.classList && parent.classList.contains("spell-slot-tracker")) return true;
            parent = parent.parentElement;
        }
        return false;
    },

    collectTextNodes: function (root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
    },

    decorateBlock: function (block) {
        var self = this;
        this.currentMaxByLevel = {};
        var nodes = this.collectTextNodes(block);
        nodes.forEach(function (node) {
            if (self.isInsideTracker(node)) return;
            var text = node.nodeValue;
            if (!text || !/\(\d+\s*slots?\)/i.test(text)) return;

            self.SLOT_PAREN_RE.lastIndex = 0;
            var parts = [];
            var lastIndex = 0;
            var match;
            var found = false;
            while ((match = self.SLOT_PAREN_RE.exec(text)) !== null) {
                found = true;
                if (match.index > lastIndex) {
                    parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
                }
                parts.push({ type: "text", value: match[1] });
                var max = parseInt(match[3], 10) || 0;
                // Infer level from the ordinal prefix in match[1]
                var levelMatch = match[1].match(/(\d+)/);
                var level = levelMatch ? parseInt(levelMatch[1], 10) : 0;
                if (level >= 1 && level <= 9 && max > 0) {
                    parts.push({ type: "slots", level: level, max: max });
                } else {
                    parts.push({ type: "text", value: match[2] });
                }
                lastIndex = self.SLOT_PAREN_RE.lastIndex;
            }
            if (!found) return;
            if (lastIndex < text.length) {
                parts.push({ type: "text", value: text.slice(lastIndex) });
            }

            var parent = node.parentNode;
            if (!parent) return;
            var fragment = document.createDocumentFragment();
            parts.forEach(function (part) {
                if (part.type === "slots") {
                    fragment.appendChild(self.createTracker(part.level, part.max));
                } else {
                    fragment.appendChild(document.createTextNode(part.value));
                }
            });
            parent.replaceChild(fragment, node);
        });
        this.persist();
    },

    bindClick: function () {
        if (this.clickBound) return;
        this.clickBound = true;
        var self = this;
        var statBlock = document.getElementById("stat-block");
        if (!statBlock) return;
        statBlock.addEventListener("click", function (e) {
            var restBtn = e.target.closest(".spell-slot-rest");
            if (restBtn && statBlock.contains(restBtn)) {
                e.preventDefault();
                e.stopPropagation();
                var restLevel = parseInt(restBtn.getAttribute("data-level"), 10);
                if (restLevel >= 1) self.restoreLevel(restLevel);
                else self.restAll();
                return;
            }
            var pip = e.target.closest(".spell-slot-pip");
            if (!pip || !statBlock.contains(pip)) return;
            e.preventDefault();
            e.stopPropagation();
            var level = parseInt(pip.getAttribute("data-level"), 10);
            if (pip.classList.contains("is-spent")) {
                self.restoreOne(level);
            } else {
                self.spend(level);
            }
        });
    }
};

var SpellLinker = {
    SRD_PATH: "../spellcards/srd-5.2-spells.json",

    byName: null,
    nameRegex: null,
    loadPromise: null,
    initialized: false,
    clickBound: false,
    activeSpell: null,

    init: function () {
        if (this.initialized) return this.loadPromise || Promise.resolve();
        this.initialized = true;
        SpellSlots.init();
        this.bindClick();
        this.bindSpendButton();
        this.loadPromise = this.loadSpells();
        return this.loadPromise;
    },

    loadSpells: function () {
        var self = this;
        return fetch(this.SRD_PATH)
            .then(function (res) {
                if (!res.ok) throw new Error("Failed to load SRD spells (" + res.status + ")");
                return res.json();
            })
            .then(function (spells) {
                self.buildLookup(Array.isArray(spells) ? spells : []);
            })
            .catch(function (err) {
                console.warn("SpellLinker: could not load SRD spells", err);
                self.byName = new Map();
                self.nameRegex = null;
            });
    },

    buildLookup: function (spells) {
        var byName = new Map();
        spells.forEach(function (spell) {
            if (!spell || !spell.name) return;
            byName.set(String(spell.name).toLowerCase(), spell);
        });
        this.byName = byName;

        var names = Array.from(byName.keys()).sort(function (a, b) {
            return b.length - a.length;
        });
        if (names.length === 0) {
            this.nameRegex = null;
            return;
        }
        var escaped = names.map(function (name) {
            return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        });
        this.nameRegex = new RegExp(
            "(^|[^A-Za-z0-9'])(" + escaped.join("|") + ")(?![A-Za-z0-9'])",
            "gi"
        );
    },

    bindClick: function () {
        if (this.clickBound) return;
        this.clickBound = true;
        var self = this;
        var statBlock = document.getElementById("stat-block");
        if (!statBlock) return;
        statBlock.addEventListener("click", function (e) {
            if (e.target.closest(".spell-slot-tracker")) return;
            var btn = e.target.closest(".spell-link");
            if (!btn || !statBlock.contains(btn)) return;
            e.preventDefault();
            e.stopPropagation();
            var key = (btn.getAttribute("data-spell") || "").toLowerCase();
            var spell = self.byName && self.byName.get(key);
            if (spell) self.showSpell(spell);
        });
    },

    bindSpendButton: function () {
        var self = this;
        var spendBtn = document.getElementById("spell-detail-spend");
        if (!spendBtn || spendBtn._spellSpendBound) return;
        spendBtn._spellSpendBound = true;
        spendBtn.addEventListener("click", function () {
            if (!self.activeSpell) return;
            var level = Number(self.activeSpell.level) || 0;
            if (level < 1) return;
            if (SpellSlots.spend(level)) {
                self.updateSpendButton();
            }
        });
    },

    escapeHtml: function (value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    },

    formatLevelSchool: function (spell) {
        var level = Number(spell.level);
        var school = spell.school || "";
        if (level === 0) return school ? "Cantrip (" + school + ")" : "Cantrip";
        var ordinal = level + (level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th");
        return school ? ordinal + "-level " + school : ordinal + "-level";
    },

    formatCastingTime: function (spell) {
        var map = {
            action: "Action",
            bonusAction: "Bonus Action",
            reaction: "Reaction"
        };
        return map[spell.actionType] || (spell.actionType || "—");
    },

    formatComponents: function (spell) {
        var comps = Array.isArray(spell.components) ? spell.components : [];
        var labeled = comps.map(function (c) {
            return String(c).toUpperCase();
        });
        var text = labeled.join(", ");
        if (spell.material) {
            text += (text ? " " : "") + "(" + spell.material + ")";
        }
        return text || "—";
    },

    formatDuration: function (spell) {
        var parts = [];
        if (spell.concentration) parts.push("Concentration");
        if (spell.duration) parts.push(spell.duration);
        if (spell.ritual) parts.push("Ritual");
        return parts.length ? parts.join(", ") : "—";
    },

    updateSpendButton: function () {
        var spendBtn = document.getElementById("spell-detail-spend");
        if (!spendBtn) return;
        var spell = this.activeSpell;
        if (!spell || Number(spell.level) < 1) {
            spendBtn.hidden = true;
            return;
        }
        var level = Number(spell.level);
        var entry = SpellSlots.getLevelState(level);
        if (!entry || entry.max <= 0) {
            spendBtn.hidden = true;
            return;
        }
        var remaining = Math.max(0, entry.max - entry.used);
        spendBtn.hidden = false;
        spendBtn.disabled = remaining <= 0;
        spendBtn.textContent = remaining > 0
            ? "Spend " + SpellSlots.ordinalLabel(level) + "-level slot (" + remaining + "/" + entry.max + ")"
            : "No " + SpellSlots.ordinalLabel(level) + "-level slots left";
    },

    showSpell: function (spell) {
        var title = document.getElementById("spell-detail-title");
        var body = document.getElementById("spell-detail-body");
        if (!title || !body) return;

        this.activeSpell = spell;
        title.textContent = spell.name || "Spell";

        var descHtml = this.escapeHtml(spell.description || "").replace(/\n/g, "<br>");
        var extra = "";
        if (spell.higherLevelSlot) {
            extra +=
                '<p class="spell-detail-extra"><strong>Using a Higher-Level Spell Slot.</strong> ' +
                this.escapeHtml(spell.higherLevelSlot) +
                "</p>";
        }
        if (spell.cantripUpgrade) {
            extra +=
                '<p class="spell-detail-extra"><strong>Cantrip Upgrade.</strong> ' +
                this.escapeHtml(spell.cantripUpgrade) +
                "</p>";
        }

        body.innerHTML =
            '<p class="spell-detail-meta">' + this.escapeHtml(this.formatLevelSchool(spell)) + "</p>" +
            '<dl class="spell-detail-stats">' +
            "<div><dt>Casting Time</dt><dd>" + this.escapeHtml(this.formatCastingTime(spell)) + "</dd></div>" +
            "<div><dt>Range</dt><dd>" + this.escapeHtml(spell.range || "—") + "</dd></div>" +
            "<div><dt>Components</dt><dd>" + this.escapeHtml(this.formatComponents(spell)) + "</dd></div>" +
            "<div><dt>Duration</dt><dd>" + this.escapeHtml(this.formatDuration(spell)) + "</dd></div>" +
            "</dl>" +
            '<div class="spell-detail-description">' + descHtml + "</div>" +
            extra;

        this.updateSpendButton();

        if (typeof DiceRoller !== "undefined" && DiceRoller.decorateSpellText) {
            DiceRoller.decorateSpellText(body, spell.name);
        }

        if (typeof $ !== "undefined" && $("#spell-detail-modal").modal) {
            $("#spell-detail-modal").modal("show");
        }
    },

    isInsideProtected: function (node) {
        var parent = node.parentElement;
        while (parent) {
            if (parent.classList) {
                if (parent.classList.contains("dice-roll")) return true;
                if (parent.classList.contains("spell-link")) return true;
                if (parent.classList.contains("spell-slot-tracker")) return true;
                if (parent.tagName === "H4") return true;
            }
            parent = parent.parentElement;
        }
        return false;
    },

    collectTextNodes: function (root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
    },

    createSpellButton: function (text, spellKey) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "spell-link";
        btn.textContent = text;
        btn.setAttribute("data-spell", spellKey);
        btn.setAttribute("title", "View spell");
        return btn;
    },

    decorateBlock: function (block) {
        if (!this.nameRegex || !this.byName || this.byName.size === 0) return;
        var self = this;
        var nodes = this.collectTextNodes(block);
        nodes.forEach(function (node) {
            if (self.isInsideProtected(node)) return;
            var text = node.nodeValue;
            if (!text || !text.trim()) return;

            self.nameRegex.lastIndex = 0;
            if (!self.nameRegex.test(text)) return;
            self.nameRegex.lastIndex = 0;

            var parts = [];
            var lastIndex = 0;
            var match;
            while ((match = self.nameRegex.exec(text)) !== null) {
                var prefix = match[1] || "";
                var matched = match[2] || "";
                if (match.index > lastIndex) {
                    parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
                }
                if (prefix) {
                    parts.push({ type: "text", value: prefix });
                }
                var key = matched.toLowerCase();
                if (matched && self.byName.has(key)) {
                    parts.push({ type: "spell", text: matched, key: key });
                } else if (matched) {
                    parts.push({ type: "text", value: matched });
                }
                lastIndex = self.nameRegex.lastIndex;
            }
            if (parts.length === 0) return;
            if (lastIndex < text.length) {
                parts.push({ type: "text", value: text.slice(lastIndex) });
            }

            var parent = node.parentNode;
            if (!parent) return;
            var fragment = document.createDocumentFragment();
            parts.forEach(function (part) {
                if (part.type === "spell") {
                    fragment.appendChild(self.createSpellButton(part.text, part.key));
                } else {
                    fragment.appendChild(document.createTextNode(part.value));
                }
            });
            parent.replaceChild(fragment, node);
        });
    },

    decorate: function (root) {
        if (!root) return;
        var self = this;
        this.init().then(function () {
            var blocks = root.querySelectorAll(".property-block");
            blocks.forEach(function (block) {
                var h4 = block.querySelector("h4");
                if (!h4) return;
                var title = h4.textContent.replace(/\.\s*$/, "").trim();
                if (!/spellcasting/i.test(title)) return;
                // Slots first so spell-name linking skips tracker nodes
                SpellSlots.decorateBlock(block);
                self.decorateBlock(block);
            });
        });
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { SpellLinker.init(); });
} else {
    SpellLinker.init();
}
