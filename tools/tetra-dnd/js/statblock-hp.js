var HpTracker = {
    STORAGE_ENTRIES: "tetra-hp-tracker-v1",
    STORAGE_UI: "tetra-hp-tracker-ui-v1",
    MAX_ENTRIES: 50,
    MAX_HISTORY: 20,
    COLLAPSED_COUNT: 3,

    root: null,
    tab: null,
    panel: null,
    list: null,
    empty: null,
    btnMinimize: null,
    btnExpand: null,
    btnClear: null,
    modal: null,
    modalTitle: null,
    modalAmount: null,
    modalAdjust: null,
    historyModal: null,
    historyTitle: null,
    historyList: null,
    historyEmpty: null,
    historyUndo: null,

    entries: [],
    uiState: "hidden",
    adjustId: null,
    adjustMode: "damage",
    historyId: null,
    initialized: false,

    init: function () {
        if (this.initialized) return;

        this.root = document.getElementById("hp-tracker");
        this.tab = document.getElementById("hp-tracker-tab");
        this.panel = document.getElementById("hp-tracker-panel");
        this.list = document.getElementById("hp-tracker-list");
        this.empty = document.getElementById("hp-tracker-empty");
        this.btnMinimize = document.getElementById("hp-tracker-minimize");
        this.btnExpand = document.getElementById("hp-tracker-expand");
        this.btnClear = document.getElementById("hp-tracker-clear");
        this.modal = document.getElementById("hp-adjust-modal");
        this.modalTitle = document.getElementById("hp-adjust-title");
        this.modalAmount = document.getElementById("hp-adjust-amount");
        this.modalAdjust = document.getElementById("hp-adjust-confirm");
        this.historyModal = document.getElementById("hp-history-modal");
        this.historyTitle = document.getElementById("hp-history-title");
        this.historyList = document.getElementById("hp-history-list");
        this.historyEmpty = document.getElementById("hp-history-empty");
        this.historyUndo = document.getElementById("hp-history-undo");

        this.rehydrate();

        if (this.root) {
            this.root.addEventListener("click", this.handlePanelClick.bind(this));
            this.root.addEventListener("dblclick", this.handlePanelDblClick.bind(this));
        }

        if (this.modalAdjust) {
            this.modalAdjust.addEventListener("click", this.applyAdjust.bind(this));
        }
        if (this.historyUndo) {
            this.historyUndo.addEventListener("click", this.undoLast.bind(this));
        }
        if (this.modalAmount) {
            this.modalAmount.addEventListener("keydown", this.handleAmountKeydown.bind(this));
        }
        if (this.modal && typeof $ !== "undefined") {
            var self = this;
            $(this.modal).on("shown.bs.modal", function () {
                if (self.modalAmount) {
                    self.modalAmount.focus();
                    self.modalAmount.select();
                }
            });
        }

        this.setState(this.uiState, true);
        this.initialized = true;
    },

    makeId: function () {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    getMonsterName: function (record) {
        if (record && record.monsterName) return String(record.monsterName).trim();
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

    nextDisplayName: function (baseName) {
        var base = (baseName || "Creature").trim() || "Creature";
        var used = {};
        for (var i = 0; i < this.entries.length; i++) {
            used[this.entries[i].name] = true;
        }
        if (!used[base]) return base;
        var n = 2;
        while (used[base + " " + n]) n++;
        return base + " " + n;
    },

    clamp: function (value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    isBloodied: function (entry) {
        return entry.current > 0 && entry.current <= Math.floor(entry.max / 2);
    },

    isDead: function (entry) {
        return entry.current === 0;
    },

    normalizeHistory: function (raw) {
        if (!Array.isArray(raw)) return [];
        var self = this;
        return raw.slice(-this.MAX_HISTORY).map(function (h) {
            var kind = h && (h.kind === "damage" || h.kind === "heal" || h.kind === "max" || h.kind === "track")
                ? h.kind
                : "track";
            return {
                id: (h && h.id) || self.makeId(),
                kind: kind,
                amount: Math.max(0, parseInt(h && h.amount, 10) || 0),
                from: Math.max(0, parseInt(h && h.from, 10) || 0),
                to: Math.max(0, parseInt(h && h.to, 10) || 0),
                maxFrom: Math.max(1, parseInt(h && h.maxFrom, 10) || 1),
                maxTo: Math.max(1, parseInt(h && h.maxTo, 10) || 1),
                at: (h && h.at) || Date.now()
            };
        });
    },

    pushHistory: function (entry, event) {
        if (!entry.history) entry.history = [];
        entry.history.push({
            id: this.makeId(),
            kind: event.kind,
            amount: event.amount,
            from: event.from,
            to: event.to,
            maxFrom: event.maxFrom,
            maxTo: event.maxTo,
            at: Date.now()
        });
        while (entry.history.length > this.MAX_HISTORY) {
            entry.history.shift();
        }
    },

    formatRelativeTime: function (at) {
        var diff = Math.max(0, Date.now() - at);
        var sec = Math.floor(diff / 1000);
        if (sec < 45) return "just now";
        var min = Math.floor(sec / 60);
        if (min < 60) return min + "m ago";
        var hr = Math.floor(min / 60);
        if (hr < 24) return hr + "h ago";
        var day = Math.floor(hr / 24);
        return day + "d ago";
    },

    formatHistoryLine: function (ev) {
        var arrow = " \u2192 ";
        var dot = " \u00b7 ";
        if (ev.kind === "damage") {
            return "\u2212" + ev.amount + dot + ev.from + arrow + ev.to;
        }
        if (ev.kind === "heal") {
            return "+" + ev.amount + dot + ev.from + arrow + ev.to;
        }
        if (ev.kind === "max") {
            var text = "Max " + ev.maxFrom + arrow + ev.maxTo;
            if (ev.from !== ev.to) text += dot + ev.from + arrow + ev.to;
            return text;
        }
        return "Tracked " + ev.to + " / " + ev.maxTo;
    },

    canUndo: function (entry) {
        if (!entry || !entry.history || entry.history.length === 0) return false;
        return entry.history[entry.history.length - 1].kind !== "track";
    },

    addFromRoll: function (record) {
        this.init();
        if (!record) return;

        var hp = parseInt(record.total, 10);
        if (isNaN(hp)) return;
        hp = Math.max(1, hp);

        var entry = {
            id: this.makeId(),
            name: this.nextDisplayName(this.getMonsterName(record)),
            current: hp,
            max: hp,
            at: Date.now(),
            history: []
        };
        this.pushHistory(entry, {
            kind: "track",
            amount: hp,
            from: hp,
            to: hp,
            maxFrom: hp,
            maxTo: hp
        });

        this.entries.push(entry);
        while (this.entries.length > this.MAX_ENTRIES) {
            this.entries.shift();
        }
        this.persistEntries();

        if (this.uiState === "hidden") {
            this.setState("collapsed");
        } else {
            this.render();
            if (this.uiState === "expanded") this.scrollToNewest();
        }
    },

    findEntry: function (id) {
        for (var i = 0; i < this.entries.length; i++) {
            if (this.entries[i].id === id) return this.entries[i];
        }
        return null;
    },

    remove: function (id) {
        this.entries = this.entries.filter(function (e) { return e.id !== id; });
        this.persistEntries();
        this.render();
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
        } catch (e) { /* ignore */ }
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
                    var self = this;
                    this.entries = data.entries.slice(-this.MAX_ENTRIES).map(function (e) {
                        return {
                            id: e.id,
                            name: String(e.name || "Creature"),
                            current: Math.max(0, parseInt(e.current, 10) || 0),
                            max: Math.max(1, parseInt(e.max, 10) || 1),
                            at: e.at || Date.now(),
                            history: self.normalizeHistory(e.history)
                        };
                    });
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

    setState: function (state, skipPersist) {
        this.uiState = state;
        if (this.root) this.root.setAttribute("data-state", state);
        if (!skipPersist) this.persistUi();
        this.render();
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

        for (var i = 0; i < visible.length; i++) {
            this.list.appendChild(this.createEntryEl(visible[i]));
        }

        if (this.btnClear) {
            this.btnClear.disabled = this.entries.length === 0;
        }

        if (this.uiState === "expanded") {
            var self = this;
            requestAnimationFrame(function () { self.scrollToNewest(); });
        }
    },

    createEntryEl: function (entry) {
        var article = document.createElement("article");
        article.className = "hp-tracker-entry";
        if (this.isDead(entry)) article.className += " hp-tracker-entry--dead";
        else if (this.isBloodied(entry)) article.className += " hp-tracker-entry--bloodied";
        article.setAttribute("data-id", entry.id);

        var name = document.createElement("div");
        name.className = "hp-tracker-name";
        name.textContent = entry.name;

        var hp = document.createElement("div");
        hp.className = "hp-tracker-hp";

        var current = document.createElement("span");
        current.className = "hp-tracker-current";
        current.textContent = String(entry.current);

        var sep = document.createElement("span");
        sep.className = "hp-tracker-sep";
        sep.textContent = " / ";

        var max = document.createElement("span");
        max.className = "hp-tracker-max";
        max.setAttribute("data-role", "max");
        max.setAttribute("title", "Double-click to set max HP");
        max.textContent = String(entry.max);

        var values = document.createElement("span");
        values.className = "hp-tracker-hp-values";
        values.appendChild(current);
        values.appendChild(sep);
        values.appendChild(max);

        var history = document.createElement("button");
        history.type = "button";
        history.className = "hp-tracker-btn hp-tracker-history";
        history.setAttribute("data-action", "history");
        history.setAttribute("data-id", entry.id);
        history.setAttribute("aria-label", "HP history");
        history.title = "HP history";
        history.innerHTML = "<i class=\"bi bi-clock-history\" aria-hidden=\"true\"></i>";

        hp.appendChild(values);
        hp.appendChild(history);

        var actions = document.createElement("div");
        actions.className = "hp-tracker-actions";

        var heal = document.createElement("button");
        heal.type = "button";
        heal.className = "hp-tracker-btn";
        heal.setAttribute("data-action", "heal");
        heal.setAttribute("data-id", entry.id);
        heal.setAttribute("aria-label", "Heal");
        heal.title = "Heal";
        heal.innerHTML = "<i class=\"bi bi-heart-fill\" aria-hidden=\"true\"></i>";

        var dmg = document.createElement("button");
        dmg.type = "button";
        dmg.className = "hp-tracker-btn";
        dmg.setAttribute("data-action", "damage");
        dmg.setAttribute("data-id", entry.id);
        dmg.setAttribute("aria-label", "Damage");
        dmg.title = "Damage";
        dmg.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"12\" height=\"12\" viewBox=\"0 0 16 16\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M7.25.75h1.5l.75.75v7.5H12v1.5H4v-1.5h2.5V1.5L7.25.75zm-.5 10.5h2.5v1.25L8.5 15h-1l-.75-2.5V11.25z\"/></svg>";

        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "hp-tracker-btn hp-tracker-btn-remove";
        remove.setAttribute("data-action", "remove");
        remove.setAttribute("data-id", entry.id);
        remove.setAttribute("aria-label", "Remove");
        remove.title = "Remove";
        remove.innerHTML = "<i class=\"bi bi-x-lg\" aria-hidden=\"true\"></i>";

        actions.appendChild(heal);
        actions.appendChild(dmg);
        actions.appendChild(remove);

        article.appendChild(name);
        article.appendChild(hp);
        article.appendChild(actions);
        return article;
    },

    handlePanelClick: function (e) {
        var btn = e.target.closest("[data-action]");
        if (!btn || !this.root.contains(btn)) return;

        var action = btn.getAttribute("data-action");
        var id = btn.getAttribute("data-id");

        if (action === "show") {
            this.setState("collapsed");
        } else if (action === "minimize") {
            this.setState(this.uiState === "expanded" ? "collapsed" : "hidden");
        } else if (action === "expand") {
            this.setState("expanded");
        } else if (action === "clear") {
            this.clearAll();
        } else if (action === "damage" || action === "heal") {
            this.openAdjust(id, action);
        } else if (action === "history") {
            this.openHistory(id);
        } else if (action === "remove") {
            this.remove(id);
        }
    },

    handlePanelDblClick: function (e) {
        var maxEl = e.target.closest("[data-role=\"max\"]");
        if (!maxEl || !this.root.contains(maxEl)) return;
        e.preventDefault();
        var article = maxEl.closest("[data-id]");
        if (!article) return;
        this.beginEditMax(article.getAttribute("data-id"), maxEl);
    },

    beginEditMax: function (id, maxEl) {
        var entry = this.findEntry(id);
        if (!entry || !maxEl) return;
        if (maxEl.querySelector("input")) return;

        var input = document.createElement("input");
        input.type = "number";
        input.min = "1";
        input.step = "1";
        input.className = "hp-tracker-max-input";
        input.value = String(entry.max);
        input.setAttribute("aria-label", "Max HP");

        var committed = false;
        var self = this;

        function commit() {
            if (committed) return;
            committed = true;
            var val = parseInt(input.value, 10);
            if (!isNaN(val) && val >= 1) {
                var maxFrom = entry.max;
                var from = entry.current;
                entry.max = val;
                entry.current = self.clamp(entry.current, 0, entry.max);
                if (entry.max !== maxFrom || entry.current !== from) {
                    self.pushHistory(entry, {
                        kind: "max",
                        amount: entry.max,
                        from: from,
                        to: entry.current,
                        maxFrom: maxFrom,
                        maxTo: entry.max
                    });
                }
                self.persistEntries();
            }
            self.render();
        }

        function cancel() {
            if (committed) return;
            committed = true;
            self.render();
        }

        input.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter") {
                ev.preventDefault();
                commit();
            } else if (ev.key === "Escape") {
                ev.preventDefault();
                cancel();
            }
        });
        input.addEventListener("blur", commit);

        maxEl.textContent = "";
        maxEl.appendChild(input);
        input.focus();
        input.select();
    },

    openAdjust: function (id, mode) {
        var entry = this.findEntry(id);
        if (!entry || !this.modal) return;

        this.adjustId = id;
        this.adjustMode = mode === "heal" ? "heal" : "damage";

        if (this.modalTitle) {
            this.modalTitle.textContent = this.adjustMode === "heal" ? "Heal" : "Damage";
        }
        if (this.modalAmount) {
            this.modalAmount.value = "1";
        }

        if (typeof $ !== "undefined") {
            $(this.modal).modal("show");
        }
    },

    handleAmountKeydown: function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            this.applyAdjust();
        }
    },

    applyAdjust: function () {
        var entry = this.findEntry(this.adjustId);
        if (!entry) return;

        var amount = parseInt(this.modalAmount && this.modalAmount.value, 10);
        if (isNaN(amount) || amount < 1) return;

        var from = entry.current;
        var maxFrom = entry.max;
        if (this.adjustMode === "heal") {
            entry.current = this.clamp(entry.current + amount, 0, entry.max);
        } else {
            entry.current = this.clamp(entry.current - amount, 0, entry.max);
        }

        if (entry.current !== from) {
            this.pushHistory(entry, {
                kind: this.adjustMode === "heal" ? "heal" : "damage",
                amount: amount,
                from: from,
                to: entry.current,
                maxFrom: maxFrom,
                maxTo: entry.max
            });
        }

        this.persistEntries();
        this.render();

        if (typeof $ !== "undefined" && this.modal) {
            $(this.modal).modal("hide");
        }
    },

    openHistory: function (id) {
        var entry = this.findEntry(id);
        if (!entry || !this.historyModal) return;

        this.historyId = id;
        this.renderHistory(entry);

        if (typeof $ !== "undefined") {
            $(this.historyModal).modal("show");
        }
    },

    createHistoryEl: function (ev) {
        var row = document.createElement("div");
        row.className = "hp-history-row";

        var time = document.createElement("div");
        time.className = "hp-history-time";
        time.textContent = this.formatRelativeTime(ev.at);

        var text = document.createElement("div");
        text.className = "hp-history-text";
        text.textContent = this.formatHistoryLine(ev);

        row.appendChild(time);
        row.appendChild(text);
        return row;
    },

    renderHistory: function (entry) {
        if (this.historyTitle) {
            this.historyTitle.textContent = entry.name + " \u2014 History";
        }
        if (!this.historyList) return;

        var events = (entry.history || []).slice().reverse();
        this.historyList.innerHTML = "";

        if (this.historyEmpty) {
            this.historyEmpty.hidden = events.length > 0;
        }

        for (var i = 0; i < events.length; i++) {
            this.historyList.appendChild(this.createHistoryEl(events[i]));
        }

        if (this.historyUndo) {
            this.historyUndo.disabled = !this.canUndo(entry);
        }
    },

    undoLast: function () {
        var entry = this.findEntry(this.historyId);
        if (!entry || !this.canUndo(entry)) return;

        var ev = entry.history.pop();
        entry.current = this.clamp(ev.from, 0, ev.maxFrom);
        entry.max = Math.max(1, ev.maxFrom);

        this.persistEntries();
        this.render();
        this.renderHistory(entry);
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { HpTracker.init(); });
} else {
    HpTracker.init();
}
