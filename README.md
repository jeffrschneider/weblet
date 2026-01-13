# Weblet

So you want to build a portable web app that works with AI agents and skills. And you use an AI coding assistant like Claude Code, Cursor, or Copilot.

**We have the solution for you.**

---

## The Problem

You're in Claude Code. You want to build a quick web app - maybe a dashboard, a game, a tool. You ask Claude to build it, and suddenly you're drowning in:

- "Let me set up a React project with Vite..."
- "First, run `npm install` with these 47 dependencies..."
- "Here's your webpack.config.js..."

All you wanted was a simple app. Instead, you got a build system.

And even if you get it working - how do you share it? How does an AI agent launch it with data? How does it fit into the ecosystem of [Agent Skills](https://agentskills.io)?

---

## The Solution: Weblets

A **weblet** is a self-contained web app in a single folder. No build step. No dependency hell. Just files that work.

```
my-app/
├── APP.md          # Describes your app
├── index.html      # Entry point
└── (your code)     # Whatever you need
```

That's it. Open `index.html` in a browser, and it runs.

Want TypeScript without a build step? Use Bun runtime - it transpiles on the fly.

Want to integrate with AI agents? Weblets can receive data from agents and emit events back to them.

Want to share it? Zip the folder. Or push to GitHub. Or deploy to any static host.

---

## Building Your First Weblet

Open Claude Code (or your preferred AI assistant) in an empty folder and say:

```
Build me a weblet that converts markdown to HTML in real-time.
Use browser runtime, no external dependencies.

Read the weblet spec for the APP.md format:
https://raw.githubusercontent.com/jeffrschneider/weblet/master/specifications/Weblet-Specification-V1-0-0.md
```

Claude will create:

```
markdown-preview/
├── APP.md              # Manifest with name, description, version
├── index.html          # The UI
└── assets/
    └── style.css       # Styling
```

**Run it:** Just open `index.html` in your browser. Done.

---

## Building Something More Complex

Want TypeScript? A server? Real-time features? Say:

```
Build me a weblet for a pomodoro timer with:
- TypeScript (use Bun runtime)
- Sound notifications
- Session history with local storage
- Clean, minimal UI

Read the weblet spec:
https://raw.githubusercontent.com/jeffrschneider/weblet/master/specifications/Weblet-Specification-V1-0-0.md

Use this example as a reference for Bun/TypeScript structure:
https://github.com/jeffrschneider/weblet/tree/master/examples/counter
```

Claude will create:

```
pomodoro/
├── APP.md
├── index.html
├── serve.ts            # Bun server with TypeScript transpilation
├── src/
│   ├── app.ts
│   ├── timer.ts
│   └── sounds.ts
└── assets/
    ├── style.css
    └── notification.mp3
```

**Run it:**
```bash
bun serve.ts
# Open http://localhost:3000
```

---

## Building Agent-Integrated Apps

This is where weblets shine. Want your app to receive data from an AI agent? Emit events back? Say:

```
Build me a weblet that visualizes JSON data as an interactive tree.
Include Agent Context API integration so an agent can:
- Pass in JSON data to visualize
- Receive events when user selects a node

When opened standalone (no agent), show a textarea for pasting JSON.

Read the weblet spec (especially the Agent Context API section):
https://raw.githubusercontent.com/jeffrschneider/weblet/master/specifications/Weblet-Specification-V1-0-0.md

Use this example for Agent Context API patterns:
https://github.com/jeffrschneider/weblet/tree/master/examples/budget-dashboard
```

Claude will create an app that:

1. **With an agent:** Receives data via `window.__AGENT_CONTEXT__`, visualizes immediately
2. **Without an agent:** Shows upload/paste UI, works fully standalone

This is how weblets become the **UI layer for Agent Skills** - the skill provides the brain, the weblet provides the face.

---

## Building a Full Agent

When you have multiple skills that work together, you can create a full agent with:
- An `AGENTS.md` file (instructions for AI coding agents)
- A `/skills` directory (one folder per skill with SKILL.md)
- A `/weblet` directory (one weblet with routes per skill)

```
my-agent/
├── AGENTS.md                    # Agent instructions
├── weblet/
│   ├── APP.md                   # Weblet manifest
│   ├── index.html
│   ├── serve.ts
│   └── src/
│       └── routes/              # One route per skill
│           ├── analyze.ts
│           ├── visualize.ts
│           └── transform.ts
└── skills/
    ├── data-analysis/
    │   ├── SKILL.md
    │   ├── assets/
    │   └── references/
    ├── data-visualization/
    │   ├── SKILL.md
    │   ├── assets/
    │   └── references/
    └── data-transform/
        ├── SKILL.md
        ├── scripts/
        └── references/
```

**Key patterns:**
- **One weblet, multiple routes** - The weblet is agent-level, not skill-level
- **Routes map to skills** - `/analyze` uses `data-analysis`, `/visualize` uses `data-visualization`
- **AGENTS.md references both** - Documents when to offer the weblet and what skills are available
- **Weblet works standalone** - Checks `window.__AGENT_CONTEXT__` for enhancement

Your `AGENTS.md` documents how it all fits together:

```markdown
## Weblet

This agent provides an interactive dashboard at `/weblet`.

**Dashboard routes:**
| Route | Purpose | Skill |
|-------|---------|-------|
| `/` | Overview | - |
| `/analyze` | Data exploration | data-analysis |
| `/visualize` | Chart builder | data-visualization |

## Skills

- `/skills/data-analysis` - Statistical analysis
- `/skills/data-visualization` - Chart generation
```

See the complete example: **[datawiz-agent](examples/datawiz-agent)** - a full agent with AGENTS.md, weblet routes, and skills with varied subdirectories.

---

## The APP.md Manifest

Every weblet has an `APP.md` file. It's simple - YAML frontmatter plus markdown docs:

```yaml
---
name: my-app
description: What this app does (helps agents discover it)
version: 1.0.0
runtime: browser
---

# My App

Documentation goes here. Usage instructions, features, whatever helps
someone (human or AI) understand the app.
```

### Runtime Options

Tell Claude which runtime you want:

| Runtime | When to use | What to say |
|---------|-------------|-------------|
| `browser` | Static apps, no server needed | "Use browser runtime" |
| `bun` | TypeScript, server features | "Use Bun runtime for TypeScript" |

### Agent Integration

For agent-aware apps, the manifest declares what data it accepts and what events it emits:

```yaml
agent:
  discoverable: true
  triggers:
    - "visualize data"
    - "show me a chart"
  context:
    data:
      items: { type: array }
  events:
    - name: item-selected
      description: User clicked an item
```

---

## Example Prompts

Here are prompts that work well with Claude Code. Each includes explicit URLs so Claude reads the right files.

**Simple utility:**
```
Create a weblet that generates QR codes from text input.
Browser runtime, no dependencies (use a simple QR algorithm or canvas).

Weblet spec: https://raw.githubusercontent.com/jeffrschneider/weblet/master/specifications/Weblet-Specification-V1-0-0.md
```

**Interactive tool:**
```
Build a weblet color palette generator.
User picks a base color, app generates complementary/analogous colors.
Include copy-to-clipboard for hex values.
Use Bun runtime for TypeScript.

Weblet spec: https://raw.githubusercontent.com/jeffrschneider/weblet/master/specifications/Weblet-Specification-V1-0-0.md
Example structure: https://github.com/jeffrschneider/weblet/tree/master/examples/counter
```

**Data visualization:**
```
Create a weblet that visualizes CSV data as sortable tables and charts.
Use Chart.js from esm.sh CDN.
Include Agent Context API - agent can pass CSV data directly.
Standalone mode shows file upload.

Weblet spec: https://raw.githubusercontent.com/jeffrschneider/weblet/master/specifications/Weblet-Specification-V1-0-0.md
Agent integration example: https://github.com/jeffrschneider/weblet/tree/master/examples/budget-dashboard
```

**Game:**
```
Build a weblet implementation of 2048.
Keyboard controls, touch swipe support, high score persistence.
Use Bun runtime for TypeScript.

Weblet spec: https://raw.githubusercontent.com/jeffrschneider/weblet/master/specifications/Weblet-Specification-V1-0-0.md
Game example: https://github.com/jeffrschneider/weblet/tree/master/examples/freecell
```

**Pro tip:** Point Claude at specific examples:
```
Read this weblet example:
https://github.com/jeffrschneider/weblet/tree/master/examples/budget-dashboard

Build something similar but for tracking daily habits instead of expenses.
```

---

## Running Weblets

**Browser runtime:** Just open `index.html`. That's it.

**Bun runtime:**
```bash
cd my-weblet
bun serve.ts
```

No install step. No build step. It just runs.

---

## Capturing Screenshots

Generate preview images for your weblet:

```bash
weblet screenshot ./my-app
```

This captures desktop and mobile screenshots to `~/.weblet/screenshots/<app-name>/`.

**Options:**
```bash
# Multiple viewport sizes
weblet screenshot ./my-app --sizes desktop,mobile,tablet

# Animated GIF preview
weblet screenshot ./my-app --animated --duration 5

# Custom output location
weblet screenshot ./my-app --output ./previews

# With interaction script for animated captures
weblet screenshot ./my-app --animated --interactions demo.json
```

**Viewport presets:** `desktop` (1280x800), `mobile` (375x667), `tablet` (768x1024), `wide` (1920x1080), or custom `WIDTHxHEIGHT`.

---

## Examples in This Repo

Learn by example. This repo includes six examples, from minimal weblets to a full agent:

### [hello-world](examples/hello-world)
The simplest possible weblet. Two files. Open in browser.

### [static-app](examples/static-app)
Shows asset organization - external CSS, images, SVGs.

### [counter](examples/counter)
TypeScript with Bun runtime. Interactive state management.

### [freecell](examples/freecell)
Full card game with drag-drop, animations, i18n, persistence, accessibility.
**This entire game was built through AI conversation.**

### [budget-dashboard](examples/budget-dashboard)
Agent Context API demo. Receives data from agents, emits events, works standalone.

### [datawiz-agent](examples/datawiz-agent)
Full agent example with AGENTS.md, weblet routes mapping to skills, and skills with varied subdirectories (assets/, references/, scripts/).

---

## How It Fits Together

```
┌─────────────────────────────────────────────────────────────┐
│                         YOU                                  │
│                          │                                   │
│                          ▼                                   │
│              ┌─────────────────────┐                        │
│              │   Claude Code /     │                        │
│              │   AI Assistant      │                        │
│              └─────────────────────┘                        │
│                          │                                   │
│            "Build me a weblet that..."                      │
│                          │                                   │
│                          ▼                                   │
│              ┌─────────────────────┐                        │
│              │      WEBLET         │  ← Portable folder     │
│              │  APP.md + code      │    Works anywhere      │
│              └─────────────────────┘                        │
│                          │                                   │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│    ┌─────────┐    ┌─────────────┐   ┌──────────┐           │
│    │ Browser │    │ AI Agent    │   │  Deploy  │           │
│    │ (local) │    │ (with data) │   │ (share)  │           │
│    └─────────┘    └─────────────┘   └──────────┘           │
└─────────────────────────────────────────────────────────────┘
```

Weblets are the **UI layer** that connects to:
- **[Agent Skills](https://agentskills.io)** - procedural knowledge agents can follow
- **[AGENTS.md](https://agents.md)** - instructions for AI coding agents
- **Any AI agent** that implements the Agent Context API

---

## The Specification

Want the formal details? See the full specification:

**[Weblet Specification v1.0.0](specifications/Weblet-Specification-V1-0-0.md)**

Covers: manifest format, runtimes, dependencies, storage, Agent Context API, security.

---

## This Repository

This repo contains:

| Directory | What's in it |
|-----------|--------------|
| `specifications/` | The formal Weblet Specification |
| `examples/` | Six reference examples (weblets + full agent) |
| `src/` | Toolkit: parser, validator, runtime utilities |
| `tests/` | Test suite (153 tests) |

### Quick Start

```bash
git clone https://github.com/jeffrschneider/weblet.git
cd weblet

# Run an example
cd examples/freecell
bun serve.ts
# Open http://localhost:3002

# Run tests
cd ../..
bun test
```

---

## Related Projects

- **[Agent Skills](https://agentskills.io)** - Instruction packages for AI agents
- **[AGENTS.md](https://agents.md)** - README format for AI coding agents

---

## License

MIT

---

## Contributing

Have ideas? Found a bug? Want to add an example?

https://github.com/jeffrschneider/weblet/issues
