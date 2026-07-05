var DiceRoller = {
    panel: null,
    output: null,
    initialized: false,

    init: function () {
        if (this.initialized) return;
        this.panel = document.getElementById("dice-result-panel");
        this.output = document.getElementById("dice-result-output");
        var statBlock = document.getElementById("stat-block");
        if (statBlock) {
            statBlock.addEventListener("click", this.handleClick.bind(this));
        }
        this.initialized = true;
    },

    rollD20: function (mod) {
        mod = parseInt(mod, 10) || 0;
        var die = Math.floor(Math.random() * 20) + 1;
        var total = die + mod;
        var note = die === 1 ? " (natural 1)" : die === 20 ? " (natural 20)" : "";
        return { type: "d20", mod: mod, dice: [die], total: total, note: note };
    },

    rollDice: function (count, sides, mod) {
        count = parseInt(count, 10);
        sides = parseInt(sides, 10);
        mod = parseInt(mod, 10) || 0;
        var rolls = [];
        for (var i = 0; i < count; i++) {
            rolls.push(Math.floor(Math.random() * sides) + 1);
        }
        var sum = rolls.reduce(function (a, b) { return a + b; }, 0);
        return { type: "dice", count: count, sides: sides, mod: mod, dice: rolls, total: sum + mod };
    },

    parseDiceExpr: function (expr) {
        var normalized = expr.replace(/\s+/g, "");
        var match = normalized.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
        if (!match) return null;
        return {
            count: parseInt(match[1], 10),
            sides: parseInt(match[2], 10),
            mod: match[3] ? parseInt(match[3], 10) : 0
        };
    },

    formatResult: function (roll, label) {
        label = label || "Roll";
        if (roll.type === "d20") {
            var modStr = roll.mod >= 0 ? " + " + roll.mod : " - " + (-roll.mod);
            return label + ": d20 (" + roll.dice[0] + ")" + modStr + " = " + roll.total + (roll.note || "");
        }
        var expr = roll.count + "d" + roll.sides;
        if (roll.mod > 0) expr += " + " + roll.mod;
        else if (roll.mod < 0) expr += " - " + (-roll.mod);
        var modPart = "";
        if (roll.mod > 0) modPart = " + " + roll.mod;
        else if (roll.mod < 0) modPart = " - " + (-roll.mod);
        return label + ": " + expr + " \u2192 [" + roll.dice.join(", ") + "]" + modPart + " = " + roll.total;
    },

    showResult: function (text) {
        if (!this.output || !this.panel) return;
        this.output.textContent = text;
        this.panel.hidden = false;
    },

    getTraitLabel: function (btn) {
        var traitBlock = btn.closest(".property-block");
        if (!traitBlock) return null;
        var h4 = traitBlock.querySelector("h4");
        if (!h4) return null;
        return h4.textContent.replace(/\.\s*$/, "").trim();
    },

    handleClick: function (e) {
        var btn = e.target.closest(".dice-roll");
        if (!btn) return;
        e.preventDefault();

        var label = btn.getAttribute("data-label") || btn.textContent.trim();
        var traitName = this.getTraitLabel(btn);
        if (traitName) label = traitName + " \u2014 " + label;

        var rollType = btn.getAttribute("data-roll");
        var result = null;
        if (rollType === "d20") {
            result = this.rollD20(btn.getAttribute("data-mod"));
        } else if (rollType === "dice") {
            result = this.rollDice(
                btn.getAttribute("data-count"),
                btn.getAttribute("data-sides"),
                btn.getAttribute("data-mod")
            );
        }
        if (result) this.showResult(this.formatResult(result, label));
    },

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
