# Weblet Reference Implementation Build Plan

**Version**: 1.0.0
**Last Updated**: 2025-01-12

---

## Overview

This document defines the build order and phases for implementing the Weblet reference implementation. The plan is structured around dependency relationships between components, enabling parallel work where possible and ensuring each phase can be tested before proceeding.

---

## Dependency Graph

```
                         ┌─────────────────┐
                         │  APP.md Parser  │
                         │   (foundation)  │
                         └────────┬────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 ▼                ▼                ▼
           ┌──────────┐    ┌──────────────┐    ┌──────────┐
           │ Storage  │    │ Dependencies │    │   CLI    │
           │  Module  │    │    Module    │    │ (basic)  │
           └────┬─────┘    └──────┬───────┘    └────┬─────┘
                │                 │                 │
                └─────────────────┼─────────────────┘
                                  ▼
                         ┌─────────────────┐
                         │     Runtime     │
                         │   (Bun server)  │
                         └────────┬────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 ▼                ▼                ▼
           ┌──────────┐    ┌──────────────┐    ┌──────────┐
           │   CLI    │    │    Agent     │    │ Examples │
           │  (full)  │    │   Context    │    │ (simple) │
           └──────────┘    └──────────────┘    └────┬─────┘
                                                    │
                                                    ▼
                                          ┌─────────────────┐
                                          │    Examples     │
                                          │   (complex)     │
                                          └─────────────────┘
```

---

## Phase 1: Foundation

### 1.1 APP.md Parser

**Source Spec**: `cli.spec.md` (Section 3.2, FR-PARSE-*)

**Deliverables**:
- `src/parser/index.ts` - Main parser module
- `src/parser/schema.ts` - TypeScript interfaces for ParsedManifest
- `src/parser/validate.ts` - Validation logic
- `src/parser/defaults.ts` - Default value application

**Key Functions**:
```typescript
parseManifest(appMdPath: string): Promise<ParsedManifest>
validateManifest(manifest: ParsedManifest): ValidationResult
```

**Test Criteria**:
- [ ] Parses valid APP.md files correctly
- [ ] Extracts YAML frontmatter and Markdown body
- [ ] Applies default values for optional fields
- [ ] Returns clear errors for invalid manifests
- [ ] Validates all field types and constraints

**Estimated Scope**: ~500 lines

**Dependencies**: None (this is the foundation)

**Blocked By**: Nothing

**Blocks**: Everything else

---

## Phase 2: Core Modules (Parallel)

These modules can be built in parallel once the parser is complete.

### 2.1 Storage Module

**Source Spec**: `storage.spec.md`

**Deliverables**:
- `src/storage/index.ts` - Main storage manager
- `src/storage/ephemeral.ts` - `.data/` directory handling
- `src/storage/persistent.ts` - `.userdata/` directory handling
- `src/storage/limits.ts` - Size limit enforcement
- `src/storage/browser.ts` - Browser storage (localStorage/IndexedDB)

**Key Functions**:
```typescript
initializeStorage(manifest: ParsedManifest): Promise<StorageManager>
getUsage(): Promise<StorageUsage>
canWrite(path: string, size: number): Promise<boolean>
```

**Test Criteria**:
- [ ] Creates `.data/` and `.userdata/` directories
- [ ] Enforces size limits
- [ ] Parses size strings (KB, MB, GB)
- [ ] Updates .gitignore
- [ ] Browser storage works with namespacing

**Estimated Scope**: ~400 lines

**Dependencies**: Parser (Phase 1)

**Blocked By**: Phase 1

**Blocks**: Phase 3 (Runtime)

---

### 2.2 Dependencies Module

**Source Spec**: `dependencies.spec.md`

**Deliverables**:
- `src/dependencies/index.ts` - Main resolver
- `src/dependencies/url.ts` - URL import handling
- `src/dependencies/vendor.ts` - Vendor directory management
- `src/dependencies/install.ts` - Package manager integration
- `src/dependencies/importmap.ts` - Import map generation

**Key Functions**:
```typescript
resolveDependencies(manifest: ParsedManifest): Promise<ResolvedDependencies>
generateImportMap(resolved: ResolvedDependencies): ImportMap
vendorPackage(spec: string, options: VendorOptions): Promise<VendoredPackage>
```

**Test Criteria**:
- [ ] Resolves URL imports from allowed CDNs
- [ ] Caches URL imports locally
- [ ] Vendors packages to /vendor directory
- [ ] Generates valid import maps
- [ ] Detects missing node_modules for install strategy

**Estimated Scope**: ~600 lines

**Dependencies**: Parser (Phase 1)

**Blocked By**: Phase 1

**Blocks**: Phase 3 (Runtime), Phase 4 (CLI vendor command)

---

### 2.3 CLI Basic Commands

**Source Spec**: `cli.spec.md` (validate, info, init commands only)

**Deliverables**:
- `src/cli/index.ts` - CLI entry point
- `src/cli/commands/validate.ts` - Validate command
- `src/cli/commands/info.ts` - Info command
- `src/cli/commands/init.ts` - Init command (scaffolding)

**Key Commands**:
```bash
weblet validate <path>
weblet info <path>
weblet init [path]
```

**Test Criteria**:
- [ ] `weblet validate` reports errors and warnings
- [ ] `weblet info` displays parsed manifest
- [ ] `weblet init` creates valid scaffolding
- [ ] All commands support --help and --json

**Estimated Scope**: ~400 lines

**Dependencies**: Parser (Phase 1)

**Blocked By**: Phase 1

**Blocks**: Nothing (can be extended in Phase 4)

---

## Phase 3: Runtime

### 3.1 Bun Server Runtime

**Source Spec**: `runtime.spec.md`

**Deliverables**:
- `src/runtime/index.ts` - Main runtime orchestrator
- `src/runtime/server.ts` - Bun.serve wrapper
- `src/runtime/static.ts` - Static file serving
- `src/runtime/api.ts` - API route handling
- `src/runtime/inject.ts` - Import map injection

**Key Functions**:
```typescript
startServer(manifest: ParsedManifest, options: RuntimeOptions): Promise<Server>
stopServer(server: Server): Promise<void>
```

**Test Criteria**:
- [ ] Serves index.html at root
- [ ] Serves static files from /assets
- [ ] Transpiles TypeScript on-the-fly
- [ ] Maps /api/* to route handlers
- [ ] Injects import maps into HTML
- [ ] Handles graceful shutdown
- [ ] Respects PORT environment variable

**Estimated Scope**: ~800 lines

**Dependencies**: Parser, Storage, Dependencies (Phases 1-2)

**Blocked By**: Phases 1, 2.1, 2.2

**Blocks**: Phase 4 (CLI run), Phase 5 (Agent Context injection)

---

## Phase 4: CLI Full Commands

### 4.1 CLI Run and Vendor Commands

**Source Spec**: `cli.spec.md` (run, vendor, list commands)

**Deliverables**:
- `src/cli/commands/run.ts` - Run command
- `src/cli/commands/vendor.ts` - Vendor command
- `src/cli/commands/list.ts` - Discovery/list command

**Key Commands**:
```bash
weblet run <path> [--port] [--open]
weblet vendor <package> [--dir]
weblet list [path]
```

**Test Criteria**:
- [ ] `weblet run` starts server via runtime
- [ ] `weblet run --open` launches browser
- [ ] `weblet vendor` downloads ESM packages
- [ ] `weblet list` discovers weblets recursively

**Estimated Scope**: ~400 lines

**Dependencies**: Runtime (Phase 3), Dependencies (Phase 2.2)

**Blocked By**: Phase 3

**Blocks**: Phase 6 (Examples need working CLI)

---

## Phase 5: Agent Context API

### 5.1 Agent Context Library

**Source Spec**: `agent-context.spec.md`

**Deliverables**:
- `src/agent-context/types.ts` - TypeScript interfaces
- `src/agent-context/helpers.ts` - Helper utilities (getAgentContext, etc.)
- `src/agent-context/inject.ts` - Context injection for runtime
- `lib/agent-context.ts` - Distributable browser library

**Key Interfaces**:
```typescript
interface AgentContext { ... }
function getAgentContext(): AgentContext | null
function isAgentLaunched(): boolean
function emitToAgent(event: string, payload?: unknown): Promise<boolean>
```

**Test Criteria**:
- [ ] Context is injected before scripts run
- [ ] Context object is frozen/immutable
- [ ] emit() sends events to agent
- [ ] request() receives responses
- [ ] on()/off() manage subscriptions
- [ ] Helpers degrade gracefully without agent

**Estimated Scope**: ~500 lines

**Dependencies**: Runtime (Phase 3) for injection

**Blocked By**: Phase 3

**Blocks**: Phase 7 (Complex examples)

---

## Phase 6: Simple Examples

### 6.1 hello-world, static-app, counter

**Source Spec**: `examples.spec.md` (Sections 3.1-3.3)

**Deliverables**:
- `examples/hello-world/` - Minimal 2-file weblet
- `examples/static-app/` - Static app with assets
- `examples/counter/` - Interactive TypeScript app

**Test Criteria**:
- [ ] All pass `weblet validate`
- [ ] All run without errors
- [ ] hello-world opens in browser directly
- [ ] static-app serves assets correctly
- [ ] counter TypeScript is transpiled correctly

**Estimated Scope**: ~300 lines total

**Dependencies**: CLI (Phase 4)

**Blocked By**: Phase 4

**Blocks**: Phase 7 (validates basic functionality)

---

## Phase 7: Complex Examples

### 7.1 freecell, budget-dashboard

**Source Spec**: `examples.spec.md` (Sections 3.4-3.5)

**Deliverables**:
- `examples/freecell/` - Full game with i18n, a11y, storage
- `examples/budget-dashboard/` - Agent-integrated visualization

**Test Criteria**:
- [ ] freecell: Complete playable game
- [ ] freecell: Keyboard accessible
- [ ] freecell: Language switching works
- [ ] freecell: Saves persist
- [ ] budget-dashboard: Works with agent context
- [ ] budget-dashboard: Falls back without agent
- [ ] budget-dashboard: Charts render correctly

**Estimated Scope**: ~2000 lines total

**Dependencies**: Everything (Phases 1-6)

**Blocked By**: Phases 5, 6

**Blocks**: Nothing (final validation)

---

## Build Schedule

```
Week 1:  ████████████████████████████████████████
         Phase 1: Parser

Week 2:  ████████████████  ████████████████
         Phase 2.1        Phase 2.2
         Storage          Dependencies
                          ████████████████
                          Phase 2.3: CLI Basic

Week 3:  ████████████████████████████████████████
         Phase 3: Runtime

Week 4:  ████████████████  ████████████████████
         Phase 4: CLI     Phase 5: Agent Context
         (full)

Week 5:  ████████████████  ████████████████████
         Phase 6: Simple  Phase 7: Complex
         Examples         Examples (start)

Week 6:  ████████████████████████████████████████
         Phase 7: Complex Examples (complete)
         Final Testing & Documentation
```

---

## Milestones

| Milestone | Phase | Deliverable | Success Criteria |
|-----------|-------|-------------|------------------|
| M1 | 1 | Parser | Can parse any valid APP.md |
| M2 | 2 | Core Modules | Storage + Dependencies work |
| M3 | 2.3 | Basic CLI | `weblet validate` works |
| M4 | 3 | Runtime | `bun serve.ts` equivalent works |
| M5 | 4 | Full CLI | `weblet run` starts apps |
| M6 | 5 | Agent API | Context injection works |
| M7 | 6 | Simple Examples | 3 examples pass all tests |
| M8 | 7 | Complex Examples | 5 examples pass all tests |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Parser complexity | Start with required fields only, add optional fields incrementally |
| Bun API changes | Pin Bun version, document minimum required version |
| URL import CDN reliability | Implement caching early, support multiple CDNs |
| TypeScript transpilation edge cases | Use Bun's native handling, test with complex TS |
| Agent Context browser compatibility | Test in all major browsers early |
| Complex example scope creep | Define MVP features, defer nice-to-haves |

---

## Testing Strategy

### Unit Tests
- Parser: Test each field type, validation rule, default value
- Storage: Test size parsing, limit enforcement, path handling
- Dependencies: Test URL resolution, vendoring, import map generation

### Integration Tests
- CLI → Parser → Validation
- CLI → Runtime → Server
- Runtime → Storage → File persistence
- Runtime → Dependencies → Import maps

### End-to-End Tests
- `weblet init && weblet run && curl localhost:3000`
- Full example workflows (create, develop, run)
- Agent context injection and event flow

---

## Directory Structure (Final)

```
weblet/
├── specifications/
│   └── Weblet-Specification-V1-0-0.md
├── specs/
│   ├── BUILD-PLAN.md          ← This document
│   ├── cli.spec.md
│   ├── runtime.spec.md
│   ├── dependencies.spec.md
│   ├── storage.spec.md
│   ├── agent-context.spec.md
│   └── examples.spec.md
├── src/
│   ├── parser/
│   ├── storage/
│   ├── dependencies/
│   ├── runtime/
│   ├── cli/
│   └── agent-context/
├── lib/
│   └── agent-context.ts       ← Browser distributable
├── examples/
│   ├── hello-world/
│   ├── static-app/
│   ├── counter/
│   ├── freecell/
│   └── budget-dashboard/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
├── tsconfig.json
└── README.md
```

---

## Next Steps

1. **Initialize project**: Set up package.json, tsconfig.json, test framework
2. **Start Phase 1**: Implement APP.md parser
3. **Set up CI**: Automated testing on each commit
4. **Begin Phase 2**: Storage and Dependencies in parallel

---

*Build Plan v1.0.0 - Ready for Implementation*
