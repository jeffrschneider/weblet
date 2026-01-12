---
name: counter
description: Interactive counter demonstrating TypeScript support
version: 1.0.0
runtime: bun
entry: index.html
server: serve.ts
port: 3001
---

# Counter

A simple counter app demonstrating TypeScript support in Weblets.

## Features

- TypeScript without build configuration
- Bun as runtime for native TS support
- Component-based architecture
- State management

## Running

```bash
# Using weblet CLI
weblet run .

# Or directly with Bun
bun serve.ts
```

Then open http://localhost:3001

## Controls

- **+** Increment the counter
- **-** Decrement the counter
- **Reset** Set counter back to zero
