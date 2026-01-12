/**
 * HTML Injection and Transformation
 *
 * Handles injecting import maps, agent context, and other runtime
 * scripts into HTML files.
 * Based on runtime.spec.md and agent-context.spec.md
 */

import type { ImportMap } from "../dependencies/index.ts";

// =============================================================================
// Types
// =============================================================================

export interface InjectionOptions {
  /** Import map to inject */
  importMap?: ImportMap;
  /** Whether to inject agent context stub */
  injectAgentContext?: boolean;
  /** Development mode (enables HMR, etc.) */
  devMode?: boolean;
  /** Base URL for assets */
  baseUrl?: string;
  /** Custom scripts to inject */
  customScripts?: string[];
}

// =============================================================================
// Agent Context Stub
// =============================================================================

/**
 * Generate the agent context stub script.
 * This provides a no-op implementation when no agent is present.
 */
export function generateAgentContextStub(): string {
  return `
<script>
// Agent Context Stub - Provides graceful degradation when no agent is present
(function() {
  if (window.__AGENT_CONTEXT__) return; // Agent already injected

  const noop = () => {};
  const noopPromise = () => Promise.resolve(undefined);
  const noopListener = () => ({ remove: noop });

  window.__AGENT_CONTEXT__ = {
    available: false,
    capabilities: [],

    emit: noop,
    request: noopPromise,
    on: noopListener,
    off: noop,

    getMetadata: () => ({}),
    getCapabilities: () => [],
    isCapabilitySupported: () => false,
  };
})();
</script>`.trim();
}

// =============================================================================
// Import Map Injection
// =============================================================================

/**
 * Generate import map script tag.
 */
export function generateImportMapScript(importMap: ImportMap): string {
  const json = JSON.stringify(importMap, null, 2);
  return `<script type="importmap">
${json}
</script>`;
}

// =============================================================================
// Development Mode Scripts
// =============================================================================

/**
 * Generate HMR (Hot Module Reload) client script.
 */
export function generateHmrScript(port: number = 3000): string {
  return `
<script>
// HMR Client
(function() {
  const ws = new WebSocket('ws://localhost:${port}/__hmr');
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'reload') {
      location.reload();
    } else if (data.type === 'css-update') {
      // Hot-reload CSS
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      links.forEach(link => {
        const url = new URL(link.href);
        url.searchParams.set('_hmr', Date.now());
        link.href = url.toString();
      });
    }
  };
  ws.onclose = () => {
    console.log('[HMR] Connection closed, attempting reconnect...');
    setTimeout(() => location.reload(), 1000);
  };
})();
</script>`.trim();
}

// =============================================================================
// HTML Transformation
// =============================================================================

/**
 * Find the best position to inject scripts in HTML.
 * Returns the index where injection should happen.
 */
function findInjectionPoint(html: string): {
  importMapIndex: number;
  scriptIndex: number;
} {
  // Import maps must be before any module scripts
  // Look for first <script> tag
  const firstScriptMatch = html.match(/<script[\s>]/i);
  const importMapIndex = firstScriptMatch
    ? html.indexOf(firstScriptMatch[0])
    : html.indexOf("</head>") !== -1
    ? html.indexOf("</head>")
    : html.indexOf("<body") !== -1
    ? html.indexOf("<body")
    : html.length;

  // Other scripts can go at end of head
  const headCloseIndex = html.indexOf("</head>");
  const scriptIndex = headCloseIndex !== -1 ? headCloseIndex : importMapIndex;

  return { importMapIndex, scriptIndex };
}

/**
 * Inject content at a specific position in HTML.
 */
function injectAt(html: string, position: number, content: string): string {
  return html.slice(0, position) + content + "\n" + html.slice(position);
}

/**
 * Transform HTML by injecting runtime scripts.
 */
export function transformHtml(html: string, options: InjectionOptions = {}): string {
  let result = html;
  const { importMapIndex, scriptIndex } = findInjectionPoint(result);

  // Track offset as we inject content
  let offset = 0;

  // 1. Inject import map (must be first, before any scripts)
  if (options.importMap && Object.keys(options.importMap.imports || {}).length > 0) {
    const importMapScript = generateImportMapScript(options.importMap);
    result = injectAt(result, importMapIndex + offset, importMapScript);
    offset += importMapScript.length + 1; // +1 for newline
  }

  // 2. Inject agent context stub
  if (options.injectAgentContext !== false) {
    const agentStub = generateAgentContextStub();
    // Agent context should be early but after import map
    const agentIndex = importMapIndex + offset;
    result = injectAt(result, agentIndex, agentStub);
    offset += agentStub.length + 1;
  }

  // 3. Inject HMR script in dev mode
  if (options.devMode) {
    const hmrScript = generateHmrScript();
    result = injectAt(result, scriptIndex + offset, hmrScript);
    offset += hmrScript.length + 1;
  }

  // 4. Inject custom scripts
  if (options.customScripts && options.customScripts.length > 0) {
    for (const script of options.customScripts) {
      result = injectAt(result, scriptIndex + offset, script);
      offset += script.length + 1;
    }
  }

  return result;
}

// =============================================================================
// Base URL Transformation
// =============================================================================

/**
 * Rewrite relative URLs in HTML to use a base URL.
 */
export function rewriteBaseUrl(html: string, baseUrl: string): string {
  if (!baseUrl || baseUrl === "/") return html;

  // Ensure baseUrl ends with /
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";

  // Rewrite src and href attributes that start with /
  return html
    .replace(/(src|href)="\/(?!\/)/gi, `$1="${base}`)
    .replace(/(src|href)='\/(?!\/)/gi, `$1='${base}`);
}

// =============================================================================
// Content Security Policy
// =============================================================================

/**
 * Generate CSP headers for a weblet.
 */
export function generateCspHeaders(options: {
  allowedCdns?: string[];
  allowEval?: boolean;
  allowInlineScripts?: boolean;
}): Record<string, string> {
  const directives: string[] = [];

  // Default sources
  directives.push("default-src 'self'");

  // Script sources
  const scriptSrc = ["'self'"];
  if (options.allowInlineScripts) {
    scriptSrc.push("'unsafe-inline'");
  }
  if (options.allowEval) {
    scriptSrc.push("'unsafe-eval'");
  }
  if (options.allowedCdns) {
    scriptSrc.push(...options.allowedCdns);
  }
  directives.push(`script-src ${scriptSrc.join(" ")}`);

  // Style sources
  directives.push("style-src 'self' 'unsafe-inline'");

  // Image sources
  directives.push("img-src 'self' data: blob:");

  // Font sources
  const fontSrc = ["'self'"];
  if (options.allowedCdns) {
    fontSrc.push(...options.allowedCdns);
  }
  directives.push(`font-src ${fontSrc.join(" ")}`);

  // Connect sources (for fetch, websocket)
  const connectSrc = ["'self'"];
  if (options.allowedCdns) {
    connectSrc.push(...options.allowedCdns);
  }
  directives.push(`connect-src ${connectSrc.join(" ")} ws:`);

  return {
    "Content-Security-Policy": directives.join("; "),
  };
}

// =============================================================================
// Error Page Generation
// =============================================================================

/**
 * Generate a styled error page.
 */
export function generateErrorPage(
  title: string,
  message: string,
  details?: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .error {
      max-width: 600px;
      text-align: center;
    }
    .error h1 {
      font-size: 4rem;
      color: #e94560;
      margin-bottom: 1rem;
    }
    .error p {
      font-size: 1.25rem;
      color: #aaa;
      margin-bottom: 1rem;
    }
    .error pre {
      background: #16213e;
      padding: 1rem;
      border-radius: 8px;
      text-align: left;
      overflow-x: auto;
      font-size: 0.875rem;
      color: #888;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="error">
    <h1>${title}</h1>
    <p>${message}</p>
    ${details ? `<pre>${details}</pre>` : ""}
  </div>
</body>
</html>`;
}

/**
 * Generate a 404 page.
 */
export function generate404Page(path: string): string {
  return generateErrorPage("404", "Page not found", `The requested path "${path}" does not exist.`);
}

/**
 * Generate a 500 error page.
 */
export function generate500Page(error?: string): string {
  return generateErrorPage(
    "500",
    "Internal Server Error",
    error || "An unexpected error occurred."
  );
}
