var DISPLAY_STORAGE_KEY = 'bobh2-display-cmd';

var displayWindow = null;

function pushDisplayCmd(cmd) {
  cmd.ts = Date.now();
  var json = JSON.stringify(cmd);
  try {
    localStorage.setItem(DISPLAY_STORAGE_KEY, json);
  } catch (e) {}
  if (displayWindow && !displayWindow.closed) {
    try {
      if (displayWindow.BoBH2Display && displayWindow.BoBH2Display.dispatch) {
        displayWindow.BoBH2Display.dispatch(cmd);
      }
    } catch (err) {}
  }
}

function displayOnTV(src) {
  var absoluteSrc = new URL(src, window.location.href).href;
  pushDisplayCmd({ action: 'display', src: absoluteSrc });
}

function dismissTV() {
  pushDisplayCmd({ action: 'dismiss' });
}

function openDisplay(view) {
  var url = 'display.html';
  if (view === 'stakeout') url += '?view=stakeout';
  displayWindow = window.open(url, 'bobh2-display', 'width=1280,height=720');
}

function clockCmd(action) {
  var sel = document.getElementById('clock-speed');
  var speed = parseFloat((sel && sel.value) || 1);
  pushDisplayCmd({ action: action, speed: speed });
}

function updateSpeed() {
  var speed = parseFloat(document.getElementById('clock-speed').value);
  clockCmd('speed');
}

function triggerWatchman() {
  pushDisplayCmd({ action: 'watchman' });
}

function clockJump() {
  var minutes = parseInt(document.getElementById('clock-jump').value, 10);
  pushDisplayCmd({ action: 'jump', minutes: minutes });
}
