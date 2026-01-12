/**
 * Agent Context Type Definitions
 *
 * TypeScript interfaces for the Agent Context API.
 * Based on agent-context.spec.md Section 3.1
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Information about the launching agent.
 */
export interface AgentInfo {
  /** Agent identifier (e.g., "claude", "chatgpt", "custom-agent") */
  readonly name: string;
  /** Agent version (semver format) */
  readonly version: string;
  /** List of capabilities the agent supports */
  readonly capabilities: readonly string[];
}

/**
 * Event handler function type.
 */
export type EventHandler = (payload: unknown) => void;

/**
 * The main Agent Context interface.
 * Injected as window.__AGENT_CONTEXT__ when an agent launches a weblet.
 */
export interface AgentContext {
  /**
   * Information about the launching agent.
   */
  readonly agent: AgentInfo;

  /**
   * Data passed to the weblet at launch.
   * Contains the payload the agent wants the weblet to work with.
   */
  readonly data: Readonly<Record<string, unknown>>;

  /**
   * Configuration passed to the weblet.
   * Contains settings and preferences from the agent.
   */
  readonly config: Readonly<Record<string, unknown>>;

  /**
   * Emit an event to the agent.
   * @param event - Event name (lowercase, hyphens allowed: /^[a-z][a-z0-9-]*$/)
   * @param payload - JSON-serializable data
   * @returns Promise that resolves when agent acknowledges
   * @throws AgentError if event name is invalid or payload not serializable
   * @throws AgentTimeoutError if agent doesn't acknowledge within 30s
   */
  emit(event: string, payload?: unknown): Promise<void>;

  /**
   * Request the agent to perform an action.
   * @param action - Action name
   * @param params - Action parameters
   * @returns Promise with agent's response
   * @throws AgentDeniedError if agent denies the request
   * @throws AgentTimeoutError if agent doesn't respond within 60s
   */
  request<T = unknown>(action: string, params?: unknown): Promise<T>;

  /**
   * Subscribe to events from the agent.
   * @param event - Event name to listen for
   * @param handler - Callback function
   */
  on(event: string, handler: EventHandler): void;

  /**
   * Unsubscribe from agent events.
   * @param event - Event name
   * @param handler - The handler to remove
   */
  off(event: string, handler: EventHandler): void;
}

// =============================================================================
// Internal Types (for agent implementations)
// =============================================================================

/**
 * Internal event emitter for agent-to-weblet communication.
 * Not part of the public API.
 */
export interface AgentContextInternal extends AgentContext {
  /**
   * Internal method for agents to emit events to the weblet.
   * @internal
   */
  _internalEmit(event: string, payload: unknown): void;
}

/**
 * Event payload format for weblet-to-agent communication.
 */
export interface WebletEvent {
  type: "weblet-event";
  event: string;
  payload: unknown;
  timestamp: number;
  weblet: string;
}

/**
 * Request format for weblet-to-agent communication.
 */
export interface WebletRequest {
  type: "weblet-request";
  action: string;
  params: unknown;
  requestId: string;
  timestamp: number;
}

/**
 * Response format for agent-to-weblet communication.
 */
export interface WebletResponse {
  type: "weblet-response";
  requestId: string;
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

// =============================================================================
// APP.md Agent Schema Types
// =============================================================================

/**
 * Agent configuration schema for APP.md manifest.
 */
export interface AgentManifestConfig {
  /** Can agents discover this app? */
  discoverable?: boolean;
  /** Can agents launch this app? */
  launchable?: boolean;
  /** When should agents consider this app? */
  triggers?: string[];
  /** What does this app provide? */
  provides?: string[];
  /** What capabilities does this app require from agents? */
  requires?: string[];
  /** Expected context schema */
  context?: {
    data?: Record<string, ContextFieldSchema>;
    config?: Record<string, ContextFieldSchema>;
  };
  /** Events this app emits */
  events?: AgentEventSchema[];
}

/**
 * Schema for a context field.
 */
export interface ContextFieldSchema {
  type: "string" | "number" | "boolean" | "array" | "object" | "date";
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, ContextFieldSchema>;
}

/**
 * Schema for an agent event.
 */
export interface AgentEventSchema {
  name: string;
  description?: string;
  payload?: Record<string, ContextFieldSchema>;
}

// =============================================================================
// Global Type Declaration
// =============================================================================

declare global {
  interface Window {
    __AGENT_CONTEXT__?: AgentContext;
  }
}

// =============================================================================
// Constants
// =============================================================================

/** Timeout for emit() in milliseconds */
export const EMIT_TIMEOUT = 30000;

/** Timeout for request() in milliseconds */
export const REQUEST_TIMEOUT = 60000;

/** Pattern for valid event names */
export const EVENT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Maximum context size in bytes */
export const MAX_CONTEXT_SIZE = 1024 * 1024; // 1MB
