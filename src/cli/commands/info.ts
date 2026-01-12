/**
 * weblet info command
 *
 * Displays information about a weblet's APP.md manifest.
 */

import { resolve } from "node:path";
import { existsSync } from "node:fs";

import { parseFile, ParserError, type ParsedManifest } from "../../parser/index.ts";
import { printError } from "../index.ts";

// =============================================================================
// Types
// =============================================================================

interface InfoFlags {
  json?: boolean;
  full?: boolean;
  [key: string]: string | boolean | undefined;
}

// =============================================================================
// Help
// =============================================================================

const HELP = `
weblet info - Display weblet information

Usage: weblet info <path> [options]

Arguments:
  path              Path to weblet directory or APP.md file

Options:
  --json            Output as JSON
  --full            Include markdown body in output
  --help            Show this help

Examples:
  weblet info ./my-app
  weblet info ./my-app --json
  weblet info ./my-app --full
`.trim();

// =============================================================================
// Formatting Helpers
// =============================================================================

function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "\x1b[90m(not set)\x1b[0m";
  }
  if (typeof value === "boolean") {
    return value ? "\x1b[32mtrue\x1b[0m" : "\x1b[31mfalse\x1b[0m";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "\x1b[90m(empty)\x1b[0m";
    return value.join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function printSection(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
  console.log("─".repeat(40));
}

function printField(label: string, value: unknown, indent = 0): void {
  const padding = "  ".repeat(indent);
  const formattedLabel = `${padding}\x1b[36m${label}:\x1b[0m`;
  console.log(`${formattedLabel} ${formatValue(value)}`);
}

// =============================================================================
// Display Functions
// =============================================================================

function displayManifest(manifest: ParsedManifest, showFull: boolean): void {
  // Header
  console.log(`\n\x1b[1m${manifest.name}\x1b[0m v${manifest.version}`);
  console.log(`\x1b[90m${manifest.description}\x1b[0m`);

  // Core
  printSection("Core");
  printField("Runtime", manifest.runtime);
  printField("Entry", manifest.entry);
  if (manifest.server) printField("Server", manifest.server);
  printField("Port", manifest.port);
  printField("Spec Version", manifest.spec);

  // Metadata
  if (manifest.author || manifest.license || manifest.repository) {
    printSection("Metadata");
    if (manifest.author) {
      if (typeof manifest.author === "string") {
        printField("Author", manifest.author);
      } else {
        printField("Author", manifest.author.name);
        if (manifest.author.email) printField("Email", manifest.author.email, 1);
        if (manifest.author.url) printField("URL", manifest.author.url, 1);
      }
    }
    if (manifest.license) printField("License", manifest.license);
    if (manifest.repository) printField("Repository", manifest.repository);
    if (manifest.homepage) printField("Homepage", manifest.homepage);
  }

  // Categorization
  if (manifest.category || manifest.tags?.length || manifest.keywords?.length) {
    printSection("Categorization");
    if (manifest.category) printField("Category", manifest.category);
    if (manifest.tags?.length) printField("Tags", manifest.tags);
    if (manifest.keywords?.length) printField("Keywords", manifest.keywords);
  }

  // Display
  if (manifest.display) {
    printSection("Display");
    if (manifest.display.width) printField("Width", manifest.display.width);
    if (manifest.display.height) printField("Height", manifest.display.height);
    if (manifest.display.resizable !== undefined)
      printField("Resizable", manifest.display.resizable);
    if (manifest.display.orientation)
      printField("Orientation", manifest.display.orientation);
  }

  // Dependencies
  if (manifest.dependencies) {
    printSection("Dependencies");
    printField("Strategy", manifest.dependencies.strategy);
    if (manifest.dependencies.imports) {
      const importCount = Object.keys(manifest.dependencies.imports).length;
      printField("Imports", `${importCount} package(s)`);
      for (const [name, url] of Object.entries(manifest.dependencies.imports)) {
        console.log(`    \x1b[90m${name}:\x1b[0m ${url}`);
      }
    }
    if (manifest.dependencies.vendor_dir) {
      printField("Vendor Dir", manifest.dependencies.vendor_dir);
    }
  }

  // Storage
  if (manifest.storage) {
    printSection("Storage");
    if (manifest.storage.app_state) {
      printField("App State", manifest.storage.app_state.enabled ?? true);
      if (manifest.storage.app_state.max_size) {
        printField("Max Size", manifest.storage.app_state.max_size, 1);
      }
    }
    if (manifest.storage.user_data) {
      printField("User Data", manifest.storage.user_data.enabled ?? true);
      if (manifest.storage.user_data.max_size) {
        printField("Max Size", manifest.storage.user_data.max_size, 1);
      }
    }
    if (manifest.storage.persist?.length) {
      printField("Persist", manifest.storage.persist);
    }
  }

  // Skills
  if (manifest.uses?.length || manifest.provides?.length) {
    printSection("Skills");
    if (manifest.uses?.length) printField("Uses", manifest.uses);
    if (manifest.provides?.length) printField("Provides", manifest.provides);
  }

  // Agent
  if (manifest.agent) {
    printSection("Agent Integration");
    printField("Discoverable", manifest.agent.discoverable);
    printField("Launchable", manifest.agent.launchable);
    if (manifest.agent.triggers?.length) {
      printField("Triggers", `${manifest.agent.triggers.length} trigger(s)`);
      for (const trigger of manifest.agent.triggers.slice(0, 3)) {
        console.log(`    \x1b[90m• ${trigger}\x1b[0m`);
      }
      if (manifest.agent.triggers.length > 3) {
        console.log(`    \x1b[90m... and ${manifest.agent.triggers.length - 3} more\x1b[0m`);
      }
    }
    if (manifest.agent.provides?.length) {
      printField("Provides", manifest.agent.provides);
    }
  }

  // Accessibility
  if (manifest.accessibility) {
    printSection("Accessibility");
    const a11y = manifest.accessibility;
    if (a11y.high_contrast !== undefined)
      printField("High Contrast", a11y.high_contrast);
    if (a11y.reduced_motion !== undefined)
      printField("Reduced Motion", a11y.reduced_motion);
    if (a11y.keyboard_nav !== undefined)
      printField("Keyboard Nav", a11y.keyboard_nav);
    if (a11y.screen_reader !== undefined)
      printField("Screen Reader", a11y.screen_reader);
  }

  // i18n
  if (manifest.i18n) {
    printSection("Internationalization");
    printField("Default Locale", manifest.i18n.default_locale);
    if (manifest.i18n.supported_locales?.length) {
      printField("Supported", manifest.i18n.supported_locales);
    }
    if (manifest.i18n.locales_dir) {
      printField("Locales Dir", manifest.i18n.locales_dir);
    }
  }

  // Body (if full mode)
  if (showFull && manifest.body) {
    printSection("Description (Markdown)");
    console.log(manifest.body);
  }

  console.log("");
}

// =============================================================================
// Command
// =============================================================================

export async function infoCommand(
  args: string[],
  flags: InfoFlags
): Promise<void> {
  // Show help
  if (flags.help) {
    console.log(HELP);
    return;
  }

  // Check for path argument
  if (args.length === 0) {
    printError("Missing path argument");
    console.log("\nUsage: weblet info <path>");
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
    const result = await parseFile(targetPath, {
      validate: false,
      throwOnError: false,
    });

    // JSON output
    if (flags.json) {
      const output = flags.full
        ? result.manifest
        : { ...result.manifest, body: undefined };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // Human-readable output
    displayManifest(result.manifest, Boolean(flags.full));
  } catch (error) {
    if (error instanceof ParserError) {
      printError(`[${error.code}] ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}
