/**
 * Agent Context Error Classes
 *
 * Custom error types for the Agent Context API.
 * Based on agent-context.spec.md Section 5
 */

// =============================================================================
// Error Codes
// =============================================================================

export const AgentErrorCodes = {
  /** Invalid event name format */
  INVALID_EVENT_NAME: "E-AGT-001",
  /** Payload not JSON-serializable */
  INVALID_PAYLOAD: "E-AGT-002",
  /** Emit timeout (30s) */
  EMIT_TIMEOUT: "E-AGT-003",
  /** Agent denied request */
  REQUEST_DENIED: "E-AGT-004",
  /** Request timeout (60s) */
  REQUEST_TIMEOUT: "E-AGT-005",
  /** Unknown action */
  UNKNOWN_ACTION: "E-AGT-006",
  /** No agent context available */
  NO_CONTEXT: "E-AGT-007",
} as const;

export type AgentErrorCode = (typeof AgentErrorCodes)[keyof typeof AgentErrorCodes];

// =============================================================================
// Base Agent Error
// =============================================================================

/**
 * Base error class for Agent Context errors.
 */
export class AgentError extends Error {
  readonly name = "AgentError";

  constructor(
    public readonly code: AgentErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentError);
    }
  }

  /**
   * Create error JSON representation.
   */
  toJSON(): { code: string; message: string; details?: unknown } {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

// =============================================================================
// Specific Error Classes
// =============================================================================

/**
 * Error thrown when an event name is invalid.
 */
export class AgentInvalidEventError extends AgentError {
  constructor(eventName: string) {
    super(
      AgentErrorCodes.INVALID_EVENT_NAME,
      `Invalid event name: "${eventName}". Use lowercase letters, numbers, and hyphens (e.g., "user-action").`,
      { eventName }
    );
    this.name = "AgentInvalidEventError";
  }
}

/**
 * Error thrown when a payload cannot be serialized to JSON.
 */
export class AgentInvalidPayloadError extends AgentError {
  constructor(reason?: string) {
    super(
      AgentErrorCodes.INVALID_PAYLOAD,
      `Event payload must be JSON-serializable${reason ? `: ${reason}` : ""}`,
      { reason }
    );
    this.name = "AgentInvalidPayloadError";
  }
}

/**
 * Error thrown when emit() times out waiting for acknowledgment.
 */
export class AgentEmitTimeoutError extends AgentError {
  constructor(event: string, timeout: number) {
    super(
      AgentErrorCodes.EMIT_TIMEOUT,
      `Agent did not acknowledge event "${event}" within ${timeout}ms`,
      { event, timeout }
    );
    this.name = "AgentEmitTimeoutError";
  }
}

/**
 * Error thrown when agent denies a request.
 */
export class AgentDeniedError extends AgentError {
  constructor(action: string, reason?: string) {
    super(
      AgentErrorCodes.REQUEST_DENIED,
      `Agent denied request: ${action}${reason ? ` - ${reason}` : ""}`,
      { action, reason }
    );
    this.name = "AgentDeniedError";
  }
}

/**
 * Error thrown when request() times out waiting for response.
 */
export class AgentRequestTimeoutError extends AgentError {
  constructor(action: string, timeout: number) {
    super(
      AgentErrorCodes.REQUEST_TIMEOUT,
      `Agent did not respond to "${action}" within ${timeout}ms`,
      { action, timeout }
    );
    this.name = "AgentRequestTimeoutError";
  }
}

/**
 * Error thrown when agent doesn't support a requested action.
 */
export class AgentUnknownActionError extends AgentError {
  constructor(action: string) {
    super(
      AgentErrorCodes.UNKNOWN_ACTION,
      `Agent does not support action: ${action}`,
      { action }
    );
    this.name = "AgentUnknownActionError";
  }
}

/**
 * Error thrown when no agent context is available.
 */
export class AgentNoContextError extends AgentError {
  constructor() {
    super(
      AgentErrorCodes.NO_CONTEXT,
      "No agent context available. The weblet was not launched by an agent."
    );
    this.name = "AgentNoContextError";
  }
}

// =============================================================================
// Error Utilities
// =============================================================================

/**
 * Check if an error is an AgentError.
 */
export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError;
}

/**
 * Check if an error is a timeout error.
 */
export function isTimeoutError(
  error: unknown
): error is AgentEmitTimeoutError | AgentRequestTimeoutError {
  return (
    error instanceof AgentEmitTimeoutError ||
    error instanceof AgentRequestTimeoutError
  );
}

/**
 * Create an AgentError from a response error object.
 */
export function createErrorFromResponse(response: {
  code: string;
  message: string;
  details?: unknown;
}): AgentError {
  const { code, message, details } = response;

  switch (code) {
    case AgentErrorCodes.INVALID_EVENT_NAME:
      return new AgentInvalidEventError(String(details || "unknown"));
    case AgentErrorCodes.INVALID_PAYLOAD:
      return new AgentInvalidPayloadError(message);
    case AgentErrorCodes.EMIT_TIMEOUT:
      return new AgentEmitTimeoutError("unknown", 30000);
    case AgentErrorCodes.REQUEST_DENIED:
      return new AgentDeniedError("unknown", message);
    case AgentErrorCodes.REQUEST_TIMEOUT:
      return new AgentRequestTimeoutError("unknown", 60000);
    case AgentErrorCodes.UNKNOWN_ACTION:
      return new AgentUnknownActionError(String(details || "unknown"));
    case AgentErrorCodes.NO_CONTEXT:
      return new AgentNoContextError();
    default:
      return new AgentError(code as AgentErrorCode, message, details);
  }
}
