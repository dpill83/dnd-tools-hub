(function() {
  'use strict';

  function itemIconHTML(item, size) {
    if (!item) return '<span style="font-size:2rem">📦</span>';
    var imgPath = window.CAT_IMG[item.category];
    var sz = size || 'clamp(2.8rem, 6vw, 5rem)';
    if (imgPath) {
      return '<img src="' + imgPath + '" alt="' + item.category + '" style="width:' + sz + ';height:' + sz + ';object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.7));-webkit-user-drag:none;" draggable="false">';
    }
    var emoji = window.CAT_EMOJI[item.category] || '✨';
    return '<span style="font-size:' + sz + ';line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8))">' + emoji + '</span>';
  }

  function itemValueStr(item) {
    if (!item) return '';
    if (item.value_raw) return item.value_raw;
    if (item.value) return item.value + ' gp';
    return '— gp';
  }

  function buildCardFront(item, cardFrontElement) {
    if (!item || !cardFrontElement) return;
    var rm = window.RARITY_META[item.rarity] || window.RARITY_META['Rare'];
    var frameUrl = rm.frame ? "url('" + rm.frame + "')" : '';
    cardFrontElement.style.backgroundImage = frameUrl ? frameUrl + ', linear-gradient(160deg, #1c1200 0%, #0d0900 100%)' : '';
    cardFrontElement.style.borderColor = rm.color;
    cardFrontElement.style.boxShadow = '0 0 40px ' + rm.glow + ', 0 0 100px ' + rm.glow.replace('0.8', '0.3') + ', inset 0 0 40px ' + rm.glow.replace('0.8', '0.08');
    var desc = item.properties || item.description || '';
    var truncDesc = desc.length > 140 ? desc.slice(0, 137) + '…' : desc;
    var descBlock = truncDesc
      ? '<div class="card-desc-divider"></div><div class="card-item-desc">' + truncDesc.replace(/\n/g, '<br>') + '</div>'
      : '';
    cardFrontElement.innerHTML =
      '<div class="card-rarity-badge" style="color:' + rm.color + '">' + item.rarity + '</div>' +
      '<div class="card-icon">' + itemIconHTML(item, 'clamp(3rem,9vw,5rem)') + '</div>' +
      '<div class="card-divider"></div>' +
      '<div class="card-item-name">' + item.name + '</div>' +
      '<div class="card-item-value">' + itemValueStr(item) + '</div>' +
      descBlock +
      (item.requirements ? '<div class="card-item-req">' + item.requirements + '</div>' : '');
  }

  function createSlot(item, isMystery, currentRoll) {
    var RARITY_META = window.RARITY_META;
    var slot = document.createElement('div');
    slot.className = 'item-slot bg-cover-center flex-center-col';
    slot.setAttribute('tabindex', '0');
    slot.setAttribute('role', 'button');
    slot.setAttribute('aria-label', isMystery ? 'Reveal mystery item' : ('View ' + (item && item.name ? item.name : 'item')));
    slot._item = isMystery ? (currentRoll && currentRoll.reveal) || null : item;
    slot._isMystery = isMystery;

    var rm = isMystery
      ? (currentRoll && currentRoll.reveal ? RARITY_META[currentRoll.reveal.rarity] : RARITY_META['Rare'])
      : (RARITY_META[item.rarity] || RARITY_META['Common']);

    if (rm) {
      if (isMystery) {
        slot.classList.add('is-mystery');
        slot.style.setProperty('--mystery-color', rm.color);
      } else {
        slot.classList.add(rm.cls);
      }
    }

    var frameBg = rm && rm.frame ? "url('" + rm.frame + "'), linear-gradient(135deg, #1a0e08 0%, #0d0805 100%)" : '';
    var backFaceStyle = frameBg ? 'background-image:' + frameBg + ';' : '';
    var backQuestion = '<span class="back-question" style="color:' + (rm ? rm.color : '#9aa0a6') + '">?</span>';

    var frontFaceContent = '';
    var displayItem = isMystery ? (currentRoll && currentRoll.reveal) : item;
    if (displayItem) {
      frontFaceContent =
        '<div class="slot">' +
          '<div class="slot-icon">' + itemIconHTML(displayItem, 'clamp(2.2rem,5vw,4rem)') + '</div>' +
          '<div class="slot-name">' + displayItem.name + '</div>' +
        '</div>';
    }

    var frontFrameBg = rm && rm.frame ? "url('" + rm.frame + "'), linear-gradient(160deg, #1c1200 0%, #0d0900 100%)" : '';
    var frontFaceStyle = frontFrameBg ? 'background-image:' + frontFrameBg + ';' : '';

    slot.innerHTML =
      '<div class="card-inner">' +
        '<div class="card-back-face abs-fill flex-center-col" style="' + backFaceStyle + '">' + backQuestion + '</div>' +
        '<div class="card-front-face abs-fill flex-center-col" style="' + frontFaceStyle + '">' + frontFaceContent + '</div>' +
      '</div>';
    return slot;
  }

  window.itemIconHTML = itemIconHTML;
  window.itemValueStr = itemValueStr;
  window.buildCardFront = buildCardFront;
  window.createSlot = createSlot;
})();
