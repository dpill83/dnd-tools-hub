(function () {
  'use strict';

  var INDEX_KEY = 'dndth:legacyProjects:index:v1';
  var CHAR_KEY_PREFIX = 'dndth:legacyProjects:character:v1:';
  var LAST_CHAR_KEY = 'dndth:legacyProjects:lastCharacter:v1';
  var SCHEMA_VERSION = 1;
  var STEP_NAMES = ['Character', 'Projects List', 'Project Setup', 'Tier', 'Track Math', 'Pieces Builder', 'Progress + Leads + Complications', 'Completion', 'Export + Copy Prompts'];

  var TIER_CONFIG = {
    Minor: { basePieces: 3, defaultMinLevel: 2 },
    Moderate: { basePieces: 5, defaultMinLevel: 4 },
    Major: { basePieces: 7, defaultMinLevel: 6 },
    Epic: { basePieces: 9, defaultMinLevel: 8 }
  };

  var PIECE_TYPES = ['Material', 'Knowledge', 'Allied Aid', 'Ritual/Experience', 'Sacrificial'];

  var PIECE_PROPERTIES = [
    'Requires a rare or exotic material from a distant location.',
    'Involves knowledge lost to time; must be researched or recovered.',
    'Needs the aid of a skilled specialist or craftsman.',
    'Tied to a ritual or ceremony that must be performed correctly.',
    'Involves a significant sacrifice—time, gold, or something personal.',
    'Connected to a specific place of power or historical significance.',
    'Requires the blessing or permission of an authority figure.',
    'Involves a creature, ally, or contact who must be convinced or recruited.',
    'Tied to a seasonal event, celestial alignment, or auspicious date.',
    'Requires overcoming a trial, challenge, or test of worthiness.',
    'Involves recovering something stolen, lost, or hidden long ago.',
    'Connected to a bloodline, oath, or inherited obligation.',
    'Requires collaboration with an unusual or unexpected ally.',
    'Tied to a secret that must be discovered or revealed.',
    'Involves a dangerous journey or expedition to obtain it.',
    'Requires appeasing or bargaining with a powerful entity.',
    'Connected to a past failure that must be redeemed or corrected.',
    'Involves a creative or artistic component—song, craft, or ritual art.',
    'Tied to the death or passing of something significant.',
    'Requires uniting disparate parties or reconciling old conflicts.'
  ];

  var COMPLICATIONS = [
    'A rival or enemy seeks the same piece or aims to obstruct you.',
    'Time pressure: a deadline or window of opportunity is closing.',
    'The cost or requirement has increased unexpectedly.',
    'A key contact, ally, or resource has become unavailable.',
    'New information reveals the piece is harder to obtain than expected.',
    'Your actions have drawn unwanted attention from powerful forces.',
    'A previous choice or commitment now conflicts with this goal.',
    'The piece is guarded, hidden, or claimed by another party.',
    'A moral or ethical dilemma complicates the path forward.',
    'Physical or logistical barriers block access to what you need.',
    'Trust has been broken; an ally or source has betrayed or deceived you.',
    'The piece itself carries a curse, cost, or unintended consequence.'
  ];

  var DEFAULT_TIER_GATING = { Minor: 2, Moderate: 4, Major: 6, Epic: 8 };

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'lp_' + Date.now() + '_' + Math.random().toString(16).slice(2);
  }

  function normalizeCharacterKey(str) {
    if (!str || typeof str !== 'string') return 'character_' + Date.now();
    var s = str.trim().toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return s || 'character_' + Date.now();
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  var state = {
    currentStep: 0,
    characterKey: null,
    characterBundle: null,
    projectId: null
  };

  function getCharKey() {
    return CHAR_KEY_PREFIX + (state.characterKey || '');
  }

  function getActiveProject() {
    if (!state.characterBundle || !state.projectId) return null;
    var proj = state.characterBundle.projects || [];
    for (var i = 0; i < proj.length; i++) {
      if (proj[i].id === state.projectId) return proj[i];
    }
    return null;
  }

  function loadIndex() {
    try {
      var raw = localStorage.getItem(INDEX_KEY);
      return raw ? JSON.parse(raw) : { characterKeys: [] };
    } catch (e) { return { characterKeys: [] }; }
  }

  function saveIndex(index) {
    try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); } catch (e) {}
  }

  function loadCharacterBundle(key) {
    try {
      var raw = localStorage.getItem(CHAR_KEY_PREFIX + key);
      if (!raw) return null;
      var b = JSON.parse(raw);
      if (!b.tierGating) b.tierGating = Object.assign({}, DEFAULT_TIER_GATING);
      return b;
    } catch (e) { return null; }
  }

  function saveCharacterBundle() {
    if (!state.characterKey || !state.characterBundle) return;
    state.characterBundle.schemaVersion = SCHEMA_VERSION;
    try {
      localStorage.setItem(getCharKey(), JSON.stringify(state.characterBundle));
      localStorage.setItem(LAST_CHAR_KEY, state.characterKey);
      var idx = loadIndex();
      if (idx.characterKeys.indexOf(state.characterKey) < 0) {
        idx.characterKeys.push(state.characterKey);
        saveIndex(idx);
      }
    } catch (e) {}
  }

  function createDefaultBundle(profile) {
    return {
      schemaVersion: SCHEMA_VERSION,
      profile: profile || { name: '', className: '', level: 0, abilities: { scores: {}, mods: {} }, proficiencyBonus: 2, skills: {} },
      tierGating: Object.assign({}, DEFAULT_TIER_GATING),
      projects: []
    };
  }

  function createDefaultProject() {
    return {
      id: generateId(),
      goal: '', why: '', categoryTags: [], stakeholders: '', constraints: '', dmApproved: false,
      sharedProjects: false, partyName: '', contributors: '',
      tier: 'Minor', basePieces: 3, varianceDie: 'd6', varianceRoll: null,
      modifierType: 'none', modifierValue: 0, totalPieces: 3, pieces: [],
      leads: [], complications: [], gpSpent: '', downtimeWeeks: '',
      completionRecord: null, dmOverride: false, dmOverrideReason: '',
      archived: false
    };
  }

  function reconcilePieces(project, newTotal) {
    var arr = project.pieces || [];
    var n = Math.max(0, parseInt(newTotal, 10) || 0);
    if (arr.length > n) project.pieces = arr.slice(0, n);
    else {
      while (arr.length < n) {
        arr.push({ title: '', type: 'Material', notes: '', acquired: false, tempBenefit: '', rolledProperty: null });
      }
      project.pieces = arr;
    }
  }

  var saveState = debounce(function () {
    saveCharacterBundle();
  }, 500);

  function showStep(index) {
    state.currentStep = index;
    document.getElementById('step-indicator').textContent = 'Step ' + (index + 1) + ' of 9: ' + STEP_NAMES[index];
    document.getElementById('step-title').textContent = STEP_NAMES[index];
    ['panel-character', 'panel-projects', 'panel-setup', 'panel-tier', 'panel-track', 'panel-pieces', 'panel-progress', 'panel-completion', 'panel-export'].forEach(function (id, i) {
      document.getElementById(id).classList.toggle('active', i === index);
    });
    document.getElementById('btn-back').disabled = index === 0;
    document.getElementById('btn-next').textContent = index === 8 ? 'Finish' : 'Next';
    renderStep(index);
    saveState();
  }

  function renderStep(index) {
    var fns = [renderCharacter, renderProjectsList, renderSetup, renderTier, renderTrack, renderPieces, renderProgress, renderCompletion, renderExport];
    if (fns[index]) fns[index]();
  }

  function renderCharacter() {
    var el = document.getElementById('panel-character');
    var idx = loadIndex();
    var keys = idx.characterKeys || [];
    var prof = state.characterBundle ? state.characterBundle.profile : null;
    var name = prof && prof.name ? prof.name : '';
    var className = prof && prof.className ? prof.className : '';
    var level = prof && prof.level ? prof.level : 0;
    var key = state.characterKey || '';
    var activeCap = Math.floor(Math.max(0, level) / 2);
    var eligible = level >= 2;

    var dropdownOpts = '<option value="" ' + (!key ? 'selected' : '') + '>— Select character —</option>' +
      keys.map(function (k) {
        return '<option value="' + escapeHtml(k) + '" ' + (k === key ? 'selected' : '') + '>' + escapeHtml(k.replace(/_/g, ' — ')) + '</option>';
      }).join('');

    el.innerHTML = '<label for="lpb-char-select">Character</label><select id="lpb-char-select">' + dropdownOpts + '</select>' +
      '<button type="button" id="lpb-new-char" class="wizard-btn secondary">New Character</button>' +
      '<label for="lpb-name">Character name</label><input type="text" id="lpb-name" value="' + escapeHtml(name) + '" placeholder="Name">' +
      '<label for="lpb-class">Class</label><input type="text" id="lpb-class" value="' + escapeHtml(className) + '" placeholder="e.g. Wizard">' +
      '<label for="lpb-level">Level</label><input type="number" id="lpb-level" min="1" max="20" value="' + level + '">' +
      '<label for="lpb-char-key">Character identity key (for storage)</label><input type="text" id="lpb-char-key" value="' + escapeHtml(key) + '" placeholder="Auto-derived from name + class">' +
      '<div class="result-box">' +
      (eligible ? '<p class="eligibility-ok">Eligible. Active project cap: ' + activeCap + '</p>' : '<p class="eligibility-warn">Not eligible yet (level &lt; 2). New Project disabled.</p>') +
      '</div>' +
      (prof && (prof.abilities || prof.skills) ? '<details><summary>Character summary</summary><pre style="font-size:0.85rem;white-space:pre-wrap;">' + escapeHtml(JSON.stringify(prof, null, 2).slice(0, 500) + (JSON.stringify(prof).length > 500 ? '...' : '')) + '</pre></details>' : '');

    document.getElementById('lpb-char-select').addEventListener('change', function () {
      var sel = this.value;
      if (!sel) {
        state.characterKey = null;
        state.characterBundle = createDefaultBundle();
        state.projectId = null;
        saveState();
        renderCharacter();
        return;
      }
      var b = loadCharacterBundle(sel);
      if (b) {
        state.characterKey = sel;
        state.characterBundle = b;
        state.projectId = null;
        saveState();
        renderCharacter();
      }
    });

    document.getElementById('lpb-new-char').addEventListener('click', function () {
      state.characterKey = null;
      state.characterBundle = createDefaultBundle();
      state.projectId = null;
      saveState();
      renderCharacter();
    });

    function updateKey() {
      var n = document.getElementById('lpb-name').value.trim();
      var c = document.getElementById('lpb-class').value.trim();
      var newKey = normalizeCharacterKey(n + '_' + c);
      document.getElementById('lpb-char-key').value = newKey;
      state.characterKey = newKey;
    }
    document.getElementById('lpb-name').addEventListener('input', function () {
      if (!state.characterBundle) state.characterBundle = createDefaultBundle();
      state.characterBundle.profile = state.characterBundle.profile || {};
      state.characterBundle.profile.name = this.value;
      updateKey();
      saveState();
    });
    document.getElementById('lpb-class').addEventListener('input', function () {
      if (!state.characterBundle) state.characterBundle = createDefaultBundle();
      state.characterBundle.profile = state.characterBundle.profile || {};
      state.characterBundle.profile.className = this.value;
      updateKey();
      saveState();
    });
    document.getElementById('lpb-level').addEventListener('input', function () {
      if (!state.characterBundle) state.characterBundle = createDefaultBundle();
      state.characterBundle.profile = state.characterBundle.profile || {};
      state.characterBundle.profile.level = parseInt(this.value, 10) || 0;
      saveState();
      renderCharacter();
    });
    document.getElementById('lpb-char-key').addEventListener('change', function () {
      state.characterKey = this.value.trim() || normalizeCharacterKey(
        (document.getElementById('lpb-name').value || '') + '_' + (document.getElementById('lpb-class').value || '')
      );
      this.value = state.characterKey;
      saveState();
    });
  }

  function renderProjectsList() {
    var el = document.getElementById('panel-projects');
    if (state.characterKey === null) {
      el.innerHTML = '<div class="result-box"><p>Select a character first.</p><p>Go to the Character step to choose an existing character or create a new one.</p></div>' +
        '<button type="button" id="lpb-new-project" class="wizard-btn" disabled>New Project</button>' +
        '<h4 style="margin-top:1rem;">Active Projects</h4><div id="lpb-active-list"></div>';
      return;
    }
    if (!state.characterBundle) state.characterBundle = loadCharacterBundle(state.characterKey) || createDefaultBundle();
    var prof = state.characterBundle.profile || {};
    var level = Math.max(0, prof.level || 0);
    var activeCap = Math.floor(level / 2);
    var projects = state.characterBundle.projects || [];
    var active = projects.filter(function (p) { return !p.archived; });
    var archived = projects.filter(function (p) { return p.archived; });
    var canNew = level >= 2 && active.length < activeCap;

    var charName = (prof.name || '').trim();
    var charClass = (prof.className || '').trim();
    var charHeader = (charName || charClass)
      ? '<div class="result-box"><strong>' + escapeHtml(charName || '(unnamed)') + '</strong> — ' + escapeHtml(charClass || '(no class)') + ' (Level ' + level + ')</div>'
      : '<div class="result-box"><strong>' + escapeHtml(state.characterKey.replace(/_/g, ' — ')) + '</strong></div>';
    var capText = level < 2
      ? 'Not eligible for projects yet (level 2+ required)'
      : 'Active projects: ' + active.length + ' / ' + activeCap;
    var html = charHeader + '<p>' + capText + '</p>';
    html += '<button type="button" id="lpb-new-project" class="wizard-btn" ' + (canNew ? '' : 'disabled') + '>New Project</button>';
    html += '<h4 style="margin-top:1rem;">Active Projects</h4><div id="lpb-active-list"></div>';
    if (archived.length) html += '<h4 style="margin-top:1rem;">Archived</h4><div id="lpb-archived-list"></div>';
    el.innerHTML = html;

    function renderList(containerId, list, archived) {
      var c = document.getElementById(containerId);
      if (!c) return;
      c.innerHTML = '';
      list.forEach(function (p) {
        var card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = '<h4>' + escapeHtml(p.goal || '(No goal)') + '</h4><p style="font-size:0.85rem;margin:0;">' + escapeHtml(p.tier || '') + ' · ' + (p.pieces ? p.pieces.filter(function (x) { return x.acquired; }).length : 0) + '/' + (p.totalPieces || 0) + ' pieces</p>' +
          '<div style="margin-top:0.5rem;">' +
          '<button type="button" class="wizard-btn secondary lpb-select-project" data-id="' + escapeHtml(p.id) + '">Open</button> ' +
          '<button type="button" class="wizard-btn secondary lpb-dup-project" data-id="' + escapeHtml(p.id) + '">Duplicate</button> ' +
          (archived ? '<button type="button" class="wizard-btn secondary lpb-unarchive-project" data-id="' + escapeHtml(p.id) + '">Restore</button>' : '<button type="button" class="wizard-btn secondary lpb-archive-project" data-id="' + escapeHtml(p.id) + '">Archive</button>') +
          '</div>';
        c.appendChild(card);
      });
    }
    renderList('lpb-active-list', active, false);
    renderList('lpb-archived-list', archived, true);

    document.getElementById('lpb-new-project').addEventListener('click', function () {
      if (!canNew) return;
      var p = createDefaultProject();
      state.characterBundle.projects.push(p);
      state.projectId = p.id;
      saveState();
      showStep(2);
    });

    el.querySelectorAll('.lpb-select-project').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.projectId = this.dataset.id;
        saveState();
        showStep(2);
      });
    });
    el.querySelectorAll('.lpb-dup-project').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.dataset.id;
        var orig = state.characterBundle.projects.find(function (p) { return p.id === id; });
        if (!orig || active.length >= activeCap) return;
        var copy = JSON.parse(JSON.stringify(orig));
        copy.id = generateId();
        copy.archived = false;
        copy.completionRecord = null;
        state.characterBundle.projects.push(copy);
        state.projectId = copy.id;
        saveState();
        renderProjectsList();
      });
    });
    el.querySelectorAll('.lpb-archive-project').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.dataset.id;
        var p = state.characterBundle.projects.find(function (x) { return x.id === id; });
        if (p) { p.archived = true; saveState(); renderProjectsList(); }
      });
    });
    el.querySelectorAll('.lpb-unarchive-project').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.dataset.id;
        var p = state.characterBundle.projects.find(function (x) { return x.id === id; });
        if (p && active.length < activeCap) { p.archived = false; saveState(); renderProjectsList(); }
      });
    });
  }

  function renderSetup() {
    var el = document.getElementById('panel-setup');
    var p = getActiveProject();
    if (!p) { el.innerHTML = '<p>No project selected. Go back to Projects List.</p>'; return; }

    var cats = ['item', 'social', 'temple', 'research', 'stronghold', 'vow', 'other'];
    var catHtml = cats.map(function (c) {
      return '<label><input type="checkbox" class="lpb-cat" value="' + c + '" ' + (p.categoryTags && p.categoryTags.indexOf(c) >= 0 ? 'checked' : '') + '> ' + c + '</label>';
    }).join('');

    el.innerHTML = '<label for="lpb-goal">Goal (1 sentence)</label><input type="text" id="lpb-goal" value="' + escapeHtml(p.goal) + '" placeholder="What are you building?">' +
      '<label for="lpb-why">Why it matters (1–2 sentences)</label><textarea id="lpb-why" placeholder="Personal or story stakes">' + escapeHtml(p.why) + '</textarea>' +
      '<label>Category tags</label><div class="lpb-cats">' + catHtml + '</div>' +
      '<label for="lpb-stakeholders">Stakeholders (free text)</label><textarea id="lpb-stakeholders" placeholder="Who cares?">' + escapeHtml(p.stakeholders) + '</textarea>' +
      '<label for="lpb-constraints">Constraints (free text)</label><textarea id="lpb-constraints" placeholder="Limitations">' + escapeHtml(p.constraints) + '</textarea>' +
      '<label><input type="checkbox" id="lpb-dm-approved" ' + (p.dmApproved ? 'checked' : '') + '> DM approval</label>' +
      '<label style="margin-top:1rem;"><input type="checkbox" id="lpb-shared" ' + (p.sharedProjects ? 'checked' : '') + '> Experimental: Shared Projects (future)</label>' +
      '<div id="lpb-shared-fields" style="' + (p.sharedProjects ? '' : 'display:none;') + 'margin-top:0.5rem;">' +
      '<label for="lpb-party-name">Party name</label><input type="text" id="lpb-party-name" value="' + escapeHtml(p.partyName) + '">' +
      '<label for="lpb-contributors">Contributors (list)</label><textarea id="lpb-contributors" placeholder="Names">' + escapeHtml(p.contributors) + '</textarea></div>';

    ['goal', 'why', 'stakeholders', 'constraints'].forEach(function (f) {
      document.getElementById('lpb-' + f.replace('_', '-')).addEventListener('input', function () {
        p[f] = this.value;
        saveState();
      });
    });
    document.getElementById('lpb-dm-approved').addEventListener('change', function () { p.dmApproved = this.checked; saveState(); });
    document.getElementById('lpb-shared').addEventListener('change', function () {
      p.sharedProjects = this.checked;
      document.getElementById('lpb-shared-fields').style.display = this.checked ? 'block' : 'none';
      saveState();
    });
    document.getElementById('lpb-party-name').addEventListener('input', function () { p.partyName = this.value; saveState(); });
    document.getElementById('lpb-contributors').addEventListener('input', function () { p.contributors = this.value; saveState(); });
    el.querySelectorAll('.lpb-cat').forEach(function (cb) {
      cb.addEventListener('change', function () {
        p.categoryTags = p.categoryTags || [];
        var v = this.value;
        if (this.checked) { if (p.categoryTags.indexOf(v) < 0) p.categoryTags.push(v); }
        else p.categoryTags = p.categoryTags.filter(function (x) { return x !== v; });
        saveState();
      });
    });
  }

  function renderTier() {
    var el = document.getElementById('panel-tier');
    var p = getActiveProject();
    if (!p) { el.innerHTML = '<p>No project selected.</p>'; return; }

    var tg = state.characterBundle.tierGating || DEFAULT_TIER_GATING;
    var cfg = TIER_CONFIG[p.tier] || TIER_CONFIG.Minor;
    var minLevel = tg[p.tier] != null ? tg[p.tier] : cfg.defaultMinLevel;
    var profLevel = (state.characterBundle.profile && state.characterBundle.profile.level) || 0;
    var overrideNeeded = minLevel > profLevel;

    el.innerHTML = '<label for="lpb-tier">Tier</label><select id="lpb-tier">' +
      ['Minor', 'Moderate', 'Major', 'Epic'].map(function (t) {
        return '<option value="' + t + '" ' + (p.tier === t ? 'selected' : '') + '>' + t + ' (' + (TIER_CONFIG[t].basePieces) + ' base pieces)</option>';
      }).join('') + '</select>' +
      '<h4 style="margin-top:1rem;">Tier gating (min level)</h4>' +
      Object.keys(DEFAULT_TIER_GATING).map(function (t) {
        return '<label>' + t + ': <input type="number" class="lpb-tg" data-tier="' + t + '" min="1" max="20" value="' + (tg[t] != null ? tg[t] : DEFAULT_TIER_GATING[t]) + '"></label>';
      }).join(' ') +
      '<div id="lpb-tier-warn" class="result-box" style="' + (overrideNeeded && !p.dmOverride ? '' : 'display:none;') + '">' +
      '<p class="eligibility-warn">Tier ' + p.tier + ' suggests level ' + minLevel + '+. You are level ' + profLevel + '.</p>' +
      '<label><input type="checkbox" id="lpb-dm-override" ' + (p.dmOverride ? 'checked' : '') + '> DM Override</label>' +
      '<label for="lpb-dm-reason">Reason</label><input type="text" id="lpb-dm-reason" value="' + escapeHtml(p.dmOverrideReason) + '" placeholder="Why allow?"></div>';

    document.getElementById('lpb-tier').addEventListener('change', function () {
      p.tier = this.value;
      p.basePieces = TIER_CONFIG[p.tier].basePieces;
      var mod = p.modifierType === 'none' ? 0 : (p.modifierType === 'prof' ? (state.characterBundle.profile && state.characterBundle.profile.proficiencyBonus) || 2 : (p.modifierType === 'custom' ? (parseInt(p.modifierValue, 10) || 0) : (state.characterBundle.profile && state.characterBundle.profile.abilities && state.characterBundle.profile.abilities.mods && state.characterBundle.profile.abilities.mods[p.modifierType]) || 0));
      p.totalPieces = p.basePieces + (p.varianceRoll != null ? p.varianceRoll : 0) + mod;
      reconcilePieces(p, p.totalPieces);
      saveState();
      renderTier();
    });
    el.querySelectorAll('.lpb-tg').forEach(function (inp) {
      inp.addEventListener('change', function () {
        state.characterBundle.tierGating = state.characterBundle.tierGating || {};
        state.characterBundle.tierGating[this.dataset.tier] = parseInt(this.value, 10) || 1;
        saveState();
        renderTier();
      });
    });
    document.getElementById('lpb-dm-override').addEventListener('change', function () { p.dmOverride = this.checked; saveState(); renderTier(); });
    document.getElementById('lpb-dm-reason').addEventListener('input', function () { p.dmOverrideReason = this.value; saveState(); });
  }

  function renderTrack() {
    var el = document.getElementById('panel-track');
    var p = getActiveProject();
    if (!p) { el.innerHTML = '<p>No project selected.</p>'; return; }

    var prof = state.characterBundle && state.characterBundle.profile ? state.characterBundle.profile : {};
    var modVal = 0;
    if (p.modifierType === 'prof') modVal = prof.proficiencyBonus != null ? prof.proficiencyBonus : 2;
    else if (p.modifierType === 'custom') modVal = parseInt(p.modifierValue, 10) || 0;
    else if (p.modifierType && prof.abilities && prof.abilities.mods && prof.abilities.mods[p.modifierType] != null) modVal = prof.abilities.mods[p.modifierType];
    p.totalPieces = p.basePieces + (p.varianceRoll != null ? p.varianceRoll : 0) + modVal;
    reconcilePieces(p, p.totalPieces);

    var trackerStr = 'Legacy Project: ' + (p.goal || '(goal)') + '. Pieces: ' + (p.pieces.filter(function (x) { return x.acquired; }).length) + ' of ' + p.totalPieces + '.';

    el.innerHTML = '<label>Variance die</label><select id="lpb-var-die"><option value="d6" ' + (p.varianceDie === 'd6' ? 'selected' : '') + '>d6</option><option value="d4" ' + (p.varianceDie === 'd4' ? 'selected' : '') + '>d4</option></select>' +
      '<button type="button" id="lpb-roll-var" class="wizard-btn secondary">Roll variance</button> ' +
      (p.varianceRoll != null ? '<span>Rolled: ' + p.varianceRoll + '</span>' : '') +
      '<label style="margin-top:0.75rem;">Optional modifier</label><select id="lpb-mod-type">' +
      '<option value="none" ' + (p.modifierType === 'none' ? 'selected' : '') + '>None</option>' +
      '<option value="prof" ' + (p.modifierType === 'prof' ? 'selected' : '') + '>Proficiency bonus</option>' +
      (prof.abilities && prof.abilities.mods ? ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(function (a) {
        return '<option value="' + a + '" ' + (p.modifierType === a ? 'selected' : '') + '>' + a + '</option>';
      }).join('') : '') +
      '<option value="custom" ' + (p.modifierType === 'custom' ? 'selected' : '') + '>Custom number</option></select>' +
      '<input type="number" id="lpb-mod-val" value="' + (p.modifierValue != null ? p.modifierValue : 0) + '" placeholder="Custom" style="' + (p.modifierType !== 'custom' ? 'display:none;' : '') + '">' +
      '<p style="margin-top:0.75rem;"><strong>Total pieces: ' + p.totalPieces + '</strong></p>' +
      '<label>Tracker string</label><div class="copy-block">' + escapeHtml(trackerStr) + '</div>' +
      '<button type="button" id="lpb-copy-tracker" class="wizard-btn secondary">Copy tracker</button>';

    document.getElementById('lpb-var-die').addEventListener('change', function () {
      p.varianceDie = this.value;
      saveState();
    });
    document.getElementById('lpb-roll-var').addEventListener('click', function () {
      var sides = p.varianceDie === 'd4' ? 4 : 6;
      p.varianceRoll = 1 + Math.floor(Math.random() * sides);
      var m = p.modifierType === 'none' ? 0 : (p.modifierType === 'prof' ? (prof.proficiencyBonus || 2) : (p.modifierType === 'custom' ? (parseInt(p.modifierValue, 10) || 0) : ((prof.abilities && prof.abilities.mods && prof.abilities.mods[p.modifierType]) || 0)));
      p.totalPieces = p.basePieces + p.varianceRoll + m;
      reconcilePieces(p, p.totalPieces);
      saveState();
      renderTrack();
    });
    document.getElementById('lpb-mod-type').addEventListener('change', function () {
      p.modifierType = this.value;
      document.getElementById('lpb-mod-val').style.display = this.value === 'custom' ? 'inline-block' : 'none';
      var m = this.value === 'none' ? 0 : (this.value === 'prof' ? (prof.proficiencyBonus || 2) : (this.value === 'custom' ? (parseInt(p.modifierValue, 10) || 0) : ((prof.abilities && prof.abilities.mods && prof.abilities.mods[this.value]) || 0)));
      p.totalPieces = p.basePieces + (p.varianceRoll != null ? p.varianceRoll : 0) + m;
      reconcilePieces(p, p.totalPieces);
      saveState();
      renderTrack();
    });
    document.getElementById('lpb-mod-val').addEventListener('input', function () {
      p.modifierValue = parseInt(this.value, 10) || 0;
      if (p.modifierType === 'custom') {
        p.totalPieces = p.basePieces + (p.varianceRoll != null ? p.varianceRoll : 0) + p.modifierValue;
        reconcilePieces(p, p.totalPieces);
      }
      saveState();
      renderTrack();
    });
    document.getElementById('lpb-copy-tracker').addEventListener('click', function () {
      copyToClipboard('Legacy Project: ' + (p.goal || '(goal)') + '. Pieces: ' + (p.pieces.filter(function (x) { return x.acquired; }).length) + ' of ' + p.totalPieces + '.');
    });
  }

  function renderPieces() {
    var el = document.getElementById('panel-pieces');
    var p = getActiveProject();
    if (!p) { el.innerHTML = '<p>No project selected.</p>'; return; }

    var pieces = p.pieces || [];
    var html = '<p>Total pieces: ' + pieces.length + '</p>';
    pieces.forEach(function (piece, i) {
      html += '<div class="project-card" data-idx="' + i + '">' +
        '<label>Piece ' + (i + 1) + ' title</label><input type="text" class="lpb-piece-title" value="' + escapeHtml(piece.title) + '">' +
        '<label>Type</label><select class="lpb-piece-type">' + PIECE_TYPES.map(function (t) {
          return '<option value="' + t + '" ' + (piece.type === t ? 'selected' : '') + '>' + t + '</option>';
        }).join('') + '</select>' +
        '<label>Notes</label><textarea class="lpb-piece-notes" rows="2">' + escapeHtml(piece.notes) + '</textarea>' +
        '<label><input type="checkbox" class="lpb-piece-acquired" ' + (piece.acquired ? 'checked' : '') + '> Acquired</label>' +
        '<label>Optional temporary benefit</label><input type="text" class="lpb-piece-temp" value="' + escapeHtml(piece.tempBenefit || '') + '" placeholder="Optional flavor">' +
        (piece.rolledProperty ? '<p class="result-box" style="margin-top:0.5rem;">Rolled property: ' + escapeHtml(piece.rolledProperty) + '</p>' : '') +
        '<button type="button" class="wizard-btn secondary lpb-roll-piece" data-idx="' + i + '">Roll Piece Property (d20)</button></div>';
    });
    el.innerHTML = html;

    el.querySelectorAll('.lpb-piece-title').forEach(function (inp, i) {
      inp.addEventListener('input', function () { pieces[i].title = this.value; saveState(); });
    });
    el.querySelectorAll('.lpb-piece-type').forEach(function (sel, i) {
      sel.addEventListener('change', function () { pieces[i].type = this.value; saveState(); });
    });
    el.querySelectorAll('.lpb-piece-notes').forEach(function (ta, i) {
      ta.addEventListener('input', function () { pieces[i].notes = this.value; saveState(); });
    });
    el.querySelectorAll('.lpb-piece-acquired').forEach(function (cb, i) {
      cb.addEventListener('change', function () { pieces[i].acquired = this.checked; saveState(); });
    });
    el.querySelectorAll('.lpb-piece-temp').forEach(function (inp, i) {
      inp.addEventListener('input', function () { pieces[i].tempBenefit = this.value; saveState(); });
    });
    el.querySelectorAll('.lpb-roll-piece').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.dataset.idx, 10);
        var roll = 1 + Math.floor(Math.random() * 20);
        pieces[idx].rolledProperty = PIECE_PROPERTIES[roll - 1];
        saveState();
        renderPieces();
      });
    });
  }

  function renderProgress() {
    var el = document.getElementById('panel-progress');
    var p = getActiveProject();
    if (!p) { el.innerHTML = '<p>No project selected.</p>'; return; }

    var acquired = (p.pieces || []).filter(function (x) { return x.acquired; }).length;
    var total = p.totalPieces || 0;
    var leads = p.leads || [];
    var comps = p.complications || [];

    var html = '<p><strong>Progress: ' + acquired + ' / ' + total + ' pieces acquired</strong></p>' +
      '<label for="lpb-gp">GP spent</label><input type="text" id="lpb-gp" value="' + escapeHtml(p.gpSpent || '') + '">' +
      '<label for="lpb-downtime">Downtime weeks</label><input type="text" id="lpb-downtime" value="' + escapeHtml(p.downtimeWeeks || '') + '">' +
      '<h4 style="margin-top:1rem;">Leads</h4><div id="lpb-leads-list"></div><button type="button" id="lpb-add-lead" class="wizard-btn secondary">Add lead</button>' +
      '<h4 style="margin-top:1rem;">Complications</h4><button type="button" id="lpb-roll-comp" class="wizard-btn secondary">Roll Complication (d12)</button><div id="lpb-comps-list"></div>';

    el.innerHTML = html;

    document.getElementById('lpb-gp').addEventListener('input', function () { p.gpSpent = this.value; saveState(); });
    document.getElementById('lpb-downtime').addEventListener('input', function () { p.downtimeWeeks = this.value; saveState(); });

    function renderLeads() {
      var c = document.getElementById('lpb-leads-list');
      c.innerHTML = '';
      leads.forEach(function (lead, i) {
        var div = document.createElement('div');
        div.className = 'project-card';
        div.innerHTML = '<input type="text" class="lpb-lead-input" value="' + escapeHtml(lead) + '" data-i="' + i + '"> <button type="button" class="wizard-btn secondary lpb-rm-lead" data-i="' + i + '">Remove</button>';
        c.appendChild(div);
      });
      c.querySelectorAll('.lpb-lead-input').forEach(function (inp) {
        inp.addEventListener('input', function () { leads[parseInt(this.dataset.i, 10)] = this.value; saveState(); });
      });
      c.querySelectorAll('.lpb-rm-lead').forEach(function (btn) {
        btn.addEventListener('click', function () {
          leads.splice(parseInt(this.dataset.i, 10), 1);
          saveState();
          renderLeads();
        });
      });
    }
    renderLeads();
    document.getElementById('lpb-add-lead').addEventListener('click', function () {
      leads.push('');
      saveState();
      renderLeads();
    });

    document.getElementById('lpb-roll-comp').addEventListener('click', function () {
      var roll = 1 + Math.floor(Math.random() * 12);
      comps.push(COMPLICATIONS[roll - 1]);
      saveState();
      renderProgress();
    });

    var compList = document.getElementById('lpb-comps-list');
    compList.innerHTML = comps.map(function (c, i) {
      return '<div class="project-card">' + escapeHtml(c) + ' <button type="button" class="wizard-btn secondary lpb-rm-comp" data-i="' + i + '">Remove</button></div>';
    }).join('');
    compList.querySelectorAll('.lpb-rm-comp').forEach(function (btn) {
      btn.addEventListener('click', function () {
        comps.splice(parseInt(this.dataset.i, 10), 1);
        saveState();
        renderProgress();
      });
    });
  }

  function renderCompletion() {
    var el = document.getElementById('panel-completion');
    var p = getActiveProject();
    if (!p) { el.innerHTML = '<p>No project selected.</p>'; return; }

    var rec = p.completionRecord;
    el.innerHTML = '<div class="result-box"><p><strong>Completion rules</strong></p><ul style="margin:0.5rem 0;padding-left:1.25rem;">' +
      '<li>Final check DC 15</li><li>Success: grant core reward (free text)</li><li>Nat 20: add one extra minor property</li>' +
      '<li>Failure: delay. DM chooses: +1 downtime week +100 gp OR require +1 extra piece</li></ul></div>' +
      (rec ? '<div class="result-box"><p>Completed: ' + escapeHtml(rec.date) + ', roll ' + rec.roll + ', ' + escapeHtml(rec.outcome) + '</p><p>' + escapeHtml(rec.rewards || '') + '</p></div>' : '') +
      '<label for="lpb-comp-date">Date</label><input type="text" id="lpb-comp-date" value="' + (rec ? escapeHtml(rec.date) : '') + '">' +
      '<label for="lpb-comp-roll">Roll</label><input type="number" id="lpb-comp-roll" value="' + (rec ? rec.roll : '') + '">' +
      '<label for="lpb-comp-outcome">Outcome</label><input type="text" id="lpb-comp-outcome" value="' + (rec ? escapeHtml(rec.outcome) : '') + '">' +
      '<label for="lpb-comp-rewards">Rewards</label><textarea id="lpb-comp-rewards">' + (rec ? escapeHtml(rec.rewards || '') : '') + '</textarea>' +
      '<button type="button" id="lpb-save-completion" class="wizard-btn">Save completion record</button>';

    document.getElementById('lpb-save-completion').addEventListener('click', function () {
      p.completionRecord = {
        date: document.getElementById('lpb-comp-date').value,
        roll: parseInt(document.getElementById('lpb-comp-roll').value, 10),
        outcome: document.getElementById('lpb-comp-outcome').value,
        rewards: document.getElementById('lpb-comp-rewards').value
      };
      saveState();
      renderCompletion();
    });
  }

  function buildPromptTemplate(type, p, charBundle) {
    var prof = charBundle && charBundle.profile ? charBundle.profile : {};
    var acquired = (p.pieces || []).filter(function (x) { return x.acquired; });
    var knownPieces = (p.pieces || []).map(function (x) { return { title: x.title, type: x.type, acquired: x.acquired }; });
    var summary = {
      goal: p.goal, tier: p.tier, totalPieces: p.totalPieces,
      acquiredPieces: acquired.length, knownPieces: knownPieces,
      stakeholders: p.stakeholders, constraints: p.constraints,
      complications: p.complications || [],
      characterSummary: { name: prof.name, className: prof.className, level: prof.level }
    };
    var schema = { type: type, projectId: p.id, items: [{ title: '', text: '', tags: [], dc: null, skill: null }] };
    var prompt = 'Generate content for a D&D 5e Legacy Project.\n\nProject summary:\n' + JSON.stringify(summary, null, 2) + '\n\n';
    if (type === 'pieces') prompt += 'Generate ' + p.totalPieces + ' piece ideas with type and short description.\n\n';
    else if (type === 'hooks') prompt += 'Generate 6 adventure hooks that can contain a piece.\n\n';
    else if (type === 'downtime') prompt += 'Generate 6 downtime scenes with suggested check and DC 15 default.\n\n';
    else if (type === 'complications') prompt += 'Generate 8 complications tied to this project.\n\n';
    prompt += 'Output valid JSON only. Use this schema:\n' + JSON.stringify(schema, null, 2) + '\n\nOutput valid JSON only. No markdown.';
    return prompt;
  }

  function renderExport() {
    var el = document.getElementById('panel-export');
    var p = getActiveProject();
    var bundle = state.characterBundle;

    var trackerStr = p ? ('Legacy Project: ' + (p.goal || '(goal)') + '. Pieces: ' + (p.pieces.filter(function (x) { return x.acquired; }).length) + ' of ' + p.totalPieces + '.') : '';

    el.innerHTML = '<label>Tracker string</label><div class="copy-block">' + escapeHtml(trackerStr) + '</div>' +
      '<button type="button" id="lpb-copy-tracker2" class="wizard-btn secondary">Copy tracker</button>' +
      '<h4 style="margin-top:1rem;">Prompt templates</h4>' +
      (p ? '<p>Select a template, edit if needed, then Copy.</p>' +
        '<select id="lpb-template-sel"><option value="pieces">1) Generate Y piece ideas</option><option value="hooks">2) Generate 6 adventure hooks</option><option value="downtime">3) Generate 6 downtime scenes</option><option value="complications">4) Generate 8 complications</option></select>' +
        '<textarea id="lpb-prompt-text" rows="12" style="width:100%;font-family:monospace;font-size:0.85rem;"></textarea>' +
        '<button type="button" id="lpb-copy-prompt" class="wizard-btn secondary">Copy prompt</button>' : '<p>Select a project in Projects List to generate prompts.</p>');

    if (p) {
      document.getElementById('lpb-template-sel').addEventListener('change', function () {
        document.getElementById('lpb-prompt-text').value = buildPromptTemplate(this.value, p, bundle);
      });
      document.getElementById('lpb-prompt-text').value = buildPromptTemplate('pieces', p, bundle);
      document.getElementById('lpb-template-sel').dispatchEvent(new Event('change'));
      document.getElementById('lpb-copy-prompt').addEventListener('click', function () {
        copyToClipboard(document.getElementById('lpb-prompt-text').value);
      });
    }
    document.getElementById('lpb-copy-tracker2').addEventListener('click', function () {
      if (trackerStr) copyToClipboard(trackerStr);
    });
  }

  function handlePdfImport(file) {
    if (!file || !file.type || !file.type.includes('pdf')) return;
    if (typeof CharacterSheetImporter === 'undefined') { alert('Character importer not loaded.'); return; }
    CharacterSheetImporter.extractPdfData(file).then(function (result) {
      var text = result.text || '';
      var fieldMap = result.fieldMap || {};
      var profile = CharacterSheetImporter.parseFromFields(fieldMap, text);
      if (!state.characterBundle) state.characterBundle = createDefaultBundle(profile);
      else state.characterBundle.profile = profile;
      state.characterKey = state.characterKey || normalizeCharacterKey(profile.name + '_' + profile.className);
      var idx = loadIndex();
      if (idx.characterKeys.indexOf(state.characterKey) < 0) {
        idx.characterKeys.push(state.characterKey);
        saveIndex(idx);
      }
      saveState();
      renderStep(state.currentStep);
    }).catch(function (err) {
      alert('PDF import failed: ' + (err && err.message ? err.message : String(err)));
    });
  }

  function exportJson() {
    if (!state.characterBundle || !state.characterKey) { alert('Select a character first.'); return; }
    var blob = new Blob([JSON.stringify(Object.assign({}, state.characterBundle, { schemaVersion: SCHEMA_VERSION }), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'legacy-projects-' + (state.characterKey || 'export') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function loadJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var sv = data.schemaVersion;
        if (sv === undefined || sv === null) sv = 1;
        if (sv !== 1) {
          alert('Cannot load: schemaVersion ' + sv + ' is not supported. Expected 1.');
          return;
        }
        if (!data.profile) data.profile = { name: '', className: '', level: 0, abilities: { scores: {}, mods: {} }, proficiencyBonus: 2, skills: {} };
        if (!data.tierGating) data.tierGating = Object.assign({}, DEFAULT_TIER_GATING);
        if (!data.projects) data.projects = [];
        state.characterBundle = data;
        state.characterKey = normalizeCharacterKey((data.profile.name || '') + '_' + (data.profile.className || ''));
        var idx = loadIndex();
        if (idx.characterKeys.indexOf(state.characterKey) < 0) {
          idx.characterKeys.push(state.characterKey);
          saveIndex(idx);
        }
        saveState();
        showStep(state.currentStep);
      } catch (e) {
        alert('Failed to load JSON: ' + (e.message || String(e)));
      }
    };
    reader.readAsText(file);
  }

  function init() {
    document.getElementById('lpb-import-pdf').addEventListener('click', function () {
      document.getElementById('lpb-import-pdf-file').click();
    });
    document.getElementById('lpb-import-pdf-file').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (f) handlePdfImport(f);
      this.value = '';
    });
    document.getElementById('btn-back').addEventListener('click', function () {
      showStep(state.currentStep - 1);
    });
    document.getElementById('btn-next').addEventListener('click', function () {
      if (state.currentStep < 8) showStep(state.currentStep + 1);
      else showStep(0);
    });
    document.getElementById('btn-reset').addEventListener('click', function () {
      if (!confirm('Reset wizard state? This clears the current session but does not delete saved character data.')) return;
      state.currentStep = 0;
      state.projectId = null;
      showStep(0);
    });
    document.getElementById('btn-save-json').addEventListener('click', exportJson);
    document.getElementById('btn-load-json').addEventListener('click', function () {
      document.getElementById('lpb-load-file').click();
    });
    document.getElementById('lpb-load-file').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (f) loadJson(f);
      this.value = '';
    });

    if (!state.characterBundle) {
      var lastKey = null;
      try { lastKey = localStorage.getItem(LAST_CHAR_KEY); } catch (e) {}
      if (lastKey) state.characterBundle = loadCharacterBundle(lastKey);
      if (state.characterBundle) state.characterKey = lastKey;
    }
    if (!state.characterBundle) {
      state.characterBundle = createDefaultBundle();
      state.characterKey = null;
    }
    showStep(state.currentStep);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
