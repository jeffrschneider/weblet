/**
 * Static File Serving
 *
 * Handles serving static files with correct MIME types.
 * Based on runtime.spec.md Section 4.4
 */

import { stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { existsSync } from "node:fs";

// =============================================================================
// MIME Types
// =============================================================================

const MIME_TYPES: Record<string, string> = {
  // HTML
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",

  // CSS
  ".css": "text/css; charset=utf-8",

  // JavaScript
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".ts": "text/javascript; charset=utf-8", // Transpiled
  ".tsx": "text/javascript; charset=utf-8", // Transpiled
  ".jsx": "text/javascript; charset=utf-8", // Transpiled

  // JSON
  ".json": "application/json",

  // Images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".avif": "image/avif",

  // Fonts
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",

  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",

  // Video
  ".mp4": "video/mp4",
  ".webm": "video/webm",

  // Documents
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",

  // Archives
  ".zip": "application/zip",
  ".gz": "application/gzip",

  // Other
  ".wasm": "application/wasm",
  ".map": "application/json", // Source maps
};

const DEFAULT_MIME_TYPE = "application/octet-stream";

/**
 * Get MIME type for a file extension.
 */
export function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? DEFAULT_MIME_TYPE;
}

/**
 * Check if a file extension is TypeScript/JSX that needs transpilation.
 */
export function needsTranspilation(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return [".ts", ".tsx", ".jsx"].includes(ext);
}

// =============================================================================
// Static File Resolution
// =============================================================================

export interface StaticFileResult {
  found: boolean;
  filePath?: string;
  mimeType?: string;
  size?: number;
  isDirectory?: boolean;
}

/**
 * Resolve a URL path to a static file.
 */
export async function resolveStaticFile(
  root: string,
  urlPath: string
): Promise<StaticFileResult> {
  // Normalize path
  let normalizedPath = urlPath;
  if (normalizedPath.startsWith("/")) {
    normalizedPath = normalizedPath.slice(1);
  }

  // Prevent path traversal
  if (normalizedPath.includes("..")) {
    return { found: false };
  }

  const filePath = join(root, normalizedPath);

  // Check if path is within root
  if (!filePath.startsWith(root)) {
    return { found: false };
  }

  // Check if file exists
  if (!existsSync(filePath)) {
    return { found: false };
  }

  try {
    const stats = await stat(filePath);

    if (stats.isDirectory()) {
      // Try index.html in directory
      const indexPath = join(filePath, "index.html");
      if (existsSync(indexPath)) {
        const indexStats = await stat(indexPath);
        return {
          found: true,
          filePath: indexPath,
          mimeType: "text/html; charset=utf-8",
          size: indexStats.size,
          isDirectory: false,
        };
      }
      return { found: false, isDirectory: true };
    }

    return {
      found: true,
      filePath,
      mimeType: getMimeType(filePath),
      size: stats.size,
      isDirectory: false,
    };
  } catch {
    return { found: false };
  }
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create cache headers for static files.
 */
export function getCacheHeaders(
  filePath: string,
  isDev: boolean = true
): Record<string, string> {
  if (isDev) {
    return {
      "Cache-Control": "no-cache",
    };
  }

  const ext = extname(filePath).toLowerCase();

  // Long cache for versioned assets (fonts, images)
  if ([".woff", ".woff2", ".ttf", ".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) {
    return {
      "Cache-Control": "public, max-age=31536000, immutable",
    };
  }

  // Short cache for HTML/CSS/JS
  return {
    "Cache-Control": "public, max-age=3600",
  };
}

/**
 * Create a 404 response.
 */
export function notFoundResponse(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * Create a 500 response.
 */
export function serverErrorResponse(message: string = "Internal Server Error"): Response {
  return new Response(message, {
    status: 500,
    headers: { "Content-Type": "text/plain" },
  });
}
