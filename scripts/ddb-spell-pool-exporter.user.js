// ==UserScript==
// @name         DDB Spell Pool Exporter
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Loads and exports D&D Beyond Manage Spells as a rich snapshot plus a Spell Cards import file.
// @match        https://www.dndbeyond.com/characters/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {  
    'use strict';

    const SCRIPT_VERSION = '1.7';
    const CONTROLS_ID = 'ddb-spell-exporter-controls';

    const SCHOOL_NAMES =
        'Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation';

    const SCHOOL_CODES = {
        abjuration: 'A',
        conjuration: 'C',
        divination: 'D',
        enchantment: 'E',
        evocation: 'V',
        illusion: 'I',
        necromancy: 'N',
        transmutation: 'T'
    };

    const CLASS_NAMES = [
        'Artificer',
        'Bard',
        'Blood Hunter',
        'Cleric',
        'Druid',
        'Paladin',
        'Ranger',
        'Sorcerer',
        'Warlock',
        'Wizard'
    ];

    const FIELD_ALIASES = {
        'Casting Time': ['Casting Time'],
        'Range': ['Range/Area', 'Range / Area', 'Range'],
        'Components': ['Components'],
        'Duration': ['Duration'],
        'Source': ['Source'],
        'Attack/Save': ['Attack/Save', 'Attack / Save', 'Save'],
        'Damage': ['Damage', 'Damage/Effect', 'Damage / Effect'],
        'Classes': ['Classes'],
        'Granted By': ['Granted By', 'Granted by', 'Origin', 'Available For']
    };

    const FIELD_NAMES = [...new Set(Object.values(FIELD_ALIASES).flat())]
        .sort((a, b) => b.length - a.length);

    const STOP_LINES = [
        /^TAGS:?$/i,
        /^Amount to add$/i,
        /^ADD SPELL$/i,
        /^LEARN$/i,
        /^PREPARE$/i,
        /^PREPARED$/i,
        /^UNPREPARE$/i,
        /^DELETE$/i,
        /^ALWAYS PREPARED$/i
    ];

    const SHOP_SELECTORS = [
        '.ct-spell-manage-pane',
        '.ct-spell-manager',
        '.ct-class-spell-manager'
    ];

    const ITEM_SELECTORS = [
        '.ct-spell-manager__spell'
    ];

    const HEADING_PATTERNS = [/^add spells$/i, /^manage spells$/i];

    let loading = false;
    let exporting = false;
    let aborted = false;
    let ui = null;
    let shopCache = null;
    let shopCacheAt = 0;
    let characterContext = null;

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    function throwIfAborted() {
        if (aborted) {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            throw err;
        }
    }

    function isAbortError(error) {
        return error && error.name === 'AbortError';
    }

    // ------------------------------------------------------------
    // SHOP HELPERS
    // ------------------------------------------------------------

    function scopedRoots() {
        return [
            ...document.querySelectorAll('[role="dialog"]'),
            ...document.querySelectorAll('.ct-sidebar'),
            ...document.querySelectorAll('[class*="styles_sidebar"]'),
            ...document.querySelectorAll('[class*="Sidebar"]')
        ].filter(node => node && node.querySelector);
    }

    function headingText(el) {
        const text = normalizeText(el.textContent);
        if (!text || text.length > 40) return null;
        return text;
    }

    function isActionLabel(text) {
        return /^(learn|prepare|prepared|unprepare|delete|remove|add spell|always prepared)$/i.test(
            text || ''
        );
    }

    function isPagerButton(button) {
        const text = (button.textContent || '').trim().toLowerCase();
        return text === 'load more' || text === 'show more' || text === 'see more';
    }

    function findLoadMoreIn(root) {
        if (!root) return null;
        return [...root.querySelectorAll('button')].find(isPagerButton) || null;
    }

    function classText(el) {
        if (!el || el.className == null) return '';
        return String(el.className);
    }

    function isShopLike(el) {
        const cls = classText(el);
        if (/spell-manage|spell-shop|SpellShop|SpellManager|equipment-shop/i.test(cls)) {
            return true;
        }
        return el.getAttribute?.('role') === 'dialog';
    }

    function looksLikeSpellRow(el) {
        if (!el) return false;
        if (el.querySelector('a[href*="/spells/"]')) return true;
        if ([...el.querySelectorAll('button')].some(button =>
            /^(learn|prepare)$/i.test((button.textContent || '').trim())
        )) {
            return true;
        }
        const text = el.innerText || '';
        if (/casting time/i.test(text)) return true;
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .slice(0, 8)
            .some(looksLikeSubtitle);
    }

    function nodeMatchesAny(el, selectors) {
        return selectors.some(selector => {
            try {
                return el.matches(selector);
            } catch {
                return false;
            }
        });
    }

    function rowFromInside(el, root) {
        let node = el;
        while (node && node !== root) {
            if (node.classList?.contains('ddbc-collapsible')) return node;
            if (nodeMatchesAny(node, ITEM_SELECTORS)) return node;
            node = node.parentElement;
        }
        node = el;
        while (node && node.parentElement && node !== root) {
            const parent = node.parentElement;
            if (parent === root || parent === document.body) break;
            const similar = [...parent.children].filter(child =>
                child.tagName === node.tagName &&
                classText(child) === classText(node)
            );
            if (similar.length >= 2) return node;
            node = parent;
        }
        return el.closest('li, article, [role="listitem"]');
    }

    function dedupeOuterNodes(nodes) {
        const unique = [];
        for (const node of nodes) {
            if (!node || unique.includes(node)) continue;
            unique.push(node);
        }
        return unique.filter(el =>
            !unique.some(other => other !== el && other.contains(el))
        );
    }

    function isSpellShopContext(root) {
        if (!root) return false;
        if (isAddSpellsList(root)) return true;
        if (root.querySelector('a[href*="/spells/"]')) return true;
        const sample = (root.innerText || '').slice(0, 2000);
        return /add spells|manage spells|cantrip|\d+(?:st|nd|rd|th)[-\s]?level/i.test(
            sample
        );
    }

    function getItemNodes(root) {
        if (!root) return [];
        const spells = [...root.querySelectorAll('.ct-spell-manager__spell')];
        if (spells.length) return spells;

        const collapsibles = [...root.querySelectorAll('.ddbc-collapsible')].filter(el => {
            if (el.classList.contains('ct-spell-slot-manager__group')) return false;
            if (el.classList.contains('ct-class-spell-manager__group')) return false;
            if (
                el.parentElement &&
                el.parentElement.closest('.ct-spell-manager__spell')
            ) {
                return false;
            }
            return looksLikeSpellRow(el);
        });
        if (collapsibles.length) return collapsibles;

        const fromLinks = [...root.querySelectorAll('a[href*="/spells/"]')]
            .map(anchor => rowFromInside(anchor, root))
            .filter(Boolean);
        const fromButtons = [...root.querySelectorAll('button')]
            .filter(button =>
                /^(learn|prepare)$/i.test((button.textContent || '').trim())
            )
            .map(button => rowFromInside(button, root))
            .filter(Boolean);

        return dedupeOuterNodes([...fromLinks, ...fromButtons]);
    }

    function findShopByHeading(root) {
        const candidates = [
            ...root.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"]'),
            ...root.querySelectorAll(
                '[class*="heading"], [class*="Heading"], [class*="Title"]'
            )
        ];
        for (const heading of candidates) {
            if (heading.closest('button')) continue;
            const text = headingText(heading);
            if (!text) continue;
            if (!HEADING_PATTERNS.some(pattern => pattern.test(text))) continue;

            let node = heading.parentElement;
            for (let depth = 0; depth < 10 && node && node !== document.body; depth++) {
                if (getItemNodes(node).length) return node;
                node = node.parentElement;
            }
        }
        return null;
    }

    function isAddSpellsList(el) {
        return [...el.querySelectorAll('button')].some(button =>
            /^(learn|prepare)$/i.test((button.textContent || '').trim())
        );
    }

    function collectShopCandidates() {
        const candidates = [];
        const push = el => {
            if (el && !candidates.includes(el)) candidates.push(el);
        };

        for (const selector of SHOP_SELECTORS) {
            document.querySelectorAll(selector).forEach(push);
        }
        for (const root of scopedRoots()) {
            if (
                isShopLike(root) ||
                findLoadMoreIn(root) ||
                isAddSpellsList(root)
            ) {
                push(root);
            }
        }
        const headingShop = findShopByHeading(document.body);
        if (headingShop) push(headingShop);
        return candidates;
    }

    function shopScore(el) {
        if (!el) return 0;
        const items = getItemNodes(el);
        if (!items.length) return 0;
        let score = items.length;
        if (findLoadMoreIn(el)) score += 5;
        if (isShopLike(el)) score += 1000;
        if (isSpellShopContext(el)) score += 500;
        return score;
    }

    function findShop() {
        let best = null;
        let bestScore = 0;
        for (const el of collectShopCandidates()) {
            const score = shopScore(el);
            if (score > bestScore) {
                best = el;
                bestScore = score;
            }
        }
        return bestScore > 0 ? best : null;
    }

    function getShop() {
        if (
            shopCache &&
            Date.now() - shopCacheAt < 400 &&
            document.contains(shopCache)
        ) {
            return shopCache;
        }
        shopCache = findShop();
        shopCacheAt = Date.now();
        return shopCache;
    }

    function getItems() {
        const shop = getShop();
        if (!shop) return [];
        return getItemNodes(shop);
    }

    function getItemCount() {
        return getItems().length;
    }

    function getItemAt(index) {
        return getItems()[index] || null;
    }

    function isCollapsed(item) {
        if (item.classList.contains('ddbc-collapsible--collapsed')) return true;
        if (item.classList.contains('ddbc-collapsible--opened')) return false;
        const header = getHeader(item);
        const expanded = header?.getAttribute('aria-expanded');
        if (expanded === 'false') return true;
        if (expanded === 'true') return false;
        return !hasDetailBody(item);
    }

    function getHeader(item) {
        const chevron = item.querySelector('.ddbc-collapsible__header-status');
        if (chevron) return chevron;
        const primary = item.querySelector(
            '.ddbc-collapsible__header-content-primary'
        );
        if (primary) return primary;
        const header =
            item.querySelector('.ddbc-collapsible__header') ||
            item.querySelector('[class*="collapsible__header"]') ||
            item.querySelector('[aria-expanded]');
        if (!header) return null;
        if (header.closest('a[href]')) return null;
        if (header.querySelector('.ct-spell-manager__spell-header-actions')) {
            return header.querySelector('.ddbc-collapsible__header-status') ||
                header.querySelector('.ddbc-collapsible__header-content-primary') ||
                header;
        }
        if (isActionLabel(normalizeText(header.textContent))) return null;
        return header;
    }

    function normalizeText(text) {
        if (text == null) return null;
        const value = String(text)
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .trim();
        return value || null;
    }

    function escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function slug(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/['’]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'spell';
    }

    function titleCase(value) {
        return String(value || '').replace(/\b\w/g, c => c.toUpperCase());
    }

    // ------------------------------------------------------------
    // LOAD MORE
    // ------------------------------------------------------------

    function getLoadMoreButton() {
        const shop = getShop();
        if (!shop) return null;
        const scopes = [shop];
        const dialog = shop.closest('[role="dialog"]') ||
            shop.closest('.ct-sidebar');
        if (dialog && dialog !== shop) scopes.push(dialog);
        else if (
            shop.parentElement &&
            shop.parentElement !== document.body
        ) {
            scopes.push(shop.parentElement);
        }
        for (const scope of scopes) {
            const button = findLoadMoreIn(scope);
            if (button) return button;
        }
        return null;
    }

    function loadMoreState() {
        const button = getLoadMoreButton();
        if (!button) return { status: 'missing', button: null };
        if (button.disabled) return { status: 'disabled', button };
        return { status: 'enabled', button };
    }

    async function waitForExpanded(item, timeout = 4000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            throwIfAborted();
            if (!isCollapsed(item) || hasDetailBody(item)) {
                await sleep(150);
                return true;
            }
            await sleep(50);
        }
        return false;
    }

    // ------------------------------------------------------------
    // TEXT PARSING
    // ------------------------------------------------------------

    function getRawLines(item) {
        return item.innerText
            .replace(/\r/g, '')
            .split('\n')
            .map(line => line.trim());
    }

    function getLines(item) {
        return getRawLines(item).filter(Boolean);
    }

    function isStopLine(line) {
        return STOP_LINES.some(pattern => pattern.test(line));
    }

    function fieldLabelRegex(fieldName) {
        return new RegExp(
            `^${escapeRegex(fieldName)}(?:\\s*:\\s*|\\s*$)(.*)$`,
            'i'
        );
    }

    function isKnownField(line) {
        const text = String(line || '').trim();
        if (!text) return false;
        return FIELD_NAMES.some(field => fieldLabelRegex(field).test(text));
    }

    function emptyValue(value) {
        return !value || value === '--' || value === '—';
    }

    function stripEmbeddedFields(value) {
        if (!value) return value;
        let trimmed = value;
        for (const field of FIELD_NAMES) {
            trimmed = trimmed.replace(
                new RegExp(`\\s+${escapeRegex(field)}\\s*:\\s*.*$`, 'i'),
                ''
            );
        }
        return trimmed.trim();
    }

    function extractField(lines, fieldName) {
        const regex = fieldLabelRegex(fieldName);
        const index = lines.findIndex(line => regex.test(String(line || '').trim()));
        if (index === -1) {
            return extractInlineField(lines, fieldName);
        }

        const match = String(lines[index] || '').trim().match(regex);
        const first = stripEmbeddedFields(match?.[1]?.trim() || '');
        if (!emptyValue(first)) {
            return normalizeText(first);
        }

        let i = index + 1;
        while (i < lines.length && !lines[i]) i++;
        if (i >= lines.length) return null;
        if (isKnownField(lines[i]) || isStopLine(lines[i])) return null;

        const value = normalizeText(stripEmbeddedFields(lines[i]));
        return emptyValue(value) ? null : value;
    }

    function extractInlineField(lines, fieldName) {
        const regex = new RegExp(
            `(?:^|\\s)${escapeRegex(fieldName)}\\s*:\\s*(.+)$`,
            'i'
        );
        const leading = new RegExp(`^${escapeRegex(fieldName)}(?:\\s*:|\\s*$)`, 'i');
        for (const line of lines) {
            if (leading.test(String(line || '').trim())) continue;
            const match = line.match(regex);
            if (!match) continue;
            const value = normalizeText(stripEmbeddedFields(match[1]));
            if (!emptyValue(value)) return value;
        }
        return null;
    }

    function extractKeyedField(lines, key) {
        const aliases = FIELD_ALIASES[key] || [key];
        for (const alias of aliases) {
            const value = extractField(lines, alias);
            if (!emptyValue(value)) return value;
        }
        return null;
    }

    function lastKnownFieldIndex(lines) {
        let last = -1;
        for (let i = 0; i < lines.length; i++) {
            if (isKnownField(lines[i])) last = i;
        }
        return last;
    }

    // ------------------------------------------------------------
    // NAME / URL / ID
    // ------------------------------------------------------------

    function extractName(item) {
        const nameEl =
            item.querySelector('[class*="styles_spellName"]') ||
            item.querySelector('[class*="styles_itemName"]') ||
            item.querySelector('[class*="spellName"]') ||
            item.querySelector('a[href*="/spells/"]');
        if (nameEl) {
            for (const node of nameEl.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = normalizeText(node.textContent);
                    if (text && !isActionLabel(text)) return text;
                }
            }
            const clone = nameEl.cloneNode(true);
            clone.querySelectorAll(
                '[class*="styles_level"], [class*="Icon"], svg, [data-tooltip-content]'
            ).forEach(el => el.remove());
            const cleaned = normalizeText(clone.textContent);
            if (cleaned && !isActionLabel(cleaned)) return cleaned;
        }
        const header = getHeader(item);
        if (header) {
            const first = normalizeText(header.innerText?.split('\n')[0]);
            if (first && !isActionLabel(first) && !looksLikeSubtitle(first)) {
                return first;
            }
        }
        return null;
    }

    function extractSpellLink(item) {
        const links = [...item.querySelectorAll('a[href]')];
        const match = links.find(link => {
            try {
                const path = new URL(link.href, location.origin).pathname;
                return /\/spells\//i.test(path);
            } catch {
                return false;
            }
        });
        return match || null;
    }

    function extractDdbUrl(item) {
        const link = extractSpellLink(item);
        if (!link) return null;
        try {
            const url = new URL(link.href, location.origin);
            return `${url.origin}${url.pathname}`;
        } catch {
            return normalizeText(link.getAttribute('href'));
        }
    }

    function shortSource(source) {
        if (!source) return null;
        const page = source.match(/^(.*?pg\.?\s*\d+)/i);
        if (page) return normalizeText(page[1]);
        const cut = source.split(/\.\s+(?=[A-Z“"])/)[0];
        return normalizeText(cut);
    }

    function extractId(ddbUrl, name, source) {
        if (ddbUrl) {
            try {
                return new URL(ddbUrl, location.origin).pathname;
            } catch {
                return ddbUrl;
            }
        }
        const base = slug(name);
        const sourceKey = shortSource(source);
        const src = sourceKey ? slug(sourceKey) : '';
        return src ? `${base}--${src}` : base;
    }

    function extractHeaderMetadata(item) {
        return [...item.querySelectorAll('.ddbc-collapsible__header-meta-item')]
            .map(el => normalizeText(el.textContent))
            .filter(Boolean);
    }

    function looksLikeSubtitle(line) {
        const text = normalizeText(line);
        if (!text || text.length > 120) return false;
        if (/\bcantrip\b/i.test(text)) return true;
        if (/^\(\s*\d+(?:st|nd|rd|th)\s*\)$/i.test(text)) return true;
        if (/\d+(?:st|nd|rd|th)[-\s]?level\b/i.test(text)) return true;
        if (/\blevel\s+\d+\b/i.test(text)) return true;
        return new RegExp(`\\b(?:${SCHOOL_NAMES})\\b`, 'i').test(text) &&
            text.length < 80;
    }

    function subtitleFromDom(item) {
        const selectors = [
            '[class*="itemSnippet"]',
            '[class*="ItemSnippet"]',
            '[class*="itemType"]',
            '[class*="styles_type"]',
            '[class*="styles_subtitle"]',
            '[class*="styles_level"]',
            '[class*="spellLevel"]',
            '[class*="SpellLevel"]'
        ];
        for (const selector of selectors) {
            const el = item.querySelector(selector);
            const text = normalizeText(el?.textContent);
            if (looksLikeSubtitle(text)) return text;
        }
        const header = getHeader(item);
        if (header) {
            for (const el of header.querySelectorAll('*')) {
                const text = normalizeText(el.textContent);
                if (looksLikeSubtitle(text)) return text;
            }
        }
        return null;
    }

    function headerDetailLines(lines) {
        const header = [];
        for (const line of lines) {
            if (isKnownField(line) || isStopLine(line)) {
                break;
            }
            header.push(line);
            if (header.length >= 12) break;
        }
        return header;
    }

    function extractSubtitle(item, lines, metadata) {
        const fromDom = subtitleFromDom(item);
        if (fromDom) return fromDom;
        const fromHeader = headerDetailLines(lines).find(looksLikeSubtitle);
        if (fromHeader) return fromHeader;
        const fromMeta = (metadata || []).find(looksLikeSubtitle);
        return fromMeta || null;
    }

    function parseLevelToken(text) {
        if (!text) return null;
        if (/\bcantrip\b/i.test(text)) return 0;
        const short = String(text).match(/\(?\s*(\d+)(?:st|nd|rd|th)\s*\)?/i);
        if (short) return Number(short[1]);
        const ordinal = String(text).match(/(\d+)(?:st|nd|rd|th)[-\s]?level/i);
        if (ordinal) return Number(ordinal[1]);
        const levelN = String(text).match(/\blevel\s+(\d+)\b/i);
        if (levelN) return Number(levelN[1]);
        return null;
    }

    function extractLevel(item, subtitle, metadata) {
        const fromDom = parseLevelToken(
            item.querySelector('[class*="styles_level"]')?.textContent
        );
        if (fromDom != null) return fromDom;
        return parseLevelToken(
            [subtitle, ...(metadata || [])].filter(Boolean).join(' ')
        );
    }

    function extractSchool(subtitle, metadata) {
        const text = [subtitle, ...(metadata || [])].filter(Boolean).join(' ');
        const match = text.match(new RegExp(`\\b(${SCHOOL_NAMES})\\b`, 'i'));
        if (!match) return null;
        return titleCase(match[1].toLowerCase());
    }

    function extractRitual(item, subtitle, duration, tags) {
        if (item.querySelector('[data-tooltip-content="Ritual"]')) return true;
        const blob = [subtitle, duration, ...(tags || [])].join(' ');
        return /\britual\b/i.test(blob);
    }

    function extractConcentration(item, duration, subtitle) {
        if (item.querySelector('[data-tooltip-content="Concentration"]')) {
            return true;
        }
        const blob = [duration, subtitle].join(' ');
        return /\bconcentration\b/i.test(blob);
    }

    function schoolCode(school) {
        if (!school) return '';
        const key = String(school).toLowerCase();
        if (SCHOOL_CODES[key]) return SCHOOL_CODES[key];
        if (school.length === 1) return school.toUpperCase();
        return '';
    }

    function skipFieldValue(lines, start) {
        let i = start;
        while (i < lines.length && !lines[i]) i++;
        if (
            i < lines.length &&
            lines[i] &&
            !isKnownField(lines[i]) &&
            !isStopLine(lines[i])
        ) {
            i++;
        }
        return i;
    }

    function looksLikeSourceLine(line, nextLine) {
        if (!line) return false;
        if (/pg\.?\s*\d+/i.test(line)) return true;
        if (line.length > 90 || /[.!?]\s/.test(line)) return false;
        if (/guide|handbook|realms|manual|compendium|supplement/i.test(line)) {
            return true;
        }
        return Boolean(
            nextLine &&
            line.length <= 80 &&
            /^(you|this|while|when|the |a |an )/i.test(nextLine)
        );
    }

    function peelSourceFromDescription(source, description) {
        if (source || !description) {
            return { source, description };
        }
        const parts = description.split('\n');
        while (parts.length && !parts[0].trim()) parts.shift();
        if (!parts.length) return { source, description };
        const first = parts[0].trim();
        const rest = parts.slice(1);
        while (rest.length && !rest[0].trim()) rest.shift();
        const nextLine = rest[0] ? rest[0].trim() : '';
        if (!looksLikeSourceLine(first, nextLine)) {
            return { source, description };
        }
        return {
            source: first,
            description: rest.join('\n').trim() || null
        };
    }

    function extractDescription(item) {
        const lines = getRawLines(item);
        const sourceIndex = lines.findIndex(line =>
            fieldLabelRegex('Source').test(String(line || '').trim())
        );
        let start;

        if (sourceIndex !== -1) {
            const inline = stripEmbeddedFields(
                (String(lines[sourceIndex] || '').trim().match(
                    fieldLabelRegex('Source')
                ) || [])[1]?.trim() || ''
            );
            start = emptyValue(inline)
                ? skipFieldValue(lines, sourceIndex + 1)
                : sourceIndex + 1;
        } else {
            const lastField = lastKnownFieldIndex(lines);
            if (lastField === -1) {
                start = 0;
            } else {
                const inline = stripEmbeddedFields(
                    (lines[lastField].match(/^[^:]+:\s*(.*)$/) || [])[1]
                        ?.trim() || ''
                );
                start = emptyValue(inline)
                    ? skipFieldValue(lines, lastField + 1)
                    : lastField + 1;
            }
        }

        while (start < lines.length && !lines[start]) start++;

        let end = lines.length;
        for (let i = start; i < lines.length; i++) {
            if (isStopLine(lines[i])) {
                end = i;
                break;
            }
        }

        const descriptionLines = lines.slice(start, end);
        while (descriptionLines.length && !descriptionLines[0]) {
            descriptionLines.shift();
        }
        while (
            descriptionLines.length &&
            !descriptionLines[descriptionLines.length - 1]
        ) {
            descriptionLines.pop();
        }
        if (!descriptionLines.length) return null;

        const cleaned = [];
        for (const line of descriptionLines) {
            if (!line) {
                if (cleaned.length && cleaned[cleaned.length - 1] !== '') {
                    cleaned.push('');
                }
                continue;
            }
            if (isKnownField(line)) continue;
            cleaned.push(line);
        }

        return cleaned.join('\n').trim() || null;
    }

    function splitDescriptionAndHigher(description) {
        if (!description) {
            return { description: null, higherLevels: null };
        }
        const lines = description.split('\n');
        const idx = lines.findIndex(line =>
            /^(at higher levels|cantrip upgrade)\b/i.test(line.trim())
        );
        if (idx === -1) {
            return { description, higherLevels: null };
        }

        const heading = lines[idx].trim();
        const rest = lines.slice(idx + 1).join('\n').trim();
        const inline = heading.match(
            /^(?:at higher levels|cantrip upgrade)\s*:?\s*(.+)$/i
        );
        let higher = rest;
        if (
            inline?.[1] &&
            !/^(at higher levels|cantrip upgrade)$/i.test(inline[1])
        ) {
            higher = [inline[1], rest].filter(Boolean).join('\n').trim();
        }

        return {
            description: lines.slice(0, idx).join('\n').trim() || null,
            higherLevels: higher || null
        };
    }

    function extractTags(item) {
        const lines = getLines(item);
        const tagsIndex = lines.findIndex(line => /^TAGS:?$/i.test(line));
        if (tagsIndex === -1) return [];

        const tags = [];
        for (let i = tagsIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (isStopLine(line)) break;
            if (line && !/^[+-]?\d+$/.test(line) && !isActionLabel(line)) {
                tags.push(line);
            }
        }
        return [...new Set(tags)];
    }

    function extractClasses(item, tags, rawLines) {
        const heading = item.closest('.ct-class-spell-manager')
            ?.querySelector('.ct-class-spell-manager__heading');
        const fromHeading = normalizeText(heading?.textContent);
        const fromField = extractKeyedField(rawLines, 'Classes');
        const fromSplit = fromField
            ? fromField.split(/[,/]/).map(part => part.trim()).filter(Boolean)
            : [];
        const fromTags = (tags || []).filter(tag =>
            CLASS_NAMES.some(name =>
                new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(tag)
            )
        );
        const all = [
            ...(fromHeading ? [fromHeading] : []),
            ...fromSplit,
            ...fromTags
        ];
        return [...new Set(all)];
    }

    function hasDetailBody(item) {
        const lines = getLines(item);
        return lines.some(line =>
            isKnownField(line) || /^TAGS:?$/i.test(line)
        );
    }

    // ------------------------------------------------------------
    // PREP STATE / ACCESS SOURCE
    // ------------------------------------------------------------

    function buttonLabel(button) {
        return normalizeText(button.textContent);
    }

    function extractManagerContext(item) {
        const manager = item.closest('.ct-class-spell-manager');
        const heading = normalizeText(
            manager?.querySelector('.ct-class-spell-manager__heading')?.textContent
        );
        return { manager, heading };
    }

    function extractPrepState(item, level) {
        const actions = item.querySelector(
            '.ct-spell-manager__spell-header-actions'
        );
        const alwaysPrepared = Boolean(
            item.querySelector('.ct-spell-manager__spell-always') ||
            /always prepared/i.test(actions?.textContent || '')
        );
        const labels = [...item.querySelectorAll(
            '.ct-spell-manager__spell-header-actions button'
        )].map(buttonLabel).filter(Boolean);
        const has = name => labels.some(label =>
            new RegExp(`^${escapeRegex(name)}$`, 'i').test(label)
        );
        const action =
            alwaysPrepared ? 'Always Prepared' :
            has('Unprepare') ? 'Unprepare' :
            has('Prepare') ? 'Prepare' :
            has('Delete') ? 'Delete' :
            has('Remove') ? 'Remove' :
            has('Learn') ? 'Learn' :
            (labels[0] || null);
        const known =
            alwaysPrepared ||
            has('Unprepare') ||
            has('Prepare') ||
            has('Delete') ||
            has('Remove');
        const isCantrip = level === 0;
        const currentlyPrepared = alwaysPrepared || has('Unprepare');
        const countsAgainstPrep = has('Unprepare') && !alwaysPrepared && !isCantrip;

        return {
            currentlyPrepared,
            alwaysPrepared,
            countsAgainstPrep,
            known,
            action
        };
    }

    function extractGrantedByText(item, rawLines) {
        return extractKeyedField(rawLines, 'Granted By');
    }

    function isClassName(text) {
        if (!text) return false;
        return CLASS_NAMES.some(name => name.toLowerCase() === text.toLowerCase());
    }

    function stripSourceTag(name) {
        return normalizeText(String(name || '').replace(/\s*\([^)]*\)\s*$/, '')) ||
            normalizeText(name);
    }

    function characterIdFromUrl() {
        const match = location.pathname.match(/\/characters\/(\d+)/);
        return match ? match[1] : null;
    }

    async function fetchCharacterData() {
        const id = characterIdFromUrl();
        if (!id) {
            return { data: null, endpoint: null, error: 'No character id in URL' };
        }
        const urls = [
            `https://character-service.dndbeyond.com/character/v5/character/${id}`,
            `https://character-service.dndbeyond.com/character/v4/character/${id}`
        ];
        const errors = [];
        for (const url of urls) {
            try {
                const response = await fetch(url, { credentials: 'include' });
                if (!response.ok) {
                    errors.push(`${url} → HTTP ${response.status}`);
                    continue;
                }
                const json = await response.json();
                const data = json.data || json;
                if (data && (data.classes || data.classSpells || data.spells)) {
                    return { data, endpoint: url, error: null };
                }
                errors.push(`${url} → unexpected payload`);
            } catch (error) {
                errors.push(`${url} → ${error?.message || error}`);
            }
        }
        return { data: null, endpoint: null, error: errors.join('; ') };
    }

    function findByComponentId(list, componentId) {
        if (componentId == null) return null;
        return (list || []).find(entry =>
            entry?.id === componentId ||
            entry?.definition?.id === componentId ||
            entry?.entityId === componentId
        ) || null;
    }

    function classFeatureById(classes, componentId) {
        for (const cls of classes || []) {
            const subclassFeatures = cls.subclassDefinition?.classFeatures || [];
            const subclassHit = subclassFeatures.find(feature =>
                feature.id === componentId
            );
            if (subclassHit) {
                return {
                    feature: subclassHit,
                    className: cls.definition?.name,
                    subclassName: stripSourceTag(cls.subclassDefinition?.name),
                    isSubclass: true
                };
            }
            const classHit = (cls.classFeatures || []).find(feature =>
                feature.definition?.id === componentId
            );
            if (classHit) {
                return {
                    feature: classHit.definition,
                    className: cls.definition?.name,
                    subclassName: stripSourceTag(cls.subclassDefinition?.name),
                    isSubclass: Boolean(classHit.definition?.isSubClassFeature)
                };
            }
        }
        return null;
    }

    function originFromClassComponent(classes, spell) {
        const feature = classFeatureById(classes, spell.componentId);
        if (feature?.isSubclass && feature.subclassName) {
            return {
                sourceKind: 'subclass',
                sourceLabel: feature.subclassName,
                grantedByFeature: feature.feature?.name || null
            };
        }
        if (feature?.className) {
            return {
                sourceKind: 'class',
                sourceLabel: feature.className,
                grantedByFeature: feature.feature?.name || null
            };
        }
        return {
            sourceKind: 'class',
            sourceLabel: classes?.[0]?.definition?.name || null,
            grantedByFeature: null
        };
    }

    function recordFromJsonSpell(spell, bucket, extras) {
        const name = spell?.definition?.name;
        if (!name) return null;
        return {
            name,
            bucket,
            prepared: spell.prepared === true,
            alwaysPrepared: spell.alwaysPrepared === true,
            preparedExplicit: typeof spell.prepared === 'boolean',
            alwaysPreparedExplicit: typeof spell.alwaysPrepared === 'boolean',
            countsAsKnownSpell: spell.countsAsKnownSpell,
            componentId: spell.componentId,
            componentTypeId: spell.componentTypeId,
            definition: spell.definition || null,
            ...extras
        };
    }

    function buildCharacterContext(data, endpoint, fetchError) {
        const classes = data?.classes || [];
        const byName = new Map();
        const itemNames = new Set();
        const featNames = new Set();
        const speciesNames = new Set();
        const subclassNames = new Set();
        const featureNames = new Set();
        const grantedRecords = [];
        const limitations = [];

        function add(record, asGrant) {
            if (!record?.name) return;
            const key = record.name.toLowerCase();
            const list = byName.get(key) || [];
            list.push(record);
            byName.set(key, list);
            if (asGrant) grantedRecords.push(record);
        }

        for (const cls of classes) {
            const subclassName = stripSourceTag(cls.subclassDefinition?.name);
            if (subclassName) subclassNames.add(subclassName.toLowerCase());
            for (const feature of cls.classFeatures || []) {
                const name = normalizeText(
                    feature.definition?.name || feature.name
                );
                if (name) featureNames.add(name.toLowerCase());
            }
            for (const feature of cls.subclassDefinition?.classFeatures || []) {
                const name = normalizeText(
                    feature.name || feature.definition?.name
                );
                if (name) featureNames.add(name.toLowerCase());
            }
        }

        for (const item of data?.inventory || []) {
            const name = normalizeText(item.definition?.name);
            if (name) itemNames.add(name.toLowerCase());
        }
        for (const feat of data?.feats || []) {
            const name = normalizeText(feat.definition?.name);
            if (name) featNames.add(name.toLowerCase());
        }
        const raceName = stripSourceTag(
            data?.race?.fullName || data?.race?.baseName
        );
        if (raceName) speciesNames.add(raceName.toLowerCase());

        for (const group of data?.classSpells || []) {
            const cls = classes.find(entry => entry.id === group.characterClassId);
            const className = cls?.definition?.name || null;
            for (const spell of group.spells || []) {
                add(recordFromJsonSpell(spell, 'classSpells', {
                    sourceKind: 'class',
                    sourceLabel: className,
                    grantedByFeature: null
                }), false);
            }
        }

        const buckets = [
            ['race', 'species'],
            ['class', 'class'],
            ['feat', 'feat'],
            ['item', 'item'],
            ['background', 'background']
        ];
        for (const [bucket, defaultKind] of buckets) {
            for (const spell of data?.spells?.[bucket] || []) {
                let sourceKind = defaultKind;
                let sourceLabel = null;
                let grantedByFeature = null;

                if (bucket === 'race') {
                    sourceLabel = raceName;
                } else if (bucket === 'feat') {
                    const feat = findByComponentId(data.feats, spell.componentId);
                    sourceLabel = feat?.definition?.name || null;
                } else if (bucket === 'item') {
                    const item = (data.inventory || []).find(entry =>
                        entry.definition?.id === spell.componentId
                    );
                    sourceLabel = item?.definition?.name || null;
                } else if (bucket === 'background') {
                    sourceLabel = data.background?.definition?.name || null;
                } else if (bucket === 'class') {
                    const origin = originFromClassComponent(classes, spell);
                    sourceKind = origin.sourceKind;
                    sourceLabel = origin.sourceLabel;
                    grantedByFeature = origin.grantedByFeature;
                }

                add(recordFromJsonSpell(spell, bucket, {
                    sourceKind,
                    sourceLabel,
                    grantedByFeature
                }), true);
            }
        }

        const jsonNames = [...byName.keys()];
        if (data && jsonNames.length < 20) {
            limitations.push(
                'Authenticated character JSON listed far fewer spells than Manage Spells. ' +
                'Subclass always-prepared grants are often omitted from this payload, ' +
                'so sourceKind/sourceLabel may stay unresolved for Always Prepared rows.'
            );
        }
        if (fetchError) {
            limitations.push(
                `Character JSON was not loaded (${fetchError}). ` +
                'Prep buttons are still scraped from the DOM; grant origin is not.'
            );
        }

        return {
            loaded: Boolean(data),
            error: fetchError,
            endpoint,
            characterName: data?.name || null,
            byName,
            grantedRecords,
            classes,
            itemNames,
            featNames,
            speciesNames,
            subclassNames,
            featureNames,
            jsonSpellCount: jsonNames.length,
            limitations
        };
    }

    function headingKind(heading, context) {
        if (!heading || !context) return null;
        const key = heading.toLowerCase();
        if (isClassName(heading)) return 'class';
        if (context.subclassNames.has(key)) return 'subclass';
        if (context.itemNames.has(key)) return 'item';
        if (context.featNames.has(key)) return 'feat';
        if (context.speciesNames.has(key)) return 'species';
        return null;
    }

    function pickJsonOrigin(name, prep, managerHeading, context) {
        const hits = context?.byName?.get(String(name || '').toLowerCase()) || [];
        if (!hits.length) return null;
        const kind = headingKind(managerHeading, context);

        if (kind && kind !== 'class') {
            const match = hits.find(hit => hit.sourceKind === kind);
            if (match) return match;
        }
        if (prep.alwaysPrepared) {
            const granted = hits.find(hit =>
                hit.bucket !== 'classSpells' || hit.alwaysPrepared
            );
            if (granted) return granted;
        }
        if (kind === 'class' || isClassName(managerHeading)) {
            const list = hits.find(hit => hit.bucket === 'classSpells');
            if (list) return list;
        }
        return hits[0];
    }

    function resolveAccessSource(item, name, prep, rawLines, context) {
        const { heading } = extractManagerContext(item);
        const grantedBy = extractGrantedByText(item, rawLines);
        const jsonHit = pickJsonOrigin(name, prep, heading, context);
        const kindFromHeading = headingKind(heading, context);

        if (jsonHit?.sourceKind && jsonHit?.sourceLabel) {
            return {
                sourceKind: jsonHit.sourceKind,
                sourceLabel: jsonHit.sourceLabel,
                countsAgainstPrep: prep.countsAgainstPrep,
                sourceDetection: 'character-json',
                grantedByFeature: jsonHit.grantedByFeature || grantedBy,
                accessManager: heading,
                jsonMatch: {
                    bucket: jsonHit.bucket,
                    prepared: jsonHit.prepared,
                    alwaysPrepared: jsonHit.alwaysPrepared
                }
            };
        }

        if (grantedBy) {
            const kind = headingKind(grantedBy, context) || kindFromHeading;
            return {
                sourceKind: kind,
                sourceLabel: grantedBy,
                countsAgainstPrep: prep.countsAgainstPrep,
                sourceDetection: 'dom-granted-by',
                grantedByFeature: grantedBy,
                accessManager: heading,
                jsonMatch: jsonHit ? {
                    bucket: jsonHit.bucket,
                    prepared: jsonHit.prepared,
                    alwaysPrepared: jsonHit.alwaysPrepared
                } : null
            };
        }

        if (kindFromHeading === 'item' || kindFromHeading === 'feat' ||
            kindFromHeading === 'species' || kindFromHeading === 'subclass') {
            return {
                sourceKind: kindFromHeading,
                sourceLabel: heading,
                countsAgainstPrep: prep.countsAgainstPrep,
                sourceDetection: 'dom-heading',
                grantedByFeature: null,
                accessManager: heading,
                jsonMatch: null
            };
        }

        if (isClassName(heading) && !prep.alwaysPrepared) {
            return {
                sourceKind: 'class',
                sourceLabel: heading,
                countsAgainstPrep: prep.countsAgainstPrep,
                sourceDetection: 'dom-heading',
                grantedByFeature: null,
                accessManager: heading,
                jsonMatch: jsonHit ? {
                    bucket: jsonHit.bucket,
                    prepared: jsonHit.prepared,
                    alwaysPrepared: jsonHit.alwaysPrepared
                } : null
            };
        }

        return {
            sourceKind: null,
            sourceLabel: null,
            countsAgainstPrep: prep.countsAgainstPrep,
            sourceDetection: 'unresolved',
            grantedByFeature: jsonHit?.grantedByFeature || null,
            accessManager: heading,
            jsonMatch: jsonHit ? {
                bucket: jsonHit.bucket,
                prepared: jsonHit.prepared,
                alwaysPrepared: jsonHit.alwaysPrepared
            } : null
        };
    }

    function stripTrailingNameStar(name) {
        return String(name || '').replace(/\*+\s*$/g, '').trim();
    }

    function splitDisplayName(name) {
        const raw = normalizeText(name);
        const cleaned = normalizeText(stripTrailingNameStar(raw || '')) || raw;
        return {
            name: cleaned || null,
            rawName: raw && cleaned && raw !== cleaned ? raw : null
        };
    }

    function normalizeSpellName(name) {
        return stripTrailingNameStar(name)
            .toLowerCase()
            .replace(/['’]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function findSameNameSpells(exported, name) {
        const key = normalizeSpellName(name);
        return (exported || []).filter(spell =>
            normalizeSpellName(spell.name) === key
        );
    }

    function normalizeAccessPart(value) {
        return String(value || '').toLowerCase().trim();
    }

    function getAccessIdentity(access) {
        const label = normalizeAccessPart(access?.sourceLabel);
        const manager = normalizeAccessPart(access?.accessManager) || label;
        return [
            normalizeAccessPart(access?.sourceKind),
            label,
            manager,
            normalizeAccessPart(access?.grantedByFeature)
        ].join('|');
    }

    function hasAccessIdentity(access) {
        return Boolean(
            normalizeAccessPart(access?.sourceLabel) ||
            normalizeAccessPart(access?.grantedByFeature)
        );
    }

    function isUnresolvedPlaceholder(access) {
        return access?.sourceDetection === 'unresolved' && !hasAccessIdentity(access);
    }

    function accessIdentityKeys(access) {
        return [
            access?.sourceLabel,
            access?.grantedByFeature
        ].map(normalizeAccessPart).filter(Boolean);
    }

    function findExistingAccess(spell, candidate) {
        const accesses = spell?.accesses || [];
        const id = getAccessIdentity(candidate);
        const exact = accesses.find(access => getAccessIdentity(access) === id);
        if (exact) return exact;
        const candidateKeys = new Set(accessIdentityKeys(candidate));
        if (!candidateKeys.size) return null;
        const hits = accesses.filter(access =>
            accessIdentityKeys(access).some(key => candidateKeys.has(key))
        );
        return hits.length === 1 ? hits[0] : null;
    }

    const ACCESS_FIELDS = [
        'sourceKind',
        'sourceLabel',
        'grantedByFeature',
        'accessManager',
        'sourceDetection',
        'ddbSheetAction',
        'castingMode',
        'additionalDetections'
    ];

    function accessFromRecord(record) {
        const access = {};
        for (const key of ACCESS_FIELDS) {
            if (record?.[key] != null && record[key] !== '') {
                access[key] = record[key];
            }
        }
        if (!access.accessManager && access.sourceLabel) {
            access.accessManager = access.sourceLabel;
        }
        return access;
    }

    function seedAccesses(record) {
        const seed = accessFromRecord(record);
        record.accesses = hasAccessIdentity(seed) ? [seed] : [];
        return record;
    }

    function mergeAccessEvidence(existing, incoming) {
        for (const key of [
            'sourceKind',
            'sourceLabel',
            'grantedByFeature',
            'accessManager',
            'ddbSheetAction',
            'castingMode'
        ]) {
            if (!existing[key] && incoming[key]) existing[key] = incoming[key];
        }
        if (
            incoming.sourceDetection &&
            incoming.sourceDetection !== existing.sourceDetection
        ) {
            const extra = existing.additionalDetections || [];
            if (!extra.includes(incoming.sourceDetection)) {
                extra.push(incoming.sourceDetection);
                existing.additionalDetections = extra;
            }
        }
    }

    function upsertAccess(spell, candidate) {
        if (!Array.isArray(spell.accesses)) spell.accesses = [];
        const incoming = accessFromRecord(candidate);
        if (
            spell.accesses.length === 1 &&
            isUnresolvedPlaceholder(spell.accesses[0]) &&
            hasAccessIdentity(incoming)
        ) {
            spell.accesses = [incoming];
            return spell.accesses[0];
        }
        if (!spell.accesses.length) {
            if (!hasAccessIdentity(incoming)) return null;
            spell.accesses.push(incoming);
            return spell.accesses[0];
        }
        const existing = findExistingAccess(spell, incoming);
        if (existing) {
            mergeAccessEvidence(existing, incoming);
            return existing;
        }
        if (!hasAccessIdentity(incoming)) return null;
        spell.accesses.push(incoming);
        return spell.accesses[spell.accesses.length - 1];
    }

    function topLevelAccess(spell) {
        return {
            sourceKind: spell.sourceKind,
            sourceLabel: spell.sourceLabel,
            grantedByFeature: spell.grantedByFeature,
            accessManager: spell.accessManager || spell.sourceLabel
        };
    }

    function normalizeBookSource(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/['’]/g, '')
            .replace(/\s+/g, ' ')
            .replace(/,?\s*pg\.?\s*\d+.*$/i, '')
            .replace(/\s*\(\d{4}\)\s*$/g, '')
            .trim();
    }

    function sourcePageNumber(text) {
        const match = String(text || '').match(/pg\.?\s*(\d+)/i);
        return match ? Number(match[1]) : null;
    }

    function sourceSignalFromJson(record) {
        const def = record?.definition || {};
        const sourceEntry = Array.isArray(def.sources) ? def.sources[0] : null;
        const sourceText = [
            def.source,
            def.sourceName,
            def.primarySource,
            typeof def.sources === 'string' ? def.sources : null,
            sourceEntry?.name,
            sourceEntry?.description
        ].find(Boolean) || null;
        return {
            sourceText,
            page: def.sourcePageNumber || sourceEntry?.pageNumber ||
                sourcePageNumber(sourceText),
            definitionId: def.id || null,
            moreDetailsUrl: def.moreDetailsUrl || null
        };
    }

    function sourceSignalFromSheet(row) {
        return {
            sourceText: row?.bookSource || null,
            page: sourcePageNumber(row?.bookSource),
            definitionId: row?.definitionId || null,
            moreDetailsUrl: row?.ddbUrl || null
        };
    }

    function matchesSourceSignal(spell, signal) {
        if (!spell || !signal) return false;
        if (signal.definitionId != null) {
            const id = String(signal.definitionId);
            if (id && String(spell.id) === id) return true;
            if (id && new RegExp(`(?:/|-)${escapeRegex(id)}(?:-|/|$)`).test(
                String(spell.ddbUrl || '')
            )) {
                return true;
            }
        }
        if (signal.moreDetailsUrl && spell.ddbUrl) {
            const url = String(signal.moreDetailsUrl);
            if (url && String(spell.ddbUrl).includes(url)) return true;
        }
        const book = normalizeBookSource(signal.sourceText);
        const spellBook = normalizeBookSource(spell.source);
        if (book && spellBook && book === spellBook) {
            const page = signal.page ?? sourcePageNumber(signal.sourceText);
            const spellPage = sourcePageNumber(spell.source);
            if (page && spellPage && page !== spellPage) return false;
            return true;
        }
        return false;
    }

    function pickPublishedDefinition(candidates, signal, contextLabel) {
        if (!candidates.length) return { match: null, reason: 'none' };
        if (candidates.length === 1) {
            return { match: candidates[0], reason: 'unique-name' };
        }
        const keyed = candidates.filter(spell =>
            matchesSourceSignal(spell, signal)
        );
        if (keyed.length === 1) {
            return { match: keyed[0], reason: 'source-signal' };
        }
        console.warn(
            `Ambiguous published spell version: ${contextLabel} ` +
            `(${candidates.length} definitions` +
            `${keyed.length ? `, ${keyed.length} source-signal hits` : ''})`
        );
        return { match: null, reason: 'ambiguous' };
    }

    function formatJsonCastingTime(activation) {
        if (!activation || activation.activationType == null) return null;
        const types = {
            1: 'action',
            2: 'no action',
            3: 'bonus action',
            4: 'reaction',
            5: 'second',
            6: 'minute',
            7: 'hour'
        };
        const unit = types[activation.activationType];
        if (!unit) return null;
        const n = activation.activationTime;
        if (n == null) return unit;
        if (unit === 'action' || unit === 'bonus action' || unit === 'reaction') {
            return n === 1 ? `1 ${unit}` : `${n} ${unit}s`;
        }
        return `${n} ${unit}${n === 1 ? '' : 's'}`;
    }

    function formatJsonDuration(duration) {
        if (!duration) return null;
        const type = duration.durationType;
        const n = duration.durationInterval;
        const unit = duration.durationUnit
            ? String(duration.durationUnit).toLowerCase()
            : '';
        if (/instant/i.test(type) || /instant/i.test(unit)) return 'Instantaneous';
        if (/permanent/i.test(type)) return 'Permanent';
        const span = n && unit ? `${n} ${unit}${n === 1 ? '' : 's'}` : null;
        if (/concentration/i.test(type)) {
            return span ? `Concentration, up to ${span}` : 'Concentration';
        }
        return span || type || null;
    }

    function formatJsonRange(range) {
        if (!range) return null;
        const origin = range.origin;
        if (origin === 'Self' && range.aoeType && range.aoeValue) {
            return `Self (${range.aoeValue}-foot ${range.aoeType})`;
        }
        if (origin === 'Self' || origin === 'Touch') return origin;
        if (range.rangeValue) return `${range.rangeValue} feet`;
        return origin || null;
    }

    function formatJsonComponents(components, material) {
        const letters = { 1: 'V', 2: 'S', 3: 'M' };
        const parts = (components || []).map(id => letters[id]).filter(Boolean);
        if (!parts.length) return null;
        let text = parts.join(', ');
        if (parts.includes('M') && material) text += `(${material})`;
        return text;
    }

    function accessCandidateFromJson(record) {
        return accessFromRecord({
            sourceKind: record.sourceKind || null,
            sourceLabel: record.sourceLabel || null,
            grantedByFeature: record.grantedByFeature || null,
            accessManager: record.sourceLabel || null,
            sourceDetection: 'character-json-supplemental'
        });
    }

    function toSupplementalSpell(record) {
        const def = record.definition || {};
        const school = typeof def.school === 'string'
            ? titleCase(def.school.toLowerCase())
            : (def.school?.name ? titleCase(String(def.school.name).toLowerCase()) : null);
        const alwaysPrepared = record.alwaysPreparedExplicit
            ? record.alwaysPrepared
            : null;
        const currentlyPrepared = record.preparedExplicit || record.alwaysPreparedExplicit
            ? record.prepared === true || record.alwaysPrepared === true
            : null;
        const originKey = [
            slug(record.name),
            record.sourceKind || record.bucket || 'grant',
            slug(record.sourceLabel || 'unknown')
        ].join('--');
        const jsonVersion = rulesVersionFromJsonDefinition(def);

        const spell = {
            id: originKey,
            name: record.name,
            level: typeof def.level === 'number' ? def.level : null,
            school,
            ritual: typeof def.ritual === 'boolean' ? def.ritual : null,
            concentration: typeof def.concentration === 'boolean'
                ? def.concentration
                : null,
            castingTime: formatJsonCastingTime(def.activation),
            range: formatJsonRange(def.range),
            components: formatJsonComponents(
                def.components,
                def.componentsDescription
            ),
            duration: formatJsonDuration(def.duration),
            attackSave: null,
            damage: null,
            source: null,
            rulesVersion: jsonVersion.rulesVersion,
            legacy: jsonVersion.legacy,
            ddbDefinitionId: jsonVersion.ddbDefinitionId,
            currentlyPrepared,
            alwaysPrepared,
            countsAgainstPrep: false,
            sourceKind: record.sourceKind || null,
            sourceLabel: record.sourceLabel || null,
            known: true,
            grantedByFeature: record.grantedByFeature || null,
            accessManager: null,
            sourceDetection: 'character-json-supplemental',
            classes: record.sourceKind === 'class' && record.sourceLabel
                ? [record.sourceLabel]
                : [],
            tags: Array.isArray(def.tags) ? def.tags : [],
            description: null,
            higherLevels: null,
            ddbUrl: null,
            ddbMetadata: [],
            ddbSubtitle: null,
            ddbPrepAction: null,
            jsonMatch: {
                bucket: record.bucket,
                prepared: record.prepared,
                alwaysPrepared: record.alwaysPrepared
            }
        };
        return seedAccesses(spell);
    }

    function collectSupplementalGrants(exported, context) {
        const added = [];
        for (const record of context?.grantedRecords || []) {
            const pool = [...exported, ...added];
            const sameName = findSameNameSpells(pool, record.name);
            if (!sameName.length) {
                added.push(toSupplementalSpell(record));
                continue;
            }
            const picked = pickPublishedDefinition(
                sameName,
                sourceSignalFromJson(record),
                `${record.name} -> ${record.sourceLabel || '(none)'} (JSON)`
            );
            if (!picked.match) continue;
            upsertAccess(picked.match, accessCandidateFromJson(record));
        }
        return added;
    }

    // ------------------------------------------------------------
    // CHARACTER SPELLS TAB
    // ------------------------------------------------------------

    function isJsonSupplemental(spell) {
        return spell?.sourceDetection === 'character-json-supplemental';
    }

    function isSheetGranted(spell) {
        return spell?.sourceDetection === 'character-spells-tab';
    }

    function isManageSpellsSpell(spell) {
        return !isJsonSupplemental(spell) && !isSheetGranted(spell);
    }

    function sheetGroupLevel(row) {
        const group = row.closest('.ct-content-group');
        if (!group) return null;
        const header = group.querySelector(
            '.ct-content-group__header, .ct-content-group__heading, ' +
            '.ct-content-group__label'
        ) || group.querySelector('[class*="content-group__header"]');
        return parseLevelToken(header?.textContent);
    }

    function collectCharacterSheetSpells() {
        const shop = getShop();
        return [...document.querySelectorAll('.ct-spells-spell')]
            .filter(row => !shop || !shop.contains(row))
            .map(row => {
                const names = splitDisplayName(
                    row.querySelector('.ct-spells-spell__label')?.textContent
                );
                const sourceLabel = normalizeText(
                    row.querySelector('.ct-spells-spell__meta-item')?.textContent
                );
                const action = normalizeText(
                    row.querySelector('.ct-spells-spell__action')?.textContent
                );
                const isItemSource = !!row.querySelector(
                    '.ct-spells-spell__meta-item [class*="itemName"]'
                );
                return {
                    name: names.name,
                    rawName: names.rawName,
                    sourceLabel,
                    action,
                    level: sheetGroupLevel(row),
                    isItemSource
                };
            })
            .filter(row => row.name);
    }

    function normalizeCastingMode(action) {
        const text = String(action || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!text) return null;
        if (text === 'at will' || text === 'at-will') return 'at-will';
        if (text === 'cast') return 'cast';
        if (text === 'use') return 'use';
        return text;
    }

    function sheetSourceKind(label, context) {
        if (!label || !context) return null;
        const key = label.toLowerCase();
        if (isClassName(label)) return 'class';
        if (context.subclassNames?.has(key)) return 'subclass';
        if (context.itemNames?.has(key)) return 'item';
        if (context.featNames?.has(key)) return 'feat';
        if (context.speciesNames?.has(key)) return 'species';
        if (context.featureNames?.has(key)) return 'feature';
        return null;
    }

    function classifySheetSource(row, context) {
        if (row.isItemSource) {
            return { sourceKind: 'item', sourceLabel: row.sourceLabel };
        }
        return {
            sourceKind: sheetSourceKind(row.sourceLabel, context),
            sourceLabel: row.sourceLabel
        };
    }

    function accessCandidateFromSheet(row, classified) {
        const sourceLabel = classified.sourceLabel || null;
        const sourceKind = classified.sourceKind || null;
        return accessFromRecord({
            sourceKind,
            sourceLabel,
            grantedByFeature: sourceKind === 'feature' ? sourceLabel : null,
            accessManager: sourceLabel,
            sourceDetection: 'character-spells-tab',
            ddbSheetAction: row.action || null,
            castingMode: normalizeCastingMode(row.action)
        });
    }

    function findSheetMatch(row, exported) {
        const sameName = findSameNameSpells(exported, row.name);
        if (!sameName.length) return { match: null, add: true };

        const picked = pickPublishedDefinition(
            sameName,
            sourceSignalFromSheet(row),
            `${row.name} -> ${row.sourceLabel || '(none)'} (sheet)`
        );
        if (picked.match) return { match: picked.match, add: false };
        return { match: null, add: false };
    }

    function applyPrimarySheetFields(spell, candidate, row) {
        const primary = topLevelAccess(spell);
        const isPrimary =
            getAccessIdentity(primary) === getAccessIdentity(candidate) ||
            Boolean(findExistingAccess({ accesses: [primary] }, candidate));
        if (!isPrimary) return;
        if (row.action) {
            spell.ddbSheetAction = row.action;
            spell.castingMode = normalizeCastingMode(row.action) ||
                spell.castingMode ||
                null;
        }
        if (row.rawName && !spell.rawName) spell.rawName = row.rawName;
    }

    function toSheetGrantedSpell(row, classified) {
        const originKey = [
            slug(row.name),
            classified.sourceKind || 'grant',
            slug(classified.sourceLabel || 'unknown')
        ].join('--');
        const spell = {
            id: originKey,
            name: row.name,
            rawName: row.rawName || null,
            level: typeof row.level === 'number' ? row.level : null,
            school: null,
            ritual: null,
            concentration: null,
            castingTime: null,
            range: null,
            components: null,
            duration: null,
            attackSave: null,
            damage: null,
            source: null,
            rulesVersion: null,
            legacy: null,
            ddbDefinitionId: null,
            currentlyPrepared: false,
            alwaysPrepared: false,
            countsAgainstPrep: false,
            sourceKind: classified.sourceKind,
            sourceLabel: classified.sourceLabel,
            known: false,
            grantedByFeature: classified.sourceKind === 'feature'
                ? classified.sourceLabel
                : null,
            accessManager: null,
            sourceDetection: 'character-spells-tab',
            classes: [],
            tags: [],
            description: null,
            higherLevels: null,
            ddbUrl: null,
            ddbMetadata: [],
            ddbSubtitle: null,
            ddbPrepAction: null,
            ddbSheetAction: row.action || null,
            castingMode: normalizeCastingMode(row.action),
            jsonMatch: null
        };
        if (!spell.rawName) delete spell.rawName;
        return seedAccesses(spell);
    }

    function reconcileCharacterSheetSpells(exported, sheetRows, context) {
        const added = [];
        let enrichedCount = 0;
        let accessSourceUnresolvedCount = 0;

        if (!sheetRows.length) {
            console.warn(
                'DDB Spell Exporter: No Character Spells tab rows found. ' +
                'Select the Spells tab, then open Manage Spells before exporting.'
            );
            return {
                added,
                enrichedCount,
                accessSourceUnresolvedCount,
                sheetCount: 0
            };
        }

        for (const row of sheetRows) {
            const classified = classifySheetSource(row, context);
            if (!classified.sourceKind) accessSourceUnresolvedCount += 1;

            const decision = findSheetMatch(row, [...exported, ...added]);
            if (decision.add) {
                if (!classified.sourceKind) {
                    console.warn(
                        `Character Spells unresolved source: ${row.name} -> ` +
                        `${row.sourceLabel || '(none)'}`
                    );
                }
                added.push(toSheetGrantedSpell(row, classified));
                continue;
            }
            if (decision.match) {
                const candidate = accessCandidateFromSheet(row, classified);
                upsertAccess(decision.match, candidate);
                applyPrimarySheetFields(decision.match, candidate, row);
                if (row.rawName && !decision.match.rawName) {
                    decision.match.rawName = row.rawName;
                }
                enrichedCount += 1;
            }
        }

        if (added.length) {
            console.log(
                'Character Spells supplemental:\n' +
                added.map(spell =>
                    `${spell.name} -> ${spell.sourceLabel || '(none)'} -> ` +
                    `${spell.sourceKind || 'unresolved'} -> ` +
                    `${spell.ddbSheetAction || ''}`
                ).join('\n')
            );
        } else {
            console.log(
                'DDB Spell Exporter: no Character Spells tab grants to add.'
            );
        }

        return {
            added,
            enrichedCount,
            accessSourceUnresolvedCount,
            sheetCount: sheetRows.length
        };
    }

    function parsePrepFraction(text) {
        const match = String(text || '').match(/(\d+)\s*\/\s*(\d+)/);
        if (!match) return { used: null, max: null };
        return { used: Number(match[1]), max: Number(match[2]) };
    }

    function extractDomPrepBudgets() {
        return [...document.querySelectorAll('.ct-class-spell-manager')].map(manager => {
            const name = normalizeText(
                manager.querySelector('.ct-class-spell-manager__heading')?.textContent
            );
            const spellsInfo = normalizeText(
                manager.querySelector(
                    '.ct-class-spell-manager__info-entry--spells'
                )?.textContent
            );
            const cantripsInfo = normalizeText(
                manager.querySelector(
                    '.ct-class-spell-manager__info-entry--cantrips'
                )?.textContent
            );
            const prep = parsePrepFraction(spellsInfo);
            const known = String(spellsInfo || '').match(/\((\d+)\s*Known\)/i);
            const cantrips = String(cantripsInfo || '').match(/(\d+)/);
            return {
                name,
                preparedUsed: prep.used,
                preparedMax: prep.max,
                knownCount: known ? Number(known[1]) : null,
                cantripsKnown: cantrips ? Number(cantrips[1]) : null,
                rawSpells: spellsInfo,
                rawCantrips: cantripsInfo
            };
        }).filter(entry => entry.name);
    }

    function jsonPrepBudget(cls) {
        const level = Number(cls.level) || 0;
        const rules = cls.definition?.spellRules || {};
        const preparedMax = Array.isArray(rules.levelPreparedSpellMaxes)
            ? rules.levelPreparedSpellMaxes[level] ?? null
            : null;
        const cantripsMax = Array.isArray(rules.levelCantripsKnownMaxes)
            ? rules.levelCantripsKnownMaxes[level] ?? null
            : null;
        return {
            name: cls.definition?.name || null,
            subclass: stripSourceTag(cls.subclassDefinition?.name),
            level,
            preparedMaxFromJson: preparedMax,
            cantripsMaxFromJson: cantripsMax
        };
    }

    function buildPreparationMetadata(context, spells) {
        const domBudgets = extractDomPrepBudgets();
        const jsonClasses = (context?.classes || []).map(jsonPrepBudget);
        const classes = [];
        const names = new Set([
            ...domBudgets.map(entry => entry.name).filter(Boolean),
            ...jsonClasses.map(entry => entry.name).filter(Boolean)
        ]);

        for (const name of names) {
            const dom = domBudgets.find(entry => entry.name === name) || {};
            const json = jsonClasses.find(entry => entry.name === name) || {};
            const classSpells = spells.filter(spell =>
                spell.accessManager === name ||
                (spell.sourceKind === 'class' && spell.sourceLabel === name)
            );
            const counted = classSpells.filter(spell => spell.countsAgainstPrep);
            classes.push({
                name,
                subclass: json.subclass || null,
                level: json.level || null,
                preparedUsed: dom.preparedUsed,
                preparedMax: dom.preparedMax ?? json.preparedMaxFromJson ?? null,
                preparedMaxFromJson: json.preparedMaxFromJson ?? null,
                knownCount: dom.knownCount,
                cantripsKnown: dom.cantripsKnown,
                cantripsMax: json.cantripsMaxFromJson ?? null,
                countedFromExport: counted.length,
                rawSpells: dom.rawSpells || null,
                rawCantrips: dom.rawCantrips || null
            });
        }

        const notes = [
            'currentlyPrepared, alwaysPrepared, and countsAgainstPrep come from Manage Spells row actions (Unprepare / Prepare / Always Prepared / Learn / Delete).',
            'source is the book source. sourceKind/sourceLabel is why this character has the spell. Top-level access fields remain the primary/base access for compatibility.',
            'countsAgainstPrep is true only for leveled spells with an Unprepare button. Always Prepared, cantrips, and unprepared rows are false.',
            'Always Prepared rows may keep sourceKind/sourceLabel unresolved. That is enough to exclude them from the prep decision pool.',
            'accesses[] lists each distinct access route. Access identity (sourceKind/sourceLabel/accessManager/grantedByFeature) is separate from detection provenance (sourceDetection).',
            'The same access observed through multiple detection paths is merged into one route. Original sourceDetection is preserved; later paths may add additionalDetections and sheet action data.',
            'Top-level ddbSheetAction and castingMode reflect the primary/base access only. Per-route actions live on accesses[].',
            'Unresolved Manage Spells detection is not an access route. accesses[] is only seeded when sourceLabel or grantedByFeature identifies a real route.',
            'sourceDetection character-json-supplemental means the spell was granted on the character but missing from Manage Spells. Those records have no scraped description.',
            'sourceDetection character-spells-tab means the spell was visible on the character sheet Spells tab but not in Manage Spells. It is granted magic, not a preparation candidate.',
            'Trailing display artifacts such as Shillelagh* are normalized for matching; rawName keeps the original label.',
            'If a JSON or Spells-tab grant matches multiple published versions of the same spell name and no book/source signal uniquely identifies one, that access is left unassigned.',
            'characterSheetAccessSourceUnresolvedCount counts Spells-tab rows whose access sourceKind could not be classified. It is not an unprocessed-row count.',
            'George\'s displayed budget is Prepared Spells used/max from .ct-class-spell-manager__info-entry--spells when that node is present.'
        ];
        if (context?.limitations?.length) notes.push(...context.limitations);
        if (!domBudgets.some(entry => entry.preparedMax != null)) {
            notes.push(
                'No Prepared Spells: N/M readout was found in the DOM. Open Known Spells before exporting to capture the live budget.'
            );
        }

        return {
            characterName: context?.characterName || null,
            characterJsonLoaded: Boolean(context?.loaded),
            characterJsonEndpoint: context?.endpoint || null,
            characterJsonError: context?.error || null,
            characterJsonSpellNames: context?.jsonSpellCount ?? 0,
            classes,
            notes
        };
    }

    function parseRulesVersionFromText(text) {
        const blob = String(text || '');
        const has2024 = /\b2024\b|\b5\.5e\b|\bxphb\b/i.test(blob);
        const has2014 = /\b2014\b/i.test(blob);
        if (has2024 && !has2014) return '2024';
        if (has2014 && !has2024) return '2014';
        return null;
    }

    function extractLegacyFlag(item, tags, metadata) {
        if (
            item.querySelector('[data-tooltip-content="Legacy"]') ||
            item.querySelector('[aria-label="Legacy"]') ||
            item.querySelector('[title="Legacy"]')
        ) {
            return true;
        }
        const texts = [
            ...(tags || []),
            ...(metadata || []),
            ...[...item.querySelectorAll(
                '[class*="badge"], [class*="tag"], [class*="pill"], [class*="legacy"]'
            )].map(el => normalizeText(el.textContent))
        ];
        if (texts.some(text => /^\s*legacy\s*$/i.test(String(text || '')))) {
            return true;
        }
        return null;
    }

    function extractRulesVersion(item, source, tags, metadata) {
        const sourceVersion = parseRulesVersionFromText(source);
        const legacyFlag = extractLegacyFlag(item, tags, metadata);
        let rulesVersion = sourceVersion;
        let legacy = null;
        if (legacyFlag === true) legacy = true;
        if (rulesVersion === '2024') legacy = false;
        if (rulesVersion === '2014') legacy = true;
        return { rulesVersion, legacy };
    }

    function rulesVersionFromJsonDefinition(def) {
        if (!def) return { rulesVersion: null, legacy: null, ddbDefinitionId: null };
        const sourceBlob = [
            def.source,
            def.sourceName,
            def.primarySource,
            ...(Array.isArray(def.sources)
                ? def.sources.map(entry => entry?.name || entry?.description || '')
                : [])
        ].join(' ');
        let rulesVersion = parseRulesVersionFromText(sourceBlob);
        let legacy = null;
        if (typeof def.isLegacy === 'boolean') legacy = def.isLegacy;
        else if (typeof def.legacy === 'boolean') legacy = def.legacy;
        if (legacy === true && !rulesVersion) rulesVersion = null;
        if (legacy === false && rulesVersion !== '2024') {
            /* non-Legacy is explicit, but not proof of a 2024 reprint */
        }
        if (rulesVersion === '2024') legacy = false;
        if (rulesVersion === '2014') legacy = true;
        return {
            rulesVersion,
            legacy,
            ddbDefinitionId: def.id ?? null
        };
    }

    function findJsonDefinitionForSpell(spell, context) {
        const hits = context?.byName?.get(String(spell.name || '').toLowerCase()) || [];
        if (!hits.length) return null;
        if (hits.length === 1) return hits[0];
        const keyed = hits.filter(hit =>
            matchesSourceSignal(spell, sourceSignalFromJson(hit))
        );
        if (keyed.length === 1) return keyed[0];
        return null;
    }

    function enrichSpellsFromJson(spells, context) {
        if (!context?.loaded) return;
        for (const spell of spells) {
            const record = findJsonDefinitionForSpell(spell, context);
            const def = record?.definition;
            if (!def) continue;
            if (emptyValue(spell.range)) {
                const formatted = formatJsonRange(def.range);
                if (formatted) spell.range = formatted;
            }
            if (spell.ddbDefinitionId == null && def.id != null) {
                spell.ddbDefinitionId = def.id;
            }
            if (!spell.ddbUrl && def.moreDetailsUrl) {
                spell.ddbUrl = def.moreDetailsUrl;
            }
            const fromJson = rulesVersionFromJsonDefinition(def);
            if (spell.legacy == null && fromJson.legacy != null) {
                spell.legacy = fromJson.legacy;
            }
            if (!spell.rulesVersion && fromJson.rulesVersion) {
                spell.rulesVersion = fromJson.rulesVersion;
            }
        }
    }

    function extractSpell(item) {
        const rawLines = getRawLines(item);
        const lines = rawLines.filter(Boolean);
        const names = splitDisplayName(extractName(item));
        const name = names.name;
        const metadata = extractHeaderMetadata(item);
        const subtitle = extractSubtitle(item, lines, metadata);
        let source = extractKeyedField(rawLines, 'Source');
        let description = extractDescription(item);
        const peeled = peelSourceFromDescription(source, description);
        source = peeled.source;
        const split = splitDescriptionAndHigher(peeled.description);
        description = split.description;
        const higherLevels = split.higherLevels;
        const ddbUrl = extractDdbUrl(item);
        const tags = extractTags(item);
        const duration = extractKeyedField(rawLines, 'Duration');
        const classes = extractClasses(item, tags, rawLines);
        const level = extractLevel(item, subtitle, metadata);
        const prep = extractPrepState(item, level);
        const access = resolveAccessSource(
            item,
            name,
            prep,
            rawLines,
            characterContext
        );
        const version = extractRulesVersion(item, source, tags, metadata);

        const spell = {
            id: extractId(ddbUrl, name, source),
            name,
            rawName: names.rawName || undefined,
            level,
            school: extractSchool(subtitle, metadata),
            ritual: extractRitual(item, subtitle, duration, tags),
            concentration: extractConcentration(item, duration, subtitle),
            castingTime: extractKeyedField(rawLines, 'Casting Time'),
            range: extractKeyedField(rawLines, 'Range'),
            components: extractKeyedField(rawLines, 'Components'),
            duration,
            attackSave: extractKeyedField(rawLines, 'Attack/Save'),
            damage: extractKeyedField(rawLines, 'Damage'),
            source,
            rulesVersion: version.rulesVersion,
            legacy: version.legacy,
            ddbDefinitionId: null,
            currentlyPrepared: prep.currentlyPrepared,
            alwaysPrepared: prep.alwaysPrepared,
            countsAgainstPrep: access.countsAgainstPrep,
            sourceKind: access.sourceKind,
            sourceLabel: access.sourceLabel,
            known: prep.known,
            grantedByFeature: access.grantedByFeature,
            accessManager: access.accessManager,
            sourceDetection: access.sourceDetection,
            classes,
            tags,
            description,
            higherLevels,
            ddbUrl,
            ddbMetadata: metadata,
            ddbSubtitle: subtitle,
            ddbPrepAction: prep.action,
            jsonMatch: access.jsonMatch
        };
        if (!spell.rawName) delete spell.rawName;
        return seedAccesses(spell);
    }

    // ------------------------------------------------------------
    // SPELL CARDS MAPPING
    // ------------------------------------------------------------

    function spellDedupeKey(spell) {
        return `${String(spell.name || '').toLowerCase()}||${String(spell.source || '').toLowerCase()}`;
    }

    function toSpellCard(spell) {
        return {
            name: spell.name || '',
            level: Number(spell.level) || 0,
            school: schoolCode(spell.school),
            time: spell.castingTime || '',
            range: spell.range || '',
            components: spell.components || '',
            duration: spell.duration || '',
            classes: Array.isArray(spell.classes)
                ? spell.classes.join(', ')
                : (spell.classes || ''),
            ritual: !!spell.ritual,
            description: spell.description || '',
            higherLevels: spell.higherLevels || ''
        };
    }

    function dedupeSpells(spells) {
        const seen = new Map();
        const skipped = [];
        for (const spell of spells) {
            const key = spellDedupeKey(spell);
            if (seen.has(key)) {
                skipped.push({
                    name: spell.name,
                    source: spell.source,
                    reason: 'duplicate name+source'
                });
                continue;
            }
            seen.set(key, spell);
        }
        return { spells: [...seen.values()], skipped };
    }

    // ------------------------------------------------------------
    // LOAD ALL
    // ------------------------------------------------------------

    async function waitForCountIncrease(previousCount, timeout = 8000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            throwIfAborted();
            if (getItemCount() > previousCount) return true;
            await sleep(200);
        }
        return false;
    }

    async function waitWhileDisabled(timeout = 8000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            throwIfAborted();
            const state = loadMoreState();
            if (state.status !== 'disabled') return state;
            await sleep(250);
        }
        return loadMoreState();
    }

    function describeShop(shop) {
        if (!shop) return { found: false };
        return {
            found: true,
            tag: shop.tagName,
            className: classText(shop).slice(0, 200),
            items: getItemNodes(shop).length,
            loadMore: findLoadMoreIn(shop) ? 'yes' : 'no'
        };
    }

    async function loadAllSpells() {
        if (loading || exporting) return;
        loading = true;
        aborted = false;
        setBusy(true, 'load');
        shopCache = null;

        try {
            const shop = getShop();
            console.log('DDB Spell Exporter: shop', describeShop(shop));
            let previousCount = getItemCount();
            let stallClicks = 0;

            if (!previousCount && loadMoreState().status === 'missing') {
                console.warn(
                    'DDB Spell Exporter: No spell rows found. Open Manage Spells → Add Spells first.'
                );
            }

            while (true) {
                throwIfAborted();
                let state = loadMoreState();

                if (state.status === 'disabled') {
                    setLoadLabel(`Loading... ${getItemCount()} spells`);
                    state = await waitWhileDisabled();
                }

                if (state.status === 'missing') {
                    await sleep(1200);
                    throwIfAborted();
                    state = loadMoreState();
                    if (state.status === 'missing') break;
                    continue;
                }

                if (state.status === 'disabled') {
                    stallClicks += 1;
                    if (stallClicks >= 3) break;
                    continue;
                }

                setLoadLabel(`Loading... ${getItemCount()} spells`);
                console.log(`DDB Spell Exporter: ${getItemCount()} spells loaded`);
                state.button.click();

                const grew = await waitForCountIncrease(previousCount);
                if (grew) {
                    previousCount = getItemCount();
                    stallClicks = 0;
                    await sleep(400);
                    continue;
                }

                stallClicks += 1;
                if (stallClicks >= 3) {
                    console.warn(
                        'DDB Spell Exporter: Load More stalled; stopping pagination.'
                    );
                    break;
                }
            }

            const total = getItemCount();
            setLoadLabel(
                total
                    ? `✓ ${total} SPELLS LOADED`
                    : 'NO SPELLS FOUND'
            );
            console.log(`DDB Spell Exporter: Finished. ${total} spells loaded.`);
        } catch (error) {
            if (isAbortError(error)) {
                setLoadLabel(`Aborted · ${getItemCount()} spells`);
            } else {
                throw error;
            }
        } finally {
            loading = false;
            aborted = false;
            setBusy(false);
        }
    }

    // ------------------------------------------------------------
    // EXPORT
    // ------------------------------------------------------------

    async function expandItemAt(index, visibleName) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            throwIfAborted();
            const item = getItemAt(index);
            if (!item) {
                throw new Error('Spell node disappeared');
            }
            if (!isCollapsed(item) || hasDetailBody(item)) {
                return item;
            }
            if (attempt > 1) {
                console.log(
                    `DDB Spell Exporter: Retry ${attempt}/3 expanding ${visibleName}`
                );
                await sleep(300);
            }
            item.scrollIntoView({ block: 'center', behavior: 'auto' });
            await sleep(150);
            const current = getItemAt(index) || item;
            const header = getHeader(current);
            if (!header) {
                if (attempt === 3) {
                    throw new Error('Could not find spell header');
                }
                continue;
            }
            header.click();
            const expanded = await waitForExpanded(getItemAt(index) || current);
            if (expanded) return getItemAt(index) || current;
        }
        throw new Error('Timed out expanding spell');
    }

    async function exportSpells() {
        if (loading || exporting) return;

        if (loadMoreState().status === 'enabled') {
            alert(
                'There are still more spells available. Click LOAD ALL DDB SPELLS first.'
            );
            return;
        }

        const total = getItemCount();
        if (!total) {
            alert('No D&D Beyond spells were found.');
            return;
        }

        exporting = true;
        aborted = false;
        setBusy(true, 'export');
        shopCache = null;
        characterContext = null;

        const results = [];
        const errors = [];
        let sheetRows = [];

        try {
            setExportLabel('Loading character data...');
            const fetched = await fetchCharacterData();
            characterContext = buildCharacterContext(
                fetched.data,
                fetched.endpoint,
                fetched.error
            );
            console.log('DDB Spell Exporter: character JSON', {
                loaded: characterContext.loaded,
                endpoint: characterContext.endpoint,
                spellNames: characterContext.jsonSpellCount,
                error: characterContext.error
            });

            sheetRows = collectCharacterSheetSpells();
            console.log('DDB Spell Exporter: Character Spells tab', {
                count: sheetRows.length
            });

            for (let i = 0; i < getItemCount(); i++) {
                throwIfAborted();
                const item = getItemAt(i);
                if (!item) {
                    errors.push({
                        name: `Spell ${i + 1}`,
                        error: 'Spell node disappeared'
                    });
                    continue;
                }

                const visibleName = extractName(item) || `Spell ${i + 1}`;
                setExportLabel(`Exporting ${i + 1}/${getItemCount()}`);
                console.log(
                    `DDB Spell Exporter: ${i + 1}/${getItemCount()} - ${visibleName}`
                );

                try {
                    await expandItemAt(i, visibleName);
                    const data = extractSpell(getItemAt(i) || item);
                    results.push(data);
                    console.log('Extracted:', data);
                } catch (error) {
                    if (isAbortError(error)) throw error;
                    console.error(
                        `DDB Spell Exporter failed on ${visibleName}:`,
                        error
                    );
                    errors.push({
                        name: visibleName,
                        error: error?.message || String(error)
                    });
                }

                await sleep(100);
            }

            const supplemental = collectSupplementalGrants(
                results,
                characterContext
            );
            if (supplemental.length) {
                console.log(
                    'DDB Spell Exporter: supplemental granted spells',
                    supplemental.map(spell => ({
                        name: spell.name,
                        sourceKind: spell.sourceKind,
                        sourceLabel: spell.sourceLabel,
                        bucket: spell.jsonMatch?.bucket
                    }))
                );
                results.push(...supplemental);
            } else {
                console.log(
                    'DDB Spell Exporter: no supplemental granted spells to add.'
                );
            }

            const sheetReconcile = reconcileCharacterSheetSpells(
                results,
                sheetRows,
                characterContext
            );
            results.push(...sheetReconcile.added);
            enrichSpellsFromJson(results, characterContext);

            downloadExports(results, errors, {
                domSpellCount: results.filter(isManageSpellsSpell).length,
                supplementalGrantedSpellCount: supplemental.length,
                characterSheetSpellCount: sheetRows.length,
                characterSheetGrantedSpellCount: sheetReconcile.added.length,
                characterSheetEnrichedCount: sheetReconcile.enrichedCount,
                characterSheetAccessSourceUnresolvedCount:
                    sheetReconcile.accessSourceUnresolvedCount
            });

            const unresolved = results.filter(spell =>
                spell.sourceDetection === 'unresolved'
            );
            if (unresolved.length) {
                console.warn(
                    `DDB Spell Exporter: ${unresolved.length} spell(s) have ` +
                    'unresolved sourceKind/sourceLabel (often Always Prepared grants).',
                    unresolved.map(spell => spell.name)
                );
            }

            setExportLabel(`✓ EXPORTED ${results.length} SPELLS`);
            console.log(
                `DDB Spell Exporter: Export complete. ` +
                `${results.filter(isManageSpellsSpell).length} from Manage Spells, ` +
                `${supplemental.length} JSON grants, ` +
                `${sheetReconcile.added.length} Character Spells grants, ` +
                `${results.length} total, ${errors.length} errors.`
            );
        } catch (error) {
            if (isAbortError(error)) {
                if (results.length) {
                    downloadExports(results, errors, {
                        domSpellCount: results.filter(isManageSpellsSpell).length,
                        supplementalGrantedSpellCount: results.filter(
                            isJsonSupplemental
                        ).length,
                        characterSheetSpellCount: sheetRows.length,
                        characterSheetGrantedSpellCount: results.filter(
                            isSheetGranted
                        ).length,
                        characterSheetEnrichedCount: 0,
                        characterSheetAccessSourceUnresolvedCount: 0
                    });
                }
                setExportLabel(`Aborted · ${results.length} exported`);
            } else {
                throw error;
            }
        } finally {
            exporting = false;
            aborted = false;
            setBusy(false);
        }
    }

    function downloadExports(results, errors, counts = {}) {
        const date = new Date().toISOString().slice(0, 10);
        const supplemental = results.filter(isJsonSupplemental);
        const sheetGranted = results.filter(isSheetGranted);
        const fromDom = results.filter(isManageSpellsSpell);
        const { spells, skipped } = dedupeSpells(fromDom);
        const cards = spells.map(toSpellCard);
        if (skipped.length) {
            console.warn(
                `DDB Spell Exporter: Skipped ${skipped.length} duplicate spell(s).`,
                skipped
            );
        }
        const unresolvedSourceCount = results.filter(spell =>
            spell.sourceDetection === 'unresolved'
        ).length;
        const domSpellCount = counts.domSpellCount ?? fromDom.length;
        const supplementalGrantedSpellCount =
            counts.supplementalGrantedSpellCount ?? supplemental.length;
        const characterSheetSpellCount = counts.characterSheetSpellCount ?? 0;
        const characterSheetGrantedSpellCount =
            counts.characterSheetGrantedSpellCount ?? sheetGranted.length;
        const characterSheetEnrichedCount =
            counts.characterSheetEnrichedCount ?? 0;
        const characterSheetAccessSourceUnresolvedCount =
            counts.characterSheetAccessSourceUnresolvedCount ?? 0;
        downloadJSON(
            {
                metadata: {
                    source: 'D&D Beyond Manage Spells',
                    scriptVersion: SCRIPT_VERSION,
                    exportedAt: new Date().toISOString(),
                    pageUrl: location.href,
                    itemCount: results.length,
                    domSpellCount,
                    supplementalGrantedSpellCount,
                    characterSheetSpellCount,
                    characterSheetGrantedSpellCount,
                    characterSheetEnrichedCount,
                    characterSheetAccessSourceUnresolvedCount,
                    finalSpellCount: results.length,
                    unresolvedSourceCount,
                    errorCount: errors.length,
                    duplicateSkippedCount: skipped.length,
                    duplicateSkipped: skipped,
                    preparation: buildPreparationMetadata(
                        characterContext,
                        results
                    )
                },
                spells: results,
                errors
            },
            `ddb-spell-pool-${date}.json`
        );
        downloadJSON(
            { spells: cards, skipped },
            `ddb-spell-cards-${date}.json`
        );
    }

    function downloadJSON(data, filename) {
        const blob = new Blob(
            [JSON.stringify(data, null, 2)],
            { type: 'application/json;charset=utf-8' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // ------------------------------------------------------------
    // UI
    // ------------------------------------------------------------

    function makeButton(text, background) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        Object.assign(button.style, {
            padding: '11px 16px',
            background,
            color: 'white',
            border: '2px solid white',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,.4)'
        });
        return button;
    }

    function setLoadLabel(text) {
        if (ui?.loadButton) ui.loadButton.textContent = text;
    }

    function setExportLabel(text) {
        if (ui?.exportButton) ui.exportButton.textContent = text;
    }

    function setBusy(busy, job) {
        if (!ui) return;
        ui.loadButton.disabled = busy;
        ui.exportButton.disabled = busy;
        ui.loadButton.style.opacity = busy && job !== 'load' ? '0.6' : '1';
        ui.exportButton.style.opacity = busy && job !== 'export' ? '0.6' : '1';
        ui.abortButton.style.display = busy ? 'block' : 'none';
        ui.abortButton.disabled = !busy;
        ui.abortButton.textContent = 'ABORT';
    }

    function createControls() {
        if (!getShop()) return;
        if (document.querySelector(`#${CONTROLS_ID}`)) return;

        const container = document.createElement('div');
        container.id = CONTROLS_ID;
        Object.assign(container.style, {
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: '999999',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        });

        const loadButton = makeButton('LOAD ALL DDB SPELLS', '#b7282e');
        const exportButton = makeButton('EXPORT FULL SPELLS', '#246b39');
        const abortButton = makeButton('ABORT', '#444');
        abortButton.style.display = 'none';

        loadButton.addEventListener('click', () => {
            loadAllSpells().catch(error => console.error(error));
        });
        exportButton.addEventListener('click', () => {
            exportSpells().catch(error => console.error(error));
        });
        abortButton.addEventListener('click', () => {
            aborted = true;
            abortButton.textContent = 'Aborting...';
        });

        container.append(loadButton, exportButton, abortButton);
        document.body.appendChild(container);
        ui = { loadButton, exportButton, abortButton };
    }

    function removeControlsIfNeeded() {
        if (getShop()) return;
        const controls = document.querySelector(`#${CONTROLS_ID}`);
        if (controls) controls.remove();
        ui = null;
    }

    let observerTimer = null;
    const observer = new MutationObserver(() => {
        shopCache = null;
        clearTimeout(observerTimer);
        observerTimer = setTimeout(() => {
            createControls();
            removeControlsIfNeeded();
        }, 250);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    createControls();
    console.log(`DDB Spell Pool Exporter v${SCRIPT_VERSION} ready.`);
})();
