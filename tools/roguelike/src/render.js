import { CellType, COLS, H, ItemType, W } from './constants.js';
import { idxOf } from './util.js';

function cellGlyphAndColor(cellType) {
  switch (cellType) {
    case CellType.Floor:
      return { g: '.', c: COLS.floor };
    case CellType.Wall:
      return { g: '#', c: COLS.wall };
    case CellType.Stairs:
      return { g: '>', c: COLS.stairs };
    case CellType.Amulet:
      return { g: '*', c: COLS.amulet };
    case CellType.DoorClosed:
      return { g: '+', c: COLS.door };
    case CellType.DoorOpen:
      return { g: '/', c: COLS.door };
    default:
      return { g: ' ', c: COLS.fog };
  }
}

function itemGlyphAndColor(item) {
  switch (item.type) {
    case ItemType.Gold:
      return { g: '$', c: COLS.gold };
    case ItemType.Potion:
      return { g: '!', c: COLS.potion };
    case ItemType.Sword:
      return { g: ')', c: COLS.sword };
    case ItemType.Shield:
      return { g: '[', c: COLS.shield };
    case ItemType.Trap:
      return { g: '^', c: COLS.trap };
    default:
      return { g: '?', c: COLS.player };
  }
}

export function renderToElement(el, state) {
  const { player, gridType, gridVisible, gridSeen, monsters, monsterAt, items, itemAt, gameOver, won } = state;

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
        pushGlyph('@', COLS.player);
        continue;
      }

      const idx = idxOf(x, y, W);
      const visible = gridVisible[idx];
      const seen = gridSeen[idx];

      const mIndex = monsterAt[idx];
      if (visible && mIndex !== -1) {
        const m = monsters[mIndex];
        pushGlyph(m.g, m.color);
        continue;
      }

      const itIndex = itemAt[idx];
      if (visible && itIndex !== -1) {
        const it = items[itIndex];
        if (it.type === ItemType.Trap && !it.revealed) {
          // hidden trap looks like floor until triggered
        } else {
          const { g, c } = itemGlyphAndColor(it);
          pushGlyph(g, c);
          continue;
        }
      }

      const cellType = gridType[idx];
      if (visible) {
        const { g, c } = cellGlyphAndColor(cellType);
        pushGlyph(g, c);
      } else if (seen) {
        const isFloorLike =
          cellType === CellType.Floor || cellType === CellType.Stairs || cellType === CellType.Amulet || cellType === CellType.DoorOpen || cellType === CellType.DoorClosed;
        const { g } = cellGlyphAndColor(cellType === CellType.Wall ? CellType.Wall : CellType.Floor);
        pushGlyph(g, isFloorLike ? COLS.seen : COLS.fog);
      } else {
        pushGlyph(' ', COLS.fog);
      }
    }
    endLine();
  }

  const out = parts.join('');
  el.innerHTML = gameOver && !won ? `<span class="dead">${out}</span>` : out;
}

