/**
 * Simple Parser Test Runner
 *
 * Can be run with: npx tsx tests/parser/test-runner.ts
 */

import { parseContent, parseFile, DEFAULTS, ParserError } from "../../src/parser/index.ts";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// =============================================================================
// Test Utilities
// =============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  })();
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

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
license: MIT
keywords:
  - test
  - demo
dependencies:
  strategy: url
  imports:
    lodash: https://esm.sh/lodash@4.17.21
agent:
  discoverable: true
  triggers:
    - user needs help
---

# Full App

Complete test.
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

// =============================================================================
// Tests
// =============================================================================

async function runTests() {
  console.log("\nParser Tests\n");

  console.log("parseContent:");

  await test("parses minimal valid manifest", () => {
    const result = parseContent(MINIMAL_VALID);
    assertEqual(result.manifest.name, "test-app");
    assertEqual(result.manifest.description, "A test application");
    assert(result.validation.valid, "Should be valid");
  });

  await test("applies default values", () => {
    const result = parseContent(MINIMAL_VALID);
    assertEqual(result.manifest.runtime, DEFAULTS.runtime);
    assertEqual(result.manifest.entry, DEFAULTS.entry);
    assertEqual(result.manifest.port, DEFAULTS.port);
  });

  await test("parses full manifest", () => {
    const result = parseContent(FULL_MANIFEST);
    assertEqual(result.manifest.name, "full-app");
    assertEqual(result.manifest.version, "1.2.3");
    assertEqual(result.manifest.runtime, "bun");
    assertEqual(result.manifest.port, 8080);
    assert(result.manifest.keywords?.includes("test") ?? false, "Should have keywords");
    assert(result.manifest.agent?.discoverable === true, "Agent should be discoverable");
  });

  await test("detects missing required fields", () => {
    const result = parseContent(MISSING_REQUIRED);
    assert(!result.validation.valid, "Should be invalid");
    assert(result.validation.errors.length > 0, "Should have errors");
    assert(
      result.validation.errors.some((e) => e.field === "name"),
      "Should have name error"
    );
  });

  await test("detects invalid runtime", () => {
    const result = parseContent(INVALID_RUNTIME);
    assert(!result.validation.valid, "Should be invalid");
    assert(
      result.validation.errors.some((e) => e.field === "runtime"),
      "Should have runtime error"
    );
  });

  await test("handles Windows line endings", () => {
    const windowsContent = MINIMAL_VALID.replace(/\n/g, "\r\n");
    const result = parseContent(windowsContent);
    assertEqual(result.manifest.name, "test-app");
  });

  await test("extracts markdown body", () => {
    const result = parseContent(MINIMAL_VALID);
    assert(result.manifest.body.includes("# Test App"), "Body should contain heading");
  });

  // File-based tests
  console.log("\nparseFile:");

  const tempDir = await mkdtemp(join(tmpdir(), "weblet-test-"));

  try {
    await test("parses APP.md from file path", async () => {
      const filePath = join(tempDir, "APP.md");
      await writeFile(filePath, MINIMAL_VALID);
      const result = await parseFile(filePath);
      assertEqual(result.manifest.name, "test-app");
    });

    await test("finds APP.md in directory", async () => {
      const subDir = join(tempDir, "subdir");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(subDir, "APP.md"), MINIMAL_VALID);
      const result = await parseFile(subDir);
      assertEqual(result.manifest.name, "test-app");
    });

    await test("throws for missing file", async () => {
      try {
        await parseFile(join(tempDir, "nonexistent"));
        throw new Error("Should have thrown");
      } catch (error) {
        assert(error instanceof ParserError, "Should be ParserError");
        assertEqual((error as ParserError).code, "E001");
      }
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  // Summary
  console.log(`\n${"─".repeat(40)}`);
  console.log(`Tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
