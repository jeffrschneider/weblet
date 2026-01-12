/**
 * Weblet Agent Context Library
 *
 * Standalone browser library for working with the Agent Context API.
 * Can be included directly in HTML or bundled with weblet code.
 *
 * Usage:
 *   <script src="agent-context.js"></script>
 *   <script>
 *     if (WebletAgent.isAgentLaunched()) {
 *       const data = WebletAgent.getData('expenses', []);
 *       WebletAgent.emit('loaded', { count: data.length });
 *     }
 *   </script>
 *
 * Or as ES module:
 *   import { isAgentLaunched, getData, emit } from './agent-context.js';
 */

// =============================================================================
// Types
// =============================================================================

export interface AgentInfo {
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly string[];
}

export interface AgentContext {
  readonly agent: AgentInfo;
  readonly data: Readonly<Record<string, unknown>>;
  readonly config: Readonly<Record<string, unknown>>;
  emit(event: string, payload?: unknown): Promise<void>;
  request<T = unknown>(action: string, params?: unknown): Promise<T>;
  on(event: string, handler: (payload: unknown) => void): void;
  off(event: string, handler: (payload: unknown) => void): void;
}

declare global {
  interface Window {
    __AGENT_CONTEXT__?: AgentContext;
    WebletAgent?: typeof WebletAgent;
  }
}

// =============================================================================
// Constants
// =============================================================================

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

// =============================================================================
// Context Access
// =============================================================================

/**
 * Get the agent context if available.
 */
export function getContext(): AgentContext | null {
  if (typeof window === "undefined") return null;
  return window.__AGENT_CONTEXT__ ?? null;
}

/**
 * Check if launched by an agent.
 */
export function isAgentLaunched(): boolean {
  return getContext() !== null;
}

/**
 * Get agent info if available.
 */
export function getAgentInfo(): AgentInfo | null {
  return getContext()?.agent ?? null;
}

/**
 * Check if agent has a capability.
 */
export function hasCapability(capability: string): boolean {
  return getContext()?.agent.capabilities.includes(capability) ?? false;
}

// =============================================================================
// Data & Config
// =============================================================================

/**
 * Get data with default value.
 */
export function getData<T>(key: string, defaultValue: T): T {
  const ctx = getContext();
  if (ctx?.data && key in ctx.data) {
    return ctx.data[key] as T;
  }
  return defaultValue;
}

/**
 * Get all data.
 */
export function getAllData(): Readonly<Record<string, unknown>> {
  return getContext()?.data ?? {};
}

/**
 * Check if data key exists.
 */
export function hasData(key: string): boolean {
  const ctx = getContext();
  return ctx?.data !== undefined && key in ctx.data;
}

/**
 * Get config with default value.
 */
export function getConfig<T>(key: string, defaultValue: T): T {
  const ctx = getContext();
  if (ctx?.config && key in ctx.config) {
    return ctx.config[key] as T;
  }
  return defaultValue;
}

/**
 * Get all config.
 */
export function getAllConfig(): Readonly<Record<string, unknown>> {
  return getContext()?.config ?? {};
}

// =============================================================================
// Events
// =============================================================================

/**
 * Validate event name.
 */
export function isValidEventName(event: string): boolean {
  return EVENT_NAME_PATTERN.test(event);
}

/**
 * Emit event to agent. Returns false if no agent.
 */
export async function emit(event: string, payload?: unknown): Promise<boolean> {
  const ctx = getContext();
  if (!ctx) return false;
  await ctx.emit(event, payload);
  return true;
}

/**
 * Subscribe to agent event. Returns cleanup function.
 */
export function on(event: string, handler: (payload: unknown) => void): () => void {
  const ctx = getContext();
  if (!ctx) return () => {};
  ctx.on(event, handler);
  return () => ctx.off(event, handler);
}

/**
 * Unsubscribe from agent event.
 */
export function off(event: string, handler: (payload: unknown) => void): void {
  getContext()?.off(event, handler);
}

// =============================================================================
// Requests
// =============================================================================

/**
 * Request agent action with fallback.
 */
export async function request<T>(
  action: string,
  params: unknown,
  fallback: () => T | Promise<T>
): Promise<T> {
  const ctx = getContext();
  if (!ctx) return fallback();
  try {
    return await ctx.request<T>(action, params);
  } catch {
    return fallback();
  }
}

/**
 * Request agent action, returning null if unavailable.
 */
export async function tryRequest<T>(action: string, params?: unknown): Promise<T | null> {
  const ctx = getContext();
  if (!ctx) return null;
  try {
    return await ctx.request<T>(action, params);
  } catch {
    return null;
  }
}

// =============================================================================
// Conditional Helpers
// =============================================================================

/**
 * Execute callback only if agent launched.
 */
export function whenAgent<T>(callback: (ctx: AgentContext) => T): T | undefined {
  const ctx = getContext();
  return ctx ? callback(ctx) : undefined;
}

/**
 * Execute different callbacks based on agent presence.
 */
export function withAgent<T>(options: {
  agent: (ctx: AgentContext) => T;
  standalone: () => T;
}): T {
  const ctx = getContext();
  return ctx ? options.agent(ctx) : options.standalone();
}

// =============================================================================
// Global Export
// =============================================================================

/**
 * WebletAgent namespace for non-module usage.
 */
export const WebletAgent = {
  // Context
  getContext,
  isAgentLaunched,
  getAgentInfo,
  hasCapability,

  // Data & Config
  getData,
  getAllData,
  hasData,
  getConfig,
  getAllConfig,

  // Events
  isValidEventName,
  emit,
  on,
  off,

  // Requests
  request,
  tryRequest,

  // Helpers
  whenAgent,
  withAgent,
};

// Auto-expose to window if in browser
if (typeof window !== "undefined") {
  window.WebletAgent = WebletAgent;
}

export default WebletAgent;
