/**
 * Agent Context Helper Utilities
 *
 * Convenient functions for working with the Agent Context API.
 * Based on agent-context.spec.md Section 3.2
 */

import type { AgentContext, AgentInfo, EventHandler } from "./types.ts";
import { EVENT_NAME_PATTERN } from "./types.ts";
import { AgentInvalidEventError, AgentInvalidPayloadError } from "./errors.ts";

// =============================================================================
// Context Access
// =============================================================================

/**
 * Get the agent context if available.
 * @returns The agent context or null if not launched by an agent
 */
export function getAgentContext(): AgentContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.__AGENT_CONTEXT__ ?? null;
}

/**
 * Check if the weblet was launched by an agent.
 * @returns true if an agent context is available
 */
export function isAgentLaunched(): boolean {
  return getAgentContext() !== null;
}

/**
 * Get agent information if available.
 * @returns Agent info or null if not launched by an agent
 */
export function getAgentInfo(): AgentInfo | null {
  const ctx = getAgentContext();
  return ctx?.agent ?? null;
}

/**
 * Check if the agent has a specific capability.
 * @param capability - The capability to check
 * @returns true if the agent has the capability
 */
export function hasAgentCapability(capability: string): boolean {
  const ctx = getAgentContext();
  return ctx?.agent.capabilities.includes(capability) ?? false;
}

// =============================================================================
// Data Access
// =============================================================================

/**
 * Get data from agent context with type safety and default value.
 * @param key - The data key to retrieve
 * @param defaultValue - Value to return if key is missing or no context
 * @returns The data value or default
 */
export function getAgentData<T>(key: string, defaultValue: T): T {
  const ctx = getAgentContext();
  if (ctx?.data && key in ctx.data) {
    return ctx.data[key] as T;
  }
  return defaultValue;
}

/**
 * Get all data from agent context.
 * @returns The data object or empty object if no context
 */
export function getAllAgentData(): Readonly<Record<string, unknown>> {
  const ctx = getAgentContext();
  return ctx?.data ?? {};
}

/**
 * Check if specific data was provided by the agent.
 * @param key - The data key to check
 * @returns true if the data key exists
 */
export function hasAgentData(key: string): boolean {
  const ctx = getAgentContext();
  return ctx?.data !== undefined && key in ctx.data;
}

// =============================================================================
// Config Access
// =============================================================================

/**
 * Get config from agent context with type safety and default value.
 * @param key - The config key to retrieve
 * @param defaultValue - Value to return if key is missing or no context
 * @returns The config value or default
 */
export function getAgentConfig<T>(key: string, defaultValue: T): T {
  const ctx = getAgentContext();
  if (ctx?.config && key in ctx.config) {
    return ctx.config[key] as T;
  }
  return defaultValue;
}

/**
 * Get all config from agent context.
 * @returns The config object or empty object if no context
 */
export function getAllAgentConfig(): Readonly<Record<string, unknown>> {
  const ctx = getAgentContext();
  return ctx?.config ?? {};
}

// =============================================================================
// Event Emission
// =============================================================================

/**
 * Validate an event name against the required pattern.
 * @param event - Event name to validate
 * @returns true if valid
 */
export function isValidEventName(event: string): boolean {
  return EVENT_NAME_PATTERN.test(event);
}

/**
 * Validate that a payload is JSON-serializable.
 * @param payload - Payload to validate
 * @returns true if serializable
 */
export function isSerializablePayload(payload: unknown): boolean {
  try {
    JSON.stringify(payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely emit an event to the agent.
 * Returns false if no agent is present (no error thrown).
 * @param event - Event name (lowercase, hyphens allowed)
 * @param payload - JSON-serializable data
 * @returns Promise<true> if emitted, Promise<false> if no agent
 */
export async function emitToAgent(
  event: string,
  payload?: unknown
): Promise<boolean> {
  const ctx = getAgentContext();
  if (!ctx) {
    return false;
  }

  await ctx.emit(event, payload);
  return true;
}

/**
 * Emit an event to the agent, throwing if validation fails.
 * Use this when you need strict validation before emit.
 * @param event - Event name
 * @param payload - Event payload
 * @throws AgentInvalidEventError if event name is invalid
 * @throws AgentInvalidPayloadError if payload is not serializable
 */
export async function emitToAgentStrict(
  event: string,
  payload?: unknown
): Promise<boolean> {
  if (!isValidEventName(event)) {
    throw new AgentInvalidEventError(event);
  }

  if (payload !== undefined && !isSerializablePayload(payload)) {
    throw new AgentInvalidPayloadError();
  }

  return emitToAgent(event, payload);
}

// =============================================================================
// Request Helpers
// =============================================================================

/**
 * Request an agent action with automatic fallback.
 * If no agent is present or request fails, the fallback is called.
 * @param action - Action name
 * @param params - Action parameters
 * @param fallback - Fallback function if agent unavailable or request fails
 * @returns The agent's response or fallback result
 */
export async function requestAgentAction<T>(
  action: string,
  params: unknown,
  fallback: () => T | Promise<T>
): Promise<T> {
  const ctx = getAgentContext();
  if (!ctx) {
    return fallback();
  }

  try {
    return await ctx.request<T>(action, params);
  } catch {
    return fallback();
  }
}

/**
 * Request an agent action, returning null if unavailable.
 * @param action - Action name
 * @param params - Action parameters
 * @returns The agent's response or null
 */
export async function tryRequestAgent<T>(
  action: string,
  params?: unknown
): Promise<T | null> {
  const ctx = getAgentContext();
  if (!ctx) {
    return null;
  }

  try {
    return await ctx.request<T>(action, params);
  } catch {
    return null;
  }
}

// =============================================================================
// Event Subscription
// =============================================================================

/**
 * Subscribe to an agent event with automatic cleanup.
 * @param event - Event name
 * @param handler - Event handler
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToAgent(
  event: string,
  handler: EventHandler
): () => void {
  const ctx = getAgentContext();
  if (!ctx) {
    // Return no-op cleanup if no context
    return () => {};
  }

  ctx.on(event, handler);
  return () => ctx.off(event, handler);
}

/**
 * Subscribe to multiple agent events.
 * @param subscriptions - Map of event names to handlers
 * @returns Cleanup function to unsubscribe all
 */
export function subscribeToAgentEvents(
  subscriptions: Record<string, EventHandler>
): () => void {
  const cleanups: (() => void)[] = [];

  for (const [event, handler] of Object.entries(subscriptions)) {
    cleanups.push(subscribeToAgent(event, handler));
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// =============================================================================
// Conditional Rendering Helpers
// =============================================================================

/**
 * Execute a callback only if launched by an agent.
 * @param callback - Function to execute
 * @returns The callback result or undefined
 */
export function whenAgentLaunched<T>(callback: (ctx: AgentContext) => T): T | undefined {
  const ctx = getAgentContext();
  if (ctx) {
    return callback(ctx);
  }
  return undefined;
}

/**
 * Execute different callbacks based on agent presence.
 * @param options - Callbacks for agent and standalone modes
 * @returns The result of the appropriate callback
 */
export function withAgentContext<T>(options: {
  withAgent: (ctx: AgentContext) => T;
  withoutAgent: () => T;
}): T {
  const ctx = getAgentContext();
  if (ctx) {
    return options.withAgent(ctx);
  }
  return options.withoutAgent();
}

// =============================================================================
// Debugging Helpers
// =============================================================================

/**
 * Log agent context information for debugging.
 * Only logs if agent context is available.
 */
export function debugAgentContext(): void {
  const ctx = getAgentContext();
  if (!ctx) {
    console.log("[Agent Context] Not available - weblet not launched by agent");
    return;
  }

  console.group("[Agent Context] Available");
  console.log("Agent:", ctx.agent);
  console.log("Data keys:", Object.keys(ctx.data));
  console.log("Config keys:", Object.keys(ctx.config));
  console.groupEnd();
}
