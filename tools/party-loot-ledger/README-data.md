# Party Loot Ledger – Data Files

All reference data is loaded from the JSON files in this folder. Edit these files to add or change content; the tool loads them when the page opens.

| File | Contents |
|------|----------|
| **tier-info.json** | Tier labels (T0–T5), names, value ranges, leverage scores, and CSS color class names. One object per tier. |
| **market-conditions.json** | List of market conditions. Each object: `name`, `effect`, `border` (hex color). "Randomize Conditions" picks from this list. |
| **loot-tables.json** | Standard 5e CR-based loot. Top-level keys: `low`, `mid`, `high`, `deadly`. Each has `individual`, `hoard`, `merchant`, `dungeon` arrays of items. Each item: `name`, `tier` (0–5), `val` (gp), `note`. |
| **custom-loot-tables.json** | Custom leverage/trade loot. Top-level keys: `"0"`–`"5"` (tier). Each tier has `open`, `guild`, `faction`, `black`, `political` arrays of items (same shape as above). |
| **default-factions.json** | Starting factions. Each object: `name`, `align` (`ally`/`neutral`/`hostile`/`unknown`), `wants`, `color`, `textColor` (hex). |

**Adding entries:** Keep the same JSON structure and property names. For new market conditions, add an object to the array in `market-conditions.json`. For new loot, add objects to the right array in `loot-tables.json` or `custom-loot-tables.json` (under the right CR/tier and type/context).

**Serving:** The tool must be opened over HTTP (e.g. from a local server or the hub) so `fetch()` can load the JSON files. Opening `index.html` as a file (`file://`) may fail to load data.
