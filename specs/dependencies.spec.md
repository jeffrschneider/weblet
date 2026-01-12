# Dependencies Specification

**Spec Version**: 1.0.0
**Weblet Spec Reference**: v1.0.0, Section 7

---

## 1. Overview

Weblets support three dependency management strategies to balance portability with developer convenience: URL imports (recommended), vendored dependencies, and traditional package manager installation. This specification defines how each strategy works, how dependencies are resolved, and how import maps are generated.

---

## 2. Requirements

### 2.1 Functional Requirements

#### URL Import Strategy

- **FR-URL-001**: The runtime SHALL support importing modules directly from HTTPS URLs
- **FR-URL-002**: The runtime SHALL support import maps for bare specifier resolution
- **FR-URL-003**: The runtime SHALL cache URL imports locally after first fetch
- **FR-URL-004**: The runtime SHALL support pinned versions in URLs (e.g., `@4.17.21`)
- **FR-URL-005**: The runtime SHALL generate browser-compatible import maps from APP.md `imports`
- **FR-URL-006**: The runtime SHALL support these CDNs: esm.sh, cdn.skypack.dev, unpkg.com, deno.land/x

#### Vendor Strategy

- **FR-VENDOR-001**: The CLI SHALL provide `weblet vendor <package>` command to download ESM builds
- **FR-VENDOR-002**: The CLI SHALL download packages to `/vendor` directory by default
- **FR-VENDOR-003**: The CLI SHALL resolve package versions from npm registry
- **FR-VENDOR-004**: The CLI SHALL download ESM-compatible builds (not CommonJS)
- **FR-VENDOR-005**: The runtime SHALL resolve imports from `/vendor` directory
- **FR-VENDOR-006**: The CLI SHALL generate a vendor manifest file (`vendor.json`)

#### Install Strategy

- **FR-INSTALL-001**: The runtime SHALL support `bun install` for dependency installation
- **FR-INSTALL-002**: The runtime SHALL support `npm install` as fallback
- **FR-INSTALL-003**: The runtime SHALL read dependencies from `package.json`
- **FR-INSTALL-004**: The runtime SHALL respect lockfiles (bun.lockb, package-lock.json)
- **FR-INSTALL-005**: The CLI SHALL detect missing `node_modules` and prompt for install

#### Import Map Generation

- **FR-IMPORTMAP-001**: The runtime SHALL generate import maps from APP.md `dependencies.imports`
- **FR-IMPORTMAP-002**: The runtime SHALL inject import maps into HTML entry files
- **FR-IMPORTMAP-003**: The runtime SHALL support scoped imports
- **FR-IMPORTMAP-004**: The runtime SHALL merge multiple import sources (URL + vendor)

### 2.2 Non-Functional Requirements

- **NFR-DEP-001**: URL imports SHALL be cached with at least 24-hour TTL
- **NFR-DEP-002**: Vendor downloads SHALL complete within 30 seconds for typical packages
- **NFR-DEP-003**: Import map injection SHALL not modify original HTML files
- **NFR-DEP-004**: Cached dependencies SHALL be stored in `~/.weblet/cache/`

---

## 3. Interface

### 3.1 APP.md Dependencies Schema

```yaml
dependencies:
  strategy: url | vendor | install

  # For strategy: url
  imports:
    lodash: https://esm.sh/lodash@4.17.21
    preact: https://esm.sh/preact@10.19.0
    preact/hooks: https://esm.sh/preact@10.19.0/hooks

  # For strategy: vendor
  vendor_dir: /vendor

  # For strategy: install
  package_manager: bun | npm | pnpm | yarn
```

### 3.2 Dependency Resolution API

```typescript
interface DependencyResolver {
  /**
   * Resolve all dependencies for a weblet
   */
  resolve(manifest: ParsedManifest): Promise<ResolvedDependencies>;

  /**
   * Generate import map for browser
   */
  generateImportMap(resolved: ResolvedDependencies): ImportMap;

  /**
   * Vendor a single package
   */
  vendor(
    packageSpec: string,
    options: VendorOptions
  ): Promise<VendoredPackage>;
}

interface ResolvedDependencies {
  strategy: "url" | "vendor" | "install";
  imports: Map<string, string>;  // bare specifier -> resolved URL/path
  cached: boolean;
}

interface ImportMap {
  imports: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
}

interface VendorOptions {
  dir: string;           // Default: "./vendor"
  cdn: string;           // Default: "https://esm.sh"
  includeTypes: boolean; // Default: false
}

interface VendoredPackage {
  name: string;
  version: string;
  path: string;
  size: number;
}
```

### 3.3 CLI Vendor Command

```
weblet vendor <package>[@version] [options]

Arguments:
  package     Package name (e.g., "lodash", "preact")
  version     Optional version (default: latest)

Options:
  --dir <path>        Vendor directory (default: ./vendor)
  --cdn <url>         CDN to fetch from (default: https://esm.sh)
  --types             Also download TypeScript types
  --dry-run           Show what would be downloaded
```

---

## 4. Behavior

### 4.1 URL Import Resolution

1. Read `dependencies.imports` from APP.md
2. For each import entry:
   - Validate URL is HTTPS
   - Validate URL points to allowed CDN
   - Check local cache for existing download
   - If not cached, fetch and cache
3. Generate import map with resolved URLs
4. Return import map for injection

**Cache Location**: `~/.weblet/cache/url-imports/`

**Cache Key**: SHA256 hash of full URL

### 4.2 Vendor Resolution

1. Read `dependencies.vendor_dir` from APP.md (default: `/vendor`)
2. Scan vendor directory for `.js` files
3. Read `vendor.json` manifest if present
4. Build import map mapping package names to local paths
5. Return import map for injection

**vendor.json format**:
```json
{
  "packages": {
    "lodash": {
      "version": "4.17.21",
      "file": "lodash.js",
      "source": "https://esm.sh/lodash@4.17.21"
    },
    "preact": {
      "version": "10.19.0",
      "file": "preact.js",
      "source": "https://esm.sh/preact@10.19.0"
    }
  }
}
```

### 4.3 Install Resolution

1. Check for `package.json` in weblet root
2. Check for `node_modules` directory
3. If missing, prompt: "Dependencies not installed. Run bun install?"
4. Read `package.json` dependencies
5. Resolve from `node_modules` using Node resolution algorithm
6. Generate import map (may not be needed for Bun runtime)

### 4.4 Import Map Injection

When serving HTML files, inject import map before first `<script>` tag:

```html
<!DOCTYPE html>
<html>
<head>
  <script type="importmap">
  {
    "imports": {
      "lodash": "https://esm.sh/lodash@4.17.21",
      "preact": "https://esm.sh/preact@10.19.0",
      "preact/hooks": "https://esm.sh/preact@10.19.0/hooks"
    }
  }
  </script>
  <!-- rest of head -->
</head>
```

### 4.5 Vendor Download Process

1. Parse package spec: `name@version` or just `name`
2. Query npm registry for package metadata
3. Determine ESM entry point
4. Construct CDN URL: `https://esm.sh/{name}@{version}`
5. Fetch bundle from CDN
6. Write to `{vendor_dir}/{name}.js`
7. Update `vendor.json` manifest
8. Log success with file size

---

## 5. Error Handling

| Error Code | Condition | Message |
|------------|-----------|---------|
| E-DEP-001 | Invalid URL | `Invalid import URL: {url}` |
| E-DEP-002 | Blocked CDN | `CDN not allowed: {host}. Use: esm.sh, cdn.skypack.dev, unpkg.com` |
| E-DEP-003 | Fetch failed | `Failed to fetch {url}: {status}` |
| E-DEP-004 | Package not found | `Package not found: {name}` |
| E-DEP-005 | Version not found | `Version {version} not found for {name}` |
| E-DEP-006 | No ESM build | `No ESM build available for {name}` |
| E-DEP-007 | Vendor dir not writable | `Cannot write to vendor directory: {path}` |
| E-DEP-008 | node_modules missing | `node_modules not found. Run: {package_manager} install` |
| E-DEP-009 | Invalid import map | `Invalid import map in APP.md: {reason}` |

---

## 6. Dependencies

- **cli.spec.md**: Vendor command is part of CLI
- **runtime.spec.md**: Runtime uses resolved import maps for serving

---

## 7. Acceptance Criteria

- [ ] AC-001: URL imports are resolved and cached locally
- [ ] AC-002: Import maps are generated from APP.md `dependencies.imports`
- [ ] AC-003: Import maps are injected into HTML without modifying source files
- [ ] AC-004: `weblet vendor lodash` downloads ESM build to ./vendor
- [ ] AC-005: vendor.json is created/updated with package metadata
- [ ] AC-006: Vendored packages can be imported with bare specifiers
- [ ] AC-007: Install strategy detects missing node_modules
- [ ] AC-008: Cache persists between runs
- [ ] AC-009: All three strategies produce working weblets
- [ ] AC-010: Mixed strategies (URL + vendor) work together

---

## 8. Test Scenarios

### TS-DEP-001: URL Import Resolution
```
Given APP.md with:
  dependencies:
    strategy: url
    imports:
      lodash: https://esm.sh/lodash@4.17.21
When I run the weblet
Then import map is injected into index.html
And `import _ from "lodash"` resolves to the URL
```

### TS-DEP-002: URL Import Caching
```
Given a weblet with URL imports
When I run it twice
Then the second run uses cached dependencies
And no network requests are made for cached URLs
```

### TS-DEP-003: Vendor Single Package
```
Given an empty ./vendor directory
When I run `weblet vendor preact@10.19.0`
Then ./vendor/preact.js exists
And ./vendor/vendor.json contains preact entry
And the file contains valid ESM exports
```

### TS-DEP-004: Vendor with Custom Directory
```
When I run `weblet vendor lodash --dir ./lib`
Then ./lib/lodash.js exists
And ./lib/vendor.json is created
```

### TS-DEP-005: Import Map Injection
```
Given index.html without import map
And APP.md with URL imports
When the runtime serves index.html
Then response contains <script type="importmap">
And original file is not modified
```

### TS-DEP-006: Install Strategy Detection
```
Given APP.md with strategy: install
And no node_modules directory
When I run `weblet run`
Then a prompt appears: "Dependencies not installed"
```

### TS-DEP-007: Invalid CDN Blocked
```
Given APP.md with:
  imports:
    evil: https://evil.com/malware.js
When I run validation
Then error E-DEP-002 is returned
```

### TS-DEP-008: Package Version Resolution
```
When I run `weblet vendor lodash@4.17.21`
Then the vendored file is from version 4.17.21
And vendor.json records version "4.17.21"
```

### TS-DEP-009: Mixed Vendor and URL
```
Given APP.md with:
  imports:
    lodash: https://esm.sh/lodash@4.17.21
And ./vendor/preact.js exists
When I run the weblet
Then import map includes both lodash (URL) and preact (local)
```

### TS-DEP-010: Subpath Imports
```
Given APP.md with:
  imports:
    preact: https://esm.sh/preact@10.19.0
    preact/hooks: https://esm.sh/preact@10.19.0/hooks
When I run the weblet
Then both `import { render } from "preact"` works
And `import { useState } from "preact/hooks"` works
```
