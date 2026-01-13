/**
 * Weblet Programmatic API
 *
 * High-level functions for other systems to integrate with weblets.
 * Use these when importing weblet as a library.
 */

import { parseManifest, type ParsedManifest } from "./parser/index.ts";
import { createServer, type WebletServer } from "./runtime/server.ts";
import { join, basename } from "path";

// =============================================================================
// Types
// =============================================================================

export interface ServeOptions {
  port?: number;
  hostname?: string;
  open?: boolean;
}

export interface ScreenshotOptions {
  /** Output directory for screenshots (default: ~/.weblet/screenshots/<name>/) */
  output?: string;
  /** Viewport sizes to capture (default: ['desktop', 'mobile']) */
  sizes?: string[];
  /** Capture animated GIF */
  animated?: boolean;
  /** Animation duration in seconds (default: 5) */
  duration?: number;
  /** GIF frame rate (default: 10) */
  fps?: number;
  /** Wait after page load in ms (default: 1000) */
  wait?: number;
  /** Route to capture (default: '/') */
  route?: string;
  /** Path to interaction script JSON */
  interactions?: string;
}

export interface ScreenshotResult {
  /** Paths to captured screenshot files */
  files: string[];
  /** Output directory */
  outputDir: string;
  /** App name from manifest */
  appName: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manifest?: ParsedManifest;
}

// =============================================================================
// Viewport Presets
// =============================================================================

const VIEWPORT_PRESETS: Record<string, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  wide: { width: 1920, height: 1080 },
};

// =============================================================================
// API Functions
// =============================================================================

/**
 * Parse and validate a weblet's APP.md manifest.
 *
 * @param webletPath - Path to the weblet directory
 * @returns Validation result with parsed manifest if valid
 *
 * @example
 * ```typescript
 * const result = await validateWeblet('./my-app');
 * if (result.valid) {
 *   console.log(result.manifest.name);
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 */
export async function validateWeblet(webletPath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const manifest = await parseManifest(webletPath);

    // Basic validation
    if (!manifest.name) {
      errors.push("Missing required field: name");
    }
    if (!manifest.version) {
      warnings.push("Missing recommended field: version");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      manifest,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings,
    };
  }
}

/**
 * Get parsed manifest information for a weblet.
 *
 * @param webletPath - Path to the weblet directory
 * @returns Parsed manifest
 *
 * @example
 * ```typescript
 * const manifest = await getWebletInfo('./my-app');
 * console.log(manifest.name, manifest.description);
 * ```
 */
export async function getWebletInfo(webletPath: string): Promise<ParsedManifest> {
  return parseManifest(webletPath);
}

export interface WebletServerHandle {
  /** The server URL (e.g., http://localhost:3000) */
  url: string;
  /** Stop the server */
  stop(): Promise<void>;
  /** Check if running */
  isRunning(): boolean;
}

/**
 * Start a weblet server.
 *
 * @param webletPath - Path to the weblet directory
 * @param options - Server options
 * @returns Server handle with url and stop() method
 *
 * @example
 * ```typescript
 * const server = await serveWeblet('./my-app', { port: 3000 });
 * console.log(`Running at ${server.url}`);
 * // ... later
 * await server.stop();
 * ```
 */
export async function serveWeblet(
  webletPath: string,
  options: ServeOptions = {}
): Promise<WebletServerHandle> {
  const manifest = await parseManifest(webletPath);
  const port = options.port ?? 3000;
  const hostname = options.hostname ?? "localhost";

  const server = await createServer({
    root: webletPath,
    manifest,
    port,
    hostname,
    open: options.open,
  });

  await server.start();

  return {
    url: server.getUrl(),
    stop: () => server.stop(),
    isRunning: () => server.isRunning(),
  };
}

/**
 * Capture screenshots of a weblet.
 *
 * @param webletPath - Path to the weblet directory
 * @param options - Screenshot options
 * @returns Result with file paths
 *
 * @example
 * ```typescript
 * const result = await captureScreenshots('./my-app', {
 *   output: './previews',
 *   sizes: ['desktop', 'mobile'],
 *   animated: true,
 *   duration: 5,
 * });
 * console.log('Screenshots saved:', result.files);
 * ```
 */
export async function captureScreenshots(
  webletPath: string,
  options: ScreenshotOptions = {}
): Promise<ScreenshotResult> {
  const manifest = await parseManifest(webletPath);
  const appName = manifest.name || basename(webletPath);

  // Determine output directory
  const outputDir = options.output || getDefaultScreenshotsDir(appName);

  // Parse viewport sizes
  const sizes = options.sizes || ["desktop", "mobile"];
  const viewports = sizes.map(parseViewportSize);

  // Ensure output directory exists
  const { mkdir } = await import("fs/promises");
  await mkdir(outputDir, { recursive: true });

  // Lazy-load puppeteer
  const puppeteer = await ensurePuppeteer();

  // Start the weblet server
  const server = await serveWeblet(webletPath, { port: 0 }); // port 0 = random available
  const serverUrl = server.url;

  const files: string[] = [];

  try {
    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    const route = options.route || "/";
    const url = `${serverUrl}${route}`;

    // Capture static screenshots for each viewport
    for (const { name, width, height } of viewports) {
      await page.setViewport({ width, height });
      await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

      // Additional wait for renders/animations
      await new Promise((r) => setTimeout(r, options.wait || 1000));

      const filename = `${name}.png`;
      const filepath = join(outputDir, filename);
      await page.screenshot({ path: filepath, fullPage: true });
      files.push(filepath);
    }

    // Capture animated GIF if requested
    if (options.animated) {
      const gifResult = await captureAnimatedGif(page, url, outputDir, {
        duration: options.duration || 5,
        fps: options.fps || 10,
        interactions: options.interactions,
        width: viewports[0]?.width || 1280,
        height: viewports[0]?.height || 800,
      });
      files.push(...gifResult);
    }

    await browser.close();
  } finally {
    await server.stop();
  }

  return {
    files,
    outputDir,
    appName,
  };
}

// =============================================================================
// Internal Helpers
// =============================================================================

function getDefaultScreenshotsDir(appName: string): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
  return join(homeDir, ".weblet", "screenshots", appName);
}

function parseViewportSize(size: string): { name: string; width: number; height: number } {
  // Check presets
  if (VIEWPORT_PRESETS[size]) {
    return { name: size, ...VIEWPORT_PRESETS[size] };
  }

  // Parse custom WIDTHxHEIGHT
  const match = size.match(/^(\d+)x(\d+)$/);
  if (match) {
    return {
      name: size,
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10),
    };
  }

  throw new Error(`Invalid viewport size: ${size}. Use preset (desktop, mobile, tablet, wide) or WIDTHxHEIGHT format.`);
}

let puppeteerModule: typeof import("puppeteer") | null = null;

async function ensurePuppeteer(): Promise<typeof import("puppeteer")> {
  if (puppeteerModule) {
    return puppeteerModule;
  }

  try {
    puppeteerModule = await import("puppeteer");
    return puppeteerModule;
  } catch {
    throw new Error(
      "Puppeteer is required for screenshots. Install it with: bun add puppeteer"
    );
  }
}

async function captureAnimatedGif(
  page: import("puppeteer").Page,
  url: string,
  outputDir: string,
  options: {
    duration: number;
    fps: number;
    interactions?: string;
    width: number;
    height: number;
  }
): Promise<string[]> {
  const files: string[] = [];
  const { mkdir } = await import("fs/promises");

  await page.setViewport({ width: options.width, height: options.height });
  await page.goto(url, { waitUntil: "networkidle0" });

  // Create temp directory for frames
  const framesDir = join(outputDir, ".frames");
  await mkdir(framesDir, { recursive: true });

  const frameCount = options.duration * options.fps;
  const frameDelay = 1000 / options.fps;

  // Load and execute interactions if provided
  let interactionActions: any[] = [];
  if (options.interactions) {
    try {
      const { readFile } = await import("fs/promises");
      const content = await readFile(options.interactions, "utf-8");
      const script = JSON.parse(content);
      interactionActions = script.actions || [];
    } catch {
      // Ignore interaction script errors
    }
  }

  // Capture frames
  let actionIndex = 0;
  for (let i = 0; i < frameCount; i++) {
    // Execute any pending interactions
    while (actionIndex < interactionActions.length) {
      const action = interactionActions[actionIndex];
      const actionTime = action.time || actionIndex * 500;

      if (actionTime <= i * frameDelay) {
        await executeInteraction(page, action);
        actionIndex++;
      } else {
        break;
      }
    }

    const framePath = join(framesDir, `frame-${String(i).padStart(4, "0")}.png`);
    await page.screenshot({ path: framePath });
    await new Promise((r) => setTimeout(r, frameDelay));
  }

  // Try to convert to GIF using ffmpeg
  const gifPath = join(outputDir, "preview.gif");
  const thumbPath = join(outputDir, "preview-thumb.png");

  try {
    const { execSync } = await import("child_process");
    execSync(
      `ffmpeg -y -framerate ${options.fps} -i "${framesDir}/frame-%04d.png" -vf "fps=${options.fps},scale=${options.width}:-1:flags=lanczos" "${gifPath}"`,
      { stdio: "pipe" }
    );
    files.push(gifPath);

    // Copy first frame as thumbnail
    const { copyFile } = await import("fs/promises");
    await copyFile(join(framesDir, "frame-0000.png"), thumbPath);
    files.push(thumbPath);
  } catch {
    // ffmpeg not available - just keep the frames or skip GIF
    console.warn("ffmpeg not available, animated GIF not created");
  }

  // Clean up frames
  try {
    const { rm } = await import("fs/promises");
    await rm(framesDir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }

  return files;
}

async function executeInteraction(
  page: import("puppeteer").Page,
  action: any
): Promise<void> {
  switch (action.type) {
    case "click":
      await page.click(action.selector);
      break;
    case "type":
      await page.type(action.selector, action.text);
      break;
    case "wait":
      await new Promise((r) => setTimeout(r, action.duration));
      break;
    case "scroll":
      await page.evaluate((x, y) => window.scrollBy(x, y), action.x || 0, action.y || 0);
      break;
    case "hover":
      await page.hover(action.selector);
      break;
    case "press":
      await page.keyboard.press(action.key);
      break;
  }
}
