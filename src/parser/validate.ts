/**
 * Weblet Parser Validation
 *
 * Validates APP.md manifests against the Weblet Specification.
 * Based on cli.spec.md validation requirements (FR-PARSE-003 through FR-PARSE-008)
 */

import type {
  ParsedManifest,
  RawManifest,
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
  Runtime,
  DependencyStrategy,
  PackageManager,
  Orientation,
} from "./schema.ts";

// =============================================================================
// Validation Error Codes
// =============================================================================

export const ErrorCodes = {
  // Required fields
  MISSING_NAME: "E003",
  MISSING_DESCRIPTION: "E003",

  // Invalid values
  INVALID_RUNTIME: "E004",
  INVALID_VERSION: "E008",
  INVALID_DEPENDENCY_STRATEGY: "E004",
  INVALID_PACKAGE_MANAGER: "E004",
  INVALID_PORT: "E004",
  INVALID_ORIENTATION: "E004",

  // Type errors
  INVALID_TYPE: "E004",
  INVALID_ARRAY: "E004",
  INVALID_OBJECT: "E004",

  // Warnings
  MISSING_VERSION: "W001",
  EMPTY_KEYWORDS: "W002",
  EMPTY_TAGS: "W003",
} as const;

// =============================================================================
// Allowed Values
// =============================================================================

const ALLOWED_RUNTIMES: Runtime[] = ["browser", "bun", "deno", "node"];
const ALLOWED_STRATEGIES: DependencyStrategy[] = ["url", "vendor", "install"];
const ALLOWED_PACKAGE_MANAGERS: PackageManager[] = ["bun", "npm", "pnpm", "yarn"];
const ALLOWED_ORIENTATIONS: Orientation[] = ["any", "portrait", "landscape"];

// =============================================================================
// Semver Validation
// =============================================================================

const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function isValidSemver(version: string): boolean {
  return SEMVER_REGEX.test(version);
}

// =============================================================================
// Skill Dependency Validation
// =============================================================================

const SKILL_DEP_REGEX = /^[a-z][a-z0-9-]*(@[\^~>=<]?\d+\.\d+\.\d+)?$/;

function isValidSkillDependency(dep: string): boolean {
  return SKILL_DEP_REGEX.test(dep);
}

// =============================================================================
// URL Validation
// =============================================================================

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// =============================================================================
// Validation Builder
// =============================================================================

class ValidationBuilder {
  private errors: ValidationIssue[] = [];
  private warnings: ValidationIssue[] = [];

  addIssue(
    severity: ValidationSeverity,
    code: string,
    message: string,
    field?: string,
    value?: unknown
  ): void {
    const issue: ValidationIssue = { severity, code, message, field, value };
    if (severity === "error") {
      this.errors.push(issue);
    } else {
      this.warnings.push(issue);
    }
  }

  error(code: string, message: string, field?: string, value?: unknown): void {
    this.addIssue("error", code, message, field, value);
  }

  warning(code: string, message: string, field?: string, value?: unknown): void {
    this.addIssue("warning", code, message, field, value);
  }

  build(): ValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }
}

// =============================================================================
// Validate Raw Manifest (Before Defaults)
// =============================================================================

/**
 * Validate a raw manifest before defaults are applied.
 * This catches errors in user-provided values.
 */
export function validateRawManifest(raw: RawManifest): ValidationResult {
  const v = new ValidationBuilder();

  // ==========================================================================
  // Required Fields
  // ==========================================================================

  if (raw.name === undefined || raw.name === null || raw.name === "") {
    v.error(ErrorCodes.MISSING_NAME, "Missing required field: name", "name");
  } else if (typeof raw.name !== "string") {
    v.error(ErrorCodes.INVALID_TYPE, "Field 'name' must be a string", "name", raw.name);
  }

  if (raw.description === undefined || raw.description === null || raw.description === "") {
    v.error(ErrorCodes.MISSING_DESCRIPTION, "Missing required field: description", "description");
  } else if (typeof raw.description !== "string") {
    v.error(ErrorCodes.INVALID_TYPE, "Field 'description' must be a string", "description", raw.description);
  }

  // ==========================================================================
  // Runtime (FR-PARSE-005)
  // ==========================================================================

  if (raw.runtime !== undefined) {
    if (!ALLOWED_RUNTIMES.includes(raw.runtime as Runtime)) {
      v.error(
        ErrorCodes.INVALID_RUNTIME,
        `Invalid runtime: ${raw.runtime}. Allowed: ${ALLOWED_RUNTIMES.join(", ")}`,
        "runtime",
        raw.runtime
      );
    }
  }

  // ==========================================================================
  // Version (FR-PARSE-006)
  // ==========================================================================

  if (raw.version !== undefined) {
    if (typeof raw.version !== "string") {
      v.error(ErrorCodes.INVALID_TYPE, "Field 'version' must be a string", "version", raw.version);
    } else if (!isValidSemver(raw.version)) {
      v.error(
        ErrorCodes.INVALID_VERSION,
        `Invalid version format: ${raw.version}. Must be valid semver (e.g., 1.0.0)`,
        "version",
        raw.version
      );
    }
  } else {
    v.warning(ErrorCodes.MISSING_VERSION, "Missing version field, defaulting to 0.0.0", "version");
  }

  // ==========================================================================
  // Port
  // ==========================================================================

  if (raw.port !== undefined) {
    if (typeof raw.port !== "number" || !Number.isInteger(raw.port)) {
      v.error(ErrorCodes.INVALID_TYPE, "Field 'port' must be an integer", "port", raw.port);
    } else if (raw.port < 1 || raw.port > 65535) {
      v.error(ErrorCodes.INVALID_PORT, `Invalid port: ${raw.port}. Must be 1-65535`, "port", raw.port);
    }
  }

  // ==========================================================================
  // Entry and Server
  // ==========================================================================

  if (raw.entry !== undefined && typeof raw.entry !== "string") {
    v.error(ErrorCodes.INVALID_TYPE, "Field 'entry' must be a string", "entry", raw.entry);
  }

  if (raw.server !== undefined && typeof raw.server !== "string") {
    v.error(ErrorCodes.INVALID_TYPE, "Field 'server' must be a string", "server", raw.server);
  }

  // ==========================================================================
  // Dependencies (FR-PARSE-007)
  // ==========================================================================

  if (raw.dependencies !== undefined) {
    if (typeof raw.dependencies !== "object" || raw.dependencies === null) {
      v.error(ErrorCodes.INVALID_OBJECT, "Field 'dependencies' must be an object", "dependencies");
    } else {
      // Strategy validation
      if (raw.dependencies.strategy !== undefined) {
        if (!ALLOWED_STRATEGIES.includes(raw.dependencies.strategy as DependencyStrategy)) {
          v.error(
            ErrorCodes.INVALID_DEPENDENCY_STRATEGY,
            `Invalid dependency strategy: ${raw.dependencies.strategy}. Allowed: ${ALLOWED_STRATEGIES.join(", ")}`,
            "dependencies.strategy",
            raw.dependencies.strategy
          );
        }
      }

      // Package manager validation
      if (raw.dependencies.package_manager !== undefined) {
        if (!ALLOWED_PACKAGE_MANAGERS.includes(raw.dependencies.package_manager as PackageManager)) {
          v.error(
            ErrorCodes.INVALID_PACKAGE_MANAGER,
            `Invalid package manager: ${raw.dependencies.package_manager}. Allowed: ${ALLOWED_PACKAGE_MANAGERS.join(", ")}`,
            "dependencies.package_manager",
            raw.dependencies.package_manager
          );
        }
      }

      // Import URLs validation
      if (raw.dependencies.imports !== undefined) {
        if (typeof raw.dependencies.imports !== "object" || raw.dependencies.imports === null) {
          v.error(ErrorCodes.INVALID_OBJECT, "Field 'dependencies.imports' must be an object", "dependencies.imports");
        } else {
          for (const [key, url] of Object.entries(raw.dependencies.imports)) {
            if (typeof url !== "string") {
              v.error(ErrorCodes.INVALID_TYPE, `Import '${key}' must be a string URL`, `dependencies.imports.${key}`, url);
            } else if (!isValidHttpsUrl(url)) {
              v.error(
                ErrorCodes.INVALID_TYPE,
                `Import '${key}' must be a valid HTTPS URL`,
                `dependencies.imports.${key}`,
                url
              );
            }
          }
        }
      }
    }
  }

  // ==========================================================================
  // Uses (Skill Dependencies) (FR-PARSE-008)
  // ==========================================================================

  if (raw.uses !== undefined) {
    if (!Array.isArray(raw.uses)) {
      v.error(ErrorCodes.INVALID_ARRAY, "Field 'uses' must be an array", "uses", raw.uses);
    } else {
      raw.uses.forEach((dep, index) => {
        if (typeof dep !== "string") {
          v.error(ErrorCodes.INVALID_TYPE, `uses[${index}] must be a string`, `uses[${index}]`, dep);
        } else if (!isValidSkillDependency(dep)) {
          v.error(
            ErrorCodes.INVALID_TYPE,
            `Invalid skill dependency: ${dep}. Expected format: skill-name or skill-name@^1.0.0`,
            `uses[${index}]`,
            dep
          );
        }
      });
    }
  }

  // ==========================================================================
  // Display
  // ==========================================================================

  if (raw.display !== undefined) {
    if (typeof raw.display !== "object" || raw.display === null) {
      v.error(ErrorCodes.INVALID_OBJECT, "Field 'display' must be an object", "display");
    } else {
      if (raw.display.width !== undefined && (typeof raw.display.width !== "number" || raw.display.width <= 0)) {
        v.error(ErrorCodes.INVALID_TYPE, "display.width must be a positive number", "display.width", raw.display.width);
      }
      if (raw.display.height !== undefined && (typeof raw.display.height !== "number" || raw.display.height <= 0)) {
        v.error(ErrorCodes.INVALID_TYPE, "display.height must be a positive number", "display.height", raw.display.height);
      }
      if (raw.display.resizable !== undefined && typeof raw.display.resizable !== "boolean") {
        v.error(ErrorCodes.INVALID_TYPE, "display.resizable must be a boolean", "display.resizable", raw.display.resizable);
      }
      if (raw.display.orientation !== undefined && !ALLOWED_ORIENTATIONS.includes(raw.display.orientation as Orientation)) {
        v.error(
          ErrorCodes.INVALID_ORIENTATION,
          `Invalid orientation: ${raw.display.orientation}. Allowed: ${ALLOWED_ORIENTATIONS.join(", ")}`,
          "display.orientation",
          raw.display.orientation
        );
      }
    }
  }

  // ==========================================================================
  // Arrays (keywords, tags, screenshots, secrets)
  // ==========================================================================

  const arrayFields = ["keywords", "tags", "screenshots", "secrets", "provides"] as const;
  for (const field of arrayFields) {
    const value = raw[field];
    if (value !== undefined) {
      if (!Array.isArray(value)) {
        v.error(ErrorCodes.INVALID_ARRAY, `Field '${field}' must be an array`, field, value);
      } else if (value.length === 0 && (field === "keywords" || field === "tags")) {
        v.warning(
          field === "keywords" ? ErrorCodes.EMPTY_KEYWORDS : ErrorCodes.EMPTY_TAGS,
          `Field '${field}' is empty`,
          field
        );
      } else {
        value.forEach((item, index) => {
          if (typeof item !== "string") {
            v.error(ErrorCodes.INVALID_TYPE, `${field}[${index}] must be a string`, `${field}[${index}]`, item);
          }
        });
      }
    }
  }

  // ==========================================================================
  // Storage
  // ==========================================================================

  if (raw.storage !== undefined) {
    if (typeof raw.storage !== "object" || raw.storage === null) {
      v.error(ErrorCodes.INVALID_OBJECT, "Field 'storage' must be an object", "storage");
    } else {
      // Validate app_state
      if (raw.storage.app_state !== undefined) {
        if (typeof raw.storage.app_state !== "object" || raw.storage.app_state === null) {
          v.error(ErrorCodes.INVALID_OBJECT, "storage.app_state must be an object", "storage.app_state");
        } else {
          if (raw.storage.app_state.enabled !== undefined && typeof raw.storage.app_state.enabled !== "boolean") {
            v.error(ErrorCodes.INVALID_TYPE, "storage.app_state.enabled must be a boolean", "storage.app_state.enabled");
          }
          if (raw.storage.app_state.max_size !== undefined && typeof raw.storage.app_state.max_size !== "string") {
            v.error(ErrorCodes.INVALID_TYPE, "storage.app_state.max_size must be a string", "storage.app_state.max_size");
          }
        }
      }

      // Validate user_data
      if (raw.storage.user_data !== undefined) {
        if (typeof raw.storage.user_data !== "object" || raw.storage.user_data === null) {
          v.error(ErrorCodes.INVALID_OBJECT, "storage.user_data must be an object", "storage.user_data");
        } else {
          if (raw.storage.user_data.enabled !== undefined && typeof raw.storage.user_data.enabled !== "boolean") {
            v.error(ErrorCodes.INVALID_TYPE, "storage.user_data.enabled must be a boolean", "storage.user_data.enabled");
          }
          if (raw.storage.user_data.max_size !== undefined && typeof raw.storage.user_data.max_size !== "string") {
            v.error(ErrorCodes.INVALID_TYPE, "storage.user_data.max_size must be a string", "storage.user_data.max_size");
          }
          if (raw.storage.user_data.sync !== undefined && typeof raw.storage.user_data.sync !== "boolean") {
            v.error(ErrorCodes.INVALID_TYPE, "storage.user_data.sync must be a boolean", "storage.user_data.sync");
          }
        }
      }

      // Validate persist patterns
      if (raw.storage.persist !== undefined) {
        if (!Array.isArray(raw.storage.persist)) {
          v.error(ErrorCodes.INVALID_ARRAY, "storage.persist must be an array", "storage.persist");
        } else {
          raw.storage.persist.forEach((pattern, index) => {
            if (typeof pattern !== "string") {
              v.error(ErrorCodes.INVALID_TYPE, `storage.persist[${index}] must be a string`, `storage.persist[${index}]`);
            }
          });
        }
      }
    }
  }

  // ==========================================================================
  // Agent
  // ==========================================================================

  if (raw.agent !== undefined) {
    if (typeof raw.agent !== "object" || raw.agent === null) {
      v.error(ErrorCodes.INVALID_OBJECT, "Field 'agent' must be an object", "agent");
    } else {
      if (raw.agent.discoverable !== undefined && typeof raw.agent.discoverable !== "boolean") {
        v.error(ErrorCodes.INVALID_TYPE, "agent.discoverable must be a boolean", "agent.discoverable");
      }
      if (raw.agent.launchable !== undefined && typeof raw.agent.launchable !== "boolean") {
        v.error(ErrorCodes.INVALID_TYPE, "agent.launchable must be a boolean", "agent.launchable");
      }
      if (raw.agent.triggers !== undefined) {
        if (!Array.isArray(raw.agent.triggers)) {
          v.error(ErrorCodes.INVALID_ARRAY, "agent.triggers must be an array", "agent.triggers");
        }
      }
      if (raw.agent.provides !== undefined) {
        if (!Array.isArray(raw.agent.provides)) {
          v.error(ErrorCodes.INVALID_ARRAY, "agent.provides must be an array", "agent.provides");
        }
      }
    }
  }

  return v.build();
}

// =============================================================================
// Validate Parsed Manifest (After Defaults)
// =============================================================================

/**
 * Validate a fully parsed manifest (after defaults applied).
 * This is a lighter validation that assumes structure is correct.
 */
export function validateManifest(manifest: ParsedManifest): ValidationResult {
  const v = new ValidationBuilder();

  // Name format validation
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.name)) {
    v.warning(
      "W004",
      `Name '${manifest.name}' should be lowercase with hyphens only`,
      "name",
      manifest.name
    );
  }

  // Description length
  if (manifest.description.length > 160) {
    v.warning(
      "W005",
      `Description exceeds recommended 160 characters (${manifest.description.length})`,
      "description"
    );
  }

  // Server required for non-browser runtimes
  if (manifest.runtime !== "browser" && !manifest.server) {
    v.warning(
      "W006",
      `Runtime '${manifest.runtime}' typically requires a 'server' entry point`,
      "server"
    );
  }

  return v.build();
}

// =============================================================================
// Combine Validation Results
// =============================================================================

export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  for (const result of results) {
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
