#!/usr/bin/env node
/**
 * Weblet CLI
 *
 * Command-line interface for managing Weblets.
 * Based on cli.spec.md
 */

import { validateCommand } from "./commands/validate.ts";
import { infoCommand } from "./commands/info.ts";
import { initCommand } from "./commands/init.ts";
import { runCommand } from "./commands/run.ts";
import { vendorCommand } from "./commands/vendor.ts";
import { listCommand } from "./commands/list.ts";

// =============================================================================
// Types
// =============================================================================

interface ParsedArgs {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

// =============================================================================
// Constants
// =============================================================================

const VERSION = "0.1.0";

const HELP_TEXT = `
weblet - Weblet CLI

Usage: weblet <command> [options]

Commands:
  run [path]          Run a weblet server
  validate <path>     Validate an APP.md manifest
  info <path>         Display manifest information
  init [path]         Create a new weblet
  vendor <package>    Vendor a dependency from CDN
  list [path]         List discovered weblets

Options:
  --help, -h          Show help
  --version, -v       Show version
  --json              Output as JSON (where supported)

Run Options:
  --port <port>       Port to run on (default: 3000)
  --host <hostname>   Hostname to bind (default: localhost)
  --open, -o          Open browser on start
  --prod              Run in production mode
  --no-spa            Disable SPA fallback

Vendor Options:
  --dir <path>        Vendor directory (default: vendor)
  --cdn <url>         CDN to use (default: https://esm.sh)
  --list, -l          List vendored packages

List Options:
  --recursive, -r     Search recursively
  --depth <n>         Max depth for recursive search
  --all, -a           Include invalid weblets

Examples:
  weblet run ./my-app
  weblet run ./my-app --port 8080 --open
  weblet validate ./my-app
  weblet info ./my-app --json
  weblet init my-new-app --runtime bun
  weblet vendor lodash@4.17.21
  weblet list --recursive
`.trim();

// =============================================================================
// Argument Parsing
// =============================================================================

function parseArgs(argv: string[]): ParsedArgs {
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];

      // Check if next arg is a value (not another flag)
      if (nextArg && !nextArg.startsWith("-")) {
        flags[key] = nextArg;
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      // Short flag
      const key = arg.slice(1);
      flags[key] = true;
      i += 1;
    } else {
      args.push(arg);
      i += 1;
    }
  }

  const command = args[0] ?? "";
  const commandArgs = args.slice(1);

  return { command, args: commandArgs, flags };
}

// =============================================================================
// Output Helpers
// =============================================================================

export function printError(message: string): void {
  console.error(`\x1b[31mError:\x1b[0m ${message}`);
}

export function printSuccess(message: string): void {
  console.log(`\x1b[32m✓\x1b[0m ${message}`);
}

export function printWarning(message: string): void {
  console.log(`\x1b[33m⚠\x1b[0m ${message}`);
}

export function printInfo(message: string): void {
  console.log(`\x1b[36mℹ\x1b[0m ${message}`);
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const { command, args, flags } = parseArgs(process.argv.slice(2));

  // Handle global flags
  if (flags.version || flags.v) {
    console.log(VERSION);
    process.exit(0);
  }

  if (flags.help || flags.h || command === "" || command === "help") {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  // Route to command
  try {
    switch (command) {
      case "validate":
        await validateCommand(args, flags);
        break;

      case "info":
        await infoCommand(args, flags);
        break;

      case "init":
        await initCommand(args, flags);
        break;

      case "run":
        await runCommand(args, flags);
        break;

      case "vendor":
        await vendorCommand(args, flags);
        break;

      case "list":
      case "ls":
      case "discover":
        await listCommand(args, flags);
        break;

      default:
        printError(`Unknown command: ${command}`);
        console.log("\nRun 'weblet --help' for usage information.");
        process.exit(2);
    }
  } catch (error) {
    if (error instanceof Error) {
      printError(error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
    } else {
      printError(String(error));
    }
    process.exit(1);
  }
}

// Run if executed directly
main();
