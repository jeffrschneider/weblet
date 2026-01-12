/**
 * CLI Module Tests
 */

import { mkdtemp, writeFile, rm, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { execSync, exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

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
// CLI Execution Helper
// =============================================================================

const CLI_PATH = join(process.cwd(), "src/cli/index.ts");

async function runCli(args: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(`npx tsx ${CLI_PATH} ${args}`);
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      exitCode: error.code || 1,
    };
  }
}

// =============================================================================
// Test Fixtures
// =============================================================================

const VALID_APP_MD = `---
name: test-app
description: A test application
version: 1.0.0
runtime: browser
---

# Test App

This is a test.
`;

const INVALID_APP_MD = `---
runtime: browser
---

Missing required fields
`;

// =============================================================================
// Tests
// =============================================================================

async function runTests() {
  console.log("\nCLI Module Tests\n");

  // Help and Version
  console.log("Global flags:");

  await test("--help shows usage", async () => {
    const result = await runCli("--help");
    assert(result.stdout.includes("weblet"), "Should show weblet in help");
    assert(result.stdout.includes("validate"), "Should show validate command");
    assert(result.stdout.includes("init"), "Should show init command");
    assertEqual(result.exitCode, 0);
  });

  await test("--version shows version", async () => {
    const result = await runCli("--version");
    assert(/\d+\.\d+\.\d+/.test(result.stdout), "Should show version number");
    assertEqual(result.exitCode, 0);
  });

  await test("-h is alias for --help", async () => {
    const result = await runCli("-h");
    assert(result.stdout.includes("weblet"), "Should show help");
    assertEqual(result.exitCode, 0);
  });

  // Validate Command
  console.log("\nvalidate command:");

  const tempDir = await mkdtemp(join(tmpdir(), "weblet-cli-test-"));

  try {
    await test("validates valid APP.md", async () => {
      const appDir = join(tempDir, "valid-app");
      await mkdir(appDir, { recursive: true });
      await writeFile(join(appDir, "APP.md"), VALID_APP_MD);

      const result = await runCli(`validate ${appDir}`);
      assert(result.stdout.includes("valid") || result.stdout.includes("✓"), "Should indicate valid");
      assertEqual(result.exitCode, 0);
    });

    await test("fails on invalid APP.md", async () => {
      const appDir = join(tempDir, "invalid-app");
      await mkdir(appDir, { recursive: true });
      await writeFile(join(appDir, "APP.md"), INVALID_APP_MD);

      const result = await runCli(`validate ${appDir}`);
      assert(result.exitCode !== 0, "Should fail");
    });

    await test("--json outputs JSON", async () => {
      const appDir = join(tempDir, "json-app");
      await mkdir(appDir, { recursive: true });
      await writeFile(join(appDir, "APP.md"), VALID_APP_MD);

      const result = await runCli(`validate ${appDir} --json`);
      const json = JSON.parse(result.stdout);
      assertEqual(json.valid, true);
      assert(Array.isArray(json.errors), "Should have errors array");
    });

    await test("fails on missing path", async () => {
      const result = await runCli(`validate ${join(tempDir, "nonexistent")}`);
      assert(result.exitCode !== 0, "Should fail");
    });

    // Info Command
    console.log("\ninfo command:");

    await test("shows manifest info", async () => {
      const appDir = join(tempDir, "info-app");
      await mkdir(appDir, { recursive: true });
      await writeFile(join(appDir, "APP.md"), VALID_APP_MD);

      const result = await runCli(`info ${appDir}`);
      assert(result.stdout.includes("test-app"), "Should show app name");
      assert(result.stdout.includes("1.0.0"), "Should show version");
      assertEqual(result.exitCode, 0);
    });

    await test("--json outputs JSON", async () => {
      const appDir = join(tempDir, "info-json-app");
      await mkdir(appDir, { recursive: true });
      await writeFile(join(appDir, "APP.md"), VALID_APP_MD);

      const result = await runCli(`info ${appDir} --json`);
      const json = JSON.parse(result.stdout);
      assertEqual(json.name, "test-app");
      assertEqual(json.version, "1.0.0");
    });

    // Init Command
    console.log("\ninit command:");

    await test("creates new weblet", async () => {
      const newAppDir = join(tempDir, "new-app");

      const result = await runCli(`init ${newAppDir}`);
      assertEqual(result.exitCode, 0);

      assert(existsSync(join(newAppDir, "APP.md")), "Should create APP.md");
      assert(existsSync(join(newAppDir, "index.html")), "Should create index.html");
      assert(existsSync(join(newAppDir, ".gitignore")), "Should create .gitignore");
    });

    await test("--name sets app name", async () => {
      const newAppDir = join(tempDir, "named-app");

      await runCli(`init ${newAppDir} --name my-custom-name`);

      const appMd = await readFile(join(newAppDir, "APP.md"), "utf-8");
      assert(appMd.includes("name: my-custom-name"), "Should use custom name");
    });

    await test("--runtime sets runtime", async () => {
      const newAppDir = join(tempDir, "bun-app");

      await runCli(`init ${newAppDir} --runtime bun`);

      const appMd = await readFile(join(newAppDir, "APP.md"), "utf-8");
      assert(appMd.includes("runtime: bun"), "Should use bun runtime");
    });

    await test("--template dynamic creates serve.ts", async () => {
      const newAppDir = join(tempDir, "dynamic-app");

      await runCli(`init ${newAppDir} --template dynamic`);

      assert(existsSync(join(newAppDir, "serve.ts")), "Should create serve.ts");
      assert(existsSync(join(newAppDir, "assets/style.css")), "Should create assets/style.css");
    });

    await test("fails if APP.md already exists", async () => {
      const existingDir = join(tempDir, "existing-app");
      await mkdir(existingDir, { recursive: true });
      await writeFile(join(existingDir, "APP.md"), VALID_APP_MD);

      const result = await runCli(`init ${existingDir}`);
      assert(result.exitCode !== 0, "Should fail if APP.md exists");
    });

    // List Command
    console.log("\nlist command:");

    await test("lists weblets in directory", async () => {
      // Create multiple weblets
      const listDir = join(tempDir, "list-test");
      await mkdir(listDir, { recursive: true });

      const app1 = join(listDir, "app1");
      const app2 = join(listDir, "app2");
      await mkdir(app1, { recursive: true });
      await mkdir(app2, { recursive: true });
      await writeFile(join(app1, "APP.md"), VALID_APP_MD);
      await writeFile(join(app2, "APP.md"), VALID_APP_MD.replace("test-app", "app-two"));

      const result = await runCli(`list ${listDir}`);
      assert(result.stdout.includes("test-app") || result.stdout.includes("2"), "Should list weblets");
      assertEqual(result.exitCode, 0);
    });

    await test("--json outputs JSON", async () => {
      const listDir = join(tempDir, "list-json-test");
      await mkdir(listDir, { recursive: true });

      const app1 = join(listDir, "myapp");
      await mkdir(app1, { recursive: true });
      await writeFile(join(app1, "APP.md"), VALID_APP_MD);

      const result = await runCli(`list ${listDir} --json`);
      const json = JSON.parse(result.stdout);
      assert(typeof json.count === "number", "Should have count");
      assert(Array.isArray(json.weblets), "Should have weblets array");
    });

    await test("shows message when no weblets found", async () => {
      const emptyDir = join(tempDir, "empty-dir");
      await mkdir(emptyDir, { recursive: true });

      const result = await runCli(`list ${emptyDir}`);
      assert(result.stdout.includes("No weblets") || result.stdout.includes("0"), "Should show no weblets message");
    });

    // Vendor Command
    console.log("\nvendor command:");

    await test("shows help without arguments", async () => {
      const result = await runCli("vendor");
      assert(result.exitCode !== 0, "Should fail without args");
      assert(
        result.stderr.includes("No package") || result.stdout.includes("Usage"),
        "Should show usage info"
      );
    });

    await test("--list shows vendored packages", async () => {
      const vendorDir = join(tempDir, "vendor-list-test");
      await mkdir(vendorDir, { recursive: true });

      const result = await runCli(`vendor --list --dir ${join(vendorDir, "vendor")}`);
      // Should succeed even with no packages
      assert(
        result.stdout.includes("No vendor") || result.stdout.includes("vendored") || result.exitCode === 0,
        "Should handle empty vendor"
      );
    });

    // Unknown Command
    console.log("\nerror handling:");

    await test("unknown command shows error", async () => {
      const result = await runCli("unknown-command");
      assert(result.exitCode !== 0, "Should fail");
      assert(
        result.stderr.includes("Unknown") || result.stdout.includes("Unknown"),
        "Should mention unknown command"
      );
    });

  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  // Summary
  console.log(`\n${"─".repeat(40)}`);
  console.log(`CLI Tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
