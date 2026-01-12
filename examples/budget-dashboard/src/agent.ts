/**
 * Agent integration utilities for budget-dashboard
 *
 * Demonstrates the Agent Context API for Weblets
 */

export interface AgentContext {
  data?: {
    expenses?: Expense[];
    date_range?: {
      start: string;
      end: string;
    };
  };
  config?: {
    chart_type?: "bar" | "line" | "pie";
    theme?: "light" | "dark" | "auto";
  };
  emit?: (event: string, data: unknown) => Promise<void>;
  request?: (action: string, data: unknown) => Promise<unknown>;
  on?: (event: string, handler: (data: unknown) => void) => void;
  off?: (event: string, handler: (data: unknown) => void) => void;
}

export interface Expense {
  id?: string;
  date: string;
  amount: number;
  category: string;
  description: string;
}

declare global {
  interface Window {
    __AGENT_CONTEXT__?: AgentContext;
  }
}

/**
 * Check if the app was launched by an agent
 */
export function isAgentLaunched(): boolean {
  return typeof window.__AGENT_CONTEXT__ !== "undefined";
}

/**
 * Get the agent context (if available)
 */
export function getAgentContext(): AgentContext | null {
  return window.__AGENT_CONTEXT__ || null;
}

/**
 * Get data from agent context with a fallback default
 */
export function getAgentData<T>(key: keyof NonNullable<AgentContext["data"]>, defaultValue: T): T {
  const ctx = getAgentContext();
  if (ctx?.data && key in ctx.data) {
    return (ctx.data[key] as T) ?? defaultValue;
  }
  return defaultValue;
}

/**
 * Get config from agent context with a fallback default
 */
export function getAgentConfig<T>(key: keyof NonNullable<AgentContext["config"]>, defaultValue: T): T {
  const ctx = getAgentContext();
  if (ctx?.config && key in ctx.config) {
    return (ctx.config[key] as T) ?? defaultValue;
  }
  return defaultValue;
}

/**
 * Emit an event to the agent
 */
export async function emitToAgent(event: string, data: unknown): Promise<void> {
  const ctx = getAgentContext();
  if (ctx?.emit) {
    await ctx.emit(event, data);
  }
  // Silent no-op if no agent
}

/**
 * Request an action from the agent
 * Returns true if the agent handled it, false if fallback should be used
 */
export async function requestAgentAction(
  action: string,
  data: unknown,
  fallback?: () => void
): Promise<boolean> {
  const ctx = getAgentContext();
  if (ctx?.request) {
    try {
      await ctx.request(action, data);
      return true;
    } catch {
      // Agent rejected or error, use fallback
      if (fallback) fallback();
      return false;
    }
  }
  // No agent, use fallback
  if (fallback) fallback();
  return false;
}

/**
 * Subscribe to agent events
 */
export function onAgentEvent(event: string, handler: (data: unknown) => void): () => void {
  const ctx = getAgentContext();
  if (ctx?.on) {
    ctx.on(event, handler);
    return () => {
      if (ctx.off) {
        ctx.off(event, handler);
      }
    };
  }
  return () => {}; // No-op unsubscribe
}

/**
 * Get chart type from agent config or default
 */
export function getChartType(): "bar" | "line" | "pie" {
  return getAgentConfig("chart_type", "bar");
}

/**
 * Get theme from agent config or default
 */
export function getTheme(): "light" | "dark" | "auto" {
  return getAgentConfig("theme", "auto");
}

/**
 * Initialize data - tries agent first, then storage, then returns empty
 */
export async function initializeData(): Promise<Expense[]> {
  // Try agent data first
  const agentExpenses = getAgentData<Expense[] | null>("expenses", null);
  if (agentExpenses && agentExpenses.length > 0) {
    return agentExpenses;
  }

  // Try local storage
  const stored = localStorage.getItem("budget_expenses");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Invalid data
    }
  }

  return [];
}

/**
 * Flag an expense - emits to agent
 */
export async function flagExpense(expense: Expense, reason: string): Promise<void> {
  await emitToAgent("expense-flagged", {
    expenseId: expense.id || `${expense.date}-${expense.amount}`,
    expense,
    reason,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Set a budget - emits to agent
 */
export async function setBudget(category: string, amount: number): Promise<void> {
  await emitToAgent("budget-set", {
    category,
    amount,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Export report - tries agent first, falls back to browser download
 */
export async function exportReport(
  format: "csv" | "json",
  data: Expense[],
  downloadFn: () => void
): Promise<void> {
  const handled = await requestAgentAction(
    "export-report",
    { format, data, timestamp: new Date().toISOString() },
    downloadFn
  );

  if (handled) {
    await emitToAgent("report-generated", { format });
  }
}
