/**
 * Run Command
 *
 * Starts a weblet server.
 * Based on cli.spec.md and runtime.spec.md
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import { printError, printInfo, printSuccess } from "../index.ts";
import { runWeblet } from "../../runtime/index.ts";

// =============================================================================
// Command
// =============================================================================

export async function runCommand(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  // Get path (default to current directory)
  const inputPath = args[0] ?? ".";
  const targetPath = join(process.cwd(), inputPath);

  // Check if path exists
  if (!existsSync(targetPath)) {
    printError(`Path does not exist: ${inputPath}`);
    process.exit(3);
  }

  // Check for APP.md
  const appMdPath = join(targetPath, "APP.md");
  if (!existsSync(appMdPath)) {
    printError(`No APP.md found in ${inputPath}`);
    printInfo("Run 'weblet init' to create a new weblet.");
    process.exit(3);
  }

  // Parse options
  const port = flags.port
    ? parseInt(String(flags.port), 10)
    : undefined;

  const hostname = typeof flags.host === "string"
    ? flags.host
    : typeof flags.hostname === "string"
    ? flags.hostname
    : "localhost";

  const open = Boolean(flags.open || flags.o);
  const dev = flags.prod ? false : true;
  const spaFallback = flags["no-spa"] ? false : true;

  // Validate port
  if (port !== undefined && (isNaN(port) || port < 1 || port > 65535)) {
    printError(`Invalid port: ${flags.port}`);
    process.exit(4);
  }

  try {
    // Print startup message
    printInfo(`Starting weblet from ${inputPath}...`);

    // Run the weblet
    await runWeblet(inputPath, {
      port,
      hostname,
      open,
      dev,
      spaFallback,
    });

    // This will only be reached if the server stops gracefully
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Port") && error.message.includes("in use")) {
        printError(error.message);
        process.exit(4);
      }
      printError(error.message);
    } else {
      printError(String(error));
    }
    process.exit(1);
  }
}
