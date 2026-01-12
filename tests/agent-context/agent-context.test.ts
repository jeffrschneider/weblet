/**
 * Agent Context Module Tests
 */

import {
  // Types and constants
  EVENT_NAME_PATTERN,
  EMIT_TIMEOUT,
  REQUEST_TIMEOUT,
  MAX_CONTEXT_SIZE,

  // Errors
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

  // Helpers
  isValidEventName,
  isSerializablePayload,

  // Context creation
  createAgentContext,
  createStubContext,
  generateContextInjectionScript,
  generateStubScript,
} from "../../src/agent-context/index.ts";

// =============================================================================
// Test Utilities
// =============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  })();
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// =============================================================================
// Tests
// =============================================================================

async function runTests() {
  console.log("\nAgent Context Module Tests\n");

  // Constants
  console.log("Constants:");

  await test("EVENT_NAME_PATTERN matches valid names", () => {
    assert(EVENT_NAME_PATTERN.test("user-action"), "Should match user-action");
    assert(EVENT_NAME_PATTERN.test("click"), "Should match click");
    assert(EVENT_NAME_PATTERN.test("data-loaded"), "Should match data-loaded");
    assert(EVENT_NAME_PATTERN.test("a1b2c3"), "Should match a1b2c3");
  });

  await test("EVENT_NAME_PATTERN rejects invalid names", () => {
    assert(!EVENT_NAME_PATTERN.test("UserAction"), "Should reject uppercase");
    assert(!EVENT_NAME_PATTERN.test("user_action"), "Should reject underscore");
    assert(!EVENT_NAME_PATTERN.test("123abc"), "Should reject leading number");
    assert(!EVENT_NAME_PATTERN.test(""), "Should reject empty string");
    assert(!EVENT_NAME_PATTERN.test("-action"), "Should reject leading hyphen");
  });

  await test("timeout constants are correct", () => {
    assertEqual(EMIT_TIMEOUT, 30000, "Emit timeout should be 30s");
    assertEqual(REQUEST_TIMEOUT, 60000, "Request timeout should be 60s");
  });

  await test("MAX_CONTEXT_SIZE is 1MB", () => {
    assertEqual(MAX_CONTEXT_SIZE, 1024 * 1024);
  });

  // Error Classes
  console.log("\nError Classes:");

  await test("AgentError has correct properties", () => {
    const error = new AgentError("E-AGT-001", "Test error", { foo: "bar" });
    assertEqual(error.code, "E-AGT-001");
    assertEqual(error.message, "Test error");
    assertEqual((error.details as any).foo, "bar");
    assertEqual(error.name, "AgentError");
  });

  await test("AgentError toJSON works", () => {
    const error = new AgentError("E-AGT-001", "Test", { x: 1 });
    const json = error.toJSON();
    assertEqual(json.code, "E-AGT-001");
    assertEqual(json.message, "Test");
    assertEqual((json.details as any).x, 1);
  });

  await test("AgentInvalidEventError has correct code", () => {
    const error = new AgentInvalidEventError("Bad Name");
    assertEqual(error.code, AgentErrorCodes.INVALID_EVENT_NAME);
    assert(error.message.includes("Bad Name"), "Should include event name");
  });

  await test("AgentInvalidPayloadError has correct code", () => {
    const error = new AgentInvalidPayloadError("circular reference");
    assertEqual(error.code, AgentErrorCodes.INVALID_PAYLOAD);
  });

  await test("AgentEmitTimeoutError has correct code", () => {
    const error = new AgentEmitTimeoutError("test-event", 30000);
    assertEqual(error.code, AgentErrorCodes.EMIT_TIMEOUT);
    assert(error.message.includes("30000"), "Should include timeout");
  });

  await test("AgentDeniedError has correct code", () => {
    const error = new AgentDeniedError("send-email", "not allowed");
    assertEqual(error.code, AgentErrorCodes.REQUEST_DENIED);
    assert(error.message.includes("send-email"), "Should include action");
  });

  await test("AgentRequestTimeoutError has correct code", () => {
    const error = new AgentRequestTimeoutError("slow-action", 60000);
    assertEqual(error.code, AgentErrorCodes.REQUEST_TIMEOUT);
  });

  await test("AgentUnknownActionError has correct code", () => {
    const error = new AgentUnknownActionError("unknown");
    assertEqual(error.code, AgentErrorCodes.UNKNOWN_ACTION);
  });

  await test("AgentNoContextError has correct code", () => {
    const error = new AgentNoContextError();
    assertEqual(error.code, AgentErrorCodes.NO_CONTEXT);
  });

  await test("isAgentError correctly identifies AgentError", () => {
    assert(isAgentError(new AgentError("E-AGT-001", "test")), "Should identify AgentError");
    assert(isAgentError(new AgentDeniedError("test")), "Should identify subclass");
    assert(!isAgentError(new Error("test")), "Should not identify regular Error");
    assert(!isAgentError("string"), "Should not identify string");
  });

  await test("isTimeoutError correctly identifies timeout errors", () => {
    assert(isTimeoutError(new AgentEmitTimeoutError("e", 1000)), "Should identify emit timeout");
    assert(isTimeoutError(new AgentRequestTimeoutError("a", 1000)), "Should identify request timeout");
    assert(!isTimeoutError(new AgentDeniedError("a")), "Should not identify denied error");
  });

  // Validation Helpers
  console.log("\nValidation Helpers:");

  await test("isValidEventName validates correctly", () => {
    assert(isValidEventName("user-action"), "Should accept valid name");
    assert(isValidEventName("click"), "Should accept simple name");
    assert(!isValidEventName("Invalid"), "Should reject uppercase");
    assert(!isValidEventName(""), "Should reject empty");
  });

  await test("isSerializablePayload accepts valid payloads", () => {
    assert(isSerializablePayload(null), "null should be serializable");
    assert(isSerializablePayload(123), "number should be serializable");
    assert(isSerializablePayload("string"), "string should be serializable");
    assert(isSerializablePayload({ foo: "bar" }), "object should be serializable");
    assert(isSerializablePayload([1, 2, 3]), "array should be serializable");
  });

  await test("isSerializablePayload rejects invalid payloads", () => {
    const circular: any = {};
    circular.self = circular;
    assert(!isSerializablePayload(circular), "circular reference should not be serializable");

    assert(!isSerializablePayload(BigInt(123)), "BigInt should not be serializable");
  });

  // Context Creation
  console.log("\nContext Creation:");

  await test("createAgentContext creates valid context", () => {
    const ctx = createAgentContext({
      agentName: "test-agent",
      agentVersion: "1.0.0",
      capabilities: ["text", "code"],
      data: { foo: "bar" },
      config: { theme: "dark" },
    });

    assertEqual(ctx.agent.name, "test-agent");
    assertEqual(ctx.agent.version, "1.0.0");
    assertEqual(ctx.agent.capabilities.length, 2);
    assertEqual(ctx.data.foo, "bar");
    assertEqual(ctx.config.theme, "dark");
  });

  await test("createAgentContext freezes objects", () => {
    const ctx = createAgentContext({
      agentName: "test",
      agentVersion: "1.0.0",
    });

    assert(Object.isFrozen(ctx), "Context should be frozen");
    assert(Object.isFrozen(ctx.agent), "Agent should be frozen");
    assert(Object.isFrozen(ctx.data), "Data should be frozen");
    assert(Object.isFrozen(ctx.config), "Config should be frozen");
  });

  await test("createAgentContext emit validates event name", async () => {
    const ctx = createAgentContext({
      agentName: "test",
      agentVersion: "1.0.0",
    });

    try {
      await ctx.emit("Invalid Name");
      throw new Error("Should have thrown");
    } catch (error) {
      assert(error instanceof AgentInvalidEventError, "Should throw AgentInvalidEventError");
    }
  });

  await test("createAgentContext emit validates payload", async () => {
    const ctx = createAgentContext({
      agentName: "test",
      agentVersion: "1.0.0",
    });

    const circular: any = {};
    circular.self = circular;

    try {
      await ctx.emit("test-event", circular);
      throw new Error("Should have thrown");
    } catch (error) {
      assert(error instanceof AgentInvalidPayloadError, "Should throw AgentInvalidPayloadError");
    }
  });

  await test("createAgentContext emit calls onEmit handler", async () => {
    let emittedEvent = "";
    let emittedPayload: unknown;

    const ctx = createAgentContext({
      agentName: "test",
      agentVersion: "1.0.0",
      onEmit: async (event, payload) => {
        emittedEvent = event;
        emittedPayload = payload;
      },
    });

    await ctx.emit("test-event", { data: 123 });

    assertEqual(emittedEvent, "test-event");
    assertEqual((emittedPayload as any).data, 123);
  });

  await test("createAgentContext request calls onRequest handler", async () => {
    const ctx = createAgentContext({
      agentName: "test",
      agentVersion: "1.0.0",
      onRequest: async (action, params) => {
        if (action === "get-value") {
          return { value: 42 };
        }
        throw new Error("Unknown action");
      },
    });

    const result = await ctx.request<{ value: number }>("get-value", {});
    assertEqual(result.value, 42);
  });

  await test("createAgentContext on/off manages handlers", () => {
    const ctx = createAgentContext({
      agentName: "test",
      agentVersion: "1.0.0",
    }) as any; // Access internal

    let called = false;
    const handler = () => { called = true; };

    ctx.on("test-event", handler);
    ctx._internalEmit("test-event", {});
    assert(called, "Handler should be called");

    called = false;
    ctx.off("test-event", handler);
    ctx._internalEmit("test-event", {});
    assert(!called, "Handler should not be called after off()");
  });

  await test("createStubContext creates no-op context", () => {
    const ctx = createStubContext();

    assertEqual(ctx.agent.name, "stub");
    assertEqual(ctx.agent.version, "0.0.0");
    assert(Object.isFrozen(ctx), "Should be frozen");
  });

  // Script Generation
  console.log("\nScript Generation:");

  await test("generateContextInjectionScript creates valid script", () => {
    const ctx = createAgentContext({
      agentName: "test",
      agentVersion: "1.0.0",
      data: { foo: "bar" },
    });

    const script = generateContextInjectionScript(ctx);

    assert(script.includes("<script>"), "Should contain script tag");
    assert(script.includes("</script>"), "Should close script tag");
    assert(script.includes("__AGENT_CONTEXT__"), "Should set context");
    assert(script.includes("test"), "Should include agent name");
    assert(script.includes("foo"), "Should include data");
  });

  await test("generateStubScript creates stub script", () => {
    const script = generateStubScript();

    assert(script.includes("<script>"), "Should contain script tag");
    assert(script.includes("__AGENT_CONTEXT__"), "Should reference context");
  });

  // Summary
  console.log(`\n${"─".repeat(40)}`);
  console.log(`Agent Context Tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
