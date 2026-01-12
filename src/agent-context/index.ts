/**
 * Agent Context Module
 *
 * Provides the Agent Context API for weblet-agent communication.
 * Based on agent-context.spec.md
 */

// =============================================================================
// Re-exports
// =============================================================================

// Types
export type {
  AgentContext,
  AgentContextInternal,
  AgentInfo,
  EventHandler,
  WebletEvent,
  WebletRequest,
  WebletResponse,
  AgentManifestConfig,
  ContextFieldSchema,
  AgentEventSchema,
} from "./types.ts";

export {
  EMIT_TIMEOUT,
  REQUEST_TIMEOUT,
  EVENT_NAME_PATTERN,
  MAX_CONTEXT_SIZE,
} from "./types.ts";

// Errors
export {
  AgentError,
  AgentInvalidEventError,
  AgentInvalidPayloadError,
  AgentEmitTimeoutError,
  AgentDeniedError,
  AgentRequestTimeoutError,
  AgentUnknownActionError,
  AgentNoContextError,
  AgentErrorCodes,
  isAgentError,
  isTimeoutError,
  createErrorFromResponse,
} from "./errors.ts";

export type { AgentErrorCode } from "./errors.ts";

// Helpers
export {
  // Context access
  getAgentContext,
  isAgentLaunched,
  getAgentInfo,
  hasAgentCapability,
  // Data access
  getAgentData,
  getAllAgentData,
  hasAgentData,
  // Config access
  getAgentConfig,
  getAllAgentConfig,
  // Event emission
  isValidEventName,
  isSerializablePayload,
  emitToAgent,
  emitToAgentStrict,
  // Request helpers
  requestAgentAction,
  tryRequestAgent,
  // Event subscription
  subscribeToAgent,
  subscribeToAgentEvents,
  // Conditional helpers
  whenAgentLaunched,
  withAgentContext,
  // Debug
  debugAgentContext,
} from "./helpers.ts";

// =============================================================================
// Context Creation (for agent implementations)
// =============================================================================

import type { AgentContext, AgentContextInternal, EventHandler } from "./types.ts";
import { EVENT_NAME_PATTERN, EMIT_TIMEOUT, REQUEST_TIMEOUT } from "./types.ts";
import {
  AgentInvalidEventError,
  AgentInvalidPayloadError,
  AgentEmitTimeoutError,
  AgentRequestTimeoutError,
} from "./errors.ts";

/**
 * Options for creating an agent context.
 */
export interface CreateContextOptions {
  /** Agent name */
  agentName: string;
  /** Agent version */
  agentVersion: string;
  /** Agent capabilities */
  capabilities?: string[];
  /** Data to pass to weblet */
  data?: Record<string, unknown>;
  /** Config to pass to weblet */
  config?: Record<string, unknown>;
  /** Handler for emitted events */
  onEmit?: (event: string, payload: unknown) => Promise<void>;
  /** Handler for requests */
  onRequest?: (action: string, params: unknown) => Promise<unknown>;
}

/**
 * Create an agent context for injection into a weblet.
 * This is used by agent implementations, not weblets.
 */
export function createAgentContext(options: CreateContextOptions): AgentContextInternal {
  const {
    agentName,
    agentVersion,
    capabilities = [],
    data = {},
    config = {},
    onEmit,
    onRequest,
  } = options;

  // Event handlers map
  const eventHandlers = new Map<string, Set<EventHandler>>();

  // Create the context object
  const context: AgentContextInternal = {
    agent: Object.freeze({
      name: agentName,
      version: agentVersion,
      capabilities: Object.freeze([...capabilities]),
    }),

    data: Object.freeze({ ...data }),
    config: Object.freeze({ ...config }),

    async emit(event: string, payload?: unknown): Promise<void> {
      // Validate event name
      if (!EVENT_NAME_PATTERN.test(event)) {
        throw new AgentInvalidEventError(event);
      }

      // Validate payload is serializable
      if (payload !== undefined) {
        try {
          JSON.stringify(payload);
        } catch {
          throw new AgentInvalidPayloadError();
        }
      }

      // Call emit handler with timeout
      if (onEmit) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new AgentEmitTimeoutError(event, EMIT_TIMEOUT));
          }, EMIT_TIMEOUT);
        });

        await Promise.race([onEmit(event, payload), timeoutPromise]);
      }
    },

    async request<T = unknown>(action: string, params?: unknown): Promise<T> {
      if (!onRequest) {
        throw new Error("Agent does not support requests");
      }

      // Call request handler with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new AgentRequestTimeoutError(action, REQUEST_TIMEOUT));
        }, REQUEST_TIMEOUT);
      });

      return Promise.race([
        onRequest(action, params) as Promise<T>,
        timeoutPromise,
      ]);
    },

    on(event: string, handler: EventHandler): void {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
    },

    off(event: string, handler: EventHandler): void {
      const handlers = eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
      }
    },

    _internalEmit(event: string, payload: unknown): void {
      const handlers = eventHandlers.get(event);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(payload);
          } catch (error) {
            console.error(`Error in event handler for "${event}":`, error);
          }
        }
      }
    },
  };

  // Freeze the context object
  Object.freeze(context);

  return context;
}

/**
 * Create a stub agent context that does nothing.
 * Used for testing or when no agent is present.
 */
export function createStubContext(): AgentContext {
  const noop = () => {};
  const noopAsync = () => Promise.resolve();

  return Object.freeze({
    agent: Object.freeze({
      name: "stub",
      version: "0.0.0",
      capabilities: Object.freeze([]),
    }),
    data: Object.freeze({}),
    config: Object.freeze({}),
    emit: noopAsync,
    request: noopAsync as <T>() => Promise<T>,
    on: noop,
    off: noop,
  });
}

/**
 * Generate JavaScript code to inject agent context.
 * This is used by the runtime to inject context into HTML.
 */
export function generateContextInjectionScript(context: AgentContext): string {
  // Serialize the static parts of context
  const serialized = JSON.stringify({
    agent: context.agent,
    data: context.data,
    config: context.config,
  });

  // Generate the injection script
  return `
<script>
(function() {
  // Agent Context Injection
  var contextData = ${serialized};

  // Event handlers
  var handlers = {};

  // Create context object
  var context = Object.freeze({
    agent: Object.freeze(contextData.agent),
    data: Object.freeze(contextData.data),
    config: Object.freeze(contextData.config),

    emit: function(event, payload) {
      return new Promise(function(resolve, reject) {
        // Validate event name
        if (!/^[a-z][a-z0-9-]*$/.test(event)) {
          reject(new Error('Invalid event name: ' + event));
          return;
        }
        // Post message to parent/host
        window.parent.postMessage({
          type: 'weblet-event',
          event: event,
          payload: payload,
          timestamp: Date.now()
        }, '*');
        // For now, resolve immediately (actual implementation would wait for ack)
        resolve();
      });
    },

    request: function(action, params) {
      return new Promise(function(resolve, reject) {
        var requestId = 'req-' + Math.random().toString(36).substr(2, 9);
        // Set up response handler
        var timeout = setTimeout(function() {
          reject(new Error('Request timeout'));
        }, 60000);

        var handler = function(event) {
          if (event.data && event.data.type === 'weblet-response' && event.data.requestId === requestId) {
            window.removeEventListener('message', handler);
            clearTimeout(timeout);
            if (event.data.success) {
              resolve(event.data.result);
            } else {
              reject(new Error(event.data.error ? event.data.error.message : 'Request failed'));
            }
          }
        };
        window.addEventListener('message', handler);

        // Send request
        window.parent.postMessage({
          type: 'weblet-request',
          action: action,
          params: params,
          requestId: requestId,
          timestamp: Date.now()
        }, '*');
      });
    },

    on: function(event, handler) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    },

    off: function(event, handler) {
      if (handlers[event]) {
        var idx = handlers[event].indexOf(handler);
        if (idx !== -1) handlers[event].splice(idx, 1);
      }
    }
  });

  // Listen for agent events
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'agent-event') {
      var eventName = event.data.event;
      if (handlers[eventName]) {
        handlers[eventName].forEach(function(h) {
          try { h(event.data.payload); } catch(e) { console.error(e); }
        });
      }
    }
  });

  window.__AGENT_CONTEXT__ = context;
})();
</script>`.trim();
}

/**
 * Generate a no-op stub script for when no agent is present.
 * This provides graceful degradation.
 */
export function generateStubScript(): string {
  return `
<script>
// Agent Context Stub - Provides graceful degradation when no agent is present
(function() {
  if (window.__AGENT_CONTEXT__) return; // Agent already injected

  var noop = function() {};
  var noopPromise = function() { return Promise.resolve(undefined); };
  var noopListener = function() { return { remove: noop }; };

  window.__AGENT_CONTEXT__ = undefined;
})();
</script>`.trim();
}
