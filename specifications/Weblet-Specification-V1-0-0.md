# Weblet Specification

**Version 1.0.0**

---

## Abstract

Weblet is an open standard for self-contained web applications that can be discovered, shared, and run anywhere. Unlike traditional web applications that require deployment infrastructure, or Progressive Web Apps that assume hosting, Weblets are folders that contain everything needed to run—with a human-readable manifest that both people and AI agents can understand.

This specification defines the folder structure, manifest format, runtime expectations, dependency management, storage model, and integration patterns for Weblets.

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Design Principles](#2-design-principles)
3. [Folder Structure](#3-folder-structure)
4. [The APP.md Manifest](#4-the-appmd-manifest)
5. [Runtime Specification](#5-runtime-specification)
6. [Bun as the Reference Runtime](#6-bun-as-the-reference-runtime)
7. [Dependency Management](#7-dependency-management)
8. [Storage and Persistence](#8-storage-and-persistence)
9. [Integration with Agent Skills](#9-integration-with-agent-skills)
10. [Agent Interactions](#10-agent-interactions)
11. [The Agent Context API](#11-the-agent-context-api)
12. [Internationalization](#12-internationalization)
13. [Accessibility](#13-accessibility)
14. [Examples](#14-examples)
15. [Discovery and Distribution](#15-discovery-and-distribution)
16. [Security Considerations](#16-security-considerations)
17. [Versioning and Updates](#17-versioning-and-updates)
18. [Future Considerations](#18-future-considerations)
19. [Appendix: Full Examples](#19-appendix-full-examples)

---

## 1. Motivation

### The Problem

The modern web ecosystem has a gap between "a file you can open" and "a deployed application":

1. **Single HTML files** work great but break down when you need multiple files, assets, or a server component.

2. **Progressive Web Apps (PWAs)** have a manifest standard, but it describes apps that are *already hosted*. The manifest.webmanifest file is metadata for installation—not a packaging format.

3. **Platform deployment configs** (vercel.json, wrangler.toml, .replit) are vendor-specific. An app configured for Vercel cannot run on Cloudflare without modification.

4. **Traditional deployment** requires CI/CD pipelines, build steps, and infrastructure decisions before you can share working software.

5. **Agents lack a UI primitive.** AI agents can invoke tools and return text, but they have no standard way to provide interactive experiences. When a user asks to "play a game" or "visualize this data," the agent has no native mechanism to launch an application.

### The Opportunity

Agent Skills (agentskills.io) demonstrated that a simple folder + markdown manifest format could become a universal standard for extending agent capabilities. The same pattern can work for applications:

- A folder with a manifest and entry point
- Human-readable, agent-parseable metadata
- Runtime-agnostic with a recommended default (Bun)
- Composable with the existing Skills ecosystem

### The Vision

**Weblets are to applications what Agent Skills are to capabilities.**

An agent can discover an app the same way it discovers a skill. A developer can share an app by sharing a folder. A user can run an app without understanding deployment infrastructure.

---

## 2. Design Principles

### 2.1 Simplicity First

The simplest valid Weblet is:

```
my-app/
  APP.md
  index.html
```

Two files. No build step. No configuration beyond the manifest. This should work by opening index.html in a browser.

### 2.2 Progressive Complexity

Apps can grow in sophistication without hitting a cliff:

| Complexity Level | What You Add | How It Runs |
|-----------------|--------------|-------------|
| Static | Just HTML/CSS/JS | Open in browser |
| Interactive | TypeScript files | `bun --serve .` |
| Dynamic | serve.ts with API routes | `bun serve.ts` |
| With Dependencies | URL imports or vendor/ | Same as above |
| Composed | Skill dependencies | Agent orchestration |

At no point do you need to adopt a framework, configure a bundler, or set up a deployment pipeline.

### 2.3 Human and Agent Readable

The APP.md manifest uses YAML frontmatter (machine-parseable) plus Markdown body (human-readable). Both agents and developers can understand the app's purpose, requirements, and usage.

### 2.4 Runtime Agnostic, Runtime Recommended

The spec does not mandate a specific runtime. However, it strongly recommends **Bun** as the default. This gives the ecosystem a known-good path while allowing flexibility.

### 2.5 Composable with Skills

Weblets exist alongside Agent Skills as peer concepts. Apps can consume skills. Skills can reference apps. Agents orchestrate both.

### 2.6 Truly Portable

A Weblet should be shareable as a folder or ZIP file and run on any machine with the appropriate runtime installed. Dependencies must be explicitly managed to preserve this portability.

---

## 3. Folder Structure

### 3.1 Minimal Structure

```
my-app/
  APP.md              # Required: manifest
  index.html          # Required: entry point for browser-based apps
```

### 3.2 Recommended Structure

```
my-app/
  APP.md              # Manifest
  index.html          # Browser entry point
  app.ts              # Main application logic (TypeScript)
  style.css           # Styles
  /assets             # Static assets
    icon.svg
    logo.png
  /components         # Optional: component organization
    header.ts
    footer.ts
```

### 3.3 Server-Enabled Structure

```
my-app/
  APP.md              # Manifest with runtime: bun
  index.html          # Browser entry point
  serve.ts            # Server entry point
  /api                # API routes
    data.ts
    submit.ts
  /assets
    ...
```

### 3.4 Full-Featured Structure

```
my-app/
  APP.md              # Manifest
  index.html          # Browser entry point
  serve.ts            # Server entry point
  
  /src                # Source code
    app.ts
    /components
    /utils
    
  /assets             # Static files
    /images
    /fonts
    
  /api                # Server routes
    /v1
      users.ts
      data.ts
  
  /vendor             # Vendored dependencies (optional)
    lodash.js
    
  /locales            # Internationalization
    en.json
    es.json
    fr.json
      
  /tests              # Optional: tests
    app.test.ts
    
  /docs               # Optional: documentation
    README.md
    CHANGELOG.md
```

### 3.5 Reserved Directories

The following directory names have special meaning:

| Directory | Purpose |
|-----------|---------|
| `/assets` | Static files served as-is |
| `/api` | Server-side API routes |
| `/src` | Source code (no special runtime behavior) |
| `/vendor` | Vendored dependencies for offline portability |
| `/locales` | Internationalization files |
| `/tests` | Test files |
| `/docs` | Documentation |
| `/.data` | Ephemeral app state (gitignored, not portable) |
| `/.userdata` | Persistent user data mount point |

---

## 4. The APP.md Manifest

### 4.1 Overview

APP.md is a Markdown file with YAML frontmatter. It serves as both machine-readable configuration and human-readable documentation.

### 4.2 Complete Schema

```yaml
---
# ============================================
# REQUIRED FIELDS
# ============================================

name: my-app                    # Unique identifier (lowercase, hyphens allowed)
description: A brief description of what this app does

# ============================================
# RUNTIME CONFIGURATION
# ============================================

runtime: bun                    # Runtime: "browser" | "bun" | "deno" | "node"
entry: index.html               # Browser entry point
server: serve.ts                # Server entry point (if runtime != "browser")
port: 3000                      # Default port (optional, default: 3000)

# ============================================
# VERSIONING
# ============================================

version: 1.0.0                  # Semantic version
spec: 1.0                       # Weblets spec version

# ============================================
# METADATA
# ============================================

author: Your Name               # Or: { name: "...", email: "...", url: "..." }
license: MIT                    # SPDX license identifier
repository: https://github.com/you/my-app
homepage: https://my-app.example.com
keywords:
  - game
  - productivity
  - visualization

# ============================================
# CATEGORIZATION
# ============================================

category: game                  # Primary category
tags:
  - solitaire
  - cards
  - casual

# ============================================
# DISPLAY
# ============================================

display:
  width: 800                    # Preferred width in pixels
  height: 600                   # Preferred height in pixels
  resizable: true               # Whether the window can be resized
  orientation: any              # "any" | "portrait" | "landscape"
  
icon: assets/icon.svg           # Path to app icon
screenshots:
  - assets/screenshot-1.png
  - assets/screenshot-2.png

# ============================================
# ACCESSIBILITY
# ============================================

accessibility:
  high_contrast: true           # App supports high contrast mode
  reduced_motion: true          # App respects reduced motion preferences
  screen_reader: true           # App is screen reader compatible
  keyboard_nav: true            # App is fully keyboard navigable
  min_font_scale: 1.0           # Minimum supported font scale
  max_font_scale: 2.0           # Maximum supported font scale

# ============================================
# INTERNATIONALIZATION
# ============================================

i18n:
  default_locale: en            # Default language
  supported_locales:            # List of supported languages
    - en
    - es
    - fr
    - de
    - ja
  locales_dir: /locales         # Directory containing locale files

# Localized descriptions (optional, supplements main description)
description_i18n:
  es: Una breve descripción de lo que hace esta aplicación
  fr: Une brève description de ce que fait cette application

# ============================================
# DEPENDENCY MANAGEMENT
# ============================================

dependencies:
  strategy: url                 # "url" | "vendor" | "install"
  
  # For strategy: url (recommended for portability)
  imports:
    lodash: https://esm.sh/lodash@4.17.21
    preact: https://esm.sh/preact@10.19.0
  
  # For strategy: vendor
  vendor_dir: /vendor           # Directory containing vendored deps
  
  # For strategy: install
  package_manager: bun          # "bun" | "npm" | "pnpm" | "yarn"

# ============================================
# STORAGE AND PERSISTENCE
# ============================================

storage:
  # Ephemeral app state (lost when app closes or container resets)
  app_state:
    enabled: true
    max_size: 10MB              # Maximum size for ephemeral state
    
  # Persistent user data (survives across sessions)
  user_data:
    enabled: true
    max_size: 100MB             # Maximum size for user data
    sync: false                 # Whether to sync across devices (future)
    
  # What data should be persisted
  persist:
    - saves/*                   # Game saves
    - preferences.json          # User preferences
    - history.db                # Usage history

# ============================================
# SKILL INTEGRATION
# ============================================

uses:                           # Skills this app depends on (with versions)
  - pdf-processing@^1.0.0
  - data-visualization@^2.1.0
  - spell-check@^1.0.0
  
provides:                       # Skills this app provides UI for
  - spreadsheet-editing

# ============================================
# ENVIRONMENT & CONFIGURATION
# ============================================

env:                            # Environment variables (non-secret defaults)
  API_TIMEOUT: 5000
  MAX_ITEMS: 100
  
secrets:                        # Required secrets (user must provide)
  - API_KEY
  - DATABASE_URL

# ============================================
# CAPABILITIES & PERMISSIONS
# ============================================

capabilities:
  network: true                 # Requires network access
  storage: true                 # Uses local storage
  camera: false                 # Requires camera access
  microphone: false             # Requires microphone access
  geolocation: false            # Requires location access
  clipboard: true               # Requires clipboard access
  notifications: false          # Requires notification permission

# ============================================
# AGENT CONFIGURATION
# ============================================

agent:
  discoverable: true            # Can agents find and recommend this app?
  launchable: true              # Can agents launch this app?
  
  triggers:                     # When should an agent consider this app?
    - user wants to play cards
    - user is bored
    - user asks for solitaire
    - user wants a break
    
  provides:                     # What does this app give the user?
    - entertainment
    - card game
    - single-player game
    
  context:                      # What context can be passed to the app?
    - difficulty: easy | medium | hard
    - theme: light | dark

---

# My App

A full description of the application in Markdown format.

## Overview

This section explains what the app does in detail. It's written for humans
but agents can also parse it for additional context about the app's purpose.

## Usage

How to use the app. This might include:

- Basic instructions
- Keyboard shortcuts
- Tips and tricks

## Running Locally

```bash
# If runtime is browser:
open index.html

# If runtime is bun:
bun serve.ts

# Or simply:
bun --serve .
```

## Configuration

Document any configuration options here.

## Changelog

### 1.0.0
- Initial release
```

### 4.3 Required Fields

Only two fields are strictly required:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique identifier for the app |
| `description` | string | Brief description (recommended: under 160 characters) |

All other fields have sensible defaults:

| Field | Default |
|-------|---------|
| `runtime` | `"browser"` |
| `entry` | `"index.html"` |
| `version` | `"0.0.0"` |
| `port` | `3000` |
| `dependencies.strategy` | `"url"` |

### 4.4 The Markdown Body

The body of APP.md (below the YAML frontmatter) is freeform Markdown. It serves multiple purposes:

1. **Human documentation**: Developers read it to understand the app
2. **Agent context**: Agents parse it for additional understanding
3. **README replacement**: It can serve as the project's README

Recommended sections:

- **Overview**: What the app does
- **Usage**: How to use it
- **Running**: How to run it locally
- **Configuration**: Config options
- **Changelog**: Version history

---

## 5. Runtime Specification

### 5.1 Runtime Types

Weblets support four runtime modes:

#### Browser Runtime (`runtime: browser`)

The app runs entirely in the browser. No server component.

```yaml
runtime: browser
entry: index.html
```

**Behavior:**
- Open `index.html` directly in a browser
- All code executes client-side
- No network server required

#### Bun Runtime (`runtime: bun`)

The app uses Bun as its server runtime.

```yaml
runtime: bun
entry: index.html
server: serve.ts
```

**Behavior:**
- Run `bun serve.ts` (or `bun --serve .` for static + dynamic)
- Server handles API routes and serves static files
- TypeScript/JSX works without configuration

#### Deno Runtime (`runtime: deno`)

The app uses Deno as its server runtime.

```yaml
runtime: deno
entry: index.html
server: serve.ts
```

**Behavior:**
- Run `deno run --allow-net --allow-read serve.ts`
- Similar to Bun but with Deno's permission model

#### Node Runtime (`runtime: node`)

The app uses Node.js as its server runtime.

```yaml
runtime: node
entry: index.html
server: serve.js
```

**Behavior:**
- Run `node serve.js`
- May require `package.json` and `npm install`
- Considered legacy; Bun or Deno preferred

### 5.2 Entry Points

Every app has at least one entry point:

| Field | Purpose | When Used |
|-------|---------|-----------|
| `entry` | Browser entry point | Always (what users see) |
| `server` | Server entry point | When `runtime` is not `browser` |

### 5.3 Static File Serving

When a server runtime is used, the following conventions apply:

1. Files in `/assets` are served at `/assets/*`
2. The `entry` file (e.g., `index.html`) is served at `/`
3. Files in `/api` are treated as route handlers (if supported by runtime)

---

## 6. Bun as the Reference Runtime

### 6.1 Why Bun?

Bun is the **recommended default runtime** for Weblets. Here's why:

| Property | Benefit |
|----------|---------|
| Single binary | One install, works everywhere |
| Zero config | No bundler, no transpiler setup |
| TypeScript native | `.ts` files just work |
| JSX native | React/Preact without build steps |
| Fast | Cold starts in milliseconds |
| npm compatible | Use existing packages |
| Built-in server | `Bun.serve()` is simple and fast |
| URL imports | Supports Deno-style URL imports |

### 6.2 Minimal Bun Server

A complete server in three lines:

```typescript
// serve.ts
Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response(Bun.file("index.html"));
  }
});
```

### 6.3 Full-Featured Bun Server

```typescript
// serve.ts
import { serve, file } from "bun";
import { join } from "path";

const PORT = process.env.PORT || 3000;

serve({
  port: PORT,
  
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // API routes
    if (path.startsWith("/api/")) {
      return handleAPI(req, path);
    }
    
    // Static files
    if (path.startsWith("/assets/")) {
      const filePath = join(import.meta.dir, path);
      const asset = file(filePath);
      if (await asset.exists()) {
        return new Response(asset);
      }
    }
    
    // SPA fallback - serve index.html for all other routes
    return new Response(file("index.html"));
  },
});

async function handleAPI(req: Request, path: string): Promise<Response> {
  const route = path.replace("/api/", "");
  
  switch (route) {
    case "health":
      return Response.json({ status: "ok" });
      
    case "data":
      const data = await loadData();
      return Response.json(data);
      
    default:
      return new Response("Not Found", { status: 404 });
  }
}

console.log(`Server running at http://localhost:${PORT}`);
```

### 6.4 Running Weblets with Bun

```bash
# Static app (browser runtime)
open index.html
# or
bun --serve .

# Dynamic app (bun runtime)
bun serve.ts

# With specific port
PORT=8080 bun serve.ts

# With environment file
bun --env-file=.env serve.ts
```

### 6.5 Future: `bun run <app>` Command

We envision a future where Bun natively supports Weblets:

```bash
# Run a local app
bun run ./my-app

# Run from URL
bun run https://apps.example.com/freecell

# Run from registry
bun run @games/freecell
```

This would:
1. Read `APP.md` to determine runtime configuration
2. Resolve dependencies based on strategy
3. Install any skill dependencies
4. Start the server (if needed)
5. Open the browser to the app

---

## 7. Dependency Management

### 7.1 The Portability Challenge

A Weblet should be shareable as a folder and run anywhere. External dependencies threaten this:

```typescript
// This breaks portability!
import lodash from "lodash";  // Requires npm install
```

The spec defines three strategies for managing dependencies while preserving portability.

### 7.2 Strategy: URL Imports (Recommended)

Import dependencies directly from URLs, Deno-style:

```yaml
# APP.md
dependencies:
  strategy: url
  imports:
    lodash: https://esm.sh/lodash@4.17.21
    preact: https://esm.sh/preact@10.19.0
    preact/hooks: https://esm.sh/preact@10.19.0/hooks
```

```typescript
// app.ts - Using import maps
import _ from "lodash";
import { render } from "preact";
import { useState } from "preact/hooks";
```

**Pros:**
- Fully portable—no install step
- Version-locked by URL
- Works in Bun, Deno, and modern browsers

**Cons:**
- Requires network on first load (can be cached)
- Not all npm packages are ESM-compatible

**Recommended CDNs:**
- `https://esm.sh/` - Universal ESM CDN
- `https://cdn.skypack.dev/` - Skypack
- `https://unpkg.com/` - unpkg (with `?module`)
- `https://deno.land/x/` - Deno modules

### 7.3 Strategy: Vendor Directory

Bundle dependencies in a `/vendor` directory for offline portability:

```yaml
# APP.md
dependencies:
  strategy: vendor
  vendor_dir: /vendor
```

```
my-app/
  APP.md
  index.html
  app.ts
  /vendor
    lodash.esm.js
    preact.esm.js
```

```typescript
// app.ts
import _ from "./vendor/lodash.esm.js";
import { render } from "./vendor/preact.esm.js";
```

**Pros:**
- Fully offline—no network required
- Complete control over dependencies
- True "folder as app" portability

**Cons:**
- Larger folder size
- Manual dependency updates
- Must vendor ESM builds

**Vendoring Tool (Future):**
```bash
weblet vendor add lodash@4.17.21
# Downloads ESM build to /vendor/lodash.esm.js
```

### 7.4 Strategy: Install (Traditional)

Use a package manager for complex apps with many dependencies:

```yaml
# APP.md
dependencies:
  strategy: install
  package_manager: bun
```

```
my-app/
  APP.md
  index.html
  app.ts
  package.json
  bun.lockb
```

**Running:**
```bash
cd my-app
bun install
bun serve.ts
```

**Pros:**
- Full npm ecosystem access
- Familiar workflow
- Best for complex apps

**Cons:**
- Not portable without `node_modules`
- Requires install step
- Larger footprint

### 7.5 Choosing a Strategy

| Use Case | Recommended Strategy |
|----------|---------------------|
| Simple apps, few deps | `url` |
| Offline/airgapped | `vendor` |
| Complex apps, many deps | `install` |
| Maximum portability | `url` or `vendor` |
| Developer familiarity | `install` |

### 7.6 Import Maps

For URL imports, apps SHOULD include an import map in `index.html`:

```html
<script type="importmap">
{
  "imports": {
    "lodash": "https://esm.sh/lodash@4.17.21",
    "preact": "https://esm.sh/preact@10.19.0",
    "preact/hooks": "https://esm.sh/preact@10.19.0/hooks"
  }
}
</script>
```

This allows bare imports (`import _ from "lodash"`) to work in browsers.

---

## 8. Storage and Persistence

### 8.1 The Persistence Problem

When running apps from URLs or containers:
- Where does user data go?
- What survives when the app closes?
- What happens when the container resets?

The spec distinguishes between two types of storage:

### 8.2 App State (Ephemeral)

Temporary data that can be lost without harm:

- Undo history
- Cached computations
- Session tokens
- Temporary files

```yaml
storage:
  app_state:
    enabled: true
    max_size: 10MB
```

**Location:** `/.data/` (gitignored, not portable)

**Behavior:**
- Created fresh each session (or persisted locally)
- May be cleared when container resets
- Should not contain irreplaceable data

### 8.3 User Data (Persistent)

Data that must survive across sessions:

- Save games
- User preferences
- Documents created by user
- History/logs the user expects to keep

```yaml
storage:
  user_data:
    enabled: true
    max_size: 100MB
    
  persist:
    - saves/*
    - preferences.json
    - documents/*
```

**Location:** `/.userdata/` (mount point for host-provided storage)

**Behavior:**
- Host provides persistent storage mounted at `/.userdata/`
- Survives container resets
- Can be backed up/synced by host
- Portable with the user (not the app)

### 8.4 Host Responsibilities

Hosts (runtimes, agents, containers) that run Weblets SHOULD:

1. **Provide ephemeral storage** at `/.data/` with at least `max_size` capacity
2. **Provide persistent storage** at `/.userdata/` if `user_data.enabled: true`
3. **Respect `persist` patterns** when deciding what to save
4. **Isolate storage** between different apps
5. **Inform users** about storage location and backup options

### 8.5 Storage API

Apps access storage through the filesystem:

```typescript
// Writing ephemeral state
await Bun.write(".data/cache.json", JSON.stringify(cache));

// Writing persistent user data
await Bun.write(".userdata/saves/game1.json", JSON.stringify(saveData));

// Reading persistent user data
const prefs = await Bun.file(".userdata/preferences.json").json();
```

For browser-only apps, use localStorage/IndexedDB with namespacing:

```typescript
// Browser storage with app namespace
const STORAGE_KEY = "pwa2:my-app";
localStorage.setItem(`${STORAGE_KEY}:prefs`, JSON.stringify(prefs));
```

---

## 9. Integration with Agent Skills

### 9.1 Skills and Apps as Peers

Agent Skills and Weblets are **peer concepts** in the same ecosystem:

```
/skills                     ← Capabilities (agent-facing)
  pdf-processing/
    SKILL.md
    process.ts
    
/apps                       ← Applications (human-facing)
  document-editor/
    APP.md
    index.html
    app.ts
```

Both are:
- Folders with a markdown manifest
- Discoverable by agents
- Versioned and distributable

They differ in their primary consumer:
- Skills are consumed by **agents** (and apps)
- Apps are consumed by **humans** (via agents or directly)

### 9.2 Apps Using Skills (with Versioning)

An app can declare skill dependencies with semantic version constraints:

```yaml
# APP.md
uses:
  - pdf-processing@^1.0.0       # Any 1.x.x version
  - markdown-rendering@~2.1.0   # 2.1.x only
  - spell-check@1.2.3           # Exactly this version
```

**Version Constraint Syntax:**

| Syntax | Meaning |
|--------|---------|
| `1.2.3` | Exactly version 1.2.3 |
| `^1.2.3` | >=1.2.3 and <2.0.0 |
| `~1.2.3` | >=1.2.3 and <1.3.0 |
| `>=1.2.3` | Version 1.2.3 or higher |
| `*` | Any version |

When the app runs, the agent or host resolves skill dependencies and ensures compatible versions are available.

### 9.3 Skills Referencing Apps

A skill can recommend apps for visualization or interaction:

```yaml
# SKILL.md
name: data-analysis
provides:
  - csv parsing
  - statistical analysis
  - data aggregation

recommended_apps:
  - data-visualizer@^2.0.0    # For charts and graphs
  - spreadsheet-editor@^1.0.0 # For manual data editing
```

### 9.4 Composition Patterns

**Pattern 1: Skill as Backend, App as Frontend**

```
User: "Analyze this CSV and show me the trends"

Agent:
  1. Invokes data-analysis@1.2.0 skill to process CSV
  2. Launches data-visualizer@2.1.0 app
  3. Passes processed data to app via Agent Context API
  4. User interacts with visualization
```

**Pattern 2: App Orchestrating Skills**

```
User opens document-editor app

App internally:
  1. Uses pdf-processing@1.0.0 skill to handle uploads
  2. Uses spell-check@1.2.3 skill for real-time checking
  3. Uses markdown-rendering@2.1.0 skill for preview
```

**Pattern 3: Agent Selecting App Based on Skills**

```
User: "Help me edit this PDF"

Agent:
  1. Looks for apps that provide: pdf-editing
  2. Finds: pdf-editor@3.0.0, document-suite@1.2.0
  3. Checks version compatibility with available skills
  4. Selects best match based on context
  5. Launches chosen app
```

---

## 10. Agent Interactions

### 10.1 Agent Discovery

Agents discover Weblets through:

1. **Local filesystem**: Scanning `/apps` directories
2. **Registries**: Querying app registries (like npm for apps)
3. **Context**: Apps mentioned in conversation or documents
4. **Skills**: Following `recommended_apps` from skills

### 10.2 Agent Launch Patterns

#### Direct Launch

```
User: "Open Freecell"

Agent:
  1. Finds freecell app
  2. Starts bun serve.ts
  3. Returns URL to user (or opens in embedded view)
```

#### Contextual Launch

```
User: "I'm bored"

Agent:
  1. Recognizes entertainment intent
  2. Searches apps with triggers matching "bored"
  3. Offers: "Would you like to play Freecell or browse some puzzles?"
  4. User selects
  5. Agent launches selected app
```

#### Data-Driven Launch

```
User: "Visualize this sales data" [attaches CSV]

Agent:
  1. Processes CSV with data-analysis skill
  2. Finds data-visualizer app
  3. Launches app with processed data as context
  4. User sees interactive chart
```

### 10.3 Example: Complete Agent Session

Here's a complete example of how a Weblet integrates with an agent conversation:

---

**User (in Claude or ChatGPT):**
> I have this spreadsheet of monthly expenses. Can you help me visualize it and find where I'm overspending?

**Agent:**
> I'd be happy to help! Let me analyze your expenses and set up an interactive visualization.

*Agent internally:*
1. *Receives uploaded spreadsheet*
2. *Invokes `spreadsheet-processing@1.0.0` skill to parse data*
3. *Invokes `expense-analysis@2.0.0` skill to categorize and find anomalies*
4. *Searches for apps with `provides: [expense-visualization, budget-analysis]`*
5. *Finds `budget-dashboard@1.2.0` app*
6. *Launches app with processed data via Agent Context API*

**Agent:**
> I've analyzed your expenses and found a few interesting patterns. I've opened an interactive budget dashboard for you:
>
> **[Launch Budget Dashboard]**
>
> Some initial findings:
> - Your dining expenses increased 40% over the last 3 months
> - Subscription services total $247/month across 12 services
> - Your highest spending category is "Shopping" at $1,340 last month
>
> The dashboard lets you drill into each category, set budgets, and see trends over time. Would you like me to walk you through it?

*User clicks "Launch Budget Dashboard"*

*App opens (either embedded or in new tab)*

**User (now in app):**
*Clicks on "Subscriptions" category*
*Sees list of 12 subscriptions with costs*
*Toggles some for cancellation*
*Clicks "Generate Savings Report"*

**App → Agent (via Agent Context API):**
```json
{
  "event": "user-action",
  "action": "generate-report",
  "data": {
    "cancelled_subscriptions": ["service-a", "service-b"],
    "monthly_savings": 47.98
  }
}
```

**Agent (back in conversation):**
> Great choices! By cancelling those 2 subscriptions, you'll save $47.98/month ($575.76/year). Would you like me to draft cancellation emails for each service?

---

This demonstrates the fluid handoff between:
- Agent conversation (text-based reasoning)
- Skill invocation (data processing)
- App interaction (visual, interactive UI)
- Back to agent (follow-up actions)

---

## 11. The Agent Context API

### 11.1 Overview

The Agent Context API provides a standard mechanism for:
- Agents to pass context to apps at launch
- Apps to read that context
- Apps to emit events back to agents
- Bidirectional communication during app lifetime

### 11.2 The Global Context Object

When an app is launched by an agent, the agent injects a global context object:

```typescript
// Available in browser context
interface AgentContext {
  // Metadata about the launching agent
  agent: {
    name: string;           // e.g., "claude", "chatgpt", "custom-agent"
    version: string;        // Agent version
    capabilities: string[]; // What the agent can do
  };
  
  // Data passed to the app
  data: Record<string, unknown>;
  
  // Configuration passed to the app
  config: Record<string, unknown>;
  
  // Methods for communication
  emit(event: string, payload: unknown): Promise<void>;
  request(action: string, params: unknown): Promise<unknown>;
  
  // Subscribe to agent messages
  on(event: string, handler: (payload: unknown) => void): void;
  off(event: string, handler: (payload: unknown) => void): void;
}

// Global availability
declare global {
  interface Window {
    __AGENT_CONTEXT__?: AgentContext;
  }
}
```

### 11.3 Accessing Context in Apps

```typescript
// utils/agent.ts

export function getAgentContext(): AgentContext | null {
  return window.__AGENT_CONTEXT__ ?? null;
}

export function isAgentLaunched(): boolean {
  return window.__AGENT_CONTEXT__ !== undefined;
}

export async function emitToAgent(event: string, payload: unknown): Promise<void> {
  const ctx = getAgentContext();
  if (ctx) {
    await ctx.emit(event, payload);
  }
}
```

### 11.4 Using Context Data

```typescript
// app.ts
import { getAgentContext, isAgentLaunched } from "./utils/agent";

async function initApp() {
  const ctx = getAgentContext();
  
  if (ctx?.data) {
    // App was launched with data from agent
    const expenseData = ctx.data.expenses as ExpenseData;
    const chartConfig = ctx.config.chartType ?? "bar";
    
    renderChart(expenseData, { type: chartConfig });
  } else {
    // App was opened directly, show upload UI
    renderUploadForm();
  }
}

// Listen for agent messages
const ctx = getAgentContext();
ctx?.on("update-config", (newConfig) => {
  applyConfig(newConfig);
});
```

### 11.5 Emitting Events to Agent

```typescript
// When user takes an action the agent should know about
async function handleSubscriptionCancel(subscriptions: string[]) {
  // Update local UI
  updateCancelledList(subscriptions);
  
  // Notify agent
  await emitToAgent("subscriptions-cancelled", {
    items: subscriptions,
    monthlySavings: calculateSavings(subscriptions)
  });
}

// Request agent to perform an action
async function requestAgentAction() {
  const ctx = getAgentContext();
  if (ctx) {
    const result = await ctx.request("send-email", {
      to: "support@service.com",
      subject: "Cancellation Request",
      body: "Please cancel my subscription..."
    });
    
    showConfirmation(result);
  }
}
```

### 11.6 Graceful Degradation

Apps MUST work when launched without an agent:

```typescript
async function saveDocument(doc: Document) {
  const ctx = getAgentContext();
  
  if (ctx) {
    // Agent is available - offer to save via agent
    await ctx.emit("document-ready", { document: doc });
  } else {
    // No agent - use browser download
    downloadAsFile(doc, "document.pdf");
  }
}
```

### 11.7 Context Schema Declaration

Apps should declare expected context in APP.md:

```yaml
agent:
  context:
    # Data the app can receive
    data:
      expenses:
        type: array
        description: Array of expense records
        required: false
      date_range:
        type: object
        properties:
          start: { type: date }
          end: { type: date }
        required: false
        
    # Config the app can receive
    config:
      chart_type:
        type: string
        enum: [bar, line, pie, scatter]
        default: bar
      theme:
        type: string
        enum: [light, dark, auto]
        default: auto
```

---

## 12. Internationalization

### 12.1 Overview

Weblets support internationalization (i18n) through locale files and manifest declarations.

### 12.2 Manifest Declaration

```yaml
i18n:
  default_locale: en
  supported_locales:
    - en
    - es
    - fr
    - de
    - ja
  locales_dir: /locales

# Optional: inline translations for key strings
description_i18n:
  es: Un juego de solitario clásico
  fr: Un jeu de solitaire classique
  de: Ein klassisches Solitärspiel
  ja: クラシックなソリティアゲーム
```

### 12.3 Locale Files

```
my-app/
  /locales
    en.json
    es.json
    fr.json
```

**locales/en.json:**
```json
{
  "app.title": "Freecell",
  "app.new_game": "New Game",
  "app.undo": "Undo",
  "app.moves": "Moves: {{count}}",
  "app.win_message": "Congratulations! You won in {{moves}} moves!",
  "menu.file": "File",
  "menu.help": "Help"
}
```

**locales/es.json:**
```json
{
  "app.title": "Freecell",
  "app.new_game": "Nuevo Juego",
  "app.undo": "Deshacer",
  "app.moves": "Movimientos: {{count}}",
  "app.win_message": "¡Felicidades! ¡Ganaste en {{moves}} movimientos!",
  "menu.file": "Archivo",
  "menu.help": "Ayuda"
}
```

### 12.4 Using Translations

```typescript
// i18n.ts
type Translations = Record<string, string>;

let translations: Translations = {};
let currentLocale = "en";

export async function loadLocale(locale: string): Promise<void> {
  try {
    const response = await fetch(`/locales/${locale}.json`);
    translations = await response.json();
    currentLocale = locale;
  } catch {
    // Fallback to default locale
    if (locale !== "en") {
      await loadLocale("en");
    }
  }
}

export function t(key: string, params?: Record<string, string | number>): string {
  let text = translations[key] ?? key;
  
  if (params) {
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(`{{${param}}}`, String(value));
    }
  }
  
  return text;
}

// Initialize with user's preferred locale
export async function initI18n(): Promise<void> {
  const userLocale = navigator.language.split("-")[0];
  await loadLocale(userLocale);
}
```

```typescript
// Using translations in app
import { t, initI18n } from "./i18n";

await initI18n();

document.title = t("app.title");
newGameButton.textContent = t("app.new_game");
movesDisplay.textContent = t("app.moves", { count: moves });
```

---

## 13. Accessibility

### 13.1 Overview

Weblets should be accessible to all users. The spec defines accessibility declarations and expectations.

### 13.2 Manifest Declaration

```yaml
accessibility:
  # Feature support declarations
  high_contrast: true         # App adapts to high contrast mode
  reduced_motion: true        # App respects prefers-reduced-motion
  screen_reader: true         # App works with screen readers
  keyboard_nav: true          # App is fully keyboard navigable
  
  # Font scaling support
  min_font_scale: 1.0         # Minimum supported scale
  max_font_scale: 2.0         # Maximum supported scale (200%)
  
  # Additional features
  captions: true              # Video/audio has captions
  audio_descriptions: false   # Audio descriptions available
```

### 13.3 Implementation Guidelines

#### High Contrast Mode

```css
/* Respect system high contrast preference */
@media (prefers-contrast: high) {
  :root {
    --bg-color: #000;
    --text-color: #fff;
    --border-color: #fff;
    --accent-color: #ffff00;
  }
  
  button, a {
    border: 2px solid var(--border-color);
  }
}
```

#### Reduced Motion

```css
/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

```typescript
// Check in JavaScript
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

function animateCard(card: HTMLElement) {
  if (prefersReducedMotion) {
    // Instant move
    card.style.transform = `translate(${x}px, ${y}px)`;
  } else {
    // Animated move
    card.animate([
      { transform: card.style.transform },
      { transform: `translate(${x}px, ${y}px)` }
    ], { duration: 200, easing: "ease-out" });
  }
}
```

#### Keyboard Navigation

```typescript
// Ensure all interactive elements are keyboard accessible
document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "Tab":
      // Default tab behavior works
      break;
    case "Enter":
    case " ":
      // Activate focused element
      const focused = document.activeElement as HTMLElement;
      focused?.click();
      break;
    case "Escape":
      // Close modals, cancel operations
      closeCurrentModal();
      break;
    case "ArrowUp":
    case "ArrowDown":
    case "ArrowLeft":
    case "ArrowRight":
      // Navigate within components
      handleArrowNavigation(e);
      break;
  }
});
```

#### Screen Reader Support

```html
<!-- Use semantic HTML -->
<main role="main" aria-label="Game board">
  <section aria-label="Free cells">
    <div role="button" aria-label="Free cell 1, empty" tabindex="0"></div>
    <div role="button" aria-label="Free cell 2, King of Hearts" tabindex="0"></div>
  </section>
  
  <!-- Announce dynamic changes -->
  <div aria-live="polite" id="announcer" class="sr-only"></div>
</main>
```

```typescript
// Announce changes to screen readers
function announce(message: string) {
  const announcer = document.getElementById("announcer");
  if (announcer) {
    announcer.textContent = message;
  }
}

// Usage
announce("Card moved to foundation. 48 cards remaining.");
announce(t("app.win_message", { moves: moveCount }));
```

#### Font Scaling

```css
/* Use relative units for text */
html {
  font-size: 100%; /* Respects user's browser setting */
}

body {
  font-size: 1rem;
  line-height: 1.5;
}

h1 { font-size: 2rem; }
h2 { font-size: 1.5rem; }

/* Ensure layout doesn't break at 200% zoom */
.container {
  max-width: 100%;
  padding: 1rem;
}

.card {
  min-width: 3rem;  /* Scales with font size */
  min-height: 4rem;
}
```

---

## 14. Examples

### 14.1 Minimal Static App

```
hello-world/
  APP.md
  index.html
```

**APP.md:**
```yaml
---
name: hello-world
description: A minimal Weblet
---

# Hello World

The simplest possible Weblet.
```

**index.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Hello World</title>
</head>
<body>
  <h1>Hello, Weblets!</h1>
</body>
</html>
```

### 14.2 Interactive Game (Freecell)

```
freecell/
  APP.md
  index.html
  serve.ts
  /src
    game.ts
    cards.ts
    ui.ts
  /assets
    style.css
    cards.svg
  /locales
    en.json
    es.json
```

**APP.md:**
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
  supported_locales: [en, es, fr, de]
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
    - user wants a casual game
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
```

### 14.3 Data Visualization App with Full Agent Integration

```
budget-dashboard/
  APP.md
  index.html
  serve.ts
  /src
    app.ts
    charts.ts
    agent.ts
  /assets
    style.css
  /locales
    en.json
```

**APP.md:**
```yaml
---
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
  supported_locales: [en, es, fr, de, ja]

agent:
  discoverable: true
  launchable: true
  
  triggers:
    - analyze expenses
    - budget visualization
    - spending analysis
    - financial overview
    - where is my money going
    
  context:
    data:
      expenses:
        type: array
        description: Array of expense records with date, amount, category
        required: false
      date_range:
        type: object
        properties:
          start: { type: date }
          end: { type: date }
    config:
      chart_type:
        type: string
        enum: [bar, line, pie]
        default: bar
      theme:
        type: string
        enum: [light, dark]
        default: auto
        
  events:
    - name: expense-flagged
      description: User flagged an unusual expense
    - name: budget-set
      description: User set a budget limit
    - name: subscription-cancelled
      description: User marked subscription for cancellation
---

# Budget Dashboard

Interactive budget analysis with AI-powered insights.

## Features

- Multiple chart types (bar, line, pie)
- Category drill-down
- Budget setting and tracking
- Subscription management
- Export to PDF

## Agent Integration

This app communicates bidirectionally with the launching agent.
See the Agent Context API section for details.
```

---

## 15. Discovery and Distribution

### 15.1 Local Discovery

Agents discover apps locally by scanning designated directories:

```
~/.weblets/                 # User-installed apps
/usr/share/weblets/         # System-wide apps
./weblets/                  # Project-local apps
```

Discovery process:
1. Scan directories for `APP.md` files
2. Parse frontmatter for metadata
3. Index by name, category, tags, triggers
4. Make available for agent queries

### 15.2 Registry Distribution

A Weblet Registry would allow:

```bash
# Install from registry
weblet install @games/freecell

# Run without installing
weblet run https://registry.weblets.io/freecell

# Publish an app
weblet publish ./my-app
```

Registry entry format:
```json
{
  "name": "freecell",
  "version": "1.0.0",
  "description": "Classic Freecell solitaire",
  "author": "Example Games",
  "repository": "https://github.com/example/freecell",
  "tarball": "https://registry.../freecell-1.0.0.tar.gz",
  "manifest": "https://registry.../freecell/APP.md",
  "checksums": {
    "sha256": "..."
  }
}
```

### 15.3 Git-Based Distribution

Apps can be shared directly via Git:

```bash
# Clone and run
git clone https://github.com/example/freecell
cd freecell
bun serve.ts
```

### 15.4 URL-Based Running

With Bun or Deno's URL import capabilities:

```bash
# Future: run directly from URL
bun run https://example.com/apps/freecell
```

---

## 16. Security Considerations

### 16.1 Capability-Based Permissions

Apps declare required capabilities in APP.md:

```yaml
capabilities:
  network: true       # Can make network requests
  storage: true       # Can use local storage
  camera: false       # Cannot access camera
  microphone: false   # Cannot access microphone
  geolocation: false  # Cannot access location
```

Runtimes SHOULD:
- Prompt users before granting undeclared capabilities
- Deny access to capabilities marked `false`
- Sandbox apps to prevent capability escalation

### 16.2 Secret Management

Apps can declare required secrets:

```yaml
secrets:
  - API_KEY
  - DATABASE_URL
```

Secrets MUST:
- Never be stored in APP.md or committed to version control
- Be provided via environment variables or secure prompt
- Be isolated between apps

### 16.3 Sandboxing

When running untrusted apps:

1. **Browser runtime**: Inherits browser sandbox (same-origin, CSP)
2. **Bun runtime**: Run with restricted permissions where available
3. **Deno runtime**: Use permission flags (`--allow-net`, etc.)

Hosts SHOULD implement sandboxing appropriate to their environment. The specific sandboxing mechanism is implementation-defined.

### 16.4 Dependency Security

For apps using URL imports:
- Only import from trusted CDNs (esm.sh, cdn.skypack.dev)
- Pin versions in URLs (`@4.17.21` not `@latest`)
- Consider using Subresource Integrity (SRI) hashes

For apps using vendored dependencies:
- Audit vendored code before distribution
- Document provenance of vendored files

### 16.5 Code Signing (Future)

A future version of this spec may include code signing:

```yaml
signature:
  algorithm: ed25519
  publicKey: "..."
  signature: "..."
```

This would allow:
- Verification of app authenticity
- Publisher identity confirmation
- Tamper detection

---

## 17. Versioning and Updates

### 17.1 Semantic Versioning

Apps MUST use semantic versioning:

```yaml
version: 1.2.3
```

- MAJOR: Breaking changes
- MINOR: New features, backward compatible
- PATCH: Bug fixes

### 17.2 Spec Versioning

Apps declare which spec version they target:

```yaml
spec: 1.0
```

This allows:
- Future spec evolution
- Backward compatibility checking
- Feature detection

### 17.3 Skill Dependency Versioning

When declaring skill dependencies, use semantic version constraints:

```yaml
uses:
  - pdf-processing@^1.0.0    # Compatible with 1.x
  - spell-check@~2.1.0       # Compatible with 2.1.x
  - data-viz@3.0.0           # Exactly 3.0.0
```

Hosts MUST resolve dependencies to compatible versions and report errors if no compatible version exists.

### 17.4 Update Checking

Registries can provide update information:

```bash
weblet check-updates ./my-app
# my-app 1.0.0 → 1.2.0 available
# skill pdf-processing 1.0.0 → 1.1.0 available
```

---

## 18. Future Considerations

The following features are under consideration for future versions of this specification:

### 18.1 Permission Negotiation Protocol (v1.1)

A formal protocol for hosts to negotiate permissions with apps:

```typescript
interface PermissionNegotiation {
  request(capability: string): Promise<PermissionStatus>;
  revoke(capability: string): Promise<void>;
  onRevoked(handler: (capability: string) => void): void;
}
```

### 18.2 Code Signing Mandate (v1.1)

Mandatory code signing for apps distributed via registries.

### 18.3 Cross-Registry Federation (v1.2)

Standards for multiple registries to federate and resolve conflicts.

### 18.4 Formal Agent API Standard (v1.1)

A standardized API that all agents (Claude, ChatGPT, open-source) implement for consistent app interactions.

### 18.5 Storage Sync

Cross-device synchronization of user data:

```yaml
storage:
  user_data:
    sync: true
    sync_provider: native  # or: icloud, gdrive, dropbox
```

### 18.6 App Bundles

Multiple apps distributed as a single bundle:

```yaml
bundle:
  name: productivity-suite
  apps:
    - document-editor
    - spreadsheet
    - presentation
```

---

## 19. Appendix: Full Examples

### 19.1 Complete Freecell Implementation

A complete, runnable Freecell game is available in the companion repository:

**Repository:** `https://github.com/weblets/examples/freecell`

Key files:
- `APP.md` - Full manifest with all features
- `serve.ts` - Bun server with static file serving
- `src/game.ts` - Complete game logic
- `src/ui.ts` - Rendering and interaction
- `locales/*.json` - Translations
- `assets/style.css` - Accessible, responsive styles

### 19.2 Budget Dashboard with Agent Integration

A complete budget visualization app demonstrating full Agent Context API usage:

**Repository:** `https://github.com/weblets/examples/budget-dashboard`

Key files:
- `APP.md` - Manifest with agent context schema
- `src/agent.ts` - Agent Context API wrapper
- `src/app.ts` - Main app with agent integration
- `src/charts.ts` - Chart rendering with accessibility

### 19.3 Minimal Examples

Quick-start templates for common use cases:

**Repository:** `https://github.com/weblets/examples/templates`

- `minimal/` - Bare minimum (2 files)
- `static-app/` - Static app with assets
- `dynamic-app/` - Bun server with API
- `agent-integrated/` - Full agent support
- `i18n-app/` - Internationalized app
- `accessible-app/` - Accessibility showcase

---

## Acknowledgments

This specification builds on ideas from:

- **Agent Skills** (agentskills.io) - The skill format that inspired this work
- **Progressive Web Apps** - The web app manifest concept
- **Deno** - URL imports and permissions model
- **Bun** - The ideal runtime for portable apps
- **Val.town** - Single-file microservices as inspiration

Special thanks to reviewers who provided feedback on the draft specification.

---

## License

This specification is released under CC0 1.0 Universal (Public Domain).

You are free to use, modify, and distribute this specification without restriction.

---

*Weblet Specification v1.0.0*

*A format for self-contained, agent-native web applications.*
