/**
 * Vendor Command
 *
 * Downloads and vendors ESM packages from CDN.
 * Based on cli.spec.md and dependencies.spec.md
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import { printError, printInfo, printSuccess, printWarning } from "../index.ts";
import {
  vendorPackage,
  getVendoredPackages,
  parsePackageSpec,
  DependencyError,
} from "../../dependencies/index.ts";

// =============================================================================
// Command
// =============================================================================

export async function vendorCommand(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  // Check for list mode
  if (flags.list || flags.l) {
    return listVendoredPackages(flags);
  }

  // Get package spec
  const spec = args[0];
  if (!spec) {
    printError("No package specified");
    console.log("\nUsage: weblet vendor <package[@version]> [options]");
    console.log("\nExamples:");
    console.log("  weblet vendor lodash");
    console.log("  weblet vendor preact@10.19.0");
    console.log("  weblet vendor @preact/signals@1.2.0");
    console.log("\nOptions:");
    console.log("  --dir <path>    Vendor directory (default: vendor)");
    console.log("  --cdn <url>     CDN to use (default: https://esm.sh)");
    console.log("  --list, -l      List vendored packages");
    console.log("  --json          Output as JSON");
    process.exit(2);
  }

  // Parse options
  const dir = typeof flags.dir === "string" ? flags.dir : "vendor";
  const cdn = typeof flags.cdn === "string" ? flags.cdn : undefined;
  const jsonOutput = Boolean(flags.json);

  // Get root directory (current working directory or specified path)
  const root = args[1] ? join(process.cwd(), args[1]) : process.cwd();

  // Parse package spec for display
  const { name, version } = parsePackageSpec(spec);
  const displayName = version ? `${name}@${version}` : name;

  if (!jsonOutput) {
    printInfo(`Vendoring ${displayName}...`);
  }

  try {
    const result = await vendorPackage(spec, root, { dir, cdn });

    if (jsonOutput) {
      console.log(JSON.stringify({
        success: true,
        package: {
          name: result.name,
          version: result.version,
          path: result.path,
          size: result.size,
          source: result.source,
        },
      }, null, 2));
    } else {
      printSuccess(`Vendored ${result.name}@${result.version}`);
      console.log(`  Path: ${result.path}`);
      console.log(`  Size: ${formatBytes(result.size)}`);
      console.log(`  Source: ${result.source}`);
      console.log("");
      printInfo(`Add to your APP.md dependencies:`);
      console.log(`  dependencies:`);
      console.log(`    strategy: vendor`);
      console.log(`    vendor_dir: ${dir}`);
    }
  } catch (error) {
    if (error instanceof DependencyError) {
      if (jsonOutput) {
        console.log(JSON.stringify({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        }, null, 2));
      } else {
        printError(`${error.code}: ${error.message}`);
      }
      process.exit(3);
    }

    if (jsonOutput) {
      console.log(JSON.stringify({
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      }, null, 2));
    } else {
      printError(error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

/**
 * List vendored packages.
 */
async function listVendoredPackages(
  flags: Record<string, string | boolean>
): Promise<void> {
  const dir = typeof flags.dir === "string" ? flags.dir : "vendor";
  const jsonOutput = Boolean(flags.json);
  const root = process.cwd();

  const vendorPath = join(root, dir);

  if (!existsSync(vendorPath)) {
    if (jsonOutput) {
      console.log(JSON.stringify({ packages: [] }, null, 2));
    } else {
      printWarning(`No vendor directory found at ${dir}/`);
      printInfo("Use 'weblet vendor <package>' to vendor a package");
    }
    return;
  }

  try {
    const packages = await getVendoredPackages(root, dir);

    if (jsonOutput) {
      console.log(JSON.stringify({
        packages: packages.map((p) => ({
          name: p.name,
          version: p.version,
          path: p.path,
          source: p.source,
        })),
      }, null, 2));
      return;
    }

    if (packages.length === 0) {
      printWarning("No vendored packages found");
      printInfo("Use 'weblet vendor <package>' to vendor a package");
      return;
    }

    console.log(`\nVendored packages (${packages.length}):\n`);

    for (const pkg of packages) {
      console.log(`  ${pkg.name}@${pkg.version}`);
      console.log(`    Source: ${pkg.source}`);
    }

    console.log("");
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Format bytes as human readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
