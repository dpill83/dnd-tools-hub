(function() {
  'use strict';

  var audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playCreak() {
    try {
      var ctx = getAudioCtx();
      var t = ctx.currentTime;
      var osc1 = ctx.createOscillator();
      var osc2 = ctx.createOscillator();
      var gain1 = ctx.createGain();
      var gain2 = ctx.createGain();
      var filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.value = 600;

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(80, t);
      osc1.frequency.linearRampToValueAtTime(55, t + 0.6);
      gain1.gain.setValueAtTime(0, t);
      gain1.gain.linearRampToValueAtTime(0.18, t + 0.05);
      gain1.gain.linearRampToValueAtTime(0, t + 0.7);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(220, t + 0.1);
      osc2.frequency.linearRampToValueAtTime(140, t + 0.5);
      gain2.gain.setValueAtTime(0, t + 0.1);
      gain2.gain.linearRampToValueAtTime(0.08, t + 0.2);
      gain2.gain.linearRampToValueAtTime(0, t + 0.6);

      osc1.connect(gain1); gain1.connect(filter);
      osc2.connect(gain2); gain2.connect(filter);
      filter.connect(ctx.destination);

      osc1.start(t); osc1.stop(t + 0.8);
      osc2.start(t + 0.1); osc2.stop(t + 0.7);
    } catch (e) {}
  }

  function playPop(pitch) {
    try {
      var ctx = getAudioCtx();
      var t = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var filter = ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.value = pitch || 800;
      filter.Q.value = 0.5;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime((pitch || 800) * 1.2, t);
      osc.frequency.exponentialRampToValueAtTime((pitch || 800) * 0.5, t + 0.15);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.2);
    } catch (e) {}
  }

  function playFlipSound() {
    try {
      var ctx = getAudioCtx();
      var t = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, t);
      filter.frequency.linearRampToValueAtTime(400, t + 0.25);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.linearRampToValueAtTime(200, t + 0.25);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain); gain.connect(filter); filter.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.32);
    } catch (e) {}
  }

  function playSting() {
    try {
      var ctx = getAudioCtx();
      var t = ctx.currentTime;

      var notes = [523.25, 659.25, 783.99, 1046.5];
      var times = [0, 0.12, 0.24, 0.4];
      var durations = [0.18, 0.18, 0.18, 0.6];

      notes.forEach(function(freq, i) {
        var osc = ctx.createOscillator();
        var osc2 = ctx.createOscillator();
        var gain = ctx.createGain();
        var gainNode = ctx.createGain();

        osc.type = 'square';
        osc2.type = 'sawtooth';
        osc.frequency.value = freq;
        osc2.frequency.value = freq * 1.005;

        gain.gain.value = 0.3;
        gainNode.gain.setValueAtTime(0, t + times[i]);
        gainNode.gain.linearRampToValueAtTime(0.25, t + times[i] + 0.02);
        gainNode.gain.linearRampToValueAtTime(0.18, t + times[i] + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, t + times[i] + durations[i]);

        var filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;

        osc.connect(gain); osc2.connect(gain);
        gain.connect(filter); filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(t + times[i]); osc.stop(t + times[i] + durations[i] + 0.05);
        osc2.start(t + times[i]); osc2.stop(t + times[i] + durations[i] + 0.05);
      });

      var boom = ctx.createOscillator();
      var boomGain = ctx.createGain();
      boom.type = 'sine';
      boom.frequency.setValueAtTime(80, t + 0.38);
      boom.frequency.exponentialRampToValueAtTime(40, t + 1.2);
      boomGain.gain.setValueAtTime(0, t + 0.38);
      boomGain.gain.linearRampToValueAtTime(0.35, t + 0.42);
      boomGain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
      boom.connect(boomGain); boomGain.connect(ctx.destination);
      boom.start(t + 0.38); boom.stop(t + 1.4);

    } catch (e) {}
  }

  function playRumble() {
    try {
      var ctx = getAudioCtx();
      var t = ctx.currentTime;
      var osc1 = ctx.createOscillator();
      var osc2 = ctx.createOscillator();
      var lfo  = ctx.createOscillator();
      var lfoGain = ctx.createGain();
      var gain1 = ctx.createGain();
      var gain2 = ctx.createGain();
      var filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, t);
      filter.frequency.linearRampToValueAtTime(800, t + 1.8);

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(40, t);
      osc1.frequency.linearRampToValueAtTime(55, t + 1.8);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(38, t);
      osc2.frequency.linearRampToValueAtTime(52, t + 1.8);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(6, t);
      lfo.frequency.linearRampToValueAtTime(14, t + 1.8);
      lfoGain.gain.value = 0.08;
      lfo.connect(lfoGain);

      gain1.gain.setValueAtTime(0, t);
      gain1.gain.linearRampToValueAtTime(0.28, t + 0.4);
      gain1.gain.linearRampToValueAtTime(0.35, t + 1.6);
      gain1.gain.linearRampToValueAtTime(0, t + 2.1);

      gain2.gain.setValueAtTime(0, t);
      gain2.gain.linearRampToValueAtTime(0.15, t + 0.6);
      gain2.gain.linearRampToValueAtTime(0, t + 2.0);

      lfoGain.connect(osc1.frequency);
      osc1.connect(gain1); gain1.connect(filter);
      osc2.connect(gain2); gain2.connect(filter);
      filter.connect(ctx.destination);

      osc1.start(t); osc1.stop(t + 2.2);
      osc2.start(t); osc2.stop(t + 2.1);
      lfo.start(t);  lfo.stop(t + 2.2);
    } catch (e) {}
  }

  window.getAudioCtx = getAudioCtx;
  window.playCreak = playCreak;
  window.playPop = playPop;
  window.playFlipSound = playFlipSound;
  window.playSting = playSting;
  window.playRumble = playRumble;
})();
