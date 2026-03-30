import { CellType, getRenderPalette, H, ItemType, W } from './constants.js';
import { idxOf } from './util.js';

function cellGlyphAndColor(cellType, P) {
  switch (cellType) {
    case CellType.Floor:
      return { g: '.', c: P.floor };
    case CellType.Wall:
      return { g: '#', c: P.wall };
    case CellType.Stairs:
      return { g: '>', c: P.stairs };
    case CellType.Amulet:
      return { g: '*', c: P.amulet };
    case CellType.DoorClosed:
      return { g: '+', c: P.door };
    case CellType.DoorOpen:
      return { g: '/', c: P.door };
    default:
      return { g: ' ', c: P.fog };
  }
}

function itemGlyphAndColor(item, P) {
  switch (item.type) {
    case ItemType.Gold:
      return { g: '$', c: P.gold };
    case ItemType.Potion:
      return { g: '!', c: P.potion };
    case ItemType.Sword:
      return { g: ')', c: P.sword };
    case ItemType.Shield:
      return { g: '[', c: P.shield };
    case ItemType.Trap:
      return { g: '^', c: P.trap };
    default:
      return { g: '?', c: P.player };
  }
}

/** Monsters store spawn-time hex colors; remap by glyph so comfort palette applies. */
function monsterPaletteColor(m, P) {
  switch (m.g) {
    case 'r':
      return P.rat;
    case 'g':
      return P.goblin;
    case 'o':
      return P.orc;
    case 'T':
      return P.troll;
    case 'D':
      return P.dragon;
    default:
      return m.color;
  }
}

export function renderToElement(el, state) {
  const { player, gridType, gridVisible, gridSeen, monsters, monsterAt, items, itemAt, gameOver, won } = state;
  const P = getRenderPalette();

  const parts = [];
  let runColor = null;
  let runText = '';

  const flushRun = () => {
    if (!runText) return;
    if (runColor) parts.push(`<span style="color:${runColor}">${runText}</span>`);
    else parts.push(runText);
    runText = '';
  };

  const pushGlyph = (glyph, color) => {
    if (runColor !== color) {
      flushRun();
      runColor = color;
    }
    runText += glyph;
  };

  const endLine = () => {
    flushRun();
    runColor = null;
    parts.push('\n');
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x === player.x && y === player.y) {
        pushGlyph('@', P.player);
        continue;
      }

      const idx = idxOf(x, y, W);
      const visible = gridVisible[idx];
      const seen = gridSeen[idx];

      const mIndex = monsterAt[idx];
      if (visible && mIndex !== -1) {
        const m = monsters[mIndex];
        pushGlyph(m.g, monsterPaletteColor(m, P));
        continue;
      }

      const itIndex = itemAt[idx];
      if (visible && itIndex !== -1) {
        const it = items[itIndex];
        if (it.type === ItemType.Trap && !it.revealed) {
          // hidden trap looks like floor until triggered
        } else {
          const { g, c } = itemGlyphAndColor(it, P);
          pushGlyph(g, c);
          continue;
        }
      }

      const cellType = gridType[idx];
      if (visible) {
        const { g, c } = cellGlyphAndColor(cellType, P);
        pushGlyph(g, c);
      } else if (seen) {
        const isFloorLike =
          cellType === CellType.Floor || cellType === CellType.Stairs || cellType === CellType.Amulet || cellType === CellType.DoorOpen || cellType === CellType.DoorClosed;
        const { g } = cellGlyphAndColor(cellType === CellType.Wall ? CellType.Wall : CellType.Floor, P);
        pushGlyph(g, isFloorLike ? P.seen : P.fog);
      } else {
        pushGlyph(' ', P.fog);
      }
    }
    endLine();
  }

  const out = parts.join('');
  el.innerHTML = gameOver && !won ? `<span class="dead">${out}</span>` : out;
}

