# Temper-True

A single-player, narrative-driven web experience built around a D&D side story.
This is not a GM tool or rules engine. It is a **scene-first interactive chronicle** that combines authored prose, light systems, and player choice.

---

## Concept

Temper-True follows George Ward, a Twilight Domain cleric, as he investigates a bureaucratic hold on lawful steel in Waterdeep. The experience blends:

* fixed, authored narrative scenes
* player-driven choices
* consequence tracking via tags
* selective dice resolution

The goal is to feel like **reading and shaping a personal chronicle**, not operating a game interface.

---

## Core Design Pillars

### 1. Authored Narrative Backbone

Each scene has fixed prose that preserves tone and intent from the module.

The LLM layer:

* handles choice responses
* adjusts tone based on consequence tags
* modifies NPC attitude and flavor text

Scenes are stable. Reactions are dynamic.

---

### 2. Consequence System (Tags)

Player actions generate tags that persist across scenes.

Examples:

* Clean Narrative / Sour Narrative
* Steel-Bound / Shadow-Marked
* Shop Trust: Up

Tags influence:

* dialogue tone
* NPC behavior
* difficulty (DC shifts)
* available options

---

### 3. Dice System (Hybrid)

Two types of checks:

**Standard Checks**

* player rolls physical dice
* enters result manually
* used for most interactions

**Critical Checks (App Rolled)**

* resolved with built-in digital roll
* used for key story hinge points

Critical checks occur at:

* Scene 2 → Narrative (reputation)
* Scene 4 → Truth (source of the hold)
* Scene 7 → Integrity (steel outcome)

---

### 4. Persistence

State is saved using `localStorage`.

Includes:

* current scene
* tags
* past choices
* narrative state

The experience is designed to span multiple sittings.

---

## Visual Direction

This project is built as a **material-driven interface**, not a standard web UI.

### Design Intent

* Objects on a desk, not panels on a screen
* Parchment, leather, ink, steel, lanternlight
* Blue-hour Waterdeep atmosphere

### Structure

* Desk background (static image)
* Center parchment (main narrative)
* Right-side chronicle (state tracking)
* Ritual panel (critical checks)

All interactive elements are real HTML layered over visual assets.

---

## Tech Stack

* HTML / CSS / vanilla JavaScript
* No framework required
* Single-page application
* `localStorage` for persistence

---

## Project Structure (suggested)

```
/assets
  desk.png
  parchment.png
  leather.png
  ritual.png
  props.png

/index.html
/styles.css
/app.js
/scenes.js
/state.js
```

---

## Key Systems

### Scene Engine

* loads scene data
* renders prose
* presents choices
* applies outcomes

### Tag System

* global state object
* additive and persistent
* used to condition logic and tone

### Check Resolver

* determines manual vs critical
* evaluates success/failure
* triggers narrative branches

### Save System

* auto-saves after each action
* restores on load
* includes reset option

---

## Development Approach

Build in layers:

1. Functional layout (no styling)
2. Scene + choice flow
3. State + tags
4. Dice system
5. Persistence
6. Visual layering (assets + polish)

Do not start with styling.

---

## Design Principles

* Scene is the focus
* UI is secondary
* No modern SaaS patterns
* No unnecessary animation
* Restraint over decoration
* Everything should feel like it exists in-world

---

## Future Enhancements

* Expanded tag interactions
* Additional scenes or modules
* Subtle sound design (paper, dice, ambient)
* Mobile layout refinement
* Optional journal expansion

---

## Notes

This project is intentionally narrow in scope.
It is built to deliver a specific narrative experience with clarity and weight.

If something feels like a “feature,” it is probably unnecessary.

Focus on:

* readability
* pacing
* consequence

---

## License

Personal project. Adapt as needed.
