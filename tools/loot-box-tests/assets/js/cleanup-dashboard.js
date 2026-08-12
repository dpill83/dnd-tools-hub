(function () {
  'use strict';

  var API = '/tools/loot-box-tests/api/cleanup';
  var REVIEWERS = ['Dan', 'Ted', 'Dani'];
  var RARITIES = ['Unknown', 'Mundane', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'];
  var CATEGORIES = [
    'Adventuring Gear', 'Armor', 'Book', 'Potion', 'Quest Hook', 'Ring', 'Treasure', 'Weapon', 'Wondrous Item'
  ];
  var STORAGE_REVIEWER = 'loot-cleanup-reviewer';
  var STORAGE_VIEW = 'loot-cleanup-view';
  var STORAGE_FILTERS = 'loot-cleanup-filters';

  var state = {
    overview: null,
    view: 'dashboard',
    reviewer: 'Dan',
    bucketSort: { key: 'category', dir: 1 },
    filters: {
      reviewer: '',
      category: '',
      rarity: '',
      complete: '',
      flagReason: '',
    },
    resume: null,
    review: {
      bucketId: null,
      bucket: null,
      items: [],
      index: 0,
      baseline: null,
    },
    flagged: [],
  };

  var $ = function (id) { return document.getElementById(id); };

  function setStatus(msg, kind) {
    var el = $('status-line');
    el.textContent = msg || '';
    el.className = 'status-line' + (kind ? ' ' + kind : '');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function api(path, opts) {
    var res = await fetch(API + path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-cache',
    }, opts || {}));
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok && res.status !== 207) {
      var err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    if (res.status === 207) {
      data = data || {};
      data._partial = true;
      data._status = 207;
    }
    return data;
  }

  function loadPrefs() {
    try {
      var r = localStorage.getItem(STORAGE_REVIEWER);
      if (REVIEWERS.indexOf(r) >= 0) state.reviewer = r;
      var v = localStorage.getItem(STORAGE_VIEW);
      if (v) state.view = v;
      var f = localStorage.getItem(STORAGE_FILTERS);
      if (f) Object.assign(state.filters, JSON.parse(f));
    } catch (e) { /* ignore */ }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_REVIEWER, state.reviewer);
      localStorage.setItem(STORAGE_VIEW, state.view);
      localStorage.setItem(STORAGE_FILTERS, JSON.stringify(state.filters));
    } catch (e) { /* ignore */ }
  }

  function showView(name) {
    state.view = name;
    savePrefs();
    document.querySelectorAll('.view').forEach(function (el) {
      el.classList.toggle('active', el.id === 'view-' + name);
    });
    document.querySelectorAll('.nav-btn[data-view]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === name);
    });
  }

  function fillSelect(el, values, includeBlank) {
    var cur = el.value;
    el.innerHTML = includeBlank ? '<option value="">All</option>' : '';
    values.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      el.appendChild(opt);
    });
    if (cur) el.value = cur;
  }

  async function syncAndRefresh() {
    setStatus('Syncing…');
    await api('/sync', { method: 'POST', body: '{}' });
    await refreshAll();
    setStatus('Synced.', 'ok');
  }

  async function refreshAll() {
    setStatus('Loading…');
    state.overview = await api('/overview');
    renderDashboard();
    renderBuckets();
    await loadResume();
    if (state.view === 'flagged') await loadFlagged();
    setStatus('');
  }

  function renderDashboard() {
    var o = state.overview;
    if (!o) return;
    $('overall-progress').textContent =
      o.examined + ' / ' + o.total + ' reviewed — ' + o.percent + '%';

    var s = o.byStatus || {};
    $('overall-stats').innerHTML = [
      ['Unreviewed', s.unreviewed || 0],
      ['Reviewed', s.reviewed || 0],
      ['Corrected', s.corrected || 0],
      ['Flagged', s.flagged || 0],
      ['Needs source', s.needs_source || 0],
    ].map(function (pair) {
      return '<div class="stat"><div class="n">' + pair[1] + '</div><div class="l">' + pair[0] + '</div></div>';
    }).join('');

    var tb = $('reviewer-table').querySelector('tbody');
    tb.innerHTML = (o.reviewers || []).map(function (r) {
      return '<tr>' +
        '<td>' + esc(r.reviewer) + '</td>' +
        '<td class="num">' + r.assigned + '</td>' +
        '<td class="num">' + r.reviewed + '</td>' +
        '<td class="num">' + r.remaining + '</td>' +
        '<td class="num">' + r.flagged + '</td>' +
        '</tr>';
    }).join('');

    var cats = {};
    var rars = {};
    (o.buckets || []).forEach(function (b) {
      cats[b.category] = true;
      rars[b.rarity] = true;
    });
    fillSelect($('filter-category'), Object.keys(cats).sort(), true);
    fillSelect($('filter-rarity'), Object.keys(rars).sort(), true);
  }

  async function loadResume() {
    try {
      var data = await api('/resume?reviewer=' + encodeURIComponent(state.reviewer));
      state.resume = data.resume || null;
    } catch (e) {
      state.resume = null;
    }
    var card = $('resume-card');
    if (!state.resume) {
      card.classList.add('hidden');
      return;
    }
    var r = state.resume;
    $('resume-text').textContent =
      (r.category || '') + ' / ' + (r.rarity || '') +
      ' — ' + (r.examined || 0) + ' / ' + (r.item_count || 0) + ' reviewed' +
      (r.next_item_id != null ? (' — continue with item ' + r.next_item_id +
        (r.next_item_name ? ' (' + r.next_item_name + ')' : '')) : '');
    card.classList.remove('hidden');
  }

  function filteredBuckets() {
    var list = (state.overview && state.overview.buckets) || [];
    var f = state.filters;
    return list.filter(function (b) {
      if (f.reviewer === '__mine' && b.assigned_to !== state.reviewer) return false;
      if (f.reviewer === '__unassigned' && b.assigned_to) return false;
      if (f.reviewer && f.reviewer.indexOf('__') !== 0 && b.assigned_to !== f.reviewer) return false;
      if (f.category && b.category !== f.category) return false;
      if (f.rarity && b.rarity !== f.rarity) return false;
      if (f.complete === 'incomplete' && b.review_complete) return false;
      if (f.complete === 'review_complete' && !b.review_complete) return false;
      if (f.complete === 'cleanup_complete' && !b.cleanup_complete) return false;
      if (f.complete === 'has_flags' && !(b.flagged > 0)) return false;
      return true;
    }).sort(function (a, b) {
      var k = state.bucketSort.key;
      var dir = state.bucketSort.dir;
      var av = a[k];
      var bv = b[k];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  function renderBuckets() {
    var tb = $('bucket-table').querySelector('tbody');
    var rows = filteredBuckets();
    tb.innerHTML = rows.map(function (b) {
      var badge = b.cleanup_complete
        ? '<span class="badge ok">Cleanup complete</span>'
        : (b.review_complete
          ? '<span class="badge warn">Review complete</span>'
          : '<span class="badge">In progress</span>');
      var assignOpts = ['<option value="">—</option>'].concat(REVIEWERS.map(function (r) {
        return '<option value="' + r + '"' + (b.assigned_to === r ? ' selected' : '') + '>' + r + '</option>';
      })).join('');
      return '<tr data-bucket-id="' + esc(b.bucket_id) + '">' +
        '<td>' + esc(b.category) + '</td>' +
        '<td>' + esc(b.rarity) + '</td>' +
        '<td class="num">' + b.item_count + '</td>' +
        '<td><select class="assign-select" data-id="' + esc(b.bucket_id) + '">' + assignOpts + '</select></td>' +
        '<td>' + b.examined + ' / ' + b.item_count + ' ' + badge + '</td>' +
        '<td class="num">' + b.flagged + '</td>' +
        '<td><button type="button" class="btn open-bucket" data-id="' + esc(b.bucket_id) + '">Open</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="7" class="sub">No buckets match filters.</td></tr>';
  }

  async function openBucket(bucketId, preferItemId) {
    setStatus('Loading bucket…');
    var data = await api('/buckets/' + encodeURIComponent(bucketId));
    state.review.bucketId = bucketId;
    state.review.bucket = data.bucket;
    state.review.items = data.items || [];
    var idx = 0;
    if (preferItemId != null) {
      var found = state.review.items.findIndex(function (it) {
        return Number(it.item_id) === Number(preferItemId);
      });
      if (found >= 0) idx = found;
    } else {
      var firstUn = state.review.items.findIndex(function (it) {
        return it.status === 'unreviewed';
      });
      if (firstUn >= 0) idx = firstUn;
    }
    state.review.index = idx;
    showView('review');
    renderReview();
    setStatus('');
  }

  function currentReviewItem() {
    return state.review.items[state.review.index] || null;
  }

  function formFields() {
    return {
      name: $('f-name').value.trim(),
      category: $('f-category').value,
      rarity: $('f-rarity').value,
      value: $('f-value').value === '' ? 0 : Number($('f-value').value),
      value_raw: $('f-value-raw').value,
      weight: $('f-weight').value,
      author: $('f-author').value,
      requirements: $('f-requirements').value,
      icon: $('f-icon').value,
      description: $('f-description').value,
      properties: $('f-properties').value,
    };
  }

  function populateForm(row) {
    var item = (row && row.item) || {};
    $('f-id').value = row ? row.item_id : '';
    $('f-status').value = row ? row.status : '';
    $('f-name').value = item.name || '';
    $('f-category').value = item.category || CATEGORIES[0];
    $('f-rarity').value = item.rarity || RARITIES[0];
    $('f-tier').value = item.tier != null ? item.tier : '';
    $('f-value').value = item.value != null ? item.value : '';
    $('f-value-raw').value = item.value_raw != null ? item.value_raw : '';
    $('f-weight').value = item.weight != null ? item.weight : '';
    $('f-author').value = item.author != null ? item.author : '';
    $('f-requirements').value = item.requirements != null ? item.requirements : '';
    $('f-icon').value = item.icon != null ? item.icon : '';
    $('f-description').value = item.description != null ? item.description : '';
    $('f-properties').value = item.properties != null ? item.properties : '';
    state.review.baseline = formFields();
    $('checklist').querySelectorAll('input[type=checkbox]').forEach(function (c) {
      c.checked = false;
    });
    $('flag-panel').classList.add('hidden');
    $('btn-flag-next').classList.add('hidden');
    $('f-flag-note').value = row && row.flag_note ? row.flag_note : '';
    if (row && row.flag_reason) $('f-flag-reason').value = row.flag_reason;
    renderIssues(item);
    loadHistory(row && row.item_id);
  }

  function formDirty() {
    var cur = formFields();
    var base = state.review.baseline || {};
    return Object.keys(cur).some(function (k) {
      return String(cur[k] == null ? '' : cur[k]) !== String(base[k] == null ? '' : base[k]);
    });
  }

  function renderIssues(item) {
    var issues = [];
    if (!item) {
      $('possible-issues').innerHTML = '';
      return;
    }
    if (!String(item.author || '').trim()) issues.push('Missing author');
    if (!String(item.description || '').trim()) issues.push('Blank description');
    if (item.value == null || Number(item.value) === 0) issues.push('Value is 0 gp');
    $('possible-issues').innerHTML = issues.length
      ? issues.map(function (i) { return '<li>⚠ ' + esc(i) + '</li>'; }).join('')
      : '';
  }

  async function loadHistory(itemId) {
    var list = $('history-list');
    if (itemId == null) {
      list.innerHTML = '<li class="sub">No item selected.</li>';
      return;
    }
    try {
      var data = await api('/items/' + itemId + '/history');
      var changes = data.changes || [];
      if (!changes.length) {
        list.innerHTML = '<li class="sub">No changes yet.</li>';
        return;
      }
      list.innerHTML = changes.map(function (c) {
        return '<li><strong>' + esc(c.field) + '</strong>: ' +
          esc(c.old_value) + ' → ' + esc(c.new_value) +
          '<br><span>' + esc(c.reviewer) + ' · ' + esc(c.created_at) + '</span></li>';
      }).join('');
    } catch (e) {
      list.innerHTML = '<li class="sub">Could not load history.</li>';
    }
  }

  function renderReview() {
    var bucket = state.review.bucket;
    var items = state.review.items;
    if (!bucket || !items.length) {
      $('review-empty').classList.remove('hidden');
      $('review-body').classList.add('hidden');
      $('review-title').textContent = 'Select a bucket';
      $('review-progress').textContent = '—';
      return;
    }
    $('review-empty').classList.add('hidden');
    $('review-body').classList.remove('hidden');
    $('review-title').textContent = bucket.category + ' / ' + bucket.rarity;
    var idx = state.review.index;
    var examined = items.filter(function (i) { return i.status !== 'unreviewed'; }).length;
    $('review-progress').textContent =
      'Item ' + (idx + 1) + ' of ' + items.length +
      ' · ' + examined + ' / ' + items.length + ' reviewed' +
      (bucket.cleanup_complete ? ' · Cleanup complete' :
        (bucket.review_complete ? ' · Review complete' : ''));
    $('btn-prev').disabled = idx <= 0;
    $('btn-next').disabled = idx >= items.length - 1;
    populateForm(items[idx]);
  }

  async function submitReview(opts) {
    var row = currentReviewItem();
    if (!row) return;
    var status = opts.status;
    var goNext = !!opts.goNext;
    var fields = null;
    var dirty = formDirty();

    if (status === 'reviewed' && dirty) {
      setStatus('Form has edits — use Save, or revert fields for “Reviewed, No Changes”.', 'error');
      return;
    }
    if (status === 'flagged') {
      var note = $('f-flag-note').value.trim();
      if (!note) {
        $('flag-panel').classList.remove('hidden');
        $('btn-flag-next').classList.remove('hidden');
        setStatus('Flag note is required.', 'error');
        return;
      }
    }
    if (dirty || status === 'corrected') {
      fields = formFields();
      if (!dirty && status === 'corrected') {
        // resolve flag without field edits — omit fields
        fields = null;
      }
    }

    var body = {
      reviewer: state.reviewer,
      status: status,
      fields: fields,
    };
    if (status === 'flagged') {
      body.flag_reason = $('f-flag-reason').value;
      body.flag_note = $('f-flag-note').value.trim();
    }

    setStatus('Saving…');
    try {
      var result = await api('/items/' + row.item_id + '/review', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (result._partial || result.partial) {
        setStatus('Item saved to R2, but cleanup metadata failed. Try Sync, then retry.', 'error');
      } else {
        setStatus('Saved.', 'ok');
      }
      if (result.item && state.review.items[state.review.index]) {
        state.review.items[state.review.index].item = result.item;
        state.review.items[state.review.index].status = (result.cleanup && result.cleanup.status) || status;
        state.review.items[state.review.index].reviewer = state.reviewer;
        if (status === 'flagged') {
          state.review.items[state.review.index].flag_reason = body.flag_reason;
          state.review.items[state.review.index].flag_note = body.flag_note;
        } else {
          state.review.items[state.review.index].flag_reason = null;
          state.review.items[state.review.index].flag_note = null;
        }
      }
      if (goNext && state.review.index < state.review.items.length - 1) {
        state.review.index += 1;
        renderReview();
      } else {
        renderReview();
      }
      // soft refresh overview in background
      api('/overview').then(function (o) {
        state.overview = o;
        renderDashboard();
        renderBuckets();
      }).catch(function () { /* ignore */ });
    } catch (e) {
      setStatus(e.message || 'Save failed', 'error');
    }
  }

  async function loadFlagged() {
    var q = state.filters.flagReason
      ? ('?flag_reason=' + encodeURIComponent(state.filters.flagReason))
      : '';
    var data = await api('/flagged' + q);
    state.flagged = data.items || [];
    var tb = $('flagged-table').querySelector('tbody');
    tb.innerHTML = state.flagged.map(function (it) {
      return '<tr>' +
        '<td>' + esc(it.name || ('#' + it.item_id)) + '</td>' +
        '<td>' + esc(it.category) + '</td>' +
        '<td>' + esc(it.rarity) + '</td>' +
        '<td>' + esc(it.reviewer) + '</td>' +
        '<td>' + esc(it.flag_reason) + '</td>' +
        '<td>' + esc(it.flag_note) + '</td>' +
        '<td>' + esc(it.flagged_at) + '</td>' +
        '<td>' +
          '<button type="button" class="btn open-flag" data-bucket="' + esc(it.bucket_id) +
          '" data-item="' + it.item_id + '">Open</button> ' +
          '<button type="button" class="btn resolve-flag" data-item="' + it.item_id +
          '" data-status="reviewed">Resolve OK</button> ' +
          '<button type="button" class="btn resolve-flag" data-item="' + it.item_id +
          '" data-status="corrected">Resolve Corrected</button>' +
        '</td></tr>';
    }).join('') || '<tr><td colspan="8" class="sub">No flagged items.</td></tr>';
  }

  function initFormSelects() {
    fillSelect($('f-category'), CATEGORIES, false);
    fillSelect($('f-rarity'), RARITIES, false);
  }

  function wire() {
    loadPrefs();
    $('reviewer-select').value = state.reviewer;
    $('filter-reviewer').value = state.filters.reviewer || '';
    $('filter-complete').value = state.filters.complete || '';
    $('filter-flag-reason').value = state.filters.flagReason || '';
    initFormSelects();

    document.querySelectorAll('.nav-btn[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-view');
        showView(v);
        if (v === 'flagged') loadFlagged().catch(function (e) {
          setStatus(e.message, 'error');
        });
        if (v === 'buckets') renderBuckets();
      });
    });

    $('reviewer-select').addEventListener('change', function () {
      state.reviewer = $('reviewer-select').value;
      savePrefs();
      loadResume();
      renderBuckets();
    });

    $('btn-sync').addEventListener('click', function () {
      syncAndRefresh().catch(function (e) { setStatus(e.message, 'error'); });
    });
    $('btn-refresh').addEventListener('click', function () {
      refreshAll().catch(function (e) { setStatus(e.message, 'error'); });
    });
    $('btn-resume').addEventListener('click', function () {
      if (!state.resume) return;
      openBucket(state.resume.bucket_id, state.resume.next_item_id).catch(function (e) {
        setStatus(e.message, 'error');
      });
    });

    ['filter-reviewer', 'filter-category', 'filter-rarity', 'filter-complete'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        state.filters.reviewer = $('filter-reviewer').value;
        state.filters.category = $('filter-category').value;
        state.filters.rarity = $('filter-rarity').value;
        state.filters.complete = $('filter-complete').value;
        savePrefs();
        renderBuckets();
      });
    });

    $('filter-flag-reason').addEventListener('change', function () {
      state.filters.flagReason = $('filter-flag-reason').value;
      savePrefs();
      loadFlagged().catch(function (e) { setStatus(e.message, 'error'); });
    });

    $('bucket-table').addEventListener('click', function (ev) {
      var openBtn = ev.target.closest('.open-bucket');
      if (openBtn) {
        openBucket(openBtn.getAttribute('data-id')).catch(function (e) {
          setStatus(e.message, 'error');
        });
      }
    });

    $('bucket-table').addEventListener('change', function (ev) {
      var sel = ev.target.closest('.assign-select');
      if (!sel) return;
      var id = sel.getAttribute('data-id');
      var assigned = sel.value || null;
      api('/buckets/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify({ assigned_to: assigned }),
      }).then(function () {
        return refreshAll();
      }).catch(function (e) {
        setStatus(e.message, 'error');
      });
    });

    $('bucket-table').querySelector('thead').addEventListener('click', function (ev) {
      var th = ev.target.closest('th[data-sort]');
      if (!th) return;
      var key = th.getAttribute('data-sort');
      if (state.bucketSort.key === key) state.bucketSort.dir *= -1;
      else {
        state.bucketSort.key = key;
        state.bucketSort.dir = 1;
      }
      renderBuckets();
    });

    $('btn-balance').addEventListener('click', function () {
      api('/assign-balanced', { method: 'POST', body: JSON.stringify({ reassignAll: false }) })
        .then(function () { return refreshAll(); })
        .then(function () { setStatus('Assigned unassigned buckets.', 'ok'); })
        .catch(function (e) { setStatus(e.message, 'error'); });
    });
    $('btn-rebalance').addEventListener('click', function () {
      if (!confirm('Reassign all buckets by item count? Review progress on items is kept.')) return;
      api('/assign-balanced', { method: 'POST', body: JSON.stringify({ reassignAll: true }) })
        .then(function () { return refreshAll(); })
        .then(function () { setStatus('Rebalanced all buckets.', 'ok'); })
        .catch(function (e) { setStatus(e.message, 'error'); });
    });

    $('btn-prev').addEventListener('click', function () {
      if (state.review.index > 0) {
        state.review.index -= 1;
        renderReview();
      }
    });
    $('btn-next').addEventListener('click', function () {
      if (state.review.index < state.review.items.length - 1) {
        state.review.index += 1;
        renderReview();
      }
    });
    $('btn-back-buckets').addEventListener('click', function () {
      showView('buckets');
      renderBuckets();
    });

    $('btn-reviewed').addEventListener('click', function () {
      submitReview({ status: 'reviewed', goNext: true });
    });
    $('btn-save').addEventListener('click', function () {
      submitReview({ status: formDirty() ? 'corrected' : 'reviewed', goNext: false });
    });
    $('btn-save-next').addEventListener('click', function () {
      submitReview({ status: formDirty() ? 'corrected' : 'reviewed', goNext: true });
    });
    $('btn-flag-toggle').addEventListener('click', function () {
      $('flag-panel').classList.toggle('hidden');
      $('btn-flag-next').classList.toggle('hidden', $('flag-panel').classList.contains('hidden'));
    });
    $('btn-flag-next').addEventListener('click', function () {
      submitReview({ status: 'flagged', goNext: true });
    });
    $('btn-needs-source').addEventListener('click', function () {
      submitReview({ status: 'needs_source', goNext: true });
    });

    $('f-rarity').addEventListener('change', function () {
      var map = {
        Unknown: 0, Mundane: 0, Common: 1, Uncommon: 2,
        Rare: 3, 'Very Rare': 4, Legendary: 5,
      };
      $('f-tier').value = map[$('f-rarity').value] != null ? map[$('f-rarity').value] : '';
    });

    $('flagged-table').addEventListener('click', function (ev) {
      var open = ev.target.closest('.open-flag');
      if (open) {
        openBucket(open.getAttribute('data-bucket'), open.getAttribute('data-item'))
          .catch(function (e) { setStatus(e.message, 'error'); });
        return;
      }
      var resolve = ev.target.closest('.resolve-flag');
      if (resolve) {
        var itemId = resolve.getAttribute('data-item');
        var status = resolve.getAttribute('data-status');
        setStatus('Resolving…');
        api('/items/' + itemId + '/review', {
          method: 'POST',
          body: JSON.stringify({ reviewer: state.reviewer, status: status }),
        }).then(function () {
          return loadFlagged();
        }).then(function () {
          return refreshAll();
        }).then(function () {
          setStatus('Resolved.', 'ok');
        }).catch(function (e) {
          setStatus(e.message, 'error');
        });
      }
    });

    showView(state.view === 'review' ? 'dashboard' : state.view);
  }

  wire();
  refreshAll().catch(function (e) {
    setStatus(e.message || 'Failed to load. Apply D1 schema and seed R2 loot table.', 'error');
  });
})();
