/**
 * Weblet APP.md Parser
 *
 * Parses APP.md manifest files with YAML frontmatter and Markdown body.
 * Based on Weblet Specification v1.0.0
 */

import { parse as parseYaml } from "yaml";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  ParsedManifest,
  RawManifest,
  ParserOptions,
  ParserResult,
  ValidationResult,
} from "./schema.ts";

import { applyDefaults } from "./defaults.ts";
import {
  validateRawManifest,
  validateManifest,
  combineValidationResults,
} from "./validate.ts";

import { ParserError, ValidationError } from "./schema.ts";

// =============================================================================
// Re-exports
// =============================================================================

export * from "./schema.ts";
export * from "./defaults.ts";
export {
  validateRawManifest,
  validateManifest,
  combineValidationResults,
  ErrorCodes,
} from "./validate.ts";

// =============================================================================
// Constants
// =============================================================================

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const APP_MD_FILENAME = "APP.md";

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_OPTIONS: Required<ParserOptions> = {
  applyDefaults: true,
  validate: true,
  throwOnError: false,
};

// =============================================================================
// Extract Frontmatter
// =============================================================================

interface ExtractedContent {
  frontmatter: string;
  body: string;
}

/**
 * Extract YAML frontmatter and Markdown body from APP.md content.
 */
function extractFrontmatter(content: string): ExtractedContent {
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    throw new ParserError(
      "E002",
      "Invalid APP.md format: missing or malformed YAML frontmatter. Expected format:\n---\nname: ...\n---\n# Content"
    );
  }

  return {
    frontmatter: match[1],
    body: match[2].trim(),
  };
}

// =============================================================================
// Parse YAML
// =============================================================================

/**
 * Parse YAML frontmatter string into a RawManifest object.
 */
function parseFrontmatter(yaml: string): RawManifest {
  try {
    const parsed = parseYaml(yaml);

    if (parsed === null || parsed === undefined) {
      return {};
    }

    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ParserError(
        "E002",
        "Invalid YAML frontmatter: must be an object (key-value pairs)"
      );
    }

    return parsed as RawManifest;
  } catch (error) {
    if (error instanceof ParserError) {
      throw error;
    }
    throw new ParserError(
      "E002",
      `Failed to parse YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// =============================================================================
// Parse Content (String)
// =============================================================================

/**
 * Parse APP.md content string into a manifest.
 *
 * @param content - The raw content of APP.md file
 * @param options - Parser options
 * @returns Parser result with manifest and validation
 */
export function parseContent(
  content: string,
  options: ParserOptions = {}
): ParserResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Extract frontmatter and body
  const { frontmatter, body } = extractFrontmatter(content);

  // Parse YAML
  const raw = parseFrontmatter(frontmatter);

  // Validate raw manifest
  let rawValidation: ValidationResult = { valid: true, errors: [], warnings: [] };
  if (opts.validate) {
    rawValidation = validateRawManifest(raw);

    if (opts.throwOnError && !rawValidation.valid) {
      throw new ValidationError(rawValidation.errors);
    }
  }

  // Apply defaults
  const manifest = opts.applyDefaults
    ? applyDefaults(raw, body)
    : applyDefaults(raw, body); // Always need to apply at least structure

  // Validate final manifest
  let manifestValidation: ValidationResult = { valid: true, errors: [], warnings: [] };
  if (opts.validate) {
    manifestValidation = validateManifest(manifest);
  }

  // Combine validation results
  const validation = opts.validate
    ? combineValidationResults(rawValidation, manifestValidation)
    : { valid: true, errors: [], warnings: [] };

  if (opts.throwOnError && !validation.valid) {
    throw new ValidationError(validation.errors);
  }

  return { manifest, validation };
}

// =============================================================================
// Parse File
// =============================================================================

/**
 * Parse an APP.md file from the filesystem.
 *
 * @param path - Path to APP.md file or directory containing APP.md
 * @param options - Parser options
 * @returns Parser result with manifest and validation
 */
export async function parseFile(
  path: string,
  options: ParserOptions = {}
): Promise<ParserResult> {
  // Resolve path
  let filePath = resolve(path);

  // If path is a directory, look for APP.md inside
  try {
    const stats = await import("node:fs").then((fs) =>
      fs.promises.stat(filePath)
    );
    if (stats.isDirectory()) {
      filePath = resolve(filePath, APP_MD_FILENAME);
    }
  } catch {
    // Path doesn't exist, will be caught below
  }

  // Read file
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ParserError(
        "E001",
        `APP.md not found at ${filePath}`,
        { path: filePath }
      );
    }
    throw new ParserError(
      "E001",
      `Failed to read APP.md: ${error instanceof Error ? error.message : String(error)}`,
      { path: filePath }
    );
  }

  return parseContent(content, options);
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Parse an APP.md file and return just the manifest.
 * Throws on validation errors.
 *
 * @param path - Path to APP.md file or directory containing APP.md
 * @returns Parsed manifest
 */
export async function parseManifest(path: string): Promise<ParsedManifest> {
  const result = await parseFile(path, { throwOnError: true });
  return result.manifest;
}

/**
 * Validate an APP.md file without fully parsing it.
 *
 * @param path - Path to APP.md file or directory containing APP.md
 * @returns Validation result
 */
export async function validateFile(path: string): Promise<ValidationResult> {
  const result = await parseFile(path, { validate: true, throwOnError: false });
  return result.validation;
}

/**
 * Check if a path contains a valid APP.md file.
 *
 * @param path - Path to check
 * @returns True if valid APP.md exists
 */
export async function isValidWeblet(path: string): Promise<boolean> {
  try {
    const result = await validateFile(path);
    return result.valid;
  } catch {
    return false;
  }
}

// =============================================================================
// Serialization
// =============================================================================

/**
 * Serialize a manifest back to APP.md format.
 *
 * @param manifest - The manifest to serialize
 * @returns APP.md content string
 */
export function serializeManifest(manifest: ParsedManifest): string {
  const { body, ...frontmatterData } = manifest;

  // Remove undefined values
  const cleanData = Object.fromEntries(
    Object.entries(frontmatterData).filter(([_, v]) => v !== undefined)
  );

  // Import yaml stringify
  const { stringify } = require("yaml");
  const yaml = stringify(cleanData, { indent: 2 });

  return `---\n${yaml}---\n\n${body}`;
}
