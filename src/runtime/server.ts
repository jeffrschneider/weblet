/**
 * Weblet Server
 *
 * Main server implementation using Bun.serve or Node.js http.
 * Based on runtime.spec.md Section 3.2
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { ParsedManifest } from "../parser/schema.ts";
import { initializeStorage } from "../storage/index.ts";
import { createDependencyResolver } from "../dependencies/index.ts";
import { resolveStaticFile, getMimeType, needsTranspilation, getCacheHeaders, notFoundResponse, serverErrorResponse } from "./static.ts";
import { createApiRouter, isApiPath, type ApiRouter } from "./api.ts";
import { transformHtml, generate404Page, generate500Page, type InjectionOptions } from "./inject.ts";

// =============================================================================
// Types
// =============================================================================

export interface ServerConfig {
  /** Root directory of the weblet */
  root: string;
  /** Parsed manifest from APP.md */
  manifest: ParsedManifest;
  /** Override port (env var or CLI flag) */
  port?: number;
  /** Development mode */
  dev?: boolean;
  /** Open browser on start */
  open?: boolean;
  /** Enable SPA fallback */
  spaFallback?: boolean;
  /** Custom hostname to bind */
  hostname?: string;
}

export interface WebletServer {
  /** Start the server */
  start(): Promise<void>;
  /** Stop the server */
  stop(): Promise<void>;
  /** Restart the server */
  restart(): Promise<void>;
  /** Get the server URL */
  getUrl(): string;
  /** Check if server is running */
  isRunning(): boolean;
}

// =============================================================================
// Port Utilities
// =============================================================================

/**
 * Check if a port is available.
 */
export async function isPortAvailable(port: number, hostname: string = "localhost"): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createHttpServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, hostname);
  });
}

/**
 * Find the next available port.
 */
export async function findAvailablePort(
  startPort: number,
  hostname: string = "localhost",
  maxAttempts: number = 10
): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port, hostname)) {
      return port;
    }
  }
  return null;
}

// =============================================================================
// Request Handler Factory
// =============================================================================

interface RequestHandlerDeps {
  root: string;
  manifest: ParsedManifest;
  apiRouter: ApiRouter;
  injectionOptions: InjectionOptions;
  spaFallback: boolean;
}

/**
 * Create a request handler function.
 */
function createRequestHandler(deps: RequestHandlerDeps) {
  const { root, manifest, apiRouter, injectionOptions, spaFallback } = deps;

  return async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      // 1. API Routes
      if (isApiPath(path)) {
        return await apiRouter.handle(req);
      }

      // 2. Static Files
      const staticResult = await resolveStaticFile(root, path);

      if (staticResult.found && staticResult.filePath) {
        // Read file
        let content = await readFile(staticResult.filePath);
        let contentType = staticResult.mimeType || "application/octet-stream";

        // Transform HTML files
        if (contentType.includes("text/html")) {
          const html = content.toString("utf-8");
          const transformed = transformHtml(html, injectionOptions);
          content = Buffer.from(transformed, "utf-8");
        }

        // Handle TypeScript/JSX transpilation placeholder
        // Note: Full transpilation requires Bun.Transpiler or esbuild
        if (needsTranspilation(staticResult.filePath)) {
          // In a full implementation, we'd transpile here
          // For now, just serve as JavaScript
          contentType = "text/javascript; charset=utf-8";
        }

        const headers: Record<string, string> = {
          "Content-Type": contentType,
          "Content-Length": String(content.length),
          ...getCacheHeaders(staticResult.filePath, injectionOptions.devMode),
        };

        return new Response(content, { headers });
      }

      // 3. SPA Fallback - serve index.html for unmatched routes
      if (spaFallback && !path.includes(".")) {
        const entryPath = join(root, manifest.entry);
        if (existsSync(entryPath)) {
          const html = await readFile(entryPath, "utf-8");
          const transformed = transformHtml(html, injectionOptions);

          return new Response(transformed, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              ...getCacheHeaders(entryPath, injectionOptions.devMode),
            },
          });
        }
      }

      // 4. Not Found
      const html = generate404Page(path);
      return new Response(html, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (error) {
      console.error(`Error handling ${path}:`, error);
      const html = generate500Page(
        error instanceof Error ? error.message : "Unknown error"
      );
      return new Response(html, {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  };
}

// =============================================================================
// Bun Server Implementation
// =============================================================================

/**
 * Create a Bun-based server.
 * Note: This requires Bun runtime. Falls back to Node.js http if unavailable.
 */
export async function createBunServer(config: ServerConfig): Promise<WebletServer> {
  const {
    root,
    manifest,
    port: overridePort,
    dev = true,
    spaFallback = true,
    hostname = "localhost",
  } = config;

  // Determine port
  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
  const port = overridePort ?? envPort ?? manifest.port ?? 3000;

  // Initialize storage
  await initializeStorage(root, manifest);

  // Initialize dependency resolver
  const depResolver = createDependencyResolver(root, manifest);
  const importMap = await depResolver.getImportMap();

  // Create API router
  const apiRouter = await createApiRouter(root);

  // Injection options
  const injectionOptions: InjectionOptions = {
    importMap: Object.keys(importMap.imports).length > 0 ? importMap : undefined,
    injectAgentContext: true,
    devMode: dev,
  };

  // Create request handler
  const handleRequest = createRequestHandler({
    root,
    manifest,
    apiRouter,
    injectionOptions,
    spaFallback,
  });

  let server: any = null;
  let isRunningFlag = false;

  return {
    async start(): Promise<void> {
      // Check port availability
      if (!(await isPortAvailable(port, hostname))) {
        const altPort = await findAvailablePort(port + 1, hostname);
        throw new Error(
          `Port ${port} is already in use.` +
            (altPort ? ` Try port ${altPort} instead.` : "")
        );
      }

      // Try Bun.serve first, fall back to Node.js http
      if (typeof globalThis.Bun !== "undefined") {
        server = Bun.serve({
          port,
          hostname,
          fetch: handleRequest,
          error(error: Error): Response {
            console.error("Server error:", error);
            return new Response(generate500Page(error.message), {
              status: 500,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          },
        });
      } else {
        // Node.js fallback
        server = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
          try {
            // Convert Node.js request to Web Request
            const protocol = "http";
            const host = req.headers.host || `${hostname}:${port}`;
            const url = new URL(req.url || "/", `${protocol}://${host}`);

            // Read body for POST/PUT/PATCH
            let body: string | undefined;
            if (req.method && ["POST", "PUT", "PATCH"].includes(req.method)) {
              body = await new Promise<string>((resolve) => {
                let data = "";
                req.on("data", (chunk) => (data += chunk));
                req.on("end", () => resolve(data));
              });
            }

            const request = new Request(url.toString(), {
              method: req.method,
              headers: req.headers as Record<string, string>,
              body: body,
            });

            const response = await handleRequest(request);

            // Send response
            res.statusCode = response.status;
            response.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });

            const responseBody = await response.arrayBuffer();
            res.end(Buffer.from(responseBody));
          } catch (error) {
            console.error("Request error:", error);
            res.statusCode = 500;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(generate500Page(error instanceof Error ? error.message : "Unknown error"));
          }
        });

        await new Promise<void>((resolve, reject) => {
          server.once("error", reject);
          server.listen(port, hostname, () => {
            server.removeListener("error", reject);
            resolve();
          });
        });
      }

      isRunningFlag = true;
      console.log(`Server running at http://${hostname}:${port}`);

      // Open browser if requested
      if (config.open) {
        const openUrl = `http://${hostname}:${port}`;
        const { exec } = await import("node:child_process");
        const cmd =
          process.platform === "darwin"
            ? `open "${openUrl}"`
            : process.platform === "win32"
            ? `start "" "${openUrl}"`
            : `xdg-open "${openUrl}"`;
        exec(cmd, () => {}); // Ignore errors
      }
    },

    async stop(): Promise<void> {
      if (!server) return;

      if (typeof globalThis.Bun !== "undefined") {
        server.stop();
      } else {
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
      }

      server = null;
      isRunningFlag = false;
      console.log("Server stopped");
    },

    async restart(): Promise<void> {
      await this.stop();
      await this.start();
    },

    getUrl(): string {
      return `http://${hostname}:${port}`;
    },

    isRunning(): boolean {
      return isRunningFlag;
    },
  };
}

// =============================================================================
// Server Factory
// =============================================================================

/**
 * Create a server based on the manifest runtime type.
 */
export async function createServer(config: ServerConfig): Promise<WebletServer> {
  const { manifest } = config;

  switch (manifest.runtime) {
    case "bun":
    case "browser":
      // Both use the same server implementation
      // Browser mode just means no custom server entry point
      return createBunServer(config);

    case "node":
      // Node.js mode - same implementation but ensures Node.js http is used
      return createBunServer(config);

    case "deno":
      // Deno support would require a separate implementation
      throw new Error("Deno runtime not yet supported in reference implementation");

    default:
      throw new Error(`Unknown runtime: ${manifest.runtime}`);
  }
}

// =============================================================================
// Graceful Shutdown
// =============================================================================

/**
 * Setup graceful shutdown handlers.
 */
export function setupGracefulShutdown(server: WebletServer): void {
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    // Set a timeout for forced shutdown
    const timeout = setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 5000);

    try {
      await server.stop();
      clearTimeout(timeout);
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      clearTimeout(timeout);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
