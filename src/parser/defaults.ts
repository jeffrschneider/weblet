/**
 * Weblet Parser Defaults
 *
 * Default values for optional manifest fields.
 * Based on Weblet Specification v1.0.0, Section 4.3
 */

import type {
  RawManifest,
  ParsedManifest,
  Runtime,
  DependencyStrategy,
} from "./schema.ts";

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULTS = {
  runtime: "browser" as Runtime,
  entry: "index.html",
  port: 3000,
  version: "0.0.0",
  spec: "1.0",
  dependencies: {
    strategy: "url" as DependencyStrategy,
  },
} as const;

// =============================================================================
// Apply Defaults
// =============================================================================

/**
 * Apply default values to a raw manifest to produce a complete ParsedManifest.
 *
 * Required fields (name, description) must be present - this function
 * does not provide defaults for them.
 *
 * @param raw - The raw manifest parsed from YAML frontmatter
 * @param body - The markdown body content
 * @returns Complete manifest with defaults applied
 */
export function applyDefaults(raw: RawManifest, body: string): ParsedManifest {
  // Required fields - these will be validated elsewhere
  const name = raw.name ?? "";
  const description = raw.description ?? "";

  // Runtime configuration
  const runtime = raw.runtime ?? DEFAULTS.runtime;
  const entry = raw.entry ?? DEFAULTS.entry;
  const port = raw.port ?? DEFAULTS.port;

  // Versioning
  const version = raw.version ?? DEFAULTS.version;
  const spec = raw.spec ?? DEFAULTS.spec;

  // Dependencies with nested defaults
  const dependencies = raw.dependencies
    ? {
        strategy: raw.dependencies.strategy ?? DEFAULTS.dependencies.strategy,
        imports: raw.dependencies.imports,
        vendor_dir: raw.dependencies.vendor_dir,
        package_manager: raw.dependencies.package_manager,
      }
    : undefined;

  // Construct the complete manifest
  const manifest: ParsedManifest = {
    // Required
    name,
    description,

    // Runtime
    runtime,
    entry,
    port,

    // Versioning
    version,
    spec,

    // Markdown body
    body,
  };

  // Optional fields - only include if present in raw manifest
  if (raw.server !== undefined) manifest.server = raw.server;
  if (raw.author !== undefined) manifest.author = raw.author;
  if (raw.license !== undefined) manifest.license = raw.license;
  if (raw.repository !== undefined) manifest.repository = raw.repository;
  if (raw.homepage !== undefined) manifest.homepage = raw.homepage;
  if (raw.keywords !== undefined) manifest.keywords = raw.keywords;
  if (raw.category !== undefined) manifest.category = raw.category;
  if (raw.tags !== undefined) manifest.tags = raw.tags;
  if (raw.display !== undefined) manifest.display = raw.display;
  if (raw.icon !== undefined) manifest.icon = raw.icon;
  if (raw.screenshots !== undefined) manifest.screenshots = raw.screenshots;
  if (raw.accessibility !== undefined) manifest.accessibility = raw.accessibility;
  if (raw.i18n !== undefined) manifest.i18n = raw.i18n;
  if (raw.description_i18n !== undefined) manifest.description_i18n = raw.description_i18n;
  if (dependencies !== undefined) manifest.dependencies = dependencies;
  if (raw.storage !== undefined) manifest.storage = raw.storage;
  if (raw.capabilities !== undefined) manifest.capabilities = raw.capabilities;
  if (raw.uses !== undefined) manifest.uses = raw.uses;
  if (raw.provides !== undefined) manifest.provides = raw.provides;
  if (raw.env !== undefined) manifest.env = raw.env;
  if (raw.secrets !== undefined) manifest.secrets = raw.secrets;
  if (raw.agent !== undefined) manifest.agent = raw.agent;

  return manifest;
}

// =============================================================================
// Default Manifest (for init command)
// =============================================================================

export interface InitOptions {
  name: string;
  description?: string;
  runtime?: Runtime;
}

/**
 * Create a default manifest for the `weblet init` command.
 */
export function createDefaultManifest(options: InitOptions): ParsedManifest {
  const runtime = options.runtime ?? DEFAULTS.runtime;

  return {
    name: options.name,
    description: options.description ?? `A Weblet application`,
    runtime,
    entry: DEFAULTS.entry,
    port: DEFAULTS.port,
    version: "1.0.0",
    spec: DEFAULTS.spec,
    body: `# ${options.name}\n\n${options.description ?? "A Weblet application."}\n`,
  };
}
