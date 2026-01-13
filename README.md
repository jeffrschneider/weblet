# Weblet

**Self-contained web applications for the AI agent era.**

Weblets are portable, single-folder web applications defined by a simple manifest (`APP.md`). They're designed to be easy for humans to create, easy for AI agents to build and modify, and easy to deploy anywhere.

---

## Why Weblets?

Modern web development has become complex. Building a simple app often requires:
- Package managers and dependency trees
- Build tools and bundlers
- Framework boilerplate
- Deployment configuration

**Weblets simplify this.** A weblet is just a folder containing:
- `APP.md` - manifest describing the app
- `index.html` - entry point
- Your code (HTML, CSS, JS, TypeScript)

No `npm install`. No webpack config. No build step (with Bun runtime).

### Designed for AI Agents

Weblets are structured so AI agents can:
- **Discover** apps via manifest metadata
- **Launch** apps with context data
- **Communicate** via the Agent Context API
- **Build** new weblets from scratch

The format is simple enough that an AI can create a complete, working app in a single conversation.

---

## Core Concepts

### APP.md Manifest

Every weblet has an `APP.md` file with YAML frontmatter and markdown documentation:

```yaml
---
name: my-app
description: A brief description of what this app does
version: 1.0.0
runtime: browser | bun | deno | node
entry: index.html
---

# My App

Documentation and usage instructions in markdown.
```

### Runtime Options

| Runtime | Use Case |
|---------|----------|
| `browser` | Static HTML/CSS/JS, open directly in browser |
| `bun` | TypeScript support, server-side features, native transpilation |
| `deno` | TypeScript with Deno runtime |
| `node` | Node.js runtime with npm dependencies |

### Dependency Strategies

Weblets support multiple approaches to dependencies:

| Strategy | Description |
|----------|-------------|
| `url` | Import from CDN (esm.sh, skypack, unpkg) |
| `vendor` | Copy ESM builds to `/vendor` directory |
| `install` | Traditional npm/bun install |

```yaml
dependencies:
  strategy: url
  imports:
    chart.js: https://esm.sh/chart.js@4.4.0
```

### Storage

Weblets can persist data with configurable storage:

```yaml
storage:
  user_data:
    enabled: true
    max_size: 10MB
  persist:
    - saves/*
    - preferences.json
```

### Agent Context API

Weblets can integrate with AI agents via `window.__AGENT_CONTEXT__`:

```yaml
agent:
  discoverable: true
  launchable: true

  triggers:
    - "analyze my data"
    - "show visualization"

  provides:
    - data-visualization
    - analysis-tool

  context:
    data:
      items: { type: array }
    config:
      theme: { enum: [light, dark] }

  events:
    - name: item-selected
      description: User selected an item
```

When an agent launches a weblet:
1. Agent injects context via `window.__AGENT_CONTEXT__`
2. Weblet reads data/config from context
3. Weblet emits events back to agent
4. Weblet can request agent actions

When opened standalone, weblets degrade gracefully (no agent = show upload UI, etc).

---

## Reference Implementation

This repository contains the **reference implementation** of the Weblet specification.

### Who Is It For?

- **App developers** wanting to build portable web apps
- **AI agent developers** integrating weblet support
- **Tool builders** creating weblet-aware development tools
- **Specification implementers** building compatible runtimes

### What Does It Include?

```
weblet/
├── specifications/          # Formal Weblet Specification (v1.0.0)
├── specs/                   # Implementation specs (spec-driven development)
├── src/                     # Reference implementation source
│   ├── parser/              # APP.md parsing and validation
│   ├── runtime/             # Bun server, static files, API routes
│   ├── storage/             # Persistent storage management
│   ├── dependencies/        # URL imports, vendoring, import maps
│   ├── agent-context/       # Agent Context API implementation
│   └── cli/                 # Command-line interface
├── lib/                     # Browser library for Agent Context
├── examples/                # Reference weblet examples
└── tests/                   # Test suites (153 tests)
```

### Installation

```bash
# Clone the repository
git clone https://github.com/jeffrschneider/weblet.git
cd weblet

# Install dependencies
npm install

# Run tests
bun test
```

### CLI Usage

```bash
# Validate a weblet
npx tsx src/cli/index.ts validate ./my-weblet

# Get weblet info
npx tsx src/cli/index.ts info ./my-weblet

# Run a weblet (starts server for bun runtime)
npx tsx src/cli/index.ts run ./my-weblet

# Initialize a new weblet
npx tsx src/cli/index.ts init ./new-weblet

# Vendor dependencies
npx tsx src/cli/index.ts vendor ./my-weblet

# List weblets in a directory
npx tsx src/cli/index.ts list ./projects
```

---

## Examples

The repository includes five reference weblets demonstrating different capabilities:

### hello-world
**Minimal weblet** - The simplest possible weblet (2 files).

```
examples/hello-world/
├── APP.md
└── index.html
```

```bash
# Just open in browser
open examples/hello-world/index.html
```

### static-app
**Static with assets** - Demonstrates asset organization (CSS, images, SVG).

```
examples/static-app/
├── APP.md
├── index.html
└── assets/
    ├── style.css
    ├── logo.svg
    └── images/
        └── hero.svg
```

### counter
**TypeScript app** - Interactive counter with Bun runtime, no build step.

```
examples/counter/
├── APP.md
├── index.html
├── serve.ts
├── src/
│   ├── app.ts
│   └── counter.ts
└── assets/
    └── style.css
```

```bash
cd examples/counter
bun serve.ts
# Open http://localhost:3001
```

### freecell
**Full-featured game** - Complete Freecell solitaire with:
- Game logic and win detection
- Drag-and-drop and keyboard navigation
- Animated card moves
- Internationalization (English, Spanish, French)
- Persistent saves and statistics
- Accessibility support (high contrast, reduced motion)

```
examples/freecell/
├── APP.md
├── index.html
├── serve.ts
├── src/
│   ├── app.ts
│   ├── game.ts
│   ├── cards.ts
│   ├── ui.ts
│   ├── drag-drop.ts
│   ├── storage.ts
│   └── i18n.ts
├── assets/
│   ├── style.css
│   └── icon.svg
└── locales/
    ├── en.json
    ├── es.json
    └── fr.json
```

```bash
cd examples/freecell
bun serve.ts
# Open http://localhost:3002
```

### budget-dashboard
**Agent integration demo** - Demonstrates the Agent Context API:
- Receives expense data from agent context
- Multiple chart types (bar, line, pie) via Chart.js
- Emits events when user flags expenses or sets budgets
- Graceful degradation (upload UI when no agent)
- CSV/JSON import in standalone mode

```
examples/budget-dashboard/
├── APP.md
├── index.html
├── serve.ts
├── src/
│   ├── app.ts
│   ├── agent.ts      # Agent Context API integration
│   ├── charts.ts
│   └── data.ts
└── assets/
    └── style.css
```

```bash
cd examples/budget-dashboard
bun serve.ts
# Open http://localhost:3003
# Click "Use Sample Data" to explore
```

---

## Specification

The formal Weblet Specification is available at:

**[specifications/Weblet-Specification-V1-0-0.md](specifications/Weblet-Specification-V1-0-0.md)**

Key sections:
- APP.md manifest format
- Runtime requirements
- Dependency strategies
- Storage behavior
- Agent Context API
- Security considerations

---

## Development

### Running Tests

```bash
# With Bun (recommended)
bun test

# With Node.js
npm run test:node
```

### Project Structure

| Directory | Purpose |
|-----------|---------|
| `src/parser/` | APP.md parsing, validation, schema |
| `src/runtime/` | Server, static files, HTML injection |
| `src/storage/` | Size limits, persistence, isolation |
| `src/dependencies/` | URL imports, import maps, vendoring |
| `src/agent-context/` | Context creation, events, type safety |
| `src/cli/` | Command implementations |

### Build Phases

The reference implementation was built in 7 phases:

1. **Parser** - APP.md parsing with YAML frontmatter
2. **Storage + Dependencies + CLI Basic** - Core modules
3. **Runtime** - Bun server with TypeScript transpilation
4. **Full CLI** - All commands implemented
5. **Agent Context API** - Browser integration
6. **Simple Examples** - hello-world, static-app, counter
7. **Complex Examples** - freecell, budget-dashboard

---

## Related Projects

- **[Agent Skills](https://agentskills.io)** - Instruction packages for AI agents
- **[AGENTS.md](https://agents.md)** - README format for AI coding agents

---

## License

MIT

---

## Contributing

Contributions welcome! Please read the specification before submitting PRs.

For bugs, feature requests, or questions:
https://github.com/jeffrschneider/weblet/issues
