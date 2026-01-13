/**
 * Screenshot Command
 *
 * Captures screenshots and animated GIFs of weblets for previews.
 * Based on screenshots.spec.md
 */

import { join, resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { printError, printInfo, printSuccess, printWarning } from "../index.ts";
import { parseFile, serializeManifest, type ParsedManifest } from "../../parser/index.ts";

// =============================================================================
// Types
// =============================================================================

interface ViewportSize {
  width: number;
  height: number;
}

interface InteractionAction {
  type: "click" | "type" | "wait" | "scroll" | "hover" | "press";
  selector?: string;
  text?: string;
  duration?: number;
  x?: number;
  y?: number;
  key?: string;
}

interface InteractionScript {
  actions: InteractionAction[];
}

interface ScreenshotOptions {
  sizes: string[];
  output: string;
  animated: boolean;
  duration: number;
  fps: number;
  wait: number;
  route: string;
  interactions?: string;
  viewportOnly: boolean;
  updateManifest: boolean;
  overwrite: boolean;
  json: boolean;
}

interface CaptureResult {
  path: string;
  size: string;
  width: number;
  height: number;
  animated: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const VIEWPORT_PRESETS: Record<string, ViewportSize> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  wide: { width: 1920, height: 1080 },
};

const DEFAULT_OPTIONS: ScreenshotOptions = {
  sizes: ["desktop", "mobile"],
  output: "", // Will be computed based on app name
  animated: false,
  duration: 5,
  fps: 10,
  wait: 1000,
  route: "/",
  viewportOnly: false,
  updateManifest: false,
  overwrite: false,
  json: false,
};

/**
 * Get the default screenshots directory (~/.weblet/screenshots/<app-name>/)
 */
function getDefaultScreenshotsDir(appName: string): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
  return join(homeDir, ".weblet", "screenshots", appName);
}

// =============================================================================
// Puppeteer Lazy Loading
// =============================================================================

let puppeteerModule: typeof import("puppeteer") | null = null;

async function ensurePuppeteer(): Promise<typeof import("puppeteer")> {
  if (puppeteerModule) {
    return puppeteerModule;
  }

  try {
    puppeteerModule = await import("puppeteer");
    return puppeteerModule;
  } catch {
    printInfo("Puppeteer not found. Installing (first-time setup)...");

    // Use process.execPath to get the bun executable path
    const bunPath = process.execPath;

    const proc = Bun.spawn([bunPath, "add", "puppeteer"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await proc.exited;

    if (proc.exitCode !== 0) {
      throw new Error("Failed to install Puppeteer");
    }

    printSuccess("Puppeteer installed successfully");
    puppeteerModule = await import("puppeteer");
    return puppeteerModule;
  }
}

// =============================================================================
// Viewport Parsing
// =============================================================================

function parseViewportSize(size: string): ViewportSize {
  // Check if it's a preset
  if (VIEWPORT_PRESETS[size]) {
    return VIEWPORT_PRESETS[size];
  }

  // Check if it's a custom size (WIDTHxHEIGHT)
  const match = size.match(/^(\d+)x(\d+)$/);
  if (match) {
    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10),
    };
  }

  throw new Error(
    `Invalid viewport size: ${size}. Use a preset (desktop, mobile, tablet, wide) or custom format (WIDTHxHEIGHT)`
  );
}

// =============================================================================
// Server Management
// =============================================================================

interface ServerProcess {
  proc: ReturnType<typeof Bun.spawn>;
  port: number;
  url: string;
}

async function startServer(
  webletPath: string,
  manifest: ParsedManifest
): Promise<ServerProcess> {
  const port = manifest.port ?? 3000;
  const url = `http://localhost:${port}`;

  let cmd: string[];
  const cwd = resolve(webletPath);
  const bunPath = process.execPath;

  switch (manifest.runtime) {
    case "browser":
      // Use simple static server
      cmd = [bunPath, "--bun", "-e", `Bun.serve({ port: ${port}, fetch(req) { const url = new URL(req.url); let path = url.pathname === '/' ? '/index.html' : url.pathname; const file = Bun.file('.' + path); return new Response(file); } }); console.log('Server ready');`];
      break;
    case "bun":
      cmd = [bunPath, manifest.server || "serve.ts"];
      break;
    case "deno":
      cmd = ["deno", "run", "--allow-net", "--allow-read", manifest.server || "serve.ts"];
      break;
    case "node":
      cmd = ["node", manifest.server || "serve.js"];
      break;
    default:
      cmd = [bunPath, manifest.server || "serve.ts"];
  }

  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });

  // Give server time to start
  await new Promise((r) => setTimeout(r, 500));

  // Wait for server to be ready
  const maxWait = 10000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok || response.status === 404 || response.status === 500) {
        // Server is responding
        return { proc, port, url };
      }
    } catch (e) {
      // Server not ready yet - check if it's a connection error
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (!errorMessage.includes("ECONNREFUSED") && !errorMessage.includes("abort") && !errorMessage.includes("fetch failed")) {
        // Different error, might be server issue
        console.error("Server check error:", errorMessage);
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  proc.kill();
  throw new Error(`Server failed to start within ${maxWait / 1000} seconds`);
}

function stopServer(server: ServerProcess): void {
  try {
    server.proc.kill();
  } catch {
    // Ignore errors when stopping
  }
}

// =============================================================================
// Screenshot Capture
// =============================================================================

async function captureScreenshot(
  page: import("puppeteer").Page,
  outputPath: string,
  viewportOnly: boolean
): Promise<void> {
  await page.screenshot({
    path: outputPath,
    fullPage: !viewportOnly,
  });
}

// =============================================================================
// Interaction Script Execution
// =============================================================================

async function executeInteractions(
  page: import("puppeteer").Page,
  script: InteractionScript
): Promise<void> {
  for (const action of script.actions) {
    switch (action.type) {
      case "click":
        if (action.selector) {
          await page.click(action.selector);
        }
        break;
      case "type":
        if (action.selector && action.text) {
          await page.type(action.selector, action.text);
        }
        break;
      case "wait":
        if (action.duration) {
          await new Promise((r) => setTimeout(r, action.duration));
        }
        break;
      case "scroll":
        await page.mouse.wheel({ deltaX: action.x ?? 0, deltaY: action.y ?? 0 });
        break;
      case "hover":
        if (action.selector) {
          await page.hover(action.selector);
        }
        break;
      case "press":
        if (action.key) {
          await page.keyboard.press(action.key as import("puppeteer").KeyInput);
        }
        break;
    }
  }
}

// =============================================================================
// Animated GIF Capture
// =============================================================================

async function captureAnimatedGif(
  page: import("puppeteer").Page,
  outputPath: string,
  options: {
    duration: number;
    fps: number;
    interactions?: InteractionScript;
  }
): Promise<string> {
  const thumbPath = outputPath.replace(".gif", "-thumb.png");

  // Capture first frame as thumbnail
  await page.screenshot({ path: thumbPath });

  // Check if we can use ffmpeg for conversion
  let hasFfmpeg = false;
  try {
    const result = Bun.spawnSync(["ffmpeg", "-version"]);
    hasFfmpeg = result.exitCode === 0;
  } catch {
    hasFfmpeg = false;
  }

  // Capture frames
  const frames: string[] = [];
  const frameInterval = 1000 / options.fps;
  const totalFrames = Math.ceil(options.duration * options.fps);
  const tempDir = join(resolve(outputPath), "..", ".temp-frames");

  // Create temp directory
  mkdirSync(tempDir, { recursive: true });

  const startTime = Date.now();
  let frameIndex = 0;

  // Execute interactions in parallel with frame capture
  const interactionPromise = options.interactions
    ? executeInteractions(page, options.interactions)
    : new Promise((r) => setTimeout(r, options.duration * 1000));

  while (frameIndex < totalFrames) {
    const framePath = join(tempDir, `frame-${String(frameIndex).padStart(4, "0")}.png`);
    await page.screenshot({ path: framePath });
    frames.push(framePath);
    frameIndex++;

    const elapsed = Date.now() - startTime;
    const targetTime = frameIndex * frameInterval;
    if (targetTime > elapsed) {
      await new Promise((r) => setTimeout(r, targetTime - elapsed));
    }
  }

  await interactionPromise;

  if (hasFfmpeg && frames.length > 0) {
    // Convert frames to GIF using ffmpeg
    const ffmpegProc = Bun.spawn([
      "ffmpeg",
      "-y",
      "-framerate", String(options.fps),
      "-i", join(tempDir, "frame-%04d.png"),
      "-vf", "scale=640:-1:flags=lanczos",
      outputPath,
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await ffmpegProc.exited;

    if (ffmpegProc.exitCode === 0) {
      // Clean up temp frames
      const fs = await import("node:fs/promises");
      for (const frame of frames) {
        try { await fs.unlink(frame); } catch { }
      }
      try { await fs.rmdir(tempDir); } catch { }

      return thumbPath;
    }
  }

  // Fallback: just use the first frame
  printWarning("Animated GIF generation requires ffmpeg. Saving static image instead.");
  const fs = await import("node:fs/promises");
  if (frames.length > 0) {
    await fs.copyFile(frames[0], outputPath);
  }

  // Clean up temp frames
  for (const frame of frames) {
    try { await fs.unlink(frame); } catch { }
  }
  try { await fs.rmdir(tempDir); } catch { }

  return thumbPath;
}

// =============================================================================
// Manifest Update
// =============================================================================

async function updateManifestScreenshots(
  webletPath: string,
  screenshots: CaptureResult[]
): Promise<void> {
  const appMdPath = join(webletPath, "APP.md");
  const content = readFileSync(appMdPath, "utf-8");

  const { manifest } = await parseFile(webletPath);

  // Add screenshot paths to manifest
  const screenshotPaths = screenshots.map((s) => s.path.replace(webletPath + "/", "").replace(webletPath + "\\", ""));

  // Update or create screenshots field
  (manifest as any).screenshots = screenshotPaths;

  // Serialize back to APP.md
  const newContent = serializeManifest(manifest);
  writeFileSync(appMdPath, newContent);
}

// =============================================================================
// Command
// =============================================================================

export async function screenshotCommand(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  // Get path (required)
  const inputPath = args[0];
  if (!inputPath) {
    printError("Path required. Usage: weblet screenshot <path>");
    process.exit(2);
  }

  const targetPath = resolve(inputPath);

  // Check if path exists
  if (!existsSync(targetPath)) {
    printError(`Path does not exist: ${inputPath}`);
    process.exit(3);
  }

  // Check for APP.md
  const appMdPath = join(targetPath, "APP.md");
  if (!existsSync(appMdPath)) {
    printError(`No APP.md found in ${inputPath}`);
    process.exit(3);
  }

  // Parse options
  const options: ScreenshotOptions = {
    sizes: flags.sizes
      ? String(flags.sizes).split(",").map((s) => s.trim())
      : DEFAULT_OPTIONS.sizes,
    output: typeof flags.output === "string" ? flags.output : DEFAULT_OPTIONS.output,
    animated: Boolean(flags.animated),
    duration: flags.duration ? parseInt(String(flags.duration), 10) : DEFAULT_OPTIONS.duration,
    fps: flags.fps ? parseInt(String(flags.fps), 10) : DEFAULT_OPTIONS.fps,
    wait: flags.wait ? parseInt(String(flags.wait), 10) : DEFAULT_OPTIONS.wait,
    route: typeof flags.route === "string" ? flags.route : DEFAULT_OPTIONS.route,
    interactions: typeof flags.interactions === "string" ? flags.interactions : undefined,
    viewportOnly: Boolean(flags["viewport-only"]),
    updateManifest: Boolean(flags["update-manifest"]),
    overwrite: Boolean(flags.overwrite),
    json: Boolean(flags.json),
  };

  // Parse viewport sizes
  const viewports: { name: string; size: ViewportSize }[] = [];
  for (const sizeName of options.sizes) {
    try {
      const size = parseViewportSize(sizeName);
      viewports.push({ name: sizeName, size });
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(4);
    }
  }

  // Load interaction script if provided
  let interactionScript: InteractionScript | undefined;
  if (options.interactions) {
    const scriptPath = resolve(options.interactions);
    if (!existsSync(scriptPath)) {
      printError(`Interaction script not found: ${options.interactions}`);
      process.exit(3);
    }
    try {
      const scriptContent = readFileSync(scriptPath, "utf-8");
      interactionScript = JSON.parse(scriptContent);
    } catch (error) {
      printError(`Failed to parse interaction script: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(4);
    }
  }

  // Parse manifest first (needed for default output directory)
  const { manifest } = await parseFile(targetPath);

  // Determine output directory
  // Default: ~/.weblet/screenshots/<app-name>/
  // Override with --output flag
  const outputDir = options.output
    ? resolve(options.output)
    : getDefaultScreenshotsDir(manifest.name);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  if (!options.json) {
    printInfo(`Capturing screenshots for ${manifest.name}...`);
  }

  // Ensure Puppeteer is available
  const puppeteer = await ensurePuppeteer();

  // Start the weblet server
  if (!options.json) {
    printInfo("Starting weblet server...");
  }
  const server = await startServer(targetPath, manifest);
  if (!options.json) {
    printInfo(`Server started at ${server.url}`);
  }

  const results: CaptureResult[] = [];

  try {
    // Launch browser
    if (!options.json) {
      printInfo("Launching browser...");
    }
    const browser = await puppeteer.launch({ headless: true });
    if (!options.json) {
      printInfo("Browser launched, creating page...");
    }
    const page = await browser.newPage();

    // Navigate to the route
    const targetUrl = `${server.url}${options.route}`;
    await page.goto(targetUrl, { waitUntil: "networkidle0" });

    // Additional wait for rendering
    await new Promise((r) => setTimeout(r, options.wait));

    // Capture static screenshots for each viewport
    for (const { name, size } of viewports) {
      const filename = `${name}.png`;
      const outputPath = join(outputDir, filename);

      if (existsSync(outputPath) && !options.overwrite) {
        if (!options.json) {
          printWarning(`Skipping ${filename} (already exists, use --overwrite)`);
        }
        continue;
      }

      await page.setViewport(size);
      await new Promise((r) => setTimeout(r, 100)); // Let layout stabilize

      await captureScreenshot(page, outputPath, options.viewportOnly);

      results.push({
        path: outputPath,
        size: name,
        width: size.width,
        height: size.height,
        animated: false,
      });

      if (!options.json) {
        printSuccess(`Captured ${filename} (${size.width}x${size.height})`);
      }
    }

    // Capture animated GIF if requested
    if (options.animated) {
      const gifFilename = "preview.gif";
      const gifPath = join(outputDir, gifFilename);

      if (existsSync(gifPath) && !options.overwrite) {
        if (!options.json) {
          printWarning(`Skipping ${gifFilename} (already exists, use --overwrite)`);
        }
      } else {
        if (!options.json) {
          printInfo(`Recording animated preview (${options.duration}s)...`);
        }

        // Use desktop viewport for GIF
        await page.setViewportSize(VIEWPORT_PRESETS.desktop);
        await new Promise((r) => setTimeout(r, 100));

        const thumbPath = await captureAnimatedGif(page, gifPath, {
          duration: options.duration,
          fps: options.fps,
          interactions: interactionScript,
        });

        results.push({
          path: gifPath,
          size: "desktop",
          width: VIEWPORT_PRESETS.desktop.width,
          height: VIEWPORT_PRESETS.desktop.height,
          animated: true,
        });

        if (!options.json) {
          printSuccess(`Captured ${gifFilename}`);
          printSuccess(`Captured preview-thumb.png`);
        }
      }
    }

    await browser.close();
  } finally {
    // Stop the server
    stopServer(server);
  }

  // Update manifest if requested
  if (options.updateManifest && results.length > 0) {
    await updateManifestScreenshots(targetPath, results);
    if (!options.json) {
      printSuccess("Updated APP.md with screenshot paths");
    }
  }

  // Output results
  if (options.json) {
    console.log(JSON.stringify({ screenshots: results }, null, 2));
  } else {
    printSuccess(`\nCaptured ${results.length} screenshot(s) to ${outputDir}`);
  }
}
