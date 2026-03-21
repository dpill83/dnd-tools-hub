(function() {
  'use strict';

  const API_BASE = '/tools/loot-box-tests/api';
  const TIER_NAMES = window.TIER_NAMES || ['Mundane', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'];
  const CR_TO_TIER = window.CR_TO_TIER || {
    '1-4': { reveal_tier_min: 1, reveal_tier_max: 2 },
    '5-8': { reveal_tier_min: 2, reveal_tier_max: 3 },
    '9-12': { reveal_tier_min: 3, reveal_tier_max: 4 },
    '13-16': { reveal_tier_min: 3, reveal_tier_max: 5 },
    '17-20': { reveal_tier_min: 4, reveal_tier_max: 5 }
  };
  const CATEGORIES = Object.keys(window.CAT_IMG || {});

  let dmKey = localStorage.getItem('dm_key') || '';
  let lootTable = null;

  const $ = function(id) { return document.getElementById(id); };

  function showTab(tabId) {
    document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('visible'); });
    document.querySelectorAll('.tab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    var el = $('tab-' + tabId);
    if (el) el.classList.add('visible');
  }

  function showError(elId, msg) {
    var el = $(elId);
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  function apiError(res, body) {
    if (res.status === 400) return (body && body.error) || 'Bad request';
    if (res.status === 403) return 'Invalid DM key for this pack';
    if (res.status === 404) return 'Pack not found';
    if (res.status === 410) return 'Pack is exhausted';
    if (res.status >= 500) return 'Server error, try again';
    return (body && body.error) || 'Request failed';
  }

  function formatDate(str) {
    if (!str) return '';
    var d = new Date(str);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function updateKeyUI() {
    var inputWrap = $('dm-key-input');
    var pill = $('dm-key-pill');
    var changeBtn = $('dm-key-change');
    var display = $('dm-key-display');
    if (dmKey) {
      if (inputWrap) inputWrap.classList.remove('visible');
      if (pill) { pill.style.display = ''; if (display) display.textContent = dmKey; }
      if (changeBtn) changeBtn.style.display = '';
    } else {
      if (inputWrap) inputWrap.classList.add('visible');
      if (pill) pill.style.display = 'none';
      if (changeBtn) changeBtn.style.display = 'none';
    }
    updateCreateAccess();
  }

  function updateCreateAccess() {
    var createTab = document.querySelector('.tab[data-tab="create"]');
    var createBtn = $('btn-create-pack');
    var locked = !dmKey;
    if (createTab) {
      createTab.style.opacity = locked ? '0.4' : '';
      createTab.style.cursor = locked ? 'not-allowed' : '';
      createTab.title = locked ? 'Enter a DM key to create packs' : '';
    }
    if (createBtn) {
      createBtn.disabled = locked;
      createBtn.style.opacity = locked ? '0.4' : '';
      createBtn.style.cursor = locked ? 'not-allowed' : '';
      createBtn.title = locked ? 'Enter a DM key to create packs' : '';
    }
  }

  function loadPacks() {
    var list = $('pack-list');
    var summary = $('packs-summary');
    var errEl = $('pack-error');
    showError('pack-error', '');
    if (!dmKey) {
      if (summary) summary.textContent = 'Enter your DM key to load packs.';
      if (list) list.innerHTML = '';
      return;
    }
    if (summary) summary.textContent = 'Loading…';
    fetch(API_BASE + '/dm/packs?dm_key=' + encodeURIComponent(dmKey))
      .then(function(res) { return res.json().then(function(body) { return { res: res, body: body }; }); })
      .then(function(_ref) {
        var res = _ref.res;
        var body = _ref.body;
        if (!res.ok) {
          showError('pack-error', 'Could not load packs. Check your key.');
          if (summary) summary.textContent = 'Error loading packs.';
          if (list) list.innerHTML = '';
          return;
        }
        var packs = Array.isArray(body) ? body : [];
        var active = packs.filter(function(p) { return p.active === 1; }).length;
        if (summary) summary.textContent = packs.length + ' pack(s) — ' + active + ' active';
        if (!list) return;
        list.innerHTML = '';
        packs.forEach(function(pack) {
          var sc = pack.slot_config || {};
          var tierMin = TIER_NAMES[sc.reveal_tier_min] || '';
          var tierMax = TIER_NAMES[sc.reveal_tier_max] || '';
          var tierStr = [tierMin, tierMax].filter(Boolean).join(' – ') || '—';
          var pct = pack.quantity ? Math.round((pack.opens_used / pack.quantity) * 100) : 0;
          var exhausted = pack.active === 0;
          var card = document.createElement('div');
          card.className = 'pack-card' + (exhausted ? ' exhausted' : '');
          if (exhausted) card.style.opacity = '0.6';
          card.innerHTML =
            '<div><div class="pack-label">' + escapeHtml(pack.label) + '</div><div class="pack-meta">' +
            '<span class="badge badge-' + pack.type + '">' + (pack.type === 'personal' ? 'Personal' : 'Shared') + '</span>' +
            '<span class="badge ' + (exhausted ? 'badge-exhausted' : 'badge-active') + '">' + (exhausted ? 'Exhausted' : 'Active') + '</span>' +
            (pack.player_name ? '<span>' + escapeHtml(pack.player_name) + '</span>' : '') +
            '<span>Qty: ' + pack.quantity + '</span>' +
            '<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:' + pct + '%;' + (exhausted ? 'background:#888780' : '') + '"></div></div>' +
            '<span>' + pack.opens_used + ' / ' + pack.quantity + ' opened</span>' +
            '<span>CR ' + (sc.cr_hint != null ? sc.cr_hint : '—') + ' · ' + tierStr + '</span>' +
            '<span>' + formatDate(pack.created_at) + '</span></div></div>' +
            '<div class="pack-actions">' +
            '<button type="button" class="btn-sm btn-history" data-id="' + escapeHtml(pack.id) + '">View History</button>' +
            (pack.active === 1 ? '<button type="button" class="btn-sm btn-deactivate" data-id="' + escapeHtml(pack.id) + '">Deactivate</button>' : '') +
            '</div>';
          list.appendChild(card);
        });
        list.querySelectorAll('.btn-history').forEach(function(btn) {
          btn.addEventListener('click', function() { openHistory(btn.getAttribute('data-id')); });
        });
        list.querySelectorAll('.btn-deactivate').forEach(function(btn) {
          btn.addEventListener('click', function() { deactivatePack(btn.getAttribute('data-id')); });
        });
      })
      .catch(function() {
        showError('pack-error', 'Could not reach server');
        if (summary) summary.textContent = 'Error loading packs.';
        if (list) list.innerHTML = '';
      });
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function openHistory(packId) {
    fetch(API_BASE + '/dm/pack/' + packId + '/history?dm_key=' + encodeURIComponent(dmKey))
      .then(function(res) { return res.json().then(function(body) { return { res: res, body: body }; }); })
      .then(function(_ref) {
        var res = _ref.res;
        var body = _ref.body;
        var modal = $('history-modal');
        var header = $('history-header');
        var sub = $('history-sub');
        var listEl = $('history-list');
        if (!res.ok) {
          alert(apiError(res, body));
          return;
        }
        var pack = body.pack || {};
        var opens = body.opens || [];
        if (header) header.textContent = pack.label || 'History';
        if (sub) sub.textContent = pack.opens_used + ' of ' + pack.quantity + ' opens · ' + (pack.type === 'shared' ? 'Shared' : 'Personal') + (pack.slot_config && pack.slot_config.cr_hint != null ? ' · CR ' + pack.slot_config.cr_hint : '');
        if (listEl) {
          listEl.innerHTML = '';
          opens.forEach(function(o) {
            var items = (o.items && o.items.mundane) || [];
            var reveal = o.items && o.items.reveal;
            if (reveal) items = items.concat([{ name: reveal.name + ' (' + (reveal.rarity || '') + ')', reveal: true }]);
            var row = document.createElement('div');
            row.className = 'history-row';
            row.innerHTML = '<div class="history-meta">' + formatDate(o.opened_at) + '</div><div class="history-items">' +
              items.map(function(it) {
                return '<span class="history-item' + (it.reveal ? ' reveal' : '') + '">' + escapeHtml(it.name || '') + '</span>';
              }).join('') + '</div>';
            listEl.appendChild(row);
          });
        }
        if (modal) modal.classList.add('visible');
      })
      .catch(function() { alert('Could not reach server'); });
  }

  function deactivatePack(packId) {
    fetch(API_BASE + '/dm/pack/' + packId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dm_key: dmKey, active: false })
    })
      .then(function(res) { return res.json().then(function(body) { return { res: res, body: body }; }); })
      .then(function(_ref) {
        if (!_ref.res.ok) alert(apiError(_ref.res, _ref.body));
        else loadPacks();
      })
      .catch(function() { alert('Could not reach server'); });
  }

  function crToTierRange(cr) {
    var v = parseInt(cr, 10);
    if (v <= 4) return CR_TO_TIER['1-4'];
    if (v <= 8) return CR_TO_TIER['5-8'];
    if (v <= 12) return CR_TO_TIER['9-12'];
    if (v <= 16) return CR_TO_TIER['13-16'];
    return CR_TO_TIER['17-20'];
  }

  function buildCreateForm() {
    var catGrid = $('cat-grid');
    if (catGrid && CATEGORIES.length) {
      catGrid.innerHTML = '';
      CATEGORIES.forEach(function(cat) {
        var chip = document.createElement('div');
        chip.className = 'cat-chip';
        chip.setAttribute('data-cat', cat);
        chip.textContent = cat;
        chip.addEventListener('click', function() { chip.classList.toggle('on'); });
        catGrid.appendChild(chip);
      });
    }

    var crInput = $('form-cr');
    var tierMin = $('form-tier-min');
    var tierMax = $('form-tier-max');
    var suggest = $('cr-suggest');
    if (crInput && tierMin && tierMax && suggest) {
      function updateCr() {
        var v = parseInt(crInput.value, 10);
        var range = crToTierRange(v);
        if (range) {
          tierMin.value = String(range.reveal_tier_min);
          tierMax.value = String(range.reveal_tier_max);
          suggest.textContent = 'Suggested: ' + (TIER_NAMES[range.reveal_tier_min] || '') + ' – ' + (TIER_NAMES[range.reveal_tier_max] || '');
        }
        $('cr-val').textContent = v;
      }
      crInput.addEventListener('input', updateCr);
    }

    $('form-quantity').addEventListener('input', function() { $('qty-val').textContent = this.value; });
    $('form-mundane').addEventListener('input', function() { $('mundane-val').textContent = this.value; });

    var typeShared = document.querySelector('.radio-pill[data-type="shared"]');
    var typePersonal = document.querySelector('.radio-pill[data-type="personal"]');
    var playerWrap = document.querySelector('.form-group-player');
    if (typeShared && typePersonal && playerWrap) {
      function setType(type) {
        typeShared.classList.toggle('selected', type === 'shared');
        typePersonal.classList.toggle('selected', type === 'personal');
        playerWrap.style.display = type === 'personal' ? '' : 'none';
      }
      typeShared.addEventListener('click', function() { setType('shared'); });
      typePersonal.addEventListener('click', function() { setType('personal'); });
    }

    var searchInput = $('form-item-search');
    var searchResults = $('search-results');
    var guaranteedId = $('form-guaranteed-id');
    var clearBtn = $('form-item-clear');
    if (searchInput && searchResults) {
      searchInput.addEventListener('input', function() {
        var q = this.value.trim().toLowerCase();
        if (q.length < 2) {
          searchResults.style.display = 'none';
          searchResults.innerHTML = '';
          return;
        }
        if (!lootTable || !lootTable.items) {
          fetch('/api/loot-table').then(function(r) { return r.json(); }).then(function(data) { lootTable = data; doSearch(q); }).catch(function() { searchResults.innerHTML = '<div class="search-item">Load failed</div>'; searchResults.style.display = 'block'; });
          return;
        }
        doSearch(q);
      });

      function doSearch(q) {
        var items = (lootTable.items || []).filter(function(it) { return (it.name || '').toLowerCase().includes(q); }).slice(0, 8);
        searchResults.innerHTML = items.map(function(it) {
          return '<div class="search-item" data-id="' + it.id + '" data-name="' + escapeHtml(it.name) + '">' + escapeHtml(it.name) + ' <span class="search-rarity">' + escapeHtml(it.rarity || '') + '</span></div>';
        }).join('');
        searchResults.style.display = items.length ? 'block' : 'none';
        searchResults.querySelectorAll('.search-item').forEach(function(el) {
          el.addEventListener('click', function() {
            guaranteedId.value = el.getAttribute('data-id');
            searchInput.value = el.getAttribute('data-name');
            searchResults.style.display = 'none';
            if (clearBtn) clearBtn.style.display = '';
          });
        });
      }
    }
    if (clearBtn && guaranteedId) {
      clearBtn.addEventListener('click', function() {
        guaranteedId.value = '';
        $('form-item-search').value = '';
        clearBtn.style.display = 'none';
      });
    }
  }

  function submitCreate(e) {
    e.preventDefault();
    if (!dmKey) {
      alert('Please enter and save your DM key first.');
      return;
    }
    var typeEl = document.querySelector('.radio-pill.selected[data-type]');
    var type = typeEl ? typeEl.getAttribute('data-type') : 'shared';
    var playerName = type === 'personal' ? ($('form-player-name') && $('form-player-name').value.trim()) : '';
    if (type === 'personal' && !playerName) {
      alert('Player name is required for personal packs.');
      return;
    }
    var quantity = parseInt($('form-quantity').value, 10) || 1;
    var slot_config = {
      mundane_count: parseInt($('form-mundane').value, 10) || 3,
      reveal_tier_min: parseInt($('form-tier-min').value, 10),
      reveal_tier_max: parseInt($('form-tier-max').value, 10),
      categories: [],
      cr_hint: parseInt($('form-cr').value, 10) || 10
    };
    var catChips = document.querySelectorAll('#cat-grid .cat-chip.on');
    if (catChips.length) {
      slot_config.categories = Array.from(catChips).map(function(c) { return c.getAttribute('data-cat'); }).filter(Boolean);
    }
    var gid = $('form-guaranteed-id').value.trim();
    var guaranteed_item_id = gid ? parseInt(gid, 10) : null;
    if (isNaN(guaranteed_item_id)) guaranteed_item_id = null;

    var payload = {
      dm_key: dmKey,
      label: $('form-label').value.trim(),
      type: type,
      quantity: quantity,
      slot_config: slot_config,
      guaranteed_item_id: guaranteed_item_id
    };
    if (type === 'personal') payload.player_name = playerName;

    fetch(API_BASE + '/pack/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(res) { return res.json().then(function(body) { return { res: res, body: body }; }); })
      .then(function(_ref) {
        if (!_ref.res.ok) {
          alert(apiError(_ref.res, _ref.body));
          return;
        }
        var b = _ref.body;
        var base = location.origin + (location.pathname.indexOf('/tools/') >= 0 ? '/tools/loot-box-tests' : '');
        var packUrl = base + '/pack/' + b.id;
        $('result-title').textContent = b.label || '';
        $('result-sub').textContent = (b.type === 'shared' ? 'Shared' : 'Personal') + ' pack created successfully';
        var sc = slot_config;
        $('result-stats').innerHTML =
          '<span class="stat-pill">' + (b.type === 'shared' ? 'Shared' : 'Personal') + '</span>' +
          '<span class="stat-pill">Qty: ' + b.quantity + '</span>' +
          '<span class="stat-pill">CR ' + sc.cr_hint + '</span>' +
          '<span class="stat-pill">' + (TIER_NAMES[sc.reveal_tier_min] || '') + ' – ' + (TIER_NAMES[sc.reveal_tier_max] || '') + '</span>' +
          (sc.categories && sc.categories.length ? '<span class="stat-pill">' + sc.categories.join(', ') + '</span>' : '');
        $('result-link-url').textContent = packUrl;

        var qrContainer = $('qr-container');
        qrContainer.innerHTML = '';
        if (window.QRCode) {
          new QRCode(qrContainer, {
            text: packUrl,
            width: 160,
            height: 160,
            colorDark: '#c9a84c',
            colorLight: '#050300'
          });
        }

        showTab('result');
      })
      .catch(function() { alert('Could not reach server'); });
  }

  function init() {
    dmKey = localStorage.getItem('dm_key') || '';
    updateKeyUI();

    $('dm-key-submit').addEventListener('click', function() {
      var val = ($('dm-key-field') && $('dm-key-field').value || '').trim();
      if (!val) return;
      dmKey = val;
      localStorage.setItem('dm_key', dmKey);
      updateKeyUI();
      loadPacks();
    });

    $('dm-key-change').addEventListener('click', function() {
      dmKey = '';
      localStorage.removeItem('dm_key');
      updateKeyUI();
      $('pack-list').innerHTML = '';
      $('packs-summary').textContent = 'Enter your DM key to load packs.';
    });

    document.querySelectorAll('.tab').forEach(function(t) {
      t.addEventListener('click', function() {
        var tab = t.getAttribute('data-tab');
        if (tab === 'create' && !dmKey) {
          showError('pack-error', 'Enter and save your DM key before creating a pack.');
          showTab('packs');
          return;
        }
        if (tab) showTab(tab);
      });
    });

    $('btn-create-pack').addEventListener('click', function() {
      if (!dmKey) {
        showError('pack-error', 'Enter and save your DM key before creating a pack.');
        return;
      }
      showTab('create');
    });
    $('form-cancel').addEventListener('click', function() { showTab('packs'); });
    $('create-form').addEventListener('submit', submitCreate);

    $('result-copy').addEventListener('click', function() {
      var url = $('result-link-url').textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function() { alert('Copied to clipboard'); }).catch(function() { fallbackCopy(url); });
      } else fallbackCopy(url);
    });
    function fallbackCopy(str) {
      var ta = document.createElement('textarea');
      ta.value = str;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Copied to clipboard');
    }

    $('result-download-qr').addEventListener('click', function() {
      var canvas = $('qr-container') && $('qr-container').querySelector('canvas');
      if (!canvas) return;
      var a = document.createElement('a');
      a.download = 'pack-qr.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    });

    $('result-create-another').addEventListener('click', function() {
      showTab('create');
      $('form-label').value = '';
      $('form-guaranteed-id').value = '';
      $('form-item-search').value = '';
      $('form-item-clear').style.display = 'none';
    });

    $('result-back').addEventListener('click', function() {
      showTab('packs');
      loadPacks();
    });

    $('history-modal').addEventListener('click', function(ev) {
      if (ev.target === this) this.classList.remove('visible');
    });

    buildCreateForm();
    if (dmKey) loadPacks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
