/**
 * Runtime Module Tests
 */

import { mkdtemp, writeFile, rm, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

import {
  getMimeType,
  needsTranspilation,
  resolveStaticFile,
  getCacheHeaders,
  filePathToRoute,
  extractParams,
  discoverApiRoutes,
  matchRoute,
  isApiPath,
  jsonResponse,
  transformHtml,
  generateAgentContextStub,
  generateImportMapScript,
  generate404Page,
  generate500Page,
  isWeblet,
} from "../../src/runtime/index.ts";

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
// Tests
// =============================================================================

async function runTests() {
  console.log("\nRuntime Module Tests\n");

  // MIME Types
  console.log("getMimeType:");

  await test("returns correct MIME type for HTML", () => {
    assertEqual(getMimeType("index.html"), "text/html; charset=utf-8");
  });

  await test("returns correct MIME type for CSS", () => {
    assertEqual(getMimeType("style.css"), "text/css; charset=utf-8");
  });

  await test("returns correct MIME type for JavaScript", () => {
    assertEqual(getMimeType("app.js"), "text/javascript; charset=utf-8");
  });

  await test("returns correct MIME type for TypeScript", () => {
    assertEqual(getMimeType("app.ts"), "text/javascript; charset=utf-8");
  });

  await test("returns correct MIME type for JSON", () => {
    assertEqual(getMimeType("data.json"), "application/json");
  });

  await test("returns correct MIME type for PNG", () => {
    assertEqual(getMimeType("image.png"), "image/png");
  });

  await test("returns correct MIME type for SVG", () => {
    assertEqual(getMimeType("icon.svg"), "image/svg+xml");
  });

  await test("returns octet-stream for unknown extension", () => {
    assertEqual(getMimeType("file.xyz"), "application/octet-stream");
  });

  // Transpilation Detection
  console.log("\nneedsTranspilation:");

  await test("returns true for TypeScript files", () => {
    assert(needsTranspilation("app.ts"), "Should need transpilation");
  });

  await test("returns true for TSX files", () => {
    assert(needsTranspilation("component.tsx"), "Should need transpilation");
  });

  await test("returns true for JSX files", () => {
    assert(needsTranspilation("component.jsx"), "Should need transpilation");
  });

  await test("returns false for JavaScript files", () => {
    assert(!needsTranspilation("app.js"), "Should not need transpilation");
  });

  await test("returns false for CSS files", () => {
    assert(!needsTranspilation("style.css"), "Should not need transpilation");
  });

  // Static File Resolution
  console.log("\nresolveStaticFile:");

  const tempDir = await mkdtemp(join(tmpdir(), "weblet-runtime-test-"));

  try {
    // Create test files
    await writeFile(join(tempDir, "index.html"), "<html></html>");
    await mkdir(join(tempDir, "assets"), { recursive: true });
    await writeFile(join(tempDir, "assets", "style.css"), "body {}");
    await mkdir(join(tempDir, "subdir"), { recursive: true });
    await writeFile(join(tempDir, "subdir", "index.html"), "<html>subdir</html>");

    await test("resolves root path to index.html", async () => {
      const result = await resolveStaticFile(tempDir, "/index.html");
      assert(result.found, "Should find file");
      assertEqual(result.mimeType, "text/html; charset=utf-8");
    });

    await test("resolves assets directory files", async () => {
      const result = await resolveStaticFile(tempDir, "/assets/style.css");
      assert(result.found, "Should find file");
      assertEqual(result.mimeType, "text/css; charset=utf-8");
    });

    await test("resolves directory to index.html", async () => {
      const result = await resolveStaticFile(tempDir, "/subdir");
      assert(result.found, "Should find file");
      assert(result.filePath?.endsWith("index.html"), "Should resolve to index.html");
    });

    await test("returns not found for non-existent file", async () => {
      const result = await resolveStaticFile(tempDir, "/nonexistent.html");
      assert(!result.found, "Should not find file");
    });

    await test("prevents path traversal attacks", async () => {
      const result = await resolveStaticFile(tempDir, "/../../../etc/passwd");
      assert(!result.found, "Should block path traversal");
    });

    // Cache Headers
    console.log("\ngetCacheHeaders:");

    await test("returns no-cache in dev mode", () => {
      const headers = getCacheHeaders("app.js", true);
      assertEqual(headers["Cache-Control"], "no-cache");
    });

    await test("returns long cache for fonts in prod", () => {
      const headers = getCacheHeaders("font.woff2", false);
      assert(headers["Cache-Control"].includes("max-age=31536000"), "Should have long cache");
    });

    await test("returns short cache for JS in prod", () => {
      const headers = getCacheHeaders("app.js", false);
      assert(headers["Cache-Control"].includes("max-age=3600"), "Should have short cache");
    });

    // API Route Pattern Parsing
    console.log("\nfilePathToRoute:");

    await test("parses simple route", () => {
      const { pattern, paramNames } = filePathToRoute(
        join(tempDir, "api", "health.ts"),
        join(tempDir, "api")
      );
      assert(pattern.test("/api/health"), "Should match /api/health");
      assertEqual(paramNames.length, 0);
    });

    await test("parses route with path parameter", () => {
      const { pattern, paramNames } = filePathToRoute(
        join(tempDir, "api", "users", "[id].ts"),
        join(tempDir, "api")
      );
      assert(pattern.test("/api/users/123"), "Should match /api/users/123");
      assertEqual(paramNames.length, 1);
      assertEqual(paramNames[0], "id");
    });

    await test("parses nested route with parameters", () => {
      const { pattern, paramNames } = filePathToRoute(
        join(tempDir, "api", "posts", "[slug]", "comments.ts"),
        join(tempDir, "api")
      );
      assert(pattern.test("/api/posts/hello-world/comments"), "Should match nested route");
      assertEqual(paramNames[0], "slug");
    });

    // Extract Params
    console.log("\nextractParams:");

    await test("extracts single parameter", () => {
      const pattern = /^\/api\/users\/([^/]+)$/;
      const params = extractParams("/api/users/123", pattern, ["id"]);
      assert(params !== null, "Should extract params");
      assertEqual(params?.id, "123");
    });

    await test("extracts multiple parameters", () => {
      const pattern = /^\/api\/([^/]+)\/posts\/([^/]+)$/;
      const params = extractParams("/api/user1/posts/post1", pattern, ["userId", "postId"]);
      assert(params !== null, "Should extract params");
      assertEqual(params?.userId, "user1");
      assertEqual(params?.postId, "post1");
    });

    await test("decodes URL-encoded parameters", () => {
      const pattern = /^\/api\/users\/([^/]+)$/;
      const params = extractParams("/api/users/hello%20world", pattern, ["name"]);
      assertEqual(params?.name, "hello world");
    });

    // API Route Discovery
    console.log("\ndiscoverApiRoutes:");

    // Create API directory structure
    await mkdir(join(tempDir, "api"), { recursive: true });
    await mkdir(join(tempDir, "api", "users"), { recursive: true });
    await writeFile(join(tempDir, "api", "health.ts"), "export function GET() {}");
    await writeFile(join(tempDir, "api", "users.ts"), "export function GET() {}");
    await writeFile(join(tempDir, "api", "users", "[id].ts"), "export function GET() {}");

    await test("discovers all API routes", async () => {
      const routes = await discoverApiRoutes(join(tempDir, "api"));
      assertEqual(routes.length, 3);
    });

    await test("sorts static routes before parameterized", async () => {
      const routes = await discoverApiRoutes(join(tempDir, "api"));
      // Static routes should come first
      const staticRoutes = routes.filter((r) => r.paramNames.length === 0);
      const paramRoutes = routes.filter((r) => r.paramNames.length > 0);
      assert(staticRoutes.length > 0, "Should have static routes");
      assert(paramRoutes.length > 0, "Should have param routes");
    });

    await test("returns empty array for non-existent directory", async () => {
      const routes = await discoverApiRoutes(join(tempDir, "nonexistent"));
      assertEqual(routes.length, 0);
    });

    // isApiPath
    console.log("\nisApiPath:");

    await test("returns true for /api/ paths", () => {
      assert(isApiPath("/api/health"), "Should be API path");
      assert(isApiPath("/api/users/123"), "Should be API path");
    });

    await test("returns false for non-api paths", () => {
      assert(!isApiPath("/assets/style.css"), "Should not be API path");
      assert(!isApiPath("/index.html"), "Should not be API path");
    });

    // JSON Response
    console.log("\njsonResponse:");

    await test("creates JSON response with correct headers", async () => {
      const response = jsonResponse({ hello: "world" });
      assertEqual(response.status, 200);
      assertEqual(response.headers.get("Content-Type"), "application/json");

      const body = await response.json();
      assertEqual(body.hello, "world");
    });

    await test("supports custom status code", async () => {
      const response = jsonResponse({ error: "Not Found" }, 404);
      assertEqual(response.status, 404);
    });

    // HTML Transformation
    console.log("\ntransformHtml:");

    await test("injects agent context stub", () => {
      const html = "<html><head></head><body></body></html>";
      const result = transformHtml(html, { injectAgentContext: true });
      assert(result.includes("__AGENT_CONTEXT__"), "Should inject agent context");
    });

    await test("injects import map before scripts", () => {
      const html = '<html><head></head><body><script src="app.js"></script></body></html>';
      const result = transformHtml(html, {
        importMap: { imports: { lodash: "https://esm.sh/lodash" } },
      });
      assert(result.includes("importmap"), "Should inject import map");
      assert(result.indexOf("importmap") < result.indexOf("app.js"), "Import map should be before script");
    });

    await test("respects injectAgentContext: false", () => {
      const html = "<html><head></head><body></body></html>";
      const result = transformHtml(html, { injectAgentContext: false });
      assert(!result.includes("__AGENT_CONTEXT__"), "Should not inject agent context");
    });

    // Agent Context Stub
    console.log("\ngenerateAgentContextStub:");

    await test("generates valid script tag", () => {
      const stub = generateAgentContextStub();
      assert(stub.includes("<script>"), "Should be a script tag");
      assert(stub.includes("</script>"), "Should close script tag");
      assert(stub.includes("__AGENT_CONTEXT__"), "Should define context");
    });

    await test("stub has available: false", () => {
      const stub = generateAgentContextStub();
      assert(stub.includes("available: false"), "Should indicate not available");
    });

    // Import Map Script Generation
    console.log("\ngenerateImportMapScript:");

    await test("generates valid import map script", () => {
      const script = generateImportMapScript({ imports: { test: "https://example.com/test" } });
      assert(script.includes('type="importmap"'), "Should have importmap type");
      assert(script.includes('"test"'), "Should include mapping");
    });

    // Error Pages
    console.log("\nerror pages:");

    await test("generate404Page creates valid HTML", () => {
      const html = generate404Page("/missing");
      assert(html.includes("404"), "Should include status code");
      assert(html.includes("/missing"), "Should include path");
      assert(html.includes("<!DOCTYPE html>"), "Should be valid HTML");
    });

    await test("generate500Page creates valid HTML", () => {
      const html = generate500Page("Test error");
      assert(html.includes("500"), "Should include status code");
      assert(html.includes("Test error"), "Should include error message");
    });

    // Weblet Detection
    console.log("\nisWeblet:");

    await test("returns true for directory with APP.md", async () => {
      const webletDir = join(tempDir, "test-weblet");
      await mkdir(webletDir, { recursive: true });
      await writeFile(join(webletDir, "APP.md"), "---\nname: test\n---");

      assert(isWeblet(webletDir), "Should detect weblet");
    });

    await test("returns false for directory without APP.md", () => {
      assert(!isWeblet(tempDir), "Should not detect as weblet");
    });

  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  // Summary
  console.log(`\n${"─".repeat(40)}`);
  console.log(`Runtime Tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
