# DataWiz Agent

A data analysis assistant that helps users understand, visualize, and transform their data.

## Overview

DataWiz can analyze CSV files, generate visualizations, identify trends, and export reports. It works through conversation but also provides an interactive dashboard for hands-on exploration.

## Capabilities

- **Data Analysis**: Load CSV/Excel files, compute statistics, find outliers
- **Visualization**: Generate charts (bar, line, pie, scatter) from your data
- **Transformation**: Filter, sort, aggregate, pivot your datasets
- **Export**: Save results as CSV, PDF reports, or images

## How to Use

Just describe what you want:
- "Analyze this sales data and show me the trends"
- "Which products are underperforming?"
- "Create a monthly breakdown by region"

For complex exploration, ask to open the dashboard:
- "Show me the dashboard"
- "I want to explore this visually"

## Weblet

This agent provides an interactive web dashboard at `/weblet`.

**When to offer the dashboard:**
- User uploads data and wants to explore it
- User asks for visualizations or charts
- User wants to interactively filter or drill down
- User explicitly requests visual interface

**Dashboard routes:**

| Route | Purpose | Skill |
|-------|---------|-------|
| `/` | Overview, recent files, quick stats | - |
| `/analyze` | Interactive data exploration | data-analysis |
| `/visualize` | Chart builder and customization | data-visualization |
| `/transform` | Data cleaning and transformation | data-transform |

**Launching:**
```bash
cd weblet && bun serve.ts
# Opens at http://localhost:3000
```

**Agent Context:**

When launching the dashboard, pass context via `window.__AGENT_CONTEXT__`:
```javascript
{
  data: {
    dataset: [...],      // The loaded data
    filename: "sales.csv",
    analysis: {...}      // Pre-computed analysis
  },
  config: {
    route: "/visualize", // Which view to open
    theme: "dark"
  }
}
```

See `weblet/APP.md` for full context schema.

## Skills

This agent uses the following skills:

### data-analysis (`/skills/data-analysis`)

Analyzes datasets to find patterns, outliers, and statistics.

- Input: CSV/JSON data
- Output: Statistical summary, anomalies, trends

Contents:
- `SKILL.md` - Skill definition and instructions
- `references/` - Statistical methods documentation, algorithm explanations
- `assets/` - Sample datasets for testing

### data-visualization (`/skills/data-visualization`)

Generates chart specifications from data and user intent.

- Input: Data + description of desired chart
- Output: Chart.js configuration

Contents:
- `SKILL.md` - Skill definition and instructions
- `references/` - Chart type guidelines, color theory docs
- `assets/` - Chart templates, color palettes

### data-transform (`/skills/data-transform`)

Transforms datasets through filtering, aggregation, pivoting.

- Input: Data + transformation description
- Output: Transformed dataset

Contents:
- `SKILL.md` - Skill definition and instructions
- `scripts/` - Reusable transformation scripts (pivot, aggregate, join)
- `references/` - SQL-to-transform mappings, common patterns

## File Structure

```
datawiz/
├── AGENTS.md                    # This file
├── weblet/
│   ├── APP.md                   # Weblet manifest
│   ├── index.html
│   ├── serve.ts
│   └── src/
│       ├── routes/
│       │   ├── analyze.ts
│       │   ├── visualize.ts
│       │   └── transform.ts
│       └── agent.ts             # Agent context handling
└── skills/
    ├── data-analysis/
    │   ├── SKILL.md
    │   ├── assets/
    │   │   └── sample-data.csv
    │   └── references/
    │       ├── statistics.md
    │       └── outlier-detection.md
    ├── data-visualization/
    │   ├── SKILL.md
    │   ├── assets/
    │   │   ├── chart-templates.json
    │   │   └── color-palettes.json
    │   └── references/
    │       ├── chart-selection.md
    │       └── accessibility.md
    └── data-transform/
        ├── SKILL.md
        ├── scripts/
        │   ├── pivot.ts
        │   ├── aggregate.ts
        │   └── join.ts
        └── references/
            └── transform-patterns.md
```

## Preferences

- Default to conversation for simple queries
- Offer dashboard when visualization would help
- Always confirm before modifying original data
- Prefer dark theme for dashboard unless user specifies

## Limitations

- Maximum file size: 50MB
- Supported formats: CSV, JSON, Excel (.xlsx)
- Charts limited to 10,000 data points for performance
