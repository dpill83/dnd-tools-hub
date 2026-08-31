// ==UserScript==
// @name         DDB My Inventory Exporter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Exports D&D Beyond My Inventory (all bags) as a rich snapshot plus a Loot Forge import file.
// @match        https://www.dndbeyond.com/characters/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_VERSION = '1.0';
    const CONTROLS_ID = 'ddb-my-inventory-exporter-controls';

    const SUBTITLE_KINDS =
        'weapon|armor|wondrous item|potion|ring|rod|scroll|staff|wand|adventuring gear|gear';
    const RARITY_WORDS =
        'artifact|legendary|very rare|uncommon|common|varies|rare';

    const STOP_LINES = [
        /^TAGS:?$/i,
        /^MOVE$/i,
        /^DELETE$/i,
        /^REMOVE$/i,
        /^UNEQUIP$/i,
        /^EQUIP$/i,
        /^Amount to add$/i,
        /^ADD ITEM$/i
    ];

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

    function titleCase(value) {
        return String(value || '').replace(/\b\w/g, c => c.toUpperCase());
    }

    function stripCountSuffix(heading) {
        return normalizeText(
            String(heading || '').replace(/\s*\(\d+\)\s*$/, '')
        );
    }

    // ------------------------------------------------------------
    // PANE / GROUPS / ITEMS
    // ------------------------------------------------------------

    function getPane() {
        return document.querySelector('.ct-equipment-manage-pane');
    }

    function findMyInventoryHeading(pane) {
        if (!pane) return null;
        return [...pane.querySelectorAll('h2.ct-sidebar__subheading, h2')]
            .find(el => /^My Inventory$/i.test(normalizeText(el.textContent) || '')) ||
            null;
    }

    function hasMyInventory() {
        return Boolean(findMyInventoryHeading(getPane()));
    }

    function getMyInventoryNodes() {
        const pane = getPane();
        const heading = findMyInventoryHeading(pane);
        if (!pane || !heading) return [];

        const nodes = [];
        let node = heading.nextElementSibling;
        while (node) {
            if (
                node.matches?.('h2') ||
                node.classList?.contains('ct-sidebar__subheading')
            ) {
                break;
            }
            nodes.push(node);
            node = node.nextElementSibling;
        }
        return nodes;
    }

    function getGroupCollapsibles() {
        return getMyInventoryNodes().filter(el =>
            el.classList?.contains('ddbc-collapsible')
        );
    }

    function getGroupHeading(group) {
        const el = group.querySelector(
            ':scope > .ddbc-collapsible__header .ddbc-collapsible__heading'
        );
        return normalizeText(el?.textContent);
    }

    function getGroupName(group) {
        return stripCountSuffix(getGroupHeading(group));
    }

    function groupItemCount(group) {
        const heading = getGroupHeading(group) || '';
        const match = heading.match(/\((\d+)\)\s*$/);
        return match ? Number(match[1]) : null;
    }

    function isCollapsed(el) {
        return el.classList.contains('ddbc-collapsible--collapsed');
    }

    function getChevron(el) {
        return el.querySelector(
            ':scope > .ddbc-collapsible__header .ddbc-collapsible__header-status'
        ) || el.querySelector('.ddbc-collapsible__header-status');
    }

    function isContainerItem(item) {
        return item.classList.contains('ct-equipment-manage-pane__item--is-container');
    }

    function getItemEntries() {
        const entries = [];
        for (const group of getGroupCollapsibles()) {
            const groupName = getGroupName(group);
            const inventory = group.querySelector(
                ':scope > .ddbc-collapsible__content .ct-equipment-manage-pane__inventory'
            ) || group.querySelector('.ct-equipment-manage-pane__inventory');
            if (!inventory) continue;

            for (const item of inventory.querySelectorAll(
                ':scope > .ct-equipment-manage-pane__item'
            )) {
                entries.push({
                    node: item,
                    groupName,
                    isContainer: isContainerItem(item)
                });
            }
        }
        return entries;
    }

    function getItemAt(index) {
        return getItemEntries()[index] || null;
    }

    // ------------------------------------------------------------
    // OPEN GROUPS / EXPAND ITEMS
    // ------------------------------------------------------------

    async function waitUntil(predicate, timeout = 4000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            throwIfAborted();
            if (predicate()) {
                await sleep(100);
                return true;
            }
            await sleep(50);
        }
        return false;
    }

    async function openCollapsedGroups() {
        for (const group of getGroupCollapsibles()) {
            throwIfAborted();
            if (!isCollapsed(group)) continue;

            const count = groupItemCount(group);
            const chevron = getChevron(group);
            if (!chevron) continue;

            group.scrollIntoView({ block: 'center', behavior: 'auto' });
            await sleep(100);
            chevron.click();

            await waitUntil(() => {
                if (!isCollapsed(group)) return true;
                if (count === 0) return true;
                return Boolean(
                    group.querySelector('.ct-equipment-manage-pane__inventory')
                );
            });
            await sleep(150);
        }
    }

    function hasDetailBody(item) {
        if (item.querySelector('.ct-item-detail')) return true;
        const text = item.innerText || '';
        return /Weight|Source|Capacity|Tags|Damage|Cost/i.test(text);
    }

    async function expandItemNode(item, visibleName) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            throwIfAborted();
            if (!isCollapsed(item) || hasDetailBody(item)) {
                return item;
            }
            if (attempt > 1) {
                console.log(
                    `DDB My Inventory: Retry ${attempt}/3 expanding ${visibleName}`
                );
                await sleep(300);
            }
            item.scrollIntoView({ block: 'center', behavior: 'auto' });
            await sleep(100);
            const chevron = getChevron(item);
            if (!chevron) {
                if (attempt === 3) {
                    throw new Error('Could not find item chevron');
                }
                continue;
            }
            chevron.click();
            const ok = await waitUntil(
                () => !isCollapsed(item) || hasDetailBody(item)
            );
            if (ok) return item;
        }
        throw new Error('Timed out expanding item');
    }

    // ------------------------------------------------------------
    // DETAIL PARSING
    // ------------------------------------------------------------

    function emptyValue(value) {
        return !value || value === '--' || value === '—';
    }

    function isRarityWord(value) {
        return new RegExp(`^(?:${RARITY_WORDS})$`, 'i').test(value || '');
    }

    function rarityFromClasses(el) {
        if (!el) return null;
        const classes = [...el.classList].join(' ').toLowerCase();
        if (classes.includes('veryrare')) return 'Very Rare';
        if (classes.includes('legendary')) return 'Legendary';
        if (classes.includes('artifact')) return 'Artifact';
        if (classes.includes('uncommon')) return 'Uncommon';
        if (classes.includes('common')) return 'Common';
        if (classes.includes('rare')) return 'Rare';
        return null;
    }

    function rarityFromText(text) {
        if (!text) return null;
        const match = text.match(
            /\b(artifact|legendary|very rare|uncommon|common|varies|rare)\b/i
        );
        if (!match) return null;
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

    function extractNameFromDom(item) {
        const nameEl = item.querySelector('[class*="styles_itemName"]');
        if (!nameEl) return null;
        const clone = nameEl.cloneNode(true);
        clone.querySelectorAll(
            '[class*="styles_legacy"], [class*="styles_asterisk"], ' +
            '[class*="styles_icon"], .ddbc-attunement-icon, .Tooltip_container__GbuSP'
        ).forEach(el => el.remove());
        return normalizeText(clone.textContent);
    }

    function extractItemLink(item) {
        const links = [...item.querySelectorAll('a[href]')];
        return links.find(link => {
            try {
                const path = new URL(link.href, location.origin).pathname;
                return /\/(equipment|magic-items)\//i.test(path);
            } catch {
                return false;
            }
        }) || null;
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

    function getCustomizeValue(detail, label) {
        if (!detail) return null;
        const items = [...detail.querySelectorAll('[role="listitem"], [class*="styles_item"]')];
        for (const row of items) {
            const labelEl = row.querySelector('[class*="styles_label"]');
            const valueEl = row.querySelector('[class*="styles_value"]');
            const labelText = normalizeText(labelEl?.textContent);
            if (!labelText) continue;
            if (new RegExp(`^${escapeRegex(label)}:?$`, 'i').test(labelText)) {
                const value = normalizeText(valueEl?.textContent);
                return emptyValue(value) ? null : value;
            }
        }
        return null;
    }

    function extractDetailTags(detail) {
        if (!detail) return [];
        const tags = [...detail.querySelectorAll(
            '[class*="styles_tagGroup"] [class*="styles_tag"], ' +
            '[class*="tagGroup"] [class*="tag"]'
        )]
            .map(el => normalizeText(el.textContent))
            .filter(Boolean)
            .filter(t => !/^tags:?$/i.test(t));
        return [...new Set(tags)];
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

    function metadataMatches(metadata, terms) {
        return metadata.some(meta => {
            const value = meta.toLowerCase();
            return terms.some(term => value === term || value.includes(term));
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
        if (combined.includes('container')) return 'Adventuring Gear';

        const exact = {
            potion: 'Potion',
            ring: 'Ring',
            rod: 'Rod',
            scroll: 'Scroll',
            staff: 'Staff',
            wand: 'Wand',
            gear: 'Adventuring Gear',
            container: 'Adventuring Gear'
        };
        for (const [key, category] of Object.entries(exact)) {
            if (metadata.some(v => v.toLowerCase() === key)) return category;
        }

        if (metadataMatches(metadata, WEAPON_TYPES)) return 'Weapon';
        if (metadataMatches(metadata, ARMOR_TERMS)) return 'Armor';
        return metadata[0] || 'Other';
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
        if (candidate && !/^(gear|container)$/i.test(candidate)) return candidate;
        return metadata[0] || null;
    }

    function extractAttunement(subtitle) {
        return /requires attunement/i.test(subtitle || '');
    }

    function extractAttunementText(subtitle) {
        if (!subtitle || !/requires attunement/i.test(subtitle)) return null;
        const paren = subtitle.match(/\((requires attunement[^)]*)\)/i);
        if (paren) return normalizeText(paren[1]);
        const open = subtitle.match(/requires attunement.*$/i);
        return open ? normalizeText(open[0].replace(/[).]+$/, '')) : null;
    }

    function isEquipped(item, detail) {
        if (item.querySelector('.ct-slot-manager__slot--used')) return true;
        const subtitle = normalizeText(
            detail?.querySelector('.ct-item-detail__intro-subtitle')?.textContent
        );
        return /equipped/i.test(subtitle || '');
    }

    function isAttuned(item) {
        return Boolean(item.querySelector('.ddbc-attunement-icon'));
    }

    function isCustomized(item) {
        return Boolean(
            item.querySelector('[class*="styles_asterisk"]') ||
            item.querySelector('[data-tooltip-content*="Customized"]')
        );
    }

    function parseIntro(introText) {
        const text = normalizeText(introText);
        if (!text) {
            return { subtitle: null, rarity: null, metadata: [] };
        }
        const rarity = rarityFromText(text);
        const metadata = text
            .split(',')
            .map(part => normalizeText(part))
            .filter(Boolean);
        return {
            subtitle: looksLikeSubtitle(text) ? text : text,
            rarity,
            metadata
        };
    }

    function extractItem(entry) {
        const { node: item, groupName, isContainer } = entry;
        const detail = item.querySelector('.ct-item-detail');

        const name = isContainer
            ? groupName
            : extractNameFromDom(item);

        const introText = normalizeText(
            detail?.querySelector('.ct-item-detail__intro')?.textContent
        );
        const parsedIntro = parseIntro(introText);

        const nameEl = item.querySelector('[class*="styles_itemName"]');
        const rarity =
            parsedIntro.rarity ||
            rarityFromClasses(nameEl) ||
            rarityFromText(introText);

        const subtitle = parsedIntro.subtitle;
        const metadata = parsedIntro.metadata.length
            ? parsedIntro.metadata
            : [];

        const category = extractCategory(subtitle, metadata);
        const type = extractSpecificType(subtitle, metadata);

        let source = getCustomizeValue(detail, 'Source');
        let weight = getCustomizeValue(detail, 'Weight');
        let cost = getCustomizeValue(detail, 'Cost');
        const capacity = getCustomizeValue(detail, 'Capacity');

        let description = normalizeText(
            detail?.querySelector('.ct-item-detail__description')?.textContent
        );
        if (description) {
            description = description.replace(/\n{3,}/g, '\n\n').trim();
        }

        const tags = extractDetailTags(detail);
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
            cost,
            weight,
            capacity: capacity || null,
            properties: null,
            tags,
            description,
            ddbUrl,
            ddbSubtitle: subtitle,
            ddbMetadata: metadata,
            container: isContainer ? null : groupName,
            isContainer,
            equipped: isEquipped(item, detail),
            attuned: isAttuned(item),
            customized: isCustomized(item)
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
        if (lower === 'gear' || lower === 'other' || lower === 'container') {
            return 'Adventuring Gear';
        }
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
        if (item.isContainer) properties.push('Container');
        if (item.capacity) properties.push(`Capacity: ${item.capacity}`);
        if (item.container) properties.push(`In: ${item.container}`);
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
    // EXPORT
    // ------------------------------------------------------------

    async function exportInventory() {
        if (exporting) return;
        if (!hasMyInventory()) {
            alert('Open Manage Inventory so My Inventory is visible.');
            return;
        }

        exporting = true;
        aborted = false;
        setBusy(true);

        const results = [];
        const errors = [];

        try {
            setExportLabel('Opening bags...');
            await openCollapsedGroups();

            let entries = getItemEntries();
            if (!entries.length) {
                alert('No My Inventory items were found.');
                return;
            }

            for (let i = 0; i < entries.length; i++) {
                throwIfAborted();
                entries = getItemEntries();
                const entry = entries[i];
                if (!entry) {
                    errors.push({
                        name: `Item ${i + 1}`,
                        error: 'Item node disappeared'
                    });
                    continue;
                }

                const visibleName = entry.isContainer
                    ? entry.groupName || 'Container'
                    : extractNameFromDom(entry.node) ||
                        entry.groupName ||
                        `Item ${i + 1}`;

                setExportLabel(`Exporting ${i + 1}/${entries.length}`);
                console.log(
                    `DDB My Inventory: ${i + 1}/${entries.length} - ${visibleName}`
                );

                try {
                    await expandItemNode(entry.node, visibleName);
                    const fresh = getItemEntries()[i] || entry;
                    const data = extractItem(fresh);
                    results.push(data);
                    console.log('Extracted:', data);
                } catch (error) {
                    if (isAbortError(error)) throw error;
                    console.error(
                        `DDB My Inventory failed on ${visibleName}:`,
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
                `DDB My Inventory: Export complete. ` +
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
                `DDB My Inventory: Skipped ${lootForgeSkipped.length} ` +
                `Loot Forge item(s) with no fixed rarity.`,
                lootForgeSkipped
            );
        }
        downloadJSON(
            {
                metadata: {
                    source: 'D&D Beyond My Inventory',
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
            `ddb-my-inventory-${date}.json`
        );
        downloadJSON(
            { items: lootItems, skipped: lootForgeSkipped },
            `ddb-loot-forge-inventory-${date}.json`
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

    function setExportLabel(text) {
        if (ui?.exportButton) ui.exportButton.textContent = text;
    }

    function setBusy(busy) {
        if (!ui) return;
        ui.exportButton.disabled = busy;
        ui.exportButton.style.opacity = '1';
        ui.abortButton.style.display = busy ? 'block' : 'none';
        ui.abortButton.disabled = !busy;
        ui.abortButton.textContent = 'ABORT';
    }

    function createControls() {
        if (!hasMyInventory()) return;
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

        const exportButton = makeButton('EXPORT MY INVENTORY', '#246b39');
        const abortButton = makeButton('ABORT', '#444');
        abortButton.style.display = 'none';

        exportButton.addEventListener('click', () => {
            exportInventory().catch(error => console.error(error));
        });
        abortButton.addEventListener('click', () => {
            aborted = true;
            abortButton.textContent = 'Aborting...';
        });

        container.append(exportButton, abortButton);
        document.body.appendChild(container);
        ui = { exportButton, abortButton };
    }

    function removeControlsIfNeeded() {
        if (hasMyInventory()) return;
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
    console.log(`DDB My Inventory Exporter v${SCRIPT_VERSION} ready.`);
})();
