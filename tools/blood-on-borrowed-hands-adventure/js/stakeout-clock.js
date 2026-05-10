(function (global) {
  global.BoBH2StakeoutClock = {
    mount: function (hostEl, hooks) {
      hooks = hooks || {
        showShellMedia: function () {},
        hideShellMedia: function () {},
      };

      function q(id) {
        var s = String(id).replace(/^#/, '');
        return hostEl.querySelector('#' + s);
      }

      var clockEverEngaged = false;
      var clockFaceRevealed = false;

      function hideTitleForClock() {
        clockFaceRevealed = true;
        var tc = q('title-card');
        if (tc) tc.style.display = 'none';
      }

      function showTitleCard() {
        clockFaceRevealed = false;
        var tc = q('title-card');
        if (tc) tc.style.display = 'flex';
      }

// ============================================================
// WATCHMAN PATROL
// ============================================================
// Watchman appears at bells 12 (midnight), 2, and 4
// Each patrol: walks across the screen over ~20 real seconds
const WATCHMAN_BELLS = [2, 4, 6]; // bell indices (0=10pm, 2=midnight, 4=2am, 6=4am)
let watchmanPatrolling = false;
let watchmanAnimFrame = null;

function startWatchmanPatrol() {
  if (watchmanPatrolling) return;
  watchmanPatrolling = true;

  const wmRoot = q('watchman');
  const alert = q('watchman-alert');
  const legL = q('leg-l');
  const legR = q('leg-r');

  // Show alert
  alert.classList.add('visible');
  setTimeout(() => alert.classList.remove('visible'), 4000);

  // Watchman walks left to right across the building base
  wmRoot.classList.add('visible');
  playWalk();
  const startX = -5; // percent
  const endX = 105;  // percent
  const duration = 25000; // 25 real seconds for full patrol
  const startTime = performance.now();
  let legPhase = 0;

  function animateWatchman(ts) {
    const elapsed = ts - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const x = startX + (endX - startX) * progress;
    wmRoot.style.left = x + '%';

    // Leg walk cycle
    legPhase += 0.08;
    const swing = Math.sin(legPhase) * 8;
    legL.setAttribute('x2', String(12 + swing));
    legL.setAttribute('y2', '70');
    legR.setAttribute('x2', String(24 - swing));
    legR.setAttribute('y2', '70');

    if (progress < 1) {
      watchmanAnimFrame = requestAnimationFrame(animateWatchman);
    } else {
      wmRoot.classList.remove('visible');
      wmRoot.style.left = '-5%';
      watchmanPatrolling = false;
      watchmanAnimFrame = null;
      stopWalk();
    }
  }

  watchmanAnimFrame = requestAnimationFrame(animateWatchman);
}

// ============================================================
// CONFIGURATION
// ============================================================
const BELLS = [
  { hour: 22, label: "10th Bell", name: "Nightfall" },
  { hour: 23, label: "11th Bell", name: "Deep Night" },
  { hour: 0,  label: "Midnight",  name: "The Witching Hour" },
  { hour: 1,  label: "1st Bell",  name: "The Dead Hour" },
  { hour: 2,  label: "2nd Bell",  name: "The Cold Hour" },
  { hour: 3,  label: "3rd Bell",  name: "The Quiet Hour" },
  { hour: 4,  label: "4th Bell",  name: "The Pale Hour" },
  { hour: 5,  label: "5th Bell",  name: "Before Dawn" },
  { hour: 6,  label: "6th Bell",  name: "Dawn Breaks" },
];

// Total duration: 8 hours (10pm to 6am)
// Accelerated: each real second = configurable game minutes
// Default: 1 real second = 1 game minute → 8 hours = 480 real seconds
// Configurable via localStorage

const TOTAL_GAME_MINUTES = 480; // 8 hours
const FULL_ARC = 2 * Math.PI * 128;

let gameMinutes = 0;       // 0 = 10pm, 480 = 6am
let running = false;
let lastTs = null;
let speedMultiplier = 1;   // game minutes per real second
let bellsRung = new Set();

// ============================================================
// STARS
// ============================================================
function makeStars() {
  const container = q('stars');
  for (let i = 0; i < 180; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() < 0.1 ? 2.5 : Math.random() < 0.3 ? 1.5 : 1;
    s.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      top:${Math.random()*65}%;
      --base-op:${0.3 + Math.random()*0.7};
      --dur:${2 + Math.random()*4}s;
      --delay:${Math.random()*4}s;
    `;
    container.appendChild(s);
  }
}

// ============================================================
// HOUR MARKERS
// ============================================================
function drawHourMarkers() {
  const g = q('hour-markers');
  BELLS.forEach((bell, i) => {
    const angle = (i / 8) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    const r1 = 128, r2 = 118;
    const x1 = 150 + r1 * Math.cos(rad);
    const y1 = 150 + r1 * Math.sin(rad);
    const x2 = 150 + r2 * Math.cos(rad);
    const y2 = 150 + r2 * Math.sin(rad);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('stroke', i === 0 || i === 8 ? '#c4a96a' : '#3a2810');
    line.setAttribute('stroke-width', i === 0 || i === 8 ? '2' : '1');
    line.setAttribute('id', `marker-${i}`);
    g.appendChild(line);

    // Label
    const lr = 108;
    const lx = 150 + lr * Math.cos(rad);
    const ly = 150 + lr * Math.sin(rad);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', lx); text.setAttribute('y', ly);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-family', 'Cinzel, serif');
    text.setAttribute('font-size', '7');
    text.setAttribute('fill', '#504030');
    text.setAttribute('id', `marker-text-${i}`);
    text.textContent = bell.label;
    g.appendChild(text);
  });
}

// ============================================================
// BAR TICKS
// ============================================================
function drawBarTicks() {
  const container = q('bar-ticks');
  for (let i = 1; i < 8; i++) {
    const pct = (i / 8) * 100;
    const tick = document.createElement('div');
    tick.className = 'night-bar-tick';
    tick.id = `tick-${i}`;
    tick.style.left = pct + '%';
    container.appendChild(tick);
  }
}

// ============================================================
// AUDIO - MP3 files
// ============================================================
const bellAudio = new Audio('bell.mp3');
const walkAudio = new Audio('walk.mp3');
walkAudio.loop = true;

function playBell(count) {
  // Play bell.mp3 once per strike, staggered
  for (let b = 0; b < Math.min(count, 6); b++) {
    setTimeout(() => {
      const strike = new Audio('bell.mp3');
      strike.volume = 1.0;
      strike.play().catch(() => {});
    }, b * 1200);
  }
}

function playWalk() {
  walkAudio.currentTime = 0;
  walkAudio.volume = 0.6;
  walkAudio.play().catch(() => {});
}

function stopWalk() {
  walkAudio.pause();
  walkAudio.currentTime = 0;
}

// ============================================================
// UPDATE DISPLAY
// ============================================================
function minutesToBellIndex(mins) {
  return Math.floor(mins / 60);
}

function update(ts) {
  if (!running) return;

  if (lastTs !== null) {
    const delta = (ts - lastTs) / 1000; // real seconds
    gameMinutes += delta * speedMultiplier;
    if (gameMinutes >= TOTAL_GAME_MINUTES) {
      gameMinutes = TOTAL_GAME_MINUTES;
      running = false;
    }
  }
  lastTs = ts;

  const bellIndex = Math.min(Math.floor(gameMinutes / 60), 8);
  const bell = BELLS[Math.min(bellIndex, 8)];
  const minutesIntoHour = gameMinutes % 60;
  const progress = gameMinutes / TOTAL_GAME_MINUTES;

  // Clock hands
  const hourAngle = (gameMinutes / TOTAL_GAME_MINUTES) * 360;
  const minuteAngle = (minutesIntoHour / 60) * 360;

  q('hour-hand').setAttribute('transform', `rotate(${hourAngle} 150 150)`);
  q('minute-hand').setAttribute('transform', `rotate(${minuteAngle} 150 150)`);

  // Progress arc
  const arcLen = progress * FULL_ARC;
  q('progress-arc').setAttribute('stroke-dasharray', `${arcLen} ${FULL_ARC}`);

  // Night bar
  q('night-fill').style.width = (progress * 100) + '%';

  // Tick marks
  for (let i = 1; i < 8; i++) {
    const tick = q('tick-' + i);
    if (tick) tick.classList.toggle('passed', gameMinutes >= i * 60);
  }

  // Hour marker highlight
  for (let i = 0; i < 9; i++) {
    const mt = q('marker-text-' + i);
    if (mt) mt.setAttribute('fill', i <= bellIndex ? '#c4a96a' : '#504030');
    const ml = q('marker-' + i);
    if (ml) ml.setAttribute('stroke', i <= bellIndex ? '#c4a96a' : '#3a2810');
  }

  // Bell labels
  q('bell-label').textContent = bell.label;
  q('bell-count').textContent = bellIndex === 0 ? '10' : bellIndex <= 8 ? String(bellIndex) : '—';
  q('bell-name').textContent = bell.name;

  // Bell ring
  if (!bellsRung.has(bellIndex) && gameMinutes >= bellIndex * 60 + 0.1) {
    bellsRung.add(bellIndex);
    ringBell(bellIndex, bell);
    // Watchman patrol on specific bells
    if (WATCHMAN_BELLS.includes(bellIndex)) {
      setTimeout(startWatchmanPatrol, 3000); // slight delay after bell
    }
  }

  // Dawn
  if (gameMinutes >= 420) {
    q('dawn-overlay').classList.add('breaking');
    q('moon').style.opacity = Math.max(0, 1 - (gameMinutes - 420) / 60);
  }

  // Sky color
  const skyProgress = gameMinutes / TOTAL_GAME_MINUTES;
  updateSky(skyProgress);

  if (running) requestAnimationFrame(update);
}

function ringBell(index, bell) {
  const ringEl = q('bell-ring');
  const ringText = q('bell-ring-text');
  const count = index === 0 ? 10 : index <= 8 ? index : 0;
  ringText.textContent = bell.label + ' — ' + bell.name;
  ringEl.classList.remove('ringing');
  void ringEl.offsetWidth;
  ringEl.classList.add('ringing');
  if (count > 0) playBell(Math.min(count, 6)); // cap at 6 strikes for sanity
}

// ============================================================
// SKY CANVAS
// ============================================================
function updateSky(progress) {
  const canvas = q('sky');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Interpolate from deep night to pre-dawn
  const r = Math.round(6 + progress * 14);
  const g = Math.round(6 + progress * 8);
  const b = Math.round(16 + progress * 30);

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.7);
  grad.addColorStop(0, `rgb(${r},${g},${b})`);
  grad.addColorStop(1, `rgb(${Math.round(r*0.7)},${Math.round(g*0.7)},${Math.round(b*1.5)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ============================================================
// COMMANDS
// ============================================================
function applyCommand(cmd) {
  if (cmd.action === 'start') {
    if (!running) {
      hideTitleForClock();
      running = true;
      lastTs = null;
      speedMultiplier = cmd.speed || 1;
      q('status-dot').classList.add('active');
      q('status-text').textContent = `Running — ${speedMultiplier} min/sec`;
      requestAnimationFrame(update);
    }
  } else if (cmd.action === 'pause') {
    hideTitleForClock();
    running = false;
    lastTs = null;
    q('paused-overlay').classList.add('visible');
    q('status-dot').classList.remove('active');
    q('status-text').textContent = 'Paused';
  } else if (cmd.action === 'resume') {
    hideTitleForClock();
    running = true;
    lastTs = null;
    q('paused-overlay').classList.remove('visible');
    q('status-dot').classList.add('active');
    q('status-text').textContent = `Running — ${speedMultiplier} min/sec`;
    requestAnimationFrame(update);
  } else if (cmd.action === 'reset') {
    clockEverEngaged = false;
    running = false;
    lastTs = null;
    gameMinutes = 0;
    bellsRung.clear();
    speedMultiplier = cmd.speed || 1;
    q('paused-overlay').classList.remove('visible');
    q('dawn-overlay').classList.remove('breaking');
    q('moon').style.opacity = 1;
    q('status-dot').classList.remove('active');
    q('status-text').textContent = 'Reset — awaiting start';
    showTitleCard();
    q('night-fill').style.width = '0%';
    q('hour-hand').setAttribute('transform', 'rotate(0 150 150)');
    q('minute-hand').setAttribute('transform', 'rotate(0 150 150)');
    q('progress-arc').setAttribute('stroke-dasharray', '0 804');
    q('bell-label').textContent = 'The Watch Begins';
    q('bell-count').textContent = '—';
    q('bell-name').textContent = 'Waiting to begin';
    updateSky(0);
  } else if (cmd.action === 'speed') {
    speedMultiplier = cmd.speed;
    q('status-text').textContent = `Running — ${speedMultiplier} min/sec`;
  } else if (cmd.action === 'display') {
    hideTitleForClock();
    hooks.showShellMedia(cmd.src);
  } else if (cmd.action === 'dismiss') {
    hooks.hideShellMedia();
  } else if (cmd.action === 'watchman') {
    hideTitleForClock();
    startWatchmanPatrol();
  } else if (cmd.action === 'jump') {
    hideTitleForClock();
    gameMinutes = cmd.minutes;
    bellsRung = new Set(BELLS.slice(0, Math.floor(cmd.minutes/60)).map((_,i) => i));
  }
}

      function markEngaged(act) {
        if (['start','resume','watchman','jump'].indexOf(act) !== -1) clockEverEngaged = true;
      }

      var _applyInner = applyCommand;
      applyCommand = function(cmd) {
        if (cmd && cmd.action) markEngaged(cmd.action);
        return _applyInner(cmd);
      };

      function shellDismissSync() {
        if (!running && gameMinutes === 0 && !clockFaceRevealed) showTitleCard();
      }

      window.addEventListener('keydown', function (e) {
        if (e.key === ' ') {
          if (running) applyCommand({ action: 'pause' });
          else applyCommand({ action: 'resume' });
        }
        if (e.key === 'r') applyCommand({ action: 'reset', speed: speedMultiplier });
      });

      makeStars();
      drawHourMarkers();
      drawBarTicks();
      updateSky(0);
      window.addEventListener('resize', function () {
        updateSky(gameMinutes / TOTAL_GAME_MINUTES);
      });

      return {
        applyCommand: applyCommand,
        startWatchmanPatrol: startWatchmanPatrol,
        clockEverEngaged: function () { return clockEverEngaged; },
        shellDismissSync: shellDismissSync,
        setTitleCardVisible: function (show) {
          if (show) showTitleCard();
          else hideTitleForClock();
        },
      };
    },
  };
})(typeof window !== 'undefined' ? window : this);

