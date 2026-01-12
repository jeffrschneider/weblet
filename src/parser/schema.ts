/**
 * Weblet Parser Schema
 *
 * TypeScript interfaces for the APP.md manifest format.
 * Based on Weblet Specification v1.0.0
 */

// =============================================================================
// Runtime Types
// =============================================================================

export type Runtime = "browser" | "bun" | "deno" | "node";

export type DependencyStrategy = "url" | "vendor" | "install";

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

export type Orientation = "any" | "portrait" | "landscape";

// =============================================================================
// Author
// =============================================================================

export interface AuthorObject {
  name: string;
  email?: string;
  url?: string;
}

export type Author = string | AuthorObject;

// =============================================================================
// Display Configuration
// =============================================================================

export interface DisplayConfig {
  width?: number;
  height?: number;
  resizable?: boolean;
  orientation?: Orientation;
}

// =============================================================================
// Accessibility Configuration
// =============================================================================

export interface AccessibilityConfig {
  high_contrast?: boolean;
  reduced_motion?: boolean;
  screen_reader?: boolean;
  keyboard_nav?: boolean;
  min_font_scale?: number;
  max_font_scale?: number;
  captions?: boolean;
  audio_descriptions?: boolean;
}

// =============================================================================
// Internationalization Configuration
// =============================================================================

export interface I18nConfig {
  default_locale?: string;
  supported_locales?: string[];
  locales_dir?: string;
}

// =============================================================================
// Dependencies Configuration
// =============================================================================

export interface DependenciesConfig {
  strategy?: DependencyStrategy;
  imports?: Record<string, string>;
  vendor_dir?: string;
  package_manager?: PackageManager;
}

// =============================================================================
// Storage Configuration
// =============================================================================

export interface AppStateConfig {
  enabled?: boolean;
  max_size?: string;
}

export interface UserDataConfig {
  enabled?: boolean;
  max_size?: string;
  sync?: boolean;
}

export interface StorageConfig {
  app_state?: AppStateConfig;
  user_data?: UserDataConfig;
  persist?: string[];
}

// =============================================================================
// Capabilities Configuration
// =============================================================================

export interface CapabilitiesConfig {
  network?: boolean;
  storage?: boolean;
  camera?: boolean;
  microphone?: boolean;
  geolocation?: boolean;
  clipboard?: boolean;
  notifications?: boolean;
}

// =============================================================================
// Agent Context Schema
// =============================================================================

export interface ContextDataSchema {
  type?: string;
  description?: string;
  required?: boolean;
  items?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  enum?: string[];
  default?: unknown;
  format?: string;
}

export interface AgentContextSchema {
  data?: Record<string, ContextDataSchema>;
  config?: Record<string, ContextDataSchema>;
}

export interface AgentEventSchema {
  name: string;
  description?: string;
  payload?: Record<string, unknown>;
}

// =============================================================================
// Agent Configuration
// =============================================================================

export interface AgentConfig {
  discoverable?: boolean;
  launchable?: boolean;
  triggers?: string[];
  provides?: string[];
  context?: AgentContextSchema;
  events?: AgentEventSchema[];
}

// =============================================================================
// Parsed Manifest (Complete)
// =============================================================================

export interface ParsedManifest {
  // Required fields
  name: string;
  description: string;

  // Runtime configuration
  runtime: Runtime;
  entry: string;
  server?: string;
  port: number;

  // Versioning
  version: string;
  spec: string;

  // Metadata
  author?: Author;
  license?: string;
  repository?: string;
  homepage?: string;
  keywords?: string[];

  // Categorization
  category?: string;
  tags?: string[];

  // Display
  display?: DisplayConfig;
  icon?: string;
  screenshots?: string[];

  // Accessibility
  accessibility?: AccessibilityConfig;

  // Internationalization
  i18n?: I18nConfig;
  description_i18n?: Record<string, string>;

  // Dependencies
  dependencies?: DependenciesConfig;

  // Storage
  storage?: StorageConfig;

  // Capabilities
  capabilities?: CapabilitiesConfig;

  // Skills integration
  uses?: string[];
  provides?: string[];

  // Environment
  env?: Record<string, string | number | boolean>;
  secrets?: string[];

  // Agent configuration
  agent?: AgentConfig;

  // Raw markdown body (content after frontmatter)
  body: string;
}

// =============================================================================
// Raw Manifest (Before Defaults Applied)
// =============================================================================

export interface RawManifest {
  // Required
  name?: string;
  description?: string;

  // Optional (everything else)
  runtime?: Runtime;
  entry?: string;
  server?: string;
  port?: number;
  version?: string;
  spec?: string;
  author?: Author;
  license?: string;
  repository?: string;
  homepage?: string;
  keywords?: string[];
  category?: string;
  tags?: string[];
  display?: DisplayConfig;
  icon?: string;
  screenshots?: string[];
  accessibility?: AccessibilityConfig;
  i18n?: I18nConfig;
  description_i18n?: Record<string, string>;
  dependencies?: DependenciesConfig;
  storage?: StorageConfig;
  capabilities?: CapabilitiesConfig;
  uses?: string[];
  provides?: string[];
  env?: Record<string, string | number | boolean>;
  secrets?: string[];
  agent?: AgentConfig;
}

// =============================================================================
// Validation Types
// =============================================================================

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  field?: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// =============================================================================
// Parser Options
// =============================================================================

export interface ParserOptions {
  /**
   * Whether to apply default values for optional fields.
   * Default: true
   */
  applyDefaults?: boolean;

  /**
   * Whether to validate the manifest after parsing.
   * Default: true
   */
  validate?: boolean;

  /**
   * Whether to throw on validation errors.
   * Default: false (returns validation result instead)
   */
  throwOnError?: boolean;
}

// =============================================================================
// Parser Result
// =============================================================================

export interface ParserResult {
  manifest: ParsedManifest;
  validation: ValidationResult;
}

// =============================================================================
// Error Types
// =============================================================================

export class ParserError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ParserError";
  }
}

export class ValidationError extends Error {
  constructor(
    public issues: ValidationIssue[]
  ) {
    const errorMessages = issues
      .filter((i) => i.severity === "error")
      .map((i) => i.message)
      .join("; ");
    super(`Validation failed: ${errorMessages}`);
    this.name = "ValidationError";
  }
}
