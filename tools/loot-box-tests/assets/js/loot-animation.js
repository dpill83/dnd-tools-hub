(function() {
  'use strict';

  function flyItemToSlot(item, slotEl, chestWrap) {
    var RARITY_META = window.RARITY_META;
    return new Promise(function(resolve) {
      var chestRect = chestWrap.getBoundingClientRect();
      var slotRect  = slotEl.getBoundingClientRect();

      var startX = chestRect.left + chestRect.width / 2;
      var startY = chestRect.top + chestRect.height * 0.25;

      var endX = slotRect.left + slotRect.width / 2;
      var endY = slotRect.top  + slotRect.height / 2;

      var peakY = Math.min(startY, endY) - window.innerHeight * 0.18;

      var flyRm = RARITY_META[item.rarity] || RARITY_META['Common'];
      var flyer = document.createElement('div');
      flyer.className = 'flying-item';
      flyer.style.filter = 'drop-shadow(0 0 14px ' + (flyRm.glow || 'rgba(154,160,166,0.6)') + ')';
      flyer.innerHTML = '<span style="font-family:\'Cinzel Decorative\',serif;font-size:clamp(2rem,4.5vw,3.5rem);color:' + flyRm.color + ';opacity:0.85">?</span>';
      flyer.style.left = startX + 'px';
      flyer.style.top  = startY + 'px';
      flyer.style.transform = 'translate(-50%, -50%) scale(1.3)';
      document.body.appendChild(flyer);

      var dur = 680;
      var steps = 60;
      var frame = 0;

      function tick() {
        frame++;
        var t = frame / steps;
        var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        var bx = startX + (endX - startX) * t;
        var by = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * peakY + t * t * endY;

        var scale = 1.3 - 0.35 * ease;
        var rot = Math.sin(t * Math.PI) * 12;

        flyer.style.left = bx + 'px';
        flyer.style.top  = by + 'px';
        flyer.style.transform = 'translate(-50%, -50%) scale(' + scale + ') rotate(' + rot + 'deg)';
        flyer.style.opacity = t > 0.85 ? (1 - (t - 0.85) / 0.15).toString() : '1';

        if (frame < steps) {
          requestAnimationFrame(tick);
        } else {
          flyer.remove();
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  function spawnSparks(count, particlesContainer) {
    for (var i = 0; i < count; i++) {
      var spark = document.createElement('div');
      spark.className = 'spark';
      var x = 30 + Math.random() * 40;
      var startY = 40 + Math.random() * 20;
      var drift = (Math.random() - 0.5) * 60;
      var dur = 0.8 + Math.random() * 1.2;
      var delay = Math.random() * 0.4;
      spark.style.cssText = 'left:' + x + '%;top:' + startY + '%;--sx:' + drift + 'px;animation-duration:' + dur + 's;animation-delay:' + delay + 's';
      particlesContainer.appendChild(spark);
      (function(s) {
        setTimeout(function() { s.remove(); }, (dur + delay) * 1000 + 100);
      })(spark);
    }
  }

  window.flyItemToSlot = flyItemToSlot;
  window.spawnSparks = spawnSparks;
})();
