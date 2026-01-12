---
name: budget-dashboard
description: Interactive budget analysis with agent integration
version: 1.0.0
runtime: bun
entry: index.html
server: serve.ts
port: 3003

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

Interactive budget analysis and visualization with agent integration.

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
- Data persists locally

## Running

```bash
# Using weblet CLI
weblet run .

# Or directly with Bun
bun serve.ts
```

Then open http://localhost:3003
