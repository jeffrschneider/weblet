/**
 * API Route Handling
 *
 * Maps /api/* routes to handler files.
 * Based on runtime.spec.md Section 4.3
 */

import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative, basename, dirname } from "node:path";

// =============================================================================
// Types
// =============================================================================

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export interface RouteParams {
  [key: string]: string;
}

export type RouteHandler = (
  req: Request,
  params: RouteParams
) => Response | Promise<Response>;

export interface ApiRoute {
  pattern: RegExp;
  paramNames: string[];
  filePath: string;
  handlers?: Map<HttpMethod, RouteHandler>;
}

export interface ApiRouteMatch {
  route: ApiRoute;
  params: RouteParams;
}

// =============================================================================
// Route Pattern Parsing
// =============================================================================

/**
 * Convert a file path to a route pattern.
 * e.g., "api/users/[id].ts" -> { pattern: /^\/api\/users\/([^/]+)$/, paramNames: ["id"] }
 */
export function filePathToRoute(
  filePath: string,
  apiDir: string
): { pattern: RegExp; paramNames: string[] } {
  // Get relative path from api directory
  const relativePath = relative(apiDir, filePath);

  // Remove extension
  const pathWithoutExt = relativePath.replace(/\.(ts|js|tsx|jsx)$/, "");

  // Handle index files
  const routePath = pathWithoutExt.endsWith("/index")
    ? pathWithoutExt.slice(0, -6)
    : pathWithoutExt === "index"
    ? ""
    : pathWithoutExt;

  // Extract param names and build pattern
  const paramNames: string[] = [];
  const patternParts = routePath.split(/[\\/]/).map((part) => {
    // Match [paramName] pattern
    const paramMatch = part.match(/^\[([^\]]+)\]$/);
    if (paramMatch) {
      paramNames.push(paramMatch[1]);
      return "([^/]+)";
    }
    // Escape special regex characters
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });

  const patternStr = `/api/${patternParts.join("/")}`;
  const pattern = new RegExp(`^${patternStr}$`);

  return { pattern, paramNames };
}

/**
 * Extract parameters from a URL path using a route pattern.
 */
export function extractParams(
  path: string,
  pattern: RegExp,
  paramNames: string[]
): RouteParams | null {
  const match = path.match(pattern);
  if (!match) return null;

  const params: RouteParams = {};
  paramNames.forEach((name, index) => {
    params[name] = decodeURIComponent(match[index + 1]);
  });

  return params;
}

// =============================================================================
// Route Discovery
// =============================================================================

/**
 * Discover all API route files in a directory.
 */
export async function discoverApiRoutes(apiDir: string): Promise<ApiRoute[]> {
  if (!existsSync(apiDir)) {
    return [];
  }

  const routes: ApiRoute[] = [];

  async function scanDir(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile() && /\.(ts|js|tsx|jsx)$/.test(entry.name)) {
        const { pattern, paramNames } = filePathToRoute(fullPath, apiDir);
        routes.push({
          pattern,
          paramNames,
          filePath: fullPath,
        });
      }
    }
  }

  await scanDir(apiDir);

  // Sort routes: static routes before parameterized routes
  routes.sort((a, b) => {
    const aHasParams = a.paramNames.length > 0;
    const bHasParams = b.paramNames.length > 0;
    if (aHasParams && !bHasParams) return 1;
    if (!aHasParams && bHasParams) return -1;
    // More specific (longer) routes first
    return b.pattern.source.length - a.pattern.source.length;
  });

  return routes;
}

// =============================================================================
// Route Matching
// =============================================================================

/**
 * Match a URL path to an API route.
 */
export function matchRoute(
  path: string,
  routes: ApiRoute[]
): ApiRouteMatch | null {
  for (const route of routes) {
    const params = extractParams(path, route.pattern, route.paramNames);
    if (params !== null) {
      return { route, params };
    }
  }
  return null;
}

// =============================================================================
// Handler Loading
// =============================================================================

/**
 * Load handlers from a route file.
 * Returns a map of HTTP method -> handler function.
 */
export async function loadRouteHandlers(
  filePath: string
): Promise<Map<HttpMethod, RouteHandler>> {
  const handlers = new Map<HttpMethod, RouteHandler>();

  try {
    // Dynamic import of the route file
    const module = await import(`file://${filePath.replace(/\\/g, "/")}`);

    const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

    for (const method of methods) {
      if (typeof module[method] === "function") {
        handlers.set(method, module[method]);
      }
    }

    // Support default export as GET handler
    if (typeof module.default === "function" && !handlers.has("GET")) {
      handlers.set("GET", module.default);
    }
  } catch (error) {
    console.error(`Error loading route handlers from ${filePath}:`, error);
  }

  return handlers;
}

// =============================================================================
// API Router
// =============================================================================

export interface ApiRouter {
  routes: ApiRoute[];
  match(path: string): ApiRouteMatch | null;
  handle(req: Request): Promise<Response>;
  reload(): Promise<void>;
}

/**
 * Create an API router for a weblet.
 */
export async function createApiRouter(root: string): Promise<ApiRouter> {
  const apiDir = join(root, "api");
  let routes = await discoverApiRoutes(apiDir);

  // Preload all handlers
  for (const route of routes) {
    route.handlers = await loadRouteHandlers(route.filePath);
  }

  return {
    routes,

    match(path: string): ApiRouteMatch | null {
      return matchRoute(path, routes);
    },

    async handle(req: Request): Promise<Response> {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method.toUpperCase() as HttpMethod;

      // Match route
      const match = matchRoute(path, routes);
      if (!match) {
        return jsonResponse({ error: "Not Found" }, 404);
      }

      // Get handler for method
      const handler = match.route.handlers?.get(method);
      if (!handler) {
        // Check if route has any handlers
        if (match.route.handlers && match.route.handlers.size > 0) {
          const allowedMethods = Array.from(match.route.handlers.keys()).join(", ");
          return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
            status: 405,
            headers: {
              "Content-Type": "application/json",
              Allow: allowedMethods,
            },
          });
        }
        return jsonResponse({ error: "Not Found" }, 404);
      }

      try {
        return await handler(req, match.params);
      } catch (error) {
        console.error(`API error in ${path}:`, error);
        return jsonResponse(
          { error: "Internal Server Error" },
          500
        );
      }
    },

    async reload(): Promise<void> {
      routes = await discoverApiRoutes(apiDir);
      for (const route of routes) {
        route.handlers = await loadRouteHandlers(route.filePath);
      }
    },
  };
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create a JSON response.
 */
export function jsonResponse(
  data: unknown,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

/**
 * Parse JSON body from request safely.
 */
export async function parseJsonBody<T = unknown>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Check if a path is an API route.
 */
export function isApiPath(path: string): boolean {
  return path.startsWith("/api/") || path === "/api";
}
