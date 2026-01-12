# Examples Specification

**Spec Version**: 1.0.0
**Weblet Spec Reference**: v1.0.0, Sections 14, 19

---

## 1. Overview

This specification defines the reference example weblets that demonstrate the capabilities of the Weblet standard. These examples serve as both documentation and validation—if these examples work correctly, the reference implementation is complete. Examples range from minimal (2 files) to full-featured (agent integration, i18n, accessibility).

---

## 2. Requirements

### 2.1 Functional Requirements

#### Example Set

- **FR-EX-001**: The reference implementation SHALL include a "hello-world" minimal example
- **FR-EX-002**: The reference implementation SHALL include a "static-app" example with assets
- **FR-EX-003**: The reference implementation SHALL include a "counter" interactive example
- **FR-EX-004**: The reference implementation SHALL include a "freecell" game example
- **FR-EX-005**: The reference implementation SHALL include a "budget-dashboard" agent-integrated example

#### Example Quality

- **FR-QUAL-001**: Each example SHALL pass `weblet validate`
- **FR-QUAL-002**: Each example SHALL run without errors
- **FR-QUAL-003**: Each example SHALL demonstrate specific Weblet features
- **FR-QUAL-004**: Each example SHALL include complete APP.md documentation
- **FR-QUAL-005**: Each example SHALL be self-contained (no external dependencies beyond declared)

### 2.2 Non-Functional Requirements

- **NFR-EX-001**: Examples SHALL be easy to understand for developers new to Weblets
- **NFR-EX-002**: Examples SHALL follow best practices for code organization
- **NFR-EX-003**: Examples SHALL be accessible (WCAG 2.1 AA where applicable)
- **NFR-EX-004**: Examples SHALL work in all modern browsers

---

## 3. Example Specifications

### 3.1 hello-world (Minimal)

**Purpose**: Demonstrate the absolute minimum viable weblet.

**Demonstrates**:
- Minimum required files (APP.md + index.html)
- Minimum required manifest fields
- Browser runtime (no server)

**Structure**:
```
examples/hello-world/
  APP.md
  index.html
```

**APP.md**:
```yaml
---
name: hello-world
description: The simplest possible Weblet
version: 1.0.0
runtime: browser
---

# Hello World

A minimal Weblet demonstrating the basic structure.

## Running

Open index.html in any browser.
```

**index.html**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hello World</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f0f0f0;
    }
    h1 {
      color: #333;
    }
  </style>
</head>
<body>
  <h1>Hello, Weblets!</h1>
</body>
</html>
```

**Acceptance Criteria**:
- [ ] `weblet validate examples/hello-world` passes
- [ ] Opening index.html displays "Hello, Weblets!"
- [ ] No JavaScript errors in console

---

### 3.2 static-app (With Assets)

**Purpose**: Demonstrate static file organization and asset serving.

**Demonstrates**:
- Asset directory structure
- CSS organization
- Image/SVG assets
- Multiple HTML files (if applicable)

**Structure**:
```
examples/static-app/
  APP.md
  index.html
  /assets
    style.css
    logo.svg
    /images
      hero.png
```

**APP.md**:
```yaml
---
name: static-app
description: Static weblet with organized assets
version: 1.0.0
runtime: browser
icon: assets/logo.svg
---

# Static App

Demonstrates asset organization in a Weblet.

## Features

- Organized asset directory
- External CSS
- SVG and image assets
```

**Acceptance Criteria**:
- [ ] `weblet validate examples/static-app` passes
- [ ] CSS loads correctly from /assets/style.css
- [ ] Images display correctly
- [ ] `weblet run examples/static-app` serves all assets

---

### 3.3 counter (Interactive TypeScript)

**Purpose**: Demonstrate TypeScript support and Bun runtime.

**Demonstrates**:
- Bun runtime configuration
- TypeScript without build step
- serve.ts implementation
- Basic interactivity
- State management

**Structure**:
```
examples/counter/
  APP.md
  index.html
  serve.ts
  /src
    app.ts
    counter.ts
  /assets
    style.css
```

**APP.md**:
```yaml
---
name: counter
description: Interactive counter demonstrating TypeScript support
version: 1.0.0
runtime: bun
entry: index.html
server: serve.ts
port: 3000
---

# Counter

A simple counter app demonstrating:
- TypeScript without build configuration
- Bun as runtime
- Basic state management

## Running

```bash
bun serve.ts
# or
weblet run .
```
```

**serve.ts**:
```typescript
Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Serve TypeScript as JavaScript
    if (path.endsWith(".ts")) {
      const file = Bun.file(`.${path}`);
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "text/javascript" }
        });
      }
    }

    // Serve static files
    if (path.startsWith("/assets/")) {
      const file = Bun.file(`.${path}`);
      if (await file.exists()) {
        return new Response(file);
      }
    }

    // Default: serve index.html
    return new Response(Bun.file("index.html"));
  }
});

console.log("Counter running at http://localhost:3000");
```

**src/counter.ts**:
```typescript
export class Counter {
  private count = 0;
  private element: HTMLElement;

  constructor(elementId: string) {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`Element ${elementId} not found`);
    this.element = el;
    this.render();
  }

  increment(): void {
    this.count++;
    this.render();
  }

  decrement(): void {
    this.count--;
    this.render();
  }

  reset(): void {
    this.count = 0;
    this.render();
  }

  private render(): void {
    this.element.textContent = String(this.count);
  }
}
```

**Acceptance Criteria**:
- [ ] `weblet validate examples/counter` passes
- [ ] `weblet run examples/counter` starts server
- [ ] Increment button increases count
- [ ] Decrement button decreases count
- [ ] Reset button sets count to 0
- [ ] TypeScript is transpiled correctly

---

### 3.4 freecell (Full Game)

**Purpose**: Demonstrate a complete, production-quality weblet.

**Demonstrates**:
- Complex application structure
- Game state management
- Keyboard accessibility
- Internationalization (i18n)
- Persistent storage (saves)
- Agent discoverability

**Structure**:
```
examples/freecell/
  APP.md
  index.html
  serve.ts
  /src
    game.ts
    cards.ts
    ui.ts
    drag-drop.ts
    storage.ts
    i18n.ts
  /assets
    style.css
    cards.svg
    icon.svg
  /locales
    en.json
    es.json
    fr.json
```

**APP.md**:
```yaml
---
name: freecell
description: Classic Freecell solitaire card game
version: 1.0.0
runtime: bun
entry: index.html
server: serve.ts

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
```

**Acceptance Criteria**:
- [ ] `weblet validate examples/freecell` passes
- [ ] Game loads and displays 52 cards correctly dealt
- [ ] Cards can be moved via click and drag
- [ ] Foundation accepts valid cards (Ace first, then ascending)
- [ ] Free cells work as temporary storage
- [ ] Win detection works
- [ ] Undo functionality works
- [ ] Keyboard navigation works
- [ ] Language can be switched (en/es/fr)
- [ ] Game saves persist to .userdata/
- [ ] High contrast mode works
- [ ] Reduced motion is respected

---

### 3.5 budget-dashboard (Agent Integration)

**Purpose**: Demonstrate full Agent Context API integration.

**Demonstrates**:
- Agent context consumption
- Event emission to agent
- Request/response with agent
- Graceful degradation without agent
- Data visualization
- Complex data handling

**Structure**:
```
examples/budget-dashboard/
  APP.md
  index.html
  serve.ts
  /src
    app.ts
    charts.ts
    agent.ts
    data.ts
  /assets
    style.css
```

**APP.md**:
```yaml
---
name: budget-dashboard
description: Interactive budget analysis with agent integration
version: 1.0.0
runtime: bun
entry: index.html
server: serve.ts

category: productivity
tags:
  - finance
  - visualization
  - analysis

dependencies:
  strategy: url
  imports:
    chart.js: https://esm.sh/chart.js@4.4.0

storage:
  user_data:
    enabled: true
    max_size: 50MB
  persist:
    - budgets.json
    - history/*

agent:
  discoverable: true
  launchable: true

  triggers:
    - analyze expenses
    - budget visualization
    - spending analysis
    - where is my money going

  provides:
    - budget-visualization
    - expense-tracking
    - financial-insights

  context:
    data:
      expenses:
        type: array
        description: Array of expense records
        items:
          type: object
          properties:
            date: { type: string, format: date }
            amount: { type: number }
            category: { type: string }
            description: { type: string }
        required: false
      date_range:
        type: object
        properties:
          start: { type: string, format: date }
          end: { type: string, format: date }
        required: false
    config:
      chart_type:
        type: string
        enum: [bar, line, pie]
        default: bar
      theme:
        type: string
        enum: [light, dark, auto]
        default: auto

  events:
    - name: expense-flagged
      description: User flagged an unusual expense
    - name: budget-set
      description: User set a budget limit
    - name: report-generated
      description: User generated a report
---

# Budget Dashboard

Interactive budget analysis and visualization.

## Features

- Multiple chart types (bar, line, pie)
- Category breakdown
- Trend analysis
- Budget setting
- Export reports

## Agent Integration

When launched by an agent:
- Receives expense data via context
- Emits events when user takes actions
- Can request agent to save/export files

## Standalone Mode

When opened directly:
- Shows upload interface for CSV/JSON
- All features work without agent
```

**src/agent.ts**:
```typescript
// Agent integration utilities for budget-dashboard

import {
  getAgentContext,
  isAgentLaunched,
  emitToAgent,
  getAgentData,
  getAgentConfig,
  requestAgentAction
} from "./utils/agent";

export interface Expense {
  date: string;
  amount: number;
  category: string;
  description: string;
}

export async function initializeData(): Promise<Expense[]> {
  // Try to get data from agent
  const agentExpenses = getAgentData<Expense[]>("expenses", null);
  if (agentExpenses) {
    return agentExpenses;
  }

  // Fallback: load from storage or show upload
  const stored = await loadFromStorage();
  if (stored) {
    return stored;
  }

  return []; // Will trigger upload UI
}

export function getChartType(): "bar" | "line" | "pie" {
  return getAgentConfig("chart_type", "bar");
}

export function getTheme(): "light" | "dark" | "auto" {
  return getAgentConfig("theme", "auto");
}

export async function flagExpense(expenseId: string, reason: string): Promise<void> {
  await emitToAgent("expense-flagged", { expenseId, reason });
}

export async function setBudget(category: string, amount: number): Promise<void> {
  await emitToAgent("budget-set", { category, amount });
}

export async function exportReport(format: "pdf" | "csv"): Promise<void> {
  const success = await requestAgentAction(
    "export-report",
    { format },
    () => {
      // Fallback: browser download
      downloadReport(format);
    }
  );
}
```

**Acceptance Criteria**:
- [ ] `weblet validate examples/budget-dashboard` passes
- [ ] App loads with agent-provided data when launched by agent
- [ ] App shows upload UI when opened directly
- [ ] Charts render correctly (bar, line, pie)
- [ ] Event emission works (flagging expenses)
- [ ] Theme respects agent config
- [ ] Export works via agent request
- [ ] Export falls back to browser download without agent
- [ ] Data persists to .userdata/ for standalone mode

---

## 4. Test Matrix

| Example | Validate | Run | Browser | Bun | Agent | i18n | a11y | Storage |
|---------|----------|-----|---------|-----|-------|------|------|---------|
| hello-world | ✓ | ✓ | ✓ | - | - | - | - | - |
| static-app | ✓ | ✓ | ✓ | ✓ | - | - | - | - |
| counter | ✓ | ✓ | ✓ | ✓ | - | - | - | - |
| freecell | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| budget-dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | - | ✓ | ✓ |

---

## 5. Integration Test Scenarios

### TS-EX-001: All Examples Validate
```
For each example in examples/
When I run `weblet validate examples/{name}`
Then exit code is 0
And no errors are reported
```

### TS-EX-002: All Examples Run
```
For each example in examples/
When I run `weblet run examples/{name}`
Then server starts (or browser opens for browser runtime)
And no errors in console
```

### TS-EX-003: Freecell Complete Game
```
Given freecell example running
When I play a complete game to victory
Then win dialog appears
And statistics are updated
And game save is created in .userdata/saves/
```

### TS-EX-004: Budget Dashboard Agent Mode
```
Given budget-dashboard running with agent context:
  data: { expenses: [...] }
  config: { chart_type: "pie" }
When the app initializes
Then it displays expense data as pie chart
And does NOT show upload UI
```

### TS-EX-005: Budget Dashboard Standalone Mode
```
Given budget-dashboard running without agent context
When the app initializes
Then it shows upload UI
And user can upload CSV file
And data is visualized after upload
```

### TS-EX-006: Freecell Keyboard Navigation
```
Given freecell example running
When I press Tab repeatedly
Then focus moves through all interactive elements
And current focus is visually indicated
And pressing Enter/Space activates focused element
```

### TS-EX-007: Freecell Language Switch
```
Given freecell example running in English
When I change language to Spanish
Then all UI text changes to Spanish
And language preference persists on reload
```

---

## 6. Dependencies

- **cli.spec.md**: Examples are validated using `weblet validate`
- **runtime.spec.md**: Examples run using `weblet run`
- **dependencies.spec.md**: budget-dashboard uses URL imports
- **storage.spec.md**: freecell and budget-dashboard use persistent storage
- **agent-context.spec.md**: budget-dashboard uses Agent Context API

---

## 7. Acceptance Criteria (Summary)

- [ ] AC-001: All 5 examples are included in reference implementation
- [ ] AC-002: All examples pass `weblet validate`
- [ ] AC-003: All examples run without errors
- [ ] AC-004: hello-world demonstrates minimal viable weblet
- [ ] AC-005: static-app demonstrates asset organization
- [ ] AC-006: counter demonstrates TypeScript/Bun runtime
- [ ] AC-007: freecell demonstrates full production app
- [ ] AC-008: budget-dashboard demonstrates agent integration
- [ ] AC-009: Examples work in Chrome, Firefox, Safari, Edge
- [ ] AC-010: Examples serve as documentation for Weblet developers
