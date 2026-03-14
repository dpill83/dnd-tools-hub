# Party Loot Ledger – Handoff for Another AI

## Executive summary

The **Party Loot Ledger** is a single-page D&D 5e tool (HTML + inline JS, data in JSON) that lives inside the D&D Tools Hub. It is **trying to be** a rarity- and tier-driven loot economy: items have tiers (T0–T5), roll from tiered/contextual tables, and are tracked with status (Holding, For Sale, Sold, Leverage) and a “leverage” score that varies by buyer type. In practice it is **still mostly a loot tracker with economy-themed UI**: you roll or add items, store tier + value + notes, cycle status, and see a static 0–100 leverage number. Factions and market conditions are descriptive only—they don’t affect values, matching, or calculations. The codebase is one large `index.html` (~1,400 lines), shared state in `state = { items, conditions, factions, lastRolled }`, and data in `tools/party-loot-ledger/data/*.json`. Understanding the **intent** (tiered loot economy with trade leverage and faction demand) versus the **current implementation** (tracker + tier badges + one calculator) is essential before changing it.

---

## 1. What this tool is for

- **Stated purpose (tagline):** “Trade value, faction leverage & market conditions. Track loot, roll hoards by CR, and manage factions.”
- **Actual function:** Track party loot (name, tier, value, qty, status, notes); roll random loot from several table systems (CR-based, custom tier+context, or Hansi CSV-derived table); display two random “market conditions”; maintain a list of factions with alignment and “wants”; and show a **Leverage Calculator** that outputs a 0–100 score for “item tier + buyer type” with a short prose note. Sync (hub storage or localStorage) persists items, conditions, and factions.

---

## 2. Who it is for

- **Primary:** Dungeon Masters (or players) running 5e games who want to (a) record what the party has found, (b) roll loot by encounter difficulty or by tier/market context, and (c) reason about “who would pay what” and “what’s this worth in this market.”
- **Implicit:** Tables that care about **rarity and tier** as drivers of value and leverage, not just “list of stuff we have.”

---

## 3. Core user flow

1. **Acquire loot:** Roll from Loot Roller (choose tier system → choose filters → “Roll the Hoard” → 2–6 items) or add manually (Ledger tab: name, tier, value, qty, status, notes).
2. **Review:** Click a rolled item to open detail modal (full description, Est. Value, Rarity, Weight, Category, etc. when from Hansi); “Add All to Ledger” copies current roll into the ledger.
3. **Track:** Ledger table shows each item with tier badge, base value, status (cycle by clicking: Holding → For Sale → Sold → Leverage), notes. “Active Holdings Total” sums value of non-Sold items.
4. **Market context:** Market tab: “Randomize Conditions” sets two conditions from `market-conditions.json` (display only); Leverage Calculator: pick “Item Tier” + “Selling To” → see leverage score and a static note.
5. **Factions:** Factions tab: view/add factions (name, alignment, “Wants / Buys”); no link from ledger items to factions or to the calculator.

There is **no flow** that says “this item is for sale to this faction” or “conditions modify this item’s value”—those are conceptual, not implemented.

---

## 4. Main screens, tabs, or modes

| Tab / area | Purpose |
|------------|--------|
| **Ledger** | Add-item form (name, tier, value, qty, status, notes); “Party Haul” table with tier, value, status (click to cycle), remove; “Active Holdings Total” in footer. |
| **Loot Roller** | Tier system dropdown: “Standard 5e (CR-based)”, “Custom (leverage / trade tiers)”, “Hansi Loot Table”. Context options per mode (CR + hoard type; tier + market context; tier + category). “Roll the Hoard”, “View current table”, roll results (click item → detail modal), “Add All to Ledger”, “Re-roll”. |
| **Market** | Leverage Calculator (tier + “Selling To” → 0–100 + note); Market Conditions list (two active, from Randomize); “View all conditions” modal. |
| **Factions** | List of factions (name, alignment pill, “Wants”); “Add Custom Faction” (name, alignment, “Wants / Buys”). No selection of “which faction is buyer” for an item or for the calculator. |

Modals: Help (?), Conditions reference, Loot table reference (“View current table”), Roll item detail (Est. Value, Rarity, Tier, Weight, Category, Requirements, Source, Description).

---

## 5. Important data fields and what they mean

**Ledger item** (in `state.items`):  
`id`, `name`, `tier` (0–5), `val` (gp number), `qty`, `status` (`holding` | `forsale` | `sold` | `leverage`), `notes`.  
- **tier:** Index into `TIER_INFO`; drives badge, “value range” text, and Leverage Calculator base.  
- **status:** “Leverage” is “use for influence, not sold” but has no separate logic—only color/label.

**Rolled item** (in `state.lastRolled`):  
Same as above plus `note` (description), and when from Hansi: `category`, `rarity`, `weight`, `requirements`, `author`.  
When added to ledger, only `name`, `tier`, `val`, `qty`, `status`, `notes` (from `note`) are stored—Hansi metadata is dropped.

**Tier (tier-info.json):**  
`label` (e.g. "T3"), `name` (e.g. "Minor Magic"), `range` (e.g. "100–500gp"), `leverage` (0–100 base), `color` (CSS class).  
Tiers are the **only** link between “how rare/valuable” and “how much leverage with a buyer.”

**Faction (state.factions / default-factions.json):**  
`name`, `align` (ally | neutral | hostile | unknown), `wants`, `color`, `textColor`.  
“Wants” is free text (e.g. “Information, anti-evil artifacts, scrolls”); there is **no structured matching** to item tier, category, or name.

**Market condition:**  
`name`, `effect` (prose, e.g. “Spell scrolls & arcane items +80%”), `border` (hex).  
Shown in UI only; **no numeric effect** on value or leverage.

**Loot table item (any source):**  
`name`, `tier`, `val`, `note`; custom/Hansi add context-specific notes. Hansi items also have `category`, `rarity`, `weight`, `requirements`, `author` in JSON and in `lastRolled`, but not in ledger after “Add All.”

---

## 6. Main calculations, scoring, or business logic

- **Active Holdings Total:** Sum of `item.val * item.qty` for items where `item.status !== 'sold'`. No modifier from conditions or buyer.
- **Leverage Calculator (`calcLeverage()`):**  
  - Base = `TIER_INFO[tier].leverage` (e.g. T3 → 55).  
  - Buyer mods: market 0, guild +12, noble +8, black -25, faction +20.  
  - Final = clamp(base + mod, 0, 100).  
  - Display: badge, “X/100 leverage”, progress bar, one static note per buyer type, “Base value range: …”.  
  **No input is “which item” or “which faction”—only abstract tier and generic buyer.**
- **Roll:** Pool = table selected by tier system + options; shuffle; take 2–6 items; store in `state.lastRolled`. No weighting by rarity or desirability beyond “what’s in the table.”
- **Market conditions:** Randomize picks two from `MARKET_CONDITIONS`; no application to prices or leverage.
- **Factions:** No computation; display and add/remove only.

So the **only** real “economy” logic is: tier + buyer type → single leverage number. Value is never modified by conditions or by faction demand.

---

## 7. What the tool currently does well

- **Single coherent tier system (T0–T5):** Same tiers for ledger, all rollers, and leverage; badges and ranges are consistent.  
- **Multiple roll modes:** CR-based, tier+market-context, and Hansi (tier+category) give different “flavors” of loot.  
- **Custom tables’ notes:** `custom-loot-tables.json` notes are written for leverage/faction/fence context, which supports the intended fantasy even if the app doesn’t act on them.  
- **Hansi integration:** Rich items (description, properties, rarity, weight, category, etc.) and item-detail modal make rolled loot feel like a collectible-style table.  
- **Status cycle:** Holding → For Sale → Sold → Leverage makes “lifecycle” of an item explicit.  
- **Persistence and sync:** One state blob; hub storage or localStorage; 8s poll for remote changes.  
- **Help and reference modals:** Help explains tabs; “View current table” and “View all conditions” reduce guesswork.

---

## 8. What it is trying to do conceptually

The app is **trying to become** a **collectible-style, rarity-driven loot economy**, not just a loot list:

- **Rarity/tier** should drive both “what you can roll” and “how much trade leverage and secondary market value you have.”
- **Market conditions** should change what’s desirable and what things are “worth” in a given situation.
- **Factions** should be potential buyers with **demand** (wants) that can be matched to items—so “this faction wants X, we have X” improves deal outcome.
- **Leverage** should feel like “negotiating power” that depends on item, buyer, and possibly conditions—not a generic tier + buyer lookup.
- **Status “Leverage”** should mean “we’re using this for influence/favors, not selling for gp”—implying a connection to factions or non-cash deals.

So the **intent** is: tiered loot tables + tier-driven value/leverage + conditions that shift the market + factions that want specific things = a small “economy” layer on top of a tracker. The implementation is only partway there.

---

## 9. Where the current implementation falls short

- **Leverage is abstract, not item-specific:** You choose “Item Tier” and “Selling To” in a vacuum. You cannot select a ledger item and ask “what’s my leverage selling *this* to *this faction*?” So leverage is a **reference** for the table, not a **tool** for a specific deal.
- **Market conditions are flavor only:** They’re not inputs to any formula. The help text says they “affect how you might roleplay selling,” but the app never applies +80% or -50% to value or leverage. Conditions feel like they should **modify** value or desirability; they don’t.
- **Factions are disconnected:** “Wants” is text only. There is no “this faction wants arcane items” → “we have a T3 spell scroll” matching, no “suggested buyers” for an item, and the Leverage Calculator’s “Faction (allied)” is not tied to any faction in the list. So factions don’t participate in the economy.
- **“Leverage” status is underused:** Marking an item Leverage doesn’t link it to a faction or a deal; it’s just a label. The idea of “we’re holding this for leverage” isn’t supported by workflow or calculations.
- **Hansi metadata is lost on add:** When you “Add All to Ledger,” only `name`, `tier`, `val`, `note` (as `notes`) are kept. Category, rarity, weight, requirements, author are dropped, so the ledger can’t later support “filter by category” or “match to faction wants” using that data.
- **No desirability or demand score:** Rarity/tier is the only axis. There’s no notion of “this buyer values this category more” or “this item is especially desirable to Harpers” except in prose.
- **Terminology overlap:** “Leverage” is (1) a status value, (2) a 0–100 score in the calculator, and (3) a concept in help text. That can confuse: “set status to Leverage” vs “your leverage with this buyer is 75.”

---

## 10. Ways to better support rarity, desirability, trade leverage, market value, and faction interest

- **Rarity / desirability:**  
  - Keep tier as the main “power” axis but allow optional **category** (or tags) on ledger items (e.g. from Hansi or manual).  
  - Use category/tags plus tier to drive a **desirability** or **demand** notion per buyer type or per faction (e.g. “Harpers want scrolls/artifacts” → higher effective leverage or a “match” indicator for items with matching tags).

- **Trade leverage:**  
  - Make the Leverage Calculator **item-aware:** e.g. “Selling this item” (dropdown or select from ledger) so the UI shows “Selling [Cloak of Elvenkind] to [Guild] → 67/100 leverage” using that item’s tier (and later category/tags).  
  - Optionally let “Selling To” be a **specific faction** from the Factions list, and use that faction’s `wants` (once parsed or tagged) to adjust leverage or show “good match / poor match.”

- **Market value:**  
  - Treat **market conditions** as modifiers: store a condition id or slug on state, and in a “current value” or “sale value” display use (e.g.) `val * conditionMultiplier` or a small table (condition + item tier/category → multiplier).  
  - Show “Base value” vs “Estimated sale value (given current conditions)” in the ledger or in the item-detail view.

- **Faction interest:**  
  - Add **structured wants** to factions (e.g. tags: `["scrolls", "artifacts", "information"]`) and optionally **tier preference** (e.g. “primarily T3+”).  
  - In the Ledger or a “Suggest buyers” action: for selected item(s), score or list factions whose wants match the item’s category/tags/tier, and show “Harpers: good match” or leverage for that faction.  
  - Allow “Selling To” in the calculator to be a dropdown of **your** factions instead of a fixed set of buyer types.

---

## 11. Suggested UI changes

- **Ledger:**  
  - Add optional **Category** (or tags) when adding an item (and when adding from Hansi roll, carry over category).  
  - For items with status “For Sale” or “Leverage,” show a control: “Suggest buyers” or “Who wants this?” that opens a small list of factions sorted by match (once matching exists).  
  - Show “Base value” and, when conditions exist, “Est. value (current conditions)” if condition modifiers are implemented.

- **Leverage Calculator:**  
  - Add “Item (optional)”: dropdown of ledger items; when selected, use that item’s tier (and later category) and prefill tier.  
  - Add “Buyer”: include “Faction” with a sub-dropdown of `state.factions`, so leverage (and later match) can be “selling this to Harpers.”  
  - Surface the current **market condition(s)** near the calculator and, when implemented, show “Conditions: City Under Siege — T4 weapons +60%” so the number feels connected to the world.

- **Factions:**  
  - When “Wants” is used for matching, consider a structured editor (e.g. chips or checkboxes for common categories) plus free text, so “wants” can be both human-readable and machine-usable.  
  - In the faction list, show a count or hint: “3 ledger items match” when matching is implemented.

- **Roll results:**  
  - “Add All to Ledger” could open a small dialog: “Add with category/rarity?” and optionally write `category`/`rarity` to the new ledger items so they’re available for matching and filters.

- **Global:**  
  - One place (e.g. Market tab or header) that always shows “Current conditions: [A], [B]” so conditions don’t feel buried.  
  - Clarify “Leverage” in UI: e.g. status = “Leverage (holding for deals)” and calculator = “Leverage score” or “Negotiating power.”

---

## 12. Suggested data model changes

- **Ledger item:**  
  - Add optional `category` (string) and/or `tags` (array of strings) so items can be matched to faction wants and used in “desirability” logic.  
  - When adding from Hansi roll, persist `category`, `rarity`, `weight`, `requirements`, `author` if you want them in the ledger (for filters and matching).

- **Faction:**  
  - Add optional `wantsTags` (array of strings), e.g. `["scrolls", "artifacts", "information"]`, derived or in addition to `wants` prose, so matching can be computed.  
  - Optional: `preferredTierMin` / `preferredTierMax` or a single “tier interest” to weight leverage by tier.

- **Market condition:**  
  - Add optional `modifiers` (e.g. `{ "scrolls": 1.8, "T4_weapons": 1.6 }`) or a simple list of (category/tier, multiplier) so conditions can drive a **value modifier** in code.  
  - Store **active condition ids** (or slugs) in state, not just the two condition objects, so the app knows “which condition is active” for formulas.

- **State:**  
  - Keep `state.conditions` as the two active conditions; ensure they have an `id` or `name` that the value/leverage logic can use.  
  - No need to store “current buyer” or “current item” in state for the calculator if you only need them in the UI (dropdowns); if you want “last used” defaults, you could add `lastCalcItemId`, `lastCalcBuyer`.

---

## 13. Suggested terminology changes

- **Status “Leverage”:** Rename to something like “Leverage (holding)” or “Holding for deal” so it’s clear it’s a **disposition** of the item, not the numeric score. Tooltip: “Using for influence or faction deal, not selling for gp.”
- **Leverage Calculator:** Consider sublabel “Negotiating power (0–100) by tier and buyer” so “leverage” is clearly the score. Optionally rename the section to “Sale leverage” or “Deal leverage.”
- **“Selling To”:** When factions are integrated, label could be “Buyer / Faction” and the dropdown could group “Open market,” “Guild,” etc., plus “Factions” with names underneath.
- **“Base Value” in ledger:** If you add condition-adjusted value, label the current field “Base value (gp)” and the derived one “Est. value (current conditions)” or “Market value.”
- **“Wants / Buys” (factions):** If you add structured tags, keep “Wants / Buys” as the human-facing description and add “Demand tags” or “Interests” in the data model/UI for matching.
- **Loot Roller “Tier system”:** The three options mix “where the table comes from” (CR vs tier+context vs Hansi). Consider grouping: “Table source: Standard 5e | Custom economy | Hansi table,” then show the relevant filters below so “tier” isn’t overloaded (tier of items vs tier as filter).

---

## 14. In plain English

**Party Loot Ledger** is an app for D&D tables that want to treat loot a bit like a **collectible economy**: you roll or add items that have a **tier** (from mundane to legendary), you track not only what you have but whether you’re **holding it, selling it, sold it, or using it for leverage**, and you get a **leverage score** (0–100) that’s supposed to reflect how strong your position is when “selling” that tier of item to a type of buyer (market, guild, noble, fence, faction). There are **market conditions** (e.g. “City Under Siege”) and **factions with wants** (e.g. “Harpers want information and artifacts”) to make the world feel like demand and context matter. Right now, the app is a **solid loot tracker** with tier badges, multiple ways to roll loot, and one **generic** leverage number; the conditions and factions are **for flavor and roleplay** only. The **goal** is to move it toward a real “rarity and tier drive value and leverage, and factions and conditions change what’s worth what.”

---

## 15. Next 5 highest-impact improvements

1. **Wire Leverage Calculator to a specific ledger item and (optionally) a specific faction.** Let the user pick “This item” (from ledger) and “This buyer” (including factions from the Factions list). Use the item’s tier (and later category/tags) and the chosen buyer to compute and show leverage. This makes “leverage” about a **concrete deal**, not an abstract tier.

2. **Persist Hansi metadata when adding to ledger.** When “Add All to Ledger” is used from a Hansi roll, save `category`, `rarity`, and optionally `author` on the new ledger items. Then the ledger can filter or display by category and, later, use category for faction matching and desirability.

3. **Give market conditions a mechanical effect.** Add a simple rule set (e.g. condition name or id → multiplier by tier or category) and display “Estimated value under current conditions” (or “Sale value”) next to base value for ledger items. Even one or two conditions with numeric effects will make the Market tab feel consequential.

4. **Add faction–item matching.** Parse or structure faction “wants” (e.g. tags or keywords) and, for each ledger item, score which factions “want” it (by tier/category/name). Surface this as “Suggested buyers” on the item or as a small “Matches” section in the Factions tab. This connects factions to the economy.

5. **Clarify and use the “Leverage” status.** Differentiate the status label (e.g. “Holding for deal”) from the numeric “leverage score,” and optionally let the user link a Leverage-status item to a faction (“reserved for Harpers”) or at least show a note “Intended buyer: …” so “Leverage” has a clear meaning in play.
