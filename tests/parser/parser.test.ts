/**
 * Parser Tests
 *
 * Tests for the Weblet APP.md parser.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  parseContent,
  parseFile,
  parseManifest,
  validateFile,
  isValidWeblet,
  serializeManifest,
  ParserError,
  ValidationError,
  DEFAULTS,
} from "../../src/parser/index.ts";

// =============================================================================
// Test Fixtures
// =============================================================================

const MINIMAL_VALID = `---
name: test-app
description: A test application
---

# Test App

This is a test.
`;

const FULL_MANIFEST = `---
name: full-app
description: A fully configured application
version: 1.2.3
runtime: bun
entry: index.html
server: serve.ts
port: 8080

author:
  name: Test Author
  email: test@example.com
  url: https://example.com

license: MIT
repository: https://github.com/test/app
homepage: https://test.example.com
keywords:
  - test
  - demo

category: productivity
tags:
  - utility
  - demo

display:
  width: 1024
  height: 768
  resizable: true
  orientation: landscape

icon: assets/icon.svg
screenshots:
  - assets/screen1.png
  - assets/screen2.png

accessibility:
  high_contrast: true
  reduced_motion: true
  keyboard_nav: true

i18n:
  default_locale: en
  supported_locales:
    - en
    - es
    - fr
  locales_dir: /locales

dependencies:
  strategy: url
  imports:
    lodash: https://esm.sh/lodash@4.17.21
    preact: https://esm.sh/preact@10.19.0

storage:
  app_state:
    enabled: true
    max_size: 10MB
  user_data:
    enabled: true
    max_size: 100MB
  persist:
    - saves/*
    - preferences.json

uses:
  - pdf-processing@^1.0.0
  - spell-check@~2.1.0

agent:
  discoverable: true
  launchable: true
  triggers:
    - user needs productivity tool
    - user wants to organize
  provides:
    - organization
    - productivity
---

# Full App

A complete test manifest.

## Features

- Feature 1
- Feature 2
`;

const INVALID_YAML = `---
name: [invalid yaml
description: broken
---

Content
`;

const MISSING_REQUIRED = `---
runtime: bun
---

Missing name and description
`;

const INVALID_RUNTIME = `---
name: test
description: test
runtime: invalid-runtime
---

Content
`;

const INVALID_VERSION = `---
name: test
description: test
version: not-semver
---

Content
`;

const INVALID_PORT = `---
name: test
description: test
port: 99999
---

Content
`;

const INVALID_DEPS_STRATEGY = `---
name: test
description: test
dependencies:
  strategy: invalid
---

Content
`;

const INVALID_IMPORTS = `---
name: test
description: test
dependencies:
  imports:
    bad: http://insecure.com/lib.js
---

Content
`;

// =============================================================================
// parseContent Tests
// =============================================================================

describe("parseContent", () => {
  it("parses minimal valid manifest", () => {
    const result = parseContent(MINIMAL_VALID);

    expect(result.manifest.name).toBe("test-app");
    expect(result.manifest.description).toBe("A test application");
    expect(result.manifest.body).toBe("# Test App\n\nThis is a test.");
    expect(result.validation.valid).toBe(true);
  });

  it("applies default values", () => {
    const result = parseContent(MINIMAL_VALID);

    expect(result.manifest.runtime).toBe(DEFAULTS.runtime);
    expect(result.manifest.entry).toBe(DEFAULTS.entry);
    expect(result.manifest.port).toBe(DEFAULTS.port);
    expect(result.manifest.version).toBe(DEFAULTS.version);
    expect(result.manifest.spec).toBe(DEFAULTS.spec);
  });

  it("parses full manifest with all fields", () => {
    const result = parseContent(FULL_MANIFEST);

    expect(result.manifest.name).toBe("full-app");
    expect(result.manifest.version).toBe("1.2.3");
    expect(result.manifest.runtime).toBe("bun");
    expect(result.manifest.port).toBe(8080);
    expect(result.manifest.author).toEqual({
      name: "Test Author",
      email: "test@example.com",
      url: "https://example.com",
    });
    expect(result.manifest.keywords).toEqual(["test", "demo"]);
    expect(result.manifest.display?.width).toBe(1024);
    expect(result.manifest.dependencies?.strategy).toBe("url");
    expect(result.manifest.dependencies?.imports?.lodash).toBe(
      "https://esm.sh/lodash@4.17.21"
    );
    expect(result.manifest.uses).toContain("pdf-processing@^1.0.0");
    expect(result.manifest.agent?.discoverable).toBe(true);
    expect(result.validation.valid).toBe(true);
  });

  it("returns validation errors for invalid YAML", () => {
    expect(() => parseContent(INVALID_YAML)).toThrow(ParserError);
  });

  it("returns validation errors for missing required fields", () => {
    const result = parseContent(MISSING_REQUIRED);

    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
    expect(result.validation.errors.some((e) => e.field === "name")).toBe(true);
    expect(result.validation.errors.some((e) => e.field === "description")).toBe(
      true
    );
  });

  it("returns validation errors for invalid runtime", () => {
    const result = parseContent(INVALID_RUNTIME);

    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.some((e) => e.field === "runtime")).toBe(
      true
    );
  });

  it("returns validation errors for invalid version", () => {
    const result = parseContent(INVALID_VERSION);

    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.some((e) => e.field === "version")).toBe(
      true
    );
  });

  it("returns validation errors for invalid port", () => {
    const result = parseContent(INVALID_PORT);

    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.some((e) => e.field === "port")).toBe(true);
  });

  it("returns validation errors for invalid dependency strategy", () => {
    const result = parseContent(INVALID_DEPS_STRATEGY);

    expect(result.validation.valid).toBe(false);
    expect(
      result.validation.errors.some((e) => e.field === "dependencies.strategy")
    ).toBe(true);
  });

  it("returns validation errors for non-HTTPS imports", () => {
    const result = parseContent(INVALID_IMPORTS);

    expect(result.validation.valid).toBe(false);
    expect(
      result.validation.errors.some((e) =>
        e.field?.startsWith("dependencies.imports")
      )
    ).toBe(true);
  });

  it("throws on error when throwOnError is true", () => {
    expect(() =>
      parseContent(MISSING_REQUIRED, { throwOnError: true })
    ).toThrow(ValidationError);
  });

  it("skips validation when validate is false", () => {
    const result = parseContent(MISSING_REQUIRED, { validate: false });

    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors.length).toBe(0);
  });

  it("returns warnings for missing version", () => {
    const result = parseContent(MINIMAL_VALID);

    expect(result.validation.warnings.some((w) => w.field === "version")).toBe(
      true
    );
  });

  it("handles empty frontmatter gracefully", () => {
    const empty = `---
---

Just body
`;
    const result = parseContent(empty);
    expect(result.validation.valid).toBe(false);
    expect(result.manifest.body).toBe("Just body");
  });
});

// =============================================================================
// parseFile Tests
// =============================================================================

describe("parseFile", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "weblet-test-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("parses APP.md file from path", async () => {
    const filePath = join(tempDir, "APP.md");
    await writeFile(filePath, MINIMAL_VALID);

    const result = await parseFile(filePath);

    expect(result.manifest.name).toBe("test-app");
    expect(result.validation.valid).toBe(true);
  });

  it("finds APP.md in directory", async () => {
    const subDir = join(tempDir, "subdir");
    await mkdir(subDir, { recursive: true });
    await writeFile(join(subDir, "APP.md"), MINIMAL_VALID);

    const result = await parseFile(subDir);

    expect(result.manifest.name).toBe("test-app");
  });

  it("throws ParserError for missing file", async () => {
    await expect(parseFile(join(tempDir, "nonexistent"))).rejects.toThrow(
      ParserError
    );
  });

  it("throws with correct error code for missing file", async () => {
    try {
      await parseFile(join(tempDir, "nonexistent"));
    } catch (error) {
      expect(error).toBeInstanceOf(ParserError);
      expect((error as ParserError).code).toBe("E001");
    }
  });
});

// =============================================================================
// parseManifest Tests
// =============================================================================

describe("parseManifest", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "weblet-test-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns just the manifest", async () => {
    const filePath = join(tempDir, "valid-APP.md");
    await writeFile(filePath, MINIMAL_VALID);

    const manifest = await parseManifest(filePath);

    expect(manifest.name).toBe("test-app");
    expect(manifest).not.toHaveProperty("validation");
  });

  it("throws on validation errors", async () => {
    const filePath = join(tempDir, "invalid-APP.md");
    await writeFile(filePath, MISSING_REQUIRED);

    await expect(parseManifest(filePath)).rejects.toThrow(ValidationError);
  });
});

// =============================================================================
// validateFile Tests
// =============================================================================

describe("validateFile", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "weblet-test-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns validation result for valid file", async () => {
    const filePath = join(tempDir, "validate-valid-APP.md");
    await writeFile(filePath, MINIMAL_VALID);

    const result = await validateFile(filePath);

    expect(result.valid).toBe(true);
  });

  it("returns validation result for invalid file", async () => {
    const filePath = join(tempDir, "validate-invalid-APP.md");
    await writeFile(filePath, MISSING_REQUIRED);

    const result = await validateFile(filePath);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// isValidWeblet Tests
// =============================================================================

describe("isValidWeblet", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "weblet-test-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns true for valid weblet", async () => {
    const subDir = join(tempDir, "valid-weblet");
    await mkdir(subDir, { recursive: true });
    await writeFile(join(subDir, "APP.md"), MINIMAL_VALID);

    const valid = await isValidWeblet(subDir);

    expect(valid).toBe(true);
  });

  it("returns false for invalid weblet", async () => {
    const subDir = join(tempDir, "invalid-weblet");
    await mkdir(subDir, { recursive: true });
    await writeFile(join(subDir, "APP.md"), MISSING_REQUIRED);

    const valid = await isValidWeblet(subDir);

    expect(valid).toBe(false);
  });

  it("returns false for missing weblet", async () => {
    const valid = await isValidWeblet(join(tempDir, "nonexistent"));

    expect(valid).toBe(false);
  });
});

// =============================================================================
// serializeManifest Tests
// =============================================================================

describe("serializeManifest", () => {
  it("serializes manifest back to APP.md format", () => {
    const result = parseContent(MINIMAL_VALID);
    const serialized = serializeManifest(result.manifest);

    expect(serialized).toContain("---");
    expect(serialized).toContain("name: test-app");
    expect(serialized).toContain("description: A test application");
    expect(serialized).toContain("# Test App");
  });

  it("round-trips a manifest", () => {
    const result1 = parseContent(FULL_MANIFEST);
    const serialized = serializeManifest(result1.manifest);
    const result2 = parseContent(serialized);

    expect(result2.manifest.name).toBe(result1.manifest.name);
    expect(result2.manifest.version).toBe(result1.manifest.version);
    expect(result2.manifest.runtime).toBe(result1.manifest.runtime);
    expect(result2.manifest.port).toBe(result1.manifest.port);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("Edge Cases", () => {
  it("handles Windows line endings", () => {
    const windowsContent = MINIMAL_VALID.replace(/\n/g, "\r\n");
    const result = parseContent(windowsContent);

    expect(result.manifest.name).toBe("test-app");
  });

  it("handles missing body", () => {
    const noBody = `---
name: test
description: test
---
`;
    const result = parseContent(noBody);

    expect(result.manifest.body).toBe("");
  });

  it("handles author as string", () => {
    const content = `---
name: test
description: test
author: John Doe
---

Content
`;
    const result = parseContent(content);

    expect(result.manifest.author).toBe("John Doe");
  });

  it("handles numeric env values", () => {
    const content = `---
name: test
description: test
env:
  TIMEOUT: 5000
  ENABLED: true
  NAME: test
---

Content
`;
    const result = parseContent(content);

    expect(result.manifest.env?.TIMEOUT).toBe(5000);
    expect(result.manifest.env?.ENABLED).toBe(true);
    expect(result.manifest.env?.NAME).toBe("test");
  });

  it("validates skill dependency format", () => {
    const validDeps = `---
name: test
description: test
uses:
  - skill-name
  - skill-with-version@^1.0.0
  - another@~2.3.4
---

Content
`;
    const result = parseContent(validDeps);
    expect(result.validation.valid).toBe(true);
  });

  it("rejects invalid skill dependency format", () => {
    const invalidDeps = `---
name: test
description: test
uses:
  - Invalid Skill Name
---

Content
`;
    const result = parseContent(invalidDeps);
    expect(result.validation.valid).toBe(false);
  });
});
