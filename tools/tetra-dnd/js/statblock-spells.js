var SpellLinker = {
    SRD_PATH: "../spellcards/srd-5.2-spells.json",

    byName: null,
    nameRegex: null,
    loadPromise: null,
    initialized: false,
    clickBound: false,

    init: function () {
        if (this.initialized) return this.loadPromise || Promise.resolve();
        this.initialized = true;
        this.bindClick();
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
        // Boundaries so "light" does not match inside "lightning"; names may include apostrophes
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
            var btn = e.target.closest(".spell-link");
            if (!btn || !statBlock.contains(btn)) return;
            e.preventDefault();
            e.stopPropagation();
            var key = (btn.getAttribute("data-spell") || "").toLowerCase();
            var spell = self.byName && self.byName.get(key);
            if (spell) self.showSpell(spell);
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

    showSpell: function (spell) {
        var title = document.getElementById("spell-detail-title");
        var body = document.getElementById("spell-detail-body");
        if (!title || !body) return;

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
