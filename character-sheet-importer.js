/**
 * Character Sheet Importer - shared D&D 5e character sheet PDF parsing.
 * Requires: PDF.js loaded before this script (global pdfjsLib).
 * Usage: Load PDF.js (and worker), then this script. Call CharacterSheetImporter.extractPdfData(file)
 *        and CharacterSheetImporter.parseFromFields(fieldMap, text) as needed.
 */
(function () {
  'use strict';

  if (typeof pdfjsLib === 'undefined') {
    console.warn('CharacterSheetImporter: pdfjsLib not loaded. Load PDF.js before this script.');
  }

  function findKey(fieldMap, possibleKeys) {
    if (!fieldMap || typeof fieldMap !== 'object' || Object.keys(fieldMap).length === 0) {
      return null;
    }
    if (!Array.isArray(possibleKeys)) {
      possibleKeys = [possibleKeys];
    }
    const fieldKeys = Object.keys(fieldMap);
    for (const key of possibleKeys) {
      const exactMatch = fieldKeys.find(fk => fk.toLowerCase() === key.toLowerCase());
      if (exactMatch) return exactMatch;
    }
    for (const key of possibleKeys) {
      const partialMatch = fieldKeys.find(fk =>
        fk.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(fk.toLowerCase())
      );
      if (partialMatch) return partialMatch;
    }
    for (const key of possibleKeys) {
      const keyWords = key.toLowerCase().split(/\s+/);
      const fuzzyMatch = fieldKeys.find(fk => {
        const fkLower = fk.toLowerCase();
        return keyWords.every(word => fkLower.includes(word));
      });
      if (fuzzyMatch) return fuzzyMatch;
    }
    return null;
  }

  async function extractPdfData(file) {
    try {
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js library not loaded');
      }
      const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    let fullText = '';

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      const normalizedPageText = pageText.replace(/\s+/g, ' ').trim();
      if (fullText && normalizedPageText) fullText += '\n';
      fullText += normalizedPageText;
    }

    const fieldMap = {};
    try {
      if (pdf.getFieldObjects && typeof pdf.getFieldObjects === 'function') {
        const fieldObjects = await pdf.getFieldObjects();
        if (fieldObjects && Array.isArray(fieldObjects)) {
          for (const field of fieldObjects) {
            if (field && field.fieldName && field.fieldValue) {
              const name = String(field.fieldName).trim();
              const value = String(field.fieldValue).trim();
              if (name && value && value !== '' && value !== 'null' && value !== 'undefined') {
                fieldMap[name] = value;
              }
            }
          }
        }
      }
    } catch (e) {
      console.log('getFieldObjects() not available or failed:', e.message);
    }

    try {
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const annotations = await page.getAnnotations();
        if (annotations && Array.isArray(annotations)) {
          for (const annotation of annotations) {
            const fieldName = annotation.fieldName || annotation.T || annotation.FT || annotation.name;
            const fieldValue = annotation.fieldValue || annotation.V || annotation.value || annotation.defaultFieldValue;
            if (fieldName && fieldValue) {
              const name = String(fieldName).trim();
              const value = String(fieldValue).trim();
              if (name && value && value !== '' && value !== 'null' && value !== 'undefined') {
                if (!fieldMap[name] || value.length > fieldMap[name].length) fieldMap[name] = value;
              }
            }
            if (annotation.subtype === 'Widget' && annotation.fieldName) {
              const name = String(annotation.fieldName).trim();
              let value = annotation.fieldValue || annotation.V || annotation.value;
              if (value) {
                value = String(value).trim();
                if (value && value !== '' && value !== 'null' && value !== 'undefined') {
                  if (!fieldMap[name] || value.length > fieldMap[name].length) fieldMap[name] = value;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.log('getAnnotations() extraction failed:', e.message);
    }

      return { text: fullText, fieldMap: fieldMap };
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw new Error('Failed to extract text from PDF: ' + error.message);
    }
  }

  function toTitleCase(str) {
    if (!str || typeof str !== 'string') return str;
    return str.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function parseFromFields(fieldMap, textFallback) {
    const profile = {
      name: '',
      className: '',
      level: 0,
      ac: undefined,
      hpMax: undefined,
      speed: undefined,
      initiativeBonus: undefined,
      spellAttackBonus: undefined,
      spellSaveDC: undefined,
      spellSlots: {},
      cantrips: [],
      spells: [],
      skills: {},
      rawText: textFallback || '',
      rawFields: fieldMap || {},
      abilities: { scores: {}, mods: {} }
    };

    const parseNumeric = (value) => {
      if (!value) return undefined;
      const str = String(value).trim();
      const match = str.match(/([+-]?\d+)/);
      return match ? parseInt(match[1], 10) : undefined;
    };

    const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    const SCORE_VARIANTS = {
      STR: ['STR', 'Strength', 'Strength Score', 'StrengthScore'],
      DEX: ['DEX', 'Dexterity', 'Dexterity Score', 'DexterityScore'],
      CON: ['CON', 'Constitution', 'Constitution Score', 'ConstitutionScore'],
      INT: ['INT', 'Intelligence', 'Intelligence Score', 'IntelligenceScore'],
      WIS: ['WIS', 'Wisdom', 'Wisdom Score', 'WisdomScore'],
      CHA: ['CHA', 'Charisma', 'Charisma Score', 'CharismaScore']
    };
    const MOD_VARIANTS = {
      STR: ['STRmod', 'Strength Mod', 'StrengthMod', 'STR Mod'],
      DEX: ['DEXmod', 'Dexterity Mod', 'DexterityMod', 'DEX Mod'],
      CON: ['CONmod', 'Constitution Mod', 'ConstitutionMod', 'CON Mod'],
      INT: ['INTmod', 'Intelligence Mod', 'IntelligenceMod', 'INT Mod'],
      WIS: ['WISmod', 'Wisdom Mod', 'WisdomMod', 'WIS Mod'],
      CHA: ['CHAmod', 'Charisma Mod', 'CharismaMod', 'CHA Mod']
    };
    const clampScore = (n) => Math.max(0, Math.min(30, Math.floor(Number(n))));
    const clampMod = (n) => Math.max(-5, Math.min(15, Math.floor(Number(n))));
    const abilityModFromScore = (score) => Math.floor((score - 10) / 2);

    const foundScore = {};
    const foundMod = {};
    const tempScore = {};
    const tempMod = {};
    ABILITIES.forEach(function (ab) { foundScore[ab] = false; foundMod[ab] = false; });

    const hasFieldMap = fieldMap && typeof fieldMap === 'object' && Object.keys(fieldMap).length > 0;

    if (hasFieldMap) {
      const nameKey = findKey(fieldMap, ['CharacterName', 'Character Name', 'Name', 'CHARACTER NAME']);
      if (nameKey && fieldMap[nameKey]) {
        profile.name = toTitleCase(String(fieldMap[nameKey]).trim());
      }

      const classLevelKey = findKey(fieldMap, ['CLASS  LEVEL', 'Class Level', 'ClassLevel', 'CLASSLEVEL']);
      if (classLevelKey && fieldMap[classLevelKey]) {
        const classLevelStr = String(fieldMap[classLevelKey]).trim();
        const classLevelMatch = classLevelStr.match(/\b(barbarian|bard|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|warlock|wizard)\s*(\d+)\b/i);
        if (classLevelMatch) {
          profile.className = classLevelMatch[1].charAt(0).toUpperCase() + classLevelMatch[1].slice(1).toLowerCase();
          profile.level = parseInt(classLevelMatch[2], 10);
        }
      }
      if (!profile.className || !profile.level) {
        const classKey = findKey(fieldMap, ['Class', 'ClassName', 'CLASS']);
        const levelKey = findKey(fieldMap, ['Level', 'Character Level', 'CharLevel', 'LEVEL']);
        if (classKey && fieldMap[classKey]) {
          const raw = String(fieldMap[classKey]).trim();
          profile.className = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
        }
        if (levelKey && fieldMap[levelKey]) {
          const n = parseNumeric(fieldMap[levelKey]);
          if (n !== undefined) profile.level = Math.max(1, Math.min(20, n));
        }
      }

      const acKey = findKey(fieldMap, ['ARMOR CLASS', 'AC', 'ArmorClass', 'Armor Class']);
      if (acKey && fieldMap[acKey]) profile.ac = parseNumeric(fieldMap[acKey]);

      const hpMaxKey = findKey(fieldMap, ['Max HP', 'HPMax', 'HP Max', 'MAX HP', 'Hit Points']);
      if (hpMaxKey && fieldMap[hpMaxKey]) {
        const hpValue = String(fieldMap[hpMaxKey]).trim();
        const hpMatch = hpValue.match(/(\d+)\s*\/\s*(\d+)/);
        if (hpMatch) profile.hpMax = parseInt(hpMatch[2], 10);
        else profile.hpMax = parseNumeric(hpValue);
      }

      const speedKey = findKey(fieldMap, ['SPEED', 'Speed', 'WALKING', 'Walking']);
      if (speedKey && fieldMap[speedKey]) profile.speed = parseNumeric(fieldMap[speedKey]);

      const initiativeKey = findKey(fieldMap, ['INITIATIVE', 'Initiative', 'InitiativeBonus']);
      if (initiativeKey && fieldMap[initiativeKey]) profile.initiativeBonus = parseNumeric(fieldMap[initiativeKey]);

      if (fieldMap.spellSaveDC0) profile.spellSaveDC = parseInt(fieldMap.spellSaveDC0, 10);
      if (fieldMap.spellAtkBonus0) profile.spellAttackBonus = parseNumeric(String(fieldMap.spellAtkBonus0).trim());
      if (fieldMap.spellCastingAbility0) profile.spellcastingAbility = String(fieldMap.spellCastingAbility0).trim();

      profile.spellSlots = {};
      if (fieldMap.spellSlotHeader1) {
        const slotValue = String(fieldMap.spellSlotHeader1).trim();
        const m = slotValue.match(/(\d+)\s+Slots/i);
        if (m) profile.spellSlots[1] = parseInt(m[1], 10);
      }

      const rows = [];
      for (let i = 0; i <= 21; i++) {
        const v = fieldMap['spellName' + i];
        if (typeof v === 'string' && v.trim()) rows.push(v.trim());
      }
      const cantripHeaderIndex = rows.findIndex(row => /^===.*CANTRIPS.*===/i.test(row));
      const lvl1HeaderIndex = rows.findIndex(row => /^===.*1ST.*LEVEL.*===/i.test(row));
      let cantrips = cantripHeaderIndex >= 0 && lvl1HeaderIndex >= 0
        ? rows.slice(cantripHeaderIndex + 1, lvl1HeaderIndex)
        : rows.slice(0, 6);
      let spellsLvl1 = cantripHeaderIndex >= 0 && lvl1HeaderIndex >= 0
        ? rows.slice(lvl1HeaderIndex + 1)
        : rows.slice(6);
      const filterHeaders = (arr) => arr.filter(item => !item.startsWith('==='));
      const deduplicate = (arr) => {
        const seen = new Set();
        const result = [];
        for (const item of arr) {
          if (!seen.has(item)) { seen.add(item); result.push(item); }
        }
        return result;
      };
      cantrips = deduplicate(filterHeaders(cantrips));
      spellsLvl1 = deduplicate(filterHeaders(spellsLvl1));
      profile.cantrips = cantrips;
      profile.spells = spellsLvl1;

      const skillNames = ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival', "Thieves' Tools", 'Thieves Tools'];
      for (const sn of skillNames) {
        const key = findKey(fieldMap, [sn, 'Skill ' + sn, sn + ' Mod', 'Skills.' + sn, 'Skills ' + sn]);
        if (key && fieldMap[key]) {
          const mod = parseNumeric(fieldMap[key]);
          if (mod !== undefined) {
            profile.skills[sn === 'Thieves Tools' ? "Thieves' Tools" : sn] = mod;
          }
        }
      }

      var normalizedKeyMap = {};
      Object.keys(fieldMap).forEach(function (k) {
        var norm = k.toLowerCase().replace(/[\s_-]+/g, '');
        if (!normalizedKeyMap[norm]) normalizedKeyMap[norm] = [];
        normalizedKeyMap[norm].push(k);
      });
      function resolveKey(variants) {
        var key = findKey(fieldMap, variants);
        if (key) return key;
        for (var v = 0; v < variants.length; v++) {
          var variant = variants[v];
          var n = variant.toLowerCase().replace(/[\s_-]+/g, '');
          var candidates = normalizedKeyMap[n];
          if (!candidates || candidates.length === 0) continue;
          var exact = candidates.filter(function (c) { return c.toLowerCase() === variant.toLowerCase(); })[0];
          if (exact) return exact;
          var shortest = candidates.slice().sort(function (a, b) { return a.length - b.length; })[0];
          return shortest;
        }
        return null;
      }

      ABILITIES.forEach(function (ab) {
        var scoreKey = resolveKey(SCORE_VARIANTS[ab]);
        if (scoreKey && fieldMap[scoreKey]) {
          var s = parseNumeric(fieldMap[scoreKey]);
          if (s !== undefined) {
            foundScore[ab] = true;
            tempScore[ab] = clampScore(s);
          }
        }
        var modKey = resolveKey(MOD_VARIANTS[ab]);
        if (modKey && fieldMap[modKey]) {
          var m = parseNumeric(fieldMap[modKey]);
          if (m !== undefined) {
            foundMod[ab] = true;
            tempMod[ab] = clampMod(m);
          }
        }
      });

      var pbKey = resolveKey(['ProficiencyBonus', 'ProfBonus', 'PB']);
      if (pbKey && fieldMap[pbKey]) {
        var pb = parseNumeric(fieldMap[pbKey]);
        if (pb !== undefined) profile.proficiencyBonus = Math.max(1, Math.min(10, Math.floor(Number(pb))));
      }
    }

    if (!hasFieldMap && textFallback) {
      if (!profile.name) {
        const lines = textFallback.split('\n').map(line => line.trim()).filter(line => line);
        for (let i = 0; i < Math.min(10, lines.length); i++) {
          const line = lines[i];
          if (!line.toLowerCase().includes('character') && !line.toLowerCase().includes('sheet') && !line.toLowerCase().includes('d&d') && line.length > 2 && line.length < 50) {
            profile.name = toTitleCase(line);
            break;
          }
        }
      }
      if (!profile.className || !profile.level) {
        const classLevelMatch = textFallback.match(/\b(barbarian|bard|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|warlock|wizard)\s+(\d+)\b/i);
        if (classLevelMatch) {
          profile.className = classLevelMatch[1].charAt(0).toUpperCase() + classLevelMatch[1].slice(1).toLowerCase();
          profile.level = parseInt(classLevelMatch[2], 10);
        }
      }
      if (profile.ac === undefined) {
        const acMatch = textFallback.match(/\b(?:ac|armor\s+class)[:\s]+(\d+)\b/i);
        if (acMatch) profile.ac = parseInt(acMatch[1], 10);
      }
      if (profile.hpMax === undefined) {
        const hpMatch = textFallback.match(/\b(?:hit\s+points|hp)[:\s]+(?:(\d+)\s*\/\s*)?(\d+)\b/i);
        if (hpMatch) profile.hpMax = parseInt(hpMatch[2] || hpMatch[1], 10);
      }
      if (profile.speed === undefined) {
        const speedMatch = textFallback.match(/\bspeed[:\s]+(\d+)\s*(?:ft|feet)?\b/i);
        if (speedMatch) profile.speed = parseInt(speedMatch[1], 10);
      }
      if (profile.initiativeBonus === undefined) {
        const initiativeMatch = textFallback.match(/\binitiative[:\s]*([+-]?\d+)\b/i);
        if (initiativeMatch) profile.initiativeBonus = parseInt(initiativeMatch[1], 10);
      }
      const fallbackSkills = ['Investigation', 'Persuasion', 'Deception', 'Stealth', 'Perception'];
      for (const skill of fallbackSkills) {
        const re = new RegExp(skill.replace(/\s+/g, '\\s+') + '\\s*[+:]?\\s*(-?\\d+)', 'i');
        const match = textFallback.match(re);
        if (match) {
          if (!profile.skills) profile.skills = {};
          profile.skills[skill] = parseInt(match[1], 10);
        }
      }
    }

    if (textFallback) {
      // Gate regex writes purely on foundScore/foundMod; do not use 0 or any numeric sentinel.
      var abilityTextPatterns = [
        { ab: 'STR', re: /\b(?:STR|Strength)\s*:?\s*(\d+)\s*(?:\(\s*([+-]?\d+)\s*\)|([+-]?\d+))?/i },
        { ab: 'DEX', re: /\b(?:DEX|Dexterity)\s*:?\s*(\d+)\s*(?:\(\s*([+-]?\d+)\s*\)|([+-]?\d+))?/i },
        { ab: 'CON', re: /\b(?:CON|Constitution)\s*:?\s*(\d+)\s*(?:\(\s*([+-]?\d+)\s*\)|([+-]?\d+))?/i },
        { ab: 'INT', re: /\b(?:INT|Intelligence)\s*:?\s*(\d+)\s*(?:\(\s*([+-]?\d+)\s*\)|([+-]?\d+))?/i },
        { ab: 'WIS', re: /\b(?:WIS|Wisdom)\s*:?\s*(\d+)\s*(?:\(\s*([+-]?\d+)\s*\)|([+-]?\d+))?/i },
        { ab: 'CHA', re: /\b(?:CHA|Charisma)\s*:?\s*(\d+)\s*(?:\(\s*([+-]?\d+)\s*\)|([+-]?\d+))?/i }
      ];
      abilityTextPatterns.forEach(function (p) {
        if (foundScore[p.ab] && foundMod[p.ab]) return;
        var match = textFallback.match(p.re);
        if (!match) return;
        var scoreVal = match[1] ? parseInt(match[1], 10) : undefined;
        var modVal = match[2] !== undefined && match[2] !== '' ? parseInt(match[2], 10) : (match[3] !== undefined && match[3] !== '' ? parseInt(match[3], 10) : undefined);
        if (!foundScore[p.ab] && scoreVal !== undefined) {
          foundScore[p.ab] = true;
          tempScore[p.ab] = clampScore(scoreVal);
        }
        if (!foundMod[p.ab] && modVal !== undefined) {
          foundMod[p.ab] = true;
          tempMod[p.ab] = clampMod(modVal);
        }
      });

      if (profile.proficiencyBonus === undefined) {
        var pbTextMatch = textFallback.match(/\b(?:Proficiency Bonus|Prof Bonus|PB)\s*[+]?(\d+)\b/i);
        if (pbTextMatch) profile.proficiencyBonus = Math.max(1, Math.min(10, parseInt(pbTextMatch[1], 10)));
      }
    }

    ABILITIES.forEach(function (ab) {
      var score = (foundScore[ab] && tempScore[ab] != null) ? tempScore[ab] : 0;
      var mod = (foundMod[ab] && tempMod[ab] != null) ? tempMod[ab] : (foundScore[ab] ? abilityModFromScore(score) : 0);
      profile.abilities.scores[ab] = clampScore(score);
      profile.abilities.mods[ab] = clampMod(mod);
    });

    var missingScoreAb = ABILITIES.filter(function (ab) { return !foundScore[ab]; });
    if (missingScoreAb.length) console.warn('CharacterSheetImporter: abilities with missing score:', missingScoreAb.join(', '));
    var mismatchAb = ABILITIES.filter(function (ab) {
      return foundScore[ab] && foundMod[ab] && tempScore[ab] != null && tempMod[ab] != null &&
        abilityModFromScore(tempScore[ab]) !== tempMod[ab];
    });
    if (mismatchAb.length) console.warn('CharacterSheetImporter: abilities with score/mod mismatch (parsed mod kept):', mismatchAb.join(', '));

    return profile;
  }

  function buildNormalizedSpells(fieldMap) {
    if (!fieldMap || typeof fieldMap !== 'object') return [];
    const normalizedSpells = [];
    let currentLevelGroup = null;
    let currentSource = 'Cleric';

    for (let i = 0; i <= 21; i++) {
      const spellNameKey = 'spellName' + i;
      const spellName = fieldMap[spellNameKey];
      if (!spellName || typeof spellName !== 'string') continue;
      const trimmedName = spellName.trim();
      if (/^===.*CANTRIPS.*===/i.test(trimmedName)) {
        currentLevelGroup = 'cantrip';
        continue;
      }
      if (/^===.*(\d+).*LEVEL.*===/i.test(trimmedName)) {
        const levelMatch = trimmedName.match(/(\d+)/);
        if (levelMatch) currentLevelGroup = parseInt(levelMatch[1], 10);
        continue;
      }
      if (!trimmedName || trimmedName.startsWith('===')) continue;

      const castingTimeKey = 'spellCastingTime' + i;
      const castingTime = fieldMap[castingTimeKey] ? String(fieldMap[castingTimeKey]).trim() : null;
      let notesRaw = null;
      const notesCandidates = ['spellNotes' + i, 'SpellNotes' + i];
      for (const k of notesCandidates) {
        if (fieldMap[k] && String(fieldMap[k]).trim()) {
          notesRaw = String(fieldMap[k]).trim();
          break;
        }
      }
      let freeUsesMax = 0;
      let freeUseRestType = null;
      if (notesRaw) {
        const freeMatch = notesRaw.match(/(\d+)\s*\/\s*(LR|SR)/i);
        if (freeMatch) {
          freeUsesMax = parseInt(freeMatch[1], 10);
          freeUseRestType = freeMatch[2].toUpperCase();
        }
      }
      let isBonusAction = false;
      let isReaction = false;
      let isRitual = false;
      if (castingTime) {
        const timeUpper = castingTime.toUpperCase();
        isBonusAction = timeUpper.includes('1BA') || timeUpper.includes('BONUS ACTION');
        isReaction = timeUpper.includes('1R') || timeUpper.includes('REACTION');
        isRitual = timeUpper.includes('RITUAL') || timeUpper.includes('[R]');
      }
      const spell = {
        name: trimmedName,
        levelGroup: currentLevelGroup || 1,
        castingTime: castingTime || null,
        source: currentSource,
        notes: notesRaw || null,
        isRitual: isRitual,
        isBonusAction: isBonusAction,
        isReaction: isReaction
      };
      if (freeUsesMax > 0 && freeUseRestType) {
        spell.freeUsesMax = freeUsesMax;
        spell.freeUseRestType = freeUseRestType;
      }
      normalizedSpells.push(spell);
    }
    return normalizedSpells;
  }

  function normalizeProfileSpells(profile) {
    if (!profile) return profile;
    if (profile.normalizedSpells && Array.isArray(profile.normalizedSpells)) return profile;
    if (profile.rawFields) {
      profile.normalizedSpells = buildNormalizedSpells(profile.rawFields);
    } else {
      profile.normalizedSpells = [];
      if (profile.cantrips) {
        profile.cantrips.forEach(name => {
          profile.normalizedSpells.push({
            name: name,
            levelGroup: 'cantrip',
            castingTime: null,
            source: 'Legacy',
            notes: null,
            isRitual: false,
            isBonusAction: false,
            isReaction: false
          });
        });
      }
      if (profile.spells) {
        profile.spells.forEach(name => {
          profile.normalizedSpells.push({
            name: name,
            levelGroup: 1,
            castingTime: null,
            source: 'Legacy',
            notes: null,
            isRitual: false,
            isBonusAction: false,
            isReaction: false
          });
        });
      }
    }
    return profile;
  }

  function getNormalizedSpells(profile) {
    if (!profile) return [];
    if (profile.normalizedSpells && Array.isArray(profile.normalizedSpells)) return profile.normalizedSpells;
    if (profile.rawFields) {
      const normalized = buildNormalizedSpells(profile.rawFields);
      profile.normalizedSpells = normalized;
      return normalized;
    }
    const normalized = [];
    if (profile.cantrips) {
      profile.cantrips.forEach(name => {
        normalized.push({
          name: name,
          levelGroup: 'cantrip',
          castingTime: null,
          source: 'Legacy',
          notes: null,
          isRitual: false,
          isBonusAction: false,
          isReaction: false
        });
      });
    }
    if (profile.spells) {
      profile.spells.forEach(name => {
        normalized.push({
          name: name,
          levelGroup: 1,
          castingTime: null,
          source: 'Legacy',
          notes: null,
          isRitual: false,
          isBonusAction: false,
          isReaction: false
        });
      });
    }
    return normalized;
  }

  window.CharacterSheetImporter = {
    extractPdfData: extractPdfData,
    parseFromFields: parseFromFields,
    findKey: findKey,
    buildNormalizedSpells: buildNormalizedSpells,
    normalizeProfileSpells: normalizeProfileSpells,
    getNormalizedSpells: getNormalizedSpells
  };
})();
