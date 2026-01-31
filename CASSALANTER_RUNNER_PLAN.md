# Brother George Ward's Cassalanter Inquiry - Episode Runner Plan (Revised)

## Overview

Single self-contained HTML file: Waterdeep-style investigation episode runner with **engine plus editable content**, standardized clue quality, structured Pressure effects, enforced episode flow, plain-text skill handling, explicit approach selection, and improved usability (Quick Start, cleaner export, collapsible sections).

---

## 1. Engine Plus Editable Content

- **Spec:** Tables are part of the engine; content is **editable by the user** and persisted. No hard-coded placeholder text that cannot be changed.
- **Stored in state and localStorage:**
  - Hooks (6 entries, keys 1-6)
  - Pressure table (rows with structured effects; keys 1, 2, 3, 4, 5, 6, 7, 8, 9, 10+)
  - Reveal table (8 entries, keys 1-8)
  - Compromised clues (4 entries, keys 1-4)
  - Site table (8 entries, keys 1-8)
  - Encounter Site: Sealed Family Chapel (boxed text, C1, C2, C3, outcomes)
- **UI:** "Tables" tab shows all tables with **editable fields** (e.g. `<textarea>` or contenteditable per cell). User can paste official text or customize. Save on blur or via "Save tables" so table content persists in localStorage under the same session key.
- **Initial load:** If no saved table content exists, seed with **default copy** (short descriptive placeholders, e.g. "Hook 1: [paste text]") so the app runs; user replaces with real content. One source of truth: engine + editable content.

---

## 2. Standardized Clue Quality Thresholds

Use **one** set of margins everywhere (in UI labels, log text, export block, and code comments):

| Margin | Label   | Definition                          |
|--------|--------|-------------------------------------|
| Below DC (failure) | partial  | Total < Case DC                     |
| 0 to 4 | solid   | Total >= Case DC and margin 0-4     |
| 5+     | strong  | Total >= Case DC and margin 5+      |

- **Code:** Single constant or comment block, e.g. `CLUE_QUALITY: { partial: { maxMargin: -1 }, solid: { minMargin: 0, maxMargin: 4 }, strong: { minMargin: 5 } }` or equivalent logic. Every place that assigns "partial/solid/strong" uses this (Progress resolution, log, export).
- **Doc/UI:** All references to clue quality use these three terms and this margin breakdown only.

---

## 3. Pressure Outcomes as Structured Effects

Model each Pressure table row as a **structured effect object**, not just `heatChange`. Support:

- `heatChange` (number, optional): add to Heat (e.g. +1, +2).
- `timeLoss` (boolean, optional): if true, log "Time lost" and optionally set a flag (e.g. next Progress costs an extra "beat" or log-only).
- `disadvantage` (boolean, optional): if true, set flag **next Progress roll has disadvantage**; clear flag after that Progress is resolved.
- `nextClueCompromised` (boolean, optional): if true, set flag **next clue is compromised** regardless of pass/fail; clear flag after next Progress.

**Example row shape:**

```js
{ min: 5, max: 5, text: "...", heatChange: 0, disadvantage: true }
{ min: 7, max: 7, text: "...", heatChange: 1, nextClueCompromised: true }
```

- **Apply automatically:** When Pressure is rolled, lookup row, apply `heatChange` to Heat, and set session flags from `disadvantage` and `nextClueCompromised`. Progress resolution checks these flags: if `disadvantage` set, roll 2d20 keep low and clear flag; if `nextClueCompromised` set, treat the next clue as compromised (and roll compromised d4) and clear flag.
- **Editable content:** In Tables tab, Pressure rows still have editable `text`; the effect fields can be editable (checkboxes/dropdowns) or fixed in the engine with editable text only. Plan: **effect fields are part of engine** (structured); only the narrative `text` is editable so users can paste official wording.

---

## 4. Enforce Episode Button Order

- **Sequence:** Hook -> Progress -> Pressure -> Reveal -> End Episode.
- **Rules:**
  - **New Episode:** Resets step to "before Hook". Enables "Roll Hook" only; disables Progress, Pressure, Reveal, End Episode until their turn.
  - After **Roll Hook:** Enable "Resolve Progress"; keep Pressure, Reveal, End disabled.
  - After **Resolve Progress:** Enable "Roll Pressure"; keep Reveal, End disabled.
  - After **Roll Pressure:** Enable "Roll Reveal"; keep End disabled until user has rolled Reveal (optional: allow End anytime after Hook, or only after Reveal - recommend **End enabled only after Reveal** to keep "episode complete" clear).
  - After **Roll Reveal:** Enable "End Episode".
- **Implementation:** Single state enum, e.g. `episodeStep: 'hook' | 'progress' | 'pressure' | 'reveal' | 'end'`. After each action, advance step and update button disabled states. "New Episode" sets step to `'hook'` and clears step-dependent flags (e.g. disadvantage, nextClueCompromised) if desired.
- **Result:** No broken state from doing Pressure before Progress or Reveal before Pressure; log and flags stay consistent.

---

## 5. Skill Names as Plain Text Everywhere

- **Display and input:** Always treat skill name as **plain text**. When rendering:
  - Use `textContent` (or `value` for inputs), never `innerHTML` for user-supplied skill name. Prevents injection and formatting bugs.
- **Avrae export:** Build the suggestion from the current skill name:
  - **Sanitize:** Strip any HTML tags, limit to safe characters (e.g. letters, spaces, hyphen; or regex replace non-ASCII and angle brackets). Produce a single token suitable for `!check <skill>` (e.g. "investigation", "sleight-of-hand").
  - Example: `skillName.replace(/<[^>]*>/g,'').replace(/[^\w\s-]/g,'').trim().toLowerCase().replace(/\s+/g,'-')` or similar; document the rule in a short comment.
- **Storage:** Store skill name as string in state; never store or inject HTML.

---

## 6. Explicit Approach Selection

- **UI:** One **explicit selection** for approach: radio group or dropdown with four options:
  - A Legwork  
  - B Social Infiltration  
  - C Shadow Work  
  - D Divine Angle  
- **Behavior:**
  - **Legwork:** When selected, show optional toggle "10 gp for advantage". If checked, next Progress roll uses advantage (and clear after use or leave for user to uncheck).
  - **Social Infiltration:** No extra toggle; rule is "beat DC by 5+ = second lead". App checks margin >= 5 on success and logs "second lead" when this approach is selected.
  - **Shadow Work:** When selected, on **Progress failure** add Heat +2 instead of +1. No "public pressure" toggle.
  - **Divine Angle:** When selected, show optional toggle "Public pressure (+1 Heat on success)". If checked and Progress **succeeds**, add Heat +1 after resolving Progress.
- **Predictability:** Shadow Work and Divine toggles only affect behavior when their approach is selected; Legwork advantage and Divine "public pressure" are clearly tied to Legwork/Divine only. Document in UI: "Approach: [selection]. Options below apply only to the selected approach."

---

## 7. Usability Improvements

### Quick Start preset

- **Button:** "Quick Start" (or "Start episode").
- **Action:** Set Case DC 15, Heat 0, Doom off (or leave Doom as-is), set episode step to `'hook'`, optionally **auto-roll Hook** and append to log so the user sees the hook immediately. Result: user lands on "ready to choose approach and resolve Progress" in one click. If no Hook is rolled, just reset step and defaults so "Roll Hook" is the only enabled action.

### Cleaner export block (Discord narrative)

- **Structure:** Fixed sections in a consistent order, e.g.:
  1. Last scene / boxed text (if any)
  2. Roll results (last Progress, Pressure, Reveal)
  3. Heat and Doom
  4. Next lead / clue to follow
- Use clear headings or line breaks; avoid run-on paragraphs. Format as Markdown suitable for Discord (e.g. code block or blockquote). "Copy Discord block" copies this single formatted string.

### Collapsible sections for mobile

- **Left column:** Group controls into sections, each **collapsible** (e.g. `<details>` with `<summary>`):
  - How to use  
  - Case DC / Heat / Doom  
  - Approach selection and toggles  
  - Progress (skill, modifier, advantage/disadvantage, Resolve)  
  - Notes (Leads and Clues)  
  - Export (Discord, Avrae)  
- Default: "How to use" can start collapsed; others open or collapsed by preference (optional: remember open/closed in localStorage). Reduces scrolling on small screens while keeping everything one tap away.

---

## 8. Implementation Checklist (Revised)

- [ ] **Data:** Table content editable and persisted; Pressure rows use structured effects (heatChange, timeLoss, disadvantage, nextClueCompromised); seed defaults if empty.
- [ ] **Clue quality:** One shared threshold set (partial / solid / strong by margin); use in Progress, log, and export.
- [ ] **Pressure:** Lookup row by roll result; apply heatChange and set flags from disadvantage and nextClueCompromised; Progress reads and clears flags.
- [ ] **Episode order:** `episodeStep` state; buttons enabled/disabled by step; New Episode resets to Hook.
- [ ] **Skill name:** textContent only; Avrae sanitization (strip tags, safe chars); store as string.
- [ ] **Approach:** Explicit radio/dropdown; Legwork/Divine toggles and Shadow Work/Divine heat rules only when that approach selected.
- [ ] **Quick Start:** One-click preset (DC 15, Heat 0, step hook, optional auto Roll Hook).
- [ ] **Export:** Discord block with clear sections; Avrae copy from sanitized skill.
- [ ] **Collapsible:** Left-column sections in `<details>` (or equivalent) for mobile-friendly layout.

---

## 9. Deliverable

- Single `.html` file: all markup, CSS, and JavaScript; no external assets.
- Engine plus editable content; standardized clue quality; structured Pressure effects; enforced episode flow; plain-text skill handling; explicit approach selection; Quick Start, cleaner export, collapsible sections.
- No em dashes in UI text; mobile-friendly; short "How to use" at top.
