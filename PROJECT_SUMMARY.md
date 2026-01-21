# Project Summary: D&D Tools Hub

## Overview

A comprehensive web-based toolkit for Dungeons & Dragons 5th Edition, designed to support both Dungeon Masters and players in creating memorable adventures and managing gameplay. The project consists of a central hub that provides access to specialized tools, each focused on solving specific D&D gameplay challenges.

## Core Philosophy

The tools are built with a deep understanding of D&D 5e mechanics and the Dungeon Master's Guide principles, emphasizing:
- **Situations over plots**: Adventures are dynamic situations that players help author, not rigid storylines
- **Player agency**: Tools support multiple paths and creative problem-solving
- **DMG-faithful design**: Following official design principles for balanced, engaging content

## Tools

### 1. Adventure Builder
A comprehensive adventure creation tool that helps DMs build structured, DMG-compliant adventures.

**Key Features:**
- **Manual Builder**: Step-by-step form following DMG adventure structure
  - Premise (situation, conflict, stakes, time pressure)
  - Hook system (Patron, Supernatural, or Happenstance)
  - Threads (2-3 investigatable leads for player choice)
  - Encounters (objective + obstacle framework)
  - NPCs, Locations, and Ending scenarios
  - Validation and auto-fill suggestions

- **AI Assistant**: 
  - Generates optimized prompts for AI tools (ChatGPT, Claude, etc.)
  - Parses AI-generated JSON responses to auto-populate the form
  - Ensures AI output follows DMG principles

- **Export Options**:
  - JSON export for data portability
  - "Build Prompt" for AI-assisted expansion
  - "Run Prompt" optimized for live DM sessions

- **Persistence**: Auto-saves to localStorage with schema versioning

**Design Principles:**
- Every encounter requires an objective (what players want) and obstacle (what stands in their way)
- Fail-forward consequences that keep the story moving
- Multiple ending scenarios based on player choices
- Thread system ensures player choices matter

### 2. Combat Turn Helper
An interactive decision tree tool that guides players through their D&D 5e combat turn.

**Key Features:**
- **Turn Structure Tracking**: 
  - Movement
  - Action
  - Bonus Action
  - Interaction (one free object interaction)
  - Reaction (available even when not your turn)

- **Decision Tree Interface**: 
  - Step-by-step guidance through turn options
  - Contextual help and rules references
  - Visual state tracking

- **Undo Support**: Allows players to backtrack and reconsider decisions

- **Reaction Widget**: Special interface for managing reactions during other players' turns

- **Dark Mode Support**: Full theme system with system preference detection

## Technical Architecture

### Technology Stack
- **Pure HTML/CSS/JavaScript**: No frameworks, lightweight and fast
- **LocalStorage**: Client-side persistence for user data
- **Responsive Design**: Mobile-friendly interfaces
- **Theme System**: Unified light/dark mode across all tools

### Code Organization
- Modular JavaScript with clear separation of concerns
- Schema versioning for data migration
- Debounced auto-save to prevent excessive localStorage writes
- Validation pipelines for data integrity

### Design Patterns
- Form data collection → Validation → Normalization → Rendering pipeline
- Dynamic section rendering for complex nested data (threads, encounters, NPCs)
- Event-driven architecture with debouncing for performance

## User Experience

### Hub Page
- Clean, card-based navigation
- Tool descriptions help users find the right tool
- Consistent theming across all tools
- Placeholder for future tool expansion

### Accessibility
- Semantic HTML structure
- ARIA labels for theme toggle
- Keyboard navigation support
- Mobile-responsive layouts

## Current State

The project is functional with two complete tools:
1. ✅ **Adventure Builder** - Fully implemented with manual and AI-assisted modes
2. ✅ **Combat Turn Helper** - Complete turn management system

### Future Expansion
The hub structure is designed to easily accommodate additional tools:
- Character Generator (placeholder in code)
- Additional DM utilities
- Player aids

## Key Differentiators

1. **DMG-Faithful**: Not just generic adventure builders, but tools that enforce D&D 5e best practices
2. **AI Integration**: Smart prompt generation that ensures AI tools produce DMG-compliant content
3. **Player-Focused**: Combat helper addresses real pain point of turn management
4. **No Dependencies**: Pure web technologies, works offline (with localStorage)
5. **Open Architecture**: JSON export/import allows integration with other tools

## Target Audience

- **Dungeon Masters**: Adventure Builder helps create structured, engaging adventures
- **Players**: Combat Turn Helper reduces cognitive load during combat
- **D&D Enthusiasts**: Tools that understand the game deeply, not generic generators

## Project Goals

The project aims to be the go-to toolkit for D&D 5e gameplay, combining:
- Deep game system knowledge
- Modern web UX
- Practical problem-solving
- Extensibility for future tools
