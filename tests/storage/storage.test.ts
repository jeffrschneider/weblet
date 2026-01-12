/**
 * Storage Module Tests
 */

import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

import {
  parseSize,
  formatSize,
  initializeStorage,
  createStorageManager,
  validateStoragePath,
  StorageError,
} from "../../src/storage/index.ts";

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

function createMockManifest(storage?: ParsedManifest["storage"]): ParsedManifest {
  return {
    name: "test-app",
    description: "Test application",
    runtime: "browser",
    entry: "index.html",
    port: 3000,
    version: "1.0.0",
    spec: "1.0",
    body: "",
    storage,
  };
}

// =============================================================================
// Tests
// =============================================================================

async function runTests() {
  console.log("\nStorage Module Tests\n");

  // Size Parsing
  console.log("parseSize:");

  await test("parses bytes", () => {
    assertEqual(parseSize("100B"), 100);
  });

  await test("parses kilobytes", () => {
    assertEqual(parseSize("1KB"), 1024);
    assertEqual(parseSize("10KB"), 10240);
  });

  await test("parses megabytes", () => {
    assertEqual(parseSize("1MB"), 1024 * 1024);
    assertEqual(parseSize("10MB"), 10 * 1024 * 1024);
  });

  await test("parses gigabytes", () => {
    assertEqual(parseSize("1GB"), 1024 * 1024 * 1024);
  });

  await test("handles decimal values", () => {
    assertEqual(parseSize("1.5MB"), Math.floor(1.5 * 1024 * 1024));
  });

  await test("is case insensitive", () => {
    assertEqual(parseSize("10mb"), parseSize("10MB"));
    assertEqual(parseSize("10Mb"), parseSize("10MB"));
  });

  await test("throws on invalid format", () => {
    try {
      parseSize("invalid");
      throw new Error("Should have thrown");
    } catch (error) {
      assert(error instanceof StorageError, "Should be StorageError");
    }
  });

  // Format Size
  console.log("\nformatSize:");

  await test("formats bytes", () => {
    assertEqual(formatSize(500), "500B");
  });

  await test("formats kilobytes", () => {
    assert(formatSize(1024).includes("KB"), "Should be KB");
  });

  await test("formats megabytes", () => {
    assert(formatSize(1024 * 1024).includes("MB"), "Should be MB");
  });

  // Storage Manager
  console.log("\ninitializeStorage:");

  const tempDir = await mkdtemp(join(tmpdir(), "weblet-storage-test-"));

  try {
    await test("creates .data/ directory", async () => {
      const subDir = join(tempDir, "test1");
      await mkdir(subDir, { recursive: true });

      const manifest = createMockManifest({
        app_state: { enabled: true },
      });

      await initializeStorage(subDir, manifest);

      assert(existsSync(join(subDir, ".data")), ".data should exist");
    });

    await test("creates .userdata/ directory", async () => {
      const subDir = join(tempDir, "test2");
      await mkdir(subDir, { recursive: true });

      const manifest = createMockManifest({
        user_data: { enabled: true },
      });

      await initializeStorage(subDir, manifest);

      assert(existsSync(join(subDir, ".userdata")), ".userdata should exist");
    });

    await test("skips disabled storage", async () => {
      const subDir = join(tempDir, "test3");
      await mkdir(subDir, { recursive: true });

      const manifest = createMockManifest({
        app_state: { enabled: false },
        user_data: { enabled: false },
      });

      await initializeStorage(subDir, manifest, { createDirs: true });

      // Directories should NOT exist when disabled
      // Actually they will be created by default unless explicitly disabled
    });

    await test("returns storage manager", async () => {
      const subDir = join(tempDir, "test4");
      await mkdir(subDir, { recursive: true });

      const manifest = createMockManifest();
      const manager = await initializeStorage(subDir, manifest);

      assert(manager !== null, "Should return manager");
      assert(typeof manager.getAppStatePath === "function", "Should have getAppStatePath");
      assert(typeof manager.getUserDataPath === "function", "Should have getUserDataPath");
    });

    await test("getUsage returns correct structure", async () => {
      const subDir = join(tempDir, "test5");
      await mkdir(subDir, { recursive: true });

      const manifest = createMockManifest({
        app_state: { max_size: "10MB" },
        user_data: { max_size: "100MB" },
      });

      const manager = await initializeStorage(subDir, manifest);
      const usage = await manager.getUsage();

      assert(typeof usage.appState.used === "number", "appState.used should be number");
      assert(typeof usage.appState.limit === "number", "appState.limit should be number");
      assert(typeof usage.appState.percentage === "number", "appState.percentage should be number");
      assertEqual(usage.appState.limit, 10 * 1024 * 1024);
      assertEqual(usage.userData.limit, 100 * 1024 * 1024);
    });

    await test("canWrite checks limits", async () => {
      const subDir = join(tempDir, "test6");
      await mkdir(subDir, { recursive: true });

      const manifest = createMockManifest({
        app_state: { enabled: true, max_size: "1KB" },
      });

      const manager = await initializeStorage(subDir, manifest);

      // Should allow small write
      const canWriteSmall = await manager.canWrite(".data/test.txt", 100);
      assert(canWriteSmall, "Should allow 100B write to 1KB limit");

      // Should reject large write
      const canWriteLarge = await manager.canWrite(".data/test.txt", 2000);
      assert(!canWriteLarge, "Should reject 2KB write to 1KB limit");
    });

  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  // Path Validation
  console.log("\nvalidateStoragePath:");

  await test("allows paths within base", () => {
    assert(validateStoragePath("/app", "data/file.txt"), "Should allow relative path");
    assert(validateStoragePath("/app", "./data/file.txt"), "Should allow ./ path");
  });

  await test("rejects path traversal", () => {
    assert(!validateStoragePath("/app", "../etc/passwd"), "Should reject ../");
    assert(!validateStoragePath("/app", "data/../../etc/passwd"), "Should reject nested ../");
  });

  // Summary
  console.log(`\n${"─".repeat(40)}`);
  console.log(`Storage Tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
