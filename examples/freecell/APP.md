---
name: freecell
description: Classic Freecell solitaire card game
version: 1.0.0
runtime: bun
entry: index.html
server: serve.ts
port: 3002

category: game
tags:
  - solitaire
  - cards
  - casual
  - single-player

display:
  width: 1024
  height: 768
  resizable: true

icon: assets/icon.svg

accessibility:
  high_contrast: true
  reduced_motion: true
  keyboard_nav: true
  screen_reader: true

i18n:
  default_locale: en
  supported_locales: [en, es, fr]
  locales_dir: /locales

storage:
  user_data:
    enabled: true
    max_size: 1MB
  persist:
    - saves/*
    - statistics.json
    - preferences.json

agent:
  discoverable: true
  launchable: true
  triggers:
    - user wants to play cards
    - user wants solitaire
    - user is bored
    - user needs a break
  provides:
    - entertainment
    - card game
    - brain exercise
---

# Freecell

A faithful implementation of the classic Freecell solitaire card game.

## Rules

- Build foundation piles from Ace to King by suit
- Use four free cells as temporary storage
- Move cards between columns in descending order, alternating colors

## Controls

- **Click** a card to select, click destination to move
- **Double-click** to auto-move to foundation
- **Drag and drop** cards between piles

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| N | New game |
| R | Restart |
| Z / Ctrl+Z | Undo |
| H | Hint |
| 1-8 | Select column |
| A-D | Select free cell |

## Running

```bash
# Using weblet CLI
weblet run .

# Or directly with Bun
bun serve.ts
```

Then open http://localhost:3002
