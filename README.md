# D&D Tools Hub

A web-based D&D 5e toolkit for Dungeon Masters and players. The central hub ([index.html](index.html)) links to specialized tools. Built with pure HTML/CSS/JS, theme support (light/dark via [theme.js](theme.js)), and responsive layouts.

---

## Shared assets

| Asset | Role |
|-------|------|
| [global.css](global.css) | Base layout, CSS variables, theme (light/dark). Loaded first on every page. |
| [theme.js](theme.js) | Dark/light toggle and persistence. Used on hub and all tool pages. |
| [styles.css](styles.css) | Shared form/tool styling for AI DM Prompt Builder, Adventure Packet Builder, Adventure Maker, Cassalanter Runner, Cassalanter Wizard. |
| [character-sheet-importer.js](character-sheet-importer.js) | Shared D&D 5e character sheet PDF parsing (requires PDF.js). Used by Combat Turn Helper and Cassalanter Inquiry Wizard. |
| PDF.js (CDN) | Used only where PDF import exists: Combat Turn Helper, Cassalanter Inquiry Wizard. |

---

## Hub page

- **Page:** [index.html](index.html)
- **CSS:** global.css, [hub.css](hub.css)
- **Scripts:** theme.js
- **Features:** Card grid linking to all tools; no tool-specific features.

---

## Tools (per page)

Tools live in `tools/<name>/` with `index.html` as the entry point.

### AI DM Prompt Builder

**Page:** [tools/ai-dm-prompt-builder/](tools/ai-dm-prompt-builder/)

- **Purpose:** Build prompts for AI (ChatGPT, Claude, etc.) to run D&D 5e adventures as DM.
- **CSS:** global.css, styles.css (from root)
- **Scripts:** theme.js (from root), [script.js](tools/ai-dm-prompt-builder/script.js)
- **Features:**
  - Manual Builder (DMG-style adventure structure)
  - AI Assistant tab with **AI prompt generator** (party level, tone, length, hook)
  - Paste AI JSON to auto-fill form
  - **Run Prompt** (ready-to-paste DM prompt)
  - JSON import/export
  - localStorage auto-save

---

### Adventure Packet Builder

**Page:** [tools/adventure-packet-builder/](tools/adventure-packet-builder/)

- **Purpose:** Build Adventure Packets for LM Studio (first DM message after system prompt).
- **CSS:** global.css, styles.css
- **Scripts:** theme.js, [adventure-packet-builder.js](adventure-packet-builder.js)
- **Features:**
  - Same Manual Builder + AI Assistant as AI DM Prompt Builder
  - **AI prompt generator**
  - Paste AI JSON to fill form
  - Output is **formatted packet for LM Studio**
  - JSON import/export

---

### Adventure Maker

**Page:** [tools/adventure-maker/](tools/adventure-maker/)

- **Purpose:** Author D&D 5e adventures for AI deep research (campaign context, progressive disclosure).
- **CSS:** global.css, styles.css (+ inline Adventure Maker step-nav/layout)
- **Scripts:** theme.js, [adventure-maker.js](adventure-maker.js)
- **Features:**
  - Step-based authoring
  - JSON import/export
  - No PDF; no AI prompt generator in-page (focused on authoring structure)

---

### Combat Turn Helper

**Page:** [tools/combat-turn-helper/](tools/combat-turn-helper/)

- **Purpose:** Guide players through a D&D 5e combat turn (decision tree).
- **CSS:** global.css, [combat-turn-helper.css](combat-turn-helper.css)
- **Scripts:** PDF.js (CDN), character-sheet-importer.js, theme.js
- **Features:**
  - **Player character sheet PDF importer** (fills name, speed, etc.)
  - JSON import/export for state
  - Movement / Action / Bonus Action / Interaction / Reaction tracking
  - “Not your turn” screen with **reaction widget**
  - Undo; turn log; rules reference snippets

---

### Brother George Ward's Cassalanter Inquiry (Runner)

**Page:** [tools/cassalanter-inquiry-runner/](tools/cassalanter-inquiry-runner/)

- **Purpose:** Waterdeep-style investigation episode runner for solo play (Hook, Progress, Pressure, Reveal).
- **CSS:** global.css, styles.css (+ inline runner layout/panels)
- **Scripts:** theme.js (no PDF, no character-sheet-importer)
- **Features:**
  - Case DC, Heat, Doom tracking
  - In-app dice
  - Export to Discord/Avrae
  - No PDF import

---

### Cassalanter Inquiry (Wizard)

**Page:** [tools/cassalanter-inquiry-wizard/](tools/cassalanter-inquiry-wizard/)

- **Purpose:** Guided wizard for the same investigation episode (one step per screen).
- **CSS:** global.css, styles.css (+ inline wizard card/step styles)
- **Scripts:** PDF.js (CDN), character-sheet-importer.js, theme.js
- **Features:**
  - **Import character sheet PDF** (Import PDF button)
  - Steps: Setup, Hook, Progress, Pressure, Reveal, Wrap
  - Back/Next, reroll step, reset
  - Same Case DC/Heat/Doom and Discord/Avrae flow as Runner

---

### Wagers & Fortunes

**Page:** [tools/wagers-fortunes/](tools/wagers-fortunes/)

- **Purpose:** Configurable Waterdeep-style storefront mystery-box encounter. The DM defines outcomes for each box so play is fair and repeatable.
- **CSS:** global.css, styles.css, [wagers-fortunes.css](tools/wagers-fortunes/wagers-fortunes.css)
- **Scripts:** theme.js, [wf-logic.js](tools/wagers-fortunes/wf-logic.js), [seed-data.js](tools/wagers-fortunes/seed-data.js), [script.js](tools/wagers-fortunes/script.js)
- **Features:**
  - **DM Builder:** Create/edit/delete games; define tiers (wager) and boxes (outcome type, reveal text, contents, estimated value, DM notes). Quick-start template (one tier, three boxes: break-even / win / loss). Optional limiter (per day, per session, or cooldown) and optional skill-check hint (e.g. Insight DC 12 for a vague hint).
  - **Run Game:** Select game and tier, optional character name; Start then choose a box to reveal the outcome. Outcomes are fixed unless “shuffle boxes each run” is on. Session log records each play; limiter can block with a clear message (DM override available).
  - **Log:** Table of plays with filters by game, tier, and name; export to JSON or CSV.
- **How to add a game:** DM Builder → New game → set name, location, description, number of boxes → Add tier or Quick start template → for each tier set wager and define each box (label, type, reveal text, contents, estimated value, notes) → Save game.
- **How to define tiers:** Each game has one or more tiers. Each tier has a wager (gp) and exactly N boxes (N = game’s “number of boxes”). Define each box’s outcome type (break-even / win / loss / custom), player-facing reveal text, full contents, and optional DM notes.
- **How to run at the table:** Run Game → select game and tier → optionally enter character/player name → Start → (optional) Make a check for a hint → player picks a box → reveal outcome; “Run again” respects the limiter unless DM override is used.

- **Testing:** Open [tools/wagers-fortunes/test-runner.html](tools/wagers-fortunes/test-runner.html) to run logic tests (validation, limiter, shuffle, log shape). Manual smoke test: open Run Game → select “Wagers & Fortunes: Waterdeep” and a tier → Start → pick a box → confirm reveal and a new entry in the Log tab.

---

### Playstyle Quiz

**Page:** [tools/playstyle-quiz/](tools/playstyle-quiz/)

- **Purpose:** Forced-choice quiz to discover D&D playstyle (narrative, tactical, exploration, etc.).
- **CSS:** global.css, [playstyle-quiz.css](playstyle-quiz.css)
- **Scripts:** theme.js, [playstyle-quiz.js](playstyle-quiz.js)
- **Features:**
  - 15 prompts, two choices each
  - Results with top playstyles and bar chart
  - Copy Results / Share; Restart
  - No PDF, no JSON import

---

## Scripts

### YouTube channel video list

**Script:** [tools/songbook/youtube_channel_videos.py](tools/songbook/youtube_channel_videos.py)

- **Purpose:** Scrape all video titles and URLs from a YouTube channel (or playlist) and write them to a text file. One line per video: `title | url`.
- **Prerequisite:** `pip install -r requirements.txt` (or `pip install yt-dlp`).
- **Usage:**
  - `python tools/songbook/youtube_channel_videos.py "https://www.youtube.com/@ChannelName"` (writes to `ChannelName-music.txt` by default)
  - Custom output: `python tools/songbook/youtube_channel_videos.py "https://www.youtube.com/@ChannelName" output.txt`
- **Output:** Plain text file with one line per video: title and URL (e.g. `Title | https://www.youtube.com/watch?v=...`). Channel URLs are the primary use; playlist URLs work the same way.

**Convert to Songbook import:** [tools/songbook/music_txt_to_ambience_json.py](tools/songbook/music_txt_to_ambience_json.py) turns a `*-music.txt` file into Songbook import JSON (folders, profiles with emojis, settings). Usage: `python tools/songbook/music_txt_to_ambience_json.py "ChannelName-music.txt"` (writes `ChannelName-music.json` by default). Import the JSON via Songbook.

---

## Tech stack

HTML/CSS/JS only; localStorage where needed; PDF.js via CDN for PDF tools; no build step.

---

## Summary table

| Page | CSS | Scripts | Key features |
|------|-----|---------|--------------|
| [index.html](index.html) | global.css, hub.css | theme.js | Hub navigation |
| [tools/ai-dm-prompt-builder/](tools/ai-dm-prompt-builder/) | global.css, styles.css | theme.js, script.js | AI prompt, Run Prompt, JSON import/export |
| [tools/adventure-packet-builder/](tools/adventure-packet-builder/) | global.css, styles.css | theme.js, adventure-packet-builder.js | AI prompt, LM Studio packet, JSON import/export |
| [tools/adventure-maker/](tools/adventure-maker/) | global.css, styles.css + inline | theme.js, adventure-maker.js | Step authoring, JSON import/export |
| [tools/combat-turn-helper/](tools/combat-turn-helper/) | global.css, combat-turn-helper.css | PDF.js, character-sheet-importer.js, theme.js | PDF import, JSON import/export, turn tracking, reaction widget |
| [tools/cassalanter-inquiry-runner/](tools/cassalanter-inquiry-runner/) | global.css, styles.css + inline | theme.js | Case DC/Heat/Doom, dice, Discord/Avrae export |
| [tools/cassalanter-inquiry-wizard/](tools/cassalanter-inquiry-wizard/) | global.css, styles.css + inline | PDF.js, character-sheet-importer.js, theme.js | PDF import, wizard steps, Discord/Avrae |
| [tools/playstyle-quiz/](tools/playstyle-quiz/) | global.css, playstyle-quiz.css | theme.js, playstyle-quiz.js | 15-question quiz, results, Copy/Share |
| [tools/legacy-project-builder/](tools/legacy-project-builder/) | global.css, styles.css | PDF.js, character-sheet-importer.js, theme.js, legacy-project-builder.js | PDF import, wizard steps, JSON import/export |
| [tools/songbook/](tools/songbook/) | global.css, ambience-sounds.css | theme.js, ambience-sounds.js, presets | YouTube music links, folders, export/import |
| [tools/wagers-fortunes/](tools/wagers-fortunes/) | global.css, styles.css, wagers-fortunes.css | theme.js, wf-logic.js, seed-data.js, script.js | DM Builder, Run Game, Log, limiter, hint check, export JSON/CSV |
| [tools/qbasic-editor/](tools/qbasic-editor/) | global.css, qbasic-editor.css | theme.js | Plain-text editor, autosave |
