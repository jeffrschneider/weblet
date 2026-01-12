/**
 * List Command
 *
 * Discovers and lists weblets in a directory.
 * Based on cli.spec.md FR-CLI-009
 */

import { readdir, stat } from "node:fs/promises";
import { join, relative, basename, resolve, isAbsolute } from "node:path";
import { existsSync } from "node:fs";
import { printError, printInfo, printWarning } from "../index.ts";
import { parseManifest } from "../../parser/index.ts";
import type { ParsedManifest } from "../../parser/schema.ts";

// =============================================================================
// Types
// =============================================================================

interface DiscoveredWeblet {
  path: string;
  relativePath: string;
  name: string;
  description: string;
  version: string;
  runtime: string;
  valid: boolean;
  error?: string;
}

// =============================================================================
// Command
// =============================================================================

export async function listCommand(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  // Get search path (default to current directory)
  const inputPath = args[0] || ".";
  const searchPath = isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath);

  // Check if path exists
  if (!existsSync(searchPath)) {
    printError(`Path does not exist: ${args[0] || "."}`);
    process.exit(3);
  }

  // Parse options
  const recursive = Boolean(flags.recursive || flags.r);
  const jsonOutput = Boolean(flags.json);
  const showAll = Boolean(flags.all || flags.a);
  const maxDepth = typeof flags.depth === "string"
    ? parseInt(flags.depth, 10)
    : recursive ? 10 : 1;

  try {
    const weblets = await discoverWeblets(searchPath, {
      recursive,
      maxDepth,
      includeInvalid: showAll,
    });

    if (jsonOutput) {
      console.log(JSON.stringify({
        count: weblets.length,
        weblets: weblets.map((w) => ({
          name: w.name,
          path: w.relativePath,
          description: w.description,
          version: w.version,
          runtime: w.runtime,
          valid: w.valid,
          ...(w.error && { error: w.error }),
        })),
      }, null, 2));
      return;
    }

    if (weblets.length === 0) {
      printWarning("No weblets found");
      printInfo("Use 'weblet init <name>' to create a new weblet");
      return;
    }

    // Group by validity
    const validWeblets = weblets.filter((w) => w.valid);
    const invalidWeblets = weblets.filter((w) => !w.valid);

    console.log(`\nDiscovered ${weblets.length} weblet${weblets.length === 1 ? "" : "s"}:\n`);

    for (const weblet of validWeblets) {
      console.log(`  ${weblet.name}`);
      console.log(`    Path: ${weblet.relativePath}`);
      console.log(`    ${weblet.description}`);
      console.log(`    Version: ${weblet.version} | Runtime: ${weblet.runtime}`);
      console.log("");
    }

    if (showAll && invalidWeblets.length > 0) {
      console.log(`Invalid weblets (${invalidWeblets.length}):\n`);
      for (const weblet of invalidWeblets) {
        console.log(`  ${weblet.relativePath}`);
        console.log(`    Error: ${weblet.error}`);
        console.log("");
      }
    }

    // Print summary
    if (validWeblets.length > 0) {
      printInfo(`Run 'weblet run <path>' to start a weblet`);
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// =============================================================================
// Discovery
// =============================================================================

interface DiscoveryOptions {
  recursive?: boolean;
  maxDepth?: number;
  includeInvalid?: boolean;
}

/**
 * Discover weblets in a directory.
 */
async function discoverWeblets(
  searchPath: string,
  options: DiscoveryOptions = {}
): Promise<DiscoveredWeblet[]> {
  const { recursive = false, maxDepth = 1, includeInvalid = false } = options;
  const weblets: DiscoveredWeblet[] = [];
  const baseDir = searchPath;

  async function scanDir(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    // Check if this directory is a weblet
    const appMdPath = join(dir, "APP.md");
    if (existsSync(appMdPath)) {
      const weblet = await loadWebletInfo(dir, baseDir);
      if (weblet.valid || includeInvalid) {
        weblets.push(weblet);
      }
      // Don't recurse into weblet directories (they are self-contained)
      return;
    }

    // Scan subdirectories if recursive
    if (!recursive && depth > 0) return;

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden directories and common non-weblet directories
        if (entry.name.startsWith(".")) continue;
        if (["node_modules", "vendor", "dist", "build", ".data", ".userdata"].includes(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDir(join(dir, entry.name), depth + 1);
        }
      }
    } catch {
      // Ignore directories we can't read
    }
  }

  await scanDir(searchPath, 0);

  // Sort by name
  weblets.sort((a, b) => a.name.localeCompare(b.name));

  return weblets;
}

/**
 * Load weblet info from directory.
 */
async function loadWebletInfo(
  webletPath: string,
  baseDir: string
): Promise<DiscoveredWeblet> {
  const appMdPath = join(webletPath, "APP.md");
  const relativePath = relative(baseDir, webletPath) || ".";

  try {
    const manifest = await parseManifest(appMdPath);

    return {
      path: webletPath,
      relativePath,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      runtime: manifest.runtime,
      valid: true,
    };
  } catch (error) {
    return {
      path: webletPath,
      relativePath,
      name: basename(webletPath),
      description: "",
      version: "",
      runtime: "",
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
