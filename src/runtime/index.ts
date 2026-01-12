/**
 * Weblet Runtime Module
 *
 * Main entry point for the runtime, exporting all components.
 * Based on runtime.spec.md
 */

// =============================================================================
// Server
// =============================================================================

export {
  createServer,
  createBunServer,
  isPortAvailable,
  findAvailablePort,
  setupGracefulShutdown,
  type ServerConfig,
  type WebletServer,
} from "./server.ts";

// =============================================================================
// Static File Serving
// =============================================================================

export {
  getMimeType,
  needsTranspilation,
  resolveStaticFile,
  getCacheHeaders,
  notFoundResponse,
  serverErrorResponse,
  type StaticFileResult,
} from "./static.ts";

// =============================================================================
// API Routes
// =============================================================================

export {
  createApiRouter,
  discoverApiRoutes,
  filePathToRoute,
  extractParams,
  matchRoute,
  loadRouteHandlers,
  isApiPath,
  jsonResponse,
  parseJsonBody,
  type HttpMethod,
  type RouteParams,
  type RouteHandler,
  type ApiRoute,
  type ApiRouteMatch,
  type ApiRouter,
} from "./api.ts";

// =============================================================================
// HTML Injection
// =============================================================================

export {
  transformHtml,
  generateAgentContextStub,
  generateImportMapScript,
  generateHmrScript,
  rewriteBaseUrl,
  generateCspHeaders,
  generateErrorPage,
  generate404Page,
  generate500Page,
  type InjectionOptions,
} from "./inject.ts";

// =============================================================================
// Convenience Functions
// =============================================================================

import { parseManifest } from "../parser/index.ts";
import { createServer, setupGracefulShutdown, type ServerConfig } from "./server.ts";
import { join } from "node:path";
import { existsSync } from "node:fs";

export interface RunOptions {
  /** Port override */
  port?: number;
  /** Development mode */
  dev?: boolean;
  /** Open browser on start */
  open?: boolean;
  /** Enable SPA fallback */
  spaFallback?: boolean;
  /** Hostname to bind */
  hostname?: string;
}

/**
 * Run a weblet from a directory.
 * This is the main entry point for `weblet run`.
 */
export async function runWeblet(
  path: string,
  options: RunOptions = {}
): Promise<void> {
  // Resolve absolute path
  const root = join(process.cwd(), path);

  // Check for APP.md
  const appMdPath = join(root, "APP.md");
  if (!existsSync(appMdPath)) {
    throw new Error(`No APP.md found in ${root}`);
  }

  // Parse manifest
  const manifest = await parseManifest(appMdPath);

  // Create server config
  const config: ServerConfig = {
    root,
    manifest,
    port: options.port,
    dev: options.dev ?? true,
    open: options.open ?? false,
    spaFallback: options.spaFallback ?? true,
    hostname: options.hostname ?? "localhost",
  };

  // Create and start server
  const server = await createServer(config);
  setupGracefulShutdown(server);

  await server.start();
}

/**
 * Check if a directory is a valid weblet.
 */
export function isWeblet(path: string): boolean {
  const appMdPath = join(path, "APP.md");
  return existsSync(appMdPath);
}

/**
 * Discover weblets in a directory (non-recursive by default).
 */
export async function discoverWeblets(
  dir: string,
  recursive: boolean = false
): Promise<string[]> {
  const { readdir, stat } = await import("node:fs/promises");
  const weblets: string[] = [];

  // Check if dir itself is a weblet
  if (isWeblet(dir)) {
    weblets.push(dir);
    if (!recursive) return weblets;
  }

  // Scan subdirectories
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = join(dir, entry.name);
        if (isWeblet(subPath)) {
          weblets.push(subPath);
        } else if (recursive) {
          const subWeblets = await discoverWeblets(subPath, true);
          weblets.push(...subWeblets);
        }
      }
    }
  } catch {
    // Ignore errors reading directories
  }

  return weblets;
}
