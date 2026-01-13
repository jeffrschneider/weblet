/**
 * Weblet Reference Implementation
 *
 * Main entry point exporting all public modules.
 */

// High-level API (recommended for integrations)
export {
  validateWeblet,
  getWebletInfo,
  serveWeblet,
  captureScreenshots,
  type ServeOptions,
  type ScreenshotOptions,
  type ScreenshotResult,
  type ValidationResult,
  type WebletServerHandle,
} from "./api.ts";

// Parser module
export * from "./parser/index.ts";

// Storage module
export * from "./storage/index.ts";

// Dependencies module
export * from "./dependencies/index.ts";

// Runtime module
export * from "./runtime/index.ts";

// Agent Context module
export * from "./agent-context/index.ts";
