# Agent Context API Specification

**Spec Version**: 1.0.0
**Weblet Spec Reference**: v1.0.0, Sections 10-11

---

## 1. Overview

The Agent Context API enables bidirectional communication between AI agents and weblets. When an agent launches a weblet, it injects a context object (`window.__AGENT_CONTEXT__`) that provides data, configuration, and communication channels. Weblets can read this context, emit events back to the agent, and request agent actions—while gracefully degrading when launched directly by users.

---

## 2. Requirements

### 2.1 Functional Requirements

#### Context Injection

- **FR-CTX-001**: The host SHALL inject `window.__AGENT_CONTEXT__` when launching a weblet
- **FR-CTX-002**: The context object SHALL be available before any weblet scripts execute
- **FR-CTX-003**: The context object SHALL be read-only (frozen)
- **FR-CTX-004**: The context SHALL include agent metadata (name, version, capabilities)
- **FR-CTX-005**: The context SHALL include data payload from agent
- **FR-CTX-006**: The context SHALL include configuration from agent

#### Event Emission

- **FR-EMIT-001**: Weblets SHALL be able to emit events to the agent via `emit(event, payload)`
- **FR-EMIT-002**: Event names SHALL be strings matching pattern `^[a-z][a-z0-9-]*$`
- **FR-EMIT-003**: Event payloads SHALL be JSON-serializable
- **FR-EMIT-004**: `emit()` SHALL return a Promise that resolves when agent acknowledges
- **FR-EMIT-005**: `emit()` SHALL timeout after 30 seconds if no acknowledgment

#### Request/Response

- **FR-REQ-001**: Weblets SHALL be able to request agent actions via `request(action, params)`
- **FR-REQ-002**: `request()` SHALL return a Promise with the agent's response
- **FR-REQ-003**: `request()` SHALL reject if agent denies or cannot perform action
- **FR-REQ-004**: `request()` SHALL timeout after 60 seconds

#### Event Subscription

- **FR-SUB-001**: Weblets SHALL be able to subscribe to agent events via `on(event, handler)`
- **FR-SUB-002**: Weblets SHALL be able to unsubscribe via `off(event, handler)`
- **FR-SUB-003**: Multiple handlers MAY be registered for the same event
- **FR-SUB-004**: Handlers SHALL receive event payload as first argument

#### Graceful Degradation

- **FR-DEGRADE-001**: `window.__AGENT_CONTEXT__` SHALL be `undefined` when no agent present
- **FR-DEGRADE-002**: Weblets SHALL provide fallback behavior when context is missing
- **FR-DEGRADE-003**: Helper utilities SHALL handle missing context gracefully

### 2.2 Non-Functional Requirements

- **NFR-CTX-001**: Context injection SHALL complete within 10ms
- **NFR-CTX-002**: Event emission latency SHALL be under 100ms for local agents
- **NFR-CTX-003**: Context object SHALL be less than 1MB in size
- **NFR-CTX-004**: API SHALL work in all modern browsers (Chrome, Firefox, Safari, Edge)

---

## 3. Interface

### 3.1 AgentContext Interface

```typescript
interface AgentContext {
  /**
   * Information about the launching agent
   */
  readonly agent: {
    readonly name: string;           // e.g., "claude", "chatgpt", "custom-agent"
    readonly version: string;        // e.g., "1.0.0"
    readonly capabilities: string[]; // What the agent can do
  };

  /**
   * Data passed to the weblet at launch
   */
  readonly data: Readonly<Record<string, unknown>>;

  /**
   * Configuration passed to the weblet
   */
  readonly config: Readonly<Record<string, unknown>>;

  /**
   * Emit an event to the agent
   * @param event - Event name (lowercase, hyphens allowed)
   * @param payload - JSON-serializable data
   * @returns Promise that resolves when agent acknowledges
   */
  emit(event: string, payload?: unknown): Promise<void>;

  /**
   * Request the agent to perform an action
   * @param action - Action name
   * @param params - Action parameters
   * @returns Promise with agent's response
   */
  request<T = unknown>(action: string, params?: unknown): Promise<T>;

  /**
   * Subscribe to events from the agent
   * @param event - Event name to listen for
   * @param handler - Callback function
   */
  on(event: string, handler: (payload: unknown) => void): void;

  /**
   * Unsubscribe from agent events
   * @param event - Event name
   * @param handler - The handler to remove
   */
  off(event: string, handler: (payload: unknown) => void): void;
}

// Global type declaration
declare global {
  interface Window {
    __AGENT_CONTEXT__?: AgentContext;
  }
}
```

### 3.2 Helper Utilities

```typescript
// utils/agent.ts - Recommended helper library

/**
 * Get agent context if available
 */
export function getAgentContext(): AgentContext | null {
  return window.__AGENT_CONTEXT__ ?? null;
}

/**
 * Check if weblet was launched by an agent
 */
export function isAgentLaunched(): boolean {
  return window.__AGENT_CONTEXT__ !== undefined;
}

/**
 * Safely emit event to agent (no-op if no agent)
 */
export async function emitToAgent(
  event: string,
  payload?: unknown
): Promise<boolean> {
  const ctx = getAgentContext();
  if (ctx) {
    await ctx.emit(event, payload);
    return true;
  }
  return false;
}

/**
 * Get data from agent context with type safety
 */
export function getAgentData<T>(key: string, defaultValue: T): T {
  const ctx = getAgentContext();
  if (ctx?.data && key in ctx.data) {
    return ctx.data[key] as T;
  }
  return defaultValue;
}

/**
 * Get config from agent context with type safety
 */
export function getAgentConfig<T>(key: string, defaultValue: T): T {
  const ctx = getAgentContext();
  if (ctx?.config && key in ctx.config) {
    return ctx.config[key] as T;
  }
  return defaultValue;
}

/**
 * Request agent action with fallback
 */
export async function requestAgentAction<T>(
  action: string,
  params: unknown,
  fallback: () => T | Promise<T>
): Promise<T> {
  const ctx = getAgentContext();
  if (ctx) {
    try {
      return await ctx.request<T>(action, params);
    } catch {
      return fallback();
    }
  }
  return fallback();
}
```

### 3.3 APP.md Agent Schema

```yaml
agent:
  discoverable: true        # Can agents find this app?
  launchable: true          # Can agents launch this app?

  triggers:                 # When should agents consider this app?
    - user wants to play cards
    - user asks for solitaire

  provides:                 # What does this app provide?
    - entertainment
    - card game

  context:                  # Expected context schema
    data:
      expenses:
        type: array
        description: Expense records to visualize
        required: false
      date_range:
        type: object
        properties:
          start: { type: date }
          end: { type: date }
    config:
      chart_type:
        type: string
        enum: [bar, line, pie]
        default: bar
      theme:
        type: string
        enum: [light, dark, auto]
        default: auto

  events:                   # Events this app emits
    - name: expense-flagged
      description: User flagged an unusual expense
      payload:
        expense_id: string
        reason: string
    - name: report-generated
      description: User generated a report
      payload:
        format: string
        data: object
```

---

## 4. Behavior

### 4.1 Context Injection Flow

**Agent-side (Host Implementation):**

```javascript
// Before loading weblet
const context = {
  agent: {
    name: "claude",
    version: "1.0.0",
    capabilities: ["text", "code", "file-access"]
  },
  data: {
    expenses: [...],
    date_range: { start: "2024-01-01", end: "2024-12-31" }
  },
  config: {
    chart_type: "bar",
    theme: "dark"
  },
  emit: async (event, payload) => { /* send to agent */ },
  request: async (action, params) => { /* request from agent */ },
  on: (event, handler) => { /* register handler */ },
  off: (event, handler) => { /* remove handler */ }
};

// Freeze to prevent modification
Object.freeze(context);
Object.freeze(context.agent);
Object.freeze(context.data);
Object.freeze(context.config);

// Inject before weblet scripts run
window.__AGENT_CONTEXT__ = context;
```

### 4.2 Event Emission Protocol

```
Weblet                          Agent
   |                              |
   |-- emit("user-action", {})  ->|
   |                              | (process event)
   |<-- acknowledgment -----------|
   |                              |
   | Promise resolves             |
```

Event payload format (internal):
```json
{
  "type": "weblet-event",
  "event": "user-action",
  "payload": { "action": "clicked-button" },
  "timestamp": 1704067200000,
  "weblet": "budget-dashboard"
}
```

### 4.3 Request/Response Protocol

```
Weblet                          Agent
   |                              |
   |-- request("send-email", {})-->|
   |                              | (evaluate request)
   |                              | (may prompt user)
   |                              | (execute action)
   |<-- response ---------------------|
   |                              |
   | Promise resolves with result |
```

Request format:
```json
{
  "type": "weblet-request",
  "action": "send-email",
  "params": {
    "to": "user@example.com",
    "subject": "Report",
    "body": "..."
  },
  "requestId": "req-123",
  "timestamp": 1704067200000
}
```

Response format:
```json
{
  "type": "weblet-response",
  "requestId": "req-123",
  "success": true,
  "result": { "sent": true, "messageId": "msg-456" }
}
```

### 4.4 Agent-to-Weblet Events

Agents can push events to weblets:

```javascript
// Agent sends event
context._internalEmit("config-updated", { theme: "light" });

// Weblet receives via on()
ctx.on("config-updated", (payload) => {
  applyTheme(payload.theme);
});
```

### 4.5 Graceful Degradation Patterns

**Pattern 1: Feature detection**
```typescript
if (isAgentLaunched()) {
  // Agent-specific UI
  showAgentToolbar();
} else {
  // Standalone UI
  showStandaloneToolbar();
}
```

**Pattern 2: Data source fallback**
```typescript
const expenses = getAgentData("expenses", null);
if (expenses) {
  renderChart(expenses);
} else {
  showUploadForm();
}
```

**Pattern 3: Action fallback**
```typescript
async function saveReport(report) {
  await requestAgentAction(
    "save-file",
    { content: report, filename: "report.pdf" },
    () => downloadFile(report, "report.pdf")  // Fallback: browser download
  );
}
```

---

## 5. Error Handling

| Error Code | Condition | Message |
|------------|-----------|---------|
| E-AGT-001 | Invalid event name | `Invalid event name: {name}. Use lowercase with hyphens.` |
| E-AGT-002 | Payload not serializable | `Event payload must be JSON-serializable` |
| E-AGT-003 | Emit timeout | `Agent did not acknowledge event within 30s` |
| E-AGT-004 | Request denied | `Agent denied request: {action}` |
| E-AGT-005 | Request timeout | `Agent did not respond within 60s` |
| E-AGT-006 | Unknown action | `Agent does not support action: {action}` |
| E-AGT-007 | Context not available | `No agent context available` |

### Error Types

```typescript
class AgentError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AgentError";
  }
}

class AgentTimeoutError extends AgentError {
  constructor(operation: string, timeout: number) {
    super("E-AGT-003", `${operation} timed out after ${timeout}ms`);
  }
}

class AgentDeniedError extends AgentError {
  constructor(action: string, reason?: string) {
    super("E-AGT-004", `Agent denied: ${action}${reason ? ` - ${reason}` : ""}`);
  }
}
```

---

## 6. Dependencies

- **runtime.spec.md**: Runtime may inject context for hosted weblets
- **cli.spec.md**: CLI may provide agent simulation for testing

---

## 7. Acceptance Criteria

- [ ] AC-001: `window.__AGENT_CONTEXT__` is defined when agent launches weblet
- [ ] AC-002: `window.__AGENT_CONTEXT__` is undefined when opened directly
- [ ] AC-003: Context object is frozen (immutable)
- [ ] AC-004: `emit()` successfully sends events to agent
- [ ] AC-005: `request()` receives responses from agent
- [ ] AC-006: `on()` / `off()` correctly manage event subscriptions
- [ ] AC-007: Helper utilities handle missing context gracefully
- [ ] AC-008: Event names are validated against pattern
- [ ] AC-009: Timeouts are enforced for emit and request
- [ ] AC-010: TypeScript types are accurate and complete

---

## 8. Test Scenarios

### TS-AGT-001: Context Available When Agent Launches
```
Given a weblet launched by an agent
When the weblet script accesses window.__AGENT_CONTEXT__
Then it is defined
And agent.name is a non-empty string
And agent.version is a valid semver
```

### TS-AGT-002: Context Undefined for Direct Launch
```
Given a weblet opened directly in browser
When the weblet script accesses window.__AGENT_CONTEXT__
Then it is undefined
```

### TS-AGT-003: Context is Immutable
```
Given an agent context
When I try to modify context.data.foo = "bar"
Then a TypeError is thrown (strict mode)
Or the modification is silently ignored
```

### TS-AGT-004: Emit Event to Agent
```
Given a weblet with agent context
When I call ctx.emit("user-action", { clicked: "save" })
Then the promise resolves
And the agent receives the event with payload
```

### TS-AGT-005: Emit Validates Event Name
```
Given a weblet with agent context
When I call ctx.emit("Invalid Name!", {})
Then the promise rejects with E-AGT-001
```

### TS-AGT-006: Request Agent Action
```
Given a weblet with agent context
And the agent supports "send-email" action
When I call ctx.request("send-email", { to: "a@b.com" })
Then the promise resolves with the result
```

### TS-AGT-007: Request Denied by Agent
```
Given a weblet with agent context
When I request an action the agent denies
Then the promise rejects with AgentDeniedError
```

### TS-AGT-008: Event Subscription
```
Given a weblet with agent context
And I register: ctx.on("theme-changed", handler)
When the agent emits "theme-changed" event
Then the handler is called with the payload
```

### TS-AGT-009: Event Unsubscription
```
Given a registered event handler
When I call ctx.off("theme-changed", handler)
And the agent emits "theme-changed"
Then the handler is NOT called
```

### TS-AGT-010: Helper Graceful Degradation
```
Given NO agent context (direct browser open)
When I call emitToAgent("event", {})
Then it returns false
And no error is thrown
```

### TS-AGT-011: Data Retrieval with Default
```
Given agent context with data: { theme: "dark" }
When I call getAgentData("theme", "light")
Then it returns "dark"
When I call getAgentData("missing", "default")
Then it returns "default"
```

### TS-AGT-012: Request Timeout
```
Given a weblet with agent context
And the agent does not respond
When I call ctx.request("slow-action", {})
Then after 60 seconds the promise rejects with timeout error
```
