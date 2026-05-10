(function () {
  var STORAGE_KEY = 'bobh2-display-cmd';
  var LEGACY_KEY = 'stakeout-clock-cmd';
  var HEAVY_STAKEOUT_ACTION = {
    start: 1,
    pause: 1,
    resume: 1,
    reset: 1,
    jump: 1,
    watchman: 1,
  };

  var lastCmdTs = -1;
  var stakeApi = null;

  function el(id) {
    return document.getElementById(id);
  }

  function mountStakeoutIfNeeded() {
    if (stakeApi) return stakeApi;
    var host = el('stakeout-host');
    var tmpl = el('tmpl-stakeout');
    host.innerHTML = '';
    host.appendChild(tmpl.content.cloneNode(true));

    stakeApi = window.BoBH2StakeoutClock.mount(host, {
      showShellMedia: showShellMedia,
      hideShellMedia: function () {
        hideShellMediaOverlay(true);
      },
    });
    return stakeApi;
  }

  function showShellMedia(src) {
    el('shell-image').src = src;
    el('shell-image-overlay').classList.add('visible');
  }

  function hideShellMediaOverlay(fromStakeoutHook) {
    el('shell-image-overlay').classList.remove('visible');
    if (stakeApi && !fromStakeoutHook) stakeApi.shellDismissSync();
    reconcileMainLayers();
  }

  function showStakeoutChrome() {
    el('idle-layer').classList.add('hidden');
    el('stakeout-host').classList.add('visible');
  }

  function reconcileMainLayers() {
    if (el('shell-image-overlay').classList.contains('visible')) return;
    if (stakeApi && stakeApi.clockEverEngaged()) {
      showStakeoutChrome();
    } else {
      el('stakeout-host').classList.remove('visible');
      el('idle-layer').classList.remove('hidden');
    }
  }

  function applyCmd(cmd) {
    if (!cmd || cmd.action === undefined || cmd.action === null) return;
    if (cmd.ts != null && cmd.ts === lastCmdTs) return;
    if (cmd.ts != null) lastCmdTs = cmd.ts;

    var action = cmd.action;

    if (action === 'display') {
      showShellMedia(cmd.src);
      return;
    }
    if (action === 'dismiss') {
      hideShellMediaOverlay(false);
      return;
    }
    if (action === 'speed') {
      if (stakeApi) stakeApi.applyCommand(cmd);
      return;
    }
    if (HEAVY_STAKEOUT_ACTION[action]) {
      mountStakeoutIfNeeded();
      showStakeoutChrome();
      stakeApi.applyCommand(cmd);
      return;
    }
  }

  function seedLastTsFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      var cmd = JSON.parse(raw);
      if (cmd.ts != null) lastCmdTs = cmd.ts;
    } catch (e) {}
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY && e.key !== LEGACY_KEY) return;
    try {
      if (!e.newValue) return;
      applyCmd(JSON.parse(e.newValue));
    } catch (err) {}
  });

  seedLastTsFromStorage();

  function bootstrapStakeoutFromQuery() {
    try {
      var qs = new URLSearchParams(window.location.search);
      if (qs.get('view') !== 'stakeout') return;
      mountStakeoutIfNeeded();
      stakeApi.setTitleCardVisible(false);
      showStakeoutChrome();
    } catch (e) {}
  }
  bootstrapStakeoutFromQuery();

  window.BoBH2Display = {
    dispatch: function (cmd) {
      applyCmd(cmd);
    },
    dismissClick: function () {
      hideShellMediaOverlay(false);
    },
  };
})();
