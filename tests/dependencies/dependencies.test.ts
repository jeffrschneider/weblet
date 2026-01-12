/**
 * Dependencies Module Tests
 */

import { mkdtemp, rm, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

import {
  isAllowedCdn,
  validateImportUrl,
  generateImportMap,
  injectImportMap,
  parsePackageSpec,
  constructCdnUrl,
  DependencyError,
  createDependencyResolver,
} from "../../src/dependencies/index.ts";

import type { ParsedManifest } from "../../src/parser/schema.ts";

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
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// =============================================================================
// Mock Manifest
// =============================================================================

function createMockManifest(deps?: ParsedManifest["dependencies"]): ParsedManifest {
  return {
    name: "test-app",
    description: "Test application",
    runtime: "browser",
    entry: "index.html",
    port: 3000,
    version: "1.0.0",
    spec: "1.0",
    body: "",
    dependencies: deps,
  };
}

// =============================================================================
// Tests
// =============================================================================

async function runTests() {
  console.log("\nDependencies Module Tests\n");

  // CDN Validation
  console.log("isAllowedCdn:");

  await test("allows esm.sh", () => {
    assert(isAllowedCdn("https://esm.sh/lodash@4.17.21"), "esm.sh should be allowed");
  });

  await test("allows cdn.skypack.dev", () => {
    assert(isAllowedCdn("https://cdn.skypack.dev/lodash"), "skypack should be allowed");
  });

  await test("allows unpkg.com", () => {
    assert(isAllowedCdn("https://unpkg.com/lodash"), "unpkg should be allowed");
  });

  await test("allows cdn.jsdelivr.net", () => {
    assert(isAllowedCdn("https://cdn.jsdelivr.net/npm/lodash"), "jsdelivr should be allowed");
  });

  await test("rejects unknown CDN", () => {
    assert(!isAllowedCdn("https://evil.com/malware.js"), "unknown CDN should be rejected");
  });

  // URL Validation
  console.log("\nvalidateImportUrl:");

  await test("accepts valid HTTPS URL from allowed CDN", () => {
    validateImportUrl("https://esm.sh/lodash@4.17.21", "lodash");
    // No error = pass
  });

  await test("rejects HTTP URL", () => {
    try {
      validateImportUrl("http://esm.sh/lodash", "lodash");
      throw new Error("Should have thrown");
    } catch (error) {
      assert(error instanceof DependencyError, "Should be DependencyError");
      assertEqual((error as DependencyError).code, "E-DEP-001");
    }
  });

  await test("rejects disallowed CDN", () => {
    try {
      validateImportUrl("https://evil.com/malware.js", "malware");
      throw new Error("Should have thrown");
    } catch (error) {
      assert(error instanceof DependencyError, "Should be DependencyError");
      assertEqual((error as DependencyError).code, "E-DEP-002");
    }
  });

  // Package Spec Parsing
  console.log("\nparsePackageSpec:");

  await test("parses name only", () => {
    const result = parsePackageSpec("lodash");
    assertEqual(result.name, "lodash");
    assertEqual(result.version, undefined);
  });

  await test("parses name@version", () => {
    const result = parsePackageSpec("lodash@4.17.21");
    assertEqual(result.name, "lodash");
    assertEqual(result.version, "4.17.21");
  });

  await test("parses scoped package", () => {
    const result = parsePackageSpec("@types/node@20.0.0");
    assertEqual(result.name, "@types/node");
    assertEqual(result.version, "20.0.0");
  });

  // CDN URL Construction
  console.log("\nconstructCdnUrl:");

  await test("constructs URL without version", () => {
    const url = constructCdnUrl("lodash");
    assertEqual(url, "https://esm.sh/lodash");
  });

  await test("constructs URL with version", () => {
    const url = constructCdnUrl("lodash", "4.17.21");
    assertEqual(url, "https://esm.sh/lodash@4.17.21");
  });

  await test("uses custom CDN", () => {
    const url = constructCdnUrl("lodash", "4.17.21", "https://cdn.skypack.dev");
    assertEqual(url, "https://cdn.skypack.dev/lodash@4.17.21");
  });

  // Import Map Generation
  console.log("\ngenerateImportMap:");

  await test("generates empty import map", () => {
    const map = generateImportMap({});
    assert(typeof map.imports === "object", "Should have imports");
    assertEqual(Object.keys(map.imports).length, 0);
  });

  await test("generates import map from config", () => {
    const map = generateImportMap({
      imports: {
        lodash: "https://esm.sh/lodash@4.17.21",
        preact: "https://esm.sh/preact@10.19.0",
      },
    });
    assertEqual(map.imports.lodash, "https://esm.sh/lodash@4.17.21");
    assertEqual(map.imports.preact, "https://esm.sh/preact@10.19.0");
  });

  // Import Map Injection
  console.log("\ninjectImportMap:");

  await test("injects before first script tag", () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <script src="app.js"></script>
</body>
</html>`;

    const result = injectImportMap(html, { imports: { test: "https://esm.sh/test" } });

    assert(result.includes('type="importmap"'), "Should contain importmap");
    assert(result.indexOf("importmap") < result.indexOf('src="app.js"'), "importmap should be before script");
  });

  await test("injects at end of head if no script", () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <p>No scripts</p>
</body>
</html>`;

    const result = injectImportMap(html, { imports: { test: "https://esm.sh/test" } });

    assert(result.includes('type="importmap"'), "Should contain importmap");
    assert(result.indexOf("importmap") < result.indexOf("</head>"), "importmap should be before </head>");
  });

  // Dependency Resolver
  console.log("\nDependencyResolver:");

  const tempDir = await mkdtemp(join(tmpdir(), "weblet-deps-test-"));

  try {
    await test("resolves URL imports", async () => {
      const manifest = createMockManifest({
        strategy: "url",
        imports: {
          lodash: "https://esm.sh/lodash@4.17.21",
        },
      });

      const resolver = createDependencyResolver(tempDir, manifest);
      const resolved = await resolver.resolve();

      assertEqual(resolved.strategy, "url");
      assert(resolved.imports.has("lodash"), "Should have lodash");
      assertEqual(resolved.imports.get("lodash"), "https://esm.sh/lodash@4.17.21");
    });

    await test("generates import map", async () => {
      const manifest = createMockManifest({
        strategy: "url",
        imports: {
          preact: "https://esm.sh/preact@10.19.0",
        },
      });

      const resolver = createDependencyResolver(tempDir, manifest);
      const importMap = await resolver.getImportMap();

      assertEqual(importMap.imports.preact, "https://esm.sh/preact@10.19.0");
    });

    await test("injects import map into HTML", async () => {
      const manifest = createMockManifest({
        strategy: "url",
        imports: {
          lodash: "https://esm.sh/lodash@4.17.21",
        },
      });

      const html = "<html><head></head><body><script></script></body></html>";
      const resolver = createDependencyResolver(tempDir, manifest);
      const result = await resolver.injectIntoHtml(html);

      assert(result.includes("importmap"), "Should inject importmap");
      assert(result.includes("lodash"), "Should include lodash");
    });

  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  // Summary
  console.log(`\n${"─".repeat(40)}`);
  console.log(`Dependencies Tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
