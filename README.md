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

### AI DM Prompt Builder

**Page:** [ai-dm-prompt-builder.html](ai-dm-prompt-builder.html)

- **Purpose:** Build prompts for AI (ChatGPT, Claude, etc.) to run D&D 5e adventures as DM.
- **CSS:** global.css, styles.css
- **Scripts:** theme.js, [script.js](script.js)
- **Features:**
  - Manual Builder (DMG-style adventure structure)
  - AI Assistant tab with **AI prompt generator** (party level, tone, length, hook)
  - Paste AI JSON to auto-fill form
  - **Run Prompt** (ready-to-paste DM prompt)
  - JSON import/export
  - localStorage auto-save

---

### Adventure Packet Builder

**Page:** [adventure-packet-builder.html](adventure-packet-builder.html)

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

**Page:** [adventure-maker.html](adventure-maker.html)

- **Purpose:** Author D&D 5e adventures for AI deep research (campaign context, progressive disclosure).
- **CSS:** global.css, styles.css (+ inline Adventure Maker step-nav/layout)
- **Scripts:** theme.js, [adventure-maker.js](adventure-maker.js)
- **Features:**
  - Step-based authoring
  - JSON import/export
  - No PDF; no AI prompt generator in-page (focused on authoring structure)

---

### Combat Turn Helper

**Page:** [combat-turn-helper.html](combat-turn-helper.html)

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

**Page:** [cassalanter-inquiry-runner.html](cassalanter-inquiry-runner.html)

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

**Page:** [cassalanter-inquiry-wizard.html](cassalanter-inquiry-wizard.html)

- **Purpose:** Guided wizard for the same investigation episode (one step per screen).
- **CSS:** global.css, styles.css (+ inline wizard card/step styles)
- **Scripts:** PDF.js (CDN), character-sheet-importer.js, theme.js
- **Features:**
  - **Import character sheet PDF** (Import PDF button)
  - Steps: Setup, Hook, Progress, Pressure, Reveal, Wrap
  - Back/Next, reroll step, reset
  - Same Case DC/Heat/Doom and Discord/Avrae flow as Runner

---

### Playstyle Quiz

**Page:** [playstyle-quiz.html](playstyle-quiz.html)

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

**Script:** [youtube_channel_videos.py](youtube_channel_videos.py)

- **Purpose:** Scrape all video titles and URLs from a YouTube channel (or playlist) and write them to a text file. One line per video: `title | url`.
- **Prerequisite:** `pip install -r requirements.txt` (or `pip install yt-dlp`).
- **Usage:**
  - `python youtube_channel_videos.py "https://www.youtube.com/@ChannelName"` (writes to `ChannelName-music.txt` by default)
  - Custom output: `python youtube_channel_videos.py "https://www.youtube.com/@ChannelName" output.txt`
- **Output:** Plain text file with one line per video: title and URL (e.g. `Title | https://www.youtube.com/watch?v=...`). Channel URLs are the primary use; playlist URLs work the same way.

**Convert to ambience import:** [music_txt_to_ambience_json.py](music_txt_to_ambience_json.py) turns a `*-music.txt` file into ambience-sounds import JSON (folders, profiles with emojis, settings). Usage: `python music_txt_to_ambience_json.py "ChannelName-music.txt"` (writes `ChannelName-music.json` by default). Import the JSON via Ambience Sounds.

---

## Tech stack

HTML/CSS/JS only; localStorage where needed; PDF.js via CDN for PDF tools; no build step.

---

## Summary table

| Page | CSS | Scripts | Key features |
|------|-----|---------|--------------|
| [index.html](index.html) | global.css, hub.css | theme.js | Hub navigation |
| [ai-dm-prompt-builder.html](ai-dm-prompt-builder.html) | global.css, styles.css | theme.js, script.js | AI prompt, Run Prompt, JSON import/export |
| [adventure-packet-builder.html](adventure-packet-builder.html) | global.css, styles.css | theme.js, adventure-packet-builder.js | AI prompt, LM Studio packet, JSON import/export |
| [adventure-maker.html](adventure-maker.html) | global.css, styles.css + inline | theme.js, adventure-maker.js | Step authoring, JSON import/export |
| [combat-turn-helper.html](combat-turn-helper.html) | global.css, combat-turn-helper.css | PDF.js, character-sheet-importer.js, theme.js | PDF import, JSON import/export, turn tracking, reaction widget |
| [cassalanter-inquiry-runner.html](cassalanter-inquiry-runner.html) | global.css, styles.css + inline | theme.js | Case DC/Heat/Doom, dice, Discord/Avrae export |
| [cassalanter-inquiry-wizard.html](cassalanter-inquiry-wizard.html) | global.css, styles.css + inline | PDF.js, character-sheet-importer.js, theme.js | PDF import, wizard steps, Discord/Avrae |
| [playstyle-quiz.html](playstyle-quiz.html) | global.css, playstyle-quiz.css | theme.js, playstyle-quiz.js | 15-question quiz, results, Copy/Share |
