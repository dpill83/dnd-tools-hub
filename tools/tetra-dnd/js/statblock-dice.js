var DiceRoller = {
    STORAGE_ENTRIES: "tetra-dice-log-v1",
    STORAGE_UI: "tetra-dice-log-ui-v1",
    MAX_ENTRIES: 100,
    COLLAPSED_COUNT: 3,
    TIMESTAMP_MS: 30000,

    root: null,
    live: null,
    tab: null,
    panel: null,
    list: null,
    empty: null,
    btnMinimize: null,
    btnExpand: null,
    btnClear: null,

    entries: [],
    uiState: "hidden",
    timestampTimer: null,
    initialized: false,

    init: function () {
        if (this.initialized) return;

        this.root = document.getElementById("dice-log");
        this.live = document.getElementById("dice-log-live");
        this.tab = document.getElementById("dice-log-tab");
        this.panel = document.getElementById("dice-log-panel");
        this.list = document.getElementById("dice-log-list");
        this.empty = document.getElementById("dice-log-empty");
        this.btnMinimize = document.getElementById("dice-log-minimize");
        this.btnExpand = document.getElementById("dice-log-expand");
        this.btnClear = document.getElementById("dice-log-clear");

        this.rehydrate();

        var statBlock = document.getElementById("stat-block");
        if (statBlock) {
            statBlock.addEventListener("click", this.handleClick.bind(this));
        }

        if (this.root) {
            this.root.addEventListener("click", this.handleLogClick.bind(this));
        }

        this.setState(this.uiState, true);
        this.initialized = true;
    },

    /* ---- expression / evaluate ---- */

    /**
     * Parse NdM±K (e.g. 1d20+10, 2d6+3). Keep this the single expression format for
     * stored records so it can later extend to keep-highest/lowest (e.g. 2d20kh1+10)
     * without rewriting history.
     */
    parseDiceExpr: function (expr) {
        if (!expr) return null;
        var normalized = String(expr).replace(/\s+/g, "");
        var match = normalized.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
        if (!match) return null;
        return {
            count: parseInt(match[1], 10),
            sides: parseInt(match[2], 10),
            mod: match[3] ? parseInt(match[3], 10) : 0
        };
    },

    formatExpression: function (count, sides, mod) {
        mod = parseInt(mod, 10) || 0;
        var expr = count + "d" + sides;
        if (mod > 0) expr += "+" + mod;
        else if (mod < 0) expr += String(mod);
        return expr;
    },

    expressionFromButton: function (btn) {
        var rollType = btn.getAttribute("data-roll");
        if (rollType === "d20") {
            return this.formatExpression(1, 20, btn.getAttribute("data-mod"));
        }
        if (rollType === "dice") {
            return this.formatExpression(
                btn.getAttribute("data-count"),
                btn.getAttribute("data-sides"),
                btn.getAttribute("data-mod")
            );
        }
        return null;
    },

    evaluate: function (expression) {
        var parsed = this.parseDiceExpr(expression);
        if (!parsed) return null;

        var dice = [];
        for (var i = 0; i < parsed.count; i++) {
            dice.push(Math.floor(Math.random() * parsed.sides) + 1);
        }
        var sum = dice.reduce(function (a, b) { return a + b; }, 0);
        var note = "";
        if (parsed.count === 1 && parsed.sides === 20) {
            if (dice[0] === 20) note = "crit";
            else if (dice[0] === 1) note = "fumble";
        }
        return {
            dice: dice,
            modifier: parsed.mod,
            total: sum + parsed.mod,
            note: note
        };
    },

    /* ---- store ---- */

    makeId: function () {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    getMonsterPrefix: function () {
        var shortName = "";
        var fullName = "";
        if (typeof mon !== "undefined" && mon) {
            shortName = (mon.shortName || "").trim();
            fullName = (mon.name || "").trim();
        }
        if (!fullName) {
            var nameEl = document.getElementById("monster-name");
            if (nameEl) fullName = nameEl.textContent.trim();
        }
        if (shortName) return shortName;
        if (!fullName) return "";
        return fullName.split(/\s+/)[0];
    },

    buildLabel: function (btn) {
        var label = btn.getAttribute("data-label") || btn.textContent.trim();
        var traitName = this.getTraitLabel(btn);
        if (traitName) label = traitName + " \u2014 " + label;
        var prefix = this.getMonsterPrefix();
        if (prefix) label = prefix + " \u00b7 " + label;
        return label;
    },

    push: function (record) {
        this.entries.push(record);
        while (this.entries.length > this.MAX_ENTRIES) {
            this.entries.shift();
        }
        this.persistEntries();
        this.announce(record);

        if (this.uiState === "hidden") {
            this.setState("collapsed");
        } else {
            this.render();
            if (this.uiState === "expanded") this.scrollToNewest();
        }
    },

    clearAll: function () {
        this.entries = [];
        this.persistEntries();
        this.render();
    },

    persistEntries: function () {
        try {
            sessionStorage.setItem(this.STORAGE_ENTRIES, JSON.stringify({
                v: 1,
                entries: this.entries
            }));
        } catch (e) { /* ignore quota / private mode */ }
    },

    persistUi: function () {
        try {
            sessionStorage.setItem(this.STORAGE_UI, JSON.stringify({
                v: 1,
                state: this.uiState
            }));
        } catch (e) { /* ignore */ }
    },

    rehydrate: function () {
        try {
            var raw = sessionStorage.getItem(this.STORAGE_ENTRIES);
            if (raw) {
                var data = JSON.parse(raw);
                if (data && data.v === 1 && Array.isArray(data.entries)) {
                    this.entries = data.entries.slice(-this.MAX_ENTRIES);
                }
            }
        } catch (e) {
            this.entries = [];
        }
        try {
            var uiRaw = sessionStorage.getItem(this.STORAGE_UI);
            if (uiRaw) {
                var ui = JSON.parse(uiRaw);
                if (ui && ui.v === 1 && (ui.state === "hidden" || ui.state === "collapsed" || ui.state === "expanded")) {
                    this.uiState = ui.state;
                }
            }
        } catch (e) {
            this.uiState = "hidden";
        }
    },

    /* ---- display helpers ---- */

    formatNote: function (note) {
        if (note === "crit") return "Natural 20";
        if (note === "fumble") return "Natural 1";
        return "";
    },

    formatRelativeTime: function (at) {
        var diff = Math.max(0, Date.now() - at);
        var sec = Math.floor(diff / 1000);
        if (sec < 45) return "Just now";
        var min = Math.floor(sec / 60);
        if (min < 60) return min === 1 ? "1 min ago" : min + " min ago";
        var hr = Math.floor(min / 60);
        if (hr < 24) return hr === 1 ? "1 hr ago" : hr + " hr ago";
        var day = Math.floor(hr / 24);
        return day === 1 ? "1 day ago" : day + " days ago";
    },

    formatMod: function (mod) {
        if (mod > 0) return " + " + mod;
        if (mod < 0) return " \u2212 " + (-mod);
        return "";
    },

    announce: function (record) {
        if (!this.live) return;
        var noteText = this.formatNote(record.note);
        var text = record.label + ": " + record.total;
        if (noteText) text += " (" + noteText + ")";
        // Clear then set so identical consecutive announcements still fire
        this.live.textContent = "";
        var live = this.live;
        setTimeout(function () { live.textContent = text; }, 0);
    },

    /* ---- UI state ---- */

    setState: function (state, skipPersist) {
        this.uiState = state;
        if (this.root) this.root.setAttribute("data-state", state);
        if (!skipPersist) this.persistUi();
        this.render();
        this.syncTimestampTimer();
    },

    syncTimestampTimer: function () {
        var visible = this.uiState === "collapsed" || this.uiState === "expanded";
        if (visible && !this.timestampTimer) {
            var self = this;
            this.timestampTimer = setInterval(function () {
                self.updateTimestamps();
            }, this.TIMESTAMP_MS);
        } else if (!visible && this.timestampTimer) {
            clearInterval(this.timestampTimer);
            this.timestampTimer = null;
        }
    },

    updateTimestamps: function () {
        if (!this.list) return;
        var nodes = this.list.querySelectorAll("[data-at]");
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var at = parseInt(el.getAttribute("data-at"), 10);
            if (!isNaN(at)) el.textContent = this.formatRelativeTime(at);
        }
    },

    scrollToNewest: function () {
        if (!this.list) return;
        this.list.scrollTop = this.list.scrollHeight;
    },

    visibleEntries: function () {
        if (this.uiState === "collapsed") {
            return this.entries.slice(-this.COLLAPSED_COUNT);
        }
        return this.entries;
    },

    render: function () {
        if (!this.root || !this.list) return;

        var visible = this.visibleEntries();
        this.list.innerHTML = "";

        if (this.empty) {
            this.empty.hidden = visible.length > 0;
        }

        var expanded = this.uiState === "expanded";
        for (var i = 0; i < visible.length; i++) {
            this.list.appendChild(this.createEntryEl(visible[i], expanded));
        }

        if (this.btnClear) {
            this.btnClear.disabled = this.entries.length === 0;
        }

        if (expanded) {
            var self = this;
            requestAnimationFrame(function () { self.scrollToNewest(); });
        }
    },

    createEntryEl: function (record, expanded) {
        var article = document.createElement("article");
        article.className = "dice-log-entry" + (expanded ? " dice-log-entry--expanded" : " dice-log-entry--compact");
        article.setAttribute("data-id", record.id);

        var time = document.createElement("time");
        time.className = "dice-log-time";
        time.setAttribute("data-at", String(record.at));
        time.textContent = this.formatRelativeTime(record.at);

        var label = document.createElement("div");
        label.className = "dice-log-label";
        label.textContent = record.label;

        var total = document.createElement("div");
        total.className = "dice-log-total";
        if (record.note === "crit") total.className += " dice-log-total--crit";
        if (record.note === "fumble") total.className += " dice-log-total--fumble";
        total.textContent = String(record.total);

        var reroll = document.createElement("button");
        reroll.type = "button";
        reroll.className = "dice-log-reroll";
        reroll.setAttribute("data-action", "reroll");
        reroll.setAttribute("data-id", record.id);
        reroll.setAttribute("aria-label", "Reroll " + record.expression);
        reroll.title = "Reroll " + record.expression;
        reroll.innerHTML = "<i class=\"bi bi-arrow-clockwise\" aria-hidden=\"true\"></i>";

        article.appendChild(time);
        article.appendChild(label);

        if (expanded) {
            var breakdown = document.createElement("div");
            breakdown.className = "dice-log-breakdown";
            var noteText = this.formatNote(record.note);
            var parts = record.expression + " \u2192 [" + record.dice.join(", ") + "]" +
                this.formatMod(record.modifier) + " = " + record.total;
            if (noteText) parts += " \u00b7 " + noteText;
            breakdown.textContent = parts;
            article.appendChild(breakdown);
        }

        article.appendChild(total);
        article.appendChild(reroll);
        return article;
    },

    /* ---- events ---- */

    handleClick: function (e) {
        var btn = e.target.closest(".dice-roll");
        if (!btn) return;
        e.preventDefault();

        var expression = this.expressionFromButton(btn);
        if (!expression) return;

        var result = this.evaluate(expression);
        if (!result) return;

        this.push({
            id: this.makeId(),
            label: this.buildLabel(btn),
            expression: expression,
            dice: result.dice,
            modifier: result.modifier,
            total: result.total,
            note: result.note,
            at: Date.now()
        });
    },

    handleLogClick: function (e) {
        var btn = e.target.closest("[data-action]");
        if (!btn || !this.root.contains(btn)) return;

        var action = btn.getAttribute("data-action");
        if (action === "show") {
            this.setState("collapsed");
        } else if (action === "minimize") {
            this.setState(this.uiState === "expanded" ? "collapsed" : "hidden");
        } else if (action === "expand") {
            this.setState("expanded");
        } else if (action === "clear") {
            this.clearAll();
        } else if (action === "reroll") {
            this.reroll(btn.getAttribute("data-id"));
        }
    },

    reroll: function (id) {
        var source = null;
        for (var i = 0; i < this.entries.length; i++) {
            if (this.entries[i].id === id) {
                source = this.entries[i];
                break;
            }
        }
        if (!source) return;

        var result = this.evaluate(source.expression);
        if (!result) return;

        this.push({
            id: this.makeId(),
            label: source.label,
            expression: source.expression,
            dice: result.dice,
            modifier: result.modifier,
            total: result.total,
            note: result.note,
            at: Date.now()
        });
    },

    getTraitLabel: function (btn) {
        var traitBlock = btn.closest(".property-block");
        if (!traitBlock) return null;
        var h4 = traitBlock.querySelector("h4");
        if (!h4) return null;
        return h4.textContent.replace(/\.\s*$/, "").trim();
    },

    /* ---- decoration (unchanged behavior) ---- */

    isInsideDiceRoll: function (node) {
        var parent = node.parentElement;
        while (parent) {
            if (parent.classList && parent.classList.contains("dice-roll")) return true;
            parent = parent.parentElement;
        }
        return false;
    },

    createDiceButton: function (text, attrs) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dice-roll";
        btn.textContent = text;
        Object.keys(attrs).forEach(function (key) {
            btn.setAttribute(key, attrs[key]);
        });
        return btn;
    },

    collectTextNodes: function (root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
    },

    replaceTextNode: function (textNode, parts) {
        if (parts.length === 0) return;
        var parent = textNode.parentNode;
        if (!parent) return;
        var fragment = document.createDocumentFragment();
        parts.forEach(function (part) {
            if (part.type === "text") {
                fragment.appendChild(document.createTextNode(part.value));
            } else {
                fragment.appendChild(this.createDiceButton(part.text, part.attrs));
            }
        }, this);
        parent.replaceChild(fragment, textNode);
    },

    wrapRegexMatches: function (textNode, regex, matchHandler) {
        var text = textNode.nodeValue;
        if (!text) return false;

        regex.lastIndex = 0;
        var parts = [];
        var lastIndex = 0;
        var match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
            }
            var handled = matchHandler.call(this, match, parts);
            if (!handled) {
                parts.push({ type: "text", value: match[0] });
            }
            lastIndex = regex.global ? regex.lastIndex : match.index + match[0].length;
            if (!regex.global) break;
        }

        if (parts.length === 0) return false;
        if (lastIndex < text.length) {
            parts.push({ type: "text", value: text.slice(lastIndex) });
        }
        this.replaceTextNode(textNode, parts);
        return true;
    },

    decorateAttackRolls: function (root) {
        var nodes = this.collectTextNodes(root);
        nodes.forEach(function (node) {
            if (this.isInsideDiceRoll(node)) return;
            this.wrapRegexMatches(node, /([+-]\d+)(\s+to hit)/gi, function (match, parts) {
                var mod = parseInt(match[1], 10);
                parts.push({
                    type: "button",
                    text: match[1],
                    attrs: {
                        "data-roll": "d20",
                        "data-mod": String(mod),
                        "data-label": "Attack",
                        "title": "Roll d20" + (mod >= 0 ? " + " + mod : " - " + (-mod))
                    }
                });
                parts.push({ type: "text", value: match[2] });
                return true;
            });
        }, this);
    },

    decorateSaveSkillRolls: function (root) {
        var nodes = this.collectTextNodes(root);
        nodes.forEach(function (node) {
            if (this.isInsideDiceRoll(node)) return;
            this.wrapRegexMatches(node, /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+([+-]\d+)\b/g, function (match, parts) {
                var name = match[1];
                var mod = parseInt(match[2], 10);
                parts.push({ type: "text", value: name + " " });
                parts.push({
                    type: "button",
                    text: match[2],
                    attrs: {
                        "data-roll": "d20",
                        "data-mod": String(mod),
                        "data-label": name,
                        "title": "Roll d20" + (mod >= 0 ? " + " + mod : " - " + (-mod))
                    }
                });
                return true;
            });
        }, this);
    },

    decorateDiceExpressions: function (root) {
        var nodes = this.collectTextNodes(root);
        nodes.forEach(function (node) {
            if (this.isInsideDiceRoll(node)) return;
            this.wrapRegexMatches(node, /\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)/gi, function (match, parts) {
                var parsed = this.parseDiceExpr(match[1]);
                if (!parsed) return false;
                parts.push({ type: "text", value: "(" });
                parts.push({
                    type: "button",
                    text: match[1],
                    attrs: {
                        "data-roll": "dice",
                        "data-count": String(parsed.count),
                        "data-sides": String(parsed.sides),
                        "data-mod": String(parsed.mod),
                        "data-label": "Damage",
                        "title": "Roll " + match[1].replace(/\s+/g, "")
                    }
                });
                parts.push({ type: "text", value: ")" });
                return true;
            });
        }, this);
    },

    decorateAbilityModifiers: function (root) {
        var scoreNodes = root.querySelectorAll(".scores p");
        scoreNodes.forEach(function (scoreEl) {
            var nodes = this.collectTextNodes(scoreEl);
            nodes.forEach(function (node) {
                if (this.isInsideDiceRoll(node)) return;
                this.wrapRegexMatches(node, /\(([+-]\d+)\)$/, function (match, parts) {
                    var mod = parseInt(match[1], 10);
                    var statName = "";
                    var statEl = scoreEl.closest("[class*='scores-']");
                    if (statEl) {
                        var h4 = statEl.querySelector("h4");
                        if (h4) statName = h4.textContent.trim();
                    }
                    parts.push({ type: "text", value: "(" });
                    parts.push({
                        type: "button",
                        text: match[1],
                        attrs: {
                            "data-roll": "d20",
                            "data-mod": String(mod),
                            "data-label": statName || "Ability check",
                            "title": "Roll d20" + (mod >= 0 ? " + " + mod : " - " + (-mod))
                        }
                    });
                    parts.push({ type: "text", value: ")" });
                    return true;
                });
            }, this);
        }, this);
    },

    labelHpDice: function (root) {
        var hpEl = root.querySelector("#hit-points");
        if (!hpEl) return;
        hpEl.querySelectorAll(".dice-roll").forEach(function (btn) {
            if (btn.getAttribute("data-label") === "Damage") {
                btn.setAttribute("data-label", "HP");
                btn.setAttribute("title", "Roll " + btn.textContent.replace(/\s+/g, ""));
            }
        });
    },

    decorate: function (root) {
        if (!root) return;
        this.init();

        this.decorateAttackRolls(root);

        var propertiesList = root.querySelector("#properties-list");
        if (propertiesList) this.decorateSaveSkillRolls(propertiesList);

        this.decorateDiceExpressions(root);
        this.decorateAbilityModifiers(root);
        this.labelHpDice(root);
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { DiceRoller.init(); });
} else {
    DiceRoller.init();
}
