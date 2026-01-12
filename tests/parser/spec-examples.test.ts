/**
 * Parser Tests - Specification Examples
 *
 * Tests parser against examples from Weblet Specification v1.0.0
 */

import { parseContent } from "../../src/parser/index.ts";

// =============================================================================
// Test Utilities
// =============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  })();
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// =============================================================================
// Examples from Weblet Specification v1.0.0
// =============================================================================

// Section 14.1 - Minimal Static App
const MINIMAL_EXAMPLE = `---
name: hello-world
description: A minimal Weblet
---

# Hello World

The simplest possible Weblet.
`;

// Section 14.2 - Interactive Game (Freecell) - Simplified for testing
const FREECELL_EXAMPLE = `---
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
  supported_locales:
    - en
    - es
    - fr
    - de
  locales_dir: /locales

storage:
  user_data:
    enabled: true
    max_size: 1MB
  persist:
    - saves/*
    - statistics.json

dependencies:
  strategy: url
  imports: {}

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

author: Example Games
license: MIT
---

# Freecell

A faithful implementation of the classic Freecell solitaire card game.

## Rules

- Build foundation piles from Ace to King by suit
- Use four free cells as temporary storage
- Move cards between columns in descending order, alternating colors
- Only move groups of cards if you have enough free cells

## Controls

- **Click** a card to select it
- **Click** destination to move
- **Double-click** to auto-move to foundation
- **Ctrl+Z** to undo

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| N | New game |
| R | Restart current game |
| Z | Undo |
| H | Hint |
`;

// Section 14.3 - Budget Dashboard with Agent Integration
const BUDGET_DASHBOARD_EXAMPLE = `---
name: budget-dashboard
description: Interactive budget analysis and visualization
version: 1.2.0
runtime: bun
entry: index.html
server: serve.ts

uses:
  - spreadsheet-processing@^1.0.0
  - expense-categorization@^2.0.0
  - financial-analysis@^1.5.0

provides:
  - budget-visualization
  - expense-tracking
  - financial-insights

dependencies:
  strategy: url
  imports:
    chart.js: https://esm.sh/chart.js@4.4.0
    date-fns: https://esm.sh/date-fns@3.0.0

storage:
  user_data:
    enabled: true
    max_size: 50MB
  persist:
    - budgets.json
    - history/*

capabilities:
  network: false
  storage: true
  clipboard: true

accessibility:
  high_contrast: true
  reduced_motion: true
  keyboard_nav: true
  screen_reader: true

i18n:
  default_locale: en
  supported_locales:
    - en
    - es
    - fr
    - de
    - ja

agent:
  discoverable: true
  launchable: true
  triggers:
    - analyze expenses
    - budget visualization
    - spending analysis
    - financial overview
    - where is my money going
---

# Budget Dashboard

Interactive budget analysis with AI-powered insights.

## Features

- Multiple chart types (bar, line, pie)
- Category drill-down
- Budget setting and tracking
- Subscription management
- Export to PDF
`;

// =============================================================================
// Tests
// =============================================================================

async function runTests() {
  console.log("\nWeblet Specification Examples\n");

  console.log("Section 14.1 - Minimal Example:");

  await test("parses minimal hello-world example", () => {
    const result = parseContent(MINIMAL_EXAMPLE);
    assertEqual(result.manifest.name, "hello-world");
    assertEqual(result.manifest.description, "A minimal Weblet");
    assertEqual(result.manifest.runtime, "browser"); // default
    assert(result.validation.valid, "Should be valid");
  });

  console.log("\nSection 14.2 - Freecell Example:");

  await test("parses freecell game manifest", () => {
    const result = parseContent(FREECELL_EXAMPLE);
    assertEqual(result.manifest.name, "freecell");
    assertEqual(result.manifest.version, "1.0.0");
    assertEqual(result.manifest.runtime, "bun");
    assertEqual(result.manifest.category, "game");
    assert(result.validation.valid, "Should be valid");
  });

  await test("freecell has correct display settings", () => {
    const result = parseContent(FREECELL_EXAMPLE);
    assertEqual(result.manifest.display?.width, 1024);
    assertEqual(result.manifest.display?.height, 768);
    assertEqual(result.manifest.display?.resizable, true);
  });

  await test("freecell has accessibility config", () => {
    const result = parseContent(FREECELL_EXAMPLE);
    assertEqual(result.manifest.accessibility?.high_contrast, true);
    assertEqual(result.manifest.accessibility?.reduced_motion, true);
    assertEqual(result.manifest.accessibility?.keyboard_nav, true);
  });

  await test("freecell has i18n config", () => {
    const result = parseContent(FREECELL_EXAMPLE);
    assertEqual(result.manifest.i18n?.default_locale, "en");
    assert(
      result.manifest.i18n?.supported_locales?.includes("es") ?? false,
      "Should support Spanish"
    );
  });

  await test("freecell has storage config", () => {
    const result = parseContent(FREECELL_EXAMPLE);
    assertEqual(result.manifest.storage?.user_data?.enabled, true);
    assertEqual(result.manifest.storage?.user_data?.max_size, "1MB");
    assert(
      result.manifest.storage?.persist?.includes("saves/*") ?? false,
      "Should persist saves"
    );
  });

  await test("freecell has agent config", () => {
    const result = parseContent(FREECELL_EXAMPLE);
    assertEqual(result.manifest.agent?.discoverable, true);
    assertEqual(result.manifest.agent?.launchable, true);
    assert(
      result.manifest.agent?.triggers?.includes("user is bored") ?? false,
      "Should have bored trigger"
    );
  });

  console.log("\nSection 14.3 - Budget Dashboard Example:");

  await test("parses budget-dashboard manifest", () => {
    const result = parseContent(BUDGET_DASHBOARD_EXAMPLE);
    assertEqual(result.manifest.name, "budget-dashboard");
    assertEqual(result.manifest.version, "1.2.0");
    assertEqual(result.manifest.runtime, "bun");
    assert(result.validation.valid, "Should be valid");
  });

  await test("budget-dashboard has skill dependencies", () => {
    const result = parseContent(BUDGET_DASHBOARD_EXAMPLE);
    assert(
      result.manifest.uses?.includes("spreadsheet-processing@^1.0.0") ?? false,
      "Should use spreadsheet-processing"
    );
    assert(
      result.manifest.uses?.includes("financial-analysis@^1.5.0") ?? false,
      "Should use financial-analysis"
    );
  });

  await test("budget-dashboard has URL imports", () => {
    const result = parseContent(BUDGET_DASHBOARD_EXAMPLE);
    assertEqual(
      result.manifest.dependencies?.imports?.["chart.js"],
      "https://esm.sh/chart.js@4.4.0"
    );
    assertEqual(
      result.manifest.dependencies?.imports?.["date-fns"],
      "https://esm.sh/date-fns@3.0.0"
    );
  });

  await test("budget-dashboard has capabilities", () => {
    const result = parseContent(BUDGET_DASHBOARD_EXAMPLE);
    assertEqual(result.manifest.capabilities?.network, false);
    assertEqual(result.manifest.capabilities?.storage, true);
    assertEqual(result.manifest.capabilities?.clipboard, true);
  });

  await test("budget-dashboard provides skills", () => {
    const result = parseContent(BUDGET_DASHBOARD_EXAMPLE);
    assert(
      result.manifest.provides?.includes("budget-visualization") ?? false,
      "Should provide budget-visualization"
    );
  });

  // Summary
  console.log(`\n${"─".repeat(40)}`);
  console.log(`Specification Examples: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
