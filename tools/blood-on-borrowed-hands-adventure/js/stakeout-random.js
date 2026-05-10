var STAKEOUT_WHAT = [
  'A cargo cart arrives late — two dock workers unload crates by torchlight',
  'A cat knocks something over inside the warehouse with a loud crash',
  'Distant shouting from the harbor — a ship argument, nothing to do with them',
  'The night watchman pauses longer than usual at the south entrance',
  'A hooded figure walks past slowly, doesn\'t stop, doesn\'t look up',
  'A lantern light appears briefly in an upper window then goes dark',
];
var STAKEOUT_WHO = [
  'Viktor notices it first',
  'Ethereal notices it first',
  'Sirus notices it first',
  'Grizz notices it first',
  'Two of you notice at the same time',
  'Nobody notices until it\'s almost too late',
];
var STAKEOUT_WHERE = [
  'At the main entrance — torchlit, visible',
  'At the water-side loading dock — dark, partially hidden',
  'In the alley to the east — where the kids will eventually come from',
  'On the roofline above you',
  'Across the street, near a stack of barrels',
  'Directly below your vantage point',
];

function rollStakeout(col) {
  var roll = Math.floor(Math.random() * 6);
  var tables = { what: STAKEOUT_WHAT, who: STAKEOUT_WHO, where: STAKEOUT_WHERE };
  var result = tables[col][roll];
  var el = document.getElementById('result-' + col);
  if (el) {
    el.textContent = '[' + (roll + 1) + '] ' + result;
    el.style.borderColor = 'var(--gold)';
    setTimeout(function () {
      el.style.borderColor = 'var(--red)';
    }, 600);
  }
}

function rollAll() {
  rollStakeout('what');
  rollStakeout('who');
  rollStakeout('where');
}
