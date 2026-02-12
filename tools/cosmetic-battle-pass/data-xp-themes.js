// D&D Cosmetic Battle Pass – XP table, sub-tier thresholds, themes (plan §3, §4)

(function (global) {
    'use strict';

    // 5e XP table: XP required to reach that level (PHB)
    const XP_TABLE = [
        0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
        85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
    ];

    function getLevelFromXp(xp) {
        let level = 1;
        for (let i = XP_TABLE.length - 1; i >= 1; i--) {
            if (xp >= XP_TABLE[i]) return i + 1;
        }
        return level;
    }

    function getSubTierThresholds(level) {
        if (level < 1 || level > 20) return [];
        const start = XP_TABLE[level - 1];
        const end = level === 20 ? 355000 : XP_TABLE[level];
        const delta = end - start;
        const tiers = [
            { tier: 0, xp: start },
            { tier: 1, xp: start + Math.floor(delta * 0.25) },
            { tier: 2, xp: start + Math.floor(delta * 0.5) },
            { tier: 3, xp: start + Math.floor(delta * 0.75) }
        ];
        if (level === 20) tiers.push({ tier: 4, xp: 355000 });
        return tiers;
    }

    function getAllUnlockedSubTiers(xp) {
        const level = getLevelFromXp(xp);
        const out = [];
        for (let L = 1; L <= level; L++) {
            const thresh = getSubTierThresholds(L);
            for (const t of thresh) {
                if (xp >= t.xp) out.push({ level: L, tier: t.tier, xpThreshold: t.xp });
            }
        }
        if (level < 20) {
            const next = getSubTierThresholds(level);
            const firstNotReached = next.find(t => xp < t.xp);
            if (firstNotReached) {
                out._nextUnlock = { level, tier: firstNotReached.tier, xp: firstNotReached.xp, need: firstNotReached.xp - xp };
            }
        } else if (xp < 355000) {
            out._nextUnlock = { level: 20, tier: 4, xp: 355000, need: 355000 - xp };
        }
        return out;
    }

    // Themes: Cotton → Gold (level 1–20), Diamond (level 20 tier 4 only)
    const THEME_NAMES = [
        'Cotton', 'Wool', 'Lace', 'Leather', 'Silk', 'Wood', 'Pottery', 'Tin', 'Bronze', 'Iron',
        'Steel', 'Porcelain', 'Crystal', 'Silver', 'Pearl', 'Coral', 'Ruby', 'Sapphire', 'Gold', 'Diamond'
    ];

    function getThemeForLevelTier(level, tier) {
        if (level === 20 && tier === 4) return THEME_NAMES[19]; // Diamond
        const index = Math.min(level - 1, 19);
        return THEME_NAMES[index];
    }

    const THEMES = {
        Cotton:  { application: ['wrap', 'grip', 'trim'], effect: ['comfort', 'soft touch', 'warmth'] },
        Wool:    { application: ['lining', 'padding', 'insulation'], effect: ['warmth', 'comfort', 'durability'] },
        Lace:    { application: ['trim', 'edging', 'overlay'], effect: ['elegance', 'delicacy', 'detail'] },
        Leather: { application: ['wrapping', 'stitching', 'padding', 'reinforcement'], effect: ['durability', 'grip', 'wear resistance'] },
        Silk:    { application: ['overlay', 'lining', 'trim'], effect: ['smooth finish', 'elegance', 'sheen'] },
        Wood:    { application: ['haft', 'shaft', 'reinforcement', 'inlay'], effect: ['balance', 'sturdiness', 'warmth'] },
        Pottery: { application: ['accents', 'pommel', 'guard', 'inlay'], effect: ['unique look', 'weight', 'craft'] },
        Tin:     { application: ['plating', 'edging', 'rivets'], effect: ['shine', 'protection', 'simple strength'] },
        Bronze:  { application: ['edging', 'ferrule', 'cap', 'studs'], effect: ['alloy gleam', 'durability', 'classic look'] },
        Iron:    { application: ['core', 'reinforcement', 'banding'], effect: ['strength', 'weight', 'reliability'] },
        Steel:   { application: ['full upgrade', 'edging', 'core'], effect: ['superior strength', 'edge retention', 'professional look'] },
        Porcelain: { application: ['etched details', 'inlay', 'accents'], effect: ['fine detail', 'elegance', 'fragile beauty'] },
        Crystal: { application: ['inlays', 'pommel', 'focus'], effect: ['soft glow', 'pulsing light', 'radiant flare'] },
        Silver:  { application: ['overlay', 'edging', 'embellishment'], effect: ['precious sheen', 'holy resonance', 'elegance'] },
        Pearl:   { application: ['embeds', 'inlay', 'accents'], effect: ['iridescence', 'calm glow', 'refinement'] },
        Coral:   { application: ['motifs', 'inlay', 'carving'], effect: ['exotic look', 'organic flow', 'sea-touched'] },
        Ruby:    { application: ['infusion', 'setting', 'veins'], effect: ['fiery glint', 'warmth', 'passion'] },
        Sapphire:{ application: ['infusion', 'setting', 'veins'], effect: ['deep blue glow', 'cool power', 'clarity'] },
        Gold:    { application: ['plating', 'embellishment', 'full trim'], effect: ['royal brilliance', 'prestige', 'wealth'] },
        Diamond: { application: ['brilliance', 'unbreakable inlay', 'ultimate trim'], effect: ['ultimate brilliance', 'unbreakable', 'legendary'] }
    };

    global.BattlePassData = {
        XP_TABLE,
        getLevelFromXp,
        getSubTierThresholds,
        getAllUnlockedSubTiers,
        THEME_NAMES,
        getThemeForLevelTier,
        THEMES
    };
})(typeof window !== 'undefined' ? window : this);
