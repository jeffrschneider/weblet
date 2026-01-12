# CLI Specification

**Spec Version**: 1.0.0
**Weblet Spec Reference**: v1.0.0

---

## 1. Overview

The Weblet CLI (`weblet`) is the primary interface for developers to create, validate, run, and manage Weblets. It handles APP.md parsing, local discovery, dependency management commands, and runtime orchestration.

---

## 2. Requirements

### 2.1 Functional Requirements

#### Commands

- **FR-CLI-001**: The CLI SHALL provide a `weblet run <path>` command that starts a weblet from the specified directory
- **FR-CLI-002**: The CLI SHALL provide a `weblet init [path]` command that scaffolds a new weblet with APP.md and index.html
- **FR-CLI-003**: The CLI SHALL provide a `weblet validate <path>` command that validates APP.md against the schema
- **FR-CLI-004**: The CLI SHALL provide a `weblet vendor <package> [--dir path]` command that vendors a dependency
- **FR-CLI-005**: The CLI SHALL provide a `weblet info <path>` command that displays parsed APP.md metadata
- **FR-CLI-006**: The CLI SHALL provide a `weblet list [path]` command that discovers weblets in a directory tree
- **FR-CLI-007**: The CLI SHALL provide a `--help` flag for all commands
- **FR-CLI-008**: The CLI SHALL provide a `--version` flag that displays the CLI version

#### APP.md Parsing

- **FR-PARSE-001**: The CLI SHALL parse YAML frontmatter from APP.md files
- **FR-PARSE-002**: The CLI SHALL extract the Markdown body separately from frontmatter
- **FR-PARSE-003**: The CLI SHALL validate required fields: `name`, `description`
- **FR-PARSE-004**: The CLI SHALL apply default values for optional fields per Weblet Spec Section 4.3
- **FR-PARSE-005**: The CLI SHALL validate `runtime` field against allowed values: `browser`, `bun`, `deno`, `node`
- **FR-PARSE-006**: The CLI SHALL validate `version` field as valid semver
- **FR-PARSE-007**: The CLI SHALL validate `dependencies.strategy` against allowed values: `url`, `vendor`, `install`
- **FR-PARSE-008**: The CLI SHALL parse skill dependencies with version constraints (e.g., `pdf-processing@^1.0.0`)

#### Discovery

- **FR-DISC-001**: The CLI SHALL scan directories recursively for APP.md files
- **FR-DISC-002**: The CLI SHALL index discovered weblets by name, category, and tags
- **FR-DISC-003**: The CLI SHALL support configurable search paths via environment variable `WEBLET_PATH`
- **FR-DISC-004**: The CLI SHALL search default paths: `~/.weblets/`, `./weblets/`, current directory

### 2.2 Non-Functional Requirements

- **NFR-CLI-001**: The CLI SHALL start and display help in under 100ms
- **NFR-CLI-002**: The CLI SHALL provide colored terminal output when stdout is a TTY
- **NFR-CLI-003**: The CLI SHALL be installable via `bun install -g weblet`
- **NFR-CLI-004**: The CLI SHALL work on Windows, macOS, and Linux
- **NFR-CLI-005**: The CLI SHALL provide machine-readable output via `--json` flag

---

## 3. Interface

### 3.1 Command Signatures

```
weblet run <path> [options]
  --port <number>       Override default port (default: 3000)
  --open                Open browser after start
  --no-watch            Disable file watching
  --env-file <path>     Load environment from file

weblet init [path] [options]
  --name <string>       Set app name
  --runtime <string>    Set runtime (browser|bun|deno|node)
  --template <string>   Use template (minimal|static|dynamic|agent)

weblet validate <path> [options]
  --strict              Fail on warnings
  --json                Output as JSON

weblet vendor <package> [options]
  --dir <path>          Vendor directory (default: ./vendor)
  --cdn <url>           CDN to fetch from (default: esm.sh)

weblet info <path> [options]
  --json                Output as JSON
  --full                Include markdown body

weblet list [path] [options]
  --json                Output as JSON
  --recursive           Search recursively (default: true)
  --max-depth <number>  Maximum directory depth
```

### 3.2 APP.md Parser API

```typescript
interface ParsedManifest {
  // Required
  name: string;
  description: string;

  // Runtime
  runtime: "browser" | "bun" | "deno" | "node";
  entry: string;
  server?: string;
  port: number;

  // Versioning
  version: string;
  spec: string;

  // Metadata
  author?: string | { name: string; email?: string; url?: string };
  license?: string;
  repository?: string;
  homepage?: string;
  keywords?: string[];

  // Categorization
  category?: string;
  tags?: string[];

  // Display
  display?: {
    width?: number;
    height?: number;
    resizable?: boolean;
    orientation?: "any" | "portrait" | "landscape";
  };
  icon?: string;
  screenshots?: string[];

  // Dependencies
  dependencies?: {
    strategy: "url" | "vendor" | "install";
    imports?: Record<string, string>;
    vendor_dir?: string;
    package_manager?: "bun" | "npm" | "pnpm" | "yarn";
  };

  // Storage
  storage?: {
    app_state?: { enabled: boolean; max_size?: string };
    user_data?: { enabled: boolean; max_size?: string; sync?: boolean };
    persist?: string[];
  };

  // Skills
  uses?: string[];
  provides?: string[];

  // Agent
  agent?: {
    discoverable?: boolean;
    launchable?: boolean;
    triggers?: string[];
    provides?: string[];
    context?: Record<string, unknown>;
  };

  // Raw markdown body
  body: string;
}

function parseManifest(appMdPath: string): Promise<ParsedManifest>;
function validateManifest(manifest: ParsedManifest): ValidationResult;
```

---

## 4. Behavior

### 4.1 `weblet run` Behavior

1. Read APP.md from specified path
2. Parse and validate manifest
3. Resolve dependencies based on strategy
4. If `runtime === "browser"`: open index.html or start simple static server
5. If `runtime === "bun"`: execute `bun <server>` or `bun --serve .`
6. If `runtime === "deno"`: execute `deno run` with appropriate permissions
7. If `runtime === "node"`: execute `node <server>`
8. Watch for file changes and restart (unless `--no-watch`)
9. Handle SIGINT/SIGTERM for graceful shutdown

### 4.2 `weblet init` Behavior

1. Create target directory if it doesn't exist
2. Generate APP.md with provided options or interactive prompts
3. Generate index.html with basic template
4. If runtime is not `browser`, generate serve.ts template
5. Create .gitignore with `.data/` and `node_modules/`
6. Display success message with next steps

### 4.3 `weblet validate` Behavior

1. Read APP.md from specified path
2. Parse YAML frontmatter
3. Validate against schema
4. Check file references exist (entry, server, icon, etc.)
5. Report errors and warnings
6. Exit 0 if valid, exit 1 if errors

### 4.4 Discovery Behavior

1. Build search path list from: explicit path, WEBLET_PATH env, defaults
2. Walk directory tree up to max depth
3. For each APP.md found, parse frontmatter (skip body for performance)
4. Build index with: path, name, description, category, tags, triggers
5. Return sorted by name

---

## 5. Error Handling

| Error Code | Condition | Message |
|------------|-----------|---------|
| E001 | APP.md not found | `APP.md not found at {path}` |
| E002 | Invalid YAML | `Failed to parse APP.md: {yaml_error}` |
| E003 | Missing required field | `Missing required field: {field}` |
| E004 | Invalid field value | `Invalid value for {field}: {value}` |
| E005 | Entry file not found | `Entry file not found: {entry}` |
| E006 | Server file not found | `Server file not found: {server}` |
| E007 | Port in use | `Port {port} is already in use` |
| E008 | Invalid semver | `Invalid version format: {version}` |
| E009 | Unknown runtime | `Unknown runtime: {runtime}` |
| E010 | Vendor failed | `Failed to vendor {package}: {reason}` |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | APP.md validation failed |
| 4 | Runtime error |
| 130 | Interrupted (SIGINT) |

---

## 6. Dependencies

- **runtime.spec.md**: `weblet run` delegates to runtime for server execution
- **dependencies.spec.md**: `weblet vendor` uses dependency resolution logic

---

## 7. Acceptance Criteria

- [ ] AC-001: `weblet run ./my-app` starts a weblet and serves on port 3000
- [ ] AC-002: `weblet init my-app` creates a valid minimal weblet
- [ ] AC-003: `weblet validate ./my-app` returns exit code 0 for valid weblets
- [ ] AC-004: `weblet validate ./invalid` returns exit code 3 with error details
- [ ] AC-005: `weblet info ./my-app --json` outputs valid JSON with all manifest fields
- [ ] AC-006: `weblet list ~/.weblets` discovers all weblets in directory
- [ ] AC-007: `weblet vendor lodash@4.17.21` downloads ESM build to ./vendor
- [ ] AC-008: All commands display help with `--help` flag
- [ ] AC-009: `weblet --version` displays version number
- [ ] AC-010: CLI works on Windows, macOS, and Linux

---

## 8. Test Scenarios

### TS-CLI-001: Run Minimal Weblet
```
Given a directory with valid APP.md and index.html
When I run `weblet run ./minimal-app`
Then the server starts on port 3000
And I can access index.html at http://localhost:3000
```

### TS-CLI-002: Init Creates Valid Weblet
```
Given an empty directory
When I run `weblet init ./new-app --name my-app --runtime bun`
Then ./new-app/APP.md exists with name: my-app
And ./new-app/index.html exists
And ./new-app/serve.ts exists
And `weblet validate ./new-app` returns exit code 0
```

### TS-CLI-003: Validate Catches Missing Required Fields
```
Given an APP.md with missing `description` field
When I run `weblet validate ./invalid-app`
Then exit code is 3
And output contains "Missing required field: description"
```

### TS-CLI-004: Discovery Finds Nested Weblets
```
Given a directory structure:
  ./apps/game1/APP.md
  ./apps/game2/APP.md
  ./apps/tools/editor/APP.md
When I run `weblet list ./apps --json`
Then output contains 3 weblet entries
And each entry has path, name, and description
```

### TS-CLI-005: Vendor Downloads ESM Module
```
Given an empty ./vendor directory
When I run `weblet vendor lodash@4.17.21 --dir ./vendor`
Then ./vendor/lodash.js exists
And the file contains valid ESM export
```

### TS-CLI-006: Run With Custom Port
```
Given a valid weblet
When I run `weblet run ./my-app --port 8080`
Then the server starts on port 8080
```

### TS-CLI-007: Graceful Shutdown on SIGINT
```
Given a running weblet server
When I send SIGINT (Ctrl+C)
Then the server shuts down gracefully
And exit code is 130
```
