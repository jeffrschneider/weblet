/**
 * weblet validate command
 *
 * Validates an APP.md manifest against the Weblet specification.
 */

import { resolve } from "node:path";
import { existsSync } from "node:fs";

import { parseFile, ParserError, ValidationError } from "../../parser/index.ts";
import { printError, printSuccess, printWarning } from "../index.ts";

// =============================================================================
// Types
// =============================================================================

interface ValidateFlags {
  json?: boolean;
  strict?: boolean;
  [key: string]: string | boolean | undefined;
}

interface ValidationOutput {
  valid: boolean;
  path: string;
  errors: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
  warnings: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
}

// =============================================================================
// Help
// =============================================================================

const HELP = `
weblet validate - Validate an APP.md manifest

Usage: weblet validate <path> [options]

Arguments:
  path              Path to weblet directory or APP.md file

Options:
  --json            Output results as JSON
  --strict          Treat warnings as errors
  --help            Show this help

Examples:
  weblet validate ./my-app
  weblet validate ./my-app/APP.md --json
  weblet validate ./my-app --strict

Exit codes:
  0  Valid manifest
  1  General error
  3  Validation failed
`.trim();

// =============================================================================
// Command
// =============================================================================

export async function validateCommand(
  args: string[],
  flags: ValidateFlags
): Promise<void> {
  // Show help
  if (flags.help) {
    console.log(HELP);
    return;
  }

  // Check for path argument
  if (args.length === 0) {
    printError("Missing path argument");
    console.log("\nUsage: weblet validate <path>");
    process.exit(2);
  }

  const inputPath = args[0];
  const targetPath = resolve(inputPath);

  // Check path exists
  if (!existsSync(targetPath)) {
    printError(`Path not found: ${targetPath}`);
    process.exit(1);
  }

  try {
    // Parse and validate
    const result = await parseFile(targetPath, {
      validate: true,
      throwOnError: false,
    });

    const output: ValidationOutput = {
      valid: result.validation.valid,
      path: targetPath,
      errors: result.validation.errors.map((e) => ({
        code: e.code,
        message: e.message,
        field: e.field,
      })),
      warnings: result.validation.warnings.map((w) => ({
        code: w.code,
        message: w.message,
        field: w.field,
      })),
    };

    // Handle strict mode
    if (flags.strict && output.warnings.length > 0) {
      output.valid = false;
    }

    // JSON output
    if (flags.json) {
      console.log(JSON.stringify(output, null, 2));
      process.exit(output.valid ? 0 : 3);
      return;
    }

    // Human-readable output
    if (output.errors.length > 0) {
      console.log("\nErrors:");
      for (const error of output.errors) {
        console.log(`  \x1b[31m✗\x1b[0m [${error.code}] ${error.message}`);
        if (error.field) {
          console.log(`    Field: ${error.field}`);
        }
      }
    }

    if (output.warnings.length > 0) {
      console.log("\nWarnings:");
      for (const warning of output.warnings) {
        console.log(`  \x1b[33m⚠\x1b[0m [${warning.code}] ${warning.message}`);
        if (warning.field) {
          console.log(`    Field: ${warning.field}`);
        }
      }
    }

    if (output.valid) {
      console.log("");
      printSuccess(`${result.manifest.name} is valid`);
      process.exit(0);
    } else {
      console.log("");
      printError("Validation failed");
      process.exit(3);
    }
  } catch (error) {
    if (error instanceof ParserError) {
      if (flags.json) {
        console.log(
          JSON.stringify(
            {
              valid: false,
              path: targetPath,
              errors: [{ code: error.code, message: error.message }],
              warnings: [],
            },
            null,
            2
          )
        );
      } else {
        printError(`[${error.code}] ${error.message}`);
      }
      process.exit(3);
    }

    throw error;
  }
}
