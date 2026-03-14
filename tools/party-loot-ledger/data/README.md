# Party Loot Ledger – Data Folder

This folder contains all of the **editable data** that powers the Party Loot Ledger tool. You can safely modify these JSON files to add, remove, or tweak entries; the UI will pick up your changes the next time the page loads (when served over HTTP so `fetch()` can read the files).

## Files

- **`tier-info.json`**
  - Defines the **tier metadata** used everywhere in the tool.
  - Each entry has:
    - `label`: short code (e.g. `"T3"`)
    - `name`: human-readable name (e.g. `"Minor Magic"`)
    - `range`: rough gp range string (e.g. `"100–500gp"`)
    - `leverage`: 0–100 baseline leverage score used by the Leverage Calculator
    - `color`: CSS class suffix for the tier badge (e.g. `"t3"`)
  - Used by: tier badges, value range display, leverage calculator, and loot roller displays.

- **`market-conditions.json`**
  - Master list of **market conditions** used in the Market tab and the "View all conditions" reference modal.
  - Each entry has:
    - `name`: condition name (e.g. `"City Under Siege"`)
    - `effect`: descriptive text shown to the DM/players
    - `border`: hex color used for the left border accent in the UI
  - The **Randomize Conditions** button picks from this array.

- **`loot-tables.json`**
  - All **standard 5e CR-based loot tables** used when the Loot Roller is set to "Standard 5e (CR-based)".
  - Top-level keys are encounter bands: `"low"`, `"mid"`, `"high"`, `"deadly"`.
  - Each band has four arrays:
    - `individual`: individual monster loot
    - `hoard`: treasure hoards
    - `merchant`: merchant caches
    - `dungeon`: dungeon stashes
  - Each item object has:
    - `name`: item name
    - `tier`: 0–5, matching the tiers in `tier-info.json`
    - `val`: base gp value (number)
    - `note`: short descriptive note / usage hint
  - Used by: standard Loot Roller and "View current table" reference when tier system = `"standard"`.

- **`custom-loot-tables.json`**
  - All **custom leverage/trade loot tables** used when the Loot Roller is set to "Custom (leverage / trade tiers)".
  - Top-level keys are **tier strings**: `"0"` through `"5"` (T0–T5).
  - For each tier, there are context arrays:
    - `open`: open market
    - `guild`: guild / academy
    - `faction`: faction deal
    - `black`: black market / fence
    - `political`: political / holding / leverage
  - Each item object has the same shape as in `loot-tables.json` (`name`, `tier`, `val`, `note`), but the notes are written with **leverage, faction demand, fence tax, and legal context** in mind.
  - Used by: custom Loot Roller and "View current table" reference when tier system = `"custom"`.

- **`hansi-loot.json`**
  - **Hansi Loot Table** item list used when the Loot Roller tier system is set to "Hansi Loot Table".
  - Source: generated from `Hansi Loot Table - Items.csv` in this folder. Regenerate with: `node tools/party-loot-ledger/scripts/csv-to-hansi-loot.js` from the repo root.
  - Structure: `items` (array of item objects) and `categories` (array of category strings for the filter dropdown). Each item has `name`, `tier` (0–5), `val` (gp number), `note` (description and source), and `category`. Used by the Hansi Loot Roller mode; filter by tier and category, then roll 2–6 random items.

- **`default-factions.json`**
  - Default **faction list** shown in the Factions tab before you add custom factions.
  - Each entry has:
    - `name`: faction name (e.g. `"Harpers"`)
    - `align`: `"ally" | "neutral" | "hostile" | "unknown"`
    - `wants`: what the faction buys or cares about
    - `color`: hex background color for that faction pill
    - `textColor`: hex text color used on the pill
  - You can add, edit, or remove default factions here; the UI treats them as the starting list.

## Editing Guidelines

- Keep the JSON **valid** (matching quotes, commas, and brackets) or the page will fall back to minimal built-in data.
- When adding new entries, prefer reusing existing shapes and keys so the UI can render them without changes.
- Avoid changing type/shape of existing fields (e.g. don't change `val` from a number to a string) unless you also update the JS logic.
