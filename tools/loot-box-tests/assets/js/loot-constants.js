(function() {
  'use strict';

  var FRAMES = 'assets/images/';
  var RARITY_META = {
    'Unknown':   { cls: 'is-common',    color: '#6b7280', glow: 'rgba(107,114,128,0.5)', frame: FRAMES + 'frame-0-unknown.png' },
    'Mundane':   { cls: 'is-common',    color: '#9aa0a6', glow: 'rgba(154,160,166,0.5)', frame: FRAMES + 'frame-1-mundane.png' },
    'Common':    { cls: 'is-common',    color: '#9aa0a6', glow: 'rgba(154,160,166,0.5)', frame: FRAMES + 'frame-2-common.png' },
    'Uncommon':  { cls: 'is-uncommon',  color: '#4fc3f7', glow: 'rgba(79,195,247,0.5)',  frame: FRAMES + 'frame-3-uncommon.png' },
    'Rare':      { cls: 'is-rare',      color: '#b39ddb', glow: 'rgba(179,157,219,0.6)', frame: FRAMES + 'frame-4-rare.png' },
    'Very Rare': { cls: 'is-very-rare', color: '#ff8a65', glow: 'rgba(255,138,101,0.6)', frame: FRAMES + 'frame-5-very-rare.png' },
    'Legendary': { cls: 'is-legendary', color: '#ffd54f', glow: 'rgba(255,213,79,0.8)',  frame: FRAMES + 'frame-6-legendary.png' },
  };

  var CAT_IMG = {
    'Adventuring Gear': 'assets/images/item-pack.png',
    'Armor':            'assets/images/item-shield.png',
    'Book':             'assets/images/item-scroll.png',
    'Potion':           'assets/images/item-potion.png',
    'Quest Hook':       'assets/images/item-scroll.png',
    'Ring':             'assets/images/item-ring.png',
    'Treasure':         'assets/images/item-gold.png',
    'Weapon':           'assets/images/item-sword.png',
    'Wondrous Item':    'assets/images/item-wondrous-item.png',
  };

  var CAT_EMOJI = {
    'Adventuring Gear': '🎒',
    'Armor':            '🛡️',
    'Book':             '📖',
    'Potion':           '🧪',
    'Quest Hook':       '📜',
    'Ring':             '💍',
    'Treasure':         '💎',
    'Weapon':           '⚔️',
    'Wondrous Item':    '✨',
  };

  var TIER_NAMES = ['Mundane', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'];

  var CR_TO_TIER = {
    '1-4':   { reveal_tier_min: 1, reveal_tier_max: 2 },
    '5-8':   { reveal_tier_min: 2, reveal_tier_max: 3 },
    '9-12':  { reveal_tier_min: 3, reveal_tier_max: 4 },
    '13-16': { reveal_tier_min: 3, reveal_tier_max: 5 },
    '17-20': { reveal_tier_min: 4, reveal_tier_max: 5 },
  };

  window.RARITY_META = RARITY_META;
  window.CAT_IMG = CAT_IMG;
  window.CAT_EMOJI = CAT_EMOJI;
  window.TIER_NAMES = TIER_NAMES;
  window.CR_TO_TIER = CR_TO_TIER;
})();
