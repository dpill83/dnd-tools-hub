// ==UserScript==
// @name         DDB Loot Pool Exporter
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  Loads and exports D&D Beyond equipment as a rich snapshot plus a Loot Forge import file.
// @match        https://www.dndbeyond.com/characters/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_VERSION = '2.4';
    const CONTROLS_ID = 'ddb-loot-exporter-controls';

    const SUBTITLE_KINDS =
        'weapon|armor|wondrous item|potion|ring|rod|scroll|staff|wand|adventuring gear|gear';
    const RARITY_WORDS =
        'artifact|legendary|very rare|uncommon|common|varies|rare';

    const FIELD_NAMES = [
        'Proficient',
        'Attack Type',
        'Range',
        'Reach',
        'Damage',
        'Damage Type',
        'Weight',
        'Cost',
        'Properties',
        'Source'
    ];

    const STOP_LINES = [/^TAGS:?$/i, /^Amount to add$/i, /^ADD ITEM$/i];

    const LOOT_CATEGORIES = [
        'Adventuring Gear',
        'Armor',
        'Book',
        'Potion',
        'Quest Hook',
        'Ring',
        'Treasure',
        'Weapon',
        'Wondrous Item'
    ];

    const RARITY_TO_TIER = {
        Unknown: 0,
        Mundane: 0,
        Common: 1,
        Uncommon: 2,
        Rare: 3,
        'Very Rare': 4,
        Legendary: 5
    };

    const WEAPON_TYPES = [
        'club', 'dagger', 'greatclub', 'handaxe', 'javelin', 'light hammer',
        'mace', 'quarterstaff', 'sickle', 'spear', 'crossbow', 'dart',
        'shortbow', 'sling', 'battleaxe', 'flail', 'glaive', 'greataxe',
        'greatsword', 'halberd', 'lance', 'longsword', 'maul', 'morningstar',
        'pike', 'rapier', 'scimitar', 'shortsword', 'trident', 'war pick',
        'warhammer', 'whip', 'blowgun', 'longbow', 'net'
    ];

    const ARMOR_TERMS = [
        'light armor', 'medium armor', 'heavy armor', 'shield', 'plate',
        'chain mail', 'chain shirt', 'half plate', 'hide', 'leather',
        'padded', 'ring mail', 'scale mail', 'splint', 'studded leather'
    ];

    let loading = false;
    let exporting = false;
    let aborted = false;
    let ui = null;

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

    function getShop() {
        return document.querySelector('.ct-equipment-shop');
    }

    function getItems() {
        const shop = getShop();
        if (!shop) return [];
        return [...shop.querySelectorAll('.ct-equipment-shop__item')];
    }

    function getItemCount() {
        return getItems().length;
    }

    function getItemAt(index) {
        return getItems()[index] || null;
    }

    function isCollapsed(item) {
        return item.classList.contains('ddbc-collapsible--collapsed');
    }

    function getHeader(item) {
        return item.querySelector('.ddbc-collapsible__header');
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
            .replace(/^-+|-+$/g, '') || 'item';
    }

    // ------------------------------------------------------------
    // LOAD MORE
    // ------------------------------------------------------------

    function getLoadMoreButton() {
        const shop = getShop();
        if (!shop) return null;
        return [...shop.querySelectorAll('button')].find(button =>
            button.textContent.trim().toLowerCase() === 'load more'
        ) || null;
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
            if (!isCollapsed(item)) {
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

    function isKnownField(line) {
        return FIELD_NAMES.some(field =>
            new RegExp(`^${escapeRegex(field)}\\s*:`, 'i').test(line)
        );
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
        const regex = new RegExp(
            `^${escapeRegex(fieldName)}\\s*:\\s*(.*)$`,
            'i'
        );
        const index = lines.findIndex(line => regex.test(line));
        if (index === -1) {
            return extractInlineField(lines, fieldName);
        }

        const match = lines[index].match(regex);
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
        for (const line of lines) {
            if (new RegExp(`^${escapeRegex(fieldName)}\\s*:`, 'i').test(line)) {
                continue;
            }
            const match = line.match(regex);
            if (!match) continue;
            const value = normalizeText(stripEmbeddedFields(match[1]));
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
        const nameElement = item.querySelector('[class*="styles_itemName"]');
        return nameElement
            ? normalizeText(nameElement.textContent)
            : null;
    }

    function extractItemLink(item) {
        const links = [...item.querySelectorAll('a[href]')];
        const match = links.find(link => {
            try {
                const path = new URL(link.href, location.origin).pathname;
                return /\/(equipment|magic-items)\//i.test(path);
            } catch {
                return false;
            }
        });
        return match || null;
    }

    function extractDdbUrl(item) {
        const link = extractItemLink(item);
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

    function sourceBook(source) {
        if (!source) return 'D&D Beyond';
        return source
            .replace(/,\s*(?:p|pp|pg)\.?\s*\d+(?:\s*[-–]\s*\d+)?\s*$/i, '')
            .trim() || 'D&D Beyond';
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

    function isRarityWord(value) {
        return new RegExp(`^(?:${RARITY_WORDS})$`, 'i').test(value || '');
    }

    function looksLikeSubtitle(line) {
        const text = normalizeText(line);
        if (!text || text.length > 120) return false;
        return new RegExp(
            `^(?:${SUBTITLE_KINDS})` +
            `(?:\\s*\\((?!(?:${RARITY_WORDS})\\b)[^)]+\\))?` +
            `\\s*,\\s*(?:${RARITY_WORDS})\\b`,
            'i'
        ).test(text);
    }

    function subtitleFromDom(item) {
        const selectors = [
            '[class*="itemSnippet"]',
            '[class*="ItemSnippet"]',
            '[class*="itemType"]',
            '[class*="styles_type"]',
            '[class*="styles_subtitle"]'
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
            if (
                isKnownField(line) ||
                isStopLine(line) ||
                /^Source\s*:/i.test(line)
            ) {
                break;
            }
            header.push(line);
            if (header.length >= 12) break;
        }
        return header;
    }

    function synthesizeSubtitle(item, metadata) {
        const rarity = rarityFromClasses(item);
        if (!rarity) return null;
        const rarityLower = rarity.toLowerCase();
        const kind = metadata.find(meta =>
            new RegExp(`^(?:${SUBTITLE_KINDS})$`, 'i').test(meta)
        );
        if (kind) return `${kind}, ${rarityLower}`;
        if (!metadata.length) return null;
        const specific = metadata[metadata.length - 1];
        if (metadataMatches(metadata, WEAPON_TYPES)) {
            return `Weapon (${specific.toLowerCase()}), ${rarityLower}`;
        }
        if (metadataMatches(metadata, ARMOR_TERMS)) {
            return `Armor (${specific.toLowerCase()}), ${rarityLower}`;
        }
        return `${specific}, ${rarityLower}`;
    }

    function extractSubtitle(item, lines, metadata) {
        const fromDom = subtitleFromDom(item);
        if (fromDom) return fromDom;
        const fromHeader = headerDetailLines(lines).find(looksLikeSubtitle);
        if (fromHeader) return fromHeader;
        return synthesizeSubtitle(item, metadata);
    }

    function rarityFromClasses(item) {
        const nameElement = item.querySelector('[class*="styles_itemName"]');
        if (!nameElement) return null;
        const classes = [...nameElement.classList].join(' ').toLowerCase();
        if (classes.includes('veryrare')) return 'Very Rare';
        if (classes.includes('legendary')) return 'Legendary';
        if (classes.includes('artifact')) return 'Artifact';
        if (classes.includes('uncommon')) return 'Uncommon';
        if (classes.includes('common')) return 'Common';
        if (classes.includes('rare')) return 'Rare';
        return null;
    }

    function extractRarity(item, subtitle) {
        if (subtitle) {
            const match = subtitle.match(
                /\b(artifact|legendary|very rare|uncommon|common|varies|rare)\b/i
            );
            if (match) {
                const map = {
                    common: 'Common',
                    uncommon: 'Uncommon',
                    rare: 'Rare',
                    'very rare': 'Very Rare',
                    legendary: 'Legendary',
                    artifact: 'Artifact',
                    varies: 'Varies'
                };
                return map[match[1].toLowerCase()] || match[1];
            }
        }
        return rarityFromClasses(item);
    }

    function titleCase(value) {
        return value.replace(/\b\w/g, c => c.toUpperCase());
    }

    function extractSpecificType(subtitle, metadata) {
        if (subtitle) {
            const parentheses = subtitle.match(/\(([^)]+)\)/);
            if (parentheses) {
                let value = normalizeText(parentheses[1]) || '';
                value = value.replace(/requires attunement.*$/i, '').trim();
                if (value && !isRarityWord(value)) {
                    return titleCase(value);
                }
            }
        }
        if (!metadata.length) return null;
        const candidate = metadata[metadata.length - 1];
        if (candidate && candidate.toLowerCase() !== 'gear') return candidate;
        return metadata[0] || null;
    }

    function metadataMatches(metadata, terms) {
        return metadata.some(meta => {
            const value = meta.toLowerCase();
            return terms.some(term =>
                value === term || value.includes(term)
            );
        });
    }

    function extractCategory(subtitle, metadata) {
        const value = (subtitle || '').toLowerCase();
        const fromSubtitle = [
            [/^weapon\b/, 'Weapon'],
            [/^armor\b/, 'Armor'],
            [/^wondrous item\b/, 'Wondrous Item'],
            [/^potion\b/, 'Potion'],
            [/^ring\b/, 'Ring'],
            [/^rod\b/, 'Rod'],
            [/^scroll\b/, 'Scroll'],
            [/^staff\b/, 'Staff'],
            [/^wand\b/, 'Wand'],
            [/^adventuring gear\b/, 'Adventuring Gear']
        ];
        for (const [pattern, category] of fromSubtitle) {
            if (pattern.test(value)) return category;
        }

        const combined = metadata.join(' ').toLowerCase();
        if (combined.includes('wondrous item')) return 'Wondrous Item';

        const exact = {
            potion: 'Potion',
            ring: 'Ring',
            rod: 'Rod',
            scroll: 'Scroll',
            staff: 'Staff',
            wand: 'Wand',
            gear: 'Adventuring Gear'
        };
        for (const [key, category] of Object.entries(exact)) {
            if (metadata.some(v => v.toLowerCase() === key)) return category;
        }

        if (metadataMatches(metadata, WEAPON_TYPES)) return 'Weapon';
        if (metadataMatches(metadata, ARMOR_TERMS)) return 'Armor';
        return metadata[0] || 'Other';
    }

    function extractAttunement(subtitle) {
        if (!subtitle) return false;
        return /requires attunement/i.test(subtitle);
    }

    function extractAttunementText(subtitle) {
        if (!subtitle || !/requires attunement/i.test(subtitle)) return null;
        const paren = subtitle.match(/\((requires attunement[^)]*)\)/i);
        if (paren) return normalizeText(paren[1]);
        const open = subtitle.match(/requires attunement.*$/i);
        return open ? normalizeText(open[0].replace(/[).]+$/, '')) : null;
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
        const sourceIndex = lines.findIndex(line => /^Source\s*:/i.test(line));
        let start;

        if (sourceIndex !== -1) {
            const inline = stripEmbeddedFields(
                (lines[sourceIndex].match(/^Source\s*:\s*(.*)$/i) || [])[1]
                    ?.trim() || ''
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

    function extractTags(item) {
        const lines = getLines(item);
        const tagsIndex = lines.findIndex(line => /^TAGS:?$/i.test(line));
        if (tagsIndex === -1) return [];

        const tags = [];
        for (let i = tagsIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (isStopLine(line)) break;
            if (line && !/^[+-]?\d+$/.test(line)) tags.push(line);
        }
        return [...new Set(tags)];
    }

    function hasDetailBody(item) {
        const lines = getLines(item);
        return lines.some(line =>
            isKnownField(line) || /^TAGS:?$/i.test(line)
        );
    }

    function extractItem(item) {
        const rawLines = getRawLines(item);
        const lines = rawLines.filter(Boolean);
        const name = extractName(item);
        const metadata = extractHeaderMetadata(item);
        const subtitle = extractSubtitle(item, lines, metadata);
        const rarity = extractRarity(item, subtitle);
        const category = extractCategory(subtitle, metadata);
        const type = extractSpecificType(subtitle, metadata);
        let source = extractField(rawLines, 'Source');
        let description = extractDescription(item);
        const peeled = peelSourceFromDescription(source, description);
        source = peeled.source;
        description = peeled.description;
        const ddbUrl = extractDdbUrl(item);

        return {
            id: extractId(ddbUrl, name, source),
            name,
            category,
            type,
            rarity,
            requiresAttunement: extractAttunement(subtitle),
            attunement: extractAttunementText(subtitle),
            source,
            cost: extractField(rawLines, 'Cost'),
            weight: extractField(rawLines, 'Weight'),
            characterProficient: extractField(rawLines, 'Proficient'),
            attackType: extractField(rawLines, 'Attack Type'),
            range: extractField(rawLines, 'Range') ||
                extractField(rawLines, 'Reach'),
            damage: extractField(rawLines, 'Damage'),
            damageType: extractField(rawLines, 'Damage Type'),
            properties: extractField(rawLines, 'Properties'),
            tags: extractTags(item),
            description,
            ddbUrl,
            ddbMetadata: metadata,
            ddbSubtitle: subtitle
        };
    }

    // ------------------------------------------------------------
    // LOOT FORGE MAPPING
    // ------------------------------------------------------------

    function parseCostToGp(cost) {
        if (!cost) return 0;
        const text = String(cost).toLowerCase().replace(/,/g, '');
        let total = 0;
        const matchAll = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(pp|gp|ep|sp|cp)/g)];
        if (!matchAll.length) {
            const bare = text.match(/(\d+(?:\.\d+)?)/);
            return bare ? Number(bare[1]) : 0;
        }
        const rates = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 };
        for (const match of matchAll) {
            total += Number(match[1]) * rates[match[2]];
        }
        return Math.round(total * 100) / 100;
    }

    function mapLootCategory(category) {
        if (LOOT_CATEGORIES.includes(category)) return category;
        const lower = String(category || '').toLowerCase();
        if (lower === 'rod' || lower === 'staff' || lower === 'wand' ||
            lower === 'scroll') {
            return 'Wondrous Item';
        }
        if (lower === 'gear' || lower === 'other') return 'Adventuring Gear';
        return 'Wondrous Item';
    }

    function mapLootRarity(raw, category) {
        if (raw === 'Artifact') {
            return { rarity: 'Legendary', originalRarity: 'Artifact' };
        }
        if (raw && RARITY_TO_TIER[raw] != null) {
            return { rarity: raw, originalRarity: null };
        }
        if (!raw && (category === 'Adventuring Gear' || category === 'Gear')) {
            return { rarity: 'Mundane', originalRarity: null };
        }
        return { rarity: raw ? 'Unknown' : 'Mundane', originalRarity: raw || null };
    }

    function typeProperty(item) {
        if (item.category && item.type) {
            const type = String(item.type);
            const cat = String(item.category).toLowerCase();
            if (type.toLowerCase() === cat) return type;
            return `${item.category} (${type})`;
        }
        return item.type || item.category || null;
    }

    function toLootForgeItem(item) {
        const mapped = mapLootRarity(item.rarity, item.category);
        const category = mapLootCategory(item.category);
        const value = parseCostToGp(item.cost);
        const properties = [];
        const typeProp = typeProperty(item);
        const plainTypes = {
            'wondrous item': true,
            ring: true,
            potion: true
        };
        if (typeProp && !plainTypes[String(typeProp).toLowerCase()]) {
            properties.push(typeProp);
        }
        if (item.damage) {
            const dmg = item.damageType
                ? `${item.damage} ${item.damageType}`
                : item.damage;
            properties.push(item.range ? `${dmg}, ${item.range}` : dmg);
        } else if (item.range) {
            properties.push(item.range);
        }
        if (item.properties) properties.push(item.properties);
        if (item.source) properties.push(item.source);
        if (mapped.originalRarity) {
            properties.push(`Original rarity: ${mapped.originalRarity}`);
        }

        const row = {
            name: item.name,
            rarity: mapped.rarity,
            category,
            value,
            tier: RARITY_TO_TIER[mapped.rarity] ?? 0,
            description: item.description || '',
            author: sourceBook(item.source)
        };

        if (item.cost) row.value_raw = item.cost;
        else if (value > 0) row.value_raw = `${value} gp`;
        if (item.weight) row.weight = item.weight;
        if (item.attunement) row.requirements = item.attunement;
        else if (item.requiresAttunement) row.requirements = 'requires attunement';
        if (properties.length) row.properties = properties;

        return row;
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

    async function loadAllItems() {
        if (loading || exporting) return;
        loading = true;
        aborted = false;
        setBusy(true, 'load');

        try {
            let previousCount = getItemCount();
            let stallClicks = 0;

            while (true) {
                throwIfAborted();
                let state = loadMoreState();

                if (state.status === 'disabled') {
                    setLoadLabel(`Loading... ${getItemCount()} items`);
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

                setLoadLabel(`Loading... ${getItemCount()} items`);
                console.log(`DDB Exporter: ${getItemCount()} items loaded`);
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
                        'DDB Exporter: Load More stalled; stopping pagination.'
                    );
                    break;
                }
            }

            const total = getItemCount();
            setLoadLabel(`✓ ${total} ITEMS LOADED`);
            console.log(`DDB Exporter: Finished. ${total} items loaded.`);
        } catch (error) {
            if (isAbortError(error)) {
                setLoadLabel(`Aborted · ${getItemCount()} items`);
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
                throw new Error('Item node disappeared');
            }
            if (!isCollapsed(item) || hasDetailBody(item)) {
                return item;
            }
            if (attempt > 1) {
                console.log(
                    `DDB Exporter: Retry ${attempt}/3 expanding ${visibleName}`
                );
                await sleep(300);
            }
            item.scrollIntoView({ block: 'center', behavior: 'auto' });
            await sleep(150);
            const current = getItemAt(index) || item;
            const header = getHeader(current);
            if (!header) {
                if (attempt === 3) {
                    throw new Error('Could not find item header');
                }
                continue;
            }
            header.click();
            const expanded = await waitForExpanded(getItemAt(index) || current);
            if (expanded) return getItemAt(index) || current;
        }
        throw new Error('Timed out expanding item');
    }

    async function exportItems() {
        if (loading || exporting) return;

        if (loadMoreState().status === 'enabled') {
            alert(
                'There are still more items available. Click LOAD ALL DDB ITEMS first.'
            );
            return;
        }

        const total = getItemCount();
        if (!total) {
            alert('No D&D Beyond items were found.');
            return;
        }

        exporting = true;
        aborted = false;
        setBusy(true, 'export');

        const results = [];
        const errors = [];

        try {
            for (let i = 0; i < getItemCount(); i++) {
                throwIfAborted();
                const item = getItemAt(i);
                if (!item) {
                    errors.push({
                        name: `Item ${i + 1}`,
                        error: 'Item node disappeared'
                    });
                    continue;
                }

                const visibleName = extractName(item) || `Item ${i + 1}`;
                setExportLabel(`Exporting ${i + 1}/${getItemCount()}`);
                console.log(
                    `DDB Exporter: ${i + 1}/${getItemCount()} - ${visibleName}`
                );

                try {
                    await expandItemAt(i, visibleName);
                    const data = extractItem(getItemAt(i) || item);
                    results.push(data);
                    console.log('Extracted:', data);
                } catch (error) {
                    if (isAbortError(error)) throw error;
                    console.error(
                        `DDB Exporter failed on ${visibleName}:`,
                        error
                    );
                    errors.push({
                        name: visibleName,
                        error: error?.message || String(error)
                    });
                }

                await sleep(100);
            }

            downloadExports(results, errors);

            setExportLabel(`✓ EXPORTED ${results.length} ITEMS`);
            console.log(
                `DDB Exporter: Export complete. ` +
                `${results.length} items, ${errors.length} errors.`
            );
        } catch (error) {
            if (isAbortError(error)) {
                if (results.length) downloadExports(results, errors);
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

    function downloadExports(results, errors) {
        const date = new Date().toISOString().slice(0, 10);
        const lootItems = [];
        const lootForgeSkipped = [];
        for (const item of results) {
            if (item.rarity === 'Varies') {
                lootForgeSkipped.push({
                    name: item.name,
                    rarity: 'Varies',
                    reason: 'no fixed rarity'
                });
                continue;
            }
            lootItems.push(toLootForgeItem(item));
        }
        if (lootForgeSkipped.length) {
            console.warn(
                `DDB Exporter: Skipped ${lootForgeSkipped.length} ` +
                `Loot Forge item(s) with no fixed rarity.`,
                lootForgeSkipped
            );
        }
        downloadJSON(
            {
                metadata: {
                    source: 'D&D Beyond Equipment Shop',
                    scriptVersion: SCRIPT_VERSION,
                    exportedAt: new Date().toISOString(),
                    pageUrl: location.href,
                    itemCount: results.length,
                    errorCount: errors.length,
                    lootForgeSkippedCount: lootForgeSkipped.length,
                    lootForgeSkipped
                },
                items: results,
                errors
            },
            `ddb-loot-pool-${date}.json`
        );
        downloadJSON(
            { items: lootItems, skipped: lootForgeSkipped },
            `ddb-loot-forge-${date}.json`
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
            right: '20px',
            zIndex: '999999',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        });

        const loadButton = makeButton('LOAD ALL DDB ITEMS', '#b7282e');
        const exportButton = makeButton('EXPORT FULL ITEMS', '#246b39');
        const abortButton = makeButton('ABORT', '#444');
        abortButton.style.display = 'none';

        loadButton.addEventListener('click', () => {
            loadAllItems().catch(error => console.error(error));
        });
        exportButton.addEventListener('click', () => {
            exportItems().catch(error => console.error(error));
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
        clearTimeout(observerTimer);
        observerTimer = setTimeout(() => {
            createControls();
            removeControlsIfNeeded();
        }, 250);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    createControls();
    console.log(`DDB Loot Pool Exporter v${SCRIPT_VERSION} ready.`);
})();
